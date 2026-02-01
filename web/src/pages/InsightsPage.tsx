import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { formatCurrency } from '../services/currencyService';
import { useBudgets, useTransactionSummary, useTransactionAnalytics, useLabels } from '../hooks';
import { BudgetCard } from '../components/budget';
import { getDateRangeForPreset, formatDateToStartOfDay, formatDateToEndOfDay } from '../hooks/useTransactionFilters';
import { DateRangePicker } from '../components/DatePicker';

type PeriodPreset = 'thisMonth' | 'lastMonth' | 'last3Months' | 'last6Months' | 'thisYear' | 'custom';

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

  // Get transaction summary for selected period
  const summaryFilter = useMemo(() => ({
    startDate: formatDateToStartOfDay(periodStart),
    endDate: formatDateToEndOfDay(periodEnd),
    status: 'Confirmed' as const,
  }), [periodStart, periodEnd]);
  
  const { data: transactionSummary, isLoading: summaryLoading } = useTransactionSummary(summaryFilter);
  const { data: budgetSummary } = useBudgets(true);
  
  // Get analytics for selected period
  const { data: analytics, isLoading: analyticsLoading } = useTransactionAnalytics(
    formatDate(periodStart),
    formatDate(periodEnd)
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

  return (
    <div>
      {/* Header with Period Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Insights</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Financial overview for {periodLabel}
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

        {/* Hero Stats - 3 main cards */}
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
                <div className="text-xs text-green-600/70 dark:text-green-400/70 mt-1">categorized income</div>
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
                <div className="text-xs text-red-600/70 dark:text-red-400/70 mt-1">categorized spending</div>
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
                <div className={`text-xs mt-1 ${financialSummary.netChange >= 0 ? 'text-blue-600/70 dark:text-blue-400/70' : 'text-orange-600/70 dark:text-orange-400/70'}`}>
                  {savingsRate >= 0 ? `${savingsRate.toFixed(0)}% savings rate` : 'spending exceeds income'}
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

      {/* Two Column Layout for Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Top Expense Categories */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Top Spending Categories</h3>
            <Link to="/transactions" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
              View all →
            </Link>
          </div>
          
          {isLoading ? (
            <div className="space-y-3">
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
            <div className="space-y-3">
              {analytics.topCategories.slice(0, 6).map((category) => (
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
                          backgroundColor: category.labelColor || '#3b82f6'
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
              <p>No transactions in this period</p>
            </div>
          )}
        </div>

        {/* Spending Trends */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Cash Flow Trend</h3>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-gray-500 dark:text-gray-400">Income</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-gray-500 dark:text-gray-400">Expenses</span>
              </div>
            </div>
          </div>
          
          {isLoading ? (
            <div className="h-48 flex items-end gap-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="flex-1 flex flex-col gap-1">
                  <div className="bg-gray-200 dark:bg-gray-700 rounded animate-pulse" style={{ height: `${Math.random() * 100 + 50}px` }} />
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : analytics?.spendingTrend && analytics.spendingTrend.length > 0 ? (
            <div className="space-y-4">
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
        </div>
      </div>

      {/* Budget Summary Widget */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Budget Tracking</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {budgetSummary?.activeBudgets ?? 0} active budget{budgetSummary?.activeBudgets !== 1 ? 's' : ''}
                {(budgetSummary?.overBudgetCount ?? 0) > 0 && (
                  <span className="text-red-500 ml-2">• {budgetSummary?.overBudgetCount} over budget</span>
                )}
              </p>
            </div>
          </div>
          <Link
            to="/budgets"
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
          >
            View all →
          </Link>
        </div>
        
        {/* Show top 3 budgets that need attention */}
        {budgetSummary?.budgets && budgetSummary.budgets.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
      </div>

      {/* Transaction Averages */}
      {analytics?.averagesByType && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Transaction Averages</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="text-sm text-green-600 dark:text-green-400 mb-1">Avg. Income</div>
              <div className="text-xl font-bold text-green-700 dark:text-green-300">
                {formatCurrency(analytics.averagesByType.averageCredit, primaryCurrency)}
              </div>
              <div className="text-xs text-green-600 dark:text-green-400 mt-1">per transaction</div>
            </div>
            <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <div className="text-sm text-red-600 dark:text-red-400 mb-1">Avg. Expense</div>
              <div className="text-xl font-bold text-red-700 dark:text-red-300">
                {formatCurrency(analytics.averagesByType.averageDebit, primaryCurrency)}
              </div>
              <div className="text-xs text-red-600 dark:text-red-400 mt-1">per transaction</div>
            </div>
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-sm text-blue-600 dark:text-blue-400 mb-1">Avg. Transfer</div>
              <div className="text-xl font-bold text-blue-700 dark:text-blue-300">
                {formatCurrency(analytics.averagesByType.averageTransfer, primaryCurrency)}
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">per transaction</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
