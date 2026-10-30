/**
 * Document Metadata & Asynchronous Outbox Routes.
 *
 * Implements Sprint 6:
 * - Document metadata registration and SHA-256 verification.
 * - Private access controls for borrower loan documents.
 * - Outbox status tracking and simulated batch dispatch.
 */

import {
  enqueueNotification,
  processOutboxBatch,
  registerDocument,
  type DocumentType,
  type EntityType,
} from '../domain/documentsAndOutbox.ts';
import { requireActor, requireRole } from '../lib/auth.ts';
import { badRequest, json } from '../lib/http.ts';
import type { RouteContext } from '../router.ts';

export async function createDocumentRecord(ctx: RouteContext): Promise<Response> {
  const actor = await requireActor(ctx);

  const body = await ctx.request.json().catch(() => null) as {
    entityType?: EntityType;
    entityId?: string;
    documentType?: DocumentType;
    filename?: string;
    storageKey?: string;
    content?: string;
  } | null;

  if (
    !body?.entityType ||
    !body?.entityId ||
    !body?.documentType ||
    !body?.filename ||
    !body?.storageKey ||
    !body?.content
  ) {
    throw badRequest('INVALID_PAYLOAD', 'Missing required document fields');
  }

  const result = await registerDocument({
    db: ctx.env.DB,
    agencyId: actor.agencyId,
    entityType: body.entityType,
    entityId: body.entityId,
    documentType: body.documentType,
    filename: body.filename,
    storageKey: body.storageKey,
    content: body.content,
    createdBy: actor.userId,
  });

  return json(result, 201);
}

export async function listDocuments(ctx: RouteContext): Promise<Response> {
  const actor = await requireActor(ctx);
  const entityType = ctx.url.searchParams.get('entityType');
  const entityId = ctx.url.searchParams.get('entityId');

  let query = `SELECT * FROM document_records WHERE agency_id = ?`;
  const params: any[] = [actor.agencyId];

  if (entityType) {
    query += ` AND entity_type = ?`;
    params.push(entityType);
  }
  if (entityId) {
    query += ` AND entity_id = ?`;
    params.push(entityId);
  }

  query += ` ORDER BY created_at DESC`;

  const docs = await ctx.env.DB.prepare(query).bind(...params).all();
  return json({ documents: docs.results });
}

export async function listOutboxEvents(ctx: RouteContext): Promise<Response> {
  const actor = await requireRole(ctx, 'agency_admin', 'auditor');

  const events = await ctx.env.DB.prepare(
    `SELECT * FROM outbox_events WHERE agency_id = ? ORDER BY created_at DESC LIMIT 50`,
  )
    .bind(actor.agencyId)
    .all();

  return json({ events: events.results });
}

export async function triggerOutboxBatch(ctx: RouteContext): Promise<Response> {
  await requireRole(ctx, 'agency_admin');
  const result = await processOutboxBatch(ctx.env.DB, 20);
  return json(result);
}
