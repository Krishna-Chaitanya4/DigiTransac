import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { getExchangeRates, ExchangeRates, convertAmount, formatCurrency } from '../services/currencyService';

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

const CACHE_KEY = 'digitransac_exchange_rates';
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

interface CachedRates {
  rates: Record<string, number>;
  lastUpdated: string;
  cachedAt: number;
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [exchangeRates, setExchangeRates] = useState<Record<string, number> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const primaryCurrency = user?.primaryCurrency || 'USD';

  // Load cached rates on mount
  useEffect(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const { rates, lastUpdated: cachedLastUpdated, cachedAt } = JSON.parse(cached) as CachedRates;
        // Check if cache is still valid
        if (Date.now() - cachedAt < CACHE_DURATION) {
          setExchangeRates(rates);
          setLastUpdated(cachedLastUpdated);
        }
      } catch {
        localStorage.removeItem(CACHE_KEY);
      }
    }
  }, []);

  // Fetch exchange rates when user is authenticated
  const fetchRates = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      const data: ExchangeRates = await getExchangeRates();
      setExchangeRates(data.rates);
      setLastUpdated(data.lastUpdated);

      // Cache the rates
      const cacheData: CachedRates = {
        rates: data.rates,
        lastUpdated: data.lastUpdated,
        cachedAt: Date.now(),
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch exchange rates');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Fetch rates on mount and when user changes
  useEffect(() => {
    if (user && !exchangeRates) {
      fetchRates();
    }
  }, [user, exchangeRates, fetchRates]);

  const refreshRates = useCallback(async () => {
    localStorage.removeItem(CACHE_KEY);
    await fetchRates();
  }, [fetchRates]);

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
