import { useState } from 'react';
import { AccountSummary } from '../../services/accountService';
import { 
  formatCurrency as formatCurrencyWithCode, 
  getCurrencySymbol, 
  formatRelativeTime,
} from '../../services/currencyService';

interface AccountSummaryCardProps {
  summary: AccountSummary;
  onRefreshRates: () => void;
}

export function AccountSummaryCard({ summary, onRefreshRates }: AccountSummaryCardProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const currencyCodes = Object.keys(summary.balancesByCurrency || {});
  const hasMultipleCurrencies = currencyCodes.length > 1;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefreshRates();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-blue-600 to-blue-700 dark:from-blue-900 dark:to-blue-950 rounded-lg p-6 text-white mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium">Net Worth</h2>
        {hasMultipleCurrencies && summary.ratesLastUpdated && (
          <div className="flex items-center gap-2 text-xs text-blue-200 dark:text-blue-300">
            <span>Rates: {formatRelativeTime(summary.ratesLastUpdated)}</span>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-1 hover:bg-blue-500 dark:hover:bg-blue-800 rounded transition-colors disabled:opacity-50"
              title="Refresh exchange rates"
            >
              <svg 
                className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        )}
      </div>
      <div className="text-4xl font-bold mb-4">
        {formatCurrencyWithCode(summary.netWorth, summary.primaryCurrency)}
      </div>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-blue-200 dark:text-blue-300 text-sm">Assets</p>
          <p className="text-xl font-semibold">{formatCurrencyWithCode(summary.totalAssets, summary.primaryCurrency)}</p>
        </div>
        <div>
          <p className="text-blue-200 dark:text-blue-300 text-sm">Liabilities</p>
          <p className="text-xl font-semibold">
            {/* Show liabilities as negative to indicate money owed */}
            {formatCurrencyWithCode(-summary.totalLiabilities, summary.primaryCurrency)}
          </p>
        </div>
      </div>
      
      {/* Currency Breakdown */}
      {hasMultipleCurrencies && (
        <div className="border-t border-blue-500 dark:border-blue-700 pt-4 mt-4">
          <p className="text-xs text-blue-200 dark:text-blue-300 mb-2">Breakdown by Currency</p>
          <div className="space-y-2">
            {currencyCodes.map((code) => {
              const balances = summary.balancesByCurrency[code];
              const isPrimary = code === summary.primaryCurrency;
              return (
                <div key={code} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1">
                    <span className="font-medium">{getCurrencySymbol(code)}</span>
                    <span className="text-blue-200 dark:text-blue-300">{code}</span>
                    {isPrimary && <span className="text-xs bg-blue-500 dark:bg-blue-700 px-1.5 py-0.5 rounded">Primary</span>}
                  </span>
                  <div className="text-right">
                    <span>{formatCurrencyWithCode(balances.netWorth, code)}</span>
                    {!isPrimary && (
                      <span className="text-blue-200 dark:text-blue-300 text-xs ml-1">
                        (≈ {formatCurrencyWithCode(balances.netWorthConverted, summary.primaryCurrency)})
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
