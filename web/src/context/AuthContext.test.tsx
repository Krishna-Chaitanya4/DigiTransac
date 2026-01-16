import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from './AuthContext';
import * as authService from '../services/authService';

// Mock the auth service
vi.mock('../services/authService');

// Test component to access auth context
function TestConsumer() {
  const { user, token, isLoading, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="loading">{isLoading ? 'loading' : 'ready'}</span>
      <span data-testid="user">{user ? user.email : 'no-user'}</span>
      <span data-testid="token">{token || 'no-token'}</span>
      <button onClick={() => login('test@example.com', 'password123')}>Login</button>
      <button onClick={logout}>Logout</button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should throw error when useAuth is used outside AuthProvider', () => {
    // Suppress console.error for this test
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      render(<TestConsumer />);
    }).toThrow('useAuth must be used within an AuthProvider');
    
    spy.mockRestore();
  });

  it('should start in loading state and become ready', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('ready');
    });
  });

  it('should have no user initially', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('no-user');
      expect(screen.getByTestId('token')).toHaveTextContent('no-token');
    });
  });

  it('should restore user from localStorage on mount', async () => {
    const storedUser = { email: 'stored@example.com', fullName: 'Stored User', isEmailVerified: true };
    localStorage.setItem('digitransac_token', 'stored-token');
    localStorage.setItem('digitransac_user', JSON.stringify(storedUser));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('stored@example.com');
      expect(screen.getByTestId('token')).toHaveTextContent('stored-token');
    });
  });

  it('should login successfully and store credentials', async () => {
    const user = userEvent.setup();
    const mockResponse = {
      token: 'new-jwt-token',
      email: 'test@example.com',
      fullName: 'Test User',
      isEmailVerified: true,
    };
    vi.mocked(authService.login).mockResolvedValue(mockResponse);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('ready');
    });

    await user.click(screen.getByText('Login'));

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
      expect(screen.getByTestId('token')).toHaveTextContent('new-jwt-token');
    });

    // Verify localStorage was updated
    expect(localStorage.getItem('digitransac_token')).toBe('new-jwt-token');
    expect(JSON.parse(localStorage.getItem('digitransac_user')!).email).toBe('test@example.com');
  });

  it('should logout and clear credentials', async () => {
    const user = userEvent.setup();
    const storedUser = { email: 'stored@example.com', fullName: 'Stored User', isEmailVerified: true };
    localStorage.setItem('digitransac_token', 'stored-token');
    localStorage.setItem('digitransac_user', JSON.stringify(storedUser));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('stored@example.com');
    });

    await user.click(screen.getByText('Logout'));

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('no-user');
      expect(screen.getByTestId('token')).toHaveTextContent('no-token');
    });

    // Verify localStorage was cleared
    expect(localStorage.getItem('digitransac_token')).toBeNull();
    expect(localStorage.getItem('digitransac_user')).toBeNull();
  });
});
