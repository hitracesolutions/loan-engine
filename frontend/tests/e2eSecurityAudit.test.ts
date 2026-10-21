import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  submitApplicationHandler,
  proposeTermsHandler,
  decideLenderProposalHandler,
  approveOfferHandler,
  recordConsentHandler,
  getLenderProposalHandler,
  getLenderProposalsHandler,
  checkDisbursementReadinessHandler,
  getBorrowerApplicationsHandler,
  getAgencyReviewQueueHandler,
} from "../convex/loans.ts";
import { computeTermsSnapshotHash } from "../convex/lib/stateMachine.ts";
import type { Doc, Id } from "../convex/_generated/dataModel";

// In-memory mock database store simulating Convex
class MockDatabase {
  private tables: Record<string, Map<string, any>> = {
    agencies: new Map(),
    users: new Map(),
    applications: new Map(),
    lenderProposals: new Map(),
    consents: new Map(),
    auditLogs: new Map(),
  };
  private idCounter = 1;

  generateId<T extends string>(table: T): Id<any> {
    return `${table}_${this.idCounter++}` as Id<any>;
  }

  async get(id: string): Promise<any | null> {
    for (const map of Object.values(this.tables)) {
      if (map.has(id)) {
        return JSON.parse(JSON.stringify(map.get(id)));
      }
    }
    return null;
  }

  async insert(table: string, doc: any): Promise<Id<any>> {
    const id = this.generateId(table);
    const newDoc = { _id: id, _creationTime: Date.now(), ...doc };
    this.tables[table].set(id, newDoc);
    return id;
  }

  async patch(id: string, fields: any): Promise<void> {
    for (const map of Object.values(this.tables)) {
      if (map.has(id)) {
        const existing = map.get(id);
        const updated = { ...existing, ...fields };
        this.tables[tableFromId(id)].set(id, updated);
        return;
      }
    }
    throw new Error(`Document not found: ${id}`);
  }

  query(table: string) {
    const records = Array.from(this.tables[table].values());
    return {
      withIndex: (indexName: string, filterFn: (q: any) => any) => {
        let filtered = records;
        const qBuilder = {
          eq: (field: string, val: any) => {
            filtered = filtered.filter((r) => r[field] === val);
            return qBuilder;
          },
        };
        filterFn(qBuilder);
        return {
          collect: async () => JSON.parse(JSON.stringify(filtered)),
          unique: async () =>
            filtered.length > 0 ? JSON.parse(JSON.stringify(filtered[0])) : null,
        };
      },
    };
  }

  seed(table: string, id: string, doc: any) {
    this.tables[table].set(id, { _id: id, _creationTime: Date.now(), ...doc });
  }

  getAll(table: string) {
    return Array.from(this.tables[table].values());
  }
}

function tableFromId(id: string): string {
  if (id.startsWith("agencies")) return "agencies";
  if (id.startsWith("users")) return "users";
  if (id.startsWith("applications")) return "applications";
  if (id.startsWith("lenderProposals")) return "lenderProposals";
  if (id.startsWith("consents")) return "consents";
  if (id.startsWith("auditLogs")) return "auditLogs";
  return id.split("_")[0];
}

function createMockCtx(db: MockDatabase, identity: any | null) {
  return {
    db: db as any,
    auth: {
      getUserIdentity: async () => identity,
    },
  };
}

describe("GIDFINE PHASE 3C: End-to-End Workflow & Security Integration Audit", () => {
  let db: MockDatabase;

  const agencyAccra = "agencies_accra" as Id<"agencies">;
  const agencyKumasi = "agencies_kumasi" as Id<"agencies">;

  const borrowerAccra1 = "users_borrower_accra_1" as Id<"users">;
  const borrowerAccra2 = "users_borrower_accra_2" as Id<"users">;
  const borrowerKumasi = "users_borrower_kumasi" as Id<"users">;

  const lenderAccra1 = "users_lender_accra_1" as Id<"users">;
  const lenderAccra2 = "users_lender_accra_2" as Id<"users">;
  const lenderKumasi = "users_lender_kumasi" as Id<"users">;

  const officerAccra = "users_officer_accra" as Id<"users">;
  const underwriterAccra = "users_underwriter_accra" as Id<"users">;
  const cashierAccra = "users_cashier_accra" as Id<"users">;
  const officerKumasi = "users_officer_kumasi" as Id<"users">;

  beforeEach(() => {
    db = new MockDatabase();

    // 1. Seed Multi-Tenant Agencies
    db.seed("agencies", agencyAccra, { name: "Accra Commercial Agency", code: "ACCRA", status: "active", createdAt: 1000 });
    db.seed("agencies", agencyKumasi, { name: "Kumasi Sovereign Agency", code: "KUMASI", status: "active", createdAt: 1000 });

    // 2. Seed Users with verified tokenIdentifiers
    db.seed("users", borrowerAccra1, {
      tokenIdentifier: "token_borrower_accra_1",
      agencyId: agencyAccra,
      role: "borrower",
      name: "Kwame Mensah",
      email: "kwame@accra.test",
      phone: "+233240000001",
      status: "active",
      createdAt: 1000,
    });

    db.seed("users", borrowerAccra2, {
      tokenIdentifier: "token_borrower_accra_2",
      agencyId: agencyAccra,
      role: "borrower",
      name: "Ama Serwaa",
      email: "ama@accra.test",
      phone: "+233240000002",
      status: "active",
      createdAt: 1000,
    });

    db.seed("users", borrowerKumasi, {
      tokenIdentifier: "token_borrower_kumasi",
      agencyId: agencyKumasi,
      role: "borrower",
      name: "Kofi Boateng",
      email: "kofi@kumasi.test",
      phone: "+233240000003",
      status: "active",
      createdAt: 1000,
    });

    db.seed("users", lenderAccra1, {
      tokenIdentifier: "token_lender_accra_1",
      agencyId: agencyAccra,
      role: "lender",
      name: "Standard Chartered Ghana",
      email: "stanchart@accra.test",
      status: "active",
      createdAt: 1000,
    });

    db.seed("users", lenderAccra2, {
      tokenIdentifier: "token_lender_accra_2",
      agencyId: agencyAccra,
      role: "lender",
      name: "Ecobank Ghana",
      email: "ecobank@accra.test",
      status: "active",
      createdAt: 1000,
    });

    db.seed("users", lenderKumasi, {
      tokenIdentifier: "token_lender_kumasi",
      agencyId: agencyKumasi,
      role: "lender",
      name: "Ashanti Capital Partners",
      email: "ashanti@kumasi.test",
      status: "active",
      createdAt: 1000,
    });

    db.seed("users", officerAccra, {
      tokenIdentifier: "token_officer_accra",
      agencyId: agencyAccra,
      role: "loan_officer",
      name: "Officer Samuel",
      email: "samuel@agency.accra.test",
      status: "active",
      createdAt: 1000,
    });

    db.seed("users", underwriterAccra, {
      tokenIdentifier: "token_underwriter_accra",
      agencyId: agencyAccra,
      role: "underwriter",
      name: "Underwriter Abena",
      email: "abena@agency.accra.test",
      status: "active",
      createdAt: 1000,
    });

    db.seed("users", cashierAccra, {
      tokenIdentifier: "token_cashier_accra",
      agencyId: agencyAccra,
      role: "cashier",
      name: "Cashier Eric",
      email: "eric@agency.accra.test",
      status: "active",
      createdAt: 1000,
    });

    db.seed("users", officerKumasi, {
      tokenIdentifier: "token_officer_kumasi",
      agencyId: agencyKumasi,
      role: "loan_officer",
      name: "Officer Yaw",
      email: "yaw@agency.kumasi.test",
      status: "active",
      createdAt: 1000,
    });
  });

  // =========================================================================
  // 1. COMPLETE END-TO-END WORKFLOW INTEGRATION
  // =========================================================================
  it("executes the full 8-step loan lifecycle from borrower submission to disbursement readiness", async () => {
    // -----------------------------------------------------------------------
    // STEP 1: Borrower Submits Application
    // -----------------------------------------------------------------------
    const borrowerCtx = createMockCtx(db, { tokenIdentifier: "token_borrower_accra_1" });
    const { applicationId } = await submitApplicationHandler(borrowerCtx as any, {
      requestedAmountPesewas: 1500000, // GH₵ 15,000.00
      tenureMonths: 12,
      purpose: "Agricultural Processing Equipment",
    });

    assert(applicationId);
    let appDoc = await db.get(applicationId);
    assert.equal(appDoc.status, "SUBMITTED");
    assert.equal(appDoc.agencyId, agencyAccra);
    assert.equal(appDoc.borrowerId, borrowerAccra1);

    // -----------------------------------------------------------------------
    // STEP 2: Authorized Agency Staff Propose Terms to Assigned Lender
    // -----------------------------------------------------------------------
    const officerCtx = createMockCtx(db, { tokenIdentifier: "token_officer_accra" });
    const { proposalId, version } = await proposeTermsHandler(officerCtx as any, {
      applicationId,
      lenderId: lenderAccra1,
      proposedAmountPesewas: 1500000,
      lenderBaseRateBps: 1650, // 16.50%
      agencyMarginBps: 250,    // 2.50%
      borrowerRateBps: 1900,   // 19.00%
    });

    assert(proposalId);
    assert.equal(version, 1);

    appDoc = await db.get(applicationId);
    assert.equal(appDoc.status, "LENDER_PENDING");
    assert.equal(appDoc.assignedLenderId, lenderAccra1);
    assert.equal(appDoc.activeProposalId, proposalId);

    // -----------------------------------------------------------------------
    // STEP 3: Only the Assigned Lender Decides (Accepts)
    // -----------------------------------------------------------------------
    const assignedLenderCtx = createMockCtx(db, { tokenIdentifier: "token_lender_accra_1" });
    const lenderDecision = await decideLenderProposalHandler(assignedLenderCtx as any, {
      applicationId,
      proposalId,
      decision: "ACCEPT",
    });

    assert.equal(lenderDecision.success, true);
    assert.equal(lenderDecision.status, "LENDER_ACCEPTED");

    appDoc = await db.get(applicationId);
    assert.equal(appDoc.status, "LENDER_ACCEPTED");

    // -----------------------------------------------------------------------
    // STEP 4: Agency Approval Remains a Separate Required Decision
    // -----------------------------------------------------------------------
    const underwriterCtx = createMockCtx(db, { tokenIdentifier: "token_underwriter_accra" });
    const agencyApproval = await approveOfferHandler(underwriterCtx as any, {
      applicationId,
      proposalId,
      notes: "Credit check verified and exposure approved.",
    });

    assert.equal(agencyApproval.success, true);
    assert.equal(agencyApproval.status, "AGENCY_APPROVED");

    appDoc = await db.get(applicationId);
    assert.equal(appDoc.status, "AGENCY_APPROVED");

    // -----------------------------------------------------------------------
    // STEP 5: Only Owning Borrower Provides Affirmative Consent
    // -----------------------------------------------------------------------
    const consentRes = await recordConsentHandler(borrowerCtx as any, {
      applicationId,
      proposalId,
      affirmedConsent: true,
      ipAddress: "102.176.65.12",
    });

    assert(consentRes.consentId);
    assert.equal(consentRes.termsSnapshotHash.length, 64);

    appDoc = await db.get(applicationId);
    assert.equal(appDoc.status, "BORROWER_ACCEPTED");

    // -----------------------------------------------------------------------
    // STEP 6: Consent Applies to Exact Terms Presented (Cryptographic Verification)
    // -----------------------------------------------------------------------
    const consentDoc = await db.get(consentRes.consentId);
    assert.equal(consentDoc.termsVersion, 1);
    assert.equal(consentDoc.principalPesewas, 1500000);
    assert.equal(consentDoc.borrowerRateBps, 1900);
    assert.equal(consentDoc.tenureMonths, 12);

    const recomputedHash = await computeTermsSnapshotHash({
      applicationId,
      proposalId,
      borrowerId: borrowerAccra1,
      termsVersion: 1,
      principalPesewas: 1500000,
      borrowerRateBps: 1900,
      tenureMonths: 12,
      consentedAt: consentDoc.consentedAt,
    });
    assert.equal(recomputedHash, consentRes.termsSnapshotHash);

    // -----------------------------------------------------------------------
    // STEP 7: Disbursement Readiness Verification (Read-Only Safety Audit)
    // -----------------------------------------------------------------------
    const cashierCtx = createMockCtx(db, { tokenIdentifier: "token_cashier_accra" });
    const readiness = await checkDisbursementReadinessHandler(cashierCtx as any, {
      applicationId,
    });

    assert.equal(readiness.readyForDisbursement, true);
    assert.equal(readiness.status, "BORROWER_ACCEPTED");
    assert.equal(readiness.reasons.length, 0);
    assert.equal(readiness.disbursementPrerequisites.hasAgencyApproval, true);
    assert.equal(readiness.disbursementPrerequisites.hasBorrowerConsent, true);
    assert.equal(readiness.disbursementPrerequisites.isConsentFingerprintValid, true);

    // -----------------------------------------------------------------------
    // STEP 8: Confirms No Payment Was Made & Repayment Schedule Is Not Active
    // -----------------------------------------------------------------------
    assert.equal(readiness.paymentInitiated, false);
    assert.equal(readiness.fundingConfirmed, false);
    assert.equal(readiness.repaymentScheduleActive, false);
  });

  // =========================================================================
  // 2. SECURITY & DATA ISOLATION AUDIT
  // =========================================================================
  it("strictly enforces multi-tenant isolation, role authorization, and server-side data redaction", async () => {
    // A. Unauthenticated Requests Rejected
    const nullCtx = createMockCtx(db, null);
    await assert.rejects(
      () => submitApplicationHandler(nullCtx as any, { requestedAmountPesewas: 100000, tenureMonths: 6, purpose: "Test" }),
      /UNAUTHENTICATED/
    );
    await assert.rejects(
      () => getBorrowerApplicationsHandler(nullCtx as any, {}),
      /UNAUTHENTICATED/
    );
    await assert.rejects(
      () => getLenderProposalsHandler(nullCtx as any, {}),
      /UNAUTHENTICATED/
    );
    await assert.rejects(
      () => getAgencyReviewQueueHandler(nullCtx as any, {}),
      /UNAUTHENTICATED/
    );

    // B. Incorrect Roles Rejected
    const borrowerCtx = createMockCtx(db, { tokenIdentifier: "token_borrower_accra_1" });
    const lenderCtx = createMockCtx(db, { tokenIdentifier: "token_lender_accra_1" });
    const officerCtx = createMockCtx(db, { tokenIdentifier: "token_officer_accra" });

    // Borrower cannot propose terms
    await assert.rejects(
      () =>
        proposeTermsHandler(borrowerCtx as any, {
          applicationId: "app_fake" as any,
          lenderId: lenderAccra1,
          proposedAmountPesewas: 500000,
          lenderBaseRateBps: 1800,
        }),
      /FORBIDDEN: Operation requires one of/
    );

    // Lender cannot submit applications
    await assert.rejects(
      () =>
        submitApplicationHandler(lenderCtx as any, {
          requestedAmountPesewas: 500000,
          tenureMonths: 12,
          purpose: "Fraudulent application",
        }),
      /FORBIDDEN: Only registered borrowers/
    );

    // Officer cannot act as lender to decide proposal
    await assert.rejects(
      () =>
        decideLenderProposalHandler(officerCtx as any, {
          applicationId: "app_fake" as any,
          proposalId: "prop_fake" as any,
          decision: "ACCEPT",
        }),
      /FORBIDDEN: Operation requires one of/
    );

    // C. Cross-Agency Isolation: Kumasi officer cannot propose terms for Accra application
    const { applicationId: accraAppId } = await submitApplicationHandler(borrowerCtx as any, {
      requestedAmountPesewas: 800000,
      tenureMonths: 6,
      purpose: "Working Capital",
    });

    const kumasiOfficerCtx = createMockCtx(db, { tokenIdentifier: "token_officer_kumasi" });
    await assert.rejects(
      () =>
        proposeTermsHandler(kumasiOfficerCtx as any, {
          applicationId: accraAppId,
          lenderId: lenderKumasi,
          proposedAmountPesewas: 800000,
          lenderBaseRateBps: 1700,
        }),
      /FORBIDDEN: Tenant Isolation Violation/
    );

    // D. Borrower Ownership: Borrower 2 cannot see Borrower 1's applications
    const borrower1Apps = await getBorrowerApplicationsHandler(borrowerCtx as any, {});
    assert.equal(borrower1Apps.length, 1);
    assert.equal(borrower1Apps[0].applicationId, accraAppId);

    const borrower2Ctx = createMockCtx(db, { tokenIdentifier: "token_borrower_accra_2" });
    const borrower2Apps = await getBorrowerApplicationsHandler(borrower2Ctx as any, {});
    assert.equal(borrower2Apps.length, 0);

    // E. Lender Access Boundary: Unassigned lender cannot view or decide proposal
    const { proposalId } = await proposeTermsHandler(officerCtx as any, {
      applicationId: accraAppId,
      lenderId: lenderAccra1, // assigned to lender 1
      proposedAmountPesewas: 800000,
      lenderBaseRateBps: 1700,
      agencyMarginBps: 300,
      borrowerRateBps: 2000,
    });

    const unassignedLenderCtx = createMockCtx(db, { tokenIdentifier: "token_lender_accra_2" }); // lender 2
    await assert.rejects(
      () =>
        decideLenderProposalHandler(unassignedLenderCtx as any, {
          applicationId: accraAppId,
          proposalId,
          decision: "ACCEPT",
        }),
      /Lender Mismatch/
    );

    // F. Server-Side PII Redaction in Lender Queries
    const lender1Proposals = await getLenderProposalsHandler(lenderCtx as any, {});
    assert.equal(lender1Proposals.length, 1);
    const item = lender1Proposals[0];

    // Assert strictly that borrower identifying fields are NOT present
    assert.equal((item as any).borrowerName, undefined);
    assert.equal((item as any).borrowerPhone, undefined);
    assert.equal((item as any).borrowerEmail, undefined);
    assert.equal((item as any).borrowerId, undefined);
    assert.equal((item as any).kyc, undefined);

    // G. Unauthorized Access to Agency Margin Redacted
    // Lender cannot view agency margin
    assert.equal((item as any).agencyMarginBps, undefined);
    assert.equal((item as any).borrowerRateBps, undefined);

    // Borrower cannot view agency margin or lender base rate before approval
    const borrowerAppBeforeApproval = await getBorrowerApplicationsHandler(borrowerCtx as any, {});
    assert.equal(borrowerAppBeforeApproval[0].activeProposal, null);

    // H. Non-Bypass Invariants: Borrower cannot consent when status is LENDER_ACCEPTED
    await decideLenderProposalHandler(lenderCtx as any, {
      applicationId: accraAppId,
      proposalId,
      decision: "ACCEPT",
    });

    await assert.rejects(
      () =>
        recordConsentHandler(borrowerCtx as any, {
          applicationId: accraAppId,
          proposalId,
          affirmedConsent: true,
        }),
      /Invalid transition.*from 'LENDER_ACCEPTED' to 'BORROWER_ACCEPTED'/
    );

    // Agency underwriter formally approves
    const underwriterCtx = createMockCtx(db, { tokenIdentifier: "token_underwriter_accra" });
    await approveOfferHandler(underwriterCtx as any, {
      applicationId: accraAppId,
      proposalId,
    });

    // Now borrower can view the approved borrower rate (but STILL NOT agency margin or lender base rate)
    const borrowerAppAfterApproval = await getBorrowerApplicationsHandler(borrowerCtx as any, {});
    assert(borrowerAppAfterApproval[0].activeProposal);
    assert.equal(borrowerAppAfterApproval[0].activeProposal.borrowerRateBps, 2000);
    assert.equal((borrowerAppAfterApproval[0].activeProposal as any).agencyMarginBps, undefined);
    assert.equal((borrowerAppAfterApproval[0].activeProposal as any).lenderBaseRateBps, undefined);

    // I. Audit Trail Integrity: Verify all 4 audit log events exist
    const logs = db.getAll("auditLogs");
    const actions = logs.map((l) => l.action);
    assert(actions.includes("APPLICATION_SUBMITTED"));
    assert(actions.includes("PROPOSAL_CREATED"));
    assert(actions.includes("LENDER_PROPOSAL_ACCEPTED"));
    assert(actions.includes("AGENCY_OFFER_APPROVED"));
    for (const log of logs) {
      assert.equal(log.agencyId, agencyAccra);
      assert(log.actorId);
      assert(log.timestamp);
    }
  });
});
