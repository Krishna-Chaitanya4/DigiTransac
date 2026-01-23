import { useState, useEffect, useCallback } from 'react';
import { 
  getPendingP2PTransactions, 
  acceptP2PTransaction, 
  rejectP2PTransaction 
} from '../services/transactionService';
import { getAccounts, type Account } from '../services/accountService';
import { getLabels } from '../services/labelService';
import { getExchangeRates, type ExchangeRates } from '../services/currencyService';
import type { PendingP2PTransaction, TransactionSplitRequest } from '../types/transactions';
import type { Label } from '../types/labels';

// Icons as inline SVGs
const XIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);
const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);
const BanIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
  </svg>
);
const ChevronDownIcon = () => (
  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);
const ChevronUpIcon = () => (
  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
  </svg>
);

interface PendingP2PModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTransactionAccepted?: () => void;
}

export function PendingP2PModal({ isOpen, onClose, onTransactionAccepted }: PendingP2PModalProps) {
  const [transactions, setTransactions] = useState<PendingP2PTransaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Form state for the expanded transaction
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedLabelId, setSelectedLabelId] = useState<string>('');
  const [amount, setAmount] = useState<number>(0);
  const [notes, setNotes] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [pendingResponse, accountsData, labelsData, ratesData] = await Promise.all([
        getPendingP2PTransactions(),
        getAccounts(),
        getLabels(),
        getExchangeRates()
      ]);
      setTransactions(pendingResponse.transactions);
      setAccounts(accountsData);
      setLabels(labelsData.filter(l => l.type === 'Category'));
      setExchangeRates(ratesData);
      setError(null);
    } catch (err) {
      setError('Failed to load pending transactions');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Convert amount when account changes
  const convertAmount = useCallback((txn: PendingP2PTransaction, accountId: string) => {
    const selectedAccount = accounts.find(a => a.id === accountId);
    if (!selectedAccount || !exchangeRates) {
      return txn.amount;
    }

    // If same currency, no conversion needed
    if (txn.currency === selectedAccount.currency) {
      return txn.amount;
    }

    // Convert: txn.currency -> base currency -> target currency
    const fromRate = exchangeRates.rates[txn.currency] || 1;
    const toRate = exchangeRates.rates[selectedAccount.currency] || 1;
    const converted = (txn.amount / fromRate) * toRate;
    
    // Round to 2 decimal places
    return Math.round(converted * 100) / 100;
  }, [accounts, exchangeRates]);

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen, fetchData]);

  const handleExpand = (txnId: string) => {
    if (expandedId === txnId) {
      setExpandedId(null);
    } else {
      const txn = transactions.find(t => t.id === txnId);
      setExpandedId(txnId);
      // Reset form when expanding a new transaction
      // Use default account if set, otherwise first account
      const defaultAccount = accounts.find(a => a.isDefault) || accounts[0];
      setSelectedAccountId(defaultAccount?.id || '');
      const defaultLabel = labels.find(l => l.name === 'Uncategorized') || labels[0];
      setSelectedLabelId(defaultLabel?.id || '');
      setNotes('');
      // Calculate initial amount based on default/first account
      if (txn && defaultAccount) {
        setAmount(convertAmount(txn, defaultAccount.id));
      }
    }
  };

  // Update amount when account selection changes
  const handleAccountChange = (accountId: string, txn: PendingP2PTransaction) => {
    setSelectedAccountId(accountId);
    if (accountId) {
      setAmount(convertAmount(txn, accountId));
    }
  };

  const handleAccept = async (txn: PendingP2PTransaction) => {
    if (!selectedAccountId || !selectedLabelId || amount <= 0) {
      setError('Please select an account, category, and enter a valid amount');
      return;
    }

    try {
      setProcessingId(txn.id);
      setError(null);
      
      const splits: TransactionSplitRequest[] = [{
        labelId: selectedLabelId,
        amount: amount,
        notes: undefined
      }];

      await acceptP2PTransaction(txn.id, {
        accountId: selectedAccountId,
        amount: amount,
        splits,
        notes: notes || undefined
      });

      // Remove from list
      setTransactions(prev => prev.filter(t => t.id !== txn.id));
      setExpandedId(null);
      onTransactionAccepted?.();
    } catch (err) {
      setError('Failed to accept transaction');
      console.error(err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (txn: PendingP2PTransaction) => {
    try {
      setProcessingId(txn.id);
      setError(null);
      
      await rejectP2PTransaction(txn.id);

      // Remove from list
      setTransactions(prev => prev.filter(t => t.id !== txn.id));
    } catch (err) {
      setError('Failed to reject transaction');
      console.error(err);
    } finally {
      setProcessingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col bg-white dark:bg-gray-800 rounded-xl shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Pending Transactions
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 
              rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <XIcon />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-500">{error}</p>
              <button
                onClick={fetchData}
                className="mt-4 px-4 py-2 text-blue-600 hover:text-blue-700"
              >
                Try again
              </button>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">
                No pending transactions to review
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                These transactions were created by others and are waiting for you to assign an account and category.
              </p>
              
              {transactions.map(txn => (
                <div
                  key={txn.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                >
                  {/* Transaction Summary Row */}
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 
                      dark:hover:bg-gray-700/50 transition-colors"
                    onClick={() => handleExpand(txn.id)}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center
                        ${txn.type === 'Receive' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                        {txn.type === 'Receive' ? '↓' : '↑'}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {txn.title || `${txn.type} from ${txn.counterpartyEmail || 'Unknown'}`}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(txn.date)} • From: {txn.counterpartyEmail || 'Unknown'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`font-semibold ${txn.type === 'Receive' ? 'text-green-600' : 'text-red-600'}`}>
                        {txn.type === 'Receive' ? '+' : '-'}{formatCurrency(txn.amount, txn.currency)}
                      </span>
                      {expandedId === txn.id ? (
                        <ChevronUpIcon />
                      ) : (
                        <ChevronDownIcon />
                      )}
                    </div>
                  </div>

                  {/* Expanded Form */}
                  {expandedId === txn.id && (
                    <div className="p-4 bg-gray-50 dark:bg-gray-700/30 border-t border-gray-200 dark:border-gray-700">
                      {/* Sender's original amount info */}
                      <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                          <span className="font-medium">{txn.counterpartyEmail}</span> sent{' '}
                          <span className="font-semibold">{formatCurrency(txn.amount, txn.currency)}</span>
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        {/* Account Select */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Your Account *
                          </label>
                          <select
                            value={selectedAccountId}
                            onChange={(e) => handleAccountChange(e.target.value, txn)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                              bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                              focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value="">Select an account</option>
                            {accounts.map(account => (
                              <option key={account.id} value={account.id}>
                                {account.name} ({account.currency})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Amount (auto-converted, editable) */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Amount You Received *
                            {selectedAccountId && accounts.find(a => a.id === selectedAccountId)?.currency !== txn.currency && (
                              <span className="ml-1 text-xs text-gray-500">(auto-converted)</span>
                            )}
                          </label>
                          <input
                            type="number"
                            value={amount || ''}
                            onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                            min="0"
                            step="0.01"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                              bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                              focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Adjust if the actual amount differs (fees, exchange rate, etc.)
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        {/* Category Select */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Category *
                          </label>
                          <select
                            value={selectedLabelId}
                            onChange={(e) => setSelectedLabelId(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                              bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                              focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value="">Select a category</option>
                            {labels.map(label => (
                              <option key={label.id} value={label.id}>
                                {label.icon} {label.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Notes */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Notes (optional)
                          </label>
                          <input
                            type="text"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Add a note..."
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                              bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                              focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => handleReject(txn)}
                          disabled={processingId === txn.id}
                          className="flex items-center gap-2 px-4 py-2 text-red-600 hover:text-red-700
                            hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors
                            disabled:opacity-50"
                        >
                          <BanIcon />
                          Reject
                        </button>
                        <button
                          onClick={() => handleAccept(txn)}
                          disabled={processingId === txn.id || !selectedAccountId || !selectedLabelId || amount <= 0}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700
                            text-white rounded-lg transition-colors disabled:opacity-50"
                        >
                          <CheckIcon />
                          Accept
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PendingP2PModal;
