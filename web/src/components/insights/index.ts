// Insights widget components
export { CollapsibleSection } from './CollapsibleSection';
export type { CollapsibleSectionProps } from './CollapsibleSection';
export { ComparisonBadge } from './ComparisonBadge';
export type { ComparisonBadgeProps } from './ComparisonBadge';
export { DragHandle } from './DragHandle';
export { WidgetWithErrorBoundary, WidgetErrorFallback } from './WidgetWithErrorBoundary';
export type { WidgetWithErrorBoundaryProps, WidgetErrorFallbackProps } from './WidgetWithErrorBoundary';
export { TrendWidget } from './TrendWidget';
export { CategoryBreakdownWidget } from './CategoryBreakdownWidget';
export { CounterpartiesWidget } from './CounterpartiesWidget';
export { SpendingByAccountWidget } from './SpendingByAccountWidget';
export { PatternsWidget } from './PatternsWidget';
export { AnomaliesWidget } from './AnomaliesWidget';
export { FinancialSummaryCard } from './FinancialSummaryCard';

// Types
export type { 
  WidgetId, 
  SectionId, 
  CategoryData,
  TrendData,
  CounterpartyData,
  AccountSpendingData,
  DayPatternData,
  HourPatternData,
  AnomalyData,
  FinancialSummary,
} from './types';