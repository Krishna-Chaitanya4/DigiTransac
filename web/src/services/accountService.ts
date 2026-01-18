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
  includeInNetWorth: boolean;
  order: number;
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

export interface AccountSummary {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  balancesByType: Record<string, number>;
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
export const accountTypeConfig: Record<AccountType, { label: string; icon: string; defaultColor: string; isLiability: boolean }> = {
  Bank: { label: 'Bank Account', icon: '🏦', defaultColor: '#3B82F6', isLiability: false },
  CreditCard: { label: 'Credit Card', icon: '💳', defaultColor: '#EF4444', isLiability: true },
  Cash: { label: 'Cash', icon: '💵', defaultColor: '#10B981', isLiability: false },
  DigitalWallet: { label: 'Digital Wallet', icon: '📱', defaultColor: '#8B5CF6', isLiability: false },
  Investment: { label: 'Investment', icon: '📈', defaultColor: '#F59E0B', isLiability: false },
  Loan: { label: 'Loan', icon: '🏠', defaultColor: '#DC2626', isLiability: true },
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

// Format currency
export function formatCurrency(amount: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
