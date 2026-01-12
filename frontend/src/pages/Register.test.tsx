import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Register } from './Register';
import { AuthProvider } from '../context/AuthContext';
import axios from 'axios';

vi.mock('axios');
const mockAxios = axios as any;

const renderRegister = () => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <Register />
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('Register Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render register form', () => {
    renderRegister();
    expect(screen.getByText(/create an account/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/username/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/full name/i)).toBeInTheDocument();
  });

  it('should display all form fields', () => {
    renderRegister();
    expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/^username/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/full name/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/^password/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/confirm password/i)).toBeInTheDocument();
  });

  it('should display register button', () => {
    renderRegister();
    const button = screen.getByRole('button', { name: /register/i });
    expect(button).toBeInTheDocument();
  });

  it('should display link to login page', () => {
    renderRegister();
    const link = screen.getByText(/already have an account/i);
    expect(link).toBeInTheDocument();
  });

  it('should validate invalid email format', async () => {
    renderRegister();
    const emailInput = screen.getByPlaceholderText(/email/i);
    fireEvent.change(emailInput, { target: { value: 'invalidemail' } });
    fireEvent.blur(emailInput);

    const submitButton = screen.getByRole('button', { name: /register/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
    });
  });

  it('should validate email required', async () => {
    renderRegister();
    const usernameInput = screen.getByPlaceholderText(/^username/i);
    fireEvent.change(usernameInput, { target: { value: 'testuser' } });

    const submitButton = screen.getByRole('button', { name: /register/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/email is required/i)).toBeInTheDocument();
    });
  });

  it('should validate username required', async () => {
    renderRegister();
    const emailInput = screen.getByPlaceholderText(/email/i);
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

    const submitButton = screen.getByRole('button', { name: /register/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/username is required/i)).toBeInTheDocument();
    });
  });

  it('should validate full name required', async () => {
    renderRegister();
    const emailInput = screen.getByPlaceholderText(/email/i);
    const usernameInput = screen.getByPlaceholderText(/^username/i);
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(usernameInput, { target: { value: 'testuser' } });

    const submitButton = screen.getByRole('button', { name: /register/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/full name is required/i)).toBeInTheDocument();
    });
  });

  it('should validate password minimum length', async () => {
    renderRegister();
    const emailInput = screen.getByPlaceholderText(/email/i);
    const usernameInput = screen.getByPlaceholderText(/^username/i);
    const fullNameInput = screen.getByPlaceholderText(/full name/i);
    const passwordInput = screen.getByPlaceholderText(/^password/i);

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(fullNameInput, { target: { value: 'Test User' } });
    fireEvent.change(passwordInput, { target: { value: 'pass123' } });

    const submitButton = screen.getByRole('button', { name: /register/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
    });
  });

  it('should validate password confirmation match', async () => {
    renderRegister();
    const emailInput = screen.getByPlaceholderText(/email/i);
    const usernameInput = screen.getByPlaceholderText(/^username/i);
    const fullNameInput = screen.getByPlaceholderText(/full name/i);
    const passwordInput = screen.getByPlaceholderText(/^password/i);
    const confirmPasswordInput = screen.getByPlaceholderText(/confirm password/i);

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(fullNameInput, { target: { value: 'Test User' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'different' } });

    const submitButton = screen.getByRole('button', { name: /register/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });
  });

  it('should show loading state during registration', async () => {
    mockAxios.post.mockImplementation(
      () =>
        new Promise(() => {
          // Never resolves to keep loading state
        })
    );

    renderRegister();
    const emailInput = screen.getByPlaceholderText(/email/i);
    const usernameInput = screen.getByPlaceholderText(/^username/i);
    const fullNameInput = screen.getByPlaceholderText(/full name/i);
    const passwordInput = screen.getByPlaceholderText(/^password/i);
    const confirmPasswordInput = screen.getByPlaceholderText(/confirm password/i);

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(fullNameInput, { target: { value: 'Test User' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } });

    const submitButton = screen.getByRole('button', { name: /register/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(submitButton).toBeDisabled();
    });
  });

  it('should display error on registration failure', async () => {
    mockAxios.post.mockRejectedValueOnce(
      new Error('Email already exists')
    );

    renderRegister();
    const emailInput = screen.getByPlaceholderText(/email/i);
    const usernameInput = screen.getByPlaceholderText(/^username/i);
    const fullNameInput = screen.getByPlaceholderText(/full name/i);
    const passwordInput = screen.getByPlaceholderText(/^password/i);
    const confirmPasswordInput = screen.getByPlaceholderText(/confirm password/i);

    fireEvent.change(emailInput, { target: { value: 'existing@example.com' } });
    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(fullNameInput, { target: { value: 'Test User' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } });

    const submitButton = screen.getByRole('button', { name: /register/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/already exists/i)).toBeInTheDocument();
    });
  });

  it('should clear error on input change', async () => {
    mockAxios.post.mockRejectedValueOnce(
      new Error('Email already exists')
    );

    renderRegister();
    const emailInput = screen.getByPlaceholderText(/email/i);
    const usernameInput = screen.getByPlaceholderText(/^username/i);
    const fullNameInput = screen.getByPlaceholderText(/full name/i);
    const passwordInput = screen.getByPlaceholderText(/^password/i);
    const confirmPasswordInput = screen.getByPlaceholderText(/confirm password/i);

    fireEvent.change(emailInput, { target: { value: 'existing@example.com' } });
    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(fullNameInput, { target: { value: 'Test User' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } });

    const submitButton = screen.getByRole('button', { name: /register/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/already exists/i)).toBeInTheDocument();
    });

    // Clear error on input change
    fireEvent.change(emailInput, { target: { value: 'newemail@example.com' } });

    await waitFor(() => {
      expect(screen.queryByText(/already exists/i)).not.toBeInTheDocument();
    });
  });

  it('should navigate to dashboard on successful registration', async () => {
    mockAxios.post.mockResolvedValueOnce({
      data: {
        data: {
          token: 'test-jwt-token',
          user: { id: '1', email: 'test@example.com', username: 'testuser', fullName: 'Test User' },
        },
      },
    });

    renderRegister();
    const emailInput = screen.getByPlaceholderText(/email/i);
    const usernameInput = screen.getByPlaceholderText(/^username/i);
    const fullNameInput = screen.getByPlaceholderText(/full name/i);
    const passwordInput = screen.getByPlaceholderText(/^password/i);
    const confirmPasswordInput = screen.getByPlaceholderText(/confirm password/i);

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(fullNameInput, { target: { value: 'Test User' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } });

    const submitButton = screen.getByRole('button', { name: /register/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/dashboard');
    });
  });
});
