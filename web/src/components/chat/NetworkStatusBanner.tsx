import { memo } from 'react';
import { useOnlineStatusExtended } from '../../hooks/useOffline';

/**
 * NetworkStatusBanner - Shows connection status to users
 * Mobile-first design with non-intrusive notifications
 */
export const NetworkStatusBanner = memo(function NetworkStatusBanner() {
  const { isOnline, wasOffline } = useOnlineStatusExtended();

  // Don't show anything if online and wasn't offline recently
  if (isOnline && !wasOffline) return null;

  return (
    <div
      className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full shadow-lg text-sm font-medium flex items-center gap-2 transition-all duration-300 ${
        isOnline
          ? 'bg-green-500 text-white animate-fade-in-up'
          : 'bg-red-500 text-white'
      }`}
      role="status"
      aria-live="polite"
    >
      {isOnline ? (
        <>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>Back online</span>
        </>
      ) : (
        <>
          <svg className="w-4 h-4 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3"
            />
          </svg>
          <span>No connection</span>
        </>
      )}
    </div>
  );
});

export default NetworkStatusBanner;