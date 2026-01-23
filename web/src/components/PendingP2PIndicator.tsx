import { useState, useEffect } from 'react';
import { getPendingP2PCount } from '../services/transactionService';

interface PendingP2PIndicatorProps {
  onClick?: () => void;
  className?: string;
}

export function PendingP2PIndicator({ onClick, className = '' }: PendingP2PIndicatorProps) {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const pendingCount = await getPendingP2PCount();
        setCount(pendingCount);
      } catch (error) {
        console.error('Failed to fetch pending P2P count:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCount();
    
    // Poll every 30 seconds for new pending transactions
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading || count === 0) {
    return null;
  }

  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-2 px-3 py-2 text-sm font-medium text-white 
        bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors ${className}`}
      title={`${count} pending transaction${count > 1 ? 's' : ''} to review`}
    >
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
      <span>{count} Pending</span>
      <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs">
        {count > 9 ? '9+' : count}
      </span>
    </button>
  );
}

export default PendingP2PIndicator;
