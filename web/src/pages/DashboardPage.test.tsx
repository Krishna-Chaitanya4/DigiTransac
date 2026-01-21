import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import DashboardPage from './DashboardPage';
import { AuthProvider } from '../context/AuthContext';
import { CurrencyProvider } from '../context/CurrencyContext';

// Mock the auth service
vi.mock('../services/authService');

// Mock the currency service to prevent API calls
vi.mock('../services/currencyService', async () => {
  const actual = await vi.importActual('../services/currencyService');
  return {
    ...actual,
    getExchangeRates: vi.fn().mockResolvedValue({
      baseCurrency: 'USD',
      rates: { USD: 1, INR: 83, EUR: 0.92 },
      lastUpdated: '2024-01-01T00:00:00Z',
      source: 'mock',
    }),
  };
});

// Create a wrapper with auth state pre-populated
function renderWithAuth(initialUser = { email: 'test@example.com', fullName: 'Test User', isEmailVerified: true, primaryCurrency: 'USD' }) {
  const validPayload = { sub: 'user-123', email: initialUser.email, exp: Math.floor(Date.now() / 1000) + 900 };
  const validToken = `header.${btoa(JSON.stringify(validPayload))}.signature`;
  
  localStorage.setItem('digitransac_access_token', validToken);
  localStorage.setItem('digitransac_refresh_token', 'valid-refresh-token');
  localStorage.setItem('digitransac_user', JSON.stringify(initialUser));

  return render(
    <BrowserRouter>
      <AuthProvider>
        <CurrencyProvider>
          <DashboardPage />
        </CurrencyProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should render dashboard title', async () => {
    renderWithAuth();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    });
  });

  it('should render welcome message with user name', async () => {
    renderWithAuth({ email: 'john@example.com', fullName: 'John Doe', isEmailVerified: true, primaryCurrency: 'USD' });

    await waitFor(() => {
      expect(screen.getByText(/Welcome back, John Doe/)).toBeInTheDocument();
    });
  });

  it('should render quick stats cards', async () => {
    renderWithAuth();

    await waitFor(() => {
      expect(screen.getByText('Total Income')).toBeInTheDocument();
      expect(screen.getByText('Total Expenses')).toBeInTheDocument();
      expect(screen.getByText('Balance')).toBeInTheDocument();
    });
  });

  it('should render recent transactions section', async () => {
    renderWithAuth();

    await waitFor(() => {
      expect(screen.getByText('Recent Transactions')).toBeInTheDocument();
      expect(screen.getByText('No transactions yet')).toBeInTheDocument();
    });
  });
});
