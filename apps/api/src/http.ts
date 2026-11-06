import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  PipeTransform,
  Injectable,
  BadRequestException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { ZodError, ZodType } from "zod";
import type { Response } from "express";
@Catch()
export class ErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    let status = 500,
      message = "The request could not be completed.",
      code = "INTERNAL_ERROR";
    let details: unknown;
    if (error instanceof ZodError) {
      status = 400;
      code = "VALIDATION_ERROR";
      message = "Check the submitted fields.";
      details = error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      }));
    } else if (error instanceof HttpException) {
      status = error.getStatus();
      message = error.message;
      code =
        (
          {
            400: "INVALID_REQUEST",
            401: "UNAUTHENTICATED",
            403: "FORBIDDEN",
            404: "NOT_FOUND",
            409: "CONFLICT",
            429: "RATE_LIMITED",
          } as Record<number, string>
        )[status] || "REQUEST_FAILED";
    } else if (
      typeof error === "object" &&
      error &&
      "type" in error &&
      error.type === "entity.parse.failed"
    ) {
      status = 400;
      code = "INVALID_JSON";
      message = "Submit a valid JSON request.";
    } else if (
      typeof error === "object" &&
      error &&
      "type" in error &&
      error.type === "entity.too.large"
    ) {
      status = 413;
      code = "REQUEST_TOO_LARGE";
      message = "The request exceeds the allowed size.";
    } else if (typeof error === "object" && error && "code" in error) {
      if (error.code === "P2002") {
        status = 409;
        code = "CONFLICT";
        message = "This record already exists.";
      } else if (error.code === "P2003") {
        status = 409;
        code = "REFERENCE_CONFLICT";
        message =
          "This record is referenced by other work or has an invalid relationship.";
      }
    }
    const requestId = randomUUID();
    res.setHeader("X-Request-Id", requestId);
    res.status(status).json({
      error: { code, message, ...(details ? { details } : {}) },
      requestId,
    });
  }
}
@Injectable()
export class ZodPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}
  transform(value: unknown) {
    return this.schema.parse(value);
  }
}
export function uuid(value: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new BadRequestException("Invalid resource identifier.");
  return value;
}
