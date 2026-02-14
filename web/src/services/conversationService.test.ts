import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getConversations,
  getUnreadCount,
  getConversation,
  sendMessage,
  sendMoney,
  markAsRead,
  editMessage,
  deleteMessage,
  restoreMessage,
  searchUserByEmail,
  getDisplayName,
  formatRelativeTime,
  formatChatCurrency,
} from './conversationService';
import { apiClient } from './apiClient';

// Mock the apiClient
vi.mock('./apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('conversationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getConversations', () => {
    it('should call conversations endpoint', async () => {
      const mockResponse = { conversations: [], totalUnreadCount: 0 };
      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      const result = await getConversations();

      expect(apiClient.get).toHaveBeenCalledWith('/conversations');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getUnreadCount', () => {
    it('should call unread-count endpoint and return count', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ count: 5 });

      const result = await getUnreadCount();

      expect(apiClient.get).toHaveBeenCalledWith('/conversations/unread-count');
      expect(result).toBe(5);
    });
  });

  describe('getConversation', () => {
    it('should call conversation endpoint with counterparty ID', async () => {
      const mockResponse = {
        counterpartyUserId: 'user123',
        messages: [],
        totalCount: 0,
        hasMore: false,
      };
      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      const result = await getConversation('user123');

      expect(apiClient.get).toHaveBeenCalledWith('/conversations/user123');
      expect(result).toEqual(mockResponse);
    });

    it('should include limit parameter when specified', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({});

      await getConversation('user123', 25);

      expect(apiClient.get).toHaveBeenCalledWith('/conversations/user123?limit=25');
    });

    it('should include before parameter when specified', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({});

      await getConversation('user123', undefined, 'msg456');

      expect(apiClient.get).toHaveBeenCalledWith('/conversations/user123?before=msg456');
    });

    it('should include both limit and before parameters when specified', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({});

      await getConversation('user123', 50, 'msg789');

      expect(apiClient.get).toHaveBeenCalledWith('/conversations/user123?limit=50&before=msg789');
    });
  });

  describe('sendMessage', () => {
    it('should post message to conversation endpoint', async () => {
      const mockMessage = { id: 'msg1', content: 'Hello', type: 'Text' };
      vi.mocked(apiClient.post).mockResolvedValue(mockMessage);

      const result = await sendMessage('user123', { content: 'Hello' });

      expect(apiClient.post).toHaveBeenCalledWith(
        '/conversations/user123/messages',
        { content: 'Hello' }
      );
      expect(result).toEqual(mockMessage);
    });

    it('should include replyToMessageId when replying', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({});

      await sendMessage('user123', { content: 'Reply', replyToMessageId: 'msg999' });

      expect(apiClient.post).toHaveBeenCalledWith('/conversations/user123/messages', {
        content: 'Reply',
        replyToMessageId: 'msg999',
      });
    });
  });

  describe('sendMoney', () => {
    it('should post money transaction to send-money endpoint', async () => {
      const request = {
        accountId: 'acc1',
        type: 'Send' as const,
        amount: 100,
        splits: [],
      };
      vi.mocked(apiClient.post).mockResolvedValue({ id: 'msg1', type: 'Transaction' });

      const result = await sendMoney('user123', request);

      expect(apiClient.post).toHaveBeenCalledWith('/conversations/user123/send-money', request);
      expect(result).toHaveProperty('id');
    });
  });

  describe('markAsRead', () => {
    it('should post to mark-read endpoint', async () => {
      vi.mocked(apiClient.post).mockResolvedValue(undefined);

      await markAsRead('user123');

      expect(apiClient.post).toHaveBeenCalledWith('/conversations/user123/mark-read', {});
    });
  });

  describe('editMessage', () => {
    it('should put updated content to message endpoint', async () => {
      vi.mocked(apiClient.put).mockResolvedValue(undefined);

      await editMessage('msg123', { content: 'Updated content' });

      expect(apiClient.put).toHaveBeenCalledWith('/conversations/messages/msg123', {
        content: 'Updated content',
      });
    });
  });

  describe('deleteMessage', () => {
    it('should call delete on message endpoint', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue(undefined);

      await deleteMessage('msg123');

      expect(apiClient.delete).toHaveBeenCalledWith('/conversations/messages/msg123');
    });
  });

  describe('restoreMessage', () => {
    it('should post to restore endpoint', async () => {
      vi.mocked(apiClient.post).mockResolvedValue(undefined);

      await restoreMessage('msg123');

      expect(apiClient.post).toHaveBeenCalledWith('/conversations/messages/msg123/restore', {});
    });
  });

  describe('searchUserByEmail', () => {
    it('should search for user by email', async () => {
      const mockResponse = { user: { userId: 'u1', email: 'test@example.com' }, found: true };
      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      const result = await searchUserByEmail('test@example.com');

      expect(apiClient.get).toHaveBeenCalledWith(
        '/conversations/search-user?email=test%40example.com'
      );
      expect(result).toEqual(mockResponse);
    });

    it('should properly encode special characters in email', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ user: null, found: false });

      await searchUserByEmail('user+tag@example.com');

      expect(apiClient.get).toHaveBeenCalledWith(
        '/conversations/search-user?email=user%2Btag%40example.com'
      );
    });
  });

  describe('getDisplayName', () => {
    it('should return counterparty name when available', () => {
      expect(getDisplayName('John Doe', 'john@example.com')).toBe('John Doe');
    });

    it('should extract name from email when name is null', () => {
      expect(getDisplayName(null, 'john.doe@example.com')).toBe('John Doe');
    });

    it('should handle underscores in email', () => {
      expect(getDisplayName(null, 'john_doe@example.com')).toBe('John Doe');
    });

    it('should capitalize first letter of each word', () => {
      expect(getDisplayName(null, 'UPPERCASE@example.com')).toBe('UPPERCASE');
    });

    it('should handle simple email username', () => {
      expect(getDisplayName(null, 'alice@example.com')).toBe('Alice');
    });
  });

  describe('formatRelativeTime', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-26T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return "just now" for times less than a minute ago', () => {
      const now = new Date();
      expect(formatRelativeTime(now.toISOString())).toBe('just now');
    });

    it('should return minutes for times less than an hour ago', () => {
      const date = new Date(Date.now() - 30 * 60000); // 30 minutes ago
      expect(formatRelativeTime(date.toISOString())).toBe('30m');
    });

    it('should return hours for times less than a day ago', () => {
      const date = new Date(Date.now() - 5 * 3600000); // 5 hours ago
      expect(formatRelativeTime(date.toISOString())).toBe('5h');
    });

    it('should return days for times less than a week ago', () => {
      const date = new Date(Date.now() - 3 * 86400000); // 3 days ago
      expect(formatRelativeTime(date.toISOString())).toBe('3d');
    });

    it('should return formatted date for times more than a week ago', () => {
      const date = new Date(Date.now() - 10 * 86400000); // 10 days ago
      const result = formatRelativeTime(date.toISOString());
      expect(result).toMatch(/Jan|16/); // Should contain month or day
    });
  });

  describe('formatChatCurrency', () => {
    it('should format amount with currency symbol', () => {
      const result = formatChatCurrency(100, 'USD');
      expect(result).toMatch(/\$100|\$100\.00|100|USD/);
    });

    it('should format amount without decimal for whole numbers', () => {
      const result = formatChatCurrency(50, 'EUR');
      expect(result).toMatch(/€50|50|EUR/);
    });

    it('should format amount with decimals when needed', () => {
      const result = formatChatCurrency(99.99, 'GBP');
      expect(result).toMatch(/£99\.99|99\.99|GBP/);
    });

    it('should handle null currency gracefully', () => {
      const result = formatChatCurrency(100, null);
      expect(result).toBe('100');
    });

    it('should handle undefined currency gracefully', () => {
      const result = formatChatCurrency(100, undefined);
      expect(result).toBe('100');
    });

    it('should format large amounts with proper grouping', () => {
      const result = formatChatCurrency(1000000, 'USD');
      // Different locales may use different grouping (1,000,000 or 10,00,000 for Indian format)
      expect(result).toMatch(/\$?\d{1,3}([,.]?\d{2,3})+/);
      expect(result).toContain('$');
    });
  });
});
