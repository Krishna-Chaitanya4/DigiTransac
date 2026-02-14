import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CurrencyProvider, useCurrency } from './CurrencyContext';
import { AuthProvider } from './AuthContext';
import { BrowserRouter } from 'react-router-dom';
import * as currencyService from '../services/currencyService';

// Mock currencyService
vi.mock('../services/currencyService', async () => {
  const actual = await vi.importActual('../services/currencyService');
  return {
    ...actual,
    getExchangeRates: vi.fn(),
  };
});

// Test component that uses the currency context
function TestConsumer() {
  const { 
    primaryCurrency, 
    exchangeRates, 
    isLoading, 
    error, 
    convert, 
    formatInPrimaryCurrency,
    formatWithConversion 
  } = useCurrency();

  return (
    <div>
      <div data-testid="primary-currency">{primaryCurrency}</div>
      <div data-testid="is-loading">{isLoading ? 'loading' : 'not-loading'}</div>
      <div data-testid="error">{error || 'no-error'}</div>
      <div data-testid="has-rates">{exchangeRates ? 'has-rates' : 'no-rates'}</div>
      <div data-testid="converted">{convert(100, 'INR')}</div>
      <div data-testid="formatted">{formatInPrimaryCurrency(100, 'INR')}</div>
      <div data-testid="with-conversion">{JSON.stringify(formatWithConversion(100, 'INR'))}</div>
    </div>
  );
}

// Setup authenticated user
function setupAuthenticatedUser(primaryCurrency = 'USD') {
  const validPayload = { sub: 'user-123', email: 'test@example.com', exp: Math.floor(Date.now() / 1000) + 900 };
  const validToken = `header.${btoa(JSON.stringify(validPayload))}.signature`;
  
  localStorage.setItem('digitransac_access_token', validToken);
  localStorage.setItem('digitransac_user', JSON.stringify({
    email: 'test@example.com',
    fullName: 'Test User',
    isEmailVerified: true,
    primaryCurrency,
  }));
}

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <CurrencyProvider>
            {ui}
          </CurrencyProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

describe('CurrencyContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should provide default primary currency when not authenticated', async () => {
    renderWithProviders(<TestConsumer />);

    await waitFor(() => {
      expect(screen.getByTestId('primary-currency')).toHaveTextContent('USD');
    });
  });

  it('should use user primary currency when authenticated', async () => {
    setupAuthenticatedUser('AED');
    vi.mocked(currencyService.getExchangeRates).mockResolvedValue({
      baseCurrency: 'USD',
      rates: { USD: 1, AED: 3.67, INR: 83 },
      lastUpdated: '2024-01-01T00:00:00Z',
      source: 'test',
    });

    renderWithProviders(<TestConsumer />);

    await waitFor(() => {
      expect(screen.getByTestId('primary-currency')).toHaveTextContent('AED');
    });
  });

  it('should fetch exchange rates when user is authenticated', async () => {
    setupAuthenticatedUser('USD');
    vi.mocked(currencyService.getExchangeRates).mockResolvedValue({
      baseCurrency: 'USD',
      rates: { USD: 1, INR: 83, EUR: 0.92 },
      lastUpdated: '2024-01-01T00:00:00Z',
      source: 'test',
    });

    renderWithProviders(<TestConsumer />);

    await waitFor(() => {
      expect(screen.getByTestId('has-rates')).toHaveTextContent('has-rates');
    });
    expect(currencyService.getExchangeRates).toHaveBeenCalled();
  });

  it('should convert amounts to primary currency', async () => {
    setupAuthenticatedUser('USD');
    vi.mocked(currencyService.getExchangeRates).mockResolvedValue({
      baseCurrency: 'USD',
      rates: { USD: 1, INR: 83 },
      lastUpdated: '2024-01-01T00:00:00Z',
      source: 'test',
    });

    renderWithProviders(<TestConsumer />);

    await waitFor(() => {
      expect(screen.getByTestId('has-rates')).toHaveTextContent('has-rates');
    });

    // 100 INR / 83 (INR rate) * 1 (USD rate) ≈ 1.20
    const converted = parseFloat(screen.getByTestId('converted').textContent || '0');
    expect(converted).toBeCloseTo(1.20, 1);
  });

  it('should format with conversion showing both original and converted', async () => {
    setupAuthenticatedUser('USD');
    vi.mocked(currencyService.getExchangeRates).mockResolvedValue({
      baseCurrency: 'USD',
      rates: { USD: 1, INR: 83 },
      lastUpdated: '2024-01-01T00:00:00Z',
      source: 'test',
    });

    renderWithProviders(<TestConsumer />);

    await waitFor(() => {
      expect(screen.getByTestId('has-rates')).toHaveTextContent('has-rates');
    });

    const result = JSON.parse(screen.getByTestId('with-conversion').textContent || '{}');
    expect(result.original).toContain('100'); // Original amount
    expect(result.converted).toBeDefined(); // Should have converted value
  });

  it('should return null for converted when currency matches primary', async () => {
    setupAuthenticatedUser('INR');
    vi.mocked(currencyService.getExchangeRates).mockResolvedValue({
      baseCurrency: 'USD',
      rates: { USD: 1, INR: 83 },
      lastUpdated: '2024-01-01T00:00:00Z',
      source: 'test',
    });

    renderWithProviders(<TestConsumer />);

    await waitFor(() => {
      expect(screen.getByTestId('has-rates')).toHaveTextContent('has-rates');
    });

    const result = JSON.parse(screen.getByTestId('with-conversion').textContent || '{}');
    expect(result.converted).toBeNull(); // Same currency, no conversion needed
  });

  it('should not fetch rates when user is not authenticated', async () => {
    renderWithProviders(<TestConsumer />);

    await waitFor(() => {
      expect(screen.getByTestId('has-rates')).toHaveTextContent('no-rates');
    });

    // Should not call API when not authenticated
    expect(currencyService.getExchangeRates).not.toHaveBeenCalled();
  });

  it('should handle API error gracefully', async () => {
    setupAuthenticatedUser('USD');
    vi.mocked(currencyService.getExchangeRates).mockRejectedValue(new Error('Network error'));

    renderWithProviders(<TestConsumer />);

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('Network error');
    });
  });

  it('should throw error when useCurrency is used outside provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      render(<TestConsumer />);
    }).toThrow('useCurrency must be used within a CurrencyProvider');

    consoleError.mockRestore();
  });
});

describe('convertAmount utility', () => {
  it('should return same amount when currencies match', () => {
    const result = currencyService.convertAmount(100, 'USD', 'USD', { USD: 1 });
    expect(result).toBe(100);
  });

  it('should convert correctly between currencies', () => {
    const rates = { USD: 1, INR: 83, AED: 3.67 };
    // 100 INR to USD: 100 / 83 * 1 ≈ 1.20
    const result = currencyService.convertAmount(100, 'INR', 'USD', rates);
    expect(result).toBeCloseTo(1.20, 1);
  });

  it('should return original amount when rate not found', () => {
    const rates = { USD: 1 };
    const result = currencyService.convertAmount(100, 'XYZ', 'USD', rates);
    expect(result).toBe(100);
  });
});
