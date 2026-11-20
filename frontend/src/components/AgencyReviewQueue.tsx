import React, { useState, useEffect, useCallback } from 'react';
import {
  gidfineAPI,
  pesewasToGhsString,
  bpsToPercentString,
  type ApplicationReview,
  type ApplicationStatus,
} from '../lib/api-gidfine';
import { useTranslation } from '../lib/useTranslation';
import {
  ClipboardList,
  Inbox,
  Info,
  RefreshCw,
  X,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

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

const STATUS_STYLES: Record<string, string> = {
  AGENCY_APPROVED: 'bg-gray-50 text-gray-600 border-gray-200',
  BORROWER_ACCEPTED: 'bg-[#f0f9f7] text-[#0d3d38] border-[#b8dbd8]',
  LENDER_ACCEPTED: 'bg-[#f0f9f7] text-[#0d3d38] border-[#b8dbd8]',
  LENDER_PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  AGENCY_REJECTED: 'bg-red-50 text-red-700 border-red-200',
  UNDER_REVIEW: 'bg-amber-50 text-amber-700 border-amber-200',
  SUBMITTED: 'bg-gray-100 text-gray-600 border-gray-200',
};

function localizedStatus(status: string, tx: (text: string) => string): string {
  return tx(status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()));
}

const inputBase =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-900/10 disabled:opacity-50';

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
  const { tx } = useTranslation();
  const [applications, setApplications] = useState<AgencyReviewQueueItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const [reviewModalApp, setReviewModalApp] = useState<AgencyReviewQueueItem | null>(null);
  const [reviewDetails, setReviewDetails] = useState<ApplicationReview | null>(null);
  const [reviewLoading, setReviewLoading] = useState<boolean>(false);
  const [reviewAction, setReviewAction] = useState<'assign' | 'transition' | 'note' | null>(null);
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [reviewTargetStatus, setReviewTargetStatus] = useState<ApplicationStatus>('UNDER_REVIEW');
  const [reviewReason, setReviewReason] = useState<string>('');
  const [reviewNote, setReviewNote] = useState<string>('');

  const [proposeModalApp, setProposeModalApp] = useState<AgencyReviewQueueItem | null>(null);
  const [proposeLenderId, setProposeLenderId] = useState<string>('');
  const [proposeAmountGhs, setProposeAmountGhs] = useState<number>(5000);
  const [proposeBaseRateBps, setProposeBaseRateBps] = useState<number>(1800);
  const [proposeMarginBps, setProposeMarginBps] = useState<number>(300);
  const [submittingPropose, setSubmittingPropose] = useState<boolean>(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

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

  const handleProposeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proposeModalApp || !proposeLenderId) return;
    setSubmittingPropose(true);
    setActionNotice(null);
    try {
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

  const handleApproveOffer = async (app: AgencyReviewQueueItem) => {
    setActionNotice(
      `[Phase 3 Gated]: Agency approval endpoint (POST /applications/${app.applicationId}/approve) is pending Sprint 2 backend implementation.`
    );
  };

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
      {/* Header */}
      <div className="dashboard-card rounded-xl border p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold dashboard-heading flex items-center gap-2">
            <ClipboardList className="h-5 w-5 dashboard-label" strokeWidth={1.75} />
            {tx('Agency Loan Review Queue')}
          </h2>
          <p className="text-sm dashboard-copy mt-1">
            Tenant Scope: <span className="font-medium dashboard-heading">{agencyName}</span> (Cloudflare API)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-gray-900/10"
          >
            <option value="">{tx('All Statuses')}</option>
            <option value="SUBMITTED">{localizedStatus('SUBMITTED', tx)}</option>
            <option value="UNDER_REVIEW">{localizedStatus('UNDER_REVIEW', tx)}</option>
            <option value="MORE_INFO_REQUIRED">{localizedStatus('MORE_INFO_REQUIRED', tx)}</option>
            <option value="MATCHING">{localizedStatus('MATCHING', tx)}</option>
            <option value="LENDER_PENDING">{localizedStatus('LENDER_PENDING', tx)}</option>
            <option value="LENDER_ACCEPTED">{localizedStatus('LENDER_ACCEPTED', tx)}</option>
            <option value="AGENCY_APPROVED">{localizedStatus('AGENCY_APPROVED', tx)}</option>
            <option value="BORROWER_ACCEPTED">{localizedStatus('BORROWER_ACCEPTED', tx)}</option>
            <option value="PENDING_DISBURSEMENT">{localizedStatus('PENDING_DISBURSEMENT', tx)}</option>
            <option value="ACTIVE">{localizedStatus('ACTIVE', tx)}</option>
            <option value="AGENCY_REJECTED">{localizedStatus('AGENCY_REJECTED', tx)}</option>
          </select>

          <button
            type="button"
            onClick={fetchQueue}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Action notice */}
      {actionNotice && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
          <div className="flex items-center gap-2 dashboard-copy">
            <Info className="h-4 w-4 dashboard-label flex-shrink-0" strokeWidth={1.75} />
            {actionNotice}
          </div>
          <button type="button" onClick={() => setActionNotice(null)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-600" strokeWidth={1.75} />
          <div className="flex-1">
            <p className="font-semibold text-amber-700">{tx('Notice')}</p>
            <p className="text-amber-600 text-xs mt-0.5">{error}</p>
          </div>
          <button type="button" onClick={() => setError(null)} className="text-amber-500 hover:text-amber-700 flex-shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Table card */}
      <div className="dashboard-card rounded-xl border overflow-hidden">
        {loading ? (
          <div className="p-12 text-center dashboard-copy">
            <RefreshCw className="h-7 w-7 animate-spin mx-auto mb-3 dashboard-label" strokeWidth={1.5} />
            <p className="text-sm font-medium">{tx('Loading applications from Cloudflare API...')}</p>
          </div>
        ) : applications.length === 0 ? (
          <div className="p-12 text-center">
            <Inbox className="h-10 w-10 mx-auto mb-2 dashboard-label" strokeWidth={1.5} />
            <p className="font-semibold dashboard-heading">{tx('No applications in review queue')}</p>
            <p className="text-xs dashboard-copy mt-1">
              {statusFilter
                ? `No applications found with status '${statusFilter}'.`
                : 'Applications submitted by borrowers will appear here.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">{tx('Ref / ID')}</th>
                  <th className="px-6 py-3.5">{tx('Applicant')}</th>
                  <th className="px-6 py-3.5">{tx('Requested Amount')}</th>
                  <th className="px-6 py-3.5">{tx('Tenure')}</th>
                  <th className="px-6 py-3.5">{tx('Purpose')}</th>
                  <th className="px-6 py-3.5">{tx('Status')}</th>
                  <th className="px-6 py-3.5 text-right">{tx('Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {applications.map((app) => {
                  const badge = STATUS_STYLES[app.status] ?? 'bg-gray-100 text-gray-600 border-gray-200';
                  return (
                    <tr key={app.applicationId} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs font-semibold dashboard-heading">
                        APP-{app.applicationId.slice(-6).toUpperCase()}
                      </td>
                      <td className="px-6 py-4 font-medium dashboard-heading">
                        {app.borrowerName}
                      </td>
                      <td className="px-6 py-4 font-semibold dashboard-heading tabular-nums">
                        {pesewasToGhsString(app.requestedAmountPesewas)}
                      </td>
                      <td className="px-6 py-4 dashboard-copy">
                        {app.tenureMonths} Months
                      </td>
                      <td className="px-6 py-4 dashboard-copy max-w-xs truncate" title={app.purpose}>
                        {app.purpose}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${badge}`}
                        >
                          {localizedStatus(app.status, tx)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openReviewModal(app)}
                            className="rounded border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
                          >
                            Review
                          </button>

                          {['SUBMITTED', 'UNDER_REVIEW', 'MATCHING', 'LENDER_PENDING'].includes(app.status) && (
                            <button
                              type="button"
                              onClick={() => {
                                setProposeModalApp(app);
                                setProposeAmountGhs(app.requestedAmountPesewas / 100);
                              }}
                              className="rounded border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
                            >
                              Propose Terms
                            </button>
                          )}

                          {app.status === 'LENDER_ACCEPTED' && (
                            <button
                              type="button"
                              onClick={() => handleApproveOffer(app)}
                              className="rounded-lg bg-[#0d3d38] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#0a2e2a]"
                            >
                              Approve Offer
                            </button>
                          )}

                          {app.status === 'BORROWER_ACCEPTED' && (
                            <button
                              type="button"
                              onClick={handleCheckDisbursement}
                              disabled={checkingReadiness}
                              className="rounded border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
                            >
                              Check Readiness
                            </button>
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

      {/* Review Modal */}
      {reviewModalApp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="review-modal-title"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setReviewModalApp(null); }}
        >
          <div
            className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start border-b border-gray-200 pb-4 mb-5">
              <div>
                <h3 id="review-modal-title" className="text-base font-semibold text-gray-900">
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
                className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {reviewLoading && !reviewDetails ? (
              <div className="py-8 text-center text-sm text-gray-500">
                <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-gray-400" />
                {tx('Review History')}…
              </div>
            ) : (
              <div className="space-y-5">
                {/* Summary cards */}
                <div className="grid sm:grid-cols-3 gap-3 text-sm">
                  {[
                    { label: tx('Status'), value: localizedStatus(reviewModalApp.status, tx) },
                    { label: tx('Requested'), value: pesewasToGhsString(reviewModalApp.requestedAmountPesewas) },
                    { label: tx('Assigned reviewer'), value: reviewModalApp.assignedOfficerId || 'Unassigned' },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <p className="text-xs text-gray-500">{label}</p>
                      <p className="font-semibold text-gray-900 mt-1 break-all">{value}</p>
                    </div>
                  ))}
                </div>

                {/* Assignment */}
                <section className="space-y-3" aria-labelledby="assignment-heading">
                  <h4 id="assignment-heading" className="font-semibold text-gray-900 text-sm">{tx('Assignment')}</h4>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <label htmlFor="assignee-id" className="sr-only">{tx('Reviewer user ID')}</label>
                    <input
                      id="assignee-id"
                      type="text"
                      value={assigneeId}
                      onChange={(e) => setAssigneeId(e.target.value)}
                      placeholder="Loan officer or underwriter user ID"
                      className={inputBase}
                    />
                    <button
                      type="button"
                      onClick={handleAssign}
                      disabled={!assigneeId.trim() || reviewAction !== null}
                      className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 whitespace-nowrap"
                    >
                      {reviewAction === 'assign' ? 'Assigning...' : 'Assign'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">
                    The API validates that the user is an active loan officer or underwriter in this agency.
                  </p>
                </section>

                {/* Review decision */}
                <section className="space-y-3" aria-labelledby="decision-heading">
                  <h4 id="decision-heading" className="font-semibold text-gray-900 text-sm">{tx('Review decision')}</h4>
                  {REVIEW_TARGETS[reviewModalApp.status]?.length ? (
                    <>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <label htmlFor="review-target" className="sr-only">{tx('Next application status')}</label>
                        <select
                          id="review-target"
                          value={reviewTargetStatus}
                          onChange={(e) => setReviewTargetStatus(e.target.value as ApplicationStatus)}
                          className={inputBase}
                        >
                          {REVIEW_TARGETS[reviewModalApp.status]?.map((target) => (
                            <option key={target} value={target}>{target}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={handleReviewTransition}
                          disabled={reviewAction !== null}
                          className="rounded-lg bg-[#0d3d38] px-4 py-2 text-sm font-medium text-white hover:bg-[#0a2e2a] disabled:opacity-50 whitespace-nowrap"
                        >
                          {reviewAction === 'transition' ? 'Saving...' : 'Save decision'}
                        </button>
                      </div>
                      <div>
                        <label htmlFor="review-reason" className="block text-xs font-medium text-gray-600 mb-1.5">
                          Reason{' '}
                          {reviewTargetStatus === 'MORE_INFO_REQUIRED' || reviewTargetStatus === 'AGENCY_REJECTED'
                            ? '(required)'
                            : '(optional)'}
                        </label>
                        <textarea
                          id="review-reason"
                          value={reviewReason}
                          onChange={(e) => setReviewReason(e.target.value)}
                          rows={3}
                          placeholder="Explain the decision or information needed"
                          className={`${inputBase} resize-y`}
                        />
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500">{tx('No agency review transition is available from this status.')}</p>
                  )}
                </section>

                {/* Internal notes */}
                <section className="space-y-3" aria-labelledby="notes-heading">
                  <h4 id="notes-heading" className="font-semibold text-gray-900 text-sm">{tx('Internal notes')}</h4>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <label htmlFor="review-note" className="sr-only">{tx('Internal review note')}</label>
                    <textarea
                      id="review-note"
                      value={reviewNote}
                      onChange={(e) => setReviewNote(e.target.value)}
                      rows={2}
                      placeholder="Add a note for agency staff"
                      className={`${inputBase} resize-y flex-1`}
                    />
                    <button
                      type="button"
                      onClick={handleAddReviewNote}
                      disabled={!reviewNote.trim() || reviewAction !== null}
                      className="self-start rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 whitespace-nowrap"
                    >
                      {reviewAction === 'note' ? 'Adding...' : 'Add note'}
                    </button>
                  </div>
                  {reviewDetails?.notes.length ? (
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {reviewDetails.notes.map((note) => (
                        <div key={note.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
                          <p className="text-gray-800 whitespace-pre-wrap">{note.note}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {note.actorId} · {new Date(note.createdAt).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">{tx('No internal notes yet.')}</p>
                  )}
                </section>

                {/* Status history */}
                <section className="space-y-2" aria-labelledby="history-heading">
                  <h4 id="history-heading" className="font-semibold text-gray-900 text-sm">{tx('Status history')}</h4>
                  {reviewDetails?.statusHistory.length ? (
                    <ol className="space-y-2 text-xs text-gray-600 max-h-36 overflow-y-auto">
                      {reviewDetails.statusHistory.map((entry) => (
                        <li key={entry.id} className="border-l-2 border-gray-200 pl-3">
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
                    <p className="text-xs text-gray-500">{tx('No status history available.')}</p>
                  )}
                </section>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Propose Terms Modal */}
      {proposeModalApp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setProposeModalApp(null); }}
        >
          <div
            className="relative w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-gray-200 pb-4 mb-4">
              <h3 className="text-base font-semibold text-gray-900">{tx('Match & Propose Terms')}</h3>
              <button
                type="button"
                onClick={() => setProposeModalApp(null)}
                className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleProposeSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">{tx('Application')}</label>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-gray-700 font-mono text-xs">
                  APP-{proposeModalApp.applicationId.slice(-6).toUpperCase()} — {proposeModalApp.borrowerName}{' '}
                  ({pesewasToGhsString(proposeModalApp.requestedAmountPesewas)})
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  {tx('Designated Lender User ID (Within Agency)')}
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. usr_lender_123"
                  value={proposeLenderId}
                  onChange={(e) => setProposeLenderId(e.target.value)}
                  className={inputBase}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    {tx('Proposed Amount (GHS)')}
                  </label>
                  <input
                    type="number"
                    min="100"
                    step="1"
                    required
                    value={proposeAmountGhs}
                    onChange={(e) => setProposeAmountGhs(Number(e.target.value))}
                    className={inputBase}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    {tx('Lender Base Rate (bps)')}
                  </label>
                  <input
                    type="number"
                    min="100"
                    step="50"
                    required
                    value={proposeBaseRateBps}
                    onChange={(e) => setProposeBaseRateBps(Number(e.target.value))}
                    className={inputBase}
                  />
                  <span className="text-[10px] text-gray-400 mt-0.5 block">
                    {bpsToPercentString(proposeBaseRateBps)} p.a.
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  {tx('Agency Margin (bps, Optional)')}
                </label>
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={proposeMarginBps}
                  onChange={(e) => setProposeMarginBps(Number(e.target.value))}
                  className={inputBase}
                />
                <span className="text-[10px] text-gray-400 mt-0.5 block">
                  {bpsToPercentString(proposeMarginBps)} spread
                </span>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setProposeModalApp(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
                >
                  {tx('Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submittingPropose}
                  className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {submittingPropose ? tx('Submitting application...') : tx('Send Proposal')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Disbursement Readiness Modal */}
      {readinessResult && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setReadinessResult(null); }}
        >
          <div
            className="relative w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-gray-200 pb-4 mb-4">
              <h3 className="text-base font-semibold text-gray-900">{tx('Disbursement Readiness Check')}</h3>
              <button
                type="button"
                onClick={() => setReadinessResult(null)}
                className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 bg-gray-50">
                <span className="font-medium text-gray-700">{tx('Status')}:</span>
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                    readinessResult.readyForDisbursement
                      ? 'bg-[#f0f9f7] text-[#0d3d38] border-[#b8dbd8]'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  {readinessResult.readyForDisbursement ? 'READY FOR DISBURSEMENT' : 'NOT READY'}
                </span>
              </div>

              <div className="space-y-2 text-xs text-gray-600">
                {[
                  { label: `${tx('Agency Approval')}:`, value: readinessResult.disbursementPrerequisites?.hasAgencyApproval },
                  { label: `${tx('Borrower Consent')}:`, value: readinessResult.disbursementPrerequisites?.hasBorrowerConsent },
                  { label: `${tx('SHA-256 Fingerprint')}:`, value: readinessResult.disbursementPrerequisites?.isConsentFingerprintValid },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between">
                    <span>{label}</span>
                    <span className={`font-medium ${value ? 'text-[#0d3d38]' : 'text-red-600'}`}>
                      {value ? '✓ Yes' : '✕ No'}
                    </span>
                  </div>
                ))}
                <div className="border-t border-gray-200 pt-2 space-y-1 text-gray-400">
                  <div className="flex justify-between">
                    <span>{tx('Payment Initiated')}:</span>
                    <span>{readinessResult.paymentInitiated ? 'Yes' : 'False (Locked)'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{tx('Repayment Schedule Active')}:</span>
                    <span>{readinessResult.repaymentScheduleActive ? 'Active' : 'False (Locked)'}</span>
                  </div>
                </div>
              </div>

              {readinessResult.reasons?.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 space-y-1">
                  <p className="font-semibold">{tx('Blockers')}:</p>
                  {readinessResult.reasons.map((r: string, idx: number) => (
                    <p key={idx}>• {r}</p>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4 border-t border-gray-200 mt-4">
              <button
                type="button"
                onClick={() => setReadinessResult(null)}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
              >
                {tx('Close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgencyReviewQueue;
