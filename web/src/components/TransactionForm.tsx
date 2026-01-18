import { useState, useEffect } from 'react';
import { CalculatorInput, QuickAmountButtons } from './CalculatorInput';
import { DatePicker } from './DatePicker';
import type {
  Transaction,
  TransactionType,
  RecurrenceFrequency,
  CreateTransactionRequest,
  UpdateTransactionRequest,
  TransactionSplitRequest,
  TransactionLocationRequest,
} from '../types/transactions';
import { recurrenceFrequencyConfig } from '../types/transactions';
import type { Account } from '../services/accountService';
import type { Label } from '../types/labels';
import type { Tag } from '../types/labels';
import { getCurrencySymbol } from '../services/currencyService';
import { getCurrentPosition, reverseGeocode } from '../services/locationService';
import { logger } from '../services/logger';

// Date utility functions - store dates at noon UTC to avoid timezone day-shift issues
// When a user selects a date, we want that calendar date to be preserved regardless of timezone
const toNoonUTC = (dateStr: string): string => {
  // Convert YYYY-MM-DD to noon UTC to avoid day shifts across timezones
  return `${dateStr}T12:00:00.000Z`;
};

const toDateString = (dateInput: string | Date): string => {
  // Extract YYYY-MM-DD from a date, handling both ISO strings and Date objects
  if (typeof dateInput === 'string') {
    // If it's an ISO string like "2026-01-18T12:00:00.000Z", extract the date part
    return dateInput.split('T')[0];
  }
  // For Date objects, format as YYYY-MM-DD
  const d = new Date(dateInput);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};

interface TransactionFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateTransactionRequest | UpdateTransactionRequest) => void;
  editingTransaction: Transaction | null;
  accounts: Account[];
  labels: Label[];
  tags: Tag[];
  defaultAccountId?: string;
  isLoading: boolean;
}

export function TransactionForm({
  isOpen,
  onClose,
  onSubmit,
  editingTransaction,
  accounts,
  labels,
  tags,
  defaultAccountId,
  isLoading,
}: TransactionFormProps) {
  const [type, setType] = useState<TransactionType>('Debit');
  const [accountId, setAccountId] = useState(defaultAccountId || '');
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(toDateString(new Date()));
  const [title, setTitle] = useState('');
  const [payee, setPayee] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedLabelId, setSelectedLabelId] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [transferToAccountId, setTransferToAccountId] = useState('');
  
  // Recurring
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<RecurrenceFrequency>('Monthly');
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  
  // Location
  const [includeLocation, setIncludeLocation] = useState(false);
  const [location, setLocation] = useState<TransactionLocationRequest | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  
  // Split transactions
  const [splits, setSplits] = useState<TransactionSplitRequest[]>([]);
  const [showSplits, setShowSplits] = useState(false);

  // Get selected account
  const selectedAccount = accounts.find(a => a.id === accountId);
  const currencySymbol = selectedAccount ? getCurrencySymbol(selectedAccount.currency) : '$';

  // Filter labels to only show categories (memoized)
  const categories = labels.filter(l => l.type === 'Category');

  // Reset form when opening/closing or changing editing transaction
  useEffect(() => {
    if (isOpen) {
      const categoryLabels = labels.filter(l => l.type === 'Category');
      if (editingTransaction) {
        setType(editingTransaction.type);
        setAccountId(editingTransaction.accountId);
        setAmount(editingTransaction.amount);
        setDate(toDateString(editingTransaction.date));
        setTitle(editingTransaction.title || '');
        setPayee(editingTransaction.payee || '');
        setNotes(editingTransaction.notes || '');
        setSelectedTagIds(editingTransaction.tagIds || []);
        setTransferToAccountId(editingTransaction.transferToAccountId || '');
        
        if (editingTransaction.splits.length > 0) {
          setSplits(editingTransaction.splits.map(s => ({
            labelId: s.labelId,
            amount: s.amount,
            notes: s.notes,
          })));
          setSelectedLabelId(editingTransaction.splits[0].labelId);
          setShowSplits(editingTransaction.splits.length > 1);
        } else {
          setSplits([]);
          setSelectedLabelId('');
          setShowSplits(false);
        }
        
        if (editingTransaction.location) {
          setLocation(editingTransaction.location);
          setIncludeLocation(true);
        } else {
          setLocation(null);
          setIncludeLocation(false);
        }

        // Recurring transactions can't be edited, but reset state
        setIsRecurring(false);
        setRecurrenceFrequency('Monthly');
        setRecurrenceInterval(1);
        setRecurrenceEndDate('');
      } else {
        // Reset to defaults
        setType('Debit');
        setAccountId(defaultAccountId || accounts[0]?.id || '');
        setAmount(0);
        setDate(toDateString(new Date()));
        setTitle('');
        setPayee('');
        setNotes('');
        setSelectedLabelId(categoryLabels[0]?.id || '');
        setSelectedTagIds([]);
        setTransferToAccountId('');
        setIsRecurring(false);
        setRecurrenceFrequency('Monthly');
        setRecurrenceInterval(1);
        setRecurrenceEndDate('');
        setIncludeLocation(false);
        setLocation(null);
        setSplits([]);
        setShowSplits(false);
      }
    }
  }, [isOpen, editingTransaction, defaultAccountId, accounts, labels]);

  // Update single split when amount or label changes (non-split mode)
  useEffect(() => {
    if (!showSplits && selectedLabelId && amount > 0) {
      setSplits([{ labelId: selectedLabelId, amount, notes: undefined }]);
    }
  }, [amount, selectedLabelId, showSplits]);

  // Capture location
  const captureLocation = async () => {
    setIsLoadingLocation(true);
    try {
      const coords = await getCurrentPosition();
      if (coords) {
        const geoInfo = await reverseGeocode(coords);
        setLocation({
          latitude: coords.latitude,
          longitude: coords.longitude,
          placeName: geoInfo?.city || undefined,
          city: geoInfo?.city,
          country: geoInfo?.country,
        });
        setIncludeLocation(true);
      }
    } catch (error) {
      logger.error('Failed to capture location:', error);
    } finally {
      setIsLoadingLocation(false);
    }
  };

  // Add new split
  const addSplit = () => {
    const remaining = amount - splits.reduce((sum, s) => sum + s.amount, 0);
    setSplits([...splits, { labelId: categories[0]?.id || '', amount: Math.max(0, remaining), notes: undefined }]);
  };

  // Update split
  const updateSplit = (index: number, field: keyof TransactionSplitRequest, value: string | number) => {
    const newSplits = [...splits];
    newSplits[index] = { ...newSplits[index], [field]: value };
    setSplits(newSplits);
  };

  // Remove split
  const removeSplit = (index: number) => {
    setSplits(splits.filter((_, i) => i !== index));
  };

  // Validate splits sum
  const splitsSum = splits.reduce((sum, s) => sum + s.amount, 0);
  const splitsDiff = Math.abs(splitsSum - amount);
  const splitsValid = splitsDiff < 0.01;

  // Toggle tag selection
  const toggleTag = (tagId: string) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Build splits
    const finalSplits = showSplits ? splits : [{ labelId: selectedLabelId, amount, notes: undefined }];
    
    if (editingTransaction) {
      const updateData: UpdateTransactionRequest = {
        type,
        amount,
        date: toNoonUTC(date),
        title: title.trim() || undefined,
        payee: payee.trim() || undefined,
        notes: notes.trim() || undefined,
        splits: finalSplits,
        tagIds: selectedTagIds,
        location: includeLocation && location ? location : undefined,
        transferToAccountId: type === 'Transfer' ? transferToAccountId : undefined,
      };
      onSubmit(updateData);
    } else {
      const createData: CreateTransactionRequest = {
        accountId,
        type,
        amount,
        date: toNoonUTC(date),
        title: title.trim() || undefined,
        payee: payee.trim() || undefined,
        notes: notes.trim() || undefined,
        splits: finalSplits,
        tagIds: selectedTagIds,
        location: includeLocation && location ? location : undefined,
        transferToAccountId: type === 'Transfer' ? transferToAccountId : undefined,
        recurringRule: isRecurring ? {
          frequency: recurrenceFrequency,
          interval: recurrenceInterval,
          endDate: recurrenceEndDate || undefined,
        } : undefined,
      };
      onSubmit(createData);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/30 dark:bg-black/50" onClick={onClose} />
        <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            {editingTransaction ? 'Edit Transaction' : 'New Transaction'}
          </h3>

          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              {/* Transaction Type Tabs */}
              <div className="flex rounded-lg bg-gray-100 dark:bg-gray-700 p-1">
                {(['Debit', 'Credit', 'Transfer'] as TransactionType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                      type === t
                        ? t === 'Debit' 
                          ? 'bg-red-500 text-white'
                          : t === 'Credit'
                          ? 'bg-green-500 text-white'
                          : 'bg-blue-500 text-white'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {/* Account Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {type === 'Transfer' ? 'From Account' : 'Account'} *
                </label>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  disabled={!!editingTransaction}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                    bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                    focus:ring-2 focus:ring-blue-500 focus:border-transparent
                    disabled:bg-gray-100 dark:disabled:bg-gray-800"
                  required
                >
                  <option value="">Select account...</option>
                  {accounts.filter(a => !a.isArchived).map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} ({account.currency})
                    </option>
                  ))}
                </select>
              </div>

              {/* Transfer To Account */}
              {type === 'Transfer' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    To Account *
                  </label>
                  <select
                    value={transferToAccountId}
                    onChange={(e) => setTransferToAccountId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                      bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                      focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select destination...</option>
                    {accounts.filter(a => !a.isArchived && a.id !== accountId).map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name} ({account.currency})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Amount *
                </label>
                <CalculatorInput
                  value={amount}
                  onChange={setAmount}
                  currency={currencySymbol}
                  placeholder="0.00"
                  autoFocus={!editingTransaction}
                />
                <QuickAmountButtons
                  amounts={[10, 20, 50, 100, 500]}
                  onSelect={setAmount}
                  currency={currencySymbol}
                />
              </div>

              {/* Date */}
              <div>
                <DatePicker
                  label="Date *"
                  value={date}
                  onChange={setDate}
                  maxDate={new Date()}
                />
              </div>

              {/* Category (Single Split Mode) */}
              {!showSplits && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Category *
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowSplits(true);
                        setSplits([{ labelId: selectedLabelId, amount, notes: undefined }]);
                      }}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Split transaction
                    </button>
                  </div>
                  <select
                    value={selectedLabelId}
                    onChange={(e) => setSelectedLabelId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                      bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                      focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select category...</option>
                    {categories.map((label) => (
                      <option key={label.id} value={label.id}>
                        {label.icon} {label.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Split Categories */}
              {showSplits && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Split Categories
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowSplits(false);
                        setSplits([{ labelId: selectedLabelId || categories[0]?.id || '', amount, notes: undefined }]);
                      }}
                      className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
                    >
                      Cancel split
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    {splits.map((split, index) => (
                      <div key={index} className="flex gap-2 items-start">
                        <select
                          value={split.labelId}
                          onChange={(e) => updateSplit(index, 'labelId', e.target.value)}
                          className="flex-1 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded 
                            bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                        >
                          <option value="">Category...</option>
                          {categories.map((label) => (
                            <option key={label.id} value={label.id}>
                              {label.icon} {label.name}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          value={split.amount}
                          onChange={(e) => updateSplit(index, 'amount', parseFloat(e.target.value) || 0)}
                          className="w-24 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded 
                            bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                          placeholder="Amount"
                          step="0.01"
                          min="0"
                        />
                        {splits.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeSplit(index)}
                            className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex justify-between items-center mt-2">
                    <button
                      type="button"
                      onClick={addSplit}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      + Add split
                    </button>
                    <span className={`text-sm ${splitsValid ? 'text-green-600' : 'text-red-600'}`}>
                      Total: {currencySymbol}{splitsSum.toFixed(2)} / {currencySymbol}{amount.toFixed(2)}
                    </span>
                  </div>
                  
                  {!splitsValid && (
                    <p className="text-xs text-red-500 mt-1">
                      Split amounts must equal the transaction amount
                    </p>
                  )}
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                    bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                    focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Grocery shopping"
                />
              </div>

              {/* Payee */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Payee
                </label>
                <input
                  type="text"
                  value={payee}
                  onChange={(e) => setPayee(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                    bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                    focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Supermarket"
                />
              </div>

              {/* Tags */}
              {tags.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tags
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        className={`px-3 py-1 text-sm rounded-full transition-colors ${
                          selectedTagIds.includes(tag.id)
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                        style={selectedTagIds.includes(tag.id) && tag.color ? { backgroundColor: tag.color } : undefined}
                      >
                        {tag.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Location */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Location
                  </label>
                  {!location && (
                    <button
                      type="button"
                      onClick={captureLocation}
                      disabled={isLoadingLocation}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
                    >
                      {isLoadingLocation ? 'Getting location...' : '📍 Add current location'}
                    </button>
                  )}
                </div>
                {location && (
                  <div className="mt-1 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      📍 {location.city || location.placeName || 'Location captured'}
                      {location.country && `, ${location.country}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setLocation(null);
                        setIncludeLocation(false);
                      }}
                      className="text-gray-400 hover:text-red-500"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              {/* Recurring (only for new transactions) */}
              {!editingTransaction && (
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isRecurring}
                      onChange={(e) => setIsRecurring(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Make this recurring
                    </span>
                  </label>
                  
                  {isRecurring && (
                    <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg space-y-3">
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                            Frequency
                          </label>
                          <select
                            value={recurrenceFrequency}
                            onChange={(e) => setRecurrenceFrequency(e.target.value as RecurrenceFrequency)}
                            className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded 
                              bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 text-sm"
                          >
                            {Object.entries(recurrenceFrequencyConfig).map(([key, { label }]) => (
                              <option key={key} value={key}>{label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="w-20">
                          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                            Every
                          </label>
                          <input
                            type="number"
                            value={recurrenceInterval}
                            onChange={(e) => setRecurrenceInterval(parseInt(e.target.value) || 1)}
                            min="1"
                            max="99"
                            className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded 
                              bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <DatePicker
                          label="End Date (optional)"
                          value={recurrenceEndDate}
                          onChange={setRecurrenceEndDate}
                          minDate={new Date()}
                          placeholder="No end date"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                    bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                    focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="Additional notes..."
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 
                  rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || amount <= 0 || !accountId || (showSplits && !splitsValid)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                  font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Saving...' : editingTransaction ? 'Update' : 'Add Transaction'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
