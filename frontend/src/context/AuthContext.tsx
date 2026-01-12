import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios, { AxiosInstance } from 'axios';

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
  login: (emailOrUsername: string, password: string) => Promise<void>;
  register: (email: string, username: string, fullName: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

// ============================================================================
// CONTEXT & HOOK
// ============================================================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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

const createApiClient = (token: string | null): AxiosInstance => {
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

  // Restore token and user from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('auth-token');
    const savedUser = localStorage.getItem('auth-user');

    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
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

      // Handle .NET response format: { success: true, data: { token, user } }
      const responseData = response.data.data || response.data;
      const { token: newToken, user: newUser } = responseData;

      if (newToken && newUser) {
        setToken(newToken);
        setUser(newUser);
        localStorage.setItem('auth-token', newToken);
        localStorage.setItem('auth-user', JSON.stringify(newUser));
      } else {
        throw new Error('Invalid response format from server');
      }
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

      // Handle .NET response format: { success: true, data: { token, user } }
      const responseData = response.data.data || response.data;
      const { token: newToken, user: newUser } = responseData;

      if (newToken && newUser) {
        setToken(newToken);
        setUser(newUser);
        localStorage.setItem('auth-token', newToken);
        localStorage.setItem('auth-user', JSON.stringify(newUser));
      } else {
        throw new Error('Invalid response format from server');
      }
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
    login,
    register,
    logout,
    isAuthenticated: !!token && !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
