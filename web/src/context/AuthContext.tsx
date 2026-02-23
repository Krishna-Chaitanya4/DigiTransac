import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { User, AuthResponse } from '../types/auth';
import * as authService from '../services/authService';
import { SESSION_EXPIRED_EVENT, refreshAccessToken } from '../services/apiClient';
import { setSentryUser, clearSentryUser } from '../services/sentry';
import { queryClient } from '../lib/queryClient';
import { isPwaStandalone } from '../utils/pwa';

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

import { ACCESS_TOKEN_KEY } from '../services/tokenStorage';
const USER_KEY = 'digitransac_user';

// Check if token is expired (with 30s buffer for API calls)
// NOTE: Client-side JWT parsing (atob) is intentional — we only read the `exp` claim
// to schedule proactive refresh. The server always validates the full signature.
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000; // Convert to milliseconds
    return Date.now() >= exp - 30000; // 30 second buffer
  } catch {
    return true;
  }
}

// Get the time-to-live of a token in milliseconds (0 if expired)
function getTokenTtlMs(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000;
    const remaining = exp - Date.now();
    return remaining > 0 ? remaining : 0;
  } catch {
    return 0;
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
      try {
        const parsedUser = JSON.parse(storedUser);
        setAccessToken(storedAccessToken);
        setUser(parsedUser);
        // Set Sentry user for error tracking
        setSentryUser({ id: parsedUser.email, email: parsedUser.email, name: parsedUser.fullName });

        // Proactively refresh if access token is expired or about to expire
        // This prevents the first API call from failing and provides seamless PWA experience
        if (isTokenExpired(storedAccessToken)) {
          refreshAccessToken()
            .then((newToken) => {
              if (newToken) {
                // Re-fetch user profile from the new token response
                // The token is already stored in localStorage by refreshAccessToken
                setAccessToken(newToken);
                // Also reload user data (refreshAccessToken now persists it)
                const refreshedUser = localStorage.getItem(USER_KEY);
                if (refreshedUser) {
                  try { setUser(JSON.parse(refreshedUser)); } catch { /* keep existing */ }
                }
              } else {
                // Refresh failed — clear auth state so user is redirected to login
                clearAuth();
              }
              setIsLoading(false);
            })
            .catch(() => {
              // Refresh failed — clear stale auth to avoid brief flash of app
              clearAuth();
              setIsLoading(false);
            });
          return; // Don't set isLoading=false yet, wait for refresh
        }
      } catch {
        // Corrupted localStorage data — clear and start fresh
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      }
    } else {
      // No stored tokens — but the HttpOnly refresh cookie may still exist
      // (Safari ITP can purge localStorage after 7 days while cookies survive)
      // Attempt a silent refresh to recover the session
      refreshAccessToken()
        .then((newToken) => {
          if (newToken) {
            setAccessToken(newToken);
            const refreshedUser = localStorage.getItem(USER_KEY);
            if (refreshedUser) {
              try {
                const parsedUser = JSON.parse(refreshedUser);
                setUser(parsedUser);
                setSentryUser({ id: parsedUser.email, email: parsedUser.email, name: parsedUser.fullName });
              } catch { /* user data missing — will redirect to login */ }
            }
          }
          setIsLoading(false);
        })
        .catch(() => {
          setIsLoading(false);
        });
      return; // Don't set isLoading=false yet, wait for refresh attempt
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
      // Clear all cached query data
      queryClient.clear();
      // Clear Sentry user
      clearSentryUser();
      // Set message to show on login page
      setSessionExpiredMessage('Your session has expired. Please log in again.');
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, []);

  // Cross-tab synchronization: detect when another tab updates the access token
  // or logs out, and sync React state accordingly
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === ACCESS_TOKEN_KEY) {
        if (e.newValue) {
          // Another tab refreshed the token — update React state
          setAccessToken(e.newValue);
        } else {
          // Another tab logged out — clear auth state in this tab too
          setAccessToken(null);
          setUser(null);
          queryClient.clear();
          clearSentryUser();
        }
      } else if (e.key === USER_KEY) {
        if (e.newValue) {
          try {
            const parsedUser = JSON.parse(e.newValue);
            setUser(parsedUser);
          } catch { /* ignore corrupted data */ }
        } else {
          setUser(null);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Proactive token refresh: schedule a refresh 60 seconds before the access token expires
  // Also refresh when the app regains visibility (user returns from another tab/app)
  useEffect(() => {
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    function scheduleRefresh() {
      if (refreshTimer) clearTimeout(refreshTimer);
      const token = localStorage.getItem(ACCESS_TOKEN_KEY);
      if (!token) return;

      // Refresh 60 seconds before expiry (minimum 5 s delay to avoid tight loops)
      const ttl = getTokenTtlMs(token);
      const delay = Math.max(ttl - 60_000, 5_000);

      refreshTimer = setTimeout(async () => {
        try {
          const newToken = await refreshAccessToken();
          if (newToken) {
            setAccessToken(newToken);
            scheduleRefresh(); // re-schedule for the new token
          }
        } catch {
          // Refresh failed — don't force logout yet;
          // the 401 interceptor in apiClient will handle it on the next API call
        }
      }, delay);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        const token = localStorage.getItem(ACCESS_TOKEN_KEY);
        if (token && isTokenExpired(token)) {
          // Token expired while tab was hidden — refresh immediately
          refreshAccessToken()
            .then((newToken) => {
              if (newToken) {
                setAccessToken(newToken);
              }
              scheduleRefresh();
            })
            .catch(() => {
              // Will be caught by 401 interceptor on next API call
            });
        } else {
          scheduleRefresh();
        }
      }
    }

    scheduleRefresh();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Also refresh when device comes back online (network reconnection)
    function handleOnline() {
      const token = localStorage.getItem(ACCESS_TOKEN_KEY);
      if (token && isTokenExpired(token)) {
        refreshAccessToken()
          .then((newToken) => {
            if (newToken) setAccessToken(newToken);
            scheduleRefresh();
          })
          .catch(() => { /* 401 interceptor handles it */ });
      } else {
        scheduleRefresh();
      }
    }
    window.addEventListener('online', handleOnline);

    // iOS PWA: handle bfcache resume (pageshow fires when visibilitychange does not)
    function handlePageShow(e: PageTransitionEvent) {
      if (e.persisted) {
        const token = localStorage.getItem(ACCESS_TOKEN_KEY);
        if (token && isTokenExpired(token)) {
          refreshAccessToken()
            .then((newToken) => {
              if (newToken) setAccessToken(newToken);
              scheduleRefresh();
            })
            .catch(() => { /* 401 interceptor handles it */ });
        } else {
          scheduleRefresh();
        }
      }
    }
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [accessToken]); // Re-schedule whenever the access token changes

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
    // Clear all cached query data to prevent stale data leaking across sessions
    queryClient.clear();
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
      const newToken = await refreshAccessToken();
      if (newToken) {
        setAccessToken(newToken);
        return newToken;
      }
      // Refresh failed, clear auth state
      clearAuth();
      return null;
    } catch {
      // Refresh failed, clear auth state
      clearAuth();
      return null;
    }
  }, [clearAuth]);

  const pwaDetected = useMemo(() => isPwaStandalone(), []);

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
