import { DatePicker } from '../DatePicker';
import type { RecurrenceFrequency } from '../../types/transactions';
import { recurrenceFrequencyConfig } from '../../types/transactions';

interface RecurringSectionProps {
  isRecurring: boolean;
  onIsRecurringChange: (value: boolean) => void;
  frequency: RecurrenceFrequency;
  onFrequencyChange: (value: RecurrenceFrequency) => void;
  interval: number;
  onIntervalChange: (value: number) => void;
  endDate: string;
  onEndDateChange: (value: string) => void;
}

export function RecurringSection({
  isRecurring,
  onIsRecurringChange,
  frequency,
  onFrequencyChange,
  interval,
  onIntervalChange,
  endDate,
  onEndDateChange,
}: RecurringSectionProps) {
  return (
    <div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={isRecurring}
          onChange={(e) => onIsRecurringChange(e.target.checked)}
          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Make this recurring
        </span>
      </label>
      
      {isRecurring && (
        <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg space-y-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Frequency
              </label>
              <select
                value={frequency}
                onChange={(e) => onFrequencyChange(e.target.value as RecurrenceFrequency)}
                className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded 
                  bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 text-sm"
              >
                {Object.entries(recurrenceFrequencyConfig).map(([key, { label }]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div className="w-20">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Every
              </label>
              <input
                type="number"
                value={interval}
                onChange={(e) => onIntervalChange(parseInt(e.target.value) || 1)}
                min="1"
                max="99"
                className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded 
                  bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 text-sm"
              />
            </div>
          </div>
          <div>
            <DatePicker
              label="End Date (optional)"
              value={endDate}
              onChange={onEndDateChange}
              minDate={new Date()}
              placeholder="No end date"
            />
          </div>
        </div>
      )}
    </div>
  );
}
