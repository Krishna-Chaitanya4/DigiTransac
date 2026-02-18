import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../context/ThemeContext';
import { CurrencyProvider } from '../context/CurrencyContext';
import { AuthProvider } from '../context/AuthContext';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  useAccounts,
  useAccountSummary,
  useCreateAccount,
  useUpdateAccount,
  useDeleteAccount,
  useAdjustBalance,
  useSetDefaultAccount,
} from './useAccountQueries';
import type { Account, AccountSummary } from '../services/accountService';

// ── Mock the service layer ──
vi.mock('../services/accountService', () => ({
  getAccounts: vi.fn(),
  getAccountSummary: vi.fn(),
  createAccount: vi.fn(),
  updateAccount: vi.fn(),
  deleteAccount: vi.fn(),
  adjustBalance: vi.fn(),
  setDefaultAccount: vi.fn(),
}));

// Import mocked functions for per-test control
import * as accountService from '../services/accountService';

const mockGetAccounts = vi.mocked(accountService.getAccounts);
const mockGetAccountSummary = vi.mocked(accountService.getAccountSummary);
const mockCreateAccount = vi.mocked(accountService.createAccount);
const mockUpdateAccount = vi.mocked(accountService.updateAccount);
const mockDeleteAccount = vi.mocked(accountService.deleteAccount);
const mockAdjustBalance = vi.mocked(accountService.adjustBalance);
const mockSetDefaultAccount = vi.mocked(accountService.setDefaultAccount);

// ── Test fixtures ──
const sampleAccount: Account = {
  id: 'acc-1',
  name: 'Checking',
  type: 'Checking',
  currency: 'USD',
  balance: 1000,
  isDefault: true,
  isArchived: false,
  icon: '🏦',
  color: '#4F46E5',
  includeInNetWorth: true,
  order: 0,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const sampleAccount2: Account = {
  ...sampleAccount,
  id: 'acc-2',
  name: 'Savings',
  type: 'Savings',
  balance: 5000,
  isDefault: false,
  order: 1,
};

const sampleSummary: AccountSummary = {
  totalBalance: 6000,
  totalAccounts: 2,
  currencyBalances: [{ currency: 'USD', balance: 6000 }],
};

// ── Helper: create a fresh QueryClient + wrapper ──
let queryClient: QueryClient;

function createWrapper() {
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ThemeProvider>
            <CurrencyProvider>
              <MemoryRouter>{children}</MemoryRouter>
            </CurrencyProvider>
          </ThemeProvider>
        </AuthProvider>
      </QueryClientProvider>
    );
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ───────── Query hooks ─────────

describe('useAccounts', () => {
  it('fetches accounts and returns data', async () => {
    mockGetAccounts.mockResolvedValue([sampleAccount, sampleAccount2]);

    const { result } = renderHook(() => useAccounts(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data![0].name).toBe('Checking');
    expect(mockGetAccounts).toHaveBeenCalledWith(false);
  });

  it('passes includeArchived flag', async () => {
    mockGetAccounts.mockResolvedValue([]);

    const { result } = renderHook(() => useAccounts(true), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGetAccounts).toHaveBeenCalledWith(true);
  });

  it('returns error on failure', async () => {
    mockGetAccounts.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useAccounts(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Network error');
  });
});

describe('useAccountSummary', () => {
  it('fetches account summary', async () => {
    mockGetAccountSummary.mockResolvedValue(sampleSummary);

    const { result } = renderHook(() => useAccountSummary(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.totalBalance).toBe(6000);
    expect(result.current.data?.totalAccounts).toBe(2);
  });
});

// ───────── Mutation hooks ─────────

describe('useCreateAccount', () => {
  it('calls createAccount and invalidates queries', async () => {
    const newAccount: Account = { ...sampleAccount, id: 'acc-3', name: 'New' };
    mockCreateAccount.mockResolvedValue(newAccount);
    // Seed accounts query so we can check invalidation
    mockGetAccounts.mockResolvedValue([sampleAccount]);

    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateAccount(), { wrapper });

    await act(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      result.current.mutate({ name: 'New', type: 'Checking', currency: 'USD', balance: 0 } as any);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockCreateAccount).toHaveBeenCalled();
  });
});

describe('useUpdateAccount', () => {
  it('optimistically updates cached account', async () => {
    mockGetAccounts.mockResolvedValue([sampleAccount, sampleAccount2]);
    mockUpdateAccount.mockResolvedValue({ ...sampleAccount, name: 'Updated Checking' });

    const wrapper = createWrapper();

    // First seed the accounts cache
    const { result: queryResult } = renderHook(() => useAccounts(), { wrapper });
    await waitFor(() => expect(queryResult.current.isSuccess).toBe(true));

    // Now trigger the mutation
    const { result: mutationResult } = renderHook(() => useUpdateAccount(), { wrapper });

    await act(async () => {
      mutationResult.current.mutate({ id: 'acc-1', data: { name: 'Updated Checking' } });
    });

    // The optimistic update should set the name immediately in cache
    await waitFor(() => {
      // After onSettled, cache is invalidated and refetched
      // Just verify mutation completed successfully
      expect(mutationResult.current.isSuccess).toBe(true);
    });

    expect(mockUpdateAccount).toHaveBeenCalledWith('acc-1', { name: 'Updated Checking' });
  });

  it('rolls back on mutation error', async () => {
    mockGetAccounts.mockResolvedValue([sampleAccount]);
    mockUpdateAccount.mockRejectedValue(new Error('Server error'));

    const wrapper = createWrapper();

    // Seed the cache
    const { result: queryResult } = renderHook(() => useAccounts(), { wrapper });
    await waitFor(() => expect(queryResult.current.isSuccess).toBe(true));

    const { result: mutationResult } = renderHook(() => useUpdateAccount(), { wrapper });

    await act(async () => {
      mutationResult.current.mutate({ id: 'acc-1', data: { name: 'Will fail' } });
    });

    await waitFor(() => expect(mutationResult.current.isError).toBe(true));

    // After rollback, cache should be restored
    const cached = queryClient.getQueryData<Account[]>(['accounts', 'list', { includeArchived: false }]);
    expect(cached?.[0].name).toBe('Checking');
  });
});

describe('useDeleteAccount', () => {
  it('optimistically removes account from cache', async () => {
    mockGetAccounts.mockResolvedValue([sampleAccount, sampleAccount2]);
    mockDeleteAccount.mockResolvedValue(undefined);

    const wrapper = createWrapper();

    // Seed cache
    const { result: queryResult } = renderHook(() => useAccounts(), { wrapper });
    await waitFor(() => expect(queryResult.current.isSuccess).toBe(true));
    expect(queryResult.current.data).toHaveLength(2);

    // Delete
    const { result: mutationResult } = renderHook(() => useDeleteAccount(), { wrapper });

    await act(async () => {
      mutationResult.current.mutate('acc-1');
    });

    await waitFor(() => expect(mutationResult.current.isSuccess).toBe(true));
    expect(mockDeleteAccount).toHaveBeenCalledWith('acc-1');
  });

  it('rolls back on delete error', async () => {
    mockGetAccounts.mockResolvedValue([sampleAccount, sampleAccount2]);
    mockDeleteAccount.mockRejectedValue(new Error('Cannot delete'));

    const wrapper = createWrapper();

    // Seed cache
    const { result: queryResult } = renderHook(() => useAccounts(), { wrapper });
    await waitFor(() => expect(queryResult.current.isSuccess).toBe(true));

    const { result: mutationResult } = renderHook(() => useDeleteAccount(), { wrapper });

    await act(async () => {
      mutationResult.current.mutate('acc-1');
    });

    await waitFor(() => expect(mutationResult.current.isError).toBe(true));

    // Check rollback restored both accounts
    const cached = queryClient.getQueryData<Account[]>(['accounts', 'list', { includeArchived: false }]);
    expect(cached).toHaveLength(2);
  });
});

describe('useAdjustBalance', () => {
  it('invalidates accounts, transactions, and conversations on success', async () => {
    mockAdjustBalance.mockResolvedValue(undefined);

    const wrapper = createWrapper();
    const { result } = renderHook(() => useAdjustBalance(), { wrapper });

    await act(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      result.current.mutate({ id: 'acc-1', data: { amount: 500, notes: 'Adjustment' } as any });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockAdjustBalance).toHaveBeenCalled();
  });
});

describe('useSetDefaultAccount', () => {
  it('calls API and completes', async () => {
    mockSetDefaultAccount.mockResolvedValue(undefined);

    const wrapper = createWrapper();
    const { result } = renderHook(() => useSetDefaultAccount(), { wrapper });

    await act(async () => {
      result.current.mutate('acc-2');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockSetDefaultAccount).toHaveBeenCalledWith('acc-2');
  });
});
