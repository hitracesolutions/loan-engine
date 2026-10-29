import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  gidfineAPI,
  ghsToPesewas,
  pesewasToGhsString,
  bpsToPercentString,
} from '../../lib/api-gidfine';
import { Banknote, FileText, CheckCircle2, AlertCircle, RefreshCw, Clock } from 'lucide-react';

export interface BorrowerApplicationItem {
  applicationId: string;
  requestedAmountPesewas: number;
  tenureMonths: number;
  purpose: string;
  status: string;
  createdAt: number;
  updatedAt: number;
  activeProposal?: {
    proposalId: string;
    version: number;
    proposedAmountPesewas: number;
    borrowerRateBps: number;
    status: string;
  } | null;
}

export const BorrowerLoanManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'apply' | 'tracking'>('apply');

  // Application Form State
  const [amountGhs, setAmountGhs] = useState<number>(5000);
  const [tenureMonths, setTenureMonths] = useState<number>(12);
  const [purpose, setPurpose] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedAppId, setSubmittedAppId] = useState<string | null>(null);
  const submissionKeyRef = useRef<string | null>(null);

  // Tracking State
  const [applications, setApplications] = useState<BorrowerApplicationItem[]>([]);
  const [loadingTracking, setLoadingTracking] = useState<boolean>(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);

  // Consent Modal State
  const [consentApp, setConsentApp] = useState<BorrowerApplicationItem | null>(null);
  const [affirmed, setAffirmed] = useState<boolean>(false);
  const [recordingConsent, setRecordingConsent] = useState<boolean>(false);
  const [consentSuccess, setConsentSuccess] = useState<string | null>(null);

  const fetchApplications = useCallback(async () => {
    if (!gidfineAPI.isAuthenticated()) {
      setTrackingError("Please log in to track your submitted loan applications.");
      setApplications([]);
      return;
    }

    setLoadingTracking(true);
    setTrackingError(null);
    try {
      const items = await gidfineAPI.listApplications();
      const mapped: BorrowerApplicationItem[] = (items || []).map((item: any) => ({
        applicationId: item.id || item.applicationId || '',
        requestedAmountPesewas: item.requestedAmountPesewas ?? item.amount_requested_pesewas ?? 0,
        tenureMonths: item.tenureMonths ?? item.tenure_months ?? 0,
        purpose: item.purpose || '',
        status: item.status || 'SUBMITTED',
        createdAt: item.createdAt ?? item.created_at ?? Date.now(),
        updatedAt: item.updatedAt ?? item.updated_at ?? Date.now(),
        activeProposal: item.activeProposal || null,
      }));
      setApplications(mapped);
    } catch (err: any) {
      setTrackingError(err.message || 'Failed to retrieve applications.');
    } finally {
      setLoadingTracking(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'tracking') {
      fetchApplications();
    }
  }, [activeTab, fetchApplications]);

  // Form Submit Handler
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmittedAppId(null);

    // Authentication check
    if (!gidfineAPI.isAuthenticated()) {
      setSubmitError('Authentication required. Please sign in before submitting an application.');
      return;
    }

    // Frontend validation
    if (amountGhs <= 0) {
      setSubmitError('Requested principal must be greater than zero GHS.');
      return;
    }
    if (tenureMonths <= 0 || !Number.isInteger(tenureMonths)) {
      setSubmitError('Tenure must be a positive integer number of months.');
      return;
    }
    if (!purpose.trim()) {
      setSubmitError('Please state the intended purpose of the loan.');
      return;
    }

    // Generate new idempotency key if one is not active for this submission
    if (!submissionKeyRef.current) {
      submissionKeyRef.current = crypto.randomUUID();
    }

    setSubmitting(true);
    try {
      const res = await gidfineAPI.createApplication(
        {
          requestedAmountPesewas: ghsToPesewas(amountGhs),
          tenureMonths,
          purpose: purpose.trim(),
        },
        submissionKeyRef.current,
      );
      setSubmittedAppId(res.id);
      setPurpose('');
      submissionKeyRef.current = null; // Reset key upon confirmed creation
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to submit application.');
    } finally {
      setSubmitting(false);
    }
  };

  // Consent Acceptance Handler
  const handleRecordConsent = async () => {
    if (!consentApp || !consentApp.activeProposal || !affirmed) return;

    setRecordingConsent(true);
    setSubmitError(null);
    try {
      // Phase 4 consent workflow is gated pending owner approval per IMPLEMENTATION_PLAN.md
      throw new Error(
        'Statutory consent recording is pending Phase 4 owner approval. Origination is currently in Phase 1/2.'
      );
    } catch (err: any) {
      setTrackingError(err.message || 'Failed to record consent.');
    } finally {
      setRecordingConsent(false);
    }
  };

  return (
    <div className="bg-[#111] border border-white/10 rounded-2xl p-6 w-full max-w-3xl mx-auto shadow-2xl relative overflow-hidden">
      {/* Tab Switcher */}
      <div className="flex border-b border-white/10 mb-6 gap-2">
        <button
          onClick={() => {
            setActiveTab('apply');
            setSubmittedAppId(null);
          }}
          className={`pb-3 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'apply'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-white/50 hover:text-white/80'
          }`}
        >
          <Banknote className="w-4 h-4" /> New Loan Request
        </button>
        <button
          onClick={() => setActiveTab('tracking')}
          className={`pb-3 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'tracking'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-white/50 hover:text-white/80'
          }`}
        >
          <FileText className="w-4 h-4" /> My Applications Tracking
        </button>
      </div>

      {/* Tab 1: Submit Application Form */}
      {activeTab === 'apply' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-bold text-white tracking-tight">
              Submit Loan Application
            </h3>
            <p className="text-xs text-white/50 mt-1">
              Your request will be submitted to the agency for review and eligible lender matching.
            </p>
          </div>

          {submitError && (
            <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-xl text-amber-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Notice</p>
                <p className="mt-0.5 text-amber-200/90">{submitError}</p>
              </div>
            </div>
          )}

          {submittedAppId && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 p-5 rounded-xl text-emerald-300 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm text-emerald-400">
                <CheckCircle2 className="w-5 h-5" /> Application Submitted Successfully
              </div>
              <p className="text-xs text-emerald-200/80">
                Application Ref: <span className="font-mono font-semibold">APP-{submittedAppId.slice(-6).toUpperCase()}</span>.
                Your request is in status <span className="font-semibold">SUBMITTED</span> and is pending agency review.
              </p>
              <div className="pt-2">
                <button
                  onClick={() => setActiveTab('tracking')}
                  className="bg-emerald-600 hover:bg-emerald-500 text-black font-semibold text-xs px-4 py-2 rounded-lg transition-colors"
                >
                  View in My Applications &rarr;
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleFormSubmit} className="space-y-5">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                  Requested Principal (GHS)
                </label>
                <span className="text-lg font-bold text-emerald-400 font-mono">
                  GHS {amountGhs.toLocaleString()}
                </span>
              </div>
              <input
                type="number"
                min="100"
                max="500000"
                step="50"
                required
                value={amountGhs}
                onChange={(e) => {
                  setAmountGhs(Number(e.target.value));
                  submissionKeyRef.current = null;
                }}
                className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                placeholder="e.g. 5000"
              />
              <span className="text-[11px] text-white/40 mt-1 block">
                Stored in backend strictly as minor units ({amountGhs * 100} pesewas).
              </span>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                  Tenure (Months)
                </label>
                <span className="text-sm font-bold text-white font-mono">
                  {tenureMonths} Months
                </span>
              </div>
              <select
                value={tenureMonths}
                onChange={(e) => {
                  setTenureMonths(Number(e.target.value));
                  submissionKeyRef.current = null;
                }}
                className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors"
              >
                <option value={3}>3 Months</option>
                <option value={6}>6 Months</option>
                <option value={12}>12 Months (1 Year)</option>
                <option value={18}>18 Months</option>
                <option value={24}>24 Months (2 Years)</option>
                <option value={36}>36 Months (3 Years)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-white/60 mb-2">
                Intended Loan Purpose
              </label>
              <textarea
                required
                rows={3}
                value={purpose}
                onChange={(e) => {
                  setPurpose(e.target.value);
                  submissionKeyRef.current = null;
                }}
                placeholder="e.g. Working capital for retail inventory expansion..."
                className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3.5 rounded-xl text-sm transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Submitting Application to Cloudflare API...
                </>
              ) : (
                'Submit Loan Request'
              )}
            </button>
          </form>
        </div>
      )}

      {/* Tab 2: Borrower Applications Tracking */}
      {activeTab === 'tracking' && (
        <div className="space-y-5">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold text-white tracking-tight">
                My Loan Applications
              </h3>
              <p className="text-xs text-white/50 mt-1">
                Real-time lifecycle tracking across agency review, lender matching, and consent.
              </p>
            </div>
            <button
              onClick={fetchApplications}
              disabled={loadingTracking}
              className="text-white/60 hover:text-white text-xs bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingTracking ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>

          {consentSuccess && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 p-3.5 rounded-xl text-emerald-300 text-xs flex items-center justify-between">
              <span>✓ {consentSuccess}</span>
              <button onClick={() => setConsentSuccess(null)} className="font-bold">✕</button>
            </div>
          )}

          {trackingError && (
            <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-xl text-amber-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Notice</p>
                <p className="mt-0.5 text-amber-200/90">{trackingError}</p>
              </div>
            </div>
          )}

          {loadingTracking ? (
            <div className="p-12 text-center text-white/40">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
              <p className="text-xs">Loading application records...</p>
            </div>
          ) : applications.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-white/10 rounded-xl text-white/40">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-semibold text-white/70">No loan requests submitted yet</p>
              <p className="text-xs text-white/40 mt-1">
                Switch to the "New Loan Request" tab to submit your first application.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {applications.map((app) => (
                <div
                  key={app.applicationId}
                  className="bg-[#181818] border border-white/10 rounded-xl p-4.5 space-y-3 hover:border-white/20 transition-all"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-mono text-xs text-emerald-400 font-semibold">
                        APP-{app.applicationId.slice(-6).toUpperCase()}
                      </span>
                      <h4 className="text-sm font-bold text-white mt-0.5">
                        {pesewasToGhsString(app.requestedAmountPesewas)} &bull; {app.tenureMonths} Months
                      </h4>
                      <p className="text-xs text-white/50 mt-0.5 max-w-md truncate">
                        Purpose: {app.purpose}
                      </p>
                    </div>

                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                      app.status === 'AGENCY_APPROVED'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : app.status === 'BORROWER_ACCEPTED'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : app.status === 'PENDING_DISBURSEMENT'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                        : app.status === 'ACTIVE'
                        ? 'bg-emerald-500 text-black font-bold'
                        : 'bg-white/10 text-white/70'
                    }`}>
                      {app.status}
                    </span>
                  </div>

                  {/* Proposal & Consent Action Box */}
                  {app.status === 'AGENCY_APPROVED' && app.activeProposal && (
                    <div className="bg-purple-950/20 border border-purple-500/30 rounded-lg p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-purple-300 flex items-center gap-1.5">
                          ✓ Agency Approved Offer Ready for Consent
                        </p>
                        <p className="text-[11px] text-purple-200/70 mt-0.5">
                          Approved Amount: {pesewasToGhsString(app.activeProposal.proposedAmountPesewas)} | Rate: {bpsToPercentString(app.activeProposal.borrowerRateBps)} p.a.
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setConsentApp(app);
                          setAffirmed(false);
                        }}
                        className="bg-purple-500 hover:bg-purple-400 text-black font-bold text-xs px-4 py-2 rounded-lg transition-colors"
                      >
                        Review & Affirm Consent
                      </button>
                    </div>
                  )}

                  <div className="text-[10px] text-white/30 border-t border-white/5 pt-2 flex justify-between">
                    <span>Submitted: {new Date(app.createdAt).toLocaleDateString()}</span>
                    <span>Updated: {new Date(app.updatedAt).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Affirmative Consent Modal */}
      {consentApp && consentApp.activeProposal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#181818] border border-white/20 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 className="font-bold text-lg text-white">
                Affirmative Loan Agreement & Consent
              </h3>
              <button
                onClick={() => setConsentApp(null)}
                className="text-white/40 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-white/80">
              <div className="bg-white/5 p-3 rounded-lg border border-white/10 space-y-1.5 font-mono">
                <div className="flex justify-between">
                  <span className="text-white/50">Application:</span>
                  <span className="text-white font-bold">APP-{consentApp.applicationId.slice(-6).toUpperCase()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">Principal Amount:</span>
                  <span className="text-emerald-400 font-bold">{pesewasToGhsString(consentApp.activeProposal.proposedAmountPesewas)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">Agreed Rate:</span>
                  <span className="text-white font-bold">{bpsToPercentString(consentApp.activeProposal.borrowerRateBps)} p.a.</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">Tenure:</span>
                  <span className="text-white font-bold">{consentApp.tenureMonths} Months</span>
                </div>
              </div>

              <p className="text-[11px] text-white/60 leading-relaxed">
                By ticking the affirmation box below, you provide explicit statutory agreement under the Ghana Data Protection Act, 2012 (Act 843) to the above loan terms. An immutable, tamper-evident cryptographic SHA-256 snapshot will be recorded.
              </p>

              <label className="flex items-start gap-2.5 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 cursor-pointer">
                <input
                  type="checkbox"
                  checked={affirmed}
                  onChange={(e) => setAffirmed(e.target.checked)}
                  className="mt-0.5 rounded accent-emerald-500"
                />
                <span className="text-xs text-white font-medium select-none">
                  I affirmatively accept the proposed loan terms, interest rate, and duration.
                </span>
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setConsentApp(null)}
                className="px-4 py-2 text-white/60 hover:text-white text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!affirmed || recordingConsent}
                onClick={handleRecordConsent}
                className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-5 py-2 rounded-lg text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {recordingConsent ? 'Recording Snapshot...' : 'Confirm & Sign Agreement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BorrowerLoanManager;
