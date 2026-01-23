import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TransactionList } from './TransactionList';
import type { Transaction } from '../types/transactions';
import type { Account } from '../services/accountService';
import type { Label, Tag } from '../types/labels';

// Mock the CurrencyContext
vi.mock('../context/CurrencyContext', () => ({
  useCurrency: () => ({
    primaryCurrency: 'USD',
    convert: (amount: number, _currency: string) => amount, // 1:1 for tests
    formatWithConversion: (amount: number, currency: string) => ({
      original: `${amount.toFixed(2)} ${currency}`,
      converted: currency === 'USD' ? null : `${amount.toFixed(2)} USD`,
    }),
  }),
}));

// Mock SwipeableRow to simplify testing
vi.mock('./SwipeableRow', () => ({
  SwipeableRow: ({ children, onSwipeLeft, onSwipeRight }: { 
    children: React.ReactNode; 
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
  }) => (
    <div data-testid="swipeable-row">
      {children}
      <button data-testid="swipe-left" onClick={onSwipeLeft}>Swipe Left</button>
      <button data-testid="swipe-right" onClick={onSwipeRight}>Swipe Right</button>
    </div>
  ),
  SwipeActionIcon: ({ icon, label }: { icon: string; label: string }) => (
    <span data-testid={`swipe-icon-${label.toLowerCase()}`}>{icon}</span>
  ),
}));

// Mock window.confirm
const mockConfirm = vi.fn(() => true);
Object.defineProperty(window, 'confirm', { value: mockConfirm, writable: true });

// Test data factories
const createTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'tx-1',
  accountId: 'acc-1',
  type: 'Send',
  amount: 100,
  currency: 'USD',
  date: '2026-01-22T12:00:00.000Z',
  title: 'Test Transaction',
  payee: 'Test Payee',
  notes: '',
  splits: [{ labelId: 'label-1', amount: 100 }],
  tagIds: [],
  tags: [],
  isCleared: true,
  isRecurringTemplate: false,
  createdAt: '2026-01-22T12:00:00.000Z',
  updatedAt: '2026-01-22T12:00:00.000Z',
  ...overrides,
});

const createAccount = (overrides: Partial<Account> = {}): Account => ({
  id: 'acc-1',
  name: 'Test Account',
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
  isDefault: false,
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
  color: '#3498db',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('TransactionList', () => {
  const defaultProps = {
    transactions: [] as Transaction[],
    accounts: [] as Account[],
    labels: [] as Label[],
    tags: [] as Tag[],
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onToggleCleared: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockConfirm.mockReturnValue(true);
  });

  describe('Empty State', () => {
    it('should render empty state when no transactions', () => {
      render(<TransactionList {...defaultProps} />);
      
      expect(screen.getByText('No transactions found')).toBeInTheDocument();
      expect(screen.getByText('Add your first transaction to get started')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should render skeleton loaders when loading', () => {
      render(<TransactionList {...defaultProps} isLoading={true} />);
      
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBe(5);
    });

    it('should not render empty state when loading', () => {
      render(<TransactionList {...defaultProps} isLoading={true} />);
      
      expect(screen.queryByText('No transactions found')).not.toBeInTheDocument();
    });
  });

  describe('Transaction Rendering', () => {
    it('should render transaction with title', () => {
      const transaction = createTransaction({ title: 'Grocery Shopping' });
      render(
        <TransactionList
          {...defaultProps}
          transactions={[transaction]}
          accounts={[createAccount()]}
          labels={[createLabel()]}
        />
      );
      
      expect(screen.getByText('Grocery Shopping')).toBeInTheDocument();
    });

    it('should render transaction with account name', () => {
      const account = createAccount({ name: 'Main Checking' });
      const transaction = createTransaction({ accountId: account.id });
      
      render(
        <TransactionList
          {...defaultProps}
          transactions={[transaction]}
          accounts={[account]}
          labels={[createLabel()]}
        />
      );
      
      expect(screen.getByText(/Main Checking/)).toBeInTheDocument();
    });

    it('should render transaction with payee', () => {
      const transaction = createTransaction({ payee: 'Amazon' });
      
      render(
        <TransactionList
          {...defaultProps}
          transactions={[transaction]}
          accounts={[createAccount()]}
          labels={[createLabel()]}
        />
      );
      
      expect(screen.getByText(/Amazon/)).toBeInTheDocument();
    });

    it('should render pending indicator for uncleared transactions', () => {
      const transaction = createTransaction({ isCleared: false });
      
      render(
        <TransactionList
          {...defaultProps}
          transactions={[transaction]}
          accounts={[createAccount()]}
          labels={[createLabel()]}
        />
      );
      
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    it('should not render pending indicator for cleared transactions', () => {
      const transaction = createTransaction({ isCleared: true });
      
      render(
        <TransactionList
          {...defaultProps}
          transactions={[transaction]}
          accounts={[createAccount()]}
          labels={[createLabel()]}
        />
      );
      
      expect(screen.queryByText('Pending')).not.toBeInTheDocument();
    });

    it('should render amount with correct formatting for send', () => {
      const transaction = createTransaction({ type: 'Send', amount: 50.99 });
      
      render(
        <TransactionList
          {...defaultProps}
          transactions={[transaction]}
          accounts={[createAccount()]}
          labels={[createLabel()]}
        />
      );
      
      // Use getAllByText since amount appears in both daily total and transaction
      const amounts = screen.getAllByText(/-\$50\.99/);
      expect(amounts.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Send/)).toBeInTheDocument();
    });

    it('should render amount with correct formatting for receive', () => {
      const transaction = createTransaction({ type: 'Receive', amount: 100 });
      
      render(
        <TransactionList
          {...defaultProps}
          transactions={[transaction]}
          accounts={[createAccount()]}
          labels={[createLabel()]}
        />
      );
      
      // Use getAllByText since amount appears in both daily total and transaction
      const amounts = screen.getAllByText(/\+\$100\.00/);
      expect(amounts.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Receive/)).toBeInTheDocument();
    });

    it('should render transfer indicator', () => {
      // Transfers are now detected by transferToAccountId presence (self-transfer)
      const transaction = createTransaction({ 
        type: 'Send', 
        amount: 500,
        transferToAccountId: 'acc-2',
        linkedTransactionId: 'linked-tx-1'
      });
      
      render(
        <TransactionList
          {...defaultProps}
          transactions={[transaction]}
          accounts={[createAccount()]}
          labels={[createLabel()]}
        />
      );
      
      expect(screen.getByText(/Transfer/)).toBeInTheDocument();
    });

    it('should render category icon from label', () => {
      const label = createLabel({ icon: '🍕' });
      const transaction = createTransaction({ splits: [{ labelId: label.id, amount: 100 }] });
      
      render(
        <TransactionList
          {...defaultProps}
          transactions={[transaction]}
          accounts={[createAccount()]}
          labels={[label]}
        />
      );
      
      expect(screen.getByText('🍕')).toBeInTheDocument();
    });

    it('should render recurring indicator for recurring transactions', () => {
      const transaction = createTransaction({ parentTransactionId: 'parent-tx-1' });
      
      render(
        <TransactionList
          {...defaultProps}
          transactions={[transaction]}
          accounts={[createAccount()]}
          labels={[createLabel()]}
        />
      );
      
      expect(screen.getByText('🔄')).toBeInTheDocument();
    });
  });

  describe('Date Grouping', () => {
    it('should group transactions by date', () => {
      const tx1 = createTransaction({ id: 'tx-1', date: '2026-01-22T12:00:00.000Z' });
      const tx2 = createTransaction({ id: 'tx-2', date: '2026-01-22T12:00:00.000Z' });
      const tx3 = createTransaction({ id: 'tx-3', date: '2026-01-21T12:00:00.000Z' });
      
      render(
        <TransactionList
          {...defaultProps}
          transactions={[tx1, tx2, tx3]}
          accounts={[createAccount()]}
          labels={[createLabel()]}
        />
      );
      
      // Should have multiple swipeable rows (one per transaction)
      const rows = screen.getAllByTestId('swipeable-row');
      expect(rows.length).toBe(3);
    });

    it('should show daily totals for each date group', () => {
      const tx1 = createTransaction({ id: 'tx-1', type: 'Receive', amount: 100 });
      const tx2 = createTransaction({ id: 'tx-2', type: 'Send', amount: 30 });
      
      render(
        <TransactionList
          {...defaultProps}
          transactions={[tx1, tx2]}
          accounts={[createAccount()]}
          labels={[createLabel()]}
        />
      );
      
      // Net should be +70 (100 receive - 30 send)
      expect(screen.getByText('+$70.00')).toBeInTheDocument();
    });
  });

  describe('Expanded Details', () => {
    it('should expand transaction on click', () => {
      const transaction = createTransaction({ notes: 'This is a test note' });
      
      render(
        <TransactionList
          {...defaultProps}
          transactions={[transaction]}
          accounts={[createAccount()]}
          labels={[createLabel()]}
        />
      );
      
      // Notes should not be visible initially
      expect(screen.queryByText('This is a test note')).not.toBeInTheDocument();
      
      // Click to expand
      const row = screen.getByText('Test Transaction').closest('.cursor-pointer');
      fireEvent.click(row!);
      
      // Notes should now be visible
      expect(screen.getByText('This is a test note')).toBeInTheDocument();
    });

    it('should show tags when expanded', () => {
      const tag = createTag({ name: 'Business' });
      const transaction = createTransaction({ tagIds: [tag.id] });
      
      render(
        <TransactionList
          {...defaultProps}
          transactions={[transaction]}
          accounts={[createAccount()]}
          labels={[createLabel()]}
          tags={[tag]}
        />
      );
      
      // Expand
      const row = screen.getByText('Test Transaction').closest('.cursor-pointer');
      fireEvent.click(row!);
      
      expect(screen.getByText('Business')).toBeInTheDocument();
    });

    it('should show location when expanded', () => {
      const transaction = createTransaction({
        location: {
          latitude: 40.7829,
          longitude: -73.9654,
          placeName: 'Central Park',
          city: 'New York',
          country: 'USA',
        },
      });
      
      render(
        <TransactionList
          {...defaultProps}
          transactions={[transaction]}
          accounts={[createAccount()]}
          labels={[createLabel()]}
        />
      );
      
      // Expand
      const row = screen.getByText('Test Transaction').closest('.cursor-pointer');
      fireEvent.click(row!);
      
      expect(screen.getByText(/Central Park/)).toBeInTheDocument();
    });

    it('should show split details when transaction has multiple splits', () => {
      const label1 = createLabel({ id: 'label-1', name: 'Food', icon: '🍔' });
      const label2 = createLabel({ id: 'label-2', name: 'Entertainment', icon: '🎬' });
      const transaction = createTransaction({
        splits: [
          { labelId: 'label-1', amount: 60 },
          { labelId: 'label-2', amount: 40 },
        ],
      });
      
      render(
        <TransactionList
          {...defaultProps}
          transactions={[transaction]}
          accounts={[createAccount()]}
          labels={[label1, label2]}
        />
      );
      
      // Expand
      const row = screen.getByText('Test Transaction').closest('.cursor-pointer');
      fireEvent.click(row!);
      
      expect(screen.getByText('Categories:')).toBeInTheDocument();
      expect(screen.getByText('🍔 Food')).toBeInTheDocument();
      expect(screen.getByText('🎬 Entertainment')).toBeInTheDocument();
    });

    it('should collapse when clicking again', () => {
      const transaction = createTransaction({ notes: 'Test note' });
      
      render(
        <TransactionList
          {...defaultProps}
          transactions={[transaction]}
          accounts={[createAccount()]}
          labels={[createLabel()]}
        />
      );
      
      const row = screen.getByText('Test Transaction').closest('.cursor-pointer');
      
      // Expand
      fireEvent.click(row!);
      expect(screen.getByText('Test note')).toBeInTheDocument();
      
      // Collapse
      fireEvent.click(row!);
      expect(screen.queryByText('Test note')).not.toBeInTheDocument();
    });
  });

  describe('Actions', () => {
    it('should call onEdit when Edit button is clicked', () => {
      const onEdit = vi.fn();
      const transaction = createTransaction();
      
      render(
        <TransactionList
          {...defaultProps}
          transactions={[transaction]}
          accounts={[createAccount()]}
          labels={[createLabel()]}
          onEdit={onEdit}
        />
      );
      
      // Expand to show actions
      const row = screen.getByText('Test Transaction').closest('.cursor-pointer');
      fireEvent.click(row!);
      
      // Click edit
      fireEvent.click(screen.getByText('Edit'));
      
      expect(onEdit).toHaveBeenCalledWith(transaction);
    });

    it('should call onDelete when Delete button is clicked and confirmed', () => {
      const onDelete = vi.fn();
      const transaction = createTransaction();
      
      render(
        <TransactionList
          {...defaultProps}
          transactions={[transaction]}
          accounts={[createAccount()]}
          labels={[createLabel()]}
          onDelete={onDelete}
        />
      );
      
      // Expand to show actions
      const row = screen.getByText('Test Transaction').closest('.cursor-pointer');
      fireEvent.click(row!);
      
      // Click delete
      fireEvent.click(screen.getByText('Delete'));
      
      expect(mockConfirm).toHaveBeenCalled();
      expect(onDelete).toHaveBeenCalledWith('tx-1');
    });

    it('should not call onDelete when delete is cancelled', () => {
      mockConfirm.mockReturnValue(false);
      const onDelete = vi.fn();
      const transaction = createTransaction();
      
      render(
        <TransactionList
          {...defaultProps}
          transactions={[transaction]}
          accounts={[createAccount()]}
          labels={[createLabel()]}
          onDelete={onDelete}
        />
      );
      
      // Expand to show actions
      const row = screen.getByText('Test Transaction').closest('.cursor-pointer');
      fireEvent.click(row!);
      
      // Click delete
      fireEvent.click(screen.getByText('Delete'));
      
      expect(onDelete).not.toHaveBeenCalled();
    });

    it('should call onToggleCleared when Mark Cleared button is clicked', () => {
      const onToggleCleared = vi.fn();
      const transaction = createTransaction({ isCleared: false });
      
      render(
        <TransactionList
          {...defaultProps}
          transactions={[transaction]}
          accounts={[createAccount()]}
          labels={[createLabel()]}
          onToggleCleared={onToggleCleared}
        />
      );
      
      // Expand to show actions
      const row = screen.getByText('Test Transaction').closest('.cursor-pointer');
      fireEvent.click(row!);
      
      // Click clear
      fireEvent.click(screen.getByText('✓ Mark Cleared'));
      
      expect(onToggleCleared).toHaveBeenCalledWith('tx-1', true);
    });

    it('should call onToggleCleared when Mark Pending button is clicked', () => {
      const onToggleCleared = vi.fn();
      const transaction = createTransaction({ isCleared: true });
      
      render(
        <TransactionList
          {...defaultProps}
          transactions={[transaction]}
          accounts={[createAccount()]}
          labels={[createLabel()]}
          onToggleCleared={onToggleCleared}
        />
      );
      
      // Expand to show actions
      const row = screen.getByText('Test Transaction').closest('.cursor-pointer');
      fireEvent.click(row!);
      
      // Click pending
      fireEvent.click(screen.getByText('↩ Mark Pending'));
      
      expect(onToggleCleared).toHaveBeenCalledWith('tx-1', false);
    });
  });

  describe('Swipe Actions', () => {
    it('should call onToggleCleared on swipe right', () => {
      const onToggleCleared = vi.fn();
      const transaction = createTransaction({ isCleared: false });
      
      render(
        <TransactionList
          {...defaultProps}
          transactions={[transaction]}
          accounts={[createAccount()]}
          labels={[createLabel()]}
          onToggleCleared={onToggleCleared}
        />
      );
      
      fireEvent.click(screen.getByTestId('swipe-right'));
      
      expect(onToggleCleared).toHaveBeenCalledWith('tx-1', true);
    });

    it('should call onDelete on swipe left when confirmed', () => {
      const onDelete = vi.fn();
      const transaction = createTransaction();
      
      render(
        <TransactionList
          {...defaultProps}
          transactions={[transaction]}
          accounts={[createAccount()]}
          labels={[createLabel()]}
          onDelete={onDelete}
        />
      );
      
      fireEvent.click(screen.getByTestId('swipe-left'));
      
      expect(mockConfirm).toHaveBeenCalled();
      expect(onDelete).toHaveBeenCalledWith('tx-1');
    });
  });

  describe('Selection Mode', () => {
    it('should show checkbox in selection mode', () => {
      const transaction = createTransaction();
      
      render(
        <TransactionList
          {...defaultProps}
          transactions={[transaction]}
          accounts={[createAccount()]}
          labels={[createLabel()]}
          selectionMode={true}
          selectedIds={new Set()}
        />
      );
      
      // Checkbox container should be visible
      const checkbox = document.querySelector('.w-5.h-5.rounded.border-2');
      expect(checkbox).toBeInTheDocument();
    });

    it('should show selected state when transaction is selected', () => {
      const transaction = createTransaction();
      
      render(
        <TransactionList
          {...defaultProps}
          transactions={[transaction]}
          accounts={[createAccount()]}
          labels={[createLabel()]}
          selectionMode={true}
          selectedIds={new Set(['tx-1'])}
        />
      );
      
      // Checkbox should be checked (has bg-blue-600)
      const checkbox = document.querySelector('.bg-blue-600');
      expect(checkbox).toBeInTheDocument();
    });

    it('should call onToggleSelection when clicking in selection mode', () => {
      const onToggleSelection = vi.fn();
      const transaction = createTransaction();
      
      render(
        <TransactionList
          {...defaultProps}
          transactions={[transaction]}
          accounts={[createAccount()]}
          labels={[createLabel()]}
          selectionMode={true}
          selectedIds={new Set()}
          onToggleSelection={onToggleSelection}
        />
      );
      
      const row = screen.getByText('Test Transaction').closest('.cursor-pointer');
      fireEvent.click(row!);
      
      expect(onToggleSelection).toHaveBeenCalledWith('tx-1');
    });

    it('should not expand transaction when clicking in selection mode', () => {
      const transaction = createTransaction({ notes: 'Test note' });
      
      render(
        <TransactionList
          {...defaultProps}
          transactions={[transaction]}
          accounts={[createAccount()]}
          labels={[createLabel()]}
          selectionMode={true}
          selectedIds={new Set()}
          onToggleSelection={vi.fn()}
        />
      );
      
      const row = screen.getByText('Test Transaction').closest('.cursor-pointer');
      fireEvent.click(row!);
      
      // Should not expand
      expect(screen.queryByText('Test note')).not.toBeInTheDocument();
    });
  });

  describe('Transfer Details', () => {
    it('should show transfer destination account when expanded', () => {
      const fromAccount = createAccount({ id: 'acc-1', name: 'Checking' });
      const toAccount = createAccount({ id: 'acc-2', name: 'Savings' });
      // Transfers are now Send type with linkedTransactionId
      const transaction = createTransaction({
        type: 'Send',
        accountId: 'acc-1',
        transferToAccountId: 'acc-2',
        linkedTransactionId: 'linked-tx-1',
      });
      
      render(
        <TransactionList
          {...defaultProps}
          transactions={[transaction]}
          accounts={[fromAccount, toAccount]}
          labels={[createLabel()]}
        />
      );
      
      // Expand
      const row = screen.getByText('Test Transaction').closest('.cursor-pointer');
      fireEvent.click(row!);
      
      expect(screen.getByText('→ Savings')).toBeInTheDocument();
    });

    it('should call onViewLinkedTransaction when View linked button is clicked', () => {
      const fromAccount = createAccount({ id: 'acc-1', name: 'Checking' });
      const toAccount = createAccount({ id: 'acc-2', name: 'Savings' });
      // Transfers are now Send type with linkedTransactionId
      const transaction = createTransaction({
        type: 'Send',
        accountId: 'acc-1',
        transferToAccountId: 'acc-2',
        linkedTransactionId: 'linked-tx-1',
      });
      const onViewLinkedTransaction = vi.fn();
      
      render(
        <TransactionList
          {...defaultProps}
          transactions={[transaction]}
          accounts={[fromAccount, toAccount]}
          labels={[createLabel()]}
          onViewLinkedTransaction={onViewLinkedTransaction}
        />
      );
      
      // Expand
      const row = screen.getByText('Test Transaction').closest('.cursor-pointer');
      fireEvent.click(row!);
      
      // Click View linked button
      const viewLinkedButton = screen.getByText('View linked');
      fireEvent.click(viewLinkedButton);
      
      expect(onViewLinkedTransaction).toHaveBeenCalledWith('linked-tx-1', 'acc-2');
    });
  });

  describe('Currency Display', () => {
    it('should show converted amount for non-primary currency', () => {
      const transaction = createTransaction({ currency: 'EUR', amount: 100 });
      
      render(
        <TransactionList
          {...defaultProps}
          transactions={[transaction]}
          accounts={[createAccount()]}
          labels={[createLabel()]}
        />
      );
      
      // Should show converted amount
      expect(screen.getByText(/≈.*USD/)).toBeInTheDocument();
    });
  });
});
