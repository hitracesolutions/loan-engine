import React, { useState, useEffect, useCallback } from 'react';
import {
  gidfineAPI,
  pesewasToGhsString,
  bpsToPercentString,
  type ApplicationReview,
  type ApplicationStatus,
} from '../lib/api-gidfine';

export interface AgencyReviewQueueItem {
  applicationId: string;
  agencyId: string;
  borrowerId: string;
  borrowerName: string;
  requestedAmountPesewas: number;
  tenureMonths: number;
  purpose: string;
  status: ApplicationStatus;
  createdAt: number;
  submittedAt?: number | null;
  assignedOfficerId?: string | null;
  activeProposalId?: string;
  proposedAmountPesewas?: number;
  lenderBaseRateBps?: number;
  agencyMarginBps?: number;
}

const REVIEW_TARGETS: Partial<Record<ApplicationStatus, ApplicationStatus[]>> = {
  SUBMITTED: ['UNDER_REVIEW', 'MORE_INFO_REQUIRED', 'AGENCY_REJECTED'],
  UNDER_REVIEW: ['MATCHING', 'MORE_INFO_REQUIRED', 'AGENCY_REJECTED'],
  MORE_INFO_REQUIRED: ['UNDER_REVIEW'],
  MATCHING: ['LENDER_PENDING', 'AGENCY_REJECTED'],
  LENDER_DECLINED: ['MATCHING', 'AGENCY_REJECTED'],
  LENDER_ACCEPTED: ['AGENCY_APPROVED', 'AGENCY_REJECTED'],
};

interface AgencyReviewQueueProps {
  agencyName?: string;
}

interface ReadinessResult {
  readyForDisbursement: boolean;
  disbursementPrerequisites: {
    hasAgencyApproval: boolean;
    hasBorrowerConsent: boolean;
    isConsentFingerprintValid: boolean;
  };
  paymentInitiated: boolean;
  repaymentScheduleActive: boolean;
  reasons: string[];
}

export const AgencyReviewQueue: React.FC<AgencyReviewQueueProps> = ({
  agencyName = 'Accra Main Agency',
}) => {
  const [applications, setApplications] = useState<AgencyReviewQueueItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Review workflow state (Phase 1/2)
  const [reviewModalApp, setReviewModalApp] = useState<AgencyReviewQueueItem | null>(null);
  const [reviewDetails, setReviewDetails] = useState<ApplicationReview | null>(null);
  const [reviewLoading, setReviewLoading] = useState<boolean>(false);
  const [reviewAction, setReviewAction] = useState<'assign' | 'transition' | 'note' | null>(null);
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [reviewTargetStatus, setReviewTargetStatus] = useState<ApplicationStatus>('UNDER_REVIEW');
  const [reviewReason, setReviewReason] = useState<string>('');
  const [reviewNote, setReviewNote] = useState<string>('');

  // Modal State for Propose Terms (Phase 3 Gated)
  const [proposeModalApp, setProposeModalApp] = useState<AgencyReviewQueueItem | null>(null);
  const [proposeLenderId, setProposeLenderId] = useState<string>('');
  const [proposeAmountGhs, setProposeAmountGhs] = useState<number>(5000);
  const [proposeBaseRateBps, setProposeBaseRateBps] = useState<number>(1800); // 18.00%
  const [proposeMarginBps, setProposeMarginBps] = useState<number>(300); // 3.00%
  const [submittingPropose, setSubmittingPropose] = useState<boolean>(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Modal State for Disbursement Readiness Check (Phase 4 Gated)
  const [readinessResult, setReadinessResult] = useState<ReadinessResult | null>(null);
  const [checkingReadiness, setCheckingReadiness] = useState<boolean>(false);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rawList = await gidfineAPI.listApplications(
        statusFilter ? { status: statusFilter as ApplicationStatus } : {},
      );

      const normalized: AgencyReviewQueueItem[] = rawList.map((item) => ({
        applicationId: item.id,
        agencyId: '',
        borrowerId: item.borrowerId ?? '',
        borrowerName: item.borrowerName ?? 'Applicant',
        requestedAmountPesewas: item.requestedAmountPesewas,
        tenureMonths: item.tenureMonths,
        purpose: item.purpose ?? '',
        status: item.status,
        createdAt: item.createdAt,
        submittedAt: item.submittedAt,
        assignedOfficerId: item.assignedOfficerId,
      }));

      setApplications(normalized);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load agency review queue from Cloudflare API.';
      if (message.includes('401')) {
        setError('Authentication required. Please log in as an agency officer to view the review queue.');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const refreshReviewDetails = async (applicationId: string) => {
    setReviewLoading(true);
    try {
      const details = await gidfineAPI.getApplicationReview(applicationId);
      setReviewDetails(details);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load review details.');
    } finally {
      setReviewLoading(false);
    }
  };

  const openReviewModal = async (app: AgencyReviewQueueItem) => {
    setReviewModalApp(app);
    setReviewDetails(null);
    setAssigneeId(app.assignedOfficerId ?? '');
    setReviewReason('');
    setReviewNote('');
    setReviewTargetStatus(REVIEW_TARGETS[app.status]?.[0] ?? 'UNDER_REVIEW');
    await refreshReviewDetails(app.applicationId);
  };

  const handleAssign = async () => {
    if (!reviewModalApp || !assigneeId.trim()) return;
    setReviewAction('assign');
    setError(null);
    try {
      await gidfineAPI.assignApplication(reviewModalApp.applicationId, assigneeId.trim());
      setActionNotice(`Application ${reviewModalApp.applicationId} assigned to ${assigneeId.trim()}.`);
      await fetchQueue();
      await refreshReviewDetails(reviewModalApp.applicationId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to assign application.');
    } finally {
      setReviewAction(null);
    }
  };

  const handleReviewTransition = async () => {
    if (!reviewModalApp) return;
    const requiresReason = reviewTargetStatus === 'MORE_INFO_REQUIRED' || reviewTargetStatus === 'AGENCY_REJECTED';
    if (requiresReason && !reviewReason.trim()) {
      setError('Add a reason before requesting information or rejecting an application.');
      return;
    }

    setReviewAction('transition');
    setError(null);
    try {
      const result = await gidfineAPI.reviewApplication(
        reviewModalApp.applicationId,
        reviewTargetStatus,
        reviewReason.trim() || undefined,
      );
      setReviewModalApp((current) => current ? { ...current, status: result.status } : current);
      setActionNotice(`Application ${reviewModalApp.applicationId} moved to ${reviewTargetStatus}.`);
      await fetchQueue();
      await refreshReviewDetails(reviewModalApp.applicationId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update application status.');
    } finally {
      setReviewAction(null);
    }
  };

  const handleAddReviewNote = async () => {
    if (!reviewModalApp || !reviewNote.trim()) return;
    setReviewAction('note');
    setError(null);
    try {
      await gidfineAPI.addApplicationReviewNote(reviewModalApp.applicationId, reviewNote.trim());
      setReviewNote('');
      setActionNotice('Internal review note added.');
      await refreshReviewDetails(reviewModalApp.applicationId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add review note.');
    } finally {
      setReviewAction(null);
    }
  };

  // Handle Propose Terms Submit (Gated: Phase 3 endpoint pending backend implementation)
  const handleProposeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proposeModalApp || !proposeLenderId) return;

    setSubmittingPropose(true);
    setActionNotice(null);
    try {
      // Backend router (workers/api) currently implements Phase 1-2 auth & applications.
      // Phase 3 lender proposal endpoints (/proposals) are pending Sprint 2 implementation.
      setActionNotice(
        `[Phase 3 Gated]: Lender term proposal endpoint (POST /proposals) is scheduled for Sprint 2. Requested GHS ${proposeAmountGhs} at ${bpsToPercentString(proposeBaseRateBps)} for ${proposeModalApp.applicationId} logged locally.`
      );
      setProposeModalApp(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to issue proposal.');
    } finally {
      setSubmittingPropose(false);
    }
  };

  // Handle Agency Approve Offer (Gated: Phase 3 approval endpoint pending backend implementation)
  const handleApproveOffer = async (app: AgencyReviewQueueItem) => {
    setActionNotice(
      `[Phase 3 Gated]: Agency approval endpoint (POST /applications/${app.applicationId}/approve) is pending Sprint 2 backend implementation.`
    );
  };

  // Handle Check Disbursement Readiness (Gated: Phase 4 readiness check pending ledger sign-off)
  const handleCheckDisbursement = async () => {
    setCheckingReadiness(true);
    setReadinessResult({
      readyForDisbursement: false,
      disbursementPrerequisites: {
        hasAgencyApproval: false,
        hasBorrowerConsent: false,
        isConsentFingerprintValid: false,
      },
      paymentInitiated: false,
      repaymentScheduleActive: false,
      reasons: [
        'Cloudflare D1 Financial Ledger cutover is quarantined pending PRD Section 15 owner sign-off.',
        'Phase 4 disbursement endpoints (/disbursements) not yet live on Workers API router.',
      ],
    });
    setCheckingReadiness(false);
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
            Tenant Scope: <span className="font-semibold text-gray-700">{agencyName}</span> (Cloudflare API)
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
            <option value="MORE_INFO_REQUIRED">MORE_INFO_REQUIRED</option>
            <option value="MATCHING">MATCHING</option>
            <option value="LENDER_PENDING">LENDER_PENDING</option>
            <option value="LENDER_ACCEPTED">LENDER_ACCEPTED</option>
            <option value="AGENCY_APPROVED">AGENCY_APPROVED</option>
            <option value="BORROWER_ACCEPTED">BORROWER_ACCEPTED</option>
            <option value="PENDING_DISBURSEMENT">PENDING_DISBURSEMENT</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="AGENCY_REJECTED">AGENCY_REJECTED</option>
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
      {actionNotice && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg text-sm flex items-center justify-between">
          <span>ℹ️ {actionNotice}</span>
          <button onClick={() => setActionNotice(null)} className="font-bold ml-4">✕</button>
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
            <p className="text-sm font-medium">Loading applications from Cloudflare API...</p>
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
                      <button
                        onClick={() => openReviewModal(app)}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium px-3 py-1.5 rounded text-xs transition-colors"
                      >
                        Review
                      </button>

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
                          onClick={handleCheckDisbursement}
                          disabled={checkingReadiness}
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

      {/* Agency review modal */}
      {reviewModalApp && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="review-modal-title"
        >
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-5">
            <div className="flex justify-between items-start border-b pb-3">
              <div>
                <h3 id="review-modal-title" className="font-bold text-lg text-gray-900">
                  Review application
                </h3>
                <p className="text-xs text-gray-500 mt-1 font-mono">
                  APP-{reviewModalApp.applicationId.slice(-6).toUpperCase()} · {reviewModalApp.borrowerName}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close review dialog"
                onClick={() => setReviewModalApp(null)}
                className="text-gray-400 hover:text-gray-600 font-bold text-lg"
              >
                ×
              </button>
            </div>

            {reviewLoading && !reviewDetails ? (
              <div className="py-8 text-center text-sm text-gray-500">Loading review history...</div>
            ) : (
              <>
                <div className="grid sm:grid-cols-3 gap-3 text-sm">
                  <div className="rounded-lg bg-gray-50 border p-3">
                    <p className="text-xs text-gray-500">Status</p>
                    <p className="font-semibold text-gray-900 mt-1">{reviewModalApp.status}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 border p-3">
                    <p className="text-xs text-gray-500">Requested</p>
                    <p className="font-semibold text-gray-900 mt-1">
                      {pesewasToGhsString(reviewModalApp.requestedAmountPesewas)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-gray-50 border p-3">
                    <p className="text-xs text-gray-500">Assigned reviewer</p>
                    <p className="font-semibold text-gray-900 mt-1 break-all">
                      {reviewModalApp.assignedOfficerId || 'Unassigned'}
                    </p>
                  </div>
                </div>

                <section className="space-y-3" aria-labelledby="assignment-heading">
                  <h4 id="assignment-heading" className="font-semibold text-gray-900">Assignment</h4>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <label htmlFor="assignee-id" className="sr-only">Reviewer user ID</label>
                    <input
                      id="assignee-id"
                      type="text"
                      value={assigneeId}
                      onChange={(e) => setAssigneeId(e.target.value)}
                      placeholder="Loan officer or underwriter user ID"
                      className="flex-1 border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAssign}
                      disabled={!assigneeId.trim() || reviewAction !== null}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg text-sm disabled:opacity-50"
                    >
                      {reviewAction === 'assign' ? 'Assigning...' : 'Assign'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">
                    The API validates that the user is an active loan officer or underwriter in this agency.
                  </p>
                </section>

                <section className="space-y-3" aria-labelledby="decision-heading">
                  <h4 id="decision-heading" className="font-semibold text-gray-900">Review decision</h4>
                  {REVIEW_TARGETS[reviewModalApp.status]?.length ? (
                    <>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <label htmlFor="review-target" className="sr-only">Next application status</label>
                        <select
                          id="review-target"
                          value={reviewTargetStatus}
                          onChange={(e) => setReviewTargetStatus(e.target.value as ApplicationStatus)}
                          className="flex-1 border rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        >
                          {REVIEW_TARGETS[reviewModalApp.status]?.map((target) => (
                            <option key={target} value={target}>{target}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={handleReviewTransition}
                          disabled={reviewAction !== null}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 rounded-lg text-sm disabled:opacity-50"
                        >
                          {reviewAction === 'transition' ? 'Saving...' : 'Save decision'}
                        </button>
                      </div>
                      <label htmlFor="review-reason" className="block text-xs font-semibold text-gray-600">
                        Reason {reviewTargetStatus === 'MORE_INFO_REQUIRED' || reviewTargetStatus === 'AGENCY_REJECTED' ? '(required)' : '(optional)'}
                      </label>
                      <textarea
                        id="review-reason"
                        value={reviewReason}
                        onChange={(e) => setReviewReason(e.target.value)}
                        rows={3}
                        placeholder="Explain the decision or information needed"
                        className="w-full border rounded-lg p-2.5 text-sm resize-y focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </>
                  ) : (
                    <p className="text-sm text-gray-500">No agency review transition is available from this status.</p>
                  )}
                </section>

                <section className="space-y-3" aria-labelledby="notes-heading">
                  <h4 id="notes-heading" className="font-semibold text-gray-900">Internal notes</h4>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <label htmlFor="review-note" className="sr-only">Internal review note</label>
                    <textarea
                      id="review-note"
                      value={reviewNote}
                      onChange={(e) => setReviewNote(e.target.value)}
                      rows={2}
                      placeholder="Add a note for agency staff"
                      className="flex-1 border rounded-lg p-2.5 text-sm resize-y focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddReviewNote}
                      disabled={!reviewNote.trim() || reviewAction !== null}
                      className="self-start bg-gray-800 hover:bg-gray-900 text-white font-medium px-4 py-2 rounded-lg text-sm disabled:opacity-50"
                    >
                      {reviewAction === 'note' ? 'Adding...' : 'Add note'}
                    </button>
                  </div>
                  {reviewDetails?.notes.length ? (
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {reviewDetails.notes.map((note) => (
                        <div key={note.id} className="rounded-lg bg-gray-50 border p-3 text-sm">
                          <p className="text-gray-800 whitespace-pre-wrap">{note.note}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {note.actorId} · {new Date(note.createdAt).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">No internal notes yet.</p>
                  )}
                </section>

                <section className="space-y-2" aria-labelledby="history-heading">
                  <h4 id="history-heading" className="font-semibold text-gray-900">Status history</h4>
                  {reviewDetails?.statusHistory.length ? (
                    <ol className="space-y-2 text-xs text-gray-600 max-h-36 overflow-y-auto">
                      {reviewDetails.statusHistory.map((entry) => (
                        <li key={entry.id} className="border-l-2 border-blue-200 pl-3">
                          <span className="font-semibold text-gray-800">
                            {entry.fromStatus || 'New'} → {entry.toStatus}
                          </span>
                          {entry.reason && <span> — {entry.reason}</span>}
                          <span className="block text-gray-500 mt-0.5">
                            {entry.actorId} · {new Date(entry.createdAt).toLocaleString()}
                          </span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-xs text-gray-500">No status history available.</p>
                  )}
                </section>
              </>
            )}
          </div>
        </div>
      )}

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
                  placeholder="e.g. usr_lender_123"
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
