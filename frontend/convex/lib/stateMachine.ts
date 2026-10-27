/**
 * Gidfine Centralized Loan State Machine Guard Engine
 *
 * Implements:
 * - 20-status state machine from Gidfine_Dev_Guide.md v1.1 Section 9
 * - 11-stage core linear workflow:
 *     DRAFT -> SUBMITTED -> UNDER_REVIEW -> MATCHING -> LENDER_PENDING ->
 *     LENDER_ACCEPTED -> AGENCY_APPROVED -> BORROWER_ACCEPTED ->
 *     PENDING_DISBURSEMENT -> ACTIVE -> PAID_OFF -> CLOSED
 * - Strict non-bypass guards:
 *     * Lender acceptance cannot bypass agency approval or borrower consent.
 *     * Disbursement cannot occur without verified borrower consent.
 *     * Lenders can only accept/decline proposals assigned to them.
 *     * Agency admins cannot act as the borrower to accept loans.
 *     * Tenant isolation: All transition checks verify agency ownership.
 * - Consent snapshot hashing & verification (SHA-256 integrity).
 */

export const APPLICATION_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "MATCHING",
  "LENDER_PENDING",
  "LENDER_ACCEPTED",
  "AGENCY_APPROVED",
  "BORROWER_ACCEPTED",
  "PENDING_DISBURSEMENT",
  "ACTIVE",
  "PAID_OFF",
  "CLOSED",
  "MORE_INFO_REQUIRED",
  "LENDER_DECLINED",
  "AGENCY_REJECTED",
  "BORROWER_DECLINED",
  "CANCELLED",
  "EXPIRED",
  "DELINQUENT",
  "RESTRUCTURED",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const USER_ROLES = [
  "agency_admin",
  "loan_officer",
  "underwriter",
  "cashier",
  "auditor",
  "lender",
  "borrower",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export interface TransitionRule {
  allowedRoles: readonly UserRole[];
  requiresAssignedLender?: boolean;
  requiresOwningBorrower?: boolean;
  requiresConsentSnapshot?: boolean;
}

/**
 * Transition Guard Table
 * Defines valid source-to-target transitions and authorized roles.
 */
export const ALLOWED_TRANSITIONS: Partial<
  Record<ApplicationStatus, Partial<Record<ApplicationStatus, TransitionRule>>>
> = {
  DRAFT: {
    SUBMITTED: {
      allowedRoles: ["borrower", "agency_admin", "loan_officer"],
      requiresOwningBorrower: true,
    },
    CANCELLED: {
      allowedRoles: ["borrower", "agency_admin"],
      requiresOwningBorrower: true,
    },
  },
  SUBMITTED: {
    UNDER_REVIEW: {
      allowedRoles: ["agency_admin", "loan_officer", "underwriter"],
    },
    MORE_INFO_REQUIRED: {
      allowedRoles: ["agency_admin", "loan_officer", "underwriter"],
    },
    AGENCY_REJECTED: {
      allowedRoles: ["agency_admin", "underwriter"],
    },
    CANCELLED: {
      allowedRoles: ["borrower", "agency_admin"],
      requiresOwningBorrower: true,
    },
  },
  UNDER_REVIEW: {
    MATCHING: {
      allowedRoles: ["agency_admin", "loan_officer", "underwriter"],
    },
    MORE_INFO_REQUIRED: {
      allowedRoles: ["agency_admin", "loan_officer", "underwriter"],
    },
    AGENCY_REJECTED: {
      allowedRoles: ["agency_admin", "underwriter"],
    },
    CANCELLED: {
      allowedRoles: ["borrower", "agency_admin"],
      requiresOwningBorrower: true,
    },
  },
  MORE_INFO_REQUIRED: {
    UNDER_REVIEW: {
      allowedRoles: ["borrower", "agency_admin", "loan_officer"],
    },
    CANCELLED: {
      allowedRoles: ["borrower", "agency_admin"],
      requiresOwningBorrower: true,
    },
    EXPIRED: {
      allowedRoles: ["agency_admin"],
    },
  },
  MATCHING: {
    LENDER_PENDING: {
      allowedRoles: ["agency_admin", "loan_officer"],
    },
    AGENCY_REJECTED: {
      allowedRoles: ["agency_admin"],
    },
    CANCELLED: {
      allowedRoles: ["borrower", "agency_admin"],
      requiresOwningBorrower: true,
    },
  },
  LENDER_PENDING: {
    LENDER_ACCEPTED: {
      allowedRoles: ["lender"],
      requiresAssignedLender: true,
    },
    LENDER_DECLINED: {
      allowedRoles: ["lender"],
      requiresAssignedLender: true,
    },
    MATCHING: {
      // Re-assign or rematch with another lender
      allowedRoles: ["agency_admin", "loan_officer"],
    },
    LENDER_PENDING: {
      // Re-propose or revise terms with next version
      allowedRoles: ["agency_admin", "loan_officer"],
    },
    EXPIRED: {
      allowedRoles: ["agency_admin"],
    },
    CANCELLED: {
      allowedRoles: ["borrower", "agency_admin"],
      requiresOwningBorrower: true,
    },
  },
  LENDER_DECLINED: {
    MATCHING: {
      // Fallback matching to alternative lender
      allowedRoles: ["agency_admin", "loan_officer"],
    },
    AGENCY_REJECTED: {
      allowedRoles: ["agency_admin"],
    },
    CANCELLED: {
      allowedRoles: ["borrower", "agency_admin"],
      requiresOwningBorrower: true,
    },
  },
  // CRITICAL GUARD: Lender acceptance CANNOT jump to BORROWER_ACCEPTED or PENDING_DISBURSEMENT.
  // It MUST proceed to AGENCY_APPROVED or AGENCY_REJECTED.
  LENDER_ACCEPTED: {
    AGENCY_APPROVED: {
      allowedRoles: ["agency_admin", "underwriter"],
    },
    AGENCY_REJECTED: {
      allowedRoles: ["agency_admin", "underwriter"],
    },
    CANCELLED: {
      allowedRoles: ["borrower", "agency_admin"],
      requiresOwningBorrower: true,
    },
  },
  // CRITICAL GUARD: Agency approved proposal CANNOT be disbursed until borrower accepts and consents.
  AGENCY_APPROVED: {
    BORROWER_ACCEPTED: {
      allowedRoles: ["borrower"],
      requiresOwningBorrower: true,
      requiresConsentSnapshot: true,
    },
    BORROWER_DECLINED: {
      allowedRoles: ["borrower"],
      requiresOwningBorrower: true,
    },
    EXPIRED: {
      allowedRoles: ["agency_admin"],
    },
    CANCELLED: {
      allowedRoles: ["borrower", "agency_admin"],
      requiresOwningBorrower: true,
    },
  },
  // CRITICAL GUARD: Only after borrower accepts with verified consent can loan transition to disbursement.
  BORROWER_ACCEPTED: {
    PENDING_DISBURSEMENT: {
      allowedRoles: ["agency_admin", "loan_officer", "cashier"],
      requiresConsentSnapshot: true,
    },
    CANCELLED: {
      allowedRoles: ["agency_admin"],
    },
  },
  PENDING_DISBURSEMENT: {
    ACTIVE: {
      allowedRoles: ["agency_admin", "cashier"],
      requiresConsentSnapshot: true,
    },
    CANCELLED: {
      allowedRoles: ["agency_admin"],
    },
  },
  ACTIVE: {
    PAID_OFF: {
      allowedRoles: ["agency_admin", "cashier"],
    },
    DELINQUENT: {
      allowedRoles: ["agency_admin", "loan_officer"],
    },
    RESTRUCTURED: {
      allowedRoles: ["agency_admin", "underwriter"],
    },
  },
  DELINQUENT: {
    PAID_OFF: {
      allowedRoles: ["agency_admin", "cashier"],
    },
    RESTRUCTURED: {
      allowedRoles: ["agency_admin", "underwriter"],
    },
    CLOSED: {
      allowedRoles: ["agency_admin"],
    },
  },
  RESTRUCTURED: {
    ACTIVE: {
      allowedRoles: ["agency_admin", "cashier"],
    },
    PAID_OFF: {
      allowedRoles: ["agency_admin", "cashier"],
    },
    DELINQUENT: {
      allowedRoles: ["agency_admin"],
    },
  },
  PAID_OFF: {
    CLOSED: {
      allowedRoles: ["agency_admin"],
    },
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
  assignedLenderId?: string;
  activeProposalId?: string;
  hasValidConsentSnapshot?: boolean;
}

export class StateTransitionError extends Error {
  public code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "StateTransitionError";
    this.code = code;
  }
}

/**
 * Validates a state transition against Gidfine's strict guard rules.
 *
 * Enforces:
 * 1. Multi-tenant agency isolation (cross-agency manipulation rejected).
 * 2. Status existence and allowed transition validation.
 * 3. Role authorization checks.
 * 4. Specific role bindings (assigned lender vs random lender, owning borrower vs third party).
 * 5. Mandatory affirmative borrower consent before disbursement transitions.
 */
export function validateStateTransition(ctx: TransitionContext): { valid: true } {
  // 1. Multi-tenant isolation guard
  if (ctx.actorAgencyId !== ctx.applicationAgencyId) {
    throw new StateTransitionError(
      `Tenant Isolation Violation: Actor agency ${ctx.actorAgencyId} does not match application agency ${ctx.applicationAgencyId}`,
      "TENANT_ISOLATION_VIOLATION"
    );
  }

  // 2. Validate current status allows target transition
  const currentTransitions = ALLOWED_TRANSITIONS[ctx.currentStatus];
  if (!currentTransitions) {
    throw new StateTransitionError(
      `Terminal or unhandled status: Application in status '${ctx.currentStatus}' has no allowed outgoing transitions.`,
      "TERMINAL_STATE"
    );
  }

  const rule = currentTransitions[ctx.targetStatus];
  if (!rule) {
    throw new StateTransitionError(
      `Invalid transition: Transition from '${ctx.currentStatus}' to '${ctx.targetStatus}' is prohibited by the state machine.`,
      "ILLEGAL_TRANSITION"
    );
  }

  // 3. Role authorization check
  if (!rule.allowedRoles.includes(ctx.actorRole)) {
    throw new StateTransitionError(
      `Unauthorized role: Role '${ctx.actorRole}' is not permitted to perform transition '${ctx.currentStatus}' -> '${ctx.targetStatus}'. Required: [${rule.allowedRoles.join(", ")}]`,
      "UNAUTHORIZED_ROLE"
    );
  }

  // 4. Lender assignment check
  if (rule.requiresAssignedLender) {
    if (ctx.actorRole === "lender") {
      if (!ctx.assignedLenderId || ctx.assignedLenderId !== ctx.actorUserId) {
        throw new StateTransitionError(
          `Lender Mismatch: User ${ctx.actorUserId} is not the assigned lender (${ctx.assignedLenderId || "none"}) for this application.`,
          "LENDER_NOT_ASSIGNED"
        );
      }
    }
  }

  // 5. Borrower ownership check
  if (rule.requiresOwningBorrower) {
    if (ctx.actorRole === "borrower" && ctx.borrowerId !== ctx.actorUserId) {
      throw new StateTransitionError(
        `Borrower Mismatch: User ${ctx.actorUserId} does not own application ${ctx.applicationId}.`,
        "BORROWER_MISMATCH"
      );
    }
  }

  // 6. Mandatory consent snapshot check
  if (rule.requiresConsentSnapshot) {
    if (!ctx.hasValidConsentSnapshot) {
      throw new StateTransitionError(
        `Consent Missing: Transition to '${ctx.targetStatus}' requires an immutable, verified borrower consent snapshot.`,
        "CONSENT_REQUIRED"
      );
    }
  }

  return { valid: true };
}

/**
 * Computes deterministic SHA-256 fingerprint for a borrower consent record.
 * Used for Act 843 affirmative consent snapshot integrity verification.
 */
export async function computeTermsSnapshotHash(terms: {
  applicationId: string;
  proposalId: string;
  borrowerId: string;
  termsVersion: number;
  principalPesewas: number;
  borrowerRateBps: number;
  tenureMonths: number;
  consentedAt: number;
}): Promise<string> {
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

  // Use Web Crypto API available in Convex V8 runtime and Node.js
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
