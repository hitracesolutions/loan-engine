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
});
