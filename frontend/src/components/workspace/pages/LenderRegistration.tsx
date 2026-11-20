import { useState } from 'react';
import { AlertCircle, CheckCircle2, Copy, Landmark } from 'lucide-react';
import { gidfineAPI } from '../../../lib/api-gidfine';
import { useLoanStore } from '../../../store/useLoanStore';
import { useTranslation } from '../../../lib/useTranslation';

type ProvisionedLogin = { lenderName: string; email: string; temporaryPassword: string };

export default function LenderRegistration() {
  const { t, tx } = useTranslation();
  const role = useLoanStore((state) => state.user?.role);
  const [login, setLogin] = useState<ProvisionedLogin | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  if (role !== 'agency_admin') return (
    <section className="mx-auto max-w-2xl dashboard-card rounded-2xl border p-8">
      <h1 className="dashboard-heading text-xl font-semibold">{t('agencyAdminRequired')}</h1>
    </section>
  );

  const fieldCls = 'mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10';

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);
    const form = new FormData(event.currentTarget);
    try {
      const result = await gidfineAPI.createLender({
        name: String(form.get('name')).trim(),
        slug: String(form.get('slug')).trim(),
        contactName: String(form.get('contactName')).trim(),
        contactEmail: String(form.get('contactEmail')).trim(),
        licenseNumber: String(form.get('licenseNumber')).trim() || undefined,
        contactPhone: String(form.get('contactPhone')).trim() || undefined,
      });
      setLogin({ lenderName: result.lender.name, email: result.login.email, temporaryPassword: result.login.temporaryPassword });
      setCopied(false);
      event.currentTarget.reset();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to register lender.');
    } finally {
      setLoading(false);
    }
  }

  async function copyCredentials() {
    if (!login) return;
    await navigator.clipboard.writeText(`${tx('Gidfine lender login')}\n${tx('Email')}: ${login.email}\n${t('temporaryPassword')}: ${login.temporaryPassword}`);
    setCopied(true);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <header>
        <div className="flex items-center gap-3">
          <span className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-gray-700">
            <Landmark className="h-5 w-5" strokeWidth={1.5} />
          </span>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gray-500">{t('agencyWorkspace')}</p>
            <h1 className="dashboard-heading mt-1 text-2xl font-semibold">{t('registerLenderTitle')}</h1>
          </div>
        </div>
        <p className="dashboard-copy mt-3 text-sm leading-6">{t('registerLenderIntro')}</p>
      </header>

      {/* Error */}
      {error && (
        <div role="alert" className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" strokeWidth={1.5} />
          {error}
        </div>
      )}

      {/* Success credentials card */}
      {login && (
        <section role="status" className="space-y-4 rounded-2xl border border-[#b8dbd8] bg-[#f0f9f7] p-5">
          <div className="flex gap-3 text-[#0a2e2a]">
            <CheckCircle2 className="h-5 w-5 shrink-0" strokeWidth={1.5} />
            <div>
              <h2 className="font-semibold">{login.lenderName} {t('lenderRegistered')}</h2>
              <p className="mt-1 text-sm text-[#0d3d38]">{t('temporaryPasswordOnce')}</p>
            </div>
          </div>
          <dl className="grid gap-3 rounded-xl bg-white border border-[#d0ebe8] p-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-gray-500">{t('loginEmail')}</dt>
              <dd className="mt-1 break-all font-mono text-gray-900">{login.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">{t('temporaryPassword')}</dt>
              <dd className="mt-1 break-all font-mono text-gray-900">{login.temporaryPassword}</dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={() => void copyCredentials().catch(() => setError(t('clipboardError')))}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Copy className="h-4 w-4" strokeWidth={1.5} />
            {copied ? t('copied') : t('copyCredentials')}
          </button>
          <p className="text-xs text-gray-400">{t('closePageHint')}</p>
        </section>
      )}

      {/* Registration form */}
      {!login && (
        <form onSubmit={submit} className="dashboard-card grid gap-4 rounded-2xl border p-5 sm:grid-cols-2 sm:p-7">
          <label className="text-xs font-medium text-gray-600">
            {t('lenderName')}
            <input name="name" required maxLength={160} className={fieldCls} />
          </label>
          <label className="text-xs font-medium text-gray-600">
            {t('accountIdentifier')}
            <input name="slug" required maxLength={80} pattern="[A-Za-z0-9-]+" className={fieldCls} />
            <span className="mt-1 block text-xs text-gray-400">{t('slugHint')}</span>
          </label>
          <label className="text-xs font-medium text-gray-600">
            {t('contactName')}
            <input name="contactName" required maxLength={120} autoComplete="name" className={fieldCls} />
          </label>
          <label className="text-xs font-medium text-gray-600">
            {t('loginEmail')}
            <input name="contactEmail" required type="email" autoComplete="email" className={fieldCls} />
          </label>
          <label className="text-xs font-medium text-gray-600">
            {t('licenceNumber')}
            <input name="licenseNumber" maxLength={100} className={fieldCls} />
          </label>
          <label className="text-xs font-medium text-gray-600">
            {t('contactPhone')}
            <input name="contactPhone" type="tel" placeholder="+233 20 123 4567" autoComplete="tel" className={fieldCls} />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800 transition-colors disabled:opacity-50 sm:col-span-2"
          >
            {loading ? t('registering') : t('registerLenderSubmit')}
          </button>
        </form>
      )}
    </div>
  );
}
