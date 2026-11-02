/**
 * Request-level enforcement for impersonated sessions.
 *
 * Runs before the router so a new route cannot forget the rule: impersonated
 * tokens may read, and may end their own session, and nothing else.
 */

import { isImpersonationEnded } from '../domain/impersonation.ts';
import type { AppEnv } from '../env.ts';
import { verifyAccessToken } from './auth.ts';
import { forbidden, unauthorized } from './http.ts';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** The only state-changing route an impersonated session may call. */
const IMPERSONATION_ALLOWED_MUTATIONS = new Set(['/admin/impersonate/stop']);

function decodePayloadForPeek(token: string): Record<string, unknown> | null {
  const [, encodedPayload] = token.split('.');
  if (!encodedPayload) return null;
  try {
    const normalized = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Rejects revoked sessions and state-changing requests from impersonated tokens.
 *
 * The payload is decoded without verification first, only to decide whether the
 * extra work is needed. Anything that claims to be impersonated is then verified
 * properly before any decision is taken, so the peek cannot be used to bypass
 * the guard.
 */
export async function enforceImpersonationScope(request: Request, env: AppEnv): Promise<void> {
  const header = request.headers.get('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return;

  const peeked = decodePayloadForPeek(token);
  if (typeof peeked?.imp !== 'string' || peeked.imp.length === 0) return;

  const claims = await verifyAccessToken(token, env.JWT_SIGNING_KEY);
  if (!claims.imp || !claims.act) return;

  const ended = await isImpersonationEnded({
    db: env.DB,
    agencyId: claims.agencyId,
    impersonationId: claims.imp,
  });
  if (ended) {
    throw unauthorized('Impersonation session has ended');
  }

  const method = request.method.toUpperCase();
  if (SAFE_METHODS.has(method)) return;

  const pathname = new URL(request.url).pathname;
  if (IMPERSONATION_ALLOWED_MUTATIONS.has(pathname)) return;

  throw forbidden('Impersonated sessions are read-only; exit impersonation to perform this action');
}
