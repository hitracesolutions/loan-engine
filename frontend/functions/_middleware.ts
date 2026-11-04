import worker, { isApiPath } from '../../workers/api/src/index.ts';
import type { AppEnv } from '../../workers/api/src/env.ts';

/**
 * Single same-origin API entrypoint for Cloudflare Pages.
 *
 * Every request whose first path segment is owned by the Worker router (see
 * `isApiPath`) is forwarded to the shared router, giving the deployed Pages
 * site parity with the standalone Worker for ALL routes (S-01). Any other path
 * — the SPA's client routes and static assets — falls through to Pages'
 * static-asset handling via `next()`.
 */
interface MiddlewareContext {
  request: Request;
  env: AppEnv;
  next: () => Promise<Response>;
}

export function onRequest(context: MiddlewareContext): Promise<Response> {
  const { pathname } = new URL(context.request.url);
  if (isApiPath(pathname)) {
    return worker.fetch(context.request, context.env);
  }
  return context.next();
}
