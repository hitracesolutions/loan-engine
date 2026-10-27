import { auditStatement } from '../lib/audit.ts';
import { requireActor } from '../lib/auth.ts';
import { badRequest, forbidden, jsonResponse, readJsonObject } from '../lib/http.ts';
import { assertKeyScope, findIdempotentResponse, idempotencyStatement } from '../lib/idempotency.ts';
import { ulid } from '../lib/ids.ts';
import { assertPositiveInteger, assertPositivePesewas } from '../lib/money.ts';
import { optionalString } from '../lib/validation.ts';
import type { RouteContext } from '../router.ts';
import type { ApplicationStatus } from '../domain/stateMachine.ts';

const MAX_TENURE_MONTHS = 480;
const MAX_PRINCIPAL_PESEWAS = 10_000_000_00; // GH₵ 10,000,000.00
const CREATION_SCOPE = 'applications.create';

interface ApplicationRow {
  id: string;
  agency_id: string;
  borrower_id: string;
  status: string;
  requested_amount_pesewas: number;
  tenure_months: number;
  purpose: string | null;
  assigned_lender_id: string | null;
  created_at: number;
  updated_at: number;
}

function toPublic(row: ApplicationRow) {
  return {
    id: row.id,
    status: row.status as ApplicationStatus,
    requestedAmountPesewas: row.requested_amount_pesewas,
    tenureMonths: row.tenure_months,
    purpose: row.purpose,
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
    created_at: now,
    updated_at: now,
  };

  const payload = toPublic(application);
  const statements: D1PreparedStatement[] = [
    env.DB.prepare(
      `INSERT INTO loan_applications
         (id, agency_id, borrower_id, status, requested_amount_pesewas, tenure_months, purpose,
          assigned_lender_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
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
  const isAgencyStaff = ['agency_admin', 'loan_officer', 'underwriter', 'auditor'].includes(actor.role);

  if (actor.role !== 'borrower' && !isAgencyStaff) {
    throw forbidden('This role cannot list applications');
  }

  const query = isAgencyStaff
    ? env.DB.prepare(
        'SELECT * FROM loan_applications WHERE agency_id = ? ORDER BY created_at DESC LIMIT 100',
      ).bind(actor.agencyId)
    : env.DB.prepare(
        `SELECT * FROM loan_applications
          WHERE agency_id = ? AND borrower_id = ?
          ORDER BY created_at DESC LIMIT 100`,
      ).bind(actor.agencyId, actor.userId);

  const { results } = await query.all<ApplicationRow>();
  return jsonResponse({ applications: results.map(toPublic) }, requestId);
}
