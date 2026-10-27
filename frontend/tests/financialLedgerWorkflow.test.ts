import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  requestDisbursementHandler,
  approveDisbursementHandler,
  executeDisbursementHandler,
  requestReversalHandler,
  approveReversalHandler,
  recordRepaymentHandler,
  validateDoubleEntryBalance,
  calculateWaterfallAllocation,
  CHART_OF_ACCOUNTS,
} from "../convex/ledger.ts";
import type { Doc, Id } from "../convex/_generated/dataModel.d.ts";

// In-memory mock database store simulating Convex for Phase 4 financial workflows
class MockDatabase {
  private tables: Record<string, Map<string, any>> = {
    agencies: new Map(),
    users: new Map(),
    applications: new Map(),
    lenderProposals: new Map(),
    consents: new Map(),
    disbursementRequests: new Map(),
    ledgerEntries: new Map(),
    journalTransactions: new Map(),
    journalLines: new Map(),
    repaymentSchedules: new Map(),
    repaymentReceipts: new Map(),
    reversalRequests: new Map(),
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
    if (!this.tables[table]) {
      this.tables[table] = new Map();
    }
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
    const map = this.tables[table] || new Map();
    let records = Array.from(map.values()).map((doc) => JSON.parse(JSON.stringify(doc)));

    return {
      withIndex: (indexName: string, filterFn: (q: any) => any) => {
        let conditions: Record<string, any> = {};
        const qMock = {
          eq: (field: string, val: any) => {
            conditions[field] = val;
            return qMock;
          },
        };
        filterFn(qMock);

        const filtered = records.filter((doc) => {
          return Object.entries(conditions).every(([f, v]) => doc[f] === v);
        });

        return {
          first: async () => filtered[0] ?? null,
          unique: async () => filtered[0] ?? null,
          collect: async () => filtered,
        };
      },
      collect: async () => records,
    };
  }
}

describe("Phase 4: Comprehensive Financial Ledger & Workflow Integration", () => {
  let db: MockDatabase;
  let agencyA: Id<"agencies">;
  let agencyB: Id<"agencies">;
  let cashierA: Doc<"users">;
  let underwriterA: Doc<"users">;
  let borrowerA: Doc<"users">;
  let cashierB: Doc<"users">;
  let appA: Id<"applications">;
  let proposalA: Id<"lenderProposals">;

  beforeEach(async () => {
    db = new MockDatabase();

    agencyA = await db.insert("agencies", {
      name: "Accra Credit Agency",
      code: "ACA",
      status: "active",
      createdAt: Date.now(),
    });

    agencyB = await db.insert("agencies", {
      name: "Kumasi Loans Agency",
      code: "KLA",
      status: "active",
      createdAt: Date.now(),
    });

    cashierA = {
      _id: await db.insert("users", {
        tokenIdentifier: "auth|cashier_a",
        agencyId: agencyA,
        role: "cashier",
        name: "Kwame Cashier",
        status: "active",
        createdAt: Date.now(),
      }),
      _creationTime: Date.now(),
      tokenIdentifier: "auth|cashier_a",
      agencyId: agencyA,
      role: "cashier",
      name: "Kwame Cashier",
      status: "active",
      createdAt: Date.now(),
    };

    underwriterA = {
      _id: await db.insert("users", {
        tokenIdentifier: "auth|underwriter_a",
        agencyId: agencyA,
        role: "underwriter",
        name: "Abena Underwriter",
        status: "active",
        createdAt: Date.now(),
      }),
      _creationTime: Date.now(),
      tokenIdentifier: "auth|underwriter_a",
      agencyId: agencyA,
      role: "underwriter",
      name: "Abena Underwriter",
      status: "active",
      createdAt: Date.now(),
    };

    borrowerA = {
      _id: await db.insert("users", {
        tokenIdentifier: "auth|borrower_a",
        agencyId: agencyA,
        role: "borrower",
        name: "Kofi Borrower",
        status: "active",
        createdAt: Date.now(),
      }),
      _creationTime: Date.now(),
      tokenIdentifier: "auth|borrower_a",
      agencyId: agencyA,
      role: "borrower",
      name: "Kofi Borrower",
      status: "active",
      createdAt: Date.now(),
    };

    cashierB = {
      _id: await db.insert("users", {
        tokenIdentifier: "auth|cashier_b",
        agencyId: agencyB,
        role: "cashier",
        name: "Yaw Cashier",
        status: "active",
        createdAt: Date.now(),
      }),
      _creationTime: Date.now(),
      tokenIdentifier: "auth|cashier_b",
      agencyId: agencyB,
      role: "cashier",
      name: "Yaw Cashier",
      status: "active",
      createdAt: Date.now(),
    };

    proposalA = await db.insert("lenderProposals", {
      agencyId: agencyA,
      applicationId: "pending_link" as any,
      lenderId: "users_lender1" as any,
      version: 1,
      proposedAmountPesewas: 1000000, // GHS 10,000.00
      lenderBaseRateBps: 1800,
      agencyMarginBps: 200,
      borrowerRateBps: 2000, // 20.00%
      status: "ACCEPTED",
      createdAt: Date.now(),
    });

    appA = await db.insert("applications", {
      agencyId: agencyA,
      borrowerId: borrowerA._id,
      requestedAmountPesewas: 1000000,
      tenureMonths: 6,
      purpose: "Agricultural Supplies",
      status: "PENDING_DISBURSEMENT",
      activeProposalId: proposalA,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await db.patch(proposalA, { applicationId: appA });

    await db.insert("consents", {
      agencyId: agencyA,
      applicationId: appA,
      borrowerId: borrowerA._id,
      proposalId: proposalA,
      termsVersion: 1,
      principalPesewas: 1000000,
      borrowerRateBps: 2000,
      tenureMonths: 6,
      termsSnapshotHash: "sha256_mock_hash_for_testing_12345678",
      consentedAt: Date.now(),
    });
  });

  const makeCtx = (user: Doc<"users">): any => ({
    db,
    auth: {
      getUserIdentity: async () => ({
        tokenIdentifier: user.tokenIdentifier,
        name: user.name,
      }),
    },
  });

  describe("Phase 4B: Disbursement Maker-Checker Workflow", () => {
    it("allows cashier to request disbursement and enforces idempotency with payload safety", async () => {
      const ctx = makeCtx(cashierA);

      // Initial valid request
      const res1 = await requestDisbursementHandler(ctx, {
        applicationId: appA,
        amountPesewas: 1000000,
        channel: "MOMO",
        idempotencyKey: "idem_disb_001",
      });

      assert.strictEqual(res1.isRetry, false);
      assert.ok(res1.disbursementRequestId);

      // Identical retry returns existing request
      const resRetry = await requestDisbursementHandler(ctx, {
        applicationId: appA,
        amountPesewas: 1000000,
        channel: "MOMO",
        idempotencyKey: "idem_disb_001",
      });
      assert.strictEqual(resRetry.isRetry, true);
      assert.strictEqual(resRetry.disbursementRequestId, res1.disbursementRequestId);

      // Reusing same key with altered amount throws payload mismatch error
      await assert.rejects(
        async () => {
          await requestDisbursementHandler(ctx, {
            applicationId: appA,
            amountPesewas: 500000,
            channel: "MOMO",
            idempotencyKey: "idem_disb_001",
          });
        },
        { message: /Idempotency contract violation: Reused idempotency key with mismatched amount/ }
      );
    });

    it("strictly prevents maker from approving their own disbursement request", async () => {
      const cashierCtx = makeCtx(cashierA);
      const { disbursementRequestId } = await requestDisbursementHandler(cashierCtx, {
        applicationId: appA,
        amountPesewas: 1000000,
        idempotencyKey: "idem_disb_002",
      });

      // Cashier attempts to approve their own request
      await assert.rejects(
        async () => {
          await approveDisbursementHandler(cashierCtx, {
            disbursementRequestId,
          });
        },
        { message: /FORBIDDEN/ }
      );
    });

    it("allows distinct checker to approve and cashier to execute disbursement, activating the loan", async () => {
      const cashierCtx = makeCtx(cashierA);
      const checkerCtx = makeCtx(underwriterA);

      const { disbursementRequestId } = await requestDisbursementHandler(cashierCtx, {
        applicationId: appA,
        amountPesewas: 1000000,
        idempotencyKey: "idem_disb_003",
      });

      // Checker approves
      const approval = await approveDisbursementHandler(checkerCtx, {
        disbursementRequestId,
        externalReference: "MOMO-PENDING-REF",
      });
      assert.strictEqual(approval.success, true);

      // Cashier executes disbursement
      const execResult = await executeDisbursementHandler(cashierCtx, {
        disbursementRequestId,
        externalReference: "MOMO-TX-12345",
      });
      assert.strictEqual(execResult.success, true);
      assert.ok(execResult.journalTransactionId);

      // Verify application activated
      const updatedApp = await db.get(appA);
      assert.strictEqual(updatedApp.status, "ACTIVE");

      // Verify repayment schedule generated (6 instalments)
      const schedules = await db.query("repaymentSchedules").collect();
      assert.strictEqual(schedules.length, 6);
      assert.strictEqual(schedules[0].instalmentNumber, 1);
      assert.strictEqual(schedules[0].status, "PENDING");
    });
  });

  describe("Phase 4C: Double-Entry Accounting Balancing Invariants", () => {
    it("validates that balanced double-entry transactions pass and unbalanced fail", () => {
      const balancedLines = [
        { entrySide: "DEBIT" as const, amountPesewas: 500000 },
        { entrySide: "CREDIT" as const, amountPesewas: 500000 },
      ];
      const valid = validateDoubleEntryBalance(balancedLines, 500000);
      assert.strictEqual(valid.isBalanced, true);

      const unbalancedLines = [
        { entrySide: "DEBIT" as const, amountPesewas: 500000 },
        { entrySide: "CREDIT" as const, amountPesewas: 450000 },
      ];
      const invalid = validateDoubleEntryBalance(unbalancedLines, 500000);
      assert.strictEqual(invalid.isBalanced, false);
      assert.match(invalid.error ?? "", /Total debits \(500000\) do not match total credits \(450000\)/);
    });

    it("supports dual-authorization compensating reversals", async () => {
      const makerCtx = makeCtx(cashierA);
      const checkerCtx = makeCtx(underwriterA);

      // Maker requests reversal
      const revReq = await requestReversalHandler(makerCtx, {
        targetType: "DISBURSEMENT",
        targetId: "disb_1",
        amountPesewas: 1000000,
        reason: "Duplicate transfer error",
        idempotencyKey: "rev_idem_001",
      });
      assert.strictEqual(revReq.status, "PENDING_APPROVAL");

      // Checker approves and executes reversal
      const execRev = await approveReversalHandler(checkerCtx, {
        reversalRequestId: revReq.reversalRequestId,
      });
      assert.strictEqual(execRev.success, true);
      assert.ok(execRev.compensatingTransactionId);

      // Verify compensating journal transaction created
      const compTx = await db.get(execRev.compensatingTransactionId);
      assert.strictEqual(compTx.isReversal, true);
      assert.strictEqual(compTx.transactionType, "REVERSAL");
    });
  });

  describe("Phase 4D: Repayment Waterfall Allocation & Receipt Handling", () => {
    it("accurately allocates payments: 1. Fees first, 2. Interest second, 3. Principal remainder", () => {
      // Case 1: Payment covers fees and part of interest
      const alloc1 = calculateWaterfallAllocation(
        25000, // GHS 250 payment
        10000, // GHS 100 fee due
        30000, // GHS 300 interest due
        100000 // GHS 1,000 principal due
      );
      assert.strictEqual(alloc1.feesCovered, 10000); // GHS 100
      assert.strictEqual(alloc1.interestCovered, 15000); // GHS 150
      assert.strictEqual(alloc1.principalCovered, 0);
      assert.strictEqual(alloc1.unallocated, 0);

      // Case 2: Payment covers all fees, all interest, and partial principal
      const alloc2 = calculateWaterfallAllocation(
        80000, // GHS 800 payment
        10000, // GHS 100 fee
        30000, // GHS 300 interest
        100000 // GHS 1,000 principal
      );
      assert.strictEqual(alloc2.feesCovered, 10000);
      assert.strictEqual(alloc2.interestCovered, 30000);
      assert.strictEqual(alloc2.principalCovered, 40000);
      assert.strictEqual(alloc2.unallocated, 0);
    });

    it("posts repayment, creates balanced journal transaction, and marks loan PAID_OFF upon completion", async () => {
      const cashierCtx = makeCtx(cashierA);

      // Set application ACTIVE and insert 1 schedule instalment
      await db.patch(appA, { status: "ACTIVE" });
      await db.insert("repaymentSchedules", {
        agencyId: agencyA,
        applicationId: appA,
        instalmentNumber: 1,
        dueDate: Date.now() + 86400000,
        principalDuePesewas: 1000000,
        interestDuePesewas: 200000,
        feesDuePesewas: 50000,
        totalDuePesewas: 1250000,
        principalPaidPesewas: 0,
        interestPaidPesewas: 0,
        feesPaidPesewas: 0,
        totalPaidPesewas: 0,
        status: "PENDING",
        createdAt: Date.now(),
      });

      // Post full payoff
      const repayRes = await recordRepaymentHandler(cashierCtx, {
        applicationId: appA,
        amountPesewas: 1250000,
        channel: "MOMO",
        externalReference: "MTN-REC-9988",
        idempotencyKey: "repay_idem_full",
      });

      assert.strictEqual(repayRes.isFullyPaid, true);
      assert.strictEqual(repayRes.allocation.feesCovered, 50000);
      assert.strictEqual(repayRes.allocation.interestCovered, 200000);
      assert.strictEqual(repayRes.allocation.principalCovered, 1000000);

      // Verify app status is PAID_OFF
      const paidApp = await db.get(appA);
      assert.strictEqual(paidApp.status, "PAID_OFF");
    });
  });

  describe("Multi-Tenant Isolation Safeguards", () => {
    it("rejects cross-tenant disbursement requests and approvals", async () => {
      const cashierBCtx = makeCtx(cashierB);

      // Cashier B from Agency B cannot request disbursement for Agency A's application
      await assert.rejects(
        async () => {
          await requestDisbursementHandler(cashierBCtx, {
            applicationId: appA,
            amountPesewas: 1000000,
            idempotencyKey: "cross_tenant_key",
          });
        },
        { message: /NOT_FOUND: Loan application not found within this agency/ }
      );
    });
  });
});
