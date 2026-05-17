import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { env } from "../config/env.js";
import { HttpError } from "../utils/httpError.js";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "Validation error",
      details: err.flatten(),
    });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({
      error: err.message,
      ...(env.NODE_ENV === "development" && err.details
        ? { details: err.details }
        : {}),
    });
  }
  if (env.NODE_ENV === "development") {
    console.error(err);
  }
  return res.status(500).json({
    error: "Internal Server Error",
    ...(env.NODE_ENV === "development" && err instanceof Error
      ? { message: err.message }
      : {}),
  });
}
