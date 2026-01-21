import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithRouter, userEvent } from '../test/test-utils';
import RegisterPage from './RegisterPage';
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

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('Step 1: Email', () => {
    it('should render email form initially', () => {
      renderWithRouter(<RegisterPage />);
      
      expect(screen.getByRole('heading', { name: /create your account/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /send verification code/i })).toBeInTheDocument();
    });

    it('should have link to login page', () => {
      renderWithRouter(<RegisterPage />);
      
      const loginLink = screen.getByRole('link', { name: /sign in/i });
      expect(loginLink).toHaveAttribute('href', '/login');
    });

    it('should send verification code on submit', async () => {
      const user = userEvent.setup();
      vi.mocked(authService.sendVerificationCode).mockResolvedValue({ 
        message: 'Verification code sent' 
      });

      renderWithRouter(<RegisterPage />);

      await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
      await user.click(screen.getByRole('button', { name: /send verification code/i }));

      await waitFor(() => {
        expect(authService.sendVerificationCode).toHaveBeenCalledWith('test@example.com');
      });

      // Should show success message and move to step 2
      await waitFor(() => {
        expect(screen.getByText(/verification code sent/i)).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /verify your email/i })).toBeInTheDocument();
      });
    });

    it('should display error on failure', async () => {
      const user = userEvent.setup();
      vi.mocked(authService.sendVerificationCode).mockRejectedValue(
        new Error('Email already registered')
      );

      renderWithRouter(<RegisterPage />);

      await user.type(screen.getByLabelText(/email address/i), 'existing@example.com');
      await user.click(screen.getByRole('button', { name: /send verification code/i }));

      await waitFor(() => {
        expect(screen.getByText('Email already registered')).toBeInTheDocument();
      });
    });
  });

  describe('Step 2: Verify Code', () => {
    async function goToVerifyStep() {
      const user = userEvent.setup();
      vi.mocked(authService.sendVerificationCode).mockResolvedValue({ 
        message: 'Verification code sent' 
      });

      renderWithRouter(<RegisterPage />);

      await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
      await user.click(screen.getByRole('button', { name: /send verification code/i }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /verify your email/i })).toBeInTheDocument();
      });

      return user;
    }

    it('should show verification code input after email submission', async () => {
      await goToVerifyStep();
      
      expect(screen.getByText(/we sent a code to test@example.com/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
    });

    it('should verify code and move to step 3', async () => {
      const user = await goToVerifyStep();
      vi.mocked(authService.verifyCode).mockResolvedValue({
        message: 'Email verified',
        verificationToken: 'verification-token-123',
      });

      await user.type(screen.getByLabelText(/verification code/i), '123456');
      await user.click(screen.getByRole('button', { name: /verify/i }));

      await waitFor(() => {
        expect(authService.verifyCode).toHaveBeenCalledWith('test@example.com', '123456');
      });

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /complete registration/i })).toBeInTheDocument();
      });
    });

    it('should display error on invalid code', async () => {
      const user = await goToVerifyStep();
      vi.mocked(authService.verifyCode).mockRejectedValue(
        new Error('Invalid verification code')
      );

      await user.type(screen.getByLabelText(/verification code/i), '000000');
      await user.click(screen.getByRole('button', { name: /verify/i }));

      await waitFor(() => {
        expect(screen.getByText('Invalid verification code')).toBeInTheDocument();
      });
    });

    it('should allow resending verification code', async () => {
      const user = await goToVerifyStep();
      vi.mocked(authService.sendVerificationCode).mockResolvedValue({ 
        message: 'Verification code resent!' 
      });

      const resendButton = screen.getByRole('button', { name: /didn't receive the code\? resend/i });
      await user.click(resendButton);

      await waitFor(() => {
        expect(authService.sendVerificationCode).toHaveBeenCalledTimes(2);
        expect(screen.getByText(/verification code resent!/i)).toBeInTheDocument();
      });
    });
  });

  describe('Step 3: Complete Registration', () => {
    async function goToCompleteStep() {
      const user = userEvent.setup();
      vi.mocked(authService.sendVerificationCode).mockResolvedValue({ 
        message: 'Verification code sent' 
      });
      vi.mocked(authService.verifyCode).mockResolvedValue({
        message: 'Email verified',
        verificationToken: 'verification-token-123',
      });

      renderWithRouter(<RegisterPage />);

      // Step 1: Email
      await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
      await user.click(screen.getByRole('button', { name: /send verification code/i }));

      await waitFor(() => {
        expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
      });

      // Step 2: Verify
      await user.type(screen.getByLabelText(/verification code/i), '123456');
      await user.click(screen.getByRole('button', { name: /verify/i }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /complete registration/i })).toBeInTheDocument();
      });

      return user;
    }

    it('should show complete registration form', async () => {
      await goToCompleteStep();

      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    });

    it('should validate password requirements', async () => {
      const user = await goToCompleteStep();

      await user.type(screen.getByLabelText(/full name/i), 'Test User');
      await user.type(screen.getByLabelText(/^password$/i), 'weak');
      await user.type(screen.getByLabelText(/confirm password/i), 'weak');
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument();
      });
    });

    it('should check passwords match', async () => {
      const user = await goToCompleteStep();

      await user.type(screen.getByLabelText(/full name/i), 'Test User');
      await user.type(screen.getByLabelText(/^password$/i), 'Password@123');
      await user.type(screen.getByLabelText(/confirm password/i), 'DifferentPass@123');
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
      });
    });

    it('should complete registration successfully', async () => {
      const user = await goToCompleteStep();
      vi.mocked(authService.completeRegistration).mockResolvedValue({
        accessToken: 'jwt-token',
        refreshToken: 'refresh-token',
        email: 'test@example.com',
        fullName: 'Test User',
        isEmailVerified: true,
        primaryCurrency: 'USD',
      });

      await user.type(screen.getByLabelText(/full name/i), 'Test User');
      await user.type(screen.getByLabelText(/^password$/i), 'Password@123');
      await user.type(screen.getByLabelText(/confirm password/i), 'Password@123');
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
      });
    });
  });

  describe('Progress Indicator', () => {
    it('should show step 1 as active initially', () => {
      renderWithRouter(<RegisterPage />);
      
      // There should be 3 step indicators (1, 2, 3)
      const steps = screen.getAllByText(/^[123]$/);
      expect(steps).toHaveLength(3);
    });
  });
});
