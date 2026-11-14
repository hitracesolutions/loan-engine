import { useLoanStore } from '../store/useLoanStore';
import { useTranslation } from '../lib/useTranslation';

/** Small public-route language selector; the same persisted preference is used in the workspace. */
export default function LanguagePicker() {
  const language = useLoanStore((state) => state.language);
  const setLanguage = useLoanStore((state) => state.setLanguage);
  const { t } = useTranslation();
  return (
    <label className="sr-only" aria-label={t('language')}>
      <select
        aria-label={t('language')}
        value={language}
        onChange={(event) => setLanguage(event.target.value as 'en' | 'fr' | 'tw')}
        className="rounded-lg border border-white/15 bg-black/40 px-2.5 py-2 text-xs text-white"
      >
        <option value="en">English</option>
        <option value="fr">Français</option>
        <option value="tw">Twi</option>
      </select>
    </label>
  );
}
