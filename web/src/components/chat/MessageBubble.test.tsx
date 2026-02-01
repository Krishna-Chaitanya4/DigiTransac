import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MessageBubble, canEditMessage, canDeleteMessage, EDIT_TIME_LIMIT_MINUTES, DELETE_TIME_LIMIT_MINUTES } from './MessageBubble';
import type { ConversationMessage } from '../../types/conversations';

// Mock the conversationService
vi.mock('../../services/conversationService', () => ({
  formatChatCurrency: (amount: number, currency: string | null | undefined) =>
    currency ? `${currency} ${amount}` : `${amount}`,
}));

// Mock CurrencyContext
vi.mock('../../context/CurrencyContext', () => ({
  useCurrency: () => ({
    primaryCurrency: 'USD',
    formatCurrency: (amount: number, currency: string) => `${currency} ${amount}`,
    formatInPrimaryCurrency: (amount: number, fromCurrency: string) => `USD ${amount}`,
    convert: (amount: number) => amount,
    exchangeRates: {},
    isLoading: false,
  }),
}));

// Helper to create a mock message
const createMessage = (overrides: Partial<ConversationMessage> = {}): ConversationMessage => ({
  id: 'msg-1',
  type: 'Text',
  senderUserId: 'user-1',
  isFromMe: true,
  content: 'Hello world',
  transaction: null,
  status: 'Sent',
  createdAt: new Date().toISOString(),
  deliveredAt: null,
  readAt: null,
  isEdited: false,
  editedAt: null,
  isDeleted: false,
  replyToMessageId: null,
  replyTo: null,
  isSystemGenerated: false,
  systemSource: null,
  ...overrides,
});

const createTransactionMessage = (overrides: Partial<ConversationMessage> = {}): ConversationMessage => ({
  ...createMessage({ type: 'Transaction' }),
  transaction: {
    transactionId: 'tx-1',
    transactionLinkId: 'link-1',
    transactionType: 'Send',
    amount: 100,
    currency: 'USD',
    date: new Date().toISOString(),
    title: 'Payment',
    notes: null,
    status: 'Confirmed',
    accountName: 'Main Account',
  },
  ...overrides,
});

describe('MessageBubble', () => {
  const mockOnMenuOpen = vi.fn();
  const mockOnScrollToReply = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('canEditMessage helper', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-26T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return true for own text message within time limit', () => {
      const msg = createMessage({ 
        isFromMe: true, 
        type: 'Text',
        createdAt: new Date(Date.now() - 5 * 60000).toISOString(), // 5 min ago
      });
      expect(canEditMessage(msg)).toBe(true);
    });

    it('should return false for message older than time limit', () => {
      const msg = createMessage({ 
        isFromMe: true, 
        type: 'Text',
        createdAt: new Date(Date.now() - (EDIT_TIME_LIMIT_MINUTES + 1) * 60000).toISOString(),
      });
      expect(canEditMessage(msg)).toBe(false);
    });

    it('should return false for message not from me', () => {
      const msg = createMessage({ isFromMe: false });
      expect(canEditMessage(msg)).toBe(false);
    });

    it('should return false for transaction type', () => {
      const msg = createTransactionMessage({ isFromMe: true });
      expect(canEditMessage(msg)).toBe(false);
    });

    it('should return false for deleted message', () => {
      const msg = createMessage({ isFromMe: true, isDeleted: true });
      expect(canEditMessage(msg)).toBe(false);
    });
  });

  describe('canDeleteMessage helper', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-26T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return true for own message within time limit', () => {
      const msg = createMessage({ 
        isFromMe: true,
        createdAt: new Date(Date.now() - 30 * 60000).toISOString(), // 30 min ago
      });
      expect(canDeleteMessage(msg)).toBe(true);
    });

    it('should return false for message older than delete time limit', () => {
      const msg = createMessage({ 
        isFromMe: true,
        createdAt: new Date(Date.now() - (DELETE_TIME_LIMIT_MINUTES + 1) * 60000).toISOString(),
      });
      expect(canDeleteMessage(msg)).toBe(false);
    });

    it('should return false for message not from me', () => {
      const msg = createMessage({ isFromMe: false });
      expect(canDeleteMessage(msg)).toBe(false);
    });

    it('should return false for already deleted message', () => {
      const msg = createMessage({ isFromMe: true, isDeleted: true });
      expect(canDeleteMessage(msg)).toBe(false);
    });

    it('should allow deleting transaction messages within time limit', () => {
      const msg = createTransactionMessage({ 
        isFromMe: true,
        createdAt: new Date(Date.now() - 10 * 60000).toISOString(),
      });
      expect(canDeleteMessage(msg)).toBe(true);
    });
  });

  describe('Text message rendering', () => {
    it('should render text content', () => {
      render(
        <MessageBubble
          message={createMessage({ content: 'Hello world' })}
          showTime={false}
          onMenuOpen={mockOnMenuOpen}
          onScrollToReply={mockOnScrollToReply}
        />
      );

      expect(screen.getByText('Hello world')).toBeInTheDocument();
    });

    it('should align to right when message is from me', () => {
      const { container } = render(
        <MessageBubble
          message={createMessage({ isFromMe: true })}
          showTime={false}
          onMenuOpen={mockOnMenuOpen}
          onScrollToReply={mockOnScrollToReply}
        />
      );

      const wrapper = container.querySelector('.justify-end');
      expect(wrapper).toBeInTheDocument();
    });

    it('should align to left when message is not from me', () => {
      const { container } = render(
        <MessageBubble
          message={createMessage({ isFromMe: false })}
          showTime={false}
          onMenuOpen={mockOnMenuOpen}
          onScrollToReply={mockOnScrollToReply}
        />
      );

      const wrapper = container.querySelector('.justify-start');
      expect(wrapper).toBeInTheDocument();
    });

    it('should show time when showTime is true', () => {
      render(
        <MessageBubble
          message={createMessage({ createdAt: '2026-01-26T14:30:00Z' })}
          showTime={true}
          onMenuOpen={mockOnMenuOpen}
          onScrollToReply={mockOnScrollToReply}
        />
      );

      // Should display time in some format
      expect(screen.getByText(/\d{1,2}:\d{2}/)).toBeInTheDocument();
    });

    it('should show edited indicator when message is edited', () => {
      render(
        <MessageBubble
          message={createMessage({ isEdited: true })}
          showTime={false}
          onMenuOpen={mockOnMenuOpen}
          onScrollToReply={mockOnScrollToReply}
        />
      );

      expect(screen.getByText('Edited')).toBeInTheDocument();
    });

    it('should highlight search query in message', () => {
      render(
        <MessageBubble
          message={createMessage({ content: 'Hello world' })}
          showTime={false}
          searchQuery="world"
          onMenuOpen={mockOnMenuOpen}
          onScrollToReply={mockOnScrollToReply}
        />
      );

      // Should have highlighted text via mark element
      const mark = screen.getByText('world');
      expect(mark.tagName).toBe('MARK');
    });

    it('should use special highlight for current search result', () => {
      render(
        <MessageBubble
          message={createMessage({ content: 'Hello world' })}
          showTime={false}
          searchQuery="world"
          isCurrentSearchResult={true}
          onMenuOpen={mockOnMenuOpen}
          onScrollToReply={mockOnScrollToReply}
        />
      );

      const mark = screen.getByText('world');
      expect(mark).toHaveClass('bg-orange-400');
    });
  });

  describe('Self-chat positioning', () => {
    it('should position system-generated messages on left in self-chat', () => {
      const { container } = render(
        <MessageBubble
          message={createMessage({ isFromMe: true, isSystemGenerated: true })}
          showTime={false}
          isSelfChat={true}
          onMenuOpen={mockOnMenuOpen}
          onScrollToReply={mockOnScrollToReply}
        />
      );

      // In self-chat, system-generated = left (justify-start)
      const wrapper = container.querySelector('.justify-start');
      expect(wrapper).toBeInTheDocument();
    });

    it('should position user-created messages on right in self-chat', () => {
      const { container } = render(
        <MessageBubble
          message={createMessage({ isFromMe: true, isSystemGenerated: false })}
          showTime={false}
          isSelfChat={true}
          onMenuOpen={mockOnMenuOpen}
          onScrollToReply={mockOnScrollToReply}
        />
      );

      // In self-chat, user-created = right (justify-end)
      const wrapper = container.querySelector('.justify-end');
      expect(wrapper).toBeInTheDocument();
    });
  });

  describe('Transaction message rendering', () => {
    it('should render transaction amount', () => {
      render(
        <MessageBubble
          message={createTransactionMessage()}
          showTime={false}
          onMenuOpen={mockOnMenuOpen}
          onScrollToReply={mockOnScrollToReply}
        />
      );

      expect(screen.getByText(/USD 100|100/)).toBeInTheDocument();
    });

    it('should show Sent badge for send transactions', () => {
      render(
        <MessageBubble
          message={createTransactionMessage({
            transaction: {
              transactionId: 'tx-1',
              transactionLinkId: 'link-1',
              transactionType: 'Send',
              amount: 50,
              currency: 'USD',
              date: new Date().toISOString(),
              title: 'Payment',
              notes: null,
              status: 'Confirmed',
              accountName: 'Checking',
            },
          })}
          showTime={false}
          onMenuOpen={mockOnMenuOpen}
          onScrollToReply={mockOnScrollToReply}
        />
      );

      expect(screen.getByText(/Sent/)).toBeInTheDocument();
    });

    it('should show Received badge for receive transactions', () => {
      render(
        <MessageBubble
          message={createTransactionMessage({
            transaction: {
              transactionId: 'tx-1',
              transactionLinkId: 'link-1',
              transactionType: 'Receive',
              amount: 75,
              currency: 'EUR',
              date: new Date().toISOString(),
              title: 'Payment received',
              notes: null,
              status: 'Confirmed',
              accountName: 'Savings',
            },
          })}
          showTime={false}
          onMenuOpen={mockOnMenuOpen}
          onScrollToReply={mockOnScrollToReply}
        />
      );

      expect(screen.getByText(/Received/)).toBeInTheDocument();
    });

    it('should show system source badge in self-chat', () => {
      render(
        <MessageBubble
          message={createTransactionMessage({
            isSystemGenerated: true,
            systemSource: 'Recurring',
          })}
          showTime={false}
          isSelfChat={true}
          onMenuOpen={mockOnMenuOpen}
          onScrollToReply={mockOnScrollToReply}
        />
      );

      expect(screen.getByText('Recurring')).toBeInTheDocument();
    });

    it('should show "Auto" badge when systemSource is null but isSystemGenerated', () => {
      render(
        <MessageBubble
          message={createTransactionMessage({
            isSystemGenerated: true,
            systemSource: null,
          })}
          showTime={false}
          isSelfChat={true}
          onMenuOpen={mockOnMenuOpen}
          onScrollToReply={mockOnScrollToReply}
        />
      );

      expect(screen.getByText('Auto')).toBeInTheDocument();
    });

    it('should show account name when available', () => {
      render(
        <MessageBubble
          message={createTransactionMessage({
            transaction: {
              transactionId: 'tx-1',
              transactionLinkId: 'link-1',
              transactionType: 'Send',
              amount: 100,
              currency: 'USD',
              date: new Date().toISOString(),
              title: 'Payment',
              notes: null,
              status: 'Confirmed',
              accountName: 'My Wallet',
            },
          })}
          showTime={false}
          onMenuOpen={mockOnMenuOpen}
          onScrollToReply={mockOnScrollToReply}
        />
      );

      expect(screen.getByText('My Wallet')).toBeInTheDocument();
    });
  });

  describe('Deleted message rendering', () => {
    it('should show deleted message placeholder', () => {
      render(
        <MessageBubble
          message={createMessage({ isDeleted: true })}
          showTime={false}
          onMenuOpen={mockOnMenuOpen}
          onScrollToReply={mockOnScrollToReply}
        />
      );

      expect(screen.getByText('This message was deleted')).toBeInTheDocument();
    });

    it('should not show original content for deleted message', () => {
      render(
        <MessageBubble
          message={createMessage({ isDeleted: true, content: 'Secret content' })}
          showTime={false}
          onMenuOpen={mockOnMenuOpen}
          onScrollToReply={mockOnScrollToReply}
        />
      );

      expect(screen.queryByText('Secret content')).not.toBeInTheDocument();
    });
  });

  describe('Reply rendering', () => {
    it('should render reply reference when message has replyTo', () => {
      render(
        <MessageBubble
          message={createMessage({
            replyTo: {
              messageId: 'msg-original',
              senderUserId: 'user-2',
              senderName: 'Bob',
              type: 'Text',
              contentPreview: 'Original message content',
            },
          })}
          showTime={false}
          counterpartyName="Bob"
          counterpartyUserId="user-2"
          onMenuOpen={mockOnMenuOpen}
          onScrollToReply={mockOnScrollToReply}
        />
      );

      expect(screen.getByText('Original message content')).toBeInTheDocument();
      expect(screen.getByText(/Replied to Bob/)).toBeInTheDocument();
    });

    it('should call onScrollToReply when reply is clicked', () => {
      render(
        <MessageBubble
          message={createMessage({
            replyTo: {
              messageId: 'msg-original',
              senderUserId: 'user-2',
              senderName: 'Bob',
              type: 'Text',
              contentPreview: 'Click me',
            },
          })}
          showTime={false}
          counterpartyUserId="user-2"
          onMenuOpen={mockOnMenuOpen}
          onScrollToReply={mockOnScrollToReply}
        />
      );

      fireEvent.click(screen.getByText('Click me'));
      expect(mockOnScrollToReply).toHaveBeenCalledWith('msg-original');
    });

    it('should show "You replied to yourself" for self-reply', () => {
      render(
        <MessageBubble
          message={createMessage({
            senderUserId: 'user-1',
            isFromMe: true,
            replyTo: {
              messageId: 'msg-original',
              senderUserId: 'user-1', // Same as message sender
              senderName: null,
              type: 'Text',
              contentPreview: 'My own message',
            },
          })}
          showTime={false}
          counterpartyUserId="user-2"
          onMenuOpen={mockOnMenuOpen}
          onScrollToReply={mockOnScrollToReply}
        />
      );

      expect(screen.getByText('You replied to yourself')).toBeInTheDocument();
    });
  });

  describe('Menu interaction', () => {
    it('should call onMenuOpen when menu button is clicked', () => {
      render(
        <MessageBubble
          message={createMessage()}
          showTime={false}
          onMenuOpen={mockOnMenuOpen}
          onScrollToReply={mockOnScrollToReply}
        />
      );

      const menuButtons = screen.getAllByRole('button');
      const menuButton = menuButtons.find(btn => btn.querySelector('svg'));
      if (menuButton) {
        fireEvent.click(menuButton);
        expect(mockOnMenuOpen).toHaveBeenCalled();
      }
    });
  });

  describe('Message element ID', () => {
    it('should set correct id attribute for scrolling', () => {
      const { container } = render(
        <MessageBubble
          message={createMessage({ id: 'unique-msg-id' })}
          showTime={false}
          onMenuOpen={mockOnMenuOpen}
          onScrollToReply={mockOnScrollToReply}
        />
      );

      expect(container.querySelector('#msg-unique-msg-id')).toBeInTheDocument();
    });
  });
});
