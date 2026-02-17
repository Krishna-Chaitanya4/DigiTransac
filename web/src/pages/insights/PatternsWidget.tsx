import { ChartErrorBoundary } from '../../components/error';
import type { DragProps, SectionId } from './types';
import type { SpendingPatternsResponse, DayOfWeekSpending, HourOfDaySpending } from '../../types/transactions';
import { convertAndFormat } from './helpers';
import { CollapsibleSection } from './InsightWidgets';

interface PatternsWidgetProps {
  spendingPatterns: SpendingPatternsResponse | undefined;
  patternsLoading: boolean;
  primaryCurrency: string;
  convert: (amount: number, fromCurrency: string) => number;
  collapsedSections: Set<string>;
  toggleSection: (id: SectionId) => void;
  dragProps: DragProps;
}

export function PatternsWidget({
  spendingPatterns,
  patternsLoading,
  primaryCurrency,
  convert,
  collapsedSections,
  toggleSection,
  dragProps,
}: PatternsWidgetProps) {
  return (
    <ChartErrorBoundary chartType="pattern">
      <CollapsibleSection
        id="patterns"
        title="Spending Patterns"
        subtitle="When you spend the most"
        icon={
          <svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
        isCollapsed={collapsedSections.has('patterns')}
        onToggle={toggleSection}
        className="mb-6"
        {...dragProps}
      >
        {patternsLoading ? (
          <div className="grid grid-cols-2 gap-4 pt-4">
            <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        ) : spendingPatterns ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
            {/* Day of Week Pattern */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">By Day of Week</h4>
              <div className="space-y-2">
                {spendingPatterns.byDayOfWeek.map((day: DayOfWeekSpending) => {
                  const maxAmount = Math.max(...spendingPatterns.byDayOfWeek.map((d: DayOfWeekSpending) => d.totalAmount));
                  const barWidth = maxAmount > 0 ? (day.totalAmount / maxAmount) * 100 : 0;
                  return (
                    <div key={day.dayOfWeek} className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400 w-12">{day.dayName.substring(0, 3)}</span>
                      <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full transition-all duration-300 flex items-center justify-end pr-2"
                          style={{ width: `${Math.max(barWidth, 4)}%` }}
                        >
                          {barWidth > 20 && (
                            <span className="text-xs text-white font-medium">
                              {convertAndFormat(day.totalAmount, spendingPatterns?.currency, primaryCurrency, convert)}
                            </span>
                          )}
                        </div>
                      </div>
                      {barWidth <= 20 && (
                        <span className="text-xs text-gray-600 dark:text-gray-400 w-16 text-right">
                          {convertAndFormat(day.totalAmount, spendingPatterns?.currency, primaryCurrency, convert)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Time of Day Pattern - Grouped into periods */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">By Time of Day</h4>
              {(() => {
                // Group hours into meaningful time periods
                const timePeriods = [
                  { name: 'Morning', emoji: '🌅', range: '6am - 12pm', hours: [6, 7, 8, 9, 10, 11] },
                  { name: 'Afternoon', emoji: '☀️', range: '12pm - 6pm', hours: [12, 13, 14, 15, 16, 17] },
                  { name: 'Evening', emoji: '🌆', range: '6pm - 10pm', hours: [18, 19, 20, 21] },
                  { name: 'Night', emoji: '🌙', range: '10pm - 6am', hours: [22, 23, 0, 1, 2, 3, 4, 5] },
                ];
                
                const periodData = timePeriods.map(period => {
                  const hourData = spendingPatterns.byHourOfDay.filter((h: HourOfDaySpending) => period.hours.includes(h.hour));
                  return {
                    ...period,
                    totalAmount: hourData.reduce((sum: number, h: HourOfDaySpending) => sum + h.totalAmount, 0),
                    transactionCount: hourData.reduce((sum: number, h: HourOfDaySpending) => sum + h.transactionCount, 0),
                  };
                });
                
                const maxAmount = Math.max(...periodData.map(p => p.totalAmount));
                
                return (
                  <div className="space-y-2">
                    {periodData.map((period) => {
                      const barWidth = maxAmount > 0 ? (period.totalAmount / maxAmount) * 100 : 0;
                      return (
                        <div key={period.name} className="flex items-center gap-2">
                          <div className="w-20 flex items-center gap-1.5">
                            <span className="text-base">{period.emoji}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">{period.name}</span>
                          </div>
                          <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-purple-400 to-purple-500 rounded-full transition-all duration-300 flex items-center justify-end pr-2"
                              style={{ width: `${Math.max(barWidth, 4)}%` }}
                            >
                              {barWidth > 25 && (
                                <span className="text-xs text-white font-medium">
                                  {convertAndFormat(period.totalAmount, spendingPatterns?.currency, primaryCurrency, convert)}
                                </span>
                              )}
                            </div>
                          </div>
                          {barWidth <= 25 && (
                            <span className="text-xs text-gray-600 dark:text-gray-400 w-16 text-right">
                              {convertAndFormat(period.totalAmount, spendingPatterns?.currency, primaryCurrency, convert)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                    {/* Time period legend */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                      {periodData.map((period) => (
                        <div key={`legend-${period.name}`} className="text-xs text-gray-500 dark:text-gray-400">
                          <span className="font-medium">{period.name}:</span> {period.range}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
            
            {/* Peak spending info */}
            <div className="lg:col-span-2 grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                <div className="text-sm text-orange-600 dark:text-orange-400">Peak Day</div>
                <div className="text-lg font-bold text-orange-700 dark:text-orange-300">
                  {spendingPatterns.byDayOfWeek.reduce((a: DayOfWeekSpending, b: DayOfWeekSpending) => a.totalAmount > b.totalAmount ? a : b).dayName}
                </div>
              </div>
              <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                <div className="text-sm text-orange-600 dark:text-orange-400">Peak Hour</div>
                <div className="text-lg font-bold text-orange-700 dark:text-orange-300">
                  {(() => {
                    const peakHour = spendingPatterns.byHourOfDay.reduce((a: HourOfDaySpending, b: HourOfDaySpending) => a.totalAmount > b.totalAmount ? a : b);
                    return `${peakHour.hour}:00 - ${peakHour.hour + 1}:00`;
                  })()}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>No spending pattern data</p>
          </div>
        )}
      </CollapsibleSection>
    </ChartErrorBoundary>
  );
}
