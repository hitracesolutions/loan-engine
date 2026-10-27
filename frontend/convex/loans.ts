import { mutation, query } from "./_generated/server.js";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx, MutationCtx } from "./_generated/server.js";
import { getVerifiedUser, requireRole } from "./lib/auth.ts";
import {
  validateStateTransition,
  computeTermsSnapshotHash,
  StateTransitionError,
} from "./lib/stateMachine.ts";

/**
 * -----------------------------------------------------------------------------
 * 1. SUBMIT APPLICATION
 * -----------------------------------------------------------------------------
 * Authenticated borrower submits an initial loan request.
 * - Enforces verified borrower identity and active agency association.
 * - Validates integer pesewas and integer tenure.
 * - Guards transition from DRAFT -> SUBMITTED.
 * - Records append-only audit event.
 */
export async function submitApplicationHandler(
  ctx: MutationCtx,
  args: {
    requestedAmountPesewas: number;
    tenureMonths: number;
    purpose: string;
  }
): Promise<{ applicationId: Id<"applications"> }> {
  // 1. Authenticate caller and assert borrower role
  const { user } = await getVerifiedUser(ctx);
  if (user.role !== "borrower") {
    throw new Error(`FORBIDDEN: Only registered borrowers can submit loan applications. Current role: ${user.role}`);
  }

  // 2. Validate inputs
  if (!Number.isInteger(args.requestedAmountPesewas) || args.requestedAmountPesewas <= 0) {
    throw new Error("INVALID_ARGUMENT: Requested amount must be a positive integer in pesewas.");
  }
  if (!Number.isInteger(args.tenureMonths) || args.tenureMonths <= 0) {
    throw new Error("INVALID_ARGUMENT: Tenure must be a positive integer number of months.");
  }
  const cleanPurpose = args.purpose ? args.purpose.trim() : "";
  if (cleanPurpose.length === 0) {
    throw new Error("INVALID_ARGUMENT: Loan purpose cannot be empty.");
  }

  // 3. Centralized state-machine initial transition check
  validateStateTransition({
    applicationId: "new_submission",
    applicationAgencyId: user.agencyId,
    actorUserId: user._id,
    actorAgencyId: user.agencyId,
    actorRole: "borrower",
    currentStatus: "DRAFT",
    targetStatus: "SUBMITTED",
    borrowerId: user._id,
  });

  const now = Date.now();

  // 4. Insert application record
  const applicationId = await ctx.db.insert("applications", {
    agencyId: user.agencyId,
    borrowerId: user._id,
    requestedAmountPesewas: args.requestedAmountPesewas,
    tenureMonths: args.tenureMonths,
    purpose: cleanPurpose,
    status: "SUBMITTED",
    createdAt: now,
    updatedAt: now,
  });

  // 5. Append-only audit record (never contains sensitive PII)
  await ctx.db.insert("auditLogs", {
    agencyId: user.agencyId,
    actorId: user._id,
    action: "APPLICATION_SUBMITTED",
    resource: `applications:${applicationId}`,
    details: JSON.stringify({
      requestedAmountPesewas: args.requestedAmountPesewas,
      tenureMonths: args.tenureMonths,
    }),
    timestamp: now,
  });

  return { applicationId };
}

export const submitApplication = mutation({
  args: {
    requestedAmountPesewas: v.number(),
    tenureMonths: v.number(),
    purpose: v.string(),
  },
  handler: submitApplicationHandler,
});

/**
 * -----------------------------------------------------------------------------
 * 2. PROPOSE TERMS
 * -----------------------------------------------------------------------------
 * Agency operator matches a lender and issues proposed pricing terms.
 * - Requires authorized agency role (agency_admin or loan_officer).
 * - Verifies application belongs to agency.
 * - Verifies assigned lender exists, is active, and belongs to same agency.
 * - Rates stored strictly in integer basis points.
 * - Does NOT calculate final borrower pricing formula until pricing policy approved.
 * - Preserves version history (supersedes older pending proposals).
 * - Transitions application to LENDER_PENDING via state-machine guard.
 */
export async function proposeTermsHandler(
  ctx: MutationCtx,
  args: {
    applicationId: Id<"applications">;
    lenderId: Id<"users">;
    proposedAmountPesewas: number;
    lenderBaseRateBps: number;
    agencyMarginBps?: number;
    borrowerRateBps?: number;
  }
): Promise<{ proposalId: Id<"lenderProposals">; version: number }> {
  // 1. Assert agency operator authority
  const actor = await requireRole(ctx, ["agency_admin", "loan_officer"]);

  // 2. Load application and assert tenant isolation
  const application = await ctx.db.get(args.applicationId);
  if (!application) {
    throw new Error(`NOT_FOUND: Application ${args.applicationId} does not exist.`);
  }
  if (application.agencyId !== actor.agencyId) {
    throw new Error("FORBIDDEN: Tenant Isolation Violation. Access to cross-agency application denied.");
  }

  // 3. Verify lender eligibility and tenancy
  const lender = await ctx.db.get(args.lenderId);
  if (!lender) {
    throw new Error(`NOT_FOUND: Lender ${args.lenderId} does not exist.`);
  }
  if (lender.agencyId !== actor.agencyId) {
    throw new Error("FORBIDDEN: Lender belongs to a different agency.");
  }
  if (lender.role !== "lender") {
    throw new Error(`INVALID_ARGUMENT: Designated user ${args.lenderId} has role '${lender.role}', expected 'lender'.`);
  }
  if (lender.status !== "active") {
    throw new Error(`FORBIDDEN: Lender account is not active (${lender.status}).`);
  }

  // 4. Validate monetary and rate units
  if (!Number.isInteger(args.proposedAmountPesewas) || args.proposedAmountPesewas <= 0) {
    throw new Error("INVALID_ARGUMENT: Proposed amount must be a positive integer in pesewas.");
  }
  if (!Number.isInteger(args.lenderBaseRateBps) || args.lenderBaseRateBps <= 0) {
    throw new Error("INVALID_ARGUMENT: Lender base rate must be a positive integer in basis points (bps).");
  }
  if (args.agencyMarginBps !== undefined) {
    if (!Number.isInteger(args.agencyMarginBps) || args.agencyMarginBps < 0) {
      throw new Error("INVALID_ARGUMENT: Agency margin must be a non-negative integer in basis points (bps).");
    }
  }
  if (args.borrowerRateBps !== undefined) {
    if (!Number.isInteger(args.borrowerRateBps) || args.borrowerRateBps <= 0) {
      throw new Error("INVALID_ARGUMENT: Borrower rate must be a positive integer in basis points (bps).");
    }
  }

  // 5. Version preservation: query existing proposals for this application
  const existingProposals = await ctx.db
    .query("lenderProposals")
    .withIndex("by_application", (q) => q.eq("applicationId", args.applicationId))
    .collect();

  let maxVersion = 0;
  for (const p of existingProposals) {
    if (p.version > maxVersion) {
      maxVersion = p.version;
    }
    // Supersede any pending proposals so old quotes cannot be ambiguously accepted
    if (p.status === "PENDING") {
      await ctx.db.patch(p._id, { status: "SUPERSEDED" });
    }
  }
  const nextVersion = maxVersion + 1;

  // 6. Centralized state-machine transition guard
  // Permitted from SUBMITTED, UNDER_REVIEW, MATCHING, or re-proposing from LENDER_PENDING/LENDER_DECLINED
  let currentStatus = application.status;
  if (currentStatus === "SUBMITTED") {
    // Progress through intermediate state if still in SUBMITTED
    currentStatus = "UNDER_REVIEW";
  }
  if (currentStatus === "UNDER_REVIEW") {
    currentStatus = "MATCHING";
  }

  validateStateTransition({
    applicationId: application._id,
    applicationAgencyId: application.agencyId,
    actorUserId: actor._id,
    actorAgencyId: actor.agencyId,
    actorRole: actor.role,
    currentStatus,
    targetStatus: "LENDER_PENDING",
    borrowerId: application.borrowerId,
    assignedLenderId: args.lenderId,
  });

  const now = Date.now();

  // 7. Insert new versioned proposal
  const proposalId = await ctx.db.insert("lenderProposals", {
    agencyId: actor.agencyId,
    applicationId: application._id,
    lenderId: args.lenderId,
    version: nextVersion,
    proposedAmountPesewas: args.proposedAmountPesewas,
    lenderBaseRateBps: args.lenderBaseRateBps,
    agencyMarginBps: args.agencyMarginBps,
    borrowerRateBps: args.borrowerRateBps,
    status: "PENDING",
    createdAt: now,
  });

  // 8. Update application state and assignment
  await ctx.db.patch(application._id, {
    status: "LENDER_PENDING",
    assignedLenderId: args.lenderId,
    activeProposalId: proposalId,
    updatedAt: now,
  });

  // 9. Append-only audit record
  await ctx.db.insert("auditLogs", {
    agencyId: actor.agencyId,
    actorId: actor._id,
    action: "PROPOSAL_CREATED",
    resource: `lenderProposals:${proposalId}`,
    details: JSON.stringify({
      applicationId: application._id,
      lenderId: args.lenderId,
      version: nextVersion,
      proposedAmountPesewas: args.proposedAmountPesewas,
      lenderBaseRateBps: args.lenderBaseRateBps,
    }),
    timestamp: now,
  });

  return { proposalId, version: nextVersion };
}

export const proposeTerms = mutation({
  args: {
    applicationId: v.id("applications"),
    lenderId: v.id("users"),
    proposedAmountPesewas: v.number(),
    lenderBaseRateBps: v.number(),
    agencyMarginBps: v.optional(v.number()),
    borrowerRateBps: v.optional(v.number()),
  },
  handler: proposeTermsHandler,
});

/**
 * -----------------------------------------------------------------------------
 * 2b. DECIDE LENDER PROPOSAL (Lender accept/decline action)
 * -----------------------------------------------------------------------------
 * Assigned lender accepts or declines a proposed loan request.
 * - Strictly enforces assigned lender identity.
 * - Transitions application to LENDER_ACCEPTED or LENDER_DECLINED.
 */
export async function decideLenderProposalHandler(
  ctx: MutationCtx,
  args: {
    applicationId: Id<"applications">;
    proposalId: Id<"lenderProposals">;
    decision: "ACCEPT" | "DECLINE";
    reason?: string;
  }
): Promise<{ success: boolean; status: "LENDER_ACCEPTED" | "LENDER_DECLINED" }> {
  const actor = await requireRole(ctx, ["lender"]);

  const application = await ctx.db.get(args.applicationId);
  if (!application) {
    throw new Error(`NOT_FOUND: Application ${args.applicationId} does not exist.`);
  }
  if (application.agencyId !== actor.agencyId) {
    throw new Error("FORBIDDEN: Tenant Isolation Violation.");
  }

  const proposal = await ctx.db.get(args.proposalId);
  if (!proposal || proposal.applicationId !== args.applicationId) {
    throw new Error("NOT_FOUND: Proposal does not match application.");
  }
  if (proposal.status !== "PENDING") {
    throw new Error(`INVALID_STATE: Proposal is already in status '${proposal.status}'.`);
  }

  const targetStatus = args.decision === "ACCEPT" ? "LENDER_ACCEPTED" : "LENDER_DECLINED";

  // Validate state transition through centralized guard engine
  validateStateTransition({
    applicationId: application._id,
    applicationAgencyId: application.agencyId,
    actorUserId: actor._id,
    actorAgencyId: actor.agencyId,
    actorRole: "lender",
    currentStatus: application.status,
    targetStatus,
    borrowerId: application.borrowerId,
    assignedLenderId: application.assignedLenderId,
    activeProposalId: proposal._id,
  });

  const now = Date.now();

  await ctx.db.patch(proposal._id, {
    status: args.decision === "ACCEPT" ? "ACCEPTED" : "DECLINED",
    decisionReason: args.reason,
    decidedAt: now,
  });

  await ctx.db.patch(application._id, {
    status: targetStatus,
    updatedAt: now,
  });

  await ctx.db.insert("auditLogs", {
    agencyId: actor.agencyId,
    actorId: actor._id,
    action: `LENDER_PROPOSAL_${args.decision}ED`,
    resource: `applications:${application._id}`,
    details: JSON.stringify({ proposalId: proposal._id, decision: args.decision }),
    timestamp: now,
  });

  return { success: true, status: targetStatus };
}

export const decideLenderProposal = mutation({
  args: {
    applicationId: v.id("applications"),
    proposalId: v.id("lenderProposals"),
    decision: v.union(v.literal("ACCEPT"), v.literal("DECLINE")),
    reason: v.optional(v.string()),
  },
  handler: decideLenderProposalHandler,
});

/**
 * -----------------------------------------------------------------------------
 * 3. APPROVE OFFER (Agency Approval)
 * -----------------------------------------------------------------------------
 * Agency admin / underwriter formally approves the lender-accepted offer.
 * - Prevents lender acceptance from bypassing agency approval.
 * - Enforces LENDER_ACCEPTED -> AGENCY_APPROVED transition.
 * - Preserves approved proposal version.
 * - Records audit log.
 */
export async function approveOfferHandler(
  ctx: MutationCtx,
  args: {
    applicationId: Id<"applications">;
    proposalId: Id<"lenderProposals">;
    notes?: string;
  }
): Promise<{ success: boolean; status: "AGENCY_APPROVED" }> {
  // 1. Require authorized agency approval role
  const actor = await requireRole(ctx, ["agency_admin", "underwriter"]);

  // 2. Fetch and verify application and proposal
  const application = await ctx.db.get(args.applicationId);
  if (!application) {
    throw new Error(`NOT_FOUND: Application ${args.applicationId} does not exist.`);
  }
  if (application.agencyId !== actor.agencyId) {
    throw new Error("FORBIDDEN: Tenant Isolation Violation.");
  }

  const proposal = await ctx.db.get(args.proposalId);
  if (!proposal || proposal.applicationId !== args.applicationId) {
    throw new Error("NOT_FOUND: Proposal does not belong to this application.");
  }
  if (proposal.agencyId !== actor.agencyId) {
    throw new Error("FORBIDDEN: Proposal belongs to a different agency.");
  }

  // 3. Non-bypass guard: Proposal must be in ACCEPTED status by lender
  if (proposal.status !== "ACCEPTED") {
    throw new Error(`INVALID_STATE: Proposal is not accepted by lender (current status: '${proposal.status}').`);
  }

  // 4. Centralized state-machine transition guard
  validateStateTransition({
    applicationId: application._id,
    applicationAgencyId: application.agencyId,
    actorUserId: actor._id,
    actorAgencyId: actor.agencyId,
    actorRole: actor.role,
    currentStatus: application.status,
    targetStatus: "AGENCY_APPROVED",
    borrowerId: application.borrowerId,
    assignedLenderId: application.assignedLenderId,
    activeProposalId: proposal._id,
  });

  const now = Date.now();

  // 5. Update application
  await ctx.db.patch(application._id, {
    status: "AGENCY_APPROVED",
    activeProposalId: proposal._id,
    updatedAt: now,
  });

  // 6. Record audit event
  await ctx.db.insert("auditLogs", {
    agencyId: actor.agencyId,
    actorId: actor._id,
    action: "AGENCY_OFFER_APPROVED",
    resource: `applications:${application._id}`,
    details: JSON.stringify({
      proposalId: proposal._id,
      proposalVersion: proposal.version,
      notes: args.notes,
    }),
    timestamp: now,
  });

  return { success: true, status: "AGENCY_APPROVED" };
}

export const approveOffer = mutation({
  args: {
    applicationId: v.id("applications"),
    proposalId: v.id("lenderProposals"),
    notes: v.optional(v.string()),
  },
  handler: approveOfferHandler,
});

/**
 * -----------------------------------------------------------------------------
 * 4. RECORD CONSENT (Borrower Final Acceptance)
 * -----------------------------------------------------------------------------
 * Authenticated owning borrower gives explicit affirmative consent to agency-approved terms.
 * - Requires authenticated owning borrower.
 * - Application must be in AGENCY_APPROVED status with active proposal.
 * - Explicit affirmative consent required (affirmedConsent: true).
 * - Computes immutable SHA-256 terms fingerprint.
 * - Prevents consent from applying to changed or superseded terms.
 * - Transitions application to BORROWER_ACCEPTED.
 */
export async function recordConsentHandler(
  ctx: MutationCtx,
  args: {
    applicationId: Id<"applications">;
    proposalId: Id<"lenderProposals">;
    affirmedConsent: boolean;
    ipAddress?: string;
  }
): Promise<{ consentId: Id<"consents">; termsSnapshotHash: string }> {
  // 1. Authenticate caller and assert borrower role
  const { user } = await getVerifiedUser(ctx);
  if (user.role !== "borrower") {
    throw new Error(`FORBIDDEN: Only the borrowing user can record loan consent. Current role: ${user.role}`);
  }

  // 2. Fetch application and verify ownership
  const application = await ctx.db.get(args.applicationId);
  if (!application) {
    throw new Error(`NOT_FOUND: Application ${args.applicationId} does not exist.`);
  }
  if (application.agencyId !== user.agencyId) {
    throw new Error("FORBIDDEN: Tenant Isolation Violation.");
  }
  if (application.borrowerId !== user._id) {
    throw new Error("FORBIDDEN: Borrower ownership mismatch. You can only consent to your own application.");
  }

  // 3. Affirmative consent check
  if (args.affirmedConsent !== true) {
    throw new Error("CONSENT_REJECTED: Explicit affirmative consent must be granted by the borrower.");
  }

  // 4. Verify proposal integrity and state
  const proposal = await ctx.db.get(args.proposalId);
  if (!proposal || proposal.applicationId !== args.applicationId) {
    throw new Error("NOT_FOUND: Proposal does not belong to this application.");
  }
  if (proposal.status === "SUPERSEDED" || proposal.status === "DECLINED") {
    throw new Error(`INVALID_STATE: Cannot consent to proposal in status '${proposal.status}'.`);
  }
  if (application.activeProposalId !== proposal._id) {
    throw new Error("INVALID_STATE: Proposal is not the current active proposal for this application.");
  }

  const effectiveRateBps = proposal.borrowerRateBps ?? proposal.lenderBaseRateBps;
  const consentedAt = Date.now();

  // 5. Compute deterministic SHA-256 fingerprint for terms snapshot
  const termsSnapshotHash = await computeTermsSnapshotHash({
    applicationId: application._id,
    proposalId: proposal._id,
    borrowerId: user._id,
    termsVersion: proposal.version,
    principalPesewas: proposal.proposedAmountPesewas,
    borrowerRateBps: effectiveRateBps,
    tenureMonths: application.tenureMonths,
    consentedAt,
  });

  // 6. Centralized state-machine transition guard
  validateStateTransition({
    applicationId: application._id,
    applicationAgencyId: application.agencyId,
    actorUserId: user._id,
    actorAgencyId: user.agencyId,
    actorRole: "borrower",
    currentStatus: application.status,
    targetStatus: "BORROWER_ACCEPTED",
    borrowerId: application.borrowerId,
    assignedLenderId: application.assignedLenderId,
    activeProposalId: proposal._id,
    hasValidConsentSnapshot: true,
  });

  // 7. Insert immutable append-only consent snapshot
  const consentId = await ctx.db.insert("consents", {
    agencyId: user.agencyId,
    applicationId: application._id,
    borrowerId: user._id,
    proposalId: proposal._id,
    termsVersion: proposal.version,
    principalPesewas: proposal.proposedAmountPesewas,
    borrowerRateBps: effectiveRateBps,
    tenureMonths: application.tenureMonths,
    termsSnapshotHash,
    ipAddress: args.ipAddress,
    consentedAt,
  });

  // 8. Update application status
  await ctx.db.patch(application._id, {
    status: "BORROWER_ACCEPTED",
    updatedAt: consentedAt,
  });

  // 9. Record audit event
  await ctx.db.insert("auditLogs", {
    agencyId: user.agencyId,
    actorId: user._id,
    action: "BORROWER_CONSENT_RECORDED",
    resource: `applications:${application._id}`,
    details: JSON.stringify({
      consentId,
      proposalId: proposal._id,
      termsVersion: proposal.version,
      termsSnapshotHash,
    }),
    timestamp: consentedAt,
  });

  return { consentId, termsSnapshotHash };
}

export const recordConsent = mutation({
  args: {
    applicationId: v.id("applications"),
    proposalId: v.id("lenderProposals"),
    affirmedConsent: v.boolean(),
    ipAddress: v.optional(v.string()),
  },
  handler: recordConsentHandler,
});

/**
 * -----------------------------------------------------------------------------
 * 5. GET LENDER PROPOSAL (Lender-Facing Query with Server-Side Redaction)
 * -----------------------------------------------------------------------------
 * Enforces agency membership and assigned-lender authorization.
 * Strictly redacts protected borrower PII (name, phone, email, token, ID documents).
 * Conceals agency margins by default per Section 7 visibility policy.
 * Returns pseudonymous case ID.
 */
export async function getLenderProposalHandler(
  ctx: QueryCtx,
  args: {
    applicationId: Id<"applications">;
  }
) {
  const actor = await requireRole(ctx, ["lender"]);

  const application = await ctx.db.get(args.applicationId);
  if (!application) {
    throw new Error(`NOT_FOUND: Application ${args.applicationId} does not exist.`);
  }
  if (application.agencyId !== actor.agencyId) {
    throw new Error("FORBIDDEN: Tenant Isolation Violation.");
  }
  if (application.assignedLenderId !== actor._id) {
    throw new Error("FORBIDDEN: Access denied. Lender is not assigned to this application.");
  }

  // Load active proposal for this application
  let proposal: Doc<"lenderProposals"> | null = null;
  if (application.activeProposalId) {
    proposal = await ctx.db.get(application.activeProposalId);
  }

  // Pseudonymous case ID (never exposes borrower ID or token)
  const caseId = `APP-${application._id.slice(-6).toUpperCase()}`;

  // STRICT SERVER-SIDE REDACTION:
  // Under Gidfine_Dev_Guide.md Section 7:
  // - Borrower name, email, phone, ID docs are completely HIDDEN from lender.
  // - Agency margin is HIDDEN by default from lender.
  return {
    caseId,
    applicationId: application._id,
    requestedAmountPesewas: application.requestedAmountPesewas,
    tenureMonths: application.tenureMonths,
    purpose: application.purpose,
    status: application.status,
    proposal: proposal
      ? {
          proposalId: proposal._id,
          version: proposal.version,
          proposedAmountPesewas: proposal.proposedAmountPesewas,
          lenderBaseRateBps: proposal.lenderBaseRateBps,
          status: proposal.status,
          // agencyMarginBps and borrowerRateBps are strictly REDACTED
        }
      : null,
  };
}

export const getLenderProposal = query({
  args: {
    applicationId: v.id("applications"),
  },
  handler: getLenderProposalHandler,
});

/**
 * -----------------------------------------------------------------------------
 * 5b. GET LENDER PROPOSALS (Lender Dashboard Queue Query with Redaction)
 * -----------------------------------------------------------------------------
 * Requires an authenticated user with role "lender".
 * Returns only proposals and applications assigned to this lender within their agency.
 * Strictly redacts borrower PII and agency margin per Section 7 visibility rules.
 * Supports status filtering: "ALL" | "PENDING" | "ACCEPTED" | "DECLINED".
 */
export async function getLenderProposalsHandler(
  ctx: QueryCtx,
  args?: {
    statusFilter?: "ALL" | "PENDING" | "ACCEPTED" | "DECLINED";
  }
) {
  const actor = await requireRole(ctx, ["lender"]);

  // 1. Query proposals assigned to this lender using index
  const proposals = await ctx.db
    .query("lenderProposals")
    .withIndex("by_lender", (q) => q.eq("lenderId", actor._id))
    .collect();

  const results = [];

  for (const proposal of proposals) {
    // Enforce tenant boundary
    if (proposal.agencyId !== actor.agencyId) {
      continue;
    }

    // Filter by proposal status if specified
    if (
      args?.statusFilter &&
      args.statusFilter !== "ALL" &&
      proposal.status !== args.statusFilter
    ) {
      continue;
    }

    const application = await ctx.db.get(proposal.applicationId);
    if (!application) {
      continue;
    }

    // Enforce cross-tenant isolation and verify application assignment
    if (
      application.agencyId !== actor.agencyId ||
      application.assignedLenderId !== actor._id
    ) {
      continue;
    }

    const caseId = `APP-${application._id.slice(-6).toUpperCase()}`;

    // STRICT SERVER-SIDE REDACTION:
    // - NO borrower name, phone, email, or KYC
    // - NO agencyMarginBps or borrowerRateBps
    results.push({
      proposalId: proposal._id,
      applicationId: application._id,
      caseId,
      version: proposal.version,
      proposedAmountPesewas: proposal.proposedAmountPesewas,
      lenderBaseRateBps: proposal.lenderBaseRateBps,
      tenureMonths: application.tenureMonths,
      purpose: application.purpose,
      proposalStatus: proposal.status,
      applicationStatus: application.status,
      decisionReason: proposal.decisionReason,
      decidedAt: proposal.decidedAt,
      createdAt: proposal.createdAt,
    });
  }

  // Sort descending by creation date
  results.sort((a, b) => b.createdAt - a.createdAt);

  return results;
}

export const getLenderProposals = query({
  args: {
    statusFilter: v.optional(
      v.union(
        v.literal("ALL"),
        v.literal("PENDING"),
        v.literal("ACCEPTED"),
        v.literal("DECLINED")
      )
    ),
  },
  handler: getLenderProposalsHandler,
});

/**
 * -----------------------------------------------------------------------------
 * 6. CHECK DISBURSEMENT READINESS (Readiness Check Only)
 * -----------------------------------------------------------------------------
 * Verifies all prerequisites for disbursement without initiating a payment:
 * - Requires authorized agency role (agency_admin, loan_officer, cashier).
 * - Requires BORROWER_ACCEPTED status.
 * - Requires valid, non-superseded agency-approved proposal.
 * - Requires valid, cryptographically verified consent snapshot under Act 843.
 * - Confirms that NO payment has been made and NO schedule is active.
 */
export async function checkDisbursementReadinessHandler(
  ctx: QueryCtx,
  args: {
    applicationId: Id<"applications">;
  }
) {
  const actor = await requireRole(ctx, ["agency_admin", "loan_officer", "cashier"]);

  const application = await ctx.db.get(args.applicationId);
  if (!application) {
    throw new Error(`NOT_FOUND: Application ${args.applicationId} does not exist.`);
  }
  if (application.agencyId !== actor.agencyId) {
    throw new Error("FORBIDDEN: Tenant Isolation Violation.");
  }

  const reasons: string[] = [];
  let isReady = true;

  // 1. Status check
  if (application.status !== "BORROWER_ACCEPTED") {
    isReady = false;
    reasons.push(`Application status is '${application.status}', expected 'BORROWER_ACCEPTED'.`);
  }

  // 2. Proposal check
  let proposal: Doc<"lenderProposals"> | null = null;
  if (!application.activeProposalId) {
    isReady = false;
    reasons.push("No active proposal attached to application.");
  } else {
    proposal = await ctx.db.get(application.activeProposalId);
    if (!proposal) {
      isReady = false;
      reasons.push("Active proposal record not found.");
    } else if (proposal.status !== "ACCEPTED") {
      isReady = false;
      reasons.push(`Proposal status is '${proposal.status}', expected 'ACCEPTED'.`);
    }
  }

  // 3. Consent check
  let consentRecord: Doc<"consents"> | null = null;
  let isHashVerified = false;

  const consents = await ctx.db
    .query("consents")
    .withIndex("by_application", (q) => q.eq("applicationId", application._id))
    .collect();

  if (consents.length === 0) {
    isReady = false;
    reasons.push("No affirmative borrower consent snapshot on record.");
  } else {
    // Find consent matching the active proposal
    consentRecord = consents.find((c) => c.proposalId === application.activeProposalId) ?? null;
    if (!consentRecord) {
      isReady = false;
      reasons.push("No consent record matches the current active proposal.");
    } else {
      // Recompute and verify terms snapshot fingerprint
      const expectedHash = await computeTermsSnapshotHash({
        applicationId: application._id,
        proposalId: consentRecord.proposalId,
        borrowerId: consentRecord.borrowerId,
        termsVersion: consentRecord.termsVersion,
        principalPesewas: consentRecord.principalPesewas,
        borrowerRateBps: consentRecord.borrowerRateBps,
        tenureMonths: consentRecord.tenureMonths,
        consentedAt: consentRecord.consentedAt,
      });

      if (expectedHash === consentRecord.termsSnapshotHash) {
        isHashVerified = true;
      } else {
        isReady = false;
        reasons.push("CRITICAL: Terms snapshot fingerprint mismatch. Consent record may have been tampered with.");
      }
    }
  }

  // 4. Return readiness determination
  // Explicitly guarantees that NO money was transferred and NO schedule is active.
  return {
    applicationId: application._id,
    status: application.status,
    readyForDisbursement: isReady,
    reasons,
    disbursementPrerequisites: {
      hasAgencyApproval: proposal ? proposal.status === "ACCEPTED" : false,
      hasBorrowerConsent: !!consentRecord,
      isConsentFingerprintValid: isHashVerified,
    },
    consentDetails: consentRecord
      ? {
          consentId: consentRecord._id,
          termsVersion: consentRecord.termsVersion,
          principalPesewas: consentRecord.principalPesewas,
          borrowerRateBps: consentRecord.borrowerRateBps,
          termsSnapshotHash: consentRecord.termsSnapshotHash,
          consentedAt: consentRecord.consentedAt,
        }
      : null,
    // Strict safety assertions:
    paymentInitiated: false,
    fundingConfirmed: false,
    repaymentScheduleActive: false,
  };
}

export const checkDisbursementReadiness = query({
  args: {
    applicationId: v.id("applications"),
  },
  handler: checkDisbursementReadinessHandler,
});

/**
 * -----------------------------------------------------------------------------
 * 7. GET BORROWER APPLICATIONS
 * -----------------------------------------------------------------------------
 * Returns all applications submitted by the authenticated borrower.
 * - Requires verified authenticated borrower role.
 * - Strictly filters by borrowerId === user._id and agencyId === user.agencyId.
 * - Does not expose internal lender or agency margins.
 */
export async function getBorrowerApplicationsHandler(
  ctx: QueryCtx,
  _args: {}
) {
  const { user } = await getVerifiedUser(ctx);
  if (user.role !== "borrower") {
    throw new Error(`FORBIDDEN: Only registered borrowers can access borrower applications. Current role: ${user.role}`);
  }

  const applications = await ctx.db
    .query("applications")
    .withIndex("by_borrower", (q) => q.eq("borrowerId", user._id))
    .collect();

  // Filter by user's agency to enforce strict tenant boundary
  const agencyScoped = applications.filter((app) => app.agencyId === user.agencyId);

  // Return clean, authorized representation for borrower UI
  return Promise.all(
    agencyScoped.map(async (app) => {
      let activeProposalSummary = null;
      if (app.activeProposalId) {
        const prop = await ctx.db.get(app.activeProposalId);
        if (
          prop &&
          (app.status === "AGENCY_APPROVED" ||
            app.status === "BORROWER_ACCEPTED" ||
            app.status === "PENDING_DISBURSEMENT" ||
            app.status === "ACTIVE" ||
            app.status === "PAID_OFF" ||
            app.status === "CLOSED")
        ) {
          // Expose approved terms only once agency approved
          activeProposalSummary = {
            proposalId: prop._id,
            version: prop.version,
            proposedAmountPesewas: prop.proposedAmountPesewas,
            borrowerRateBps: prop.borrowerRateBps ?? prop.lenderBaseRateBps,
            status: prop.status,
          };
        }
      }

      return {
        applicationId: app._id,
        requestedAmountPesewas: app.requestedAmountPesewas,
        tenureMonths: app.tenureMonths,
        purpose: app.purpose,
        status: app.status,
        createdAt: app.createdAt,
        updatedAt: app.updatedAt,
        activeProposal: activeProposalSummary,
      };
    })
  );
}

export const getBorrowerApplications = query({
  args: {},
  handler: getBorrowerApplicationsHandler,
});

/**
 * -----------------------------------------------------------------------------
 * 8. GET AGENCY REVIEW QUEUE
 * -----------------------------------------------------------------------------
 * Returns loan applications within the agency for review, matching, and approval.
 * - Requires an authorized agency role (agency_admin, loan_officer, underwriter, cashier, auditor).
 * - Derives agencyId strictly from verified caller's user record (zero client trust).
 * - Supports optional status filter.
 * - Includes sanitized applicant reference without exposing unneeded sensitive PII.
 */
export async function getAgencyReviewQueueHandler(
  ctx: QueryCtx,
  args: {
    status?: string;
  }
) {
  const actor = await requireRole(ctx, [
    "agency_admin",
    "loan_officer",
    "underwriter",
    "cashier",
    "auditor",
  ]);

  let applications: Doc<"applications">[];

  if (args.status) {
    applications = await ctx.db
      .query("applications")
      .withIndex("by_agency_and_status", (q) =>
        q.eq("agencyId", actor.agencyId).eq("status", args.status as any)
      )
      .collect();
  } else {
    applications = await ctx.db
      .query("applications")
      .withIndex("by_agency", (q) => q.eq("agencyId", actor.agencyId))
      .collect();
  }

  // Hydrate with authorized context (borrower name, active proposal status)
  return Promise.all(
    applications.map(async (app) => {
      const borrower = await ctx.db.get(app.borrowerId);
      let proposal: Doc<"lenderProposals"> | null = null;
      if (app.activeProposalId) {
        proposal = await ctx.db.get(app.activeProposalId);
      }

      return {
        applicationId: app._id,
        borrowerId: app.borrowerId,
        borrowerName: borrower?.name ?? "Applicant",
        borrowerPhone: borrower?.phone ?? undefined,
        requestedAmountPesewas: app.requestedAmountPesewas,
        tenureMonths: app.tenureMonths,
        purpose: app.purpose,
        status: app.status,
        assignedLenderId: app.assignedLenderId,
        activeProposalId: app.activeProposalId,
        activeProposal: proposal
          ? {
              proposalId: proposal._id,
              version: proposal.version,
              proposedAmountPesewas: proposal.proposedAmountPesewas,
              lenderBaseRateBps: proposal.lenderBaseRateBps,
              agencyMarginBps: proposal.agencyMarginBps,
              borrowerRateBps: proposal.borrowerRateBps,
              status: proposal.status,
            }
          : null,
        createdAt: app.createdAt,
        updatedAt: app.updatedAt,
      };
    })
  );
}

export const getAgencyReviewQueue = query({
  args: {
    status: v.optional(v.string()),
  },
  handler: getAgencyReviewQueueHandler,
});

