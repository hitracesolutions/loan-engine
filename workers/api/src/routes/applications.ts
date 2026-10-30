import { auditStatement } from '../lib/audit.ts';
import { requireActor } from '../lib/auth.ts';
import { badRequest, forbidden, jsonResponse, notFound, readJsonObject } from '../lib/http.ts';
import { assertKeyScope, findIdempotentResponse, idempotencyStatement } from '../lib/idempotency.ts';
import { ulid } from '../lib/ids.ts';
import { assertPositiveInteger, assertPositivePesewas } from '../lib/money.ts';
import { optionalString, requireString } from '../lib/validation.ts';
import type { RouteContext } from '../router.ts';
import {
  APPLICATION_STATUSES,
  validateStateTransition,
  type ApplicationStatus,
} from '../domain/stateMachine.ts';

const MAX_TENURE_MONTHS = 480;
const MAX_PRINCIPAL_PESEWAS = 10_000_000_00; // GH₵ 10,000,000.00
const CREATION_SCOPE = 'applications.create';

const AGENCY_STAFF_ROLES = ['agency_admin', 'loan_officer', 'underwriter'] as const;
const REVIEW_READER_ROLES = ['agency_admin', 'loan_officer', 'underwriter', 'auditor'] as const;

interface ApplicationRow {
  id: string;
  agency_id: string;
  borrower_id: string;
  status: string;
  requested_amount_pesewas: number;
  tenure_months: number;
  purpose: string | null;
  assigned_lender_id: string | null;
  rejection_reason: string | null;
  created_at: number;
  updated_at: number;
  borrower_name?: string | null;
  notes_count?: number;
}

interface ApplicationNoteRow {
  id: string;
  agency_id: string;
  application_id: string;
  author_id: string;
  note_text: string;
  is_internal: number;
  created_at: number;
  author_name?: string;
  author_role?: string;
}

function toPublic(row: ApplicationRow) {
  return {
    id: row.id,
    borrowerId: row.borrower_id,
    borrowerName: row.borrower_name ?? null,
    status: row.status as ApplicationStatus,
    requestedAmountPesewas: row.requested_amount_pesewas,
    tenureMonths: row.tenure_months,
    purpose: row.purpose,
    rejectionReason: row.rejection_reason ?? null,
    notesCount: Number(row.notes_count ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** POST /applications — borrower submits a loan request. */
export async function createApplication({ request, env, requestId }: RouteContext): Promise<Response> {
  const actor = await requireActor(request, env.JWT_SIGNING_KEY);
  if (actor.role !== 'borrower') {
    throw forbidden('Only a borrower may submit an application');
  }

  const idempotencyKey = request.headers.get('idempotency-key');
  if (idempotencyKey) {
    await assertKeyScope(env.DB, actor.agencyId, idempotencyKey, CREATION_SCOPE);
    const replayed = await findIdempotentResponse(env.DB, actor.agencyId, idempotencyKey);
    if (replayed !== undefined) {
      return jsonResponse(replayed, requestId);
    }
  }

  const body = await readJsonObject(request);
  const requestedAmountPesewas = assertPositivePesewas(body.requestedAmountPesewas, 'requestedAmountPesewas');
  if (requestedAmountPesewas > MAX_PRINCIPAL_PESEWAS) {
    throw badRequest('AMOUNT_TOO_LARGE', 'Requested amount exceeds the permitted maximum');
  }
  const tenureMonths = assertPositiveInteger(body.tenureMonths, 'tenureMonths', MAX_TENURE_MONTHS);
  const purpose = optionalString(body, 'purpose', 200);

  const now = Date.now();
  const application: ApplicationRow = {
    id: ulid(now),
    agency_id: actor.agencyId,
    borrower_id: actor.userId,
    status: 'SUBMITTED',
    requested_amount_pesewas: requestedAmountPesewas,
    tenure_months: tenureMonths,
    purpose,
    assigned_lender_id: null,
    rejection_reason: null,
    created_at: now,
    updated_at: now,
  };

  const payload = toPublic(application);
  const statements: D1PreparedStatement[] = [
    env.DB.prepare(
      `INSERT INTO loan_applications
         (id, agency_id, borrower_id, status, requested_amount_pesewas, tenure_months, purpose,
          assigned_lender_id, rejection_reason, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)`,
    ).bind(
      application.id,
      application.agency_id,
      application.borrower_id,
      application.status,
      application.requested_amount_pesewas,
      application.tenure_months,
      application.purpose,
      application.created_at,
      application.updated_at,
    ),
    auditStatement(env.DB, {
      agencyId: actor.agencyId,
      actorId: actor.userId,
      action: 'APPLICATION_SUBMITTED',
      resourceType: 'loan_application',
      resourceId: application.id,
      details: {
        requestedAmountPesewas,
        tenureMonths,
      },
    }),
  ];

  const idempotency = idempotencyStatement(env.DB, actor.agencyId, idempotencyKey, CREATION_SCOPE, payload);
  if (idempotency) statements.push(idempotency);

  await env.DB.batch(statements);

  return jsonResponse(payload, requestId, 201);
}

/** GET /applications — borrower sees their own; agency staff see the tenant queue. */
export async function listApplications({ request, env, requestId }: RouteContext): Promise<Response> {
  const actor = await requireActor(request, env.JWT_SIGNING_KEY);
  const isAgencyStaff = REVIEW_READER_ROLES.includes(actor.role as any);

  if (actor.role !== 'borrower' && !isAgencyStaff) {
    throw forbidden('This role cannot list applications');
  }

  const query = isAgencyStaff
    ? env.DB.prepare(
        `SELECT a.*,
                u.full_name as borrower_name,
                (SELECT count(*) FROM application_notes WHERE application_id = a.id) as notes_count
         FROM loan_applications a
         JOIN users u ON u.id = a.borrower_id
         WHERE a.agency_id = ?
         ORDER BY a.created_at DESC
         LIMIT 100`,
      ).bind(actor.agencyId)
    : env.DB.prepare(
        `SELECT a.*,
                (SELECT count(*) FROM application_notes WHERE application_id = a.id) as notes_count
         FROM loan_applications a
         WHERE a.agency_id = ? AND a.borrower_id = ?
         ORDER BY a.created_at DESC
         LIMIT 100`,
      ).bind(actor.agencyId, actor.userId);

  const { results } = await query.all<ApplicationRow>();
  return jsonResponse({ applications: results.map(toPublic) }, requestId);
}

/**
 * POST /applications/:id/notes
 * Agency staff records an internal review note.
 * Strictly prohibited for borrowers.
 */
export async function addApplicationNote({ request, env, params, requestId }: RouteContext): Promise<Response> {
  const actor = await requireActor(request, env.JWT_SIGNING_KEY);
  if (!AGENCY_STAFF_ROLES.includes(actor.role as any)) {
    throw forbidden('Only agency review staff may record internal notes');
  }

  const applicationId = params.id;
  if (!applicationId) {
    throw badRequest('MISSING_ID', 'Application ID is required');
  }

  // Tenant-scoped lookup
  const app = await env.DB.prepare(
    'SELECT id, agency_id FROM loan_applications WHERE agency_id = ? AND id = ?',
  )
    .bind(actor.agencyId, applicationId)
    .first<{ id: string; agency_id: string }>();

  if (!app) {
    throw notFound('Application not found');
  }

  const body = await readJsonObject(request);
  const noteText =
    optionalString(body, 'noteText', 2000) || optionalString(body, 'note', 2000);
  if (!noteText || noteText.trim().length === 0) {
    throw badRequest('MISSING_NOTE', 'Note content cannot be empty');
  }

  const now = Date.now();
  const noteId = ulid(now);

  const statements: D1PreparedStatement[] = [
    env.DB.prepare(
      `INSERT INTO application_notes
         (id, agency_id, application_id, author_id, note_text, is_internal, created_at)
       VALUES (?, ?, ?, ?, ?, 1, ?)`,
    ).bind(noteId, actor.agencyId, applicationId, actor.userId, noteText, now),
    auditStatement(env.DB, {
      agencyId: actor.agencyId,
      actorId: actor.userId,
      action: 'APPLICATION_NOTE_ADDED',
      resourceType: 'application_note',
      resourceId: noteId,
      details: {
        applicationId,
      },
    }),
  ];

  await env.DB.batch(statements);

  const noteResult = {
    id: noteId,
    applicationId,
    authorId: actor.userId,
    authorRole: actor.role,
    noteText,
    note: noteText,
    isInternal: true,
    createdAt: now,
  };

  return jsonResponse(
    {
      ...noteResult,
      note: noteResult,
    },
    requestId,
    201,
  );
}

/**
 * GET /applications/:id/notes
 * Retrieves all review notes for an application.
 * Staff-only endpoint. Borrowers are strictly forbidden.
 */
export async function listApplicationNotes({ request, env, params, requestId }: RouteContext): Promise<Response> {
  const actor = await requireActor(request, env.JWT_SIGNING_KEY);
  if (!REVIEW_READER_ROLES.includes(actor.role as any)) {
    throw forbidden('Borrowers are not permitted to view internal review notes');
  }

  const applicationId = params.id;
  if (!applicationId) {
    throw badRequest('MISSING_ID', 'Application ID is required');
  }

  const app = await env.DB.prepare(
    'SELECT id, agency_id FROM loan_applications WHERE agency_id = ? AND id = ?',
  )
    .bind(actor.agencyId, applicationId)
    .first<{ id: string; agency_id: string }>();

  if (!app) {
    throw notFound('Application not found');
  }

  const { results } = await env.DB.prepare(
    `SELECT n.id, n.agency_id, n.application_id, n.author_id, n.note_text, n.is_internal, n.created_at,
            u.full_name as author_name, u.role as author_role
     FROM application_notes n
     JOIN users u ON u.id = n.author_id
     WHERE n.agency_id = ? AND n.application_id = ?
     ORDER BY n.created_at ASC`,
  )
    .bind(actor.agencyId, applicationId)
    .all<ApplicationNoteRow>();

  return jsonResponse(
    {
      notes: results.map((n) => ({
        id: n.id,
        applicationId: n.application_id,
        authorId: n.author_id,
        authorName: n.author_name ?? 'Staff',
        authorRole: n.author_role ?? 'loan_officer',
        author_name: n.author_name ?? 'Staff',
        author_role: n.author_role ?? 'loan_officer',
        noteText: n.note_text,
        note: n.note_text,
        isInternal: Boolean(n.is_internal),
        createdAt: n.created_at,
      })),
    },
    requestId,
  );
}

/**
 * Verifies server-verifiable borrower response evidence directly from trusted database records.
 * Client-provided booleans are strictly ignored and cannot authorize transitions.
 */
async function verifyBorrowerResponseEvidence(
  db: D1Database,
  agencyId: string,
  applicationId: string,
  borrowerId: string,
): Promise<boolean> {
  // 1. Locate timestamp when the application was last transitioned to MORE_INFO_REQUIRED
  const auditRow = await db
    .prepare(
      `SELECT created_at FROM audit_events
       WHERE agency_id = ? AND resource_id = ? AND action = 'APPLICATION_STATUS_TRANSITION'
         AND json_extract(details, '$.targetStatus') = 'MORE_INFO_REQUIRED'
       ORDER BY created_at DESC LIMIT 1`,
    )
    .bind(agencyId, applicationId)
    .first<{ created_at: number }>();

  const requestedAt = auditRow?.created_at ?? 0;

  // 2. Query trusted borrower_responses table for response authored by the owning borrower
  // within the same agency and application, created at or after the information request.
  const responseRow = await db
    .prepare(
      `SELECT id, created_at FROM borrower_responses
       WHERE agency_id = ? AND application_id = ? AND borrower_id = ?
         AND created_at >= ?
       ORDER BY created_at DESC LIMIT 1`,
    )
    .bind(agencyId, applicationId, borrowerId, requestedAt)
    .first<{ id: string; created_at: number }>();

  return Boolean(responseRow);
}

/**
 * POST /applications/:id/response
 * Authenticated borrower submits verified response evidence for an application in MORE_INFO_REQUIRED status.
 */
export async function submitBorrowerResponse({
  request,
  env,
  params,
  requestId,
}: RouteContext): Promise<Response> {
  const actor = await requireActor(request, env.JWT_SIGNING_KEY);
  if (actor.role !== 'borrower') {
    throw forbidden('Only an applicant borrower may submit a response');
  }

  const applicationId = params.id;
  if (!applicationId) {
    throw badRequest('MISSING_ID', 'Application ID is required');
  }

  const app = await env.DB.prepare(
    'SELECT * FROM loan_applications WHERE agency_id = ? AND borrower_id = ? AND id = ?',
  )
    .bind(actor.agencyId, actor.userId, applicationId)
    .first<ApplicationRow>();

  if (!app) {
    throw notFound('Application not found');
  }

  if (app.status !== 'MORE_INFO_REQUIRED') {
    throw badRequest(
      'INVALID_STATUS',
      `Cannot submit response: application is currently in '${app.status}' status, not 'MORE_INFO_REQUIRED'`,
    );
  }

  const body = await readJsonObject(request);
  const responseText =
    optionalString(body, 'response', 3000) ||
    optionalString(body, 'responseText', 3000) ||
    optionalString(body, 'message', 3000);

  if (!responseText || responseText.trim().length === 0) {
    throw badRequest('MISSING_RESPONSE_TEXT', 'Response text cannot be empty');
  }

  const now = Date.now();
  const responseId = ulid(now);

  const statements: D1PreparedStatement[] = [
    env.DB.prepare(
      `INSERT INTO borrower_responses
         (id, agency_id, application_id, borrower_id, response_text, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(responseId, actor.agencyId, applicationId, actor.userId, responseText.trim(), now),
    auditStatement(env.DB, {
      agencyId: actor.agencyId,
      actorId: actor.userId,
      action: 'BORROWER_RESPONSE_SUBMITTED',
      resourceType: 'borrower_response',
      resourceId: responseId,
      details: {
        applicationId,
        length: responseText.trim().length,
      },
    }),
  ];

  await env.DB.batch(statements);

  return jsonResponse(
    {
      id: responseId,
      applicationId,
      borrowerId: actor.userId,
      responseText: responseText.trim(),
      createdAt: now,
    },
    requestId,
    201,
  );
}

/**
 * POST /applications/:id/transition
 * Executes a validated application state transition.
 * Enforces agency authorization, cancellation ownership, and mandatory rejection reasons.
 */
export async function transitionApplication({ request, env, params, requestId }: RouteContext): Promise<Response> {
  const actor = await requireActor(request, env.JWT_SIGNING_KEY);
  const applicationId = params.id;
  if (!applicationId) {
    throw badRequest('MISSING_ID', 'Application ID is required');
  }

  // Enforce borrower scoping: borrowers can only find their own application
  const app = actor.role === 'borrower'
    ? await env.DB.prepare(
        'SELECT * FROM loan_applications WHERE agency_id = ? AND borrower_id = ? AND id = ?',
      )
        .bind(actor.agencyId, actor.userId, applicationId)
        .first<ApplicationRow>()
    : await env.DB.prepare(
        'SELECT * FROM loan_applications WHERE agency_id = ? AND id = ?',
      )
        .bind(actor.agencyId, applicationId)
        .first<ApplicationRow>();

  if (!app) {
    throw notFound('Application not found');
  }

  const body = await readJsonObject(request);
  const targetStatusRaw =
    optionalString(body, 'targetStatus', 30) || optionalString(body, 'toStatus', 30);
  if (!targetStatusRaw || !APPLICATION_STATUSES.includes(targetStatusRaw as ApplicationStatus)) {
    throw badRequest('INVALID_TARGET_STATUS', `Unrecognised application status: ${targetStatusRaw ?? 'missing'}`);
  }
  const targetStatus = targetStatusRaw as ApplicationStatus;

  const reason = optionalString(body, 'reason', 500) || optionalString(body, 'rejectionReason', 500);
  const note = optionalString(body, 'note', 2000) || optionalString(body, 'noteText', 2000);

  // Rejection requires a non-empty recorded reason
  if (targetStatus === 'AGENCY_REJECTED') {
    if (!reason || reason.trim().length === 0) {
      throw badRequest('REJECTION_REASON_REQUIRED', 'A recorded rejection reason is required to reject an application');
    }
  }

  // Resubmission from MORE_INFO_REQUIRED strictly requires server-verified evidence.
  // Client-supplied booleans (hasBorrowerResponse, hasResponse) are completely ignored.
  let hasBorrowerResponse = false;
  if (app.status === 'MORE_INFO_REQUIRED' && targetStatus === 'UNDER_REVIEW') {
    hasBorrowerResponse = await verifyBorrowerResponseEvidence(
      env.DB,
      actor.agencyId,
      applicationId,
      app.borrower_id,
    );
  }

  // Validate state machine rules & non-bypass guards
  try {
    validateStateTransition({
      applicationId: app.id,
      applicationAgencyId: app.agency_id,
      actorUserId: actor.userId,
      actorAgencyId: actor.agencyId,
      actorRole: actor.role,
      currentStatus: app.status as ApplicationStatus,
      targetStatus,
      borrowerId: app.borrower_id,
      assignedLenderId: app.assigned_lender_id,
      hasValidConsentSnapshot: false,
      rejectionReason: reason,
      hasBorrowerResponse,
    });
  } catch (err: any) {
    if (err.name === 'StateTransitionError') {
      if (err.code === 'TENANT_ISOLATION_VIOLATION' || err.code === 'BORROWER_MISMATCH') {
        throw forbidden(err.message);
      }
      throw badRequest(err.code, err.message);
    }
    throw err;
  }

  const now = Date.now();
  const rejectionReason = targetStatus === 'AGENCY_REJECTED' ? reason : app.rejection_reason;

  const statements: D1PreparedStatement[] = [
    env.DB.prepare(
      `UPDATE loan_applications SET
         status = ?,
         rejection_reason = ?,
         updated_at = ?
       WHERE agency_id = ? AND id = ?`,
    ).bind(targetStatus, rejectionReason, now, actor.agencyId, applicationId),
    auditStatement(env.DB, {
      agencyId: actor.agencyId,
      actorId: actor.userId,
      action: 'APPLICATION_STATUS_TRANSITION',
      resourceType: 'loan_application',
      resourceId: applicationId,
      details: {
        previousStatus: app.status,
        targetStatus,
        reason: reason ?? null,
      },
    }),
  ];

  // If agency staff provided an accompanying note, insert into application_notes
  if (note && AGENCY_STAFF_ROLES.includes(actor.role as any)) {
    statements.push(
      env.DB.prepare(
        `INSERT INTO application_notes
           (id, agency_id, application_id, author_id, note_text, is_internal, created_at)
         VALUES (?, ?, ?, ?, ?, 1, ?)`,
      ).bind(ulid(now), actor.agencyId, applicationId, actor.userId, note, now),
    );
  }

  await env.DB.batch(statements);

  const updatedApp = await env.DB.prepare(
    `SELECT a.*,
            (SELECT count(*) FROM application_notes WHERE application_id = a.id) as notes_count
     FROM loan_applications a
     WHERE a.agency_id = ? AND a.id = ?`,
  )
    .bind(actor.agencyId, applicationId)
    .first<ApplicationRow>();

  const finalRow = updatedApp ?? { ...app, status: targetStatus, rejection_reason: rejectionReason, updated_at: now };
  const publicApp = {
    ...toPublic(finalRow),
    rejection_reason: finalRow.rejection_reason ?? null,
  };

  return jsonResponse(
    {
      ...publicApp,
      application: publicApp,
    },
    requestId,
  );
}
