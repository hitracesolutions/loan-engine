import React, { useState, useEffect, useCallback } from 'react';
import {
  loanService,
  type LenderProposalItem,
  type LenderDetailedProposal,
  pesewasToGhsString,
  bpsToPercentString,
} from '../services/loanService';
import {
  Landmark,
  CheckCircle2,
  XCircle,
  Clock,
  BadgeCheck,
  Filter,
  RefreshCw,
  Eye,
  AlertCircle,
  FileCheck,
  X,
} from 'lucide-react';
import { useTranslation } from '../lib/useTranslation';

interface LenderPortalProps {
  lenderName?: string;
}

export const LenderPortal: React.FC<LenderPortalProps> = ({
  lenderName = 'Institutional Lender',
}) => {
  const { tx } = useTranslation();

  const [proposals, setProposals] = useState<LenderProposalItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'ACCEPTED' | 'DECLINED'>('ALL');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const [selectedProposal, setSelectedProposal] = useState<LenderProposalItem | null>(null);
  const [detailedProposal, setDetailedProposal] = useState<LenderDetailedProposal | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);

  const [decisionModal, setDecisionModal] = useState<{
    isOpen: boolean;
    proposal: LenderProposalItem | null;
    decision: 'ACCEPT' | 'DECLINE';
    reason: string;
    isSubmitting: boolean;
  }>({ isOpen: false, proposal: null, decision: 'ACCEPT', reason: '', isSubmitting: false });

  const loadProposals = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await loanService.getLenderProposals(null, statusFilter);
      setProposals(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load assigned proposals.');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { loadProposals(); }, [loadProposals]);

  const handleOpenDetail = async (item: LenderProposalItem) => {
    setSelectedProposal(item);
    setDetailedProposal(null);
    setIsLoadingDetail(true);
    try {
      const detail = await loanService.getLenderProposal(null, item.applicationId);
      setDetailedProposal(detail);
    } catch (err: any) {
      console.error('Failed to load proposal detail:', err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const openDecisionModal = (proposal: LenderProposalItem, decision: 'ACCEPT' | 'DECLINE') => {
    if (proposal.proposalStatus !== 'PENDING') {
      setError(`Cannot decide on proposal in '${proposal.proposalStatus}' state. Only PENDING proposals can be decided.`);
      return;
    }
    setDecisionModal({ isOpen: true, proposal, decision, reason: '', isSubmitting: false });
  };

  const handleDecisionSubmit = async () => {
    if (!decisionModal.proposal) return;
    setDecisionModal((prev) => ({ ...prev, isSubmitting: true }));
    setError(null);
    setSuccessNotice(null);
    try {
      const result = await loanService.decideLenderProposal(null, {
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
      setDecisionModal({ isOpen: false, proposal: null, decision: 'ACCEPT', reason: '', isSubmitting: false });
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

  const pendingCount = proposals.filter((p) => p.proposalStatus === 'PENDING').length;
  const acceptedCount = proposals.filter((p) => p.proposalStatus === 'ACCEPTED').length;
  const declinedCount = proposals.filter((p) => p.proposalStatus === 'DECLINED').length;
  const totalVolumePesewas = proposals.reduce((acc, p) => acc + p.proposedAmountPesewas, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="dashboard-card rounded-2xl border p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-gray-700">
              <Landmark className="w-7 h-7" strokeWidth={1.5} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="dashboard-heading text-2xl font-semibold tracking-tight">{tx('Lender Decision Portal')}</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                  Assigned Rate Cards
                </span>
              </div>
              <p className="dashboard-copy text-sm mt-0.5">
                Review proposed loan allocations, evaluate risk terms, and commit funding capacity.
              </p>
            </div>
          </div>
          <button
            onClick={loadProposals}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} strokeWidth={1.5} />
            Refresh Queue
          </button>
        </div>

        {/* Redaction notice */}
        <div className="mt-4 p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-start gap-2.5 text-xs text-gray-600">
          <BadgeCheck className="w-4 h-4 text-[#0d3d38] shrink-0 mt-0.5" strokeWidth={1.5} />
          <div>
            <span className="font-semibold text-gray-800">{tx('Gidfine Privacy & Visibility Control (Section 7): ')}</span>
            Borrower identifying information (name, phone, email, national ID) and agency operational margins are strictly redacted.
            Lender decisions are audited on-chain; acceptance triggers agency review and does not directly activate loans or disburse funds.
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" strokeWidth={1.5} />
            <div>
              <div className="font-semibold">{tx('Operation Error')}</div>
              <p className="text-xs text-red-700 mt-0.5">{error}</p>
            </div>
          </div>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 text-xs font-semibold">Dismiss</button>
        </div>
      )}

      {successNotice && (
        <div className="p-4 bg-[#f0f9f7] border border-[#b8dbd8] rounded-xl text-[#0a2e2a] text-sm flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-5 h-5 text-[#0d3d38] shrink-0 mt-0.5" strokeWidth={1.5} />
            <div>
              <div className="font-semibold">{tx('Decision Recorded')}</div>
              <p className="text-xs text-[#0d3d38] mt-0.5">{successNotice}</p>
            </div>
          </div>
          <button onClick={() => setSuccessNotice(null)} className="text-[#0d3d38] hover:text-[#0d3d38] text-xs font-semibold">Dismiss</button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="dashboard-card rounded-xl border p-4">
          <div className="dashboard-label text-xs font-medium uppercase tracking-wider">{tx('Pending Action')}</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-amber-600">{pendingCount}</span>
            <Clock className="w-5 h-5 text-amber-400" strokeWidth={1.5} />
          </div>
          <p className="dashboard-subtle text-[11px] mt-1">{tx('Awaiting lender response')}</p>
        </div>

        <div className="dashboard-card rounded-xl border p-4">
          <div className="dashboard-label text-xs font-medium uppercase tracking-wider">{tx('Accepted Quotes')}</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-[#0d3d38]">{acceptedCount}</span>
            <CheckCircle2 className="w-5 h-5 text-[#4d9d97]" strokeWidth={1.5} />
          </div>
          <p className="dashboard-subtle text-[11px] mt-1">{tx('Advanced to agency review')}</p>
        </div>

        <div className="dashboard-card rounded-xl border p-4">
          <div className="dashboard-label text-xs font-medium uppercase tracking-wider">{tx('Declined Proposals')}</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-gray-600">{declinedCount}</span>
            <XCircle className="w-5 h-5 text-gray-400" strokeWidth={1.5} />
          </div>
          <p className="dashboard-subtle text-[11px] mt-1">{tx('Returned with reasons')}</p>
        </div>

        <div className="dashboard-card rounded-xl border p-4">
          <div className="dashboard-label text-xs font-medium uppercase tracking-wider">{tx('Total Portfolio Volume')}</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-bold dashboard-heading">{pesewasToGhsString(totalVolumePesewas)}</span>
            <Landmark className="w-5 h-5 text-gray-400" strokeWidth={1.5} />
          </div>
          <p className="dashboard-subtle text-[11px] mt-1">{tx('All assigned proposals')}</p>
        </div>
      </div>

      {/* Queue table */}
      <div className="dashboard-card rounded-2xl border overflow-hidden">
        {/* Controls */}
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/50">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" strokeWidth={1.5} />
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-600">{tx('Filter Queue:')}</span>
            <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
              {(['ALL', 'PENDING', 'ACCEPTED', 'DECLINED'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    statusFilter === tab
                      ? 'bg-gray-900 text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {tx(tab === 'ALL' ? 'All Proposals' : tab.charAt(0) + tab.slice(1).toLowerCase())}
                </button>
              ))}
            </div>
          </div>
          <div className="dashboard-subtle text-xs">
            {tx('Showing')} <span className="font-semibold dashboard-heading">{proposals.length}</span> {tx('assigned proposals')}
          </div>
        </div>

        {/* Table body */}
        {isLoading ? (
          <div className="py-16 text-center">
            <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-sm font-medium dashboard-copy">{tx('Loading lender proposal queue...')}</p>
          </div>
        ) : proposals.length === 0 ? (
          <div className="py-16 text-center" role="status">
            <Clock className="w-12 h-12 text-gray-200 mx-auto mb-3" strokeWidth={1} />
            <h3 className="text-base font-semibold dashboard-heading">{tx('No proposals found')}</h3>
            <p className="dashboard-subtle text-xs max-w-md mx-auto mt-1">
              {tx('There are currently no loan proposals assigned to your institution in the')}{' '}
              {tx(statusFilter === 'ALL' ? 'All Proposals' : statusFilter.charAt(0) + statusFilter.slice(1).toLowerCase())}{' '}
              {tx('status.')}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/70 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="py-3 px-4">{tx('Case Reference')}</th>
                  <th className="py-3 px-4">{tx('Proposed Amount')}</th>
                  <th className="py-3 px-4">{tx('Lender Base Rate')}</th>
                  <th className="py-3 px-4">{tx('Tenure')}</th>
                  <th className="py-3 px-4">{tx('Purpose')}</th>
                  <th className="py-3 px-4">{tx('Proposal Status')}</th>
                  <th className="py-3 px-4">{tx('Assigned On')}</th>
                  <th className="py-3 px-4 text-right">{tx('Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {proposals.map((item) => {
                  const isPending = item.proposalStatus === 'PENDING';
                  const isAccepted = item.proposalStatus === 'ACCEPTED';
                  const isDeclined = item.proposalStatus === 'DECLINED';
                  return (
                    <tr key={item.proposalId} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-medium dashboard-heading flex items-center gap-2">
                        <span>{item.caseId}</span>
                        <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1 py-0.5 rounded">v{item.version}</span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold dashboard-heading">{pesewasToGhsString(item.proposedAmountPesewas)}</td>
                      <td className="py-3.5 px-4 font-medium text-[#0d3d38]">{bpsToPercentString(item.lenderBaseRateBps)} p.a.</td>
                      <td className="py-3.5 px-4 dashboard-copy">{item.tenureMonths} mos</td>
                      <td className="py-3.5 px-4 dashboard-copy max-w-[160px] truncate" title={item.purpose}>{item.purpose}</td>
                      <td className="py-3.5 px-4">
                        {isPending && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3.5 h-3.5" strokeWidth={1.5} /> Awaiting Decision
                          </span>
                        )}
                        {isAccepted && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#f0f9f7] text-[#0d3d38] border border-[#b8dbd8]">
                            <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.5} /> Accepted
                          </span>
                        )}
                        {isDeclined && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            <XCircle className="w-3.5 h-3.5" strokeWidth={1.5} /> Declined
                          </span>
                        )}
                        {!isPending && !isAccepted && !isDeclined && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                            {tx(item.proposalStatus.charAt(0) + item.proposalStatus.slice(1).toLowerCase())}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs dashboard-subtle">{new Date(item.createdAt).toLocaleDateString()}</td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenDetail(item)}
                            className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                            title="View Proposal Details"
                          >
                            <Eye className="w-4 h-4" strokeWidth={1.5} />
                          </button>
                          {isPending && (
                            <>
                              <button
                                onClick={() => openDecisionModal(item, 'ACCEPT')}
                                className="px-2.5 py-1 text-xs font-medium text-[#0d3d38] bg-[#f0f9f7] hover:bg-emerald-100 border border-[#b8dbd8] rounded-lg transition-colors"
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
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-gray-200 overflow-hidden">
            <div className="p-5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-gray-700" strokeWidth={1.5} />
                <h3 className="text-base font-bold text-gray-900">{tx('Proposal Specification')}</h3>
              </div>
              <button onClick={() => setSelectedProposal(null)} className="text-gray-400 hover:text-gray-700 transition-colors">
                <X className="w-5 h-5" strokeWidth={1.5} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm">
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
                <div className="flex justify-between items-center text-xs text-gray-700 font-semibold uppercase tracking-wider">
                  <span>{tx('Pseudonymous Case Reference')}</span>
                  <span className="font-mono bg-white px-2 py-0.5 rounded border border-gray-200">{selectedProposal.caseId}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                  <div>
                    <span className="text-gray-500">{tx('Proposal Version:')}</span>
                    <div className="font-semibold text-gray-900">{tx('Version')} {selectedProposal.version}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">{tx('Proposed Principal:')}</span>
                    <div className="font-semibold text-gray-900">{pesewasToGhsString(selectedProposal.proposedAmountPesewas)}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">{tx('Lender Base Rate:')}</span>
                    <div className="font-semibold text-[#0d3d38]">{bpsToPercentString(selectedProposal.lenderBaseRateBps)} p.a.</div>
                  </div>
                  <div>
                    <span className="text-gray-500">{tx('Tenure')}:</span>
                    <div className="font-semibold text-gray-900">{selectedProposal.tenureMonths} Months</div>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{tx('Loan Purpose')}</label>
                <p className="mt-1 text-gray-800 bg-gray-50 p-3 rounded-lg border border-gray-200 text-xs">{selectedProposal.purpose}</p>
              </div>

              {selectedProposal.decisionReason && (
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Lender Decision Notes</label>
                  <p className="mt-1 text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-200 text-xs">{selectedProposal.decisionReason}</p>
                </div>
              )}

              {/* Redaction notice */}
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-500 space-y-1">
                <div className="font-medium text-gray-700 flex items-center gap-1.5">
                  <BadgeCheck className="w-4 h-4 text-[#0d3d38]" strokeWidth={1.5} />
                  Server-Side Field Redaction Active
                </div>
                <p>
                  Borrower name, contact information, National ID numbers, bank statements, and agency margins are
                  omitted from lender payloads under Gidfine Dev Guide Section 7.
                </p>
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
              <button
                onClick={() => setSelectedProposal(null)}
                className="px-4 py-2 text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Close View
              </button>
              {selectedProposal.proposalStatus === 'PENDING' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => { const item = selectedProposal; setSelectedProposal(null); openDecisionModal(item, 'DECLINE'); }}
                    className="px-3 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
                  >
                    Decline Quote
                  </button>
                  <button
                    onClick={() => { const item = selectedProposal; setSelectedProposal(null); openDecisionModal(item, 'ACCEPT'); }}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-[#0d3d38] hover:bg-[#0a2e2a] rounded-lg shadow-sm transition-colors"
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
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-gray-200 overflow-hidden">
            <div
              className={`p-5 border-b flex items-center justify-between ${
                decisionModal.decision === 'ACCEPT'
                  ? 'bg-[#f0f9f7] border-[#d0ebe8]'
                  : 'bg-rose-50 border-rose-100'
              }`}
            >
              <div className="flex items-center gap-2">
                {decisionModal.decision === 'ACCEPT' ? (
                  <CheckCircle2 className="w-5 h-5 text-[#0d3d38]" strokeWidth={1.5} />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-600" strokeWidth={1.5} />
                )}
                <h3 className={`text-base font-bold ${decisionModal.decision === 'ACCEPT' ? 'text-emerald-900' : 'text-rose-900'}`}>
                  {decisionModal.decision === 'ACCEPT' ? 'Accept Loan Proposal' : 'Decline Loan Proposal'}
                </h3>
              </div>
              <button
                disabled={decisionModal.isSubmitting}
                onClick={() => setDecisionModal((prev) => ({ ...prev, isOpen: false }))}
                className="text-gray-400 hover:text-gray-700 transition-colors disabled:opacity-40"
              >
                <X className="w-5 h-5" strokeWidth={1.5} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm">
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 space-y-1.5 text-xs">
                <div className="flex justify-between font-mono">
                  <span className="text-gray-500">{tx('Case ID:')}</span>
                  <span className="font-semibold text-gray-800">{decisionModal.proposal.caseId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{tx('Amount')}:</span>
                  <span className="font-semibold text-gray-800">{pesewasToGhsString(decisionModal.proposal.proposedAmountPesewas)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{tx('Base Rate:')}</span>
                  <span className="font-semibold text-[#0d3d38]">{bpsToPercentString(decisionModal.proposal.lenderBaseRateBps)} p.a.</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{tx('Tenure')}:</span>
                  <span className="font-semibold text-gray-800">{decisionModal.proposal.tenureMonths} Months</span>
                </div>
              </div>

              {decisionModal.decision === 'ACCEPT' ? (
                <div className="p-3 bg-[#f0f9f7] border border-[#b8dbd8] rounded-xl text-xs text-emerald-900 space-y-1">
                  <p className="font-semibold">{tx('Lender Acceptance Notice:')}</p>
                  <p className="text-[#0a2e2a]">
                    By confirming, {lenderName} agrees to reserve capacity for this allocation.
                    This advances the case to the agency for formal review. It does not disburse funds or commit the
                    borrower until final agency approval and affirmative borrower consent are obtained.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Reason for Declining (Recorded in Audit Trail)
                  </label>
                  <textarea
                    rows={3}
                    value={decisionModal.reason}
                    onChange={(e) => setDecisionModal((prev) => ({ ...prev, reason: e.target.value }))}
                    placeholder="E.g., Outside risk parameters, tenure mismatch, capacity reached..."
                    className="w-full text-xs p-2.5 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400"
                  />
                </div>
              )}
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2">
              <button
                disabled={decisionModal.isSubmitting}
                onClick={() => setDecisionModal((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                disabled={decisionModal.isSubmitting}
                onClick={handleDecisionSubmit}
                className={`px-4 py-2 text-xs font-semibold rounded-lg text-white shadow-sm transition-colors flex items-center gap-2 ${
                  decisionModal.decision === 'ACCEPT'
                    ? 'bg-[#0d3d38] hover:bg-[#0a2e2a] disabled:opacity-60'
                    : 'bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400'
                }`}
              >
                {decisionModal.isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
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
