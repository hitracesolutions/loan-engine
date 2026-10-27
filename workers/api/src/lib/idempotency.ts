import { ulid } from './ids.ts';
import { conflict } from './http.ts';

/**
 * Replays the stored response for a repeated (agencyId, key) pair so a retried
 * client request cannot create a second record.
 *
 * Returns `undefined` when the key has not been used yet.
 */
export async function findIdempotentResponse(
  db: D1Database,
  agencyId: string,
  key: string | null,
): Promise<unknown | undefined> {
  if (!key) return undefined;

  const row = await db
    .prepare('SELECT response_body FROM idempotency_keys WHERE agency_id = ? AND key = ?')
    .bind(agencyId, key)
    .first<{ response_body: string }>();

  return row ? (JSON.parse(row.response_body) as unknown) : undefined;
}

export function idempotencyStatement(
  db: D1Database,
  agencyId: string,
  key: string | null,
  scope: string,
  response: unknown,
): D1PreparedStatement | null {
  if (!key) return null;

  return db
    .prepare(
      `INSERT INTO idempotency_keys (agency_id, key, scope, response_body, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(agencyId, key, scope, JSON.stringify(response), Date.now());
}

/** Rejects a request whose Idempotency-Key is already bound to a different operation. */
export async function assertKeyScope(db: D1Database, agencyId: string, key: string, scope: string) {
  const row = await db
    .prepare('SELECT scope FROM idempotency_keys WHERE agency_id = ? AND key = ?')
    .bind(agencyId, key)
    .first<{ scope: string }>();

  if (row && row.scope !== scope) {
    throw conflict('IDEMPOTENCY_KEY_REUSED', 'Idempotency-Key was already used for another operation');
  }
  return row !== null;
}

export const newIdempotencyKey = () => ulid();
