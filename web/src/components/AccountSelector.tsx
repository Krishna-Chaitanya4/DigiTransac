import type { Account } from '../services/accountService';

interface AccountSelectorProps {
  value: string;
  onChange: (accountId: string) => void;
  accounts: Account[];
  label?: string;
  excludeAccountId?: string;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
}

export function AccountSelector({
  value,
  onChange,
  accounts,
  label = 'Account',
  excludeAccountId,
  disabled = false,
  required = true,
  placeholder = 'Select account...',
}: AccountSelectorProps) {
  const availableAccounts = accounts.filter(a => 
    !a.isArchived && (!excludeAccountId || a.id !== excludeAccountId)
  );

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label} {required && '*'}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-label={label}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
          bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
          focus:ring-2 focus:ring-blue-500 focus:border-transparent
          disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
        required={required}
      >
        <option value="">{placeholder}</option>
        {availableAccounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name} ({account.currency})
          </option>
        ))}
      </select>
    </div>
  );
}
