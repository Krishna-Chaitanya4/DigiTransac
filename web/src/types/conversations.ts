// Chat/Conversation types

export type MessageStatus = 'Sent' | 'Delivered' | 'Read';
export type MessageType = 'Text' | 'Transaction' | 'Request';

export interface ConversationSummary {
  counterpartyUserId: string;
  counterpartyEmail: string;
  counterpartyName: string | null;
  lastActivityAt: string;
  lastMessagePreview: string | null;
  lastMessageType: string | null; // "Text", "Transaction", "Request"
  unreadCount: number;
  totalSent: number | null;
  totalReceived: number | null;
  primaryCurrency: string | null;
}

export interface ConversationListResponse {
  conversations: ConversationSummary[];
  totalUnreadCount: number;
}

export interface TransactionMessageData {
  transactionId: string;
  transactionLinkId: string;
  transactionType: 'Send' | 'Receive';
  amount: number;
  currency: string;
  date: string;
  title: string | null;
  notes: string | null;
  isPending: boolean;
  isCleared: boolean;
  accountName: string | null;
}

export interface ReplyPreview {
  messageId: string;
  senderUserId: string;
  senderName: string | null;
  type: MessageType;
  contentPreview: string | null;
}

export interface ConversationMessage {
  id: string;
  type: MessageType;
  senderUserId: string;
  isFromMe: boolean;
  content: string | null;
  transaction: TransactionMessageData | null;
  status: MessageStatus;
  createdAt: string;
  deliveredAt: string | null;
  readAt: string | null;
  isEdited: boolean;
  editedAt: string | null;
  isDeleted: boolean;
  replyToMessageId: string | null;
  replyTo: ReplyPreview | null;
}

export interface ConversationDetailResponse {
  counterpartyUserId: string;
  counterpartyEmail: string;
  counterpartyName: string | null;
  messages: ConversationMessage[];
  totalCount: number;
  hasMore: boolean;
  totalSent: number;
  totalReceived: number;
}

// Request types
export interface SendMessageRequest {
  content: string;
  replyToMessageId?: string;
}

export interface EditMessageRequest {
  content: string;
}

export interface SendMoneyRequest {
  accountId: string;
  amount: number;
  title?: string;
  notes?: string;
  splits: {
    labelId: string;
    amount: number;
    notes?: string;
  }[];
}

// User search types
export interface UserSearchResult {
  userId: string;
  email: string;
  name: string | null;
}

export interface UserSearchResponse {
  user: UserSearchResult | null;
  found: boolean;
}
