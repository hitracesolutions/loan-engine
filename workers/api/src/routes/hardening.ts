/**
 * Security Hardening, MFA & Audit Routes.
 *
 * Implements Sprint 7:
 * - Privileged-user MFA activation and verification.
 * - Rate limiting and security event audit logs.
 */

import { recordSecurityEvent, setupMfa, verifyMfa } from '../domain/hardeningMfa.ts';
import { requireActor, requireRole } from '../lib/auth.ts';
import { badRequest, json, unauthorized } from '../lib/http.ts';
import type { RouteContext } from '../router.ts';

export async function setupMfaHandler(ctx: RouteContext): Promise<Response> {
  const actor = await requireActor(ctx);

  const result = await setupMfa({
    db: ctx.env.DB,
    agencyId: actor.agencyId,
    userId: actor.userId,
  });

  return json(result, 201);
}

export async function verifyMfaHandler(ctx: RouteContext): Promise<Response> {
  const actor = await requireActor(ctx);

  const body = await ctx.request.json().catch(() => null) as {
    code?: string;
  } | null;

  if (!body?.code?.trim()) {
    throw badRequest('INVALID_PAYLOAD', 'MFA code is required');
  }

  const ipAddress = ctx.request.headers.get('cf-connecting-ip') ?? ctx.request.headers.get('x-forwarded-for');
  const userAgent = ctx.request.headers.get('user-agent');

  const verified = await verifyMfa({
    db: ctx.env.DB,
    agencyId: actor.agencyId,
    userId: actor.userId,
    code: body.code.trim(),
    ipAddress,
    userAgent,
  });

  if (!verified) {
    throw unauthorized('Invalid MFA code');
  }

  return json({ verified: true });
}

export async function listSecurityAuditLogs(ctx: RouteContext): Promise<Response> {
  const actor = await requireRole(ctx, 'agency_admin', 'auditor');

  const logs = await ctx.env.DB.prepare(
    `SELECT * FROM security_audit_logs WHERE agency_id = ? ORDER BY created_at DESC LIMIT 100`,
  )
    .bind(actor.agencyId)
    .all();

  return json({ logs: logs.results });
}
