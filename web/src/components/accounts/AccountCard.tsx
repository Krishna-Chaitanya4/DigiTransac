import { useState, useCallback } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useHaptics } from '../../hooks/useHaptics';
import { Account, accountTypeConfig, formatCurrency } from '../../services/accountService';

interface AccountCardProps {
  account: Account;
  onEdit: () => void;
  onDelete: () => void;
  onAdjustBalance: () => void;
  onArchiveToggle: () => void;
  onSetDefault?: () => void;
  formatWithConversion: (amount: number, fromCurrency: string) => { original: string; converted: string | null };
  primaryCurrency: string;
}

export function AccountCard({ account, onEdit, onDelete, onAdjustBalance, onArchiveToggle, onSetDefault, formatWithConversion, primaryCurrency }: AccountCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const { resolvedTheme } = useTheme();
  const isMobile = useIsMobile();
  const haptics = useHaptics();
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
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-gray-900 dark:text-gray-100">{account.name}</h3>
              {account.isDefault && (
                <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 rounded-full">
                  Default
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {config.label}
              {account.institution && ` • ${account.institution}`}
              {account.accountNumber && ` • ${account.accountNumber}`}
            </p>
          </div>
        </div>

        <div className="relative">
          <button
            onClick={() => {
              haptics.light();
              setShowMenu(!showMenu);
            }}
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 touch-manipulation"
          >
            <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>

          {/* Desktop: positioned dropdown */}
          {showMenu && !isMobile && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-700 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 py-1 z-20">
                <button
                  onClick={() => { setShowMenu(false); onAdjustBalance(); }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  Adjust Balance
                </button>
                <button
                  onClick={() => { setShowMenu(false); onEdit(); }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  Edit
                </button>
                {onSetDefault && !account.isDefault && (
                  <button
                    onClick={() => { setShowMenu(false); onSetDefault(); }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
                  >
                    Set as Default
                  </button>
                )}
                <button
                  onClick={() => { setShowMenu(false); onArchiveToggle(); }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  {account.isArchived ? 'Unarchive' : 'Archive'}
                </button>
                <hr className="my-1 dark:border-gray-600" />
                <button
                  onClick={() => { setShowMenu(false); onDelete(); }}
                  className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
                >
                  Delete
                </button>
              </div>
            </>
          )}

          {/* Mobile: bottom action sheet */}
          {showMenu && isMobile && (
            <>
              <div
                className="fixed inset-0 bg-black/40 z-40 animate-fade-in"
                onClick={() => setShowMenu(false)}
              />
              <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-800 rounded-t-2xl shadow-2xl animate-slide-up safe-area-bottom">
                {/* Drag handle */}
                <div className="flex justify-center pt-3 pb-1">
                  <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                </div>

                {/* Account info header */}
                <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 dark:border-gray-700">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-lg"
                    style={{ backgroundColor: displayColor }}
                  >
                    {config.icon}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{account.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{config.label}</p>
                  </div>
                </div>

                {/* Action items */}
                <div className="py-2">
                  <button
                    onClick={() => { haptics.light(); setShowMenu(false); onAdjustBalance(); }}
                    className="w-full flex items-center gap-4 px-5 py-3.5 min-h-[52px] text-left text-gray-700 dark:text-gray-200 active:bg-gray-100 dark:active:bg-gray-700 touch-manipulation"
                  >
                    <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-base">Adjust Balance</span>
                  </button>
                  <button
                    onClick={() => { haptics.light(); setShowMenu(false); onEdit(); }}
                    className="w-full flex items-center gap-4 px-5 py-3.5 min-h-[52px] text-left text-gray-700 dark:text-gray-200 active:bg-gray-100 dark:active:bg-gray-700 touch-manipulation"
                  >
                    <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                    </svg>
                    <span className="text-base">Edit Account</span>
                  </button>
                  {onSetDefault && !account.isDefault && (
                    <button
                      onClick={() => { haptics.light(); setShowMenu(false); onSetDefault(); }}
                      className="w-full flex items-center gap-4 px-5 py-3.5 min-h-[52px] text-left text-gray-700 dark:text-gray-200 active:bg-gray-100 dark:active:bg-gray-700 touch-manipulation"
                    >
                      <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                      </svg>
                      <span className="text-base">Set as Default</span>
                    </button>
                  )}
                  <button
                    onClick={() => { haptics.light(); setShowMenu(false); onArchiveToggle(); }}
                    className="w-full flex items-center gap-4 px-5 py-3.5 min-h-[52px] text-left text-gray-700 dark:text-gray-200 active:bg-gray-100 dark:active:bg-gray-700 touch-manipulation"
                  >
                    <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                    </svg>
                    <span className="text-base">{account.isArchived ? 'Unarchive' : 'Archive'}</span>
                  </button>
                  
                  <div className="border-t border-gray-100 dark:border-gray-700 mt-1 pt-1">
                    <button
                      onClick={() => { haptics.warning(); setShowMenu(false); onDelete(); }}
                      className="w-full flex items-center gap-4 px-5 py-3.5 min-h-[52px] text-left text-red-600 dark:text-red-400 active:bg-red-50 dark:active:bg-red-900/30 touch-manipulation"
                    >
                      <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                      <span className="text-base font-medium">Delete Account</span>
                    </button>
                  </div>
                </div>

                {/* Cancel button */}
                <div className="px-4 pb-4 pt-1">
                  <button
                    onClick={() => setShowMenu(false)}
                    className="w-full py-3 min-h-[48px] text-center text-base font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-xl active:bg-gray-200 dark:active:bg-gray-600 touch-manipulation"
                  >
                    Cancel
                  </button>
                </div>
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
                  ? 'text-red-600 dark:text-red-400'    // Liability with debt = bad (red)
                  : 'text-green-600 dark:text-green-400' // Liability paid off/overpayment = good (green)
                : account.currentBalance >= 0
                ? 'text-green-600 dark:text-green-400'  // Asset with money = good (green)
                : 'text-red-600 dark:text-red-400'      // Asset overdraft = bad (red)
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
