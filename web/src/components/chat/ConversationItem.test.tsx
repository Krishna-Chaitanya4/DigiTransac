import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConversationItem } from './ConversationItem';
import type { ConversationSummary } from '../../types/conversations';

// Mock the conversationService
vi.mock('../../services/conversationService', () => ({
  getDisplayName: (name: string | null, email: string) => name || email.split('@')[0],
  formatRelativeTime: (_dateString: string) => '5m',
}));

// Mock the presence context
vi.mock('../../context/PresenceContext', () => ({
  usePresence: () => ({
    isOnline: () => false,
  }),
}));

// Helper to create mock conversation
const createConversation = (overrides: Partial<ConversationSummary> = {}): ConversationSummary => ({
  counterpartyUserId: 'user-123',
  counterpartyEmail: 'john@example.com',
  counterpartyName: 'John Doe',
  lastActivityAt: new Date().toISOString(),
  lastMessagePreview: 'Hey there!',
  lastMessageType: 'Text',
  unreadCount: 0,
  totalSent: 0,
  totalReceived: 0,
  primaryCurrency: 'USD',
  isSelfChat: false,
  ...overrides,
});

describe('ConversationItem', () => {
  const mockOnClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Display name', () => {
    it('should display counterparty name when available', () => {
      render(
        <ConversationItem
          conversation={createConversation({ counterpartyName: 'Alice Smith' })}
          isSelected={false}
          onClick={mockOnClick}
        />
      );

      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    });

    it('should display email-based name when counterpartyName is null', () => {
      render(
        <ConversationItem
          conversation={createConversation({ counterpartyName: null, counterpartyEmail: 'bob@test.com' })}
          isSelected={false}
          onClick={mockOnClick}
        />
      );

      expect(screen.getByText('bob')).toBeInTheDocument();
    });

    it('should display "Personal" for self-chat', () => {
      render(
        <ConversationItem
          conversation={createConversation({ isSelfChat: true })}
          isSelected={false}
          onClick={mockOnClick}
        />
      );

      expect(screen.getByText('Personal')).toBeInTheDocument();
    });
  });

  describe('Avatar', () => {
    it('should show first letter of name in avatar for regular chat', () => {
      render(
        <ConversationItem
          conversation={createConversation({ counterpartyName: 'Mike' })}
          isSelected={false}
          onClick={mockOnClick}
        />
      );

      // Avatar should contain 'M'
      const avatar = screen.getByText('M');
      expect(avatar).toBeInTheDocument();
    });

    it('should show special icon for self-chat instead of letter', () => {
      const { container } = render(
        <ConversationItem
          conversation={createConversation({ isSelfChat: true })}
          isSelected={false}
          onClick={mockOnClick}
        />
      );

      // Self-chat has SVG icon, not letter
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('should use different gradient for self-chat avatar', () => {
      const { container } = render(
        <ConversationItem
          conversation={createConversation({ isSelfChat: true })}
          isSelected={false}
          onClick={mockOnClick}
        />
      );

      // Self-chat uses amber solid background
      const avatar = container.querySelector('.bg-amber-500');
      expect(avatar).toBeInTheDocument();
    });
  });

  describe('Last message preview', () => {
    it('should display last message preview', () => {
      render(
        <ConversationItem
          conversation={createConversation({ lastMessagePreview: 'See you tomorrow!' })}
          isSelected={false}
          onClick={mockOnClick}
        />
      );

      expect(screen.getByText('See you tomorrow!')).toBeInTheDocument();
    });

    it('should display "No messages yet" when no preview', () => {
      render(
        <ConversationItem
          conversation={createConversation({ lastMessagePreview: null })}
          isSelected={false}
          onClick={mockOnClick}
        />
      );

      expect(screen.getByText('No messages yet')).toBeInTheDocument();
    });
  });

  describe('Time display', () => {
    it('should display relative time', () => {
      render(
        <ConversationItem
          conversation={createConversation()}
          isSelected={false}
          onClick={mockOnClick}
        />
      );

      // Mock returns '5m'
      expect(screen.getByText('5m')).toBeInTheDocument();
    });
  });

  describe('Unread badge', () => {
    it('should display unread count when greater than 0', () => {
      render(
        <ConversationItem
          conversation={createConversation({ unreadCount: 3 })}
          isSelected={false}
          onClick={mockOnClick}
        />
      );

      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should display "9+" when unread count exceeds 9', () => {
      render(
        <ConversationItem
          conversation={createConversation({ unreadCount: 15 })}
          isSelected={false}
          onClick={mockOnClick}
        />
      );

      expect(screen.getByText('9+')).toBeInTheDocument();
    });

    it('should not display badge when unread count is 0', () => {
      render(
        <ConversationItem
          conversation={createConversation({ unreadCount: 0 })}
          isSelected={false}
          onClick={mockOnClick}
        />
      );

      // No badge element should exist
      expect(screen.queryByText('0')).not.toBeInTheDocument();
      expect(screen.queryByText('9+')).not.toBeInTheDocument();
    });
  });

  describe('Selection state', () => {
    it('should apply selected styling when isSelected is true', () => {
      const { container } = render(
        <ConversationItem
          conversation={createConversation()}
          isSelected={true}
          onClick={mockOnClick}
        />
      );

      const button = container.querySelector('button');
      expect(button).toHaveClass('bg-blue-50');
      expect(button).toHaveClass('border-r-2');
    });

    it('should not apply selected styling when isSelected is false', () => {
      const { container } = render(
        <ConversationItem
          conversation={createConversation()}
          isSelected={false}
          onClick={mockOnClick}
        />
      );

      const button = container.querySelector('button');
      expect(button).not.toHaveClass('bg-blue-50');
    });
  });

  describe('Click interaction', () => {
    it('should call onClick when clicked', () => {
      render(
        <ConversationItem
          conversation={createConversation()}
          isSelected={false}
          onClick={mockOnClick}
        />
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('should be accessible as a button', () => {
      render(
        <ConversationItem
          conversation={createConversation()}
          isSelected={false}
          onClick={mockOnClick}
        />
      );

      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });
});
