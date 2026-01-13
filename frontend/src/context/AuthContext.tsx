import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5253/api/v1';

// ============================================================================
// TYPES
// ============================================================================

interface User {
  id: string;
  email: string;
  username: string;
  fullName: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  initialized: boolean;
  login: (emailOrUsername: string, password: string) => Promise<void>;
  register: (email: string, username: string, fullName: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

// ============================================================================
// CONTEXT & HOOK
// ============================================================================

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

// ============================================================================
// API CLIENT
// ============================================================================

const createApiClient = (token: string | null) => {
  const client = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000,
  });

  if (token) {
    client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  return client;
};

// ============================================================================
// PROVIDER
// ============================================================================

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Restore token and user from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('auth-token');
    const savedUser = localStorage.getItem('auth-user');

    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch (error) {
        // If localStorage data is corrupted, clear it
        localStorage.removeItem('auth-token');
        localStorage.removeItem('auth-user');
      }
    }
    
    // Mark initialization as complete
    setInitialized(true);
  }, []);

  // ========================================================================
  // LOGIN
  // ========================================================================
  const login = async (emailOrUsername: string, password: string) => {
    setLoading(true);
    try {
      const api = createApiClient(null);

      const response = await api.post('/auth/login', {
        emailOrUsername,
        password,
      });

      // Handle .NET API response format: { success: true, accessToken, refreshToken, user, ... }
      const { accessToken, user: apiUser } = response.data;

      if (!accessToken || !apiUser) {
        throw new Error('Invalid response format from server');
      }

      // Map API user to frontend User interface
      const newUser: User = {
        id: apiUser.id || '',
        email: apiUser.email || '',
        username: apiUser.username || '',
        fullName: apiUser.fullName || apiUser.fullname || '',
      };

      setToken(accessToken);
      setUser(newUser);
      localStorage.setItem('auth-token', accessToken);
      localStorage.setItem('auth-user', JSON.stringify(newUser));
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Login failed';
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  // ========================================================================
  // REGISTER
  // ========================================================================
  const register = async (
    email: string,
    username: string,
    fullName: string,
    password: string
  ) => {
    setLoading(true);
    try {
      const api = createApiClient(null);

      const response = await api.post('/auth/register', {
        email,
        username,
        fullName,
        password,
      });

      // Handle .NET API response format: { success: true, accessToken, refreshToken, user, ... }
      const { accessToken, user: apiUser } = response.data;

      if (!accessToken || !apiUser) {
        throw new Error('Invalid response format from server');
      }

      // Map API user to frontend User interface
      const newUser: User = {
        id: apiUser.id || '',
        email: apiUser.email || '',
        username: apiUser.username || '',
        fullName: apiUser.fullName || apiUser.fullname || '',
      };

      setToken(accessToken);
      setUser(newUser);
      localStorage.setItem('auth-token', accessToken);
      localStorage.setItem('auth-user', JSON.stringify(newUser));
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Registration failed';
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  // ========================================================================
  // LOGOUT
  // ========================================================================
  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('auth-token');
    localStorage.removeItem('auth-user');
  };

  // ========================================================================
  // RENDER
  // ========================================================================
  const value: AuthContextType = {
    user,
    token,
    loading,
    initialized,
    login,
    register,
    logout,
    isAuthenticated: !!token && !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
