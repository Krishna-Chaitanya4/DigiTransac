import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithRouter, userEvent } from '../../test/test-utils';
import { FilterPanel } from './FilterPanel';
import type { Account } from '../../services/accountService';
import type { Label, Tag } from '../../types/labels';
import type { TransactionFilter } from '../../types/transactions';

// Sample test data
const mockAccounts: Account[] = [
  { id: 'acc1', name: 'Checking', type: 'Bank', icon: '🏦', color: null, currency: 'USD', initialBalance: 0, currentBalance: 1000, institution: 'Bank A', accountNumber: null, notes: null, isArchived: false, isDefault: false, includeInNetWorth: true, order: 0, canEditCurrency: true, createdAt: '2025-01-01', updatedAt: '2025-01-01' },
  { id: 'acc2', name: 'Savings', type: 'Bank', icon: '🏦', color: null, currency: 'USD', initialBalance: 0, currentBalance: 5000, institution: 'Bank A', accountNumber: null, notes: null, isArchived: false, isDefault: false, includeInNetWorth: true, order: 1, canEditCurrency: true, createdAt: '2025-01-01', updatedAt: '2025-01-01' },
];

// Hierarchical labels: Expenses > Food & Dining > (Restaurants, Groceries), Transport > (Fuel, Cab)
const mockLabels: Label[] = [
  // Top-level folder
  { id: 'expenses', name: 'Expenses', type: 'Folder', parentId: null, icon: '💰', color: null, order: 0, isSystem: false, createdAt: '2025-01-01' },
  // Sub-folder under Expenses
  { id: 'food', name: 'Food & Dining', type: 'Folder', parentId: 'expenses', icon: '🍽️', color: null, order: 0, isSystem: false, createdAt: '2025-01-01' },
  // Categories under Food & Dining
  { id: 'restaurants', name: 'Restaurants', type: 'Category', parentId: 'food', icon: '🍕', color: '#ef4444', order: 0, isSystem: false, createdAt: '2025-01-01' },
  { id: 'groceries', name: 'Groceries', type: 'Category', parentId: 'food', icon: '🛒', color: '#22c55e', order: 1, isSystem: false, createdAt: '2025-01-01' },
  // Sub-folder under Expenses
  { id: 'transport', name: 'Transport', type: 'Folder', parentId: 'expenses', icon: '🚗', color: null, order: 1, isSystem: false, createdAt: '2025-01-01' },
  // Categories under Transport
  { id: 'fuel', name: 'Fuel', type: 'Category', parentId: 'transport', icon: '⛽', color: '#3b82f6', order: 0, isSystem: false, createdAt: '2025-01-01' },
  { id: 'cab', name: 'Cab/Taxi', type: 'Category', parentId: 'transport', icon: '🚕', color: '#f59e0b', order: 1, isSystem: false, createdAt: '2025-01-01' },
  // Direct category under Expenses
  { id: 'misc', name: 'Miscellaneous', type: 'Category', parentId: 'expenses', icon: '📦', color: '#6b7280', order: 2, isSystem: false, createdAt: '2025-01-01' },
  // Another top-level folder
  { id: 'income', name: 'Income', type: 'Folder', parentId: null, icon: '💵', color: null, order: 1, isSystem: false, createdAt: '2025-01-01' },
  { id: 'salary', name: 'Salary', type: 'Category', parentId: 'income', icon: '💼', color: '#10b981', order: 0, isSystem: false, createdAt: '2025-01-01' },
];

const mockTags: Tag[] = [
  { id: 'tag1', name: 'Urgent', color: '#ef4444', createdAt: '2025-01-01' },
  { id: 'tag2', name: 'Personal', color: '#3b82f6', createdAt: '2025-01-01' },
];

describe('FilterPanel', () => {
  const defaultFilter: TransactionFilter = {};
  let onFilterChange: (filter: TransactionFilter) => void;
  let onClose: () => void;

  beforeEach(() => {
    onFilterChange = vi.fn();
    onClose = vi.fn();
  });

  const renderFilterPanel = (filter: TransactionFilter = defaultFilter) => {
    return renderWithRouter(
      <FilterPanel
        isOpen={true}
        accounts={mockAccounts}
        labels={mockLabels}
        tags={mockTags}
        filter={filter}
        onFilterChange={onFilterChange}
        onClose={onClose}
      />
    );
  };

  describe('initial render', () => {
    it('should render filter panel when open', () => {
      renderFilterPanel();
      expect(screen.getByText('Categories')).toBeInTheDocument();
      expect(screen.getByText('Accounts')).toBeInTheDocument();
      expect(screen.getByText('Tags')).toBeInTheDocument();
    });

    it('should show category search input', () => {
      renderFilterPanel();
      expect(screen.getByPlaceholderText('Search categories...')).toBeInTheDocument();
    });
  });

  describe('folder and category display', () => {
    it('should show both folders and categories in dropdown', async () => {
      const user = userEvent.setup();
      renderFilterPanel();

      // Click on category search to open dropdown
      const categoryInput = screen.getByPlaceholderText('Search categories...');
      await user.click(categoryInput);

      // Should show folders
      expect(screen.getByText('Expenses')).toBeInTheDocument();
      expect(screen.getByText('Food & Dining')).toBeInTheDocument();
      expect(screen.getByText('Transport')).toBeInTheDocument();
      expect(screen.getByText('Income')).toBeInTheDocument();

      // Should show categories
      expect(screen.getByText('Restaurants')).toBeInTheDocument();
      expect(screen.getByText('Groceries')).toBeInTheDocument();
      expect(screen.getByText('Fuel')).toBeInTheDocument();
    });

    it('should show folder icon from label data', async () => {
      const user = userEvent.setup();
      renderFilterPanel();

      const categoryInput = screen.getByPlaceholderText('Search categories...');
      await user.click(categoryInput);

      // The Expenses folder should show its icon 💰
      expect(screen.getByText('💰')).toBeInTheDocument();
      expect(screen.getByText('🍽️')).toBeInTheDocument();
    });

    it('should show category count for folders', async () => {
      const user = userEvent.setup();
      renderFilterPanel();

      const categoryInput = screen.getByPlaceholderText('Search categories...');
      await user.click(categoryInput);

      // Food & Dining and Transport both have 2 categories
      // So there should be at least 2 instances of "2 categories"
      const twoCategoriesElements = screen.getAllByText('2 categories');
      expect(twoCategoriesElements.length).toBeGreaterThanOrEqual(2);
    });

    it('should show recursive category count for parent folders', async () => {
      const user = userEvent.setup();
      renderFilterPanel();

      const categoryInput = screen.getByPlaceholderText('Search categories...');
      await user.click(categoryInput);

      // Expenses should show total categories: 
      // Food & Dining (2) + Transport (2) + Miscellaneous (1) = 5
      expect(screen.getByText('5 categories')).toBeInTheDocument();
    });
  });

  describe('folder selection', () => {
    it('should add folder to folderIds when folder is selected', async () => {
      const user = userEvent.setup();
      renderFilterPanel();

      const categoryInput = screen.getByPlaceholderText('Search categories...');
      await user.click(categoryInput);

      // Click on Food & Dining folder
      const foodFolder = screen.getByText('Food & Dining');
      await user.click(foodFolder);

      // Should call onFilterChange with folderIds containing the folder
      expect(onFilterChange).toHaveBeenCalledWith(
        expect.objectContaining({
          folderIds: ['food'],
        })
      );
    });

    it('should add category to labelIds when category is selected', async () => {
      const user = userEvent.setup();
      renderFilterPanel();

      const categoryInput = screen.getByPlaceholderText('Search categories...');
      await user.click(categoryInput);

      // Click on Restaurants category
      const restaurants = screen.getByText('Restaurants');
      await user.click(restaurants);

      // Should call onFilterChange with labelIds containing the category
      expect(onFilterChange).toHaveBeenCalledWith(
        expect.objectContaining({
          labelIds: ['restaurants'],
        })
      );
    });

    it('should display selected folder with its icon', () => {
      // Render with a folder already selected
      renderFilterPanel({ folderIds: ['food'] });

      // Should show Food & Dining as selected with its icon
      expect(screen.getByText('Food & Dining')).toBeInTheDocument();
      expect(screen.getByText('🍽️')).toBeInTheDocument();
    });

    it('should display selected category with its icon', () => {
      // Render with a category already selected
      renderFilterPanel({ labelIds: ['restaurants'] });

      // Should show Restaurants as selected with its icon
      expect(screen.getByText('Restaurants')).toBeInTheDocument();
      expect(screen.getByText('🍕')).toBeInTheDocument();
    });

    it('should show child count badge on selected folder', () => {
      // Render with Food & Dining folder selected
      renderFilterPanel({ folderIds: ['food'] });

      // Should show (2) indicating 2 categories will be included
      expect(screen.getByText('(2)')).toBeInTheDocument();
    });
  });

  describe('folder removal', () => {
    it('should remove folder from selection when X is clicked', async () => {
      const user = userEvent.setup();
      // Start with a folder selected
      renderFilterPanel({ folderIds: ['food'] });

      // Find the remove button (X) next to Food & Dining
      const foodChip = screen.getByText('Food & Dining').closest('span');
      const removeButton = foodChip?.querySelector('button');
      expect(removeButton).toBeTruthy();
      await user.click(removeButton!);

      // Should call onFilterChange with folderIds as undefined (empty)
      expect(onFilterChange).toHaveBeenCalledWith(
        expect.objectContaining({
          folderIds: undefined,
        })
      );
    });
  });

  describe('search filtering', () => {
    it('should filter folders and categories by search text', async () => {
      const user = userEvent.setup();
      renderFilterPanel();

      const categoryInput = screen.getByPlaceholderText('Search categories...');
      await user.click(categoryInput);
      await user.type(categoryInput, 'food');

      // Should show Food & Dining folder
      expect(screen.getByText('Food & Dining')).toBeInTheDocument();

      // Should not show unrelated items
      expect(screen.queryByText('Transport')).not.toBeInTheDocument();
      expect(screen.queryByText('Fuel')).not.toBeInTheDocument();
    });

    it('should filter and show matching categories', async () => {
      const user = userEvent.setup();
      renderFilterPanel();

      const categoryInput = screen.getByPlaceholderText('Search categories...');
      await user.click(categoryInput);
      await user.type(categoryInput, 'restaurant');

      // Should show Restaurants category
      expect(screen.getByText('Restaurants')).toBeInTheDocument();

      // Should not show other items
      expect(screen.queryByText('Groceries')).not.toBeInTheDocument();
    });
  });

  describe('multiple selections', () => {
    it('should display both folder and category when selected', () => {
      // Start with both folder and category selected
      renderFilterPanel({ folderIds: ['food'], labelIds: ['fuel'] });

      // Both should be visible as chips
      expect(screen.getByText('Food & Dining')).toBeInTheDocument();
      expect(screen.getByText('Fuel')).toBeInTheDocument();
      // Should show folder's child count
      expect(screen.getByText('(2)')).toBeInTheDocument();
    });

    it('should show selected folder icon and category icon', () => {
      renderFilterPanel({ folderIds: ['transport'], labelIds: ['restaurants'] });

      // Transport folder icon
      expect(screen.getByText('🚗')).toBeInTheDocument();
      // Restaurants category icon
      expect(screen.getByText('🍕')).toBeInTheDocument();
    });
  });

  describe('clear filters', () => {
    it('should clear all filters when Clear Filters is clicked', async () => {
      const user = userEvent.setup();
      renderFilterPanel({
        folderIds: ['food'],
        labelIds: ['fuel'],
        accountIds: ['acc1'],
        tagIds: ['tag1'],
      });

      // Click Clear Filters button
      const clearButton = screen.getByText('Clear Filters');
      await user.click(clearButton);

      // Should call onFilterChange with empty filter
      expect(onFilterChange).toHaveBeenCalledWith({});
    });
  });
});
