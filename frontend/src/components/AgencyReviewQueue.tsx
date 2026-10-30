import React, { useState, useEffect, useCallback } from 'react';
import {
  gidfineAPI,
  pesewasToGhsString,
  bpsToPercentString,
} from '../lib/api-gidfine';

export interface AgencyReviewQueueItem {
  applicationId: string;
  agencyId: string;
  borrowerId: string;
  borrowerName: string;
  requestedAmountPesewas: number;
  tenureMonths: number;
  purpose: string;
  status: string;
  rejectionReason?: string | null;
  notesCount?: number;
  createdAt: number;
  activeProposalId?: string;
  proposedAmountPesewas?: number;
  lenderBaseRateBps?: number;
  agencyMarginBps?: number;
}

export interface ReviewNoteItem {
  id: string;
  applicationId: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  noteText: string;
  isInternal: boolean;
  createdAt: number;
}

interface AgencyReviewQueueProps {
  agencyName?: string;
}

export const AgencyReviewQueue: React.FC<AgencyReviewQueueProps> = ({
  agencyName = 'Accra Main Agency',
}) => {
  const [applications, setApplications] = useState<AgencyReviewQueueItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Notes Modal State (Sprint 2)
  const [notesModalApp, setNotesModalApp] = useState<AgencyReviewQueueItem | null>(null);
  const [appNotes, setAppNotes] = useState<ReviewNoteItem[]>([]);
  const [loadingNotes, setLoadingNotes] = useState<boolean>(false);
  const [newNoteText, setNewNoteText] = useState<string>('');
  const [submittingNote, setSubmittingNote] = useState<boolean>(false);

  // Rejection Modal State (Sprint 2)
  const [rejectModalApp, setRejectModalApp] = useState<AgencyReviewQueueItem | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [submittingReject, setSubmittingReject] = useState<boolean>(false);

  // Request Info Modal State (Sprint 2)
  const [infoModalApp, setInfoModalApp] = useState<AgencyReviewQueueItem | null>(null);
  const [infoNoteText, setInfoNoteText] = useState<string>('');
  const [submittingInfo, setSubmittingInfo] = useState<boolean>(false);

  // Modal State for Propose Terms (Phase 3 Gated)
  const [proposeModalApp, setProposeModalApp] = useState<AgencyReviewQueueItem | null>(null);
  const [proposeLenderId, setProposeLenderId] = useState<string>('');
  const [proposeAmountGhs, setProposeAmountGhs] = useState<number>(5000);
  const [proposeBaseRateBps, setProposeBaseRateBps] = useState<number>(1800);
  const [proposeMarginBps, setProposeMarginBps] = useState<number>(300);
  const [submittingPropose, setSubmittingPropose] = useState<boolean>(false);

  // Modal State for Disbursement Readiness Check (Phase 4 Gated)
  const [readinessResult, setReadinessResult] = useState<any | null>(null);
  const [checkingReadiness, setCheckingReadiness] = useState<boolean>(false);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rawList = await gidfineAPI.listApplications();

      const normalized: AgencyReviewQueueItem[] = rawList.map((item: any) => ({
        applicationId: item.id || item.applicationId || String(item._id || ''),
        agencyId: item.agency_id || item.agencyId || '',
        borrowerId: item.borrower_id || item.borrowerId || '',
        borrowerName: item.borrower_name || item.borrowerName || (item.borrower_id ? `Borrower ${item.borrower_id.slice(0, 8)}` : 'Applicant'),
        requestedAmountPesewas: Number(item.requested_amount_pesewas ?? item.requestedAmountPesewas ?? 0),
        tenureMonths: Number(item.tenure_months ?? item.tenureMonths ?? 0),
        purpose: item.purpose || '',
        status: item.status || 'SUBMITTED',
        rejectionReason: item.rejection_reason ?? item.rejectionReason ?? null,
        notesCount: Number(item.notes_count ?? item.notesCount ?? 0),
        createdAt: typeof item.createdAt === 'number' ? item.createdAt : (item.created_at ? new Date(item.created_at).getTime() : (item.createdAt ?? Date.now())),
        activeProposalId: item.active_proposal_id || item.activeProposalId,
        proposedAmountPesewas: item.proposed_amount_pesewas ? Number(item.proposed_amount_pesewas) : undefined,
        lenderBaseRateBps: item.lender_base_rate_bps ? Number(item.lender_base_rate_bps) : undefined,
        agencyMarginBps: item.agency_margin_bps ? Number(item.agency_margin_bps) : undefined,
      }));

      const filtered = statusFilter
        ? normalized.filter((app) => app.status === statusFilter)
        : normalized;

      setApplications(filtered);
    } catch (err: any) {
      if (err.message && err.message.includes('401')) {
        setError('Authentication required. Please log in as an agency officer to view the review queue.');
      } else {
        setError(err.message || 'Failed to load agency review queue from Cloudflare API.');
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // Open Notes Drawer
  const handleOpenNotes = async (app: AgencyReviewQueueItem) => {
    setNotesModalApp(app);
    setLoadingNotes(true);
    setNewNoteText('');
    try {
      const notes = await gidfineAPI.getApplicationNotes(app.applicationId);
      setAppNotes(notes || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load internal review notes.');
    } finally {
      setLoadingNotes(false);
    }
  };

  // Submit Note
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notesModalApp || !newNoteText.trim()) return;

    setSubmittingNote(true);
    try {
      const note = await gidfineAPI.addApplicationNote(notesModalApp.applicationId, newNoteText.trim());
      setAppNotes((prev) => [...prev, note]);
      setNewNoteText('');
      fetchQueue();
    } catch (err: any) {
      setError(err.message || 'Failed to add internal note.');
    } finally {
      setSubmittingNote(false);
    }
  };

  // State Transition Handlers
  const handleTransition = async (applicationId: string, targetStatus: string, reason?: string, note?: string) => {
    setError(null);
    try {
      await gidfineAPI.transitionApplication(applicationId, targetStatus, reason, note);
      setActionNotice(`Application transitioned to ${targetStatus} successfully.`);
      fetchQueue();
    } catch (err: any) {
      setError(err.message || `Failed to transition application to ${targetStatus}.`);
    }
  };

  // Submit Rejection
  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectModalApp || !rejectReason.trim()) return;

    setSubmittingReject(true);
    try {
      await handleTransition(rejectModalApp.applicationId, 'AGENCY_REJECTED', rejectReason.trim());
      setRejectModalApp(null);
      setRejectReason('');
    } finally {
      setSubmittingReject(false);
    }
  };

  // Submit Request Info
  const handleInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!infoModalApp || !infoNoteText.trim()) return;

    setSubmittingInfo(true);
    try {
      await handleTransition(infoModalApp.applicationId, 'MORE_INFO_REQUIRED', undefined, infoNoteText.trim());
      setInfoModalApp(null);
      setInfoNoteText('');
    } finally {
      setSubmittingInfo(false);
    }
  };

  // Handle Propose Terms Submit (Gated: Phase 3 endpoint)
  const handleProposeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proposeModalApp || !proposeLenderId) return;

    setSubmittingPropose(true);
    setActionNotice(null);
    try {
      setActionNotice(
        `[Phase 3 Gated]: Lender matching and proposal endpoints (POST /proposals) are scheduled for Sprint 3. Requested GHS ${proposeAmountGhs} at ${bpsToPercentString(proposeBaseRateBps)} for ${proposeModalApp.applicationId} logged.`
      );
      setProposeModalApp(null);
    } finally {
      setSubmittingPropose(false);
    }
  };

  // Handle Check Disbursement Readiness (Gated: Phase 4)
  const handleCheckDisbursement = async (applicationId: string) => {
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
            <option value="CANCELLED">CANCELLED</option>
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
                  <th className="px-6 py-3.5 text-right">Review Actions</th>
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
                      {app.rejectionReason && (
                        <p className="text-xs text-red-600 mt-0.5 truncate" title={app.rejectionReason}>
                          Reason: {app.rejectionReason}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        app.status === 'UNDER_REVIEW'
                          ? 'bg-blue-100 text-blue-800'
                          : app.status === 'MATCHING'
                          ? 'bg-teal-100 text-teal-800'
                          : app.status === 'MORE_INFO_REQUIRED'
                          ? 'bg-amber-100 text-amber-800'
                          : app.status === 'AGENCY_REJECTED'
                          ? 'bg-red-100 text-red-800'
                          : app.status === 'AGENCY_APPROVED'
                          ? 'bg-purple-100 text-purple-800'
                          : app.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {app.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-1.5 whitespace-nowrap">
                      {/* Notes Button */}
                      <button
                        onClick={() => handleOpenNotes(app)}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-2.5 py-1.5 rounded text-xs transition-colors"
                      >
                        Notes ({app.notesCount ?? 0})
                      </button>

                      {/* SUBMITTED -> Begin Review */}
                      {app.status === 'SUBMITTED' && (
                        <button
                          onClick={() => handleTransition(app.applicationId, 'UNDER_REVIEW')}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-2.5 py-1.5 rounded text-xs transition-colors"
                        >
                          Begin Review
                        </button>
                      )}

                      {/* UNDER_REVIEW -> Actions */}
                      {app.status === 'UNDER_REVIEW' && (
                        <>
                          <button
                            onClick={() => setInfoModalApp(app)}
                            className="bg-amber-100 hover:bg-amber-200 text-amber-800 font-medium px-2.5 py-1.5 rounded text-xs transition-colors"
                          >
                            Request Info
                          </button>
                          <button
                            onClick={() => handleTransition(app.applicationId, 'MATCHING')}
                            className="bg-teal-600 hover:bg-teal-700 text-white font-medium px-2.5 py-1.5 rounded text-xs transition-colors"
                          >
                            Mark Matching
                          </button>
                          <button
                            onClick={() => setRejectModalApp(app)}
                            className="bg-red-50 hover:bg-red-100 text-red-700 font-medium px-2.5 py-1.5 rounded text-xs transition-colors"
                          >
                            Reject
                          </button>
                        </>
                      )}

                      {/* MORE_INFO_REQUIRED -> Resume Review */}
                      {app.status === 'MORE_INFO_REQUIRED' && (
                        <button
                          onClick={() => handleTransition(app.applicationId, 'UNDER_REVIEW')}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-2.5 py-1.5 rounded text-xs transition-colors"
                        >
                          Resume Review
                        </button>
                      )}

                      {/* Phase 3 Gated: Propose Terms */}
                      {app.status === 'MATCHING' && (
                        <button
                          onClick={() => {
                            setProposeModalApp(app);
                            setProposeAmountGhs(app.requestedAmountPesewas / 100);
                          }}
                          className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium px-2.5 py-1.5 rounded text-xs transition-colors"
                        >
                          Propose Terms (P3)
                        </button>
                      )}

                      {/* Phase 4 Gated: Check Readiness */}
                      {app.status === 'BORROWER_ACCEPTED' && (
                        <button
                          onClick={() => handleCheckDisbursement(app.applicationId)}
                          disabled={checkingReadiness}
                          className="bg-purple-50 hover:bg-purple-100 text-purple-700 font-medium px-2.5 py-1.5 rounded text-xs transition-colors"
                        >
                          Check Readiness (P4)
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

      {/* Internal Notes Drawer/Modal (Sprint 2) */}
      {notesModalApp && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-bold text-lg text-gray-900">Internal Review Notes</h3>
                <p className="text-xs text-gray-500 font-mono">APP-{notesModalApp.applicationId.slice(-6).toUpperCase()} — {notesModalApp.borrowerName}</p>
              </div>
              <button onClick={() => setNotesModalApp(null)} className="text-gray-400 hover:text-gray-600 font-bold">✕</button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2">
              {loadingNotes ? (
                <p className="text-xs text-gray-400 py-4 text-center">Loading notes...</p>
              ) : appNotes.length === 0 ? (
                <p className="text-xs text-gray-400 py-4 text-center">No internal review notes recorded yet.</p>
              ) : (
                appNotes.map((note) => (
                  <div key={note.id} className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-xs space-y-1">
                    <div className="flex justify-between text-gray-500 font-medium">
                      <span>{note.authorName} ({note.authorRole})</span>
                      <span>{new Date(note.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-gray-800 whitespace-pre-wrap">{note.noteText}</p>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleAddNote} className="space-y-3 pt-2 border-t">
              <label className="block text-xs font-semibold text-gray-700">Add Staff Note (Internal Only)</label>
              <textarea
                required
                rows={3}
                placeholder="Enter observations, borrower verification notes, or hold reasons..."
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                className="w-full border rounded-lg p-2.5 text-xs text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setNotesModalApp(null)}
                  className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={submittingNote || !newNoteText.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-1.5 rounded text-xs transition-colors disabled:opacity-50"
                >
                  {submittingNote ? 'Saving...' : 'Save Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rejection Modal with Mandatory Reason (Sprint 2) */}
      {rejectModalApp && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-lg text-red-600">Reject Loan Application</h3>
              <button onClick={() => setRejectModalApp(null)} className="text-gray-400 hover:text-gray-600 font-bold">✕</button>
            </div>
            <form onSubmit={handleRejectSubmit} className="space-y-3 text-xs">
              <p className="text-gray-600">
                A formal rejection reason is required by agency review policy and is recorded immutably in the audit trail.
              </p>
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Rejection Reason *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Ineligible income to debt ratio; requested loan tenure exceeds policy ceiling..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full border rounded-lg p-2.5 text-xs text-gray-800 focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectModalApp(null)}
                  className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReject || !rejectReason.trim()}
                  className="bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-1.5 rounded text-xs transition-colors disabled:opacity-50"
                >
                  {submittingReject ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Request Info Modal (Sprint 2) */}
      {infoModalApp && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-lg text-amber-700">Request Information from Applicant</h3>
              <button onClick={() => setInfoModalApp(null)} className="text-gray-400 hover:text-gray-600 font-bold">✕</button>
            </div>
            <form onSubmit={handleInfoSubmit} className="space-y-3 text-xs">
              <p className="text-gray-600">
                Specify what additional information or documents the applicant must supply to continue review.
              </p>
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Information Required *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Please provide recent 3-month payslip or valid Ghana Card number..."
                  value={infoNoteText}
                  onChange={(e) => setInfoNoteText(e.target.value)}
                  className="w-full border rounded-lg p-2.5 text-xs text-gray-800 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setInfoModalApp(null)}
                  className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingInfo || !infoNoteText.trim()}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-medium px-4 py-1.5 rounded text-xs transition-colors disabled:opacity-50"
                >
                  {submittingInfo ? 'Sending...' : 'Request Info'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Propose Terms Modal (Phase 3 Gated) */}
      {proposeModalApp && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-lg text-gray-900">Match & Propose Terms (Phase 3)</h3>
              <button onClick={() => setProposeModalApp(null)} className="text-gray-400 hover:text-gray-600 font-bold">✕</button>
            </div>
            <form onSubmit={handleProposeSubmit} className="space-y-4 text-sm">
              <div className="bg-amber-50 border border-amber-200 text-amber-900 p-2.5 rounded text-xs">
                ⚠️ Lender proposal issuance is gated behind Phase 3 owner approvals (O-03 to O-06, O-08).
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Designated Lender ID</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. usr_lender_123"
                  value={proposeLenderId}
                  onChange={(e) => setProposeLenderId(e.target.value)}
                  className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setProposeModalApp(null)} className="px-4 py-2 border rounded-lg text-sm text-gray-600">Cancel</button>
                <button type="submit" disabled={submittingPropose} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium">Log Proposal (P3)</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Disbursement Readiness Modal (Phase 4 Gated) */}
      {readinessResult && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-lg text-gray-900">Disbursement Readiness Audit</h3>
              <button onClick={() => setReadinessResult(null)} className="text-gray-400 hover:text-gray-600 font-bold">✕</button>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2 text-xs">
              <p className="font-semibold text-amber-900">Disbursement Cutover Quarantine (Phase 4)</p>
              <ul className="list-disc list-inside text-amber-800 space-y-1">
                {readinessResult.reasons.map((r: string, i: number) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
            <div className="flex justify-end">
              <button onClick={() => setReadinessResult(null)} className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgencyReviewQueue;
