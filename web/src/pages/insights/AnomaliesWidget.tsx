import type { DragProps, SectionId } from './types';
import type { SpendingAnomaliesResponse, SpendingAnomaly } from '../../types/transactions';
import { convertAndFormat } from './helpers';
import { CollapsibleSection, WidgetWithErrorBoundary } from './InsightWidgets';

interface AnomaliesWidgetProps {
  anomalies: SpendingAnomaliesResponse | undefined;
  anomaliesLoading: boolean;
  primaryCurrency: string;
  convert: (amount: number, fromCurrency: string) => number;
  collapsedSections: Set<string>;
  toggleSection: (id: SectionId) => void;
  dragProps: DragProps;
}

export function AnomaliesWidget({
  anomalies,
  anomaliesLoading,
  primaryCurrency,
  convert,
  collapsedSections,
  toggleSection,
  dragProps,
}: AnomaliesWidgetProps) {
  return (
    <WidgetWithErrorBoundary name="Spending Alerts">
      <CollapsibleSection
        id="anomalies"
        title="Spending Alerts"
        subtitle={anomalies && anomalies.anomalies.length > 0 ? `${anomalies.anomalies.length} unusual transaction${anomalies.anomalies.length !== 1 ? 's' : ''}` : 'All spending looks normal'}
        icon={
          <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        }
        isCollapsed={collapsedSections.has('anomalies')}
        onToggle={toggleSection}
        className="mb-6"
        {...dragProps}
      >
        {anomaliesLoading ? (
          <div className="space-y-3 pt-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse">
                <div className="h-4 w-48 bg-gray-200 dark:bg-gray-600 rounded mb-2" />
                <div className="h-3 w-32 bg-gray-200 dark:bg-gray-600 rounded" />
              </div>
            ))}
          </div>
        ) : anomalies && anomalies.anomalies.length > 0 ? (
          <div className="space-y-3 pt-4">
            {anomalies.anomalies.map((anomaly: SpendingAnomaly, index: number) => (
              <div
                key={anomaly.transactionId || `anomaly-${index}`}
                className={`p-4 rounded-lg border-l-4 ${
                  anomaly.severity === 'High'
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-500'
                    : anomaly.severity === 'Medium'
                    ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500'
                    : 'bg-blue-50 dark:bg-blue-900/20 border-blue-500'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${
                        anomaly.severity === 'High'
                          ? 'text-red-700 dark:text-red-300'
                          : anomaly.severity === 'Medium'
                          ? 'text-yellow-700 dark:text-yellow-300'
                          : 'text-blue-700 dark:text-blue-300'
                      }`}>
                        {anomaly.title}
                      </span>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        anomaly.severity === 'High'
                          ? 'bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200'
                          : anomaly.severity === 'Medium'
                          ? 'bg-yellow-200 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200'
                          : 'bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-200'
                      }`}>
                        {anomaly.severity}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {anomaly.description}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      {new Date(anomaly.detectedAt).toLocaleDateString()}
                      {anomaly.payeeName && ` • Payee: ${anomaly.payeeName}`}
                      {anomaly.categoryName && ` • Category: ${anomaly.categoryName}`}
                    </p>
                  </div>
                  {anomaly.amount !== undefined && (
                    <div className="text-right ml-4">
                      <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                          {convertAndFormat(anomaly.amount, anomalies?.currency, primaryCurrency, convert)}
                        </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {/* Summary */}
            <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {anomalies.anomalies.length} unusual pattern{anomalies.anomalies.length !== 1 ? 's' : ''} detected
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3 text-green-300 dark:text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-green-600 dark:text-green-400 font-medium">All spending looks normal!</p>
            <p className="text-sm mt-1">No unusual transactions detected in this period</p>
          </div>
        )}
      </CollapsibleSection>
    </WidgetWithErrorBoundary>
  );
}
