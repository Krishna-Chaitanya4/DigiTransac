import { useState, useEffect, useCallback, useRef } from 'react';
import { TransactionList } from '../components/TransactionList';
import { TransactionForm } from '../components/TransactionForm';
import { getLabels } from '../services/labelService';
import { getTags, createTag } from '../services/tagService';
import { getAccounts, type Account } from '../services/accountService';
import { getCurrencySymbol } from '../services/currencyService';
import { logger } from '../services/logger';
import {
  getTransactions,
  getTransactionSummary,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  toggleCleared,
} from '../services/transactionService';
import type {
  Transaction,
  TransactionSummary,
  TransactionFilter,
  CreateTransactionRequest,
  UpdateTransactionRequest,
  TransactionType,
} from '../types/transactions';
import type { Label, Tag } from '../types/labels';

// Date utility functions
const formatDateToStartOfDay = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}T00:00:00.000Z`;
};

const formatDateToEndOfDay = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}T23:59:59.999Z`;
};

const formatDateForInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Date preset types
type DatePreset = 'today' | 'thisWeek' | 'thisMonth' | 'lastMonth' | 'custom';

interface DateRange {
  start: Date;
  end: Date;
}

function getDateRangeForPreset(preset: DatePreset): DateRange {
  const now = new Date();
  
  switch (preset) {
    case 'today':
      return { start: now, end: now };
    case 'thisWeek': {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
      return { start, end: now };
    }
    case 'thisMonth': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start, end: now };
    }
    case 'lastMonth': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0); // Last day of previous month
      return { start, end };
    }
    case 'custom':
    default:
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
  }
}

// Summary Card Component
function SummaryCard({ 
  label, 
  amount, 
  icon, 
  colorClass,
  currency 
}: { 
  label: string; 
  amount: number; 
  icon: string;
  colorClass: string;
  currency: string;
}) {
  const symbol = getCurrencySymbol(currency);
  const formattedAmount = Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{icon}</span>
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</span>
      </div>
      <div className={`text-xl font-bold ${colorClass}`}>
        {amount >= 0 ? '' : '-'}{symbol}{formattedAmount}
      </div>
    </div>
  );
}

// Filter Panel Component
function FilterPanel({
  isOpen,
  accounts,
  labels,
  tags,
  filter,
  onFilterChange,
  onClose,
}: {
  isOpen: boolean;
  accounts: Account[];
  labels: Label[];
  tags: Tag[];
  filter: TransactionFilter;
  onFilterChange: (filter: TransactionFilter) => void;
  onClose: () => void;
}) {
  // Tag search state
  const [tagSearch, setTagSearch] = useState('');
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
  const [highlightedTagIndex, setHighlightedTagIndex] = useState(-1);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const tagDropdownRef = useRef<HTMLDivElement>(null);

  // Account search state
  const [accountSearch, setAccountSearch] = useState('');
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);
  const [highlightedAccountIndex, setHighlightedAccountIndex] = useState(-1);
  const accountInputRef = useRef<HTMLInputElement>(null);
  const accountDropdownRef = useRef<HTMLDivElement>(null);

  // Category search state
  const [categorySearch, setCategorySearch] = useState('');
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [highlightedCategoryIndex, setHighlightedCategoryIndex] = useState(-1);
  const categoryInputRef = useRef<HTMLInputElement>(null);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  // Get categories from labels
  const categories = labels.filter(l => l.type === 'Category');

  // Filter tags based on search (exclude already selected)
  const filteredTags = tags.filter(tag =>
    tag.name.toLowerCase().includes(tagSearch.toLowerCase()) &&
    !(filter.tagIds?.includes(tag.id) ?? false)
  );

  // Filter accounts based on search (exclude already selected)
  const filteredAccounts = accounts.filter(account =>
    account.name.toLowerCase().includes(accountSearch.toLowerCase()) &&
    !(filter.accountIds?.includes(account.id) ?? false)
  );

  // Filter categories based on search (exclude already selected)
  const filteredCategories = categories.filter(cat =>
    cat.name.toLowerCase().includes(categorySearch.toLowerCase()) &&
    !(filter.labelIds?.includes(cat.id) ?? false)
  );

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
        accountDropdownRef.current &&
        !accountDropdownRef.current.contains(event.target as Node)
      ) {
        setIsAccountDropdownOpen(false);
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

  // Toggle tag selection
  const toggleTag = (tagId: string) => {
    const currentTags = filter.tagIds || [];
    const isSelected = currentTags.includes(tagId);
    const newTags = isSelected
      ? currentTags.filter(id => id !== tagId)
      : [...currentTags, tagId];
    onFilterChange({
      ...filter,
      tagIds: newTags.length > 0 ? newTags : undefined
    });
  };

  // Select tag from dropdown
  const selectTag = (tagId: string) => {
    toggleTag(tagId);
    setTagSearch('');
    setIsTagDropdownOpen(false);
    setHighlightedTagIndex(-1);
  };

  // Toggle account selection
  const toggleAccount = (accountId: string) => {
    const currentAccounts = filter.accountIds || [];
    const isSelected = currentAccounts.includes(accountId);
    const newAccounts = isSelected
      ? currentAccounts.filter(id => id !== accountId)
      : [...currentAccounts, accountId];
    onFilterChange({
      ...filter,
      accountIds: newAccounts.length > 0 ? newAccounts : undefined
    });
  };

  // Select account from dropdown
  const selectAccount = (accountId: string) => {
    toggleAccount(accountId);
    setAccountSearch('');
    setIsAccountDropdownOpen(false);
    setHighlightedAccountIndex(-1);
  };

  // Toggle type selection
  const toggleType = (type: TransactionType) => {
    const currentTypes = filter.types || [];
    const isSelected = currentTypes.includes(type);
    const newTypes = isSelected
      ? currentTypes.filter(t => t !== type)
      : [...currentTypes, type];
    onFilterChange({
      ...filter,
      types: newTypes.length > 0 ? newTypes : undefined
    });
  };

  // Toggle category selection
  const toggleCategory = (categoryId: string) => {
    const currentCategories = filter.labelIds || [];
    const isSelected = currentCategories.includes(categoryId);
    const newCategories = isSelected
      ? currentCategories.filter(id => id !== categoryId)
      : [...currentCategories, categoryId];
    onFilterChange({
      ...filter,
      labelIds: newCategories.length > 0 ? newCategories : undefined
    });
  };

  // Select category from dropdown
  const selectCategory = (categoryId: string) => {
    toggleCategory(categoryId);
    setCategorySearch('');
    setIsCategoryDropdownOpen(false);
    setHighlightedCategoryIndex(-1);
  };

  if (!isOpen) return null;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-900 dark:text-gray-100">Filters</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Account Filter - Searchable multi-select */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Accounts
          </label>
          
          <div className="relative" ref={accountDropdownRef}>
            <div 
              className="flex flex-wrap items-center gap-1.5 px-2 py-1.5 min-h-[42px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent cursor-text"
              onClick={() => accountInputRef.current?.focus()}
            >
              {/* Selected accounts as tokens */}
              {(filter.accountIds || []).map((accountId) => {
                const account = accounts.find(a => a.id === accountId);
                if (!account) return null;
                return (
                  <span
                    key={account.id}
                    className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 text-sm font-medium rounded-full bg-purple-500 text-white"
                  >
                    {account.name}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleAccount(account.id);
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
                ref={accountInputRef}
                type="text"
                value={accountSearch}
                onChange={(e) => {
                  setAccountSearch(e.target.value);
                  setIsAccountDropdownOpen(true);
                  setHighlightedAccountIndex(-1);
                }}
                onFocus={() => setIsAccountDropdownOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setHighlightedAccountIndex(prev =>
                      prev < filteredAccounts.length - 1 ? prev + 1 : 0
                    );
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setHighlightedAccountIndex(prev =>
                      prev > 0 ? prev - 1 : filteredAccounts.length - 1
                    );
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (highlightedAccountIndex >= 0 && filteredAccounts[highlightedAccountIndex]) {
                      selectAccount(filteredAccounts[highlightedAccountIndex].id);
                    } else if (filteredAccounts.length === 1) {
                      selectAccount(filteredAccounts[0].id);
                    }
                  } else if (e.key === 'Escape') {
                    setIsAccountDropdownOpen(false);
                    setAccountSearch('');
                  } else if (e.key === 'Backspace' && !accountSearch && filter.accountIds?.length) {
                    toggleAccount(filter.accountIds[filter.accountIds.length - 1]);
                  }
                }}
                placeholder={!filter.accountIds?.length ? "Search accounts..." : ""}
                className="flex-1 min-w-[80px] bg-transparent border-none outline-none text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 text-sm"
              />
            </div>
            
            {/* Dropdown */}
            {isAccountDropdownOpen && filteredAccounts.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredAccounts.map((account, index) => (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => selectAccount(account.id)}
                    className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${
                      index === highlightedAccountIndex
                        ? 'bg-purple-50 dark:bg-purple-900/30'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <span className="text-gray-900 dark:text-white">{account.name}</span>
                    <span className="text-gray-500 dark:text-gray-400 text-xs ml-auto">{account.currency}</span>
                  </button>
                ))}
              </div>
            )}
            
            {isAccountDropdownOpen && accountSearch && filteredAccounts.length === 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg p-3">
                <p className="text-sm text-gray-500 dark:text-gray-400">No matching accounts</p>
              </div>
            )}
          </div>
        </div>

        {/* Type Filter - Multi-select chips */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Type
          </label>
          <div className="flex flex-wrap gap-2">
            {(['Credit', 'Debit', 'Transfer'] as TransactionType[]).map((type) => {
              const isSelected = filter.types?.includes(type) ?? false;
              const colors = {
                Credit: { bg: 'bg-green-500', hover: 'hover:bg-green-600', unselected: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50' },
                Debit: { bg: 'bg-red-500', hover: 'hover:bg-red-600', unselected: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50' },
                Transfer: { bg: 'bg-blue-500', hover: 'hover:bg-blue-600', unselected: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50' },
              };
              const icons = { Credit: '↓', Debit: '↑', Transfer: '↔' };
              const labels = { Credit: 'Credit', Debit: 'Debit', Transfer: 'Transfer' };
              
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleType(type)}
                  className={`px-3 py-1.5 text-sm rounded-full transition-colors flex items-center gap-1.5 ${
                    isSelected
                      ? `${colors[type].bg} text-white ${colors[type].hover}`
                      : colors[type].unselected
                  }`}
                >
                  <span>{icons[type]}</span>
                  <span>{labels[type]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Category Filter - Searchable multi-select */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Categories
          </label>
          
          <div className="relative" ref={categoryDropdownRef}>
            <div 
              className="flex flex-wrap items-center gap-1.5 px-2 py-1.5 min-h-[42px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent cursor-text"
              onClick={() => categoryInputRef.current?.focus()}
            >
              {/* Selected categories as tokens */}
              {(filter.labelIds || []).map((labelId) => {
                const category = categories.find(c => c.id === labelId);
                if (!category) return null;
                return (
                  <span
                    key={category.id}
                    className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 text-sm font-medium rounded-full bg-amber-500 text-white"
                    style={category.color ? { backgroundColor: category.color } : undefined}
                  >
                    {category.icon && <span>{category.icon}</span>}
                    {category.name}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCategory(category.id);
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
                      selectCategory(filteredCategories[highlightedCategoryIndex].id);
                    } else if (filteredCategories.length === 1) {
                      selectCategory(filteredCategories[0].id);
                    }
                  } else if (e.key === 'Escape') {
                    setIsCategoryDropdownOpen(false);
                    setCategorySearch('');
                  } else if (e.key === 'Backspace' && !categorySearch && filter.labelIds?.length) {
                    toggleCategory(filter.labelIds[filter.labelIds.length - 1]);
                  }
                }}
                placeholder={!filter.labelIds?.length ? "Search categories..." : ""}
                className="flex-1 min-w-[80px] bg-transparent border-none outline-none text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 text-sm"
              />
            </div>
            
            {/* Dropdown */}
            {isCategoryDropdownOpen && filteredCategories.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredCategories.map((category, index) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => selectCategory(category.id)}
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
                ))}
              </div>
            )}
            
            {isCategoryDropdownOpen && categorySearch && filteredCategories.length === 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg p-3">
                <p className="text-sm text-gray-500 dark:text-gray-400">No matching categories</p>
              </div>
            )}
          </div>
        </div>

        {/* Tags - Searchable multi-select */}
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
              {/* Selected tags as tokens */}
              {(filter.tagIds || []).map((tagId) => {
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
                  setHighlightedTagIndex(-1);
                }}
                onFocus={() => setIsTagDropdownOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setHighlightedTagIndex(prev =>
                      prev < filteredTags.length - 1 ? prev + 1 : 0
                    );
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setHighlightedTagIndex(prev =>
                      prev > 0 ? prev - 1 : filteredTags.length - 1
                    );
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (highlightedTagIndex >= 0 && filteredTags[highlightedTagIndex]) {
                      selectTag(filteredTags[highlightedTagIndex].id);
                    } else if (filteredTags.length === 1) {
                      selectTag(filteredTags[0].id);
                    }
                  } else if (e.key === 'Escape') {
                    setIsTagDropdownOpen(false);
                    setTagSearch('');
                  } else if (e.key === 'Backspace' && !tagSearch && filter.tagIds?.length) {
                    // Remove last tag
                    toggleTag(filter.tagIds[filter.tagIds.length - 1]);
                  }
                }}
                placeholder={!filter.tagIds?.length ? "Search tags..." : ""}
                className="flex-1 min-w-[80px] bg-transparent border-none outline-none text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 text-sm"
              />
            </div>
            
            {/* Dropdown */}
            {isTagDropdownOpen && filteredTags.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredTags.map((tag, index) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => selectTag(tag.id)}
                    className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${
                      index === highlightedTagIndex
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
              </div>
            )}
            
            {/* No tags message */}
            {isTagDropdownOpen && tagSearch && filteredTags.length === 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg p-3">
                <p className="text-sm text-gray-500 dark:text-gray-400">No matching tags</p>
              </div>
            )}
          </div>
          
          {filter.tagIds && filter.tagIds.length > 0 && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Showing transactions with any selected tag
            </p>
          )}
        </div>

        {/* Cleared Status Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Status
          </label>
          <select
            value={filter.isCleared === undefined ? '' : filter.isCleared.toString()}
            onChange={(e) => onFilterChange({ 
              ...filter, 
              isCleared: e.target.value === '' ? undefined : e.target.value === 'true' 
            })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
              bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
              focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All</option>
            <option value="true">Cleared</option>
            <option value="false">Pending</option>
          </select>
        </div>

        {/* Amount Range */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Amount Range
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Min"
              value={filter.minAmount ?? ''}
              onChange={(e) => onFilterChange({ 
                ...filter, 
                minAmount: e.target.value ? parseFloat(e.target.value) : undefined 
              })}
              className="w-1/2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <input
              type="number"
              placeholder="Max"
              value={filter.maxAmount ?? ''}
              onChange={(e) => onFilterChange({ 
                ...filter, 
                maxAmount: e.target.value ? parseFloat(e.target.value) : undefined 
              })}
              className="w-1/2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Clear Filters Button */}
      <div className="flex justify-end">
        <button
          onClick={() => onFilterChange({
            startDate: filter.startDate,
            endDate: filter.endDate,
            searchText: filter.searchText,
          })}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          Clear Filters
        </button>
      </div>
    </div>
  );
}

export default function TransactionsPage() {
  // Data state
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [summary, setSummary] = useState<TransactionSummary | null>(null);
  
  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [showLoadingSkeleton, setShowLoadingSkeleton] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const pageSize = 50;
  
  // Filter state
  const [datePreset, setDatePreset] = useState<DatePreset>('thisMonth');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [searchText, setSearchText] = useState('');
  const [filter, setFilter] = useState<TransactionFilter>({});
  
  // Refs
  const listRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Delayed loading skeleton - only show if loading takes more than 200ms
  useEffect(() => {
    if (isLoading) {
      loadingTimeoutRef.current = setTimeout(() => {
        setShowLoadingSkeleton(true);
      }, 200);
    } else {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
      setShowLoadingSkeleton(false);
    }
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [isLoading]);

  // Get current date range based on preset
  const getDateRange = useCallback((): { startDate: string; endDate: string } => {
    if (datePreset === 'custom') {
      return {
        startDate: customStartDate ? formatDateToStartOfDay(new Date(customStartDate)) : '',
        endDate: customEndDate ? formatDateToEndOfDay(new Date(customEndDate)) : '',
      };
    }
    const range = getDateRangeForPreset(datePreset);
    return {
      startDate: formatDateToStartOfDay(range.start),
      endDate: formatDateToEndOfDay(range.end),
    };
  }, [datePreset, customStartDate, customEndDate]);

  // Load initial data
  useEffect(() => {
    async function loadInitialData() {
      try {
        const [accountsData, labelsData, tagsData] = await Promise.all([
          getAccounts(),
          getLabels(),
          getTags(),
        ]);
        setAccounts(accountsData);
        setLabels(labelsData);
        setTags(tagsData);
      } catch (err) {
        logger.error('Failed to load initial data:', err);
        setError('Failed to load data. Please refresh the page.');
      }
    }
    loadInitialData();
  }, []);

  // Load transactions when filter changes
  const loadTransactions = useCallback(async (page = 1, append = false) => {
    if (page === 1) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }
    setError(null);

    try {
      const dateRange = getDateRange();
      const fullFilter: TransactionFilter = {
        ...filter,
        ...dateRange,
        searchText: searchText || undefined,
        page,
        pageSize,
      };

      const [transactionsData, summaryData] = await Promise.all([
        getTransactions(fullFilter),
        // For summary, use first selected account or undefined for all
        page === 1 ? getTransactionSummary(dateRange.startDate, dateRange.endDate, filter.accountIds?.[0]) : Promise.resolve(null),
      ]);

      if (append) {
        setTransactions(prev => [...prev, ...transactionsData.transactions]);
      } else {
        setTransactions(transactionsData.transactions);
      }
      
      if (summaryData) {
        setSummary(summaryData);
      }
      
      setCurrentPage(transactionsData.page);
      setHasMore(transactionsData.page < transactionsData.totalPages);
    } catch (err) {
      logger.error('Failed to load transactions:', err);
      setError('Failed to load transactions. Please try again.');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [filter, searchText, getDateRange]);

  // Initial load and reload on filter changes
  useEffect(() => {
    loadTransactions(1, false);
  }, [loadTransactions]);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      loadTransactions(1, false);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchText]);

  // Infinite scroll handler
  useEffect(() => {
    const handleScroll = () => {
      if (!listRef.current || isLoadingMore || !hasMore) return;
      
      const { scrollTop, scrollHeight, clientHeight } = listRef.current;
      if (scrollTop + clientHeight >= scrollHeight - 200) {
        loadTransactions(currentPage + 1, true);
      }
    };

    const listElement = listRef.current;
    if (listElement) {
      listElement.addEventListener('scroll', handleScroll);
      return () => listElement.removeEventListener('scroll', handleScroll);
    }
  }, [currentPage, hasMore, isLoadingMore, loadTransactions]);

  // Handle date preset change
  const handleDatePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    if (preset !== 'custom') {
      setCustomStartDate('');
      setCustomEndDate('');
    } else {
      // Set default custom range to this month
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      setCustomStartDate(formatDateForInput(startOfMonth));
      setCustomEndDate(formatDateForInput(now));
    }
  };

  // Handle transaction form submit
  const handleFormSubmit = async (data: CreateTransactionRequest | UpdateTransactionRequest) => {
    setIsSubmitting(true);
    setError(null);
    try {
      if (editingTransaction) {
        await updateTransaction(editingTransaction.id, data as UpdateTransactionRequest);
      } else {
        await createTransaction(data as CreateTransactionRequest);
      }
      setIsFormOpen(false);
      setEditingTransaction(null);
      loadTransactions(1, false);
    } catch (err) {
      logger.error('Failed to save transaction:', err);
      const message = err instanceof Error ? err.message : 'Failed to save transaction. Please try again.';
      setError(message);
      // Don't close the form on error so user can fix and retry
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle edit
  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setIsFormOpen(true);
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    try {
      await deleteTransaction(id);
      loadTransactions(1, false);
    } catch (err) {
      logger.error('Failed to delete transaction:', err);
      setError('Failed to delete transaction. Please try again.');
    }
  };

  // Handle toggle cleared
  const handleToggleCleared = async (id: string, isCleared: boolean) => {
    try {
      await toggleCleared(id, isCleared);
      setTransactions(prev => prev.map(t => 
        t.id === id ? { ...t, isCleared } : t
      ));
    } catch (err) {
      logger.error('Failed to update transaction:', err);
      setError('Failed to update transaction. Please try again.');
    }
  };

  // Close form
  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingTransaction(null);
  };

  // Get active filter count (excluding date range and search)
  const activeFilterCount = [
    filter.accountIds && filter.accountIds.length > 0,
    filter.types && filter.types.length > 0,
    filter.labelIds && filter.labelIds.length > 0,
    filter.tagIds && filter.tagIds.length > 0,
    filter.isCleared !== undefined,
    filter.minAmount !== undefined,
    filter.maxAmount !== undefined,
  ].filter(Boolean).length;

  const primaryCurrency = summary?.currency || 'USD';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Transactions
        </h1>
        <button
          onClick={() => setIsFormOpen(true)}
          className="hidden sm:flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg 
            hover:bg-blue-700 transition-colors font-medium"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Transaction
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 
          rounded-lg text-red-600 dark:text-red-400 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {/* Date Presets */}
      <div className="flex flex-wrap gap-2 mb-4">
        {(['today', 'thisWeek', 'thisMonth', 'lastMonth', 'custom'] as DatePreset[]).map((preset) => (
          <button
            key={preset}
            onClick={() => handleDatePresetChange(preset)}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              datePreset === preset
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400'
            }`}
          >
            {preset === 'today' && 'Today'}
            {preset === 'thisWeek' && 'This Week'}
            {preset === 'thisMonth' && 'This Month'}
            {preset === 'lastMonth' && 'Last Month'}
            {preset === 'custom' && 'Custom'}
          </button>
        ))}
      </div>

      {/* Custom Date Range */}
      {datePreset === 'custom' && (
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 dark:text-gray-400">From:</label>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg 
                bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 dark:text-gray-400">To:</label>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg 
                bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <SummaryCard
            label="Money In"
            amount={summary.totalCredits}
            icon="↓"
            colorClass="text-green-600 dark:text-green-400"
            currency={primaryCurrency}
          />
          <SummaryCard
            label="Money Out"
            amount={summary.totalDebits}
            icon="↑"
            colorClass="text-red-600 dark:text-red-400"
            currency={primaryCurrency}
          />
          <SummaryCard
            label="Net"
            amount={summary.netChange}
            icon="📊"
            colorClass={summary.netChange >= 0 
              ? 'text-blue-600 dark:text-blue-400' 
              : 'text-orange-600 dark:text-orange-400'}
            currency={primaryCurrency}
          />
        </div>
      )}

      {/* Search and Filter Row */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1 relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search title, category, tag, account, city..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
              bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
              focus:ring-2 focus:ring-blue-500 focus:border-blue-500
              placeholder-gray-400 dark:placeholder-gray-500"
          />
          {searchText && (
            <button
              onClick={() => setSearchText('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <button
          onClick={() => setIsFilterOpen(!isFilterOpen)}
          className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
            isFilterOpen || activeFilterCount > 0
              ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400'
              : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-400'
          }`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" 
            />
          </svg>
          <span className="hidden sm:inline">Filters</span>
          {activeFilterCount > 0 && (
            <span className="bg-blue-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Filter Panel */}
      <FilterPanel
        isOpen={isFilterOpen}
        accounts={accounts}
        labels={labels}
        tags={tags}
        filter={filter}
        onFilterChange={setFilter}
        onClose={() => setIsFilterOpen(false)}
      />

      {/* Transaction List */}
      <div 
        ref={listRef}
        className="flex-1 overflow-y-auto min-h-0"
      >
        <TransactionList
          transactions={transactions}
          accounts={accounts}
          labels={labels}
          tags={tags}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onToggleCleared={handleToggleCleared}
          isLoading={showLoadingSkeleton}
        />
        
        {/* Loading More Indicator */}
        {isLoadingMore && (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        )}
        
        {/* End of List */}
        {!isLoading && !hasMore && transactions.length > 0 && (
          <div className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">
            {transactions.length} transaction{transactions.length !== 1 ? 's' : ''} • End of list
          </div>
        )}
      </div>

      {/* Floating Action Button (Mobile) */}
      <button
        onClick={() => setIsFormOpen(true)}
        className="sm:hidden fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full 
          shadow-lg hover:bg-blue-700 transition-colors flex items-center justify-center z-40"
      >
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* Transaction Form Modal */}
      <TransactionForm
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        onSubmit={handleFormSubmit}
        editingTransaction={editingTransaction}
        accounts={accounts}
        labels={labels}
        tags={tags}
        isLoading={isSubmitting}
        autoLocationEnabled={true}
        onCreateTag={async (name) => {
          try {
            const newTag = await createTag({ name });
            // Add to local tags list
            setTags(prev => [...prev, newTag]);
            return newTag;
          } catch (error) {
            logger.error('Failed to create tag:', error);
            return null;
          }
        }}
      />
    </div>
  );
}
