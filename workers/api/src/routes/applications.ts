import { auditStatement } from '../lib/audit.ts';
import { requireActor } from '../lib/auth.ts';
import { badRequest, forbidden, jsonResponse, notFound, readJsonObject } from '../lib/http.ts';
import { assertKeyScope, findIdempotentResponse, idempotencyStatement } from '../lib/idempotency.ts';
import { ulid } from '../lib/ids.ts';
import { assertPositiveInteger, assertPositivePesewas } from '../lib/money.ts';
import { discloseApplication, type ApplicationDisclosureRecord } from '../lib/disclosure.ts';
import { optionalString, requireString } from '../lib/validation.ts';
import type { RouteContext } from '../router.ts';
import {
  APPLICATION_STATUSES,
  StateTransitionError,
  validateStateTransition,
  type ApplicationStatus,
  type UserRole,
} from '../domain/stateMachine.ts';

const MAX_TENURE_MONTHS = 480;
const MAX_PRINCIPAL_PESEWAS = 10_000_000_00; // GH₵ 10,000,000.00
const CREATION_SCOPE = 'applications.create';

const REVIEW_READ_ROLES = ['agency_admin', 'loan_officer', 'underwriter', 'auditor'] as const;
const REVIEW_WRITE_ROLES = ['agency_admin', 'loan_officer', 'underwriter'] as const;
const AGENCY_STAFF_ROLES = REVIEW_WRITE_ROLES;
const REVIEW_READER_ROLES = REVIEW_READ_ROLES;

interface ApplicationRow extends ApplicationDisclosureRecord {
  rejection_reason?: string | null;
  notes_count?: number;
}

interface ReviewNoteRow {
  id: string;
  actor_id: string;
  note: string;
  created_at: number;
}

interface StatusHistoryRow {
  id: string;
  actor_id: string;
  from_status: string | null;
  to_status: string;
  reason: string | null;
  created_at: number;
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

function requireReviewReader(actor: { role: string }): void {
  if (!REVIEW_READ_ROLES.includes(actor.role as any)) {
    throw forbidden('Only agency staff may access the review workflow');
  }
}

function requireReviewWriter(actor: { role: string }): void {
  if (!REVIEW_WRITE_ROLES.includes(actor.role as any)) {
    throw forbidden('Only agency review staff may perform this review action');
  }
}

function requireApplicationStatus(value: unknown): ApplicationStatus {
  if (typeof value !== 'string' || !APPLICATION_STATUSES.includes(value as ApplicationStatus)) {
    throw badRequest('INVALID_STATUS', `Unrecognised application status: ${String(value)}`);
  }
  return value as ApplicationStatus;
}

async function findApplication(
  db: D1Database,
  applicationId: string,
  agencyId: string,
): Promise<ApplicationRow> {
  if (!applicationId) {
    throw badRequest('MISSING_ID', 'Application ID is required');
  }

  const row = await db
    .prepare(
      `SELECT loan_applications.*,
              borrower.full_name AS borrower_full_name,
              borrower.email AS borrower_email,
              borrower.phone AS borrower_phone
       FROM loan_applications
       JOIN users AS borrower
         ON borrower.id = loan_applications.borrower_id
        AND borrower.agency_id = loan_applications.agency_id
       WHERE loan_applications.id = ? AND loan_applications.agency_id = ?`,
    )
    .bind(applicationId, agencyId)
    .first<ApplicationRow>();

  if (!row) {
    throw notFound('Application not found');
  }
  return row;
}

function toPublic(row: ApplicationRow, role?: UserRole) {
  if (role) {
    return {
      ...discloseApplication(row, role),
      rejectionReason: row.rejection_reason ?? null,
      notesCount: Number(row.notes_count ?? 0),
    };
  }
  return {
    id: row.id,
    borrowerId: row.borrower_id,
    borrowerName: row.borrower_full_name ?? null,
    borrowerEmail: row.borrower_email ?? null,
    borrowerPhone: row.borrower_phone ?? null,
    status: row.status as ApplicationStatus,
    requestedAmountPesewas: row.requested_amount_pesewas,
    tenureMonths: row.tenure_months,
    purpose: row.purpose,
    rejectionReason: row.rejection_reason ?? null,
    notesCount: Number(row.notes_count ?? 0),
    assignedOfficerId: row.assigned_officer_id ?? null,
    submittedAt: row.submitted_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function urlStatus(requestUrl: string): ApplicationStatus | null {
  const value = new URL(requestUrl).searchParams.get('status');
  if (value === null) return null;
  return requireApplicationStatus(value);
}

/** POST /applications — submit a new loan application. */
export async function createApplication({ request, env, requestId }: RouteContext): Promise<Response> {
  const actor = await requireActor(request, env.JWT_SIGNING_KEY);
  if (actor.role !== 'borrower') {
    throw forbidden('Only borrowers may submit applications');
  }

  const idempotencyKey = request.headers.get('idempotency-key');
  if (idempotencyKey) {
    await assertKeyScope(env.DB, actor.agencyId, idempotencyKey, CREATION_SCOPE);
    const cached = await findIdempotentResponse<Record<string, unknown>>(
      env.DB,
      actor.agencyId,
      idempotencyKey,
    );
    if (cached) return jsonResponse(cached, requestId, 200);
  }

  const body = await readJsonObject(request);
  const requestedAmountPesewasRaw = body.requestedAmountPesewas ?? body.requested_amount_pesewas;
  const tenureMonthsRaw = body.tenureMonths ?? body.tenure_months;

  const requestedAmountPesewas = assertPositivePesewas(
    requestedAmountPesewasRaw,
    MAX_PRINCIPAL_PESEWAS,
    'requestedAmountPesewas',
  );
  const tenureMonths = assertPositiveInteger(
    tenureMonthsRaw,
    MAX_TENURE_MONTHS,
    'tenureMonths',
  );
  const purpose = optionalString(body, 'purpose', 500);

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
    assigned_officer_id: null,
    submitted_at: now,
    rejection_reason: null,
    created_at: now,
    updated_at: now,
  };

  const payload = discloseApplication(application, actor.role);
  const statements: D1PreparedStatement[] = [
    env.DB.prepare(
      `INSERT INTO loan_applications
         (id, agency_id, borrower_id, status, requested_amount_pesewas, tenure_months, purpose,
          assigned_lender_id, assigned_officer_id, submitted_at, rejection_reason, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, NULL, ?, ?)`,
    ).bind(
      application.id,
      application.agency_id,
      application.borrower_id,
      application.status,
      application.requested_amount_pesewas,
      application.tenure_months,
      application.purpose,
      application.submitted_at,
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
    env.DB.prepare(
      `INSERT INTO application_status_history
         (id, agency_id, application_id, actor_id, from_status, to_status, reason, created_at)
       VALUES (?, ?, ?, ?, NULL, ?, ?, ?)`,
    ).bind(
      ulid(now),
      actor.agencyId,
      application.id,
      actor.userId,
      application.status,
      'Initial borrower submission',
      now,
    ),
  ];

  const idempotency = idempotencyStatement(env.DB, actor.agencyId, idempotencyKey, CREATION_SCOPE, payload);
  if (idempotency) statements.push(idempotency);

  await env.DB.batch(statements);

  return jsonResponse(payload, requestId, 201);
}

/** GET /applications — borrower sees their own; agency staff see the tenant queue. */
export async function listApplications({ request, env, requestId }: RouteContext): Promise<Response> {
  const actor = await requireActor(request, env.JWT_SIGNING_KEY);
  const isAgencyStaff = REVIEW_READ_ROLES.includes(actor.role as any);

  if (actor.role !== 'borrower' && !isAgencyStaff) {
    throw forbidden('This role cannot list applications');
  }

  const status = urlStatus(request.url);

  let query: D1PreparedStatement;
  if (isAgencyStaff) {
    if (status) {
      query = env.DB.prepare(
        `SELECT loan_applications.*,
                borrower.full_name AS borrower_full_name,
                borrower.email AS borrower_email,
                borrower.phone AS borrower_phone
         FROM loan_applications
         JOIN users AS borrower
           ON borrower.id = loan_applications.borrower_id
          AND borrower.agency_id = loan_applications.agency_id
         WHERE loan_applications.agency_id = ? AND loan_applications.status = ?
         ORDER BY loan_applications.created_at DESC LIMIT 100`,
      ).bind(actor.agencyId, status);
    } else {
      query = env.DB.prepare(
        `SELECT loan_applications.*,
                borrower.full_name AS borrower_full_name,
                borrower.email AS borrower_email,
                borrower.phone AS borrower_phone
         FROM loan_applications
         JOIN users AS borrower
           ON borrower.id = loan_applications.borrower_id
          AND borrower.agency_id = loan_applications.agency_id
         WHERE loan_applications.agency_id = ?
         ORDER BY loan_applications.created_at DESC LIMIT 100`,
      ).bind(actor.agencyId);
    }
  } else {
    query = env.DB.prepare(
      `SELECT loan_applications.*,
              borrower.full_name AS borrower_full_name,
              borrower.email AS borrower_email,
              borrower.phone AS borrower_phone
       FROM loan_applications
       JOIN users AS borrower
         ON borrower.id = loan_applications.borrower_id
        AND borrower.agency_id = loan_applications.agency_id
       WHERE loan_applications.agency_id = ? AND loan_applications.borrower_id = ?
       ORDER BY loan_applications.created_at DESC LIMIT 100`,
    ).bind(actor.agencyId, actor.userId);
  }

  const { results } = await query.all<ApplicationRow>();
  return jsonResponse({ applications: results.map((row) => discloseApplication(row, actor.role)) }, requestId);
}

/** POST /applications/:id/assign — assign an internal reviewer. */
export async function assignApplication({
  request,
  env,
  params,
  requestId,
}: RouteContext): Promise<Response> {
  const actor = await requireActor(request, env.JWT_SIGNING_KEY);
  if (!['agency_admin', 'loan_officer'].includes(actor.role)) {
    throw forbidden('Only agency administrators and loan officers may assign applications');
  }

  const applicationId = params.applicationId || params.id || '';
  const application = await findApplication(env.DB, applicationId, actor.agencyId);
  const body = await readJsonObject(request);
  const assigneeId = requireString(body, 'assigneeId', { maxLength: 100 });
  const assignee = await env.DB
    .prepare(
      `SELECT id, role FROM users
       WHERE id = ? AND agency_id = ? AND is_active = 1`,
    )
    .bind(assigneeId, actor.agencyId)
    .first<{ id: string; role: string }>();

  if (!assignee || !['loan_officer', 'underwriter'].includes(assignee.role)) {
    throw badRequest('INVALID_ASSIGNEE', 'assigneeId must identify an active loan officer or underwriter');
  }

  const now = Date.now();
  await env.DB.batch([
    env.DB
      .prepare(
        `UPDATE loan_applications
         SET assigned_officer_id = ?, updated_at = ?
         WHERE id = ? AND agency_id = ?`,
      )
      .bind(assignee.id, now, application.id, actor.agencyId),
    auditStatement(env.DB, {
      agencyId: actor.agencyId,
      actorId: actor.userId,
      action: 'APPLICATION_ASSIGNED',
      resourceType: 'loan_application',
      resourceId: application.id,
      details: { assignedOfficerId: assignee.id },
    }),
  ]);

  return jsonResponse(
    { applicationId: application.id, assignedOfficerId: assignee.id, updatedAt: now },
    requestId,
  );
}

/** POST /applications/:id/review — guarded agency status transition. */
export async function reviewApplication({
  request,
  env,
  params,
  requestId,
}: RouteContext): Promise<Response> {
  const actor = await requireActor(request, env.JWT_SIGNING_KEY);
  requireReviewWriter(actor);

  const applicationId = params.applicationId || params.id || '';
  const application = await findApplication(env.DB, applicationId, actor.agencyId);
  const body = await readJsonObject(request);
  const targetStatus = requireApplicationStatus(body.targetStatus);
  const reason = optionalString(body, 'reason', 1000);

  if ((targetStatus === 'MORE_INFO_REQUIRED' || targetStatus === 'AGENCY_REJECTED') && !reason) {
    throw badRequest('REASON_REQUIRED', 'A reason is required for this review decision');
  }

  try {
    validateStateTransition({
      applicationId: application.id,
      applicationAgencyId: application.agency_id,
      actorUserId: actor.userId,
      actorAgencyId: actor.agencyId,
      actorRole: actor.role,
      currentStatus: application.status as ApplicationStatus,
      targetStatus,
      borrowerId: application.borrower_id,
      assignedLenderId: application.assigned_lender_id,
      rejectionReason: reason,
    });
  } catch (error) {
    if (error instanceof StateTransitionError) {
      if (error.code === 'UNAUTHORIZED_ROLE') throw forbidden(error.message);
      throw badRequest(error.code, error.message);
    }
    throw error;
  }

  const now = Date.now();
  await env.DB.batch([
    env.DB
      .prepare(
        `UPDATE loan_applications
         SET status = ?, rejection_reason = ?, updated_at = ?
         WHERE id = ? AND agency_id = ?`,
      )
      .bind(targetStatus, reason ?? null, now, application.id, actor.agencyId),
    env.DB
      .prepare(
        `INSERT INTO application_status_history
           (id, agency_id, application_id, actor_id, from_status, to_status, reason, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        ulid(now),
        actor.agencyId,
        application.id,
        actor.userId,
        application.status,
        targetStatus,
        reason,
        now,
      ),
    auditStatement(env.DB, {
      agencyId: actor.agencyId,
      actorId: actor.userId,
      action: 'APPLICATION_STATUS_CHANGED',
      resourceType: 'loan_application',
      resourceId: application.id,
      details: { fromStatus: application.status, toStatus: targetStatus, reason },
    }),
  ]);

  return jsonResponse(
    { applicationId: application.id, fromStatus: application.status, status: targetStatus, updatedAt: now },
    requestId,
  );
}

/** POST /applications/:id/notes — add an internal review note. */
export async function addApplicationReviewNote({
  request,
  env,
  params,
  requestId,
}: RouteContext): Promise<Response> {
  return addApplicationNote({ request, env, params, requestId });
}

/** GET /applications/:id/review — staff-only review evidence. */
export async function getApplicationReview({
  request,
  env,
  params,
  requestId,
}: RouteContext): Promise<Response> {
  const actor = await requireActor(request, env.JWT_SIGNING_KEY);
  requireReviewReader(actor);

  const applicationId = params.applicationId || params.id || '';
  const application = await findApplication(env.DB, applicationId, actor.agencyId);
  const [notes, history] = await Promise.all([
    env.DB
      .prepare(
        `SELECT id, actor_id, note, created_at
         FROM application_review_notes
         WHERE application_id = ? AND agency_id = ?
         ORDER BY created_at ASC`,
      )
      .bind(application.id, actor.agencyId)
      .all<ReviewNoteRow>(),
    env.DB
      .prepare(
        `SELECT id, actor_id, from_status, to_status, reason, created_at
         FROM application_status_history
         WHERE application_id = ? AND agency_id = ?
         ORDER BY created_at ASC`,
      )
      .bind(application.id, actor.agencyId)
      .all<StatusHistoryRow>(),
  ]);

  return jsonResponse(
    {
      application: discloseApplication(application, actor.role),
      notes: notes.results,
      statusHistory: history.results,
    },
    requestId,
  );
}

/**
 * POST /applications/:id/notes
 * Agency staff records an internal review note.
 * Inserts into both application_notes and application_review_notes.
 */
export async function addApplicationNote({ request, env, params, requestId }: RouteContext): Promise<Response> {
  const actor = await requireActor(request, env.JWT_SIGNING_KEY);
  if (!AGENCY_STAFF_ROLES.includes(actor.role as any)) {
    throw forbidden('Only agency review staff may record internal notes');
  }

  const applicationId = params.applicationId || params.id;
  if (!applicationId) {
    throw badRequest('MISSING_ID', 'Application ID is required');
  }

  const app = await findApplication(env.DB, applicationId, actor.agencyId);
  const body = await readJsonObject(request);
  const noteText =
    optionalString(body, 'noteText', 4000) || optionalString(body, 'note', 4000);
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
    env.DB.prepare(
      `INSERT INTO application_review_notes
         (id, agency_id, application_id, actor_id, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
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
 */
export async function listApplicationNotes({ request, env, params, requestId }: RouteContext): Promise<Response> {
  const actor = await requireActor(request, env.JWT_SIGNING_KEY);
  if (!REVIEW_READER_ROLES.includes(actor.role as any)) {
    throw forbidden('Only agency staff may view application review notes');
  }

  const applicationId = params.applicationId || params.id;
  if (!applicationId) {
    throw badRequest('MISSING_ID', 'Application ID is required');
  }

  const app = await findApplication(env.DB, applicationId, actor.agencyId);

  const query = env.DB.prepare(
    `SELECT n.*, u.full_name as author_name, u.role as author_role
     FROM application_notes n
     JOIN users u ON u.id = n.author_id
     WHERE n.agency_id = ? AND n.application_id = ?
     ORDER BY n.created_at ASC`,
  ).bind(actor.agencyId, applicationId);

  const { results } = await query.all<ApplicationNoteRow>();

  return jsonResponse(
    {
      notes: results.map((n) => ({
        id: n.id,
        applicationId: n.application_id,
        authorId: n.author_id,
        authorName: n.author_name,
        author_name: n.author_name,
        authorRole: n.author_role,
        author_role: n.author_role,
        noteText: n.note_text,
        note_text: n.note_text,
        note: n.note_text,
        isInternal: Boolean(n.is_internal),
        is_internal: Boolean(n.is_internal),
        createdAt: n.created_at,
        created_at: n.created_at,
      })),
    },
    requestId,
  );
}

/**
 * POST /applications/:id/response
 * Submits borrower response evidence when MORE_INFO_REQUIRED.
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

  const applicationId = params.applicationId || params.id;
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
 */
export async function transitionApplication({ request, env, params, requestId }: RouteContext): Promise<Response> {
  const actor = await requireActor(request, env.JWT_SIGNING_KEY);
  const applicationId = params.applicationId || params.id;
  if (!applicationId) {
    throw badRequest('MISSING_ID', 'Application ID is required');
  }

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

  if (targetStatus === 'AGENCY_REJECTED') {
    if (!reason || reason.trim().length === 0) {
      throw badRequest('REJECTION_REASON_REQUIRED', 'A recorded rejection reason is required to reject an application');
    }
  }

  let hasBorrowerResponse = false;
  if (app.status === 'MORE_INFO_REQUIRED' && targetStatus === 'UNDER_REVIEW') {
    const lastMoreInfoAudit = await env.DB.prepare(
      `SELECT created_at FROM audit_events
       WHERE agency_id = ? AND resource_id = ? AND action = 'APPLICATION_STATUS_TRANSITION'
       ORDER BY created_at DESC LIMIT 1`,
    )
      .bind(actor.agencyId, applicationId)
      .first<{ created_at: number }>();

    const moreInfoTimestamp = lastMoreInfoAudit ? lastMoreInfoAudit.created_at : 0;

    const evidence = await env.DB.prepare(
      `SELECT id FROM borrower_responses
       WHERE agency_id = ? AND application_id = ? AND borrower_id = ? AND created_at >= ?
       ORDER BY created_at DESC LIMIT 1`,
    )
      .bind(actor.agencyId, applicationId, app.borrower_id, moreInfoTimestamp)
      .first<{ id: string }>();

    if (evidence) {
      hasBorrowerResponse = true;
    }
  }

  try {
    validateStateTransition({
      applicationId,
      applicationAgencyId: app.agency_id,
      actorUserId: actor.userId,
      actorAgencyId: actor.agencyId,
      actorRole: actor.role,
      currentStatus: app.status as ApplicationStatus,
      targetStatus,
      borrowerId: app.borrower_id,
      assignedLenderId: app.assigned_lender_id,
      rejectionReason: reason,
      hasBorrowerResponse,
    });
  } catch (error) {
    if (error instanceof StateTransitionError) {
      if (error.code === 'UNAUTHORIZED_ROLE') {
        throw forbidden(error.message);
      }
      throw badRequest(error.code, error.message);
    }
    throw error;
  }

  const now = Date.now();
  const rejectionReason = targetStatus === 'AGENCY_REJECTED' ? reason : app.rejection_reason;

  const statements: D1PreparedStatement[] = [
    env.DB.prepare(
      `UPDATE loan_applications
       SET status = ?, rejection_reason = ?, updated_at = ?
       WHERE agency_id = ? AND id = ?`,
    ).bind(targetStatus, rejectionReason, now, actor.agencyId, applicationId),
    env.DB.prepare(
      `INSERT INTO application_status_history
         (id, agency_id, application_id, actor_id, from_status, to_status, reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      ulid(now),
      actor.agencyId,
      applicationId,
      actor.userId,
      app.status,
      targetStatus,
      reason ?? null,
      now,
    ),
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

  if (note && AGENCY_STAFF_ROLES.includes(actor.role as any)) {
    statements.push(
      env.DB.prepare(
        `INSERT INTO application_notes
           (id, agency_id, application_id, author_id, note_text, is_internal, created_at)
         VALUES (?, ?, ?, ?, ?, 1, ?)`,
      ).bind(ulid(now), actor.agencyId, applicationId, actor.userId, note, now),
      env.DB.prepare(
        `INSERT INTO application_review_notes
           (id, agency_id, application_id, actor_id, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).bind(ulid(now), actor.agencyId, applicationId, actor.userId, note, now),
    );
  }

  await env.DB.batch(statements);

  const updatedApp = await env.DB.prepare(
    `SELECT loan_applications.*,
            borrower.full_name AS borrower_full_name,
            borrower.email AS borrower_email,
            borrower.phone AS borrower_phone
     FROM loan_applications
     JOIN users AS borrower
       ON borrower.id = loan_applications.borrower_id
      AND borrower.agency_id = loan_applications.agency_id
     WHERE loan_applications.agency_id = ? AND loan_applications.id = ?`,
  )
    .bind(actor.agencyId, applicationId)
    .first<ApplicationRow>();

  const finalRow = updatedApp ?? { ...app, status: targetStatus, rejection_reason: rejectionReason, updated_at: now };
  const publicApp = {
    ...discloseApplication(finalRow, actor.role),
    rejectionReason: finalRow.rejection_reason ?? null,
    rejection_reason: finalRow.rejection_reason ?? null,
  };

  return jsonResponse(
    {
      ...publicApp,
      application: publicApp,
      fromStatus: app.status,
      status: targetStatus,
      rejectionReason: finalRow.rejection_reason ?? null,
      rejection_reason: finalRow.rejection_reason ?? null,
      updatedAt: now,
    },
    requestId,
  );
}
