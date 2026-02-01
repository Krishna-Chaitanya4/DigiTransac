import { memo, useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { ContactPicker } from './ContactPicker';
import { AccountPicker } from './AccountPicker';
import { BulkImportModal } from './BulkImportModal';
import type { Account } from '../services/accountService';
import type { UserSearchResult, ConversationSummary } from '../types/conversations';

export type TransactionIntent = 'personal' | 'withSomeone' | 'transfer' | 'import';

interface AddTransactionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  conversations?: ConversationSummary[];
  /** Reference to the anchor button for positioning the dropdown */
  anchorRef?: React.RefObject<HTMLButtonElement | null>;
  /** Whether to use dropdown mode (anchored to button) vs modal mode (centered) */
  mode?: 'dropdown' | 'modal';
}

interface ActionOption {
  id: TransactionIntent;
  icon: string;
  title: string;
  description: string;
  color: string;
  bgColor: string;
}

const actionOptions: ActionOption[] = [
  {
    id: 'personal',
    icon: '👤',
    title: 'Personal (My Records)',
    description: 'Track your own expenses and income',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30',
  },
  {
    id: 'withSomeone',
    icon: '👥',
    title: 'With someone',
    description: 'Record a payment with another person',
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30',
  },
  {
    id: 'transfer',
    icon: '🔄',
    title: 'Transfer between accounts',
    description: 'Move money between your accounts',
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30',
  },
  {
    id: 'import',
    icon: '📁',
    title: 'Import from CSV/Bank',
    description: 'Bulk import transactions from a file',
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700',
  },
];

export const AddTransactionSheet = memo(function AddTransactionSheet({
  isOpen,
  onClose,
  accounts,
  conversations = [],
  anchorRef,
  mode = 'modal',
}: AddTransactionSheetProps) {
  const navigate = useNavigate();
  const modalRef = useFocusTrap<HTMLDivElement>(isOpen);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Sub-modal states
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  
  // Dropdown positioning state
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  // Reset state when sheet closes
  useEffect(() => {
    if (!isOpen) {
      setShowContactPicker(false);
      setShowAccountPicker(false);
      setShowImportModal(false);
    }
  }, [isOpen]);

  // Calculate dropdown position when in dropdown mode
  useEffect(() => {
    if (!isOpen || mode !== 'dropdown' || !anchorRef?.current) return;
    
    const updatePosition = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      
      const rect = anchor.getBoundingClientRect();
      const dropdownWidth = 320; // Fixed width for dropdown
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      // Position below the button, aligned to the right edge
      let left = rect.right - dropdownWidth;
      let top = rect.bottom + 8;
      
      // Ensure dropdown doesn't go off-screen left
      if (left < 16) {
        left = 16;
      }
      
      // Ensure dropdown doesn't go off-screen right
      if (left + dropdownWidth > viewportWidth - 16) {
        left = viewportWidth - dropdownWidth - 16;
      }
      
      // If dropdown would go off-screen bottom, position above the button
      const estimatedHeight = 320; // Approximate height
      if (top + estimatedHeight > viewportHeight - 16) {
        top = rect.top - estimatedHeight - 8;
      }
      
      setDropdownStyle({
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        width: `${dropdownWidth}px`,
      });
    };
    
    updatePosition();
    
    // Update on resize/scroll
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, mode, anchorRef]);

  // Close on click outside for dropdown mode
  useEffect(() => {
    if (!isOpen || mode !== 'dropdown') return;
    
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        anchorRef?.current &&
        !anchorRef.current.contains(target)
      ) {
        onClose();
      }
    };
    
    // Delay to avoid immediate close on the same click that opened it
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, mode, onClose, anchorRef]);

  // Navigate to personal chat (self-chat) with transaction form
  const navigateToPersonalChat = useCallback(() => {
    navigate('/chats?self=true&action=transaction');
    onClose();
  }, [navigate, onClose]);

  // Navigate to a user's chat with transaction intent
  const navigateToUserChat = useCallback((userId: string) => {
    navigate(`/chats?user=${userId}&action=transaction`);
    onClose();
  }, [navigate, onClose]);

  // Handle contact selection
  const handleContactSelect = useCallback((user: UserSearchResult) => {
    navigateToUserChat(user.userId);
  }, [navigateToUserChat]);

  // Handle action selection
  const handleActionSelect = useCallback((action: TransactionIntent) => {
    switch (action) {
      case 'personal':
        navigateToPersonalChat();
        break;
      case 'withSomeone':
        setShowContactPicker(true);
        break;
      case 'transfer':
        // For transfer: if 2+ accounts, show picker; otherwise open Personal with Transfer type pre-selected
        if (accounts.filter(a => !a.isArchived).length >= 2) {
          setShowAccountPicker(true);
        } else {
          // Open Personal chat with Transfer type (user can still create transaction, it just won't be a true transfer)
          navigate('/chats?self=true&action=transaction&type=Transfer');
          onClose();
        }
        break;
      case 'import':
        setShowImportModal(true);
        break;
    }
  }, [navigateToPersonalChat, accounts, navigate, onClose]);

  // Handle transfer account selection
  const handleTransferSelect = useCallback((fromAccountId: string, toAccountId: string) => {
    // Navigate to personal chat with transfer pre-filled
    navigate(`/chats?self=true&action=transaction&type=Transfer&fromAccount=${fromAccountId}&toAccount=${toAccountId}`);
    onClose();
  }, [navigate, onClose]);

  // Handle import close
  const handleImportClose = useCallback(() => {
    setShowImportModal(false);
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  // Show contact picker
  if (showContactPicker) {
    return (
      <ContactPicker
        isOpen={true}
        onClose={() => setShowContactPicker(false)}
        onSelect={handleContactSelect}
        recentConversations={conversations}
      />
    );
  }

  // Show account picker for transfers
  if (showAccountPicker) {
    return (
      <AccountPicker
        isOpen={true}
        onClose={() => setShowAccountPicker(false)}
        onSelect={handleTransferSelect}
        accounts={accounts}
      />
    );
  }

  // Show import modal
  if (showImportModal) {
    return (
      <BulkImportModal
        isOpen={true}
        onClose={handleImportClose}
        accounts={accounts}
      />
    );
  }

  // Dropdown mode - compact menu anchored to button
  if (mode === 'dropdown') {
    return (
      <div
        ref={dropdownRef}
        style={dropdownStyle}
        className="z-50 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700
          animate-fade-in overflow-hidden"
        role="menu"
        aria-label="Add transaction options"
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      >
        {/* Compact Action Options */}
        <div className="py-2">
          {actionOptions.map((option, index) => (
            <button
              key={option.id}
              onClick={() => handleActionSelect(option.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50
                transition-colors text-left ${index !== actionOptions.length - 1 ? 'border-b border-gray-100 dark:border-gray-700/50' : ''}`}
              role="menuitem"
            >
              <span className="text-xl flex-shrink-0" role="img" aria-hidden="true">
                {option.icon}
              </span>
              <div className="flex-1 min-w-0">
                <div className={`font-medium text-sm ${option.color}`}>
                  {option.title}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {option.description}
                </div>
              </div>
              <svg
                className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Modal mode - full sheet/modal (for mobile FAB or when no anchor)
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-transaction-sheet-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 dark:bg-black/60 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Sheet */}
      <div
        ref={modalRef}
        className="relative w-full sm:max-w-md bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl
          shadow-2xl transform transition-transform animate-slide-up sm:animate-fade-in
          max-h-[85vh] overflow-y-auto"
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      >
        {/* Handle bar (mobile) */}
        <div className="sm:hidden flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
        </div>
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h2
            id="add-transaction-sheet-title"
            className="text-lg font-semibold text-gray-900 dark:text-gray-100"
          >
            Add Transaction
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300
              hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Action Options */}
        <div className="p-4 space-y-2">
          {actionOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => handleActionSelect(option.id)}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border border-transparent
                ${option.bgColor} transition-all active:scale-[0.98]`}
            >
              <span className="text-2xl" role="img" aria-hidden="true">
                {option.icon}
              </span>
              <div className="flex-1 text-left">
                <div className={`font-medium ${option.color}`}>
                  {option.title}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {option.description}
                </div>
              </div>
              <svg
                className="w-5 h-5 text-gray-400 dark:text-gray-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>
        
        {/* Cancel button (mobile) */}
        <div className="sm:hidden px-4 pb-6">
          <button
            onClick={onClose}
            className="w-full py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300
              font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
});