import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import { configService } from '../services/config.service';
import { syncFromAPI, setupAutoSync, isOnline } from '../utils/offlineSync';
import { initDB } from '../utils/indexedDB';
import { isDevelopmentEnvironment } from '../utils/environment';

interface User {
  id: string;
  email?: string;
  phone?: string;
  username: string;
  fullName: string;
  dateOfBirth?: string;
  currency: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (identifier: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface RegisterData {
  email?: string;
  phone?: string;
  username: string;
  fullName: string;
  dateOfBirth?: string;
  password: string;
  currency: string;
}

interface AuthResponse {
  success: boolean;
  message: string;
  token: string;
  user: User;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('auth-token');
  });
  const [isLoading, setIsLoading] = useState(true);

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('auth-token');
    localStorage.removeItem('auth-user');
    delete axios.defaults.headers.common['Authorization'];
    window.location.href = '/login';
  };

  // Setup offline sync on token change
  useEffect(() => {
    if (!token) return;

    // Initialize IndexedDB
    initDB().catch(() => {});

    // Sync data from API if online
    if (isOnline()) {
      syncFromAPI(token).catch(() => {});
    }

    // Setup auto-sync on network reconnection
    const cleanup = setupAutoSync(token);
    return cleanup;
  }, [token]);

  useEffect(() => {
    const initAuth = async () => {
      // Load runtime configuration first
      await configService.fetchConfig();

      // Don't set axios baseURL in development - use relative URLs for Vite proxy
      // In production, the config service will provide the correct API URL
      const isDevelopment = isDevelopmentEnvironment();

      if (!isDevelopment) {
        const apiUrl = configService.getApiUrl();
        axios.defaults.baseURL = apiUrl;
      }

      const savedToken = localStorage.getItem('auth-token');
      const savedUser = localStorage.getItem('auth-user');

      if (savedToken && savedUser) {
        try {
          setToken(savedToken);
          setUser(JSON.parse(savedUser));
          axios.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
        } catch {
          localStorage.removeItem('auth-token');
          localStorage.removeItem('auth-user');
          setToken(null);
          setUser(null);
        }
      }
      setIsLoading(false);
    };

    initAuth();

    // Add axios interceptor to handle token expiration
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        // Handle any 401 error (unauthorized/token expired)
        if (error.response?.status === 401) {
          // Clear auth state and redirect to login
          setUser(null);
          setToken(null);
          localStorage.removeItem('auth-token');
          localStorage.removeItem('auth-user');
          delete axios.defaults.headers.common['Authorization'];
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  const login = async (identifier: string, password: string) => {
    try {
      // Use relative URL to let Vite proxy handle it
      const loginUrl = '/api/auth/login';

      // Try fetch with relative path (uses Vite proxy)
      const fetchResponse = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ identifier, password }),
      }).catch((fetchError) => {
        throw new Error(`Network request failed: ${fetchError.message}`);
      });

      if (!fetchResponse.ok) {
        const errorData = await fetchResponse.json().catch(() => ({}));
        const errorMessage =
          errorData.message ||
          (fetchResponse.status === 401
            ? 'Invalid username/email/phone or password'
            : fetchResponse.status === 404
              ? 'Login service is currently unavailable'
              : fetchResponse.status === 405
                ? 'Service temporarily unavailable. Please try again in a moment'
                : fetchResponse.status === 429
                  ? 'Too many login attempts. Please try again later'
                  : fetchResponse.status >= 500
                    ? 'Server error. Please try again later'
                    : 'Login failed. Please check your credentials and try again');
        throw new Error(errorMessage);
      }

      const data = await fetchResponse.json();

      if (!data.success) {
        throw new Error(data.message || 'Login failed. Please try again.');
      }

      const { token: newToken, user: userData } = data;

      setToken(newToken);
      setUser(userData);
      localStorage.setItem('auth-token', newToken);
      localStorage.setItem('auth-user', JSON.stringify(userData));
      axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    } catch (error: any) {
      const errorMessage = error.message || 'Login failed';
      throw new Error(errorMessage);
    }
  };

  const register = async (data: RegisterData) => {
    try {
      const response = await axios.post<AuthResponse>('/api/auth/register', data);

      if (!response.data.success) {
        throw new Error(response.data.message || 'Registration failed');
      }

      const { token: newToken, user: userData } = response.data;

      setToken(newToken);
      setUser(userData);
      localStorage.setItem('auth-token', newToken);
      localStorage.setItem('auth-user', JSON.stringify(userData));
      axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    } catch (error: any) {
      // Handle different error scenarios with user-friendly messages
      if (error.response) {
        const status = error.response.status;
        const serverMessage = error.response.data?.message;

        if (status === 409) {
          // Conflict - duplicate data
          throw new Error(
            serverMessage || 'This username, email, or phone number is already registered'
          );
        } else if (status === 400) {
          // Validation error
          throw new Error(serverMessage || 'Please check your information and try again');
        } else if (status === 429) {
          // Rate limit
          throw new Error('Too many registration attempts. Please try again later');
        } else if (status >= 500) {
          // Server error
          throw new Error('Server error. Please try again later');
        }

        throw new Error(serverMessage || `Registration failed (Error ${status})`);
      } else if (error.request) {
        // Network error
        throw new Error('Network error. Please check your connection and try again');
      } else {
        // Other errors
        throw new Error(error.message || 'Registration failed. Please try again');
      }
    }
  };

  const value: AuthContextType = {
    user,
    token,
    login,
    register,
    logout,
    isLoading,
    isAuthenticated: !!token,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
