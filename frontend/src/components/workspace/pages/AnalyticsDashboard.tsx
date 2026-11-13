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
      <div className="bg-gradient-to-r from-white/10 via-white/5 to-transparent border border-white/10 rounded-2xl p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-2xl space-y-3 relative z-10">
          <h1 className="text-3xl lg:text-4xl font-display font-medium tracking-tight text-white">
            Welcome back{user?.name ? `, ${user.name}` : ''}
          </h1>
          <p className="text-white/60 text-sm leading-relaxed">
            Track your loan applications, active loans and repayment status.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setView('APPLICATION')}
              className="px-5 py-2.5 bg-white text-black font-medium text-sm rounded-xl hover:bg-white/90 shadow-lg shadow-white/10 transition-all flex items-center gap-2"
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
            <div key={m.label} className="bg-[#111] border border-white/10 rounded-2xl p-6">
              <div className="flex justify-between items-start mb-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-white/50">{m.label}</p>
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${m.tint}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <h3 className="text-3xl font-display font-bold text-white tracking-tight">{loading ? '—' : m.value}</h3>
            </div>
          );
        })}
      </div>

      <div className="bg-[#111] border border-white/10 rounded-2xl p-6">
        <h3 className="text-lg font-display font-medium text-white mb-4 tracking-tight">Recent applications</h3>
        {loading ? (
          <p className="text-white/40 text-sm">Loading…</p>
        ) : recent.length === 0 ? (
          <p className="text-white/40 text-sm">No applications yet. Apply for a loan to get started.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-white/70">
              <thead className="text-xs font-semibold text-white/40 uppercase tracking-wider border-b border-white/10">
                <tr>
                  <th className="pb-3">Reference</th>
                  <th className="pb-3">Date</th>
                  <th className="pb-3">Amount</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recent.map((a) => (
                  <tr key={a.id}>
                    <td className="py-3 text-white font-mono text-xs">{String(a.id).slice(0, 10)}</td>
                    <td className="py-3 text-white/60">{formatDate(a.createdAt)}</td>
                    <td className="py-3 text-white font-medium">{pesewasToGhsString(a.requestedAmountPesewas ?? 0)}</td>
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
