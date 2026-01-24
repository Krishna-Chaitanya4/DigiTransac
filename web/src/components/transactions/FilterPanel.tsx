import { useState, useRef, useEffect, useMemo } from 'react';
import type { Account } from '../../services/accountService';
import type { Label, Tag } from '../../types/labels';
import type { TransactionFilter, TransactionUIType } from '../../types/transactions';

interface FilterPanelProps {
  isOpen: boolean;
  accounts: Account[];
  labels: Label[];
  tags: Tag[];
  filter: TransactionFilter;
  onFilterChange: (filter: TransactionFilter) => void;
  onClose: () => void;
}

export function FilterPanel({
  isOpen,
  accounts,
  labels,
  tags,
  filter,
  onFilterChange,
  onClose,
}: FilterPanelProps) {
  // Search states for each dropdown
  const [accountSearch, setAccountSearch] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [tagSearch, setTagSearch] = useState('');

  // Dropdown open states
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);

  // Highlighted index for keyboard navigation
  const [highlightedAccountIndex, setHighlightedAccountIndex] = useState(-1);
  const [highlightedCategoryIndex, setHighlightedCategoryIndex] = useState(-1);
  const [highlightedTagIndex, setHighlightedTagIndex] = useState(-1);

  // Refs for inputs and dropdowns
  const accountInputRef = useRef<HTMLInputElement>(null);
  const categoryInputRef = useRef<HTMLInputElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const accountDropdownRef = useRef<HTMLDivElement>(null);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const tagDropdownRef = useRef<HTMLDivElement>(null);

  // Get all folders and categories for the dropdown
  const foldersAndCategories = useMemo(() => {
    // Get all folders
    const folders = labels.filter(l => l.type === 'Folder');
    // Get all categories (non-folders)
    const categories = labels.filter(l => l.type === 'Category');
    
    // Sort: folders first (alphabetically), then categories (alphabetically)
    return [
      ...folders.sort((a, b) => a.name.localeCompare(b.name)),
      ...categories.sort((a, b) => a.name.localeCompare(b.name)),
    ];
  }, [labels]);

  // Get ALL leaf category IDs for a folder (recursively)
  const getChildCategoryIds = (folderId: string): string[] => {
    const result: string[] = [];
    
    const collectCategories = (parentId: string) => {
      const children = labels.filter(l => l.parentId === parentId);
      for (const child of children) {
        if (child.type === 'Category') {
          result.push(child.id);
        } else if (child.type === 'Folder') {
          // Recursively get categories from sub-folders
          collectCategories(child.id);
        }
      }
    };
    
    collectCategories(folderId);
    return result;
  };

  // Filter items based on search
  const filteredAccounts = useMemo(() => {
    const selectedIds = new Set(filter.accountIds || []);
    return accounts.filter(a => 
      !selectedIds.has(a.id) &&
      a.name.toLowerCase().includes(accountSearch.toLowerCase())
    );
  }, [accounts, accountSearch, filter.accountIds]);

  const filteredCategories = useMemo(() => {
    const selectedLabelIds = new Set(filter.labelIds || []);
    const selectedFolderIds = new Set(filter.folderIds || []);
    return foldersAndCategories.filter(c => 
      !selectedLabelIds.has(c.id) &&
      !selectedFolderIds.has(c.id) &&
      c.name.toLowerCase().includes(categorySearch.toLowerCase())
    );
  }, [foldersAndCategories, categorySearch, filter.labelIds, filter.folderIds]);

  const filteredTags = useMemo(() => {
    const selectedIds = new Set(filter.tagIds || []);
    return tags.filter(t => 
      !selectedIds.has(t.id) &&
      t.name.toLowerCase().includes(tagSearch.toLowerCase())
    );
  }, [tags, tagSearch, filter.tagIds]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(event.target as Node)) {
        setIsAccountDropdownOpen(false);
        setAccountSearch('');
      }
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setIsCategoryDropdownOpen(false);
        setCategorySearch('');
      }
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(event.target as Node)) {
        setIsTagDropdownOpen(false);
        setTagSearch('');
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
  const toggleType = (type: TransactionUIType) => {
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

  // Toggle category or folder selection
  const toggleCategory = (labelId: string) => {
    const label = labels.find(l => l.id === labelId);
    if (!label) return;

    if (label.type === 'Folder') {
      // Handle folder selection
      const currentFolders = filter.folderIds || [];
      const isSelected = currentFolders.includes(labelId);
      const newFolders = isSelected
        ? currentFolders.filter(id => id !== labelId)
        : [...currentFolders, labelId];
      onFilterChange({
        ...filter,
        folderIds: newFolders.length > 0 ? newFolders : undefined
      });
    } else {
      // Handle category selection
      const currentCategories = filter.labelIds || [];
      const isSelected = currentCategories.includes(labelId);
      const newCategories = isSelected
        ? currentCategories.filter(id => id !== labelId)
        : [...currentCategories, labelId];
      onFilterChange({
        ...filter,
        labelIds: newCategories.length > 0 ? newCategories : undefined
      });
    }
  };

  // Remove folder from selection
  const removeFolder = (folderId: string) => {
    const currentFolders = filter.folderIds || [];
    const newFolders = currentFolders.filter(id => id !== folderId);
    onFilterChange({
      ...filter,
      folderIds: newFolders.length > 0 ? newFolders : undefined
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
                    className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 text-sm font-medium rounded-full bg-purple-500 dark:bg-purple-900 text-white"
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
                    <span className="text-gray-400 text-xs ml-auto">{account.currency}</span>
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
            {(['Receive', 'Send', 'Transfer'] as TransactionUIType[]).map((type) => {
              const isSelected = filter.types?.includes(type) ?? false;
              const colors = {
                Receive: { bg: 'bg-green-500', hover: 'hover:bg-green-600', unselected: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50' },
                Send: { bg: 'bg-red-500', hover: 'hover:bg-red-600', unselected: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50' },
                Transfer: { bg: 'bg-blue-500', hover: 'hover:bg-blue-600', unselected: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50' },
              };
              const icons = { Receive: '↓', Send: '↑', Transfer: '↔' };
              const labels = { Receive: 'Receive', Send: 'Send', Transfer: 'Transfer' };
              
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
              {/* Selected folders as tokens */}
              {(filter.folderIds || []).map((folderId) => {
                const folder = labels.find(l => l.id === folderId);
                if (!folder) return null;
                const childCount = getChildCategoryIds(folderId).length;
                return (
                  <span
                    key={folder.id}
                    className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 text-sm font-medium rounded-full bg-blue-500 dark:bg-blue-950 text-white"
                    style={folder.color ? { backgroundColor: folder.color } : undefined}
                  >
                    {folder.icon && <span>{folder.icon}</span>}
                    {folder.name}
                    {childCount > 0 && (
                      <span className="text-xs opacity-75">({childCount})</span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFolder(folder.id);
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
              
              {/* Selected categories as tokens */}
              {(filter.labelIds || []).map((labelId) => {
                const category = labels.find(l => l.id === labelId);
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
                  } else if (e.key === 'Backspace' && !categorySearch) {
                    // Remove last selected item (category first, then folder)
                    if (filter.labelIds?.length) {
                      toggleCategory(filter.labelIds[filter.labelIds.length - 1]);
                    } else if (filter.folderIds?.length) {
                      removeFolder(filter.folderIds[filter.folderIds.length - 1]);
                    }
                  }
                }}
                placeholder={!(filter.labelIds?.length || filter.folderIds?.length) ? "Search categories..." : ""}
                className="flex-1 min-w-[80px] bg-transparent border-none outline-none text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 text-sm"
              />
            </div>
            
            {/* Dropdown */}
            {isCategoryDropdownOpen && filteredCategories.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredCategories.map((item, index) => {
                  const isFolder = item.type === 'Folder';
                  const childCount = isFolder ? getChildCategoryIds(item.id).length : 0;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selectCategory(item.id)}
                      className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${
                        index === highlightedCategoryIndex
                          ? 'bg-amber-50 dark:bg-amber-900/30'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      {item.icon ? (
                        <span>{item.icon}</span>
                      ) : item.color ? (
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                      ) : null}
                      <span className="text-gray-900 dark:text-white flex-1">{item.name}</span>
                      {isFolder && childCount > 0 && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {childCount} categories
                        </span>
                      )}
                    </button>
                  );
                })}
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
                    className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 text-sm font-medium rounded-full bg-blue-500 dark:bg-blue-950 text-white"
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

        {/* Status Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Status
          </label>
          <select
            value={filter.status ?? ''}
            onChange={(e) => onFilterChange({ 
              ...filter, 
              status: e.target.value === '' ? undefined : e.target.value as 'Pending' | 'Confirmed' | 'Declined'
            })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
              bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
              focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All</option>
            <option value="Confirmed">Confirmed</option>
            <option value="Pending">Pending</option>
            <option value="Declined">Declined</option>
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
