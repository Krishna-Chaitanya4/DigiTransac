import { createContext, useContext, useCallback, ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext';
import { getExchangeRates, convertAmount, formatCurrency } from '../services/currencyService';
import { queryKeys } from '../lib/queryClient';

interface CurrencyContextType {
  primaryCurrency: string;
  exchangeRates: Record<string, number> | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: string | null;
  convert: (amount: number, fromCurrency: string) => number;
  formatInPrimaryCurrency: (amount: number, fromCurrency: string) => string;
  formatWithConversion: (amount: number, fromCurrency: string) => { original: string; converted: string | null };
  refreshRates: () => Promise<void>;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const primaryCurrency = user?.primaryCurrency || 'USD';

  const { data, isLoading, error: queryError } = useQuery({
    queryKey: queryKeys.exchangeRates.current,
    queryFn: getExchangeRates,
    enabled: !!user,
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 2 * 60 * 60 * 1000, // 2 hours
  });

  const exchangeRates = data?.rates ?? null;
  const lastUpdated = data?.lastUpdated ?? null;
  const error = queryError
    ? (queryError instanceof Error ? queryError.message : 'Failed to fetch exchange rates')
    : null;

  const refreshRates = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.exchangeRates.current });
  }, [queryClient]);

  // Convert amount from source currency to primary currency
  const convert = useCallback(
    (amount: number, fromCurrency: string): number => {
      if (!exchangeRates) return amount;
      return convertAmount(amount, fromCurrency, primaryCurrency, exchangeRates);
    },
    [exchangeRates, primaryCurrency]
  );

  // Format amount in primary currency (after conversion)
  const formatInPrimaryCurrency = useCallback(
    (amount: number, fromCurrency: string): string => {
      const converted = convert(amount, fromCurrency);
      return formatCurrency(converted, primaryCurrency);
    },
    [convert, primaryCurrency]
  );

  // Format with both original and converted amounts
  const formatWithConversion = useCallback(
    (amount: number, fromCurrency: string): { original: string; converted: string | null } => {
      const original = formatCurrency(amount, fromCurrency);
      
      if (fromCurrency === primaryCurrency || !exchangeRates) {
        return { original, converted: null };
      }
      
      const convertedAmount = convert(amount, fromCurrency);
      const converted = formatCurrency(convertedAmount, primaryCurrency);
      
      return { original, converted };
    },
    [convert, primaryCurrency, exchangeRates]
  );

  return (
    <CurrencyContext.Provider
      value={{
        primaryCurrency,
        exchangeRates,
        isLoading,
        error,
        lastUpdated,
        convert,
        formatInPrimaryCurrency,
        formatWithConversion,
        refreshRates,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}
