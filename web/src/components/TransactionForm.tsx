import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
import { useHaptics } from '../hooks/useHaptics';
import { useTransactions } from '../hooks';
import { useRecentPayees } from '../hooks/useRecentPayees';
import { getCurrentPosition, reverseGeocode } from '../services/locationService';
import { logger } from '../services/logger';
import { formatCurrency } from '../services/currencyService';
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
// When dateLocal is available, we use that for display (the human-intended date).
// The `date` field is still sent as noon UTC for backward compatibility with queries.

/**
 * Convert a date string (YYYY-MM-DD) to noon UTC for backward compatibility
 */
const toNoonUTC = (dateStr: string): string => `${dateStr}T12:00:00.000Z`;

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
 * Get the current local time in HH:mm format
 */
const getCurrentTime = (): string => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

/**
 * Common timezone options for dropdown (sorted by offset)
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
 * Extract YYYY-MM-DD from a date, preferring dateLocal if available.
 * For transactions with dateLocal, we use that directly (it's the user's intended date).
 * For legacy transactions without dateLocal, we extract from the UTC date.
 */
const toDateString = (dateInput: string | Date, dateLocal?: string): string => {
  // If we have the local date string, use it directly
  if (dateLocal) {
    return dateLocal;
  }
  
  if (typeof dateInput === 'string') {
    // Check if it's just a date (YYYY-MM-DD) or has time component
    if (dateInput.length === 10) {
      return dateInput;
    }
    // Has time component - for legacy data, extract date from UTC
    // This maintains backward compatibility
    return dateInput.split('T')[0];
  }
  
  // For Date objects, format as local date (user's perspective)
  const d = dateInput;
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
  defaultAmount?: number;
  defaultTitle?: string;
  defaultPayee?: string;
  defaultLabelId?: string;
  defaultTagIds?: string[];
  defaultTransferToAccountId?: string;
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
  defaultAmount,
  defaultTitle,
  defaultPayee,
  defaultLabelId,
  defaultTagIds,
  defaultTransferToAccountId,
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
  
  // Advanced options state (time & timezone)
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [timeLocal, setTimeLocal] = useState(getCurrentTime());
  const [dateTimezone, setDateTimezone] = useState(getUserTimezone());
  
  // Track if we've already attempted auto-capture for this form session
  const locationCaptureAttemptedRef = useRef(false);
  
  // Duplicate warning dismissed state
  const [duplicateWarningDismissed, setDuplicateWarningDismissed] = useState(false);
  
  // Payee autocomplete state
  const { addPayee: recordPayee, getSuggestions } = useRecentPayees();
  const [showPayeeSuggestions, setShowPayeeSuggestions] = useState(false);
  const payeeSuggestions = useMemo(
    () => getSuggestions(payee),
    [getSuggestions, payee]
  );
  const payeeInputRef = useRef<HTMLInputElement>(null);
  const payeeSuggestionsRef = useRef<HTMLDivElement>(null);
  const [payeeSuggestionIndex, setPayeeSuggestionIndex] = useState(-1);

  // Close payee suggestions on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        payeeSuggestionsRef.current &&
        !payeeSuggestionsRef.current.contains(e.target as Node) &&
        payeeInputRef.current &&
        !payeeInputRef.current.contains(e.target as Node)
      ) {
        setShowPayeeSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePayeeSelect = useCallback((name: string) => {
    setPayee(name);
    setShowPayeeSuggestions(false);
    setPayeeSuggestionIndex(-1);
  }, []);

  const handlePayeeKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showPayeeSuggestions || payeeSuggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setPayeeSuggestionIndex(prev =>
        prev < payeeSuggestions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setPayeeSuggestionIndex(prev =>
        prev > 0 ? prev - 1 : payeeSuggestions.length - 1
      );
    } else if (e.key === 'Enter' && payeeSuggestionIndex >= 0) {
      e.preventDefault();
      handlePayeeSelect(payeeSuggestions[payeeSuggestionIndex]);
    } else if (e.key === 'Escape') {
      setShowPayeeSuggestions(false);
      setPayeeSuggestionIndex(-1);
    }
  }, [showPayeeSuggestions, payeeSuggestions, payeeSuggestionIndex, handlePayeeSelect]);

  // Get user's primary currency for fallback
  const { primaryCurrency } = useCurrency();
  
  // ──────────── Duplicate Detection ────────────
  // Fetch recent transactions around the selected date to detect duplicates
  const duplicateCheckFilter = useMemo(() => {
    if (!accountId || amount <= 0 || !date || !isOpen || editingTransaction) return null;
    // Search ±1 day from the selected date
    const selectedDate = new Date(date + 'T12:00:00');
    const dayBefore = new Date(selectedDate);
    dayBefore.setDate(dayBefore.getDate() - 1);
    const dayAfter = new Date(selectedDate);
    dayAfter.setDate(dayAfter.getDate() + 1);
    
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return {
      accountIds: [accountId],
      startDate: `${fmt(dayBefore)}T00:00:00.000Z`,
      endDate: `${fmt(dayAfter)}T23:59:59.999Z`,
      pageSize: 20,
    };
  }, [accountId, amount, date, isOpen, editingTransaction]);
  
  const { data: recentTransactions } = useTransactions(
    duplicateCheckFilter ?? { pageSize: 0 },
    !!duplicateCheckFilter
  );
  
  // Find potential duplicates: same account + similar amount (±1%) + within ±1 day
  const potentialDuplicates = useMemo(() => {
    if (!recentTransactions?.transactions || !duplicateCheckFilter || amount <= 0) return [];
    const tolerance = amount * 0.01; // 1% tolerance
    return recentTransactions.transactions.filter(t => {
      // Skip the transaction being edited
      if (editingTransaction && t.id === editingTransaction.id) return false;
      // Match amount within tolerance
      return Math.abs(t.amount - amount) <= Math.max(tolerance, 0.01);
    });
  }, [recentTransactions, duplicateCheckFilter, amount, editingTransaction]);
  
  // Reset dismissed state when key fields change
  useEffect(() => {
    setDuplicateWarningDismissed(false);
  }, [amount, date, accountId]);

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
        setDate(toDateString(editingTransaction.date, editingTransaction.dateLocal));
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
        
        // Set time/timezone from existing transaction
        setTimeLocal(editingTransaction.timeLocal || getCurrentTime());
        setDateTimezone(editingTransaction.dateTimezone || getUserTimezone());
        // Always start collapsed - user can expand if needed
        setShowAdvancedOptions(false);
      } else {
        // Reset to defaults for new transaction (supports template pre-fill)
        const categoryLabels = labels.filter(l => l.type === 'Category');
        // Use defaultType if provided, otherwise 'Send'
        setType(defaultType || 'Send');
        setAccountId(defaultAccountId || accounts[0]?.id || '');
        setAmount(defaultAmount || 0);
        setDate(toDateString(new Date(), undefined));
        setTitle(defaultTitle || '');
        setPayee(defaultPayee || '');
        setNotes('');
        setSelectedLabelId(defaultLabelId || categoryLabels[0]?.id || '');
        setSplits([]);
        setSelectedTagIds(defaultTagIds || []);
        setTransferToAccountId(defaultTransferToAccountId || '');
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
    
    // Record payee in recent history for autocomplete
    if (payee.trim()) {
      recordPayee(payee.trim());
    }
    
    const finalSplits = showSplits ? splits : [{ labelId: selectedLabelId, amount, notes: undefined }];
    // P2P applies to Send/Receive transactions with counterparty email
    // In chat context, counterpartyEmail is set from fixedCounterpartyEmail
    const effectiveCounterpartyEmail = counterpartyEmail.trim();
    const isP2P = (type === 'Send' || type === 'Receive') && effectiveCounterpartyEmail;
    
    // Convert UI type to API type: Transfer -> Send (backend creates linked Send+Receive)
    const apiType: TransactionType = type === 'Transfer' ? 'Send' : type;
    const isTransfer = type === 'Transfer';
    
    // Get the user's current timezone for storage
    const timezone = getUserTimezone();
    
    // Use user-selected timezone or auto-detected one
    const effectiveTimezone = showAdvancedOptions ? dateTimezone : timezone;
    const effectiveTimeLocal = timeLocal;
    
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
        // Timezone-aware date/time fields
        dateLocal: date,           // The YYYY-MM-DD date the user selected
        timeLocal: effectiveTimeLocal, // The HH:mm time
        dateTimezone: effectiveTimezone, // User's timezone
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
        // Timezone-aware date/time fields
        dateLocal: date,           // The YYYY-MM-DD date the user selected
        timeLocal: effectiveTimeLocal, // The HH:mm time
        dateTimezone: effectiveTimezone, // User's timezone
      };
      onSubmit(createData);
    }
  };

  // ──────────── Mobile Wizard State ────────────
  const isMobile = useIsMobile();
  const haptics = useHaptics();
  const [wizardStep, setWizardStep] = useState(0);

  // Reset wizard step when form opens
  useEffect(() => {
    if (isOpen) setWizardStep(0);
  }, [isOpen]);

  // Wizard step definitions
  const WIZARD_STEPS = useMemo(() => [
    { label: 'Amount', icon: '💰' },
    { label: 'Account', icon: '🏦' },
    { label: 'Details', icon: '📝' },
  ], []);

  const canAdvanceStep = useMemo(() => {
    switch (wizardStep) {
      case 0: return amount > 0;
      case 1: return !!accountId && (type !== 'Transfer' || !!transferToAccountId) &&
                (type === 'Transfer' || showSplits ? splitsValid : !!selectedLabelId);
      case 2: return true; // Details are all optional
      default: return false;
    }
  }, [wizardStep, amount, accountId, type, transferToAccountId, showSplits, splitsValid, selectedLabelId]);

  const handleNextStep = () => {
    if (canAdvanceStep && wizardStep < WIZARD_STEPS.length - 1) {
      haptics.light();
      setWizardStep(s => s + 1);
    }
  };

  const handlePrevStep = () => {
    if (wizardStep > 0) {
      haptics.light();
      setWizardStep(s => s - 1);
    }
  };

  if (!isOpen) return null;

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
        <select value={accountId} onChange={(e) => setAccountId(e.target.value)}
          className="w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
          required>
          <option value="">Select account...</option>
          {accounts.filter(a => !a.isArchived).map((account) => (
            <option key={account.id} value={account.id}>{account.name} ({account.currency})</option>
          ))}
        </select>
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
          <select value={transferToAccountId} onChange={(e) => setTransferToAccountId(e.target.value)}
            className="w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
            required>
            <option value="">Select destination...</option>
            {accounts.filter(a => !a.isArchived && a.id !== accountId).map((account) => (
              <option key={account.id} value={account.id}>{account.name} ({account.currency})</option>
            ))}
          </select>
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

      {/* Payee/Payer with Autocomplete */}
      {type !== 'Transfer' && !hidePayeeField && (
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{type === 'Send' ? 'Payee' : 'Payer'}</label>
          <input
            ref={payeeInputRef}
            type="text"
            value={payee}
            onChange={(e) => {
              setPayee(e.target.value);
              setShowPayeeSuggestions(true);
              setPayeeSuggestionIndex(-1);
            }}
            onFocus={() => setShowPayeeSuggestions(true)}
            onKeyDown={handlePayeeKeyDown}
            className="w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
            placeholder={type === 'Send' ? 'e.g., Supermarket' : 'e.g., Employer'}
            autoComplete="off"
            role="combobox"
            aria-expanded={showPayeeSuggestions && payeeSuggestions.length > 0}
            aria-autocomplete="list"
            aria-controls="payee-suggestions"
            aria-activedescendant={payeeSuggestionIndex >= 0 ? `payee-suggestion-${payeeSuggestionIndex}` : undefined}
          />
          {/* Autocomplete dropdown */}
          {showPayeeSuggestions && payeeSuggestions.length > 0 && (
            <div
              ref={payeeSuggestionsRef}
              id="payee-suggestions"
              role="listbox"
              className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto"
            >
              {payeeSuggestions.map((suggestion, idx) => (
                <button
                  key={suggestion}
                  id={`payee-suggestion-${idx}`}
                  role="option"
                  aria-selected={idx === payeeSuggestionIndex}
                  type="button"
                  className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${
                    idx === payeeSuggestionIndex
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault(); // Prevent blur before click
                    handlePayeeSelect(suggestion);
                  }}
                  onMouseEnter={() => setPayeeSuggestionIndex(idx)}
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                    {suggestion}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tags */}
      <TagTokenInput tags={tags} selectedTagIds={selectedTagIds} onToggleTag={toggleTag} onCreateTag={onCreateTag} />

      {/* Location */}
      <LocationPicker location={location} onChange={handleLocationChange} autoCapture={false} />

      {/* Time & Timezone */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Time</label>
          <input type="time" value={timeLocal} onChange={(e) => setTimeLocal(e.target.value)}
            className="w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Timezone</label>
          <select value={dateTimezone} onChange={(e) => setDateTimezone(e.target.value)}
            className="w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm">
            {TIMEZONE_OPTIONS.map((tz) => (<option key={tz.value} value={tz.value}>{tz.label}</option>))}
            {!TIMEZONE_OPTIONS.find(tz => tz.value === dateTimezone) && (<option value={dateTimezone}>{dateTimezone}</option>)}
          </select>
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

  const renderDuplicateWarning = () => {
    if (duplicateWarningDismissed || potentialDuplicates.length === 0 || editingTransaction) return null;
    const dup = potentialDuplicates[0];
    const dupDate = dup.dateLocal || dup.date.split('T')[0];
    return (
      <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg mt-3">
        <div className="flex items-start gap-2">
          <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              Possible duplicate detected
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              {formatCurrency(dup.amount, dup.currency)} on {dupDate}
              {dup.title && ` — "${dup.title}"`}
              {dup.payee && ` (${dup.payee})`}
              {potentialDuplicates.length > 1 && ` and ${potentialDuplicates.length - 1} more`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDuplicateWarningDismissed(true)}
            className="p-1 text-amber-400 hover:text-amber-600 dark:text-amber-500 dark:hover:text-amber-300 flex-shrink-0"
            aria-label="Dismiss duplicate warning"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    );
  };

  const renderErrorMessage = () => error ? (
    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm mt-4">
      {error}
    </div>
  ) : null;

  // ──────────── Mobile Wizard Layout ────────────
  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50 bg-white dark:bg-gray-800 flex flex-col" role="dialog" aria-modal="true" aria-labelledby="transaction-form-title">
        {/* Wizard Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-gray-200 dark:border-gray-700">
          <button type="button" onClick={wizardStep === 0 ? onClose : handlePrevStep}
            className="flex items-center gap-1 p-2 -ml-2 min-h-[44px] min-w-[44px] text-gray-600 dark:text-gray-400 touch-manipulation"
            aria-label={wizardStep === 0 ? 'Close' : 'Back'}>
            {wizardStep === 0 ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
            )}
          </button>
          <h3 id="transaction-form-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {editingTransaction ? 'Edit Transaction' : 'New Transaction'}
          </h3>
          <div className="w-10" /> {/* Spacer for centering */}
        </div>

        {/* Step Indicators */}
        <div className="flex items-center justify-center gap-2 px-4 py-3">
          {WIZARD_STEPS.map((step, i) => (
            <button key={i} type="button" onClick={() => { if (i < wizardStep) { haptics.selection(); setWizardStep(i); } }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors touch-manipulation ${
                i === wizardStep
                  ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                  : i < wizardStep
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 cursor-pointer'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
              }`}
              disabled={i > wizardStep}
              aria-current={i === wizardStep ? 'step' : undefined}>
              <span>{step.icon}</span>
              <span>{step.label}</span>
              {i < wizardStep && (
                <svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
              )}
            </button>
          ))}
        </div>

        {/* Step Content — scrollable */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <div className="space-y-4 pt-2">
              {/* Step 0: Type & Amount */}
              {wizardStep === 0 && (
                <>
                  {renderTypeSelector()}
                  {renderAmount()}
                  {renderDatePicker()}
                </>
              )}

              {/* Step 1: Account & Category */}
              {wizardStep === 1 && (
                <>
                  {renderAccountSelect()}
                  {renderTransferToAccount()}
                  {renderP2PEmail()}
                  {renderCategory()}
                </>
              )}

              {/* Step 2: Details (optional) */}
              {wizardStep === 2 && renderAdvancedFields()}
            </div>
            {renderDuplicateWarning()}
            {renderErrorMessage()}
          </div>

          {/* Bottom Actions — fixed at bottom */}
          <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3 safe-area-bottom bg-white dark:bg-gray-800">
            {wizardStep < WIZARD_STEPS.length - 1 ? (
              <button type="button" onClick={handleNextStep} disabled={!canAdvanceStep}
                className="w-full py-3.5 min-h-[48px] rounded-xl font-medium text-white bg-gradient-to-br from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation transition-opacity">
                Next: {WIZARD_STEPS[wizardStep + 1].label}
              </button>
            ) : (
              <button type="submit"
                disabled={isLoading || amount <= 0 || !accountId ||
                  (type === 'Transfer' ? !transferToAccountId : ((!showSplits && !selectedLabelId) || (showSplits && !splitsValid)))}
                className="w-full py-3.5 min-h-[48px] rounded-xl font-medium text-white bg-gradient-to-br from-green-600 to-green-700 dark:from-green-700 dark:to-green-800 disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation transition-opacity">
                {isLoading ? 'Saving...' : editingTransaction ? 'Update Transaction' : '✓ Add Transaction'}
              </button>
            )}
          </div>
        </form>
      </div>
    );
  }

  // ──────────── Desktop Modal Layout (Unchanged) ────────────
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

            {renderDuplicateWarning()}
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
