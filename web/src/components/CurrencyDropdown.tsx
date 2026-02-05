import { useState, useEffect } from 'react';
import { 
  getCurrencySymbol, 
  Currency,
  getSupportedCurrencies,
  COMMON_CURRENCIES,
} from '../services/currencyService';

interface CurrencyDropdownProps {
  currency: string;
  onChange: (code: string) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Searchable currency dropdown component.
 * Shows common currencies by default, with search to find all 28 supported currencies.
 */
export function CurrencyDropdown({ 
  currency, 
  onChange, 
  label,
  disabled = false,
  className = ''
}: CurrencyDropdownProps) {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  // Load currencies on mount
  useEffect(() => {
    getSupportedCurrencies()
      .then(setCurrencies)
      .catch(console.error);
  }, []);

  // Reset highlighted index when search changes or dropdown opens
  useEffect(() => {
    setHighlightedIndex(0);
  }, [search, isOpen]);

  // Filter currencies for dropdown
  const filteredCurrencies = currencies.filter(c => 
    search === '' 
      ? COMMON_CURRENCIES.includes(c.code)
      : c.code.toLowerCase().includes(search.toLowerCase()) ||
        c.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (code: string) => {
    onChange(code);
    setIsOpen(false);
    setSearch('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => Math.min(prev + 1, filteredCurrencies.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredCurrencies[highlightedIndex]) {
          handleSelect(filteredCurrencies[highlightedIndex].code);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
      case 'Tab':
        setIsOpen(false);
        break;
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.currency-dropdown-container')) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className={`currency-dropdown-container ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label}
        </label>
      )}
      <div className="relative" onKeyDown={handleKeyDown}>
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`flex items-center gap-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
            bg-gray-50 dark:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 min-w-[100px]
            ${disabled 
              ? 'opacity-60 cursor-not-allowed' 
              : 'hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer'
            }`}
        >
          <span>{getCurrencySymbol(currency)}</span>
          <span className="text-gray-600 dark:text-gray-300">{currency}</span>
          <svg className="w-4 h-4 text-gray-400 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {isOpen && (
          <div className="absolute z-50 mt-1 w-64 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg">
            <div className="p-2 border-b border-gray-100 dark:border-gray-600">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search currencies..."
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg 
                  bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 
                  focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <div className="max-h-48 overflow-y-auto">
              {search === '' && (
                <div className="px-3 py-1 text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-600">
                  Common Currencies
                </div>
              )}
              {filteredCurrencies.map((c, index) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => handleSelect(c.code)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left ${
                    index === highlightedIndex
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : c.code === currency
                      ? 'bg-gray-50 dark:bg-gray-600'
                      : 'text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                >
                  <span className="w-6">{c.symbol}</span>
                  <span className="flex-1">{c.name}</span>
                  <span className="text-gray-400 dark:text-gray-500">{c.code}</span>
                </button>
              ))}
              {filteredCurrencies.length === 0 && (
                <p className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">No currencies found</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}