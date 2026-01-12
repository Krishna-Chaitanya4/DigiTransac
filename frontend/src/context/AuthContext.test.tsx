import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import { AuthProvider, useAuth } from './AuthContext';
import React from 'react';

// Mock axios
vi.mock('axios');
const mockAxios = axios as any;

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('AuthContext', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('should provide initial auth state', () => {
    const wrapper = ({ children }: any) => React.createElement(AuthProvider, {}, children);
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('should login successfully with email', async () => {
    const mockResponse = {
      data: {
        data: {
          token: 'test-jwt-token',
          user: { id: '1', email: 'test@example.com', username: 'testuser', fullName: 'Test User' },
        },
      },
    };
    mockAxios.post.mockResolvedValueOnce(mockResponse);

    const wrapper = ({ children }: any) => React.createElement(AuthProvider, {}, children);
    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => {
      result.current.login('test@example.com', 'password123');
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user?.email).toBe('test@example.com');
    });
  });

  it('should login successfully with username', async () => {
    const mockResponse = {
      data: {
        data: {
          token: 'test-jwt-token',
          user: { id: '1', email: 'test@example.com', username: 'testuser', fullName: 'Test User' },
        },
      },
    };
    mockAxios.post.mockResolvedValueOnce(mockResponse);

    const wrapper = ({ children }: any) => React.createElement(AuthProvider, {}, children);
    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => {
      result.current.login('testuser', 'password123');
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });
  });

  it('should register successfully', async () => {
    const mockResponse = {
      data: {
        data: {
          token: 'test-jwt-token',
          user: { id: '1', email: 'new@example.com', username: 'newuser', fullName: 'New User' },
        },
      },
    };
    mockAxios.post.mockResolvedValueOnce(mockResponse);

    const wrapper = ({ children }: any) => React.createElement(AuthProvider, {}, children);
    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => {
      result.current.register('new@example.com', 'newuser', 'New User', 'password123');
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user?.username).toBe('newuser');
    });
  });

  it('should handle login error', async () => {
    mockAxios.post.mockRejectedValueOnce(new Error('Invalid credentials'));

    const wrapper = ({ children }: any) => React.createElement(AuthProvider, {}, children);
    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => {
      result.current.login('test@example.com', 'wrongpassword');
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.error).toContain('Invalid credentials');
    });
  });

  it('should handle register error', async () => {
    mockAxios.post.mockRejectedValueOnce(new Error('Email already exists'));

    const wrapper = ({ children }: any) => React.createElement(AuthProvider, {}, children);
    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => {
      result.current.register('existing@example.com', 'user', 'User', 'password123');
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.error).toContain('already exists');
    });
  });

  it('should persist token to localStorage', async () => {
    const mockResponse = {
      data: {
        data: {
          token: 'test-jwt-token',
          user: { id: '1', email: 'test@example.com', username: 'testuser', fullName: 'Test User' },
        },
      },
    };
    mockAxios.post.mockResolvedValueOnce(mockResponse);

    const wrapper = ({ children }: any) => React.createElement(AuthProvider, {}, children);
    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => {
      result.current.login('test@example.com', 'password123');
    });

    await waitFor(() => {
      expect(localStorageMock.getItem('auth-token')).toBe('test-jwt-token');
    });
  });

  it('should logout and clear token', async () => {
    localStorageMock.setItem('auth-token', 'test-jwt-token');

    const wrapper = ({ children }: any) => React.createElement(AuthProvider, {}, children);
    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => {
      result.current.logout();
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(false);
      expect(localStorageMock.getItem('auth-token')).toBeNull();
    });
  });

  it('should restore auth state from localStorage on mount', () => {
    localStorageMock.setItem('auth-token', 'test-jwt-token');
    localStorageMock.setItem('auth-user', JSON.stringify({
      id: '1',
      email: 'test@example.com',
      username: 'testuser',
      fullName: 'Test User',
    }));

    const wrapper = ({ children }: any) => React.createElement(AuthProvider, {}, children);
    const { result } = renderHook(() => useAuth(), { wrapper });

    waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user?.email).toBe('test@example.com');
    });
  });
});
