import { memo } from 'react';
import type { TransactionUIType } from '../../types/transactions';

interface TransactionTypeSelectorProps {
  value: TransactionUIType;
  onChange: (type: TransactionUIType) => void;
  showTransfer?: boolean;
}

export const TransactionTypeSelector = memo(function TransactionTypeSelector({ value, onChange, showTransfer = true }: TransactionTypeSelectorProps) {
  const types: TransactionUIType[] = showTransfer ? ['Send', 'Receive', 'Transfer'] : ['Send', 'Receive'];

  return (
    <div className="flex rounded-lg bg-gray-100 dark:bg-gray-700 p-1">
      {types.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
            value === t
              ? t === 'Send' 
                ? 'bg-red-500 dark:bg-red-950 text-white'
                : t === 'Receive'
                ? 'bg-green-500 dark:bg-green-950 text-white'
                : 'bg-blue-500 dark:bg-blue-950 text-white'
              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
});
