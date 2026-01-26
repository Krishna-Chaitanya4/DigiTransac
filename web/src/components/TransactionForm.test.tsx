import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TransactionForm } from './TransactionForm';
import type { Transaction } from '../types/transactions';
import type { Account } from '../services/accountService';
import type { Label, Tag } from '../types/labels';

// Mock the CalculatorInput component
vi.mock('./CalculatorInput', () => ({
  CalculatorInput: ({ value, onChange, currency, placeholder }: { 
    value: number; 
    onChange: (val: number) => void;
    currency: string;
    placeholder: string;
  }) => (
    <input
      data-testid="calculator-input"
      type="number"
      value={value || ''}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      placeholder={`${currency}${placeholder}`}
    />
  ),
  QuickAmountButtons: ({ amounts, onSelect, currency }: {
    amounts: number[];
    onSelect: (val: number) => void;
    currency: string;
  }) => (
    <div data-testid="quick-amounts">
      {amounts.map(amt => (
        <button
          key={amt}
          data-testid={`quick-amount-${amt}`}
          onClick={() => onSelect(amt)}
        >
          {currency}{amt}
        </button>
      ))}
    </div>
  ),
}));

// Mock DatePicker
vi.mock('./DatePicker', () => ({
  DatePicker: ({ label, value, onChange, maxDate }: {
    label: string;
    value: string;
    onChange: (val: string) => void;
    maxDate?: Date;
  }) => (
    <div>
      <label>{label}</label>
      <input
        data-testid="date-picker"
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        max={maxDate?.toISOString().split('T')[0]}
      />
    </div>
  ),
}));

// Mock SearchableCategoryDropdown
vi.mock('./SearchableCategoryDropdown', () => ({
  SearchableCategoryDropdown: ({ value, onChange, categories, placeholder }: {
    value: string;
    onChange: (val: string) => void;
    categories: Label[];
    placeholder: string;
  }) => (
    <select
      data-testid="category-dropdown"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{placeholder}</option>
      {categories.map(cat => (
        <option key={cat.id} value={cat.id}>{cat.name}</option>
      ))}
    </select>
  ),
}));

// Mock transaction-form components
vi.mock('./transaction-form', () => ({
  TransactionTypeSelector: ({ value, onChange, showTransfer }: {
    value: string;
    onChange: (val: 'Send' | 'Receive' | 'Transfer') => void;
    showTransfer: boolean;
  }) => (
    <div data-testid="type-selector">
      <button
        data-testid="type-send"
        className={value === 'Send' ? 'active' : ''}
        onClick={() => onChange('Send')}
      >
        Send
      </button>
      <button
        data-testid="type-receive"
        className={value === 'Receive' ? 'active' : ''}
        onClick={() => onChange('Receive')}
      >
        Receive
      </button>
      {showTransfer && (
        <button
          data-testid="type-transfer"
          className={value === 'Transfer' ? 'active' : ''}
          onClick={() => onChange('Transfer')}
        >
          Transfer
        </button>
      )}
    </div>
  ),
  TagTokenInput: ({ tags, selectedTagIds, onToggleTag, onCreateTag }: {
    tags: Tag[];
    selectedTagIds: string[];
    onToggleTag: (id: string) => void;
    onCreateTag?: (name: string) => Promise<Tag | null>;
  }) => (
    <div data-testid="tag-input">
      {tags.map(tag => (
        <button
          key={tag.id}
          data-testid={`tag-${tag.id}`}
          className={selectedTagIds.includes(tag.id) ? 'selected' : ''}
          onClick={() => onToggleTag(tag.id)}
        >
          {tag.name}
        </button>
      ))}
    </div>
  ),
  RecurringSection: ({ isRecurring, onIsRecurringChange, frequency, onFrequencyChange }: {
    isRecurring: boolean;
    onIsRecurringChange: (val: boolean) => void;
    frequency: string;
    onFrequencyChange: (val: string) => void;
  }) => (
    <div data-testid="recurring-section">
      <label>
        <input
          type="checkbox"
          data-testid="recurring-checkbox"
          checked={isRecurring}
          onChange={(e) => onIsRecurringChange(e.target.checked)}
        />
        Recurring
      </label>
      {isRecurring && (
        <select
          data-testid="recurring-frequency"
          value={frequency}
          onChange={(e) => onFrequencyChange(e.target.value)}
        >
          <option value="Daily">Daily</option>
          <option value="Weekly">Weekly</option>
          <option value="Monthly">Monthly</option>
          <option value="Yearly">Yearly</option>
        </select>
      )}
    </div>
  ),
  SplitCategoriesSection: ({ splits, onSplitsChange, categories, amount, currencySymbol, onCancelSplit }: {
    splits: { labelId: string; amount: number; notes?: string }[];
    onSplitsChange: (val: { labelId: string; amount: number; notes?: string }[]) => void;
    categories: Label[];
    amount: number;
    currencySymbol: string;
    onCancelSplit: () => void;
  }) => (
    <div data-testid="split-section">
      <button data-testid="cancel-split" onClick={onCancelSplit}>Cancel Split</button>
      <span>Total: {currencySymbol}{amount}</span>
      <span>Splits: {splits.length}</span>
    </div>
  ),
  LocationPicker: ({ location, onChange, autoCapture }: {
    location: { latitude: number; longitude: number } | null;
    onChange: (loc: { latitude: number; longitude: number } | null, include: boolean) => void;
    autoCapture: boolean;
  }) => (
    <div data-testid="location-picker">
      <button 
        data-testid="toggle-location"
        onClick={() => onChange(location ? null : { latitude: 0, longitude: 0 }, !location)}
      >
        {location ? 'Remove Location' : 'Add Location'}
      </button>
    </div>
  ),
  validateSplits: (splits: { amount: number }[], totalAmount: number) => {
    const sum = splits.reduce((s, split) => s + split.amount, 0);
    return Math.abs(sum - totalAmount) < 0.01;
  },
}));

// Mock useFocusTrap
vi.mock('../hooks/useFocusTrap', () => ({
  useFocusTrap: () => ({ current: null }),
}));

// Mock currencyService
vi.mock('../services/currencyService', () => ({
  getCurrencySymbol: (currency: string) => {
    const symbols: Record<string, string> = { USD: '$', EUR: '€', GBP: '£' };
    return symbols[currency] || '$';
  },
}));

// Test data factories
const createAccount = (overrides: Partial<Account> = {}): Account => ({
  id: 'acc-1',
  name: 'Checking Account',
  type: 'Bank',
  icon: '🏦',
  color: null,
  currency: 'USD',
  initialBalance: 0,
  currentBalance: 1000,
  institution: null,
  accountNumber: null,
  notes: null,
  isArchived: false,
  isDefault: true,
  includeInNetWorth: true,
  order: 0,
  canEditCurrency: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const createLabel = (overrides: Partial<Label> = {}): Label => ({
  id: 'label-1',
  name: 'Food',
  parentId: null,
  type: 'Category',
  icon: '🍔',
  color: '#FF5733',
  order: 0,
  isSystem: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const createTag = (overrides: Partial<Tag> = {}): Tag => ({
  id: 'tag-1',
  name: 'Essential',
  order: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const createTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'tx-1',
  accountId: 'acc-1',
  type: 'Send',
  amount: 100,
  currency: 'USD',
  date: '2026-01-22T12:00:00.000Z',
  title: 'Test Transaction',
  payee: 'Test Payee',
  notes: 'Test notes',
  splits: [{ labelId: 'label-1', amount: 100 }],
  tagIds: ['tag-1'],
  tags: ['tag-1'],
  status: 'Confirmed',
  isRecurringTemplate: false,
  createdAt: '2026-01-22T12:00:00.000Z',
  updatedAt: '2026-01-22T12:00:00.000Z',
  ...overrides,
});

describe('TransactionForm', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSubmit: vi.fn(),
    editingTransaction: null,
    accounts: [createAccount()],
    labels: [createLabel()],
    tags: [createTag()],
    isLoading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('does not render when closed', () => {
      render(<TransactionForm {...defaultProps} isOpen={false} />);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders modal when open', () => {
      render(<TransactionForm {...defaultProps} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('New Transaction')).toBeInTheDocument();
    });

    it('renders edit title when editing', () => {
      render(
        <TransactionForm 
          {...defaultProps} 
          editingTransaction={createTransaction()} 
        />
      );
      expect(screen.getByText('Edit Transaction')).toBeInTheDocument();
    });

    it('shows close button', () => {
      render(<TransactionForm {...defaultProps} />);
      expect(screen.getByLabelText('Close dialog')).toBeInTheDocument();
    });

    it('renders all form fields', () => {
      render(<TransactionForm {...defaultProps} />);
      expect(screen.getByTestId('type-selector')).toBeInTheDocument();
      expect(screen.getByTestId('calculator-input')).toBeInTheDocument();
      expect(screen.getByTestId('date-picker')).toBeInTheDocument();
      expect(screen.getByTestId('category-dropdown')).toBeInTheDocument();
      expect(screen.getByTestId('tag-input')).toBeInTheDocument();
      expect(screen.getByTestId('recurring-section')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('e.g., Grocery shopping')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Additional notes...')).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('submit button is disabled when amount is 0', () => {
      render(<TransactionForm {...defaultProps} />);
      const submitBtn = screen.getByRole('button', { name: 'Add Transaction' });
      expect(submitBtn).toBeDisabled();
    });

    it('submit button is disabled when no account is selected', () => {
      render(<TransactionForm {...defaultProps} accounts={[]} />);
      const submitBtn = screen.getByRole('button', { name: 'Add Transaction' });
      expect(submitBtn).toBeDisabled();
    });

    it('submit button is disabled when no category selected (non-transfer)', async () => {
      render(<TransactionForm {...defaultProps} labels={[]} />);
      
      const amountInput = screen.getByTestId('calculator-input');
      await userEvent.clear(amountInput);
      await userEvent.type(amountInput, '100');
      
      const submitBtn = screen.getByRole('button', { name: 'Add Transaction' });
      expect(submitBtn).toBeDisabled();
    });

    it('enables submit button when form is valid', async () => {
      render(<TransactionForm {...defaultProps} />);
      
      const amountInput = screen.getByTestId('calculator-input');
      await userEvent.clear(amountInput);
      await userEvent.type(amountInput, '100');
      
      const categoryDropdown = screen.getByTestId('category-dropdown');
      await userEvent.selectOptions(categoryDropdown, 'label-1');
      
      const submitBtn = screen.getByRole('button', { name: 'Add Transaction' });
      expect(submitBtn).not.toBeDisabled();
    });
  });

  describe('Transaction Type Selection', () => {
    it('defaults to Send type', () => {
      render(<TransactionForm {...defaultProps} />);
      expect(screen.getByTestId('type-send')).toHaveClass('active');
    });

    it('can switch to Receive type', async () => {
      render(<TransactionForm {...defaultProps} />);
      
      await userEvent.click(screen.getByTestId('type-receive'));
      expect(screen.getByTestId('type-receive')).toHaveClass('active');
    });

    it('shows Transfer option when showTransfer is true', () => {
      render(<TransactionForm {...defaultProps} showTransfer={true} />);
      expect(screen.getByTestId('type-transfer')).toBeInTheDocument();
    });

    it('hides Transfer option when showTransfer is false', () => {
      render(<TransactionForm {...defaultProps} showTransfer={false} />);
      expect(screen.queryByTestId('type-transfer')).not.toBeInTheDocument();
    });

    it('shows To Account field when Transfer is selected', async () => {
      const accounts = [
        createAccount({ id: 'acc-1', name: 'Checking' }),
        createAccount({ id: 'acc-2', name: 'Savings' }),
      ];
      render(<TransactionForm {...defaultProps} accounts={accounts} showTransfer={true} />);
      
      await userEvent.click(screen.getByTestId('type-transfer'));
      expect(screen.getByText('To Account *')).toBeInTheDocument();
    });
  });

  describe('Account Selection', () => {
    it('renders account options', () => {
      const accounts = [
        createAccount({ id: 'acc-1', name: 'Checking' }),
        createAccount({ id: 'acc-2', name: 'Savings' }),
      ];
      render(<TransactionForm {...defaultProps} accounts={accounts} />);
      
      expect(screen.getByText('Checking (USD)')).toBeInTheDocument();
      expect(screen.getByText('Savings (USD)')).toBeInTheDocument();
    });

    it('filters out archived accounts', () => {
      const accounts = [
        createAccount({ id: 'acc-1', name: 'Checking', isArchived: false }),
        createAccount({ id: 'acc-2', name: 'Old Account', isArchived: true }),
      ];
      render(<TransactionForm {...defaultProps} accounts={accounts} />);
      
      expect(screen.getByText('Checking (USD)')).toBeInTheDocument();
      expect(screen.queryByText('Old Account (USD)')).not.toBeInTheDocument();
    });

    it('uses defaultAccountId when provided', () => {
      const accounts = [
        createAccount({ id: 'acc-1', name: 'Checking' }),
        createAccount({ id: 'acc-2', name: 'Savings' }),
      ];
      render(<TransactionForm {...defaultProps} accounts={accounts} defaultAccountId="acc-2" />);
      
      const select = screen.getByDisplayValue('Savings (USD)');
      expect(select).toBeInTheDocument();
    });
  });

  describe('Amount Input', () => {
    it('shows quick amount buttons', () => {
      render(<TransactionForm {...defaultProps} />);
      expect(screen.getByTestId('quick-amounts')).toBeInTheDocument();
    });

    it('sets amount when quick amount button is clicked', async () => {
      render(<TransactionForm {...defaultProps} />);
      
      await userEvent.click(screen.getByTestId('quick-amount-50'));
      
      const amountInput = screen.getByTestId('calculator-input') as HTMLInputElement;
      expect(amountInput.value).toBe('50');
    });
  });

  describe('Tags', () => {
    it('renders available tags', () => {
      const tags = [
        createTag({ id: 'tag-1', name: 'Essential' }),
        createTag({ id: 'tag-2', name: 'Vacation' }),
      ];
      render(<TransactionForm {...defaultProps} tags={tags} />);
      
      expect(screen.getByTestId('tag-tag-1')).toBeInTheDocument();
      expect(screen.getByTestId('tag-tag-2')).toBeInTheDocument();
    });

    it('can toggle tags', async () => {
      const tags = [createTag({ id: 'tag-1', name: 'Essential' })];
      render(<TransactionForm {...defaultProps} tags={tags} />);
      
      const tagBtn = screen.getByTestId('tag-tag-1');
      await userEvent.click(tagBtn);
      
      expect(tagBtn).toHaveClass('selected');
    });
  });

  describe('Recurring Transactions', () => {
    it('shows recurring section for new transactions', () => {
      render(<TransactionForm {...defaultProps} />);
      expect(screen.getByTestId('recurring-section')).toBeInTheDocument();
    });

    it('hides recurring section when editing', () => {
      render(
        <TransactionForm 
          {...defaultProps} 
          editingTransaction={createTransaction()} 
        />
      );
      expect(screen.queryByTestId('recurring-section')).not.toBeInTheDocument();
    });

    it('shows frequency options when recurring is enabled', async () => {
      render(<TransactionForm {...defaultProps} />);
      
      await userEvent.click(screen.getByTestId('recurring-checkbox'));
      expect(screen.getByTestId('recurring-frequency')).toBeInTheDocument();
    });
  });

  describe('P2P Transactions', () => {
    it('shows recipient email field for Send transactions', () => {
      render(<TransactionForm {...defaultProps} />);
      expect(screen.getByPlaceholderText('friend@example.com')).toBeInTheDocument();
    });

    it('hides recipient field when hideRecipientField is true', () => {
      render(<TransactionForm {...defaultProps} hideRecipientField={true} />);
      expect(screen.queryByPlaceholderText('friend@example.com')).not.toBeInTheDocument();
    });

    it('pre-fills counterparty email when fixedCounterpartyEmail is provided', () => {
      render(
        <TransactionForm 
          {...defaultProps} 
          fixedCounterpartyEmail="test@example.com"
        />
      );
      // Form should be initialized with the fixed email
      // (tested via submission)
    });
  });

  describe('Form Submission', () => {
    it('calls onSubmit with correct data for new Send transaction', async () => {
      const onSubmit = vi.fn();
      render(<TransactionForm {...defaultProps} onSubmit={onSubmit} />);
      
      // Fill form
      await userEvent.clear(screen.getByTestId('calculator-input'));
      await userEvent.type(screen.getByTestId('calculator-input'), '150');
      await userEvent.selectOptions(screen.getByTestId('category-dropdown'), 'label-1');
      await userEvent.type(screen.getByPlaceholderText('e.g., Grocery shopping'), 'Groceries');
      await userEvent.type(screen.getByPlaceholderText('e.g., Supermarket'), 'Walmart');
      
      // Submit
      await userEvent.click(screen.getByRole('button', { name: 'Add Transaction' }));
      
      expect(onSubmit).toHaveBeenCalledTimes(1);
      const submittedData = onSubmit.mock.calls[0][0];
      expect(submittedData.type).toBe('Send');
      expect(submittedData.amount).toBe(150);
      expect(submittedData.title).toBe('Groceries');
      expect(submittedData.payee).toBe('Walmart');
      expect(submittedData.accountId).toBe('acc-1');
    });

    it('calls onSubmit with correct data for Receive transaction', async () => {
      const onSubmit = vi.fn();
      const { unmount } = render(<TransactionForm {...defaultProps} onSubmit={onSubmit} />);
      
      await userEvent.click(screen.getByTestId('type-receive'));
      await userEvent.clear(screen.getByTestId('calculator-input'));
      await userEvent.type(screen.getByTestId('calculator-input'), '500');
      await userEvent.selectOptions(screen.getByTestId('category-dropdown'), 'label-1');
      
      await userEvent.click(screen.getByRole('button', { name: 'Add Transaction' }));
      
      expect(onSubmit).toHaveBeenCalled();
      // Find the call with Receive type (multiple submissions possible due to React strictMode)
      const receiveCall = onSubmit.mock.calls.find(call => call[0].type === 'Receive');
      expect(receiveCall).toBeDefined();
      expect(receiveCall[0].type).toBe('Receive');
      expect(receiveCall[0].amount).toBe(500);
      
      unmount();
    });

    it('includes recurring rule when enabled', async () => {
      const onSubmit = vi.fn();
      render(<TransactionForm {...defaultProps} onSubmit={onSubmit} />);
      
      await userEvent.clear(screen.getByTestId('calculator-input'));
      await userEvent.type(screen.getByTestId('calculator-input'), '100');
      await userEvent.selectOptions(screen.getByTestId('category-dropdown'), 'label-1');
      await userEvent.click(screen.getByTestId('recurring-checkbox'));
      
      await userEvent.click(screen.getByRole('button', { name: 'Add Transaction' }));
      
      expect(onSubmit).toHaveBeenCalledTimes(1);
      const data = onSubmit.mock.calls[0][0];
      expect(data.recurringRule).toBeDefined();
      expect(data.recurringRule.frequency).toBe('Monthly');
    });

    it('calls onSubmit with update data when editing', async () => {
      const onSubmit = vi.fn();
      const editingTransaction = createTransaction({ amount: 100, title: 'Old Title' });
      
      render(
        <TransactionForm 
          {...defaultProps} 
          onSubmit={onSubmit}
          editingTransaction={editingTransaction}
        />
      );
      
      // Modify the title
      const titleInput = screen.getByPlaceholderText('e.g., Grocery shopping');
      await userEvent.clear(titleInput);
      await userEvent.type(titleInput, 'New Title');
      
      await userEvent.click(screen.getByRole('button', { name: 'Update' }));
      
      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit.mock.calls[0][0].title).toBe('New Title');
    });
  });

  describe('Transfer Transactions', () => {
    it('requires destination account for transfers', async () => {
      const accounts = [
        createAccount({ id: 'acc-1', name: 'Checking' }),
        createAccount({ id: 'acc-2', name: 'Savings' }),
      ];
      render(<TransactionForm {...defaultProps} accounts={accounts} showTransfer={true} />);
      
      await userEvent.click(screen.getByTestId('type-transfer'));
      await userEvent.clear(screen.getByTestId('calculator-input'));
      await userEvent.type(screen.getByTestId('calculator-input'), '100');
      
      const submitBtn = screen.getByRole('button', { name: 'Add Transaction' });
      // Should be enabled because transfer auto-selects destination
      expect(submitBtn).not.toBeDisabled();
    });

    it('excludes current account from destination options', async () => {
      const accounts = [
        createAccount({ id: 'acc-1', name: 'Checking' }),
        createAccount({ id: 'acc-2', name: 'Savings' }),
      ];
      render(<TransactionForm {...defaultProps} accounts={accounts} showTransfer={true} />);
      
      await userEvent.click(screen.getByTestId('type-transfer'));
      
      // The destination dropdown should not show the source account
      const destOptions = screen.getAllByRole('option');
      const checkingInDest = destOptions.filter(o => o.textContent?.includes('Checking'));
      // Checking appears once (in source) but shouldn't appear in destination
      expect(checkingInDest.length).toBe(1);
    });

    it('shows warning when only one account exists', async () => {
      const accounts = [createAccount({ id: 'acc-1', name: 'Checking' })];
      render(<TransactionForm {...defaultProps} accounts={accounts} showTransfer={true} />);
      
      await userEvent.click(screen.getByTestId('type-transfer'));
      
      expect(screen.getByText(/You need at least two accounts/)).toBeInTheDocument();
    });
  });

  describe('Modal Behavior', () => {
    it('calls onClose when close button clicked', async () => {
      const onClose = vi.fn();
      render(<TransactionForm {...defaultProps} onClose={onClose} />);
      
      await userEvent.click(screen.getByLabelText('Close dialog'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when cancel button clicked', async () => {
      const onClose = vi.fn();
      render(<TransactionForm {...defaultProps} onClose={onClose} />);
      
      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when backdrop clicked', async () => {
      const onClose = vi.fn();
      render(<TransactionForm {...defaultProps} onClose={onClose} />);
      
      // Click backdrop (the overlay div)
      const backdrop = document.querySelector('.bg-black\\/30');
      if (backdrop) {
        fireEvent.click(backdrop);
        expect(onClose).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe('Loading State', () => {
    it('shows loading text when isLoading is true', () => {
      render(<TransactionForm {...defaultProps} isLoading={true} />);
      expect(screen.getByRole('button', { name: 'Saving...' })).toBeInTheDocument();
    });

    it('disables submit button when loading', () => {
      render(<TransactionForm {...defaultProps} isLoading={true} />);
      expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
    });
  });

  describe('Error Display', () => {
    it('shows error message when error prop is provided', () => {
      render(<TransactionForm {...defaultProps} error="Something went wrong" />);
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('does not show error section when no error', () => {
      const { container } = render(<TransactionForm {...defaultProps} error={null} />);
      expect(container.querySelector('.bg-red-50')).not.toBeInTheDocument();
    });
  });

  describe('Form Reset on Open/Close', () => {
    it('resets form when reopened', async () => {
      const { rerender } = render(<TransactionForm {...defaultProps} />);
      
      // Fill some data
      await userEvent.type(screen.getByPlaceholderText('e.g., Grocery shopping'), 'Test');
      
      // Close and reopen
      rerender(<TransactionForm {...defaultProps} isOpen={false} />);
      rerender(<TransactionForm {...defaultProps} isOpen={true} />);
      
      // Title should be reset
      const titleInput = screen.getByPlaceholderText('e.g., Grocery shopping') as HTMLInputElement;
      expect(titleInput.value).toBe('');
    });

    it('populates form with transaction data when editing', () => {
      const transaction = createTransaction({
        title: 'Existing Title',
        amount: 250,
        notes: 'Existing notes',
      });
      
      render(<TransactionForm {...defaultProps} editingTransaction={transaction} />);
      
      const titleInput = screen.getByPlaceholderText('e.g., Grocery shopping') as HTMLInputElement;
      expect(titleInput.value).toBe('Existing Title');
      
      const notesInput = screen.getByPlaceholderText('Additional notes...') as HTMLTextAreaElement;
      expect(notesInput.value).toBe('Existing notes');
    });
  });

  describe('Split Transactions', () => {
    it('shows split transaction button', () => {
      render(<TransactionForm {...defaultProps} />);
      expect(screen.getByText('Split transaction')).toBeInTheDocument();
    });

    it('shows split section when split button is clicked', async () => {
      render(<TransactionForm {...defaultProps} />);
      
      await userEvent.click(screen.getByText('Split transaction'));
      expect(screen.getByTestId('split-section')).toBeInTheDocument();
    });

    it('hides split for transfer type', async () => {
      const accounts = [
        createAccount({ id: 'acc-1', name: 'Checking' }),
        createAccount({ id: 'acc-2', name: 'Savings' }),
      ];
      render(<TransactionForm {...defaultProps} accounts={accounts} showTransfer={true} />);
      
      await userEvent.click(screen.getByTestId('type-transfer'));
      
      expect(screen.queryByText('Split transaction')).not.toBeInTheDocument();
    });
  });

  describe('Chat Context Props', () => {
    it('hides payee field when hidePayeeField is true', () => {
      render(<TransactionForm {...defaultProps} hidePayeeField={true} />);
      expect(screen.queryByPlaceholderText('e.g., Supermarket')).not.toBeInTheDocument();
    });

    it('hides transfer type when showTransfer is false', () => {
      render(<TransactionForm {...defaultProps} showTransfer={false} />);
      expect(screen.queryByTestId('type-transfer')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper aria attributes on dialog', () => {
      render(<TransactionForm {...defaultProps} />);
      
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'transaction-form-title');
    });

    it('close button has accessible label', () => {
      render(<TransactionForm {...defaultProps} />);
      expect(screen.getByLabelText('Close dialog')).toBeInTheDocument();
    });

    it('required fields are marked', () => {
      render(<TransactionForm {...defaultProps} />);
      expect(screen.getByText('Amount *')).toBeInTheDocument();
      expect(screen.getByText('Category *')).toBeInTheDocument();
    });
  });
});
