/**
 * Quick test script for transaction tag detection
 * Run with: npx ts-node src/utils/transactionTags.test.ts
 */

import { detectTransactionTags } from './transactionTags';

console.log('=== Transaction Tag Detection Tests ===\n');

// Test cases
const testCases = [
  {
    name: 'Regular expense - Swiggy',
    type: 'debit' as const,
    text: 'Rs 500 debited for Swiggy order',
    merchant: 'Swiggy',
  },
  {
    name: 'Investment - Zerodha stocks',
    type: 'debit' as const,
    text: 'Rs 50000 debited for Stock purchase at Zerodha',
    merchant: 'Zerodha',
  },
  {
    name: 'EMI payment',
    type: 'debit' as const,
    text: 'Your A/c debited Rs 15000 for Home Loan EMI payment',
    merchant: 'HDFC Home Loan',
  },
  {
    name: 'Transfer - NEFT',
    type: 'debit' as const,
    text: 'Rs 10000 transferred via NEFT to savings account',
    merchant: 'Self Transfer',
  },
  {
    name: 'Refund - Amazon',
    type: 'credit' as const,
    text: 'Rs 1500 refund from Amazon order cancellation',
    merchant: 'Amazon',
  },
  {
    name: 'Savings - Fixed Deposit',
    type: 'debit' as const,
    text: 'Rs 100000 debited for FD opening',
    merchant: 'SBI FD',
  },
  {
    name: 'Regular income - Salary',
    type: 'credit' as const,
    text: 'Rs 80000 credited to your account',
    merchant: 'Salary',
  },
  {
    name: 'Crypto purchase',
    type: 'debit' as const,
    text: 'Rs 25000 debited for Bitcoin purchase at WazirX',
    merchant: 'WazirX',
  },
  {
    name: 'SIP - Mutual fund',
    type: 'debit' as const,
    text: 'Rs 5000 debited for Mutual Fund SIP',
    merchant: 'Groww',
  },
  {
    name: 'Credit card payment',
    type: 'debit' as const,
    text: 'Rs 12000 debited for Credit Card Bill payment',
    merchant: 'HDFC Credit Card',
  },
];

testCases.forEach((testCase, index) => {
  console.log(`${index + 1}. ${testCase.name}`);
  console.log(`   Text: "${testCase.text}"`);
  console.log(`   Type: ${testCase.type}`);
  console.log(`   Merchant: ${testCase.merchant}`);

  const result = detectTransactionTags(testCase.type, testCase.text, testCase.merchant);

  console.log(`   ✓ Tags: [${result.tags.join(', ')}]`);
  console.log(`   ✓ Confidence: ${result.confidence}`);
  console.log('');
});

console.log('=== Test Complete ===');
