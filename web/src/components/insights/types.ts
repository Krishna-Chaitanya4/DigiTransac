import { DragEvent, ReactNode } from 'react';

// Widget IDs for reordering (excludes the fixed summary card)
export type WidgetId = 'categoryPair' | 'trends' | 'budgets' | 'averages' | 'counterparties' | 'byAccount' | 'patterns' | 'anomalies';

// Collapsible section IDs for persistence
export type SectionId = 'summary' | 'categories' | 'incomeCategories' | 'trends' | 'budgets' | 'averages' | 'counterparties' | 'byAccount' | 'patterns' | 'anomalies';

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

export interface CategoryData {
  labelId: string;
  labelName: string;
  labelColor?: string;
  labelIcon?: string;
  amount: number;
  percentage: number;
  transactionCount: number;
}

export interface TrendData {
  period: string;
  credits: number;
  debits: number;
}

export interface CounterpartyData {
  name: string;
  totalAmount: number;
  transactionCount: number;
}

export interface AccountSpendingData {
  accountId: string;
  accountName: string;
  totalDebits: number;
  totalCredits: number;
  percentage: number;
}

export interface DayPatternData {
  dayOfWeek: number;
  dayName: string;
  totalAmount: number;
  transactionCount: number;
}

export interface HourPatternData {
  hour: number;
  totalAmount: number;
  transactionCount: number;
}

export interface AnomalyData {
  transactionId?: string;
  title: string;
  description: string;
  severity: 'Low' | 'Medium' | 'High';
  amount?: number;
  detectedAt: string;
  payeeName?: string;
  categoryName?: string;
}

export interface FinancialSummary {
  income: number;
  expenses: number;
  transfers: number;
  netChange: number;
}