import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import DashboardPage from './DashboardPage';
import { AuthProvider } from '../context/AuthContext';
import * as authService from '../services/authService';

// Mock the auth service
vi.mock('../services/authService');

// Create a wrapper with auth state pre-populated
function renderWithAuth(initialUser = { email: 'test@example.com', fullName: 'Test User', isEmailVerified: true }) {
  // Set up localStorage before rendering
  const validPayload = { sub: 'user-123', email: initialUser.email, exp: Math.floor(Date.now() / 1000) + 900 };
  const validToken = `header.${btoa(JSON.stringify(validPayload))}.signature`;
  
  localStorage.setItem('digitransac_access_token', validToken);
  localStorage.setItem('digitransac_refresh_token', 'valid-refresh-token');
  localStorage.setItem('digitransac_user', JSON.stringify(initialUser));

  return render(
    <BrowserRouter>
      <AuthProvider>
        <DashboardPage />
      </AuthProvider>
    </BrowserRouter>
  );
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should render dashboard with user name', async () => {
    renderWithAuth({ email: 'john@example.com', fullName: 'John Doe', isEmailVerified: true });

    await waitFor(() => {
      expect(screen.getByText('Welcome, John Doe')).toBeInTheDocument();
    });
  });

  it('should render welcome message', async () => {
    renderWithAuth();

    await waitFor(() => {
      expect(screen.getByText('Welcome to DigiTransac!')).toBeInTheDocument();
      expect(screen.getByText('Your digital transaction tracker dashboard.')).toBeInTheDocument();
    });
  });

  it('should render account settings section', async () => {
    renderWithAuth();

    await waitFor(() => {
      expect(screen.getByText('Account Settings')).toBeInTheDocument();
      expect(screen.getByText('Sign out from all devices')).toBeInTheDocument();
      // Delete Account appears as both a label and a button
      expect(screen.getAllByText('Delete Account').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('should call logout when sign out button is clicked', async () => {
    vi.mocked(authService.revokeToken).mockResolvedValue({ message: 'Token revoked' });
    
    renderWithAuth();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Sign out')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Sign out'));

    await waitFor(() => {
      expect(authService.revokeToken).toHaveBeenCalled();
    });
  });

  it('should call logoutAll when sign out everywhere button is clicked', async () => {
    vi.mocked(authService.revokeAllTokens).mockResolvedValue({ message: 'All tokens revoked' });
    
    renderWithAuth();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Sign out everywhere')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Sign out everywhere'));

    await waitFor(() => {
      expect(screen.getByText('Signing out...')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(authService.revokeAllTokens).toHaveBeenCalled();
    });
  });

  it('should show delete modal when delete account button is clicked', async () => {
    renderWithAuth();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Delete Account' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Delete Account' }));

    await waitFor(() => {
      // Modal should now be visible with password input
      expect(screen.getByPlaceholderText('Enter your password')).toBeInTheDocument();
      expect(screen.getByText(/This action cannot be undone/)).toBeInTheDocument();
    });
  });

  it('should show error when delete is attempted without password', async () => {
    renderWithAuth();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Delete Account' })).toBeInTheDocument();
    });

    // Open modal
    await user.click(screen.getByRole('button', { name: 'Delete Account' }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter your password')).toBeInTheDocument();
    });

    // Try to delete without entering password - find the modal's delete button (the second one)
    const deleteButtons = screen.getAllByRole('button', { name: 'Delete Account' });
    await user.click(deleteButtons[1]); // Click the modal's delete button

    await waitFor(() => {
      expect(screen.getByText('Please enter your password to confirm')).toBeInTheDocument();
    });
  });

  it('should cancel delete when cancel button is clicked', async () => {
    renderWithAuth();
    const user = userEvent.setup();

    // Open modal
    await user.click(screen.getByRole('button', { name: 'Delete Account' }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter your password')).toBeInTheDocument();
    });

    // Click cancel
    await user.click(screen.getByText('Cancel'));

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Enter your password')).not.toBeInTheDocument();
    });
  });

  it('should delete account when password is provided', async () => {
    vi.mocked(authService.deleteAccount).mockResolvedValue({ message: 'Account deleted' });
    
    renderWithAuth();
    const user = userEvent.setup();

    // Open modal
    await user.click(screen.getByRole('button', { name: 'Delete Account' }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter your password')).toBeInTheDocument();
    });

    // Enter password and submit
    await user.type(screen.getByPlaceholderText('Enter your password'), 'Password@123');
    
    // Find and click the delete button in the modal (there are two "Delete Account" buttons)
    const deleteButtons = screen.getAllByRole('button', { name: 'Delete Account' });
    const modalDeleteButton = deleteButtons.find(btn => btn.closest('.fixed'));
    if (modalDeleteButton) {
      await user.click(modalDeleteButton);
    }

    await waitFor(() => {
      expect(authService.deleteAccount).toHaveBeenCalled();
    });
  });

  it('should toggle password visibility in delete modal', async () => {
    renderWithAuth();
    const user = userEvent.setup();

    // Open modal
    await user.click(screen.getByRole('button', { name: 'Delete Account' }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter your password')).toBeInTheDocument();
    });

    const passwordInput = screen.getByPlaceholderText('Enter your password');
    expect(passwordInput).toHaveAttribute('type', 'password');

    // Find and click the eye button (toggle visibility)
    const toggleButton = passwordInput.parentElement?.querySelector('button');
    if (toggleButton) {
      await user.click(toggleButton);
      expect(passwordInput).toHaveAttribute('type', 'text');
      
      await user.click(toggleButton);
      expect(passwordInput).toHaveAttribute('type', 'password');
    }
  });
});
