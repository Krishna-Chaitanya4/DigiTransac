import { useState, useCallback, useMemo } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useCurrency } from '../../context/CurrencyContext';
import { getCurrencySymbol } from '../../services/currencyService';
import type { CreateBudgetRequest, BudgetPeriod } from '../../types/budgets';
import type { Label } from '../../types/labels';

// ── Suggested budget templates ───────────────────────────────────

interface BudgetTemplate {
  id: string;
  name: string;
  icon: string;
  color: string;
  suggestedAmount: number;       // default suggestion (user can change)
  period: BudgetPeriod;
  /** Match keywords against label names to auto-select categories */
  categoryKeywords: string[];
  description: string;
}

const BUDGET_TEMPLATES: BudgetTemplate[] = [
  {
    id: 'food',
    name: 'Food & Dining',
    icon: '🍽️',
    color: '#f97316',
    suggestedAmount: 500,
    period: 'Monthly',
    categoryKeywords: ['food', 'dining', 'restaurant', 'eat', 'lunch', 'dinner', 'breakfast', 'takeout', 'delivery'],
    description: 'Track spending on restaurants, takeout, and dining out.',
  },
  {
    id: 'groceries',
    name: 'Groceries',
    icon: '🛒',
    color: '#10b981',
    suggestedAmount: 400,
    period: 'Monthly',
    categoryKeywords: ['grocery', 'groceries', 'supermarket', 'market'],
    description: 'Weekly grocery and household shopping budget.',
  },
  {
    id: 'transport',
    name: 'Transportation',
    icon: '🚗',
    color: '#3b82f6',
    suggestedAmount: 200,
    period: 'Monthly',
    categoryKeywords: ['transport', 'gas', 'fuel', 'uber', 'taxi', 'bus', 'metro', 'train', 'parking', 'car'],
    description: 'Fuel, public transit, ride-sharing, and parking.',
  },
  {
    id: 'entertainment',
    name: 'Entertainment',
    icon: '🎭',
    color: '#8b5cf6',
    suggestedAmount: 150,
    period: 'Monthly',
    categoryKeywords: ['entertainment', 'movie', 'cinema', 'game', 'music', 'streaming', 'netflix', 'spotify', 'subscription'],
    description: 'Movies, games, subscriptions, and fun activities.',
  },
  {
    id: 'shopping',
    name: 'Shopping',
    icon: '🛍️',
    color: '#ec4899',
    suggestedAmount: 300,
    period: 'Monthly',
    categoryKeywords: ['shopping', 'clothes', 'clothing', 'fashion', 'electronics', 'amazon'],
    description: 'Clothing, electronics, and personal purchases.',
  },
  {
    id: 'housing',
    name: 'Housing & Bills',
    icon: '🏠',
    color: '#06b6d4',
    suggestedAmount: 1500,
    period: 'Monthly',
    categoryKeywords: ['rent', 'mortgage', 'housing', 'utility', 'utilities', 'electric', 'water', 'internet', 'phone', 'insurance', 'bill'],
    description: 'Rent, utilities, internet, and recurring bills.',
  },
  {
    id: 'travel',
    name: 'Travel',
    icon: '✈️',
    color: '#f59e0b',
    suggestedAmount: 500,
    period: 'Quarterly',
    categoryKeywords: ['travel', 'flight', 'hotel', 'vacation', 'trip', 'airbnb', 'booking'],
    description: 'Flights, hotels, and vacation expenses.',
  },
  {
    id: 'health',
    name: 'Health & Wellness',
    icon: '💊',
    color: '#ef4444',
    suggestedAmount: 100,
    period: 'Monthly',
    categoryKeywords: ['health', 'medical', 'doctor', 'pharmacy', 'gym', 'fitness', 'wellness', 'medicine'],
    description: 'Doctor visits, pharmacy, gym, and wellness.',
  },
];

// ── Wizard steps ─────────────────────────────────────────────────

type WizardStep = 'template' | 'customize' | 'categories' | 'review';

const STEP_ORDER: WizardStep[] = ['template', 'customize', 'categories', 'review'];

const PERIOD_OPTIONS: { value: BudgetPeriod; label: string }[] = [
  { value: 'Weekly', label: 'Weekly' },
  { value: 'Monthly', label: 'Monthly' },
  { value: 'Quarterly', label: 'Quarterly' },
  { value: 'Yearly', label: 'Yearly' },
];

// ── Component ────────────────────────────────────────────────────

interface BudgetWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateBudgetRequest) => Promise<void>;
  labels: Label[];
  isLoading?: boolean;
  error?: string | null;
}

export function BudgetWizard({
  isOpen,
  onClose,
  onSubmit,
  labels,
  isLoading = false,
  error,
}: BudgetWizardProps) {
  const modalRef = useFocusTrap<HTMLDivElement>(isOpen);
  const { primaryCurrency } = useCurrency();

  // ── State ──
  const [step, setStep] = useState<WizardStep>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<BudgetTemplate | null>(null);

  // Customization state
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(primaryCurrency);
  const [period, setPeriod] = useState<BudgetPeriod>('Monthly');

  // Category selection
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);

  // Derived
  const stepIndex = STEP_ORDER.indexOf(step);
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === STEP_ORDER.length - 1;

  // Categories and folders
  const categories = useMemo(() => labels.filter(l => l.type === 'Category'), [labels]);
  const folders = useMemo(() => labels.filter(l => l.type === 'Folder'), [labels]);

  // Auto-match categories to template keywords
  const autoMatchCategories = useCallback(
    (template: BudgetTemplate): string[] => {
      const matched: string[] = [];
      for (const cat of categories) {
        const catName = cat.name.toLowerCase();
        if (template.categoryKeywords.some(kw => catName.includes(kw))) {
          matched.push(cat.id);
        }
      }
      // Also check folder names
      for (const folder of folders) {
        const folderName = folder.name.toLowerCase();
        if (template.categoryKeywords.some(kw => folderName.includes(kw))) {
          // Add all children of this folder
          const children = labels.filter(l => l.parentId === folder.id && l.type === 'Category');
          for (const child of children) {
            if (!matched.includes(child.id)) matched.push(child.id);
          }
        }
      }
      return matched;
    },
    [categories, folders, labels],
  );

  // ── Handlers ──

  const handleSelectTemplate = useCallback(
    (template: BudgetTemplate) => {
      setSelectedTemplate(template);
      setName(template.name);
      setIcon(template.icon);
      setColor(template.color);
      setAmount(template.suggestedAmount.toString());
      setPeriod(template.period);
      setCurrency(primaryCurrency);
      setSelectedLabelIds(autoMatchCategories(template));
      setStep('customize');
    },
    [primaryCurrency, autoMatchCategories],
  );

  const handleStartFromScratch = useCallback(() => {
    setSelectedTemplate(null);
    setName('');
    setIcon('');
    setColor('#3b82f6');
    setAmount('');
    setPeriod('Monthly');
    setCurrency(primaryCurrency);
    setSelectedLabelIds([]);
    setStep('customize');
  }, [primaryCurrency]);

  const handleNext = useCallback(() => {
    const next = STEP_ORDER[stepIndex + 1];
    if (next) setStep(next);
  }, [stepIndex]);

  const handleBack = useCallback(() => {
    const prev = STEP_ORDER[stepIndex - 1];
    if (prev) setStep(prev);
  }, [stepIndex]);

  const toggleCategory = useCallback((id: string) => {
    setSelectedLabelIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );
  }, []);

  const handleSubmit = useCallback(async () => {
    const amountNum = parseFloat(amount);
    if (!name.trim() || isNaN(amountNum) || amountNum <= 0) return;

    const data: CreateBudgetRequest = {
      name: name.trim(),
      amount: amountNum,
      currency,
      period,
      labelIds: selectedLabelIds.length > 0 ? selectedLabelIds : undefined,
      icon: icon || undefined,
      color: color || undefined,
    };
    await onSubmit(data);
  }, [name, amount, currency, period, selectedLabelIds, icon, color, onSubmit]);

  // validate current step
  const canProceed = useMemo(() => {
    if (step === 'customize') return name.trim().length > 0 && parseFloat(amount) > 0;
    if (step === 'categories') return true; // optional
    return true;
  }, [step, name, amount]);

  // Reset when modal opens
  const prevOpen = useMemo(() => isOpen, [isOpen]);
  if (!prevOpen && isOpen) {
    // Will be triggered on next render via effect — but since we can't use useEffect in render,
    // we handle reset differently below
  }

  // Reset on open (use key trick — parent should unmount/remount or we rely on effect in parent)
  // For simplicity, reset when step changes back to template
  const resetWizard = useCallback(() => {
    setStep('template');
    setSelectedTemplate(null);
    setName('');
    setIcon('');
    setColor('#3b82f6');
    setAmount('');
    setPeriod('Monthly');
    setCurrency(primaryCurrency);
    setSelectedLabelIds([]);
  }, [primaryCurrency]);

  const handleClose = useCallback(() => {
    resetWizard();
    onClose();
  }, [resetWizard, onClose]);

  // Group categories by parent folder for the categories step
  const categoriesByFolder = useMemo(() => {
    const map: Record<string, Label[]> = {};
    const ungrouped: Label[] = [];
    for (const cat of categories) {
      if (cat.parentId) {
        (map[cat.parentId] ||= []).push(cat);
      } else {
        ungrouped.push(cat);
      }
    }
    return { map, ungrouped };
  }, [categories]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/30 dark:bg-black/50" onClick={handleClose} />

        {/* Modal */}
        <div
          ref={modalRef}
          className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col"
          onKeyDown={e => e.key === 'Escape' && handleClose()}
        >
          {/* Progress bar */}
          <div className="h-1 bg-gray-200 dark:bg-gray-700">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${((stepIndex + 1) / STEP_ORDER.length) * 100}%` }}
            />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {step === 'template' && 'Create a Budget'}
                {step === 'customize' && 'Customize Budget'}
                {step === 'categories' && 'Select Categories'}
                {step === 'review' && 'Review & Create'}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Step {stepIndex + 1} of {STEP_ORDER.length}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* ── Step 1: Template selection ── */}
            {step === 'template' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Pick a suggested budget to get started quickly, or create one from scratch.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {BUDGET_TEMPLATES.map(template => {
                    const matchCount = autoMatchCategories(template).length;
                    return (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => handleSelectTemplate(template)}
                        className="flex flex-col items-start p-3.5 rounded-xl border-2 border-gray-200 dark:border-gray-700
                          hover:border-blue-400 dark:hover:border-blue-600 hover:bg-blue-50/50 dark:hover:bg-blue-900/10
                          transition-all text-left group"
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-2xl">{template.icon}</span>
                          <span className="font-medium text-sm text-gray-900 dark:text-gray-100 group-hover:text-blue-700 dark:group-hover:text-blue-300">
                            {template.name}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug mb-2">
                          {template.description}
                        </p>
                        <div className="flex items-center gap-2 mt-auto">
                          <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-600 dark:text-gray-400">
                            {template.period}
                          </span>
                          {matchCount > 0 && (
                            <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 rounded-full text-green-700 dark:text-green-400">
                              {matchCount} match{matchCount !== 1 ? 'es' : ''}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* From scratch */}
                <button
                  type="button"
                  onClick={handleStartFromScratch}
                  className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600
                    rounded-xl text-gray-600 dark:text-gray-400 hover:border-blue-400 dark:hover:border-blue-600
                    hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Start from scratch
                </button>
              </div>
            )}

            {/* ── Step 2: Customize ── */}
            {step === 'customize' && (
              <div className="space-y-5">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Budget Name *
                  </label>
                  <div className="flex items-center gap-2">
                    {icon && (
                      <span className="text-2xl flex-shrink-0">{icon}</span>
                    )}
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="e.g., Monthly Groceries"
                      className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg
                        bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                        focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Budget Amount *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 text-lg">
                      {getCurrencySymbol(currency)}
                    </span>
                    <input
                      type="number"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      className="w-full pl-10 pr-4 py-2.5 text-lg border border-gray-300 dark:border-gray-600 rounded-lg
                        bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                        focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  {selectedTemplate && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Suggested: {getCurrencySymbol(currency)}{selectedTemplate.suggestedAmount} / {selectedTemplate.period.toLowerCase()}
                    </p>
                  )}
                </div>

                {/* Period */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Recurring Period
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {PERIOD_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setPeriod(opt.value)}
                        className={`py-2 px-1 text-sm rounded-lg border-2 transition-colors font-medium ${
                          period === opt.value
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                            : 'border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 3: Categories ── */}
            {step === 'categories' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Select categories to track for this budget. Leave empty to track all spending.
                  {selectedTemplate && selectedLabelIds.length > 0 && (
                    <span className="text-green-600 dark:text-green-400 ml-1">
                      ({selectedLabelIds.length} auto-matched)
                    </span>
                  )}
                </p>

                {/* Grouped by folder */}
                {folders.map(folder => {
                  const children = categoriesByFolder.map[folder.id];
                  if (!children || children.length === 0) return null;
                  const allSelected = children.every(c => selectedLabelIds.includes(c.id));
                  const someSelected = children.some(c => selectedLabelIds.includes(c.id));

                  return (
                    <div key={folder.id}>
                      <button
                        type="button"
                        onClick={() => {
                          if (allSelected) {
                            setSelectedLabelIds(prev => prev.filter(id => !children.some(c => c.id === id)));
                          } else {
                            setSelectedLabelIds(prev => {
                              const set = new Set(prev);
                              children.forEach(c => set.add(c.id));
                              return Array.from(set);
                            });
                          }
                        }}
                        className="flex items-center gap-2 mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300"
                      >
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                          allSelected
                            ? 'bg-blue-600 border-blue-600'
                            : someSelected
                              ? 'bg-blue-200 dark:bg-blue-800 border-blue-400'
                              : 'border-gray-300 dark:border-gray-600'
                        }`}>
                          {allSelected && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                          {someSelected && !allSelected && (
                            <div className="w-2 h-0.5 bg-blue-600 rounded" />
                          )}
                        </div>
                        <span>{folder.icon || '📁'}</span>
                        {folder.name}
                      </button>
                      <div className="ml-6 flex flex-wrap gap-2 mb-3">
                        {children.map(cat => {
                          const selected = selectedLabelIds.includes(cat.id);
                          return (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => toggleCategory(cat.id)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-full border transition-colors ${
                                selected
                                  ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                  : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                              }`}
                            >
                              {cat.icon && <span>{cat.icon}</span>}
                              {cat.name}
                              {selected && (
                                <svg className="w-3 h-3 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {/* Ungrouped categories */}
                {categoriesByFolder.ungrouped.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Other</p>
                    <div className="flex flex-wrap gap-2">
                      {categoriesByFolder.ungrouped.map(cat => {
                        const selected = selectedLabelIds.includes(cat.id);
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => toggleCategory(cat.id)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-full border transition-colors ${
                              selected
                                ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                            }`}
                          >
                            {cat.icon && <span>{cat.icon}</span>}
                            {cat.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {categories.length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                    No categories found. The budget will track all spending.
                  </p>
                )}
              </div>
            )}

            {/* ── Step 4: Review ── */}
            {step === 'review' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl border-2 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10">
                  <div className="flex items-center gap-3 mb-4">
                    {icon ? (
                      <span className="text-3xl">{icon}</span>
                    ) : (
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: color }}
                      >
                        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                    )}
                    <div>
                      <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100">{name}</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{period} budget</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Amount</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                        {getCurrencySymbol(currency)}{parseFloat(amount || '0').toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Categories</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                        {selectedLabelIds.length || 'All'}
                      </p>
                    </div>
                  </div>

                  {selectedLabelIds.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {selectedLabelIds.slice(0, 8).map(id => {
                        const label = labels.find(l => l.id === id);
                        return label ? (
                          <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                            {label.icon && <span>{label.icon}</span>}
                            {label.name}
                          </span>
                        ) : null;
                      })}
                      {selectedLabelIds.length > 8 && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 py-0.5">
                          +{selectedLabelIds.length - 8} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  You can always edit this budget later.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          {step !== 'template' && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <button
                type="button"
                onClick={isFirstStep ? handleClose : handleBack}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300
                  hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                disabled={isLoading}
              >
                {isFirstStep ? 'Cancel' : '← Back'}
              </button>

              {isLastStep ? (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isLoading || !canProceed}
                  className="px-6 py-2.5 text-sm font-semibold text-white bg-gradient-to-br from-blue-600 to-blue-700
                    dark:from-blue-900 dark:to-blue-950 rounded-lg hover:from-blue-700 hover:to-blue-800
                    disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? 'Creating...' : '✓ Create Budget'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!canProceed}
                  className="px-6 py-2.5 text-sm font-semibold text-white bg-gradient-to-br from-blue-600 to-blue-700
                    dark:from-blue-900 dark:to-blue-950 rounded-lg hover:from-blue-700 hover:to-blue-800
                    disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next →
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}