import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  gidfineAPI,
  ghsToPesewas,
  pesewasToGhsString,
  bpsToPercentString,
} from '../../lib/api-gidfine';
import { Banknote, FileText, CheckCircle2, AlertCircle, RefreshCw, Clock, X } from 'lucide-react';
import { useTranslation } from '../../lib/useTranslation';

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

const APP_STATUS_STYLES: Record<string, string> = {
  AGENCY_APPROVED: 'bg-gray-50 text-gray-600 border-gray-200',
  BORROWER_ACCEPTED: 'bg-[#f0f9f7] text-[#0d3d38] border-[#b8dbd8]',
  PENDING_DISBURSEMENT: 'bg-[#f0f9f7] text-[#0d3d38] border-[#b8dbd8]',
  ACTIVE: 'bg-[#f0f9f7] text-[#0a2e2a] border-[#b8dbd8]',
  AGENCY_REJECTED: 'bg-red-50 text-red-700 border-red-200',
  SUBMITTED: 'bg-gray-100 text-gray-600 border-gray-200',
  UNDER_REVIEW: 'bg-amber-50 text-amber-700 border-amber-200',
};

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

const inputBase =
  'w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-900/10 disabled:opacity-50';

export const BorrowerLoanManager: React.FC = () => {
  const { tx, language } = useTranslation();
  const [activeTab, setActiveTab] = useState<'apply' | 'tracking'>('apply');

  const [amountGhs, setAmountGhs] = useState<number>(5000);
  const [tenureMonths, setTenureMonths] = useState<number>(12);
  const [purpose, setPurpose] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedAppId, setSubmittedAppId] = useState<string | null>(null);
  const submissionKeyRef = useRef<string | null>(null);

  const [applications, setApplications] = useState<BorrowerApplicationItem[]>([]);
  const [loadingTracking, setLoadingTracking] = useState<boolean>(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);

  const [consentApp, setConsentApp] = useState<BorrowerApplicationItem | null>(null);
  const [affirmed, setAffirmed] = useState<boolean>(false);
  const [recordingConsent, setRecordingConsent] = useState<boolean>(false);
  const [consentSuccess, setConsentSuccess] = useState<string | null>(null);

  const fetchApplications = useCallback(async () => {
    if (!gidfineAPI.isAuthenticated()) {
      setTrackingError('Please log in to track your submitted loan applications.');
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

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmittedAppId(null);

    if (!gidfineAPI.isAuthenticated()) {
      setSubmitError('Authentication required. Please sign in before submitting an application.');
      return;
    }
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
      submissionKeyRef.current = null;
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to submit application.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecordConsent = async () => {
    if (!consentApp || !consentApp.activeProposal || !affirmed) return;
    setRecordingConsent(true);
    setSubmitError(null);
    try {
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
    <div className="dashboard-card rounded-xl border w-full max-w-3xl mx-auto relative">
      {/* Tab switcher */}
      <div className="flex border-b border-gray-200 px-2 pt-2 gap-1">
        {([
          { key: 'apply', icon: Banknote, label: tx('New Loan Request') },
          { key: 'tracking', icon: FileText, label: tx('My Applications Tracking') },
        ] as const).map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setActiveTab(key);
              if (key === 'apply') setSubmittedAppId(null);
            }}
            className={`flex items-center gap-2 px-4 pb-3 pt-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === key
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="h-4 w-4" strokeWidth={1.75} />
            {label}
          </button>
        ))}
      </div>

      <div className="p-6">
        {/* ── Tab 1: Apply ── */}
        {activeTab === 'apply' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold dashboard-heading tracking-tight">
                {tx('Submit Loan Application')}
              </h3>
              <p className="text-xs dashboard-copy mt-1">
                {tx('Your request will be submitted to the agency for review and eligible lender matching.')}
              </p>
            </div>

            {submitError && (
              <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-600" />
                <div>
                  <p className="font-semibold text-amber-700">{tx('Notice')}</p>
                  <p className="mt-0.5 text-amber-600">{submitError}</p>
                </div>
              </div>
            )}

            {submittedAppId && (
              <div className="rounded-lg border border-[#b8dbd8] bg-[#f0f9f7] p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#0d3d38]">
                  <CheckCircle2 className="h-4 w-4" strokeWidth={1.75} />
                  {tx('Application Submitted Successfully')}
                </div>
                <p className="text-xs text-[#0d3d38]">
                  {tx('Application Ref:')}{' '}
                  <span className="font-semibold text-gray-800">APP-{submittedAppId.slice(-6).toUpperCase()}</span>.{' '}
                  {tx('Your request is in status')}{' '}
                  <span className="font-semibold">{tx('Submitted').toUpperCase()}</span>{' '}
                  {tx('and is pending agency review.')}
                </p>
                <button
                  onClick={() => setActiveTab('tracking')}
                  className="rounded-lg bg-gray-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-gray-800 transition-colors"
                >
                  {tx('View in My Applications →')}
                </button>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-5">
              {/* Amount */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-600">
                    {tx('Requested Principal (GHS)')}
                  </label>
                  <span className="text-lg font-semibold dashboard-heading tabular-nums">
                    GH₵ {amountGhs.toLocaleString()}
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
                  className={inputBase}
                  placeholder="e.g. 5000"
                />
                <span className="text-[11px] dashboard-copy mt-1 block">
                  {tx('Stored in backend strictly as minor units')} ({amountGhs * 100} pesewas).
                </span>
              </div>

              {/* Tenure */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-600">
                    {tx('Tenure (Months)')}
                  </label>
                  <span className="text-sm font-semibold dashboard-heading tabular-nums">
                    {tenureMonths} {tx('months')}
                  </span>
                </div>
                <select
                  value={tenureMonths}
                  onChange={(e) => {
                    setTenureMonths(Number(e.target.value));
                    submissionKeyRef.current = null;
                  }}
                  className={inputBase}
                >
                  <option value={3}>3 {tx('months')}</option>
                  <option value={6}>6 {tx('months')}</option>
                  <option value={12}>12 {tx('months')} (1 {tx('year')})</option>
                  <option value={18}>18 {tx('months')}</option>
                  <option value={24}>24 {tx('months')} (2 {tx('years')})</option>
                  <option value={36}>36 {tx('months')} (3 {tx('years')})</option>
                </select>
              </div>

              {/* Purpose */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">
                  {tx('Intended Loan Purpose')}
                </label>
                <textarea
                  required
                  rows={3}
                  value={purpose}
                  onChange={(e) => {
                    setPurpose(e.target.value);
                    submissionKeyRef.current = null;
                  }}
                  placeholder={tx('e.g. Working capital for retail inventory expansion...')}
                  className={`${inputBase} resize-none`}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-gray-900 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? (
                  <><RefreshCw className="h-4 w-4 animate-spin" /> {tx('Submitting application...')}</>
                ) : (
                  tx('Submit Loan Request')
                )}
              </button>
            </form>
          </div>
        )}

        {/* ── Tab 2: Tracking ── */}
        {activeTab === 'tracking' && (
          <div className="space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold dashboard-heading tracking-tight">
                  {tx('My Loan Applications')}
                </h3>
                <p className="text-xs dashboard-copy mt-1">
                  {tx('Real-time lifecycle tracking across agency review, lender matching, and consent.')}
                </p>
              </div>
              <button
                type="button"
                onClick={fetchApplications}
                disabled={loadingTracking}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 text-gray-500 ${loadingTracking ? 'animate-spin' : ''}`} />
                {tx('Refresh')}
              </button>
            </div>

            {consentSuccess && (
              <div className="flex items-center justify-between rounded-lg border border-[#b8dbd8] bg-[#f0f9f7] px-3.5 py-3 text-xs text-[#0d3d38]">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" strokeWidth={1.75} />
                  {consentSuccess}
                </div>
                <button onClick={() => setConsentSuccess(null)} className="text-[#0d3d38] hover:text-[#0a2e2a]">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {trackingError && (
              <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-600" />
                <div>
                  <p className="font-semibold text-amber-700">{tx('Notice')}</p>
                  <p className="mt-0.5 text-amber-600">{trackingError}</p>
                </div>
              </div>
            )}

            {loadingTracking ? (
              <div className="p-12 text-center">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 dashboard-label" />
                <p className="text-xs dashboard-copy">{tx('Loading application records...')}</p>
              </div>
            ) : applications.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 p-12 text-center">
                <Clock className="h-8 w-8 mx-auto mb-2 dashboard-label" strokeWidth={1.5} />
                <p className="text-sm font-medium dashboard-heading">{tx('No loan requests submitted yet')}</p>
                <p className="text-xs dashboard-copy mt-1">
                  {tx('Switch to the "New Loan Request" tab to submit your first application.')}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {applications.map((app) => {
                  const badge =
                    APP_STATUS_STYLES[app.status] ?? 'bg-gray-100 text-gray-500 border-gray-200';
                  const locale =
                    language === 'fr' ? 'fr-GH' : language === 'tw' ? 'ak-GH' : 'en-GH';

                  return (
                    <div
                      key={app.applicationId}
                      className="rounded-xl border border-gray-200 bg-white p-4 space-y-3 hover:border-gray-300 transition-all"
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div>
                          <span className="text-xs font-semibold text-gray-500 tabular-nums">
                            APP-{app.applicationId.slice(-6).toUpperCase()}
                          </span>
                          <h4 className="text-sm font-semibold dashboard-heading mt-0.5">
                            {pesewasToGhsString(app.requestedAmountPesewas)} &bull; {app.tenureMonths} Months
                          </h4>
                          <p className="text-xs dashboard-copy mt-0.5 max-w-md truncate">
                            Purpose: {app.purpose}
                          </p>
                        </div>
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${badge}`}
                        >
                          {tx(statusLabel(app.status))}
                        </span>
                      </div>

                      {/* Consent action box */}
                      {app.status === 'AGENCY_APPROVED' && app.activeProposal && (
                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                              <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
                              {tx('Agency Approved Offer Ready for Consent')}
                            </p>
                            <p className="text-[11px] text-gray-500 mt-0.5">
                              Approved Amount: {pesewasToGhsString(app.activeProposal.proposedAmountPesewas)}{' '}
                              | Rate: {bpsToPercentString(app.activeProposal.borrowerRateBps)} p.a.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setConsentApp(app);
                              setAffirmed(false);
                            }}
                            className="rounded-lg bg-gray-900 px-4 py-2 text-xs font-medium text-white hover:bg-gray-800 transition-colors whitespace-nowrap"
                          >
                            {tx('Review & Affirm Consent')}
                          </button>
                        </div>
                      )}

                      <div className="flex justify-between border-t border-gray-100 pt-2 text-[10px] text-gray-400">
                        <span>{tx('Submitted:')} {new Date(app.createdAt).toLocaleDateString(locale)}</span>
                        <span>{tx('Updated:')} {new Date(app.updatedAt).toLocaleTimeString(locale)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Affirmative Consent Modal */}
      {consentApp && consentApp.activeProposal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setConsentApp(null); }}
        >
          <div
            className="relative max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-gray-200 pb-4 mb-4">
              <h3 className="text-base font-semibold dashboard-heading">
                {tx('Affirmative Loan Agreement & Consent')}
              </h3>
              <button
                type="button"
                onClick={() => setConsentApp(null)}
                className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Loan summary */}
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-1.5">
                {[
                  { label: `${tx('Application')}:`, value: `APP-${consentApp.applicationId.slice(-6).toUpperCase()}`, className: 'dashboard-heading font-semibold' },
                  { label: `${tx('Principal Amount:')}`, value: pesewasToGhsString(consentApp.activeProposal.proposedAmountPesewas), className: 'text-[#0d3d38] font-semibold' },
                  { label: `${tx('Agreed Rate:')}`, value: `${bpsToPercentString(consentApp.activeProposal.borrowerRateBps)} p.a.`, className: 'dashboard-heading font-semibold' },
                  { label: `${tx('Tenure')}:`, value: `${consentApp.tenureMonths} ${tx('months')}`, className: 'dashboard-heading font-semibold' },
                ].map(({ label, value, className }) => (
                  <div key={label} className="flex justify-between">
                    <span className="dashboard-copy">{label}</span>
                    <span className={className}>{value}</span>
                  </div>
                ))}
              </div>

              <p className="text-[11px] dashboard-copy leading-relaxed">
                {tx('By ticking the affirmation box below, you provide explicit statutory agreement under the Ghana Data Protection Act, 2012 (Act 843) to the above loan terms. An immutable, tamper-evident cryptographic SHA-256 snapshot will be recorded.')}
              </p>

              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-[#b8dbd8] bg-[#f0f9f7] p-3">
                <input
                  type="checkbox"
                  checked={affirmed}
                  onChange={(e) => setAffirmed(e.target.checked)}
                  className="mt-0.5 rounded accent-gray-900"
                />
                <span className="text-xs dashboard-heading font-medium select-none">
                  {tx('I affirmatively accept the proposed loan terms, interest rate, and duration.')}
                </span>
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setConsentApp(null)}
                className="px-4 py-2 text-xs font-medium dashboard-copy hover:dashboard-heading transition-colors"
              >
                {tx('Cancel')}
              </button>
              <button
                type="button"
                disabled={!affirmed || recordingConsent}
                onClick={handleRecordConsent}
                className="rounded-lg bg-gray-900 px-5 py-2 text-xs font-medium text-white hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {recordingConsent ? tx('Recording Snapshot...') : tx('Confirm & Sign Agreement')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BorrowerLoanManager;
