import { memo, useState } from 'react';

interface FloatingActionButtonProps {
  onCreateTransaction: () => void;
  hasAccounts: boolean;
  className?: string;
}

/**
 * FloatingActionButton - Quick access to create transactions on mobile
 * Follows Material Design FAB patterns with subtle animations
 */
export const FloatingActionButton = memo(function FloatingActionButton({
  onCreateTransaction,
  hasAccounts,
  className = '',
}: FloatingActionButtonProps) {
  const [isPressed, setIsPressed] = useState(false);

  if (!hasAccounts) return null;

  return (
    <button
      onClick={onCreateTransaction}
      onTouchStart={() => setIsPressed(true)}
      onTouchEnd={() => setIsPressed(false)}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      className={`
        fixed bottom-6 right-4 z-40
        w-14 h-14 sm:w-16 sm:h-16
        bg-gradient-to-br from-blue-500 to-indigo-600
        rounded-full shadow-lg
        flex items-center justify-center
        text-white
        transition-all duration-200 ease-out
        active:scale-95 hover:shadow-xl
        focus:outline-none focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-800
        touch-manipulation
        ${isPressed ? 'scale-95 shadow-md' : 'scale-100'}
        ${className}
      `}
      aria-label="Record transaction"
      title="Record transaction"
    >
      {/* Rupee symbol with plus */}
      <div className="relative flex items-center justify-center">
        <span className="text-2xl sm:text-3xl font-bold">₹</span>
        <svg 
          className="w-3 h-3 sm:w-4 sm:h-4 absolute -right-2 -top-1 bg-white text-blue-600 rounded-full p-0.5"
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
          strokeWidth={3}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </div>
    </button>
  );
});

export default FloatingActionButton;