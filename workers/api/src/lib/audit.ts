/**
 * Append-only audit trail. Every guarded mutation records one row here.
 */

import { ulid } from './ids.ts';

export interface AuditEventInput {
  agencyId: string;
  actorId: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  details?: Record<string, unknown>;
}

export function auditStatement(db: D1Database, event: AuditEventInput): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO audit_events
         (id, agency_id, actor_id, action, resource_type, resource_id, details, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      ulid(),
      event.agencyId,
      event.actorId,
      event.action,
      event.resourceType,
      event.resourceId,
      event.details === undefined ? null : JSON.stringify(event.details),
      Date.now(),
    );
}
