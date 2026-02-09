/**
 * Multi-Currency Dashboard Widget
 * 
 * Displays a consolidated view of all accounts with currency conversion,
 * exchange rates, and total net worth in the user's base currency.
 */

import { memo, useMemo, useState } from 'react';
import { useCurrency } from '../../context/CurrencyContext';
import { getCurrencySymbol } from '../../services/currencyService';
import type { Account } from '../../services/accountService';
import { accountTypeConfig } from '../../services/accountService';

interface CurrencyBreakdown {
  currency: string;
  accounts: Account[];
  totalBalance: number;
  convertedBalance: number;
}

interface MultiCurrencyDashboardProps {
  accounts: Account[];
  className?: string;
}

export const MultiCurrencyDashboard = memo(function MultiCurrencyDashboard({
  accounts,
  className = '',
}: MultiCurrencyDashboardProps) {
  const { primaryCurrency, exchangeRates, convert } = useCurrency();
  const [showDetails, setShowDetails] = useState(false);

  // Group accounts by currency
  const currencyBreakdown = useMemo((): CurrencyBreakdown[] => {
    const grouped = accounts
      .filter(a => !a.isArchived)
      .reduce((acc, account) => {
        const currency = account.currency || 'USD';
        if (!acc[currency]) {
          acc[currency] = [];
        }
        acc[currency].push(account);
        return acc;
      }, {} as Record<string, Account[]>);

    return Object.entries(grouped)
      .map(([currency, accts]) => {
        const totalBalance = accts.reduce((sum, a) => sum + a.currentBalance, 0);
        const convertedBalance = convert(totalBalance, currency);
        
        return {
          currency,
          accounts: accts,
          totalBalance,
          convertedBalance,
        };
      })
      .sort((a, b) => b.convertedBalance - a.convertedBalance);
  }, [accounts, convert]);

  // Calculate total net worth in base currency
  const totalNetWorth = useMemo(() => {
    return currencyBreakdown.reduce((sum, b) => sum + b.convertedBalance, 0);
  }, [currencyBreakdown]);

  // Get exchange rates for display
  const exchangeRatesDisplay = useMemo(() => {
    if (!exchangeRates) return [];
    
    const uniqueCurrencies = [...new Set(accounts.map(a => a.currency || 'USD'))]
      .filter(c => c !== primaryCurrency);
    
    return uniqueCurrencies.map(currency => ({
      currency,
      rate: exchangeRates[currency] ? 1 / exchangeRates[currency] : null,
    }));
  }, [accounts, primaryCurrency, exchangeRates]);

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatCompact = (amount: number, currency: string) => {
    const symbol = getCurrencySymbol(currency);
    if (Math.abs(amount) >= 1000000) {
      return `${symbol}${(amount / 1000000).toFixed(1)}M`;
    }
    if (Math.abs(amount) >= 1000) {
      return `${symbol}${(amount / 1000).toFixed(1)}K`;
    }
    return `${symbol}${amount.toFixed(2)}`;
  };

  if (currencyBreakdown.length === 0) {
    return null;
  }

  return (
    <div className={`bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl p-6 text-white ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold opacity-90">
          💰 Net Worth
        </h3>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-sm opacity-80 hover:opacity-100 transition-opacity"
        >
          {showDetails ? 'Hide details' : 'Show details'}
        </button>
      </div>

      {/* Total Net Worth */}
      <div className="mb-6">
        <p className="text-4xl font-bold tracking-tight">
          {formatAmount(totalNetWorth, primaryCurrency)}
        </p>
        <p className="text-sm opacity-75 mt-1">
          in {primaryCurrency} equivalent
        </p>
      </div>

      {/* Currency Breakdown */}
      {currencyBreakdown.length > 1 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium opacity-80">By Currency</h4>
          <div className="grid gap-2">
            {currencyBreakdown.map((breakdown) => (
              <div
                key={breakdown.currency}
                className="bg-white/10 backdrop-blur-sm rounded-lg p-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">
                      {getCurrencyFlag(breakdown.currency)}
                    </span>
                    <div>
                      <p className="font-medium">{breakdown.currency}</p>
                      <p className="text-xs opacity-75">
                        {breakdown.accounts.length} account{breakdown.accounts.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      {formatAmount(breakdown.totalBalance, breakdown.currency)}
                    </p>
                    {breakdown.currency !== primaryCurrency && (
                      <p className="text-xs opacity-75">
                        ≈ {formatCompact(breakdown.convertedBalance, primaryCurrency)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Account details (expandable) */}
                {showDetails && (
                  <div className="mt-2 pt-2 border-t border-white/20 space-y-1">
                    {breakdown.accounts.map((account) => (
                      <div
                        key={account.id}
                        className="flex items-center justify-between text-sm opacity-80"
                      >
                        <span className="truncate">{account.name}</span>
                        <span className="font-mono">
                          {formatAmount(account.currentBalance, breakdown.currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Exchange Rates */}
      {exchangeRatesDisplay.length > 0 && (
        <div className="mt-6 pt-4 border-t border-white/20">
          <h4 className="text-sm font-medium opacity-80 mb-2">Exchange Rates</h4>
          <div className="flex flex-wrap gap-3">
            {exchangeRatesDisplay.map(({ currency, rate }) => (
              <div
                key={currency}
                className="bg-white/10 rounded-lg px-3 py-1.5 text-sm"
              >
                <span className="opacity-75">1 {primaryCurrency} = </span>
                <span className="font-medium">
                  {rate ? rate.toFixed(4) : '—'} {currency}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs opacity-50 mt-2">
            Rates updated hourly via Open Exchange Rates
          </p>
        </div>
      )}

      {/* Quick Stats */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        <div className="text-center">
          <p className="text-2xl font-bold">
            {currencyBreakdown.length}
          </p>
          <p className="text-xs opacity-75">Currencies</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold">
            {accounts.filter(a => !a.isArchived).length}
          </p>
          <p className="text-xs opacity-75">Accounts</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold">
            {accounts.filter(a => {
              // For liability accounts, "good" means zero or negative balance (paid off)
              // For asset accounts, "good" means positive balance
              const isLiability = accountTypeConfig[a.type]?.isLiability ?? false;
              return isLiability ? a.currentBalance <= 0 : a.currentBalance > 0;
            }).length}
          </p>
          <p className="text-xs opacity-75">In Good Standing</p>
        </div>
      </div>
    </div>
  );
});

/**
 * Get flag emoji for currency
 */
function getCurrencyFlag(currency: string): string {
  const currencyToCountry: Record<string, string> = {
    USD: '🇺🇸',
    EUR: '🇪🇺',
    GBP: '🇬🇧',
    JPY: '🇯🇵',
    INR: '🇮🇳',
    AUD: '🇦🇺',
    CAD: '🇨🇦',
    CHF: '🇨🇭',
    CNY: '🇨🇳',
    HKD: '🇭🇰',
    NZD: '🇳🇿',
    SEK: '🇸🇪',
    KRW: '🇰🇷',
    SGD: '🇸🇬',
    NOK: '🇳🇴',
    MXN: '🇲🇽',
    BRL: '🇧🇷',
    RUB: '🇷🇺',
    ZAR: '🇿🇦',
    TRY: '🇹🇷',
    PLN: '🇵🇱',
    THB: '🇹🇭',
    IDR: '🇮🇩',
    MYR: '🇲🇾',
    PHP: '🇵🇭',
    AED: '🇦🇪',
    SAR: '🇸🇦',
  };
  
  return currencyToCountry[currency] || '💱';
}

/**
 * Compact version for sidebar or mobile
 */
export const MultiCurrencyCompact = memo(function MultiCurrencyCompact({
  accounts,
  className = '',
}: MultiCurrencyDashboardProps) {
  const { primaryCurrency, convert } = useCurrency();

  const totalNetWorth = useMemo(() => {
    return accounts
      .filter(a => !a.isArchived)
      .reduce((sum, account) => {
        return sum + convert(account.currentBalance, account.currency || 'USD');
      }, 0);
  }, [accounts, convert]);

  const currencyCount = useMemo(() => {
    return new Set(accounts.filter(a => !a.isArchived).map(a => a.currency || 'USD')).size;
  }, [accounts]);

  return (
    <div className={`bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl p-4 text-white ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm opacity-80">Total Balance</p>
          <p className="text-2xl font-bold">
            {getCurrencySymbol(primaryCurrency)}
            {totalNetWorth.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="text-right">
          <p className="text-3xl">💰</p>
          <p className="text-xs opacity-75">{currencyCount} currencies</p>
        </div>
      </div>
    </div>
  );
});