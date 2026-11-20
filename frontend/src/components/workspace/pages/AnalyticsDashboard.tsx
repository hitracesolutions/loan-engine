import { useEffect, useState } from 'react';
import { useLoanStore } from '../../../store/useLoanStore';
import { ArrowUpRight, CreditCard, Eye, EyeOff, FileText, ScrollText, Wallet } from 'lucide-react';
import { gidfineAPI, pesewasToGhsString } from '../../../lib/api-gidfine';
import { translate, translateText, type TranslationKey } from '../../../lib/translations';

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusVariant(status: string): string {
  const s = status.toUpperCase();
  if (['ACTIVE', 'APPROVED', 'DISBURSED'].includes(s))
    return 'bg-[#edfade] text-[#2d7a1f] border-[#a8f07a]';
  if (['SUBMITTED', 'UNDER_REVIEW', 'PENDING'].includes(s))
    return 'bg-amber-50 text-amber-700 border-amber-200';
  if (['REJECTED', 'CANCELLED', 'DEFAULTED'].includes(s))
    return 'bg-red-50 text-red-700 border-red-200';
  return 'bg-gray-100 text-gray-600 border-gray-200';
}

function formatDate(ms: number | null | undefined, language: 'en' | 'fr' | 'tw'): string {
  if (!ms) return '—';
  const d = new Date(Number(ms));
  const locale = language === 'fr' ? 'fr-GH' : language === 'tw' ? 'ak-GH' : 'en-GH';
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
}

type HeroTab = 'outstanding' | 'active' | 'applications';

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-white/10 ${className ?? ''}`}
    />
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 pb-10">
      {/* Hero card skeleton */}
      <div
        className="rounded-2xl p-5 md:p-6 relative overflow-hidden max-w-2xl"
        style={{ background: 'linear-gradient(to right, #0d3d38 55%, #155049 100%)' }}
      >
        {/* greeting */}
        <Shimmer className="mb-2 h-3.5 w-24" />
        <Shimmer className="mb-7 h-7 w-48" />
        {/* tabs */}
        <div className="flex gap-2 mb-6">
          <Shimmer className="h-9 w-32" />
          <Shimmer className="h-9 w-24 opacity-50" />
          <Shimmer className="h-9 w-24 opacity-50" />
        </div>
        {/* big number */}
        <Shimmer className="mb-6 h-12 w-44" />
        {/* buttons */}
        <div className="flex gap-3">
          <Shimmer className="h-10 w-36" />
          <Shimmer className="h-10 w-28 opacity-60" />
        </div>
      </div>

      {/* Recent applications skeleton */}
      <div className="dashboard-card rounded-xl border overflow-hidden" style={{ borderColor: 'var(--dash-border)' }}>
        <div className="border-b px-5 py-4" style={{ borderColor: 'var(--dash-border)' }}>
          <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
        </div>
        <div className="divide-y" style={{ borderColor: 'var(--dash-border)' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <div className="h-3.5 w-24 animate-pulse rounded bg-gray-100" />
              <div className="h-3.5 w-20 animate-pulse rounded bg-gray-100" />
              <div className="h-3.5 w-16 animate-pulse rounded bg-gray-100" />
              <div className="h-5 w-20 animate-pulse rounded-full bg-gray-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsDashboard() {
  const { user, setView, language } = useLoanStore();
  const t = (key: TranslationKey) => translate(language, key);
  const tx = (text: string) => translateText(language, text);

  const [applications, setApplications] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [heroTab, setHeroTab] = useState<HeroTab>('outstanding');
  const [balanceHidden, setBalanceHidden] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.allSettled([gidfineAPI.listApplications(), gidfineAPI.listLoans()])
      .then(([apps, lns]) => {
        if (!mounted) return;
        if (apps.status === 'fulfilled' && Array.isArray(apps.value)) setApplications(apps.value as any[]);
        if (lns.status === 'fulfilled' && Array.isArray(lns.value)) setLoans(lns.value as any[]);
      })
      .finally(() => { if (mounted) setLoading(false); });

    return () => { mounted = false; };
  }, []);

  if (loading) return <DashboardSkeleton />;

  const activeLoans = loans.filter((l) => l.status === 'ACTIVE');
  const totalOutstanding = loans.reduce(
    (sum, l) =>
      sum +
      (l.outstanding_principal_pesewas ?? 0) +
      (l.outstanding_interest_pesewas ?? 0) +
      (l.outstanding_fees_pesewas ?? 0),
    0,
  );

  const heroTabs: { id: HeroTab; label: string; value: string; icon: typeof Wallet }[] = [
    { id: 'outstanding', label: tx('Total Outstanding'), value: loading ? '—' : pesewasToGhsString(totalOutstanding), icon: Wallet },
    { id: 'active',      label: tx('Active Loans'),     value: loading ? '—' : String(activeLoans.length),              icon: CreditCard },
    { id: 'applications',label: tx('Applications'),     value: loading ? '—' : String(applications.length),             icon: FileText },
  ];

  const activeHero = heroTabs.find((h) => h.id === heroTab)!;
  const recent = applications.slice(0, 6);

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6 pb-10">

      {/* ── Dark hero card ── */}
      <div
        className="rounded-2xl p-5 md:p-6 relative overflow-hidden max-w-2xl"
        style={{ background: 'linear-gradient(to right, #0d3d38 55%, #155049 100%)' }}
      >
        {/* noise dither — kills gradient banding */}
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl"
          style={{
            opacity: 0.04,
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)'/%3E%3C/svg%3E")`,
            backgroundSize: '200px 200px',
          }}
        />

        {/* 3D Chrome Cedi Symbol — subtle right side */}
        <div className="pointer-events-none absolute right-6 sm:right-10 md:right-14 top-1/2 -translate-y-1/2 select-none">
          <img
            src="/features/chrome-cedi-symbol.png"
            alt=""
            className="w-20 sm:w-24 md:w-28 h-auto object-contain opacity-65"
          />
        </div>

        {/* Greeting */}
        <p className="text-sm font-medium text-white/60 mb-1">{tx('Welcome back')}</p>
        <h1 className="text-2xl font-semibold text-white tracking-tight mb-6">
          {user?.name ? user.name : tx('Dashboard')}
        </h1>

        {/* Tab switcher */}
        <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit" style={{ background: 'rgba(255,255,255,0.08)' }}>
          {heroTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setHeroTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                heroTab === tab.id
                  ? 'bg-white text-[#0d3d38] shadow-sm'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Big number */}
        <div className="flex items-end gap-3 mb-5">
          <span className="text-4xl md:text-5xl font-bold text-white tabular-nums tracking-tight">
            {balanceHidden ? '••••••' : activeHero.value}
          </span>
          <button
            type="button"
            onClick={() => setBalanceHidden((s) => !s)}
            className="mb-1.5 text-white/40 hover:text-white/70 transition-colors"
            aria-label={balanceHidden ? 'Show balance' : 'Hide balance'}
          >
            {balanceHidden
              ? <Eye className="h-5 w-5" strokeWidth={1.5} />
              : <EyeOff className="h-5 w-5" strokeWidth={1.5} />}
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setView('APPLICATION')}
            className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all"
            style={{ background: '#38c9c0', color: '#0d3d38', fontWeight: 600 }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#2ab5ac')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#38c9c0')}
          >
            {t('applyLoan')} <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setView('ACTIVE_LOANS')}
            className="inline-flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-semibold transition-all"
            style={{ borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.75)' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)'; e.currentTarget.style.color = 'white'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.color = 'rgba(255,255,255,0.75)'; }}
          >
            <ScrollText className="h-4 w-4" aria-hidden="true" /> {tx('View loans')}
          </button>
        </div>
      </div>

      {/* ── Recent applications ── */}
      <div className="dashboard-card rounded-xl border">
        <div className="border-b px-5 py-4" style={{ borderColor: 'var(--dash-border)' }}>
          <h2 className="dashboard-heading text-sm font-semibold">{t('recentApplications')}</h2>
        </div>

        {recent.length === 0 ? (
          <p className="dashboard-copy px-5 py-6 text-sm">{t('noApplications')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--dash-border)' }}>
                  <th className="dashboard-label px-5 py-3 text-xs font-medium uppercase tracking-wider">{t('reference')}</th>
                  <th className="dashboard-label px-5 py-3 text-xs font-medium uppercase tracking-wider">{t('date')}</th>
                  <th className="dashboard-label px-5 py-3 text-xs font-medium uppercase tracking-wider">{t('amount')}</th>
                  <th className="dashboard-label px-5 py-3 text-xs font-medium uppercase tracking-wider">{t('status')}</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b last:border-0 transition-colors"
                    style={{ borderColor: 'var(--dash-border)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--dash-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                  >
                    <td className="dashboard-heading px-5 py-3.5 font-mono text-xs">{String(a.id).slice(0, 10)}</td>
                    <td className="dashboard-copy px-5 py-3.5 text-sm">{formatDate(a.createdAt, language)}</td>
                    <td className="dashboard-heading px-5 py-3.5 text-sm font-medium tabular-nums">{pesewasToGhsString(a.requestedAmountPesewas ?? 0)}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${statusVariant(a.status || 'DRAFT')}`}>
                        {tx(statusLabel(a.status || 'DRAFT'))}
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
