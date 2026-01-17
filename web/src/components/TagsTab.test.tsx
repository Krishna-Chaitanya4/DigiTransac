import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderWithRouter, userEvent } from '../test/test-utils';
import TagsTab from './TagsTab';
import * as tagService from '../services/tagService';
import { Tag } from '../types/labels';

// Mock the tag service
vi.mock('../services/tagService', () => ({
  getTags: vi.fn(),
  createTag: vi.fn(),
  updateTag: vi.fn(),
  deleteTag: vi.fn(),
}));

// Sample test data
const mockTags: Tag[] = [
  { id: '1', name: 'Tax Deductible', color: '#22c55e', createdAt: '2025-01-01' },
  { id: '2', name: 'Vacation', color: '#3b82f6', createdAt: '2025-01-01' },
  { id: '3', name: 'Business', color: '#ef4444', createdAt: '2025-01-01' },
  { id: '4', name: 'Personal', color: null, createdAt: '2025-01-01' },
];

describe('TagsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(tagService.getTags).mockResolvedValue(mockTags);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial render', () => {
    it('should load and display tags', async () => {
      // Act
      renderWithRouter(<TagsTab />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Tax Deductible')).toBeInTheDocument();
      });
      expect(screen.getByText('Vacation')).toBeInTheDocument();
      expect(screen.getByText('Business')).toBeInTheDocument();
      expect(screen.getByText('Personal')).toBeInTheDocument();
    });

    it('should display loading spinner initially', () => {
      // Arrange
      vi.mocked(tagService.getTags).mockImplementation(() => new Promise(() => {}));

      // Act
      renderWithRouter(<TagsTab />);

      // Assert
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('should display error message on load failure', async () => {
      // Arrange
      vi.mocked(tagService.getTags).mockRejectedValue(new Error('Network error'));

      // Act
      renderWithRouter(<TagsTab />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('should display description text', async () => {
      // Act
      renderWithRouter(<TagsTab />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Add flexible tags to any transaction')).toBeInTheDocument();
      });
    });
  });

  describe('empty state', () => {
    it('should show empty state when no tags exist', async () => {
      // Arrange
      vi.mocked(tagService.getTags).mockResolvedValue([]);

      // Act
      renderWithRouter(<TagsTab />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('No tags yet')).toBeInTheDocument();
      });
      expect(screen.getByText('Create First Tag')).toBeInTheDocument();
    });

    it('should open modal when clicking Create First Tag in empty state', async () => {
      // Arrange
      const user = userEvent.setup();
      vi.mocked(tagService.getTags).mockResolvedValue([]);

      renderWithRouter(<TagsTab />);

      await waitFor(() => {
        expect(screen.getByText('Create First Tag')).toBeInTheDocument();
      });

      // Act
      await user.click(screen.getByText('Create First Tag'));

      // Assert
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'New Tag' })).toBeInTheDocument();
      });
    });
  });

  describe('search functionality', () => {
    it('should filter tags when searching', async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithRouter(<TagsTab />);

      await waitFor(() => {
        expect(screen.getByText('Tax Deductible')).toBeInTheDocument();
      });

      // Act
      const searchInput = screen.getByPlaceholderText('Search tags...');
      await user.type(searchInput, 'Tax');

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Tax Deductible')).toBeInTheDocument();
      });
      expect(screen.queryByText('Vacation')).not.toBeInTheDocument();
      expect(screen.queryByText('Business')).not.toBeInTheDocument();
    });

    it('should show no results message for non-matching search', async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithRouter(<TagsTab />);

      await waitFor(() => {
        expect(screen.getByText('Tax Deductible')).toBeInTheDocument();
      });

      // Act
      const searchInput = screen.getByPlaceholderText('Search tags...');
      await user.type(searchInput, 'NonExistent');

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/No tags found/)).toBeInTheDocument();
      });
    });

    it('should clear search when clicking clear button', async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithRouter(<TagsTab />);

      await waitFor(() => {
        expect(screen.getByText('Tax Deductible')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search tags...');
      await user.type(searchInput, 'Tax');

      await waitFor(() => {
        expect(screen.queryByText('Vacation')).not.toBeInTheDocument();
      });

      // Act - click clear button
      const clearButton = searchInput.parentElement?.querySelector('button');
      if (clearButton) {
        await user.click(clearButton);
      }

      // Assert - all tags should be visible again
      await waitFor(() => {
        expect(screen.getByText('Vacation')).toBeInTheDocument();
      });
    });

    it('should not show search bar when no tags exist', async () => {
      // Arrange
      vi.mocked(tagService.getTags).mockResolvedValue([]);

      // Act
      renderWithRouter(<TagsTab />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('No tags yet')).toBeInTheDocument();
      });
      expect(screen.queryByPlaceholderText('Search tags...')).not.toBeInTheDocument();
    });
  });

  describe('create tag modal', () => {
    it('should open modal when clicking New Tag button', async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithRouter(<TagsTab />);

      await waitFor(() => {
        expect(screen.getByText('Tax Deductible')).toBeInTheDocument();
      });

      // Act
      await user.click(screen.getByText('New Tag'));

      // Assert
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'New Tag' })).toBeInTheDocument();
      });
    });

    it('should show color picker with preset colors', async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithRouter(<TagsTab />);

      await waitFor(() => {
        expect(screen.getByText('Tax Deductible')).toBeInTheDocument();
      });

      // Open modal
      await user.click(screen.getByText('New Tag'));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'New Tag' })).toBeInTheDocument();
      });

      // Assert - color section should be visible
      expect(screen.getByText('Color')).toBeInTheDocument();
    });

    it('should create tag when submitting form', async () => {
      // Arrange
      const user = userEvent.setup();
      vi.mocked(tagService.createTag).mockResolvedValue({
        id: '5', name: 'New Test Tag', color: '#ef4444', createdAt: '2025-01-01'
      });

      renderWithRouter(<TagsTab />);

      await waitFor(() => {
        expect(screen.getByText('Tax Deductible')).toBeInTheDocument();
      });

      // Open modal
      await user.click(screen.getByText('New Tag'));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'New Tag' })).toBeInTheDocument();
      });

      // Fill form
      await user.type(screen.getByPlaceholderText(/vacation/i), 'New Test Tag');

      // Act
      await user.click(screen.getByRole('button', { name: /create/i }));

      // Assert
      await waitFor(() => {
        expect(tagService.createTag).toHaveBeenCalledWith(expect.objectContaining({
          name: 'New Test Tag',
        }));
      });
    });

    it('should close modal when clicking Cancel', async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithRouter(<TagsTab />);

      await waitFor(() => {
        expect(screen.getByText('Tax Deductible')).toBeInTheDocument();
      });

      // Open modal
      await user.click(screen.getByText('New Tag'));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'New Tag' })).toBeInTheDocument();
      });

      // Act
      await user.click(screen.getByRole('button', { name: /cancel/i }));

      // Assert
      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: 'New Tag' })).not.toBeInTheDocument();
      });
    });

    it('should disable Create button when name is empty', async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithRouter(<TagsTab />);

      await waitFor(() => {
        expect(screen.getByText('Tax Deductible')).toBeInTheDocument();
      });

      // Open modal
      await user.click(screen.getByText('New Tag'));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'New Tag' })).toBeInTheDocument();
      });

      // Assert
      expect(screen.getByRole('button', { name: /create/i })).toBeDisabled();
    });
  });

  describe('edit tag', () => {
    it('should open edit modal with pre-filled values', async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithRouter(<TagsTab />);

      await waitFor(() => {
        expect(screen.getByText('Tax Deductible')).toBeInTheDocument();
      });

      // Get the tag pill container and hover to show edit button
      const tagPill = screen.getByText('Tax Deductible').closest('div.inline-flex');
      expect(tagPill).toBeInTheDocument();

      // Act - click edit button (revealed on hover via CSS, but accessible in DOM)
      const editButtons = tagPill?.querySelectorAll('button');
      const editButton = editButtons?.[0]; // First button is edit
      if (editButton) {
        await user.click(editButton);
      }

      // Assert
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Edit Tag' })).toBeInTheDocument();
      });
      expect(screen.getByDisplayValue('Tax Deductible')).toBeInTheDocument();
    });

    it('should update tag when submitting edit form', async () => {
      // Arrange
      const user = userEvent.setup();
      vi.mocked(tagService.updateTag).mockResolvedValue({
        id: '1', name: 'Updated Tag', color: '#22c55e', createdAt: '2025-01-01'
      });

      renderWithRouter(<TagsTab />);

      await waitFor(() => {
        expect(screen.getByText('Tax Deductible')).toBeInTheDocument();
      });

      // Get the tag pill and click edit
      const tagPill = screen.getByText('Tax Deductible').closest('div.inline-flex');
      const editButton = tagPill?.querySelector('button');
      if (editButton) {
        await user.click(editButton);
      }

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Edit Tag' })).toBeInTheDocument();
      });

      // Clear and update name
      const nameInput = screen.getByDisplayValue('Tax Deductible');
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Tag');

      // Act
      await user.click(screen.getByRole('button', { name: /update/i }));

      // Assert
      await waitFor(() => {
        expect(tagService.updateTag).toHaveBeenCalledWith('1', expect.objectContaining({
          name: 'Updated Tag',
        }));
      });
    });
  });

  describe('delete tag', () => {
    it('should open delete confirmation modal', async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithRouter(<TagsTab />);

      await waitFor(() => {
        expect(screen.getByText('Tax Deductible')).toBeInTheDocument();
      });

      // Get the tag pill and click delete button
      const tagPill = screen.getByText('Tax Deductible').closest('div.inline-flex');
      const buttons = tagPill?.querySelectorAll('button');
      const deleteButton = buttons?.[1]; // Second button is delete
      if (deleteButton) {
        await user.click(deleteButton);
      }

      // Assert
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Delete Tag' })).toBeInTheDocument();
      });
      expect(screen.getByText(/Are you sure you want to delete "Tax Deductible"/)).toBeInTheDocument();
    });

    it('should delete tag when confirming', async () => {
      // Arrange
      const user = userEvent.setup();
      vi.mocked(tagService.deleteTag).mockResolvedValue(undefined);

      renderWithRouter(<TagsTab />);

      await waitFor(() => {
        expect(screen.getByText('Tax Deductible')).toBeInTheDocument();
      });

      // Open delete modal
      const tagPill = screen.getByText('Tax Deductible').closest('div.inline-flex');
      const buttons = tagPill?.querySelectorAll('button');
      const deleteButton = buttons?.[1];
      if (deleteButton) {
        await user.click(deleteButton);
      }

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Delete Tag' })).toBeInTheDocument();
      });

      // Act - find the Delete button in the modal (by looking at the modal dialog)
      const modal = screen.getByRole('heading', { name: 'Delete Tag' }).closest('.relative') as HTMLElement;
      const confirmButton = within(modal).getByRole('button', { name: 'Delete' });
      await user.click(confirmButton);

      // Assert
      await waitFor(() => {
        expect(tagService.deleteTag).toHaveBeenCalledWith('1');
      });
    });

    it('should close delete modal when clicking Cancel', async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithRouter(<TagsTab />);

      await waitFor(() => {
        expect(screen.getByText('Tax Deductible')).toBeInTheDocument();
      });

      // Open delete modal
      const tagPill = screen.getByText('Tax Deductible').closest('div.inline-flex');
      const buttons = tagPill?.querySelectorAll('button');
      const deleteButton = buttons?.[1];
      if (deleteButton) {
        await user.click(deleteButton);
      }

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Delete Tag' })).toBeInTheDocument();
      });

      // Act
      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      // Assert
      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: 'Delete Tag' })).not.toBeInTheDocument();
      });
    });
  });

  describe('tag display', () => {
    it('should display color indicator for tags with color', async () => {
      // Act
      renderWithRouter(<TagsTab />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Tax Deductible')).toBeInTheDocument();
      });

      // Check for color indicator (colored span next to tag name)
      const tagPill = screen.getByText('Tax Deductible').closest('div.inline-flex');
      const colorIndicator = tagPill?.querySelector('span.rounded-full');
      expect(colorIndicator).toBeInTheDocument();
      expect(colorIndicator).toHaveStyle({ backgroundColor: '#22c55e' });
    });

    it('should not display color indicator for tags without color', async () => {
      // Act
      renderWithRouter(<TagsTab />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Personal')).toBeInTheDocument();
      });

      // Tag without color should not have color indicator
      const tagPill = screen.getByText('Personal').closest('div.inline-flex');
      const colorIndicator = tagPill?.querySelector('span.rounded-full');
      expect(colorIndicator).not.toBeInTheDocument();
    });
  });
});
