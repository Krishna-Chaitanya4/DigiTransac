import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import SettingsPage from './SettingsPage';
import { AuthProvider } from '../context/AuthContext';
import * as authService from '../services/authService';

// Mock the auth service
vi.mock('../services/authService');

// Create a wrapper with auth state pre-populated
function renderWithAuth(initialUser = { email: 'test@example.com', fullName: 'Test User', isEmailVerified: true }) {
  const validPayload = { sub: 'user-123', email: initialUser.email, exp: Math.floor(Date.now() / 1000) + 900 };
  const validToken = `header.${btoa(JSON.stringify(validPayload))}.signature`;
  
  localStorage.setItem('digitransac_access_token', validToken);
  localStorage.setItem('digitransac_refresh_token', 'valid-refresh-token');
  localStorage.setItem('digitransac_user', JSON.stringify(initialUser));

  return render(
    <BrowserRouter>
      <AuthProvider>
        <SettingsPage />
      </AuthProvider>
    </BrowserRouter>
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
});
