/**
 * Transaction Tag Detection Utility
 * Auto-assigns tags based on transaction type and keywords
 * Consistent with frontend CATEGORY_TAG_SUGGESTIONS
 */

// Keyword patterns for detecting special transaction types
const TAG_KEYWORD_PATTERNS = {
  investment: [
    /\b(?:stock|stocks|equity|equities|mutual fund|mf|sip|crypto|cryptocurrency|bitcoin|btc|eth|investment|invested|invest)\b/i,
    /\b(?:zerodha|groww|upstox|kite|smallcase|coin dcx|wazirx)\b/i,
  ],
  transfer: [
    /\b(?:transfer|transferred|transferring|a\/c transfer|account transfer|self transfer)\b/i,
    /\b(?:imps|neft|rtgs|upi transfer)\b/i,
  ],
  savings: [
    /\b(?:saving|savings|saved|emergency fund|rd|recurring deposit|fd|fixed deposit)\b/i,
  ],
  loan: [
    /\b(?:loan|emi|equated monthly|home loan|car loan|personal loan|credit card bill|cc payment)\b/i,
    /\b(?:repayment|loan payment|emi payment|instalment)\b/i,
  ],
  refund: [
    /\b(?:refund|refunded|cashback|cash back|reversed|reversal|cancelled|cancellation)\b/i,
    /\b(?:return|returned|chargeback)\b/i,
  ],
};

export interface TagDetectionResult {
  tags: string[];
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Detect and assign tags based on transaction details
 * @param type - Transaction type (debit/credit)
 * @param description - Transaction description/merchant name
 * @param merchant - Merchant name (if available)
 * @returns Array of detected tags
 */
export function detectTransactionTags(
  type: 'debit' | 'credit',
  description?: string,
  merchant?: string
): TagDetectionResult {
  const tags: string[] = [];
  const textToAnalyze = `${description || ''} ${merchant || ''}`.toLowerCase();
  
  // Default tag based on transaction type
  const defaultTag = type === 'debit' ? 'expense' : 'income';
  
  // Check for special transaction types
  let specialTagDetected = false;
  
  // Investment detection
  if (TAG_KEYWORD_PATTERNS.investment.some(pattern => pattern.test(textToAnalyze))) {
    tags.push('investment');
    specialTagDetected = true;
  }
  
  // Transfer detection
  if (TAG_KEYWORD_PATTERNS.transfer.some(pattern => pattern.test(textToAnalyze))) {
    tags.push('transfer');
    specialTagDetected = true;
  }
  
  // Savings detection
  if (TAG_KEYWORD_PATTERNS.savings.some(pattern => pattern.test(textToAnalyze))) {
    tags.push('savings');
    specialTagDetected = true;
  }
  
  // Loan/EMI detection
  if (TAG_KEYWORD_PATTERNS.loan.some(pattern => pattern.test(textToAnalyze))) {
    tags.push('loan');
    specialTagDetected = true;
  }
  
  // Refund detection
  if (TAG_KEYWORD_PATTERNS.refund.some(pattern => pattern.test(textToAnalyze))) {
    tags.push('refund');
    specialTagDetected = true;
  }
  
  // If no special tags detected, use default tag
  if (!specialTagDetected) {
    tags.push(defaultTag);
    return {
      tags,
      confidence: 'high',
    };
  }
  
  // Special handling for conflicting tags
  // Investment, transfer, savings, loan should not have 'expense' tag
  if (type === 'debit' && !tags.includes('refund')) {
    // Don't add 'expense' if it's investment/transfer/savings/loan
    // Refunds should keep income tag if credit, expense if debit
  }
  
  // Refunds: Keep default tag but add 'refund'
  if (tags.includes('refund')) {
    if (!tags.includes(defaultTag)) {
      tags.push(defaultTag);
    }
  }
  
  // Determine confidence based on number of matches
  const confidence = tags.length > 1 ? 'high' : 'medium';
  
  return {
    tags: [...new Set(tags)], // Remove duplicates
    confidence,
  };
}

/**
 * Apply category-based tag suggestions (mirrors frontend logic)
 * @param categoryName - Category name
 * @param existingTags - Existing tags to merge with
 * @returns Updated tags array
 */
export function applyCategoryTagSuggestions(
  categoryName: string,
  existingTags: string[] = []
): string[] {
  const categoryLower = categoryName.toLowerCase();
  
  // Category to tag mapping (same as frontend CATEGORY_TAG_SUGGESTIONS)
  const CATEGORY_TAG_MAP: Record<string, { add: string[]; remove: string[] }> = {
    'stocks': { add: ['investment'], remove: ['expense'] },
    'mutual funds': { add: ['investment'], remove: ['expense'] },
    'crypto': { add: ['investment'], remove: ['expense'] },
    'cryptocurrency': { add: ['investment'], remove: ['expense'] },
    'investment': { add: ['investment'], remove: ['expense'] },
    'bonds': { add: ['investment'], remove: ['expense'] },
    'real estate': { add: ['investment'], remove: ['expense'] },
    'transfer': { add: ['transfer'], remove: ['expense', 'income'] },
    'account transfer': { add: ['transfer'], remove: ['expense', 'income'] },
    'savings': { add: ['savings'], remove: ['expense'] },
    'emergency fund': { add: ['savings'], remove: ['expense'] },
    'loan payment': { add: ['loan'], remove: ['expense'] },
    'loan': { add: ['loan'], remove: ['expense'] },
    'debt payment': { add: ['loan'], remove: ['expense'] },
    'emi': { add: ['loan'], remove: ['expense'] },
    'refund': { add: ['refund'], remove: ['income'] },
    'cashback': { add: ['refund'], remove: ['income'] },
    'return': { add: ['refund'], remove: ['income'] },
  };
  
  const mapping = CATEGORY_TAG_MAP[categoryLower];
  if (!mapping) {
    return existingTags;
  }
  
  // Remove conflicting tags
  let updatedTags = existingTags.filter(tag => !mapping.remove.includes(tag.toLowerCase()));
  
  // Add suggested tags
  updatedTags = [...updatedTags, ...mapping.add.filter(tag => !updatedTags.includes(tag))];
  
  return updatedTags;
}
