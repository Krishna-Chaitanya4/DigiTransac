import { apiClient } from './apiClient';

// Types
export interface Account {
  id: string;
  name: string;
  type: AccountType;
  icon: string | null;
  color: string | null;
  currency: string;
  initialBalance: number;
  currentBalance: number;
  institution: string | null;
  accountNumber: string | null;
  notes: string | null;
  isArchived: boolean;
  isDefault: boolean;
  includeInNetWorth: boolean;
  order: number;
  canEditCurrency: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AccountType = 
  | 'Bank'
  | 'CreditCard'
  | 'Cash'
  | 'DigitalWallet'
  | 'Investment'
  | 'Loan';

export interface CurrencyBalances {
  assets: number;
  liabilities: number;
  netWorth: number;
  assetsConverted: number;
  liabilitiesConverted: number;
  netWorthConverted: number;
}

export interface AccountSummary {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  balancesByType: Record<string, number>;
  primaryCurrency: string;
  balancesByCurrency: Record<string, CurrencyBalances>;
  ratesLastUpdated: string | null;
}

export interface CreateAccountRequest {
  name: string;
  type: AccountType;
  icon?: string | null;
  color?: string | null;
  currency?: string;
  initialBalance?: number;
  institution?: string | null;
  accountNumber?: string | null;
  notes?: string | null;
  includeInNetWorth?: boolean;
}

export interface UpdateAccountRequest {
  name?: string;
  icon?: string | null;
  color?: string | null;
  currency?: string;
  institution?: string | null;
  accountNumber?: string | null;
  notes?: string | null;
  isArchived?: boolean;
  includeInNetWorth?: boolean;
  order?: number;
}

export interface AdjustBalanceRequest {
  newBalance: number;
  notes?: string;
}

// Account type configuration
export const accountTypeConfig: Record<AccountType, { label: string; icon: string; defaultColor: string; darkColor: string; isLiability: boolean }> = {
  Bank: { label: 'Bank Account', icon: '🏦', defaultColor: '#3B82F6', darkColor: '#1e3a5f', isLiability: false },
  CreditCard: { label: 'Credit Card', icon: '💳', defaultColor: '#EF4444', darkColor: '#7f1d1d', isLiability: true },
  Cash: { label: 'Cash', icon: '💵', defaultColor: '#10B981', darkColor: '#064e3b', isLiability: false },
  DigitalWallet: { label: 'Digital Wallet', icon: '📱', defaultColor: '#8B5CF6', darkColor: '#4c1d95', isLiability: false },
  Investment: { label: 'Investment', icon: '📈', defaultColor: '#F59E0B', darkColor: '#78350f', isLiability: false },
  Loan: { label: 'Loan', icon: '🏠', defaultColor: '#DC2626', darkColor: '#7f1d1d', isLiability: true },
};

// Get all accounts
export async function getAccounts(includeArchived = false): Promise<Account[]> {
  return apiClient.get<Account[]>(`/accounts?includeArchived=${includeArchived}`);
}

// Get account summary
export async function getAccountSummary(): Promise<AccountSummary> {
  return apiClient.get<AccountSummary>('/accounts/summary');
}

// Get single account
export async function getAccount(id: string): Promise<Account> {
  return apiClient.get<Account>(`/accounts/${id}`);
}

// Create account
export async function createAccount(request: CreateAccountRequest): Promise<Account> {
  return apiClient.post<Account>('/accounts', request);
}

// Update account
export async function updateAccount(id: string, request: UpdateAccountRequest): Promise<Account> {
  return apiClient.put<Account>(`/accounts/${id}`, request);
}

// Adjust balance
export async function adjustBalance(id: string, request: AdjustBalanceRequest): Promise<void> {
  return apiClient.post<void>(`/accounts/${id}/adjust-balance`, request);
}

// Reorder accounts
export async function reorderAccounts(items: { id: string; order: number }[]): Promise<void> {
  return apiClient.post<void>('/accounts/reorder', { items });
}

// Delete account
export async function deleteAccount(id: string): Promise<void> {
  return apiClient.delete<void>(`/accounts/${id}`);
}

// Set default account
export async function setDefaultAccount(id: string): Promise<void> {
  return apiClient.post<void>(`/accounts/${id}/set-default`, {});
}

// Format currency
export function formatCurrency(amount: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
