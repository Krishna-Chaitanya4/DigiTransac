import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import TwoFactorSettings from './TwoFactorSettings';
import { AuthProvider } from '../context/AuthContext';
import * as authService from '../services/authService';

// Mock the auth service
vi.mock('../services/authService');

// Create a wrapper with auth state pre-populated
function renderWithAuth() {
  const validPayload = { sub: 'user-123', email: 'test@example.com', exp: Math.floor(Date.now() / 1000) + 900 };
  const validToken = `header.${btoa(JSON.stringify(validPayload))}.signature`;
  
  localStorage.setItem('digitransac_access_token', validToken);
  localStorage.setItem('digitransac_refresh_token', 'valid-refresh-token');
  localStorage.setItem('digitransac_user', JSON.stringify({ 
    email: 'test@example.com', 
    fullName: 'Test User', 
    isEmailVerified: true 
  }));

  return render(
    <BrowserRouter>
      <AuthProvider>
        <TwoFactorSettings />
      </AuthProvider>
    </BrowserRouter>
  );
}

describe('TwoFactorSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('Loading state', () => {
    it('should show loading state initially', () => {
      vi.mocked(authService.getTwoFactorStatus).mockImplementation(() => new Promise(() => {}));
      renderWithAuth();

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  describe('2FA Disabled state', () => {
    beforeEach(() => {
      vi.mocked(authService.getTwoFactorStatus).mockResolvedValue({ enabled: false });
    });

    it('should show enable button when 2FA is disabled', async () => {
      renderWithAuth();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Enable' })).toBeInTheDocument();
      });
    });

    it('should show description for disabled state', async () => {
      renderWithAuth();

      await waitFor(() => {
        expect(screen.getByText('Two-Factor Authentication')).toBeInTheDocument();
        expect(screen.getByText('Add an extra layer of security using an authenticator app')).toBeInTheDocument();
      });
    });

    it('should not show Enabled badge when 2FA is disabled', async () => {
      renderWithAuth();

      await waitFor(() => {
        expect(screen.queryByText('Enabled')).not.toBeInTheDocument();
      });
    });
  });

  describe('2FA Enabled state', () => {
    beforeEach(() => {
      vi.mocked(authService.getTwoFactorStatus).mockResolvedValue({ enabled: true });
    });

    it('should show disable button when 2FA is enabled', async () => {
      renderWithAuth();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Disable' })).toBeInTheDocument();
      });
    });

    it('should show Enabled badge when 2FA is enabled', async () => {
      renderWithAuth();

      await waitFor(() => {
        expect(screen.getByText('Enabled')).toBeInTheDocument();
      });
    });

    it('should show description for enabled state', async () => {
      renderWithAuth();

      await waitFor(() => {
        expect(screen.getByText('Your account is protected with an authenticator app')).toBeInTheDocument();
      });
    });
  });

  describe('Enable 2FA flow', () => {
    const mockSetupData = {
      secret: 'JBSWY3DPEHPK3PXP',
      qrCodeUri: 'otpauth://totp/DigiTransac:test@example.com?secret=JBSWY3DPEHPK3PXP&issuer=DigiTransac',
      manualEntryKey: 'JBSW Y3DP EHPK 3PXP',
    };

    beforeEach(() => {
      vi.mocked(authService.getTwoFactorStatus).mockResolvedValue({ enabled: false });
      vi.mocked(authService.setupTwoFactor).mockResolvedValue(mockSetupData);
    });

    it('should open setup modal when Enable button is clicked', async () => {
      const user = userEvent.setup();
      renderWithAuth();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Enable' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Enable' }));

      await waitFor(() => {
        expect(screen.getByText('Set Up Two-Factor Authentication')).toBeInTheDocument();
      });
    });

    it('should show QR code instructions in setup modal', async () => {
      const user = userEvent.setup();
      renderWithAuth();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Enable' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Enable' }));

      await waitFor(() => {
        expect(screen.getByText('1. Scan this QR code with your authenticator app')).toBeInTheDocument();
        expect(screen.getByText('Or enter this key manually:')).toBeInTheDocument();
        expect(screen.getByText('2. Enter the 6-digit code from your app')).toBeInTheDocument();
      });
    });

    it('should show manual entry key in setup modal', async () => {
      const user = userEvent.setup();
      renderWithAuth();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Enable' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Enable' }));

      await waitFor(() => {
        expect(screen.getByText(mockSetupData.manualEntryKey)).toBeInTheDocument();
      });
    });

    it('should allow entering verification code', async () => {
      const user = userEvent.setup();
      renderWithAuth();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Enable' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Enable' }));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('000000')).toBeInTheDocument();
      });

      const codeInput = screen.getByPlaceholderText('000000');
      await user.type(codeInput, '123456');

      expect(codeInput).toHaveValue('123456');
    });

    it('should only allow numeric input in verification code field', async () => {
      const user = userEvent.setup();
      renderWithAuth();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Enable' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Enable' }));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('000000')).toBeInTheDocument();
      });

      const codeInput = screen.getByPlaceholderText('000000');
      await user.type(codeInput, 'abc123def456');

      expect(codeInput).toHaveValue('123456');
    });

    it('should enable 2FA when valid code is entered', async () => {
      vi.mocked(authService.enableTwoFactor).mockResolvedValue({ message: '2FA enabled' });
      const user = userEvent.setup();
      renderWithAuth();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Enable' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Enable' }));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('000000')).toBeInTheDocument();
      });

      await user.type(screen.getByPlaceholderText('000000'), '123456');
      await user.click(screen.getByRole('button', { name: 'Enable 2FA' }));

      await waitFor(() => {
        expect(authService.enableTwoFactor).toHaveBeenCalledWith(expect.any(String), '123456');
      });

      await waitFor(() => {
        expect(screen.getByText('Two-factor authentication has been enabled')).toBeInTheDocument();
      });
    });

    it('should close setup modal when Cancel is clicked', async () => {
      const user = userEvent.setup();
      renderWithAuth();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Enable' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Enable' }));

      await waitFor(() => {
        expect(screen.getByText('Set Up Two-Factor Authentication')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() => {
        expect(screen.queryByText('Set Up Two-Factor Authentication')).not.toBeInTheDocument();
      });
    });

    it('should disable Enable 2FA button when code is not 6 digits', async () => {
      const user = userEvent.setup();
      renderWithAuth();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Enable' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Enable' }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Enable 2FA' })).toBeDisabled();
      });

      await user.type(screen.getByPlaceholderText('000000'), '123');

      expect(screen.getByRole('button', { name: 'Enable 2FA' })).toBeDisabled();
    });
  });

  describe('Disable 2FA flow', () => {
    beforeEach(() => {
      vi.mocked(authService.getTwoFactorStatus).mockResolvedValue({ enabled: true });
    });

    it('should open disable modal when Disable button is clicked', async () => {
      const user = userEvent.setup();
      renderWithAuth();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Disable' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Disable' }));

      await waitFor(() => {
        expect(screen.getByText('Disable Two-Factor Authentication')).toBeInTheDocument();
      });
    });

    it('should show warning message in disable modal', async () => {
      const user = userEvent.setup();
      renderWithAuth();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Disable' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Disable' }));

      await waitFor(() => {
        expect(screen.getByText('This will make your account less secure. Enter your password to confirm.')).toBeInTheDocument();
      });
    });

    it('should allow entering password to disable', async () => {
      const user = userEvent.setup();
      renderWithAuth();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Disable' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Disable' }));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter your password')).toBeInTheDocument();
      });

      await user.type(screen.getByPlaceholderText('Enter your password'), 'mypassword');

      expect(screen.getByPlaceholderText('Enter your password')).toHaveValue('mypassword');
    });

    it('should disable 2FA when password is entered and confirmed', async () => {
      vi.mocked(authService.disableTwoFactor).mockResolvedValue({ message: '2FA disabled' });
      const user = userEvent.setup();
      renderWithAuth();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Disable' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Disable' }));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter your password')).toBeInTheDocument();
      });

      await user.type(screen.getByPlaceholderText('Enter your password'), 'mypassword');
      await user.click(screen.getByRole('button', { name: 'Disable 2FA' }));

      await waitFor(() => {
        expect(authService.disableTwoFactor).toHaveBeenCalledWith(expect.any(String), 'mypassword');
      });

      await waitFor(() => {
        expect(screen.getByText('Two-factor authentication has been disabled')).toBeInTheDocument();
      });
    });

    it('should close disable modal when Cancel is clicked', async () => {
      const user = userEvent.setup();
      renderWithAuth();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Disable' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Disable' }));

      await waitFor(() => {
        expect(screen.getByText('Disable Two-Factor Authentication')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() => {
        expect(screen.queryByText('Disable Two-Factor Authentication')).not.toBeInTheDocument();
      });
    });

    it('should disable Disable 2FA button when password is empty', async () => {
      const user = userEvent.setup();
      renderWithAuth();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Disable' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Disable' }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Disable 2FA' })).toBeDisabled();
      });
    });
  });

  describe('Error handling', () => {
    it('should show error when loading 2FA status fails', async () => {
      vi.mocked(authService.getTwoFactorStatus).mockRejectedValue(new Error('Network error'));
      renderWithAuth();

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('should show error when setup fails', async () => {
      vi.mocked(authService.getTwoFactorStatus).mockResolvedValue({ enabled: false });
      vi.mocked(authService.setupTwoFactor).mockRejectedValue(new Error('Setup failed'));
      const user = userEvent.setup();
      renderWithAuth();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Enable' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Enable' }));

      await waitFor(() => {
        expect(screen.getByText('Setup failed')).toBeInTheDocument();
      });
    });

    it('should show error when enabling 2FA fails', async () => {
      vi.mocked(authService.getTwoFactorStatus).mockResolvedValue({ enabled: false });
      vi.mocked(authService.setupTwoFactor).mockResolvedValue({
        secret: 'secret',
        qrCodeUri: 'uri',
        manualEntryKey: 'key',
      });
      vi.mocked(authService.enableTwoFactor).mockRejectedValue(new Error('Invalid code'));
      const user = userEvent.setup();
      renderWithAuth();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Enable' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Enable' }));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('000000')).toBeInTheDocument();
      });

      await user.type(screen.getByPlaceholderText('000000'), '123456');
      await user.click(screen.getByRole('button', { name: 'Enable 2FA' }));

      await waitFor(() => {
        expect(screen.getByText('Invalid code')).toBeInTheDocument();
      });
    });

    it('should show error when disabling 2FA fails', async () => {
      vi.mocked(authService.getTwoFactorStatus).mockResolvedValue({ enabled: true });
      vi.mocked(authService.disableTwoFactor).mockRejectedValue(new Error('Wrong password'));
      const user = userEvent.setup();
      renderWithAuth();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Disable' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Disable' }));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter your password')).toBeInTheDocument();
      });

      await user.type(screen.getByPlaceholderText('Enter your password'), 'wrongpassword');
      await user.click(screen.getByRole('button', { name: 'Disable 2FA' }));

      await waitFor(() => {
        expect(screen.getByText('Wrong password')).toBeInTheDocument();
      });
    });
  });
});
