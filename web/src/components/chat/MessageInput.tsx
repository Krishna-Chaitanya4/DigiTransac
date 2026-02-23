import { memo } from 'react';
import type { ConversationMessage } from '../../types/conversations';
import { formatChatCurrency } from '../../services/conversationService';

interface MessageInputProps {
  messageInput: string;
  onMessageChange: (value: string) => void;
  onSend: () => void;
  isSending: boolean;
  onOpenTransactionForm: () => void;
  // Reply state
  replyTo: ConversationMessage | null;
  onCancelReply: () => void;
  counterpartyName?: string | null;
  // Edit mode
  editingMessage: ConversationMessage | null;
  editInput: string;
  onEditInputChange: (value: string) => void;
  onEditSubmit: () => void;
  onCancelEdit: () => void;
}

export const MessageInput = memo(function MessageInput({
  messageInput,
  onMessageChange,
  onSend,
  isSending,
  onOpenTransactionForm,
  replyTo,
  onCancelReply,
  counterpartyName,
  editingMessage,
  editInput,
  onEditInputChange,
  onEditSubmit,
  onCancelEdit,
}: MessageInputProps) {
  return (
    <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      {/* Reply preview */}
      {replyTo && (
        <div className="flex items-center gap-2 mb-2 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg border-l-4 border-blue-500">
          <svg
            className="w-4 h-4 text-blue-500 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"
            />
          </svg>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-blue-600 dark:text-blue-400">
              Replying to {replyTo.isFromMe ? 'yourself' : counterpartyName || 'User'}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
              {replyTo.type === 'Transaction' && replyTo.transaction
                ? `${replyTo.transaction.transactionType === 'Send' ? 'Sent' : 'Received'} ${formatChatCurrency(replyTo.transaction.amount, replyTo.transaction.currency)}`
                : replyTo.content || 'Message'}
            </div>
          </div>
          <button
            onClick={onCancelReply}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Edit mode indicator */}
      {editingMessage && (
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500 mb-2 rounded-r">
          <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
          <span className="flex-1 text-sm text-blue-800 dark:text-blue-200 truncate">
            Editing: {editingMessage.content?.substring(0, 50)}...
          </span>
          <button
            onClick={onCancelEdit}
            className="p-1.5 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-800/30 rounded-full transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="flex items-center gap-2">
        {editingMessage ? (
          <>
            <input
              type="text"
              value={editInput}
              onChange={(e) => onEditInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) onEditSubmit();
                if (e.key === 'Escape') onCancelEdit();
              }}
              autoFocus
              placeholder="Edit message..."
              className="flex-1 px-4 py-2 border border-blue-400 dark:border-blue-600 rounded-full bg-blue-50 dark:bg-blue-900/20 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={onEditSubmit}
              disabled={!editInput.trim()}
              className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </button>
          </>
        ) : (
          <>
            <input
              type="text"
              value={messageInput}
              onChange={(e) => onMessageChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && messageInput.trim() && onSend()}
              placeholder="Type a message..."
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-full bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {/* Show ₹ button when empty, send button when typing */}
            {messageInput.trim() ? (
              <button
                onClick={onSend}
                disabled={isSending}
                className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            ) : (
              <button
                onClick={onOpenTransactionForm}
                className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors shadow-sm"
                title="New transaction"
              >
                <span className="w-5 h-5 flex items-center justify-center font-bold text-sm">₹</span>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
});
