import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  Inject,
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ConflictException,
  HttpException,
  UseGuards,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { hash, verify, Algorithm } from "@node-rs/argon2";
import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import type { Request, Response } from "express";
import {
  loginSchema,
  registerSchema,
  id as idSchema,
  type RegisterInput,
} from "@flowdesk/contracts";
import type { Prisma } from "@flowdesk/database";
import { Database } from "./db";
import { config, cookieNames } from "./config";
import { ZodPipe } from "./http";
export type AuthRequest = Request & {
  identity: { userId: string; sessionId: string };
};
export const passwordOptions = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 1,
};
const digest = (token: string) =>
  createHash("sha256").update(token).digest("hex");
const safeUser = { id: true, name: true, email: true } as const;
@Injectable()
export class AuthService {
  private readonly jwt = new JwtService({ secret: config.JWT_SECRET });
  private readonly dummy = hash(
    "unavailable-account-" + randomBytes(24).toString("hex"),
    passwordOptions,
  );
  constructor(@Inject(Database) private readonly db: Database) {}
  private lock(tx: Prisma.TransactionClient, userId: string) {
    return tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${userId},0))`;
  }
  async throttle(ip: string, path: string) {
    const now = new Date(),
      window = Math.floor(now.getTime() / 60000);
    const key = digest(`${ip}|${path}|${window}`);
    const row = await this.db.client.authThrottle.upsert({
      where: { key },
      create: { key, expiresAt: new Date((window + 1) * 60000) },
      update: { count: { increment: 1 } },
    });
    await this.db.client.authThrottle.deleteMany({
      where: { expiresAt: { lt: now } },
    });
    if (row.count > 30)
      throw new HttpException(
        "Too many attempts. Try again in one minute.",
        429,
      );
  }
  async register(data: RegisterInput) {
    if (await this.db.client.user.findUnique({ where: { email: data.email } }))
      throw new ConflictException(
        "An account cannot be created with these details.",
      );
    return this.db.client.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash: await hash(data.password, passwordOptions),
      },
      select: safeUser,
    });
  }
  async login(email: string, password: string) {
    const user = await this.db.client.user.findUnique({ where: { email } });
    const valid = await verify(
      user?.passwordHash || (await this.dummy),
      password,
    );
    if (!user || !valid)
      throw new UnauthorizedException("Email or password is incorrect.");
    return { id: user.id, name: user.name, email: user.email };
  }
  async issue(userId: string) {
    const sessionId = randomUUID(),
      secret = randomBytes(32).toString("base64url");
    await this.db.client.$transaction(async (tx) => {
      await this.lock(tx, userId);
      await tx.refreshSession.create({
        data: {
          id: sessionId,
          familyId: randomUUID(),
          userId,
          tokenHash: digest(secret),
          expiresAt: new Date(Date.now() + 7 * 86400000),
        },
      });
    });
    return this.tokens(userId, sessionId, secret);
  }
  private async tokens(userId: string, sessionId: string, secret: string) {
    return {
      access: await this.jwt.signAsync(
        { sub: userId, sid: sessionId },
        {
          expiresIn: "10m",
          issuer: "flowdesk",
          audience: "flowdesk-web",
          algorithm: "HS256",
        },
      ),
      refresh: `${sessionId}.${secret}`,
    };
  }
  async authenticate(token?: string) {
    if (!token) throw new UnauthorizedException("Sign in to continue.");
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; sid: string }>(
        token,
        { issuer: "flowdesk", audience: "flowdesk-web", algorithms: ["HS256"] },
      );
      if (typeof payload.sub !== "string" || typeof payload.sid !== "string")
        throw new Error();
      const session = await this.db.client.refreshSession.findFirst({
        where: {
          id: payload.sid,
          userId: payload.sub,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
      });
      if (!session) throw new Error();
      return { userId: payload.sub, sessionId: payload.sid };
    } catch {
      throw new UnauthorizedException("Your session has ended. Sign in again.");
    }
  }
  async rotate(token?: string) {
    if (!token || !/^([0-9a-f-]{36})\.([A-Za-z0-9_-]{43})$/.test(token))
      throw new UnauthorizedException("Your session has ended.");
    const [sessionId, secret] = token.split(".");
    if (!idSchema.safeParse(sessionId).success)
      throw new UnauthorizedException("Your session has ended.");
    const result = await this.db.client.$transaction(async (tx) => {
      const lookup = await tx.refreshSession.findUnique({
        where: { id: sessionId },
      });
      if (!lookup) return null;
      await this.lock(tx, lookup.userId);
      const current = await tx.refreshSession.findUnique({
        where: { id: sessionId },
      });
      if (!current) return null;
      const actual = Buffer.from(digest(secret), "hex"),
        expected = Buffer.from(current.tokenHash, "hex");
      if (
        current.revokedAt ||
        current.expiresAt <= new Date() ||
        !timingSafeEqual(actual, expected)
      ) {
        await tx.refreshSession.updateMany({
          where: { familyId: current.familyId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        return null;
      }
      await tx.refreshSession.update({
        where: { id: current.id },
        data: { revokedAt: new Date() },
      });
      const nextSecret = randomBytes(32).toString("base64url");
      const next = await tx.refreshSession.create({
        data: {
          familyId: current.familyId,
          userId: current.userId,
          tokenHash: digest(nextSecret),
          expiresAt: current.expiresAt,
        },
      });
      return { userId: current.userId, id: next.id, secret: nextSecret };
    });
    if (!result)
      throw new UnauthorizedException("Your session has ended. Sign in again.");
    return this.tokens(result.userId, result.id, result.secret);
  }
  cookies(res: Response, tokens: { access: string; refresh: string }) {
    const common = {
      httpOnly: true,
      secure: config.NODE_ENV === "production",
      sameSite: "lax" as const,
    };
    res.cookie(cookieNames.access, tokens.access, {
      ...common,
      path: "/",
      maxAge: 10 * 60000,
    });
    res.cookie(cookieNames.refresh, tokens.refresh, {
      ...common,
      path: "/api/auth",
      maxAge: 7 * 86400000,
    });
  }
  clear(res: Response) {
    res.clearCookie(cookieNames.access, {
      path: "/",
      httpOnly: true,
      secure: config.NODE_ENV === "production",
      sameSite: "lax",
    });
    res.clearCookie(cookieNames.refresh, {
      path: "/api/auth",
      httpOnly: true,
      secure: config.NODE_ENV === "production",
      sameSite: "lax",
    });
  }
  async logout(token?: string) {
    if (!token) return;
    const id = token.split(".")[0];
    if (!idSchema.safeParse(id).success) return;
    await this.db.client.$transaction(async (tx) => {
      const lookup = await tx.refreshSession.findUnique({ where: { id } });
      if (!lookup) return;
      await this.lock(tx, lookup.userId);
      const session = await tx.refreshSession.findUnique({ where: { id } });
      if (
        session &&
        timingSafeEqual(
          Buffer.from(session.tokenHash, "hex"),
          Buffer.from(digest(token.split(".")[1] || ""), "hex"),
        )
      )
        await tx.refreshSession.updateMany({
          where: { familyId: session.familyId },
          data: { revokedAt: new Date() },
        });
    });
  }
  async logoutAll(userId: string) {
    await this.db.client.$transaction(async (tx) => {
      await this.lock(tx, userId);
      await tx.refreshSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }
  async me(userId: string) {
    return {
      user: await this.db.client.user.findUniqueOrThrow({
        where: { id: userId },
        select: safeUser,
      }),
      memberships: await this.db.client.membership.findMany({
        where: { userId, active: true },
        include: { organization: true, user: { select: safeUser } },
      }),
    };
  }
}
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    req.identity = await this.auth.authenticate(
      req.cookies?.[cookieNames.access],
    );
    return true;
  }
}
@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}
  @Post("register") async register(
    @Body(new ZodPipe(registerSchema)) data: RegisterInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.throttle(req.ip || "unknown", "register");
    const user = await this.auth.register(data);
    this.auth.cookies(res, await this.auth.issue(user.id));
    return { user };
  }
  @Post("login") async login(
    @Body(new ZodPipe(loginSchema)) data: { email: string; password: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.throttle(req.ip || "unknown", "login");
    const user = await this.auth.login(data.email, data.password);
    this.auth.cookies(res, await this.auth.issue(user.id));
    return { user };
  }
  @Post("refresh") async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.throttle(req.ip || "unknown", "refresh");
    try {
      this.auth.cookies(
        res,
        await this.auth.rotate(req.cookies?.[cookieNames.refresh]),
      );
      return { ok: true };
    } catch (e) {
      this.auth.clear(res);
      throw e;
    }
  }
  @Post("logout") async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logout(req.cookies?.[cookieNames.refresh]);
    this.auth.clear(res);
    return { ok: true };
  }
  @UseGuards(AuthGuard) @Post("logout-all") async logoutAll(
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logoutAll(req.identity.userId);
    this.auth.clear(res);
    return { ok: true };
  }
  @UseGuards(AuthGuard) @Get("me") me(@Req() req: AuthRequest) {
    return this.auth.me(req.identity.userId);
  }
}
