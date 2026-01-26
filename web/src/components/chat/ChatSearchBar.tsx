import { memo } from 'react';

interface ChatSearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchResultsCount: number;
  currentSearchIndex: number;
  onNavigatePrev: () => void;
  onNavigateNext: () => void;
  onClose: () => void;
}

export const ChatSearchBar = memo(function ChatSearchBar({
  searchQuery,
  onSearchChange,
  searchResultsCount,
  currentSearchIndex,
  onNavigatePrev,
  onNavigateNext,
  onClose,
}: ChatSearchBarProps) {
  return (
    <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center gap-2">
      <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search in conversation..."
        autoFocus
        className="flex-1 px-2 py-1 bg-transparent text-gray-900 dark:text-gray-100 focus:outline-none"
      />
      {searchResultsCount > 0 && (
        <div className="flex items-center gap-1 text-sm text-gray-500">
          <span>
            {currentSearchIndex + 1}/{searchResultsCount}
          </span>
          <button
            onClick={onNavigatePrev}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <button
            onClick={onNavigateNext}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      )}
      <button
        onClick={onClose}
        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
});
