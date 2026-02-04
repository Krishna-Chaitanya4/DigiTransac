/**
 * i18n Configuration for DigiTransac
 *
 * This file sets up internationalization using react-i18next.
 *
 * INSTALLATION:
 *   npm install i18next react-i18next i18next-browser-languagedetector
 *
 * Supported Languages:
 * - English (en) - Default
 * - Spanish (es)
 * - French (fr)
 * - German (de)
 * - Hindi (hi)
 * - Japanese (ja)
 * - Chinese Simplified (zh)
 *
 * Usage:
 *   import { useTranslation } from 'react-i18next';
 *   const { t } = useTranslation();
 *   <p>{t('common.welcome')}</p>
 *
 * To enable i18n in your app, add to main.tsx:
 *   import './i18n';
 *
 * And wrap your app with Suspense:
 *   <Suspense fallback={<Loading />}>
 *     <App />
 *   </Suspense>
 */

// NOTE: Uncomment the following imports after installing dependencies:
// import i18n from 'i18next';
// import { initReactI18next } from 'react-i18next';
// import LanguageDetector from 'i18next-browser-languagedetector';

// Import translations
// import en from './locales/en.json';
// import es from './locales/es.json';

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

export type LanguageCode = typeof supportedLanguages[number]['code'];

// Helper to get language info
export const getLanguageInfo = (code: LanguageCode) => {
  return supportedLanguages.find(lang => lang.code === code);
};

// Placeholder exports for when packages are installed
// These will work once i18next is properly installed
export const changeLanguage = async (lng: LanguageCode): Promise<void> => {
  // Will be replaced when i18n is initialized
  localStorage.setItem('i18nextLng', lng);
  console.log(`Language changed to: ${lng}`);
};

export const getCurrentLanguage = (): LanguageCode => {
  const stored = localStorage.getItem('i18nextLng');
  if (stored && supportedLanguages.some(l => l.code === stored)) {
    return stored as LanguageCode;
  }
  // Detect from browser
  const browserLang = navigator.language.split('-')[0];
  if (supportedLanguages.some(l => l.code === browserLang)) {
    return browserLang as LanguageCode;
  }
  return 'en';
};

/**
 * Initialize i18n when dependencies are installed.
 *
 * To enable, uncomment the code above and call this in main.tsx:
 *
 * ```typescript
 * import i18n from './i18n';
 *
 * // In your app:
 * <I18nextProvider i18n={i18n}>
 *   <App />
 * </I18nextProvider>
 * ```
 */

// Resources for i18next (ready to use once packages installed)
// const resources = {
//   en: { translation: en },
//   es: { translation: es },
// };

// i18n
//   .use(LanguageDetector)
//   .use(initReactI18next)
//   .init({
//     resources,
//     fallbackLng: 'en',
//     defaultNS: 'translation',
//     debug: process.env.NODE_ENV === 'development',
//     detection: {
//       order: ['localStorage', 'navigator', 'htmlTag'],
//       caches: ['localStorage'],
//       lookupLocalStorage: 'i18nextLng',
//     },
//     interpolation: {
//       escapeValue: false,
//       format: (value: unknown, format: string | undefined, lng: string | undefined) => {
//         if (format === 'currency' && typeof value === 'number') {
//           return new Intl.NumberFormat(lng, { style: 'currency', currency: 'USD' }).format(value);
//         }
//         if (format === 'number' && typeof value === 'number') {
//           return new Intl.NumberFormat(lng).format(value);
//         }
//         if (format === 'date' && value instanceof Date) {
//           return new Intl.DateTimeFormat(lng).format(value);
//         }
//         return String(value);
//       },
//     },
//     react: {
//       useSuspense: true,
//       bindI18n: 'languageChanged',
//       transSupportBasicHtmlNodes: true,
//       transKeepBasicHtmlNodesFor: ['br', 'strong', 'i', 'p', 'b'],
//     },
//   });

// export default i18n;

// Temporary mock for useTranslation hook
export const useTranslation = () => ({
  t: (key: string, options?: Record<string, unknown>) => {
    // Simple key lookup - returns the key for now
    // Will be replaced by actual i18next when installed
    const parts = key.split('.');
    return options?.defaultValue ?? parts[parts.length - 1] ?? key;
  },
  i18n: {
    language: getCurrentLanguage(),
    changeLanguage,
  },
});