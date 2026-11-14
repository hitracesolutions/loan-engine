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

  if (!allowed) return <section className="mx-auto max-w-2xl rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-white"><h1 className="text-xl font-semibold">{t('staffAccessRequired')}</h1><p className="mt-2 text-white/60">{t('staffOnlyIntro')}</p></section>;

  const field = 'mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white placeholder:text-white/30 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/20';
  const label = 'block text-sm font-medium text-white/80';
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
      if (!Number.isFinite(amountGhs) || amountGhs <= 0 || !Number.isInteger(amountGhs * 100)) throw new Error('Enter a valid loan amount in GH₵.');
      if (!Number.isInteger(tenureMonths) || tenureMonths <= 0) throw new Error('Enter a valid repayment term in months.');
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
        consent: { attested: true, method: consentMethod, statement: `Staff attests borrower consent was obtained by ${consentMethod.replace('_', ' ')}.` },
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
    <div className="mx-auto max-w-3xl space-y-6 text-white">
      <div><div className="flex items-center gap-3"><span className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-emerald-300"><UserPlus className="h-5 w-5" /></span><div><p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-300">{t('agencyWorkspace')}</p><h1 className="mt-1 text-2xl font-semibold">{t('borrowerIntakeTitle')}</h1></div></div><p className="mt-3 max-w-2xl text-sm leading-6 text-white/60">{t('borrowerIntakeIntro')}</p></div>
      {error && <div role="alert" className="flex gap-3 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200"><AlertCircle className="h-5 w-5 shrink-0" /><span>{error}{borrower && ' The borrower account has already been created; if you retry registration, use the existing account instead of creating a duplicate.'}</span></div>}
      {complete && <div role="status" className="flex gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-200"><CheckCircle2 className="h-5 w-5 shrink-0" />{complete}</div>}
      {borrower && <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/70">{t('borrowerRegistered')} <strong className="text-white">{borrower.fullName}</strong> · {borrower.email}. {t('continueIntake')}</div>}
      <form onSubmit={submit} className="space-y-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-7">
        {!borrower && <fieldset className="space-y-4"><legend className="text-base font-semibold">{t('borrowerDetails')}</legend><div className="grid gap-4 sm:grid-cols-2"><label className={label}>{t('fullName')}<input name="fullName" required autoComplete="name" className={field} /></label><label className={label}>{t('emailAddress')}<input name="email" type="email" required autoComplete="email" className={field} /></label><label className={label}>{t('phoneNumber')}<input name="phone" type="tel" placeholder="+233 20 123 4567" autoComplete="tel" className={field} /></label><label className={label}>{t('temporaryPassword')}<input name="temporaryPassword" type="password" minLength={12} required autoComplete="new-password" className={field} /><span className="mt-1 block text-xs text-white/45">{t('strongPasswordHint')}</span></label></div></fieldset>}
        <fieldset className="space-y-4"><legend className="text-base font-semibold">{t('loanRequest')}</legend><div className="grid gap-4 sm:grid-cols-2"><label className={label}>{t('loanAmount')}<input name="amountGhs" type="number" min="0.01" step="0.01" required className={field} placeholder="5,000.00" /></label><label className={label}>{t('repaymentTerm')}<input name="tenureMonths" type="number" min="1" step="1" required className={field} placeholder="12" /></label></div><label className={label}>{t('purpose')}<textarea name="purpose" rows={3} maxLength={500} className={field} placeholder={t('purposePlaceholder')} /></label></fieldset>
        <fieldset className="space-y-4 rounded-xl border border-amber-300/20 bg-amber-300/[0.04] p-4"><legend className="px-1 text-sm font-semibold text-amber-100">{t('borrowerPermission')}</legend><p className="text-sm leading-6 text-white/70">{t('consentIntro')}</p><label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-white/85"><input type="checkbox" checked={consentAttested} onChange={(event) => setConsentAttested(event.target.checked)} className="mt-1 h-4 w-4 accent-emerald-400" />{t('consentCheck')}</label><label className={label}>{t('consentMethod')}<select value={consentMethod} onChange={(event) => setConsentMethod(event.target.value as typeof consentMethod)} className={field}>{consentMethods.map((method) => <option key={method.value} value={method.value} className="bg-slate-900">{t(method.value === 'in_branch' ? 'inBranch' : method.value)}</option>)}</select></label><p className="text-xs text-white/45">{t('consentRecorded')}</p></fieldset>
        <button type="submit" disabled={loading || !consentAttested} className="w-full rounded-xl bg-emerald-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-45">{loading ? t('submitting') : t('submitIntake')}</button>
      </form>
    </div>
  );
}
