import { apiClient } from './apiClient';
import type {
  ConversationListResponse,
  ConversationDetailResponse,
  ConversationMessage,
  SendMessageRequest,
  SendMoneyRequest,
  EditMessageRequest,
  UserSearchResponse,
} from '../types/conversations';

// Get all conversations
export async function getConversations(): Promise<ConversationListResponse> {
  return apiClient.get<ConversationListResponse>('/conversations');
}

// Get unread count
export async function getUnreadCount(): Promise<number> {
  const response = await apiClient.get<{ count: number }>('/conversations/unread-count');
  return response.count;
}

// Get conversation with specific user
export async function getConversation(
  counterpartyUserId: string,
  limit?: number,
  before?: string
): Promise<ConversationDetailResponse> {
  const params = new URLSearchParams();
  if (limit) params.append('limit', limit.toString());
  if (before) params.append('before', before);
  
  const query = params.toString();
  const url = `/conversations/${counterpartyUserId}${query ? `?${query}` : ''}`;
  return apiClient.get<ConversationDetailResponse>(url);
}

// Send text message
export async function sendMessage(
  counterpartyUserId: string,
  request: SendMessageRequest
): Promise<ConversationMessage> {
  return apiClient.post<ConversationMessage>(
    `/conversations/${counterpartyUserId}/messages`,
    request
  );
}

// Send money
export async function sendMoney(
  counterpartyUserId: string,
  request: SendMoneyRequest
): Promise<ConversationMessage> {
  return apiClient.post<ConversationMessage>(
    `/conversations/${counterpartyUserId}/send-money`,
    request
  );
}

// Mark conversation as read
export async function markAsRead(counterpartyUserId: string): Promise<void> {
  await apiClient.post(`/conversations/${counterpartyUserId}/mark-read`, {});
}

// Edit a message
export async function editMessage(
  messageId: string,
  request: EditMessageRequest
): Promise<void> {
  await apiClient.put(`/conversations/messages/${messageId}`, request);
}

// Delete a message
export async function deleteMessage(messageId: string): Promise<void> {
  await apiClient.delete(`/conversations/messages/${messageId}`);
}

// Restore (undo delete) a message
export async function restoreMessage(messageId: string): Promise<void> {
  await apiClient.post(`/conversations/messages/${messageId}/restore`, {});
}

// Search for a user by email
export async function searchUserByEmail(email: string): Promise<UserSearchResponse> {
  return apiClient.get<UserSearchResponse>(`/conversations/search-user?email=${encodeURIComponent(email)}`);
}

// Search users by partial name or email (typeahead)
export async function searchUsers(query: string): Promise<import('../types/conversations').UserSearchResult[]> {
  return apiClient.get<import('../types/conversations').UserSearchResult[]>(`/conversations/search-users?query=${encodeURIComponent(query)}`);
}

// Helper: Get display name from conversation summary
export function getDisplayName(
  counterpartyName: string | null,
  counterpartyEmail: string
): string {
  if (counterpartyName) {
    return counterpartyName;
  }
  // Extract name part from email
  const emailName = counterpartyEmail.split('@')[0];
  // Capitalize first letter and replace dots/underscores with spaces
  return emailName
    .replace(/[._]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Helper: Format relative time
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Helper: Format currency for chat
export function formatChatCurrency(amount: number, currency: string | null | undefined): string {
  if (!currency) {
    // Fallback to plain number if no currency
    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  }
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}
