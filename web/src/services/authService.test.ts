import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as authService from './authService';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('authService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getStoredAccessToken', () => {
    it('should return token from localStorage', () => {
      localStorageMock.getItem.mockReturnValue('test-token');
      
      const result = authService.getStoredAccessToken();
      
      expect(result).toBe('test-token');
      expect(localStorageMock.getItem).toHaveBeenCalledWith('digitransac_access_token');
    });

    it('should return null when no token exists', () => {
      localStorageMock.getItem.mockReturnValue(null);
      
      const result = authService.getStoredAccessToken();
      
      expect(result).toBeNull();
    });
  });

  describe('sendVerificationCode', () => {
    it('should send verification code request', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: 'Code sent', verificationToken: 'token123' }),
      });

      const result = await authService.sendVerificationCode('test@example.com');

      expect(mockFetch).toHaveBeenCalledWith('/api/auth/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com' }),
      });
      expect(result.message).toBe('Code sent');
    });

    it('should throw error on failed request', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ message: 'Invalid email' }),
      });

      await expect(authService.sendVerificationCode('invalid')).rejects.toThrow('Invalid email');
    });

    it('should throw network error when fetch fails', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(authService.sendVerificationCode('test@example.com')).rejects.toThrow(
        'Unable to connect to server'
      );
    });
  });

  describe('verifyCode', () => {
    it('should verify code successfully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: 'Verified', verificationToken: 'verified-token' }),
      });

      const result = await authService.verifyCode('test@example.com', '123456');

      expect(mockFetch).toHaveBeenCalledWith('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com', code: '123456' }),
      });
      expect(result.verificationToken).toBe('verified-token');
    });

    it('should throw error on invalid code', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ message: 'Invalid code' }),
      });

      await expect(authService.verifyCode('test@example.com', 'wrong')).rejects.toThrow('Invalid code');
    });
  });

  describe('completeRegistration', () => {
    it('should complete registration successfully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          accessToken: 'access-token',
          user: { email: 'test@example.com', fullName: 'Test User' },
        }),
      });

      const result = await authService.completeRegistration(
        'test@example.com',
        'verification-token',
        'password123',
        'Test User',
        'USD'
      );

      expect(mockFetch).toHaveBeenCalledWith('/api/auth/complete-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: 'test@example.com',
          verificationToken: 'verification-token',
          password: 'password123',
          fullName: 'Test User',
          primaryCurrency: 'USD',
        }),
      });
      expect(result.accessToken).toBe('access-token');
    });
  });

  describe('login', () => {
    it('should login successfully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          accessToken: 'access-token',
          email: 'test@example.com',
          fullName: 'Test User',
          primaryCurrency: 'USD',
        }),
      });

      const result = await authService.login('test@example.com', 'password123');

      expect(mockFetch).toHaveBeenCalledWith('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: 'test@example.com', password: 'password123', rememberMe: false }),
      });
      expect(result.accessToken).toBe('access-token');
    });

    it('should return 2FA requirement when enabled', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          requiresTwoFactor: true,
          twoFactorToken: '2fa-token',
        }),
      });

      const result = await authService.login('test@example.com', 'password123');

      expect(result.requiresTwoFactor).toBe(true);
      expect(result.twoFactorToken).toBe('2fa-token');
    });

    it('should throw error on invalid credentials', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.reject(new Error('Parse error')),
      });

      await expect(authService.login('test@example.com', 'wrong')).rejects.toThrow(
        'Invalid credentials'
      );
    });
  });

  describe('verifyTwoFactorLogin', () => {
    it('should verify 2FA code successfully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          accessToken: 'access-token',
          user: { email: 'test@example.com' },
        }),
      });

      const result = await authService.verifyTwoFactorLogin('2fa-token', '123456');

      expect(mockFetch).toHaveBeenCalledWith('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ twoFactorToken: '2fa-token', code: '123456', rememberMe: false }),
      });
      expect(result.accessToken).toBe('access-token');
    });
  });

  describe('getCurrentUser', () => {
    it('should get current user', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          email: 'test@example.com',
          fullName: 'Test User',
          isEmailVerified: true,
          primaryCurrency: 'USD',
        }),
      });

      const result = await authService.getCurrentUser('bearer-token');

      expect(mockFetch).toHaveBeenCalledWith('/api/auth/me', {
        headers: { 'Authorization': 'Bearer bearer-token' },
      });
      expect(result.email).toBe('test@example.com');
    });
  });

  describe('deleteAccount', () => {
    it('should delete account successfully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: 'Account deleted' }),
      });

      const result = await authService.deleteAccount('token', 'password123');

      expect(mockFetch).toHaveBeenCalledWith('/api/auth/account', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer token',
        },
        body: JSON.stringify({ password: 'password123' }),
      });
      expect(result.message).toBe('Account deleted');
    });
  });

  describe('updateName', () => {
    it('should update name successfully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: 'Name updated' }),
      });

      const result = await authService.updateName('token', 'New Name');

      expect(mockFetch).toHaveBeenCalledWith('/api/auth/profile/name', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer token',
        },
        body: JSON.stringify({ fullName: 'New Name' }),
      });
      expect(result.message).toBe('Name updated');
    });
  });

  describe('sendEmailChangeCode', () => {
    it('should send email change code', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: 'Code sent' }),
      });

      const result = await authService.sendEmailChangeCode('token', 'new@example.com');

      expect(mockFetch).toHaveBeenCalledWith('/api/auth/profile/email/send-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer token',
        },
        body: JSON.stringify({ newEmail: 'new@example.com' }),
      });
      expect(result.message).toBe('Code sent');
    });
  });

  describe('verifyEmailChange', () => {
    it('should verify email change', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: 'Email updated' }),
      });

      const result = await authService.verifyEmailChange('token', 'new@example.com', '123456');

      expect(mockFetch).toHaveBeenCalledWith('/api/auth/profile/email/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer token',
        },
        body: JSON.stringify({ newEmail: 'new@example.com', code: '123456' }),
      });
      expect(result.message).toBe('Email updated');
    });
  });

  describe('sendPasswordResetCode', () => {
    it('should send password reset code', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: 'Code sent', verificationToken: 'reset-token' }),
      });

      const result = await authService.sendPasswordResetCode('test@example.com');

      expect(mockFetch).toHaveBeenCalledWith('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com' }),
      });
      expect(result.verificationToken).toBe('reset-token');
    });
  });

  describe('verifyResetCode', () => {
    it('should verify reset code', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: 'Verified', verificationToken: 'verified-token' }),
      });

      const result = await authService.verifyResetCode('test@example.com', '123456');

      expect(mockFetch).toHaveBeenCalledWith('/api/auth/verify-reset-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com', code: '123456' }),
      });
      expect(result.verificationToken).toBe('verified-token');
    });
  });

  describe('resetPassword', () => {
    it('should reset password successfully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: 'Password reset' }),
      });

      const result = await authService.resetPassword('test@example.com', 'token', 'newpassword');

      expect(mockFetch).toHaveBeenCalledWith('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          verificationToken: 'token',
          newPassword: 'newpassword',
        }),
      });
      expect(result.message).toBe('Password reset');
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          accessToken: 'new-access-token',
          user: { email: 'test@example.com' },
        }),
      });

      const result = await authService.refreshToken();

      expect(mockFetch).toHaveBeenCalledWith('/api/auth/refresh-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      expect(result.accessToken).toBe('new-access-token');
    });
  });

  describe('revokeToken', () => {
    it('should revoke token successfully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: 'Token revoked' }),
      });

      const result = await authService.revokeToken('access-token');

      expect(mockFetch).toHaveBeenCalledWith('/api/auth/revoke-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer access-token',
        },
        credentials: 'include',
      });
      expect(result.message).toBe('Token revoked');
    });
  });

  describe('revokeAllTokens', () => {
    it('should revoke all tokens successfully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: 'All tokens revoked' }),
      });

      const result = await authService.revokeAllTokens('access-token');

      expect(mockFetch).toHaveBeenCalledWith('/api/auth/revoke-all-tokens', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer access-token' },
        credentials: 'include',
      });
      expect(result.message).toBe('All tokens revoked');
    });
  });

  describe('Two-Factor Authentication', () => {
    describe('getTwoFactorStatus', () => {
      it('should get 2FA status', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ enabled: true }),
        });

        const result = await authService.getTwoFactorStatus('token');

        expect(mockFetch).toHaveBeenCalledWith('/api/auth/2fa/status', {
          headers: { 'Authorization': 'Bearer token' },
        });
        expect(result.enabled).toBe(true);
      });
    });

    describe('setupTwoFactor', () => {
      it('should setup 2FA', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({
            secret: 'SECRET123',
            qrCodeUri: 'otpauth://totp/...',
            manualEntryKey: 'ABCD EFGH',
          }),
        });

        const result = await authService.setupTwoFactor('token');

        expect(mockFetch).toHaveBeenCalledWith('/api/auth/2fa/setup', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer token' },
        });
        expect(result.secret).toBe('SECRET123');
      });
    });

    describe('enableTwoFactor', () => {
      it('should enable 2FA with code', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ message: '2FA enabled' }),
        });

        const result = await authService.enableTwoFactor('token', '123456');

        expect(mockFetch).toHaveBeenCalledWith('/api/auth/2fa/enable', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer token',
          },
          body: JSON.stringify({ code: '123456' }),
        });
        expect(result.message).toBe('2FA enabled');
      });
    });

    describe('disableTwoFactor', () => {
      it('should disable 2FA with password', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ message: '2FA disabled' }),
        });

        const result = await authService.disableTwoFactor('token', 'password123');

        expect(mockFetch).toHaveBeenCalledWith('/api/auth/2fa/disable', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer token',
          },
          body: JSON.stringify({ password: 'password123' }),
        });
        expect(result.message).toBe('2FA disabled');
      });
    });

    describe('sendTwoFactorEmailOtp', () => {
      it('should send email OTP', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ message: 'Email OTP sent' }),
        });

        const result = await authService.sendTwoFactorEmailOtp('2fa-token');

        expect(mockFetch).toHaveBeenCalledWith('/api/auth/2fa/send-email-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ twoFactorToken: '2fa-token' }),
        });
        expect(result.message).toBe('Email OTP sent');
      });
    });

    describe('verifyTwoFactorEmailOtp', () => {
      it('should verify email OTP', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({
            accessToken: 'access-token',
            user: { email: 'test@example.com' },
          }),
        });

        const result = await authService.verifyTwoFactorEmailOtp('2fa-token', '123456');

        expect(mockFetch).toHaveBeenCalledWith('/api/auth/2fa/verify-email-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ twoFactorToken: '2fa-token', emailCode: '123456', rememberMe: false }),
        });
        expect(result.accessToken).toBe('access-token');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle 400 error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.reject(new Error('Parse error')),
      });

      await expect(authService.login('test@example.com', 'pass')).rejects.toThrow(
        'Invalid request'
      );
    });

    it('should handle 403 error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        json: () => Promise.reject(new Error('Parse error')),
      });

      await expect(authService.login('test@example.com', 'pass')).rejects.toThrow(
        'You do not have permission'
      );
    });

    it('should handle 404 error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.reject(new Error('Parse error')),
      });

      await expect(authService.login('test@example.com', 'pass')).rejects.toThrow(
        'resource was not found'
      );
    });

    it('should handle 429 error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        json: () => Promise.reject(new Error('Parse error')),
      });

      await expect(authService.login('test@example.com', 'pass')).rejects.toThrow(
        'Too many requests'
      );
    });

    it('should handle 500 error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('Parse error')),
      });

      await expect(authService.login('test@example.com', 'pass')).rejects.toThrow(
        'Server error'
      );
    });

    it('should handle unknown status code', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 418,
        json: () => Promise.reject(new Error('Parse error')),
      });

      await expect(authService.login('test@example.com', 'pass')).rejects.toThrow(
        'Request failed (418)'
      );
    });

    it('should use API error message when available', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ message: 'Custom API error message' }),
      });

      await expect(authService.login('test@example.com', 'pass')).rejects.toThrow(
        'Custom API error message'
      );
    });
  });
});
