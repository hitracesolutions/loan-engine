import { useState } from 'react';
import { AlertCircle, CheckCircle2, UserPlus } from 'lucide-react';
import { gidfineAPI, type StaffBorrowerRecord } from '../../../lib/api-gidfine';
import { useLoanStore } from '../../../store/useLoanStore';
import { useTranslation } from '../../../lib/useTranslation';

const consentMethods = [
  { value: 'in_branch', label: 'In person at branch' },
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
  { value: 'written', label: 'Written' },
] as const;

export default function StaffIntake() {
  const { t } = useTranslation();
  const role = useLoanStore((state) => state.user?.role);
  const allowed = role === 'loan_officer' || role === 'agency_admin';
  const [borrower, setBorrower] = useState<StaffBorrowerRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [complete, setComplete] = useState('');
  const [consentAttested, setConsentAttested] = useState(false);
  const [consentMethod, setConsentMethod] = useState<(typeof consentMethods)[number]['value']>('in_branch');

  if (!allowed) return (
    <section className="mx-auto max-w-2xl dashboard-card rounded-2xl p-8">
      <h1 className="dashboard-heading text-xl font-semibold">{t('staffAccessRequired')}</h1>
      <p className="dashboard-copy mt-2">{t('staffOnlyIntro')}</p>
    </section>
  );

  const fieldCls = 'mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10';
  const labelCls = 'block text-xs font-medium text-gray-600';

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setComplete('');
    setLoading(true);
    const data = new FormData(event.currentTarget);
    try {
      if (!consentAttested) throw new Error(t('consentRequiredUi'));
      const amountGhs = Number(data.get('amountGhs'));
      const tenureMonths = Number(data.get('tenureMonths'));
      if (!Number.isFinite(amountGhs) || amountGhs <= 0 || !Number.isInteger(amountGhs * 100))
        throw new Error('Enter a valid loan amount in GH₵.');
      if (!Number.isInteger(tenureMonths) || tenureMonths <= 0)
        throw new Error('Enter a valid repayment term in months.');
      let borrowerId = borrower?.id;
      if (!borrowerId) {
        const created = await gidfineAPI.registerBorrowerByStaff({
          fullName: String(data.get('fullName')).trim(),
          email: String(data.get('email')).trim(),
          phone: String(data.get('phone')).trim(),
          password: String(data.get('temporaryPassword')),
        });
        borrowerId = created.user.id;
        setBorrower(created.user);
      }
      await gidfineAPI.createApplicationOnBehalf({
        borrowerId,
        requestedAmountPesewas: Math.round(amountGhs * 100),
        tenureMonths,
        purpose: String(data.get('purpose')).trim() || undefined,
        consent: {
          attested: true,
          method: consentMethod,
          statement: `Staff attests borrower consent was obtained by ${consentMethod.replace('_', ' ')}.`,
        },
      });
      setComplete(t('intakeSuccess'));
      setBorrower(null);
      setConsentAttested(false);
      event.currentTarget.reset();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('intakeFailure'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <span className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-gray-700">
            <UserPlus className="h-5 w-5" strokeWidth={1.5} />
          </span>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-gray-500">{t('agencyWorkspace')}</p>
            <h1 className="dashboard-heading mt-1 text-2xl font-semibold">{t('borrowerIntakeTitle')}</h1>
          </div>
        </div>
        <p className="dashboard-copy mt-3 max-w-2xl text-sm leading-6">{t('borrowerIntakeIntro')}</p>
      </div>

      {/* Alerts */}
      {error && (
        <div role="alert" className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" strokeWidth={1.5} />
          <span>
            {error}
            {borrower && ' The borrower account has already been created; if you retry registration, use the existing account instead of creating a duplicate.'}
          </span>
        </div>
      )}
      {complete && (
        <div role="status" className="flex gap-3 rounded-xl border border-[#b8dbd8] bg-[#f0f9f7] p-4 text-sm text-[#0a2e2a]">
          <CheckCircle2 className="h-5 w-5 shrink-0" strokeWidth={1.5} />
          {complete}
        </div>
      )}
      {borrower && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          {t('borrowerRegistered')} <strong className="text-gray-900">{borrower.fullName}</strong> · {borrower.email}. {t('continueIntake')}
        </div>
      )}

      {/* Form */}
      <form onSubmit={submit} className="dashboard-card space-y-6 rounded-2xl border p-5 sm:p-7">
        {!borrower && (
          <fieldset className="space-y-4">
            <legend className="dashboard-heading text-base font-semibold">{t('borrowerDetails')}</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={labelCls}>{t('fullName')}<input name="fullName" required autoComplete="name" className={fieldCls} /></label>
              <label className={labelCls}>{t('emailAddress')}<input name="email" type="email" required autoComplete="email" className={fieldCls} /></label>
              <label className={labelCls}>{t('phoneNumber')}<input name="phone" type="tel" placeholder="+233 20 123 4567" autoComplete="tel" className={fieldCls} /></label>
              <label className={labelCls}>
                {t('temporaryPassword')}
                <input name="temporaryPassword" type="password" minLength={12} required autoComplete="new-password" className={fieldCls} />
                <span className="mt-1 block text-xs text-gray-400">{t('strongPasswordHint')}</span>
              </label>
            </div>
          </fieldset>
        )}

        <fieldset className="space-y-4">
          <legend className="dashboard-heading text-base font-semibold">{t('loanRequest')}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelCls}>{t('loanAmount')}<input name="amountGhs" type="number" min="0.01" step="0.01" required className={fieldCls} placeholder="5,000.00" /></label>
            <label className={labelCls}>{t('repaymentTerm')}<input name="tenureMonths" type="number" min="1" step="1" required className={fieldCls} placeholder="12" /></label>
          </div>
          <label className={labelCls}>{t('purpose')}<textarea name="purpose" rows={3} maxLength={500} className={fieldCls} placeholder={t('purposePlaceholder')} /></label>
        </fieldset>

        {/* Consent fieldset */}
        <fieldset className="space-y-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <legend className="px-1 text-sm font-semibold text-amber-800">{t('borrowerPermission')}</legend>
          <p className="text-sm leading-6 text-amber-700">{t('consentIntro')}</p>
          <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-gray-700">
            <input
              type="checkbox"
              checked={consentAttested}
              onChange={(e) => setConsentAttested(e.target.checked)}
              className="mt-1 h-4 w-4 accent-gray-900"
            />
            {t('consentCheck')}
          </label>
          <label className={labelCls}>
            {t('consentMethod')}
            <select
              value={consentMethod}
              onChange={(e) => setConsentMethod(e.target.value as typeof consentMethod)}
              className={fieldCls}
            >
              {consentMethods.map((m) => (
                <option key={m.value} value={m.value}>
                  {t(m.value === 'in_branch' ? 'inBranch' : m.value)}
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs text-gray-400">{t('consentRecorded')}</p>
        </fieldset>

        <button
          type="submit"
          disabled={loading || !consentAttested}
          className="w-full rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? t('submitting') : t('submitIntake')}
        </button>
      </form>
    </div>
  );
}
