import { useState, useMemo, useEffect, useCallback, ReactNode, DragEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { formatCurrency } from '../services/currencyService';
import { useBudgets, useTransactionSummary, useTransactionAnalytics, useLabels } from '../hooks';
import { BudgetCard } from '../components/budget';
import { getDateRangeForPreset, formatDateToStartOfDay, formatDateToEndOfDay } from '../hooks/useTransactionFilters';
import { DateRangePicker } from '../components/DatePicker';

type PeriodPreset = 'thisMonth' | 'lastMonth' | 'last3Months' | 'last6Months' | 'thisYear' | 'custom';

// Widget IDs for reordering (excludes the fixed summary card)
type WidgetId = 'categoryPair' | 'trends' | 'budgets' | 'averages';

// Collapsible section IDs for persistence
type SectionId = 'summary' | 'categories' | 'incomeCategories' | 'trends' | 'budgets' | 'averages';

const COLLAPSED_SECTIONS_KEY = 'insights_collapsed_sections';
const WIDGET_ORDER_KEY = 'insights_widget_order';
const DEFAULT_WIDGET_ORDER: WidgetId[] = ['categoryPair', 'trends', 'budgets', 'averages'];

// Helper to calculate percentage change
function calculatePercentChange(current: number, previous: number): number | null {
  if (previous === 0) {
    if (current === 0) return 0;
    return null; // Can't calculate % change from 0
  }
  return ((current - previous) / Math.abs(previous)) * 100;
}

// Format percentage change with sign
function formatPercentChange(change: number | null): string {
  if (change === null) return 'New';
  if (change === 0) return '0%';
  const sign = change > 0 ? '+' : '';
  return `${sign}${change.toFixed(0)}%`;
}

// Get color class for percentage change badge
function getPercentChangeColor(change: number | null, invertColors = false): string {
  if (change === null) return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
  if (change === 0) return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
  
  // For expenses, increase is bad (red), decrease is good (green)
  // For income, increase is good (green), decrease is bad (red)
  const isPositive = change > 0;
  const isGood = invertColors ? !isPositive : isPositive;
  
  if (isGood) {
    return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400';
  } else {
    return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400';
  }
}

// Calculate previous period date range
function getPreviousPeriodRange(start: Date, end: Date): { start: Date; end: Date } {
  const periodDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - periodDays + 1);
  return { start: prevStart, end: prevEnd };
}

// Drag Handle Component
function DragHandle({ onMouseDown }: { onMouseDown?: (e: React.MouseEvent) => void }) {
  return (
    <div
      className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
      onMouseDown={onMouseDown}
      title="Drag to reorder"
    >
      <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
        <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"/>
      </svg>
    </div>
  );
}

// Collapsible Section Component with drag support
interface CollapsibleSectionProps {
  id: SectionId;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  headerRight?: ReactNode;
  isCollapsed: boolean;
  onToggle: (id: SectionId) => void;
  children: ReactNode;
  className?: string;
  // Drag props
  draggable?: boolean;
  onDragStart?: (e: DragEvent) => void;
  onDragOver?: (e: DragEvent) => void;
  onDragEnd?: (e: DragEvent) => void;
  onDrop?: (e: DragEvent) => void;
  isDragOver?: boolean;
}

function CollapsibleSection({
  id,
  title,
  subtitle,
  icon,
  headerRight,
  isCollapsed,
  onToggle,
  children,
  className = '',
  draggable = false,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  isDragOver = false,
}: CollapsibleSectionProps) {
  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg border-2 transition-all duration-200 ${
        isDragOver
          ? 'border-blue-500 dark:border-blue-400 shadow-lg'
          : 'border-gray-200 dark:border-gray-700'
      } ${className}`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDrop={onDrop}
    >
      <button
        onClick={() => onToggle(id)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors rounded-t-lg"
      >
        <div className="flex items-center gap-3">
          {draggable && <DragHandle />}
          {icon && (
            <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              {icon}
            </div>
          )}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
            {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {headerRight}
          <svg
            className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-180'}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {!isCollapsed && (
        <div className="p-4 pt-0 border-t border-gray-100 dark:border-gray-700">
          {children}
        </div>
      )}
    </div>
  );
}

// Comparison Badge Component
interface ComparisonBadgeProps {
  current: number;
  previous: number;
  invertColors?: boolean; // true for expenses (increase = bad)
  label?: string;
}

function ComparisonBadge({ current, previous, invertColors = false, label = 'vs last period' }: ComparisonBadgeProps) {
  const change = calculatePercentChange(current, previous);
  const colorClass = getPercentChangeColor(change, invertColors);
  
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
      {formatPercentChange(change)} {label}
    </span>
  );
}

const PERIOD_OPTIONS: { value: PeriodPreset; label: string }[] = [
  { value: 'thisMonth', label: 'This Month' },
  { value: 'lastMonth', label: 'Last Month' },
  { value: 'last3Months', label: 'Last 3 Months' },
  { value: 'last6Months', label: 'Last 6 Months' },
  { value: 'thisYear', label: 'This Year' },
  { value: 'custom', label: 'Custom' },
];

// Helper to get date range for a preset
function getDateRange(preset: PeriodPreset) {
  const now = new Date();
  
  switch (preset) {
    case 'thisMonth': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { start, end };
    }
    case 'lastMonth': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start, end };
    }
    case 'last3Months': {
      const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { start, end };
    }
    case 'last6Months': {
      const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { start, end };
    }
    case 'thisYear': {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { start, end };
    }
    case 'custom':
      // For custom, return null to indicate custom dates should be used
      return null;
    default:
      return getDateRangeForPreset('thisMonth');
  }
}

// Format date for API
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

type ViewMode = 'categorized' | 'cashflow';

export default function InsightsPage() {
  const { user } = useAuth();
  const { primaryCurrency } = useCurrency();
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodPreset>('thisMonth');
  const [viewMode, setViewMode] = useState<ViewMode>('categorized');
  
  // Collapsed sections state with localStorage persistence
  const [collapsedSections, setCollapsedSections] = useState<Set<SectionId>>(() => {
    try {
      const saved = localStorage.getItem(COLLAPSED_SECTIONS_KEY);
      if (saved) {
        return new Set(JSON.parse(saved) as SectionId[]);
      }
    } catch (e) {
      // Ignore parse errors
    }
    return new Set<SectionId>();
  });
  
  // Persist collapsed sections to localStorage
  useEffect(() => {
    localStorage.setItem(COLLAPSED_SECTIONS_KEY, JSON.stringify([...collapsedSections]));
  }, [collapsedSections]);
  
  const toggleSection = useCallback((id: SectionId) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);
  
  // Widget order state with localStorage persistence
  const [widgetOrder, setWidgetOrder] = useState<WidgetId[]>(() => {
    try {
      const saved = localStorage.getItem(WIDGET_ORDER_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as WidgetId[];
        // Validate that all widgets are present
        if (DEFAULT_WIDGET_ORDER.every(w => parsed.includes(w)) && parsed.length === DEFAULT_WIDGET_ORDER.length) {
          return parsed;
        }
      }
    } catch (e) {
      // Ignore parse errors
    }
    return DEFAULT_WIDGET_ORDER;
  });
  
  // Persist widget order to localStorage
  useEffect(() => {
    localStorage.setItem(WIDGET_ORDER_KEY, JSON.stringify(widgetOrder));
  }, [widgetOrder]);
  
  // Drag state
  const [draggedWidget, setDraggedWidget] = useState<WidgetId | null>(null);
  const [dragOverWidget, setDragOverWidget] = useState<WidgetId | null>(null);
  
  const handleDragStart = useCallback((widgetId: WidgetId) => (e: DragEvent) => {
    setDraggedWidget(widgetId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', widgetId);
    // Add a slight delay to allow the drag image to be captured
    setTimeout(() => {
      (e.target as HTMLElement).style.opacity = '0.5';
    }, 0);
  }, []);
  
  const handleDragOver = useCallback((widgetId: WidgetId) => (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedWidget && draggedWidget !== widgetId) {
      setDragOverWidget(widgetId);
    }
  }, [draggedWidget]);
  
  const handleDragEnd = useCallback((e: DragEvent) => {
    (e.target as HTMLElement).style.opacity = '1';
    setDraggedWidget(null);
    setDragOverWidget(null);
  }, []);
  
  const handleDrop = useCallback((targetWidgetId: WidgetId) => (e: DragEvent) => {
    e.preventDefault();
    if (!draggedWidget || draggedWidget === targetWidgetId) {
      setDragOverWidget(null);
      return;
    }
    
    setWidgetOrder(prev => {
      const newOrder = [...prev];
      const draggedIndex = newOrder.indexOf(draggedWidget);
      const targetIndex = newOrder.indexOf(targetWidgetId);
      
      // Remove dragged item and insert at target position
      newOrder.splice(draggedIndex, 1);
      newOrder.splice(targetIndex, 0, draggedWidget);
      
      return newOrder;
    });
    
    setDraggedWidget(null);
    setDragOverWidget(null);
  }, [draggedWidget]);
  
  // Reset widget order
  const resetWidgetOrder = useCallback(() => {
    setWidgetOrder(DEFAULT_WIDGET_ORDER);
  }, []);
  
  // Custom date range state - stored as YYYY-MM-DD strings
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() =>
    new Date().toISOString().split('T')[0]
  );
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);

  // Parse date string to Date object
  const parseDate = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  // Get date range based on selected period
  const { start: periodStart, end: periodEnd } = useMemo(() => {
    if (selectedPeriod === 'custom') {
      return {
        start: parseDate(customStartDate),
        end: parseDate(customEndDate)
      };
    }
    const range = getDateRange(selectedPeriod);
    return range ?? { start: new Date(), end: new Date() };
  }, [selectedPeriod, customStartDate, customEndDate]);

  // Handle period selection
  const handlePeriodChange = (period: PeriodPreset) => {
    setSelectedPeriod(period);
    if (period === 'custom') {
      setShowCustomDatePicker(true);
    } else {
      setShowCustomDatePicker(false);
    }
  };

  // Fetch labels to identify Income/Expense/Transfer folders
  const { data: labels = [] } = useLabels();
  
  // Get system folder IDs - note: actual folder names are "Income", "Expenses", "Transfers"
  const systemFolders = useMemo(() => {
    // Find system folders by name - these are the root folders created by the backend
    const incomeFolder = labels.find(l => l.name === 'Income' && l.type === 'Folder' && !l.parentId);
    const expenseFolder = labels.find(l => l.name === 'Expenses' && l.type === 'Folder' && !l.parentId);
    const transferFolder = labels.find(l => l.name === 'Transfers' && l.type === 'Folder' && !l.parentId);
    
    // Get all category IDs under a folder (recursively through sub-folders)
    const getChildCategoryIds = (folderId: string | undefined): string[] => {
      if (!folderId) return [];
      
      const result: string[] = [];
      const collectCategories = (parentId: string) => {
        const children = labels.filter(l => l.parentId === parentId);
        for (const child of children) {
          if (child.type === 'Category') {
            result.push(child.id);
          }
          // Always recurse into folders to find nested categories
          if (child.type === 'Folder') {
            collectCategories(child.id);
          }
        }
      };
      collectCategories(folderId);
      return result;
    };
    
    const incomeCategoryIds = getChildCategoryIds(incomeFolder?.id);
    const expenseCategoryIds = getChildCategoryIds(expenseFolder?.id);
    const transferCategoryIds = getChildCategoryIds(transferFolder?.id);
    
    return {
      incomeId: incomeFolder?.id,
      expenseId: expenseFolder?.id,
      transferId: transferFolder?.id,
      incomeCategoryIds,
      expenseCategoryIds,
      transferCategoryIds,
    };
  }, [labels]);

  // Calculate previous period range for comparison
  const { start: prevPeriodStart, end: prevPeriodEnd } = useMemo(() => {
    return getPreviousPeriodRange(periodStart, periodEnd);
  }, [periodStart, periodEnd]);

  // Get transaction summary for selected period
  const summaryFilter = useMemo(() => ({
    startDate: formatDateToStartOfDay(periodStart),
    endDate: formatDateToEndOfDay(periodEnd),
    status: 'Confirmed' as const,
  }), [periodStart, periodEnd]);
  
  // Get transaction summary for previous period (for comparison)
  const prevSummaryFilter = useMemo(() => ({
    startDate: formatDateToStartOfDay(prevPeriodStart),
    endDate: formatDateToEndOfDay(prevPeriodEnd),
    status: 'Confirmed' as const,
  }), [prevPeriodStart, prevPeriodEnd]);
  
  const { data: transactionSummary, isLoading: summaryLoading } = useTransactionSummary(summaryFilter);
  const { data: prevTransactionSummary } = useTransactionSummary(prevSummaryFilter);
  const { data: budgetSummary } = useBudgets(true);
  
  // Get analytics for selected period
  const { data: analytics, isLoading: analyticsLoading } = useTransactionAnalytics(
    formatDate(periodStart),
    formatDate(periodEnd)
  );
  
  // Get analytics for previous period (for income category comparison)
  const { data: prevAnalytics } = useTransactionAnalytics(
    formatDate(prevPeriodStart),
    formatDate(prevPeriodEnd)
  );

  // Calculate true income/expense from category breakdown
  const financialSummary = useMemo(() => {
    if (!transactionSummary?.byCategory || !systemFolders.incomeCategoryIds.length) {
      // Fallback to totalCredits/totalDebits
      return {
        income: transactionSummary?.totalCredits ?? 0,
        expenses: transactionSummary?.totalDebits ?? 0,
        transfers: 0,
        netChange: transactionSummary?.netChange ?? 0,
      };
    }
    
    let income = 0;
    let expenses = 0;
    let transfers = 0;
    
    // Sum by category based on folder membership
    Object.entries(transactionSummary.byCategory).forEach(([labelId, amount]) => {
      if (systemFolders.incomeCategoryIds.includes(labelId)) {
        income += amount;
      } else if (systemFolders.expenseCategoryIds.includes(labelId)) {
        expenses += amount;
      } else if (systemFolders.transferCategoryIds.includes(labelId)) {
        transfers += amount;
      }
    });
    
    return {
      income,
      expenses,
      transfers,
      netChange: income - expenses,
    };
  }, [transactionSummary, systemFolders]);
  
  // Calculate previous period financial summary for comparison
  const prevFinancialSummary = useMemo(() => {
    if (!prevTransactionSummary?.byCategory || !systemFolders.incomeCategoryIds.length) {
      return {
        income: prevTransactionSummary?.totalCredits ?? 0,
        expenses: prevTransactionSummary?.totalDebits ?? 0,
        transfers: 0,
        netChange: prevTransactionSummary?.netChange ?? 0,
      };
    }
    
    let income = 0;
    let expenses = 0;
    let transfers = 0;
    
    Object.entries(prevTransactionSummary.byCategory).forEach(([labelId, amount]) => {
      if (systemFolders.incomeCategoryIds.includes(labelId)) {
        income += amount;
      } else if (systemFolders.expenseCategoryIds.includes(labelId)) {
        expenses += amount;
      } else if (systemFolders.transferCategoryIds.includes(labelId)) {
        transfers += amount;
      }
    });
    
    return {
      income,
      expenses,
      transfers,
      netChange: income - expenses,
    };
  }, [prevTransactionSummary, systemFolders]);
  
  // Calculate income categories breakdown (mirror of expense categories)
  const incomeCategories = useMemo(() => {
    if (!analytics?.topCategories || !systemFolders.incomeCategoryIds.length) {
      return [];
    }
    
    // Filter categories that are income categories and have positive amounts
    const incomeCats = analytics.topCategories.filter(cat =>
      systemFolders.incomeCategoryIds.includes(cat.labelId) && cat.amount > 0
    );
    
    // Recalculate percentages based on total income
    const totalIncome = incomeCats.reduce((sum, cat) => sum + cat.amount, 0);
    
    return incomeCats.map(cat => ({
      ...cat,
      percentage: totalIncome > 0 ? (cat.amount / totalIncome) * 100 : 0
    })).sort((a, b) => b.amount - a.amount);
  }, [analytics, systemFolders]);

  // Calculate savings rate
  const savingsRate = useMemo(() => {
    if (financialSummary.income <= 0) return 0;
    return ((financialSummary.income - financialSummary.expenses) / financialSummary.income) * 100;
  }, [financialSummary]);

  // Format period label
  const periodLabel = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    if (selectedPeriod === 'custom') {
      const formatDate = (d: Date) => `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
      return `${formatDate(periodStart)} - ${formatDate(periodEnd)}`;
    }
    if (selectedPeriod === 'thisMonth' || selectedPeriod === 'lastMonth') {
      return `${months[periodStart.getMonth()]} ${periodStart.getFullYear()}`;
    }
    return `${months[periodStart.getMonth()]} - ${months[periodEnd.getMonth()]} ${periodEnd.getFullYear()}`;
  }, [selectedPeriod, periodStart, periodEnd]);

  const isLoading = summaryLoading || analyticsLoading;
  
  // Check if widget order has been customized
  const isOrderCustomized = JSON.stringify(widgetOrder) !== JSON.stringify(DEFAULT_WIDGET_ORDER);

  return (
    <div>
      {/* Header with Period Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Insights</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Financial overview for {periodLabel}
            {isOrderCustomized && (
              <button
                onClick={resetWidgetOrder}
                className="ml-2 text-blue-600 dark:text-blue-400 hover:underline"
              >
                Reset layout
              </button>
            )}
          </p>
        </div>
        
        {/* Period Selector */}
        <div className="flex gap-2 flex-wrap">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => handlePeriodChange(option.value)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                selectedPeriod === option.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      
      {/* Custom Date Range Picker */}
      {showCustomDatePicker && selectedPeriod === 'custom' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[300px]">
              <DateRangePicker
                startDate={customStartDate}
                endDate={customEndDate}
                onStartDateChange={(value) => setCustomStartDate(value)}
                onEndDateChange={(value) => setCustomEndDate(value)}
              />
            </div>
            <button
              onClick={() => setShowCustomDatePicker(false)}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              Hide
            </button>
          </div>
        </div>
      )}
      
      {/* Welcome Card */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 dark:from-blue-800 dark:to-blue-900 rounded-lg p-6 mb-6 text-white">
        <h2 className="text-lg font-medium mb-2">
          Welcome back, {user?.fullName}!
        </h2>
        <p className="text-blue-100">
          Here's your financial overview for {periodLabel}.
        </p>
      </div>

      {/* Financial Summary Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
        {/* View Toggle */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('categorized')}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                viewMode === 'categorized'
                  ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              💰 Budget View
            </button>
            <button
              onClick={() => setViewMode('cashflow')}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                viewMode === 'cashflow'
                  ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              💵 Cash Flow
            </button>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {viewMode === 'categorized' ? 'Based on Income & Expense categories' : 'All account transactions'}
          </span>
        </div>

        {/* Hero Stats - 3 main cards with comparison badges */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {viewMode === 'categorized' ? (
            <>
              {/* Income */}
              <div className="text-center p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/40 mb-3">
                  <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                  </svg>
                </div>
                <div className="text-sm font-medium text-green-700 dark:text-green-300 mb-1">Income</div>
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {isLoading ? (
                    <div className="h-9 w-28 bg-green-200 dark:bg-green-800 rounded animate-pulse mx-auto" />
                  ) : (
                    formatCurrency(financialSummary.income, primaryCurrency)
                  )}
                </div>
                <div className="flex flex-col items-center gap-1 mt-2">
                  <div className="text-xs text-green-600/70 dark:text-green-400/70">categorized income</div>
                  {!isLoading && prevFinancialSummary.income > 0 && (
                    <ComparisonBadge
                      current={financialSummary.income}
                      previous={prevFinancialSummary.income}
                      invertColors={false}
                      label="vs prev"
                    />
                  )}
                </div>
              </div>

              {/* Expenses */}
              <div className="text-center p-6 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 rounded-xl">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/40 mb-3">
                  <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div className="text-sm font-medium text-red-700 dark:text-red-300 mb-1">Expenses</div>
                <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                  {isLoading ? (
                    <div className="h-9 w-28 bg-red-200 dark:bg-red-800 rounded animate-pulse mx-auto" />
                  ) : (
                    formatCurrency(financialSummary.expenses, primaryCurrency)
                  )}
                </div>
                <div className="flex flex-col items-center gap-1 mt-2">
                  <div className="text-xs text-red-600/70 dark:text-red-400/70">categorized spending</div>
                  {!isLoading && prevFinancialSummary.expenses > 0 && (
                    <ComparisonBadge
                      current={financialSummary.expenses}
                      previous={prevFinancialSummary.expenses}
                      invertColors={true}
                      label="vs prev"
                    />
                  )}
                </div>
              </div>

              {/* Net Savings */}
              <div className={`text-center p-6 rounded-xl ${
                financialSummary.netChange >= 0
                  ? 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20'
                  : 'bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20'
              }`}>
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full mb-3 ${
                  financialSummary.netChange >= 0
                    ? 'bg-blue-100 dark:bg-blue-900/40'
                    : 'bg-orange-100 dark:bg-orange-900/40'
                }`}>
                  <svg className={`w-6 h-6 ${financialSummary.netChange >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
                  </svg>
                </div>
                <div className={`text-sm font-medium mb-1 ${financialSummary.netChange >= 0 ? 'text-blue-700 dark:text-blue-300' : 'text-orange-700 dark:text-orange-300'}`}>
                  Net Savings
                </div>
                <div className={`text-3xl font-bold ${financialSummary.netChange >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>
                  {isLoading ? (
                    <div className="h-9 w-28 bg-blue-200 dark:bg-blue-800 rounded animate-pulse mx-auto" />
                  ) : (
                    <>
                      {financialSummary.netChange >= 0 ? '+' : ''}
                      {formatCurrency(financialSummary.netChange, primaryCurrency)}
                    </>
                  )}
                </div>
                <div className="flex flex-col items-center gap-1 mt-2">
                  <div className={`text-xs ${financialSummary.netChange >= 0 ? 'text-blue-600/70 dark:text-blue-400/70' : 'text-orange-600/70 dark:text-orange-400/70'}`}>
                    {savingsRate >= 0 ? `${savingsRate.toFixed(0)}% savings rate` : 'spending exceeds income'}
                  </div>
                  {!isLoading && (prevFinancialSummary.netChange !== 0 || financialSummary.netChange !== 0) && (
                    <ComparisonBadge
                      current={financialSummary.netChange}
                      previous={prevFinancialSummary.netChange}
                      invertColors={false}
                      label="vs prev"
                    />
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Money In */}
              <div className="text-center p-6 bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 rounded-xl">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-teal-100 dark:bg-teal-900/40 mb-3">
                  <svg className="w-6 h-6 text-teal-600 dark:text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>
                <div className="text-sm font-medium text-teal-700 dark:text-teal-300 mb-1">Money In</div>
                <div className="text-3xl font-bold text-teal-600 dark:text-teal-400">
                  {isLoading ? (
                    <div className="h-9 w-28 bg-teal-200 dark:bg-teal-800 rounded animate-pulse mx-auto" />
                  ) : (
                    formatCurrency(transactionSummary?.totalCredits ?? 0, primaryCurrency)
                  )}
                </div>
                <div className="text-xs text-teal-600/70 dark:text-teal-400/70 mt-1">all credits received</div>
              </div>

              {/* Money Out */}
              <div className="text-center p-6 bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20 rounded-xl">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-pink-100 dark:bg-pink-900/40 mb-3">
                  <svg className="w-6 h-6 text-pink-600 dark:text-pink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                </div>
                <div className="text-sm font-medium text-pink-700 dark:text-pink-300 mb-1">Money Out</div>
                <div className="text-3xl font-bold text-pink-600 dark:text-pink-400">
                  {isLoading ? (
                    <div className="h-9 w-28 bg-pink-200 dark:bg-pink-800 rounded animate-pulse mx-auto" />
                  ) : (
                    formatCurrency(transactionSummary?.totalDebits ?? 0, primaryCurrency)
                  )}
                </div>
                <div className="text-xs text-pink-600/70 dark:text-pink-400/70 mt-1">all debits sent</div>
              </div>

              {/* Net Flow */}
              <div className={`text-center p-6 rounded-xl ${
                (transactionSummary?.netChange ?? 0) >= 0
                  ? 'bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20'
                  : 'bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20'
              }`}>
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full mb-3 ${
                  (transactionSummary?.netChange ?? 0) >= 0
                    ? 'bg-purple-100 dark:bg-purple-900/40'
                    : 'bg-orange-100 dark:bg-orange-900/40'
                }`}>
                  <svg className={`w-6 h-6 ${(transactionSummary?.netChange ?? 0) >= 0 ? 'text-purple-600 dark:text-purple-400' : 'text-orange-600 dark:text-orange-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                </div>
                <div className={`text-sm font-medium mb-1 ${(transactionSummary?.netChange ?? 0) >= 0 ? 'text-purple-700 dark:text-purple-300' : 'text-orange-700 dark:text-orange-300'}`}>
                  Net Cash Flow
                </div>
                <div className={`text-3xl font-bold ${(transactionSummary?.netChange ?? 0) >= 0 ? 'text-purple-600 dark:text-purple-400' : 'text-orange-600 dark:text-orange-400'}`}>
                  {isLoading ? (
                    <div className="h-9 w-28 bg-purple-200 dark:bg-purple-800 rounded animate-pulse mx-auto" />
                  ) : (
                    <>
                      {(transactionSummary?.netChange ?? 0) >= 0 ? '+' : ''}
                      {formatCurrency(transactionSummary?.netChange ?? 0, primaryCurrency)}
                    </>
                  )}
                </div>
                <div className={`text-xs mt-1 ${(transactionSummary?.netChange ?? 0) >= 0 ? 'text-purple-600/70 dark:text-purple-400/70' : 'text-orange-600/70 dark:text-orange-400/70'}`}>
                  {transactionSummary?.transactionCount ?? 0} transactions
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Reorderable Widgets */}
      {widgetOrder.map((widgetId) => {
        const dragProps = {
          draggable: true,
          onDragStart: handleDragStart(widgetId),
          onDragOver: handleDragOver(widgetId),
          onDragEnd: handleDragEnd,
          onDrop: handleDrop(widgetId),
          isDragOver: dragOverWidget === widgetId,
        };
        
        switch (widgetId) {
          case 'categoryPair':
            return (
              <div
                key="categoryPair"
                className={`grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 p-1 rounded-lg transition-all duration-200 ${
                  dragOverWidget === 'categoryPair' ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' : ''
                }`}
                draggable={true}
                onDragStart={handleDragStart('categoryPair')}
                onDragOver={handleDragOver('categoryPair')}
                onDragEnd={handleDragEnd}
                onDrop={handleDrop('categoryPair')}
              >
                {/* Top Expense Categories - Collapsible */}
                <CollapsibleSection
                  id="categories"
                  title="Top Spending Categories"
                  icon={
                    <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  }
                  headerRight={
                    <>
                      <DragHandle />
                      <Link
                        to="/transactions"
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View all →
                      </Link>
                    </>
                  }
                  isCollapsed={collapsedSections.has('categories')}
                  onToggle={toggleSection}
                >
                  {isLoading ? (
                    <div className="space-y-3 pt-4">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
                          <div className="flex-1">
                            <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-1" />
                            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-full" />
                          </div>
                          <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                        </div>
                      ))}
                    </div>
                  ) : analytics?.topCategories && analytics.topCategories.length > 0 ? (
                    <div className="space-y-3 pt-4">
                      {analytics.topCategories
                        .filter(cat => systemFolders.expenseCategoryIds.includes(cat.labelId))
                        .slice(0, 6)
                        .map((category) => (
                        <div key={category.labelId} className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
                            style={{ backgroundColor: category.labelColor ? `${category.labelColor}20` : '#f3f4f6' }}
                          >
                            {category.labelIcon || '📦'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                {category.labelName}
                              </span>
                              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                {formatCurrency(category.amount, primaryCurrency)}
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                              <div
                                className="h-2 rounded-full transition-all duration-300"
                                style={{
                                  width: `${category.percentage}%`,
                                  backgroundColor: category.labelColor || '#ef4444'
                                }}
                              />
                            </div>
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400 w-12 text-right">
                            {category.percentage.toFixed(0)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <svg className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p>No expense transactions in this period</p>
                    </div>
                  )}
                </CollapsibleSection>

                {/* Top Income Categories */}
                <CollapsibleSection
                  id="incomeCategories"
                  title="Top Income Sources"
                  icon={
                    <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                    </svg>
                  }
                  headerRight={
                    <Link
                      to="/transactions"
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View all →
                    </Link>
                  }
                  isCollapsed={collapsedSections.has('incomeCategories')}
                  onToggle={toggleSection}
                >
                  {isLoading ? (
                    <div className="space-y-3 pt-4">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
                          <div className="flex-1">
                            <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-1" />
                            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-full" />
                          </div>
                          <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                        </div>
                      ))}
                    </div>
                  ) : incomeCategories.length > 0 ? (
                    <div className="space-y-3 pt-4">
                      {incomeCategories.slice(0, 6).map((category) => (
                        <div key={category.labelId} className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
                            style={{ backgroundColor: category.labelColor ? `${category.labelColor}20` : '#f0fdf4' }}
                          >
                            {category.labelIcon || '💰'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                {category.labelName}
                              </span>
                              <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                                {formatCurrency(category.amount, primaryCurrency)}
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                              <div
                                className="h-2 rounded-full transition-all duration-300"
                                style={{
                                  width: `${category.percentage}%`,
                                  backgroundColor: category.labelColor || '#22c55e'
                                }}
                              />
                            </div>
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400 w-12 text-right">
                            {category.percentage.toFixed(0)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <svg className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p>No income transactions in this period</p>
                    </div>
                  )}
                </CollapsibleSection>
              </div>
            );
            
          case 'trends':
            return (
              <CollapsibleSection
                key="trends"
                id="trends"
                title="Cash Flow Trend"
                subtitle={analytics?.spendingTrend ? `Last ${Math.min(6, analytics.spendingTrend.length)} months` : undefined}
                icon={
                  <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                  </svg>
                }
                headerRight={
                  <div className="flex items-center gap-4 text-xs" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                      <span className="text-gray-500 dark:text-gray-400">Income</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <span className="text-gray-500 dark:text-gray-400">Expenses</span>
                    </div>
                  </div>
                }
                isCollapsed={collapsedSections.has('trends')}
                onToggle={toggleSection}
                className="mb-6"
                {...dragProps}
              >
                {isLoading ? (
                  <div className="h-48 flex items-end gap-2 pt-4">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div key={i} className="flex-1 flex flex-col gap-1">
                        <div className="bg-gray-200 dark:bg-gray-700 rounded animate-pulse" style={{ height: `${Math.random() * 100 + 50}px` }} />
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                      </div>
                    ))}
                  </div>
                ) : analytics?.spendingTrend && analytics.spendingTrend.length > 0 ? (
                  <div className="space-y-4 pt-4">
                    {/* Simple bar chart visualization */}
                    <div className="flex items-end gap-2 h-40">
                      {analytics.spendingTrend.slice(-6).map((trend) => {
                        const maxValue = Math.max(
                          ...analytics.spendingTrend.slice(-6).flatMap(t => [t.credits, t.debits])
                        );
                        const creditsHeight = maxValue > 0 ? (trend.credits / maxValue) * 100 : 0;
                        const debitsHeight = maxValue > 0 ? (trend.debits / maxValue) * 100 : 0;
                        
                        return (
                          <div key={trend.period} className="flex-1 flex flex-col items-center gap-1">
                            <div className="flex items-end gap-0.5 h-32 w-full">
                              <div
                                className="flex-1 bg-green-500 rounded-t transition-all duration-300"
                                style={{ height: `${creditsHeight}%`, minHeight: trend.credits > 0 ? '4px' : '0' }}
                                title={`Income: ${formatCurrency(trend.credits, primaryCurrency)}`}
                              />
                              <div
                                className="flex-1 bg-red-500 rounded-t transition-all duration-300"
                                style={{ height: `${debitsHeight}%`, minHeight: trend.debits > 0 ? '4px' : '0' }}
                                title={`Expenses: ${formatCurrency(trend.debits, primaryCurrency)}`}
                              />
                            </div>
                            <span className="text-xs text-gray-500 dark:text-gray-400 truncate w-full text-center">
                              {trend.period.substring(5, 7)}/{trend.period.substring(2, 4)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Summary stats */}
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <div className="text-center">
                        <div className="text-sm text-gray-500 dark:text-gray-400">Daily Average</div>
                        <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                          {formatCurrency(analytics.dailyAverage, primaryCurrency)}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm text-gray-500 dark:text-gray-400">Monthly Average</div>
                        <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                          {formatCurrency(analytics.monthlyAverage, primaryCurrency)}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <svg className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                    </svg>
                    <p>No trend data available</p>
                  </div>
                )}
              </CollapsibleSection>
            );
            
          case 'budgets':
            return (
              <CollapsibleSection
                key="budgets"
                id="budgets"
                title="Budget Tracking"
                subtitle={`${budgetSummary?.activeBudgets ?? 0} active budget${budgetSummary?.activeBudgets !== 1 ? 's' : ''}${(budgetSummary?.overBudgetCount ?? 0) > 0 ? ` • ${budgetSummary?.overBudgetCount} over budget` : ''}`}
                icon={
                  <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z" />
                  </svg>
                }
                headerRight={
                  <Link
                    to="/budgets"
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                    onClick={(e) => e.stopPropagation()}
                  >
                    View all →
                  </Link>
                }
                isCollapsed={collapsedSections.has('budgets')}
                onToggle={toggleSection}
                className="mb-6"
                {...dragProps}
              >
                {/* Show top 3 budgets that need attention */}
                {budgetSummary?.budgets && budgetSummary.budgets.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-4">
                    {budgetSummary.budgets
                      .sort((a, b) => b.percentUsed - a.percentUsed) // Sort by usage, highest first
                      .slice(0, 3)
                      .map((budget) => (
                        <BudgetCard key={budget.id} budget={budget} compact />
                      ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-gray-500 dark:text-gray-400 mb-3">No budgets set up yet</p>
                    <Link
                      to="/budgets"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-blue-600 to-blue-700
                        dark:from-blue-900 dark:to-blue-950 text-white rounded-lg text-sm font-medium
                        hover:from-blue-700 hover:to-blue-800 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Create Budget
                    </Link>
                  </div>
                )}
              </CollapsibleSection>
            );
            
          case 'averages':
            if (!analytics?.averagesByType) return null;
            return (
              <CollapsibleSection
                key="averages"
                id="averages"
                title="Transaction Averages"
                icon={
                  <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                }
                isCollapsed={collapsedSections.has('averages')}
                onToggle={toggleSection}
                {...dragProps}
              >
                <div className="grid grid-cols-3 gap-4 pt-4">
                  <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="text-sm text-green-600 dark:text-green-400 mb-1">Avg. Income</div>
                    <div className="text-xl font-bold text-green-700 dark:text-green-300">
                      {formatCurrency(analytics.averagesByType.averageCredit, primaryCurrency)}
                    </div>
                    <div className="text-xs text-green-600 dark:text-green-400 mt-1">per transaction</div>
                    {prevAnalytics?.averagesByType && (
                      <div className="mt-2">
                        <ComparisonBadge
                          current={analytics.averagesByType.averageCredit}
                          previous={prevAnalytics.averagesByType.averageCredit}
                          invertColors={false}
                          label=""
                        />
                      </div>
                    )}
                  </div>
                  <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <div className="text-sm text-red-600 dark:text-red-400 mb-1">Avg. Expense</div>
                    <div className="text-xl font-bold text-red-700 dark:text-red-300">
                      {formatCurrency(analytics.averagesByType.averageDebit, primaryCurrency)}
                    </div>
                    <div className="text-xs text-red-600 dark:text-red-400 mt-1">per transaction</div>
                    {prevAnalytics?.averagesByType && (
                      <div className="mt-2">
                        <ComparisonBadge
                          current={analytics.averagesByType.averageDebit}
                          previous={prevAnalytics.averagesByType.averageDebit}
                          invertColors={true}
                          label=""
                        />
                      </div>
                    )}
                  </div>
                  <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="text-sm text-blue-600 dark:text-blue-400 mb-1">Avg. Transfer</div>
                    <div className="text-xl font-bold text-blue-700 dark:text-blue-300">
                      {formatCurrency(analytics.averagesByType.averageTransfer, primaryCurrency)}
                    </div>
                    <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">per transaction</div>
                    {prevAnalytics?.averagesByType && (
                      <div className="mt-2">
                        <ComparisonBadge
                          current={analytics.averagesByType.averageTransfer}
                          previous={prevAnalytics.averagesByType.averageTransfer}
                          invertColors={false}
                          label=""
                        />
                      </div>
                    )}
                  </div>
                </div>
              </CollapsibleSection>
            );
            
          default:
            return null;
        }
      })}
    </div>
  );
}
