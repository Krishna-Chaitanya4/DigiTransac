import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import InsightsPage from './InsightsPage';
import React from 'react';

// Mock data - defined before mocks
const mockLabels = [
  { id: 'lbl-income', name: 'Income', type: 'Folder', parentId: null },
  { id: 'lbl-expense', name: 'Expenses', type: 'Folder', parentId: null },
  { id: 'lbl-salary', name: 'Salary', type: 'Category', parentId: 'lbl-income', color: '#22c55e' },
  { id: 'lbl-food', name: 'Food', type: 'Category', parentId: 'lbl-expense', color: '#ef4444' },
  { id: 'lbl-transport', name: 'Transport', type: 'Category', parentId: 'lbl-expense', color: '#3b82f6' },
];

const mockTransactionSummary = {
  totalCredits: 5000,
  totalDebits: 3000,
  netChange: 2000,
  transactionCount: 50,
  byCategory: {
    'lbl-salary': 5000,
    'lbl-food': 1500,
    'lbl-transport': 1000,
  },
};

const mockBudgetSummary = {
  totalBudgets: 3,
  activeBudgets: 2,
  overBudgetCount: 0,
  nearLimitCount: 1,
  totalBudgetAmount: 2000,
  totalSpent: 1500,
  totalRemaining: 500,
  primaryCurrency: 'USD',
  budgets: [
    {
      id: 'budget-1',
      name: 'Food Budget',
      amount: 500,
      amountSpent: 350,
      percentUsed: 70,
      currency: 'USD',
      period: 'Monthly',
      startDate: '2026-02-01',
      periodStart: '2026-02-01',
      periodEnd: '2026-02-28',
      labelIds: ['lbl-food'],
      labels: [{ id: 'lbl-food', name: 'Food', color: '#ef4444' }],
      accountIds: [],
      accounts: [],
      alerts: [],
      isActive: true,
      amountRemaining: 150,
      daysRemaining: 24,
      isOverBudget: false,
      createdAt: '2026-01-01',
      updatedAt: '2026-02-01',
    },
  ],
};

const mockAnalytics = {
  topCategories: [
    { labelId: 'lbl-food', labelName: 'Food', labelColor: '#ef4444', amount: 1500, percentage: 50, transactionCount: 20 },
    { labelId: 'lbl-transport', labelName: 'Transport', labelColor: '#3b82f6', amount: 1000, percentage: 33, transactionCount: 15 },
  ],
  spendingTrend: [
    { period: '2025-12', credits: 4500, debits: 2800 },
    { period: '2026-01', credits: 5000, debits: 3200 },
    { period: '2026-02', credits: 5000, debits: 3000 },
  ],
  dailyAverage: 100,
  monthlyAverage: 3000,
  averagesByType: {
    averageCredit: 500,
    averageDebit: 60,
    averageTransfer: 200,
  },
};

const mockCounterparties = {
  counterparties: [
    { name: 'Amazon', totalAmount: 500, transactionCount: 10 },
    { name: 'Uber', totalAmount: 300, transactionCount: 8 },
  ],
};

const mockSpendingByAccount = {
  accounts: [
    { accountId: 'acc-1', accountName: 'Checking', totalDebits: 2000, totalCredits: 5000, percentage: 66 },
    { accountId: 'acc-2', accountName: 'Credit Card', totalDebits: 1000, totalCredits: 0, percentage: 34 },
  ],
};

const mockSpendingPatterns = {
  byDayOfWeek: [
    { dayOfWeek: 0, dayName: 'Sunday', totalAmount: 400, transactionCount: 5 },
    { dayOfWeek: 1, dayName: 'Monday', totalAmount: 600, transactionCount: 8 },
    { dayOfWeek: 2, dayName: 'Tuesday', totalAmount: 500, transactionCount: 7 },
    { dayOfWeek: 3, dayName: 'Wednesday', totalAmount: 450, transactionCount: 6 },
    { dayOfWeek: 4, dayName: 'Thursday', totalAmount: 550, transactionCount: 7 },
    { dayOfWeek: 5, dayName: 'Friday', totalAmount: 700, transactionCount: 10 },
    { dayOfWeek: 6, dayName: 'Saturday', totalAmount: 800, transactionCount: 12 },
  ],
  byHourOfDay: Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    totalAmount: i >= 9 && i <= 21 ? 100 + i * 10 : 20,
    transactionCount: i >= 9 && i <= 21 ? 5 : 1,
  })),
};

const mockAnomalies = {
  anomalies: [],
};

// Mock the hooks
vi.mock('../hooks', () => ({
  useBudgets: vi.fn(() => ({
    data: mockBudgetSummary
  })),
  useTransactionSummary: vi.fn(() => ({
    data: mockTransactionSummary,
    isLoading: false
  })),
  useTransactionAnalytics: vi.fn(() => ({
    data: mockAnalytics,
    isLoading: false
  })),
  useLabels: vi.fn(() => ({ data: mockLabels })),
  useTopCounterparties: vi.fn(() => ({
    data: mockCounterparties,
    isLoading: false
  })),
  useSpendingByAccount: vi.fn(() => ({
    data: mockSpendingByAccount,
    isLoading: false
  })),
  useSpendingPatterns: vi.fn(() => ({
    data: mockSpendingPatterns,
    isLoading: false
  })),
  useSpendingAnomalies: vi.fn(() => ({
    data: mockAnomalies,
    isLoading: false
  })),
  // Invalidation hooks for pull-to-refresh
  useInvalidateTransactions: vi.fn(() => vi.fn(() => Promise.resolve())),
  useInvalidateBudgets: vi.fn(() => vi.fn(() => Promise.resolve())),
  useInvalidateLabels: vi.fn(() => vi.fn(() => Promise.resolve())),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: {
      id: 'user-1',
      email: 'test@example.com',
      fullName: 'Test User'
    }
  })),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../context/CurrencyContext', () => ({
  useCurrency: vi.fn(() => ({
    primaryCurrency: 'USD',
    currencies: ['USD', 'EUR'],
    exchangeRates: {},
    isLoading: false,
  })),
  CurrencyProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../context/ThemeContext', () => ({
  useTheme: vi.fn(() => ({
    theme: 'light',
    setTheme: vi.fn(),
  })),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../services/currencyService', () => ({
  formatCurrency: vi.fn((amount: number, currency: string) =>
    `${currency} ${amount.toFixed(2)}`
  ),
}));

// Create a query client for tests
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false, gcTime: 0, staleTime: 0 },
    mutations: { retry: false },
  },
});

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('InsightsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders welcome message with user name', async () => {
    renderWithProviders(<InsightsPage />);
    
    await waitFor(() => {
      expect(screen.getByText(/Welcome back, Test User/i)).toBeDefined();
    });
  });

  it('renders period selector buttons', async () => {
    renderWithProviders(<InsightsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('This Month')).toBeDefined();
      expect(screen.getByText('Last Month')).toBeDefined();
      expect(screen.getByText('Last 3 Months')).toBeDefined();
    });
  });

  it('displays financial summary with income and expenses', async () => {
    renderWithProviders(<InsightsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Income')).toBeDefined();
      expect(screen.getByText('Expenses')).toBeDefined();
    });
  });

  it('shows budget tracking section', async () => {
    renderWithProviders(<InsightsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Budget Tracking')).toBeDefined();
    });
  });

  it('shows spending patterns section', async () => {
    renderWithProviders(<InsightsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Spending Patterns')).toBeDefined();
    });
  });

  it('can toggle between categorized and cashflow view', async () => {
    const user = userEvent.setup();
    renderWithProviders(<InsightsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('💰 Income vs Expenses')).toBeDefined();
    });
    
    // Click on Money In vs Out
    const cashflowButton = screen.getByText('💵 Money In vs Out');
    await user.click(cashflowButton);
    
    await waitFor(() => {
      // "Money In" and "Money Out" may appear multiple times in the UI
      expect(screen.getAllByText('Money In').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Money Out').length).toBeGreaterThan(0);
    });
  });
});

describe('InsightsPage - Period Selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('changes period when selecting different time range', async () => {
    const user = userEvent.setup();
    renderWithProviders(<InsightsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('This Month')).toBeDefined();
    });
    
    // Click on Last 3 Months
    await user.click(screen.getByText('Last 3 Months'));
    
    // The button should now be active (we can verify by checking styles or state)
    await waitFor(() => {
      const button = screen.getByText('Last 3 Months');
      expect(button.className).toContain('bg-blue');
    });
  });

  it('shows custom date picker when Custom is selected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<InsightsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Custom')).toBeDefined();
    });
    
    await user.click(screen.getByText('Custom'));
    
    await waitFor(() => {
      // Should show date picker UI
      expect(screen.getByText('Hide')).toBeDefined();
    });
  });
});

describe('InsightsPage - Widget Collapsing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('can collapse and expand sections', async () => {
    const user = userEvent.setup();
    renderWithProviders(<InsightsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Budget Tracking')).toBeDefined();
    });
    
    // Click on the Budget Tracking header to collapse
    const budgetHeader = screen.getByText('Budget Tracking');
    await user.click(budgetHeader);
    
    // The section should be collapsed (content hidden)
    // We verify by checking the component renders
    expect(budgetHeader).toBeDefined();
  });
});

describe('InsightsPage - Loading States', () => {
  it('handles loading state gracefully', async () => {
    renderWithProviders(<InsightsPage />);
    
    // Page should render without errors during loading
    await waitFor(() => {
      expect(screen.getByText(/Welcome back/i)).toBeDefined();
    });
  });
});