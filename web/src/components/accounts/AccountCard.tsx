import { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { Account, accountTypeConfig, formatCurrency } from '../../services/accountService';

interface AccountCardProps {
  account: Account;
  onEdit: () => void;
  onDelete: () => void;
  onAdjustBalance: () => void;
  onArchiveToggle: () => void;
  formatWithConversion: (amount: number, fromCurrency: string) => { original: string; converted: string | null };
  primaryCurrency: string;
}

export function AccountCard({ account, onEdit, onDelete, onAdjustBalance, onArchiveToggle, formatWithConversion, primaryCurrency }: AccountCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const { resolvedTheme } = useTheme();
  const config = accountTypeConfig[account.type];
  
  // Use dark mode color when in dark theme (only for default colors, not custom user colors)
  const displayColor = account.color 
    ? account.color 
    : (resolvedTheme === 'dark' ? config.darkColor : config.defaultColor);

  return (
    <div
      className={`bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 p-4 hover:shadow-md dark:hover:shadow-gray-900/50 transition-shadow ${
        account.isArchived ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-white text-xl"
            style={{ backgroundColor: displayColor }}
          >
            {config.icon}
          </div>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100">{account.name}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {config.label}
              {account.institution && ` • ${account.institution}`}
              {account.accountNumber && ` • ${account.accountNumber}`}
            </p>
          </div>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>

          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-700 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 py-1 z-20">
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onAdjustBalance();
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  Adjust Balance
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onEdit();
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onArchiveToggle();
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  {account.isArchived ? 'Unarchive' : 'Archive'}
                </button>
                <hr className="my-1 dark:border-gray-600" />
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onDelete();
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
                >
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Current Balance</p>
          <p
            className={`text-2xl font-bold ${
              config.isLiability
                ? account.currentBalance > 0
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-green-600 dark:text-green-400'
                : account.currentBalance >= 0
                ? 'text-gray-900 dark:text-gray-100'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {formatCurrency(account.currentBalance, account.currency)}
          </p>
          {/* Show converted amount if currency differs from primary */}
          {account.currency !== primaryCurrency && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              ≈ {formatWithConversion(account.currentBalance, account.currency).converted}
            </p>
          )}
        </div>

        {!account.includeInNetWorth && (
          <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
            Not in net worth
          </span>
        )}
        {account.isArchived && (
          <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
            Archived
          </span>
        )}
      </div>
    </div>
  );
}
