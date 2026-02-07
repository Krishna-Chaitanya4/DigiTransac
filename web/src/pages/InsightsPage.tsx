import { useState, useMemo, useEffect, useCallback, ReactNode, DragEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { formatCurrency } from '../services/currencyService';
import { PullToRefreshContainer } from '../components/PullToRefreshContainer';

// Helper to convert and format currency - ensures proper conversion from source to target currency
const convertAndFormat = (
  amount: number,
  sourceCurrency: string | undefined,
  targetCurrency: string,
  convert: (amount: number, fromCurrency: string) => number
): string => {
  if (!sourceCurrency || sourceCurrency === targetCurrency) {
    return formatCurrency(amount, targetCurrency);
  }
  const convertedAmount = convert(amount, sourceCurrency);
  return formatCurrency(convertedAmount, targetCurrency);
};
import { useBudgets, useTransactionSummary, useTransactionAnalytics, useLabels, useTopCounterparties, useSpendingByAccount, useSpendingPatterns, useSpendingAnomalies, useInvalidateTransactions, useInvalidateBudgets, useInvalidateLabels } from '../hooks';
import { BudgetCard } from '../components/budget';
import { getDateRangeForPreset, formatDateToStartOfDay, formatDateToEndOfDay } from '../hooks/useTransactionFilters';
import { DateRangePicker } from '../components/DatePicker';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ChartErrorBoundary } from '../components/error';

type PeriodPreset = 'thisMonth' | 'lastMonth' | 'last3Months' | 'last6Months' | 'thisYear' | 'custom';

// Widget IDs for reordering (excludes the fixed summary card)
type WidgetId = 'categoryPair' | 'trends' | 'budgets' | 'averages' | 'counterparties' | 'byAccount' | 'patterns' | 'anomalies';

// Collapsible section IDs for persistence
type SectionId = 'summary' | 'categories' | 'incomeCategories' | 'trends' | 'budgets' | 'averages' | 'counterparties' | 'byAccount' | 'patterns' | 'anomalies';

const COLLAPSED_SECTIONS_KEY = 'insights_collapsed_sections';
const WIDGET_ORDER_KEY = 'insights_widget_order';
const DEFAULT_WIDGET_ORDER: WidgetId[] = ['categoryPair', 'trends', 'budgets', 'averages', 'counterparties', 'byAccount', 'patterns', 'anomalies'];

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

// Widget Error Fallback Component
interface WidgetErrorFallbackProps {
  widgetName: string;
  onRetry: () => void;
}

function WidgetErrorFallback({ widgetName, onRetry }: WidgetErrorFallbackProps) {
  return (
    <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-center">
      <svg
        className="w-12 h-12 mx-auto mb-3 text-red-400 dark:text-red-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <h3 className="text-sm font-medium text-red-800 dark:text-red-300 mb-1">
        Failed to load {widgetName}
      </h3>
      <p className="text-sm text-red-600 dark:text-red-400 mb-3">
        Something went wrong while loading this widget.
      </p>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-200 rounded-lg text-sm font-medium hover:bg-red-200 dark:hover:bg-red-700 transition-colors"
      >
        Try Again
      </button>
    </div>
  );
}

// Widget wrapper with error boundary
interface WidgetWithErrorBoundaryProps {
  name: string;
  children: ReactNode;
}

function WidgetWithErrorBoundary({ name, children }: WidgetWithErrorBoundaryProps) {
  const [key, setKey] = useState(0);
  
  const handleRetry = useCallback(() => {
    setKey(k => k + 1);
  }, []);
  
  return (
    <ErrorBoundary
      key={key}
      name={`InsightsWidget-${name}`}
      fallback={<WidgetErrorFallback widgetName={name} onRetry={handleRetry} />}
    >
      {children}
    </ErrorBoundary>
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
  const { primaryCurrency, convert } = useCurrency();
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodPreset>('thisMonth');
  const [viewMode, setViewMode] = useState<ViewMode>('categorized');
  
  // Collapsed sections state with localStorage persistence
  const [collapsedSections, setCollapsedSections] = useState<Set<SectionId>>(() => {
    try {
      const saved = localStorage.getItem(COLLAPSED_SECTIONS_KEY);
      if (saved) {
        return new Set(JSON.parse(saved) as SectionId[]);
      }
    } catch {
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
    } catch {
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
  
  // Get extended analytics data
  const { data: counterparties, isLoading: counterpartiesLoading } = useTopCounterparties(
    formatDate(periodStart),
    formatDate(periodEnd),
    10
  );
  
  const { data: spendingByAccount, isLoading: byAccountLoading } = useSpendingByAccount(
    formatDate(periodStart),
    formatDate(periodEnd)
  );
  
  const { data: spendingPatterns, isLoading: patternsLoading } = useSpendingPatterns(
    formatDate(periodStart),
    formatDate(periodEnd)
  );
  
  const { data: anomalies, isLoading: anomaliesLoading } = useSpendingAnomalies(
    formatDate(periodStart),
    formatDate(periodEnd)
  );
  
  // Invalidation hooks for pull-to-refresh
  const invalidateTransactions = useInvalidateTransactions();
  const invalidateBudgets = useInvalidateBudgets();
  const invalidateLabels = useInvalidateLabels();
  
  // Handle refresh - invalidate all queries
  const handleRefresh = useCallback(async () => {
    await Promise.all([
      invalidateTransactions(),
      invalidateBudgets(),
      invalidateLabels(),
    ]);
  }, [invalidateTransactions, invalidateBudgets, invalidateLabels]);

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
    <PullToRefreshContainer onRefresh={handleRefresh}>
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
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors relative group ${
                viewMode === 'categorized'
                  ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              title="Shows only transactions categorized under Income/Expenses folders"
            >
              💰 Income vs Expenses
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                Transactions with Income/Expense categories only
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
              </div>
            </button>
            <button
              onClick={() => setViewMode('cashflow')}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors relative group ${
                viewMode === 'cashflow'
                  ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              title="Shows all money received and sent, regardless of category"
            >
              💵 Money In vs Out
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                All credits received & debits sent (including transfers)
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
              </div>
            </button>
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              {viewMode === 'categorized'
                ? 'Excludes uncategorized & transfer transactions'
                : 'Includes all transactions (transfers counted twice)'}
            </span>
          </div>
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
                    convertAndFormat(financialSummary.income, transactionSummary?.currency, primaryCurrency, convert)
                  )}
                </div>
                <div className="flex flex-col items-center gap-1 mt-2">
                  <div className="text-xs text-green-600/70 dark:text-green-400/70">from Income categories</div>
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
                    convertAndFormat(financialSummary.expenses, transactionSummary?.currency, primaryCurrency, convert)
                  )}
                </div>
                <div className="flex flex-col items-center gap-1 mt-2">
                  <div className="text-xs text-red-600/70 dark:text-red-400/70">from Expense categories</div>
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
                      {convertAndFormat(financialSummary.netChange, transactionSummary?.currency, primaryCurrency, convert)}
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
                    convertAndFormat(transactionSummary?.totalCredits ?? 0, transactionSummary?.currency, primaryCurrency, convert)
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
                    convertAndFormat(transactionSummary?.totalDebits ?? 0, transactionSummary?.currency, primaryCurrency, convert)
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
                      {convertAndFormat(transactionSummary?.netChange ?? 0, transactionSummary?.currency, primaryCurrency, convert)}
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
              <WidgetWithErrorBoundary key="categoryPair" name="Categories">
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
                                {convertAndFormat(category.amount, transactionSummary?.currency, primaryCurrency, convert)}
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
                                {convertAndFormat(category.amount, transactionSummary?.currency, primaryCurrency, convert)}
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
              </WidgetWithErrorBoundary>
            );
            
          case 'trends':
            return (
              <ChartErrorBoundary key="trends" chartType="trend">
              <CollapsibleSection
                key="trends"
                id="trends"
                title="Monthly Cash Flow"
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
                      <span className="text-gray-500 dark:text-gray-400">Money In</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <span className="text-gray-500 dark:text-gray-400">Money Out</span>
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
                                        title={`Money In: ${convertAndFormat(trend.credits, transactionSummary?.currency, primaryCurrency, convert)}`}
                                      />
                                      <div
                                        className="flex-1 bg-red-500 rounded-t transition-all duration-300"
                                        style={{ height: `${debitsHeight}%`, minHeight: trend.debits > 0 ? '4px' : '0' }}
                                        title={`Money Out: ${convertAndFormat(trend.debits, transactionSummary?.currency, primaryCurrency, convert)}`}
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
                          {convertAndFormat(analytics.dailyAverage, transactionSummary?.currency, primaryCurrency, convert)}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm text-gray-500 dark:text-gray-400">Monthly Average</div>
                        <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                          {convertAndFormat(analytics.monthlyAverage, transactionSummary?.currency, primaryCurrency, convert)}
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
              </ChartErrorBoundary>
            );
            
          case 'budgets':
            return (
              <WidgetWithErrorBoundary key="budgets" name="Budget Tracking">
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
              </WidgetWithErrorBoundary>
            );
            
          case 'averages':
            if (!analytics?.averagesByType) return null;
            return (
              <WidgetWithErrorBoundary key="averages" name="Transaction Averages">
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
                      {convertAndFormat(analytics.averagesByType.averageCredit, transactionSummary?.currency, primaryCurrency, convert)}
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
                      {convertAndFormat(analytics.averagesByType.averageDebit, transactionSummary?.currency, primaryCurrency, convert)}
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
                      {convertAndFormat(analytics.averagesByType.averageTransfer, transactionSummary?.currency, primaryCurrency, convert)}
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
              </WidgetWithErrorBoundary>
            );
            
          case 'counterparties':
            return (
              <WidgetWithErrorBoundary key="counterparties" name="Top Payees">
              <CollapsibleSection
                key="counterparties"
                id="counterparties"
                title="Top Payees"
                subtitle={counterparties ? `${counterparties.counterparties.length} payees` : undefined}
                icon={
                  <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                }
                isCollapsed={collapsedSections.has('counterparties')}
                onToggle={toggleSection}
                className="mb-6"
                {...dragProps}
              >
                {counterpartiesLoading ? (
                  <div className="space-y-3 pt-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
                        <div className="flex-1">
                          <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-1" />
                          <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                        </div>
                        <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                      </div>
                    ))}
                  </div>
                ) : counterparties && counterparties.counterparties.length > 0 ? (
                  <div className="space-y-3 pt-4">
                    {counterparties.counterparties.map((cp, index) => {
                      const avgAmount = cp.transactionCount > 0 ? cp.totalAmount / cp.transactionCount : 0;
                      return (
                        <div key={cp.name} className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-semibold text-sm">
                            {cp.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                {cp.name}
                              </span>
                              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                {convertAndFormat(cp.totalAmount, counterparties?.currency, primaryCurrency, convert)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                              <span>{cp.transactionCount} transaction{cp.transactionCount !== 1 ? 's' : ''}</span>
                              <span>•</span>
                              <span>Avg: {convertAndFormat(avgAmount, counterparties?.currency, primaryCurrency, convert)}</span>
                            </div>
                          </div>
                          <div className="text-xs text-gray-400 dark:text-gray-500 w-6 text-right">
                            #{index + 1}
                          </div>
                        </div>
                      );
                    })}
                    <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Total from top payees</span>
                        <span className="font-semibold text-gray-900 dark:text-gray-100">
                          {convertAndFormat(
                            counterparties.counterparties.reduce((sum, cp) => sum + cp.totalAmount, 0),
                            counterparties?.currency,
                            primaryCurrency,
                            convert
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <svg className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <p>No payee data available</p>
                  </div>
                )}
              </CollapsibleSection>
              </WidgetWithErrorBoundary>
            );
            
          case 'byAccount':
            return (
              <WidgetWithErrorBoundary key="byAccount" name="Spending by Account">
              <CollapsibleSection
                key="byAccount"
                id="byAccount"
                title="Spending by Account"
                subtitle={spendingByAccount ? `${spendingByAccount.accounts.length} account${spendingByAccount.accounts.length !== 1 ? 's' : ''}` : undefined}
                icon={
                  <svg className="w-5 h-5 text-cyan-600 dark:text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                }
                isCollapsed={collapsedSections.has('byAccount')}
                onToggle={toggleSection}
                className="mb-6"
                {...dragProps}
              >
                {byAccountLoading ? (
                  <div className="space-y-3 pt-4">
                    {[1, 2, 3].map((i) => (
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
                ) : spendingByAccount && spendingByAccount.accounts.length > 0 ? (
                  <div className="space-y-3 pt-4">
                    {spendingByAccount.accounts.map((account) => (
                      <div key={account.accountId} className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-lg bg-cyan-100 dark:bg-cyan-900/30"
                        >
                          🏦
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                              {account.accountName}
                            </span>
                            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                              {convertAndFormat(account.totalDebits, spendingByAccount?.currency, primaryCurrency, convert)}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className="h-2 rounded-full transition-all duration-300 bg-cyan-500"
                              style={{
                                width: `${account.percentage}%`,
                              }}
                            />
                          </div>
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 w-12 text-right">
                          {account.percentage.toFixed(0)}%
                        </span>
                      </div>
                    ))}
                    <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Total spending</span>
                        <span className="font-semibold text-gray-900 dark:text-gray-100">
                          {convertAndFormat(
                            spendingByAccount.accounts.reduce((sum, acc) => sum + acc.totalDebits, 0),
                            spendingByAccount?.currency,
                            primaryCurrency,
                            convert
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <svg className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                    <p>No account spending data</p>
                  </div>
                )}
              </CollapsibleSection>
              </WidgetWithErrorBoundary>
            );
            
          case 'patterns':
            return (
              <ChartErrorBoundary key="patterns" chartType="pattern">
              <CollapsibleSection
                key="patterns"
                id="patterns"
                title="Spending Patterns"
                subtitle="When you spend the most"
                icon={
                  <svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
                isCollapsed={collapsedSections.has('patterns')}
                onToggle={toggleSection}
                className="mb-6"
                {...dragProps}
              >
                {patternsLoading ? (
                  <div className="grid grid-cols-2 gap-4 pt-4">
                    <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  </div>
                ) : spendingPatterns ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
                    {/* Day of Week Pattern */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">By Day of Week</h4>
                      <div className="space-y-2">
                        {spendingPatterns.byDayOfWeek.map((day) => {
                          const maxAmount = Math.max(...spendingPatterns.byDayOfWeek.map(d => d.totalAmount));
                          const barWidth = maxAmount > 0 ? (day.totalAmount / maxAmount) * 100 : 0;
                          return (
                            <div key={day.dayOfWeek} className="flex items-center gap-2">
                              <span className="text-xs text-gray-500 dark:text-gray-400 w-12">{day.dayName.substring(0, 3)}</span>
                              <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full transition-all duration-300 flex items-center justify-end pr-2"
                                  style={{ width: `${Math.max(barWidth, 4)}%` }}
                                >
                                  {barWidth > 20 && (
                                    <span className="text-xs text-white font-medium">
                                      {convertAndFormat(day.totalAmount, spendingPatterns?.currency, primaryCurrency, convert)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {barWidth <= 20 && (
                                <span className="text-xs text-gray-600 dark:text-gray-400 w-16 text-right">
                                  {convertAndFormat(day.totalAmount, spendingPatterns?.currency, primaryCurrency, convert)}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    
                    {/* Time of Day Pattern - Grouped into periods */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">By Time of Day</h4>
                      {(() => {
                        // Group hours into meaningful time periods
                        const timePeriods = [
                          { name: 'Morning', emoji: '🌅', range: '6am - 12pm', hours: [6, 7, 8, 9, 10, 11] },
                          { name: 'Afternoon', emoji: '☀️', range: '12pm - 6pm', hours: [12, 13, 14, 15, 16, 17] },
                          { name: 'Evening', emoji: '🌆', range: '6pm - 10pm', hours: [18, 19, 20, 21] },
                          { name: 'Night', emoji: '🌙', range: '10pm - 6am', hours: [22, 23, 0, 1, 2, 3, 4, 5] },
                        ];
                        
                        const periodData = timePeriods.map(period => {
                          const hourData = spendingPatterns.byHourOfDay.filter(h => period.hours.includes(h.hour));
                          return {
                            ...period,
                            totalAmount: hourData.reduce((sum, h) => sum + h.totalAmount, 0),
                            transactionCount: hourData.reduce((sum, h) => sum + h.transactionCount, 0),
                          };
                        });
                        
                        const maxAmount = Math.max(...periodData.map(p => p.totalAmount));
                        
                        return (
                          <div className="space-y-2">
                            {periodData.map((period) => {
                              const barWidth = maxAmount > 0 ? (period.totalAmount / maxAmount) * 100 : 0;
                              return (
                                <div key={period.name} className="flex items-center gap-2">
                                  <div className="w-20 flex items-center gap-1.5">
                                    <span className="text-base">{period.emoji}</span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">{period.name}</span>
                                  </div>
                                  <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-gradient-to-r from-purple-400 to-purple-500 rounded-full transition-all duration-300 flex items-center justify-end pr-2"
                                      style={{ width: `${Math.max(barWidth, 4)}%` }}
                                    >
                                      {barWidth > 25 && (
                                        <span className="text-xs text-white font-medium">
                                          {convertAndFormat(period.totalAmount, spendingPatterns?.currency, primaryCurrency, convert)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  {barWidth <= 25 && (
                                    <span className="text-xs text-gray-600 dark:text-gray-400 w-16 text-right">
                                      {convertAndFormat(period.totalAmount, spendingPatterns?.currency, primaryCurrency, convert)}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                            {/* Time period legend */}
                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                              {periodData.map((period) => (
                                <div key={`legend-${period.name}`} className="text-xs text-gray-500 dark:text-gray-400">
                                  <span className="font-medium">{period.name}:</span> {period.range}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                    
                    {/* Peak spending info */}
                    <div className="lg:col-span-2 grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                        <div className="text-sm text-orange-600 dark:text-orange-400">Peak Day</div>
                        <div className="text-lg font-bold text-orange-700 dark:text-orange-300">
                          {spendingPatterns.byDayOfWeek.reduce((a, b) => a.totalAmount > b.totalAmount ? a : b).dayName}
                        </div>
                      </div>
                      <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                        <div className="text-sm text-orange-600 dark:text-orange-400">Peak Hour</div>
                        <div className="text-lg font-bold text-orange-700 dark:text-orange-300">
                          {(() => {
                            const peakHour = spendingPatterns.byHourOfDay.reduce((a, b) => a.totalAmount > b.totalAmount ? a : b);
                            return `${peakHour.hour}:00 - ${peakHour.hour + 1}:00`;
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <svg className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p>No spending pattern data</p>
                  </div>
                )}
              </CollapsibleSection>
              </ChartErrorBoundary>
            );
            
          case 'anomalies':
            return (
              <WidgetWithErrorBoundary key="anomalies" name="Spending Alerts">
              <CollapsibleSection
                key="anomalies"
                id="anomalies"
                title="Spending Alerts"
                subtitle={anomalies && anomalies.anomalies.length > 0 ? `${anomalies.anomalies.length} unusual transaction${anomalies.anomalies.length !== 1 ? 's' : ''}` : 'All spending looks normal'}
                icon={
                  <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                }
                isCollapsed={collapsedSections.has('anomalies')}
                onToggle={toggleSection}
                className="mb-6"
                {...dragProps}
              >
                {anomaliesLoading ? (
                  <div className="space-y-3 pt-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="p-4 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse">
                        <div className="h-4 w-48 bg-gray-200 dark:bg-gray-600 rounded mb-2" />
                        <div className="h-3 w-32 bg-gray-200 dark:bg-gray-600 rounded" />
                      </div>
                    ))}
                  </div>
                ) : anomalies && anomalies.anomalies.length > 0 ? (
                  <div className="space-y-3 pt-4">
                    {anomalies.anomalies.map((anomaly, index) => (
                      <div
                        key={anomaly.transactionId || `anomaly-${index}`}
                        className={`p-4 rounded-lg border-l-4 ${
                          anomaly.severity === 'High'
                            ? 'bg-red-50 dark:bg-red-900/20 border-red-500'
                            : anomaly.severity === 'Medium'
                            ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500'
                            : 'bg-blue-50 dark:bg-blue-900/20 border-blue-500'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-medium ${
                                anomaly.severity === 'High'
                                  ? 'text-red-700 dark:text-red-300'
                                  : anomaly.severity === 'Medium'
                                  ? 'text-yellow-700 dark:text-yellow-300'
                                  : 'text-blue-700 dark:text-blue-300'
                              }`}>
                                {anomaly.title}
                              </span>
                              <span className={`px-2 py-0.5 text-xs rounded-full ${
                                anomaly.severity === 'High'
                                  ? 'bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200'
                                  : anomaly.severity === 'Medium'
                                  ? 'bg-yellow-200 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200'
                                  : 'bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-200'
                              }`}>
                                {anomaly.severity}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {anomaly.description}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                              {new Date(anomaly.detectedAt).toLocaleDateString()}
                              {anomaly.payeeName && ` • Payee: ${anomaly.payeeName}`}
                              {anomaly.categoryName && ` • Category: ${anomaly.categoryName}`}
                            </p>
                          </div>
                          {anomaly.amount !== undefined && (
                            <div className="text-right ml-4">
                              <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                                  {convertAndFormat(anomaly.amount, anomalies?.currency, primaryCurrency, convert)}
                                </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    
                    {/* Summary */}
                    <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                      <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {anomalies.anomalies.length} unusual pattern{anomalies.anomalies.length !== 1 ? 's' : ''} detected
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <svg className="w-12 h-12 mx-auto mb-3 text-green-300 dark:text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-green-600 dark:text-green-400 font-medium">All spending looks normal!</p>
                    <p className="text-sm mt-1">No unusual transactions detected in this period</p>
                  </div>
                )}
              </CollapsibleSection>
              </WidgetWithErrorBoundary>
            );
            
          default:
            return null;
        }
      })}
    </PullToRefreshContainer>
  );
}
