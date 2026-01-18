import { apiClient } from './apiClient';

// Types
export interface Currency {
  code: string;
  name: string;
  symbol: string;
}

export interface ExchangeRates {
  baseCurrency: string;
  rates: Record<string, number>;
  lastUpdated: string;
  source: string;
}

export interface CurrencyBalances {
  assets: number;
  liabilities: number;
  netWorth: number;
  assetsConverted: number;
  liabilitiesConverted: number;
  netWorthConverted: number;
}

// Common currencies for quick selection
export const COMMON_CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD', 'JPY'];

// Currency display configuration
export const currencyConfig: Record<string, { symbol: string; name: string; locale: string }> = {
  INR: { symbol: '₹', name: 'Indian Rupee', locale: 'en-IN' },
  USD: { symbol: '$', name: 'US Dollar', locale: 'en-US' },
  EUR: { symbol: '€', name: 'Euro', locale: 'de-DE' },
  GBP: { symbol: '£', name: 'British Pound', locale: 'en-GB' },
  AED: { symbol: 'د.إ', name: 'UAE Dirham', locale: 'ar-AE' },
  SGD: { symbol: 'S$', name: 'Singapore Dollar', locale: 'en-SG' },
  AUD: { symbol: 'A$', name: 'Australian Dollar', locale: 'en-AU' },
  CAD: { symbol: 'C$', name: 'Canadian Dollar', locale: 'en-CA' },
  JPY: { symbol: '¥', name: 'Japanese Yen', locale: 'ja-JP' },
  CNY: { symbol: '¥', name: 'Chinese Yuan', locale: 'zh-CN' },
  CHF: { symbol: 'CHF', name: 'Swiss Franc', locale: 'de-CH' },
  HKD: { symbol: 'HK$', name: 'Hong Kong Dollar', locale: 'zh-HK' },
  NZD: { symbol: 'NZ$', name: 'New Zealand Dollar', locale: 'en-NZ' },
  SEK: { symbol: 'kr', name: 'Swedish Krona', locale: 'sv-SE' },
  KRW: { symbol: '₩', name: 'South Korean Won', locale: 'ko-KR' },
  MXN: { symbol: '$', name: 'Mexican Peso', locale: 'es-MX' },
  BRL: { symbol: 'R$', name: 'Brazilian Real', locale: 'pt-BR' },
  ZAR: { symbol: 'R', name: 'South African Rand', locale: 'en-ZA' },
  RUB: { symbol: '₽', name: 'Russian Ruble', locale: 'ru-RU' },
  THB: { symbol: '฿', name: 'Thai Baht', locale: 'th-TH' },
  MYR: { symbol: 'RM', name: 'Malaysian Ringgit', locale: 'ms-MY' },
  IDR: { symbol: 'Rp', name: 'Indonesian Rupiah', locale: 'id-ID' },
  PHP: { symbol: '₱', name: 'Philippine Peso', locale: 'en-PH' },
  VND: { symbol: '₫', name: 'Vietnamese Dong', locale: 'vi-VN' },
  PKR: { symbol: '₨', name: 'Pakistani Rupee', locale: 'ur-PK' },
  BDT: { symbol: '৳', name: 'Bangladeshi Taka', locale: 'bn-BD' },
  LKR: { symbol: 'Rs', name: 'Sri Lankan Rupee', locale: 'si-LK' },
  NPR: { symbol: 'रू', name: 'Nepalese Rupee', locale: 'ne-NP' },
};

// API Functions
export async function getSupportedCurrencies(): Promise<Currency[]> {
  return apiClient.get<Currency[]>('/currencies');
}

export async function getExchangeRates(): Promise<ExchangeRates> {
  return apiClient.get<ExchangeRates>('/currencies/rates');
}

export async function refreshExchangeRates(): Promise<ExchangeRates> {
  return apiClient.post<ExchangeRates>('/currencies/rates/refresh');
}

export async function getCurrencyPreference(): Promise<string> {
  const response = await apiClient.get<{ primaryCurrency: string }>('/currencies/preference');
  return response.primaryCurrency;
}

export async function updateCurrencyPreference(currency: string): Promise<void> {
  await apiClient.put('/currencies/preference', { currency });
}

// Utility Functions
export function formatCurrency(amount: number, currencyCode: string = 'INR'): string {
  const config = currencyConfig[currencyCode.toUpperCase()];
  
  if (config) {
    try {
      return new Intl.NumberFormat(config.locale, {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: currencyCode === 'JPY' || currencyCode === 'KRW' ? 0 : 2,
        maximumFractionDigits: currencyCode === 'JPY' || currencyCode === 'KRW' ? 0 : 2,
      }).format(amount);
    } catch {
      // Fallback if Intl doesn't support the currency
      return `${config.symbol}${amount.toLocaleString()}`;
    }
  }
  
  // Fallback for unknown currencies
  return `${currencyCode} ${amount.toLocaleString()}`;
}

export function getCurrencySymbol(currencyCode: string): string {
  return currencyConfig[currencyCode.toUpperCase()]?.symbol || currencyCode;
}

export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
  
  if (diffInHours < 1) {
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    return diffInMinutes <= 1 ? 'Just now' : `${diffInMinutes} minutes ago`;
  } else if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
  } else {
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  }
}
