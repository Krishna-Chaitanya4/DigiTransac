import { useState, useEffect, useRef } from 'react';

interface DatePickerProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  label?: string;
  minDate?: Date;
  maxDate?: Date;
  className?: string;
}

// Format date to YYYY-MM-DD
function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Parse YYYY-MM-DD to Date
function parseDateString(dateStr: string): Date | null {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

// Format for display (e.g., "21 Jan 2026")
function formatDisplayDate(dateStr: string): string {
  const date = parseDateString(dateStr);
  if (!date) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

// Get days in month
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

// Get day of week for first day of month (0 = Sunday)
function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

// Check if two dates are the same day
function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

// Check if date is within range (compares dates only, ignoring time)
function isDateInRange(date: Date, minDate?: Date, maxDate?: Date): boolean {
  // Normalize to start of day for comparison
  const normalizedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  
  if (minDate) {
    const min = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate()).getTime();
    if (normalizedDate < min) return false;
  }
  if (maxDate) {
    const max = new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate()).getTime();
    if (normalizedDate > max) return false;
  }
  return true;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function DatePicker({
  value,
  onChange,
  placeholder = 'Select date',
  disabled = false,
  label,
  minDate,
  maxDate,
  className = '',
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => {
    const parsed = value ? parseDateString(value) : null;
    return parsed || new Date();
  });
  const [showYearPicker, setShowYearPicker] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  const today = new Date();
  const selectedDate = value ? parseDateString(value) : null;

  // Update view date when value changes externally
  useEffect(() => {
    if (value) {
      const parsed = parseDateString(value);
      if (parsed) {
        setViewDate(parsed);
      }
    }
  }, [value]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowYearPicker(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;

      switch (event.key) {
        case 'Escape':
          setIsOpen(false);
          setShowYearPicker(false);
          break;
        case 'ArrowLeft':
          if (!showYearPicker) {
            event.preventDefault();
            navigateDay(-1);
          }
          break;
        case 'ArrowRight':
          if (!showYearPicker) {
            event.preventDefault();
            navigateDay(1);
          }
          break;
        case 'ArrowUp':
          if (!showYearPicker) {
            event.preventDefault();
            navigateDay(-7);
          }
          break;
        case 'ArrowDown':
          if (!showYearPicker) {
            event.preventDefault();
            navigateDay(7);
          }
          break;
        case 'Enter':
          if (!showYearPicker && selectedDate) {
            setIsOpen(false);
          }
          break;
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, showYearPicker, selectedDate]);

  const navigateDay = (days: number) => {
    const current = selectedDate || today;
    const newDate = new Date(current);
    newDate.setDate(newDate.getDate() + days);
    
    if (isDateInRange(newDate, minDate, maxDate)) {
      onChange?.(formatDateForInput(newDate));
      setViewDate(newDate);
    }
  };

  const handleDateSelect = (day: number) => {
    const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    if (isDateInRange(newDate, minDate, maxDate)) {
      onChange?.(formatDateForInput(newDate));
      setIsOpen(false);
    }
  };

  const handlePrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const handleYearSelect = (year: number) => {
    setViewDate(new Date(year, viewDate.getMonth(), 1));
    setShowYearPicker(false);
  };

  const handleMonthSelect = (month: number) => {
    setViewDate(new Date(viewDate.getFullYear(), month, 1));
  };

  const handleToday = () => {
    if (isDateInRange(today, minDate, maxDate)) {
      onChange?.(formatDateForInput(today));
      setViewDate(today);
      setIsOpen(false);
    }
  };

  const handleClear = () => {
    onChange?.('');
    setIsOpen(false);
  };

  // Generate calendar days
  const daysInMonth = getDaysInMonth(viewDate.getFullYear(), viewDate.getMonth());
  const firstDay = getFirstDayOfMonth(viewDate.getFullYear(), viewDate.getMonth());
  const days: (number | null)[] = [];
  
  // Add empty slots for days before the first day
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  // Add the days of the month
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  // Generate year options (50 years before and after current year)
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = currentYear - 50; y <= currentYear + 10; y++) {
    years.push(y);
  }

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label}
        </label>
      )}
      
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-3 py-2 text-left border rounded-lg flex items-center justify-between
          transition-colors duration-150
          ${disabled 
            ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed border-gray-300 dark:border-gray-600' 
            : 'bg-white dark:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500 border-gray-300 dark:border-gray-600 cursor-pointer'
          }
          ${isOpen ? 'ring-2 ring-blue-500 border-transparent' : ''}
        `}
      >
        <span className={value ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}>
          {value ? formatDisplayDate(value) : placeholder}
        </span>
        <svg 
          className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>

      {/* Calendar Dropdown */}
      {isOpen && (
        <div 
          ref={calendarRef}
          className="absolute z-50 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 
            rounded-xl shadow-lg p-4 w-72 animate-in fade-in slide-in-from-top-2 duration-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Previous month"
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            <div className="flex items-center gap-1">
              {/* Month Dropdown */}
              <select
                value={viewDate.getMonth()}
                onChange={(e) => handleMonthSelect(parseInt(e.target.value))}
                className="bg-transparent text-gray-900 dark:text-gray-100 font-semibold 
                  hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg px-2 py-1 cursor-pointer
                  focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {MONTHS.map((month, index) => (
                  <option key={month} value={index} className="bg-white dark:bg-gray-800">
                    {month}
                  </option>
                ))}
              </select>
              
              {/* Year Button/Dropdown */}
              <button
                type="button"
                onClick={() => setShowYearPicker(!showYearPicker)}
                className="text-gray-900 dark:text-gray-100 font-semibold 
                  hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg px-2 py-1 transition-colors"
              >
                {viewDate.getFullYear()}
              </button>
            </div>
            
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Next month"
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Year Picker */}
          {showYearPicker && (
            <div className="absolute inset-x-4 top-14 bottom-14 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 
              rounded-lg shadow-lg overflow-y-auto z-10">
              <div className="grid grid-cols-4 gap-1 p-2">
                {years.map((year) => (
                  <button
                    key={year}
                    type="button"
                    onClick={() => handleYearSelect(year)}
                    className={`p-2 text-sm rounded-lg transition-colors
                      ${year === viewDate.getFullYear()
                        ? 'bg-blue-500 dark:bg-blue-950 text-white font-semibold'
                        : year === currentYear
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAYS.map((day) => (
              <div
                key={day}
                className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 py-1"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, index) => {
              if (day === null) {
                return <div key={`empty-${index}`} className="p-2" />;
              }

              const date = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
              const isToday = isSameDay(date, today);
              const isSelected = selectedDate && isSameDay(date, selectedDate);
              const isDisabled = !isDateInRange(date, minDate, maxDate);

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleDateSelect(day)}
                  disabled={isDisabled}
                  className={`p-2 text-sm rounded-lg transition-all duration-150 relative
                    ${isSelected
                      ? 'bg-blue-500 dark:bg-blue-950 text-white font-semibold shadow-sm'
                      : isToday
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-semibold ring-1 ring-blue-200 dark:ring-blue-800'
                      : isDisabled
                      ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }
                    ${!isDisabled && !isSelected ? 'hover:scale-110' : ''}
                  `}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={handleClear}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 
                px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handleToday}
              disabled={!isDateInRange(today, minDate, maxDate)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 
                px-2 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface DateRangePickerProps {
  startDate?: string;
  endDate?: string;
  onStartDateChange?: (value: string) => void;
  onEndDateChange?: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  disabled = false,
  className = '',
}: DateRangePickerProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex-1">
        <DatePicker
          value={startDate}
          onChange={onStartDateChange}
          disabled={disabled}
          placeholder="Start date"
          maxDate={endDate ? parseDateString(endDate) || undefined : undefined}
        />
      </div>
      <span className="text-gray-500 dark:text-gray-400 flex-shrink-0">→</span>
      <div className="flex-1">
        <DatePicker
          value={endDate}
          onChange={onEndDateChange}
          disabled={disabled}
          placeholder="End date"
          minDate={startDate ? parseDateString(startDate) || undefined : undefined}
        />
      </div>
    </div>
  );
}
