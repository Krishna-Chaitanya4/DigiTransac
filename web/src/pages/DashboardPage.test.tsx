import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import DashboardPage from './DashboardPage';
import { AuthProvider } from '../context/AuthContext';

// Mock the auth service
vi.mock('../services/authService');

// Create a wrapper with auth state pre-populated
function renderWithAuth(initialUser = { email: 'test@example.com', fullName: 'Test User', isEmailVerified: true }) {
  const validPayload = { sub: 'user-123', email: initialUser.email, exp: Math.floor(Date.now() / 1000) + 900 };
  const validToken = `header.${btoa(JSON.stringify(validPayload))}.signature`;
  
  localStorage.setItem('digitransac_access_token', validToken);
  localStorage.setItem('digitransac_refresh_token', 'valid-refresh-token');
  localStorage.setItem('digitransac_user', JSON.stringify(initialUser));

  return render(
    <BrowserRouter>
      <AuthProvider>
        <DashboardPage />
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
    renderWithAuth({ email: 'john@example.com', fullName: 'John Doe', isEmailVerified: true });

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
