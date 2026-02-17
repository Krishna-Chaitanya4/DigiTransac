import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ConversationMessage } from '../../types/conversations';
import { canEditMessage, canDeleteMessage } from './MessageBubble';

interface MessageActionsMenuProps {
  message: ConversationMessage;
  position: { x: number; y: number; buttonTop: number };
  onClose: () => void;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDeleteTransaction?: (transactionId: string) => void;
}

export const MessageActionsMenu = memo(function MessageActionsMenu({
  message,
  position,
  onClose,
  onReply,
  onEdit,
  onDelete,
  onDeleteTransaction,
}: MessageActionsMenuProps) {
  const navigate = useNavigate();

  // Calculate menu position with viewport clamping
  const isTransactionMessage = message.type === 'Transaction' && message.transaction && !message.transaction.isDeleted;
  const canDeleteMsg = message.type !== 'Transaction' && canDeleteMessage(message);
  const optionCount =
    1 + // Reply is always available
    (message.type === 'Text' ? 1 : 0) + // Copy for text
    (isTransactionMessage ? 1 : 0) + // View in Transactions
    (canEditMessage(message) ? 1 : 0) + // Edit
    (canDeleteMsg ? 1 : 0) + // Delete (text messages only)
    (isTransactionMessage && onDeleteTransaction ? 1 : 0); // Delete Transaction

  const menuHeight = optionCount * 40 + 8;
  const menuWidth = 180; // min-w-[140px] but can be wider; use 180 as estimate
  const bottomTabBarHeight = 64; // Height of mobile bottom navigation bar
  const edgePadding = 8; // Minimum padding from screen edges
  const availableHeight = window.innerHeight - bottomTabBarHeight;
  const spaceBelow = availableHeight - position.y;
  const spaceAbove = position.buttonTop;
  const openUpward = spaceBelow < menuHeight && spaceAbove > spaceBelow;

  // Clamp horizontal position so menu stays on screen
  const computeHorizontalStyle = (): React.CSSProperties => {
    if (message.isFromMe) {
      // Right-aligned: ensure menu doesn't go off left edge
      const rightOffset = window.innerWidth - position.x - 24;
      const menuLeft = window.innerWidth - rightOffset - menuWidth;
      if (menuLeft < edgePadding) {
        return { left: edgePadding };
      }
      return { right: rightOffset };
    } else {
      // Left-aligned: ensure menu doesn't go off right edge
      const menuRight = position.x + menuWidth;
      if (menuRight > window.innerWidth - edgePadding) {
        return { right: edgePadding };
      }
      return { left: Math.max(edgePadding, position.x) };
    }
  };

  // Clamp vertical position so menu stays within viewport (above bottom tab bar)
  const computeVerticalStyle = (): React.CSSProperties => {
    if (openUpward) {
      const bottomValue = window.innerHeight - position.buttonTop + 4;
      // Ensure menu top doesn't go above viewport
      const menuTop = window.innerHeight - bottomValue - menuHeight;
      if (menuTop < edgePadding) {
        return { top: edgePadding };
      }
      return { bottom: bottomValue };
    } else {
      let topValue = position.y + 4;
      // Ensure menu bottom doesn't go below available height (above tab bar)
      if (topValue + menuHeight > availableHeight - edgePadding) {
        topValue = availableHeight - menuHeight - edgePadding;
      }
      // Ensure menu doesn't go above viewport
      if (topValue < edgePadding) {
        topValue = edgePadding;
      }
      return { top: topValue };
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content || '');
    onClose();
  };

  const handleViewTransaction = () => {
    if (message.transaction) {
      navigate(`/transactions?highlight=${message.transaction.transactionId}`);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div
        className="absolute bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden min-w-[140px] max-w-[calc(100vw-16px)]"
        style={{
          ...computeVerticalStyle(),
          ...computeHorizontalStyle(),
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Reply */}
        <button
          onClick={() => {
            onReply();
            onClose();
          }}
          className="w-full px-4 py-2.5 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
        >
          <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"
            />
          </svg>
          <span>Reply</span>
        </button>

        {/* Copy - only for text messages */}
        {message.type === 'Text' && (
          <button
            onClick={handleCopy}
            className="w-full px-4 py-2.5 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            <span>Copy</span>
          </button>
        )}

        {/* View in Transactions - only for transaction messages */}
        {message.type === 'Transaction' && message.transaction && (
          <button
            onClick={handleViewTransaction}
            className="w-full px-4 py-2.5 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <span>View in Transactions</span>
          </button>
        )}

        {/* Edit - only for own text messages within time limit */}
        {canEditMessage(message) && (
          <button
            onClick={() => {
              onEdit();
              onClose();
            }}
            className="w-full px-4 py-2.5 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            <span>Edit</span>
          </button>
        )}

        {/* Delete - only for own non-transaction messages within time limit */}
        {canDeleteMsg && (
          <button
            onClick={() => {
              onDelete();
              onClose();
            }}
            className="w-full px-4 py-2.5 text-left text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            <span>Delete</span>
          </button>
        )}

        {/* Delete Transaction - for transaction messages */}
        {isTransactionMessage && onDeleteTransaction && (
          <button
            onClick={() => {
              onDeleteTransaction(message.transaction!.transactionId);
              onClose();
            }}
            className="w-full px-4 py-2.5 text-left text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            <span>Delete Transaction</span>
          </button>
        )}
      </div>
    </div>
  );
});
