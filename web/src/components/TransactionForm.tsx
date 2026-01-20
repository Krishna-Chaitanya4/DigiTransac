import { useState, useEffect, useRef } from 'react';
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
import { getCurrentPosition, reverseGeocode, searchPlaces, type PlaceSearchResult } from '../services/locationService';
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
  onCreateTag?: (name: string) => Promise<Tag | null>;
  editingTransaction: Transaction | null;
  accounts: Account[];
  labels: Label[];
  tags: Tag[];
  defaultAccountId?: string;
  isLoading: boolean;
  autoLocationEnabled?: boolean;
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
  const [locationError, setLocationError] = useState<string | null>(null);
  const [manualLocationMode, setManualLocationMode] = useState(false);
  const [manualPlaceName, setManualPlaceName] = useState('');
  const [placeSearchResults, setPlaceSearchResults] = useState<PlaceSearchResult[]>([]);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [highlightedPlaceIndex, setHighlightedPlaceIndex] = useState(-1);
  const placeSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const placeInputRef = useRef<HTMLInputElement>(null);
  const placeDropdownRef = useRef<HTMLDivElement>(null);
  
  // Split transactions
  const [splits, setSplits] = useState<TransactionSplitRequest[]>([]);
  const [showSplits, setShowSplits] = useState(false);
  
  // Tag search
  const [tagSearch, setTagSearch] = useState('');
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const tagDropdownRef = useRef<HTMLDivElement>(null);

  // Category search
  const [categorySearch, setCategorySearch] = useState('');
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [highlightedCategoryIndex, setHighlightedCategoryIndex] = useState(-1);
  const categoryInputRef = useRef<HTMLInputElement>(null);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  // Get selected account
  const selectedAccount = accounts.find(a => a.id === accountId);
  const currencySymbol = selectedAccount ? getCurrencySymbol(selectedAccount.currency) : '$';

  // Filter labels to only show categories (memoized)
  const categories = labels.filter(l => l.type === 'Category');
  
  // Filter categories based on search
  const filteredCategories = categories.filter(cat =>
    cat.name.toLowerCase().includes(categorySearch.toLowerCase())
  );
  
  // Filter tags based on search
  const filteredTags = tags.filter(tag => 
    tag.name.toLowerCase().includes(tagSearch.toLowerCase()) &&
    !selectedTagIds.includes(tag.id)
  );
  const showCreateOption = tagSearch.trim() && 
    !tags.some(t => t.name.toLowerCase() === tagSearch.toLowerCase().trim());
  
  // Total dropdown items count (for keyboard navigation)
  const dropdownItemCount = filteredTags.length + (showCreateOption ? 1 : 0);

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
        
        // Reset tag search and location search
        setTagSearch('');
        setIsTagDropdownOpen(false);
        setHighlightedIndex(-1);
        setManualLocationMode(false);
        setManualPlaceName('');
        setLocationError(null);
        setPlaceSearchResults([]);
        setHighlightedPlaceIndex(-1);
      } else {
        // Reset to defaults for new transaction
        setType('Debit');
        setAccountId(defaultAccountId || accounts[0]?.id || '');
        setAmount(0);
        setDate(toDateString(new Date()));
        setTitle('');
        setPayee('');
        setNotes('');
        const defaultCategoryId = categoryLabels[0]?.id || '';
        setSelectedLabelId(defaultCategoryId);
        // Reset splits to match the default state (empty since amount is 0)
        setSplits([]);
        setSelectedTagIds([]);
        setTransferToAccountId('');
        setIsRecurring(false);
        setRecurrenceFrequency('Monthly');
        setRecurrenceInterval(1);
        setRecurrenceEndDate('');
        setIncludeLocation(false);
        setLocation(null);
        setShowSplits(false);
        setTagSearch('');
        setIsTagDropdownOpen(false);
        setHighlightedIndex(-1);
        setManualLocationMode(false);
        setManualPlaceName('');
        setLocationError(null);
        setPlaceSearchResults([]);
        setHighlightedPlaceIndex(-1);
        setCategorySearch('');
        setIsCategoryDropdownOpen(false);
        setHighlightedCategoryIndex(-1);
        
        // Auto-capture location for new transactions
        if (autoLocationEnabled) {
          captureLocationAuto();
        }
      }
    }
  }, [isOpen, editingTransaction, defaultAccountId, accounts, labels]);
  
  // Auto-capture location silently (for new transactions)
  const captureLocationAuto = async () => {
    setIsLoadingLocation(true);
    setLocationError(null);
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
      // Silently fail for auto-capture - user can manually add later
      logger.info('Auto location capture failed:', error);
    } finally {
      setIsLoadingLocation(false);
    }
  };

  // Update single split when amount or label changes (non-split mode)
  useEffect(() => {
    if (!showSplits && selectedLabelId) {
      if (amount > 0) {
        setSplits([{ labelId: selectedLabelId, amount, notes: undefined }]);
      } else {
        // Clear splits when amount is 0 or negative
        setSplits([]);
      }
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

  // Handle creating a new tag inline
  const handleCreateTag = async () => {
    if (!tagSearch.trim() || !onCreateTag) return;
    
    setIsCreatingTag(true);
    try {
      const newTag = await onCreateTag(tagSearch.trim());
      if (newTag) {
        setSelectedTagIds(prev => [...prev, newTag.id]);
        setTagSearch('');
        setIsTagDropdownOpen(false);
      }
    } catch (error) {
      logger.error('Failed to create tag:', error);
    } finally {
      setIsCreatingTag(false);
    }
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        tagDropdownRef.current && 
        !tagDropdownRef.current.contains(event.target as Node)
      ) {
        setIsTagDropdownOpen(false);
      }
      if (
        placeDropdownRef.current && 
        !placeDropdownRef.current.contains(event.target as Node)
      ) {
        setPlaceSearchResults([]);
      }
      if (
        categoryDropdownRef.current && 
        !categoryDropdownRef.current.contains(event.target as Node)
      ) {
        setIsCategoryDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced place search
  useEffect(() => {
    if (!manualPlaceName || manualPlaceName.trim().length < 2) {
      setPlaceSearchResults([]);
      setHighlightedPlaceIndex(-1);
      return;
    }

    // Clear previous timeout
    if (placeSearchTimeoutRef.current) {
      clearTimeout(placeSearchTimeoutRef.current);
    }

    // Debounce the search
    placeSearchTimeoutRef.current = setTimeout(async () => {
      setIsSearchingPlaces(true);
      try {
        const results = await searchPlaces(manualPlaceName.trim());
        setPlaceSearchResults(results);
        setHighlightedPlaceIndex(-1);
      } catch (error) {
        logger.error('Place search failed:', error);
        setPlaceSearchResults([]);
      } finally {
        setIsSearchingPlaces(false);
      }
    }, 300); // 300ms debounce

    return () => {
      if (placeSearchTimeoutRef.current) {
        clearTimeout(placeSearchTimeoutRef.current);
      }
    };
  }, [manualPlaceName]);

  // Select a place from search results
  const selectPlace = (place: PlaceSearchResult) => {
    setLocation({
      latitude: place.latitude,
      longitude: place.longitude,
      placeName: place.displayName.split(',')[0], // First part of display name
      city: place.city,
      country: place.country,
    });
    setIncludeLocation(true);
    setManualLocationMode(false);
    setManualPlaceName('');
    setPlaceSearchResults([]);
    setHighlightedPlaceIndex(-1);
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

              {/* Category (Single Split Mode) - Searchable */}
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
                  
                  <div className="relative" ref={categoryDropdownRef}>
                    {/* Selected category display or search input */}
                    {selectedLabelId ? (
                      <div 
                        className="flex items-center justify-between px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 cursor-pointer"
                        onClick={() => {
                          setSelectedLabelId('');
                          setCategorySearch('');
                          setIsCategoryDropdownOpen(true);
                          setTimeout(() => categoryInputRef.current?.focus(), 0);
                        }}
                      >
                        <span className="text-gray-900 dark:text-gray-100">
                          {categories.find(c => c.id === selectedLabelId)?.icon}{' '}
                          {categories.find(c => c.id === selectedLabelId)?.name}
                        </span>
                        <button
                          type="button"
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLabelId('');
                            setCategorySearch('');
                            setIsCategoryDropdownOpen(true);
                            setTimeout(() => categoryInputRef.current?.focus(), 0);
                          }}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <input
                        ref={categoryInputRef}
                        type="text"
                        value={categorySearch}
                        onChange={(e) => {
                          setCategorySearch(e.target.value);
                          setIsCategoryDropdownOpen(true);
                          setHighlightedCategoryIndex(-1);
                        }}
                        onFocus={() => setIsCategoryDropdownOpen(true)}
                        onKeyDown={(e) => {
                          if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            setHighlightedCategoryIndex(prev =>
                              prev < filteredCategories.length - 1 ? prev + 1 : 0
                            );
                          } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            setHighlightedCategoryIndex(prev =>
                              prev > 0 ? prev - 1 : filteredCategories.length - 1
                            );
                          } else if (e.key === 'Enter') {
                            e.preventDefault();
                            if (highlightedCategoryIndex >= 0 && filteredCategories[highlightedCategoryIndex]) {
                              setSelectedLabelId(filteredCategories[highlightedCategoryIndex].id);
                              setCategorySearch('');
                              setIsCategoryDropdownOpen(false);
                              setHighlightedCategoryIndex(-1);
                            } else if (filteredCategories.length === 1) {
                              setSelectedLabelId(filteredCategories[0].id);
                              setCategorySearch('');
                              setIsCategoryDropdownOpen(false);
                            }
                          } else if (e.key === 'Escape') {
                            setIsCategoryDropdownOpen(false);
                            setCategorySearch('');
                          }
                        }}
                        placeholder="Search categories..."
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                          bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                          focus:ring-2 focus:ring-blue-500 focus:border-transparent
                          placeholder:text-gray-400 dark:placeholder:text-gray-500"
                      />
                    )}
                    
                    {/* Dropdown */}
                    {isCategoryDropdownOpen && !selectedLabelId && (
                      <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {filteredCategories.length > 0 ? (
                          filteredCategories.map((category, index) => (
                            <button
                              key={category.id}
                              type="button"
                              onClick={() => {
                                setSelectedLabelId(category.id);
                                setCategorySearch('');
                                setIsCategoryDropdownOpen(false);
                                setHighlightedCategoryIndex(-1);
                              }}
                              className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${
                                index === highlightedCategoryIndex
                                  ? 'bg-amber-50 dark:bg-amber-900/30'
                                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                              }`}
                            >
                              {category.icon && <span>{category.icon}</span>}
                              {category.color && (
                                <span
                                  className="w-3 h-3 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: category.color }}
                                />
                              )}
                              <span className="text-gray-900 dark:text-white">{category.name}</span>
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                            No matching categories
                          </div>
                        )}
                      </div>
                    )}
                  </div>
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

              {/* Tags - Token input with keyboard navigation */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tags
                </label>
                
                {/* Token input container */}
                <div className="relative" ref={tagDropdownRef}>
                  <div 
                    className="flex flex-wrap items-center gap-1.5 px-2 py-1.5 min-h-[42px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent cursor-text"
                    onClick={() => tagInputRef.current?.focus()}
                  >
                    {/* Selected tags as tokens inside the input */}
                    {selectedTagIds.map((tagId) => {
                      const tag = tags.find(t => t.id === tagId);
                      if (!tag) return null;
                      return (
                        <span
                          key={tag.id}
                          className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 text-sm font-medium rounded-full bg-blue-500 text-white"
                          style={tag.color ? { backgroundColor: tag.color } : undefined}
                        >
                          {tag.name}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleTag(tag.id);
                            }}
                            className="flex items-center justify-center w-4 h-4 ml-0.5 hover:bg-white/20 rounded-full transition-colors"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </span>
                      );
                    })}
                    
                    {/* Search input */}
                    <input
                      ref={tagInputRef}
                      type="text"
                      value={tagSearch}
                      onChange={(e) => {
                        setTagSearch(e.target.value);
                        setIsTagDropdownOpen(true);
                        setHighlightedIndex(-1);
                      }}
                      onFocus={() => {
                        setIsTagDropdownOpen(true);
                        setHighlightedIndex(-1);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setHighlightedIndex(prev => 
                            prev < dropdownItemCount - 1 ? prev + 1 : 0
                          );
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          setHighlightedIndex(prev => 
                            prev > 0 ? prev - 1 : dropdownItemCount - 1
                          );
                        } else if (e.key === 'Enter') {
                          e.preventDefault();
                          if (highlightedIndex >= 0 && highlightedIndex < filteredTags.length) {
                            // Select existing tag (highlighted)
                            toggleTag(filteredTags[highlightedIndex].id);
                            setTagSearch('');
                            setIsTagDropdownOpen(false);
                            setHighlightedIndex(-1);
                          } else if (highlightedIndex === filteredTags.length && showCreateOption) {
                            // Create new tag (highlighted on create option)
                            handleCreateTag();
                          } else if (highlightedIndex === -1 && tagSearch.trim()) {
                            // Nothing highlighted - check for exact match first
                            const exactMatch = filteredTags.find(
                              t => t.name.toLowerCase() === tagSearch.trim().toLowerCase()
                            );
                            if (exactMatch) {
                              // Exact match found - select it
                              toggleTag(exactMatch.id);
                              setTagSearch('');
                              setIsTagDropdownOpen(false);
                            } else if (showCreateOption) {
                              // No exact match - create new tag
                              handleCreateTag();
                            } else if (filteredTags.length === 1) {
                              // Only one match - select it
                              toggleTag(filteredTags[0].id);
                              setTagSearch('');
                              setIsTagDropdownOpen(false);
                            }
                          }
                        } else if (e.key === 'Escape') {
                          setIsTagDropdownOpen(false);
                          setTagSearch('');
                          setHighlightedIndex(-1);
                        } else if (e.key === 'Backspace' && !tagSearch && selectedTagIds.length > 0) {
                          // Remove last tag when backspace on empty input
                          toggleTag(selectedTagIds[selectedTagIds.length - 1]);
                        }
                      }}
                      placeholder={selectedTagIds.length === 0 ? "Search or create tag..." : ""}
                      className="flex-1 min-w-[100px] bg-transparent border-none outline-none text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
                    />
                  </div>
                  
                  {/* Dropdown */}
                  {isTagDropdownOpen && (filteredTags.length > 0 || showCreateOption) && (
                    <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {/* Existing tags */}
                      {filteredTags.map((tag, index) => (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => {
                            toggleTag(tag.id);
                            setTagSearch('');
                            setIsTagDropdownOpen(false);
                            setHighlightedIndex(-1);
                          }}
                          className={`w-full px-3 py-2 text-left flex items-center gap-2 ${
                            index === highlightedIndex 
                              ? 'bg-blue-50 dark:bg-blue-900/30' 
                              : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                        >
                          {tag.color && (
                            <span 
                              className="w-3 h-3 rounded-full flex-shrink-0" 
                              style={{ backgroundColor: tag.color }}
                            />
                          )}
                          <span className="text-gray-900 dark:text-white">{tag.name}</span>
                        </button>
                      ))}
                      
                      {/* Create new option */}
                      {showCreateOption && (
                        <button
                          type="button"
                          onClick={handleCreateTag}
                          disabled={isCreatingTag}
                          className={`w-full px-3 py-2 text-left flex items-center gap-2 text-blue-600 dark:text-blue-400 ${
                            filteredTags.length > 0 ? 'border-t border-gray-200 dark:border-gray-600' : ''
                          } ${
                            highlightedIndex === filteredTags.length 
                              ? 'bg-blue-50 dark:bg-blue-900/30' 
                              : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                        >
                          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          {isCreatingTag ? 'Creating...' : `Create "${tagSearch.trim()}"`}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Location */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Location
                  </label>
                  {!location && !isLoadingLocation && !manualLocationMode && (
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setManualLocationMode(true)}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        ✏️ Enter manually
                      </button>
                      <button
                        type="button"
                        onClick={captureLocation}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        📍 Use current
                      </button>
                    </div>
                  )}
                </div>
                
                {/* Loading state */}
                {isLoadingLocation && !location && (
                  <div className="mt-1 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg flex items-center gap-2">
                    <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                    <span className="text-sm text-gray-600 dark:text-gray-300">Getting location...</span>
                  </div>
                )}
                
                {/* Manual entry mode with autocomplete */}
                {manualLocationMode && !location && (
                  <div className="mt-1 relative" ref={placeDropdownRef}>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          ref={placeInputRef}
                          type="text"
                          value={manualPlaceName}
                          onChange={(e) => setManualPlaceName(e.target.value)}
                          placeholder="Search for a place..."
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                            bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                            focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          onKeyDown={(e) => {
                            if (e.key === 'ArrowDown') {
                              e.preventDefault();
                              setHighlightedPlaceIndex(prev => 
                                prev < placeSearchResults.length - 1 ? prev + 1 : 0
                              );
                            } else if (e.key === 'ArrowUp') {
                              e.preventDefault();
                              setHighlightedPlaceIndex(prev => 
                                prev > 0 ? prev - 1 : placeSearchResults.length - 1
                              );
                            } else if (e.key === 'Enter') {
                              e.preventDefault();
                              if (highlightedPlaceIndex >= 0 && placeSearchResults[highlightedPlaceIndex]) {
                                selectPlace(placeSearchResults[highlightedPlaceIndex]);
                              } else if (placeSearchResults.length === 1) {
                                selectPlace(placeSearchResults[0]);
                              } else if (manualPlaceName.trim() && placeSearchResults.length === 0) {
                                // Allow manual entry if no results
                                const parts = manualPlaceName.split(',').map(p => p.trim());
                                setLocation({
                                  latitude: 0,
                                  longitude: 0,
                                  placeName: manualPlaceName.trim(),
                                  city: parts[0] || undefined,
                                  country: parts[1] || undefined,
                                });
                                setIncludeLocation(true);
                                setManualLocationMode(false);
                                setManualPlaceName('');
                              }
                            } else if (e.key === 'Escape') {
                              setManualLocationMode(false);
                              setManualPlaceName('');
                              setPlaceSearchResults([]);
                            }
                          }}
                        />
                        {isSearchingPlaces && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setManualLocationMode(false);
                          setManualPlaceName('');
                          setPlaceSearchResults([]);
                        }}
                        className="px-3 py-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                    
                    {/* Autocomplete dropdown */}
                    {placeSearchResults.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {placeSearchResults.map((place, index) => (
                          <button
                            key={place.placeId}
                            type="button"
                            onClick={() => selectPlace(place)}
                            className={`w-full px-3 py-2 text-left text-sm ${
                              index === highlightedPlaceIndex 
                                ? 'bg-blue-50 dark:bg-blue-900/30' 
                                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <span className="text-gray-400 mt-0.5">📍</span>
                              <div className="flex-1 min-w-0">
                                <div className="text-gray-900 dark:text-white truncate">
                                  {place.city || place.displayName.split(',')[0]}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                  {place.displayName}
                                </div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    
                    {/* No results hint */}
                    {manualPlaceName.trim().length >= 2 && !isSearchingPlaces && placeSearchResults.length === 0 && (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        No places found. Press Enter to add "{manualPlaceName.trim()}" manually.
                      </p>
                    )}
                  </div>
                )}
                
                {/* Location error */}
                {locationError && !location && !manualLocationMode && (
                  <p className="mt-1 text-sm text-red-500">{locationError}</p>
                )}
                
                {/* Location display */}
                {location && (
                  <div className="mt-1 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      📍 {location.city || location.placeName || 'Location captured'}
                      {location.country && `, ${location.country}`}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          // Pre-fill manual entry with current location
                          const currentPlace = location.city 
                            ? (location.country ? `${location.city}, ${location.country}` : location.city)
                            : location.placeName || '';
                          setManualPlaceName(currentPlace);
                          setLocation(null);
                          setIncludeLocation(false);
                          setManualLocationMode(true);
                        }}
                        className="text-gray-400 hover:text-blue-500"
                        title="Edit location"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLocation(null);
                          setIncludeLocation(false);
                        }}
                        className="text-gray-400 hover:text-red-500"
                        title="Remove location"
                      >
                        ✕
                      </button>
                    </div>
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
                disabled={isLoading || amount <= 0 || !accountId || (!showSplits && !selectedLabelId) || (showSplits && !splitsValid)}
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
