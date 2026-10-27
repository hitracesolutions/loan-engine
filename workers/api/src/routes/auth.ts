import { auditStatement } from '../lib/audit.ts';
import {
  USER_ROLES,
  hashPassword,
  requireActor,
  signAccessToken,
  verifyPassword,
} from '../lib/auth.ts';
import type { AppEnv } from '../env.ts';
import type { UserRole } from '../domain/stateMachine.ts';
import { conflict, jsonResponse, readJsonObject, unauthorized } from '../lib/http.ts';
import { ulid } from '../lib/ids.ts';
import { optionalString, requireEmail, requirePassword, requirePersonName } from '../lib/validation.ts';
import type { RouteContext } from '../router.ts';

const DEFAULT_AGENCY_SLUG = 'gidfine';

interface UserRow {
  id: string;
  agency_id: string;
  role: string;
  email: string;
  phone: string | null;
  full_name: string;
  password_hash: string;
  is_active: number;
  created_at: number;
}

function publicUser(row: UserRow) {
  return {
    id: row.id,
    agencyId: row.agency_id,
    role: row.role,
    email: row.email,
    phone: row.phone,
    fullName: row.full_name,
    createdAt: row.created_at,
  };
}

async function resolveAgencyId(db: D1Database, slug: string | null): Promise<string> {
  const row = await db
    .prepare('SELECT id FROM agencies WHERE slug = ?')
    .bind(slug ?? DEFAULT_AGENCY_SLUG)
    .first<{ id: string }>();

  if (!row) {
    throw conflict('AGENCY_NOT_FOUND', 'Unknown agency');
  }
  return row.id;
}

/** Narrows a stored role string to the compile-time union (the column has a CHECK constraint). */
function toRole(value: string): UserRole {
  if (!(USER_ROLES as readonly string[]).includes(value)) {
    throw new Error(`Unrecognised stored role: ${value}`);
  }
  return value as UserRole;
}

async function issueToken(
  env: AppEnv,
  user: { id: string; agency_id: string; role: string },
): Promise<string> {
  const ttl = Number(env.ACCESS_TOKEN_TTL_SECONDS) || 900;
  return signAccessToken(
    { userId: user.id, agencyId: user.agency_id, role: toRole(user.role) },
    env.JWT_SIGNING_KEY,
    ttl,
  );
}

/** POST /auth/register — self-service borrower signup. */
export async function register({ request, env, requestId }: RouteContext): Promise<Response> {
  const body = await readJsonObject(request);
  const email = requireEmail(body);
  const password = requirePassword(body);
  const fullName = requirePersonName(body);
  const phone = optionalString(body, 'phone', 32);
  const agencySlug = optionalString(body, 'agencySlug', 64);
  const agencyId = await resolveAgencyId(env.DB, agencySlug);

  const existing = await env.DB.prepare(
    'SELECT id FROM users WHERE agency_id = ? AND lower(email) = ?',
  )
    .bind(agencyId, email)
    .first<{ id: string }>();

  if (existing) {
    throw conflict('EMAIL_TAKEN', 'An account with that email already exists');
  }

  const now = Date.now();
  const user: UserRow = {
    id: ulid(now),
    agency_id: agencyId,
    role: 'borrower',
    email,
    phone,
    full_name: fullName,
    password_hash: await hashPassword(password),
    is_active: 1,
    created_at: now,
  };

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO users (id, agency_id, role, email, phone, full_name, password_hash, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    ).bind(
      user.id,
      user.agency_id,
      user.role,
      user.email,
      user.phone,
      user.full_name,
      user.password_hash,
      now,
      now,
    ),
    auditStatement(env.DB, {
      agencyId,
      actorId: user.id,
      action: 'USER_REGISTERED',
      resourceType: 'user',
      resourceId: user.id,
      details: { role: user.role },
    }),
  ]);

  return jsonResponse(
    { token: await issueToken(env, user), user: publicUser(user) },
    requestId,
    201,
  );
}

/** POST /auth/login — email + password, constant-ish failure response. */
export async function login({ request, env, requestId }: RouteContext): Promise<Response> {
  const body = await readJsonObject(request);
  const email = requireEmail(body);
  const password = requirePassword(body);
  const agencySlug = optionalString(body, 'agencySlug', 64);
  const agencyId = await resolveAgencyId(env.DB, agencySlug);

  const user = await env.DB.prepare(
    'SELECT * FROM users WHERE agency_id = ? AND lower(email) = ?',
  )
    .bind(agencyId, email)
    .first<UserRow>();

  // Same message and status for unknown user and wrong password.
  const invalid = unauthorized('Invalid email or password');
  if (!user) throw invalid;
  if (!(await verifyPassword(password, user.password_hash))) throw invalid;
  if (user.is_active !== 1) throw unauthorized('Account is disabled');

  return jsonResponse({ token: await issueToken(env, user), user: publicUser(user) }, requestId);
}

/** GET /auth/me — echoes the authenticated principal. */
export async function me({ request, env, requestId }: RouteContext): Promise<Response> {
  const actor = await requireActor(request, env.JWT_SIGNING_KEY);

  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ? AND agency_id = ?')
    .bind(actor.userId, actor.agencyId)
    .first<UserRow>();

  if (!user) throw unauthorized('Account no longer exists');

  return jsonResponse({ user: publicUser(user) }, requestId);
}
