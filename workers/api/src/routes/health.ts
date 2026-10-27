import { jsonResponse } from '../lib/http.ts';
import type { RouteContext } from '../router.ts';

/** Liveness probe used by CI and the deploy smoke test. */
export async function health({ env, requestId }: RouteContext): Promise<Response> {
  let database: 'ok' | 'error' = 'ok';
  let detail: string | undefined;

  try {
    await env.DB.prepare('SELECT 1').first();
  } catch (error) {
    database = 'error';
    detail = error instanceof Error ? error.message : 'unknown database error';
  }

  return jsonResponse(
    {
      service: env.APP_NAME,
      environment: env.APP_ENV,
      database,
      ...(detail === undefined ? {} : { detail }),
      time: new Date().toISOString(),
    },
    requestId,
    database === 'ok' ? 200 : 503,
  );
}
