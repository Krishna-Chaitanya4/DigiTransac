import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types/auth';
import * as authService from '../services/authService';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  completeRegistration: (email: string, verificationToken: string, password: string, fullName: string) => Promise<void>;
  logout: () => void;
  deleteAccount: (password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'digitransac_token';
const USER_KEY = 'digitransac_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing token on mount
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const handleAuthSuccess = (authResponse: { token: string; email: string; fullName: string; isEmailVerified: boolean }) => {
    const userData: User = { 
      email: authResponse.email, 
      fullName: authResponse.fullName,
      isEmailVerified: authResponse.isEmailVerified
    };
    setToken(authResponse.token);
    setUser(userData);
    localStorage.setItem(TOKEN_KEY, authResponse.token);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
  };

  const login = async (email: string, password: string) => {
    const response = await authService.login(email, password);
    handleAuthSuccess(response);
  };

  const completeRegistration = async (email: string, verificationToken: string, password: string, fullName: string) => {
    const response = await authService.completeRegistration(email, verificationToken, password, fullName);
    handleAuthSuccess(response);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  };

  const deleteAccount = async (password: string) => {
    if (!token) {
      throw new Error('Not authenticated');
    }
    await authService.deleteAccount(token, password);
    logout(); // Clear local state after successful deletion
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, completeRegistration, logout, deleteAccount }}>
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
