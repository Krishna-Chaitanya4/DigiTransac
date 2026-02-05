import { DragEvent } from 'react';
import { CollapsibleSection } from './CollapsibleSection';
import { ChartErrorBoundary } from '../error';
import type { SectionId, TrendData } from './types';

interface TrendWidgetProps {
  spendingTrend: TrendData[] | undefined;
  dailyAverage: number;
  monthlyAverage: number;
  isLoading: boolean;
  isCollapsed: boolean;
  onToggle: (id: SectionId) => void;
  formatCurrency: (amount: number, currency: string) => string;
  primaryCurrency: string;
  // Drag props
  draggable?: boolean;
  onDragStart?: (e: DragEvent) => void;
  onDragOver?: (e: DragEvent) => void;
  onDragEnd?: (e: DragEvent) => void;
  onDrop?: (e: DragEvent) => void;
  isDragOver?: boolean;
}

export function TrendWidget({
  spendingTrend,
  dailyAverage,
  monthlyAverage,
  isLoading,
  isCollapsed,
  onToggle,
  formatCurrency,
  primaryCurrency,
  draggable = false,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  isDragOver = false,
}: TrendWidgetProps) {
  return (
    <ChartErrorBoundary chartType="trend">
      <CollapsibleSection
        id="trends"
        title="Monthly Cash Flow"
        subtitle={spendingTrend ? `Last ${Math.min(6, spendingTrend.length)} months` : undefined}
        icon={
          <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
          </svg>
        }
        headerRight={
          <div className="flex items-center gap-4 text-xs" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-gray-500 dark:text-gray-400">Money In</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-gray-500 dark:text-gray-400">Money Out</span>
            </div>
          </div>
        }
        isCollapsed={isCollapsed}
        onToggle={onToggle}
        className="mb-6"
        draggable={draggable}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDrop={onDrop}
        isDragOver={isDragOver}
      >
        {isLoading ? (
          <div className="h-48 flex items-end gap-2 pt-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex-1 flex flex-col gap-1">
                <div className="bg-gray-200 dark:bg-gray-700 rounded animate-pulse" style={{ height: `${Math.random() * 100 + 50}px` }} />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : spendingTrend && spendingTrend.length > 0 ? (
          <div className="space-y-4 pt-4">
            {/* Simple bar chart visualization */}
            <div className="flex items-end gap-2 h-40">
              {spendingTrend.slice(-6).map((trend) => {
                const maxValue = Math.max(
                  ...spendingTrend.slice(-6).flatMap(t => [t.credits, t.debits])
                );
                const creditsHeight = maxValue > 0 ? (trend.credits / maxValue) * 100 : 0;
                const debitsHeight = maxValue > 0 ? (trend.debits / maxValue) * 100 : 0;
                
                return (
                  <div key={trend.period} className="flex-1 flex flex-col items-center gap-1">
                    <div className="flex items-end gap-0.5 h-32 w-full">
                      <div
                        className="flex-1 bg-green-500 rounded-t transition-all duration-300"
                        style={{ height: `${creditsHeight}%`, minHeight: trend.credits > 0 ? '4px' : '0' }}
                        title={`Money In: ${formatCurrency(trend.credits, primaryCurrency)}`}
                      />
                      <div
                        className="flex-1 bg-red-500 rounded-t transition-all duration-300"
                        style={{ height: `${debitsHeight}%`, minHeight: trend.debits > 0 ? '4px' : '0' }}
                        title={`Money Out: ${formatCurrency(trend.debits, primaryCurrency)}`}
                      />
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 truncate w-full text-center">
                      {trend.period.substring(5, 7)}/{trend.period.substring(2, 4)}
                    </span>
                  </div>
                );
              })}
            </div>
            
            {/* Summary stats */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="text-center">
                <div className="text-sm text-gray-500 dark:text-gray-400">Daily Average</div>
                <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {formatCurrency(dailyAverage, primaryCurrency)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-500 dark:text-gray-400">Monthly Average</div>
                <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {formatCurrency(monthlyAverage, primaryCurrency)}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
            <p>No trend data available</p>
          </div>
        )}
      </CollapsibleSection>
    </ChartErrorBoundary>
  );
}