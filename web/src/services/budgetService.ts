import { apiClient } from './apiClient';
import type {
  Budget,
  BudgetSummary,
  BudgetNotificationList,
  BudgetSpendingBreakdown,
  CreateBudgetRequest,
  UpdateBudgetRequest,
} from '../types/budgets';

// Get all budgets with summary
export async function getBudgets(activeOnly = true): Promise<BudgetSummary> {
  return apiClient.get<BudgetSummary>(`/budgets?activeOnly=${activeOnly}`);
}

// Get single budget by ID
export async function getBudget(id: string): Promise<Budget> {
  return apiClient.get<Budget>(`/budgets/${id}`);
}

// Get budget spending breakdown (detailed analytics)
export async function getBudgetBreakdown(id: string): Promise<BudgetSpendingBreakdown> {
  return apiClient.get<BudgetSpendingBreakdown>(`/budgets/${id}/breakdown`);
}

// Create a new budget
export async function createBudget(request: CreateBudgetRequest): Promise<Budget> {
  return apiClient.post<Budget>('/budgets', request);
}

// Update an existing budget
export async function updateBudget(id: string, request: UpdateBudgetRequest): Promise<Budget> {
  return apiClient.put<Budget>(`/budgets/${id}`, request);
}

// Delete a budget
export async function deleteBudget(id: string): Promise<void> {
  return apiClient.delete<void>(`/budgets/${id}`);
}

// Get budget notifications
export async function getBudgetNotifications(unreadOnly = false): Promise<BudgetNotificationList> {
  return apiClient.get<BudgetNotificationList>(`/budgets/notifications?unreadOnly=${unreadOnly}`);
}

// Mark a notification as read
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  return apiClient.post<void>(`/budgets/notifications/${notificationId}/read`, {});
}

// Mark all notifications as read
export async function markAllNotificationsAsRead(): Promise<void> {
  return apiClient.post<void>('/budgets/notifications/read-all', {});
}