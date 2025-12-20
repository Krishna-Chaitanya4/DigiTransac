import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import { configService } from '../services/config.service';

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

  useEffect(() => {
    const initAuth = async () => {
      // Load runtime configuration first
      await configService.fetchConfig();
      
      // Configure axios with runtime API URL
      axios.defaults.baseURL = configService.getApiUrl();
      
      const savedToken = localStorage.getItem('auth-token');
      const savedUser = localStorage.getItem('auth-user');
      
      if (savedToken && savedUser) {
        try {
          setToken(savedToken);
          setUser(JSON.parse(savedUser));
          axios.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
        } catch (error) {
          console.error('Error restoring auth:', error);
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
          console.log('Authentication error (401), logging out...', error.response?.data);
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
      const response = await axios.post<AuthResponse>('/api/auth/login', { 
        email, 
        password 
      });
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Login failed');
      }

      const { token: newToken, user: userData } = response.data;
      
      setToken(newToken);
      setUser(userData);
      localStorage.setItem('auth-token', newToken);
      localStorage.setItem('auth-user', JSON.stringify(userData));
      axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Login failed';
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
