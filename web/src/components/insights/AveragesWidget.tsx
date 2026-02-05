import { DragEvent } from 'react';
import { CollapsibleSection } from './CollapsibleSection';
import { ComparisonBadge } from './ComparisonBadge';
import { WidgetWithErrorBoundary } from './WidgetWithErrorBoundary';
import type { SectionId } from './types';

interface AveragesByType {
  averageCredit: number;
  averageDebit: number;
  averageTransfer: number;
}

interface AveragesWidgetProps {
  averagesByType: AveragesByType | undefined;
  prevAveragesByType: AveragesByType | undefined;
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

export function AveragesWidget({
  averagesByType,
  prevAveragesByType,
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
}: AveragesWidgetProps) {
  if (!averagesByType) return null;

  return (
    <WidgetWithErrorBoundary name="Transaction Averages">
      <CollapsibleSection
        id="averages"
        title="Transaction Averages"
        icon={
          <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        }
        isCollapsed={isCollapsed}
        onToggle={onToggle}
        draggable={draggable}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDrop={onDrop}
        isDragOver={isDragOver}
      >
        <div className="grid grid-cols-3 gap-4 pt-4">
          <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="text-sm text-green-600 dark:text-green-400 mb-1">Avg. Income</div>
            <div className="text-xl font-bold text-green-700 dark:text-green-300">
              {formatCurrency(averagesByType.averageCredit, primaryCurrency)}
            </div>
            <div className="text-xs text-green-600 dark:text-green-400 mt-1">per transaction</div>
            {prevAveragesByType && (
              <div className="mt-2">
                <ComparisonBadge
                  current={averagesByType.averageCredit}
                  previous={prevAveragesByType.averageCredit}
                  invertColors={false}
                  label=""
                />
              </div>
            )}
          </div>
          <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <div className="text-sm text-red-600 dark:text-red-400 mb-1">Avg. Expense</div>
            <div className="text-xl font-bold text-red-700 dark:text-red-300">
              {formatCurrency(averagesByType.averageDebit, primaryCurrency)}
            </div>
            <div className="text-xs text-red-600 dark:text-red-400 mt-1">per transaction</div>
            {prevAveragesByType && (
              <div className="mt-2">
                <ComparisonBadge
                  current={averagesByType.averageDebit}
                  previous={prevAveragesByType.averageDebit}
                  invertColors={true}
                  label=""
                />
              </div>
            )}
          </div>
          <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="text-sm text-blue-600 dark:text-blue-400 mb-1">Avg. Transfer</div>
            <div className="text-xl font-bold text-blue-700 dark:text-blue-300">
              {formatCurrency(averagesByType.averageTransfer, primaryCurrency)}
            </div>
            <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">per transaction</div>
            {prevAveragesByType && (
              <div className="mt-2">
                <ComparisonBadge
                  current={averagesByType.averageTransfer}
                  previous={prevAveragesByType.averageTransfer}
                  invertColors={false}
                  label=""
                />
              </div>
            )}
          </div>
        </div>
      </CollapsibleSection>
    </WidgetWithErrorBoundary>
  );
}