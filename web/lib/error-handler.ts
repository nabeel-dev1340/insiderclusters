import "server-only";
import { logger } from "./logger";

export interface AppError extends Error {
  statusCode?: number;
  userMessage?: string;
}

export function createAppError(
  message: string,
  statusCode: number = 500,
  userMessage?: string
): AppError {
  const err = new Error(message) as AppError;
  err.statusCode = statusCode;
  err.userMessage = userMessage || "An error occurred. Please try again.";
  return err;
}

export function handleError(
  err: unknown,
  context: string,
  requestId?: string
): { status: number; userMessage: string } {
  const error = err instanceof Error ? err : new Error(String(err));
  const appError = error as AppError;

  const status = appError.statusCode || 500;
  const userMessage =
    appError.userMessage ||
    (status === 404
      ? "Not found"
      : status === 429
        ? "Too many requests. Please try again later."
        : "An error occurred. Please try again.");

  // Log full error server-side with request ID for tracking
  logger.error(context, error.message, {
    statusCode: status,
    requestId,
    stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
  });

  return { status, userMessage };
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof Error && "statusCode" in err;
}
