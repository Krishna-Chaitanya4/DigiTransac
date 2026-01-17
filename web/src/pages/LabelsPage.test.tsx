import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithRouter, userEvent } from '../test/test-utils';
import LabelsPage from './LabelsPage';

// Mock the child components
vi.mock('../components/CategoriesTab', () => ({
  default: () => <div data-testid="categories-tab">Categories Tab Content</div>,
}));

vi.mock('../components/TagsTab', () => ({
  default: () => <div data-testid="tags-tab">Tags Tab Content</div>,
}));

describe('LabelsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('rendering', () => {
    it('should render page title', () => {
      // Act
      renderWithRouter(<LabelsPage />);

      // Assert
      expect(screen.getByRole('heading', { name: 'Labels' })).toBeInTheDocument();
    });

    it('should render Categories and Tags tabs', () => {
      // Act
      renderWithRouter(<LabelsPage />);

      // Assert
      expect(screen.getByRole('button', { name: 'Categories' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Tags' })).toBeInTheDocument();
    });

    it('should show Categories tab as active by default', () => {
      // Act
      renderWithRouter(<LabelsPage />);

      // Assert
      const categoriesButton = screen.getByRole('button', { name: 'Categories' });
      const tagsButton = screen.getByRole('button', { name: 'Tags' });
      
      expect(categoriesButton).toHaveClass('border-blue-500', 'text-blue-600');
      expect(tagsButton).toHaveClass('border-transparent', 'text-gray-500');
    });

    it('should render CategoriesTab content by default', () => {
      // Act
      renderWithRouter(<LabelsPage />);

      // Assert
      expect(screen.getByTestId('categories-tab')).toBeInTheDocument();
      expect(screen.queryByTestId('tags-tab')).not.toBeInTheDocument();
    });
  });

  describe('tab switching', () => {
    it('should switch to Tags tab when clicked', async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithRouter(<LabelsPage />);

      // Act
      await user.click(screen.getByRole('button', { name: 'Tags' }));

      // Assert
      await waitFor(() => {
        expect(screen.getByTestId('tags-tab')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('categories-tab')).not.toBeInTheDocument();
    });

    it('should show Tags tab as active after clicking', async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithRouter(<LabelsPage />);

      // Act
      await user.click(screen.getByRole('button', { name: 'Tags' }));

      // Assert
      const categoriesButton = screen.getByRole('button', { name: 'Categories' });
      const tagsButton = screen.getByRole('button', { name: 'Tags' });
      
      await waitFor(() => {
        expect(tagsButton).toHaveClass('border-blue-500', 'text-blue-600');
      });
      expect(categoriesButton).toHaveClass('border-transparent', 'text-gray-500');
    });

    it('should switch back to Categories tab when clicked', async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithRouter(<LabelsPage />);

      // Act - Switch to Tags first
      await user.click(screen.getByRole('button', { name: 'Tags' }));
      await waitFor(() => {
        expect(screen.getByTestId('tags-tab')).toBeInTheDocument();
      });

      // Act - Switch back to Categories
      await user.click(screen.getByRole('button', { name: 'Categories' }));

      // Assert
      await waitFor(() => {
        expect(screen.getByTestId('categories-tab')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('tags-tab')).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have accessible tab navigation', () => {
      // Act
      renderWithRouter(<LabelsPage />);

      // Assert
      const nav = screen.getByRole('navigation');
      expect(nav).toBeInTheDocument();
      
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(2);
    });
  });
});
