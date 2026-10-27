import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  loanService,
  ghsToPesewas,
  pesewasToGhs,
  pesewasToGhsString,
  bpsToPercentString,
  ConvexCloudUnavailableError,
} from "../src/services/loanService.ts";

describe("LoanService Client Adapter Tests", () => {
  it("converts GHS to integer pesewas accurately", () => {
    assert.equal(ghsToPesewas(5000), 500000);
    assert.equal(ghsToPesewas(100.5), 10050);
    assert.equal(ghsToPesewas(0.01), 1);
    assert.throws(() => ghsToPesewas(-50), /Invalid amount/);
    assert.throws(() => ghsToPesewas(0), /Invalid amount/);
  });

  it("converts pesewas to GHS and formats strings correctly", () => {
    assert.equal(pesewasToGhs(500000), 5000);
    assert.equal(pesewasToGhsString(500000), "GHS 5,000.00");
    assert.equal(pesewasToGhsString(125050), "GHS 1,250.50");
  });

  it("formats basis points as clean percentage strings", () => {
    assert.equal(bpsToPercentString(1800), "18.00%");
    assert.equal(bpsToPercentString(2450), "24.50%");
    assert.equal(bpsToPercentString(300), "3.00%");
  });

  it("explicitly throws ConvexCloudUnavailableError when client is not configured", async () => {
    // When VITE_CONVEX_URL is not configured and client is null
    const nullClient = null;

    await assert.rejects(
      () =>
        loanService.submitApplication(nullClient, {
          amountGhs: 5000,
          tenureMonths: 12,
          purpose: "Expansion",
        }),
      (err: any) => {
        assert(err instanceof ConvexCloudUnavailableError);
        assert(err.message.includes("Convex Cloud is not configured"));
        return true;
      }
    );

    await assert.rejects(
      () => loanService.getBorrowerApplications(nullClient),
      ConvexCloudUnavailableError
    );

    await assert.rejects(
      () => loanService.getAgencyReviewQueue(nullClient),
      ConvexCloudUnavailableError
    );
  });

  it("validates inputs before sending to backend", async () => {
    // Mock client with spy
    let calledMutation = false;
    const mockClient: any = {
      mutation: async () => {
        calledMutation = true;
        return { applicationId: "app_123" };
      },
    };

    // Invalid tenure
    await assert.rejects(
      () =>
        loanService.submitApplication(mockClient, {
          amountGhs: 5000,
          tenureMonths: -5,
          purpose: "Store",
        }),
      /Invalid tenure/
    );

    // Empty purpose
    await assert.rejects(
      () =>
        loanService.submitApplication(mockClient, {
          amountGhs: 5000,
          tenureMonths: 12,
          purpose: "   ",
        }),
      /Loan purpose cannot be empty/
    );

    // Mutation was not called on invalid input
    assert.equal(calledMutation, false);

    // Valid submission calls mutation with integer pesewas
    let sentArgs: any = null;
    mockClient.mutation = async (_apiFn: any, args: any) => {
      sentArgs = args;
      return { applicationId: "app_valid_123" };
    };

    const res = await loanService.submitApplication(mockClient, {
      amountGhs: 5000,
      tenureMonths: 12,
      purpose: "Valid purpose",
    });
    assert.equal(res.applicationId, "app_valid_123");
    assert.equal(sentArgs.requestedAmountPesewas, 500000);
    assert.equal(sentArgs.tenureMonths, 12);
  });

  it("requires explicit affirmative consent in recordConsent", async () => {
    const mockClient: any = {
      mutation: async () => ({ consentId: "c_1", termsSnapshotHash: "abc" }),
    };

    await assert.rejects(
      () =>
        loanService.recordConsent(mockClient, {
          applicationId: "app_1" as any,
          proposalId: "p_1" as any,
          affirmedConsent: false,
        }),
      /Explicit affirmative consent is required/
    );
  });

  it("handles lender queries and decisions through loanService", async () => {
    const nullClient = null;

    // Cloud unavailable for lender queries and mutations
    await assert.rejects(
      () => loanService.getLenderProposals(nullClient),
      ConvexCloudUnavailableError
    );

    await assert.rejects(
      () => loanService.getLenderProposal(nullClient, "app_1" as any),
      ConvexCloudUnavailableError
    );

    await assert.rejects(
      () =>
        loanService.decideLenderProposal(nullClient, {
          applicationId: "app_1" as any,
          proposalId: "prop_1" as any,
          decision: "ACCEPT",
        }),
      ConvexCloudUnavailableError
    );

    // Mock client with valid responses
    let capturedMutation: any = null;
    let capturedQuery: any = null;
    const mockClient: any = {
      query: async (_apiFn: any, args: any) => {
        capturedQuery = args;
        return [
          {
            proposalId: "prop_1",
            applicationId: "app_1",
            caseId: "APP-001",
            version: 1,
            proposedAmountPesewas: 500000,
            lenderBaseRateBps: 1800,
            tenureMonths: 12,
            purpose: "Expansion",
            proposalStatus: "PENDING",
            applicationStatus: "LENDER_PENDING",
            createdAt: Date.now(),
          },
        ];
      },
      mutation: async (_apiFn: any, args: any) => {
        capturedMutation = args;
        return { success: true, status: "LENDER_ACCEPTED" };
      },
    };

    const proposals = await loanService.getLenderProposals(mockClient, "PENDING");
    assert.equal(proposals.length, 1);
    assert.equal(proposals[0].caseId, "APP-001");
    assert.equal(capturedQuery.statusFilter, "PENDING");

    const decisionRes = await loanService.decideLenderProposal(mockClient, {
      applicationId: "app_1" as any,
      proposalId: "prop_1" as any,
      decision: "ACCEPT",
    });
    assert.equal(decisionRes.success, true);
    assert.equal(decisionRes.status, "LENDER_ACCEPTED");
    assert.equal(capturedMutation.decision, "ACCEPT");
  });
});

