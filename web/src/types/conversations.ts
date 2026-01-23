// Chat/Conversation types

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

export interface ConversationMessage {
  id: string;
  type: 'Text' | 'Transaction' | 'Request';
  senderUserId: string;
  isFromMe: boolean;
  content: string | null;
  transaction: TransactionMessageData | null;
  isRead: boolean;
  createdAt: string;
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
