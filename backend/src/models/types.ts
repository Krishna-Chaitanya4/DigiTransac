export interface User {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Category {
  id: string;
  userId: string;
  name: string;
  parentId: string | null;
  isFolder: boolean;
  icon?: string;
  color?: string;
  path: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Expense {
  id: string;
  userId: string;
  categoryId: string;
  amount: number;
  description: string;
  date: Date;
  isRecurring: boolean;
  recurrencePattern?: RecurrencePattern;
  tags?: string[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecurrencePattern {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
  interval: number;
  endDate?: Date;
  customDays?: number[];
}

export interface Budget {
  id: string;
  userId: string;
  categoryId: string;
  amount: number;
  period: 'monthly' | 'yearly' | 'custom';
  startDate: Date;
  endDate?: Date;
  alertThreshold: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface BudgetAlert {
  budgetId: string;
  currentSpending: number;
  budgetAmount: number;
  percentageUsed: number;
  isExceeded: boolean;
}
