import { memo, useState } from 'react';
import type { UserSearchResult } from '../../types/conversations';
import { searchUserByEmail } from '../../services/conversationService';

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartConversation: (user: UserSearchResult) => void;
}

export const NewChatModal = memo(function NewChatModal({
  isOpen,
  onClose,
  onStartConversation,
}: NewChatModalProps) {
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResult, setSearchResult] = useState<UserSearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  if (!isOpen) return null;

  const handleSearch = async () => {
    if (!searchEmail.trim()) return;

    setIsSearching(true);
    setSearchError('');
    setSearchResult(null);

    try {
      const result = await searchUserByEmail(searchEmail.trim());
      if (result?.user) {
        setSearchResult(result.user);
      } else {
        setSearchError('User not found');
      }
    } catch {
      setSearchError('Failed to search user');
    } finally {
      setIsSearching(false);
    }
  };

  const handleClose = () => {
    setSearchEmail('');
    setSearchResult(null);
    setSearchError('');
    onClose();
  };

  const handleStartConversation = () => {
    if (searchResult) {
      onStartConversation(searchResult);
      handleClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">New Chat</h3>
          <button
            onClick={handleClose}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Search by email
          </label>
          <div className="flex gap-2">
            <input
              type="email"
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Enter email address"
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSearch}
              disabled={!searchEmail.trim() || isSearching}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSearching ? '...' : 'Search'}
            </button>
          </div>

          {/* Error */}
          {searchError && <p className="mt-2 text-sm text-red-500">{searchError}</p>}

          {/* Search result */}
          {searchResult && (
            <div className="mt-4 p-3 border border-gray-200 dark:border-gray-700 rounded-lg flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                {(searchResult.name || searchResult.email).charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {searchResult.name || 'No name'}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{searchResult.email}</p>
              </div>
              <button
                onClick={handleStartConversation}
                className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600"
              >
                Chat
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
