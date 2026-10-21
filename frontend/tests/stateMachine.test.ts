import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateStateTransition,
  computeTermsSnapshotHash,
  StateTransitionError,
  type TransitionContext,
} from "../convex/lib/stateMachine.ts";

describe("Gidfine Centralized State Machine & Guard Tests", () => {
  const baseContext: TransitionContext = {
    applicationId: "app_123",
    applicationAgencyId: "agency_accra",
    actorUserId: "user_officer_1",
    actorAgencyId: "agency_accra",
    actorRole: "loan_officer",
    currentStatus: "SUBMITTED",
    targetStatus: "UNDER_REVIEW",
    borrowerId: "user_borrower_1",
    assignedLenderId: "user_lender_1",
    activeProposalId: "prop_1",
    hasValidConsentSnapshot: false,
  };

  it("allows standard linear transitions with authorized roles", () => {
    // SUBMITTED -> UNDER_REVIEW by loan_officer
    const res = validateStateTransition(baseContext);
    assert.equal(res.valid, true);

    // UNDER_REVIEW -> MATCHING by underwriter
    const matchingRes = validateStateTransition({
      ...baseContext,
      actorRole: "underwriter",
      currentStatus: "UNDER_REVIEW",
      targetStatus: "MATCHING",
    });
    assert.equal(matchingRes.valid, true);

    // MATCHING -> LENDER_PENDING by agency_admin
    const lenderPendingRes = validateStateTransition({
      ...baseContext,
      actorRole: "agency_admin",
      currentStatus: "MATCHING",
      targetStatus: "LENDER_PENDING",
    });
    assert.equal(lenderPendingRes.valid, true);
  });

  it("strictly enforces assigned lender for lender actions", () => {
    // Assigned lender accepting proposal -> OK
    const lenderAcceptOk = validateStateTransition({
      ...baseContext,
      actorUserId: "user_lender_1",
      actorRole: "lender",
      currentStatus: "LENDER_PENDING",
      targetStatus: "LENDER_ACCEPTED",
      assignedLenderId: "user_lender_1",
    });
    assert.equal(lenderAcceptOk.valid, true);

    // Unassigned third-party lender attempting to accept -> REJECTED
    assert.throws(
      () =>
        validateStateTransition({
          ...baseContext,
          actorUserId: "user_lender_imposter",
          actorRole: "lender",
          currentStatus: "LENDER_PENDING",
          targetStatus: "LENDER_ACCEPTED",
          assignedLenderId: "user_lender_1",
        }),
      (err: any) => {
        assert(err instanceof StateTransitionError);
        assert.equal(err.code, "LENDER_NOT_ASSIGNED");
        return true;
      }
    );
  });

  it("CRITICAL GUARD: Prevents lender acceptance from bypassing agency approval or borrower consent", () => {
    // Lender cannot bypass agency approval directly to BORROWER_ACCEPTED
    assert.throws(
      () =>
        validateStateTransition({
          ...baseContext,
          actorUserId: "user_lender_1",
          actorRole: "lender",
          currentStatus: "LENDER_ACCEPTED",
          targetStatus: "BORROWER_ACCEPTED",
        }),
      (err: any) => {
        assert(err instanceof StateTransitionError);
        assert.equal(err.code, "ILLEGAL_TRANSITION");
        return true;
      }
    );

    // Lender cannot bypass directly to PENDING_DISBURSEMENT
    assert.throws(
      () =>
        validateStateTransition({
          ...baseContext,
          actorUserId: "user_lender_1",
          actorRole: "lender",
          currentStatus: "LENDER_ACCEPTED",
          targetStatus: "PENDING_DISBURSEMENT",
        }),
      (err: any) => {
        assert(err instanceof StateTransitionError);
        assert.equal(err.code, "ILLEGAL_TRANSITION");
        return true;
      }
    );

    // Legitimate step: LENDER_ACCEPTED -> AGENCY_APPROVED by agency_admin
    const agencyApproveRes = validateStateTransition({
      ...baseContext,
      actorRole: "agency_admin",
      currentStatus: "LENDER_ACCEPTED",
      targetStatus: "AGENCY_APPROVED",
    });
    assert.equal(agencyApproveRes.valid, true);
  });

  it("CRITICAL GUARD: Prevents agency from bypassing borrower affirmative consent", () => {
    // Agency admin cannot accept the loan on behalf of the borrower
    assert.throws(
      () =>
        validateStateTransition({
          ...baseContext,
          actorRole: "agency_admin",
          currentStatus: "AGENCY_APPROVED",
          targetStatus: "BORROWER_ACCEPTED",
          hasValidConsentSnapshot: true,
        }),
      (err: any) => {
        assert(err instanceof StateTransitionError);
        assert.equal(err.code, "UNAUTHORIZED_ROLE");
        return true;
      }
    );

    // Borrower cannot accept without an immutable verified consent snapshot
    assert.throws(
      () =>
        validateStateTransition({
          ...baseContext,
          actorUserId: "user_borrower_1",
          actorRole: "borrower",
          currentStatus: "AGENCY_APPROVED",
          targetStatus: "BORROWER_ACCEPTED",
          hasValidConsentSnapshot: false, // MISSING CONSENT
        }),
      (err: any) => {
        assert(err instanceof StateTransitionError);
        assert.equal(err.code, "CONSENT_REQUIRED");
        return true;
      }
    );

    // Borrower accepts WITH valid consent snapshot -> OK
    const borrowerAcceptOk = validateStateTransition({
      ...baseContext,
      actorUserId: "user_borrower_1",
      actorRole: "borrower",
      currentStatus: "AGENCY_APPROVED",
      targetStatus: "BORROWER_ACCEPTED",
      hasValidConsentSnapshot: true,
    });
    assert.equal(borrowerAcceptOk.valid, true);
  });

  it("CRITICAL GUARD: Prevents disbursement without verified consent snapshot", () => {
    // Cashier attempting disbursement without consent snapshot -> REJECTED
    assert.throws(
      () =>
        validateStateTransition({
          ...baseContext,
          actorRole: "cashier",
          currentStatus: "BORROWER_ACCEPTED",
          targetStatus: "PENDING_DISBURSEMENT",
          hasValidConsentSnapshot: false,
        }),
      (err: any) => {
        assert(err instanceof StateTransitionError);
        assert.equal(err.code, "CONSENT_REQUIRED");
        return true;
      }
    );

    // Cashier with verified consent snapshot -> OK
    const disbursementOk = validateStateTransition({
      ...baseContext,
      actorRole: "cashier",
      currentStatus: "BORROWER_ACCEPTED",
      targetStatus: "PENDING_DISBURSEMENT",
      hasValidConsentSnapshot: true,
    });
    assert.equal(disbursementOk.valid, true);
  });

  it("CRITICAL GUARD: Enforces multi-tenant agency isolation", () => {
    // Actor from foreign agency attempting transition -> REJECTED
    assert.throws(
      () =>
        validateStateTransition({
          ...baseContext,
          actorAgencyId: "agency_kumasi_foreign",
          applicationAgencyId: "agency_accra_local",
        }),
      (err: any) => {
        assert(err instanceof StateTransitionError);
        assert.equal(err.code, "TENANT_ISOLATION_VIOLATION");
        return true;
      }
    );
  });

  it("computes deterministic SHA-256 consent fingerprint", async () => {
    const terms = {
      applicationId: "app_123",
      proposalId: "prop_456",
      borrowerId: "user_borrower_1",
      termsVersion: 1,
      principalPesewas: 500000, // GHS 5,000.00
      borrowerRateBps: 2400,    // 24.00% p.a.
      tenureMonths: 6,
      consentedAt: 1729522800000,
    };

    const hash1 = await computeTermsSnapshotHash(terms);
    const hash2 = await computeTermsSnapshotHash(terms);

    // Deterministic repeatability
    assert.equal(hash1, hash2);
    assert.equal(typeof hash1, "string");
    assert.equal(hash1.length, 64); // SHA-256 hex length

    // Tampered amount produces different hash
    const tamperedHash = await computeTermsSnapshotHash({
      ...terms,
      principalPesewas: 600000,
    });
    assert.notEqual(hash1, tamperedHash);
  });
});
