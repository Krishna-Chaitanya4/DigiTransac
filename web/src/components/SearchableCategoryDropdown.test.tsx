import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SearchableCategoryDropdown } from './SearchableCategoryDropdown';
import type { Label } from '../types/labels';

const mockCategories: Label[] = [
  { id: '1', name: 'Food', icon: '🍔', type: 'Category', parentId: null, color: null, order: 0, isSystem: false, createdAt: '2024-01-01T00:00:00Z' },
  { id: '2', name: 'Transport', icon: '🚗', type: 'Category', parentId: null, color: null, order: 1, isSystem: false, createdAt: '2024-01-01T00:00:00Z' },
  { id: '3', name: 'Shopping', icon: '🛒', type: 'Category', parentId: null, color: null, order: 2, isSystem: false, createdAt: '2024-01-01T00:00:00Z' },
  { id: '4', name: 'Entertainment', icon: '🎬', type: 'Category', parentId: null, color: null, order: 3, isSystem: false, createdAt: '2024-01-01T00:00:00Z' },
  { id: '5', name: 'Utilities', icon: '💡', type: 'Category', parentId: null, color: null, order: 4, isSystem: false, createdAt: '2024-01-01T00:00:00Z' },
];

describe('SearchableCategoryDropdown', () => {
  const defaultProps = {
    value: '',
    onChange: vi.fn(),
    categories: mockCategories,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render with placeholder when no value selected', () => {
      render(<SearchableCategoryDropdown {...defaultProps} placeholder="Select category..." />);
      expect(screen.getByText('Select category...')).toBeInTheDocument();
    });

    it('should render selected category with icon', () => {
      render(<SearchableCategoryDropdown {...defaultProps} value="1" />);
      expect(screen.getByText('🍔')).toBeInTheDocument();
      expect(screen.getByText('Food')).toBeInTheDocument();
    });

    it('should be disabled when disabled prop is true', () => {
      render(<SearchableCategoryDropdown {...defaultProps} disabled />);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });
  });

  describe('Dropdown Interaction', () => {
    it('should open dropdown when clicked', async () => {
      render(<SearchableCategoryDropdown {...defaultProps} />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search categories...')).toBeInTheDocument();
      });
    });

    it('should show all categories in dropdown', async () => {
      render(<SearchableCategoryDropdown {...defaultProps} />);
      
      fireEvent.click(screen.getByRole('button'));
      
      await waitFor(() => {
        mockCategories.forEach(cat => {
          expect(screen.getByText(cat.name)).toBeInTheDocument();
        });
      });
    });

    it('should close dropdown when clicking outside', async () => {
      render(
        <div>
          <SearchableCategoryDropdown {...defaultProps} />
          <div data-testid="outside">Outside</div>
        </div>
      );
      
      fireEvent.click(screen.getByRole('button'));
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search categories...')).toBeInTheDocument();
      });
      
      fireEvent.mouseDown(screen.getByTestId('outside'));
      
      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Search categories...')).not.toBeInTheDocument();
      });
    });

    it('should close dropdown on Escape key', async () => {
      render(<SearchableCategoryDropdown {...defaultProps} />);
      
      fireEvent.click(screen.getByRole('button'));
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search categories...')).toBeInTheDocument();
      });
      
      fireEvent.keyDown(document, { key: 'Escape' });
      
      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Search categories...')).not.toBeInTheDocument();
      });
    });
  });

  describe('Search Functionality', () => {
    it('should filter categories based on search', async () => {
      render(<SearchableCategoryDropdown {...defaultProps} />);
      
      fireEvent.click(screen.getByRole('button'));
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search categories...')).toBeInTheDocument();
      });
      
      const searchInput = screen.getByPlaceholderText('Search categories...');
      fireEvent.change(searchInput, { target: { value: 'food' } });
      
      await waitFor(() => {
        expect(screen.getByText('Food')).toBeInTheDocument();
        expect(screen.queryByText('Transport')).not.toBeInTheDocument();
        expect(screen.queryByText('Shopping')).not.toBeInTheDocument();
      });
    });

    it('should show no results message when search has no matches', async () => {
      render(<SearchableCategoryDropdown {...defaultProps} />);
      
      fireEvent.click(screen.getByRole('button'));
      
      const searchInput = screen.getByPlaceholderText('Search categories...');
      fireEvent.change(searchInput, { target: { value: 'xyz123' } });
      
      await waitFor(() => {
        expect(screen.getByText('No matching categories')).toBeInTheDocument();
      });
    });

    it('should be case-insensitive search', async () => {
      render(<SearchableCategoryDropdown {...defaultProps} />);
      
      fireEvent.click(screen.getByRole('button'));
      
      const searchInput = screen.getByPlaceholderText('Search categories...');
      fireEvent.change(searchInput, { target: { value: 'FOOD' } });
      
      await waitFor(() => {
        expect(screen.getByText('Food')).toBeInTheDocument();
      });
    });
  });

  describe('Selection', () => {
    it('should call onChange when category is selected', async () => {
      const onChange = vi.fn();
      render(<SearchableCategoryDropdown {...defaultProps} onChange={onChange} />);
      
      fireEvent.click(screen.getByRole('button'));
      
      await waitFor(() => {
        expect(screen.getByText('Transport')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByText('Transport'));
      
      expect(onChange).toHaveBeenCalledWith('2');
    });

    it('should close dropdown after selection', async () => {
      render(<SearchableCategoryDropdown {...defaultProps} />);
      
      fireEvent.click(screen.getByRole('button'));
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search categories...')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByText('Transport'));
      
      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Search categories...')).not.toBeInTheDocument();
      });
    });

    it('should show checkmark on selected item', async () => {
      render(<SearchableCategoryDropdown {...defaultProps} value="1" />);
      
      fireEvent.click(screen.getByRole('button'));
      
      await waitFor(() => {
        // Food appears twice - in button and dropdown. Get the dropdown option (second one)
        const foodButtons = screen.getAllByText('Food');
        const dropdownOption = foodButtons[1].closest('button');
        expect(dropdownOption).toHaveClass('text-blue-700');
      });
    });
  });

  describe('Exclusions', () => {
    it('should hide excluded categories from the dropdown', async () => {
      render(<SearchableCategoryDropdown {...defaultProps} excludeIds={['2', '3']} />);
      
      fireEvent.click(screen.getByRole('button'));
      
      await waitFor(() => {
        expect(screen.queryByText('Transport')).not.toBeInTheDocument();
        expect(screen.queryByText('Shopping')).not.toBeInTheDocument();
        expect(screen.getByText('Food')).toBeInTheDocument();
      });
    });

    it('should show currently selected category even if in excludeIds', async () => {
      render(<SearchableCategoryDropdown {...defaultProps} value="2" excludeIds={['2']} />);
      
      fireEvent.click(screen.getByRole('button'));
      
      // Transport is selected so it should still be visible
      await waitFor(() => {
        expect(screen.getAllByText('Transport').length).toBe(2); // Once in button, once in dropdown
      });
    });

    it('should only show available categories when some are excluded', async () => {
      const onChange = vi.fn();
      render(<SearchableCategoryDropdown {...defaultProps} onChange={onChange} excludeIds={['1', '3', '4']} />);
      
      fireEvent.click(screen.getByRole('button'));
      
      await waitFor(() => {
        // Only Transport (id: 2) and Utilities (id: 5) should be visible
        expect(screen.getByText('Transport')).toBeInTheDocument();
        expect(screen.getByText('Utilities')).toBeInTheDocument();
        expect(screen.queryByText('Food')).not.toBeInTheDocument();
        expect(screen.queryByText('Shopping')).not.toBeInTheDocument();
        expect(screen.queryByText('Entertainment')).not.toBeInTheDocument();
      });
    });
  });
});
