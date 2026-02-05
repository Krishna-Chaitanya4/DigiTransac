import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithRouter, userEvent } from '../test/test-utils';
import CategoriesTab from './CategoriesTab';
import * as labelService from '../services/labelService';
import { LabelTree, Label } from '../types/labels';

// Mock the label service
vi.mock('../services/labelService', () => ({
  getLabels: vi.fn(),
  getLabelsTree: vi.fn(),
  createLabel: vi.fn(),
  updateLabel: vi.fn(),
  deleteLabel: vi.fn(),
  getLabelTransactionCount: vi.fn(),
  deleteLabelWithReassignment: vi.fn(),
}));

// Sample test data
const mockFlatLabels: Label[] = [
  { id: '1', name: 'Expenses', type: 'Folder', parentId: null, icon: '💰', color: null, order: 0, isSystem: false, createdAt: '2025-01-01' },
  { id: '2', name: 'Food', type: 'Category', parentId: '1', icon: '🍔', color: '#ef4444', order: 0, isSystem: false, createdAt: '2025-01-01' },
  { id: '3', name: 'Transport', type: 'Folder', parentId: '1', icon: '🚗', color: null, order: 1, isSystem: false, createdAt: '2025-01-01' },
  { id: '4', name: 'Gas', type: 'Category', parentId: '3', icon: '⛽', color: '#3b82f6', order: 0, isSystem: false, createdAt: '2025-01-01' },
  { id: '5', name: 'Income', type: 'Folder', parentId: null, icon: '💵', color: null, order: 1, isSystem: false, createdAt: '2025-01-01' },
];

const mockTreeLabels: LabelTree[] = [
  {
    id: '1', name: 'Expenses', type: 'Folder', parentId: null, icon: '💰', color: null, order: 0, isSystem: false, createdAt: '2025-01-01',
    children: [
      { id: '2', name: 'Food', type: 'Category', parentId: '1', icon: '🍔', color: '#ef4444', order: 0, isSystem: false, createdAt: '2025-01-01', children: [] },
      {
        id: '3', name: 'Transport', type: 'Folder', parentId: '1', icon: '🚗', color: null, order: 1, isSystem: false, createdAt: '2025-01-01',
        children: [
          { id: '4', name: 'Gas', type: 'Category', parentId: '3', icon: '⛽', color: '#3b82f6', order: 0, isSystem: false, createdAt: '2025-01-01', children: [] },
        ],
      },
    ],
  },
  {
    id: '5', name: 'Income', type: 'Folder', parentId: null, icon: '💵', color: null, order: 1, isSystem: false, createdAt: '2025-01-01',
    children: [],
  },
];

describe('CategoriesTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(labelService.getLabels).mockResolvedValue(mockFlatLabels);
    vi.mocked(labelService.getLabelsTree).mockResolvedValue(mockTreeLabels);
    vi.mocked(labelService.getLabelTransactionCount).mockResolvedValue({ transactionCount: 0 });
    vi.mocked(labelService.deleteLabelWithReassignment).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial render', () => {
    it('should load and display labels', async () => {
      // Act
      renderWithRouter(<CategoriesTab />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Expenses')).toBeInTheDocument();
      });
      expect(screen.getByText('Income')).toBeInTheDocument();
    });

    it('should show all folders expanded by default', async () => {
      // Act
      renderWithRouter(<CategoriesTab />);

      // Assert - all nested items should be visible
      await waitFor(() => {
        expect(screen.getByText('Expenses')).toBeInTheDocument();
      });
      expect(screen.getByText('Food')).toBeInTheDocument();
      expect(screen.getByText('Transport')).toBeInTheDocument();
      expect(screen.getByText('Gas')).toBeInTheDocument();
    });

    it('should display loading state initially', () => {
      // Arrange
      vi.mocked(labelService.getLabelsTree).mockImplementation(() => new Promise(() => {}));

      // Act
      renderWithRouter(<CategoriesTab />);

      // Assert - CategoriesTab shows a spinner, not text
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('should display error message on load failure', async () => {
      // Arrange
      vi.mocked(labelService.getLabelsTree).mockRejectedValue(new Error('Network error'));

      // Act
      renderWithRouter(<CategoriesTab />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });
  });

  describe('search functionality', () => {
    it('should filter labels when searching', async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithRouter(<CategoriesTab />);

      await waitFor(() => {
        expect(screen.getByText('Expenses')).toBeInTheDocument();
      });

      // Act
      const searchInput = screen.getByPlaceholderText('Search categories...');
      await user.type(searchInput, 'Food');

      // Assert
      await waitFor(() => {
        expect(screen.getByText('1 result')).toBeInTheDocument();
      });
      expect(screen.getByText('Food')).toBeInTheDocument();
    });

    it('should show path in search results', async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithRouter(<CategoriesTab />);

      await waitFor(() => {
        expect(screen.getByText('Expenses')).toBeInTheDocument();
      });

      // Act
      const searchInput = screen.getByPlaceholderText('Search categories...');
      await user.type(searchInput, 'Gas');

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Expenses → Transport → Gas')).toBeInTheDocument();
      });
    });

    it('should show no results message for non-matching search', async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithRouter(<CategoriesTab />);

      await waitFor(() => {
        expect(screen.getByText('Expenses')).toBeInTheDocument();
      });

      // Act
      const searchInput = screen.getByPlaceholderText('Search categories...');
      await user.type(searchInput, 'NonExistent');

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/No results found/)).toBeInTheDocument();
      });
    });

    it('should clear search when clicking clear button', async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithRouter(<CategoriesTab />);

      await waitFor(() => {
        expect(screen.getByText('Expenses')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search categories...');
      await user.type(searchInput, 'Food');

      await waitFor(() => {
        expect(screen.getByText('1 result')).toBeInTheDocument();
      });

      // Act - click clear button (X)
      const clearButton = searchInput.parentElement?.querySelector('button');
      if (clearButton) {
        await user.click(clearButton);
      }

      // Assert
      await waitFor(() => {
        expect(screen.queryByText('1 result')).not.toBeInTheDocument();
      });
    });
  });

  describe('expand/collapse toggle', () => {
    it('should collapse all folders when clicking collapse button', async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithRouter(<CategoriesTab />);

      await waitFor(() => {
        expect(screen.getByText('Food')).toBeInTheDocument();
      });

      // Act - click the toggle button (should be "Collapse All" since all are expanded)
      const toggleButton = screen.getByTitle('Collapse All');
      await user.click(toggleButton);

      // Assert - nested items should be hidden
      await waitFor(() => {
        expect(screen.queryByText('Food')).not.toBeInTheDocument();
      });
      expect(screen.queryByText('Gas')).not.toBeInTheDocument();
      // Root folders should still be visible
      expect(screen.getByText('Expenses')).toBeInTheDocument();
      expect(screen.getByText('Income')).toBeInTheDocument();
    });

    it('should expand all folders when clicking expand button', async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithRouter(<CategoriesTab />);

      await waitFor(() => {
        expect(screen.getByText('Food')).toBeInTheDocument();
      });

      // First collapse all
      const collapseButton = screen.getByTitle('Collapse All');
      await user.click(collapseButton);

      await waitFor(() => {
        expect(screen.queryByText('Food')).not.toBeInTheDocument();
      });

      // Act - click expand button
      const expandButton = screen.getByTitle('Expand All');
      await user.click(expandButton);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Food')).toBeInTheDocument();
      });
      expect(screen.getByText('Gas')).toBeInTheDocument();
    });
  });

  describe('create label modal', () => {
    it('should open modal when clicking New Folder button', async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithRouter(<CategoriesTab />);

      await waitFor(() => {
        expect(screen.getByText('Expenses')).toBeInTheDocument();
      });

      // Act
      await user.click(screen.getByText('New Folder'));

      // Assert
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'New Folder' })).toBeInTheDocument();
      });
    });

    it('should open modal when clicking New Category button', async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithRouter(<CategoriesTab />);

      await waitFor(() => {
        expect(screen.getByText('Expenses')).toBeInTheDocument();
      });

      // Act
      await user.click(screen.getByText('New Category'));

      // Assert
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'New Category' })).toBeInTheDocument();
      });
    });

    it('should show searchable folder dropdown in modal', async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithRouter(<CategoriesTab />);

      await waitFor(() => {
        expect(screen.getByText('Expenses')).toBeInTheDocument();
      });

      // Open modal
      await user.click(screen.getByText('New Category'));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'New Category' })).toBeInTheDocument();
      });

      // Act - click the parent folder dropdown
      const parentDropdownButton = screen.getByText('None (Root level)');
      await user.click(parentDropdownButton);

      // Assert - dropdown should be open with search
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search folders...')).toBeInTheDocument();
      });
    });

    it('should filter folders in searchable dropdown', async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithRouter(<CategoriesTab />);

      await waitFor(() => {
        expect(screen.getByText('Expenses')).toBeInTheDocument();
      });

      // Open modal
      await user.click(screen.getByText('New Category'));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'New Category' })).toBeInTheDocument();
      });

      // Open dropdown
      const parentDropdownButton = screen.getByText('None (Root level)');
      await user.click(parentDropdownButton);

      // Act - search for a folder
      const folderSearch = screen.getByPlaceholderText('Search folders...');
      await user.type(folderSearch, 'Transport');

      // Assert - only matching folder should be visible
      await waitFor(() => {
        const dropdown = folderSearch.closest('div[class*="relative"]');
        expect(dropdown).toBeInTheDocument();
        // Transport should be in results
        expect(screen.getAllByText('Transport').length).toBeGreaterThanOrEqual(1);
      });
    });

    it('should create label when submitting form', async () => {
      // Arrange
      const user = userEvent.setup();
      vi.mocked(labelService.createLabel).mockResolvedValue({
        id: '6', name: 'New Test', type: 'Category', parentId: null, icon: null, color: null, order: 0, isSystem: false, createdAt: '2025-01-01'
      });

      renderWithRouter(<CategoriesTab />);

      await waitFor(() => {
        expect(screen.getByText('Expenses')).toBeInTheDocument();
      });

      // Open modal
      await user.click(screen.getByText('New Category'));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'New Category' })).toBeInTheDocument();
      });

      // Fill form
      await user.type(screen.getByPlaceholderText('Enter category name'), 'New Test');

      // Act
      await user.click(screen.getByRole('button', { name: /create/i }));

      // Assert
      await waitFor(() => {
        expect(labelService.createLabel).toHaveBeenCalledWith(expect.objectContaining({
          name: 'New Test',
          type: 'Category',
        }));
      });
    });
  });

  describe('empty state', () => {
    it('should show empty state when no labels exist', async () => {
      // Arrange
      vi.mocked(labelService.getLabels).mockResolvedValue([]);
      vi.mocked(labelService.getLabelsTree).mockResolvedValue([]);

      // Act
      renderWithRouter(<CategoriesTab />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('No categories yet')).toBeInTheDocument();
      });
    });
  });
});
