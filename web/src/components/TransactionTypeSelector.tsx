import type { TransactionUIType } from '../types/transactions';

interface TransactionTypeSelectorProps {
  value: TransactionUIType;
  onChange: (type: TransactionUIType) => void;
}

export function TransactionTypeSelector({ value, onChange }: TransactionTypeSelectorProps) {
  const types: { type: TransactionUIType; label: string }[] = [
    { type: 'Send', label: 'Send' },
    { type: 'Receive', label: 'Receive' },
    { type: 'Transfer', label: 'Transfer' },
  ];

  return (
    <div className="flex rounded-lg bg-gray-100 dark:bg-gray-700 p-1">
      {types.map(({ type, label }) => (
        <button
          key={type}
          type="button"
          onClick={() => onChange(type)}
          aria-pressed={value === type}
          className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
            value === type
              ? type === 'Send' 
                ? 'bg-red-500 dark:bg-red-950 text-white'
                : type === 'Receive'
                ? 'bg-green-500 dark:bg-green-950 text-white'
                : 'bg-blue-500 dark:bg-blue-950 text-white'
              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
