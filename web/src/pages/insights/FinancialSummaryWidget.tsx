import type { ViewMode } from './types';
import type { TransactionSummary } from '../../types/transactions';
import { convertAndFormat } from './helpers';
import { ComparisonBadge } from './InsightWidgets';

interface FinancialSummaryWidgetProps {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  isLoading: boolean;
  financialSummary: { income: number; expenses: number; transfers: number; netChange: number };
  prevFinancialSummary: { income: number; expenses: number; transfers: number; netChange: number };
  transactionSummary: TransactionSummary | undefined;
  primaryCurrency: string;
  convert: (amount: number, fromCurrency: string) => number;
  savingsRate: number;
}

export function FinancialSummaryWidget({
  viewMode,
  setViewMode,
  isLoading,
  financialSummary,
  prevFinancialSummary,
  transactionSummary,
  primaryCurrency,
  convert,
  savingsRate,
}: FinancialSummaryWidgetProps) {
  return (
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

      {/* Hero Stats - compact on mobile, 3 columns on desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-6">
        {viewMode === 'categorized' ? (
          <>
            {/* Income */}
            <div className="flex flex-row items-center gap-3 p-3 sm:flex-col sm:text-center sm:p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl">
              <div className="inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-green-100 dark:bg-green-900/40 flex-shrink-0 sm:mb-3">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-medium text-green-700 dark:text-green-300 mb-0.5 sm:mb-1">Income</div>
                <div className="text-lg sm:text-3xl font-bold text-green-600 dark:text-green-400 truncate">
                  {isLoading ? (
                    <div className="h-6 sm:h-9 w-20 sm:w-28 bg-green-200 dark:bg-green-800 rounded animate-pulse sm:mx-auto" />
                  ) : (
                    convertAndFormat(financialSummary.income, transactionSummary?.currency, primaryCurrency, convert)
                  )}
                </div>
                <div className="flex flex-col sm:items-center gap-1 mt-1 sm:mt-2">
                  <div className="text-[10px] sm:text-xs text-green-600/70 dark:text-green-400/70">from Income categories</div>
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
            </div>

            {/* Expenses */}
            <div className="flex flex-row items-center gap-3 p-3 sm:flex-col sm:text-center sm:p-6 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 rounded-xl">
              <div className="inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-red-100 dark:bg-red-900/40 flex-shrink-0 sm:mb-3">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-medium text-red-700 dark:text-red-300 mb-0.5 sm:mb-1">Expenses</div>
                <div className="text-lg sm:text-3xl font-bold text-red-600 dark:text-red-400 truncate">
                  {isLoading ? (
                    <div className="h-6 sm:h-9 w-20 sm:w-28 bg-red-200 dark:bg-red-800 rounded animate-pulse sm:mx-auto" />
                  ) : (
                    convertAndFormat(financialSummary.expenses, transactionSummary?.currency, primaryCurrency, convert)
                  )}
                </div>
                <div className="flex flex-col sm:items-center gap-1 mt-1 sm:mt-2">
                  <div className="text-[10px] sm:text-xs text-red-600/70 dark:text-red-400/70">from Expense categories</div>
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
            </div>

            {/* Net Savings */}
            <div className={`col-span-2 sm:col-span-1 flex flex-row items-center gap-3 p-3 sm:flex-col sm:text-center sm:p-6 rounded-xl ${
              financialSummary.netChange >= 0
                ? 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20'
                : 'bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20'
            }`}>
              <div className={`inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full flex-shrink-0 sm:mb-3 ${
                financialSummary.netChange >= 0
                  ? 'bg-blue-100 dark:bg-blue-900/40'
                  : 'bg-orange-100 dark:bg-orange-900/40'
              }`}>
                <svg className={`w-5 h-5 sm:w-6 sm:h-6 ${financialSummary.netChange >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className={`text-xs sm:text-sm font-medium mb-0.5 sm:mb-1 ${financialSummary.netChange >= 0 ? 'text-blue-700 dark:text-blue-300' : 'text-orange-700 dark:text-orange-300'}`}>
                  Net Savings
                </div>
                <div className={`text-lg sm:text-3xl font-bold truncate ${financialSummary.netChange >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>
                  {isLoading ? (
                    <div className="h-6 sm:h-9 w-20 sm:w-28 bg-blue-200 dark:bg-blue-800 rounded animate-pulse sm:mx-auto" />
                  ) : (
                    <>
                      {financialSummary.netChange >= 0 ? '+' : ''}
                      {convertAndFormat(financialSummary.netChange, transactionSummary?.currency, primaryCurrency, convert)}
                    </>
                  )}
                </div>
                <div className="flex flex-col sm:items-center gap-1 mt-1 sm:mt-2">
                  <div className={`text-[10px] sm:text-xs ${financialSummary.netChange >= 0 ? 'text-blue-600/70 dark:text-blue-400/70' : 'text-orange-600/70 dark:text-orange-400/70'}`}>
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
            </div>
          </>
        ) : (
          <>
            {/* Money In */}
            <div className="flex flex-row items-center gap-3 p-3 sm:flex-col sm:text-center sm:p-6 bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 rounded-xl">
              <div className="inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-teal-100 dark:bg-teal-900/40 flex-shrink-0 sm:mb-3">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-teal-600 dark:text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-medium text-teal-700 dark:text-teal-300 mb-0.5 sm:mb-1">Money In</div>
                <div className="text-lg sm:text-3xl font-bold text-teal-600 dark:text-teal-400 truncate">
                  {isLoading ? (
                    <div className="h-6 sm:h-9 w-20 sm:w-28 bg-teal-200 dark:bg-teal-800 rounded animate-pulse sm:mx-auto" />
                  ) : (
                    convertAndFormat(transactionSummary?.totalCredits ?? 0, transactionSummary?.currency, primaryCurrency, convert)
                  )}
                </div>
                <div className="text-[10px] sm:text-xs text-teal-600/70 dark:text-teal-400/70 mt-0.5 sm:mt-1">all credits received</div>
              </div>
            </div>

            {/* Money Out */}
            <div className="flex flex-row items-center gap-3 p-3 sm:flex-col sm:text-center sm:p-6 bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20 rounded-xl">
              <div className="inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-pink-100 dark:bg-pink-900/40 flex-shrink-0 sm:mb-3">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-pink-600 dark:text-pink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-medium text-pink-700 dark:text-pink-300 mb-0.5 sm:mb-1">Money Out</div>
                <div className="text-lg sm:text-3xl font-bold text-pink-600 dark:text-pink-400 truncate">
                  {isLoading ? (
                    <div className="h-6 sm:h-9 w-20 sm:w-28 bg-pink-200 dark:bg-pink-800 rounded animate-pulse sm:mx-auto" />
                  ) : (
                    convertAndFormat(transactionSummary?.totalDebits ?? 0, transactionSummary?.currency, primaryCurrency, convert)
                  )}
                </div>
                <div className="text-[10px] sm:text-xs text-pink-600/70 dark:text-pink-400/70 mt-0.5 sm:mt-1">all debits sent</div>
              </div>
            </div>

            {/* Net Flow */}
            <div className={`col-span-2 sm:col-span-1 flex flex-row items-center gap-3 p-3 sm:flex-col sm:text-center sm:p-6 rounded-xl ${
              (transactionSummary?.netChange ?? 0) >= 0
                ? 'bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20'
                : 'bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20'
            }`}>
              <div className={`inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full flex-shrink-0 sm:mb-3 ${
                (transactionSummary?.netChange ?? 0) >= 0
                  ? 'bg-purple-100 dark:bg-purple-900/40'
                  : 'bg-orange-100 dark:bg-orange-900/40'
              }`}>
                <svg className={`w-5 h-5 sm:w-6 sm:h-6 ${(transactionSummary?.netChange ?? 0) >= 0 ? 'text-purple-600 dark:text-purple-400' : 'text-orange-600 dark:text-orange-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className={`text-xs sm:text-sm font-medium mb-0.5 sm:mb-1 ${(transactionSummary?.netChange ?? 0) >= 0 ? 'text-purple-700 dark:text-purple-300' : 'text-orange-700 dark:text-orange-300'}`}>
                  Net Cash Flow
                </div>
                <div className={`text-lg sm:text-3xl font-bold truncate ${(transactionSummary?.netChange ?? 0) >= 0 ? 'text-purple-600 dark:text-purple-400' : 'text-orange-600 dark:text-orange-400'}`}>
                  {isLoading ? (
                    <div className="h-6 sm:h-9 w-20 sm:w-28 bg-purple-200 dark:bg-purple-800 rounded animate-pulse sm:mx-auto" />
                  ) : (
                    <>
                      {(transactionSummary?.netChange ?? 0) >= 0 ? '+' : ''}
                      {convertAndFormat(transactionSummary?.netChange ?? 0, transactionSummary?.currency, primaryCurrency, convert)}
                    </>
                  )}
                </div>
                <div className={`text-[10px] sm:text-xs mt-0.5 sm:mt-1 ${(transactionSummary?.netChange ?? 0) >= 0 ? 'text-purple-600/70 dark:text-purple-400/70' : 'text-orange-600/70 dark:text-orange-400/70'}`}>
                  {transactionSummary?.transactionCount ?? 0} transactions
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
