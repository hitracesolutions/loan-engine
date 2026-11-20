import { useState } from 'react';
import {
  Bell, BellOff, Check, CheckCircle2, ChevronDown, Eye, EyeOff,
  Globe2, KeyRound, Lock, Moon, Save, Sun,
} from 'lucide-react';
import { useLoanStore, type LanguagePreference, type ThemePreference } from '../../../store/useLoanStore';
import { translate, translateText, type TranslationKey } from '../../../lib/translations';

const languages: { code: LanguagePreference; label: string; nativeName: string }[] = [
  { code: 'en', label: 'English', nativeName: 'English' },
  { code: 'fr', label: 'Français', nativeName: 'Français' },
  { code: 'tw', label: 'Twi', nativeName: 'Twi' },
];

export default function AccountSettings() {
  const { theme, setTheme, language, setLanguage } = useLoanStore();
  const t = (key: TranslationKey) => translate(language, key);
  const tx = (text: string) => translateText(language, text);

  /* ── Password change ── */
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  /* ── Notifications ── */
  const [notifLoanStatus, setNotifLoanStatus] = useState(true);
  const [notifRepayment, setNotifRepayment] = useState(true);
  const [notifMarketing, setNotifMarketing] = useState(false);

  /* ── Language dropdown ── */
  const [langOpen, setLangOpen] = useState(false);

  const fieldCls =
    'w-full rounded-xl border border-gray-200 bg-white pl-10 pr-10 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10';
  const labelCls = 'text-xs font-medium uppercase tracking-widest text-gray-500';

  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    if (newPw.length < 8) { setPwError('New password must be at least 8 characters.'); return; }
    if (newPw !== confirmPw) { setPwError('Passwords do not match.'); return; }
    setPwSaving(true);
    await new Promise((r) => setTimeout(r, 900));
    setPwSaving(false);
    setPwSuccess(true);
    setCurrentPw(''); setNewPw(''); setConfirmPw('');
    setTimeout(() => setPwSuccess(false), 3000);
  };

  const Toggle = ({ on, onChange }: { on: boolean; onChange: () => void }) => (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d3d38] focus-visible:ring-offset-2 ${
        on ? 'bg-[#0d3d38]' : 'bg-gray-200'
      }`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12">
      <div>
        <h1 className="dashboard-heading text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="dashboard-copy text-sm mt-1">Appearance, language, security and notifications.</p>
      </div>

      {/* ── Appearance ── */}
      <section className="dashboard-card rounded-2xl border p-6 md:p-8 space-y-5">
        <div className="flex items-center gap-3 pb-5 border-b border-gray-100">
          <Sun className="h-5 w-5 text-[#0d3d38] shrink-0" strokeWidth={1.5} />
          <div>
            <h2 className="dashboard-heading font-semibold text-base">{t('appearance')}</h2>
            <p className="dashboard-subtle text-xs mt-0.5">{t('themeHelp')}</p>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium dashboard-heading">Theme</p>
            <p className="dashboard-subtle text-xs mt-0.5">Choose how the workspace looks to you.</p>
          </div>
          <div role="group" aria-label={t('appearance')} className="dashboard-segment inline-flex rounded-xl border p-1 gap-1">
            {(['light', 'dark'] as ThemePreference[]).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setTheme(opt)}
                aria-pressed={theme === opt}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  theme === opt
                    ? 'bg-[#0d3d38] text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {opt === 'light' ? <Sun className="h-3.5 w-3.5" strokeWidth={1.75} /> : <Moon className="h-3.5 w-3.5" strokeWidth={1.75} />}
                <span className="capitalize">{opt}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Language ── */}
      <section className="dashboard-card rounded-2xl border p-6 md:p-8 space-y-5">
        <div className="flex items-center gap-3 pb-5 border-b border-gray-100">
          <Globe2 className="h-5 w-5 text-[#0d3d38] shrink-0" strokeWidth={1.5} />
          <div>
            <h2 className="dashboard-heading font-semibold text-base">{t('language')}</h2>
            <p className="dashboard-subtle text-xs mt-0.5">Choose the language for your workspace.</p>
          </div>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setLangOpen((o) => !o)}
            aria-expanded={langOpen}
            className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900 hover:bg-gray-50 transition-colors"
          >
            <span>{languages.find((l) => l.code === language)?.nativeName || 'English'}</span>
            <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${langOpen ? 'rotate-180' : ''}`} strokeWidth={1.75} />
          </button>
          {langOpen && (
            <div className="dashboard-language-menu absolute left-0 right-0 top-full z-10 mt-1 rounded-xl border p-1.5 shadow-xl">
              {languages.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  role="menuitemradio"
                  aria-checked={language === item.code}
                  onClick={() => { setLanguage(item.code); setLangOpen(false); }}
                  className="dashboard-language-option flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm"
                >
                  <span className="flex-1">{item.nativeName}</span>
                  {language === item.code && <Check className="h-4 w-4 text-[#0d3d38]" strokeWidth={1.75} />}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Security ── */}
      <section className="dashboard-card rounded-2xl border p-6 md:p-8 space-y-6">
        <div className="flex items-center gap-3 pb-5 border-b border-gray-100">
          <Lock className="h-5 w-5 text-[#0d3d38] shrink-0" strokeWidth={1.5} />
          <div>
            <h2 className="dashboard-heading font-semibold text-base">Security</h2>
            <p className="dashboard-subtle text-xs mt-0.5">Change your account password.</p>
          </div>
        </div>

        {pwSuccess && (
          <div className="p-4 bg-[#f0f9f7] border border-[#b8dbd8] rounded-xl text-[#0a2e2a] font-medium text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" strokeWidth={1.5} /> Password updated successfully.
          </div>
        )}
        {pwError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-medium">{pwError}</div>
        )}

        <form onSubmit={handlePasswordSave} className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="st-current" className={labelCls}>Current password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" strokeWidth={1.5} />
              <input id="st-current" type={showCurrent ? 'text' : 'password'} value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} autoComplete="current-password" className={fieldCls} placeholder="••••••••" />
              <button type="button" onClick={() => setShowCurrent((s) => !s)} className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600 transition-colors">
                {showCurrent ? <EyeOff className="w-4 h-4" strokeWidth={1.5} /> : <Eye className="w-4 h-4" strokeWidth={1.5} />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label htmlFor="st-new" className={labelCls}>New password</label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" strokeWidth={1.5} />
                <input id="st-new" type={showNew ? 'text' : 'password'} value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" className={fieldCls} placeholder="Min. 8 characters" />
                <button type="button" onClick={() => setShowNew((s) => !s)} className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600 transition-colors">
                  {showNew ? <EyeOff className="w-4 h-4" strokeWidth={1.5} /> : <Eye className="w-4 h-4" strokeWidth={1.5} />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="st-confirm" className={labelCls}>Confirm new password</label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" strokeWidth={1.5} />
                <input id="st-confirm" type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} autoComplete="new-password" className={fieldCls} placeholder="Repeat new password" />
              </div>
            </div>
          </div>

          <button type="submit" disabled={pwSaving || !currentPw || !newPw || !confirmPw} className="h-12 px-6 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-800 transition-all text-sm flex items-center gap-2 disabled:opacity-50">
            {pwSaving ? (<><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</>) : (<><Save className="w-4 h-4" strokeWidth={1.5} /> Update password</>)}
          </button>
        </form>
      </section>

      {/* ── Notifications ── */}
      <section className="dashboard-card rounded-2xl border p-6 md:p-8 space-y-5">
        <div className="flex items-center gap-3 pb-5 border-b border-gray-100">
          <Bell className="h-5 w-5 text-[#0d3d38] shrink-0" strokeWidth={1.5} />
          <div>
            <h2 className="dashboard-heading font-semibold text-base">Notifications</h2>
            <p className="dashboard-subtle text-xs mt-0.5">Choose what you want to hear about.</p>
          </div>
        </div>

        {[
          { id: 'notif-loan', icon: <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />, title: 'Loan status updates', desc: 'Approval decisions, disbursements, and rejections.', on: notifLoanStatus, toggle: () => setNotifLoanStatus((s) => !s) },
          { id: 'notif-repay', icon: <Bell className="h-4 w-4" strokeWidth={1.5} />, title: 'Repayment reminders', desc: 'Upcoming due dates and missed payments.', on: notifRepayment, toggle: () => setNotifRepayment((s) => !s) },
          { id: 'notif-mkt', icon: <BellOff className="h-4 w-4" strokeWidth={1.5} />, title: 'Marketing & promotions', desc: 'Product announcements and feature highlights.', on: notifMarketing, toggle: () => setNotifMarketing((s) => !s) },
        ].map((row) => (
          <div key={row.id} className="flex items-center gap-4 py-3 border-b border-gray-50 last:border-0">
            <span className="shrink-0 text-[#0d3d38]">{row.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium dashboard-heading">{row.title}</p>
              <p className="dashboard-subtle text-xs mt-0.5">{row.desc}</p>
            </div>
            <Toggle on={row.on} onChange={row.toggle} />
          </div>
        ))}
      </section>
    </div>
  );
}
