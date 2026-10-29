/**
 * Gidfine API Worker entrypoint.
 *
 * The API is backed by the current D1 schema in migrations/0001_core.sql.
 * Keep route registration here so local Wrangler, tests, and deployed Workers
 * all execute the same handlers.
 */

import type { AppEnv } from './env.ts';
import { ensureAdminUser } from './lib/auth.ts';
import { corsHeaders, errorResponse } from './lib/http.ts';
import {
  addApplicationReviewNote,
  assignApplication,
  createApplication,
  getApplicationReview,
  listApplications,
  reviewApplication,
} from './routes/applications.ts';
import { login, me, register } from './routes/auth.ts';
import { health } from './routes/health.ts';
import { Router } from './router.ts';

const router = new Router()
  .get('/health', health)
  .post('/auth/login', login)
  .post('/auth/register', register)
  .get('/auth/me', me)
  .post('/applications', createApplication)
  .get('/applications', listApplications)
  .get('/applications/:applicationId/review', getApplicationReview)
  .post('/applications/:applicationId/assign', assignApplication)
  .post('/applications/:applicationId/review', reviewApplication)
  .post('/applications/:applicationId/notes', addApplicationReviewNote)
  .get('/agency/applications', listApplications)
  // Preserve the path used by the current frontend while it migrates to the
  // shorter resource-oriented API paths.
  .post('/borrower/applications', createApplication)
  .get('/borrower/applications', listApplications);

let adminInitialization:
  | { configuration: string; promise: Promise<void> }
  | undefined;

function initializeAdmin(env: AppEnv): Promise<void> {
  // Pages secrets can be attached after an isolate has already handled a
  // request. Retry when the configured admin identity changes from missing to
  // available instead of permanently caching the initial no-op.
  const configuration = `${env.ADMIN_EMAIL?.trim().toLowerCase() ?? ''}|${env.ADMIN_PASSWORD ? 'configured' : 'missing'}`;
  if (!adminInitialization || adminInitialization.configuration !== configuration) {
    adminInitialization = {
      configuration,
      promise: ensureAdminUser(env).catch((error) => {
        console.error('[AUTH] Admin initialization failed:', error);
      }),
    };
  }
  return adminInitialization.promise;
}

function withRequestHeaders(
  response: Response,
  requestId: string,
  origin: string | null,
  allowedOrigins: string,
): Response {
  const headers = new Headers(response.headers);
  const cors = corsHeaders(origin, allowedOrigins);
  cors.forEach((value, key) => headers.set(key, value));
  headers.set('x-request-id', requestId);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function handleRequest(request: Request, env: AppEnv): Promise<Response> {
  const requestId = crypto.randomUUID();
  const origin = request.headers.get('origin');

  if (request.method === 'OPTIONS') {
    return withRequestHeaders(
      new Response(null, { status: 204 }),
      requestId,
      origin,
      env.ALLOWED_ORIGINS,
    );
  }

  try {
    const url = new URL(request.url);
    const { handler, params } = router.match(request.method, url.pathname);
    const response = await handler({ request, env, url, params, requestId });
    return withRequestHeaders(response, requestId, origin, env.ALLOWED_ORIGINS);
  } catch (error) {
    return withRequestHeaders(errorResponse(error, requestId), requestId, origin, env.ALLOWED_ORIGINS);
  }
}

export default {
  async fetch(request: Request, env: AppEnv) {
    await initializeAdmin(env);
    return handleRequest(request, env);
  },
};
