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
} from '../domain/stateMachine.ts';

const MAX_TENURE_MONTHS = 480;
const MAX_PRINCIPAL_PESEWAS = 10_000_000_00; // GH₵ 10,000,000.00
const CREATION_SCOPE = 'applications.create';

interface ApplicationRow extends ApplicationDisclosureRecord {}

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

const REVIEW_READ_ROLES = ['agency_admin', 'loan_officer', 'underwriter', 'auditor'];
const REVIEW_WRITE_ROLES = ['agency_admin', 'loan_officer', 'underwriter'];

function requireReviewReader(actor: { role: string }): void {
  if (!REVIEW_READ_ROLES.includes(actor.role)) {
    throw forbidden('Only agency staff may access the review workflow');
  }
}

function requireReviewWriter(actor: { role: string }): void {
  if (!REVIEW_WRITE_ROLES.includes(actor.role)) {
    throw forbidden('This role has read-only access to the review workflow');
  }
}

function requireApplicationStatus(value: unknown): ApplicationStatus {
  if (typeof value !== 'string' || !APPLICATION_STATUSES.includes(value as ApplicationStatus)) {
    throw badRequest('INVALID_STATUS', 'targetStatus must be a supported application status');
  }
  return value as ApplicationStatus;
}

async function findApplication(
  db: D1Database,
  applicationId: string,
  agencyId: string,
): Promise<ApplicationRow> {
  const application = await db
    .prepare(
      `SELECT loan_applications.*, borrower.full_name AS borrower_full_name,
              borrower.email AS borrower_email, borrower.phone AS borrower_phone
       FROM loan_applications
       JOIN users AS borrower ON borrower.id = loan_applications.borrower_id
       WHERE loan_applications.id = ? AND loan_applications.agency_id = ?`,
    )
    .bind(applicationId, agencyId)
    .first<ApplicationRow>();

  if (!application) throw notFound('Application not found');
  return application;
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
    assigned_officer_id: null,
    submitted_at: now,
    created_at: now,
    updated_at: now,
  };

  const payload = discloseApplication(application, actor.role);
  const statements: D1PreparedStatement[] = [
    env.DB.prepare(
      `INSERT INTO loan_applications
         (id, agency_id, borrower_id, status, requested_amount_pesewas, tenure_months, purpose,
          assigned_lender_id, assigned_officer_id, submitted_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?)`,
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
  const isAgencyStaff = ['agency_admin', 'loan_officer', 'underwriter', 'auditor'].includes(actor.role);

  if (actor.role !== 'borrower' && !isAgencyStaff) {
    throw forbidden('This role cannot list applications');
  }

  if (isAgencyStaff) {
    const status = urlStatus(request.url);
    const assignedOfficerId = new URL(request.url).searchParams.get('assignedOfficerId');
    const filters = ['loan_applications.agency_id = ?'];
    const values: string[] = [actor.agencyId];

    if (status) {
      filters.push('loan_applications.status = ?');
      values.push(status);
    }
    if (assignedOfficerId) {
      filters.push('loan_applications.assigned_officer_id = ?');
      values.push(assignedOfficerId);
    }

    const query = env.DB
      .prepare(
        `SELECT loan_applications.*, borrower.full_name AS borrower_full_name,
                borrower.email AS borrower_email, borrower.phone AS borrower_phone
         FROM loan_applications
         JOIN users AS borrower ON borrower.id = loan_applications.borrower_id
         WHERE ${filters.join(' AND ')}
         ORDER BY loan_applications.created_at DESC LIMIT 100`,
      )
      .bind(...values);
    const { results } = await query.all<ApplicationRow>();
    return jsonResponse({ applications: results.map((row) => discloseApplication(row, actor.role)) }, requestId);
  }

  const query = env.DB
    .prepare(
      `SELECT loan_applications.*, borrower.full_name AS borrower_full_name,
              borrower.email AS borrower_email, borrower.phone AS borrower_phone
       FROM loan_applications
       JOIN users AS borrower ON borrower.id = loan_applications.borrower_id
       WHERE loan_applications.agency_id = ? AND loan_applications.borrower_id = ?
       ORDER BY loan_applications.created_at DESC LIMIT 100`,
    )
    .bind(actor.agencyId, actor.userId);

  const { results } = await query.all<ApplicationRow>();
  return jsonResponse({ applications: results.map((row) => discloseApplication(row, actor.role)) }, requestId);
}

function urlStatus(requestUrl: string): ApplicationStatus | null {
  const value = new URL(requestUrl).searchParams.get('status');
  if (value === null) return null;
  return requireApplicationStatus(value);
}

/** POST /applications/:applicationId/assign — assign an internal reviewer. */
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

  const applicationId = params.applicationId ?? '';
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

/** POST /applications/:applicationId/review — guarded agency status transition. */
export async function reviewApplication({
  request,
  env,
  params,
  requestId,
}: RouteContext): Promise<Response> {
  const actor = await requireActor(request, env.JWT_SIGNING_KEY);
  requireReviewWriter(actor);

  const applicationId = params.applicationId ?? '';
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
         SET status = ?, updated_at = ?
         WHERE id = ? AND agency_id = ?`,
      )
      .bind(targetStatus, now, application.id, actor.agencyId),
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

/** POST /applications/:applicationId/notes — add an internal review note. */
export async function addApplicationReviewNote({
  request,
  env,
  params,
  requestId,
}: RouteContext): Promise<Response> {
  const actor = await requireActor(request, env.JWT_SIGNING_KEY);
  requireReviewWriter(actor);

  const applicationId = params.applicationId ?? '';
  const application = await findApplication(env.DB, applicationId, actor.agencyId);
  const body = await readJsonObject(request);
  const note = requireString(body, 'note', { maxLength: 4000 });
  const now = Date.now();
  const noteId = ulid(now);

  await env.DB.batch([
    env.DB
      .prepare(
        `INSERT INTO application_review_notes
           (id, agency_id, application_id, actor_id, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(noteId, actor.agencyId, application.id, actor.userId, note, now),
    auditStatement(env.DB, {
      agencyId: actor.agencyId,
      actorId: actor.userId,
      action: 'APPLICATION_REVIEW_NOTE_ADDED',
      resourceType: 'loan_application',
      resourceId: application.id,
      details: { noteId },
    }),
  ]);

  return jsonResponse({ id: noteId, applicationId: application.id, note, createdAt: now }, requestId, 201);
}

/** GET /applications/:applicationId/review — staff-only review evidence. */
export async function getApplicationReview({
  request,
  env,
  params,
  requestId,
}: RouteContext): Promise<Response> {
  const actor = await requireActor(request, env.JWT_SIGNING_KEY);
  requireReviewReader(actor);

  const applicationId = params.applicationId ?? '';
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
