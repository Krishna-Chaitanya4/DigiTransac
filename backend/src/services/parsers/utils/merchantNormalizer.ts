/**
 * Shared merchant normalization utilities
 * Cleans and standardizes merchant names from transaction messages
 */

/**
 * Clean merchant name by removing noise and normalizing format
 * Removes: dates, balances, card references, common suffixes
 */
export function cleanMerchantName(merchant: string): string {
  if (!merchant?.trim()) {
    return '';
  }

  let cleaned = merchant.trim();

  // Remove date patterns (e.g., "on 23-Dec-25", "23/12/2025")
  cleaned = cleaned.replace(/\s+on\s+\d{1,2}[-/]\w{3}[-/]\d{2,4}/gi, '');
  cleaned = cleaned.replace(/\s+\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/g, '');

  // Remove balance info (e.g., "Avl Bal:Rs.5000", "Available Balance: 5000")
  cleaned = cleaned.replace(/\s*(?:Avl|Available)\s*(?:Bal|Balance)[:\s]*(?:Rs\.?|INR)?\s*[\d,]+\.?\d*/gi, '');

  // Remove card references (e.g., "Card XX1234", "A/c **5678")
  cleaned = cleaned.replace(/\s*(?:Card|A\/c|Account)\s+[xX*.]{2,}\d{4}/gi, '');

  // Remove common company suffixes
  cleaned = cleaned.replace(/\s+(?:PVT|LTD|PRIVATE|LIMITED|INC|CORP|CORPORATION)\.?$/gi, '');

  // Remove location suffixes (e.g., "BANGALORE", "MUMBAI")
  cleaned = cleaned.replace(/\s+(?:BANGALORE|MUMBAI|DELHI|CHENNAI|KOLKATA|HYDERABAD|PUNE|AHMEDABAD)$/gi, '');

  // Remove excess whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // Remove trailing punctuation
  cleaned = cleaned.replace(/[.,;:!?]+$/, '');

  // Normalize to title case for better readability
  cleaned = toTitleCase(cleaned);

  return cleaned;
}

/**
 * Convert string to title case (First Letter Of Each Word)
 */
function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => {
      // Keep common acronyms uppercase
      const upperWords = ['atm', 'pos', 'upi', 'imps', 'neft', 'rtgs', 'emi'];
      if (upperWords.includes(word)) {
        return word.toUpperCase();
      }
      // Special handling for single letters
      if (word.length === 1) {
        return word.toUpperCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * Validate merchant name (basic sanity checks)
 */
export function isValidMerchantName(merchant: string): boolean {
  if (!merchant || merchant.length < 2) {
    return false;
  }

  // Should not be just numbers or special characters
  if (!/[A-Za-z]{2,}/.test(merchant)) {
    return false;
  }

  // Should not be common non-merchant terms
  const invalidTerms = [
    'card',
    'account',
    'balance',
    'available',
    'total',
    'limit',
    'bank',
    'transaction',
    'ref',
    'reference',
  ];

  const lowerMerchant = merchant.toLowerCase();
  return !invalidTerms.some((term) => lowerMerchant === term);
}
