// DatePicker component - Coming Soon

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

export function DatePicker(_props: DatePickerProps) {
  return (
    <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 italic border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
      Coming soon
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

export function DateRangePicker(_props: DateRangePickerProps) {
  return (
    <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 italic border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
      Coming soon
    </div>
  );
}
