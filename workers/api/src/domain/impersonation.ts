/**
 * Administrator impersonation ("view as").
 *
 * Guardrails that are enforced here or by the request guard in index.ts:
 * - Only an `agency_admin` may start a session, and never for another admin.
 * - The target must be an active user in the same agency.
 * - Sessions are short lived and every start/stop is written to
 *   `security_audit_logs`, so the trail survives token expiry.
 * - An impersonated token is read-only: the guard rejects every state-changing
 *   request, so a support session can never sign a consent, move money, change a
 *   profile or grant another impersonation.
 */

import { badRequest, forbidden, notFound } from '../lib/http.ts';
import { ulid } from '../lib/ids.ts';
import { recordSecurityEvent } from './hardeningMfa.ts';
import type { UserRole } from './stateMachine.ts';

/** Impersonation never outlives a normal access token, and is capped at 15 minutes. */
export const IMPERSONATION_TTL_SECONDS = 900;

const STARTED_EVENT = 'IMPERSONATION_STARTED';
const STOPPED_EVENT = 'IMPERSONATION_STOPPED';

export interface ImpersonationTarget {
  id: string;
  email: string;
  role: UserRole;
  fullName: string;
}

export interface StartedImpersonation {
  impersonationId: string;
  expiresAt: number;
  target: ImpersonationTarget;
}

interface TargetRow {
  id: string;
  email: string;
  role: string;
  full_name: string;
  is_active: number;
}

function toRole(value: string): UserRole {
  return value as UserRole;
}

export async function startImpersonation(params: {
  db: D1Database;
  agencyId: string;
  adminUserId: string;
  adminRole: UserRole;
  targetUserId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  ttlSeconds?: number;
}): Promise<StartedImpersonation> {
  const { db, agencyId, adminUserId, adminRole, targetUserId } = params;

  if (adminRole !== 'agency_admin') {
    throw forbidden('Only an administrator may impersonate a user');
  }
  if (targetUserId === adminUserId) {
    throw badRequest('SELF_IMPERSONATION', 'You cannot impersonate your own account');
  }

  const row = await db
    .prepare('SELECT id, email, role, full_name, is_active FROM users WHERE id = ? AND agency_id = ?')
    .bind(targetUserId, agencyId)
    .first<TargetRow>();

  if (!row) {
    throw notFound('User not found');
  }
  if (row.is_active !== 1) {
    throw badRequest('INACTIVE_USER', 'Cannot impersonate a disabled account');
  }
  if (row.role === 'agency_admin') {
    throw forbidden('Administrators cannot impersonate other administrators');
  }

  const impersonationId = ulid();
  const expiresAt =
    Math.floor(Date.now() / 1000) + (params.ttlSeconds ?? IMPERSONATION_TTL_SECONDS);

  await recordSecurityEvent({
    db,
    agencyId,
    userId: adminUserId,
    eventType: STARTED_EVENT,
    ipAddress: params.ipAddress ?? null,
    userAgent: params.userAgent ?? null,
    details: JSON.stringify({
      impersonationId,
      impersonatedBy: adminUserId,
      targetUserId: row.id,
      targetRole: row.role,
      expiresAt,
    }),
  });

  return {
    impersonationId,
    expiresAt,
    target: {
      id: row.id,
      email: row.email,
      role: toRole(row.role),
      fullName: row.full_name,
    },
  };
}

export async function stopImpersonation(params: {
  db: D1Database;
  agencyId: string;
  impersonationId: string;
  impersonatedBy: string;
  resumedUserId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  await recordSecurityEvent({
    db: params.db,
    agencyId: params.agencyId,
    userId: params.resumedUserId,
    eventType: STOPPED_EVENT,
    ipAddress: params.ipAddress ?? null,
    userAgent: params.userAgent ?? null,
    details: JSON.stringify({
      impersonationId: params.impersonationId,
      impersonatedBy: params.impersonatedBy,
      resumedUserId: params.resumedUserId,
      stoppedAt: Math.floor(Date.now() / 1000),
    }),
  });
}

/**
 * Server-side revocation: a stopped session is rejected even though its token is
 * still inside its TTL. Key order in the JSON detail is stable, so the LIKE
 * lookup matches the row written by {@link stopImpersonation}.
 */
export async function isImpersonationEnded(params: {
  db: D1Database;
  agencyId: string;
  impersonationId: string;
}): Promise<boolean> {
  const row = await params.db
    .prepare(
      `SELECT id FROM security_audit_logs
       WHERE agency_id = ? AND event_type = ? AND details LIKE ?
       LIMIT 1`,
    )
    .bind(params.agencyId, STOPPED_EVENT, `%"impersonationId":"${params.impersonationId}"%`)
    .first<{ id: string }>();

  return row !== null;
}
