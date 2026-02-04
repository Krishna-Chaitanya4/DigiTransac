/**
 * i18n Configuration for DigiTransac
 *
 * Internationalization using react-i18next.
 * 
 * Supported Languages:
 * - English (en) - Default
 * - Spanish (es)
 * - French (fr)
 * - German (de)
 * - Hindi (hi)
 * - Japanese (ja)
 * - Chinese Simplified (zh)
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translations
import en from './locales/en.json';
import es from './locales/es.json';

// Supported languages
export const supportedLanguages = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
] as const;

export type LanguageCode = (typeof supportedLanguages)[number]['code'];

// Helper to get language info
export const getLanguageInfo = (code: LanguageCode) => {
  return supportedLanguages.find((lang) => lang.code === code);
};

// Resources for i18next
const resources = {
  en: { translation: en },
  es: { translation: es },
};

// Initialize i18next
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    defaultNS: 'translation',
    debug: import.meta.env.DEV,
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
    interpolation: {
      escapeValue: false,
      format: (value: unknown, format: string | undefined, lng: string | undefined) => {
        if (format === 'currency' && typeof value === 'number') {
          return new Intl.NumberFormat(lng, { style: 'currency', currency: 'USD' }).format(value);
        }
        if (format === 'number' && typeof value === 'number') {
          return new Intl.NumberFormat(lng).format(value);
        }
        if (format === 'date' && value instanceof Date) {
          return new Intl.DateTimeFormat(lng).format(value);
        }
        return String(value);
      },
    },
    react: {
      useSuspense: true,
      bindI18n: 'languageChanged',
      transSupportBasicHtmlNodes: true,
      transKeepBasicHtmlNodesFor: ['br', 'strong', 'i', 'p', 'b'],
    },
  });

// Helper functions
export const changeLanguage = async (lng: LanguageCode): Promise<void> => {
  await i18n.changeLanguage(lng);
};

export const getCurrentLanguage = (): LanguageCode => {
  return i18n.language as LanguageCode;
};

export default i18n;