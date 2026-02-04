/**
 * E2E Test Data Fixtures
 * 
 * This file contains reusable test data for E2E tests.
 * These can be used to create mock scenarios or validate expected behaviors.
 */

export const testUsers = {
  validUser: {
    email: 'test@example.com',
    password: 'TestPassword123!',
    fullName: 'Test User',
  },
  invalidUser: {
    email: 'invalid@example.com',
    password: 'wrongpassword',
  },
  newUser: {
    email: `newuser-${Date.now()}@example.com`,
    password: 'NewUserPassword123!',
    fullName: 'New Test User',
  },
};

export const testTransactions = {
  send: {
    type: 'Send',
    amount: 50.00,
    payee: 'Grocery Store',
    category: 'Food & Dining',
    notes: 'E2E Test Transaction',
  },
  receive: {
    type: 'Receive',
    amount: 1000.00,
    payer: 'Employer Inc',
    category: 'Income',
    notes: 'E2E Test Income',
  },
  transfer: {
    type: 'Transfer',
    amount: 200.00,
    fromAccount: 'Checking',
    toAccount: 'Savings',
    notes: 'E2E Test Transfer',
  },
};

export const testAccounts = {
  checking: {
    name: 'E2E Checking',
    type: 'Bank',
    currency: 'USD',
    initialBalance: 1000.00,
  },
  savings: {
    name: 'E2E Savings',
    type: 'Bank',
    currency: 'USD',
    initialBalance: 5000.00,
  },
  creditCard: {
    name: 'E2E Credit Card',
    type: 'CreditCard',
    currency: 'USD',
    creditLimit: 10000.00,
  },
};

export const testBudgets = {
  monthly: {
    name: 'E2E Monthly Budget',
    amount: 2000.00,
    period: 'Monthly',
    categories: ['Food & Dining', 'Entertainment'],
  },
  weekly: {
    name: 'E2E Weekly Budget',
    amount: 500.00,
    period: 'Weekly',
    categories: ['Food & Dining'],
  },
};

export const testCategories = [
  { name: 'Food & Dining', icon: '🍔', color: '#F59E0B' },
  { name: 'Entertainment', icon: '🎬', color: '#8B5CF6' },
  { name: 'Transportation', icon: '🚗', color: '#3B82F6' },
  { name: 'Shopping', icon: '🛒', color: '#EC4899' },
  { name: 'Income', icon: '💰', color: '#10B981' },
];

export const quickAmounts = [10, 20, 50, 100, 200, 500];

export const periods = [
  { key: '7d', label: '7D', days: 7 },
  { key: '30d', label: '30D', days: 30 },
  { key: '90d', label: '90D', days: 90 },
  { key: '1y', label: '1Y', days: 365 },
];