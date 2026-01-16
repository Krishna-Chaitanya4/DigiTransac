import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from './AuthContext';
import * as authService from '../services/authService';

// Mock the auth service
vi.mock('../services/authService');

// Test component to access auth context
function TestConsumer() {
  const { user, accessToken, isLoading, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="loading">{isLoading ? 'loading' : 'ready'}</span>
      <span data-testid="user">{user ? user.email : 'no-user'}</span>
      <span data-testid="token">{accessToken || 'no-token'}</span>
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
    localStorage.setItem('digitransac_access_token', 'stored-token');
    localStorage.setItem('digitransac_refresh_token', 'stored-refresh-token');
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
      accessToken: 'new-jwt-token',
      refreshToken: 'new-refresh-token',
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
    expect(localStorage.getItem('digitransac_access_token')).toBe('new-jwt-token');
    expect(localStorage.getItem('digitransac_refresh_token')).toBe('new-refresh-token');
    expect(JSON.parse(localStorage.getItem('digitransac_user')!).email).toBe('test@example.com');
  });

  it('should logout and clear credentials', async () => {
    const user = userEvent.setup();
    const storedUser = { email: 'stored@example.com', fullName: 'Stored User', isEmailVerified: true };
    localStorage.setItem('digitransac_access_token', 'stored-token');
    localStorage.setItem('digitransac_refresh_token', 'stored-refresh-token');
    localStorage.setItem('digitransac_user', JSON.stringify(storedUser));

    // Mock the revokeToken call
    vi.mocked(authService.revokeToken).mockResolvedValue({ message: 'Token revoked' });

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
    expect(localStorage.getItem('digitransac_access_token')).toBeNull();
    expect(localStorage.getItem('digitransac_refresh_token')).toBeNull();
    expect(localStorage.getItem('digitransac_user')).toBeNull();
  });

  it('should logout all sessions and clear credentials', async () => {
    const user = userEvent.setup();
    const storedUser = { email: 'stored@example.com', fullName: 'Stored User', isEmailVerified: true };
    localStorage.setItem('digitransac_access_token', 'stored-token');
    localStorage.setItem('digitransac_refresh_token', 'stored-refresh-token');
    localStorage.setItem('digitransac_user', JSON.stringify(storedUser));

    // Mock the revokeAllTokens call
    vi.mocked(authService.revokeAllTokens).mockResolvedValue({ message: 'All tokens revoked' });

    // Test component with logoutAll
    function TestConsumerWithLogoutAll() {
      const { user: authUser, logoutAll } = useAuth();
      return (
        <div>
          <span data-testid="user">{authUser ? authUser.email : 'no-user'}</span>
          <button onClick={logoutAll}>Logout All</button>
        </div>
      );
    }

    render(
      <AuthProvider>
        <TestConsumerWithLogoutAll />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('stored@example.com');
    });

    await user.click(screen.getByText('Logout All'));

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('no-user');
    });

    // Verify revokeAllTokens was called
    expect(authService.revokeAllTokens).toHaveBeenCalledWith('stored-token');

    // Verify localStorage was cleared
    expect(localStorage.getItem('digitransac_access_token')).toBeNull();
    expect(localStorage.getItem('digitransac_refresh_token')).toBeNull();
  });

  it('should refresh access token when expired', async () => {
    // Create an expired JWT token (exp in the past)
    const expiredPayload = { sub: 'user-123', email: 'test@example.com', exp: Math.floor(Date.now() / 1000) - 60 };
    const expiredToken = `header.${btoa(JSON.stringify(expiredPayload))}.signature`;

    const storedUser = { email: 'test@example.com', fullName: 'Test User', isEmailVerified: true };
    localStorage.setItem('digitransac_access_token', expiredToken);
    localStorage.setItem('digitransac_refresh_token', 'valid-refresh-token');
    localStorage.setItem('digitransac_user', JSON.stringify(storedUser));

    const newTokenPayload = { sub: 'user-123', email: 'test@example.com', exp: Math.floor(Date.now() / 1000) + 900 };
    const newAccessToken = `header.${btoa(JSON.stringify(newTokenPayload))}.signature`;

    vi.mocked(authService.refreshToken).mockResolvedValue({
      accessToken: newAccessToken,
      refreshToken: 'new-refresh-token',
      email: 'test@example.com',
      fullName: 'Test User',
      isEmailVerified: true,
    });

    let validToken: string | null = null;

    function TestConsumerWithGetValidToken() {
      const { getValidAccessToken, accessToken: currentToken } = useAuth();
      return (
        <div>
          <span data-testid="current-token">{currentToken || 'no-token'}</span>
          <button onClick={async () => { validToken = await getValidAccessToken(); }}>Get Valid Token</button>
        </div>
      );
    }

    render(
      <AuthProvider>
        <TestConsumerWithGetValidToken />
      </AuthProvider>
    );

    const user = userEvent.setup();
    
    await waitFor(() => {
      expect(screen.getByTestId('current-token')).toHaveTextContent(expiredToken);
    });

    await user.click(screen.getByText('Get Valid Token'));

    await waitFor(() => {
      expect(authService.refreshToken).toHaveBeenCalledWith('valid-refresh-token');
    });

    // Token should be refreshed
    await waitFor(() => {
      expect(screen.getByTestId('current-token')).toHaveTextContent(newAccessToken);
    });

    expect(validToken).toBe(newAccessToken);
  });

  it('should clear auth when refresh token fails', async () => {
    // Create an expired JWT token
    const expiredPayload = { sub: 'user-123', email: 'test@example.com', exp: Math.floor(Date.now() / 1000) - 60 };
    const expiredToken = `header.${btoa(JSON.stringify(expiredPayload))}.signature`;

    const storedUser = { email: 'test@example.com', fullName: 'Test User', isEmailVerified: true };
    localStorage.setItem('digitransac_access_token', expiredToken);
    localStorage.setItem('digitransac_refresh_token', 'invalid-refresh-token');
    localStorage.setItem('digitransac_user', JSON.stringify(storedUser));

    vi.mocked(authService.refreshToken).mockRejectedValue(new Error('Invalid refresh token'));

    let validToken: string | null = 'should-be-null';

    function TestConsumerWithGetValidToken() {
      const { getValidAccessToken, user: authUser } = useAuth();
      return (
        <div>
          <span data-testid="user">{authUser ? authUser.email : 'no-user'}</span>
          <button onClick={async () => { validToken = await getValidAccessToken(); }}>Get Valid Token</button>
        </div>
      );
    }

    render(
      <AuthProvider>
        <TestConsumerWithGetValidToken />
      </AuthProvider>
    );

    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
    });

    await user.click(screen.getByText('Get Valid Token'));

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('no-user');
    });

    expect(validToken).toBeNull();
    expect(localStorage.getItem('digitransac_access_token')).toBeNull();
  });

  it('should return valid token without refresh when not expired', async () => {
    // Create a valid (non-expired) JWT token
    const validPayload = { sub: 'user-123', email: 'test@example.com', exp: Math.floor(Date.now() / 1000) + 900 };
    const validAccessToken = `header.${btoa(JSON.stringify(validPayload))}.signature`;

    const storedUser = { email: 'test@example.com', fullName: 'Test User', isEmailVerified: true };
    localStorage.setItem('digitransac_access_token', validAccessToken);
    localStorage.setItem('digitransac_refresh_token', 'valid-refresh-token');
    localStorage.setItem('digitransac_user', JSON.stringify(storedUser));

    let returnedToken: string | null = null;

    function TestConsumerWithGetValidToken() {
      const { getValidAccessToken } = useAuth();
      return (
        <button onClick={async () => { returnedToken = await getValidAccessToken(); }}>Get Valid Token</button>
      );
    }

    render(
      <AuthProvider>
        <TestConsumerWithGetValidToken />
      </AuthProvider>
    );

    const user = userEvent.setup();
    await user.click(screen.getByText('Get Valid Token'));

    await waitFor(() => {
      expect(returnedToken).toBe(validAccessToken);
    });

    // Refresh should NOT have been called
    expect(authService.refreshToken).not.toHaveBeenCalled();
  });

  it('should return null when no tokens exist', async () => {
    let returnedToken: string | null = 'should-be-null';

    function TestConsumerWithGetValidToken() {
      const { getValidAccessToken } = useAuth();
      return (
        <button onClick={async () => { returnedToken = await getValidAccessToken(); }}>Get Valid Token</button>
      );
    }

    render(
      <AuthProvider>
        <TestConsumerWithGetValidToken />
      </AuthProvider>
    );

    const user = userEvent.setup();
    await user.click(screen.getByText('Get Valid Token'));

    await waitFor(() => {
      expect(returnedToken).toBeNull();
    });
  });
});
