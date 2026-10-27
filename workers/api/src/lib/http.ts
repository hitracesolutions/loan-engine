/**
 * HTTP plumbing: typed errors, JSON envelopes, request ids, CORS.
 *
 * Every response uses one envelope so the client never has to guess:
 *   success: { ok: true, data: <payload>, requestId }
 *   failure: { ok: false, error: { code, message, details? }, requestId }
 */

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (code: string, message: string, details?: unknown) =>
  new HttpError(400, code, message, details);

export const unauthorized = (message = 'Authentication required') =>
  new HttpError(401, 'UNAUTHENTICATED', message);

export const forbidden = (message = 'Not permitted') =>
  new HttpError(403, 'FORBIDDEN', message);

export const notFound = (message = 'Not found') => new HttpError(404, 'NOT_FOUND', message);

export const conflict = (code: string, message: string) => new HttpError(409, code, message);

export function jsonResponse(data: unknown, requestId: string, status = 200): Response {
  return new Response(JSON.stringify({ ok: true, data, requestId }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export function errorResponse(error: unknown, requestId: string): Response {
  const httpError =
    error instanceof HttpError
      ? error
      : new HttpError(500, 'INTERNAL_ERROR', 'Unexpected server error');

  if (httpError.status >= 500) {
    // Log the real failure; never leak it to the caller.
    console.error(
      JSON.stringify({
        level: 'error',
        requestId,
        code: httpError.code,
        message: httpError.message,
        stack: error instanceof Error ? error.stack : undefined,
      }),
    );
  }

  return new Response(
    JSON.stringify({
      ok: false,
      error: {
        code: httpError.code,
        message: httpError.message,
        ...(httpError.details === undefined ? {} : { details: httpError.details }),
      },
      requestId,
    }),
    {
      status: httpError.status,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    },
  );
}

export function corsHeaders(origin: string | null, allowedOrigins: string): Headers {
  const headers = new Headers({
    vary: 'origin',
    'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization,idempotency-key',
    'access-control-max-age': '86400',
  });

  const allowList = allowedOrigins
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (origin && allowList.includes(origin)) {
    headers.set('access-control-allow-origin', origin);
  }

  return headers;
}

/** Reads the JSON body, rejecting anything that is not a JSON object. */
export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw badRequest('INVALID_CONTENT_TYPE', 'Expected Content-Type: application/json');
  }

  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    throw badRequest('INVALID_JSON', 'Request body is not valid JSON');
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw badRequest('INVALID_BODY', 'Request body must be a JSON object');
  }

  return parsed as Record<string, unknown>;
}
