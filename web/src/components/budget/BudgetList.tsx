import { memo, useState, useCallback } from 'react';
import { BudgetCard } from './BudgetCard';
import { BudgetForm } from './BudgetForm';
import { useBudgets, useCreateBudget, useUpdateBudget, useDeleteBudget } from '../../hooks';
import { useLabels, useAccounts } from '../../hooks';
import { formatCurrency } from '../../services/currencyService';
import type { Budget, CreateBudgetRequest, UpdateBudgetRequest } from '../../types/budgets';

interface BudgetListProps {
  compact?: boolean;
  maxItems?: number;
  showCreateButton?: boolean;
  onViewDetails?: (budget: Budget) => void;
}

export const BudgetList = memo(function BudgetList({
  compact = false,
  maxItems,
  showCreateButton = true,
  onViewDetails,
}: BudgetListProps) {
  const { data: budgetSummary, isLoading, error } = useBudgets(true);
  const { data: labels = [] } = useLabels();
  const { data: accounts = [] } = useAccounts();
  
  const createBudgetMutation = useCreateBudget();
  const updateBudgetMutation = useUpdateBudget();
  const deleteBudgetMutation = useDeleteBudget();
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const handleCreateClick = useCallback(() => {
    setEditingBudget(null);
    setFormError(null);
    setIsFormOpen(true);
  }, []);

  const handleEditClick = useCallback((budget: Budget) => {
    setEditingBudget(budget);
    setFormError(null);
    setIsFormOpen(true);
  }, []);

  const handleFormSubmit = useCallback(async (data: CreateBudgetRequest | UpdateBudgetRequest) => {
    setFormError(null);
    try {
      if (editingBudget) {
        await updateBudgetMutation.mutateAsync({ id: editingBudget.id, data: data as UpdateBudgetRequest });
      } else {
        await createBudgetMutation.mutateAsync(data as CreateBudgetRequest);
      }
      setIsFormOpen(false);
      setEditingBudget(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save budget';
      setFormError(message);
    }
  }, [editingBudget, createBudgetMutation, updateBudgetMutation]);

  // Delete handler - available for future use (e.g., context menu or swipe action)
  const _handleDelete = useCallback(async (budgetId: string) => {
    if (!confirm('Are you sure you want to delete this budget?')) return;
    
    try {
      await deleteBudgetMutation.mutateAsync(budgetId);
    } catch {
      // Error handled by mutation cache
    }
  }, [deleteBudgetMutation]);
  void _handleDelete; // Suppress unused warning

  const handleCardClick = useCallback((budget: Budget) => {
    if (onViewDetails) {
      onViewDetails(budget);
    } else {
      handleEditClick(budget);
    }
  }, [onViewDetails, handleEditClick]);

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div 
            key={i}
            className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded-xl ${compact ? 'h-16' : 'h-32'}`}
          />
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 
        rounded-lg text-red-600 dark:text-red-400 text-sm">
        Failed to load budgets. Please try again.
      </div>
    );
  }

  const budgets = budgetSummary?.budgets ?? [];
  const displayBudgets = maxItems ? budgets.slice(0, maxItems) : budgets;

  // Empty state
  if (budgets.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full 
          flex items-center justify-center">
          <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">
          No budgets yet
        </h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
          Create a budget to start tracking your spending goals.
        </p>
        {showCreateButton && (
          <button
            onClick={handleCreateClick}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 
              text-white rounded-lg transition-colors font-medium"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Budget
          </button>
        )}
        
        <BudgetForm
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          onSubmit={handleFormSubmit}
          editingBudget={editingBudget}
          labels={labels}
          accounts={accounts}
          isLoading={createBudgetMutation.isPending || updateBudgetMutation.isPending}
          error={formError}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary header */}
      {!compact && budgetSummary && (
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Total:</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {formatCurrency(budgetSummary.totalSpent, budgetSummary.primaryCurrency)}
            </span>
            <span className="text-gray-400">/</span>
            <span className="text-gray-600 dark:text-gray-400">
              {formatCurrency(budgetSummary.totalBudgetAmount, budgetSummary.primaryCurrency)}
            </span>
          </div>
          
          {budgetSummary.overBudgetCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 dark:bg-red-900/30 
              text-red-600 dark:text-red-400 rounded-full text-xs font-medium">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
              </svg>
              {budgetSummary.overBudgetCount} over budget
            </span>
          )}
          
          {budgetSummary.nearLimitCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 
              text-orange-600 dark:text-orange-400 rounded-full text-xs font-medium">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
              </svg>
              {budgetSummary.nearLimitCount} near limit
            </span>
          )}
        </div>
      )}
      
      {/* Budget grid */}
      <div className={`grid gap-4 ${compact ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
        {displayBudgets.map((budget) => (
          <BudgetCard
            key={budget.id}
            budget={budget}
            onClick={handleCardClick}
            compact={compact}
          />
        ))}
      </div>
      
      {/* Show more link */}
      {maxItems && budgets.length > maxItems && (
        <div className="text-center pt-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            +{budgets.length - maxItems} more budgets
          </span>
        </div>
      )}
      
      {/* Create button */}
      {showCreateButton && !compact && (
        <button
          onClick={handleCreateClick}
          className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed 
            border-gray-300 dark:border-gray-600 rounded-xl text-gray-500 dark:text-gray-400
            hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400
            transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Budget
        </button>
      )}
      
      {/* Budget Form Modal */}
      <BudgetForm
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingBudget(null);
          setFormError(null);
        }}
        onSubmit={handleFormSubmit}
        editingBudget={editingBudget}
        labels={labels}
        accounts={accounts}
        isLoading={createBudgetMutation.isPending || updateBudgetMutation.isPending}
        error={formError}
      />
    </div>
  );
});