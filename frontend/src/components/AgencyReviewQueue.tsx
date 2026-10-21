import React, { useState, useEffect, useCallback } from 'react';
import { useOptionalConvex } from '../lib/convex';
import {
  loanService,
  type AgencyReviewQueueItem,
  pesewasToGhsString,
  bpsToPercentString,
  ConvexCloudUnavailableError,
} from '../services/loanService';
import type { Id } from '../../convex/_generated/dataModel';

interface AgencyReviewQueueProps {
  agencyName?: string;
}

export const AgencyReviewQueue: React.FC<AgencyReviewQueueProps> = ({
  agencyName = 'Accra Main Agency',
}) => {
  const convexClient = useOptionalConvex();
  const [applications, setApplications] = useState<AgencyReviewQueueItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Modal State for Propose Terms
  const [proposeModalApp, setProposeModalApp] = useState<AgencyReviewQueueItem | null>(null);
  const [proposeLenderId, setProposeLenderId] = useState<string>('');
  const [proposeAmountGhs, setProposeAmountGhs] = useState<number>(5000);
  const [proposeBaseRateBps, setProposeBaseRateBps] = useState<number>(1800); // 18.00%
  const [proposeMarginBps, setProposeMarginBps] = useState<number>(300); // 3.00%
  const [submittingPropose, setSubmittingPropose] = useState<boolean>(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Modal State for Disbursement Readiness Check
  const [readinessResult, setReadinessResult] = useState<any | null>(null);
  const [checkingReadiness, setCheckingReadiness] = useState<boolean>(false);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await loanService.getAgencyReviewQueue(
        convexClient,
        statusFilter || undefined
      );
      setApplications(items);
    } catch (err: any) {
      if (err instanceof ConvexCloudUnavailableError) {
        setError("Convex Cloud backend is not linked or VITE_CONVEX_URL is not set. Matthias will handle cloud deployment.");
      } else {
        setError(err.message || 'Failed to load agency review queue.');
      }
    } finally {
      setLoading(false);
    }
  }, [convexClient, statusFilter]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // Handle Propose Terms Submit
  const handleProposeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proposeModalApp || !proposeLenderId) return;

    setSubmittingPropose(true);
    setActionSuccess(null);
    try {
      const res = await loanService.proposeTerms(convexClient, {
        applicationId: proposeModalApp.applicationId,
        lenderId: proposeLenderId as Id<'users'>,
        proposedAmountGhs: proposeAmountGhs,
        lenderBaseRateBps: proposeBaseRateBps,
        agencyMarginBps: proposeMarginBps,
      });
      setActionSuccess(`Proposal v${res.version} created and sent to lender for application.`);
      setProposeModalApp(null);
      await fetchQueue();
    } catch (err: any) {
      setError(err.message || 'Failed to issue proposal.');
    } finally {
      setSubmittingPropose(false);
    }
  };

  // Handle Agency Approve Offer
  const handleApproveOffer = async (app: AgencyReviewQueueItem) => {
    if (!app.activeProposalId) return;
    setLoading(true);
    setActionSuccess(null);
    try {
      await loanService.approveOffer(convexClient, {
        applicationId: app.applicationId,
        proposalId: app.activeProposalId,
        notes: 'Underwriting verification satisfied by agency operator.',
      });
      setActionSuccess(`Application ${app.applicationId} approved. Awaiting borrower consent.`);
      await fetchQueue();
    } catch (err: any) {
      setError(err.message || 'Failed to approve offer.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Check Disbursement Readiness
  const handleCheckDisbursement = async (applicationId: Id<'applications'>) => {
    setCheckingReadiness(true);
    setReadinessResult(null);
    try {
      const result = await loanService.checkDisbursementReadiness(convexClient, applicationId);
      setReadinessResult(result);
    } catch (err: any) {
      setError(err.message || 'Failed to verify disbursement readiness.');
    } finally {
      setCheckingReadiness(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span>📋</span> Agency Loan Review Queue
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Tenant Scope: <span className="font-semibold text-gray-700">{agencyName}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="SUBMITTED">SUBMITTED</option>
            <option value="UNDER_REVIEW">UNDER_REVIEW</option>
            <option value="MATCHING">MATCHING</option>
            <option value="LENDER_PENDING">LENDER_PENDING</option>
            <option value="LENDER_ACCEPTED">LENDER_ACCEPTED</option>
            <option value="AGENCY_APPROVED">AGENCY_APPROVED</option>
            <option value="BORROWER_ACCEPTED">BORROWER_ACCEPTED</option>
            <option value="PENDING_DISBURSEMENT">PENDING_DISBURSEMENT</option>
            <option value="ACTIVE">ACTIVE</option>
          </select>

          <button
            onClick={fetchQueue}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Notifications */}
      {actionSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg text-sm flex items-center justify-between">
          <span>✓ {actionSuccess}</span>
          <button onClick={() => setActionSuccess(null)} className="font-bold ml-4">✕</button>
        </div>
      )}

      {error && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
          <span className="text-lg">ℹ️</span>
          <div className="flex-1">
            <p className="font-semibold">Notice</p>
            <p className="text-amber-800 text-xs mt-0.5">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="font-bold">✕</button>
        </div>
      )}

      {/* Applications Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent mb-3" />
            <p className="text-sm font-medium">Loading applications from Convex...</p>
          </div>
        ) : applications.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <span className="text-4xl block mb-2">📭</span>
            <p className="font-semibold text-gray-700">No applications in review queue</p>
            <p className="text-xs text-gray-400 mt-1">
              {statusFilter ? `No applications found with status '${statusFilter}'.` : 'Applications submitted by borrowers will appear here.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Ref / ID</th>
                  <th className="px-6 py-3.5">Applicant</th>
                  <th className="px-6 py-3.5">Requested Amount</th>
                  <th className="px-6 py-3.5">Tenure</th>
                  <th className="px-6 py-3.5">Purpose</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {applications.map((app) => (
                  <tr key={app.applicationId} className="hover:bg-gray-50/75 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-gray-900 font-semibold">
                      APP-{app.applicationId.slice(-6).toUpperCase()}
                    </td>
                    <td className="px-6 py-4 text-gray-900 font-medium">
                      {app.borrowerName}
                    </td>
                    <td className="px-6 py-4 text-gray-900 font-semibold">
                      {pesewasToGhsString(app.requestedAmountPesewas)}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {app.tenureMonths} Months
                    </td>
                    <td className="px-6 py-4 text-gray-600 max-w-xs truncate" title={app.purpose}>
                      {app.purpose}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        app.status === 'AGENCY_APPROVED'
                          ? 'bg-purple-100 text-purple-800'
                          : app.status === 'BORROWER_ACCEPTED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : app.status === 'LENDER_ACCEPTED'
                          ? 'bg-blue-100 text-blue-800'
                          : app.status === 'LENDER_PENDING'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {app.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      {/* Propose Terms Button */}
                      {(app.status === 'SUBMITTED' || app.status === 'UNDER_REVIEW' || app.status === 'MATCHING' || app.status === 'LENDER_PENDING') && (
                        <button
                          onClick={() => {
                            setProposeModalApp(app);
                            setProposeAmountGhs(app.requestedAmountPesewas / 100);
                          }}
                          className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium px-3 py-1.5 rounded text-xs transition-colors"
                        >
                          Propose Terms
                        </button>
                      )}

                      {/* Approve Offer Button */}
                      {app.status === 'LENDER_ACCEPTED' && (
                        <button
                          onClick={() => handleApproveOffer(app)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3 py-1.5 rounded text-xs transition-colors"
                        >
                          Approve Offer
                        </button>
                      )}

                      {/* Verify Disbursement Readiness */}
                      {app.status === 'BORROWER_ACCEPTED' && (
                        <button
                          onClick={() => handleCheckDisbursement(app.applicationId)}
                          className="bg-purple-50 hover:bg-purple-100 text-purple-700 font-medium px-3 py-1.5 rounded text-xs transition-colors"
                        >
                          Check Readiness
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Propose Terms Modal */}
      {proposeModalApp && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-lg text-gray-900">
                Match & Propose Terms
              </h3>
              <button
                onClick={() => setProposeModalApp(null)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleProposeSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Application
                </label>
                <div className="bg-gray-50 p-2.5 rounded border border-gray-200 text-gray-700 font-mono text-xs">
                  APP-{proposeModalApp.applicationId.slice(-6).toUpperCase()} — {proposeModalApp.borrowerName} ({pesewasToGhsString(proposeModalApp.requestedAmountPesewas)})
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Designated Lender User ID (Within Agency)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. users_lender_123"
                  value={proposeLenderId}
                  onChange={(e) => setProposeLenderId(e.target.value)}
                  className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Proposed Amount (GHS)
                  </label>
                  <input
                    type="number"
                    min="100"
                    step="1"
                    required
                    value={proposeAmountGhs}
                    onChange={(e) => setProposeAmountGhs(Number(e.target.value))}
                    className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Lender Base Rate (bps)
                  </label>
                  <input
                    type="number"
                    min="100"
                    step="50"
                    required
                    value={proposeBaseRateBps}
                    onChange={(e) => setProposeBaseRateBps(Number(e.target.value))}
                    className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-gray-400 mt-0.5 block">
                    {bpsToPercentString(proposeBaseRateBps)} p.a.
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Agency Margin (bps, Optional)
                </label>
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={proposeMarginBps}
                  onChange={(e) => setProposeMarginBps(Number(e.target.value))}
                  className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <span className="text-[10px] text-gray-400 mt-0.5 block">
                  {bpsToPercentString(proposeMarginBps)} spread
                </span>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setProposeModalApp(null)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPropose}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  {submittingPropose ? 'Submitting...' : 'Send Proposal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Disbursement Readiness Modal */}
      {readinessResult && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-lg text-gray-900">
                Disbursement Readiness Check
              </h3>
              <button
                onClick={() => setReadinessResult(null)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border">
                <span className="font-medium text-gray-700">Status:</span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  readinessResult.readyForDisbursement ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {readinessResult.readyForDisbursement ? 'READY FOR DISBURSEMENT' : 'NOT READY'}
                </span>
              </div>

              <div className="space-y-2 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>Agency Approval:</span>
                  <span className="font-medium">{readinessResult.disbursementPrerequisites?.hasAgencyApproval ? '✓ Yes' : '✕ No'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Borrower Consent:</span>
                  <span className="font-medium">{readinessResult.disbursementPrerequisites?.hasBorrowerConsent ? '✓ Yes' : '✕ No'}</span>
                </div>
                <div className="flex justify-between">
                  <span>SHA-256 Fingerprint:</span>
                  <span className="font-medium">{readinessResult.disbursementPrerequisites?.isConsentFingerprintValid ? '✓ Verified' : '✕ Invalid'}</span>
                </div>
                <div className="flex justify-between pt-2 border-t text-gray-400">
                  <span>Payment Initiated:</span>
                  <span>{readinessResult.paymentInitiated ? 'Yes' : 'False (Locked)'}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Repayment Schedule Active:</span>
                  <span>{readinessResult.repaymentScheduleActive ? 'Active' : 'False (Locked)'}</span>
                </div>
              </div>

              {readinessResult.reasons?.length > 0 && (
                <div className="bg-amber-50 p-3 rounded text-xs text-amber-800 space-y-1">
                  <p className="font-semibold">Blockers:</p>
                  {readinessResult.reasons.map((r: string, idx: number) => (
                    <p key={idx}>• {r}</p>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t">
              <button
                onClick={() => setReadinessResult(null)}
                className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-900"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgencyReviewQueue;
