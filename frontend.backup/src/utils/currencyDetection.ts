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
 * Uses: Timezone → Locale/Country Code → Fallback
 */
export const detectCurrency = (): string => {
  try {
    // METHOD 1: Timezone-based detection (Most Reliable)
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      const timezoneToCurrency: Record<string, string> = {
        // Asia
        'Asia/Kolkata': 'INR',
        'Asia/Calcutta': 'INR',
        'Asia/Mumbai': 'INR',
        'Asia/Delhi': 'INR',
        'Asia/Tokyo': 'JPY',
        'Asia/Shanghai': 'CNY',
        'Asia/Hong_Kong': 'HKD',
        'Asia/Singapore': 'SGD',
        'Asia/Seoul': 'KRW',
        'Asia/Bangkok': 'THB',
        'Asia/Jakarta': 'IDR',
        'Asia/Manila': 'PHP',
        'Asia/Kuala_Lumpur': 'MYR',
        'Asia/Dubai': 'AED',
        'Asia/Riyadh': 'SAR',
        'Asia/Tel_Aviv': 'ILS',
        'Asia/Istanbul': 'TRY',
        // Americas
        'America/New_York': 'USD',
        'America/Chicago': 'USD',
        'America/Denver': 'USD',
        'America/Los_Angeles': 'USD',
        'America/Toronto': 'CAD',
        'America/Vancouver': 'CAD',
        'America/Mexico_City': 'MXN',
        'America/Sao_Paulo': 'BRL',
        'America/Buenos_Aires': 'ARS',
        // Europe
        'Europe/London': 'GBP',
        'Europe/Paris': 'EUR',
        'Europe/Berlin': 'EUR',
        'Europe/Rome': 'EUR',
        'Europe/Madrid': 'EUR',
        'Europe/Amsterdam': 'EUR',
        'Europe/Brussels': 'EUR',
        'Europe/Vienna': 'EUR',
        'Europe/Zurich': 'CHF',
        'Europe/Moscow': 'RUB',
        'Europe/Warsaw': 'PLN',
        // Oceania
        'Australia/Sydney': 'AUD',
        'Australia/Melbourne': 'AUD',
        'Pacific/Auckland': 'NZD',
        // Africa
        'Africa/Johannesburg': 'ZAR',
        'Africa/Lagos': 'NGN',
        'Africa/Nairobi': 'KES',
      };

      if (timezoneToCurrency[timezone]) {
        return timezoneToCurrency[timezone];
      }
    } catch {
      // Timezone detection failed, continue to fallback
    }

    // METHOD 2: Locale-based detection with country code extraction
    const languages = navigator.languages || [navigator.language];

    for (const lang of languages) {
      // Try exact locale match
      if (localeToCurrency[lang]) {
        return localeToCurrency[lang];
      }

      // Extract country code (e.g., "en-IN" → "IN")
      if (lang.includes('-')) {
        const countryCode = lang.split('-')[1]?.toUpperCase();

        const countryToCurrency: Record<string, string> = {
          IN: 'INR',
          US: 'USD',
          GB: 'GBP',
          CA: 'CAD',
          AU: 'AUD',
          JP: 'JPY',
          CN: 'CNY',
          SG: 'SGD',
          MY: 'MYR',
          PH: 'PHP',
          TH: 'THB',
          ID: 'IDR',
          VN: 'VND',
          KR: 'KRW',
          HK: 'HKD',
          TW: 'TWD',
          BR: 'BRL',
          MX: 'MXN',
          ZA: 'ZAR',
          SA: 'SAR',
          AE: 'AED',
          TR: 'TRY',
          RU: 'RUB',
          PL: 'PLN',
          NG: 'NGN',
          KE: 'KES',
          AR: 'ARS',
          CL: 'CLP',
          CO: 'COP',
          NZ: 'NZD',
          IL: 'ILS',
          CH: 'CHF',
        };

        // Eurozone countries
        const eurozone = ['DE', 'FR', 'ES', 'IT', 'NL', 'PT', 'BE', 'AT', 'IE', 'FI', 'GR'];
        if (eurozone.includes(countryCode)) {
          return 'EUR';
        }

        if (countryCode && countryToCurrency[countryCode]) {
          return countryToCurrency[countryCode];
        }
      }
    }

    // Fallback to USD
    return 'USD';
  } catch {
    return 'USD';
  }
};

/**
 * Get currency name by code
 */
export const getCurrencyName = (code: string): string => {
  const currency = availableCurrencies.find((c) => c.code === code);
  return currency ? currency.name : code;
};

/**
 * Get currency symbol by code
 */
export const getCurrencySymbol = (code: string): string => {
  const currency = availableCurrencies.find((c) => c.code === code);
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
