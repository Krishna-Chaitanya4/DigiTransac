import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User, AuthResponse } from '../types/auth';
import * as authService from '../services/authService';
import { SESSION_EXPIRED_EVENT } from '../services/apiClient';
import { setSentryUser, clearSentryUser } from '../services/sentry';

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  sessionExpiredMessage: string | null;
  clearSessionExpiredMessage: () => void;
  login: (email: string, password: string) => Promise<{ requiresTwoFactor: boolean; twoFactorToken?: string }>;
  verifyTwoFactorLogin: (twoFactorToken: string, code: string) => Promise<void>;
  verifyTwoFactorEmailOtp: (twoFactorToken: string, emailCode: string) => Promise<void>;
  completeRegistration: (email: string, verificationToken: string, password: string, fullName: string, primaryCurrency?: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
  updateName: (fullName: string) => Promise<void>;
  sendEmailChangeCode: (newEmail: string) => Promise<void>;
  verifyEmailChange: (newEmail: string, code: string) => Promise<void>;
  getValidAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ACCESS_TOKEN_KEY = 'digitransac_access_token';
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
  const [isLoading, setIsLoading] = useState(true);
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState<string | null>(null);

  useEffect(() => {
    // Check for existing tokens on mount
    // Note: Refresh token is now stored in HttpOnly cookie (not accessible via JS)
    const storedAccessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);

    if (storedAccessToken && storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setAccessToken(storedAccessToken);
      setUser(parsedUser);
      // Set Sentry user for error tracking
      setSentryUser({ id: parsedUser.email, email: parsedUser.email, name: parsedUser.fullName });
    }
    setIsLoading(false);
  }, []);

  // Listen for session expiration events
  useEffect(() => {
    const handleSessionExpired = () => {
      // Clear auth state
      setAccessToken(null);
      setUser(null);
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      // Clear Sentry user
      clearSentryUser();
      // Set message to show on login page
      setSessionExpiredMessage('Your session has expired. Please log in again.');
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, []);

  const handleAuthSuccess = useCallback((authResponse: AuthResponse) => {
    const userData: User = { 
      email: authResponse.email, 
      fullName: authResponse.fullName,
      isEmailVerified: authResponse.isEmailVerified
    };
    setAccessToken(authResponse.accessToken);
    setUser(userData);
    localStorage.setItem(ACCESS_TOKEN_KEY, authResponse.accessToken);
    // Note: Refresh token is now stored in HttpOnly cookie by the server
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    // Set Sentry user for error tracking
    setSentryUser({ id: userData.email, email: userData.email, name: userData.fullName });
  }, []);

  const clearAuth = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    // Note: HttpOnly cookie will be cleared by the server on logout
    // Clear Sentry user
    clearSentryUser();
  }, []);

  // Get a valid access token, refreshing if necessary
  // Note: Refresh token is sent automatically via HttpOnly cookie
  const getValidAccessToken = useCallback(async (): Promise<string | null> => {
    const currentAccessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
    const currentUser = localStorage.getItem(USER_KEY);

    // If no user stored, we're not logged in
    if (!currentUser) {
      return null;
    }

    // If token exists and not expired, use it
    if (currentAccessToken && !isTokenExpired(currentAccessToken)) {
      return currentAccessToken;
    }

    // Token is expired or missing, try to refresh using HttpOnly cookie
    try {
      const response = await authService.refreshToken();
      handleAuthSuccess(response);
      return response.accessToken;
    } catch {
      // Refresh failed, clear auth state
      clearAuth();
      return null;
    }
  }, [handleAuthSuccess, clearAuth]);

  const login = async (email: string, password: string): Promise<{ requiresTwoFactor: boolean; twoFactorToken?: string }> => {
    const response = await authService.login(email, password);
    
    if (response.requiresTwoFactor && response.twoFactorToken) {
      return { requiresTwoFactor: true, twoFactorToken: response.twoFactorToken };
    }
    
    // Normal login - no 2FA required
    // Note: Refresh token is now in HttpOnly cookie, not in response
    if (response.accessToken && response.email && response.fullName !== undefined) {
      handleAuthSuccess({
        accessToken: response.accessToken,
        refreshToken: '', // Not used - stored in HttpOnly cookie
        email: response.email,
        fullName: response.fullName,
        isEmailVerified: response.isEmailVerified ?? false,
      });
    }
    
    return { requiresTwoFactor: false };
  };

  const verifyTwoFactorLogin = async (twoFactorToken: string, code: string) => {
    const response = await authService.verifyTwoFactorLogin(twoFactorToken, code);
    handleAuthSuccess(response);
  };

  const verifyTwoFactorEmailOtp = async (twoFactorToken: string, emailCode: string) => {
    const response = await authService.verifyTwoFactorEmailOtp(twoFactorToken, emailCode);
    handleAuthSuccess(response);
  };

  const completeRegistration = async (email: string, verificationToken: string, password: string, fullName: string, primaryCurrency?: string) => {
    const response = await authService.completeRegistration(email, verificationToken, password, fullName, primaryCurrency);
    handleAuthSuccess(response);
  };

  const logout = async () => {
    if (accessToken) {
      try {
        // Server will clear the HttpOnly cookie
        await authService.revokeToken(accessToken);
      } catch {
        // Ignore errors - we're logging out anyway
      }
    }
    clearAuth();
  };

  const logoutAll = async () => {
    if (accessToken) {
      try {
        // Server will clear the HttpOnly cookie
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

  const updateName = async (fullName: string) => {
    const validToken = await getValidAccessToken();
    if (!validToken) {
      throw new Error('Not authenticated');
    }
    await authService.updateName(validToken, fullName);
    // Update local user state
    if (user) {
      const updatedUser = { ...user, fullName };
      setUser(updatedUser);
      localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
    }
  };

  const sendEmailChangeCode = async (newEmail: string) => {
    const validToken = await getValidAccessToken();
    if (!validToken) {
      throw new Error('Not authenticated');
    }
    await authService.sendEmailChangeCode(validToken, newEmail);
  };

  const verifyEmailChange = async (newEmail: string, code: string) => {
    const validToken = await getValidAccessToken();
    if (!validToken) {
      throw new Error('Not authenticated');
    }
    await authService.verifyEmailChange(validToken, newEmail, code);
    // Update local user state
    if (user) {
      const updatedUser = { ...user, email: newEmail };
      setUser(updatedUser);
      localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
    }
  };

  const clearSessionExpiredMessage = useCallback(() => {
    setSessionExpiredMessage(null);
  }, []);

  return (
    <AuthContext.Provider value={{ 
      user, 
      accessToken, 
      isLoading,
      sessionExpiredMessage,
      clearSessionExpiredMessage,
      login,
      verifyTwoFactorLogin,
      verifyTwoFactorEmailOtp,
      completeRegistration, 
      logout, 
      logoutAll, 
      deleteAccount,
      updateName,
      sendEmailChangeCode,
      verifyEmailChange,
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
