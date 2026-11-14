import { useLoanStore } from '../store/useLoanStore';
import { translate, type TranslationKey } from './translations';

/** Reads the persisted app language so every screen can react to the header selector. */
export function useTranslation() {
  const language = useLoanStore((state) => state.language);
  return {
    language,
    t: (key: TranslationKey) => translate(language, key),
  };
}
