import { useState, useMemo, useEffect, useCallback, DragEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';
import { PullToRefreshContainer } from '../../components/PullToRefreshContainer';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useBudgets, useTransactionSummary, useTransactionAnalytics, useTopCounterparties, useSpendingByAccount, useAccounts, useInvalidateTransactions, useInvalidateBudgets, useInvalidateLabels } from '../../hooks';
import { formatDateToStartOfDay, formatDateToEndOfDay } from '../../hooks/useTransactionFilters';
import { DateRangePicker } from '../../components/DatePicker';

import type { PeriodPreset, WidgetId, SectionId } from './types';
import { COLLAPSED_SECTIONS_KEY, WIDGET_ORDER_KEY, DEFAULT_WIDGET_ORDER, PERIOD_OPTIONS } from './types';
import { getPreviousPeriodRange, getDateRange, formatDate } from './helpers';
import { CategoryPairWidget } from './CategoryPairWidget';
import { TrendsWidget } from './TrendsWidget';
import { BudgetsWidget } from './BudgetsWidget';
import { CounterpartiesWidget } from './CounterpartiesWidget';
import { AccountActivityWidget } from './AccountActivityWidget';

export default function InsightsPage() {
  const { user } = useAuth();
  const { primaryCurrency, convert } = useCurrency();
  const isMobile = useIsMobile();
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodPreset>('thisMonth');
  
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
  
  // Mobile reorder helpers (touch-friendly alternative to drag)
  const moveWidgetUp = useCallback((widgetId: WidgetId) => {
    setWidgetOrder(prev => {
      const idx = prev.indexOf(widgetId);
      if (idx <= 0) return prev;
      const newOrder = [...prev];
      [newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]];
      return newOrder;
    });
  }, []);
  
  const moveWidgetDown = useCallback((widgetId: WidgetId) => {
    setWidgetOrder(prev => {
      const idx = prev.indexOf(widgetId);
      if (idx < 0 || idx >= prev.length - 1) return prev;
      const newOrder = [...prev];
      [newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]];
      return newOrder;
    });
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
  const { data: budgetSummary, isLoading: budgetsLoading } = useBudgets(true);
  
  // Get analytics for selected period
  const { data: analytics, isLoading: analyticsLoading } = useTransactionAnalytics(
    formatDate(periodStart),
    formatDate(periodEnd)
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
  
  const { data: accountsList } = useAccounts();
  
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

  // Money In / Money Out — purely based on transaction Type, excluding transfers
  const financialSummary = useMemo(() => {
    const income = transactionSummary?.totalCredits ?? 0;
    const expenses = transactionSummary?.totalDebits ?? 0;
    return {
      income,
      expenses,
      transfers: 0,
      netChange: income - expenses,
    };
  }, [transactionSummary]);
  
  // Previous period for comparison
  const prevFinancialSummary = useMemo(() => {
    const income = prevTransactionSummary?.totalCredits ?? 0;
    const expenses = prevTransactionSummary?.totalDebits ?? 0;
    return {
      income,
      expenses,
      transfers: 0,
      netChange: income - expenses,
    };
  }, [prevTransactionSummary]);
  
  // Calculate savings rate
  const savingsRate = useMemo(() => {
    if (financialSummary.income <= 0) return 0;
    return ((financialSummary.income - financialSummary.expenses) / financialSummary.income) * 100;
  }, [financialSummary]);

  // Format period label
  const periodLabel = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    if (selectedPeriod === 'custom') {
      const fmtDate = (d: Date) => `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
      return `${fmtDate(periodStart)} - ${fmtDate(periodEnd)}`;
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
          <h1 className="hidden lg:block text-2xl font-bold text-gray-900 dark:text-gray-100">Insights</h1>
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
        
        {/* Period Selector — horizontally scrollable on mobile */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide lg:flex-wrap lg:overflow-x-visible lg:pb-0 lg:mx-0 lg:px-0">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => handlePeriodChange(option.value)}
              className={`px-3 py-1.5 min-h-[44px] lg:min-h-0 text-sm font-medium rounded-lg transition-colors whitespace-nowrap flex-shrink-0 touch-manipulation ${
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
          Welcome back, {user?.fullName?.includes('@') ? user.fullName.split('@')[0] : user?.fullName}!
        </h2>
        <p className="text-blue-100">
          Here's your financial overview for {periodLabel}.
        </p>
      </div>

      {/* Reorderable Widgets */}
      {widgetOrder.map((widgetId, widgetIndex) => {
        const dragProps = {
          draggable: !isMobile, // Disable HTML5 drag on touch devices
          onDragStart: handleDragStart(widgetId),
          onDragOver: handleDragOver(widgetId),
          onDragEnd: handleDragEnd,
          onDrop: handleDrop(widgetId),
          isDragOver: dragOverWidget === widgetId,
        };
        
        // Mobile reorder button props
        const mobileReorderProps = {
          onMoveUp: () => moveWidgetUp(widgetId),
          onMoveDown: () => moveWidgetDown(widgetId),
          canMoveUp: widgetIndex > 0,
          canMoveDown: widgetIndex < widgetOrder.length - 1,
        };
        
        switch (widgetId) {
          case 'categoryPair':
            return (
              <CategoryPairWidget
                key="categoryPair"
                analytics={analytics}
                transactionSummary={transactionSummary}
                primaryCurrency={primaryCurrency}
                convert={convert}
                isLoading={isLoading}
                collapsedSections={collapsedSections}
                toggleSection={toggleSection}
                dragOverWidget={dragOverWidget}
                dragProps={dragProps}
                mobileReorderProps={mobileReorderProps}
              />
            );
            
          case 'trends':
            return (
              <TrendsWidget
                key="trends"
                analytics={analytics}
                transactionSummary={transactionSummary}
                primaryCurrency={primaryCurrency}
                convert={convert}
                isLoading={isLoading}
                collapsedSections={collapsedSections}
                toggleSection={toggleSection}
                dragProps={dragProps}
                financialSummary={financialSummary}
                prevFinancialSummary={prevFinancialSummary}
                savingsRate={savingsRate}
              />
            );
            
          case 'budgets':
            return (
              <BudgetsWidget
                key="budgets"
                budgetSummary={budgetSummary}
                isLoading={budgetsLoading}
                collapsedSections={collapsedSections}
                toggleSection={toggleSection}
                dragProps={dragProps}
              />
            );
            
          case 'counterparties':
            return (
              <CounterpartiesWidget
                key="counterparties"
                counterparties={counterparties}
                counterpartiesLoading={counterpartiesLoading}
                primaryCurrency={primaryCurrency}
                convert={convert}
                collapsedSections={collapsedSections}
                toggleSection={toggleSection}
                dragProps={dragProps}
              />
            );
            
          case 'accountActivity':
            return (
              <AccountActivityWidget
                key="accountActivity"
                spendingByAccount={spendingByAccount}
                accounts={accountsList}
                byAccountLoading={byAccountLoading}
                primaryCurrency={primaryCurrency}
                convert={convert}
                collapsedSections={collapsedSections}
                toggleSection={toggleSection}
                dragProps={dragProps}
              />
            );
            
          default:
            return null;
        }
      })}
    </PullToRefreshContainer>
  );
}
