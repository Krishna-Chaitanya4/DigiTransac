interface BulkActionsBarProps {
  /** Number of selected items */
  selectedCount: number;
  /** Called when user wants to clear selection */
  onClearSelection: () => void;
  /** Called when user wants to delete selected items */
  onDelete?: () => void;
  /** Called when user wants to mark items as cleared */
  onMarkCleared?: () => void;
  /** Called when user wants to mark items as pending */
  onMarkPending?: () => void;
  /** Whether actions are currently being processed */
  isProcessing?: boolean;
}

export function BulkActionsBar({
  selectedCount,
  onClearSelection,
  onDelete,
  onMarkCleared,
  onMarkPending,
  isProcessing = false,
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 sm:bottom-6 sm:left-1/2 sm:-translate-x-1/2 sm:max-w-xl">
      <div className="bg-gray-900 dark:bg-gray-800 text-white shadow-2xl sm:rounded-xl border border-gray-700">
        <div className="flex items-center justify-between px-4 py-3">
          {/* Selection count and clear */}
          <div className="flex items-center gap-3">
            <button
              onClick={onClearSelection}
              className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors"
              title="Clear selection"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <span className="font-medium">
              {selectedCount} selected
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {onMarkCleared && (
              <button
                onClick={onMarkCleared}
                disabled={isProcessing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg 
                  bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed
                  transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="hidden sm:inline">Clear</span>
              </button>
            )}

            {onMarkPending && (
              <button
                onClick={onMarkPending}
                disabled={isProcessing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg 
                  bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed
                  transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="hidden sm:inline">Pending</span>
              </button>
            )}

            {onDelete && (
              <button
                onClick={onDelete}
                disabled={isProcessing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg 
                  bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed
                  transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span className="hidden sm:inline">Delete</span>
              </button>
            )}
          </div>
        </div>

        {/* Loading bar */}
        {isProcessing && (
          <div className="h-1 bg-gray-700 overflow-hidden">
            <div className="h-full bg-blue-500 animate-pulse" style={{ width: '100%' }} />
          </div>
        )}
      </div>
    </div>
  );
}
