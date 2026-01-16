import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithRouter, userEvent } from '../test/test-utils';
import ForgotPasswordPage from './ForgotPasswordPage';
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

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Step 1: Email', () => {
    it('should render email form initially', () => {
      renderWithRouter(<ForgotPasswordPage />);
      
      expect(screen.getByRole('heading', { name: /forgot your password/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /send reset code/i })).toBeInTheDocument();
    });

    it('should have link back to login page', () => {
      renderWithRouter(<ForgotPasswordPage />);
      
      const backLink = screen.getByRole('link', { name: /sign in/i });
      expect(backLink).toHaveAttribute('href', '/login');
    });

    it('should send reset code on submit', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      vi.mocked(authService.sendPasswordResetCode).mockResolvedValue({ 
        message: 'Reset code sent' 
      });

      renderWithRouter(<ForgotPasswordPage />);

      await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
      await user.click(screen.getByRole('button', { name: /send reset code/i }));

      await waitFor(() => {
        expect(authService.sendPasswordResetCode).toHaveBeenCalledWith('test@example.com');
      });

      // Should show success and move to step 2
      await waitFor(() => {
        expect(screen.getByText(/reset code sent/i)).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /enter reset code/i })).toBeInTheDocument();
      });
    });

    it('should display error on failure', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      vi.mocked(authService.sendPasswordResetCode).mockRejectedValue(
        new Error('Email not found')
      );

      renderWithRouter(<ForgotPasswordPage />);

      await user.type(screen.getByLabelText(/email address/i), 'unknown@example.com');
      await user.click(screen.getByRole('button', { name: /send reset code/i }));

      await waitFor(() => {
        expect(screen.getByText('Email not found')).toBeInTheDocument();
      });
    });
  });

  describe('Step 2: Verify Code', () => {
    async function goToVerifyStep() {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      vi.mocked(authService.sendPasswordResetCode).mockResolvedValue({ 
        message: 'Reset code sent' 
      });

      renderWithRouter(<ForgotPasswordPage />);

      await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
      await user.click(screen.getByRole('button', { name: /send reset code/i }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /enter reset code/i })).toBeInTheDocument();
      });

      return user;
    }

    it('should show verification code input after email submission', async () => {
      await goToVerifyStep();
      
      expect(screen.getByText(/we sent a code to test@example.com/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/reset code/i)).toBeInTheDocument();
    });

    it('should verify code and move to step 3', async () => {
      const user = await goToVerifyStep();
      vi.mocked(authService.verifyResetCode).mockResolvedValue({
        message: 'Code verified',
        verificationToken: 'reset-token-123',
      });

      await user.type(screen.getByLabelText(/reset code/i), '123456');
      await user.click(screen.getByRole('button', { name: /verify code/i }));

      await waitFor(() => {
        expect(authService.verifyResetCode).toHaveBeenCalledWith('test@example.com', '123456');
      });

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /set new password/i })).toBeInTheDocument();
      });
    });

    it('should display error on invalid code', async () => {
      const user = await goToVerifyStep();
      vi.mocked(authService.verifyResetCode).mockRejectedValue(
        new Error('Invalid or expired code')
      );

      await user.type(screen.getByLabelText(/reset code/i), '000000');
      await user.click(screen.getByRole('button', { name: /verify code/i }));

      await waitFor(() => {
        expect(screen.getByText('Invalid or expired code')).toBeInTheDocument();
      });
    });

    it('should allow resending reset code', async () => {
      const user = await goToVerifyStep();
      vi.mocked(authService.sendPasswordResetCode).mockResolvedValue({ 
        message: 'Reset code resent!' 
      });

      const resendButton = screen.getByRole('button', { name: /didn't receive the code\? resend/i });
      await user.click(resendButton);

      await waitFor(() => {
        expect(authService.sendPasswordResetCode).toHaveBeenCalledTimes(2);
        expect(screen.getByText(/reset code resent!/i)).toBeInTheDocument();
      });
    });
  });

  describe('Step 3: Reset Password', () => {
    async function goToResetStep() {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      vi.mocked(authService.sendPasswordResetCode).mockResolvedValue({ 
        message: 'Reset code sent' 
      });
      vi.mocked(authService.verifyResetCode).mockResolvedValue({
        message: 'Code verified',
        verificationToken: 'reset-token-123',
      });

      renderWithRouter(<ForgotPasswordPage />);

      // Step 1: Email
      await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
      await user.click(screen.getByRole('button', { name: /send reset code/i }));

      await waitFor(() => {
        expect(screen.getByLabelText(/reset code/i)).toBeInTheDocument();
      });

      // Step 2: Verify
      await user.type(screen.getByLabelText(/reset code/i), '123456');
      await user.click(screen.getByRole('button', { name: /verify code/i }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /set new password/i })).toBeInTheDocument();
      });

      return user;
    }

    it('should show password reset form', async () => {
      await goToResetStep();

      expect(screen.getByLabelText(/^new password$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/confirm new password/i)).toBeInTheDocument();
    });

    it('should validate password requirements', async () => {
      const user = await goToResetStep();

      await user.type(screen.getByLabelText(/^new password$/i), 'weak');
      await user.type(screen.getByLabelText(/confirm new password/i), 'weak');
      await user.click(screen.getByRole('button', { name: /reset password/i }));

      await waitFor(() => {
        expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument();
      });
    });

    it('should check passwords match', async () => {
      const user = await goToResetStep();

      await user.type(screen.getByLabelText(/^new password$/i), 'Password@123');
      await user.type(screen.getByLabelText(/confirm new password/i), 'DifferentPass@123');
      await user.click(screen.getByRole('button', { name: /reset password/i }));

      await waitFor(() => {
        expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
      });
    });

    it('should reset password and redirect to login', async () => {
      const user = await goToResetStep();
      vi.mocked(authService.resetPassword).mockResolvedValue({
        message: 'Password reset successfully',
      });

      await user.type(screen.getByLabelText(/^new password$/i), 'NewPassword@123');
      await user.type(screen.getByLabelText(/confirm new password/i), 'NewPassword@123');
      await user.click(screen.getByRole('button', { name: /reset password/i }));

      await waitFor(() => {
        expect(authService.resetPassword).toHaveBeenCalledWith(
          'test@example.com',
          'reset-token-123',
          'NewPassword@123'
        );
      });

      await waitFor(() => {
        expect(screen.getByText(/password reset successfully/i)).toBeInTheDocument();
      });

      // Advance timer for redirect
      vi.advanceTimersByTime(2000);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login');
      });
    });

    it('should display error on reset failure', async () => {
      const user = await goToResetStep();
      vi.mocked(authService.resetPassword).mockRejectedValue(
        new Error('Token expired')
      );

      await user.type(screen.getByLabelText(/^new password$/i), 'NewPassword@123');
      await user.type(screen.getByLabelText(/confirm new password/i), 'NewPassword@123');
      await user.click(screen.getByRole('button', { name: /reset password/i }));

      await waitFor(() => {
        expect(screen.getByText('Token expired')).toBeInTheDocument();
      });
    });
  });
});
