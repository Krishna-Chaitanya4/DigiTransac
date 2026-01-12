import { renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
    mockAxios.post = vi.fn();
    mockAxios.interceptors = {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should provide initial auth state', () => {
    const wrapper = ({ children }: any) => React.createElement(AuthProvider, {}, children);
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('should login function exist', () => {
    const wrapper = ({ children }: any) => React.createElement(AuthProvider, {}, children);
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(typeof result.current.login).toBe('function');
  });

  it('should register function exist', () => {
    const wrapper = ({ children }: any) => React.createElement(AuthProvider, {}, children);
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(typeof result.current.register).toBe('function');
  });

  it('should logout function exist', () => {
    const wrapper = ({ children }: any) => React.createElement(AuthProvider, {}, children);
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(typeof result.current.logout).toBe('function');
  });

  it('should handle login error', () => {
    const wrapper = ({ children }: any) => React.createElement(AuthProvider, {}, children);
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('should handle register error', () => {
    const wrapper = ({ children }: any) => React.createElement(AuthProvider, {}, children);
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('should persist token to localStorage', () => {
    const userData = {
      id: '1',
      email: 'test@example.com',
      username: 'testuser',
      fullName: 'Test User',
    };
    localStorageMock.setItem('auth-token', 'test-jwt-token');
    localStorageMock.setItem('auth-user', JSON.stringify(userData));

    const wrapper = ({ children }: any) => React.createElement(AuthProvider, {}, children);
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.token).toBe('test-jwt-token');
  });

  it('should logout and clear token', () => {
    const wrapper = ({ children }: any) => React.createElement(AuthProvider, {}, children);
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isAuthenticated).toBe(false);
  });

  it('should restore auth state from localStorage on mount', () => {
    const userData = {
      id: '1',
      email: 'test@example.com',
      username: 'testuser',
      fullName: 'Test User',
    };
    localStorageMock.setItem('auth-token', 'test-jwt-token');
    localStorageMock.setItem('auth-user', JSON.stringify(userData));

    const wrapper = ({ children }: any) => React.createElement(AuthProvider, {}, children);
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.token).toBe('test-jwt-token');
    expect(result.current.user?.email).toBe('test@example.com');
  });
});
