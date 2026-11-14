import { useEffect, useState } from 'react';
import { useLoanStore } from '../../../store/useLoanStore';
import { FileText, CreditCard, Wallet, ArrowUpRight } from 'lucide-react';
import { gidfineAPI, pesewasToGhsString } from '../../../lib/api-gidfine';

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(ms: number | null | undefined): string {
  if (!ms) return '—';
  const d = new Date(Number(ms));
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function AnalyticsDashboard() {
  const { user, setView } = useLoanStore();
  const [applications, setApplications] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    Promise.allSettled([gidfineAPI.listApplications(), gidfineAPI.listLoans()])
      .then(([apps, lns]) => {
        if (!mounted) return;
        if (apps.status === 'fulfilled' && Array.isArray(apps.value)) setApplications(apps.value as any[]);
        if (lns.status === 'fulfilled' && Array.isArray(lns.value)) setLoans(lns.value as any[]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const activeLoans = loans.filter((l) => l.status === 'ACTIVE');
  const totalOutstanding = loans.reduce(
    (sum, l) =>
      sum +
      (l.outstanding_principal_pesewas ?? 0) +
      (l.outstanding_interest_pesewas ?? 0) +
      (l.outstanding_fees_pesewas ?? 0),
    0,
  );

  const metrics = [
    { label: 'Applications', value: String(applications.length), icon: FileText, tint: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
    { label: 'Active loans', value: String(activeLoans.length), icon: CreditCard, tint: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    { label: 'Total outstanding', value: pesewasToGhsString(totalOutstanding), icon: Wallet, tint: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
  ];

  const recent = applications.slice(0, 6);

  return (
    <div className="space-y-8 pb-10">
      <div className="dashboard-welcome relative overflow-hidden rounded-2xl border p-6 sm:p-8">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-2xl space-y-3 relative z-10">
          <h1 className="dashboard-heading text-3xl font-display font-semibold tracking-tight lg:text-4xl">
            Welcome back{user?.name ? `, ${user.name}` : ''}
          </h1>
          <p className="dashboard-copy text-sm leading-relaxed">
            Track your loan applications, active loans and repayment status.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setView('APPLICATION')}
              className="dashboard-primary-button flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all"
            >
              Apply for a loan <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.label} className="dashboard-card rounded-2xl border p-5 sm:p-6">
              <div className="flex justify-between items-start mb-4">
                <p className="dashboard-label text-xs font-semibold uppercase tracking-widest">{m.label}</p>
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${m.tint}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <h3 className="text-3xl font-display font-bold text-white tracking-tight">{loading ? '—' : m.value}</h3>
            </div>
          );
        })}
      </div>

      <div className="dashboard-card rounded-2xl border p-5 sm:p-6">
        <h3 className="dashboard-heading mb-4 text-lg font-display font-semibold tracking-tight">Recent applications</h3>
        {loading ? (
          <p className="dashboard-copy text-sm">Loading…</p>
        ) : recent.length === 0 ? (
          <p className="dashboard-copy text-sm">No applications yet. Apply for a loan to get started.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="dashboard-table w-full text-left text-sm">
              <thead className="dashboard-label border-b text-xs font-semibold uppercase tracking-wider">
                <tr>
                  <th className="pb-3">Reference</th>
                  <th className="pb-3">Date</th>
                  <th className="pb-3">Amount</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((a) => (
                  <tr key={a.id}>
                    <td className="dashboard-heading border-b py-3 font-mono text-xs">{String(a.id).slice(0, 10)}</td>
                    <td className="dashboard-copy border-b py-3">{formatDate(a.createdAt)}</td>
                    <td className="dashboard-heading border-b py-3 font-medium">{pesewasToGhsString(a.requestedAmountPesewas ?? 0)}</td>
                    <td className="py-3">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full border border-white/10 bg-white/5 text-xs">
                        {statusLabel(a.status || 'DRAFT')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
