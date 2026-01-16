import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User, AuthResponse } from '../types/auth';
import * as authService from '../services/authService';

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  completeRegistration: (email: string, verificationToken: string, password: string, fullName: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
  getValidAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ACCESS_TOKEN_KEY = 'digitransac_access_token';
const REFRESH_TOKEN_KEY = 'digitransac_refresh_token';
const USER_KEY = 'digitransac_user';

// Check if token is expired (with 30s buffer for API calls)
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000; // Convert to milliseconds
    return Date.now() >= exp - 30000; // 30 second buffer
  } catch {
    return true;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing tokens on mount
    const storedAccessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
    const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);

    if (storedAccessToken && storedRefreshToken && storedUser) {
      setAccessToken(storedAccessToken);
      setRefreshToken(storedRefreshToken);
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const handleAuthSuccess = useCallback((authResponse: AuthResponse) => {
    const userData: User = { 
      email: authResponse.email, 
      fullName: authResponse.fullName,
      isEmailVerified: authResponse.isEmailVerified
    };
    setAccessToken(authResponse.accessToken);
    setRefreshToken(authResponse.refreshToken);
    setUser(userData);
    localStorage.setItem(ACCESS_TOKEN_KEY, authResponse.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, authResponse.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
  }, []);

  const clearAuth = useCallback(() => {
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }, []);

  // Get a valid access token, refreshing if necessary
  const getValidAccessToken = useCallback(async (): Promise<string | null> => {
    if (!accessToken || !refreshToken) {
      return null;
    }

    if (!isTokenExpired(accessToken)) {
      return accessToken;
    }

    // Token is expired, try to refresh
    try {
      const response = await authService.refreshToken(refreshToken);
      handleAuthSuccess(response);
      return response.accessToken;
    } catch {
      // Refresh failed, clear auth state
      clearAuth();
      return null;
    }
  }, [accessToken, refreshToken, handleAuthSuccess, clearAuth]);

  const login = async (email: string, password: string) => {
    const response = await authService.login(email, password);
    handleAuthSuccess(response);
  };

  const completeRegistration = async (email: string, verificationToken: string, password: string, fullName: string) => {
    const response = await authService.completeRegistration(email, verificationToken, password, fullName);
    handleAuthSuccess(response);
  };

  const logout = async () => {
    if (accessToken && refreshToken) {
      try {
        await authService.revokeToken(accessToken, refreshToken);
      } catch {
        // Ignore errors - we're logging out anyway
      }
    }
    clearAuth();
  };

  const logoutAll = async () => {
    if (accessToken) {
      try {
        await authService.revokeAllTokens(accessToken);
      } catch {
        // Ignore errors - we're logging out anyway
      }
    }
    clearAuth();
  };

  const deleteAccount = async (password: string) => {
    const validToken = await getValidAccessToken();
    if (!validToken) {
      throw new Error('Not authenticated');
    }
    await authService.deleteAccount(validToken, password);
    clearAuth();
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      accessToken, 
      isLoading, 
      login, 
      completeRegistration, 
      logout, 
      logoutAll, 
      deleteAccount,
      getValidAccessToken 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
