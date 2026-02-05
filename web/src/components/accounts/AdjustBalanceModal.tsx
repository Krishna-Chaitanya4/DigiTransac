import { useState, useEffect } from 'react';
import { Account, formatCurrency } from '../../services/accountService';
import { getCurrencySymbol } from '../../services/currencyService';

interface AdjustBalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (newBalance: number, notes: string) => void;
  account: Account | null;
  isLoading: boolean;
}

export function AdjustBalanceModal({ isOpen, onClose, onSubmit, account, isLoading }: AdjustBalanceModalProps) {
  const [newBalance, setNewBalance] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (account) {
      setNewBalance(account.currentBalance.toString());
      setNotes('');
    }
  }, [account, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(parseFloat(newBalance) || 0, notes);
  };

  if (!isOpen || !account) return null;

  const difference = (parseFloat(newBalance) || 0) - account.currentBalance;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/30" onClick={onClose} />
        <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Adjust Balance - {account.name}
          </h3>

          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Current Balance
                </label>
                <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {formatCurrency(account.currentBalance, account.currency)}
                </div>
              </div>

              <div>
                <label htmlFor="newBalance" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  New Balance
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">{getCurrencySymbol(account.currency)}</span>
                  <input
                    type="number"
                    id="newBalance"
                    value={newBalance}
                    onChange={(e) => setNewBalance(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    step="0.01"
                    autoFocus
                  />
                </div>
                {difference !== 0 && (
                  <p className={`mt-1 text-sm ${difference > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {difference > 0 ? '+' : ''}{formatCurrency(difference, account.currency)}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="adjustNotes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Reason (optional)
                </label>
                <input
                  type="text"
                  id="adjustNotes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Bank reconciliation"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-br from-blue-600 to-blue-700 dark:from-blue-900 dark:to-blue-950 rounded-lg hover:from-blue-700 hover:to-blue-800 dark:hover:from-blue-800 dark:hover:to-blue-900 disabled:opacity-50"
                disabled={isLoading}
              >
                {isLoading ? 'Updating...' : 'Update Balance'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
