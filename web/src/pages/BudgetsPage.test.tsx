import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BudgetsPage from './BudgetsPage';
import * as budgetService from '../services/budgetService';
import * as labelService from '../services/labelService';
import * as accountService from '../services/accountService';
import { CurrencyProvider } from '../context/CurrencyContext';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import { BrowserRouter } from 'react-router-dom';
import type { Budget, BudgetSummary } from '../types/budgets';
import type { Label } from '../types/labels';
import type { Account } from '../types/accounts';

// Mock the services
vi.mock('../services/budgetService', async () => {
  const actual = await vi.importActual('../services/budgetService');
  return {
    ...actual,
    getBudgets: vi.fn(),
    createBudget: vi.fn(),
    updateBudget: vi.fn(),
    deleteBudget: vi.fn(),
  };
});

vi.mock('../services/labelService', async () => {
  const actual = await vi.importActual('../services/labelService');
  return {
    ...actual,
    getLabels: vi.fn(),
  };
});

vi.mock('../services/accountService', async () => {
  const actual = await vi.importActual('../services/accountService');
  return {
    ...actual,
    getAccounts: vi.fn(),
  };
});

vi.mock('../services/currencyService', async () => {
  const actual = await vi.importActual('../services/currencyService');
  return {
    ...actual,
    formatCurrency: (amount: number, currency: string) => `${currency} ${amount}`,
    getCurrencySymbol: (code: string) => code === 'INR' ? '₹' : '$',
    getExchangeRates: vi.fn().mockResolvedValue({
      baseCurrency: 'USD',
      rates: { USD: 1, INR: 83 },
      lastUpdated: '2024-01-01T00:00:00Z',
      source: 'mock',
    }),
    getSupportedCurrencies: vi.fn().mockResolvedValue([
      { code: 'USD', name: 'US Dollar', symbol: '$' },
      { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
    ]),
  };
});

// Test wrapper with providers
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <CurrencyProvider>{children}</CurrencyProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

const renderWithProviders = (ui: React.ReactElement) => {
  return render(ui, { wrapper: TestWrapper });
};

// Mock data
const mockLabels: Label[] = [
  { id: 'label-1', name: 'Groceries', icon: '🛒', color: '#22c55e', parentId: null, type: 'Category', isSystem: false, order: 0, createdAt: '2024-01-01T00:00:00Z' },
  { id: 'label-2', name: 'Food & Dining', icon: '🍔', color: '#F97316', parentId: null, type: 'Category', isSystem: false, order: 1, createdAt: '2024-01-01T00:00:00Z' },
];

const mockAccounts: Account[] = [
  {
    id: 'acc-1',
    name: 'HDFC Savings',
    type: 'Bank',
    icon: null,
    color: null,
    currency: 'INR',
    initialBalance: 50000,
    currentBalance: 75000,
    institution: 'HDFC Bank',
    accountNumber: '****1234',
    notes: null,
    isArchived: false,
    isDefault: true,
    includeInNetWorth: true,
    order: 0,
    canEditCurrency: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

const createMockBudget = (overrides: Partial<Budget> = {}): Budget => ({
  id: `budget-${Math.random().toString(36).substr(2, 9)}`,
  name: 'Test Budget',
  amount: 10000,
  currency: 'INR',
  period: 'Monthly',
  periodStartDay: 1,
  amountSpent: 5000,
  amountRemaining: 5000,
  percentUsed: 50,
  daysRemaining: 15,
  startDate: '2024-01-01',
  endDate: '2024-01-31',
  labels: [],
  accounts: [],
  icon: undefined,
  color: undefined,
  description: undefined,
  spendingByCurrency: undefined,
  ...overrides,
});

const mockBudgets: Budget[] = [
  createMockBudget({ id: 'budget-1', name: 'Groceries Budget', amount: 10000, amountSpent: 5000, percentUsed: 50 }),
  createMockBudget({ id: 'budget-2', name: 'Dining Out', amount: 5000, amountSpent: 6000, percentUsed: 120 }),
  createMockBudget({ id: 'budget-3', name: 'Entertainment', amount: 3000, amountSpent: 2500, percentUsed: 83 }),
];

const mockBudgetSummary: BudgetSummary = {
  budgets: mockBudgets,
  activeBudgets: 3,
  overBudgetCount: 1,
  totalBudgetAmount: 18000,
  totalSpent: 13500,
  currency: 'INR',
};

const emptyBudgetSummary: BudgetSummary = {
  budgets: [],
  activeBudgets: 0,
  overBudgetCount: 0,
  totalBudgetAmount: 0,
  totalSpent: 0,
  currency: 'INR',
};

describe('BudgetsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(labelService.getLabels).mockResolvedValue(mockLabels);
    vi.mocked(accountService.getAccounts).mockResolvedValue(mockAccounts);
  });

  describe('Initial Rendering', () => {
    it('should render page title and description', async () => {
      vi.mocked(budgetService.getBudgets).mockResolvedValue(mockBudgetSummary);

      renderWithProviders(<BudgetsPage />);

      expect(screen.getByText('Budgets')).toBeInTheDocument();
      expect(screen.getByText('Track spending limits for your categories')).toBeInTheDocument();
    });

    it('should render loading state initially', () => {
      vi.mocked(budgetService.getBudgets).mockImplementation(() => new Promise(() => {}));

      renderWithProviders(<BudgetsPage />);

      expect(screen.getByText('Budgets')).toBeInTheDocument();
    });

    it('should render budgets after loading', async () => {
      vi.mocked(budgetService.getBudgets).mockResolvedValue(mockBudgetSummary);

      renderWithProviders(<BudgetsPage />);

      await waitFor(() => {
        expect(screen.getByText('Groceries Budget')).toBeInTheDocument();
      });
      expect(screen.getByText('Dining Out')).toBeInTheDocument();
      expect(screen.getByText('Entertainment')).toBeInTheDocument();
    });

    it('should display overview cards with stats', async () => {
      vi.mocked(budgetService.getBudgets).mockResolvedValue(mockBudgetSummary);

      renderWithProviders(<BudgetsPage />);

      await waitFor(() => {
        expect(screen.getByText('Active Budgets')).toBeInTheDocument();
      });
      expect(screen.getByText('Total Budgeted')).toBeInTheDocument();
      expect(screen.getByText('Total Spent')).toBeInTheDocument();
      expect(screen.getByText('Exceeded')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no budgets exist', async () => {
      vi.mocked(budgetService.getBudgets).mockResolvedValue(emptyBudgetSummary);

      renderWithProviders(<BudgetsPage />);

      await waitFor(() => {
        expect(screen.getByText('No budgets yet')).toBeInTheDocument();
      });
      expect(screen.getByText('Create budgets to track spending limits for your categories.')).toBeInTheDocument();
      expect(screen.getByText('Create Your First Budget')).toBeInTheDocument();
    });
  });

  describe('Create Budget', () => {
    it('should have Create Budget button visible', async () => {
      vi.mocked(budgetService.getBudgets).mockResolvedValue(mockBudgetSummary);

      renderWithProviders(<BudgetsPage />);

      await waitFor(() => {
        expect(screen.getByText('Groceries Budget')).toBeInTheDocument();
      });

      expect(screen.getByText('Create Budget')).toBeInTheDocument();
    });
  });

  describe('Filter and Search', () => {
    it('should render status filter buttons', async () => {
      vi.mocked(budgetService.getBudgets).mockResolvedValue(mockBudgetSummary);

      renderWithProviders(<BudgetsPage />);

      await waitFor(() => {
        expect(screen.getByText('All')).toBeInTheDocument();
      });
      expect(screen.getByText('On Track')).toBeInTheDocument();
      expect(screen.getByText('Warning')).toBeInTheDocument();
      expect(screen.getByText('Exceeded')).toBeInTheDocument();
    });

    it('should render search input', async () => {
      vi.mocked(budgetService.getBudgets).mockResolvedValue(mockBudgetSummary);

      renderWithProviders(<BudgetsPage />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search budgets...')).toBeInTheDocument();
      });
    });

    it('should filter budgets when filter is clicked', async () => {
      vi.mocked(budgetService.getBudgets).mockResolvedValue(mockBudgetSummary);

      renderWithProviders(<BudgetsPage />);

      await waitFor(() => {
        expect(screen.getByText('Dining Out')).toBeInTheDocument();
      });

      // Click "Exceeded" filter
      const exceededButton = screen.getByText('Exceeded');
      fireEvent.click(exceededButton);

      // Only "Dining Out" should be visible as it's over budget (120%)
      await waitFor(() => {
        expect(screen.getByText('Dining Out')).toBeInTheDocument();
      });
      // "Groceries Budget" should not be visible as it's on track
      expect(screen.queryByText('Groceries Budget')).not.toBeInTheDocument();
    });
  });

  describe('Budget Status', () => {
    it('should show exceeded count when budgets are over limit', async () => {
      vi.mocked(budgetService.getBudgets).mockResolvedValue(mockBudgetSummary);

      renderWithProviders(<BudgetsPage />);

      await waitFor(() => {
        expect(screen.getByText('Exceeded')).toBeInTheDocument();
      });
      // There's 1 exceeded budget
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('Needs attention')).toBeInTheDocument();
    });
  });
});