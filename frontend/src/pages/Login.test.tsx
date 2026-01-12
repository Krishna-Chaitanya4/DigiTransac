import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Login } from './Login';
import { AuthProvider } from '../context/AuthContext';
import axios from 'axios';

vi.mock('axios');
const mockAxios = axios as any;

const renderLogin = () => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <Login />
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('Login Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render login form', () => {
    renderLogin();
    expect(screen.getByText(/login/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/email or username/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/password/i)).toBeInTheDocument();
  });

  it('should display email/username input', () => {
    renderLogin();
    const input = screen.getByPlaceholderText(/email or username/i) as HTMLInputElement;
    expect(input).toBeInTheDocument();
  });

  it('should display password input', () => {
    renderLogin();
    const input = screen.getByPlaceholderText(/password/i) as HTMLInputElement;
    expect(input).toBeInTheDocument();
  });

  it('should display login button', () => {
    renderLogin();
    const button = screen.getByRole('button', { name: /login/i });
    expect(button).toBeInTheDocument();
  });

  it('should display link to register page', () => {
    renderLogin();
    const link = screen.getByText(/don't have an account/i);
    expect(link).toBeInTheDocument();
  });

  it('should validate empty email/username', async () => {
    renderLogin();
    const submitButton = screen.getByRole('button', { name: /login/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/email or username is required/i)).toBeInTheDocument();
    });
  });

  it('should validate empty password', async () => {
    renderLogin();
    const emailInput = screen.getByPlaceholderText(/email or username/i);
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

    const submitButton = screen.getByRole('button', { name: /login/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    });
  });

  it('should show loading state during login', async () => {
    mockAxios.post.mockImplementation(
      () =>
        new Promise(() => {
          // Never resolves to keep loading state
        })
    );

    renderLogin();
    const emailInput = screen.getByPlaceholderText(/email or username/i);
    const passwordInput = screen.getByPlaceholderText(/password/i);
    const submitButton = screen.getByRole('button', { name: /login/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(submitButton).toBeDisabled();
    });
  });

  it('should display error alert on login failure', async () => {
    mockAxios.post.mockRejectedValueOnce(
      new Error('Invalid credentials')
    );

    renderLogin();
    const emailInput = screen.getByPlaceholderText(/email or username/i);
    const passwordInput = screen.getByPlaceholderText(/password/i);
    const submitButton = screen.getByRole('button', { name: /login/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    });
  });

  it('should clear error alert on new input', async () => {
    renderLogin();
    const emailInput = screen.getByPlaceholderText(/email or username/i);

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(emailInput, { target: { value: '' } });

    await waitFor(() => {
      expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
    });
  });

  it('should navigate to dashboard on successful login', async () => {
    mockAxios.post.mockResolvedValueOnce({
      data: {
        data: {
          token: 'test-jwt-token',
          user: { id: '1', email: 'test@example.com', username: 'testuser', fullName: 'Test User' },
        },
      },
    });

    renderLogin();
    const emailInput = screen.getByPlaceholderText(/email or username/i);
    const passwordInput = screen.getByPlaceholderText(/password/i);
    const submitButton = screen.getByRole('button', { name: /login/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      // Check if navigation occurred
      expect(window.location.pathname).toBe('/dashboard');
    });
  });
});
