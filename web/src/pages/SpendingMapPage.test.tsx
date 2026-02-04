import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SpendingMapPage from './SpendingMapPage';
import * as transactionService from '../services/transactionService';
import * as labelService from '../services/labelService';
import { CurrencyProvider } from '../context/CurrencyContext';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import { BrowserRouter } from 'react-router-dom';
import type { Transaction, TransactionListResponse, LocationInsightsResponse, TripGroupsResponse } from '../types/transactions';
import type { Label } from '../types/labels';

// Mock the services
vi.mock('../services/transactionService', async () => {
  const actual = await vi.importActual('../services/transactionService');
  return {
    ...actual,
    getTransactions: vi.fn(),
    getLocationInsights: vi.fn(),
    getTripGroups: vi.fn(),
  };
});

vi.mock('../services/labelService', async () => {
  const actual = await vi.importActual('../services/labelService');
  return {
    ...actual,
    getLabels: vi.fn(),
  };
});

vi.mock('../services/currencyService', async () => {
  const actual = await vi.importActual('../services/currencyService');
  return {
    ...actual,
    formatCurrency: (amount: number, currency: string) => `${currency} ${amount}`,
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

// Mock Leaflet to avoid DOM issues in tests
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="marker">{children}</div>
  ),
  Popup: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="popup">{children}</div>
  ),
  useMap: () => ({
    fitBounds: vi.fn(),
  }),
  CircleMarker: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="circle-marker">{children}</div>
  ),
}));

vi.mock('react-leaflet-cluster', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="marker-cluster">{children}</div>
  ),
}));

vi.mock('leaflet', () => {
  const mockL = {
    icon: () => ({}),
    divIcon: () => ({}),
    latLngBounds: () => ({}),
    Marker: {
      prototype: {
        options: {},
      },
    },
    point: () => ({}),
  };
  return {
    ...mockL,
    default: mockL,
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

const createMockTransactionWithLocation = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: `txn-${Math.random().toString(36).substr(2, 9)}`,
  accountId: 'acc-1',
  type: 'Send',
  amount: 1000,
  currency: 'INR',
  date: '2024-01-15',
  title: 'Test Transaction',
  payee: 'Test Payee',
  notes: undefined,
  splits: [{ labelId: 'label-1', amount: 1000, notes: undefined }],
  tagIds: [],
  tags: [],
  location: {
    latitude: 12.9716,
    longitude: 77.5946,
    placeName: 'Bangalore',
    city: 'Bangalore',
    country: 'India',
  },
  isRecurringTemplate: false,
  status: 'Confirmed',
  createdAt: '2024-01-15T10:00:00Z',
  updatedAt: '2024-01-15T10:00:00Z',
  ...overrides,
});

const mockTransactionsWithLocations: Transaction[] = [
  createMockTransactionWithLocation({ id: 'txn-1', payee: 'Restaurant A' }),
  createMockTransactionWithLocation({
    id: 'txn-2',
    payee: 'Grocery Store',
    location: { latitude: 13.0827, longitude: 80.2707, placeName: 'Chennai', city: 'Chennai', country: 'India' },
  }),
  createMockTransactionWithLocation({
    id: 'txn-3',
    payee: 'Coffee Shop',
    location: { latitude: 12.9716, longitude: 77.5946, placeName: 'Bangalore', city: 'Bangalore', country: 'India' },
  }),
];

const mockTransactionsWithoutLocations: Transaction[] = [
  {
    id: 'txn-no-loc-1',
    accountId: 'acc-1',
    type: 'Send',
    amount: 500,
    currency: 'INR',
    date: '2024-01-15',
    title: 'No Location Transaction',
    payee: 'Some Payee',
    notes: undefined,
    splits: [{ labelId: 'label-1', amount: 500, notes: undefined }],
    tagIds: [],
    tags: [],
    isRecurringTemplate: false,
    status: 'Confirmed',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
  },
];

const mockTransactionListResponse = (transactions: Transaction[]): TransactionListResponse => ({
  transactions,
  totalCount: transactions.length,
  page: 1,
  pageSize: 1000,
  totalPages: 1,
});

const mockLocationInsightsResponse: LocationInsightsResponse = {
  totalTransactions: 3,
  transactionsWithLocation: 3,
  totalSpendingWithLocation: 3000,
  nearbySpending: undefined,
  topLocations: [],
  currency: 'INR',
};

const mockTripGroupsResponse: TripGroupsResponse = {
  trips: [],
  totalTripSpending: 0,
  totalTripTransactions: 0,
  currency: 'INR',
};

describe('SpendingMapPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(labelService.getLabels).mockResolvedValue(mockLabels);
    vi.mocked(transactionService.getLocationInsights).mockResolvedValue(mockLocationInsightsResponse);
    vi.mocked(transactionService.getTripGroups).mockResolvedValue(mockTripGroupsResponse);
  });

  describe('Initial Rendering', () => {
    it('should render page title and description', async () => {
      vi.mocked(transactionService.getTransactions).mockResolvedValue(
        mockTransactionListResponse(mockTransactionsWithLocations)
      );

      renderWithProviders(<SpendingMapPage />);

      expect(screen.getByText('Spending Map')).toBeInTheDocument();
      expect(screen.getByText('Visualize where you spend money')).toBeInTheDocument();
    });

    it('should render loading state initially', () => {
      vi.mocked(transactionService.getTransactions).mockImplementation(() => new Promise(() => {}));

      renderWithProviders(<SpendingMapPage />);

      expect(screen.getByText('Spending Map')).toBeInTheDocument();
    });

    it('should render map after loading transactions with locations', async () => {
      vi.mocked(transactionService.getTransactions).mockResolvedValue(
        mockTransactionListResponse(mockTransactionsWithLocations)
      );

      renderWithProviders(<SpendingMapPage />);

      await waitFor(() => {
        expect(screen.getByTestId('map-container')).toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no transactions have locations', async () => {
      vi.mocked(transactionService.getTransactions).mockResolvedValue(
        mockTransactionListResponse(mockTransactionsWithoutLocations)
      );

      renderWithProviders(<SpendingMapPage />);

      await waitFor(() => {
        expect(screen.getByText('No transactions with locations')).toBeInTheDocument();
      });
      expect(screen.getByText(/Enable location when creating transactions/)).toBeInTheDocument();
      expect(screen.getByText('Add Transaction')).toBeInTheDocument();
    });

    it('should show empty state when no transactions exist', async () => {
      vi.mocked(transactionService.getTransactions).mockResolvedValue(
        mockTransactionListResponse([])
      );

      renderWithProviders(<SpendingMapPage />);

      await waitFor(() => {
        expect(screen.getByText('No transactions with locations')).toBeInTheDocument();
      });
    });
  });

  describe('Date Filters', () => {
    it('should render date filter options', async () => {
      vi.mocked(transactionService.getTransactions).mockResolvedValue(
        mockTransactionListResponse(mockTransactionsWithLocations)
      );

      renderWithProviders(<SpendingMapPage />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('Last 3 Months')).toBeInTheDocument();
      });
    });

    it('should filter transactions when date filter changes', async () => {
      vi.mocked(transactionService.getTransactions).mockResolvedValue(
        mockTransactionListResponse(mockTransactionsWithLocations)
      );

      renderWithProviders(<SpendingMapPage />);

      await waitFor(() => {
        expect(screen.getByTestId('map-container')).toBeInTheDocument();
      });

      const dateSelect = screen.getByDisplayValue('Last 3 Months');
      fireEvent.change(dateSelect, { target: { value: 'thisMonth' } });

      // Should trigger a new fetch with different date range
      await waitFor(() => {
        expect(vi.mocked(transactionService.getTransactions)).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('View Mode Toggle', () => {
    it('should render Map and Trips view toggle', async () => {
      vi.mocked(transactionService.getTransactions).mockResolvedValue(
        mockTransactionListResponse(mockTransactionsWithLocations)
      );

      renderWithProviders(<SpendingMapPage />);

      await waitFor(() => {
        expect(screen.getByText('🗺️ Map')).toBeInTheDocument();
        expect(screen.getByText(/✈️ Trips/)).toBeInTheDocument();
      });
    });

    it('should switch to Trips view when clicked', async () => {
      vi.mocked(transactionService.getTransactions).mockResolvedValue(
        mockTransactionListResponse(mockTransactionsWithLocations)
      );
      vi.mocked(transactionService.getTripGroups).mockResolvedValue(mockTripGroupsResponse);

      renderWithProviders(<SpendingMapPage />);

      await waitFor(() => {
        expect(screen.getByText(/✈️ Trips/)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(/✈️ Trips/));

      await waitFor(() => {
        expect(screen.getByText('No trips detected')).toBeInTheDocument();
      });
    });
  });

  describe('Heatmap Toggle', () => {
    it('should render heatmap toggle button in map mode', async () => {
      vi.mocked(transactionService.getTransactions).mockResolvedValue(
        mockTransactionListResponse(mockTransactionsWithLocations)
      );

      renderWithProviders(<SpendingMapPage />);

      await waitFor(() => {
        expect(screen.getByText('🔥 Heatmap')).toBeInTheDocument();
      });
    });
  });

  describe('Stats Display', () => {
    it('should display transaction stats in map mode', async () => {
      vi.mocked(transactionService.getTransactions).mockResolvedValue(
        mockTransactionListResponse(mockTransactionsWithLocations)
      );

      renderWithProviders(<SpendingMapPage />);

      await waitFor(() => {
        expect(screen.getByText('Transactions')).toBeInTheDocument();
        expect(screen.getByText('Total Spent')).toBeInTheDocument();
        expect(screen.getByText('Locations')).toBeInTheDocument();
        expect(screen.getByText('Top Location')).toBeInTheDocument();
      });
    });

    it('should display trip stats in trips mode', async () => {
      vi.mocked(transactionService.getTransactions).mockResolvedValue(
        mockTransactionListResponse(mockTransactionsWithLocations)
      );
      vi.mocked(transactionService.getTripGroups).mockResolvedValue({
        trips: [
          {
            id: 'trip-1',
            name: 'Goa Trip',
            city: 'Goa',
            country: 'India',
            centerLatitude: 15.2993,
            centerLongitude: 74.124,
            totalAmount: 5000,
            transactionCount: 5,
            startDate: '2024-01-01',
            endDate: '2024-01-05',
            durationDays: 5,
            isHomeBase: false,
            categoryBreakdown: [],
            dailyBreakdown: [],
          },
        ],
        totalTripSpending: 5000,
        totalTripTransactions: 5,
        currency: 'INR',
      });

      renderWithProviders(<SpendingMapPage />);

      await waitFor(() => {
        expect(screen.getByText(/✈️ Trips/)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(/✈️ Trips/));

      await waitFor(() => {
        expect(screen.getByText('Trips Detected')).toBeInTheDocument();
        expect(screen.getByText('Total Trip Spending')).toBeInTheDocument();
        expect(screen.getByText('Trip Transactions')).toBeInTheDocument();
      });
    });
  });

  describe('Location Insights', () => {
    it('should display location insights when nearby spending is available', async () => {
      vi.mocked(transactionService.getTransactions).mockResolvedValue(
        mockTransactionListResponse(mockTransactionsWithLocations)
      );
      vi.mocked(transactionService.getLocationInsights).mockResolvedValue({
        totalTransactions: 3,
        transactionsWithLocation: 3,
        totalSpendingWithLocation: 3000,
        nearbySpending: {
          name: 'Near Home',
          latitude: 12.9716,
          longitude: 77.5946,
          totalAmount: 1500,
          transactionCount: 2,
          topCategory: 'Groceries',
          percentage: 50,
          averageAmount: 750,
        },
        topLocations: [],
        currency: 'INR',
      });

      renderWithProviders(<SpendingMapPage />);

      await waitFor(() => {
        expect(screen.getByText('You spent near here')).toBeInTheDocument();
      });
    });
  });

  describe('Top Spending Locations Sidebar', () => {
    it('should display top spending locations sidebar in map mode', async () => {
      vi.mocked(transactionService.getTransactions).mockResolvedValue(
        mockTransactionListResponse(mockTransactionsWithLocations)
      );

      renderWithProviders(<SpendingMapPage />);

      await waitFor(() => {
        expect(screen.getByText('Top Spending Locations')).toBeInTheDocument();
      });
    });
  });
});