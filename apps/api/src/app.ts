import "reflect-metadata";
import { randomUUID, createHash, timingSafeEqual } from "node:crypto";
import {
  Controller,
  Get,
  Module,
  ForbiddenException,
  Inject,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { json } from "express";
import type { Request, Response, NextFunction } from "express";
import { config } from "./config";
import { Database } from "./db";
import { AuthService, AuthGuard, AuthController } from "./auth";
import { WorkspaceService } from "./workspace";
import { WorkspaceController } from "./controller";
import { ErrorFilter } from "./http";
import { isDemo } from "./demo";
@Controller("health")
class HealthController {
  @Get() health() {
    return { status: "ok", application: "FlowDesk", independentDemo: true };
  }
}
@Controller("ready")
class ReadyController {
  constructor(@Inject(Database) private readonly db: Database) {}
  @Get() async ready() {
    await this.db.client.$queryRaw`SELECT 1`;
    return { status: "ready" };
  }
}
@Module({
  controllers: [
    AuthController,
    WorkspaceController,
    HealthController,
    ReadyController,
  ],
  providers: [Database, AuthService, AuthGuard, WorkspaceService],
})
class AppModule {}
export async function createApp() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: config.NODE_ENV === "test" ? false : ["error", "warn"],
    bodyParser: false,
  });
  app.setGlobalPrefix("api");
  app.set("trust proxy", config.TRUST_PROXY === "true" ? 1 : false);
  app.use(helmet());
  let windowStart = Date.now(),
    requests = 0,
    active = 0,
    passwordChecks = 0;
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!isDemo || (req.method === "GET" && req.path === "/api/health"))
      return next();
    res.setHeader("Cache-Control", "no-store");
    const fail = (status: number, message: string) =>
      res.status(status).json({ error: { message } });
    const supplied = req.headers["x-flowdesk-proxy"];
    if (
      typeof supplied !== "string" ||
      supplied.length > 256 ||
      !timingSafeEqual(
        createHash("sha256").update(supplied).digest(),
        createHash("sha256").update(config.PROXY_SECRET!).digest(),
      )
    )
      return fail(403, "Use the FlowDesk web application.");
    if (Date.now() - windowStart >= 60000) {
      windowStart = Date.now();
      requests = 0;
    }
    if (++requests > 120 || active >= 8)
      return fail(429, "The shared demo is busy. Try again shortly.");
    if (req.method === "DELETE" || req.path === "/api/auth/register")
      return fail(403, "This action is disabled in the shared demo.");
    const login = req.path === "/api/auth/login";
    if (login && passwordChecks >= 2)
      return fail(429, "The shared demo is busy. Try again shortly.");
    active++;
    if (login) passwordChecks++;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      active--;
      if (login) passwordChecks--;
    };
    res.once("finish", release);
    res.once("close", release);
    next();
  });
  app.use(json({ limit: "20kb" }));
  app.use(
    (error: unknown, _req: Request, res: Response, next: NextFunction) => {
      const type =
        typeof error === "object" && error && "type" in error
          ? error.type
          : undefined;
      if (type !== "entity.parse.failed" && type !== "entity.too.large")
        return next(error);
      const requestId = randomUUID();
      res.setHeader("X-Request-Id", requestId);
      res.setHeader("Cache-Control", "no-store");
      res.status(type === "entity.too.large" ? 413 : 400).json({
        error: {
          code:
            type === "entity.too.large" ? "REQUEST_TOO_LARGE" : "INVALID_JSON",
          message:
            type === "entity.too.large"
              ? "The request exceeds the allowed size."
              : "Submit a valid JSON request.",
        },
        requestId,
      });
    },
  );
  app.use(cookieParser());
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Cache-Control", "no-store");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      (req.headers.origin !== config.WEB_ORIGIN ||
        req.headers["x-flowdesk-request"] !== "1")
    )
      return next(new ForbiddenException("Request origin is not permitted."));
    next();
  });
  app.enableCors({
    origin: config.WEB_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-FlowDesk-Request"],
  });
  app.useGlobalFilters(new ErrorFilter());
  app.enableShutdownHooks();
  return app;
}
