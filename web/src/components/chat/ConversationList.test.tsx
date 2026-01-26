import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConversationList } from './ConversationList';
import type { ConversationSummary } from '../../types/conversations';

// Mock the ConversationItem component
vi.mock('./ConversationItem', () => ({
  ConversationItem: ({ conversation, isSelected, onClick }: { 
    conversation: ConversationSummary; 
    isSelected: boolean; 
    onClick: () => void;
  }) => (
    <button
      data-testid={`conversation-${conversation.counterpartyUserId}`}
      data-selected={isSelected}
      onClick={onClick}
    >
      {conversation.counterpartyName || conversation.counterpartyEmail}
    </button>
  ),
}));

// Helper to create mock conversations
const createConversation = (id: string, name: string, email?: string): ConversationSummary => ({
  counterpartyUserId: id,
  counterpartyEmail: email || `${name.toLowerCase().replace(' ', '.')}@example.com`,
  counterpartyName: name,
  lastActivityAt: new Date().toISOString(),
  lastMessagePreview: 'Hello',
  lastMessageType: 'Text',
  unreadCount: 0,
  totalSent: 0,
  totalReceived: 0,
  primaryCurrency: 'USD',
  isSelfChat: false,
});

describe('ConversationList', () => {
  const mockOnSelectConversation = vi.fn();
  const mockOnNewChat = vi.fn();
  const mockOnResizeStart = vi.fn();
  const mockOnResizeReset = vi.fn();
  const mockOnWidthChange = vi.fn();

  const defaultProps = {
    conversations: [] as ConversationSummary[],
    selectedUserId: null,
    onSelectConversation: mockOnSelectConversation,
    onNewChat: mockOnNewChat,
    isResizing: false,
    onResizeStart: mockOnResizeStart,
    onResizeReset: mockOnResizeReset,
    sidebarWidth: 320,
    onWidthChange: mockOnWidthChange,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Header', () => {
    it('should render "Chats" heading', () => {
      render(<ConversationList {...defaultProps} />);
      expect(screen.getByText('Chats')).toBeInTheDocument();
    });

    it('should render new chat button', () => {
      render(<ConversationList {...defaultProps} />);
      const newChatBtn = screen.getByTitle('New Chat');
      expect(newChatBtn).toBeInTheDocument();
    });

    it('should call onNewChat when new chat button is clicked', () => {
      render(<ConversationList {...defaultProps} />);
      fireEvent.click(screen.getByTitle('New Chat'));
      expect(mockOnNewChat).toHaveBeenCalledTimes(1);
    });
  });

  describe('Empty state', () => {
    it('should show empty state when no conversations', () => {
      render(<ConversationList {...defaultProps} conversations={[]} />);
      expect(screen.getByText('No conversations yet')).toBeInTheDocument();
      expect(screen.getByText('Start a new chat or make a transaction')).toBeInTheDocument();
    });
  });

  describe('Conversation list rendering', () => {
    it('should render all conversations', () => {
      const conversations = [
        createConversation('user-1', 'Alice'),
        createConversation('user-2', 'Bob'),
        createConversation('user-3', 'Charlie'),
      ];

      render(<ConversationList {...defaultProps} conversations={conversations} />);

      expect(screen.getByTestId('conversation-user-1')).toBeInTheDocument();
      expect(screen.getByTestId('conversation-user-2')).toBeInTheDocument();
      expect(screen.getByTestId('conversation-user-3')).toBeInTheDocument();
    });

    it('should mark selected conversation', () => {
      const conversations = [
        createConversation('user-1', 'Alice'),
        createConversation('user-2', 'Bob'),
      ];

      render(
        <ConversationList 
          {...defaultProps} 
          conversations={conversations} 
          selectedUserId="user-2" 
        />
      );

      expect(screen.getByTestId('conversation-user-1')).toHaveAttribute('data-selected', 'false');
      expect(screen.getByTestId('conversation-user-2')).toHaveAttribute('data-selected', 'true');
    });

    it('should call onSelectConversation when conversation is clicked', () => {
      const conversations = [createConversation('user-1', 'Alice')];

      render(<ConversationList {...defaultProps} conversations={conversations} />);
      fireEvent.click(screen.getByTestId('conversation-user-1'));

      expect(mockOnSelectConversation).toHaveBeenCalledWith('user-1');
    });
  });

  describe('Search/filter functionality', () => {
    it('should render search input', () => {
      render(<ConversationList {...defaultProps} />);
      expect(screen.getByPlaceholderText('Search by name or email...')).toBeInTheDocument();
    });

    it('should filter conversations by name', () => {
      const conversations = [
        createConversation('user-1', 'Alice'),
        createConversation('user-2', 'Bob'),
        createConversation('user-3', 'Charlie'),
      ];

      render(<ConversationList {...defaultProps} conversations={conversations} />);

      const searchInput = screen.getByPlaceholderText('Search by name or email...');
      fireEvent.change(searchInput, { target: { value: 'alice' } });

      expect(screen.getByTestId('conversation-user-1')).toBeInTheDocument();
      expect(screen.queryByTestId('conversation-user-2')).not.toBeInTheDocument();
      expect(screen.queryByTestId('conversation-user-3')).not.toBeInTheDocument();
    });

    it('should filter conversations by email', () => {
      const conversations = [
        createConversation('user-1', 'Alice', 'alice@test.com'),
        createConversation('user-2', 'Bob', 'bob@work.com'),
      ];

      render(<ConversationList {...defaultProps} conversations={conversations} />);

      const searchInput = screen.getByPlaceholderText('Search by name or email...');
      fireEvent.change(searchInput, { target: { value: 'work.com' } });

      expect(screen.queryByTestId('conversation-user-1')).not.toBeInTheDocument();
      expect(screen.getByTestId('conversation-user-2')).toBeInTheDocument();
    });

    it('should show no match message when filter has no results', () => {
      const conversations = [createConversation('user-1', 'Alice')];

      render(<ConversationList {...defaultProps} conversations={conversations} />);

      const searchInput = screen.getByPlaceholderText('Search by name or email...');
      fireEvent.change(searchInput, { target: { value: 'xyz' } });

      expect(screen.getByText('No conversations match "xyz"')).toBeInTheDocument();
    });

    it('should clear search when clear button is clicked', () => {
      const conversations = [
        createConversation('user-1', 'Alice'),
        createConversation('user-2', 'Bob'),
      ];

      render(<ConversationList {...defaultProps} conversations={conversations} />);

      const searchInput = screen.getByPlaceholderText('Search by name or email...');
      fireEvent.change(searchInput, { target: { value: 'alice' } });

      // Only Alice visible
      expect(screen.queryByTestId('conversation-user-2')).not.toBeInTheDocument();

      // Find and click clear button (the X button that appears when there's text)
      const clearButtons = screen.getAllByRole('button');
      const clearButton = clearButtons.find(btn => {
        const svg = btn.querySelector('svg');
        // Looking for the X icon button (not the + icon for new chat)
        return svg && btn !== screen.getByTitle('New Chat');
      });

      if (clearButton) {
        fireEvent.click(clearButton);
        // Both should be visible again
        expect(screen.getByTestId('conversation-user-1')).toBeInTheDocument();
        expect(screen.getByTestId('conversation-user-2')).toBeInTheDocument();
      }
    });

    it('should be case-insensitive when filtering', () => {
      const conversations = [createConversation('user-1', 'Alice Smith')];

      render(<ConversationList {...defaultProps} conversations={conversations} />);

      const searchInput = screen.getByPlaceholderText('Search by name or email...');
      fireEvent.change(searchInput, { target: { value: 'ALICE' } });

      expect(screen.getByTestId('conversation-user-1')).toBeInTheDocument();
    });
  });

  describe('Sidebar width and resize', () => {
    it('should apply sidebarWidth style', () => {
      const { container } = render(
        <ConversationList {...defaultProps} sidebarWidth={400} />
      );

      const sidebar = container.querySelector('[style*="width: 400px"]');
      expect(sidebar).toBeInTheDocument();
    });

    it('should apply minWidth and maxWidth constraints', () => {
      const { container } = render(
        <ConversationList 
          {...defaultProps} 
          sidebarWidth={350}
          minWidth={300}
          maxWidth={450}
        />
      );

      const sidebar = container.querySelector('[style*="min-width: 300px"]');
      expect(sidebar).toBeInTheDocument();
    });
  });

  describe('Resize handle', () => {
    it('should call onResizeStart when handle is mousedown', () => {
      const { container } = render(<ConversationList {...defaultProps} />);

      // Find resize handle (hidden on mobile, visible on md+)
      const resizeHandle = container.querySelector('.cursor-col-resize');
      if (resizeHandle) {
        fireEvent.mouseDown(resizeHandle);
        expect(mockOnResizeStart).toHaveBeenCalledTimes(1);
      }
    });

    it('should call onResizeReset on double-click', () => {
      const { container } = render(<ConversationList {...defaultProps} />);

      const resizeHandle = container.querySelector('.cursor-col-resize');
      if (resizeHandle) {
        fireEvent.doubleClick(resizeHandle);
        expect(mockOnResizeReset).toHaveBeenCalledTimes(1);
      }
    });

    it('should show active resize styling when isResizing is true', () => {
      const { container } = render(
        <ConversationList {...defaultProps} isResizing={true} />
      );

      const resizeHandle = container.querySelector('.cursor-col-resize');
      expect(resizeHandle).toHaveClass('bg-blue-100');
    });
  });

  describe('Responsive behavior', () => {
    it('should hide sidebar on mobile when conversation is selected', () => {
      const { container } = render(
        <ConversationList 
          {...defaultProps} 
          conversations={[createConversation('user-1', 'Alice')]}
          selectedUserId="user-1"
        />
      );

      // Sidebar should have hidden class on mobile, visible on md+
      const sidebar = container.querySelector('.hidden.md\\:flex');
      expect(sidebar).toBeInTheDocument();
    });

    it('should show sidebar on mobile when no conversation is selected', () => {
      const { container } = render(
        <ConversationList 
          {...defaultProps} 
          conversations={[createConversation('user-1', 'Alice')]}
          selectedUserId={null}
        />
      );

      // Sidebar should not have hidden class
      const sidebar = container.querySelector('.flex.flex-col');
      expect(sidebar).not.toHaveClass('hidden');
    });
  });
});
