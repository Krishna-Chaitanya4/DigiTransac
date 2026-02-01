import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { formatCurrency } from '../services/currencyService';
import { useBudgets, useTransactionSummary } from '../hooks';
import { BudgetCard } from '../components/budget';
import { getDateRangeForPreset, formatDateToStartOfDay, formatDateToEndOfDay } from '../hooks/useTransactionFilters';

export default function InsightsPage() {
  const { user } = useAuth();
  const { primaryCurrency } = useCurrency();

  // Get current month's transaction summary
  const dateRange = getDateRangeForPreset('thisMonth');
  const summaryFilter = {
    startDate: formatDateToStartOfDay(dateRange.start),
    endDate: formatDateToEndOfDay(dateRange.end),
    status: 'Confirmed' as const,
  };
  const { data: transactionSummary } = useTransactionSummary(summaryFilter);
  const { data: budgetSummary } = useBudgets(true);

  // Use real data or fallback to 0
  const totalIncome = transactionSummary?.totalCredits ?? 0;
  const totalExpenses = transactionSummary?.totalDebits ?? 0;
  const balance = transactionSummary?.netChange ?? 0;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Insights</h1>
      
      {/* Welcome Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          Welcome back, {user?.fullName}!
        </h2>
        <p className="text-gray-500 dark:text-gray-400">
          Here's your financial overview for this month.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Income</div>
          <div className="mt-2 text-2xl font-bold text-green-600 dark:text-green-400">
            {formatCurrency(totalIncome, primaryCurrency)}
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">This month</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Expenses</div>
          <div className="mt-2 text-2xl font-bold text-red-600 dark:text-red-400">
            {formatCurrency(totalExpenses, primaryCurrency)}
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">This month</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Net Change</div>
          <div className={`mt-2 text-2xl font-bold ${balance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {balance >= 0 ? '+' : ''}{formatCurrency(balance, primaryCurrency)}
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">This month</p>
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
      
      {/* Analytics Cards - Coming Soon */}
      <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Analytics</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Spending Analysis */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-rose-600 dark:text-rose-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Spending Analysis</h3>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
            Visualize spending patterns by category, time period, and account.
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">Coming soon...</p>
        </div>

        {/* Income vs Expenses */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Income vs Expenses</h3>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
            Track your cash flow and see your savings rate over time.
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">Coming soon...</p>
        </div>

        {/* Trends */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5m.75-9 3-3 2.148 2.148A12.061 12.061 0 0 1 16.5 7.605" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Trends</h3>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
            Identify spending trends and compare month-over-month changes.
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">Coming soon...</p>
        </div>

        {/* Category Breakdown */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Category Breakdown</h3>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
            See where your money goes with detailed category analysis.
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">Coming soon...</p>
        </div>
      </div>
    </div>
  );
}
