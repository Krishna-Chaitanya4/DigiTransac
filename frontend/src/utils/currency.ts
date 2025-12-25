// Currency utility functions for formatting amounts based on user's currency

export interface CurrencyInfo {
  code: string;
  symbol: string;
  name: string;
  locale: string;
}

// Common currency configurations
export const CURRENCIES: Record<string, CurrencyInfo> = {
  USD: {
    code: 'USD',
    symbol: '$',
    name: 'US Dollar',
    locale: 'en-US',
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    name: 'Euro',
    locale: 'en-EU',
  },
  GBP: {
    code: 'GBP',
    symbol: '£',
    name: 'British Pound',
    locale: 'en-GB',
  },
  INR: {
    code: 'INR',
    symbol: '₹',
    name: 'Indian Rupee',
    locale: 'en-IN',
  },
  JPY: {
    code: 'JPY',
    symbol: '¥',
    name: 'Japanese Yen',
    locale: 'ja-JP',
  },
  CNY: {
    code: 'CNY',
    symbol: '¥',
    name: 'Chinese Yuan',
    locale: 'zh-CN',
  },
  AUD: {
    code: 'AUD',
    symbol: 'A$',
    name: 'Australian Dollar',
    locale: 'en-AU',
  },
  CAD: {
    code: 'CAD',
    symbol: 'C$',
    name: 'Canadian Dollar',
    locale: 'en-CA',
  },
  CHF: {
    code: 'CHF',
    symbol: 'CHF',
    name: 'Swiss Franc',
    locale: 'de-CH',
  },
  SEK: {
    code: 'SEK',
    symbol: 'kr',
    name: 'Swedish Krona',
    locale: 'sv-SE',
  },
  NZD: {
    code: 'NZD',
    symbol: 'NZ$',
    name: 'New Zealand Dollar',
    locale: 'en-NZ',
  },
  SGD: {
    code: 'SGD',
    symbol: 'S$',
    name: 'Singapore Dollar',
    locale: 'en-SG',
  },
  HKD: {
    code: 'HKD',
    symbol: 'HK$',
    name: 'Hong Kong Dollar',
    locale: 'en-HK',
  },
  KRW: {
    code: 'KRW',
    symbol: '₩',
    name: 'South Korean Won',
    locale: 'ko-KR',
  },
  BRL: {
    code: 'BRL',
    symbol: 'R$',
    name: 'Brazilian Real',
    locale: 'pt-BR',
  },
  MXN: {
    code: 'MXN',
    symbol: 'MX$',
    name: 'Mexican Peso',
    locale: 'es-MX',
  },
  ZAR: {
    code: 'ZAR',
    symbol: 'R',
    name: 'South African Rand',
    locale: 'en-ZA',
  },
  AED: {
    code: 'AED',
    symbol: 'د.إ',
    name: 'UAE Dirham',
    locale: 'ar-AE',
  },
  SAR: {
    code: 'SAR',
    symbol: '﷼',
    name: 'Saudi Riyal',
    locale: 'ar-SA',
  },
};

/**
 * Get currency info by code
 */
export const getCurrencyInfo = (currencyCode: string): CurrencyInfo => {
  return CURRENCIES[currencyCode.toUpperCase()] || CURRENCIES.USD;
};

/**
 * Get currency symbol by code
 */
export const getCurrencySymbol = (currencyCode: string): string => {
  return getCurrencyInfo(currencyCode).symbol;
};

/**
 * Format amount with currency symbol
 * @param amount - The amount to format
 * @param currencyCode - The currency code (e.g., 'USD', 'INR')
 * @param showSymbol - Whether to show the currency symbol (default: true)
 * @param decimals - Number of decimal places (default: 2)
 */
export const formatCurrency = (
  amount: number,
  currencyCode: string = 'USD',
  showSymbol: boolean = true,
  decimals: number = 2
): string => {
  const currencyInfo = getCurrencyInfo(currencyCode);

  // Format the number with appropriate locale
  const formattedAmount = new Intl.NumberFormat(currencyInfo.locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Math.abs(amount));

  // Add symbol if requested
  const symbol = showSymbol ? currencyInfo.symbol : '';
  const sign = amount < 0 ? '-' : '';

  return `${sign}${symbol}${formattedAmount}`;
};

/**
 * Format currency with full locale support (using Intl.NumberFormat)
 */
export const formatCurrencyFull = (amount: number, currencyCode: string = 'USD'): string => {
  const currencyInfo = getCurrencyInfo(currencyCode);

  return new Intl.NumberFormat(currencyInfo.locale, {
    style: 'currency',
    currency: currencyInfo.code,
  }).format(amount);
};

/**
 * Get list of all supported currencies
 */
export const getSupportedCurrencies = (): CurrencyInfo[] => {
  return Object.values(CURRENCIES);
};
