/**
 * Shared application constants
 */

/**
 * SignalR and real-time notification settings
 */
export const NOTIFICATION_CONSTANTS = {
  /** Ping interval in milliseconds to keep SignalR connection alive */
  PING_INTERVAL_MS: 30000,
  /** Maximum number of reconnection attempts */
  MAX_RECONNECT_ATTEMPTS: 5,
  /** Maximum delay between reconnection attempts in milliseconds */
  MAX_RECONNECT_DELAY_MS: 30000,
} as const;

/**
 * Chat and messaging settings
 */
export const CHAT_CONSTANTS = {
  /** Maximum message content length */
  MAX_MESSAGE_LENGTH: 1000,
  /** Message preview truncation length in conversation list */
  PREVIEW_TRUNCATE_LENGTH: 50,
  /** Reply preview truncation length */
  REPLY_PREVIEW_TRUNCATE_LENGTH: 30,
  /** Default number of messages to load */
  DEFAULT_MESSAGE_LIMIT: 50,
  /** Time window in minutes for editing messages */
  EDIT_WINDOW_MINUTES: 15,
  /** Time window in minutes for deleting messages */
  DELETE_WINDOW_MINUTES: 60,
  /** Display name for self-chat/personal transactions */
  SELF_CHAT_DISPLAY_NAME: 'Personal',
} as const;

/**
 * Sidebar resize settings
 */
export const SIDEBAR_CONSTANTS = {
  /** Default sidebar width in pixels */
  DEFAULT_WIDTH: 320,
  /** Minimum sidebar width in pixels */
  MIN_WIDTH: 280,
  /** Maximum sidebar width in pixels */
  MAX_WIDTH: 500,
} as const;

/**
 * Transaction display settings
 */
export const TRANSACTION_CONSTANTS = {
  /** Default page size for transaction lists */
  DEFAULT_PAGE_SIZE: 50,
} as const;

/**
 * Currency symbols for formatting
 */
export const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  AUD: 'A$',
  CAD: 'C$',
  CHF: 'Fr',
  CNY: '¥',
  HKD: 'HK$',
  NZD: 'NZ$',
  SGD: 'S$',
  KRW: '₩',
  MXN: 'Mex$',
  BRL: 'R$',
  ZAR: 'R',
  RUB: '₽',
  AED: 'د.إ',
  SAR: '﷼',
  THB: '฿',
} as const;

/**
 * Format currency amount with symbol
 */
export function formatCurrency(amount: number, currencyCode: string): string {
  const symbol = CURRENCY_SYMBOLS[currencyCode?.toUpperCase()] || `${currencyCode} `;
  return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Get currency symbol for a currency code
 */
export function getCurrencySymbol(currencyCode: string): string {
  return CURRENCY_SYMBOLS[currencyCode?.toUpperCase()] || `${currencyCode} `;
}