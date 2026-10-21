import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Gidfine Convex Foundation Schema (v1.1 Core)
 * 
 * Strict foundational entities:
 * - Tenancy isolation via agencies
 * - Role-governed user identity tied to verified authentication tokenIdentifier
 * - Immutable audit log trail for server-side authorization and security actions
 * 
 * NOTE: Loan lifecycle, pricing formulas, and disclosure schemas are intentionally
 * withheld pending resolution of blocking business decisions (Calculation standard,
 * Act 843 disclosure fields, and tenancy scope).
 */
export default defineSchema({
  agencies: defineTable({
    name: v.string(),
    code: v.string(),
    status: v.union(v.literal("active"), v.literal("suspended"), v.literal("pending")),
    createdAt: v.number(),
  }).index("by_code", ["code"]),

  users: defineTable({
    tokenIdentifier: v.string(), // Verified identity subject from Auth Provider
    agencyId: v.id("agencies"),  // Tenant isolation boundary
    role: v.union(
      v.literal("agency_admin"),
      v.literal("loan_officer"),
      v.literal("underwriter"),
      v.literal("cashier"),
      v.literal("auditor"),
      v.literal("lender"),
      v.literal("borrower")
    ),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("suspended"), v.literal("pending")),
    createdAt: v.number(),
  })
    .index("by_token", ["tokenIdentifier"])
    .index("by_agency", ["agencyId"]),

  auditLogs: defineTable({
    agencyId: v.id("agencies"),
    actorId: v.id("users"),
    action: v.string(),
    resource: v.string(),
    details: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("by_agency", ["agencyId"])
    .index("by_actor", ["actorId"]),

  /**
   * Mini-scale loan application records.
   * Monetary amounts stored strictly in integer minor units (pesewas: 1 GHS = 100 pesewas).
   * Status governed strictly by centralized state machine guards.
   */
  applications: defineTable({
    agencyId: v.id("agencies"),
    borrowerId: v.id("users"),
    requestedAmountPesewas: v.number(), // Integer pesewas (e.g. 500000 = GHS 5,000.00)
    tenureMonths: v.number(),           // Integer months
    purpose: v.string(),
    status: v.union(
      v.literal("DRAFT"),
      v.literal("SUBMITTED"),
      v.literal("UNDER_REVIEW"),
      v.literal("MATCHING"),
      v.literal("LENDER_PENDING"),
      v.literal("LENDER_ACCEPTED"),
      v.literal("AGENCY_APPROVED"),
      v.literal("BORROWER_ACCEPTED"),
      v.literal("PENDING_DISBURSEMENT"),
      v.literal("ACTIVE"),
      v.literal("PAID_OFF"),
      v.literal("CLOSED"),
      v.literal("MORE_INFO_REQUIRED"),
      v.literal("LENDER_DECLINED"),
      v.literal("AGENCY_REJECTED"),
      v.literal("BORROWER_DECLINED"),
      v.literal("CANCELLED"),
      v.literal("EXPIRED"),
      v.literal("DELINQUENT"),
      v.literal("RESTRUCTURED")
    ),
    assignedLenderId: v.optional(v.id("users")),
    activeProposalId: v.optional(v.id("lenderProposals")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_agency", ["agencyId"])
    .index("by_agency_and_status", ["agencyId", "status"])
    .index("by_borrower", ["borrowerId"])
    .index("by_assigned_lender", ["assignedLenderId"]),

  /**
   * Lender proposals & rate cards.
   * Rates stored in basis points (1% = 100 bps; e.g. 1800 bps = 18.00% p.a.).
   * Every revision creates a new version; history is never silently overwritten.
   */
  lenderProposals: defineTable({
    agencyId: v.id("agencies"),
    applicationId: v.id("applications"),
    lenderId: v.id("users"),
    version: v.number(),
    proposedAmountPesewas: v.number(),
    lenderBaseRateBps: v.number(),          // Basis points (integer)
    agencyMarginBps: v.optional(v.number()), // Basis points (integer)
    borrowerRateBps: v.optional(v.number()), // Basis points (integer)
    status: v.union(
      v.literal("PENDING"),
      v.literal("ACCEPTED"),
      v.literal("DECLINED"),
      v.literal("SUPERSEDED")
    ),
    decisionReason: v.optional(v.string()),
    decidedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_agency", ["agencyId"])
    .index("by_application", ["applicationId"])
    .index("by_lender", ["lenderId"]),

  /**
   * Immutable borrower consent snapshots.
   * Preserves terms snapshot and hash for affirmative legal agreement under Act 843.
   * Historical consents are append-only and cannot be overwritten.
   */
  consents: defineTable({
    agencyId: v.id("agencies"),
    applicationId: v.id("applications"),
    borrowerId: v.id("users"),
    proposalId: v.id("lenderProposals"),
    termsVersion: v.number(),
    principalPesewas: v.number(),
    borrowerRateBps: v.number(),
    tenureMonths: v.number(),
    termsSnapshotHash: v.string(), // SHA-256 fingerprint of agreed terms
    ipAddress: v.optional(v.string()),
    consentedAt: v.number(),
  })
    .index("by_agency", ["agencyId"])
    .index("by_application", ["applicationId"])
    .index("by_borrower", ["borrowerId"]),

  /**
   * Dual-authorization disbursement requests (Maker-Checker workflow).
   * Supports segregation of duties: maker cannot approve their own request.
   * Monetary amounts stored in integer minor units (pesewas: 1 GHS = 100 pesewas).
   */
  disbursementRequests: defineTable({
    agencyId: v.id("agencies"),
    applicationId: v.id("applications"),
    amountPesewas: v.number(), // Integer pesewas
    currency: v.literal("GHS"), // Approved currency convention
    status: v.union(
      v.literal("PENDING_APPROVAL"),
      v.literal("APPROVED"),
      v.literal("REJECTED"),
      v.literal("PROCESSED"),
      v.literal("CANCELLED")
    ),
    makerId: v.id("users"), // Cashier or officer initiating the request
    requestedAt: v.number(), // Timestamp of initial creation
    checkerId: v.optional(v.id("users")), // Authorizer/approver (must !== makerId)
    decidedAt: v.optional(v.number()), // Timestamp of approval/rejection
    externalReference: v.optional(v.string()), // Transfer transaction ID from payment system
    channel: v.optional(
      v.union(
        v.literal("MOMO"),
        v.literal("BANK_TRANSFER"),
        v.literal("CHEQUE"),
        v.literal("CASH")
      )
    ),
    note: v.optional(v.string()),
    rejectionReason: v.optional(v.string()),
    idempotencyKey: v.string(), // Scoped by agency for retry safety
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_agency", ["agencyId"])
    .index("by_application", ["applicationId"])
    .index("by_agency_and_status", ["agencyId", "status"])
    .index("by_agency_and_idempotency", ["agencyId", "idempotencyKey"])
    .index("by_maker", ["makerId"]),

  /**
   * Financial ledger entry records.
   * Monetary amounts stored strictly in integer minor units (GHS pesewas: 1 GHS = 100 pesewas).
   * Supports immutable transaction recording, traceability, and compensating reversals (Phase 4C).
   */
  ledgerEntries: defineTable({
    agencyId: v.id("agencies"),
    applicationId: v.id("applications"),
    entryType: v.union(
      v.literal("DISBURSEMENT"),
      v.literal("REPAYMENT_PRINCIPAL"),
      v.literal("REPAYMENT_INTEREST"),
      v.literal("REPAYMENT_FEE"),
      v.literal("REVERSAL"),
      v.literal("ADJUSTMENT")
    ),
    amountPesewas: v.number(), // Integer pesewas (strictly positive)
    currency: v.literal("GHS"), // Ghana Cedi approved convention
    actorId: v.id("users"), // User initiating or posting the entry
    disbursementRequestId: v.optional(v.id("disbursementRequests")),
    repaymentReceiptId: v.optional(v.string()), // Reference to external/internal repayment receipt
    reversedEntryId: v.optional(v.id("ledgerEntries")), // For compensating reversals
    isReversal: v.boolean(),
    externalReference: v.optional(v.string()), // External bank/MNO/clearing reference
    idempotencyKey: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_agency", ["agencyId"])
    .index("by_application", ["applicationId"])
    .index("by_disbursement_request", ["disbursementRequestId"])
    .index("by_agency_and_idempotency", ["agencyId", "idempotencyKey"])
    .index("by_reversed_entry", ["reversedEntryId"]),

  /**
   * Double-entry General Journal Transactions (Phase 4C).
   * Represents an immutable, balanced transaction event (Total Debits == Total Credits).
   */
  journalTransactions: defineTable({
    agencyId: v.id("agencies"),
    applicationId: v.optional(v.id("applications")),
    transactionType: v.union(
      v.literal("DISBURSEMENT"),
      v.literal("REPAYMENT"),
      v.literal("FEE_ACCRUAL"),
      v.literal("INTEREST_ACCRUAL"),
      v.literal("REVERSAL"),
      v.literal("ADJUSTMENT")
    ),
    reference: v.string(), // E.g., disbursementRequestId or receiptNumber
    description: v.string(),
    totalAmountPesewas: v.number(), // Balanced sum of debits/credits in integer minor units
    currency: v.literal("GHS"),
    postedBy: v.id("users"),
    postedAt: v.number(),
    reversalOfTransactionId: v.optional(v.id("journalTransactions")),
    isReversal: v.boolean(),
    idempotencyKey: v.optional(v.string()),
  })
    .index("by_agency", ["agencyId"])
    .index("by_application", ["applicationId"])
    .index("by_agency_and_idempotency", ["agencyId", "idempotencyKey"])
    .index("by_reference", ["reference"]),

  /**
   * Double-entry Journal Lines (Phase 4C).
   * Explicit debit and credit legs linked to journalTransactions.
   */
  journalLines: defineTable({
    agencyId: v.id("agencies"),
    transactionId: v.id("journalTransactions"),
    accountCode: v.string(), // E.g. "1010-CASH", "1200-LOANS_RECEIVABLE", "2010-LENDER_PAYABLE", "4010-INTEREST_INCOME", "4020-FEE_INCOME"
    accountName: v.string(),
    accountType: v.union(
      v.literal("ASSET"),
      v.literal("LIABILITY"),
      v.literal("EQUITY"),
      v.literal("INCOME"),
      v.literal("EXPENSE")
    ),
    entrySide: v.union(v.literal("DEBIT"), v.literal("CREDIT")),
    amountPesewas: v.number(), // Positive integer minor units
    currency: v.literal("GHS"),
    createdAt: v.number(),
  })
    .index("by_transaction", ["transactionId"])
    .index("by_agency_and_account", ["agencyId", "accountCode"]),

  /**
   * Repayment instalment schedules (Phase 4D).
   * Derived from agreed proposal terms and activated upon disbursement.
   */
  repaymentSchedules: defineTable({
    agencyId: v.id("agencies"),
    applicationId: v.id("applications"),
    instalmentNumber: v.number(),
    dueDate: v.number(),
    principalDuePesewas: v.number(),
    interestDuePesewas: v.number(),
    feesDuePesewas: v.number(),
    totalDuePesewas: v.number(),
    principalPaidPesewas: v.number(),
    interestPaidPesewas: v.number(),
    feesPaidPesewas: v.number(),
    totalPaidPesewas: v.number(),
    status: v.union(
      v.literal("PENDING"),
      v.literal("PARTIALLY_PAID"),
      v.literal("PAID"),
      v.literal("OVERDUE")
    ),
    paidAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_agency", ["agencyId"])
    .index("by_application", ["applicationId"])
    .index("by_application_and_instalment", ["applicationId", "instalmentNumber"]),

  /**
   * Repayment Receipts (Phase 4D).
   * Records cash or transfer receipts and their waterfall allocation.
   */
  repaymentReceipts: defineTable({
    agencyId: v.id("agencies"),
    applicationId: v.id("applications"),
    receiptNumber: v.string(),
    amountPesewas: v.number(),
    currency: v.literal("GHS"),
    channel: v.union(
      v.literal("MOMO"),
      v.literal("BANK_TRANSFER"),
      v.literal("CASH"),
      v.literal("CHEQUE")
    ),
    externalReference: v.optional(v.string()),
    receivedAt: v.number(),
    receivedBy: v.id("users"),
    feesCoveredPesewas: v.number(),
    interestCoveredPesewas: v.number(),
    principalCoveredPesewas: v.number(),
    unallocatedPesewas: v.number(),
    journalTransactionId: v.optional(v.id("journalTransactions")),
    idempotencyKey: v.string(),
    status: v.union(v.literal("POSTED"), v.literal("REVERSED")),
    reversedReceiptId: v.optional(v.id("repaymentReceipts")),
    reversalReason: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_agency", ["agencyId"])
    .index("by_application", ["applicationId"])
    .index("by_agency_and_idempotency", ["agencyId", "idempotencyKey"])
    .index("by_receipt_number", ["receiptNumber"]),

  /**
   * Dual-authorization Reversal Requests (Phase 4C).
   * Requires second person's approval or approved admin override.
   */
  reversalRequests: defineTable({
    agencyId: v.id("agencies"),
    targetType: v.union(
      v.literal("DISBURSEMENT"),
      v.literal("REPAYMENT"),
      v.literal("JOURNAL_ENTRY")
    ),
    targetId: v.string(),
    amountPesewas: v.number(),
    reason: v.string(),
    makerId: v.id("users"),
    checkerId: v.optional(v.id("users")),
    status: v.union(
      v.literal("PENDING_APPROVAL"),
      v.literal("APPROVED"),
      v.literal("REJECTED"),
      v.literal("EXECUTED")
    ),
    isAdminOverride: v.boolean(),
    compensatingTransactionId: v.optional(v.id("journalTransactions")),
    idempotencyKey: v.string(),
    createdAt: v.number(),
    decidedAt: v.optional(v.number()),
  })
    .index("by_agency", ["agencyId"])
    .index("by_agency_and_status", ["agencyId", "status"])
    .index("by_agency_and_idempotency", ["agencyId", "idempotencyKey"]),
});

