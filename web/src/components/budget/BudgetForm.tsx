import { memo, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useCurrency } from '../../context/CurrencyContext';
import { EmojiPickerInput } from '../EmojiPickerInput';
import { DatePicker } from '../DatePicker';
import { CurrencyDropdown } from '../CurrencyDropdown';
import { getCurrencySymbol } from '../../services/currencyService';
import { CalculatorInput } from '../CalculatorInput';
import type { Budget, BudgetPeriod, CreateBudgetRequest, UpdateBudgetRequest, BudgetAlertRequest } from '../../types/budgets';
import { defaultAlerts } from '../../types/budgets';
import type { Label } from '../../types/labels';
import type { Account } from '../../services/accountService';

interface BudgetFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateBudgetRequest | UpdateBudgetRequest) => Promise<void>;
  editingBudget?: Budget | null;
  labels: Label[];
  accounts: Account[];
  isLoading?: boolean;
  error?: string | null;
}

const PERIOD_OPTIONS: { value: BudgetPeriod; label: string; icon: string }[] = [
  { value: 'Weekly', label: 'Weekly', icon: '📅' },
  { value: 'Monthly', label: 'Monthly', icon: '🗓️' },
  { value: 'Quarterly', label: 'Quarterly', icon: '📊' },
  { value: 'Yearly', label: 'Yearly', icon: '🎯' },
  { value: 'Custom', label: 'Custom', icon: '⚙️' },
];

// Preset colors (matching AccountModal style)
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

export const BudgetForm = memo(function BudgetForm({
  isOpen,
  onClose,
  onSubmit,
  editingBudget,
  labels,
  accounts,
  isLoading = false,
  error,
}: BudgetFormProps) {
  const modalRef = useFocusTrap<HTMLDivElement>(isOpen);
  const { primaryCurrency } = useCurrency();
  
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState(0);
  const [currency, setCurrency] = useState(primaryCurrency);
  const [period, setPeriod] = useState<BudgetPeriod>('Monthly');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);
  const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [selectedIcon, setSelectedIcon] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('#3B82F6');
  const [alerts, setAlerts] = useState<BudgetAlertRequest[]>(defaultAlerts);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const categoryInputRef = useRef<HTMLInputElement>(null);

  // Get all folders and categories for the dropdown
  const foldersAndCategories = useMemo(() => {
    const folders = labels.filter(l => l.type === 'Folder');
    const categories = labels.filter(l => l.type === 'Category');
    return [
      ...folders.sort((a, b) => a.name.localeCompare(b.name)),
      ...categories.sort((a, b) => a.name.localeCompare(b.name)),
    ];
  }, [labels]);

  // Get ALL leaf category IDs for a folder (recursively)
  const getChildCategoryIds = useCallback((folderId: string): string[] => {
    const result: string[] = [];
    const collectCategories = (parentId: string) => {
      const children = labels.filter(l => l.parentId === parentId);
      for (const child of children) {
        if (child.type === 'Category') {
          result.push(child.id);
        } else if (child.type === 'Folder') {
          collectCategories(child.id);
        }
      }
    };
    collectCategories(folderId);
    return result;
  }, [labels]);

  // Filter categories/folders by search
  const filteredCategories = useMemo(() => {
    const searchLower = categorySearch.toLowerCase().trim();
    const selectedLabelSet = new Set(selectedLabelIds);
    const selectedFolderSet = new Set(selectedFolderIds);
    return foldersAndCategories.filter(c =>
      !selectedLabelSet.has(c.id) &&
      !selectedFolderSet.has(c.id) &&
      c.name.toLowerCase().includes(searchLower)
    );
  }, [foldersAndCategories, categorySearch, selectedLabelIds, selectedFolderIds]);

  // Reset form when modal opens/closes or editing budget changes
  useEffect(() => {
    if (isOpen) {
      if (editingBudget) {
        setName(editingBudget.name);
        setDescription(editingBudget.description || '');
        setAmount(editingBudget.amount);
        setCurrency(editingBudget.currency);
        setPeriod(editingBudget.period);
        setStartDate(editingBudget.startDate ? editingBudget.startDate.split('T')[0] : '');
        setEndDate(editingBudget.endDate ? editingBudget.endDate.split('T')[0] : '');
        setSelectedLabelIds(editingBudget.labelIds);
        setSelectedFolderIds([]);
        setSelectedAccountIds(editingBudget.accountIds);
        setSelectedIcon(editingBudget.icon || '');
        setSelectedColor(editingBudget.color || '#3B82F6');
        setAlerts(editingBudget.alerts.map(a => ({
          thresholdPercent: a.thresholdPercent,
          notifyEnabled: a.notifyEnabled
        })));
      } else {
        // Reset to defaults
        setName('');
        setDescription('');
        setAmount(0);
        setCurrency(primaryCurrency);
        setPeriod('Monthly');
        setStartDate('');
        setEndDate('');
        setSelectedLabelIds([]);
        setSelectedFolderIds([]);
        setSelectedAccountIds([]);
        setSelectedIcon('');
        setSelectedColor('#3B82F6');
        setAlerts(defaultAlerts);
      }
      setShowAdvanced(false);
      setCategorySearch('');
      setShowCategoryDropdown(false);
    }
  }, [isOpen, editingBudget, primaryCurrency]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || amount <= 0) {
      return;
    }

    // Expand folders to their child category IDs for the API
    const expandedLabelIds = new Set(selectedLabelIds);
    for (const folderId of selectedFolderIds) {
      const childIds = getChildCategoryIds(folderId);
      childIds.forEach(id => expandedLabelIds.add(id));
    }

    const data: CreateBudgetRequest | UpdateBudgetRequest = {
      name: name.trim(),
      description: description.trim() || undefined,
      amount,
      currency,
      period,
      startDate: startDate || undefined,
      endDate: period === 'Custom' ? endDate || undefined : undefined,
      labelIds: expandedLabelIds.size > 0 ? Array.from(expandedLabelIds) : undefined,
      accountIds: selectedAccountIds.length > 0 ? selectedAccountIds : undefined,
      alerts: alerts.filter(a => a.thresholdPercent > 0),
      icon: selectedIcon || undefined,
      color: selectedColor || undefined,
    };

    await onSubmit(data);
  }, [name, description, amount, currency, period, startDate, endDate, selectedLabelIds, selectedFolderIds, getChildCategoryIds, selectedAccountIds, alerts, selectedIcon, selectedColor, onSubmit]);

  const toggleLabelOrFolder = useCallback((labelId: string) => {
    const label = labels.find(l => l.id === labelId);
    if (!label) return;

    if (label.type === 'Folder') {
      setSelectedFolderIds(prev =>
        prev.includes(labelId)
          ? prev.filter(id => id !== labelId)
          : [...prev, labelId]
      );
    } else {
      setSelectedLabelIds(prev =>
        prev.includes(labelId)
          ? prev.filter(id => id !== labelId)
          : [...prev, labelId]
      );
    }
    setCategorySearch('');
  }, [labels]);

  const removeLabel = useCallback((labelId: string) => {
    setSelectedLabelIds(prev => prev.filter(id => id !== labelId));
  }, []);

  const removeFolder = useCallback((folderId: string) => {
    setSelectedFolderIds(prev => prev.filter(id => id !== folderId));
  }, []);

  const toggleAccount = useCallback((accountId: string) => {
    setSelectedAccountIds(prev => 
      prev.includes(accountId) 
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  }, []);

  const updateAlert = useCallback((index: number, field: 'thresholdPercent' | 'notifyEnabled', value: number | boolean) => {
    setAlerts(prev => prev.map((alert, i) => 
      i === index ? { ...alert, [field]: value } : alert
    ));
  }, []);


  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="budget-form-title"
    >
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black/30 dark:bg-black/50" 
          onClick={onClose}
          aria-hidden="true"
        />
        
        {/* Modal */}
        <div 
          ref={modalRef}
          className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto"
          onKeyDown={(e) => e.key === 'Escape' && onClose()}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 
              focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          {/* Header */}
          <h3 id="budget-form-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            {editingBudget ? 'Edit Budget' : 'New Budget'}
          </h3>
          
          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              {/* Error message */}
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 
                  rounded-lg text-red-600 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}
              
              {/* Name */}
              <div>
                <label htmlFor="budget-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name *
                </label>
                <input
                  id="budget-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Monthly Groceries"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                    bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                    focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                  autoFocus
                />
              </div>
              
              {/* Amount and Currency */}
              <div>
                <label htmlFor="budget-amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Budget Amount *
                </label>
                <div className="flex gap-2">
                  <CurrencyDropdown
                    currency={currency}
                    onChange={setCurrency}
                  />
                  <CalculatorInput
                    id="budget-amount"
                    value={amount}
                    onChange={setAmount}
                    currency={getCurrencySymbol(currency)}
                    placeholder="0.00"
                    className="flex-1"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Select the currency for this budget. Transactions in other currencies will be converted.
                </p>
              </div>
              
              {/* Period Selection - Visual buttons like AccountModal type selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Budget Period *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {PERIOD_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPeriod(opt.value)}
                      className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                        period === opt.value
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-700'
                      }`}
                    >
                      <span className="text-lg">{opt.icon}</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Custom date range - using modern DatePicker */}
              {period === 'Custom' && (
                <div className="grid grid-cols-2 gap-4">
                  <DatePicker
                    label="Start Date"
                    value={startDate}
                    onChange={setStartDate}
                    placeholder="Select start date"
                    maxDate={endDate ? new Date(endDate) : undefined}
                  />
                  <DatePicker
                    label="End Date"
                    value={endDate}
                    onChange={setEndDate}
                    placeholder="Select end date"
                    minDate={startDate ? new Date(startDate) : undefined}
                  />
                </div>
              )}
              
              {/* Categories - Searchable with folder support */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Track Categories
                  <span className="text-gray-500 dark:text-gray-400 font-normal ml-1">(optional)</span>
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Select folders or categories. Folders include all their sub-categories.
                </p>
                
                {/* Selected items + search input */}
                <div
                  className="min-h-[42px] flex flex-wrap gap-1.5 p-2 border border-gray-300 dark:border-gray-600 rounded-lg
                    bg-white dark:bg-gray-700 cursor-text"
                  onClick={() => categoryInputRef.current?.focus()}
                >
                  {/* Selected folders */}
                  {selectedFolderIds.map((folderId) => {
                    const folder = labels.find(l => l.id === folderId);
                    if (!folder) return null;
                    const childCount = getChildCategoryIds(folderId).length;
                    return (
                      <span
                        key={folder.id}
                        className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 text-sm font-medium rounded-full bg-blue-500 text-white"
                        style={folder.color ? { backgroundColor: folder.color } : undefined}
                      >
                        <span>{folder.icon || '📁'}</span>
                        {folder.name}
                        {childCount > 0 && (
                          <span className="text-white/80 text-xs">({childCount})</span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFolder(folder.id);
                          }}
                          className="ml-1 hover:bg-white/20 rounded-full p-0.5"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    );
                  })}
                  
                  {/* Selected categories */}
                  {selectedLabelIds.map((labelId) => {
                    const label = labels.find(l => l.id === labelId);
                    if (!label) return null;
                    return (
                      <span
                        key={label.id}
                        className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 text-sm font-medium rounded-full bg-gray-500 text-white"
                        style={label.color ? { backgroundColor: label.color } : undefined}
                      >
                        {label.icon && <span>{label.icon}</span>}
                        {label.name}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeLabel(label.id);
                          }}
                          className="ml-1 hover:bg-white/20 rounded-full p-0.5"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                      setShowCategoryDropdown(true);
                    }}
                    onFocus={() => setShowCategoryDropdown(true)}
                    onBlur={() => setTimeout(() => setShowCategoryDropdown(false), 150)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setShowCategoryDropdown(false);
                        categoryInputRef.current?.blur();
                      } else if (e.key === 'Backspace' && !categorySearch) {
                        // Remove last selected item
                        if (selectedLabelIds.length) {
                          removeLabel(selectedLabelIds[selectedLabelIds.length - 1]);
                        } else if (selectedFolderIds.length) {
                          removeFolder(selectedFolderIds[selectedFolderIds.length - 1]);
                        }
                      }
                    }}
                    placeholder={!(selectedLabelIds.length || selectedFolderIds.length) ? "Search categories or folders..." : ""}
                    className="flex-1 min-w-[120px] bg-transparent border-none outline-none text-gray-900 dark:text-white
                      placeholder:text-gray-400 dark:placeholder:text-gray-500 text-sm"
                  />
                </div>
                
                {/* Dropdown */}
                {showCategoryDropdown && filteredCategories.length > 0 && (
                  <div className="mt-1 max-h-48 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                    rounded-lg shadow-lg z-10 relative">
                    {filteredCategories.map((item) => {
                      const isFolder = item.type === 'Folder';
                      const childCount = isFolder ? getChildCategoryIds(item.id).length : 0;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            toggleLabelOrFolder(item.id);
                            categoryInputRef.current?.focus();
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          <span className="flex-shrink-0">
                            {item.icon || (isFolder ? '📁' : '🏷️')}
                          </span>
                          <span className="flex-1 text-gray-900 dark:text-gray-100">{item.name}</span>
                          {isFolder && (
                            <span className="text-xs text-gray-400 dark:text-gray-500">
                              {childCount > 0 ? `${childCount} categories` : 'folder'}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
                
                {showCategoryDropdown && filteredCategories.length === 0 && categorySearch && (
                  <div className="mt-1 px-3 py-2 text-sm text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800
                    border border-gray-200 dark:border-gray-700 rounded-lg">
                    No matching categories or folders
                  </div>
                )}
              </div>
              
              {/* Icon and Color */}
              <div>
                <EmojiPickerInput
                  id="budget-icon"
                  label="Icon (emoji)"
                  value={selectedIcon}
                  onChange={setSelectedIcon}
                  placeholder="Select an emoji"
                />
              </div>
              
              {/* Color - with preset colors like AccountModal */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Color
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {PRESET_COLORS.map((presetColor) => (
                    <button
                      key={presetColor}
                      type="button"
                      onClick={() => setSelectedColor(presetColor)}
                      className={`w-8 h-8 rounded-full border-2 transition-transform ${
                        selectedColor === presetColor ? 'border-gray-900 dark:border-gray-100 scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: presetColor }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    id="budget-color"
                    value={selectedColor || '#3b82f6'}
                    onChange={(e) => setSelectedColor(e.target.value)}
                    className="w-10 h-10 p-1 border border-gray-300 dark:border-gray-600 rounded cursor-pointer"
                  />
                  {selectedColor && (
                    <button
                      type="button"
                      onClick={() => setSelectedColor('')}
                      className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      Use default
                    </button>
                  )}
                </div>
              </div>
              
              {/* Advanced options toggle - consistent styling with TransactionForm */}
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400
                  hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
              >
                <svg
                  className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
                Advanced options
              </button>
              
              {/* Advanced options */}
              {showAdvanced && (
                <div className="space-y-4 pt-2">
                  {/* Description */}
                  <div>
                    <label htmlFor="budget-desc" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Description
                    </label>
                    <textarea
                      id="budget-desc"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Optional notes about this budget..."
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                        bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                        focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                    />
                  </div>
                  
                  {/* Accounts filter */}
                  {accounts.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Track Accounts
                        <span className="text-gray-500 dark:text-gray-400 font-normal ml-1">(optional)</span>
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {accounts.filter(a => !a.isArchived).map((account) => (
                          <button
                            key={account.id}
                            type="button"
                            onClick={() => toggleAccount(account.id)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${
                              selectedAccountIds.includes(account.id)
                                ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 ring-1 ring-blue-400'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                            }`}
                          >
                            {account.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Alert thresholds */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Alert Thresholds
                    </label>
                    <div className="space-y-2">
                      {alerts.map((alert, index) => (
                        <div key={index} className="flex items-center gap-3">
                          <input
                            type="number"
                            value={alert.thresholdPercent}
                            onChange={(e) => updateAlert(index, 'thresholdPercent', parseInt(e.target.value) || 0)}
                            min="0"
                            max="100"
                            className="w-20 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg
                              bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm
                              focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <span className="text-sm text-gray-500 dark:text-gray-400">%</span>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={alert.notifyEnabled}
                              onChange={(e) => updateAlert(index, 'notifyEnabled', e.target.checked)}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-600 dark:text-gray-400">Notify</span>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Actions */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 
                  border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || !name.trim() || amount <= 0}
                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-br from-blue-600 to-blue-700 
                  dark:from-blue-900 dark:to-blue-950 rounded-lg hover:from-blue-700 hover:to-blue-800 
                  dark:hover:from-blue-800 dark:hover:to-blue-900 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Saving...' : editingBudget ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
});