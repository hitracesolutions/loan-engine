import { useState } from 'react';
import { AlertCircle, CheckCircle2, Copy, Landmark } from 'lucide-react';
import { gidfineAPI } from '../../../lib/api-gidfine';
import { useLoanStore } from '../../../store/useLoanStore';
import { useTranslation } from '../../../lib/useTranslation';

type ProvisionedLogin = { lenderName: string; email: string; temporaryPassword: string };

export default function LenderRegistration() {
  const { t } = useTranslation();
  const role = useLoanStore((state) => state.user?.role);
  const [login, setLogin] = useState<ProvisionedLogin | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  if (role !== 'agency_admin') return <section className="mx-auto max-w-2xl rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-white"><h1 className="text-xl font-semibold">{t('agencyAdminRequired')}</h1></section>;

  const field = 'mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white placeholder:text-white/30 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/20';
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setLoading(true);
    const form = new FormData(event.currentTarget);
    try {
      const result = await gidfineAPI.createLender({
        name: String(form.get('name')).trim(), slug: String(form.get('slug')).trim(),
        contactName: String(form.get('contactName')).trim(), contactEmail: String(form.get('contactEmail')).trim(),
        licenseNumber: String(form.get('licenseNumber')).trim() || undefined,
        contactPhone: String(form.get('contactPhone')).trim() || undefined,
      });
      setLogin({ lenderName: result.lender.name, email: result.login.email, temporaryPassword: result.login.temporaryPassword });
      setCopied(false);
      event.currentTarget.reset();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to register lender.'); }
    finally { setLoading(false); }
  }

  async function copyCredentials() {
    if (!login) return;
    await navigator.clipboard.writeText(`Gidfine lender login\nEmail: ${login.email}\nTemporary password: ${login.temporaryPassword}`);
    setCopied(true);
  }

  return <div className="mx-auto max-w-3xl space-y-6 text-white">
    <header><div className="flex items-center gap-3"><span className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-3 text-cyan-200"><Landmark className="h-5 w-5" /></span><div><p className="text-xs uppercase tracking-[0.2em] text-cyan-200">{t('agencyWorkspace')}</p><h1 className="mt-1 text-2xl font-semibold">{t('registerLenderTitle')}</h1></div></div><p className="mt-3 text-sm leading-6 text-white/60">{t('registerLenderIntro')}</p></header>
    {error && <div role="alert" className="flex gap-3 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200"><AlertCircle className="h-5 w-5 shrink-0" />{error}</div>}
    {login && <section role="status" className="space-y-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-5"><div className="flex gap-3 text-emerald-200"><CheckCircle2 className="h-5 w-5 shrink-0" /><div><h2 className="font-semibold">{login.lenderName} {t('lenderRegistered')}</h2><p className="mt-1 text-sm text-white/65">{t('temporaryPasswordOnce')}</p></div></div><dl className="grid gap-3 rounded-xl bg-black/20 p-4 text-sm sm:grid-cols-2"><div><dt className="text-white/45">{t('loginEmail')}</dt><dd className="mt-1 break-all font-mono">{login.email}</dd></div><div><dt className="text-white/45">{t('temporaryPassword')}</dt><dd className="mt-1 break-all font-mono">{login.temporaryPassword}</dd></div></dl><button type="button" onClick={() => void copyCredentials().catch(() => setError(t('clipboardError')))} className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm hover:bg-white/5"><Copy className="h-4 w-4" />{copied ? t('copied') : t('copyCredentials')}</button><p className="text-xs text-white/45">{t('closePageHint')}</p></section>}
    {!login && <form onSubmit={submit} className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:grid-cols-2 sm:p-7">
      <label className="text-sm text-white/80">{t('lenderName')}<input name="name" required maxLength={160} className={field} /></label>
      <label className="text-sm text-white/80">{t('accountIdentifier')}<input name="slug" required maxLength={80} pattern="[A-Za-z0-9-]+" className={field} /><span className="mt-1 block text-xs text-white/45">{t('slugHint')}</span></label>
      <label className="text-sm text-white/80">{t('contactName')}<input name="contactName" required maxLength={120} autoComplete="name" className={field} /></label>
      <label className="text-sm text-white/80">{t('loginEmail')}<input name="contactEmail" required type="email" autoComplete="email" className={field} /></label>
      <label className="text-sm text-white/80">{t('licenceNumber')}<input name="licenseNumber" maxLength={100} className={field} /></label>
      <label className="text-sm text-white/80">{t('contactPhone')}<input name="contactPhone" type="tel" placeholder="+233 20 123 4567" autoComplete="tel" className={field} /></label>
      <button type="submit" disabled={loading} className="mt-2 rounded-xl bg-emerald-400 px-5 py-3 font-semibold text-slate-950 hover:bg-emerald-300 disabled:opacity-50 sm:col-span-2">{loading ? t('registering') : t('registerLenderSubmit')}</button>
    </form>}
  </div>;
}
