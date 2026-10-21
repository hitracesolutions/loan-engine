/**
 * Gidfine Typed Convex Loan Service Adapter
 * 
 * Bridges React UI components to Convex backend queries and mutations:
 * - Enforces integer pesewas (1 GHS = 100 pesewas) and integer basis points (1% = 100 bps)
 * - Explicitly surfaces Convex Cloud unavailability (never silently mocks or fakes success)
 * - Safe error propagation without leaking private tokens or sensitive PII
 */

import type { ConvexReactClient } from "convex/react";
import { api } from "../../convex/_generated/api.js";
import type { Id } from "../../convex/_generated/dataModel";

export class ConvexCloudUnavailableError extends Error {
  constructor(message = "Convex Cloud is not configured or VITE_CONVEX_URL is missing. Matthias will provision the deployment.") {
    super(message);
    this.name = "ConvexCloudUnavailableError";
  }
}

/**
 * Currency & Rate Conversion Helpers
 */
export function ghsToPesewas(amountGhs: number): number {
  if (isNaN(amountGhs) || amountGhs <= 0) {
    throw new Error("Invalid amount: Must be a positive number.");
  }
  return Math.round(amountGhs * 100);
}

export function pesewasToGhs(pesewas: number): number {
  return pesewas / 100;
}

export function pesewasToGhsString(pesewas: number): string {
  return `GHS ${(pesewas / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function bpsToPercentString(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

/**
 * Service Types
 */
export interface SubmitApplicationParams {
  amountGhs: number;
  tenureMonths: number;
  purpose: string;
}

export interface BorrowerApplicationItem {
  applicationId: Id<"applications">;
  requestedAmountPesewas: number;
  tenureMonths: number;
  purpose: string;
  status: string;
  createdAt: number;
  updatedAt: number;
  activeProposal?: {
    proposalId: Id<"lenderProposals">;
    version: number;
    proposedAmountPesewas: number;
    borrowerRateBps: number;
    status: string;
  } | null;
}

export interface AgencyReviewQueueItem {
  applicationId: Id<"applications">;
  borrowerId: Id<"users">;
  borrowerName: string;
  borrowerPhone?: string;
  requestedAmountPesewas: number;
  tenureMonths: number;
  purpose: string;
  status: string;
  assignedLenderId?: Id<"users">;
  activeProposalId?: Id<"lenderProposals">;
  activeProposal?: {
    proposalId: Id<"lenderProposals">;
    version: number;
    proposedAmountPesewas: number;
    lenderBaseRateBps: number;
    agencyMarginBps?: number;
    borrowerRateBps?: number;
    status: string;
  } | null;
  createdAt: number;
  updatedAt: number;
}

export interface ProposeTermsParams {
  applicationId: Id<"applications">;
  lenderId: Id<"users">;
  proposedAmountGhs: number;
  lenderBaseRateBps: number;
  agencyMarginBps?: number;
  borrowerRateBps?: number;
}

export interface RecordConsentParams {
  applicationId: Id<"applications">;
  proposalId: Id<"lenderProposals">;
  affirmedConsent: boolean;
  ipAddress?: string;
}

export interface LenderProposalItem {
  proposalId: Id<"lenderProposals">;
  applicationId: Id<"applications">;
  caseId: string;
  version: number;
  proposedAmountPesewas: number;
  lenderBaseRateBps: number;
  tenureMonths: number;
  purpose: string;
  proposalStatus: "PENDING" | "ACCEPTED" | "DECLINED" | "SUPERSEDED";
  applicationStatus: string;
  decisionReason?: string;
  decidedAt?: number;
  createdAt: number;
}

export interface LenderDetailedProposal {
  caseId: string;
  applicationId: Id<"applications">;
  requestedAmountPesewas: number;
  tenureMonths: number;
  purpose: string;
  status: string;
  proposal: {
    proposalId: Id<"lenderProposals">;
    version: number;
    proposedAmountPesewas: number;
    lenderBaseRateBps: number;
    status: string;
  } | null;
}

/**
 * Client Verification Helper
 */
function assertClient(client?: ConvexReactClient | null): ConvexReactClient {
  if (!client) {
    throw new ConvexCloudUnavailableError();
  }
  return client;
}

/**
 * Loan Service Operations
 */
export const loanService = {
  /**
   * Submit a new loan application as the authenticated borrower.
   */
  async submitApplication(
    client: ConvexReactClient | null,
    params: SubmitApplicationParams
  ): Promise<{ applicationId: Id<"applications"> }> {
    const c = assertClient(client);

    const requestedAmountPesewas = ghsToPesewas(params.amountGhs);
    if (!Number.isInteger(params.tenureMonths) || params.tenureMonths <= 0) {
      throw new Error("Invalid tenure: Must be a positive integer number of months.");
    }
    const cleanPurpose = params.purpose?.trim() || "";
    if (!cleanPurpose) {
      throw new Error("Loan purpose cannot be empty.");
    }

    try {
      return await c.mutation(api.loans.submitApplication, {
        requestedAmountPesewas,
        tenureMonths: params.tenureMonths,
        purpose: cleanPurpose,
      });
    } catch (err: any) {
      // Re-throw with clean user-facing error message, never reporting false success
      throw new Error(err.message || "Failed to submit loan application to backend.");
    }
  },

  /**
   * Fetch all applications for the authenticated borrower.
   */
  async getBorrowerApplications(
    client: ConvexReactClient | null
  ): Promise<BorrowerApplicationItem[]> {
    const c = assertClient(client);
    try {
      const results = await c.query(api.loans.getBorrowerApplications, {});
      return results as BorrowerApplicationItem[];
    } catch (err: any) {
      throw new Error(err.message || "Failed to retrieve borrower applications.");
    }
  },

  /**
   * Fetch agency review queue for operator view.
   */
  async getAgencyReviewQueue(
    client: ConvexReactClient | null,
    statusFilter?: string
  ): Promise<AgencyReviewQueueItem[]> {
    const c = assertClient(client);
    try {
      const results = await c.query(api.loans.getAgencyReviewQueue, {
        status: statusFilter,
      });
      return results as AgencyReviewQueueItem[];
    } catch (err: any) {
      throw new Error(err.message || "Failed to load agency review queue.");
    }
  },

  /**
   * Propose pricing terms to an eligible lender for an application.
   */
  async proposeTerms(
    client: ConvexReactClient | null,
    params: ProposeTermsParams
  ): Promise<{ proposalId: Id<"lenderProposals">; version: number }> {
    const c = assertClient(client);
    const proposedAmountPesewas = ghsToPesewas(params.proposedAmountGhs);

    try {
      return await c.mutation(api.loans.proposeTerms, {
        applicationId: params.applicationId,
        lenderId: params.lenderId,
        proposedAmountPesewas,
        lenderBaseRateBps: params.lenderBaseRateBps,
        agencyMarginBps: params.agencyMarginBps,
        borrowerRateBps: params.borrowerRateBps,
      });
    } catch (err: any) {
      throw new Error(err.message || "Failed to issue proposal to lender.");
    }
  },

  /**
   * Lender decision mutation (accept or decline).
   */
  async decideLenderProposal(
    client: ConvexReactClient | null,
    params: {
      applicationId: Id<"applications">;
      proposalId: Id<"lenderProposals">;
      decision: "ACCEPT" | "DECLINE";
      reason?: string;
    }
  ): Promise<{ success: boolean; status: "LENDER_ACCEPTED" | "LENDER_DECLINED" }> {
    const c = assertClient(client);
    try {
      return await c.mutation(api.loans.decideLenderProposal, params);
    } catch (err: any) {
      throw new Error(err.message || "Failed to record lender decision.");
    }
  },

  /**
   * Fetch proposals assigned to authenticated lender.
   */
  async getLenderProposals(
    client: ConvexReactClient | null,
    statusFilter?: "ALL" | "PENDING" | "ACCEPTED" | "DECLINED"
  ): Promise<LenderProposalItem[]> {
    const c = assertClient(client);
    try {
      const results = await c.query(api.loans.getLenderProposals, {
        statusFilter: statusFilter && statusFilter !== "ALL" ? statusFilter : undefined,
      });
      return results as LenderProposalItem[];
    } catch (err: any) {
      throw new Error(err.message || "Failed to retrieve lender assigned proposals.");
    }
  },

  /**
   * Fetch single proposal detail for authenticated lender.
   */
  async getLenderProposal(
    client: ConvexReactClient | null,
    applicationId: Id<"applications">
  ): Promise<LenderDetailedProposal> {
    const c = assertClient(client);
    try {
      const result = await c.query(api.loans.getLenderProposal, {
        applicationId,
      });
      return result as LenderDetailedProposal;
    } catch (err: any) {
      throw new Error(err.message || "Failed to retrieve lender proposal detail.");
    }
  },

  /**
   * Agency formal approval of lender-accepted proposal.
   */
  async approveOffer(
    client: ConvexReactClient | null,
    params: {
      applicationId: Id<"applications">;
      proposalId: Id<"lenderProposals">;
      notes?: string;
    }
  ): Promise<{ success: boolean; status: "AGENCY_APPROVED" }> {
    const c = assertClient(client);
    try {
      return await c.mutation(api.loans.approveOffer, params);
    } catch (err: any) {
      throw new Error(err.message || "Failed to approve loan offer.");
    }
  },

  /**
   * Borrower affirmative consent to agency-approved terms.
   */
  async recordConsent(
    client: ConvexReactClient | null,
    params: RecordConsentParams
  ): Promise<{ consentId: Id<"consents">; termsSnapshotHash: string }> {
    const c = assertClient(client);
    if (!params.affirmedConsent) {
      throw new Error("Explicit affirmative consent is required.");
    }

    try {
      return await c.mutation(api.loans.recordConsent, {
        applicationId: params.applicationId,
        proposalId: params.proposalId,
        affirmedConsent: true,
        ipAddress: params.ipAddress,
      });
    } catch (err: any) {
      throw new Error(err.message || "Failed to record borrower consent snapshot.");
    }
  },

  /**
   * Check disbursement prerequisites (Readiness only).
   */
  async checkDisbursementReadiness(
    client: ConvexReactClient | null,
    applicationId: Id<"applications">
  ) {
    const c = assertClient(client);
    try {
      return await c.query(api.loans.checkDisbursementReadiness, {
        applicationId,
      });
    } catch (err: any) {
      throw new Error(err.message || "Failed to check disbursement readiness.");
    }
  },

  // ===========================================================================
  // PHASE 4: DISBURSEMENT MAKER-CHECKER & FINANCIAL LEDGER
  // ===========================================================================

  /**
   * Maker requests disbursement for an application in PENDING_DISBURSEMENT.
   */
  async requestDisbursement(
    client: ConvexReactClient | null,
    params: {
      applicationId: Id<"applications">;
      amountGhs: number;
      channel?: "MOMO" | "BANK_TRANSFER" | "CHEQUE" | "CASH";
      note?: string;
      idempotencyKey?: string;
    }
  ) {
    const c = assertClient(client);
    const amountPesewas = ghsToPesewas(params.amountGhs);
    const idempotencyKey = params.idempotencyKey || `disb_${params.applicationId}_${Date.now()}`;
    try {
      return await c.mutation((api as any).ledger.requestDisbursement, {
        applicationId: params.applicationId,
        amountPesewas,
        channel: params.channel,
        note: params.note,
        idempotencyKey,
      });
    } catch (err: any) {
      throw new Error(err.message || "Failed to request disbursement.");
    }
  },

  /**
   * Checker approves disbursement (strictly Maker !== Checker).
   */
  async approveDisbursement(
    client: ConvexReactClient | null,
    params: {
      disbursementRequestId: Id<"disbursementRequests">;
      externalReference?: string;
    }
  ) {
    const c = assertClient(client);
    try {
      return await c.mutation((api as any).ledger.approveDisbursement, params);
    } catch (err: any) {
      throw new Error(err.message || "Failed to approve disbursement.");
    }
  },

  /**
   * Checker rejects disbursement request.
   */
  async rejectDisbursement(
    client: ConvexReactClient | null,
    params: {
      disbursementRequestId: Id<"disbursementRequests">;
      rejectionReason: string;
    }
  ) {
    const c = assertClient(client);
    try {
      return await c.mutation((api as any).ledger.rejectDisbursement, params);
    } catch (err: any) {
      throw new Error(err.message || "Failed to reject disbursement.");
    }
  },

  /**
   * Executes disbursement and activates loan.
   */
  async executeDisbursement(
    client: ConvexReactClient | null,
    params: {
      disbursementRequestId: Id<"disbursementRequests">;
      externalReference: string;
    }
  ) {
    const c = assertClient(client);
    try {
      return await c.mutation((api as any).ledger.executeDisbursement, params);
    } catch (err: any) {
      throw new Error(err.message || "Failed to execute disbursement.");
    }
  },

  /**
   * Queries disbursement requests for cashier/underwriter review.
   */
  async getDisbursementRequests(
    client: ConvexReactClient | null,
    status?: string
  ) {
    const c = assertClient(client);
    try {
      return await c.query((api as any).ledger.getDisbursementRequests, { status });
    } catch (err: any) {
      throw new Error(err.message || "Failed to load disbursement requests.");
    }
  },

  /**
   * Records a repayment receipt and applies waterfall allocation.
   */
  async recordRepayment(
    client: ConvexReactClient | null,
    params: {
      applicationId: Id<"applications">;
      amountGhs: number;
      channel: "MOMO" | "BANK_TRANSFER" | "CASH" | "CHEQUE";
      externalReference?: string;
      idempotencyKey?: string;
    }
  ) {
    const c = assertClient(client);
    const amountPesewas = ghsToPesewas(params.amountGhs);
    const idempotencyKey = params.idempotencyKey || `repay_${params.applicationId}_${Date.now()}`;
    try {
      return await c.mutation((api as any).ledger.recordRepayment, {
        applicationId: params.applicationId,
        amountPesewas,
        channel: params.channel,
        externalReference: params.externalReference,
        idempotencyKey,
      });
    } catch (err: any) {
      throw new Error(err.message || "Failed to record repayment.");
    }
  },

  /**
   * Retrieves repayment instalment schedule for an application.
   */
  async getRepaymentSchedule(
    client: ConvexReactClient | null,
    applicationId: Id<"applications">
  ) {
    const c = assertClient(client);
    try {
      return await c.query((api as any).ledger.getRepaymentSchedule, { applicationId });
    } catch (err: any) {
      throw new Error(err.message || "Failed to load repayment schedule.");
    }
  },

  /**
   * Retrieves double-entry general ledger transactions.
   */
  async getJournalTransactions(
    client: ConvexReactClient | null,
    applicationId?: Id<"applications">
  ) {
    const c = assertClient(client);
    try {
      return await c.query((api as any).ledger.getJournalTransactions, { applicationId });
    } catch (err: any) {
      throw new Error(err.message || "Failed to load journal transactions.");
    }
  },
};
