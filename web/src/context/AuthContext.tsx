import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User, AuthResponse } from '../types/auth';
import * as authService from '../services/authService';
import { SESSION_EXPIRED_EVENT } from '../services/apiClient';
import { setSentryUser, clearSentryUser } from '../services/sentry';

// Detect if running as installed PWA (standalone mode)
function isPwaStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as unknown as { standalone?: boolean }).standalone === true; // iOS Safari
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  isPwa: boolean;
  sessionExpiredMessage: string | null;
  clearSessionExpiredMessage: () => void;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<{ requiresTwoFactor: boolean; twoFactorToken?: string }>;
  verifyTwoFactorLogin: (twoFactorToken: string, code: string, rememberMe?: boolean) => Promise<void>;
  verifyTwoFactorEmailOtp: (twoFactorToken: string, emailCode: string, rememberMe?: boolean) => Promise<void>;
  completeRegistration: (email: string, verificationToken: string, password: string, fullName: string, primaryCurrency?: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
  updateName: (fullName: string) => Promise<void>;
  updatePrimaryCurrency: (currency: string) => void;
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
    // Check for existing tokens on mount and proactively refresh if expired
    // This ensures PWA users stay logged in without needing to re-authenticate
    const storedAccessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);

    if (storedAccessToken && storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setAccessToken(storedAccessToken);
      setUser(parsedUser);
      // Set Sentry user for error tracking
      setSentryUser({ id: parsedUser.email, email: parsedUser.email, name: parsedUser.fullName });

      // Proactively refresh if access token is expired or about to expire
      // This prevents the first API call from failing and provides seamless PWA experience
      if (isTokenExpired(storedAccessToken)) {
        authService.refreshToken()
          .then((response) => {
            handleAuthSuccess(response);
            setIsLoading(false);
          })
          .catch(() => {
            // Refresh failed — token cookie expired or was cleared
            // Keep user data so ProtectedRoute can show the app briefly,
            // the next API call will trigger session-expired flow
            setIsLoading(false);
          });
        return; // Don't set isLoading=false yet, wait for refresh
      }
    }
    setIsLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      isEmailVerified: authResponse.isEmailVerified,
      primaryCurrency: authResponse.primaryCurrency
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

  const pwaDetected = isPwaStandalone();

  const login = async (email: string, password: string, rememberMe?: boolean): Promise<{ requiresTwoFactor: boolean; twoFactorToken?: string }> => {
    // Default: PWA always remembers, browser only if explicitly requested
    const shouldRemember = rememberMe ?? pwaDetected;
    const response = await authService.login(email, password, shouldRemember);
    
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
        primaryCurrency: response.primaryCurrency ?? 'USD',
      });
    }
    
    return { requiresTwoFactor: false };
  };

  const verifyTwoFactorLogin = async (twoFactorToken: string, code: string, rememberMe?: boolean) => {
    const shouldRemember = rememberMe ?? pwaDetected;
    const response = await authService.verifyTwoFactorLogin(twoFactorToken, code, shouldRemember);
    handleAuthSuccess(response);
  };

  const verifyTwoFactorEmailOtp = async (twoFactorToken: string, emailCode: string, rememberMe?: boolean) => {
    const shouldRemember = rememberMe ?? pwaDetected;
    const response = await authService.verifyTwoFactorEmailOtp(twoFactorToken, emailCode, shouldRemember);
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

  const updatePrimaryCurrency = (currency: string) => {
    // Update local user state (API call is already made by SettingsPage)
    if (user) {
      const updatedUser = { ...user, primaryCurrency: currency };
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
      isPwa: pwaDetected,
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
      updatePrimaryCurrency,
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
