import type { AppEnv } from './env.ts';
import { Router, type RouteContext } from './router.ts';
import { StateTransitionError } from './domain/stateMachine.ts';
import {
  HttpError,
  corsHeaders,
  errorResponse,
} from './lib/http.ts';
import { ulid } from './lib/ids.ts';
import { health } from './routes/health.ts';
import { login, me, register } from './routes/auth.ts';
import { createApplication, listApplications } from './routes/applications.ts';

const router = new Router()
  .get('/health', health)
  .post('/auth/register', register)
  .post('/auth/login', login)
  .get('/auth/me', me)
  .post('/applications', createApplication)
  .get('/applications', listApplications);

function toHttpError(error: unknown): unknown {
  // Map domain guard failures onto 409 so clients can branch on the code.
  if (error instanceof StateTransitionError) {
    return new HttpError(409, error.code, error.message);
  }
  return error;
}

export default {
  async fetch(request: Request, env: AppEnv): Promise<Response> {
    const requestId = ulid();
    const url = new URL(request.url);
    const origin = request.headers.get('origin');
    const cors = corsHeaders(origin, env.ALLOWED_ORIGINS);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    try {
      const { handler, params } = router.match(request.method, url.pathname);
      const ctx: RouteContext = { request, env, url, params, requestId };
      const response = await handler(ctx);

      cors.forEach((value, key) => response.headers.set(key, value));
      response.headers.set('x-request-id', requestId);
      response.headers.set('x-content-type-options', 'nosniff');
      response.headers.set('referrer-policy', 'no-referrer');
      return response;
    } catch (error) {
      const response = errorResponse(toHttpError(error), requestId);
      cors.forEach((value, key) => response.headers.set(key, value));
      response.headers.set('x-request-id', requestId);
      return response;
    }
  },
} satisfies ExportedHandler<AppEnv>;
