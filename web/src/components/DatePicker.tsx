// DatePicker component

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

// Format date to YYYY-MM-DD for input value
function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function DatePicker({
  value,
  onChange,
  placeholder,
  disabled = false,
  label,
  minDate,
  maxDate,
  className = '',
}: DatePickerProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.(e.target.value);
  };

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label}
        </label>
      )}
      <input
        type="date"
        value={value || ''}
        onChange={handleChange}
        disabled={disabled}
        placeholder={placeholder}
        min={minDate ? formatDateForInput(minDate) : undefined}
        max={maxDate ? formatDateForInput(maxDate) : undefined}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
          bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
          focus:ring-2 focus:ring-blue-500 focus:border-transparent
          disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
      />
    </div>
  );
}

interface DateRangePickerProps {
  startDate?: string;
  endDate?: string;
  onStartDateChange?: (value: string) => void;
  onEndDateChange?: (value: string) => void;
  disabled?: boolean;
}

export function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  disabled = false,
}: DateRangePickerProps) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="date"
        value={startDate || ''}
        onChange={(e) => onStartDateChange?.(e.target.value)}
        disabled={disabled}
        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
          bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
          focus:ring-2 focus:ring-blue-500 focus:border-transparent
          disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
      />
      <span className="text-gray-500 dark:text-gray-400">to</span>
      <input
        type="date"
        value={endDate || ''}
        onChange={(e) => onEndDateChange?.(e.target.value)}
        disabled={disabled}
        min={startDate || undefined}
        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
          bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
          focus:ring-2 focus:ring-blue-500 focus:border-transparent
          disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
      />
    </div>
  );
}
