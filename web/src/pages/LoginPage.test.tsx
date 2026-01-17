import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithRouter, userEvent } from '../test/test-utils';
import LoginPage from './LoginPage';
import * as authService from '../services/authService';

// Mock the auth service
vi.mock('../services/authService');

// Mock react-router-dom's useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should render login form', () => {
    renderWithRouter(<LoginPage />);
    
    expect(screen.getByRole('heading', { name: /sign in to digitransac/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('should have link to register page', () => {
    renderWithRouter(<LoginPage />);
    
    const registerLink = screen.getByRole('link', { name: /create a new account/i });
    expect(registerLink).toHaveAttribute('href', '/register');
  });

  it('should have link to forgot password page', () => {
    renderWithRouter(<LoginPage />);
    
    const forgotPasswordLink = screen.getByRole('link', { name: /forgot your password/i });
    expect(forgotPasswordLink).toHaveAttribute('href', '/forgot-password');
  });

  it('should update form fields when typing', async () => {
    const user = userEvent.setup();
    renderWithRouter(<LoginPage />);

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');

    expect(emailInput).toHaveValue('test@example.com');
    expect(passwordInput).toHaveValue('password123');
  });

  it('should submit form and navigate on successful login', async () => {
    const user = userEvent.setup();
    const mockResponse = {
      accessToken: 'jwt-token',
      refreshToken: 'refresh-token',
      email: 'test@example.com',
      fullName: 'Test User',
      isEmailVerified: true,
    };
    vi.mocked(authService.login).mockResolvedValue(mockResponse);

    renderWithRouter(<LoginPage />);

    await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(authService.login).toHaveBeenCalledWith('test@example.com', 'password123');
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('should display error message on login failure', async () => {
    const user = userEvent.setup();
    vi.mocked(authService.login).mockRejectedValue(new Error('Invalid credentials'));

    renderWithRouter(<LoginPage />);

    await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'wrongpassword');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });

  it('should disable submit button while submitting', async () => {
    const user = userEvent.setup();
    // Create a promise that we can control
    let resolveLogin: (value: any) => void;
    const loginPromise = new Promise((resolve) => {
      resolveLogin = resolve;
    });
    vi.mocked(authService.login).mockReturnValue(loginPromise as any);

    renderWithRouter(<LoginPage />);

    await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    await user.click(submitButton);

    // Button should show loading state
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled();
    });

    // Resolve the login
    resolveLogin!({
      accessToken: 'jwt-token',
      refreshToken: 'refresh-token',
      email: 'test@example.com',
      fullName: 'Test User',
      isEmailVerified: true,
    });
  });

  it('should require email and password fields', () => {
    renderWithRouter(<LoginPage />);

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);

    expect(emailInput).toBeRequired();
    expect(passwordInput).toBeRequired();
  });

  describe('Two-Factor Authentication', () => {
    it('should show 2FA verification screen when login requires 2FA', async () => {
      const user = userEvent.setup();
      vi.mocked(authService.login).mockResolvedValue({
        requiresTwoFactor: true,
        twoFactorToken: 'temp-2fa-token',
      });

      renderWithRouter(<LoginPage />);

      await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /two-factor authentication/i })).toBeInTheDocument();
      });
    });

    it('should show verification code input on 2FA screen', async () => {
      const user = userEvent.setup();
      vi.mocked(authService.login).mockResolvedValue({
        requiresTwoFactor: true,
        twoFactorToken: 'temp-2fa-token',
      });

      renderWithRouter(<LoginPage />);

      await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText('000000')).toBeInTheDocument();
      });
    });

    it('should show back to login button on 2FA screen', async () => {
      const user = userEvent.setup();
      vi.mocked(authService.login).mockResolvedValue({
        requiresTwoFactor: true,
        twoFactorToken: 'temp-2fa-token',
      });

      renderWithRouter(<LoginPage />);

      await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /back to login/i })).toBeInTheDocument();
      });
    });

    it('should return to login form when back button is clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(authService.login).mockResolvedValue({
        requiresTwoFactor: true,
        twoFactorToken: 'temp-2fa-token',
      });

      renderWithRouter(<LoginPage />);

      await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /two-factor authentication/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /back to login/i }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /sign in to digitransac/i })).toBeInTheDocument();
      });
    });

    it('should only allow numeric input in 2FA code field', async () => {
      const user = userEvent.setup();
      vi.mocked(authService.login).mockResolvedValue({
        requiresTwoFactor: true,
        twoFactorToken: 'temp-2fa-token',
      });

      renderWithRouter(<LoginPage />);

      await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('000000')).toBeInTheDocument();
      });

      const codeInput = screen.getByPlaceholderText('000000');
      await user.type(codeInput, 'abc123xyz456');

      expect(codeInput).toHaveValue('123456');
    });

    it('should disable verify button when code is not 6 digits', async () => {
      const user = userEvent.setup();
      vi.mocked(authService.login).mockResolvedValue({
        requiresTwoFactor: true,
        twoFactorToken: 'temp-2fa-token',
      });

      renderWithRouter(<LoginPage />);

      await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /verify/i })).toBeDisabled();
      });

      await user.type(screen.getByPlaceholderText('000000'), '123');

      expect(screen.getByRole('button', { name: /verify/i })).toBeDisabled();
    });

    it('should enable verify button when 6-digit code is entered', async () => {
      const user = userEvent.setup();
      vi.mocked(authService.login).mockResolvedValue({
        requiresTwoFactor: true,
        twoFactorToken: 'temp-2fa-token',
      });

      renderWithRouter(<LoginPage />);

      await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('000000')).toBeInTheDocument();
      });

      await user.type(screen.getByPlaceholderText('000000'), '123456');

      expect(screen.getByRole('button', { name: /verify/i })).not.toBeDisabled();
    });

    it('should call verifyTwoFactorLogin and navigate on successful verification', async () => {
      const user = userEvent.setup();
      vi.mocked(authService.login).mockResolvedValue({
        requiresTwoFactor: true,
        twoFactorToken: 'temp-2fa-token',
      });
      vi.mocked(authService.verifyTwoFactorLogin).mockResolvedValue({
        accessToken: 'jwt-token',
        refreshToken: 'refresh-token',
        email: 'test@example.com',
        fullName: 'Test User',
        isEmailVerified: true,
      });

      renderWithRouter(<LoginPage />);

      await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('000000')).toBeInTheDocument();
      });

      await user.type(screen.getByPlaceholderText('000000'), '123456');
      await user.click(screen.getByRole('button', { name: /verify/i }));

      await waitFor(() => {
        expect(authService.verifyTwoFactorLogin).toHaveBeenCalledWith('temp-2fa-token', '123456');
      });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
      });
    });

    it('should show error on invalid 2FA code', async () => {
      const user = userEvent.setup();
      vi.mocked(authService.login).mockResolvedValue({
        requiresTwoFactor: true,
        twoFactorToken: 'temp-2fa-token',
      });
      vi.mocked(authService.verifyTwoFactorLogin).mockRejectedValue(new Error('Invalid verification code'));

      renderWithRouter(<LoginPage />);

      await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('000000')).toBeInTheDocument();
      });

      await user.type(screen.getByPlaceholderText('000000'), '000000');
      await user.click(screen.getByRole('button', { name: /verify/i }));

      await waitFor(() => {
        expect(screen.getByText('Invalid verification code')).toBeInTheDocument();
      });
    });

    it('should show email me a code instead option on 2FA screen', async () => {
      const user = userEvent.setup();
      vi.mocked(authService.login).mockResolvedValue({
        requiresTwoFactor: true,
        twoFactorToken: 'temp-2fa-token',
      });

      renderWithRouter(<LoginPage />);

      await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /email me a code instead/i })).toBeInTheDocument();
      });
    });

    it('should switch to email OTP screen when clicking email me a code instead', async () => {
      const user = userEvent.setup();
      vi.mocked(authService.login).mockResolvedValue({
        requiresTwoFactor: true,
        twoFactorToken: 'temp-2fa-token',
      });

      renderWithRouter(<LoginPage />);

      await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /email me a code instead/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /email me a code instead/i }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /email verification/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /send code to my email/i })).toBeInTheDocument();
      });
    });

    it('should send email OTP when clicking send code button', async () => {
      const user = userEvent.setup();
      vi.mocked(authService.login).mockResolvedValue({
        requiresTwoFactor: true,
        twoFactorToken: 'temp-2fa-token',
      });
      vi.mocked(authService.sendTwoFactorEmailOtp).mockResolvedValue({
        message: 'Verification code sent to your email',
      });

      renderWithRouter(<LoginPage />);

      await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /email me a code instead/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /email me a code instead/i }));
      await user.click(screen.getByRole('button', { name: /send code to my email/i }));

      await waitFor(() => {
        expect(authService.sendTwoFactorEmailOtp).toHaveBeenCalledWith('temp-2fa-token');
      });

      await waitFor(() => {
        expect(screen.getByText('Verification code sent to your email')).toBeInTheDocument();
        expect(screen.getByLabelText(/email code/i)).toBeInTheDocument();
      });
    });

    it('should switch back to authenticator app when clicking use authenticator app instead', async () => {
      const user = userEvent.setup();
      vi.mocked(authService.login).mockResolvedValue({
        requiresTwoFactor: true,
        twoFactorToken: 'temp-2fa-token',
      });

      renderWithRouter(<LoginPage />);

      await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /email me a code instead/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /email me a code instead/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /use authenticator app instead/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /use authenticator app instead/i }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /two-factor authentication/i })).toBeInTheDocument();
        expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
      });
    });

    it('should verify email OTP and login successfully', async () => {
      const user = userEvent.setup();
      vi.mocked(authService.login).mockResolvedValue({
        requiresTwoFactor: true,
        twoFactorToken: 'temp-2fa-token',
      });
      vi.mocked(authService.sendTwoFactorEmailOtp).mockResolvedValue({
        message: 'Verification code sent to your email',
      });
      vi.mocked(authService.verifyTwoFactorEmailOtp).mockResolvedValue({
        accessToken: 'jwt-token',
        refreshToken: 'refresh-token',
        email: 'test@example.com',
        fullName: 'Test User',
        isEmailVerified: true,
      });

      renderWithRouter(<LoginPage />);

      await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /email me a code instead/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /email me a code instead/i }));
      await user.click(screen.getByRole('button', { name: /send code to my email/i }));

      await waitFor(() => {
        expect(screen.getByLabelText(/email code/i)).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/email code/i), '654321');
      await user.click(screen.getByRole('button', { name: /verify/i }));

      await waitFor(() => {
        expect(authService.verifyTwoFactorEmailOtp).toHaveBeenCalledWith('temp-2fa-token', '654321');
      });
    });

    it('should show error on failed email OTP send', async () => {
      const user = userEvent.setup();
      vi.mocked(authService.login).mockResolvedValue({
        requiresTwoFactor: true,
        twoFactorToken: 'temp-2fa-token',
      });
      vi.mocked(authService.sendTwoFactorEmailOtp).mockRejectedValue(new Error('Please wait before requesting another code'));

      renderWithRouter(<LoginPage />);

      await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /email me a code instead/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /email me a code instead/i }));
      await user.click(screen.getByRole('button', { name: /send code to my email/i }));

      await waitFor(() => {
        expect(screen.getByText('Please wait before requesting another code')).toBeInTheDocument();
      });
    });

    it('should show error on invalid email OTP code', async () => {
      const user = userEvent.setup();
      vi.mocked(authService.login).mockResolvedValue({
        requiresTwoFactor: true,
        twoFactorToken: 'temp-2fa-token',
      });
      vi.mocked(authService.sendTwoFactorEmailOtp).mockResolvedValue({
        message: 'Verification code sent to your email',
      });
      vi.mocked(authService.verifyTwoFactorEmailOtp).mockRejectedValue(new Error('Invalid or expired verification code'));

      renderWithRouter(<LoginPage />);

      await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /email me a code instead/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /email me a code instead/i }));
      await user.click(screen.getByRole('button', { name: /send code to my email/i }));

      await waitFor(() => {
        expect(screen.getByLabelText(/email code/i)).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/email code/i), '000000');
      await user.click(screen.getByRole('button', { name: /verify/i }));

      await waitFor(() => {
        expect(screen.getByText('Invalid or expired verification code')).toBeInTheDocument();
      });
    });
  });
});
