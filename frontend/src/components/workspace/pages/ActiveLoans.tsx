import { useEffect, useState, useCallback } from 'react';
import { CreditCard, ChevronDown, RefreshCw } from 'lucide-react';
import { gidfineAPI, pesewasToGhsString, bpsToPercentString } from '../../../lib/api-gidfine';
import { useTranslation } from '../../../lib/useTranslation';

function Shimmer({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-gray-200 ${className ?? ''}`} />;
}

function ActiveLoansSkeleton() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* header */}
      <div className="flex justify-between items-end">
        <div className="space-y-2">
          <Shimmer className="h-7 w-48" />
          <Shimmer className="h-4 w-72" />
        </div>
        <Shimmer className="h-8 w-20" />
      </div>
      {/* loan cards */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="dashboard-card rounded-xl border p-5 space-y-4" style={{ borderColor: 'var(--dash-border)' }}>
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <Shimmer className="h-4 w-32" />
              <Shimmer className="h-3 w-20" />
            </div>
            <Shimmer className="h-6 w-20 rounded-full" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Shimmer className="h-10" />
            <Shimmer className="h-10" />
            <Shimmer className="h-10" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface LoanRow {
  id: string;
  status: string;
  principal_pesewas: number;
  nominal_annual_rate_bps: number;
  tenure_months: number;
  monthly_repayment_pesewas: number;
  outstanding_principal_pesewas: number;
  outstanding_interest_pesewas: number;
  outstanding_fees_pesewas: number;
  disbursed_at: number | null;
  lender_name?: string | null;
  borrower_name?: string | null;
}

interface Installment {
  installment_number: number;
  due_date: number;
  total_due_pesewas: number;
  principal_due_pesewas: number;
  interest_due_pesewas: number;
  fees_due_pesewas: number;
  status: string;
}

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-[#edfade] text-[#2d7a1f] border-[#a8f07a]',
  PAID_OFF: 'bg-gray-100 text-gray-600 border-gray-200',
  CLOSED: 'bg-gray-100 text-gray-500 border-gray-200',
  DELINQUENT: 'bg-amber-50 text-amber-700 border-amber-200',
};

const INST_STATUS_STYLES: Record<string, string> = {
  PAID: 'bg-[#edfade] text-[#2d7a1f] border-[#a8f07a]',
  PENDING: 'bg-gray-100 text-gray-500 border-gray-200',
  OVERDUE: 'bg-red-50 text-red-600 border-red-200',
};

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(ms: number | null | undefined, language: 'en' | 'fr' | 'tw'): string {
  if (!ms) return '—';
  const d = new Date(Number(ms));
  if (Number.isNaN(d.getTime())) return '—';
  const locale = language === 'fr' ? 'fr-GH' : language === 'tw' ? 'ak-GH' : 'en-GH';
  return d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ActiveLoans() {
  const { t, tx, language } = useTranslation();
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<Record<string, Installment[]>>({});
  const [scheduleError, setScheduleError] = useState<Record<string, string>>({});
  const [loadingSchedule, setLoadingSchedule] = useState<string | null>(null);

  const loadLoans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = (await gidfineAPI.listLoans()) as LoanRow[];
      setLoans(Array.isArray(rows) ? rows : []);
    } catch {
      setError('We could not load your loans right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLoans();
  }, [loadLoans]);

  const toggleLoan = async (loanId: string) => {
    if (expandedId === loanId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(loanId);
    if (!schedules[loanId]) {
      setLoadingSchedule(loanId);
      setScheduleError((prev) => ({ ...prev, [loanId]: '' }));
      try {
        const installments = (await gidfineAPI.getRepaymentSchedule(loanId)) as Installment[];
        setSchedules((prev) => ({ ...prev, [loanId]: Array.isArray(installments) ? installments : [] }));
      } catch {
        setScheduleError((prev) => ({ ...prev, [loanId]: 'Could not load the repayment schedule.' }));
      } finally {
        setLoadingSchedule(null);
      }
    }
  };

  const outstandingTotal = (loan: LoanRow) =>
    (loan.outstanding_principal_pesewas ?? 0) +
    (loan.outstanding_interest_pesewas ?? 0) +
    (loan.outstanding_fees_pesewas ?? 0);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Page header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="dashboard-heading text-2xl font-semibold tracking-tight">{t('loansLedgerTitle')}</h1>
          <p className="dashboard-copy text-sm mt-1">{t('loansLedgerIntro')}</p>
        </div>
        <button
          type="button"
          onClick={() => void loadLoans()}
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          <RefreshCw className="h-3.5 w-3.5 text-gray-500" />
          {t('refresh')}
        </button>
      </div>

      {/* Loading */}
      {loading && <ActiveLoansSkeleton />}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-red-700 text-sm">{error}</p>
          <button
            type="button"
            onClick={() => void loadLoans()}
            className="mt-4 rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            {t('tryAgain')}
          </button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && loans.length === 0 && (
        <div className="dashboard-card rounded-xl border p-12 text-center">
          <CreditCard className="h-10 w-10 dashboard-label mx-auto mb-3" strokeWidth={1.5} />
          <p className="dashboard-heading font-medium">{t('noActiveLoans')}</p>
          <p className="dashboard-copy text-sm mt-1">{t('loanDisbursedHint')}</p>
        </div>
      )}

      {/* Loan cards */}
      {!loading && !error && loans.map((loan) => {
        const isOpen = expandedId === loan.id;
        const badge = STATUS_STYLES[loan.status] ?? 'bg-gray-100 text-gray-500 border-gray-200';

        return (
          <div key={loan.id} className="dashboard-card rounded-xl border overflow-hidden">
            <button
              type="button"
              onClick={() => void toggleLoan(loan.id)}
              aria-expanded={isOpen}
              className="w-full text-left p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50/50 transition-colors"
            >
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${badge}`}
                  >
                    {tx(statusLabel(loan.status))}
                  </span>
                  {loan.lender_name && (
                    <span className="text-xs dashboard-copy">{loan.lender_name}</span>
                  )}
                </div>
                <h2 className="text-2xl font-semibold dashboard-heading tracking-tight mt-2 tabular-nums">
                  {pesewasToGhsString(loan.principal_pesewas)}
                </h2>
                <p className="text-xs dashboard-copy mt-1">
                  {bpsToPercentString(loan.nominal_annual_rate_bps)} p.a.
                  {' · '}{loan.tenure_months} {t('months')}
                  {' · '}{t('disbursed')} {formatDate(loan.disbursed_at, language)}
                </p>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-[10px] dashboard-label uppercase tracking-widest font-semibold">{t('outstanding')}</p>
                  <p className="text-lg font-semibold dashboard-heading tabular-nums">{pesewasToGhsString(outstandingTotal(loan))}</p>
                </div>
                <ChevronDown
                  className={`h-5 w-5 dashboard-label transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  strokeWidth={1.75}
                />
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-gray-200 p-6 bg-gray-50/60">
                {/* Breakdown sub-cards */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                  {[
                    { label: t('principal'), value: loan.outstanding_principal_pesewas ?? 0 },
                    { label: t('interest'), value: loan.outstanding_interest_pesewas ?? 0 },
                    { label: t('fees'), value: loan.outstanding_fees_pesewas ?? 0 },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-lg border border-gray-200 bg-white p-3">
                      <p className="text-[10px] dashboard-label uppercase tracking-widest font-semibold">{label}</p>
                      <p className="text-sm font-semibold dashboard-heading mt-1 tabular-nums">{pesewasToGhsString(value)}</p>
                    </div>
                  ))}
                </div>

                {/* Repayment schedule */}
                <h3 className="text-sm font-medium dashboard-heading mb-3">{t('repaymentSchedule')}</h3>

                {loadingSchedule === loan.id && (
                  <p className="dashboard-copy text-xs">{t('loadingSchedule')}</p>
                )}
                {scheduleError[loan.id] && (
                  <p className="text-red-600 text-xs">{scheduleError[loan.id]}</p>
                )}
                {!loadingSchedule && !scheduleError[loan.id] && (schedules[loan.id]?.length ?? 0) === 0 && (
                  <p className="dashboard-copy text-xs">{t('noSchedule')}</p>
                )}

                {(schedules[loan.id]?.length ?? 0) > 0 && (
                  <div className="space-y-2">
                    {schedules[loan.id].map((inst) => {
                      const instBadge =
                        INST_STATUS_STYLES[inst.status] ?? 'bg-gray-100 text-gray-500 border-gray-200';
                      return (
                        <div
                          key={inst.installment_number}
                          className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 text-xs"
                        >
                          <div className="flex items-center gap-3">
                            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gray-100 text-xs font-semibold text-gray-700">
                              {inst.installment_number}
                            </span>
                            <span className="dashboard-copy">
                              {t('due')} {formatDate(inst.due_date, language)}
                            </span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="font-semibold dashboard-heading tabular-nums">
                              {pesewasToGhsString(inst.total_due_pesewas)}
                            </span>
                            <span
                              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${instBadge}`}
                            >
                              {tx(statusLabel(inst.status || 'PENDING'))}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
