import { useEffect, useState, useCallback } from 'react';
import { CreditCard, ChevronDown, RefreshCw } from 'lucide-react';
import { gidfineAPI, pesewasToGhsString, bpsToPercentString } from '../../../lib/api-gidfine';
import { useTranslation } from '../../../lib/useTranslation';

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
  ACTIVE: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  PAID_OFF: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20',
  CLOSED: 'text-white/50 bg-white/5 border-white/10',
  DELINQUENT: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
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
  const { t, language } = useTranslation();
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
    <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-fade-in">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-display font-medium text-white tracking-tight">{t('loansLedgerTitle')}</h1>
          <p className="text-white/60 text-sm mt-1">{t('loansLedgerIntro')}</p>
        </div>
        <button
          type="button"
          onClick={() => void loadLoans()}
          className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-medium border border-white/10 transition-all flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4 text-emerald-400" /> {t('refresh')}
        </button>
      </div>

      {loading && (
        <div className="bg-[#111] border border-white/10 rounded-2xl p-10 text-center text-white/50 text-sm">
          {t('loadingLoans')}
        </div>
      )}

      {!loading && error && (
        <div className="bg-[#111] border border-red-500/20 rounded-2xl p-6 text-center">
          <p className="text-red-300 text-sm">{error}</p>
          <button
            type="button"
            onClick={() => void loadLoans()}
            className="mt-4 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-medium border border-white/10"
          >
            {t('tryAgain')}
          </button>
        </div>
      )}

      {!loading && !error && loans.length === 0 && (
        <div className="bg-[#111] border border-white/10 rounded-2xl p-12 text-center">
          <CreditCard className="w-10 h-10 text-white/20 mx-auto mb-3" />
          <p className="text-white font-medium">{t('noActiveLoans')}</p>
          <p className="text-white/50 text-sm mt-1">{t('loanDisbursedHint')}</p>
        </div>
      )}

      {!loading && !error && loans.map((loan) => {
        const isOpen = expandedId === loan.id;
        const badge = STATUS_STYLES[loan.status] ?? 'text-white/60 bg-white/5 border-white/10';
        return (
          <div key={loan.id} className="bg-[#111] border border-white/10 rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => void toggleLoan(loan.id)}
              aria-expanded={isOpen}
              className="w-full text-left p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border ${badge}`}>
                    {statusLabel(loan.status)}
                  </span>
                  {loan.lender_name && <span className="text-xs text-white/50">{loan.lender_name}</span>}
                </div>
                <h2 className="text-2xl font-display font-semibold text-white tracking-tight mt-2">
                  {pesewasToGhsString(loan.principal_pesewas)}
                </h2>
                <p className="text-xs text-white/40 mt-1">
                  {bpsToPercentString(loan.nominal_annual_rate_bps)} p.a. · {loan.tenure_months} {t('months')} · {t('disbursed')} {formatDate(loan.disbursed_at, language)}
                </p>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">{t('outstanding')}</p>
                  <p className="text-lg font-semibold text-white">{pesewasToGhsString(outstandingTotal(loan))}</p>
                </div>
                <ChevronDown className={`w-5 h-5 text-white/40 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-white/10 p-6 bg-[#0A0A0A]/40">
                <div className="grid grid-cols-3 gap-3 mb-6">
                  <div className="bg-[#0A0A0A] border border-white/5 rounded-xl p-3">
                    <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">{t('principal')}</p>
                    <p className="text-sm font-semibold text-white mt-1">{pesewasToGhsString(loan.outstanding_principal_pesewas ?? 0)}</p>
                  </div>
                  <div className="bg-[#0A0A0A] border border-white/5 rounded-xl p-3">
                    <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">{t('interest')}</p>
                    <p className="text-sm font-semibold text-white mt-1">{pesewasToGhsString(loan.outstanding_interest_pesewas ?? 0)}</p>
                  </div>
                  <div className="bg-[#0A0A0A] border border-white/5 rounded-xl p-3">
                    <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">{t('fees')}</p>
                    <p className="text-sm font-semibold text-white mt-1">{pesewasToGhsString(loan.outstanding_fees_pesewas ?? 0)}</p>
                  </div>
                </div>

                <h3 className="text-sm font-medium text-white mb-3">{t('repaymentSchedule')}</h3>
                {loadingSchedule === loan.id && <p className="text-white/40 text-xs">{t('loadingSchedule')}</p>}
                {scheduleError[loan.id] && <p className="text-red-300 text-xs">{scheduleError[loan.id]}</p>}
                {!loadingSchedule && !scheduleError[loan.id] && (schedules[loan.id]?.length ?? 0) === 0 && (
                  <p className="text-white/40 text-xs">{t('noSchedule')}</p>
                )}
                {(schedules[loan.id]?.length ?? 0) > 0 && (
                  <div className="space-y-2">
                    {schedules[loan.id].map((inst) => {
                      const paid = inst.status === 'PAID';
                      return (
                        <div
                          key={inst.installment_number}
                          className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-[#0A0A0A] text-xs"
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-7 h-7 rounded-lg bg-white/5 text-white/60 flex items-center justify-center font-semibold">
                              {inst.installment_number}
                            </span>
                            <span className="text-white/60">{t('due')} {formatDate(inst.due_date, language)}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="font-semibold text-white">{pesewasToGhsString(inst.total_due_pesewas)}</span>
                            <span
                              className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium ${
                                paid
                                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                                  : 'text-white/50 bg-white/5 border-white/10'
                              }`}
                            >
                              {statusLabel(inst.status || 'PENDING')}
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
