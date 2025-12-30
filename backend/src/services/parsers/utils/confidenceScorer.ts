/**
 * Shared confidence scoring utilities
 * Calculates confidence scores for parsed transactions
 */

import { ParsedTransaction } from '../base/types';

/**
 * Calculate confidence score (0-1) for parsed transaction
 * Based on completeness and quality of extracted data
 */
export function calculateConfidenceScore(transaction: Partial<ParsedTransaction>): number {
  let confidence = 0.4; // Base confidence for successful pattern match

  // Amount is required, adds confidence
  if (transaction.amount && transaction.amount > 0) {
    confidence += 0.2;
  }

  // Merchant name adds significant confidence
  if (transaction.merchant && transaction.merchant.length > 2) {
    confidence += 0.2;
  }

  // Date information adds confidence
  if (transaction.date) {
    confidence += 0.1;
  }

  // Card or account number adds confidence
  if (transaction.cardLast4 || transaction.accountNumber) {
    confidence += 0.05;
  }

  // Transaction ID/Reference adds confidence
  if (transaction.transactionId || transaction.referenceNumber) {
    confidence += 0.05;
  }

  // Ensure score is between 0 and 1
  return Math.min(Math.max(confidence, 0), 1);
}

/**
 * Convert numeric confidence (0-1) to level string
 */
export function confidenceToLevel(score: number): 'high' | 'medium' | 'low' {
  if (score >= 0.8) return 'high';
  if (score >= 0.5) return 'medium';
  return 'low';
}

/**
 * Convert confidence level string to numeric score
 */
export function confidenceLevelToScore(level: 'high' | 'medium' | 'low'): number {
  switch (level) {
    case 'high':
      return 0.9;
    case 'medium':
      return 0.65;
    case 'low':
      return 0.4;
  }
}
