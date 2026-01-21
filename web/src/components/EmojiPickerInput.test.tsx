import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EmojiPickerInput } from './EmojiPickerInput';
import { ThemeProvider } from '../context/ThemeContext';

// Mock emoji-picker-react
vi.mock('emoji-picker-react', () => ({
  default: ({ onEmojiClick }: { onEmojiClick: (data: { emoji: string }) => void }) => (
    <div data-testid="emoji-picker">
      <button 
        data-testid="emoji-pizza" 
        onClick={() => onEmojiClick({ emoji: '🍕' })}
      >
        🍕
      </button>
      <button 
        data-testid="emoji-car" 
        onClick={() => onEmojiClick({ emoji: '🚗' })}
      >
        🚗
      </button>
    </div>
  ),
  Theme: { LIGHT: 'light', DARK: 'dark' },
}));

// Helper to render with ThemeProvider
const renderWithTheme = (ui: React.ReactElement) => {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
};

describe('EmojiPickerInput', () => {
  const defaultProps = {
    value: '',
    onChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render with placeholder when no value', () => {
      renderWithTheme(<EmojiPickerInput {...defaultProps} placeholder="Select an emoji" />);
      expect(screen.getByText('Select an emoji')).toBeInTheDocument();
    });

    it('should render with label when provided', () => {
      renderWithTheme(<EmojiPickerInput {...defaultProps} label="Icon" id="icon-input" />);
      expect(screen.getByText('Icon')).toBeInTheDocument();
    });

    it('should display the selected emoji value', () => {
      renderWithTheme(<EmojiPickerInput {...defaultProps} value="🍕" />);
      expect(screen.getByText('🍕')).toBeInTheDocument();
    });

    it('should show clear button when value is set', () => {
      renderWithTheme(<EmojiPickerInput {...defaultProps} value="🍕" />);
      expect(screen.getByTitle('Clear')).toBeInTheDocument();
    });

    it('should not show clear button when value is empty', () => {
      renderWithTheme(<EmojiPickerInput {...defaultProps} value="" />);
      expect(screen.queryByTitle('Clear')).not.toBeInTheDocument();
    });
  });

  describe('Picker Interaction', () => {
    it('should open emoji picker when button is clicked', async () => {
      renderWithTheme(<EmojiPickerInput {...defaultProps} placeholder="Select" />);
      
      const button = screen.getByRole('button', { name: /select/i });
      fireEvent.click(button);
      
      await waitFor(() => {
        expect(screen.getByTestId('emoji-picker')).toBeInTheDocument();
      });
    });

    it('should close emoji picker when clicking again', async () => {
      renderWithTheme(<EmojiPickerInput {...defaultProps} placeholder="Select" />);
      
      const button = screen.getByRole('button', { name: /select/i });
      
      // Open
      fireEvent.click(button);
      await waitFor(() => {
        expect(screen.getByTestId('emoji-picker')).toBeInTheDocument();
      });
      
      // Close
      fireEvent.click(button);
      await waitFor(() => {
        expect(screen.queryByTestId('emoji-picker')).not.toBeInTheDocument();
      });
    });

    it('should call onChange when emoji is selected', async () => {
      const onChange = vi.fn();
      renderWithTheme(<EmojiPickerInput {...defaultProps} onChange={onChange} placeholder="Select" />);
      
      // Open picker
      const button = screen.getByRole('button', { name: /select/i });
      fireEvent.click(button);
      
      // Click an emoji
      await waitFor(() => {
        const pizzaEmoji = screen.getByTestId('emoji-pizza');
        fireEvent.click(pizzaEmoji);
      });
      
      expect(onChange).toHaveBeenCalledWith('🍕');
    });

    it('should close picker after emoji selection', async () => {
      renderWithTheme(<EmojiPickerInput {...defaultProps} placeholder="Select" />);
      
      // Open picker
      const button = screen.getByRole('button', { name: /select/i });
      fireEvent.click(button);
      
      await waitFor(() => {
        expect(screen.getByTestId('emoji-picker')).toBeInTheDocument();
      });
      
      // Click an emoji
      const pizzaEmoji = screen.getByTestId('emoji-pizza');
      fireEvent.click(pizzaEmoji);
      
      await waitFor(() => {
        expect(screen.queryByTestId('emoji-picker')).not.toBeInTheDocument();
      });
    });
  });

  describe('Clear Functionality', () => {
    it('should call onChange with empty string when clear is clicked', async () => {
      const onChange = vi.fn();
      renderWithTheme(<EmojiPickerInput {...defaultProps} value="🍕" onChange={onChange} />);
      
      const clearButton = screen.getByTitle('Clear');
      fireEvent.click(clearButton);
      
      expect(onChange).toHaveBeenCalledWith('');
    });

    it('should not open picker when clear is clicked', async () => {
      renderWithTheme(<EmojiPickerInput {...defaultProps} value="🍕" />);
      
      const clearButton = screen.getByTitle('Clear');
      fireEvent.click(clearButton);
      
      // Picker should not be visible
      expect(screen.queryByTestId('emoji-picker')).not.toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should close picker on Escape key', async () => {
      renderWithTheme(<EmojiPickerInput {...defaultProps} placeholder="Select" />);
      
      // Open picker
      const button = screen.getByRole('button', { name: /select/i });
      fireEvent.click(button);
      
      await waitFor(() => {
        expect(screen.getByTestId('emoji-picker')).toBeInTheDocument();
      });
      
      // Press Escape
      fireEvent.keyDown(document, { key: 'Escape' });
      
      await waitFor(() => {
        expect(screen.queryByTestId('emoji-picker')).not.toBeInTheDocument();
      });
    });
  });

  describe('Click Outside', () => {
    it('should close picker when clicking outside', async () => {
      renderWithTheme(
        <div>
          <EmojiPickerInput {...defaultProps} placeholder="Select" />
          <div data-testid="outside">Outside element</div>
        </div>
      );
      
      // Open picker
      const button = screen.getByRole('button', { name: /select/i });
      fireEvent.click(button);
      
      await waitFor(() => {
        expect(screen.getByTestId('emoji-picker')).toBeInTheDocument();
      });
      
      // Click outside
      const outsideElement = screen.getByTestId('outside');
      fireEvent.mouseDown(outsideElement);
      
      await waitFor(() => {
        expect(screen.queryByTestId('emoji-picker')).not.toBeInTheDocument();
      });
    });
  });

  describe('Different Emoji Selection', () => {
    it('should handle selecting different emojis', async () => {
      const onChange = vi.fn();
      renderWithTheme(<EmojiPickerInput {...defaultProps} onChange={onChange} placeholder="Select" />);
      
      // Open picker
      const button = screen.getByRole('button', { name: /select/i });
      fireEvent.click(button);
      
      // Click car emoji
      await waitFor(() => {
        const carEmoji = screen.getByTestId('emoji-car');
        fireEvent.click(carEmoji);
      });
      
      expect(onChange).toHaveBeenCalledWith('🚗');
    });
  });
});
