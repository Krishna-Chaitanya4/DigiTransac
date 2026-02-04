import { ReactNode } from 'react';
import { ErrorBoundary } from '../ErrorBoundary';

interface ChatErrorFallbackProps {
  onRetry: () => void;
}

function ChatErrorFallback({ onRetry }: ChatErrorFallbackProps) {
  return (
    <div className="h-full flex flex-col items-center justify-center bg-white dark:bg-gray-800 p-8">
      <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
        <svg 
          className="w-8 h-8 text-red-500 dark:text-red-400"
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={1.5} 
            d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" 
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
        Chat couldn't be loaded
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-4 max-w-xs">
        There was a problem loading the conversation. Your messages are safe and will appear once the issue is resolved.
      </p>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
      >
        Reload Chat
      </button>
    </div>
  );
}

interface ChatErrorBoundaryProps {
  children: ReactNode;
  onRetry?: () => void;
}

export function ChatErrorBoundary({ children, onRetry }: ChatErrorBoundaryProps) {
  const handleReset = () => {
    onRetry?.();
  };

  return (
    <ErrorBoundary
      name="Chat"
      fallback={<ChatErrorFallback onRetry={handleReset} />}
    >
      {children}
    </ErrorBoundary>
  );
}

export default ChatErrorBoundary;