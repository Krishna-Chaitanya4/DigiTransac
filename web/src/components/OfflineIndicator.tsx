import { useOnlineStatus, useOfflineQueue } from '../hooks/useOffline';

export default function OfflineIndicator() {
  const isOnline = useOnlineStatus();
  const { queue, isSyncing } = useOfflineQueue();
  
  // Don't show anything when online and no pending items
  if (isOnline && queue.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-50">
      {!isOnline && (
        <div className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-lg shadow-lg">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <span className="text-sm font-medium">You're offline</span>
        </div>
      )}
      
      {queue.length > 0 && (
        <div className={`mt-2 flex items-center gap-2 ${isOnline ? 'bg-indigo-500 dark:bg-indigo-700' : 'bg-gray-600 dark:bg-gray-700'} text-white px-4 py-2 rounded-lg shadow-lg`}>
          {isSyncing ? (
            <>
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-sm font-medium">Syncing {queue.length} item{queue.length > 1 ? 's' : ''}...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <span className="text-sm font-medium">{queue.length} pending change{queue.length > 1 ? 's' : ''}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
