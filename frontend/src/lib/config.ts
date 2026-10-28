/**
 * Single source of truth for the API origin.
 *
 * Resolution order:
 *   1. VITE_API_BASE — set per environment in Cloudflare Pages.
 *      VITE_API_URL is accepted only during local development, so a stale
 *      production variable cannot route traffic to a retired Worker hostname.
 *   2. Development   -> the local Worker (`wrangler dev`).
 *   3. Production    -> same origin, for deployments that mount the Worker on the
 *                       Pages domain. A warning is logged so a missing build
 *                       variable is never silent.
 *
 * There is deliberately no hard-coded production host: an unset variable must
 * never route traffic to a retired backend.
 */
function resolveApiBase(): string {
  const configured = (
    import.meta.env.VITE_API_BASE ?? (import.meta.env.DEV ? import.meta.env.VITE_API_URL : '') ?? ''
  ).trim().replace(/\/+$/, '');
  if (configured) return configured;

  if (import.meta.env.DEV) return 'http://localhost:8787';

  console.warn(
    '[gidfine] VITE_API_BASE is not set; falling back to same-origin API calls. ' +
      'Set it in the Cloudflare Pages build environment.',
  );
  return '';
}

export const API_BASE = resolveApiBase();

/** Builds an absolute API URL. */
export function apiUrl(path: string): string {
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

/** WebSocket origin derived from the REST base, used for the session Durable Object route. */
export function apiSocketBase(): string {
  const base = API_BASE || window.location.origin;
  return base.replace(/^http/, 'ws');
}

