/**
 * Response Utilities — Standardized API responses
 */

import type { ErrorResponse } from "../types";

export function success(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function error(message: string, code: string, status = 400, details?: any) {
  const payload: ErrorResponse = {
    error: message,
    code,
    timestamp: new Date().toISOString(),
    ...(details && { details }),
  };

  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function created(data: any) {
  return success(data, 201);
}

export function notFound(message = "Resource not found") {
  return error(message, "NOT_FOUND", 404);
}

export function badRequest(message: string, details?: any) {
  return error(message, "BAD_REQUEST", 400, details);
}

export function unauthorized(message = "Unauthorized") {
  return error(message, "UNAUTHORIZED", 401);
}

export function forbidden(message = "Forbidden") {
  return error(message, "FORBIDDEN", 403);
}

export function rateLimit(remaining: number, resetAt: number) {
  return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "X-RateLimit-Remaining": String(remaining),
      "X-RateLimit-Reset": String(Math.floor(resetAt / 1000)),
    },
  });
}

export function serverError(message = "Internal server error") {
  return error(message, "INTERNAL_ERROR", 500);
}

export function methodNotAllowed() {
  return error("Method not allowed", "METHOD_NOT_ALLOWED", 405);
}
