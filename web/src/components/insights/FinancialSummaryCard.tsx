import { ComparisonBadge } from './ComparisonBadge';
import type { FinancialSummary } from './types';

type ViewMode = 'categorized' | 'cashflow';

interface FinancialSummaryCardProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  financialSummary: FinancialSummary;
  prevFinancialSummary: FinancialSummary;
  transactionSummary: {
    totalCredits: number;
    totalDebits: number;
    netChange: number;
    transactionCount: number;
  } | undefined;
  savingsRate: number;
  isLoading: boolean;
  formatCurrency: (amount: number, currency: string) => string;
  primaryCurrency: string;
}

export function FinancialSummaryCard({
  viewMode,
  onViewModeChange,
  financialSummary,
  prevFinancialSummary,
  transactionSummary,
  savingsRate,
  isLoading,
  formatCurrency,
  primaryCurrency,
}: FinancialSummaryCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
      {/* View Toggle */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onViewModeChange('categorized')}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors relative group ${
              viewMode === 'categorized'
                ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            title="Shows only transactions categorized under Income/Expenses folders"
          >
            💰 Income vs Expenses
            <Tooltip text="Transactions with Income/Expense categories only" />
          </button>
          <button
            onClick={() => onViewModeChange('cashflow')}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors relative group ${
              viewMode === 'cashflow'
                ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            title="Shows all money received and sent, regardless of category"
          >
            💵 Money In vs Out
            <Tooltip text="All credits received & debits sent (including transfers)" />
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
          <CategorizedView
            financialSummary={financialSummary}
            prevFinancialSummary={prevFinancialSummary}
            savingsRate={savingsRate}
            isLoading={isLoading}
            formatCurrency={formatCurrency}
            primaryCurrency={primaryCurrency}
          />
        ) : (
          <CashflowView
            transactionSummary={transactionSummary}
            isLoading={isLoading}
            formatCurrency={formatCurrency}
            primaryCurrency={primaryCurrency}
          />
        )}
      </div>
    </div>
  );
}

function Tooltip({ text }: { text: string }) {
  return (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
      {text}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
    </div>
  );
}

function CategorizedView({
  financialSummary,
  prevFinancialSummary,
  savingsRate,
  isLoading,
  formatCurrency,
  primaryCurrency,
}: {
  financialSummary: FinancialSummary;
  prevFinancialSummary: FinancialSummary;
  savingsRate: number;
  isLoading: boolean;
  formatCurrency: (amount: number, currency: string) => string;
  primaryCurrency: string;
}) {
  return (
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
            formatCurrency(financialSummary.expenses, primaryCurrency)
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
  );
}

function CashflowView({
  transactionSummary,
  isLoading,
  formatCurrency,
  primaryCurrency,
}: {
  transactionSummary: {
    totalCredits: number;
    totalDebits: number;
    netChange: number;
    transactionCount: number;
  } | undefined;
  isLoading: boolean;
  formatCurrency: (amount: number, currency: string) => string;
  primaryCurrency: string;
}) {
  const netChange = transactionSummary?.netChange ?? 0;

  return (
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
        netChange >= 0
          ? 'bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20'
          : 'bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20'
      }`}>
        <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full mb-3 ${
          netChange >= 0
            ? 'bg-purple-100 dark:bg-purple-900/40'
            : 'bg-orange-100 dark:bg-orange-900/40'
        }`}>
          <svg className={`w-6 h-6 ${netChange >= 0 ? 'text-purple-600 dark:text-purple-400' : 'text-orange-600 dark:text-orange-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        </div>
        <div className={`text-sm font-medium mb-1 ${netChange >= 0 ? 'text-purple-700 dark:text-purple-300' : 'text-orange-700 dark:text-orange-300'}`}>
          Net Cash Flow
        </div>
        <div className={`text-3xl font-bold ${netChange >= 0 ? 'text-purple-600 dark:text-purple-400' : 'text-orange-600 dark:text-orange-400'}`}>
          {isLoading ? (
            <div className="h-9 w-28 bg-purple-200 dark:bg-purple-800 rounded animate-pulse mx-auto" />
          ) : (
            <>
              {netChange >= 0 ? '+' : ''}
              {formatCurrency(netChange, primaryCurrency)}
            </>
          )}
        </div>
        <div className={`text-xs mt-1 ${netChange >= 0 ? 'text-purple-600/70 dark:text-purple-400/70' : 'text-orange-600/70 dark:text-orange-400/70'}`}>
          {transactionSummary?.transactionCount ?? 0} transactions
        </div>
      </div>
    </>
  );
}