/**
 * Format a number as a currency amount with proper thousand separators
 * @param amount The amount to format
 * @param currency The currency code (used for locale determination)
 * @param options Additional formatting options
 */
export function formatAmount(
  amount: number,
  currency?: string,
  options?: {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    showSign?: boolean;
  }
): string {
  const {
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
    showSign = false,
  } = options || {};

  // Determine locale based on currency for proper formatting
  const locale = getLocaleForCurrency(currency);

  const formatted = Math.abs(amount).toLocaleString(locale, {
    minimumFractionDigits,
    maximumFractionDigits,
  });

  if (showSign) {
    if (amount > 0) return `+${formatted}`;
    if (amount < 0) return `-${formatted}`;
  }

  return formatted;
}

/**
 * Get appropriate locale for currency formatting
 */
function getLocaleForCurrency(currency?: string): string {
  switch (currency) {
    case 'EUR':
      return 'de-DE';
    case 'GBP':
      return 'en-GB';
    case 'JPY':
      return 'ja-JP';
    case 'INR':
      return 'en-IN';
    case 'CNY':
      return 'zh-CN';
    case 'USD':
    default:
      return 'en-US';
  }
}

/**
 * Format a percentage value
 */
export function formatPercentage(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format a date for display
 */
export function formatDisplayDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format a date range for display
 */
export function formatDateRange(startDate: Date, endDate: Date): string {
  const start = formatDisplayDate(startDate);
  const end = formatDisplayDate(endDate);
  
  if (start === end) {
    return start;
  }
  
  return `${start} - ${end}`;
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1) + '…';
}

/**
 * Format a number in compact notation (1.2K, 3.5M, etc.)
 */
export function formatCompact(value: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 1,
  }).format(value);
}
