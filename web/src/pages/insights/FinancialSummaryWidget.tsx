import type { TransactionSummary } from '../../types/transactions';
import { convertAndFormat } from './helpers';
import { ComparisonBadge } from './InsightWidgets';

interface FinancialSummaryWidgetProps {
  isLoading: boolean;
  financialSummary: { income: number; expenses: number; transfers: number; netChange: number };
  prevFinancialSummary: { income: number; expenses: number; transfers: number; netChange: number };
  transactionSummary: TransactionSummary | undefined;
  primaryCurrency: string;
  convert: (amount: number, fromCurrency: string) => number;
  savingsRate: number;
}

export function FinancialSummaryWidget({
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
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
          💰 Money In vs Out
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Based on transaction type, excludes transfers</span>
        </div>
      </div>

      {/* Hero Stats - compact on mobile, 3 columns on desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-6">
        {/* Money In */}
        <div className="flex flex-row items-center gap-3 p-3 sm:flex-col sm:text-center sm:p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl">
          <div className="inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-green-100 dark:bg-green-900/40 flex-shrink-0 sm:mb-3">
            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-medium text-green-700 dark:text-green-300 mb-0.5 sm:mb-1">Money In</div>
            <div className="text-lg sm:text-3xl font-bold text-green-600 dark:text-green-400 truncate">
              {isLoading ? (
                <div className="h-6 sm:h-9 w-20 sm:w-28 bg-green-200 dark:bg-green-800 rounded animate-pulse sm:mx-auto" />
              ) : (
                convertAndFormat(financialSummary.income, transactionSummary?.currency, primaryCurrency, convert)
              )}
            </div>
            <div className="flex flex-col sm:items-center gap-1 mt-1 sm:mt-2">
              <div className="text-[10px] sm:text-xs text-green-600/70 dark:text-green-400/70">all receive transactions</div>
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

        {/* Money Out */}
        <div className="flex flex-row items-center gap-3 p-3 sm:flex-col sm:text-center sm:p-6 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 rounded-xl">
          <div className="inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-red-100 dark:bg-red-900/40 flex-shrink-0 sm:mb-3">
            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-medium text-red-700 dark:text-red-300 mb-0.5 sm:mb-1">Money Out</div>
            <div className="text-lg sm:text-3xl font-bold text-red-600 dark:text-red-400 truncate">
              {isLoading ? (
                <div className="h-6 sm:h-9 w-20 sm:w-28 bg-red-200 dark:bg-red-800 rounded animate-pulse sm:mx-auto" />
              ) : (
                convertAndFormat(financialSummary.expenses, transactionSummary?.currency, primaryCurrency, convert)
              )}
            </div>
            <div className="flex flex-col sm:items-center gap-1 mt-1 sm:mt-2">
              <div className="text-[10px] sm:text-xs text-red-600/70 dark:text-red-400/70">all send transactions</div>
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

        {/* Net Cash Flow */}
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className={`text-xs sm:text-sm font-medium mb-0.5 sm:mb-1 ${financialSummary.netChange >= 0 ? 'text-blue-700 dark:text-blue-300' : 'text-orange-700 dark:text-orange-300'}`}>
              Net Cash Flow
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
      </div>
    </div>
  );
}
