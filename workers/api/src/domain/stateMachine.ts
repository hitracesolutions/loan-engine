/**
 * Gidfine centralised loan state machine.
 *
 * Implements the status model from Gidfine_Dev_Guide.md v1.2 section 9 and the
 * guard rules that make financial outcomes non-bypassable:
 *
 *   DRAFT -> SUBMITTED -> UNDER_REVIEW -> MATCHING -> LENDER_PENDING ->
 *   LENDER_ACCEPTED -> AGENCY_APPROVED -> BORROWER_ACCEPTED ->
 *   PENDING_DISBURSEMENT -> ACTIVE -> PAID_OFF -> CLOSED
 *
 * Guards:
 *   - Lender acceptance can never reach BORROWER_ACCEPTED or PENDING_DISBURSEMENT.
 *   - Disbursement requires a verified borrower consent snapshot.
 *   - Lenders may only decide proposals assigned to them.
 *   - Agency staff can never consent on the borrower's behalf.
 *   - Every check verifies the actor and record share an agency (tenant isolation).
 *
 * This module is runtime-agnostic (Web Crypto only) and is covered by
 * tests/stateMachine.test.ts.
 */

export const APPLICATION_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'MATCHING',
  'LENDER_PENDING',
  'LENDER_ACCEPTED',
  'AGENCY_APPROVED',
  'BORROWER_ACCEPTED',
  'PENDING_DISBURSEMENT',
  'ACTIVE',
  'PAID_OFF',
  'CLOSED',
  'MORE_INFO_REQUIRED',
  'LENDER_DECLINED',
  'AGENCY_REJECTED',
  'BORROWER_DECLINED',
  'CANCELLED',
  'EXPIRED',
  'DELINQUENT',
  'RESTRUCTURED',
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const USER_ROLES = [
  'agency_admin',
  'loan_officer',
  'underwriter',
  'cashier',
  'auditor',
  'lender',
  'borrower',
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export interface TransitionRule {
  allowedRoles: readonly UserRole[];
  requiresAssignedLender?: boolean;
  requiresOwningBorrower?: boolean;
  requiresConsentSnapshot?: boolean;
}

const AGENCY_STAFF = ['agency_admin', 'loan_officer', 'underwriter'] as const;
const CANCELLING = ['borrower', 'agency_admin'] as const;

/**
 * Transition guard table: source status -> permitted targets -> rule.
 * A missing entry means the transition is prohibited.
 */
export const ALLOWED_TRANSITIONS: Partial<
  Record<ApplicationStatus, Partial<Record<ApplicationStatus, TransitionRule>>>
> = {
  DRAFT: {
    SUBMITTED: { allowedRoles: ['borrower', 'agency_admin', 'loan_officer'], requiresOwningBorrower: true },
    CANCELLED: { allowedRoles: CANCELLING, requiresOwningBorrower: true },
  },
  SUBMITTED: {
    UNDER_REVIEW: { allowedRoles: AGENCY_STAFF },
    MORE_INFO_REQUIRED: { allowedRoles: AGENCY_STAFF },
    AGENCY_REJECTED: { allowedRoles: ['agency_admin', 'underwriter'] },
    CANCELLED: { allowedRoles: CANCELLING, requiresOwningBorrower: true },
  },
  UNDER_REVIEW: {
    MATCHING: { allowedRoles: AGENCY_STAFF },
    MORE_INFO_REQUIRED: { allowedRoles: AGENCY_STAFF },
    AGENCY_REJECTED: { allowedRoles: ['agency_admin', 'underwriter'] },
    CANCELLED: { allowedRoles: CANCELLING, requiresOwningBorrower: true },
  },
  MORE_INFO_REQUIRED: {
    UNDER_REVIEW: { allowedRoles: ['borrower', 'agency_admin', 'loan_officer'] },
    CANCELLED: { allowedRoles: CANCELLING, requiresOwningBorrower: true },
    EXPIRED: { allowedRoles: ['agency_admin'] },
  },
  MATCHING: {
    LENDER_PENDING: { allowedRoles: ['agency_admin', 'loan_officer'] },
    AGENCY_REJECTED: { allowedRoles: ['agency_admin'] },
    CANCELLED: { allowedRoles: CANCELLING, requiresOwningBorrower: true },
  },
  LENDER_PENDING: {
    LENDER_ACCEPTED: { allowedRoles: ['lender'], requiresAssignedLender: true },
    LENDER_DECLINED: { allowedRoles: ['lender'], requiresAssignedLender: true },
    // Re-assign to another lender.
    MATCHING: { allowedRoles: ['agency_admin', 'loan_officer'] },
    // Revise terms with a new proposal version.
    LENDER_PENDING: { allowedRoles: ['agency_admin', 'loan_officer'] },
    EXPIRED: { allowedRoles: ['agency_admin'] },
    CANCELLED: { allowedRoles: CANCELLING, requiresOwningBorrower: true },
  },
  LENDER_DECLINED: {
    MATCHING: { allowedRoles: ['agency_admin', 'loan_officer'] },
    AGENCY_REJECTED: { allowedRoles: ['agency_admin'] },
    CANCELLED: { allowedRoles: CANCELLING, requiresOwningBorrower: true },
  },
  // Lender acceptance must pass through agency approval. No shortcut to
  // BORROWER_ACCEPTED or PENDING_DISBURSEMENT exists here by design.
  LENDER_ACCEPTED: {
    AGENCY_APPROVED: { allowedRoles: ['agency_admin', 'underwriter'] },
    AGENCY_REJECTED: { allowedRoles: ['agency_admin', 'underwriter'] },
    CANCELLED: { allowedRoles: CANCELLING, requiresOwningBorrower: true },
  },
  // Only the borrower may consent, and only with a snapshot to hash.
  AGENCY_APPROVED: {
    BORROWER_ACCEPTED: {
      allowedRoles: ['borrower'],
      requiresOwningBorrower: true,
      requiresConsentSnapshot: true,
    },
    BORROWER_DECLINED: { allowedRoles: ['borrower'], requiresOwningBorrower: true },
    EXPIRED: { allowedRoles: ['agency_admin'] },
    CANCELLED: { allowedRoles: CANCELLING, requiresOwningBorrower: true },
  },
  BORROWER_ACCEPTED: {
    PENDING_DISBURSEMENT: {
      allowedRoles: ['agency_admin', 'loan_officer', 'cashier'],
      requiresConsentSnapshot: true,
    },
    CANCELLED: { allowedRoles: ['agency_admin'] },
  },
  PENDING_DISBURSEMENT: {
    ACTIVE: {
      allowedRoles: ['agency_admin', 'cashier'],
      requiresConsentSnapshot: true,
    },
    CANCELLED: { allowedRoles: ['agency_admin'] },
  },
  ACTIVE: {
    PAID_OFF: { allowedRoles: ['agency_admin', 'cashier'] },
    DELINQUENT: { allowedRoles: ['agency_admin', 'loan_officer'] },
    RESTRUCTURED: { allowedRoles: ['agency_admin', 'underwriter'] },
  },
  DELINQUENT: {
    PAID_OFF: { allowedRoles: ['agency_admin', 'cashier'] },
    RESTRUCTURED: { allowedRoles: ['agency_admin', 'underwriter'] },
    CLOSED: { allowedRoles: ['agency_admin'] },
  },
  RESTRUCTURED: {
    ACTIVE: { allowedRoles: ['agency_admin', 'cashier'] },
    PAID_OFF: { allowedRoles: ['agency_admin', 'cashier'] },
    DELINQUENT: { allowedRoles: ['agency_admin'] },
  },
  PAID_OFF: {
    CLOSED: { allowedRoles: ['agency_admin'] },
  },
};

export interface TransitionContext {
  applicationId: string;
  applicationAgencyId: string;
  actorUserId: string;
  actorAgencyId: string;
  actorRole: UserRole;
  currentStatus: ApplicationStatus;
  targetStatus: ApplicationStatus;
  borrowerId: string;
  assignedLenderId?: string | null;
  hasValidConsentSnapshot?: boolean;
}

export type TransitionErrorCode =
  | 'TENANT_ISOLATION_VIOLATION'
  | 'TERMINAL_STATE'
  | 'ILLEGAL_TRANSITION'
  | 'UNAUTHORIZED_ROLE'
  | 'LENDER_NOT_ASSIGNED'
  | 'BORROWER_MISMATCH'
  | 'CONSENT_REQUIRED';

export class StateTransitionError extends Error {
  readonly code: TransitionErrorCode;

  constructor(message: string, code: TransitionErrorCode) {
    super(message);
    this.name = 'StateTransitionError';
    this.code = code;
  }
}

/**
 * Throws StateTransitionError when the transition is not permitted.
 * Order matters: tenant isolation is checked before anything else so a
 * cross-tenant caller cannot probe valid transitions.
 */
export function validateStateTransition(ctx: TransitionContext): { valid: true } {
  if (ctx.actorAgencyId !== ctx.applicationAgencyId) {
    throw new StateTransitionError(
      'Actor does not belong to the application agency',
      'TENANT_ISOLATION_VIOLATION',
    );
  }

  const currentTransitions = ALLOWED_TRANSITIONS[ctx.currentStatus];
  if (!currentTransitions) {
    throw new StateTransitionError(
      `Application status '${ctx.currentStatus}' has no outgoing transitions`,
      'TERMINAL_STATE',
    );
  }

  const rule = currentTransitions[ctx.targetStatus];
  if (!rule) {
    throw new StateTransitionError(
      `Transition '${ctx.currentStatus}' -> '${ctx.targetStatus}' is prohibited`,
      'ILLEGAL_TRANSITION',
    );
  }

  if (!rule.allowedRoles.includes(ctx.actorRole)) {
    throw new StateTransitionError(
      `Role '${ctx.actorRole}' may not perform '${ctx.currentStatus}' -> '${ctx.targetStatus}' (requires ${rule.allowedRoles.join(', ')})`,
      'UNAUTHORIZED_ROLE',
    );
  }

  if (rule.requiresAssignedLender && ctx.actorRole === 'lender') {
    if (!ctx.assignedLenderId || ctx.assignedLenderId !== ctx.actorUserId) {
      throw new StateTransitionError(
        `User ${ctx.actorUserId} is not the assigned lender for this application`,
        'LENDER_NOT_ASSIGNED',
      );
    }
  }

  if (rule.requiresOwningBorrower && ctx.actorRole === 'borrower' && ctx.borrowerId !== ctx.actorUserId) {
    throw new StateTransitionError(
      `User ${ctx.actorUserId} does not own application ${ctx.applicationId}`,
      'BORROWER_MISMATCH',
    );
  }

  if (rule.requiresConsentSnapshot && !ctx.hasValidConsentSnapshot) {
    throw new StateTransitionError(
      `Transition to '${ctx.targetStatus}' requires a verified borrower consent snapshot`,
      'CONSENT_REQUIRED',
    );
  }

  return { valid: true };
}

export interface ConsentTerms {
  applicationId: string;
  proposalId: string;
  borrowerId: string;
  termsVersion: number;
  principalPesewas: number;
  borrowerRateBps: number;
  tenureMonths: number;
  consentedAt: number;
}

export const CONSENT_ALGORITHM_VERSION = 'sha256-v1';

/**
 * Deterministic SHA-256 fingerprint of the terms a borrower agreed to.
 * Stored with the consent record so later edits to the proposal are detectable
 * (Act 843 affirmative-consent evidence).
 */
export async function computeTermsSnapshotHash(terms: ConsentTerms): Promise<string> {
  const payload = JSON.stringify({
    app: terms.applicationId,
    prop: terms.proposalId,
    borr: terms.borrowerId,
    v: terms.termsVersion,
    pesewas: terms.principalPesewas,
    bps: terms.borrowerRateBps,
    m: terms.tenureMonths,
    ts: terms.consentedAt,
  });

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
