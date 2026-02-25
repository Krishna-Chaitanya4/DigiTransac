import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
import { useCurrency } from '../context/CurrencyContext';
import { useIsMobile } from '../hooks/useMediaQuery';
import { getCurrentPosition, reverseGeocode } from '../services/locationService';
import { logger } from '../services/logger';
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

// Date utility functions for timezone-aware date handling
// The form uses date + time + timezone as INPUT controls to compute real UTC.
// Only the UTC `date` field is sent to the API and stored.

/**
 * Get the user's current IANA timezone identifier (e.g., "Asia/Kolkata", "America/New_York")
 */
const getUserTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
};

/**
 * Convert a local date + time + timezone to a UTC ISO string.
 * WhatsApp-style: we store only the true UTC instant; display uses the viewer's device timezone.
 *
 * @param dateStr  YYYY-MM-DD (the calendar date the user picked)
 * @param time     HH:mm      (the local time the user picked)
 * @param timezone IANA timezone (e.g. "Asia/Kolkata")
 * @returns        ISO 8601 UTC string, e.g. "2025-06-20T06:30:00.000Z"
 */
const localToUtc = (dateStr: string, time: string, timezone: string): string => {
  // Build a formatter that interprets a wall-clock reading in the given timezone.
  // We format it as parts, then calculate the offset from UTC.
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);

  // Create a Date in the system timezone, then adjust for the target timezone.
  // Strategy: use Intl.DateTimeFormat to find the UTC offset of `timezone` at this instant,
  // then build the correct UTC Date.
  const guess = new Date(year, month - 1, day, hours, minutes, 0, 0);

  // Get the target timezone's offset at this approximate time
  const formatInTz = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  const partsInTz = formatInTz.formatToParts(guess);
  const get = (type: string) => Number(partsInTz.find(p => p.type === type)?.value ?? 0);
  const wallInTz = new Date(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));

  // Offset (in ms) = what the wall clock in TZ shows minus actual UTC
  const offsetMs = wallInTz.getTime() - guess.getTime() + guess.getTimezoneOffset() * 60_000;

  // The desired wall-clock reading in the target TZ is year/month/day hours:minutes
  const desiredWall = new Date(year, month - 1, day, hours, minutes, 0, 0);
  const utc = new Date(desiredWall.getTime() - offsetMs + desiredWall.getTimezoneOffset() * 60_000);

  return utc.toISOString();
};

/**
 * Get the current local time in HH:mm format
 */
const getCurrentTime = (): string => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

/**
 * Common timezone options for the override dropdown (sorted by offset)
 */
const TIMEZONE_OPTIONS = [
  { value: 'Pacific/Honolulu', label: '(GMT-10:00) Hawaii' },
  { value: 'America/Anchorage', label: '(GMT-09:00) Alaska' },
  { value: 'America/Los_Angeles', label: '(GMT-08:00) Pacific Time' },
  { value: 'America/Denver', label: '(GMT-07:00) Mountain Time' },
  { value: 'America/Chicago', label: '(GMT-06:00) Central Time' },
  { value: 'America/New_York', label: '(GMT-05:00) Eastern Time' },
  { value: 'America/Sao_Paulo', label: '(GMT-03:00) São Paulo' },
  { value: 'Atlantic/Reykjavik', label: '(GMT+00:00) Reykjavik' },
  { value: 'Europe/London', label: '(GMT+00:00) London' },
  { value: 'Europe/Paris', label: '(GMT+01:00) Paris' },
  { value: 'Europe/Berlin', label: '(GMT+01:00) Berlin' },
  { value: 'Africa/Cairo', label: '(GMT+02:00) Cairo' },
  { value: 'Europe/Moscow', label: '(GMT+03:00) Moscow' },
  { value: 'Asia/Dubai', label: '(GMT+04:00) Dubai' },
  { value: 'Asia/Karachi', label: '(GMT+05:00) Karachi' },
  { value: 'Asia/Kolkata', label: '(GMT+05:30) Mumbai, Kolkata' },
  { value: 'Asia/Dhaka', label: '(GMT+06:00) Dhaka' },
  { value: 'Asia/Bangkok', label: '(GMT+07:00) Bangkok' },
  { value: 'Asia/Singapore', label: '(GMT+08:00) Singapore' },
  { value: 'Asia/Shanghai', label: '(GMT+08:00) Shanghai' },
  { value: 'Asia/Tokyo', label: '(GMT+09:00) Tokyo' },
  { value: 'Australia/Sydney', label: '(GMT+10:00) Sydney' },
  { value: 'Pacific/Auckland', label: '(GMT+12:00) Auckland' },
];

/**
 * Extract YYYY-MM-DD from a date for the form's date picker.
 * Converts the UTC date to the viewer's local calendar date.
 */
const toDateString = (dateInput: string | Date): string => {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
  defaultType?: TransactionUIType;
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
  defaultType,
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
  
  // Calculator expression input state
  const [expressionInput, setExpressionInput] = useState<string | undefined>(undefined);
  
  // Advanced options state (time & timezone are inputs for computing UTC)
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [timeLocal, setTimeLocal] = useState(getCurrentTime());
  const [dateTimezone, setDateTimezone] = useState(getUserTimezone());
  
  // Track if we've already attempted auto-capture for this form session
  const locationCaptureAttemptedRef = useRef(false);

  // Get user's primary currency for fallback
  const { primaryCurrency } = useCurrency();

  // Derived values
  const selectedAccount = accounts.find(a => a.id === accountId);
  // Use selected account's currency symbol, or fall back to user's primary currency
  const currencySymbol = getCurrencySymbol(selectedAccount?.currency || primaryCurrency);
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
        
        // Derive time from the stored UTC date in the viewer's local timezone
        const d = new Date(editingTransaction.date);
        setTimeLocal(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
        setDateTimezone(getUserTimezone());
        // Always start collapsed - user can expand if needed
        setShowAdvancedOptions(false);
      } else {
        // Reset to defaults for new transaction
        const categoryLabels = labels.filter(l => l.type === 'Category');
        // Use defaultType if provided, otherwise 'Send'
        setType(defaultType || 'Send');
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
        
        // Reset advanced options to defaults
        setShowAdvancedOptions(false);
        setTimeLocal(getCurrentTime());
        setDateTimezone(getUserTimezone());
        
        // Reset location capture tracking for new form session
        locationCaptureAttemptedRef.current = false;
      }
    }
  }, [isOpen, editingTransaction, defaultAccountId, accounts, labels]);

  // Auto-capture location when form opens for new transactions
  useEffect(() => {
    if (isOpen && isNewTransaction && autoLocationEnabled && !location && !locationCaptureAttemptedRef.current) {
      locationCaptureAttemptedRef.current = true;
      
      // Silently capture location in the background
      (async () => {
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
          // Silent fail for auto-capture - user can still add location manually
          logger.info('Auto location capture failed:', error);
        }
      })();
    }
  }, [isOpen, isNewTransaction, autoLocationEnabled, location]);

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
    
    // Derive UTC from the form's date + time + selected timezone
    
    if (editingTransaction) {
      const updateData: UpdateTransactionRequest = {
        type: apiType,
        amount,
        date: localToUtc(date, timeLocal, dateTimezone),
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
        date: localToUtc(date, timeLocal, dateTimezone),
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

  // ──────────── Mobile Detection ────────────
  const isMobile = useIsMobile();

  if (!isOpen) return null;

  // Render via portal to escape parent stacking contexts (e.g., ChatsPage's z-20 fixed container)
  // This ensures the form's z-50 is in the root stacking context, above BottomTabBar (z-40) and header (z-30)
  const renderInPortal = (content: React.ReactNode) => createPortal(content, document.body);

  // ──────────── Shared Field Renderers ────────────
  const renderTypeSelector = () => (
    <TransactionTypeSelector value={type} onChange={setType} showTransfer={showTransfer} />
  );

  const renderAccountSelect = () => (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {type === 'Transfer' ? 'From Account' : 'Account'} *
      </label>
      {accounts.filter(a => !a.isArchived).length === 0 ? (
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
          <p className="text-sm text-amber-700 dark:text-amber-300 mb-2">
            You need to create an account first before adding transactions.
          </p>
          <a href="/accounts" className="inline-flex items-center gap-1 text-sm font-medium text-amber-700 dark:text-amber-300 hover:text-amber-800 dark:hover:text-amber-200 underline">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            Create Account
          </a>
        </div>
      ) : (
        <div className="relative">
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)}
            className="w-full px-3 py-3 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base appearance-none"
            required>
            <option value="">Select account...</option>
            {accounts.filter(a => !a.isArchived).map((account) => (
              <option key={account.id} value={account.id}>{account.name} ({account.currency})</option>
            ))}
          </select>
          <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
        </div>
      )}
    </div>
  );

  const renderTransferToAccount = () => type === 'Transfer' ? (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">To Account *</label>
      {accounts.filter(a => !a.isArchived && a.id !== accountId).length === 0 ? (
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
          <p className="text-sm text-yellow-700 dark:text-yellow-300">You need at least two accounts to transfer between them.</p>
        </div>
      ) : (
        <>
          <div className="relative">
            <select value={transferToAccountId} onChange={(e) => setTransferToAccountId(e.target.value)}
              className="w-full px-3 py-3 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base appearance-none"
              required>
              <option value="">Select destination...</option>
              {accounts.filter(a => !a.isArchived && a.id !== accountId).map((account) => (
                <option key={account.id} value={account.id}>{account.name} ({account.currency})</option>
              ))}
            </select>
            <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
          </div>
          {transferToAccountId && (() => {
            const destAccount = accounts.find(a => a.id === transferToAccountId);
            const sourceAccount = accounts.find(a => a.id === accountId);
            const isCrossCurrency = destAccount && sourceAccount && destAccount.currency !== sourceAccount.currency;
            return isCrossCurrency ? (
              <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                <span className="inline-flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" /></svg>
                  Amount will be converted from {sourceAccount.currency} to {destAccount.currency}
                </span>
              </p>
            ) : null;
          })()}
        </>
      )}
    </div>
  ) : null;

  const renderP2PEmail = () => type === 'Send' && !hideRecipientField ? (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Recipient's Email (optional)</label>
      <input type="email" value={counterpartyEmail} onChange={(e) => setCounterpartyEmail(e.target.value)} placeholder="friend@example.com"
        className="w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base" />
      <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">If they're on DigiTransac, they'll see this transaction too</p>
    </div>
  ) : null;

  const renderAmount = () => (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount *</label>
      <CalculatorInput value={amount} onChange={setAmount} currency={currencySymbol} placeholder="0.00"
        autoFocus={!editingTransaction} expressionInput={expressionInput}
        onExpressionInputConsumed={() => setExpressionInput(undefined)} />
      <QuickAmountButtons amounts={[10, 20, 50, 100, 500]} onSelect={setAmount}
        onExpressionClick={setExpressionInput} currency={currencySymbol} />
    </div>
  );

  const renderDatePicker = () => (
    <DatePicker label="Date *" value={date} onChange={setDate} maxDate={new Date()} />
  );

  const renderCategory = () => {
    if (type === 'Transfer') {
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
          <div className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 flex items-center gap-2">
            <span>🔁</span><span>Account Transfer</span>
            <svg className="w-4 h-4 ml-auto" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>
          </div>
        </div>
      );
    }
    if (showSplits) {
      return (
        <SplitCategoriesSection splits={splits} onSplitsChange={setSplits} categories={categories}
          amount={amount} currencySymbol={currencySymbol} onCancelSplit={handleCancelSplit} />
      );
    }
    return (
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Category *</label>
          <button type="button" onClick={handleStartSplit} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">Split transaction</button>
        </div>
        <SearchableCategoryDropdown value={selectedLabelId} onChange={setSelectedLabelId}
          categories={categories} placeholder="Select category..." />
      </div>
    );
  };

  const renderAdvancedFields = () => (
    <div className="space-y-4">
      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
          placeholder="e.g., Grocery shopping" />
      </div>

      {/* Payee/Payer */}
      {type !== 'Transfer' && !hidePayeeField && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{type === 'Send' ? 'Payee' : 'Payer'}</label>
          <input type="text" value={payee} onChange={(e) => setPayee(e.target.value)}
            className="w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
            placeholder={type === 'Send' ? 'e.g., Supermarket' : 'e.g., Employer'} />
        </div>
      )}

      {/* Tags */}
      <TagTokenInput tags={tags} selectedTagIds={selectedTagIds} onToggleTag={toggleTag} onCreateTag={onCreateTag} />

      {/* Location */}
      <LocationPicker location={location} onChange={handleLocationChange} autoCapture={false} />

      {/* Time & Timezone */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Time</label>
          <input type="time" value={timeLocal} onChange={(e) => setTimeLocal(e.target.value)}
            className="w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base [&::-webkit-date-and-time-value]:text-left" />
        </div>
        <div className="min-w-0">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Timezone</label>
          <div className="relative">
            <select value={dateTimezone} onChange={(e) => setDateTimezone(e.target.value)}
              className="w-full px-3 py-3 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base appearance-none truncate">
              {TIMEZONE_OPTIONS.map((tz) => (<option key={tz.value} value={tz.value}>{tz.label}</option>))}
              {!TIMEZONE_OPTIONS.find(tz => tz.value === dateTimezone) && (<option value={dateTimezone}>{dateTimezone}</option>)}
            </select>
            <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
          </div>
        </div>
      </div>

      {/* Recurring (only new) */}
      {isNewTransaction && (
        <RecurringSection isRecurring={isRecurring} onIsRecurringChange={setIsRecurring}
          frequency={recurrenceFrequency} onFrequencyChange={setRecurrenceFrequency}
          interval={recurrenceInterval} onIntervalChange={setRecurrenceInterval}
          endDate={recurrenceEndDate} onEndDateChange={setRecurrenceEndDate} />
      )}

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
          className="w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-base"
          placeholder="Additional notes..." />
      </div>
    </div>
  );

  const renderErrorMessage = () => error ? (
    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm mt-4">
      {error}
    </div>
  ) : null;

  // ──────────── Mobile Single-Form Layout ────────────
  if (isMobile) {
    return renderInPortal(
      <div className="fixed inset-0 z-50 bg-white dark:bg-gray-800 flex flex-col overflow-x-hidden" role="dialog" aria-modal="true" aria-labelledby="transaction-form-title">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-gray-200 dark:border-gray-700">
          <button type="button" onClick={onClose}
            className="flex items-center gap-1 p-2 -ml-2 min-h-[44px] min-w-[44px] text-gray-600 dark:text-gray-400 touch-manipulation"
            aria-label="Close">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <h3 id="transaction-form-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {editingTransaction ? 'Edit Transaction' : 'New Transaction'}
          </h3>
          <div className="w-10" /> {/* Spacer for centering */}
        </div>

        {/* Scrollable Form Content */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <div className="space-y-4 pt-2">
              {renderTypeSelector()}
              {renderAmount()}
              {renderDatePicker()}
              {renderAccountSelect()}
              {renderTransferToAccount()}
              {renderP2PEmail()}
              {renderCategory()}

              {/* Advanced Options Toggle */}
              <button
                type="button"
                onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors touch-manipulation min-h-[44px]"
              >
                <svg
                  className={`w-4 h-4 transition-transform ${showAdvancedOptions ? 'rotate-90' : ''}`}
                  fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
                Advanced options
              </button>

              {showAdvancedOptions && renderAdvancedFields()}
            </div>
            {renderErrorMessage()}
          </div>

          {/* Bottom Submit Button — fixed at bottom */}
          <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3 safe-area-bottom bg-white dark:bg-gray-800">
            <button type="submit"
              disabled={isLoading || amount <= 0 || !accountId ||
                (type === 'Transfer' ? !transferToAccountId : ((!showSplits && !selectedLabelId) || (showSplits && !splitsValid)))}
              className="w-full py-3.5 min-h-[48px] rounded-xl font-medium text-white bg-gradient-to-br from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation transition-opacity">
              {isLoading ? 'Saving...' : editingTransaction ? 'Update Transaction' : '✓ Add Transaction'}
            </button>
          </div>
        </form>
        </div>
      );
    }
  
    // ──────────── Desktop Modal Layout (Unchanged) ────────────
    return renderInPortal(
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
              {renderTypeSelector()}
              {renderAccountSelect()}
              {renderTransferToAccount()}
              {renderP2PEmail()}
              {renderAmount()}
              {renderDatePicker()}
              {renderCategory()}

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

              {showAdvancedOptions && renderAdvancedFields()}
            </div>

            {renderErrorMessage()}

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
