/**
 * Administrator impersonation routes.
 *
 * - POST /admin/impersonate       — mint a read-only token for another user
 * - POST /admin/impersonate/stop  — end the current impersonation session
 * - GET  /admin/users             — the accounts an admin may view as
 */

import { requireActor, requireNotImpersonating, requireRole, signAccessToken } from '../lib/auth.ts';
import { badRequest, json } from '../lib/http.ts';
import {
  IMPERSONATION_TTL_SECONDS,
  startImpersonation,
  stopImpersonation,
} from '../domain/impersonation.ts';
import type { RouteContext } from '../router.ts';

function requestContext(ctx: RouteContext): { ipAddress: string | null; userAgent: string | null } {
  return {
    ipAddress: ctx.request.headers.get('cf-connecting-ip') ?? ctx.request.headers.get('x-forwarded-for'),
    userAgent: ctx.request.headers.get('user-agent'),
  };
}

export async function impersonateUser(ctx: RouteContext): Promise<Response> {
  const actor = await requireRole(ctx, 'agency_admin');
  requireNotImpersonating(actor, 'impersonate another user');

  const body = (await ctx.request.json().catch(() => null)) as { userId?: string } | null;
  const targetUserId = typeof body?.userId === 'string' ? body.userId.trim() : '';
  if (!targetUserId) {
    throw badRequest('INVALID_PAYLOAD', 'userId is required');
  }

  const { ipAddress, userAgent } = requestContext(ctx);

  const started = await startImpersonation({
    db: ctx.env.DB,
    agencyId: actor.agencyId,
    adminUserId: actor.userId,
    adminRole: actor.role,
    targetUserId,
    ipAddress,
    userAgent,
  });

  const token = await signAccessToken(
    {
      userId: started.target.id,
      agencyId: actor.agencyId,
      role: started.target.role,
      impersonatedBy: actor.userId,
      impersonationId: started.impersonationId,
    },
    ctx.env.JWT_SIGNING_KEY,
    IMPERSONATION_TTL_SECONDS,
  );

  return json({
    token,
    impersonation: {
      id: started.impersonationId,
      expiresAt: started.expiresAt,
      impersonatedBy: actor.userId,
      targetUser: started.target,
    },
  });
}

export async function stopImpersonationHandler(ctx: RouteContext): Promise<Response> {
  const actor = await requireActor(ctx);
  if (!actor.impersonationId || !actor.impersonatedBy) {
    throw badRequest('NOT_IMPERSONATING', 'This session is not impersonating a user');
  }

  const { ipAddress, userAgent } = requestContext(ctx);

  await stopImpersonation({
    db: ctx.env.DB,
    agencyId: actor.agencyId,
    impersonationId: actor.impersonationId,
    impersonatedBy: actor.impersonatedBy,
    resumedUserId: actor.userId,
    ipAddress,
    userAgent,
  });

  return json({ stopped: true, impersonationId: actor.impersonationId });
}

export async function listImpersonatableUsers(ctx: RouteContext): Promise<Response> {
  const actor = await requireRole(ctx, 'agency_admin');
  requireNotImpersonating(actor, 'list users');

  const rows = await ctx.env.DB.prepare(
    `SELECT id, email, role, full_name, is_active
     FROM users
     WHERE agency_id = ? AND role <> 'agency_admin'
     ORDER BY role, email
     LIMIT 200`,
  )
    .bind(actor.agencyId)
    .all<{ id: string; email: string; role: string; full_name: string; is_active: number }>();

  return json({
    users: rows.results.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      fullName: row.full_name,
      isActive: row.is_active,
    })),
  });
}
