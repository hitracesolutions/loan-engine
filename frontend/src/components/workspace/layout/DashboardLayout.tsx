import { useEffect, useRef, useState } from 'react';
import {
  Bell, Check, ChevronDown, CreditCard, Globe2, LayoutDashboard, Landmark,
  LogOut, Moon, Settings2, Sun, UserRound, Users,
} from 'lucide-react';
import { useLoanStore, type DashboardView, type LanguagePreference, type ThemePreference } from '../../../store/useLoanStore';
import AnalyticsDashboard from '../pages/AnalyticsDashboard';
import LoanApplication from '../pages/LoanApplication';
import AgencyReviewQueue from '../../AgencyReviewQueue';
import ActiveLoans from '../pages/ActiveLoans';
import UserProfile from '../pages/UserProfile';
import Docs from '../../../pages/Docs';
import StaffIntake from '../pages/StaffIntake';
import { LenderPortal } from '../../LenderPortal';
import LenderRegistration from '../pages/LenderRegistration';

const languages: { code: LanguagePreference; label: string; nativeName: string }[] = [
  { code: 'en', label: 'English', nativeName: 'English' },
  { code: 'fr', label: 'French', nativeName: 'Français' },
  { code: 'tw', label: 'Twi', nativeName: 'Twi' },
];

export default function DashboardLayout() {
  const { user, currentView, setView, clearSession, theme, language, setTheme, setLanguage } = useLoanStore();
  const [profileOpen, setProfileOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const staffRole = user?.role === 'loan_officer' || user?.role === 'agency_admin';
  const lenderRole = user?.role === 'lender';
  const roleLabel = user?.role?.replaceAll('_', ' ') || 'Account';

  const navigation: { name: string; id: DashboardView; icon: typeof LayoutDashboard }[] = lenderRole ? [
    { name: 'Proposals', id: 'LENDER_PORTAL', icon: Landmark },
  ] : [
    { name: 'Overview', id: 'DASHBOARD', icon: LayoutDashboard },
    { name: 'Applications', id: 'APPLICATION', icon: CreditCard },
    { name: 'Review queue', id: 'AGENCY_QUEUE', icon: Users },
    { name: 'Loans & ledgers', id: 'ACTIVE_LOANS', icon: Landmark },
  ];
  if (staffRole) navigation.splice(2, 0, { name: 'Borrower intake', id: 'STAFF_INTAKE', icon: Users });
  if (user?.role === 'agency_admin') navigation.splice(3, 0, { name: 'Register lender', id: 'LENDER_REGISTER', icon: Landmark });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      if (!profileRef.current?.contains(event.target as Node)) {
        setProfileOpen(false);
        setLanguageOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setProfileOpen(false);
        setLanguageOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

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
      case 'DOCS': return <Docs />;
      default: return lenderRole ? <LenderPortal lenderName={user?.name} /> : <AnalyticsDashboard />;
    }
  };

  const selectLanguage = (code: LanguagePreference) => {
    if (code !== 'en') return;
    setLanguage(code);
    setLanguageOpen(false);
  };

  return (
    <div className="dashboard-shell min-h-screen font-sans selection:bg-emerald-500/20">
      <header className="dashboard-header sticky top-0 z-40 border-b backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center gap-5 px-4 sm:px-6 xl:px-10">
          <button type="button" onClick={() => setView(lenderRole ? 'LENDER_PORTAL' : 'DASHBOARD')} aria-label="Go to dashboard" className="flex shrink-0 items-center gap-3 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
            <span className="grid h-10 w-10 place-items-center overflow-hidden rounded-[14px] bg-emerald-500/10 ring-1 ring-emerald-500/15"><img src="/favicon.svg" alt="" className="h-7 w-7" /></span>
            <span className="hidden sm:block"><span className="block text-[17px] font-semibold tracking-tight">Gidfine<span className="text-emerald-600">.</span></span><span className="dashboard-subtle block text-[10px] font-medium uppercase tracking-[0.16em]">Finance workspace</span></span>
          </button>

          <nav aria-label="Main navigation" className="dashboard-nav ml-1 hidden min-w-0 items-center gap-1 overflow-x-auto lg:flex">
            {navigation.map((item) => {
              const active = currentView === item.id;
              return <button key={item.id} type="button" onClick={() => setView(item.id)} aria-current={active ? 'page' : undefined} className={`dashboard-nav-item inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-[13px] font-medium transition-colors ${active ? 'is-active' : ''}`}><item.icon className="h-4 w-4" />{item.name}</button>;
            })}
          </nav>

          <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
            <button type="button" aria-label="Notifications coming later" title="Notifications coming later" disabled className="dashboard-icon-button relative grid h-10 w-10 shrink-0 cursor-not-allowed place-items-center rounded-xl border opacity-55"><Bell className="h-[17px] w-[17px]" /></button>

            <div className="relative" ref={profileRef}>
              <button type="button" onClick={() => { setProfileOpen((open) => !open); setLanguageOpen(false); }} aria-haspopup="dialog" aria-expanded={profileOpen} aria-label="Open account menu" className="dashboard-account flex h-11 items-center gap-2 rounded-xl p-1 pr-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 sm:gap-2.5 sm:pr-2">
                <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-[11px] bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-semibold text-white shadow-sm">{user?.picture ? <img src={user.picture} alt="" className="h-full w-full object-cover" /> : (user?.name?.trim()?.[0] || user?.email?.[0] || 'U').toUpperCase()}</span>
                <span className="hidden min-w-0 text-left sm:block"><span className="block max-w-28 truncate text-xs font-semibold leading-4">{user?.name || user?.email || 'Account'}</span><span className="dashboard-subtle mt-0.5 block max-w-28 truncate text-[10px] capitalize">{roleLabel}</span></span>
                <ChevronDown className={`dashboard-subtle hidden h-4 w-4 transition-transform sm:block ${profileOpen ? 'rotate-180' : ''}`} />
              </button>

              {profileOpen && <section role="dialog" aria-label="Account menu" className="dashboard-popover absolute right-0 top-[calc(100%+12px)] z-50 w-[min(340px,calc(100vw-24px))] origin-top-right overflow-visible rounded-2xl border p-2.5 shadow-2xl animate-scale-in">
                <div className="flex items-center gap-3 rounded-xl p-3"><span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-[13px] bg-gradient-to-br from-emerald-500 to-teal-600 text-base font-semibold text-white">{user?.picture ? <img src={user.picture} alt="" className="h-full w-full object-cover" /> : (user?.name?.trim()?.[0] || user?.email?.[0] || 'U').toUpperCase()}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{user?.name || 'Gidfine user'}</span><span className="dashboard-subtle mt-1 block truncate text-xs">{user?.email}</span></span></div>
                <div className="dashboard-divider my-2 border-t" />
                <button type="button" onClick={() => { setView('PROFILE'); setProfileOpen(false); }} className="dashboard-menu-item flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors"><UserRound className="h-4 w-4" /><span className="flex-1">Profile settings</span></button>

                <div className="dashboard-setting-row mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5"><span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600">{theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}</span><span className="min-w-0 flex-1"><span className="block text-sm font-medium">Appearance</span><span className="dashboard-subtle block text-[11px]">Choose your workspace theme</span></span><div role="group" aria-label="Theme" className="dashboard-segment inline-flex rounded-lg border p-0.5"><button type="button" onClick={() => setTheme('light')} aria-pressed={theme === 'light'} aria-label="Light mode" className={`grid h-7 w-7 place-items-center rounded-md transition-colors ${theme === 'light' ? 'is-selected' : ''}`}><Sun className="h-3.5 w-3.5" /></button><button type="button" onClick={() => setTheme('dark')} aria-pressed={theme === 'dark'} aria-label="Dark mode" className={`grid h-7 w-7 place-items-center rounded-md transition-colors ${theme === 'dark' ? 'is-selected' : ''}`}><Moon className="h-3.5 w-3.5" /></button></div></div>

                <div className="relative mt-1"><button type="button" onClick={() => setLanguageOpen((open) => !open)} aria-expanded={languageOpen} className="dashboard-menu-item flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors"><span className="grid h-8 w-8 place-items-center rounded-lg bg-sky-500/10 text-sky-600"><Globe2 className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-medium">Language</span><span className="dashboard-subtle block text-[11px]">{languages.find((item) => item.code === language)?.label || 'English'}</span></span><ChevronDown className={`dashboard-subtle h-4 w-4 transition-transform ${languageOpen ? 'rotate-180' : ''}`} /></button>
                  {languageOpen && <div role="menu" aria-label="Choose language" className="dashboard-language-menu absolute right-0 top-full z-[60] mt-1 w-full rounded-xl border p-1.5 shadow-xl">{languages.map((item) => <button key={item.code} type="button" role="menuitemradio" aria-checked={language === item.code} disabled={item.code !== 'en'} onClick={() => selectLanguage(item.code)} className="dashboard-language-option flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm disabled:cursor-not-allowed"><span className="flex-1">{item.nativeName}</span>{item.code !== 'en' && <span className="dashboard-coming rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide">Coming later</span>}{language === item.code && <Check className="h-4 w-4 text-emerald-600" />}</button>)}</div>}
                </div>

                <button type="button" onClick={() => { setView('PROFILE'); setProfileOpen(false); }} className="dashboard-menu-item mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors"><Settings2 className="h-4 w-4" /><span className="flex-1">Account preferences</span></button>
                <div className="dashboard-divider my-2 border-t" />
                <button type="button" onClick={clearSession} className="dashboard-logout flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors"><LogOut className="h-4 w-4" /><span>Log out</span></button>
              </section>}
            </div>
          </div>
        </div>
        <nav aria-label="Mobile navigation" className="dashboard-mobile-nav flex gap-1 overflow-x-auto border-t px-3 py-2 lg:hidden">
          {navigation.map((item) => { const active = currentView === item.id; return <button key={item.id} type="button" onClick={() => setView(item.id)} aria-current={active ? 'page' : undefined} className={`dashboard-nav-item inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-medium ${active ? 'is-active' : ''}`}><item.icon className="h-4 w-4" />{item.name}</button>; })}
        </nav>
      </header>

      <main className="dashboard-main mx-auto w-full max-w-[1440px] px-4 py-7 sm:px-6 lg:px-8 xl:px-10 xl:py-9">
        <div key={currentView} className="animate-fade-in">{renderContent()}</div>
      </main>
    </div>
  );
}
