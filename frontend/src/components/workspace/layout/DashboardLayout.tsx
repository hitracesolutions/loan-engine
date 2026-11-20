import { useEffect, useRef, useState } from 'react';
import {
  Bell, ChevronDown, ClipboardList, CreditCard, Gauge, Landmark,
  LogOut, Menu, ScrollText, Settings2, UserPlus, UserRound, X,
} from 'lucide-react';
import { useLoanStore, type DashboardView, type LanguagePreference } from '../../../store/useLoanStore';
import AnalyticsDashboard from '../pages/AnalyticsDashboard';
import LoanApplication from '../pages/LoanApplication';
import AgencyReviewQueue from '../../AgencyReviewQueue';
import ActiveLoans from '../pages/ActiveLoans';
import UserProfile from '../pages/UserProfile';
import AccountSettings from '../pages/AccountSettings';
import NotificationsPage from '../pages/NotificationsPage';
import Docs from '../../../pages/Docs';
import StaffIntake from '../pages/StaffIntake';
import { LenderPortal } from '../../LenderPortal';
import LenderRegistration from '../pages/LenderRegistration';
import { translate, translateText, type TranslationKey } from '../../../lib/translations';

const languages: { code: LanguagePreference; label: string; nativeName: string }[] = [
  { code: 'en', label: 'English', nativeName: 'English' },
  { code: 'fr', label: 'Français', nativeName: 'Français' },
  { code: 'tw', label: 'Twi', nativeName: 'Twi' },
];

export default function DashboardLayout() {
  const { user, currentView, setView, clearSession, theme, language, setTheme, setLanguage } = useLoanStore();
  const [profileOpen, setProfileOpen] = useState(false); // kept for future use
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const staffRole = user?.role === 'loan_officer' || user?.role === 'agency_admin';
  const lenderRole = user?.role === 'lender';
  const roleLabel = user?.role
    ? translateText(language, user.role.replaceAll('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()))
    : translateText(language, 'Account');
  const t = (key: TranslationKey) => translate(language, key);
  const tx = (text: string) => translateText(language, text);

  const navigation: { name: string; id: DashboardView; icon: typeof Gauge }[] = lenderRole ? [
    { name: t('proposals'), id: 'LENDER_PORTAL', icon: Landmark },
  ] : [
    { name: t('overview'), id: 'DASHBOARD', icon: Gauge },
    { name: t('applications'), id: 'APPLICATION', icon: CreditCard },
    { name: t('reviewQueue'), id: 'AGENCY_QUEUE', icon: ClipboardList },
    { name: t('loansLedgers'), id: 'ACTIVE_LOANS', icon: ScrollText },
  ];
  if (staffRole) navigation.splice(2, 0, { name: t('borrowerIntake'), id: 'STAFF_INTAKE', icon: UserPlus });
  if (user?.role === 'agency_admin') navigation.splice(3, 0, { name: t('registerLender'), id: 'LENDER_REGISTER', icon: Landmark });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = language === 'tw' ? 'ak' : language;
  }, [language]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setMobileNavOpen(false); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); };
  }, []);

  const navigate = (id: DashboardView) => { setView(id); setMobileNavOpen(false); };

  const renderContent = () => {
    switch (currentView) {
      case 'DASHBOARD': return <AnalyticsDashboard />;
      case 'APPLICATION': return <LoanApplication />;
      case 'STAFF_INTAKE': return staffRole ? <StaffIntake /> : <AnalyticsDashboard />;
      case 'LENDER_REGISTER': return user?.role === 'agency_admin' ? <LenderRegistration /> : <AnalyticsDashboard />;
      case 'LENDER_PORTAL': return lenderRole ? <LenderPortal lenderName={user?.name} /> : <AnalyticsDashboard />;
      case 'AGENCY_QUEUE': return staffRole ? <AgencyReviewQueue /> : <AnalyticsDashboard />;
      case 'ACTIVE_LOANS': return <ActiveLoans />;
      case 'PROFILE': return <UserProfile />;
      case 'SETTINGS': return <AccountSettings />;
      case 'NOTIFICATIONS': return <NotificationsPage />;
      case 'DOCS': return <Docs />;
      default: return lenderRole ? <LenderPortal lenderName={user?.name} /> : <AnalyticsDashboard />;
    }
  };

  /* ─── Sidebar nav items ─── */
  const SidebarNav = () => (
    <nav aria-label={tx('Main navigation')} className="flex flex-col gap-1 px-3">
      {navigation.map((item) => {
        const active = currentView === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => navigate(item.id)}
            aria-current={active ? 'page' : undefined}
            className={`dashboard-sidebar-item flex w-full items-center gap-3 px-3.5 py-3 text-sm font-medium text-left transition-colors ${active ? 'is-active' : ''}`}
          >
            <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
            <span>{item.name}</span>
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="dashboard-shell flex min-h-screen font-sans selection:bg-[#f0f9f7]0/20">

      {/* ═══ DESKTOP SIDEBAR ═══ */}
      <aside className="dashboard-sidebar hidden lg:flex w-60 shrink-0 flex-col border-r">
        {/* Logo */}
        <div className="flex h-[72px] shrink-0 items-center px-5 border-b border-inherit">
          <button
            type="button"
            onClick={() => navigate(lenderRole ? 'LENDER_PORTAL' : 'DASHBOARD')}
            className="flex items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d3d38]"
          >
            <img src="/favicon.svg" alt="" className="h-7 w-7 shrink-0" />
            <span>
              <span className="block text-[16px] font-semibold tracking-tight dashboard-heading">
                Gidfine<span className="text-[#0d3d38]">.</span>
              </span>
              <span className="dashboard-subtle block text-[10px] font-medium uppercase tracking-[0.16em]">{t('workspace')}</span>
            </span>
          </button>
        </div>

        {/* User block */}
        <div className="shrink-0 px-4 py-3.5 border-b border-inherit">
          <button
            type="button"
            onClick={() => navigate('PROFILE')}
            className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-gray-50 transition-colors"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-teal-700 to-teal-600 text-sm font-semibold text-white">
              {user?.picture
                ? <img src={user.picture} alt="" className="h-full w-full object-cover" />
                : (user?.name?.trim()?.[0] || user?.email?.[0] || 'U').toUpperCase()
              }
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold dashboard-heading">{user?.name || user?.email || 'Account'}</span>
              <span className="dashboard-subtle block truncate text-[10px] capitalize mt-0.5">{roleLabel}</span>
            </span>
          </button>
        </div>

        {/* Nav items + bottom section — no gap, stacked naturally */}
        <div className="flex-1 overflow-y-auto py-4 flex flex-col">
          <SidebarNav />
          <div className="mt-4 border-t border-inherit px-3 pt-4 space-y-1">
            <button
              type="button"
              
              onClick={() => navigate('NOTIFICATIONS')}
              className={`dashboard-sidebar-item flex w-full items-center gap-3 px-3.5 py-3 text-sm font-medium text-left transition-colors ${currentView === 'NOTIFICATIONS' ? 'is-active' : ''}`}
            >
              <Bell className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
              <span>{'Notifications'}</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('PROFILE')}
              className={`dashboard-sidebar-item flex w-full items-center gap-3 px-3.5 py-3 text-sm font-medium text-left transition-colors ${currentView === 'PROFILE' ? 'is-active' : ''}`}
            >
              <UserRound className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
              <span>{t('profileSettings')}</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('SETTINGS')}
              className={`dashboard-sidebar-item flex w-full items-center gap-3 px-3.5 py-3 text-sm font-medium text-left transition-colors ${currentView === 'SETTINGS' ? 'is-active' : ''}`}
            >
              <Settings2 className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
              <span>{tx('Settings')}</span>
            </button>
            <button
              type="button"
              onClick={clearSession}
              className="dashboard-sidebar-logout flex w-full items-center gap-3 px-3.5 py-3 text-sm font-medium text-left transition-colors"
            >
              <LogOut className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
              <span>{t('logout')}</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ═══ MOBILE SIDEBAR DRAWER ═══ */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileNavOpen(false)} />
          {/* drawer */}
          <aside className="dashboard-sidebar absolute left-0 top-0 h-full w-64 flex flex-col border-r shadow-2xl">
            {/* Logo row */}
            <div className="flex h-[72px] shrink-0 items-center justify-between px-5 border-b border-inherit">
              <button
                type="button"
                onClick={() => navigate(lenderRole ? 'LENDER_PORTAL' : 'DASHBOARD')}
                className="flex items-center gap-2.5"
              >
                <img src="/favicon.svg" alt="" className="h-7 w-7 shrink-0" />
                <span className="block text-[16px] font-semibold tracking-tight dashboard-heading">
                  Gidfine<span className="text-[#0d3d38]">.</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="dashboard-subtle hover:text-current p-1 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" strokeWidth={1.75} />
              </button>
            </div>
            {/* User block */}
            <div className="shrink-0 px-4 py-3.5 border-b border-inherit">
              <button
                type="button"
                onClick={() => navigate('PROFILE')}
                className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-gray-50 transition-colors"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-teal-700 to-teal-600 text-sm font-semibold text-white">
                  {user?.picture
                    ? <img src={user.picture} alt="" className="h-full w-full object-cover" />
                    : (user?.name?.trim()?.[0] || user?.email?.[0] || 'U').toUpperCase()
                  }
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold dashboard-heading">{user?.name || user?.email || 'Account'}</span>
                  <span className="dashboard-subtle block truncate text-[10px] capitalize mt-0.5">{roleLabel}</span>
                </span>
              </button>
            </div>
            {/* Nav + bottom stacked */}
            <div className="flex-1 overflow-y-auto py-4 flex flex-col">
              <SidebarNav />
              <div className="mt-4 border-t border-inherit px-3 pt-4 space-y-1">
                <button
                  type="button"
                  
              onClick={() => navigate('NOTIFICATIONS')}
              className={`dashboard-sidebar-item flex w-full items-center gap-3 px-3.5 py-3 text-sm font-medium text-left transition-colors ${currentView === 'NOTIFICATIONS' ? 'is-active' : ''}`}
            >
              <Bell className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
                  <span>{'Notifications'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('PROFILE')}
                  className={`dashboard-sidebar-item flex w-full items-center gap-3 px-3.5 py-3 text-sm font-medium text-left transition-colors ${currentView === 'PROFILE' ? 'is-active' : ''}`}
                >
                  <UserRound className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
                  <span>{t('profileSettings')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('SETTINGS')}
                  className={`dashboard-sidebar-item flex w-full items-center gap-3 px-3.5 py-3 text-sm font-medium text-left transition-colors ${currentView === 'SETTINGS' ? 'is-active' : ''}`}
                >
                  <Settings2 className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
                  <span>{tx('Settings')}</span>
                </button>
                <button
                  type="button"
                  onClick={clearSession}
                  className="dashboard-sidebar-logout flex w-full items-center gap-3 px-3.5 py-3 text-sm font-medium text-left transition-colors"
                >
                  <LogOut className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
                  <span>{t('logout')}</span>
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* ═══ MAIN COLUMN ═══ */}
      <div className="flex flex-1 min-w-0 flex-col">

        {/* Top bar */}
        <header className="dashboard-header sticky top-0 z-40 border-b backdrop-blur-xl">
          <div className="flex h-[72px] items-center gap-3 px-4 sm:px-6">

            {/* Mobile hamburger */}
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden dashboard-icon-button grid h-10 w-10 shrink-0 place-items-center rounded-xl border"
              aria-label={tx('Open navigation')}
            >
              <Menu className="h-5 w-5" strokeWidth={1.75} />
            </button>

            {/* Mobile logo (shown when sidebar hidden) */}
            <button
              type="button"
              onClick={() => navigate(lenderRole ? 'LENDER_PORTAL' : 'DASHBOARD')}
              className="lg:hidden flex items-center gap-2 rounded-xl"
            >
              <img src="/favicon.svg" alt="" className="h-6 w-6 shrink-0" />
              <span className="text-[15px] font-semibold tracking-tight dashboard-heading">
                Gidfine<span className="text-[#0d3d38]">.</span>
              </span>
            </button>

            <div className="ml-auto flex items-center gap-2 sm:gap-3">
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="dashboard-main flex-1 px-4 py-7 sm:px-6 lg:px-8 xl:px-10 xl:py-9">
          <div key={currentView} className="animate-fade-in">{renderContent()}</div>
        </main>
      </div>
    </div>
  );
}

