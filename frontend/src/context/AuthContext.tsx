import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import { configService } from '../services/config.service';
import { syncFromAPI, setupAutoSync, isOnline } from '../utils/offlineSync';
import { initDB } from '../utils/indexedDB';
import { isDevelopmentEnvironment } from '../utils/environment';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  currency: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
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
        } catch (error) {
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

  const login = async (email: string, password: string) => {
    try {
      // Use relative URL to let Vite proxy handle it
      const loginUrl = '/api/auth/login';
      
      // Try fetch with relative path (uses Vite proxy)
      const fetchResponse = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      }).catch((fetchError) => {
        throw new Error(`Network request failed: ${fetchError.message}`);
      });

      if (!fetchResponse.ok) {
        const errorData = await fetchResponse.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${fetchResponse.status}`);
      }

      const data = await fetchResponse.json();

      if (!data.success) {
        throw new Error(data.message || 'Login failed');
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
      const errorMessage = error.response?.data?.message || error.message || 'Registration failed';
      throw new Error(errorMessage);
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
