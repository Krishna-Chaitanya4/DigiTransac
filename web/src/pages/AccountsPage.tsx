import { useState, useEffect, useCallback, useMemo } from 'react';
import { logger } from '../services/logger';
import { useCurrency } from '../context/CurrencyContext';
import {
  Account,
  AccountType,
  AccountSummary,
  CreateAccountRequest,
  UpdateAccountRequest,
  accountTypeConfig,
  getAccounts,
  getAccountSummary,
  createAccount,
  updateAccount,
  deleteAccount,
  adjustBalance,
  formatCurrency,
} from '../services/accountService';
import { 
  formatCurrency as formatCurrencyWithCode, 
  getCurrencySymbol, 
  formatRelativeTime,
  refreshExchangeRates,
  Currency,
  getSupportedCurrencies,
  COMMON_CURRENCIES,
} from '../services/currencyService';

// Preset colors for accounts
const PRESET_COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#10b981', // green
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
];

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateAccountRequest | UpdateAccountRequest) => void;
  editingAccount: Account | null;
  isLoading: boolean;
  primaryCurrency: string;
  error?: string | null;
}

function AccountModal({ isOpen, onClose, onSubmit, editingAccount, isLoading, primaryCurrency, error }: AccountModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('Bank');
  const [color, setColor] = useState('');
  const [currency, setCurrency] = useState(primaryCurrency);
  const [initialBalance, setInitialBalance] = useState('0');
  const [institution, setInstitution] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [includeInNetWorth, setIncludeInNetWorth] = useState(true);
  
  // Currency dropdown state
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [currencySearch, setCurrencySearch] = useState('');
  const [isCurrencyDropdownOpen, setIsCurrencyDropdownOpen] = useState(false);
  
  // Load currencies on mount
  useEffect(() => {
    getSupportedCurrencies()
      .then(setCurrencies)
      .catch((err) => logger.error('Failed to load currencies:', err));
  }, []);

  useEffect(() => {
    if (editingAccount) {
      setName(editingAccount.name);
      setType(editingAccount.type);
      setColor(editingAccount.color || '');
      setCurrency(editingAccount.currency);
      setInitialBalance(editingAccount.initialBalance.toString());
      setInstitution(editingAccount.institution || '');
      setAccountNumber(editingAccount.accountNumber || '');
      setNotes(editingAccount.notes || '');
      setIncludeInNetWorth(editingAccount.includeInNetWorth);
    } else {
      setName('');
      setType('Bank');
      setColor('');
      setCurrency(primaryCurrency);
      setInitialBalance('0');
      setInstitution('');
      setAccountNumber('');
      setNotes('');
      setIncludeInNetWorth(true);
    }
  }, [editingAccount, isOpen, primaryCurrency]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingAccount) {
      onSubmit({
        name: name.trim(),
        color: color || null,
        currency,
        institution: institution.trim() || null,
        accountNumber: accountNumber.trim() || null,
        notes: notes.trim() || null,
        includeInNetWorth,
      });
    } else {
      onSubmit({
        name: name.trim(),
        type,
        color: color || null,
        currency,
        initialBalance: parseFloat(initialBalance) || 0,
        institution: institution.trim() || null,
        accountNumber: accountNumber.trim() || null,
        notes: notes.trim() || null,
        includeInNetWorth,
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/30" onClick={onClose} />
        <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {editingAccount ? 'Edit Account' : 'New Account'}
          </h3>

          <form onSubmit={handleSubmit}>
            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {/* Account Name */}
              <div>
                <label htmlFor="accountName" className="block text-sm font-medium text-gray-700 mb-1">
                  Account Name *
                </label>
                <input
                  type="text"
                  id="accountName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., HDFC Savings"
                  required
                  autoFocus
                />
              </div>

              {/* Account Type (only for new accounts) */}
              {!editingAccount && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Account Type *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(accountTypeConfig) as AccountType[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setType(t)}
                        className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                          type === t
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <span className="text-xl">{accountTypeConfig[t].icon}</span>
                        <span className="text-sm font-medium">{accountTypeConfig[t].label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Initial Balance (only for new accounts) */}
              {!editingAccount && (
                <div>
                  <label htmlFor="initialBalance" className="block text-sm font-medium text-gray-700 mb-1">
                    Initial Balance
                  </label>
                  <div className="flex gap-2">
                    {/* Currency Dropdown */}
                    <div className="relative flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => setIsCurrencyDropdownOpen(!isCurrencyDropdownOpen)}
                        className="flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 hover:bg-gray-100 text-sm font-medium min-w-[90px]"
                      >
                        <span>{getCurrencySymbol(currency)}</span>
                        <span className="text-gray-600">{currency}</span>
                        <svg className="w-4 h-4 text-gray-400 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      
                      {isCurrencyDropdownOpen && (
                        <div className="absolute z-20 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg">
                          <div className="p-2 border-b border-gray-100">
                            <input
                              type="text"
                              value={currencySearch}
                              onChange={(e) => setCurrencySearch(e.target.value)}
                              placeholder="Search currencies..."
                              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              autoFocus
                            />
                          </div>
                          <div className="max-h-48 overflow-y-auto">
                            {/* Common currencies section */}
                            {currencySearch === '' && (
                              <div className="px-3 py-1 text-xs text-gray-400 bg-gray-50">Common Currencies</div>
                            )}
                            {currencies
                              .filter(c => 
                                currencySearch === '' 
                                  ? COMMON_CURRENCIES.includes(c.code)
                                  : c.code.toLowerCase().includes(currencySearch.toLowerCase()) ||
                                    c.name.toLowerCase().includes(currencySearch.toLowerCase())
                              )
                              .map((c) => (
                                <button
                                  key={c.code}
                                  type="button"
                                  onClick={() => {
                                    setCurrency(c.code);
                                    setIsCurrencyDropdownOpen(false);
                                    setCurrencySearch('');
                                  }}
                                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 ${
                                    c.code === currency ? 'bg-blue-50 text-blue-700' : ''
                                  }`}
                                >
                                  <span className="w-6">{c.symbol}</span>
                                  <span className="flex-1">{c.name}</span>
                                  <span className="text-gray-400">{c.code}</span>
                                </button>
                              ))
                            }
                            {currencySearch !== '' && currencies.filter(c => 
                              c.code.toLowerCase().includes(currencySearch.toLowerCase()) ||
                              c.name.toLowerCase().includes(currencySearch.toLowerCase())
                            ).length === 0 && (
                              <p className="px-3 py-2 text-sm text-gray-500">No currencies found</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Amount Input */}
                    <input
                      type="number"
                      id="initialBalance"
                      value={initialBalance}
                      onChange={(e) => setInitialBalance(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0.00"
                      step="0.01"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {accountTypeConfig[type].isLiability
                      ? 'Enter the amount you owe (as positive number)'
                      : 'Enter your current balance'}
                  </p>
                </div>
              )}

              {/* Currency (only for editing accounts) */}
              {editingAccount && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Currency
                  </label>
                  {editingAccount.canEditCurrency ? (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsCurrencyDropdownOpen(!isCurrencyDropdownOpen)}
                        className="flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 hover:bg-gray-100 text-sm font-medium min-w-[120px]"
                      >
                        <span>{getCurrencySymbol(currency)}</span>
                        <span className="text-gray-600">{currency}</span>
                        <svg className="w-4 h-4 text-gray-400 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      
                      {isCurrencyDropdownOpen && (
                        <div className="absolute z-20 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg">
                          <div className="p-2 border-b border-gray-100">
                            <input
                              type="text"
                              value={currencySearch}
                              onChange={(e) => setCurrencySearch(e.target.value)}
                              placeholder="Search currencies..."
                              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              autoFocus
                            />
                          </div>
                          <div className="max-h-48 overflow-y-auto">
                            {currencySearch === '' && (
                              <div className="px-3 py-1 text-xs text-gray-400 bg-gray-50">Common Currencies</div>
                            )}
                            {currencies
                              .filter(c => 
                                currencySearch === '' 
                                  ? COMMON_CURRENCIES.includes(c.code)
                                  : c.code.toLowerCase().includes(currencySearch.toLowerCase()) ||
                                    c.name.toLowerCase().includes(currencySearch.toLowerCase())
                              )
                              .map((c) => (
                                <button
                                  key={c.code}
                                  type="button"
                                  onClick={() => {
                                    setCurrency(c.code);
                                    setIsCurrencyDropdownOpen(false);
                                    setCurrencySearch('');
                                  }}
                                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 ${
                                    c.code === currency ? 'bg-blue-50 text-blue-700' : ''
                                  }`}
                                >
                                  <span className="w-6">{c.symbol}</span>
                                  <span className="flex-1">{c.name}</span>
                                  <span className="text-gray-400">{c.code}</span>
                                </button>
                              ))
                            }
                            {currencySearch !== '' && currencies.filter(c => 
                              c.code.toLowerCase().includes(currencySearch.toLowerCase()) ||
                              c.name.toLowerCase().includes(currencySearch.toLowerCase())
                            ).length === 0 && (
                              <p className="px-3 py-2 text-sm text-gray-500">No currencies found</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium">
                        <span>{getCurrencySymbol(currency)}</span>
                        <span>{currency}</span>
                      </span>
                      <span className="text-xs text-gray-500" title="Currency cannot be changed because this account has transactions">
                        <svg className="w-4 h-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m2-10a4 4 0 00-4 4v1a2 2 0 002 2h4a2 2 0 002-2v-1a4 4 0 00-4-4z" />
                        </svg>
                        Locked (has transactions)
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Color */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {PRESET_COLORS.map((presetColor) => (
                    <button
                      key={presetColor}
                      type="button"
                      onClick={() => setColor(presetColor)}
                      className={`w-8 h-8 rounded-full border-2 ${
                        color === presetColor ? 'border-gray-900 scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: presetColor }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={color || accountTypeConfig[type].defaultColor}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-10 h-10 p-1 border border-gray-300 rounded cursor-pointer"
                  />
                  {color && (
                    <button
                      type="button"
                      onClick={() => setColor('')}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Use default
                    </button>
                  )}
                </div>
              </div>

              {/* Institution */}
              <div>
                <label htmlFor="institution" className="block text-sm font-medium text-gray-700 mb-1">
                  Institution / Bank
                </label>
                <input
                  type="text"
                  id="institution"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., HDFC Bank"
                />
              </div>

              {/* Account Number */}
              <div>
                <label htmlFor="accountNumber" className="block text-sm font-medium text-gray-700 mb-1">
                  Account Number (last 4 digits)
                </label>
                <input
                  type="text"
                  id="accountNumber"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., ****1234"
                  maxLength={10}
                />
              </div>

              {/* Notes */}
              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Optional notes..."
                  rows={2}
                />
              </div>

              {/* Include in Net Worth */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="includeInNetWorth"
                  checked={includeInNetWorth}
                  onChange={(e) => setIncludeInNetWorth(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="includeInNetWorth" className="text-sm text-gray-700">
                  Include in net worth calculation
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                disabled={isLoading || !name.trim()}
              >
                {isLoading ? 'Saving...' : editingAccount ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onArchive?: () => void;
  accountName: string;
  isLoading: boolean;
  errorMessage?: string | null;
}

function DeleteConfirmModal({ isOpen, onClose, onConfirm, onArchive, accountName, isLoading, errorMessage }: DeleteConfirmModalProps) {
  if (!isOpen) return null;

  const hasTransactionError = errorMessage && errorMessage.includes('transaction');

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/30" onClick={onClose} />
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Account</h3>
          
          {hasTransactionError ? (
            <div className="space-y-4">
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
                <div className="text-sm text-red-800">
                  <p className="font-medium">Cannot delete this account</p>
                  <p>{errorMessage}</p>
                </div>
              </div>
              <p className="text-gray-600 text-sm">
                To hide this account from your dashboard, you can archive it instead. Archived accounts will still appear in reports and transaction history.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                {onArchive && (
                  <button
                    type="button"
                    onClick={onArchive}
                    className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700"
                  >
                    Archive Instead
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              <p className="text-gray-600 mb-4">
                Are you sure you want to delete <strong>{accountName}</strong>? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onConfirm}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
                  disabled={isLoading}
                >
                  {isLoading ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface AdjustBalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (newBalance: number, notes: string) => void;
  account: Account | null;
  isLoading: boolean;
}

function AdjustBalanceModal({ isOpen, onClose, onSubmit, account, isLoading }: AdjustBalanceModalProps) {
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
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Adjust Balance - {account.name}
          </h3>

          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Current Balance
                </label>
                <div className="text-lg font-semibold text-gray-900">
                  {formatCurrency(account.currentBalance, account.currency)}
                </div>
              </div>

              <div>
                <label htmlFor="newBalance" className="block text-sm font-medium text-gray-700 mb-1">
                  New Balance
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                  <input
                    type="number"
                    id="newBalance"
                    value={newBalance}
                    onChange={(e) => setNewBalance(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    step="0.01"
                    autoFocus
                  />
                </div>
                {difference !== 0 && (
                  <p className={`mt-1 text-sm ${difference > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {difference > 0 ? '+' : ''}{formatCurrency(difference, account.currency)}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="adjustNotes" className="block text-sm font-medium text-gray-700 mb-1">
                  Reason (optional)
                </label>
                <input
                  type="text"
                  id="adjustNotes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Bank reconciliation"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
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

interface AccountCardProps {
  account: Account;
  onEdit: () => void;
  onDelete: () => void;
  onAdjustBalance: () => void;
  onArchiveToggle: () => void;
  formatWithConversion: (amount: number, fromCurrency: string) => { original: string; converted: string | null };
  primaryCurrency: string;
}

function AccountCard({ account, onEdit, onDelete, onAdjustBalance, onArchiveToggle, formatWithConversion, primaryCurrency }: AccountCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const config = accountTypeConfig[account.type];
  const displayColor = account.color || config.defaultColor;

  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow ${
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
            <h3 className="font-medium text-gray-900">{account.name}</h3>
            <p className="text-sm text-gray-500">
              {config.label}
              {account.institution && ` • ${account.institution}`}
              {account.accountNumber && ` • ${account.accountNumber}`}
            </p>
          </div>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 rounded hover:bg-gray-100"
          >
            <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>

          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onAdjustBalance();
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  Adjust Balance
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onEdit();
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onArchiveToggle();
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  {account.isArchived ? 'Unarchive' : 'Archive'}
                </button>
                <hr className="my-1" />
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onDelete();
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
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
          <p className="text-xs text-gray-500 uppercase tracking-wide">Current Balance</p>
          <p
            className={`text-2xl font-bold ${
              config.isLiability
                ? account.currentBalance > 0
                  ? 'text-red-600'
                  : 'text-green-600'
                : account.currentBalance >= 0
                ? 'text-gray-900'
                : 'text-red-600'
            }`}
          >
            {formatCurrency(account.currentBalance, account.currency)}
          </p>
          {/* Show converted amount if currency differs from primary */}
          {account.currency !== primaryCurrency && (
            <p className="text-sm text-gray-500">
              ≈ {formatWithConversion(account.currentBalance, account.currency).converted}
            </p>
          )}
        </div>

        {!account.includeInNetWorth && (
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
            Not in net worth
          </span>
        )}
        {account.isArchived && (
          <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">
            Archived
          </span>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ summary, onRefreshRates }: { summary: AccountSummary; onRefreshRates: () => void }) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const currencyCodes = Object.keys(summary.balancesByCurrency || {});
  const hasMultipleCurrencies = currencyCodes.length > 1;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefreshRates();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg p-6 text-white mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium">Net Worth</h2>
        {hasMultipleCurrencies && summary.ratesLastUpdated && (
          <div className="flex items-center gap-2 text-xs text-blue-200">
            <span>Rates: {formatRelativeTime(summary.ratesLastUpdated)}</span>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-1 hover:bg-blue-500 rounded transition-colors disabled:opacity-50"
              title="Refresh exchange rates"
            >
              <svg 
                className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        )}
      </div>
      <div className="text-4xl font-bold mb-4">
        {formatCurrencyWithCode(summary.netWorth, summary.primaryCurrency)}
      </div>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-blue-200 text-sm">Assets</p>
          <p className="text-xl font-semibold">{formatCurrencyWithCode(summary.totalAssets, summary.primaryCurrency)}</p>
        </div>
        <div>
          <p className="text-blue-200 text-sm">Liabilities</p>
          <p className="text-xl font-semibold">{formatCurrencyWithCode(summary.totalLiabilities, summary.primaryCurrency)}</p>
        </div>
      </div>
      
      {/* Currency Breakdown */}
      {hasMultipleCurrencies && (
        <div className="border-t border-blue-500 pt-4 mt-4">
          <p className="text-xs text-blue-200 mb-2">Breakdown by Currency</p>
          <div className="space-y-2">
            {currencyCodes.map((code) => {
              const balances = summary.balancesByCurrency[code];
              const isPrimary = code === summary.primaryCurrency;
              return (
                <div key={code} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1">
                    <span className="font-medium">{getCurrencySymbol(code)}</span>
                    <span className="text-blue-200">{code}</span>
                    {isPrimary && <span className="text-xs bg-blue-500 px-1.5 py-0.5 rounded">Primary</span>}
                  </span>
                  <div className="text-right">
                    <span>{formatCurrencyWithCode(balances.netWorth, code)}</span>
                    {!isPrimary && (
                      <span className="text-blue-200 text-xs ml-1">
                        (≈ {formatCurrencyWithCode(balances.netWorthConverted, summary.primaryCurrency)})
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AccountsPage() {
  const { formatWithConversion, primaryCurrency: userPrimaryCurrency } = useCurrency();
  
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustingAccount, setAdjustingAccount] = useState<Account | null>(null);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [accountsData, summaryData] = await Promise.all([
        getAccounts(showArchived),
        getAccountSummary(),
      ]);
      setAccounts(accountsData);
      setSummary(summaryData);
    } catch {
      setError('Failed to load accounts');
    } finally {
      setIsLoading(false);
    }
  }, [showArchived]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefreshRates = useCallback(async () => {
    try {
      await refreshExchangeRates();
      // Reload summary to get updated converted values
      const summaryData = await getAccountSummary();
      setSummary(summaryData);
    } catch {
      setError('Failed to refresh exchange rates');
    }
  }, []);

  // Group accounts by type
  const groupedAccounts = useMemo(() => {
    const groups: Record<AccountType, Account[]> = {
      Bank: [],
      CreditCard: [],
      Cash: [],
      DigitalWallet: [],
      Investment: [],
      Loan: [],
    };

    accounts.forEach((account) => {
      groups[account.type].push(account);
    });

    return groups;
  }, [accounts]);

  const handleCreate = () => {
    setEditingAccount(null);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleEdit = (account: Account) => {
    setEditingAccount(account);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleDelete = (account: Account) => {
    setDeletingAccount(account);
    setDeleteError(null);
    setIsDeleteModalOpen(true);
  };

  const handleAdjustBalance = (account: Account) => {
    setAdjustingAccount(account);
    setIsAdjustModalOpen(true);
  };

  const handleArchiveFromDeleteModal = async () => {
    if (!deletingAccount) return;
    
    try {
      setIsSubmitting(true);
      await updateAccount(deletingAccount.id, { isArchived: true });
      setIsDeleteModalOpen(false);
      setDeletingAccount(null);
      setDeleteError(null);
      await loadData();
    } catch {
      setError('Failed to archive account');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchiveToggle = async (account: Account) => {
    try {
      await updateAccount(account.id, { isArchived: !account.isArchived });
      await loadData();
    } catch {
      setError('Failed to update account');
    }
  };

  const handleModalSubmit = async (data: CreateAccountRequest | UpdateAccountRequest) => {
    try {
      setIsSubmitting(true);
      setModalError(null);
      if (editingAccount) {
        await updateAccount(editingAccount.id, data as UpdateAccountRequest);
      } else {
        await createAccount(data as CreateAccountRequest);
      }
      setIsModalOpen(false);
      setModalError(null);
      await loadData();
    } catch (err) {
      // Show error in the modal
      const message = err instanceof Error ? err.message : (editingAccount ? 'Failed to update account' : 'Failed to create account');
      setModalError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingAccount) return;

    try {
      setIsSubmitting(true);
      await deleteAccount(deletingAccount.id);
      setIsDeleteModalOpen(false);
      setDeletingAccount(null);
      setDeleteError(null);
      await loadData();
    } catch (err) {
      // Show error in the modal instead of the global error
      const message = err instanceof Error ? err.message : 'Failed to delete account';
      setDeleteError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdjustSubmit = async (newBalance: number, notes: string) => {
    if (!adjustingAccount) return;

    try {
      setIsSubmitting(true);
      await adjustBalance(adjustingAccount.id, { newBalance, notes });
      setIsAdjustModalOpen(false);
      setAdjustingAccount(null);
      await loadData();
    } catch {
      setError('Failed to adjust balance');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Accounts</h1>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Account
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
          <button onClick={() => setError(null)} className="float-right font-bold">×</button>
        </div>
      )}

      {/* Summary Card */}
      {summary && accounts.length > 0 && <SummaryCard summary={summary} onRefreshRates={handleRefreshRates} />}

      {/* Show Archived Toggle */}
      {accounts.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <input
            type="checkbox"
            id="showArchived"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label htmlFor="showArchived" className="text-sm text-gray-600">
            Show archived accounts
          </label>
        </div>
      )}

      {/* Empty State */}
      {accounts.length === 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
            </svg>
          </div>
          <h2 className="text-lg font-medium text-gray-900 mb-2">No Accounts Yet</h2>
          <p className="text-gray-500 mb-4">
            Add your bank accounts, credit cards, and other financial accounts to track your money.
          </p>
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Your First Account
          </button>
        </div>
      )}

      {/* Accounts grouped by type */}
      {accounts.length > 0 && (
        <div className="space-y-6">
          {(Object.keys(groupedAccounts) as AccountType[]).map((type) => {
            const typeAccounts = groupedAccounts[type];
            if (typeAccounts.length === 0) return null;

            const config = accountTypeConfig[type];
            // Use the converted total from summary (properly handles multi-currency)
            const typeTotal = summary?.balancesByType?.[type] ?? 0;

            return (
              <div key={type}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <span>{config.icon}</span>
                    {config.label}s
                    <span className="text-sm font-normal text-gray-500">
                      ({typeAccounts.length})
                    </span>
                  </h2>
                  <span
                    className={`text-lg font-semibold ${
                      config.isLiability ? 'text-red-600' : 'text-gray-900'
                    }`}
                  >
                    {formatCurrencyWithCode(typeTotal, summary?.primaryCurrency || 'INR')}
                  </span>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {typeAccounts.map((account) => (
                    <AccountCard
                      key={account.id}
                      account={account}
                      onEdit={() => handleEdit(account)}
                      onDelete={() => handleDelete(account)}
                      onAdjustBalance={() => handleAdjustBalance(account)}
                      onArchiveToggle={() => handleArchiveToggle(account)}
                      formatWithConversion={formatWithConversion}
                      primaryCurrency={userPrimaryCurrency}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <AccountModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setModalError(null);
        }}
        onSubmit={handleModalSubmit}
        editingAccount={editingAccount}
        isLoading={isSubmitting}
        primaryCurrency={summary?.primaryCurrency || 'USD'}
        error={modalError}
      />

      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDeletingAccount(null);
          setDeleteError(null);
        }}
        onConfirm={handleDeleteConfirm}
        onArchive={handleArchiveFromDeleteModal}
        accountName={deletingAccount?.name || ''}
        isLoading={isSubmitting}
        errorMessage={deleteError}
      />

      <AdjustBalanceModal
        isOpen={isAdjustModalOpen}
        onClose={() => {
          setIsAdjustModalOpen(false);
          setAdjustingAccount(null);
        }}
        onSubmit={handleAdjustSubmit}
        account={adjustingAccount}
        isLoading={isSubmitting}
      />
    </div>
  );
}
