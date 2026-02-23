import { memo, useState, useMemo, useCallback } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { searchUserByEmail } from '../services/conversationService';
import type { UserSearchResult, ConversationSummary } from '../types/conversations';

interface ContactPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (user: UserSearchResult) => void;
  recentConversations?: ConversationSummary[];
}

export const ContactPicker = memo(function ContactPicker({
  isOpen,
  onClose,
  onSelect,
  recentConversations = [],
}: ContactPickerProps) {
  const modalRef = useFocusTrap<HTMLDivElement>(isOpen);
  
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResult, setSearchResult] = useState<UserSearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  // Filter out self-chat from recent conversations
  const recentContacts = useMemo(() => 
    recentConversations
      .filter(c => !c.isSelfChat)
      .slice(0, 5)
      .map(c => ({
        userId: c.counterpartyUserId,
        email: c.counterpartyEmail,
        name: c.counterpartyName,
      })),
    [recentConversations]
  );

  const handleSearch = useCallback(async () => {
    if (!searchEmail.trim()) return;

    setIsSearching(true);
    setSearchError('');
    setSearchResult(null);

    try {
      const result = await searchUserByEmail(searchEmail.trim());
      if (result?.user) {
        setSearchResult(result.user);
      } else {
        setSearchError('User not found. They may not have a DigiTransac account.');
      }
    } catch {
      setSearchError('Failed to search. Please try again.');
    } finally {
      setIsSearching(false);
    }
  }, [searchEmail]);

  const handleClose = useCallback(() => {
    setSearchEmail('');
    setSearchResult(null);
    setSearchError('');
    onClose();
  }, [onClose]);

  const handleSelectContact = useCallback((user: UserSearchResult) => {
    onSelect(user);
    handleClose();
  }, [onSelect, handleClose]);

  if (!isOpen) return null;

  const title = 'With someone';
  const description = 'Select a person to record a transaction with';

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-picker-title"
    >
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/40 dark:bg-black/60 transition-opacity" 
        onClick={handleClose} 
        aria-hidden="true" 
      />
      
      {/* Modal */}
      <div 
        ref={modalRef}
        className="relative w-full sm:max-w-md bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl 
          shadow-2xl max-h-[85vh] overflow-hidden flex flex-col"
        onKeyDown={(e) => e.key === 'Escape' && handleClose()}
      >
        {/* Handle bar (mobile) */}
        <div className="sm:hidden flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
        </div>
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={handleClose}
              className="p-2 -ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 
                hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              aria-label="Back"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2
              id="contact-picker-title"
              className="text-lg font-semibold text-gray-900 dark:text-gray-100"
            >
              {title}
            </h2>
            <div className="w-9" /> {/* Spacer for centering */}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
            {description}
          </p>
        </div>
        
        {/* Search */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex gap-2">
            <input
              type="email"
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search by email address..."
              className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg 
                bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                placeholder-gray-400 dark:placeholder-gray-500"
              autoFocus
            />
            <button
              onClick={handleSearch}
              disabled={!searchEmail.trim() || isSearching}
              className="px-4 py-2.5 bg-blue-500 text-white rounded-xl hover:bg-blue-600 
                disabled:opacity-50 disabled:cursor-not-allowed transition-colors
                flex items-center gap-2"
            >
              {isSearching ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              )}
              <span className="hidden sm:inline">Search</span>
            </button>
          </div>
          
          {/* Error */}
          {searchError && (
            <p className="mt-2 text-sm text-red-500 dark:text-red-400">{searchError}</p>
          )}
          
          {/* Search result */}
          {searchResult && (
            <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 
              rounded-xl flex items-center gap-3 animate-fade-in">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 
                flex items-center justify-center text-white font-semibold flex-shrink-0">
                {(searchResult.name || searchResult.email).charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                  {searchResult.name || 'No name'}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {searchResult.email}
                </p>
              </div>
              <button
                onClick={() => handleSelectContact(searchResult)}
                className="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg 
                  hover:bg-blue-600 transition-colors flex-shrink-0"
              >
                Select
              </button>
            </div>
          )}
        </div>
        
        {/* Recent Contacts */}
        <div className="flex-1 overflow-y-auto">
          {recentContacts.length > 0 && (
            <div className="p-4">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                Recent Contacts
              </h3>
              <div className="space-y-2">
                {recentContacts.map((contact) => (
                  <button
                    key={contact.userId}
                    onClick={() => handleSelectContact(contact)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl 
                      hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 
                      flex items-center justify-center text-white font-semibold flex-shrink-0">
                      {(contact.name || contact.email).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                        {contact.name || 'No name'}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {contact.email}
                      </p>
                    </div>
                    <svg 
                      className="w-5 h-5 text-gray-400 flex-shrink-0" 
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
          )}
          
          {recentContacts.length === 0 && !searchResult && (
            <div className="p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full 
                flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <p className="text-gray-500 dark:text-gray-400">
                Search for a contact by email
              </p>
            </div>
          )}
        </div>
        
        {/* Cancel button (mobile) */}
        <div className="sm:hidden p-4 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={handleClose}
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