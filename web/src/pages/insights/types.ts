import { ReactNode, DragEvent } from 'react';

export type PeriodPreset = 'thisMonth' | 'lastMonth' | 'last3Months' | 'last6Months' | 'thisYear' | 'custom';

// Widget IDs for reordering (excludes the fixed summary card)
export type WidgetId = 'categoryPair' | 'trends' | 'budgets' | 'averages' | 'counterparties' | 'byAccount' | 'patterns' | 'anomalies';

// Collapsible section IDs for persistence
export type SectionId = 'summary' | 'categories' | 'incomeCategories' | 'trends' | 'budgets' | 'averages' | 'counterparties' | 'byAccount' | 'patterns' | 'anomalies';

export type ViewMode = 'categorized' | 'cashflow';

export interface CollapsibleSectionProps {
  id: SectionId;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  headerRight?: ReactNode;
  isCollapsed: boolean;
  onToggle: (id: SectionId) => void;
  children: ReactNode;
  className?: string;
  // Drag props
  draggable?: boolean;
  onDragStart?: (e: DragEvent) => void;
  onDragOver?: (e: DragEvent) => void;
  onDragEnd?: (e: DragEvent) => void;
  onDrop?: (e: DragEvent) => void;
  isDragOver?: boolean;
}

export interface WidgetErrorFallbackProps {
  widgetName: string;
  onRetry: () => void;
}

export interface WidgetWithErrorBoundaryProps {
  name: string;
  children: ReactNode;
}

export interface ComparisonBadgeProps {
  current: number;
  previous: number;
  invertColors?: boolean; // true for expenses (increase = bad)
  label?: string;
}

export interface DragProps {
  draggable: boolean;
  onDragStart: (e: DragEvent) => void;
  onDragOver: (e: DragEvent) => void;
  onDragEnd: (e: DragEvent) => void;
  onDrop: (e: DragEvent) => void;
  isDragOver: boolean;
}

export interface MobileReorderProps {
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

export const COLLAPSED_SECTIONS_KEY = 'insights_collapsed_sections';
export const WIDGET_ORDER_KEY = 'insights_widget_order';
export const DEFAULT_WIDGET_ORDER: WidgetId[] = ['categoryPair', 'trends', 'budgets', 'averages', 'counterparties', 'byAccount', 'patterns', 'anomalies'];

export const PERIOD_OPTIONS: { value: PeriodPreset; label: string }[] = [
  { value: 'thisMonth', label: 'This Month' },
  { value: 'lastMonth', label: 'Last Month' },
  { value: 'last3Months', label: 'Last 3 Months' },
  { value: 'last6Months', label: 'Last 6 Months' },
  { value: 'thisYear', label: 'This Year' },
  { value: 'custom', label: 'Custom' },
];
