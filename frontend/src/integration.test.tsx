import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import App from '../App';
import axios from 'axios';

vi.mock('axios');
const mockAxios = axios as any;

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

describe('E2E: Complete Auth Flow', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('should complete full registration flow', async () => {
    mockAxios.post.mockResolvedValueOnce({
      data: {
        data: {
          token: 'test-jwt-token',
          user: { id: '1', email: 'new@example.com', username: 'newuser', fullName: 'New User' },
        },
      },
    });

    render(<App />);

    // Should start on register (home redirects to dashboard, but no auth redirects to login)
    const registerLink = screen.getByText(/create an account|register/i);
    fireEvent.click(registerLink);

    // Fill register form
    const emailInput = screen.getByPlaceholderText(/email/i);
    const usernameInput = screen.getByPlaceholderText(/^username/i);
    const fullNameInput = screen.getByPlaceholderText(/full name/i);
    const passwordInput = screen.getByPlaceholderText(/^password/i);
    const confirmPasswordInput = screen.getByPlaceholderText(/confirm password/i);

    fireEvent.change(emailInput, { target: { value: 'new@example.com' } });
    fireEvent.change(usernameInput, { target: { value: 'newuser' } });
    fireEvent.change(fullNameInput, { target: { value: 'New User' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } });

    const submitButton = screen.getByRole('button', { name: /register/i });
    fireEvent.click(submitButton);

    // Verify token stored and navigation occurred
    await waitFor(() => {
      expect(localStorageMock.getItem('auth-token')).toBe('test-jwt-token');
    });
  });

  it('should complete full login flow', async () => {
    mockAxios.post.mockResolvedValueOnce({
      data: {
        data: {
          token: 'test-jwt-token',
          user: { id: '1', email: 'test@example.com', username: 'testuser', fullName: 'Test User' },
        },
      },
    });

    render(<App />);

    // Fill login form
    const emailInput = screen.getByPlaceholderText(/email or username/i);
    const passwordInput = screen.getByPlaceholderText(/password/i);

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    const submitButton = screen.getByRole('button', { name: /login/i });
    fireEvent.click(submitButton);

    // Verify token stored
    await waitFor(() => {
      expect(localStorageMock.getItem('auth-token')).toBe('test-jwt-token');
    });
  });

  it('should show dashboard after login', async () => {
    mockAxios.post.mockResolvedValueOnce({
      data: {
        data: {
          token: 'test-jwt-token',
          user: { id: '1', email: 'test@example.com', username: 'testuser', fullName: 'Test User' },
        },
      },
    });

    render(<App />);

    const emailInput = screen.getByPlaceholderText(/email or username/i);
    const passwordInput = screen.getByPlaceholderText(/password/i);
    const submitButton = screen.getByRole('button', { name: /login/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    // Should show dashboard with welcome message
    await waitFor(() => {
      expect(screen.getByText(/welcome/i)).toBeInTheDocument();
    });
  });

  it('should redirect to login when not authenticated', async () => {
    render(<App />);

    // Clear auth state
    localStorageMock.clear();

    // Verify user is on login page
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/email or username/i)).toBeInTheDocument();
    });
  });

  it('should logout and redirect to login', async () => {
    mockAxios.post.mockResolvedValueOnce({
      data: {
        data: {
          token: 'test-jwt-token',
          user: { id: '1', email: 'test@example.com', username: 'testuser', fullName: 'Test User' },
        },
      },
    });

    render(<App />);

    const emailInput = screen.getByPlaceholderText(/email or username/i);
    const passwordInput = screen.getByPlaceholderText(/password/i);
    const loginButton = screen.getByRole('button', { name: /login/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(loginButton);

    // Wait for dashboard to appear
    await waitFor(() => {
      expect(screen.getByText(/welcome/i)).toBeInTheDocument();
    });

    // Click logout
    const logoutButton = screen.getByRole('button', { name: /logout/i });
    fireEvent.click(logoutButton);

    // Should be redirected to login
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/email or username/i)).toBeInTheDocument();
    });
  });
});
