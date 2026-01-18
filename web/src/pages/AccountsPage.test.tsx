import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AccountsPage from './AccountsPage';
import * as accountService from '../services/accountService';

// Mock the account service
vi.mock('../services/accountService', async () => {
  const actual = await vi.importActual('../services/accountService');
  return {
    ...actual,
    getAccounts: vi.fn(),
    getAccountSummary: vi.fn(),
    createAccount: vi.fn(),
    updateAccount: vi.fn(),
    deleteAccount: vi.fn(),
    adjustBalance: vi.fn(),
  };
});

const mockAccounts: accountService.Account[] = [
  {
    id: '1',
    name: 'HDFC Savings',
    type: 'Bank',
    icon: null,
    color: null,
    currency: 'INR',
    initialBalance: 50000,
    currentBalance: 75000,
    institution: 'HDFC Bank',
    accountNumber: '****1234',
    notes: null,
    isArchived: false,
    includeInNetWorth: true,
    order: 0,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    name: 'ICICI Credit Card',
    type: 'CreditCard',
    icon: null,
    color: '#ef4444',
    currency: 'INR',
    initialBalance: 0,
    currentBalance: 15000,
    institution: 'ICICI Bank',
    accountNumber: '****5678',
    notes: null,
    isArchived: false,
    includeInNetWorth: true,
    order: 0,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '3',
    name: 'Cash Wallet',
    type: 'Cash',
    icon: null,
    color: null,
    currency: 'INR',
    initialBalance: 5000,
    currentBalance: 3000,
    institution: null,
    accountNumber: null,
    notes: null,
    isArchived: false,
    includeInNetWorth: true,
    order: 0,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

const mockSummary: accountService.AccountSummary = {
  totalAssets: 78000,
  totalLiabilities: 15000,
  netWorth: 63000,
  balancesByType: {
    Bank: 75000,
    CreditCard: 15000,
    Cash: 3000,
  },
};

describe('AccountsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading state initially', () => {
    vi.mocked(accountService.getAccounts).mockImplementation(() => new Promise(() => {}));
    vi.mocked(accountService.getAccountSummary).mockImplementation(() => new Promise(() => {}));

    render(<AccountsPage />);
    
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('should render empty state when no accounts', async () => {
    vi.mocked(accountService.getAccounts).mockResolvedValue([]);
    vi.mocked(accountService.getAccountSummary).mockResolvedValue({
      totalAssets: 0,
      totalLiabilities: 0,
      netWorth: 0,
      balancesByType: {},
    });

    render(<AccountsPage />);

    await waitFor(() => {
      expect(screen.getByText('No Accounts Yet')).toBeInTheDocument();
    });
    expect(screen.getByText('Add Your First Account')).toBeInTheDocument();
  });

  it('should render accounts grouped by type', async () => {
    vi.mocked(accountService.getAccounts).mockResolvedValue(mockAccounts);
    vi.mocked(accountService.getAccountSummary).mockResolvedValue(mockSummary);

    render(<AccountsPage />);

    await waitFor(() => {
      expect(screen.getByText('HDFC Savings')).toBeInTheDocument();
    });
    expect(screen.getByText('ICICI Credit Card')).toBeInTheDocument();
    expect(screen.getByText('Cash Wallet')).toBeInTheDocument();
  });

  it('should display net worth summary', async () => {
    vi.mocked(accountService.getAccounts).mockResolvedValue(mockAccounts);
    vi.mocked(accountService.getAccountSummary).mockResolvedValue(mockSummary);

    render(<AccountsPage />);

    await waitFor(() => {
      expect(screen.getByText('Net Worth')).toBeInTheDocument();
    });
    expect(screen.getByText('Assets')).toBeInTheDocument();
    expect(screen.getByText('Liabilities')).toBeInTheDocument();
  });

  it('should open create modal when clicking Add Account', async () => {
    vi.mocked(accountService.getAccounts).mockResolvedValue([]);
    vi.mocked(accountService.getAccountSummary).mockResolvedValue({
      totalAssets: 0,
      totalLiabilities: 0,
      netWorth: 0,
      balancesByType: {},
    });

    render(<AccountsPage />);

    await waitFor(() => {
      expect(screen.getByText('Add Your First Account')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Add Your First Account'));

    expect(screen.getByText('New Account')).toBeInTheDocument();
    expect(screen.getByLabelText('Account Name *')).toBeInTheDocument();
  });

  it('should show account types in create modal', async () => {
    vi.mocked(accountService.getAccounts).mockResolvedValue([]);
    vi.mocked(accountService.getAccountSummary).mockResolvedValue({
      totalAssets: 0,
      totalLiabilities: 0,
      netWorth: 0,
      balancesByType: {},
    });

    render(<AccountsPage />);

    await waitFor(() => {
      expect(screen.getByText('Add Your First Account')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Add Your First Account'));

    expect(screen.getByText('Bank Account')).toBeInTheDocument();
    expect(screen.getByText('Credit Card')).toBeInTheDocument();
    expect(screen.getByText('Cash')).toBeInTheDocument();
    expect(screen.getByText('Digital Wallet')).toBeInTheDocument();
    expect(screen.getByText('Investment')).toBeInTheDocument();
    expect(screen.getByText('Loan')).toBeInTheDocument();
  });

  it('should create account when form is submitted', async () => {
    vi.mocked(accountService.getAccounts).mockResolvedValue([]);
    vi.mocked(accountService.getAccountSummary).mockResolvedValue({
      totalAssets: 0,
      totalLiabilities: 0,
      netWorth: 0,
      balancesByType: {},
    });
    vi.mocked(accountService.createAccount).mockResolvedValue(mockAccounts[0]);

    render(<AccountsPage />);

    await waitFor(() => {
      expect(screen.getByText('Add Your First Account')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Add Your First Account'));

    const nameInput = screen.getByLabelText('Account Name *');
    fireEvent.change(nameInput, { target: { value: 'Test Account' } });

    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(accountService.createAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Account',
          type: 'Bank',
        })
      );
    });
  });

  it('should display error when loading fails', async () => {
    vi.mocked(accountService.getAccounts).mockRejectedValue(new Error('Failed'));
    vi.mocked(accountService.getAccountSummary).mockRejectedValue(new Error('Failed'));

    render(<AccountsPage />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load accounts')).toBeInTheDocument();
    });
  });

  it('should show archived toggle when accounts exist', async () => {
    vi.mocked(accountService.getAccounts).mockResolvedValue(mockAccounts);
    vi.mocked(accountService.getAccountSummary).mockResolvedValue(mockSummary);

    render(<AccountsPage />);

    await waitFor(() => {
      expect(screen.getByText('Show archived accounts')).toBeInTheDocument();
    });
  });

  it('should display institution and account number in card', async () => {
    vi.mocked(accountService.getAccounts).mockResolvedValue(mockAccounts);
    vi.mocked(accountService.getAccountSummary).mockResolvedValue(mockSummary);

    render(<AccountsPage />);

    await waitFor(() => {
      expect(screen.getByText(/HDFC Bank/)).toBeInTheDocument();
    });
    expect(screen.getByText(/\*\*\*\*1234/)).toBeInTheDocument();
  });
});

describe('AccountsPage - Account Card Menu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(accountService.getAccounts).mockResolvedValue(mockAccounts);
    vi.mocked(accountService.getAccountSummary).mockResolvedValue(mockSummary);
  });

  it('should show menu when clicking three dots', async () => {
    render(<AccountsPage />);

    await waitFor(() => {
      expect(screen.getByText('HDFC Savings')).toBeInTheDocument();
    });

    // Find the menu button (three dots) for the first account
    const menuButtons = screen.getAllByRole('button').filter(btn => 
      btn.querySelector('svg[viewBox="0 0 20 20"]')
    );
    
    fireEvent.click(menuButtons[0]);

    expect(screen.getByText('Adjust Balance')).toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Archive')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('should open delete confirmation when clicking Delete', async () => {
    render(<AccountsPage />);

    await waitFor(() => {
      expect(screen.getByText('HDFC Savings')).toBeInTheDocument();
    });

    const menuButtons = screen.getAllByRole('button').filter(btn => 
      btn.querySelector('svg[viewBox="0 0 20 20"]')
    );
    
    fireEvent.click(menuButtons[0]);
    fireEvent.click(screen.getByText('Delete'));

    expect(screen.getByText('Delete Account')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to delete/)).toBeInTheDocument();
  });

  it('should delete account when confirmed', async () => {
    vi.mocked(accountService.deleteAccount).mockResolvedValue(undefined);

    render(<AccountsPage />);

    await waitFor(() => {
      expect(screen.getByText('HDFC Savings')).toBeInTheDocument();
    });

    const menuButtons = screen.getAllByRole('button').filter(btn => 
      btn.querySelector('svg[viewBox="0 0 20 20"]')
    );
    
    fireEvent.click(menuButtons[0]);
    fireEvent.click(screen.getByText('Delete'));

    // Click the delete button in the confirmation modal
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    const confirmButton = deleteButtons.find(btn => btn.classList.contains('bg-red-600'));
    
    if (confirmButton) {
      fireEvent.click(confirmButton);
    }

    await waitFor(() => {
      expect(accountService.deleteAccount).toHaveBeenCalledWith('1');
    });
  });

  it('should archive account when clicking Archive', async () => {
    vi.mocked(accountService.updateAccount).mockResolvedValue({
      ...mockAccounts[0],
      isArchived: true,
    });

    render(<AccountsPage />);

    await waitFor(() => {
      expect(screen.getByText('HDFC Savings')).toBeInTheDocument();
    });

    const menuButtons = screen.getAllByRole('button').filter(btn => 
      btn.querySelector('svg[viewBox="0 0 20 20"]')
    );
    
    fireEvent.click(menuButtons[0]);
    fireEvent.click(screen.getByText('Archive'));

    await waitFor(() => {
      expect(accountService.updateAccount).toHaveBeenCalledWith('1', { isArchived: true });
    });
  });
});

describe('AccountsPage - Adjust Balance Modal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(accountService.getAccounts).mockResolvedValue(mockAccounts);
    vi.mocked(accountService.getAccountSummary).mockResolvedValue(mockSummary);
  });

  it('should open adjust balance modal when clicking Adjust Balance', async () => {
    render(<AccountsPage />);

    await waitFor(() => {
      expect(screen.getByText('HDFC Savings')).toBeInTheDocument();
    });

    const menuButtons = screen.getAllByRole('button').filter(btn => 
      btn.querySelector('svg[viewBox="0 0 20 20"]')
    );
    
    fireEvent.click(menuButtons[0]);
    fireEvent.click(screen.getByText('Adjust Balance'));

    expect(screen.getByText('Adjust Balance - HDFC Savings')).toBeInTheDocument();
    // The modal has "Current Balance" label - verify by finding it within the modal
    expect(screen.getByLabelText('New Balance')).toBeInTheDocument();
    expect(screen.getByLabelText('Reason (optional)')).toBeInTheDocument();
  });

  it('should adjust balance when form is submitted', async () => {
    vi.mocked(accountService.adjustBalance).mockResolvedValue(undefined);

    render(<AccountsPage />);

    await waitFor(() => {
      expect(screen.getByText('HDFC Savings')).toBeInTheDocument();
    });

    const menuButtons = screen.getAllByRole('button').filter(btn => 
      btn.querySelector('svg[viewBox="0 0 20 20"]')
    );
    
    fireEvent.click(menuButtons[0]);
    fireEvent.click(screen.getByText('Adjust Balance'));

    const newBalanceInput = screen.getByLabelText('New Balance');
    fireEvent.change(newBalanceInput, { target: { value: '80000' } });

    fireEvent.click(screen.getByText('Update Balance'));

    await waitFor(() => {
      expect(accountService.adjustBalance).toHaveBeenCalledWith('1', {
        newBalance: 80000,
        notes: '',
      });
    });
  });
});

describe('formatCurrency', () => {
  it('should format INR correctly', () => {
    expect(accountService.formatCurrency(75000)).toBe('₹75,000.00');
    expect(accountService.formatCurrency(1234567.89)).toBe('₹12,34,567.89');
    expect(accountService.formatCurrency(-5000)).toBe('-₹5,000.00');
  });
});
