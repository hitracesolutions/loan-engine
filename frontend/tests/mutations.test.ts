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
        map.set(id, updated);
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

function createMockCtx(db: MockDatabase, identity: any | null) {
  return {
    db: db as any,
    auth: {
      getUserIdentity: async () => identity,
    },
  };
}

describe("Gidfine Phase 2 Secure Convex Mutations & Queries", () => {
  let db: MockDatabase;

  const agencyAccra = "agencies_accra" as Id<"agencies">;
  const agencyKumasi = "agencies_kumasi" as Id<"agencies">;

  const borrowerAccra = "users_borrower_accra" as Id<"users">;
  const borrowerKumasi = "users_borrower_kumasi" as Id<"users">;
  const lenderAccra = "users_lender_accra" as Id<"users">;
  const lenderForeign = "users_lender_foreign" as Id<"users">;
  const officerAccra = "users_officer_accra" as Id<"users">;
  const adminAccra = "users_admin_accra" as Id<"users">;

  beforeEach(() => {
    db = new MockDatabase();

    // Seed Agencies
    db.seed("agencies", agencyAccra, { name: "Accra Main Agency", code: "ACCRA", status: "active", createdAt: 1000 });
    db.seed("agencies", agencyKumasi, { name: "Kumasi Branch", code: "KUMASI", status: "active", createdAt: 1000 });

    // Seed Users
    db.seed("users", borrowerAccra, {
      tokenIdentifier: "sub_borrower_accra",
      agencyId: agencyAccra,
      role: "borrower",
      name: "Kwame Mensah",
      email: "kwame@example.com",
      phone: "+233200000001",
      status: "active",
      createdAt: 1000,
    });

    db.seed("users", borrowerKumasi, {
      tokenIdentifier: "sub_borrower_kumasi",
      agencyId: agencyKumasi,
      role: "borrower",
      name: "Kofi Annan",
      email: "kofi@example.com",
      phone: "+233200000002",
      status: "active",
      createdAt: 1000,
    });

    db.seed("users", lenderAccra, {
      tokenIdentifier: "sub_lender_accra",
      agencyId: agencyAccra,
      role: "lender",
      name: "Apex Capital Ghana",
      email: "apex@example.com",
      status: "active",
      createdAt: 1000,
    });

    db.seed("users", lenderForeign, {
      tokenIdentifier: "sub_lender_foreign",
      agencyId: agencyKumasi,
      role: "lender",
      name: "Kumasi Prime Lender",
      email: "kumasi@example.com",
      status: "active",
      createdAt: 1000,
    });

    db.seed("users", officerAccra, {
      tokenIdentifier: "sub_officer_accra",
      agencyId: agencyAccra,
      role: "loan_officer",
      name: "Abena Serwaa",
      email: "abena@example.com",
      status: "active",
      createdAt: 1000,
    });

    db.seed("users", adminAccra, {
      tokenIdentifier: "sub_admin_accra",
      agencyId: agencyAccra,
      role: "agency_admin",
      name: "Yaw Boateng",
      email: "yaw@example.com",
      status: "active",
      createdAt: 1000,
    });
  });

  // 1. Authentication & Role Authorization
  it("rejects unauthenticated callers across all mutations", async () => {
    const unauthCtx = createMockCtx(db, null);

    await assert.rejects(
      () => submitApplicationHandler(unauthCtx as any, { requestedAmountPesewas: 500000, tenureMonths: 6, purpose: "Stock" }),
      /UNAUTHENTICATED/
    );

    await assert.rejects(
      () =>
        proposeTermsHandler(unauthCtx as any, {
          applicationId: "app_fake" as any,
          lenderId: lenderAccra,
          proposedAmountPesewas: 500000,
          lenderBaseRateBps: 1800,
        }),
      /UNAUTHENTICATED/
    );
  });

  it("rejects unauthorized roles from submitting loan applications", async () => {
    // Lender attempting to submit application
    const lenderCtx = createMockCtx(db, { tokenIdentifier: "sub_lender_accra" });
    await assert.rejects(
      () => submitApplicationHandler(lenderCtx as any, { requestedAmountPesewas: 500000, tenureMonths: 6, purpose: "Stock" }),
      /FORBIDDEN: Only registered borrowers/
    );

    // Loan officer attempting to submit application as borrower
    const officerCtx = createMockCtx(db, { tokenIdentifier: "sub_officer_accra" });
    await assert.rejects(
      () => submitApplicationHandler(officerCtx as any, { requestedAmountPesewas: 500000, tenureMonths: 6, purpose: "Stock" }),
      /FORBIDDEN: Only registered borrowers/
    );
  });

  // 2. submitApplication validation & audit
  it("validates positive amounts and tenure, records audit log in submitApplication", async () => {
    const borrowerCtx = createMockCtx(db, { tokenIdentifier: "sub_borrower_accra" });

    // Reject non-positive or float amounts
    await assert.rejects(
      () => submitApplicationHandler(borrowerCtx as any, { requestedAmountPesewas: -100, tenureMonths: 6, purpose: "Stock" }),
      /INVALID_ARGUMENT: Requested amount must be a positive integer/
    );
    await assert.rejects(
      () => submitApplicationHandler(borrowerCtx as any, { requestedAmountPesewas: 500.5, tenureMonths: 6, purpose: "Stock" }),
      /INVALID_ARGUMENT: Requested amount must be a positive integer/
    );

    // Valid submission
    const res = await submitApplicationHandler(borrowerCtx as any, {
      requestedAmountPesewas: 500000, // GHS 5,000.00
      tenureMonths: 6,
      purpose: "Inventory expansion",
    });
    assert(res.applicationId);

    const app = await db.get(res.applicationId);
    assert.equal(app.status, "SUBMITTED");
    assert.equal(app.requestedAmountPesewas, 500000);
    assert.equal(app.tenureMonths, 6);
    assert.equal(app.agencyId, agencyAccra);
    assert.equal(app.borrowerId, borrowerAccra);

    // Check audit log
    const auditLogs = db.getAll("auditLogs");
    const subLog = auditLogs.find((l) => l.action === "APPLICATION_SUBMITTED");
    assert(subLog);
    assert.equal(subLog.actorId, borrowerAccra);
    assert.equal(subLog.resource, `applications:${res.applicationId}`);
  });

  // 3. proposeTerms & Version Preservation
  it("preserves proposal versions and supersedes pending quotes in proposeTerms", async () => {
    const borrowerCtx = createMockCtx(db, { tokenIdentifier: "sub_borrower_accra" });
    const { applicationId } = await submitApplicationHandler(borrowerCtx as any, {
      requestedAmountPesewas: 500000,
      tenureMonths: 6,
      purpose: "Expansion",
    });

    const officerCtx = createMockCtx(db, { tokenIdentifier: "sub_officer_accra" });

    // Version 1 proposal
    const p1 = await proposeTermsHandler(officerCtx as any, {
      applicationId,
      lenderId: lenderAccra,
      proposedAmountPesewas: 500000,
      lenderBaseRateBps: 2000, // 20.00%
      agencyMarginBps: 400,
    });
    assert.equal(p1.version, 1);

    const prop1Doc = await db.get(p1.proposalId);
    assert.equal(prop1Doc.status, "PENDING");
    assert.equal(prop1Doc.version, 1);

    // Version 2 proposal (e.g. rate counter/adjustment)
    const p2 = await proposeTermsHandler(officerCtx as any, {
      applicationId,
      lenderId: lenderAccra,
      proposedAmountPesewas: 450000,
      lenderBaseRateBps: 1800, // 18.00%
      agencyMarginBps: 400,
    });
    assert.equal(p2.version, 2);

    // Proposal 1 must now be SUPERSEDED, not deleted or silently overwritten
    const prop1After = await db.get(p1.proposalId);
    assert.equal(prop1After.status, "SUPERSEDED");

    const prop2Doc = await db.get(p2.proposalId);
    assert.equal(prop2Doc.status, "PENDING");
    assert.equal(prop2Doc.version, 2);

    // Application reflects new proposal
    const app = await db.get(applicationId);
    assert.equal(app.activeProposalId, p2.proposalId);
    assert.equal(app.status, "LENDER_PENDING");
  });

  // 4. Cross-agency access isolation
  it("strictly enforces tenant isolation across applications and lenders", async () => {
    const borrowerAccraCtx = createMockCtx(db, { tokenIdentifier: "sub_borrower_accra" });
    const { applicationId } = await submitApplicationHandler(borrowerAccraCtx as any, {
      requestedAmountPesewas: 500000,
      tenureMonths: 6,
      purpose: "Accra application",
    });

    const officerAccraCtx = createMockCtx(db, { tokenIdentifier: "sub_officer_accra" });

    // Attempt to assign foreign Kumasi lender to Accra application -> REJECTED
    await assert.rejects(
      () =>
        proposeTermsHandler(officerAccraCtx as any, {
          applicationId,
          lenderId: lenderForeign,
          proposedAmountPesewas: 500000,
          lenderBaseRateBps: 1800,
        }),
      /FORBIDDEN: Lender belongs to a different agency/
    );
  });

  // 5. Non-Bypass Guards & Agency Approval
  it("prevents lender acceptance from bypassing agency approval", async () => {
    const borrowerCtx = createMockCtx(db, { tokenIdentifier: "sub_borrower_accra" });
    const { applicationId } = await submitApplicationHandler(borrowerCtx as any, {
      requestedAmountPesewas: 500000,
      tenureMonths: 6,
      purpose: "Expansion",
    });

    const officerCtx = createMockCtx(db, { tokenIdentifier: "sub_officer_accra" });
    const { proposalId } = await proposeTermsHandler(officerCtx as any, {
      applicationId,
      lenderId: lenderAccra,
      proposedAmountPesewas: 500000,
      lenderBaseRateBps: 1800,
    });

    const lenderCtx = createMockCtx(db, { tokenIdentifier: "sub_lender_accra" });

    // Lender accepts proposal
    const decisionRes = await decideLenderProposalHandler(lenderCtx as any, {
      applicationId,
      proposalId,
      decision: "ACCEPT",
    });
    assert.equal(decisionRes.status, "LENDER_ACCEPTED");

    // CRITICAL: Borrower cannot record consent yet because agency has NOT approved!
    await assert.rejects(
      () =>
        recordConsentHandler(borrowerCtx as any, {
          applicationId,
          proposalId,
          affirmedConsent: true,
        }),
      /Transition from 'LENDER_ACCEPTED' to 'BORROWER_ACCEPTED' is prohibited/
    );

    // Agency admin approves offer
    const adminCtx = createMockCtx(db, { tokenIdentifier: "sub_admin_accra" });
    const approveRes = await approveOfferHandler(adminCtx as any, {
      applicationId,
      proposalId,
      notes: "Underwriting criteria satisfied.",
    });
    assert.equal(approveRes.status, "AGENCY_APPROVED");

    const app = await db.get(applicationId);
    assert.equal(app.status, "AGENCY_APPROVED");
  });

  // 6. Borrower ownership violation & affirmative consent
  it("enforces borrower ownership and explicit affirmative consent", async () => {
    const borrowerCtx = createMockCtx(db, { tokenIdentifier: "sub_borrower_accra" });
    const { applicationId } = await submitApplicationHandler(borrowerCtx as any, {
      requestedAmountPesewas: 500000,
      tenureMonths: 6,
      purpose: "Expansion",
    });

    const officerCtx = createMockCtx(db, { tokenIdentifier: "sub_officer_accra" });
    const { proposalId } = await proposeTermsHandler(officerCtx as any, {
      applicationId,
      lenderId: lenderAccra,
      proposedAmountPesewas: 500000,
      lenderBaseRateBps: 1800,
    });

    const lenderCtx = createMockCtx(db, { tokenIdentifier: "sub_lender_accra" });
    await decideLenderProposalHandler(lenderCtx as any, { applicationId, proposalId, decision: "ACCEPT" });

    const adminCtx = createMockCtx(db, { tokenIdentifier: "sub_admin_accra" });
    await approveOfferHandler(adminCtx as any, { applicationId, proposalId });

    // Imposter borrower (from Kumasi) attempts to accept Accra borrower's loan -> REJECTED
    const imposterCtx = createMockCtx(db, { tokenIdentifier: "sub_borrower_kumasi" });
    await assert.rejects(
      () =>
        recordConsentHandler(imposterCtx as any, {
          applicationId,
          proposalId,
          affirmedConsent: true,
        }),
      /FORBIDDEN: Tenant Isolation Violation/
    );

    // Non-affirmative consent (affirmedConsent: false) -> REJECTED
    await assert.rejects(
      () =>
        recordConsentHandler(borrowerCtx as any, {
          applicationId,
          proposalId,
          affirmedConsent: false,
        }),
      /CONSENT_REJECTED: Explicit affirmative consent must be granted/
    );

    // Legitimate affirmative consent by owning borrower
    const consentRes = await recordConsentHandler(borrowerCtx as any, {
      applicationId,
      proposalId,
      affirmedConsent: true,
      ipAddress: "192.168.1.1",
    });
    assert(consentRes.consentId);
    assert.equal(consentRes.termsSnapshotHash.length, 64);

    const consentDoc = await db.get(consentRes.consentId);
    assert.equal(consentDoc.borrowerId, borrowerAccra);
    assert.equal(consentDoc.termsSnapshotHash, consentRes.termsSnapshotHash);

    const appAfter = await db.get(applicationId);
    assert.equal(appAfter.status, "BORROWER_ACCEPTED");
  });

  // 7. Lender PII Redaction
  it("strictly redacts borrower PII and agency margin from lender query", async () => {
    const borrowerCtx = createMockCtx(db, { tokenIdentifier: "sub_borrower_accra" });
    const { applicationId } = await submitApplicationHandler(borrowerCtx as any, {
      requestedAmountPesewas: 500000,
      tenureMonths: 6,
      purpose: "Machinery purchase",
    });

    const officerCtx = createMockCtx(db, { tokenIdentifier: "sub_officer_accra" });
    await proposeTermsHandler(officerCtx as any, {
      applicationId,
      lenderId: lenderAccra,
      proposedAmountPesewas: 500000,
      lenderBaseRateBps: 1800,
      agencyMarginBps: 300, // 3% margin
      borrowerRateBps: 2100, // 21%
    });

    const lenderCtx = createMockCtx(db, { tokenIdentifier: "sub_lender_accra" });
    const lenderView = await getLenderProposalHandler(lenderCtx as any, { applicationId });

    // Verify pseudonymous case ID
    assert(lenderView.caseId.startsWith("APP-"));
    assert.equal(lenderView.requestedAmountPesewas, 500000);
    assert.equal(lenderView.proposal?.lenderBaseRateBps, 1800);

    // VERIFY REDACTION:
    // Borrower PII fields MUST NOT exist in payload
    assert.equal((lenderView as any).borrower, undefined);
    assert.equal((lenderView as any).borrowerName, undefined);
    assert.equal((lenderView as any).email, undefined);
    assert.equal((lenderView as any).phone, undefined);
    assert.equal((lenderView as any).tokenIdentifier, undefined);

    // Agency margin MUST NOT be exposed to lender
    assert.equal((lenderView.proposal as any).agencyMarginBps, undefined);
    assert.equal((lenderView.proposal as any).borrowerRateBps, undefined);
  });

  // 8. Disbursement Readiness Checks
  it("prohibits payment initiation or schedule activation during disbursement readiness check", async () => {
    const borrowerCtx = createMockCtx(db, { tokenIdentifier: "sub_borrower_accra" });
    const { applicationId } = await submitApplicationHandler(borrowerCtx as any, {
      requestedAmountPesewas: 500000,
      tenureMonths: 6,
      purpose: "Machinery purchase",
    });

    const officerCtx = createMockCtx(db, { tokenIdentifier: "sub_officer_accra" });
    const { proposalId } = await proposeTermsHandler(officerCtx as any, {
      applicationId,
      lenderId: lenderAccra,
      proposedAmountPesewas: 500000,
      lenderBaseRateBps: 1800,
    });

    // Check readiness BEFORE acceptance -> NOT READY
    const unreadyCheck = await checkDisbursementReadinessHandler(officerCtx as any, { applicationId });
    assert.equal(unreadyCheck.readyForDisbursement, false);
    assert.equal(unreadyCheck.paymentInitiated, false);
    assert.equal(unreadyCheck.fundingConfirmed, false);
    assert.equal(unreadyCheck.repaymentScheduleActive, false);

    // Step through to complete borrower consent
    const lenderCtx = createMockCtx(db, { tokenIdentifier: "sub_lender_accra" });
    await decideLenderProposalHandler(lenderCtx as any, { applicationId, proposalId, decision: "ACCEPT" });

    const adminCtx = createMockCtx(db, { tokenIdentifier: "sub_admin_accra" });
    await approveOfferHandler(adminCtx as any, { applicationId, proposalId });

    await recordConsentHandler(borrowerCtx as any, {
      applicationId,
      proposalId,
      affirmedConsent: true,
    });

    // Check readiness AFTER consent -> READY FOR DISBURSEMENT
    const readyCheck = await checkDisbursementReadinessHandler(officerCtx as any, { applicationId });
    assert.equal(readyCheck.readyForDisbursement, true);
    assert.equal(readyCheck.disbursementPrerequisites.hasAgencyApproval, true);
    assert.equal(readyCheck.disbursementPrerequisites.hasBorrowerConsent, true);
    assert.equal(readyCheck.disbursementPrerequisites.isConsentFingerprintValid, true);

    // INVARIANT: Schedule MUST NOT be active and payment MUST NOT be initiated
    assert.equal(readyCheck.paymentInitiated, false);
    assert.equal(readyCheck.fundingConfirmed, false);
    assert.equal(readyCheck.repaymentScheduleActive, false);
  });

  // 9. getBorrowerApplications Query Isolation
  it("strictly enforces borrower ownership and agency boundary in getBorrowerApplications", async () => {
    const borrowerAccraCtx = createMockCtx(db, { tokenIdentifier: "sub_borrower_accra" });
    const borrowerKumasiCtx = createMockCtx(db, { tokenIdentifier: "sub_borrower_kumasi" });

    // Submit Accra application
    const appAccra = await submitApplicationHandler(borrowerAccraCtx as any, {
      requestedAmountPesewas: 500000,
      tenureMonths: 12,
      purpose: "Accra Shop",
    });

    // Submit Kumasi application
    const appKumasi = await submitApplicationHandler(borrowerKumasiCtx as any, {
      requestedAmountPesewas: 300000,
      tenureMonths: 6,
      purpose: "Kumasi Store",
    });

    // Borrower Accra queries their applications
    const accraApps = await getBorrowerApplicationsHandler(borrowerAccraCtx as any, {});
    assert.equal(accraApps.length, 1);
    assert.equal(accraApps[0].applicationId, appAccra.applicationId);
    assert.equal(accraApps[0].requestedAmountPesewas, 500000);

    // Borrower Kumasi queries their applications
    const kumasiApps = await getBorrowerApplicationsHandler(borrowerKumasiCtx as any, {});
    assert.equal(kumasiApps.length, 1);
    assert.equal(kumasiApps[0].applicationId, appKumasi.applicationId);
    assert.equal(kumasiApps[0].requestedAmountPesewas, 300000);

    // Non-borrower (lender) attempting to call borrower query -> REJECTED
    const lenderCtx = createMockCtx(db, { tokenIdentifier: "sub_lender_accra" });
    await assert.rejects(
      () => getBorrowerApplicationsHandler(lenderCtx as any, {}),
      /FORBIDDEN: Only registered borrowers/
    );
  });

  // 10. getAgencyReviewQueue Query Isolation & Filtering
  it("strictly enforces agency tenant isolation and role authorization in getAgencyReviewQueue", async () => {
    const borrowerAccraCtx = createMockCtx(db, { tokenIdentifier: "sub_borrower_accra" });
    const borrowerKumasiCtx = createMockCtx(db, { tokenIdentifier: "sub_borrower_kumasi" });

    // Create applications in both agencies
    await submitApplicationHandler(borrowerAccraCtx as any, {
      requestedAmountPesewas: 700000,
      tenureMonths: 18,
      purpose: "Accra Fleet",
    });

    await submitApplicationHandler(borrowerKumasiCtx as any, {
      requestedAmountPesewas: 250000,
      tenureMonths: 6,
      purpose: "Kumasi Farm",
    });

    const officerAccraCtx = createMockCtx(db, { tokenIdentifier: "sub_officer_accra" });

    // Accra officer queries review queue
    const accraQueue = await getAgencyReviewQueueHandler(officerAccraCtx as any, {});
    // MUST ONLY contain Accra applications
    assert(accraQueue.length >= 1);
    for (const item of accraQueue) {
      const appDoc = await db.get(item.applicationId);
      assert.equal(appDoc.agencyId, agencyAccra);
    }

    // Filter by status SUBMITTED
    const submittedQueue = await getAgencyReviewQueueHandler(officerAccraCtx as any, { status: "SUBMITTED" });
    for (const item of submittedQueue) {
      assert.equal(item.status, "SUBMITTED");
    }

    // Borrower attempting to inspect agency review queue -> REJECTED
    await assert.rejects(
      () => getAgencyReviewQueueHandler(borrowerAccraCtx as any, {}),
      /FORBIDDEN: Operation requires one of/
    );
  });

  // 11. getLenderProposals: Role authorization, cross-agency isolation, and PII redaction
  it("strictly enforces lender role, cross-agency isolation, and PII redaction in getLenderProposals", async () => {
    const borrowerCtx = createMockCtx(db, { tokenIdentifier: "sub_borrower_accra" });
    const { applicationId: appAccraId } = await submitApplicationHandler(borrowerCtx as any, {
      requestedAmountPesewas: 600000,
      tenureMonths: 12,
      purpose: "Accra Logistics Hub",
    });

    const officerAccraCtx = createMockCtx(db, { tokenIdentifier: "sub_officer_accra" });
    const { proposalId: propAccraId } = await proposeTermsHandler(officerAccraCtx as any, {
      applicationId: appAccraId,
      lenderId: lenderAccra,
      proposedAmountPesewas: 600000,
      lenderBaseRateBps: 1750,
      agencyMarginBps: 250,
      borrowerRateBps: 2000,
    });

    // Unauthenticated caller -> REJECTED
    const unauthCtx = createMockCtx(db, null);
    await assert.rejects(
      () => getLenderProposalsHandler(unauthCtx as any, {}),
      /UNAUTHENTICATED/
    );

    // Borrower role attempting to view lender proposals -> REJECTED
    await assert.rejects(
      () => getLenderProposalsHandler(borrowerCtx as any, {}),
      /FORBIDDEN: Operation requires one of/
    );

    // Agency officer attempting to view lender proposals -> REJECTED
    await assert.rejects(
      () => getLenderProposalsHandler(officerAccraCtx as any, {}),
      /FORBIDDEN: Operation requires one of/
    );

    // Assigned Accra lender queries proposals -> SUCCESS
    const lenderAccraCtx = createMockCtx(db, { tokenIdentifier: "sub_lender_accra" });
    const accraProposals = await getLenderProposalsHandler(lenderAccraCtx as any, {});

    assert.equal(accraProposals.length, 1);
    const item = accraProposals[0];
    assert.equal(item.proposalId, propAccraId);
    assert.equal(item.applicationId, appAccraId);
    assert.equal(item.proposedAmountPesewas, 600000);
    assert.equal(item.lenderBaseRateBps, 1750);
    assert.equal(item.proposalStatus, "PENDING");
    assert.equal(item.applicationStatus, "LENDER_PENDING");

    // SERVER-SIDE REDACTION VERIFICATION:
    // PII and margins must NOT be present in item
    assert.equal((item as any).borrowerName, undefined);
    assert.equal((item as any).borrowerPhone, undefined);
    assert.equal((item as any).borrowerEmail, undefined);
    assert.equal((item as any).agencyMarginBps, undefined);
    assert.equal((item as any).borrowerRateBps, undefined);

    // Cross-agency lender from Kumasi queries proposals -> Sees 0 proposals (Strict Isolation)
    const lenderForeignCtx = createMockCtx(db, { tokenIdentifier: "sub_lender_foreign" });
    const kumasiProposals = await getLenderProposalsHandler(lenderForeignCtx as any, {});
    assert.equal(kumasiProposals.length, 0);
  });

  // 12. decideLenderProposal: Accept / Decline and Audit Logs
  it("enforces assigned lender identity and transitions for ACCEPT and DECLINE decisions", async () => {
    // Setup application & proposal
    const borrowerCtx = createMockCtx(db, { tokenIdentifier: "sub_borrower_accra" });
    const { applicationId: app1 } = await submitApplicationHandler(borrowerCtx as any, {
      requestedAmountPesewas: 300000,
      tenureMonths: 6,
      purpose: "Inventory Stocking",
    });

    const officerCtx = createMockCtx(db, { tokenIdentifier: "sub_officer_accra" });
    const { proposalId: prop1 } = await proposeTermsHandler(officerCtx as any, {
      applicationId: app1,
      lenderId: lenderAccra,
      proposedAmountPesewas: 300000,
      lenderBaseRateBps: 1900,
    });

    // Unassigned lender from Kumasi attempts to decide Accra proposal -> REJECTED
    const lenderForeignCtx = createMockCtx(db, { tokenIdentifier: "sub_lender_foreign" });
    await assert.rejects(
      () =>
        decideLenderProposalHandler(lenderForeignCtx as any, {
          applicationId: app1,
          proposalId: prop1,
          decision: "ACCEPT",
        }),
      /FORBIDDEN: Tenant Isolation Violation/
    );

    // Legitimate assigned lender declines with reason
    const lenderAccraCtx = createMockCtx(db, { tokenIdentifier: "sub_lender_accra" });
    const declineRes = await decideLenderProposalHandler(lenderAccraCtx as any, {
      applicationId: app1,
      proposalId: prop1,
      decision: "DECLINE",
      reason: "Exceeds exposure ceiling for inventory loans.",
    });

    assert.equal(declineRes.success, true);
    assert.equal(declineRes.status, "LENDER_DECLINED");

    const appAfterDecline = await db.get(app1);
    assert.equal(appAfterDecline.status, "LENDER_DECLINED");

    const propAfterDecline = await db.get(prop1);
    assert.equal(propAfterDecline.status, "DECLINED");
    assert.equal(propAfterDecline.decisionReason, "Exceeds exposure ceiling for inventory loans.");

    // Second application: Legitimate ACCEPT decision
    const { applicationId: app2 } = await submitApplicationHandler(borrowerCtx as any, {
      requestedAmountPesewas: 400000,
      tenureMonths: 12,
      purpose: "Equipment Purchase",
    });

    const { proposalId: prop2 } = await proposeTermsHandler(officerCtx as any, {
      applicationId: app2,
      lenderId: lenderAccra,
      proposedAmountPesewas: 400000,
      lenderBaseRateBps: 1800,
    });

    const acceptRes = await decideLenderProposalHandler(lenderAccraCtx as any, {
      applicationId: app2,
      proposalId: prop2,
      decision: "ACCEPT",
    });

    assert.equal(acceptRes.success, true);
    assert.equal(acceptRes.status, "LENDER_ACCEPTED");

    const appAfterAccept = await db.get(app2);
    assert.equal(appAfterAccept.status, "LENDER_ACCEPTED");

    const propAfterAccept = await db.get(prop2);
    assert.equal(propAfterAccept.status, "ACCEPTED");
  });

  // 13. Stale Decision Prevention & Non-Bypass of Agency Approval
  it("prevents stale or duplicate decisions and prevents lender acceptance from bypassing agency approval", async () => {
    const borrowerCtx = createMockCtx(db, { tokenIdentifier: "sub_borrower_accra" });
    const { applicationId } = await submitApplicationHandler(borrowerCtx as any, {
      requestedAmountPesewas: 800000,
      tenureMonths: 24,
      purpose: "Factory Expansion",
    });

    const officerCtx = createMockCtx(db, { tokenIdentifier: "sub_officer_accra" });
    const { proposalId } = await proposeTermsHandler(officerCtx as any, {
      applicationId,
      lenderId: lenderAccra,
      proposedAmountPesewas: 800000,
      lenderBaseRateBps: 1650,
    });

    const lenderAccraCtx = createMockCtx(db, { tokenIdentifier: "sub_lender_accra" });
    // First decision: ACCEPT -> SUCCESS
    await decideLenderProposalHandler(lenderAccraCtx as any, {
      applicationId,
      proposalId,
      decision: "ACCEPT",
    });

    // DUPLICATE / STALE DECISION PREVENTION:
    // Attempting to decide on an already accepted proposal -> REJECTED
    await assert.rejects(
      () =>
        decideLenderProposalHandler(lenderAccraCtx as any, {
          applicationId,
          proposalId,
          decision: "ACCEPT",
        }),
      /INVALID_STATE: Proposal is already in status 'ACCEPTED'/
    );

    // Attempting to DECLINE after ACCEPT -> REJECTED
    await assert.rejects(
      () =>
        decideLenderProposalHandler(lenderAccraCtx as any, {
          applicationId,
          proposalId,
          decision: "DECLINE",
        }),
      /INVALID_STATE: Proposal is already in status 'ACCEPTED'/
    );

    // NON-BYPASS OF AGENCY APPROVAL:
    // Borrower attempts to consent immediately after lender acceptance (bypassing agency approval) -> REJECTED
    await assert.rejects(
      () =>
        recordConsentHandler(borrowerCtx as any, {
          applicationId,
          proposalId,
          affirmedConsent: true,
        }),
      /Invalid transition.*from 'LENDER_ACCEPTED' to 'BORROWER_ACCEPTED'/
    );
  });
});

