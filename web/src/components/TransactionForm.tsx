import { useState, useEffect } from 'react';
import { CalculatorInput, QuickAmountButtons } from './CalculatorInput';
import { DatePicker } from './DatePicker';
import { SearchableCategoryDropdown } from './SearchableCategoryDropdown';
import { 
  TransactionTypeSelector, 
  TagTokenInput, 
  RecurringSection, 
  SplitCategoriesSection,
  LocationPicker,
  validateSplits,
} from './transaction-form';
import { useFocusTrap } from '../hooks/useFocusTrap';
import type {
  Transaction,
  TransactionType,
  TransactionUIType,
  RecurrenceFrequency,
  CreateTransactionRequest,
  UpdateTransactionRequest,
  TransactionSplitRequest,
  TransactionLocationRequest,
} from '../types/transactions';
import type { Account } from '../services/accountService';
import type { Label } from '../types/labels';
import type { Tag } from '../types/labels';
import { getCurrencySymbol } from '../services/currencyService';

// Date utility functions - store dates at noon UTC to avoid timezone day-shift issues
const toNoonUTC = (dateStr: string): string => `${dateStr}T12:00:00.000Z`;

const toDateString = (dateInput: string | Date): string => {
  if (typeof dateInput === 'string') {
    return dateInput.split('T')[0];
  }
  const d = new Date(dateInput);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};

interface TransactionFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateTransactionRequest | UpdateTransactionRequest) => void;
  onCreateTag?: (name: string) => Promise<Tag | null>;
  editingTransaction: Transaction | null;
  accounts: Account[];
  labels: Label[];
  tags: Tag[];
  defaultAccountId?: string;
  isLoading: boolean;
  autoLocationEnabled?: boolean;
  error?: string | null;
  // Chat context props
  hideRecipientField?: boolean;
  showTransfer?: boolean;
  fixedCounterpartyEmail?: string;
  hidePayeeField?: boolean;
}

export function TransactionForm({
  isOpen,
  onClose,
  onSubmit,
  onCreateTag,
  editingTransaction,
  accounts,
  labels,
  tags,
  defaultAccountId,
  isLoading,
  autoLocationEnabled = true,
  error,
  // Chat context props
  hideRecipientField = false,
  showTransfer = true,
  fixedCounterpartyEmail,
  hidePayeeField = false,
}: TransactionFormProps) {
  // Focus trap for modal accessibility
  const modalRef = useFocusTrap<HTMLDivElement>(isOpen);
  
  // Core transaction state
  // Note: type uses TransactionUIType (includes Transfer for UI) but converts to TransactionType for API
  const [type, setType] = useState<TransactionUIType>('Send');
  const [accountId, setAccountId] = useState(defaultAccountId || '');
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(toDateString(new Date()));
  const [title, setTitle] = useState('');
  const [payee, setPayee] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedLabelId, setSelectedLabelId] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [transferToAccountId, setTransferToAccountId] = useState('');
  
  // P2P state (optional for Send/Receive)
  const [counterpartyEmail, setCounterpartyEmail] = useState('');
  
  // Recurring state
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<RecurrenceFrequency>('Monthly');
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  
  // Location state
  const [includeLocation, setIncludeLocation] = useState(false);
  const [location, setLocation] = useState<TransactionLocationRequest | null>(null);
  
  // Split transactions state
  const [splits, setSplits] = useState<TransactionSplitRequest[]>([]);
  const [showSplits, setShowSplits] = useState(false);

  // Derived values
  const selectedAccount = accounts.find(a => a.id === accountId);
  const currencySymbol = selectedAccount ? getCurrencySymbol(selectedAccount.currency) : '$';
  const categories = labels.filter(l => l.type === 'Category');
  const splitsValid = showSplits ? validateSplits(splits, amount) : true;
  const isNewTransaction = !editingTransaction;

  // Reset form when opening/closing
  useEffect(() => {
    if (isOpen) {
      if (editingTransaction) {
        // Populate form with existing transaction data
        // Detect if this is a transfer: has transferToAccountId (means it was created as transfer)
        const isTransfer = !!editingTransaction.transferToAccountId;
        const uiType: TransactionUIType = isTransfer ? 'Transfer' : editingTransaction.type;
        setType(uiType);
        setAccountId(editingTransaction.accountId);
        setAmount(editingTransaction.amount);
        setDate(toDateString(editingTransaction.date));
        setTitle(editingTransaction.title || '');
        setPayee(editingTransaction.payee || '');
        setNotes(editingTransaction.notes || '');
        setSelectedTagIds(editingTransaction.tagIds || []);
        setTransferToAccountId(editingTransaction.transferToAccountId || '');
        
        // Set P2P fields from editing transaction
        setCounterpartyEmail(editingTransaction.counterpartyEmail || '');
        
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

        // Reset recurring state (can't edit recurring)
        setIsRecurring(false);
        setRecurrenceFrequency('Monthly');
        setRecurrenceInterval(1);
        setRecurrenceEndDate('');
      } else {
        // Reset to defaults for new transaction
        const categoryLabels = labels.filter(l => l.type === 'Category');
        setType('Send');
        setAccountId(defaultAccountId || accounts[0]?.id || '');
        setAmount(0);
        setDate(toDateString(new Date()));
        setTitle('');
        setPayee('');
        setNotes('');
        setSelectedLabelId(categoryLabels[0]?.id || '');
        setSplits([]);
        setSelectedTagIds([]);
        setTransferToAccountId('');
        setCounterpartyEmail(fixedCounterpartyEmail || '');
        setIsRecurring(false);
        setRecurrenceFrequency('Monthly');
        setRecurrenceInterval(1);
        setRecurrenceEndDate('');
        setIncludeLocation(false);
        setLocation(null);
        setShowSplits(false);
      }
    }
  }, [isOpen, editingTransaction, defaultAccountId, accounts, labels]);

  // Auto-select "To Account" for transfers
  useEffect(() => {
    if (type === 'Transfer' && !editingTransaction) {
      // Find first non-archived account that's different from the selected account
      const availableAccounts = accounts.filter(a => !a.isArchived && a.id !== accountId);
      if (availableAccounts.length > 0 && !transferToAccountId) {
        setTransferToAccountId(availableAccounts[0].id);
      } else if (transferToAccountId === accountId) {
        // If current "To" account matches "From", select a different one
        setTransferToAccountId(availableAccounts[0]?.id || '');
      }
    }
  }, [type, accountId, accounts, editingTransaction, transferToAccountId]);

  // Update single split when amount or label changes (non-split mode)
  useEffect(() => {
    if (!showSplits && selectedLabelId && amount > 0) {
      setSplits([{ labelId: selectedLabelId, amount, notes: undefined }]);
    } else if (!showSplits && amount <= 0) {
      setSplits([]);
    }
  }, [amount, selectedLabelId, showSplits]);

  // Handlers
  const handleLocationChange = (newLocation: TransactionLocationRequest | null, include: boolean) => {
    setLocation(newLocation);
    setIncludeLocation(include);
  };

  const toggleTag = (tagId: string) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const handleStartSplit = () => {
    setShowSplits(true);
    setSplits([{ labelId: selectedLabelId, amount, notes: undefined }]);
  };

  const handleCancelSplit = () => {
    setShowSplits(false);
    setSplits([{ labelId: selectedLabelId || categories[0]?.id || '', amount, notes: undefined }]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const finalSplits = showSplits ? splits : [{ labelId: selectedLabelId, amount, notes: undefined }];
    // P2P applies to Send/Receive transactions with counterparty email
    // In chat context, counterpartyEmail is set from fixedCounterpartyEmail
    const effectiveCounterpartyEmail = counterpartyEmail.trim();
    const isP2P = (type === 'Send' || type === 'Receive') && effectiveCounterpartyEmail;
    
    // Convert UI type to API type: Transfer -> Send (backend creates linked Send+Receive)
    const apiType: TransactionType = type === 'Transfer' ? 'Send' : type;
    const isTransfer = type === 'Transfer';
    
    if (editingTransaction) {
      const updateData: UpdateTransactionRequest = {
        type: apiType,
        amount,
        date: toNoonUTC(date),
        title: title.trim() || undefined,
        payee: payee.trim() || undefined,
        notes: notes.trim() || undefined,
        splits: finalSplits,
        tagIds: selectedTagIds,
        location: includeLocation && location ? location : undefined,
        transferToAccountId: isTransfer ? transferToAccountId : undefined,
        accountId,
      };
      onSubmit(updateData);
    } else {
      const createData: CreateTransactionRequest = {
        accountId,
        type: apiType,
        amount,
        date: toNoonUTC(date),
        title: title.trim() || undefined,
        payee: payee.trim() || undefined,
        notes: notes.trim() || undefined,
        splits: finalSplits,
        tagIds: selectedTagIds,
        location: includeLocation && location ? location : undefined,
        transferToAccountId: isTransfer ? transferToAccountId : undefined,
        recurringRule: isRecurring ? {
          frequency: recurrenceFrequency,
          interval: recurrenceInterval,
          endDate: recurrenceEndDate || undefined,
        } : undefined,
        // P2P fields (for Send/Receive with counterparty email)
        counterpartyEmail: isP2P ? effectiveCounterpartyEmail : undefined,
      };
      onSubmit(createData);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="transaction-form-title"
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/30 dark:bg-black/50" onClick={onClose} aria-hidden="true" />
        <div 
          ref={modalRef}
          className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto"
          onKeyDown={(e) => e.key === 'Escape' && onClose()}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
            aria-label="Close dialog"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <h3 id="transaction-form-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            {editingTransaction ? 'Edit Transaction' : 'New Transaction'}
          </h3>

          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              {/* Transaction Type */}
              <TransactionTypeSelector value={type} onChange={setType} showTransfer={showTransfer} />

              {/* Account Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {type === 'Transfer' ? 'From Account' : 'Account'} *
                </label>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                    bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                    focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

              {/* Transfer: To Account selector */}
              {type === 'Transfer' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    To Account *
                  </label>
                  {accounts.filter(a => !a.isArchived && a.id !== accountId).length === 0 ? (
                    <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
                      <p className="text-sm text-yellow-700 dark:text-yellow-300">
                        You need at least two accounts to transfer between them. 
                        Create another account first.
                      </p>
                    </div>
                  ) : (
                    <>
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
                      {/* Currency conversion info */}
                      {transferToAccountId && (() => {
                        const destAccount = accounts.find(a => a.id === transferToAccountId);
                        const sourceAccount = accounts.find(a => a.id === accountId);
                        const isCrossCurrency = destAccount && sourceAccount && destAccount.currency !== sourceAccount.currency;
                        return isCrossCurrency ? (
                          <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                            <span className="inline-flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                              </svg>
                              Amount will be converted from {sourceAccount.currency} to {destAccount.currency}
                            </span>
                          </p>
                        ) : null;
                      })()}
                    </>
                  )}
                </div>
              )}

              {/* P2P: Counterparty email (only for Send - sender initiates P2P) */}
              {/* Hidden when in chat context (hideRecipientField=true) since recipient is the conversation partner */}
              {type === 'Send' && !hideRecipientField && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Recipient's Email (optional)
                  </label>
                  <input
                    type="email"
                    value={counterpartyEmail}
                    onChange={(e) => setCounterpartyEmail(e.target.value)}
                    placeholder="friend@example.com"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                      bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                      focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                    If they're on DigiTransac, they'll see this transaction too
                  </p>
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
              <DatePicker
                label="Date *"
                value={date}
                onChange={setDate}
                maxDate={new Date()}
              />

              {/* Category (Single Mode) - Hidden for self-transfers */}
              {!showSplits && type !== 'Transfer' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Category *
                    </label>
                    <button
                      type="button"
                      onClick={handleStartSplit}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Split transaction
                    </button>
                  </div>
                  <SearchableCategoryDropdown
                    value={selectedLabelId}
                    onChange={setSelectedLabelId}
                    categories={categories}
                    placeholder="Select category..."
                  />
                </div>
              )}

              {/* Category (Locked for self-transfers only) */}
              {type === 'Transfer' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Category
                  </label>
                  <div className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg 
                    bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    <span>🔁</span>
                    <span>Account Transfer</span>
                    <svg className="w-4 h-4 ml-auto" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                    </svg>
                  </div>
                </div>
              )}

              {/* Split Categories - Hidden for transfers */}
              {showSplits && type !== 'Transfer' && (
                <SplitCategoriesSection
                  splits={splits}
                  onSplitsChange={setSplits}
                  categories={categories}
                  amount={amount}
                  currencySymbol={currencySymbol}
                  onCancelSplit={handleCancelSplit}
                />
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

              {/* Payee/Payer - hidden for transfers and when hidePayeeField is true */}
              {type !== 'Transfer' && !hidePayeeField && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {type === 'Send' ? 'Payee' : 'Payer'}
                  </label>
                  <input
                    type="text"
                    value={payee}
                    onChange={(e) => setPayee(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                      bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                      focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={type === 'Send' ? 'e.g., Supermarket' : 'e.g., Employer'}
                  />
                </div>
              )}

              {/* Tags */}
              <TagTokenInput
                tags={tags}
                selectedTagIds={selectedTagIds}
                onToggleTag={toggleTag}
                onCreateTag={onCreateTag}
              />

              {/* Location */}
              <LocationPicker
                location={location}
                onChange={handleLocationChange}
                autoCapture={isNewTransaction && autoLocationEnabled}
              />

              {/* Recurring (only for new transactions) */}
              {isNewTransaction && (
                <RecurringSection
                  isRecurring={isRecurring}
                  onIsRecurringChange={setIsRecurring}
                  frequency={recurrenceFrequency}
                  onFrequencyChange={setRecurrenceFrequency}
                  interval={recurrenceInterval}
                  onIntervalChange={setRecurrenceInterval}
                  endDate={recurrenceEndDate}
                  onEndDateChange={setRecurrenceEndDate}
                />
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

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 
                rounded-lg text-red-600 dark:text-red-400 text-sm mt-4">
                {error}
              </div>
            )}

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
                disabled={isLoading || amount <= 0 || !accountId || 
                  (type === 'Transfer' 
                    ? !transferToAccountId 
                    : ((!showSplits && !selectedLabelId) || (showSplits && !splitsValid)))}
                className="flex-1 px-4 py-2 bg-gradient-to-br from-blue-600 to-blue-700 dark:from-blue-900 dark:to-blue-950 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 dark:hover:from-blue-800 dark:hover:to-blue-900 
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
