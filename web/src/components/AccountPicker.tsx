import { memo, useState, useMemo, useCallback } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { getCurrencySymbol } from '../services/currencyService';
import type { Account } from '../services/accountService';

interface AccountPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (fromAccountId: string, toAccountId: string) => void;
  accounts: Account[];
}

export const AccountPicker = memo(function AccountPicker({
  isOpen,
  onClose,
  onSelect,
  accounts,
}: AccountPickerProps) {
  const modalRef = useFocusTrap<HTMLDivElement>(isOpen);
  
  const [fromAccountId, setFromAccountId] = useState<string>('');
  const [step, setStep] = useState<'from' | 'to'>('from');

  // Filter active accounts
  const activeAccounts = useMemo(() => 
    accounts.filter(a => !a.isArchived),
    [accounts]
  );

  // Get available destination accounts (excluding the selected source)
  const availableToAccounts = useMemo(() => 
    activeAccounts.filter(a => a.id !== fromAccountId),
    [activeAccounts, fromAccountId]
  );

  const handleClose = useCallback(() => {
    setFromAccountId('');
    setStep('from');
    onClose();
  }, [onClose]);

  const handleFromSelect = useCallback((accountId: string) => {
    setFromAccountId(accountId);
    setStep('to');
  }, []);

  const handleToSelect = useCallback((accountId: string) => {
    onSelect(fromAccountId, accountId);
    handleClose();
  }, [fromAccountId, onSelect, handleClose]);

  const handleBack = useCallback(() => {
    if (step === 'to') {
      setStep('from');
    } else {
      handleClose();
    }
  }, [step, handleClose]);

  const getAccountIcon = (type: string) => {
    switch (type) {
      case 'Bank': return '🏦';
      case 'CreditCard': return '💳';
      case 'Cash': return '💵';
      case 'DigitalWallet': return '📱';
      case 'Investment': return '📈';
      case 'Loan': return '🏠';
      default: return '💰';
    }
  };

  if (!isOpen) return null;

  const currentAccounts = step === 'from' ? activeAccounts : availableToAccounts;
  const title = step === 'from' ? 'Transfer From' : 'Transfer To';
  const description = step === 'from' 
    ? 'Select the account to transfer from'
    : 'Select the destination account';

  // Get the from account for display in step 2
  const fromAccount = accounts.find(a => a.id === fromAccountId);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-picker-title"
    >
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/40 dark:bg-black/60 transition-opacity" 
        onClick={handleClose} 
        aria-hidden="true" 
      />
      
      {/* Modal */}
      <div 
        ref={modalRef}
        className="relative w-full sm:max-w-md bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl 
          shadow-2xl max-h-[85vh] overflow-hidden flex flex-col"
        onKeyDown={(e) => e.key === 'Escape' && handleClose()}
      >
        {/* Handle bar (mobile) */}
        <div className="sm:hidden flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
        </div>
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={handleBack}
              className="p-2 -ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 
                hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              aria-label="Back"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 
              id="account-picker-title" 
              className="text-lg font-semibold text-gray-900 dark:text-gray-100"
            >
              {title}
            </h2>
            <div className="w-9" /> {/* Spacer for centering */}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
            {description}
          </p>
          
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mt-3">
            <div className={`w-2 h-2 rounded-full transition-colors ${
              step === 'from' ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
            }`} />
            <div className={`w-2 h-2 rounded-full transition-colors ${
              step === 'to' ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
            }`} />
          </div>
        </div>
        
        {/* Selected From Account (shown in step 2) */}
        {step === 'to' && fromAccount && (
          <div className="px-4 pt-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 
              rounded-xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 
                flex items-center justify-center text-white text-lg flex-shrink-0">
                {getAccountIcon(fromAccount.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">From</p>
                <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                  {fromAccount.name}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-gray-500 dark:text-gray-400">{fromAccount.currency}</p>
              </div>
            </div>
            
            <div className="flex justify-center py-2">
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>
          </div>
        )}
        
        {/* Account List */}
        <div className="flex-1 overflow-y-auto p-4">
          {currentAccounts.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full 
                flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                    d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <p className="text-gray-500 dark:text-gray-400">
                No accounts available
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {currentAccounts.map((account) => {
                const isCrossCurrency = step === 'to' && fromAccount && account.currency !== fromAccount.currency;
                
                return (
                  <button
                    key={account.id}
                    onClick={() => step === 'from' ? handleFromSelect(account.id) : handleToSelect(account.id)}
                    className="w-full flex items-center gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-700
                      hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:border-gray-300 dark:hover:border-gray-600
                      transition-all active:scale-[0.98]"
                  >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl flex-shrink-0 ${
                      account.type === 'CreditCard'
                        ? 'bg-gradient-to-br from-red-500 to-red-600 text-white'
                        : account.type === 'Bank'
                        ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white'
                        : account.type === 'Cash'
                        ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white'
                        : account.type === 'DigitalWallet'
                        ? 'bg-gradient-to-br from-purple-500 to-purple-600 text-white'
                        : account.type === 'Investment'
                        ? 'bg-gradient-to-br from-yellow-500 to-orange-600 text-white'
                        : account.type === 'Loan'
                        ? 'bg-gradient-to-br from-red-600 to-red-700 text-white'
                        : 'bg-gradient-to-br from-gray-400 to-gray-600 text-white'
                    }`}>
                      {getAccountIcon(account.type)}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                        {account.name}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {account.type}
                        </span>
                        {isCrossCurrency && (
                          <span className="text-xs px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 
                            text-yellow-700 dark:text-yellow-400 rounded">
                            {fromAccount?.currency} → {account.currency}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-semibold text-gray-900 dark:text-gray-100">
                        {getCurrencySymbol(account.currency)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {account.currency}
                      </p>
                    </div>
                    <svg 
                      className="w-5 h-5 text-gray-400 flex-shrink-0" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Cancel button (mobile) */}
        <div className="sm:hidden p-4 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={handleClose}
            className="w-full py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 
              font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
});