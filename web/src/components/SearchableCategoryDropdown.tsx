import { useState, useRef, useEffect, useMemo, memo } from 'react';
import type { Label } from '../types/labels';

interface SearchableCategoryDropdownProps {
  value: string;
  onChange: (value: string) => void;
  categories: Label[];
  excludeIds?: string[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const SearchableCategoryDropdown = memo(function SearchableCategoryDropdown({
  value,
  onChange,
  categories,
  excludeIds = [],
  placeholder = 'Select category...',
  disabled = false,
  className = '',
}: SearchableCategoryDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setSearch('');
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

  // Filter categories based on search and exclusions
  const filteredCategories = useMemo(() => {
    let filtered = categories.filter(cat => !excludeIds.includes(cat.id) || cat.id === value);
    
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(cat => 
        cat.name.toLowerCase().includes(searchLower)
      );
    }
    
    return filtered;
  }, [categories, search, excludeIds, value]);

  // Get selected category info
  const selectedCategory = value ? categories.find(c => c.id === value) : null;

  const handleSelect = (categoryId: string) => {
    onChange(categoryId);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Selected value display / trigger */}
      <button
        type="button"
        onClick={() => {
          if (disabled) return;
          setIsOpen(!isOpen);
          if (!isOpen) {
            setTimeout(() => inputRef.current?.focus(), 0);
          }
        }}
        disabled={disabled}
        className={`w-full px-3 py-3 border rounded-lg text-left flex items-center gap-2 text-base ${
          disabled 
            ? 'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 cursor-not-allowed text-gray-500 dark:text-gray-400' 
            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600'
        }`}
      >
        {selectedCategory ? (
          <>
            {selectedCategory.icon && <span>{selectedCategory.icon}</span>}
            <span className="flex-1 min-w-0 truncate text-gray-900 dark:text-gray-100">
              {selectedCategory.name}
            </span>
          </>
        ) : (
          <span className="flex-1 text-gray-400 dark:text-gray-500">{placeholder}</span>
        )}
        <svg 
          className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          viewBox="0 0 24 24" 
          strokeWidth={1.5} 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-64 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          {/* Search input */}
          <div className="p-2 border-b border-gray-100 dark:border-gray-700">
            <div className="relative">
              <svg 
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" 
                fill="none" 
                viewBox="0 0 24 24" 
                strokeWidth={1.5} 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search categories..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg 
                  bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                  focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Options list */}
          <div className="max-h-48 overflow-y-auto">
            {filteredCategories.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 text-center">
                {search ? 'No matching categories' : 'No available categories'}
              </div>
            ) : (
              filteredCategories.map(category => {
                const isSelected = category.id === value;
                const isExcluded = excludeIds.includes(category.id) && !isSelected;
                
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => !isExcluded && handleSelect(category.id)}
                    disabled={isExcluded}
                    className={`w-full px-3 py-2 text-left flex items-center gap-2 text-sm ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : isExcluded
                        ? 'bg-gray-50 dark:bg-gray-700/50 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    {category.icon && <span>{category.icon}</span>}
                    <span className="flex-1 truncate">{category.name}</span>
                    {isSelected && (
                      <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    )}
                    {isExcluded && (
                      <span className="text-xs text-gray-400">(in use)</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
});
