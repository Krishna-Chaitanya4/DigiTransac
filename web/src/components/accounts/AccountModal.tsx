import { useState, useEffect } from 'react';
import { logger } from '../../services/logger';
import {
  Account,
  AccountType,
  CreateAccountRequest,
  UpdateAccountRequest,
  accountTypeConfig,
} from '../../services/accountService';
import { 
  getCurrencySymbol, 
  Currency,
  getSupportedCurrencies,
  COMMON_CURRENCIES,
} from '../../services/currencyService';

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

export function AccountModal({ isOpen, onClose, onSubmit, editingAccount, isLoading, primaryCurrency, error }: AccountModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('Bank');
  const [color, setColor] = useState('');
  const [currency, setCurrency] = useState(primaryCurrency);
  const [initialBalance, setInitialBalance] = useState('0');
  const [institution, setInstitution] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [includeInNetWorth, setIncludeInNetWorth] = useState(true);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  
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
      // Always start collapsed - user can expand if needed
      setShowAdvancedOptions(false);
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
      setShowAdvancedOptions(false);
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

  // Filter currencies for dropdown
  const filteredCurrencies = currencies.filter(c => 
    currencySearch === '' 
      ? COMMON_CURRENCIES.includes(c.code)
      : c.code.toLowerCase().includes(currencySearch.toLowerCase()) ||
        c.name.toLowerCase().includes(currencySearch.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/30" onClick={onClose} />
        <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            {editingAccount ? 'Edit Account' : 'New Account'}
          </h3>

          <form onSubmit={handleSubmit}>
            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                  <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {/* Account Name */}
              <div>
                <label htmlFor="accountName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Account Name *
                </label>
                <input
                  type="text"
                  id="accountName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., HDFC Savings"
                  required
                  autoFocus
                />
              </div>

              {/* Account Type (only for new accounts) */}
              {!editingAccount && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-700'
                        }`}
                      >
                        <span className="text-xl">{accountTypeConfig[t].icon}</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{accountTypeConfig[t].label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Initial Balance / Currency Section */}
              {!editingAccount ? (
                <div>
                  <label htmlFor="initialBalance" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Initial Balance
                  </label>
                  <div className="flex gap-2">
                    <CurrencyDropdown
                      currency={currency}
                      currencies={filteredCurrencies}
                      isOpen={isCurrencyDropdownOpen}
                      onToggle={() => setIsCurrencyDropdownOpen(!isCurrencyDropdownOpen)}
                      onSelect={(code) => {
                        setCurrency(code);
                        setIsCurrencyDropdownOpen(false);
                        setCurrencySearch('');
                      }}
                      search={currencySearch}
                      onSearchChange={setCurrencySearch}
                    />
                    <input
                      type="number"
                      id="initialBalance"
                      value={initialBalance}
                      onChange={(e) => setInitialBalance(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0.00"
                      step="0.01"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {accountTypeConfig[type].isLiability
                      ? 'Enter the amount you owe (as positive number)'
                      : 'Enter your current balance'}
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Currency
                  </label>
                  {editingAccount.canEditCurrency ? (
                    <CurrencyDropdown
                      currency={currency}
                      currencies={filteredCurrencies}
                      isOpen={isCurrencyDropdownOpen}
                      onToggle={() => setIsCurrencyDropdownOpen(!isCurrencyDropdownOpen)}
                      onSelect={(code) => {
                        setCurrency(code);
                        setIsCurrencyDropdownOpen(false);
                        setCurrencySearch('');
                      }}
                      search={currencySearch}
                      onSearchChange={setCurrencySearch}
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium">
                        <span>{getCurrencySymbol(currency)}</span>
                        <span>{currency}</span>
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        🔒 Locked (has transactions)
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Color */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Color
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {PRESET_COLORS.map((presetColor) => (
                    <button
                      key={presetColor}
                      type="button"
                      onClick={() => setColor(presetColor)}
                      className={`w-8 h-8 rounded-full border-2 ${
                        color === presetColor ? 'border-gray-900 dark:border-gray-100 scale-110' : 'border-transparent'
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
                    className="w-10 h-10 p-1 border border-gray-300 dark:border-gray-600 rounded cursor-pointer"
                  />
                  {color && (
                    <button
                      type="button"
                      onClick={() => setColor('')}
                      className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      Use default
                    </button>
                  )}
                </div>
              </div>

              {/* Advanced Options Toggle */}
              <button
                type="button"
                onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400
                  hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
              >
                <svg
                  className={`w-4 h-4 transition-transform ${showAdvancedOptions ? 'rotate-90' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
                Advanced options
              </button>

              {/* Advanced Options Section */}
              {showAdvancedOptions && (
                <div className="space-y-4 pt-2">
                  {/* Institution */}
                  <div>
                    <label htmlFor="institution" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Institution / Bank
                    </label>
                    <input
                      type="text"
                      id="institution"
                      value={institution}
                      onChange={(e) => setInstitution(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., HDFC Bank"
                    />
                  </div>

                  {/* Account Number */}
                  <div>
                    <label htmlFor="accountNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Account Number (last 4 digits)
                    </label>
                    <input
                      type="text"
                      id="accountNumber"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., ****1234"
                      maxLength={10}
                    />
                  </div>

                  {/* Notes */}
                  <div>
                    <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Notes
                    </label>
                    <textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                      className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 dark:bg-gray-700"
                    />
                    <label htmlFor="includeInNetWorth" className="text-sm text-gray-700 dark:text-gray-300">
                      Include in net worth calculation
                    </label>
                  </div>
                </div>
              )}
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

// Currency dropdown sub-component
interface CurrencyDropdownProps {
  currency: string;
  currencies: Currency[];
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (code: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
}

function CurrencyDropdown({ currency, currencies, isOpen, onToggle, onSelect, search, onSearchChange }: CurrencyDropdownProps) {
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  // Reset highlighted index when search changes or dropdown opens
  useEffect(() => {
    setHighlightedIndex(0);
  }, [search, isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        onToggle();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => Math.min(prev + 1, currencies.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (currencies[highlightedIndex]) {
          onSelect(currencies[highlightedIndex].code);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onToggle();
        break;
      case 'Tab':
        onToggle();
        break;
    }
  };

  return (
    <div className="relative flex-shrink-0" onKeyDown={handleKeyDown}>
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-sm font-medium text-gray-700 dark:text-gray-200 min-w-[90px]"
      >
        <span>{getCurrencySymbol(currency)}</span>
        <span className="text-gray-600">{currency}</span>
        <svg className="w-4 h-4 text-gray-400 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isOpen && (
        <div className="absolute z-20 mt-1 w-64 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg">
          <div className="p-2 border-b border-gray-100 dark:border-gray-600">
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search currencies..."
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {search === '' && (
              <div className="px-3 py-1 text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-600">Common Currencies</div>
            )}
            {currencies.map((c, index) => (
              <button
                key={c.code}
                type="button"
                onClick={() => onSelect(c.code)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left ${
                  index === highlightedIndex
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : c.code === currency
                    ? 'bg-gray-50 dark:bg-gray-600'
                    : 'text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
              >
                <span className="w-6">{c.symbol}</span>
                <span className="flex-1">{c.name}</span>
                <span className="text-gray-400 dark:text-gray-500">{c.code}</span>
              </button>
            ))}
            {currencies.length === 0 && (
              <p className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">No currencies found</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
