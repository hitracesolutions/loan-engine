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
});
