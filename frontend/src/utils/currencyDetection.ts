/**
 * Currency Auto-Detection Utility
 * Detects user's currency based on browser locale
 */

interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
}

// Map of locale to currency
const localeToCurrency: Record<string, string> = {
  // North America
  'en-US': 'USD',
  'en-CA': 'CAD',
  'es-MX': 'MXN',
  'fr-CA': 'CAD',
  
  // Europe
  'en-GB': 'GBP',
  'de-DE': 'EUR',
  'fr-FR': 'EUR',
  'es-ES': 'EUR',
  'it-IT': 'EUR',
  'nl-NL': 'EUR',
  'pt-PT': 'EUR',
  'pl-PL': 'PLN',
  'ru-RU': 'RUB',
  'tr-TR': 'TRY',
  
  // Asia
  'zh-CN': 'CNY',
  'zh-TW': 'TWD',
  'zh-HK': 'HKD',
  'ja-JP': 'JPY',
  'ko-KR': 'KRW',
  'hi-IN': 'INR',
  'en-IN': 'INR',
  'th-TH': 'THB',
  'vi-VN': 'VND',
  'id-ID': 'IDR',
  'ms-MY': 'MYR',
  'en-SG': 'SGD',
  'en-PH': 'PHP',
  
  // Oceania
  'en-AU': 'AUD',
  'en-NZ': 'NZD',
  
  // Middle East
  'ar-SA': 'SAR',
  'ar-AE': 'AED',
  'he-IL': 'ILS',
  
  // South America
  'pt-BR': 'BRL',
  'es-AR': 'ARS',
  'es-CL': 'CLP',
  'es-CO': 'COP',
  
  // Africa
  'en-ZA': 'ZAR',
  'en-NG': 'NGN',
  'en-KE': 'KES',
};

// Available currencies list
export const availableCurrencies: CurrencyInfo[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩' },
  { code: 'MXN', name: 'Mexican Peso', symbol: '$' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
  { code: 'RUB', name: 'Russian Ruble', symbol: '₽' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
  { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼' },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺' },
  { code: 'THB', name: 'Thai Baht', symbol: '฿' },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp' },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM' },
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱' },
  { code: 'PLN', name: 'Polish Zloty', symbol: 'zł' },
  { code: 'NGN', name: 'Nigerian Naira', symbol: '₦' },
];

/**
 * Detect currency from browser locale
 */
export const detectCurrency = (): string => {
  try {
    // Get all browser languages
    const languages = navigator.languages || [navigator.language];
    
    // Try to match locale to currency
    for (const lang of languages) {
      if (localeToCurrency[lang]) {
        return localeToCurrency[lang];
      }
      
      // Try with just country code (e.g., "en-US" -> "en")
      const baseLocale = lang.split('-')[0];
      if (localeToCurrency[baseLocale]) {
        return localeToCurrency[baseLocale];
      }
    }
    
    // Fallback to USD
    return 'USD';
  } catch (error) {
    console.warn('Currency detection failed, defaulting to USD', error);
    return 'USD';
  }
};

/**
 * Get currency name by code
 */
export const getCurrencyName = (code: string): string => {
  const currency = availableCurrencies.find(c => c.code === code);
  return currency ? currency.name : code;
};

/**
 * Get currency symbol by code
 */
export const getCurrencySymbol = (code: string): string => {
  const currency = availableCurrencies.find(c => c.code === code);
  return currency ? currency.symbol : code;
};

/**
 * Get detected locale info
 */
export const getLocaleInfo = () => {
  const locale = navigator.language || 'en-US';
  const detectedCurrency = detectCurrency();
  
  return {
    locale,
    currency: detectedCurrency,
    currencyName: getCurrencyName(detectedCurrency),
    currencySymbol: getCurrencySymbol(detectedCurrency),
  };
};
