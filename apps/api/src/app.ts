import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { Controller, Get, Module, ForbiddenException } from "@nestjs/common";
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
@Controller("health")
class HealthController {
  @Get() health() {
    return { status: "ok", application: "FlowDesk", independentDemo: true };
  }
}
@Module({
  controllers: [AuthController, WorkspaceController, HealthController],
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
