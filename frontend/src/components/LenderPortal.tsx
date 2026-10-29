import React, { useState, useEffect, useCallback } from 'react';
import { useOptionalConvex } from '../lib/convex';
import {
  loanService,
  type LenderProposalItem,
  type LenderDetailedProposal,
  pesewasToGhsString,
  bpsToPercentString,
  ConvexCloudUnavailableError,
} from '../services/loanService';
import {
  Landmark,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Filter,
  RefreshCw,
  Eye,
  AlertCircle,
  FileCheck,
} from 'lucide-react';
import type { Id } from '../../convex/_generated/dataModel';

interface LenderPortalProps {
  lenderName?: string;
}

export const LenderPortal: React.FC<LenderPortalProps> = ({
  lenderName = 'Institutional Lender',
}) => {
  const convexClient = useOptionalConvex();

  // State
  const [proposals, setProposals] = useState<LenderProposalItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'ACCEPTED' | 'DECLINED'>('ALL');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Selected Proposal for Details
  const [selectedProposal, setSelectedProposal] = useState<LenderProposalItem | null>(null);
  const [detailedProposal, setDetailedProposal] = useState<LenderDetailedProposal | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);

  // Decision Modal State
  const [decisionModal, setDecisionModal] = useState<{
    isOpen: boolean;
    proposal: LenderProposalItem | null;
    decision: 'ACCEPT' | 'DECLINE';
    reason: string;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    proposal: null,
    decision: 'ACCEPT',
    reason: '',
    isSubmitting: false,
  });

  // Fetch Proposals from Convex
  const loadProposals = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    if (!convexClient) {
      setIsLoading(false);
      return;
    }

    try {
      const data = await loanService.getLenderProposals(convexClient, statusFilter);
      setProposals(data);
    } catch (err: any) {
      if (err instanceof ConvexCloudUnavailableError) {
        setError('Convex Cloud backend is not deployed. Lender queue cannot be loaded.');
      } else {
        setError(err.message || 'Failed to load assigned proposals.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [convexClient, statusFilter]);

  useEffect(() => {
    loadProposals();
  }, [loadProposals]);

  // Load single proposal detail when selected
  const handleOpenDetail = async (item: LenderProposalItem) => {
    setSelectedProposal(item);
    setDetailedProposal(null);
    setIsLoadingDetail(true);

    if (!convexClient) {
      setIsLoadingDetail(false);
      return;
    }

    try {
      const detail = await loanService.getLenderProposal(convexClient, item.applicationId);
      setDetailedProposal(detail);
    } catch (err: any) {
      console.error('Failed to load proposal detail:', err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Open Decision Modal
  const openDecisionModal = (proposal: LenderProposalItem, decision: 'ACCEPT' | 'DECLINE') => {
    // Stale decision guard
    if (proposal.proposalStatus !== 'PENDING') {
      setError(`Cannot decide on proposal in '${proposal.proposalStatus}' state. Only PENDING proposals can be decided.`);
      return;
    }

    setDecisionModal({
      isOpen: true,
      proposal,
      decision,
      reason: '',
      isSubmitting: false,
    });
  };

  // Submit Decision
  const handleDecisionSubmit = async () => {
    if (!decisionModal.proposal || !convexClient) return;

    setDecisionModal((prev) => ({ ...prev, isSubmitting: true }));
    setError(null);
    setSuccessNotice(null);

    try {
      const result = await loanService.decideLenderProposal(convexClient, {
        applicationId: decisionModal.proposal.applicationId,
        proposalId: decisionModal.proposal.proposalId,
        decision: decisionModal.decision,
        reason: decisionModal.reason ? decisionModal.reason.trim() : undefined,
      });

      setSuccessNotice(
        `Case ${decisionModal.proposal.caseId} has been successfully ${
          decisionModal.decision === 'ACCEPT' ? 'ACCEPTED' : 'DECLINED'
        }. State updated to ${result.status}.`
      );

      setDecisionModal({
        isOpen: false,
        proposal: null,
        decision: 'ACCEPT',
        reason: '',
        isSubmitting: false,
      });

      if (selectedProposal?.proposalId === decisionModal.proposal.proposalId) {
        setSelectedProposal(null);
        setDetailedProposal(null);
      }

      await loadProposals();
    } catch (err: any) {
      setError(err.message || 'Failed to record proposal decision.');
      setDecisionModal((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  // Stats
  const pendingCount = proposals.filter((p) => p.proposalStatus === 'PENDING').length;
  const acceptedCount = proposals.filter((p) => p.proposalStatus === 'ACCEPTED').length;
  const declinedCount = proposals.filter((p) => p.proposalStatus === 'DECLINED').length;
  const totalVolumePesewas = proposals.reduce((acc, p) => acc + p.proposedAmountPesewas, 0);

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-2xl p-6 text-white border border-slate-700 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-600/30 border border-indigo-400/30 rounded-xl text-indigo-400">
              <Landmark className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">Lender Decision Portal</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Assigned Rate Cards
                </span>
              </div>
              <p className="text-slate-400 text-sm mt-0.5">
                Review proposed loan allocations, evaluate risk terms, and commit funding capacity.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadProposals}
              disabled={isLoading || !convexClient}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh Queue
            </button>
          </div>
        </div>

        {/* Confidentiality Reminder Banner */}
        <div className="mt-4 p-3 bg-slate-800/80 rounded-xl border border-slate-700/80 flex items-start gap-2.5 text-xs text-slate-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-slate-100">Gidfine Privacy & Visibility Control (Section 7): </span>
            Borrower identifying information (name, phone, email, national ID) and agency operational margins are strictly redacted.
            Lender decisions are audited on-chain; acceptance triggers agency review and does not directly activate loans or disburse funds.
          </div>
        </div>
      </div>

      {/* Phase 3 Gating Notice */}
      {!convexClient && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm flex items-start gap-3" role="status" aria-live="polite">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">Lender Workflow APIs Scheduled for Phase 3</div>
            <p className="mt-0.5 text-xs text-amber-700">
              The Cloudflare Workers REST backend currently serves Phase 1-2 identity and application services. Institutional lender matching, proposal review, and decisioning endpoints will be enabled following Phase 3 schema migrations and legal disclosure sign-off (Owner Decision O-06).
            </p>
          </div>
        </div>
      )}

      {/* Global Alerts */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Operation Error</div>
              <p className="text-xs text-rose-700 mt-0.5">{error}</p>
            </div>
          </div>
          <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700 text-xs font-semibold">
            Dismiss
          </button>
        </div>
      )}

      {successNotice && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Decision Recorded</div>
              <p className="text-xs text-emerald-700 mt-0.5">{successNotice}</p>
            </div>
          </div>
          <button onClick={() => setSuccessNotice(null)} className="text-emerald-500 hover:text-emerald-700 text-xs font-semibold">
            Dismiss
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Pending Action</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-amber-600">{pendingCount}</span>
            <Clock className="w-5 h-5 text-amber-500/50" />
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Awaiting lender response</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Accepted Quotes</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-600">{acceptedCount}</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-500/50" />
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Advanced to agency review</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Declined Proposals</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-600">{declinedCount}</span>
            <XCircle className="w-5 h-5 text-slate-400" />
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Returned with reasons</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Portfolio Volume</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-bold text-slate-900">{pesewasToGhsString(totalVolumePesewas)}</span>
            <Landmark className="w-5 h-5 text-slate-400" />
          </div>
          <p className="text-[11px] text-slate-400 mt-1">All assigned proposals</p>
        </div>
      </div>

      {/* Main Content Area: Queue & Filter */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Table Controls */}
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">Filter Queue:</span>
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
              {(['ALL', 'PENDING', 'ACCEPTED', 'DECLINED'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    statusFilter === tab
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab === 'ALL' ? 'All Proposals' : tab.charAt(0) + tab.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="text-xs text-slate-500">
            Showing <span className="font-semibold text-slate-800">{proposals.length}</span> assigned proposals
          </div>
        </div>

        {/* Proposals List */}
        {isLoading ? (
          <div className="py-16 text-center">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-600">Loading lender proposal queue...</p>
          </div>
        ) : !convexClient || proposals.length === 0 ? (
          <div className="py-16 text-center" role="status">
            <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-700">
              {!convexClient ? 'Lender Proposal Queue Inactive' : 'No proposals found'}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              {!convexClient
                ? 'Institutional proposal assignment and decisioning workflows are scheduled for Phase 3 implementation. No live proposals will appear until Phase 3 lender endpoints are deployed.'
                : `There are currently no loan proposals assigned to your institution in the '${statusFilter}' status.`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Case Reference</th>
                  <th className="py-3 px-4">Proposed Amount</th>
                  <th className="py-3 px-4">Lender Base Rate</th>
                  <th className="py-3 px-4">Tenure</th>
                  <th className="py-3 px-4">Purpose</th>
                  <th className="py-3 px-4">Proposal Status</th>
                  <th className="py-3 px-4">Assigned On</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {proposals.map((item) => {
                  const isPending = item.proposalStatus === 'PENDING';
                  const isAccepted = item.proposalStatus === 'ACCEPTED';
                  const isDeclined = item.proposalStatus === 'DECLINED';

                  return (
                    <tr key={item.proposalId} className="hover:bg-slate-50/80 transition-colors">
                      {/* Case Reference */}
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-900 flex items-center gap-2">
                        <span>{item.caseId}</span>
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1 py-0.5 rounded">
                          v{item.version}
                        </span>
                      </td>

                      {/* Proposed Amount */}
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        {pesewasToGhsString(item.proposedAmountPesewas)}
                      </td>

                      {/* Lender Base Rate */}
                      <td className="py-3.5 px-4 font-medium text-indigo-700">
                        {bpsToPercentString(item.lenderBaseRateBps)} p.a.
                      </td>

                      {/* Tenure */}
                      <td className="py-3.5 px-4 text-slate-600">
                        {item.tenureMonths} mos
                      </td>

                      {/* Purpose */}
                      <td className="py-3.5 px-4 text-slate-600 max-w-[160px] truncate" title={item.purpose}>
                        {item.purpose}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {isPending && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3.5 h-3.5" />
                            Awaiting Decision
                          </span>
                        )}
                        {isAccepted && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Accepted
                          </span>
                        )}
                        {isDeclined && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            <XCircle className="w-3.5 h-3.5" />
                            Declined
                          </span>
                        )}
                        {!isPending && !isAccepted && !isDeclined && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                            {item.proposalStatus}
                          </span>
                        )}
                      </td>

                      {/* Created Date */}
                      <td className="py-3.5 px-4 text-xs text-slate-500">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenDetail(item)}
                            className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="View Proposal Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {isPending && (
                            <>
                              <button
                                onClick={() => openDecisionModal(item, 'ACCEPT')}
                                className="px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                              >
                                Accept
                              </button>
                              <button
                                onClick={() => openDecisionModal(item, 'DECLINE')}
                                className="px-2.5 py-1 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
                              >
                                Decline
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedProposal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Proposal Specification</h3>
              </div>
              <button
                onClick={() => setSelectedProposal(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm">
              <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-4 space-y-2">
                <div className="flex justify-between items-center text-xs text-indigo-900 font-semibold uppercase tracking-wider">
                  <span>Pseudonymous Case Reference</span>
                  <span className="font-mono bg-white px-2 py-0.5 rounded border border-indigo-200">
                    {selectedProposal.caseId}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                  <div>
                    <span className="text-slate-500">Proposal Version:</span>
                    <div className="font-semibold text-slate-900">Version {selectedProposal.version}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Proposed Principal:</span>
                    <div className="font-semibold text-slate-900">
                      {pesewasToGhsString(selectedProposal.proposedAmountPesewas)}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Lender Base Rate:</span>
                    <div className="font-semibold text-indigo-700">
                      {bpsToPercentString(selectedProposal.lenderBaseRateBps)} p.a.
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Tenure:</span>
                    <div className="font-semibold text-slate-900">{selectedProposal.tenureMonths} Months</div>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Loan Purpose</label>
                <p className="mt-1 text-slate-800 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                  {selectedProposal.purpose}
                </p>
              </div>

              {selectedProposal.decisionReason && (
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Lender Decision Notes
                  </label>
                  <p className="mt-1 text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                    {selectedProposal.decisionReason}
                  </p>
                </div>
              )}

              {/* Redaction Notice */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 space-y-1">
                <div className="font-medium text-slate-700 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  Server-Side Field Redaction Active
                </div>
                <p>
                  Borrower name, contact information, National ID numbers, bank statements, and agency margins are
                  omitted from lender payloads under Gidfine Dev Guide Section 7.
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => setSelectedProposal(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200/50 rounded-lg transition-colors"
              >
                Close View
              </button>

              {selectedProposal.proposalStatus === 'PENDING' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const item = selectedProposal;
                      setSelectedProposal(null);
                      openDecisionModal(item, 'DECLINE');
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
                  >
                    Decline Quote
                  </button>
                  <button
                    onClick={() => {
                      const item = selectedProposal;
                      setSelectedProposal(null);
                      openDecisionModal(item, 'ACCEPT');
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors"
                  >
                    Accept Quote
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Decision Confirmation Modal */}
      {decisionModal.isOpen && decisionModal.proposal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div
              className={`p-5 border-b flex items-center justify-between ${
                decisionModal.decision === 'ACCEPT'
                  ? 'bg-emerald-50/80 border-emerald-100'
                  : 'bg-rose-50/80 border-rose-100'
              }`}
            >
              <div className="flex items-center gap-2">
                {decisionModal.decision === 'ACCEPT' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-600" />
                )}
                <h3
                  className={`text-base font-bold ${
                    decisionModal.decision === 'ACCEPT' ? 'text-emerald-900' : 'text-rose-900'
                  }`}
                >
                  {decisionModal.decision === 'ACCEPT' ? 'Accept Loan Proposal' : 'Decline Loan Proposal'}
                </h3>
              </div>
              <button
                disabled={decisionModal.isSubmitting}
                onClick={() => setDecisionModal((prev) => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5 text-xs">
                <div className="flex justify-between font-mono">
                  <span className="text-slate-500">Case ID:</span>
                  <span className="font-semibold text-slate-800">{decisionModal.proposal.caseId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Amount:</span>
                  <span className="font-semibold text-slate-800">
                    {pesewasToGhsString(decisionModal.proposal.proposedAmountPesewas)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Base Rate:</span>
                  <span className="font-semibold text-indigo-700">
                    {bpsToPercentString(decisionModal.proposal.lenderBaseRateBps)} p.a.
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tenure:</span>
                  <span className="font-semibold text-slate-800">
                    {decisionModal.proposal.tenureMonths} Months
                  </span>
                </div>
              </div>

              {decisionModal.decision === 'ACCEPT' ? (
                <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-1">
                  <p className="font-semibold">Lender Acceptance Notice:</p>
                  <p className="text-emerald-800">
                    By confirming, {lenderName} agrees to reserve capacity for this allocation.
                    This advances the case to the agency for formal review. It does not disburse funds or commit the
                    borrower until final agency approval and affirmative borrower consent are obtained.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Reason for Declining (Recorded in Audit Trail)
                  </label>
                  <textarea
                    rows={3}
                    value={decisionModal.reason}
                    onChange={(e) => setDecisionModal((prev) => ({ ...prev, reason: e.target.value }))}
                    placeholder="E.g., Outside risk parameters, tenure mismatch, capacity reached..."
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  />
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                disabled={decisionModal.isSubmitting}
                onClick={() => setDecisionModal((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200/50 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={decisionModal.isSubmitting}
                onClick={handleDecisionSubmit}
                className={`px-4 py-2 text-xs font-semibold rounded-lg text-white shadow-sm transition-colors flex items-center gap-2 ${
                  decisionModal.decision === 'ACCEPT'
                    ? 'bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400'
                    : 'bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400'
                }`}
              >
                {decisionModal.isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Recording Decision...
                  </>
                ) : decisionModal.decision === 'ACCEPT' ? (
                  'Confirm Acceptance'
                ) : (
                  'Confirm Decline'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
