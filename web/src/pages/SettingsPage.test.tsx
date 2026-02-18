import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import SettingsPage from './SettingsPage';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import * as authService from '../services/authService';

// Mock the auth service
vi.mock('../services/authService');

// Mock the currency service to prevent unmocked fetch errors
vi.mock('../services/currencyService', () => ({
  getSupportedCurrencies: vi.fn().mockResolvedValue([]),
  getCurrencyPreference: vi.fn().mockResolvedValue('USD'),
  updateCurrencyPreference: vi.fn().mockResolvedValue(undefined),
  getCurrencySymbol: vi.fn().mockReturnValue('$'),
  Currency: {},
}));

// Create a wrapper with auth state pre-populated
function renderWithAuth(initialUser = { email: 'test@example.com', fullName: 'Test User', isEmailVerified: true }) {
  const validPayload = { sub: 'user-123', email: initialUser.email, exp: Math.floor(Date.now() / 1000) + 900 };
  const validToken = `header.${btoa(JSON.stringify(validPayload))}.signature`;
  
  localStorage.setItem('digitransac_access_token', validToken);
  localStorage.setItem('digitransac_refresh_token', 'valid-refresh-token');
  localStorage.setItem('digitransac_user', JSON.stringify(initialUser));

  return render(
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <SettingsPage />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should render settings title', async () => {
    renderWithAuth();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    });
  });

  it('should render profile section with user info', async () => {
    renderWithAuth({ email: 'john@example.com', fullName: 'John Doe', isEmailVerified: true });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Profile' })).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('john@example.com')).toBeInTheDocument();
    });
  });

  it('should render security section', async () => {
    renderWithAuth();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Security' })).toBeInTheDocument();
      expect(screen.getByText('Sign out from all devices')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sign out everywhere' })).toBeInTheDocument();
    });
  });

  it('should render danger zone section', async () => {
    renderWithAuth();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Danger Zone' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete Account' })).toBeInTheDocument();
    });
  });

  it('should call logoutAll when sign out everywhere is clicked', async () => {
    vi.mocked(authService.revokeAllTokens).mockResolvedValue({ message: 'All tokens revoked' });
    
    renderWithAuth();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Sign out everywhere' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Sign out everywhere' }));

    await waitFor(() => {
      expect(screen.getByText('Signing out...')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(authService.revokeAllTokens).toHaveBeenCalled();
    });
  });

  it('should show delete account modal when delete button is clicked', async () => {
    renderWithAuth();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Delete Account' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Delete Account' }));

    await waitFor(() => {
      expect(screen.getByText('This action cannot be undone. All your data will be permanently deleted.')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Your password')).toBeInTheDocument();
    });
  });

  it('should close delete modal when cancel is clicked', async () => {
    renderWithAuth();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Delete Account' }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Your password')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Your password')).not.toBeInTheDocument();
    });
  });

  it('should show error when trying to delete without password', async () => {
    renderWithAuth();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Delete Account' }));

    await waitFor(() => {
      // Find the delete button inside the modal (there are two delete buttons now)
      const deleteButtons = screen.getAllByRole('button', { name: 'Delete Account' });
      expect(deleteButtons.length).toBe(2);
    });

    // Click the modal's delete button (second one)
    const deleteButtons = screen.getAllByRole('button', { name: 'Delete Account' });
    await user.click(deleteButtons[1]);

    await waitFor(() => {
      expect(screen.getByText('Please enter your password to confirm')).toBeInTheDocument();
    });
  });

  it('should call deleteAccount with password', async () => {
    vi.mocked(authService.deleteAccount).mockResolvedValue({ message: 'Account deleted' });
    
    renderWithAuth();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Delete Account' }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Your password')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('Your password'), 'mypassword123');
    
    const deleteButtons = screen.getAllByRole('button', { name: 'Delete Account' });
    await user.click(deleteButtons[1]);

    await waitFor(() => {
      expect(authService.deleteAccount).toHaveBeenCalled();
      // Verify password was passed (second argument)
      expect(vi.mocked(authService.deleteAccount).mock.calls[0][1]).toBe('mypassword123');
    });
  });

  // Profile Update Tests
  describe('Name Update', () => {
    it('should show edit form when Edit button is clicked for name', async () => {
      renderWithAuth({ email: 'test@example.com', fullName: 'Test User', isEmailVerified: true });
      const user = userEvent.setup();

      await waitFor(() => {
        expect(screen.getByText('Test User')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Edit' }));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Your full name')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      });
    });

    it('should cancel name editing and restore original value', async () => {
      renderWithAuth({ email: 'test@example.com', fullName: 'Test User', isEmailVerified: true });
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: 'Edit' }));
      
      const input = screen.getByPlaceholderText('Your full name');
      await user.clear(input);
      await user.type(input, 'New Name');

      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() => {
        expect(screen.getByText('Test User')).toBeInTheDocument();
        expect(screen.queryByPlaceholderText('Your full name')).not.toBeInTheDocument();
      });
    });

    it('should show error for empty name', async () => {
      renderWithAuth({ email: 'test@example.com', fullName: 'Test User', isEmailVerified: true });
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: 'Edit' }));
      
      const input = screen.getByPlaceholderText('Your full name');
      await user.clear(input);

      await user.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(screen.getByText('Name is required')).toBeInTheDocument();
      });
    });

    it('should show error for name less than 2 characters', async () => {
      renderWithAuth({ email: 'test@example.com', fullName: 'Test User', isEmailVerified: true });
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: 'Edit' }));
      
      const input = screen.getByPlaceholderText('Your full name');
      await user.clear(input);
      await user.type(input, 'A');

      await user.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(screen.getByText('Name must be at least 2 characters')).toBeInTheDocument();
      });
    });

    it('should call updateName when saving valid name', async () => {
      vi.mocked(authService.updateName).mockResolvedValue({ message: 'Name updated' });
      
      renderWithAuth({ email: 'test@example.com', fullName: 'Test User', isEmailVerified: true });
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: 'Edit' }));
      
      const input = screen.getByPlaceholderText('Your full name');
      await user.clear(input);
      await user.type(input, 'Updated Name');

      await user.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(authService.updateName).toHaveBeenCalled();
        expect(vi.mocked(authService.updateName).mock.calls[0][1]).toBe('Updated Name');
      });
    });
  });

  describe('Email Update', () => {
    it('should show email change modal when Change button is clicked', async () => {
      renderWithAuth({ email: 'test@example.com', fullName: 'Test User', isEmailVerified: true });
      const user = userEvent.setup();

      await waitFor(() => {
        expect(screen.getByText('test@example.com')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Change' }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Change Email' })).toBeInTheDocument();
        expect(screen.getByPlaceholderText('new@example.com')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Send Code' })).toBeInTheDocument();
      });
    });

    it('should close email modal when Cancel is clicked', async () => {
      renderWithAuth();
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: 'Change' }));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('new@example.com')).toBeInTheDocument();
      });

      // Click the Cancel button in the modal
      const cancelButtons = screen.getAllByRole('button', { name: 'Cancel' });
      await user.click(cancelButtons[0]);

      await waitFor(() => {
        expect(screen.queryByPlaceholderText('new@example.com')).not.toBeInTheDocument();
      });
    });

    it('should show error for invalid email format', async () => {
      renderWithAuth();
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: 'Change' }));
      await user.type(screen.getByPlaceholderText('new@example.com'), 'invalid-email');
      await user.click(screen.getByRole('button', { name: 'Send Code' }));

      await waitFor(() => {
        expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
      });
    });

    it('should show error when new email is same as current', async () => {
      renderWithAuth({ email: 'test@example.com', fullName: 'Test User', isEmailVerified: true });
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: 'Change' }));
      await user.type(screen.getByPlaceholderText('new@example.com'), 'test@example.com');
      await user.click(screen.getByRole('button', { name: 'Send Code' }));

      await waitFor(() => {
        expect(screen.getByText('New email must be different from current email')).toBeInTheDocument();
      });
    });

    it('should call sendEmailChangeCode and show verify step', async () => {
      vi.mocked(authService.sendEmailChangeCode).mockResolvedValue({ message: 'Code sent' });
      
      renderWithAuth();
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: 'Change' }));
      await user.type(screen.getByPlaceholderText('new@example.com'), 'new@example.com');
      await user.click(screen.getByRole('button', { name: 'Send Code' }));

      await waitFor(() => {
        expect(authService.sendEmailChangeCode).toHaveBeenCalled();
        expect(vi.mocked(authService.sendEmailChangeCode).mock.calls[0][1]).toBe('new@example.com');
      });

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Verify Email' })).toBeInTheDocument();
        expect(screen.getByPlaceholderText('000000')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Verify & Update' })).toBeInTheDocument();
      });
    });

    it('should allow going back to enter step from verify step', async () => {
      vi.mocked(authService.sendEmailChangeCode).mockResolvedValue({ message: 'Code sent' });
      
      renderWithAuth();
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: 'Change' }));
      await user.type(screen.getByPlaceholderText('new@example.com'), 'new@example.com');
      await user.click(screen.getByRole('button', { name: 'Send Code' }));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('000000')).toBeInTheDocument();
      });

      await user.click(screen.getByText('← Use a different email'));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Change Email' })).toBeInTheDocument();
        expect(screen.getByPlaceholderText('new@example.com')).toBeInTheDocument();
      });
    });

    it('should call verifyEmailChange when code is submitted', async () => {
      vi.mocked(authService.sendEmailChangeCode).mockResolvedValue({ message: 'Code sent' });
      vi.mocked(authService.verifyEmailChange).mockResolvedValue({ message: 'Email updated' });
      
      renderWithAuth();
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: 'Change' }));
      await user.type(screen.getByPlaceholderText('new@example.com'), 'new@example.com');
      await user.click(screen.getByRole('button', { name: 'Send Code' }));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('000000')).toBeInTheDocument();
      });

      await user.type(screen.getByPlaceholderText('000000'), '123456');
      await user.click(screen.getByRole('button', { name: 'Verify & Update' }));

      await waitFor(() => {
        expect(authService.verifyEmailChange).toHaveBeenCalled();
        expect(vi.mocked(authService.verifyEmailChange).mock.calls[0][1]).toBe('new@example.com');
        expect(vi.mocked(authService.verifyEmailChange).mock.calls[0][2]).toBe('123456');
      });
    });
  });

  describe('Two-Factor Authentication section', () => {
    it('should render Two-Factor Authentication section', async () => {
      vi.mocked(authService.getTwoFactorStatus).mockResolvedValue({ enabled: false });
      renderWithAuth();

      await waitFor(() => {
        expect(screen.getByText('Two-Factor Authentication')).toBeInTheDocument();
      });
    });

    it('should show Enable button when 2FA is disabled', async () => {
      vi.mocked(authService.getTwoFactorStatus).mockResolvedValue({ enabled: false });
      renderWithAuth();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Enable' })).toBeInTheDocument();
      });
    });

    it('should show Disable button when 2FA is enabled', async () => {
      vi.mocked(authService.getTwoFactorStatus).mockResolvedValue({ enabled: true });
      renderWithAuth();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Disable' })).toBeInTheDocument();
      });
    });

    it('should show Enabled badge when 2FA is enabled', async () => {
      vi.mocked(authService.getTwoFactorStatus).mockResolvedValue({ enabled: true });
      renderWithAuth();

      await waitFor(() => {
        expect(screen.getByText('Enabled')).toBeInTheDocument();
      });
    });
  });
});
