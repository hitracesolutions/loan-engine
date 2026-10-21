import { mutation, query } from "./_generated/server.js";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel.d.ts";
import type { MutationCtx, QueryCtx } from "./_generated/server.js";
import { getVerifiedUser, requireRole } from "./lib/auth.ts";
import { validateStateTransition } from "./lib/stateMachine.ts";
import {
  validateMakerCheckerSegregation,
  isValidIdempotencyKey,
  evaluateIdempotencyPayloadMatch,
} from "./lib/ledgerTypes.ts";

/**
 * Standard Chart of Accounts (COA) for Gidfine Double-Entry System
 */
export const CHART_OF_ACCOUNTS = {
  CASH: { code: "1010-CASH", name: "Operating Cash Account", type: "ASSET" as const },
  LOANS_RECEIVABLE: { code: "1200-LOANS_RECEIVABLE", name: "Loans Principal Receivable", type: "ASSET" as const },
  LENDER_PAYABLE: { code: "2010-LENDER_PAYABLE", name: "Lender Capital Payable", type: "LIABILITY" as const },
  INTEREST_INCOME: { code: "4010-INTEREST_INCOME", name: "Interest Income", type: "INCOME" as const },
  FEE_INCOME: { code: "4020-FEE_INCOME", name: "Agency Fee Income", type: "INCOME" as const },
  REVERSAL_CLEARING: { code: "1990-REVERSAL_CLEARING", name: "Reversal Clearing Suspense", type: "ASSET" as const },
};

// =============================================================================
// PHASE 4B: DISBURSEMENT MAKER-CHECKER WORKFLOW
// =============================================================================

/**
 * 1. REQUEST DISBURSEMENT (Maker)
 * Cashier or loan officer initiates disbursement for an application in PENDING_DISBURSEMENT.
 */
export async function requestDisbursementHandler(
  ctx: MutationCtx,
  args: {
    applicationId: Id<"applications">;
    amountPesewas: number;
    channel?: "MOMO" | "BANK_TRANSFER" | "CHEQUE" | "CASH";
    note?: string;
    idempotencyKey: string;
  }
) {
  const actor = await requireRole(ctx, ["cashier", "loan_officer", "agency_admin"]);

  if (!isValidIdempotencyKey(args.idempotencyKey)) {
    throw new Error("INVALID_ARGUMENT: A valid, non-empty idempotencyKey is required.");
  }
  if (!Number.isInteger(args.amountPesewas) || args.amountPesewas <= 0) {
    throw new Error("INVALID_ARGUMENT: Amount must be a positive integer in pesewas.");
  }

  // Idempotency check with OCC read-set registration
  const existing = await ctx.db
    .query("disbursementRequests")
    .withIndex("by_agency_and_idempotency", (q) =>
      q.eq("agencyId", actor.agencyId).eq("idempotencyKey", args.idempotencyKey)
    )
    .first();

  if (existing) {
    const match = evaluateIdempotencyPayloadMatch(existing, {
      amountPesewas: args.amountPesewas,
      applicationId: args.applicationId,
    });
    if (!match.isMatch) {
      throw new Error(match.error);
    }
    return { disbursementRequestId: existing._id, isRetry: true };
  }

  // Verify application state
  const app = await ctx.db.get(args.applicationId);
  if (!app || app.agencyId !== actor.agencyId) {
    throw new Error("NOT_FOUND: Loan application not found within this agency.");
  }
  if (app.status !== "PENDING_DISBURSEMENT") {
    throw new Error(`INVALID_STATE: Application must be in PENDING_DISBURSEMENT to request disbursement. Current: ${app.status}`);
  }

  // Ensure amount matches approved active proposal
  if (!app.activeProposalId) {
    throw new Error("INVALID_STATE: Application has no active proposal.");
  }
  const proposal = await ctx.db.get(app.activeProposalId);
  if (!proposal) {
    throw new Error("NOT_FOUND: Active proposal not found.");
  }
  if (proposal.proposedAmountPesewas !== args.amountPesewas) {
    throw new Error(
      `INVALID_ARGUMENT: Requested disbursement amount (${args.amountPesewas}) must match agreed proposal amount (${proposal.proposedAmountPesewas}).`
    );
  }

  const now = Date.now();
  const requestId = await ctx.db.insert("disbursementRequests", {
    agencyId: actor.agencyId,
    applicationId: args.applicationId,
    amountPesewas: args.amountPesewas,
    currency: "GHS",
    status: "PENDING_APPROVAL",
    makerId: actor._id,
    requestedAt: now,
    channel: args.channel,
    note: args.note,
    idempotencyKey: args.idempotencyKey,
    createdAt: now,
    updatedAt: now,
  });

  await ctx.db.insert("auditLogs", {
    agencyId: actor.agencyId,
    actorId: actor._id,
    action: "DISBURSEMENT_REQUESTED",
    resource: `disbursementRequests/${requestId}`,
    details: JSON.stringify({
      applicationId: args.applicationId,
      amountPesewas: args.amountPesewas,
      channel: args.channel,
    }),
    timestamp: now,
  });

  return { disbursementRequestId: requestId, isRetry: false };
}

/**
 * 2. APPROVE DISBURSEMENT (Checker)
 * Authorizer (underwriter / agency_admin) approves disbursement.
 * Strictly enforces Maker !== Checker segregation of duties.
 */
export async function approveDisbursementHandler(
  ctx: MutationCtx,
  args: {
    disbursementRequestId: Id<"disbursementRequests">;
    externalReference?: string;
  }
) {
  const checker = await requireRole(ctx, ["underwriter", "agency_admin"]);

  const request = await ctx.db.get(args.disbursementRequestId);
  if (!request || request.agencyId !== checker.agencyId) {
    throw new Error("NOT_FOUND: Disbursement request not found in this agency.");
  }
  if (request.status !== "PENDING_APPROVAL") {
    throw new Error(`INVALID_STATE: Request is not PENDING_APPROVAL. Current: ${request.status}`);
  }

  // Strictly enforce Maker-Checker segregation of duties
  const segregation = validateMakerCheckerSegregation(request.makerId, checker._id);
  if (!segregation.isValid) {
    throw new Error(`FORBIDDEN: ${segregation.error}`);
  }

  const now = Date.now();
  await ctx.db.patch(request._id, {
    status: "APPROVED",
    checkerId: checker._id,
    decidedAt: now,
    externalReference: args.externalReference ?? request.externalReference,
    updatedAt: now,
  });

  await ctx.db.insert("auditLogs", {
    agencyId: checker.agencyId,
    actorId: checker._id,
    action: "DISBURSEMENT_APPROVED",
    resource: `disbursementRequests/${request._id}`,
    details: JSON.stringify({
      makerId: request.makerId,
      checkerId: checker._id,
      amountPesewas: request.amountPesewas,
    }),
    timestamp: now,
  });

  return { success: true };
}

/**
 * 3. REJECT DISBURSEMENT (Checker)
 */
export async function rejectDisbursementHandler(
  ctx: MutationCtx,
  args: {
    disbursementRequestId: Id<"disbursementRequests">;
    rejectionReason: string;
  }
) {
  const checker = await requireRole(ctx, ["underwriter", "agency_admin"]);

  const request = await ctx.db.get(args.disbursementRequestId);
  if (!request || request.agencyId !== checker.agencyId) {
    throw new Error("NOT_FOUND: Disbursement request not found in this agency.");
  }
  if (request.status !== "PENDING_APPROVAL") {
    throw new Error(`INVALID_STATE: Request is not PENDING_APPROVAL. Current: ${request.status}`);
  }

  const segregation = validateMakerCheckerSegregation(request.makerId, checker._id);
  if (!segregation.isValid) {
    throw new Error(`FORBIDDEN: ${segregation.error}`);
  }

  const now = Date.now();
  await ctx.db.patch(request._id, {
    status: "REJECTED",
    checkerId: checker._id,
    decidedAt: now,
    rejectionReason: args.rejectionReason,
    updatedAt: now,
  });

  await ctx.db.insert("auditLogs", {
    agencyId: checker.agencyId,
    actorId: checker._id,
    action: "DISBURSEMENT_REJECTED",
    resource: `disbursementRequests/${request._id}`,
    details: JSON.stringify({ reason: args.rejectionReason }),
    timestamp: now,
  });

  return { success: true };
}

/**
 * 4. EXECUTE DISBURSEMENT & ACTIVATE LOAN
 * Triggered once external verification / payment is ready.
 * - Marks disbursement PROCESSED.
 * - Transitions application PENDING_DISBURSEMENT -> ACTIVE.
 * - Posts balanced double-entry journal entry.
 * - Generates repayment schedule.
 */
export async function executeDisbursementHandler(
  ctx: MutationCtx,
  args: {
    disbursementRequestId: Id<"disbursementRequests">;
    externalReference: string;
  }
) {
  const actor = await requireRole(ctx, ["cashier", "agency_admin"]);

  const request = await ctx.db.get(args.disbursementRequestId);
  if (!request || request.agencyId !== actor.agencyId) {
    throw new Error("NOT_FOUND: Disbursement request not found in this agency.");
  }
  if (request.status !== "APPROVED") {
    throw new Error(`INVALID_STATE: Disbursement request must be APPROVED before execution. Current: ${request.status}`);
  }

  const app = await ctx.db.get(request.applicationId);
  if (!app || app.agencyId !== actor.agencyId) {
    throw new Error("NOT_FOUND: Application not found.");
  }
  if (app.status !== "PENDING_DISBURSEMENT") {
    throw new Error(`INVALID_STATE: Application must be PENDING_DISBURSEMENT. Current: ${app.status}`);
  }

  const now = Date.now();

  // Retrieve immutable borrower consent snapshot required by state machine guard
  const consent = await ctx.db
    .query("consents")
    .withIndex("by_application", (q) => q.eq("applicationId", app._id))
    .first();

  if (!consent || !consent.termsSnapshotHash) {
    throw new Error("INVALID_STATE: Verified affirmative borrower consent snapshot is required before disbursement.");
  }

  // Validate state machine transition from PENDING_DISBURSEMENT -> ACTIVE
  validateStateTransition({
    applicationId: app._id,
    applicationAgencyId: app.agencyId,
    actorUserId: actor._id,
    actorAgencyId: actor.agencyId,
    actorRole: actor.role,
    currentStatus: app.status,
    targetStatus: "ACTIVE",
    borrowerId: app.borrowerId,
    assignedLenderId: app.assignedLenderId,
    hasValidConsentSnapshot: Boolean(consent && consent.termsSnapshotHash),
  });

  // 1. Post Balanced Double-Entry Journal Entry (Phase 4C)
  const txId = await ctx.db.insert("journalTransactions", {
    agencyId: actor.agencyId,
    applicationId: app._id,
    transactionType: "DISBURSEMENT",
    reference: args.externalReference,
    description: `Disbursement for loan ${app._id}`,
    totalAmountPesewas: request.amountPesewas,
    currency: "GHS",
    postedBy: actor._id,
    postedAt: now,
    isReversal: false,
    idempotencyKey: `disburse_tx_${request._id}`,
  });

  // Debit: Loans Receivable (Asset +)
  await ctx.db.insert("journalLines", {
    agencyId: actor.agencyId,
    transactionId: txId,
    accountCode: CHART_OF_ACCOUNTS.LOANS_RECEIVABLE.code,
    accountName: CHART_OF_ACCOUNTS.LOANS_RECEIVABLE.name,
    accountType: CHART_OF_ACCOUNTS.LOANS_RECEIVABLE.type,
    entrySide: "DEBIT",
    amountPesewas: request.amountPesewas,
    currency: "GHS",
    createdAt: now,
  });

  // Credit: Cash Account (Asset -)
  await ctx.db.insert("journalLines", {
    agencyId: actor.agencyId,
    transactionId: txId,
    accountCode: CHART_OF_ACCOUNTS.CASH.code,
    accountName: CHART_OF_ACCOUNTS.CASH.name,
    accountType: CHART_OF_ACCOUNTS.CASH.type,
    entrySide: "CREDIT",
    amountPesewas: request.amountPesewas,
    currency: "GHS",
    createdAt: now,
  });

  // 2. Insert into legacy ledgerEntries for backward-compatibility sub-ledger
  await ctx.db.insert("ledgerEntries", {
    agencyId: actor.agencyId,
    applicationId: app._id,
    entryType: "DISBURSEMENT",
    amountPesewas: request.amountPesewas,
    currency: "GHS",
    actorId: actor._id,
    disbursementRequestId: request._id,
    isReversal: false,
    externalReference: args.externalReference,
    idempotencyKey: `subledger_${request._id}`,
    createdAt: now,
  });

  // 3. Generate Repayment Schedule (Phase 4D)
  const proposal = app.activeProposalId ? await ctx.db.get(app.activeProposalId) : null;
  const tenureMonths = app.tenureMonths || 1;
  const monthlyPrincipal = Math.floor(request.amountPesewas / tenureMonths);
  const remainderPrincipal = request.amountPesewas - monthlyPrincipal * tenureMonths;
  const borrowerRateBps = proposal?.borrowerRateBps ?? 0;
  // Simple monthly interest allocation based on agreed bps
  const totalInterestPesewas = Math.round((request.amountPesewas * (borrowerRateBps / 10000) * (tenureMonths / 12)));
  const monthlyInterest = Math.floor(totalInterestPesewas / tenureMonths);
  const remainderInterest = totalInterestPesewas - monthlyInterest * tenureMonths;

  for (let i = 1; i <= tenureMonths; i++) {
    const isLast = i === tenureMonths;
    const princDue = isLast ? monthlyPrincipal + remainderPrincipal : monthlyPrincipal;
    const intDue = isLast ? monthlyInterest + remainderInterest : monthlyInterest;
    const dueTime = now + i * 30 * 24 * 60 * 60 * 1000; // 30-day interval

    await ctx.db.insert("repaymentSchedules", {
      agencyId: actor.agencyId,
      applicationId: app._id,
      instalmentNumber: i,
      dueDate: dueTime,
      principalDuePesewas: princDue,
      interestDuePesewas: intDue,
      feesDuePesewas: 0,
      totalDuePesewas: princDue + intDue,
      principalPaidPesewas: 0,
      interestPaidPesewas: 0,
      feesPaidPesewas: 0,
      totalPaidPesewas: 0,
      status: "PENDING",
      createdAt: now,
    });
  }

  // 4. Update request and application
  await ctx.db.patch(request._id, {
    status: "PROCESSED",
    externalReference: args.externalReference,
    updatedAt: now,
  });

  await ctx.db.patch(app._id, {
    status: "ACTIVE",
    updatedAt: now,
  });

  await ctx.db.insert("auditLogs", {
    agencyId: actor.agencyId,
    actorId: actor._id,
    action: "DISBURSEMENT_EXECUTED_LOAN_ACTIVATED",
    resource: `applications/${app._id}`,
    details: JSON.stringify({
      disbursementRequestId: request._id,
      journalTransactionId: txId,
      externalReference: args.externalReference,
    }),
    timestamp: now,
  });

  return { success: true, journalTransactionId: txId };
}

// =============================================================================
// PHASE 4C: DOUBLE-ENTRY JOURNAL & REVERSAL WORKFLOW
// =============================================================================

/**
 * Validates that journal lines balance: Sum of Debits == Sum of Credits == totalAmountPesewas.
 */
export function validateDoubleEntryBalance(
  lines: Array<{ entrySide: "DEBIT" | "CREDIT"; amountPesewas: number }>,
  expectedTotal: number
): { isBalanced: boolean; error?: string } {
  if (!lines || lines.length < 2) {
    return { isBalanced: false, error: "Journal entry must contain at least two lines." };
  }
  let debitSum = 0;
  let creditSum = 0;

  for (const line of lines) {
    if (!Number.isInteger(line.amountPesewas) || line.amountPesewas <= 0) {
      return { isBalanced: false, error: "Line amounts must be strictly positive integers in pesewas." };
    }
    if (line.entrySide === "DEBIT") {
      debitSum += line.amountPesewas;
    } else if (line.entrySide === "CREDIT") {
      creditSum += line.amountPesewas;
    } else {
      return { isBalanced: false, error: `Invalid entrySide: "${line.entrySide}". Must be DEBIT or CREDIT.` };
    }
  }

  if (debitSum !== creditSum) {
    return {
      isBalanced: false,
      error: `Unbalanced journal entry: Total debits (${debitSum}) do not match total credits (${creditSum}).`,
    };
  }
  if (debitSum !== expectedTotal) {
    return {
      isBalanced: false,
      error: `Total line amount (${debitSum}) does not match transaction totalAmountPesewas (${expectedTotal}).`,
    };
  }

  return { isBalanced: true };
}

/**
 * REQUEST REVERSAL (Phase 4C)
 * Dual-authorization: requires a second person's approval unless admin override is specified.
 */
export async function requestReversalHandler(
  ctx: MutationCtx,
  args: {
    targetType: "DISBURSEMENT" | "REPAYMENT" | "JOURNAL_ENTRY";
    targetId: string;
    amountPesewas: number;
    reason: string;
    adminOverride?: boolean;
    idempotencyKey: string;
  }
) {
  const actor = await requireRole(ctx, ["cashier", "underwriter", "agency_admin"]);

  if (!isValidIdempotencyKey(args.idempotencyKey)) {
    throw new Error("INVALID_ARGUMENT: A valid, non-empty idempotencyKey is required.");
  }
  if (!args.reason || args.reason.trim().length === 0) {
    throw new Error("INVALID_ARGUMENT: Reversal reason must be provided.");
  }

  // Idempotency check
  const existing = await ctx.db
    .query("reversalRequests")
    .withIndex("by_agency_and_idempotency", (q) =>
      q.eq("agencyId", actor.agencyId).eq("idempotencyKey", args.idempotencyKey)
    )
    .first();

  if (existing) {
    return { reversalRequestId: existing._id, status: existing.status, isRetry: true };
  }

  const now = Date.now();
  const isAdminOverride = Boolean(args.adminOverride && actor.role === "agency_admin");

  const reversalId = await ctx.db.insert("reversalRequests", {
    agencyId: actor.agencyId,
    targetType: args.targetType,
    targetId: args.targetId,
    amountPesewas: args.amountPesewas,
    reason: args.reason,
    makerId: actor._id,
    checkerId: isAdminOverride ? actor._id : undefined,
    status: isAdminOverride ? "APPROVED" : "PENDING_APPROVAL",
    isAdminOverride,
    idempotencyKey: args.idempotencyKey,
    createdAt: now,
    decidedAt: isAdminOverride ? now : undefined,
  });

  await ctx.db.insert("auditLogs", {
    agencyId: actor.agencyId,
    actorId: actor._id,
    action: isAdminOverride ? "REVERSAL_APPROVED_ADMIN_OVERRIDE" : "REVERSAL_REQUESTED",
    resource: `reversalRequests/${reversalId}`,
    details: JSON.stringify({
      targetType: args.targetType,
      targetId: args.targetId,
      amountPesewas: args.amountPesewas,
      isAdminOverride,
    }),
    timestamp: now,
  });

  return { reversalRequestId: reversalId, status: isAdminOverride ? "APPROVED" : "PENDING_APPROVAL", isRetry: false };
}

/**
 * APPROVE AND EXECUTE REVERSAL (Phase 4C)
 * Second person approves and posts a balanced compensating transaction.
 */
export async function approveReversalHandler(
  ctx: MutationCtx,
  args: {
    reversalRequestId: Id<"reversalRequests">;
  }
) {
  const checker = await requireRole(ctx, ["underwriter", "agency_admin"]);

  const revReq = await ctx.db.get(args.reversalRequestId);
  if (!revReq || revReq.agencyId !== checker.agencyId) {
    throw new Error("NOT_FOUND: Reversal request not found in this agency.");
  }
  if (revReq.status === "EXECUTED") {
    throw new Error("INVALID_STATE: Reversal has already been executed.");
  }
  if (revReq.status !== "PENDING_APPROVAL" && revReq.status !== "APPROVED") {
    throw new Error(`INVALID_STATE: Reversal is in status ${revReq.status}.`);
  }

  // Segregation of duties: Maker cannot approve unless admin override was initially flagged
  if (!revReq.isAdminOverride) {
    const segregation = validateMakerCheckerSegregation(revReq.makerId, checker._id);
    if (!segregation.isValid) {
      throw new Error(`FORBIDDEN: ${segregation.error}`);
    }
  }

  const now = Date.now();

  // Create compensating journal transaction
  const compTxId = await ctx.db.insert("journalTransactions", {
    agencyId: checker.agencyId,
    transactionType: "REVERSAL",
    reference: `REV-${revReq._id}`,
    description: `Compensating reversal for ${revReq.targetType} ${revReq.targetId}: ${revReq.reason}`,
    totalAmountPesewas: revReq.amountPesewas,
    currency: "GHS",
    postedBy: checker._id,
    postedAt: now,
    isReversal: true,
    idempotencyKey: `comp_tx_${revReq._id}`,
  });

  // Balancing compensating lines (Reversal Clearing vs Cash/Receivable)
  await ctx.db.insert("journalLines", {
    agencyId: checker.agencyId,
    transactionId: compTxId,
    accountCode: CHART_OF_ACCOUNTS.CASH.code,
    accountName: CHART_OF_ACCOUNTS.CASH.name,
    accountType: CHART_OF_ACCOUNTS.CASH.type,
    entrySide: "DEBIT",
    amountPesewas: revReq.amountPesewas,
    currency: "GHS",
    createdAt: now,
  });

  await ctx.db.insert("journalLines", {
    agencyId: checker.agencyId,
    transactionId: compTxId,
    accountCode: CHART_OF_ACCOUNTS.LOANS_RECEIVABLE.code,
    accountName: CHART_OF_ACCOUNTS.LOANS_RECEIVABLE.name,
    accountType: CHART_OF_ACCOUNTS.LOANS_RECEIVABLE.type,
    entrySide: "CREDIT",
    amountPesewas: revReq.amountPesewas,
    currency: "GHS",
    createdAt: now,
  });

  await ctx.db.patch(revReq._id, {
    status: "EXECUTED",
    checkerId: checker._id,
    compensatingTransactionId: compTxId,
    decidedAt: now,
  });

  await ctx.db.insert("auditLogs", {
    agencyId: checker.agencyId,
    actorId: checker._id,
    action: "REVERSAL_EXECUTED",
    resource: `reversalRequests/${revReq._id}`,
    details: JSON.stringify({
      compensatingTransactionId: compTxId,
      amountPesewas: revReq.amountPesewas,
    }),
    timestamp: now,
  });

  return { success: true, compensatingTransactionId: compTxId };
}

// =============================================================================
// PHASE 4D: REPAYMENT WATERFALL ALLOCATION & RECEIPTS
// =============================================================================

/**
 * Waterfall allocation policy confirmed by Matthias:
 * 1. Fees first
 * 2. Interest second
 * 3. Remaining funds reduce principal
 */
export function calculateWaterfallAllocation(
  amountPesewas: number,
  unpaidFeesPesewas: number,
  unpaidInterestPesewas: number,
  unpaidPrincipalPesewas: number
): {
  feesCovered: number;
  interestCovered: number;
  principalCovered: number;
  unallocated: number;
} {
  let remaining = amountPesewas;

  // Tier 1: Fees
  const feesCovered = Math.min(remaining, unpaidFeesPesewas);
  remaining -= feesCovered;

  // Tier 2: Interest
  const interestCovered = Math.min(remaining, unpaidInterestPesewas);
  remaining -= interestCovered;

  // Tier 3: Principal
  const principalCovered = Math.min(remaining, unpaidPrincipalPesewas);
  remaining -= principalCovered;

  return {
    feesCovered,
    interestCovered,
    principalCovered,
    unallocated: remaining,
  };
}

/**
 * RECORD REPAYMENT RECEIPT (Phase 4D)
 * Applies waterfall allocation across instalments and updates repayment schedule.
 */
export async function recordRepaymentHandler(
  ctx: MutationCtx,
  args: {
    applicationId: Id<"applications">;
    amountPesewas: number;
    channel: "MOMO" | "BANK_TRANSFER" | "CASH" | "CHEQUE";
    externalReference?: string;
    idempotencyKey: string;
  }
) {
  const actor = await requireRole(ctx, ["cashier", "agency_admin"]);

  if (!isValidIdempotencyKey(args.idempotencyKey)) {
    throw new Error("INVALID_ARGUMENT: A valid, non-empty idempotencyKey is required.");
  }
  if (!Number.isInteger(args.amountPesewas) || args.amountPesewas <= 0) {
    throw new Error("INVALID_ARGUMENT: Repayment amount must be a positive integer in pesewas.");
  }

  // Idempotency check
  const existing = await ctx.db
    .query("repaymentReceipts")
    .withIndex("by_agency_and_idempotency", (q) =>
      q.eq("agencyId", actor.agencyId).eq("idempotencyKey", args.idempotencyKey)
    )
    .first();

  if (existing) {
    return { receiptId: existing._id, receiptNumber: existing.receiptNumber, isRetry: true };
  }

  const app = await ctx.db.get(args.applicationId);
  if (!app || app.agencyId !== actor.agencyId) {
    throw new Error("NOT_FOUND: Loan application not found within this agency.");
  }
  if (app.status !== "ACTIVE" && app.status !== "DELINQUENT") {
    throw new Error(`INVALID_STATE: Cannot post repayment to a loan in status ${app.status}.`);
  }

  // Fetch repayment schedule ordered by instalmentNumber
  const schedules = await ctx.db
    .query("repaymentSchedules")
    .withIndex("by_application", (q) => q.eq("applicationId", app._id))
    .collect();

  schedules.sort((a, b) => a.instalmentNumber - b.instalmentNumber);

  // Compute aggregate unpaid balances
  let totalUnpaidFees = 0;
  let totalUnpaidInterest = 0;
  let totalUnpaidPrincipal = 0;

  for (const s of schedules) {
    totalUnpaidFees += Math.max(0, s.feesDuePesewas - s.feesPaidPesewas);
    totalUnpaidInterest += Math.max(0, s.interestDuePesewas - s.interestPaidPesewas);
    totalUnpaidPrincipal += Math.max(0, s.principalDuePesewas - s.principalPaidPesewas);
  }

  // Apply confirmed waterfall policy
  const allocation = calculateWaterfallAllocation(
    args.amountPesewas,
    totalUnpaidFees,
    totalUnpaidInterest,
    totalUnpaidPrincipal
  );

  const now = Date.now();
  const receiptNumber = `RCP-${now}-${Math.floor(Math.random() * 1000)}`;

  // Post balanced double-entry journal entry
  const journalTxId = await ctx.db.insert("journalTransactions", {
    agencyId: actor.agencyId,
    applicationId: app._id,
    transactionType: "REPAYMENT",
    reference: receiptNumber,
    description: `Repayment received for loan ${app._id}`,
    totalAmountPesewas: args.amountPesewas,
    currency: "GHS",
    postedBy: actor._id,
    postedAt: now,
    isReversal: false,
    idempotencyKey: `repay_tx_${args.idempotencyKey}`,
  });

  // Debit: Cash account (Cash +)
  await ctx.db.insert("journalLines", {
    agencyId: actor.agencyId,
    transactionId: journalTxId,
    accountCode: CHART_OF_ACCOUNTS.CASH.code,
    accountName: CHART_OF_ACCOUNTS.CASH.name,
    accountType: CHART_OF_ACCOUNTS.CASH.type,
    entrySide: "DEBIT",
    amountPesewas: args.amountPesewas,
    currency: "GHS",
    createdAt: now,
  });

  // Credit: Fees (if any)
  if (allocation.feesCovered > 0) {
    await ctx.db.insert("journalLines", {
      agencyId: actor.agencyId,
      transactionId: journalTxId,
      accountCode: CHART_OF_ACCOUNTS.FEE_INCOME.code,
      accountName: CHART_OF_ACCOUNTS.FEE_INCOME.name,
      accountType: CHART_OF_ACCOUNTS.FEE_INCOME.type,
      entrySide: "CREDIT",
      amountPesewas: allocation.feesCovered,
      currency: "GHS",
      createdAt: now,
    });
  }

  // Credit: Interest (if any)
  if (allocation.interestCovered > 0) {
    await ctx.db.insert("journalLines", {
      agencyId: actor.agencyId,
      transactionId: journalTxId,
      accountCode: CHART_OF_ACCOUNTS.INTEREST_INCOME.code,
      accountName: CHART_OF_ACCOUNTS.INTEREST_INCOME.name,
      accountType: CHART_OF_ACCOUNTS.INTEREST_INCOME.type,
      entrySide: "CREDIT",
      amountPesewas: allocation.interestCovered,
      currency: "GHS",
      createdAt: now,
    });
  }

  // Credit: Principal reduction (or unallocated credit to liability)
  const principalAndUnallocated = allocation.principalCovered + allocation.unallocated;
  if (principalAndUnallocated > 0) {
    await ctx.db.insert("journalLines", {
      agencyId: actor.agencyId,
      transactionId: journalTxId,
      accountCode: CHART_OF_ACCOUNTS.LOANS_RECEIVABLE.code,
      accountName: CHART_OF_ACCOUNTS.LOANS_RECEIVABLE.name,
      accountType: CHART_OF_ACCOUNTS.LOANS_RECEIVABLE.type,
      entrySide: "CREDIT",
      amountPesewas: principalAndUnallocated,
      currency: "GHS",
      createdAt: now,
    });
  }

  // Insert Receipt record
  const receiptId = await ctx.db.insert("repaymentReceipts", {
    agencyId: actor.agencyId,
    applicationId: app._id,
    receiptNumber,
    amountPesewas: args.amountPesewas,
    currency: "GHS",
    channel: args.channel,
    externalReference: args.externalReference,
    receivedAt: now,
    receivedBy: actor._id,
    feesCoveredPesewas: allocation.feesCovered,
    interestCoveredPesewas: allocation.interestCovered,
    principalCoveredPesewas: allocation.principalCovered,
    unallocatedPesewas: allocation.unallocated,
    journalTransactionId: journalTxId,
    idempotencyKey: args.idempotencyKey,
    status: "POSTED",
    createdAt: now,
  });

  // Distribute covered amounts across schedules
  let remainingFeesToDistribute = allocation.feesCovered;
  let remainingInterestToDistribute = allocation.interestCovered;
  let remainingPrincipalToDistribute = allocation.principalCovered;

  for (const s of schedules) {
    let sFeesPaid = s.feesPaidPesewas;
    let sIntPaid = s.interestPaidPesewas;
    let sPrincPaid = s.principalPaidPesewas;

    // Distribute fees
    const feesNeeded = s.feesDuePesewas - sFeesPaid;
    if (feesNeeded > 0 && remainingFeesToDistribute > 0) {
      const take = Math.min(feesNeeded, remainingFeesToDistribute);
      sFeesPaid += take;
      remainingFeesToDistribute -= take;
    }

    // Distribute interest
    const intNeeded = s.interestDuePesewas - sIntPaid;
    if (intNeeded > 0 && remainingInterestToDistribute > 0) {
      const take = Math.min(intNeeded, remainingInterestToDistribute);
      sIntPaid += take;
      remainingInterestToDistribute -= take;
    }

    // Distribute principal
    const princNeeded = s.principalDuePesewas - sPrincPaid;
    if (princNeeded > 0 && remainingPrincipalToDistribute > 0) {
      const take = Math.min(princNeeded, remainingPrincipalToDistribute);
      sPrincPaid += take;
      remainingPrincipalToDistribute -= take;
    }

    const sTotalPaid = sFeesPaid + sIntPaid + sPrincPaid;
    const isPaid = sTotalPaid >= s.totalDuePesewas;
    const isPartiallyPaid = sTotalPaid > 0 && !isPaid;

    await ctx.db.patch(s._id, {
      feesPaidPesewas: sFeesPaid,
      interestPaidPesewas: sIntPaid,
      principalPaidPesewas: sPrincPaid,
      totalPaidPesewas: sTotalPaid,
      status: isPaid ? "PAID" : isPartiallyPaid ? "PARTIALLY_PAID" : s.status,
      paidAt: isPaid ? now : undefined,
    });
  }

  // Check if entire loan is paid off
  const remainingPrincipal = totalUnpaidPrincipal - allocation.principalCovered;
  if (remainingPrincipal <= 0) {
    await ctx.db.patch(app._id, {
      status: "PAID_OFF",
      updatedAt: now,
    });
  }

  await ctx.db.insert("auditLogs", {
    agencyId: actor.agencyId,
    actorId: actor._id,
    action: "REPAYMENT_RECORDED",
    resource: `repaymentReceipts/${receiptId}`,
    details: JSON.stringify({
      receiptNumber,
      amountPesewas: args.amountPesewas,
      allocation,
      remainingPrincipal,
    }),
    timestamp: now,
  });

  return {
    receiptId,
    receiptNumber,
    allocation,
    journalTransactionId: journalTxId,
    isFullyPaid: remainingPrincipal <= 0,
    isRetry: false,
  };
}

// =============================================================================
// QUERIES FOR FRONTEND & AUDIT
// =============================================================================

export async function getDisbursementRequestsHandler(
  ctx: QueryCtx,
  args: { status?: string }
) {
  const actor = await requireRole(ctx, ["cashier", "loan_officer", "underwriter", "agency_admin"]);

  if (args.status) {
    return await ctx.db
      .query("disbursementRequests")
      .withIndex("by_agency_and_status", (q) =>
        q.eq("agencyId", actor.agencyId).eq("status", args.status as any)
      )
      .collect();
  }
  return await ctx.db
    .query("disbursementRequests")
    .withIndex("by_agency", (q) => q.eq("agencyId", actor.agencyId))
    .collect();
}

export async function getJournalTransactionsHandler(
  ctx: QueryCtx,
  args: { applicationId?: Id<"applications"> }
) {
  const actor = await requireRole(ctx, ["cashier", "underwriter", "agency_admin", "auditor"]);

  if (args.applicationId) {
    return await ctx.db
      .query("journalTransactions")
      .withIndex("by_application", (q) => q.eq("applicationId", args.applicationId))
      .collect();
  }
  return await ctx.db
    .query("journalTransactions")
    .withIndex("by_agency", (q) => q.eq("agencyId", actor.agencyId))
    .collect();
}

export async function getRepaymentScheduleHandler(
  ctx: QueryCtx,
  args: { applicationId: Id<"applications"> }
) {
  const user = await getVerifiedUser(ctx);
  const app = await ctx.db.get(args.applicationId);
  if (!app) {
    throw new Error("NOT_FOUND: Application not found.");
  }

  // Cross-tenant barrier
  if (app.agencyId !== user.user.agencyId) {
    throw new Error("FORBIDDEN: Tenant boundary violation.");
  }
  // Borrower ownership barrier
  if (user.user.role === "borrower" && app.borrowerId !== user.user._id) {
    throw new Error("FORBIDDEN: Borrowers can only view their own repayment schedules.");
  }

  const schedules = await ctx.db
    .query("repaymentSchedules")
    .withIndex("by_application", (q) => q.eq("applicationId", args.applicationId))
    .collect();

  schedules.sort((a, b) => a.instalmentNumber - b.instalmentNumber);
  return schedules;
}

// Convex public exports
export const requestDisbursement = mutation({
  args: {
    applicationId: v.id("applications"),
    amountPesewas: v.number(),
    channel: v.optional(v.union(v.literal("MOMO"), v.literal("BANK_TRANSFER"), v.literal("CHEQUE"), v.literal("CASH"))),
    note: v.optional(v.string()),
    idempotencyKey: v.string(),
  },
  handler: requestDisbursementHandler,
});

export const approveDisbursement = mutation({
  args: {
    disbursementRequestId: v.id("disbursementRequests"),
    externalReference: v.optional(v.string()),
  },
  handler: approveDisbursementHandler,
});

export const rejectDisbursement = mutation({
  args: {
    disbursementRequestId: v.id("disbursementRequests"),
    rejectionReason: v.string(),
  },
  handler: rejectDisbursementHandler,
});

export const executeDisbursement = mutation({
  args: {
    disbursementRequestId: v.id("disbursementRequests"),
    externalReference: v.string(),
  },
  handler: executeDisbursementHandler,
});

export const requestReversal = mutation({
  args: {
    targetType: v.union(v.literal("DISBURSEMENT"), v.literal("REPAYMENT"), v.literal("JOURNAL_ENTRY")),
    targetId: v.string(),
    amountPesewas: v.number(),
    reason: v.string(),
    adminOverride: v.optional(v.boolean()),
    idempotencyKey: v.string(),
  },
  handler: requestReversalHandler,
});

export const approveReversal = mutation({
  args: {
    reversalRequestId: v.id("reversalRequests"),
  },
  handler: approveReversalHandler,
});

export const recordRepayment = mutation({
  args: {
    applicationId: v.id("applications"),
    amountPesewas: v.number(),
    channel: v.union(v.literal("MOMO"), v.literal("BANK_TRANSFER"), v.literal("CASH"), v.literal("CHEQUE")),
    externalReference: v.optional(v.string()),
    idempotencyKey: v.string(),
  },
  handler: recordRepaymentHandler,
});

export const getDisbursementRequests = query({
  args: {
    status: v.optional(v.string()),
  },
  handler: getDisbursementRequestsHandler,
});

export const getJournalTransactions = query({
  args: {
    applicationId: v.optional(v.id("applications")),
  },
  handler: getJournalTransactionsHandler,
});

export const getRepaymentSchedule = query({
  args: {
    applicationId: v.id("applications"),
  },
  handler: getRepaymentScheduleHandler,
});
