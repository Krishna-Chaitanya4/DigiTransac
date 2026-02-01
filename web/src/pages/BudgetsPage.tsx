import { useState, useMemo, useCallback } from 'react';
import {
  useBudgets,
  useCreateBudget,
  useUpdateBudget,
  useDeleteBudget,
  useLabels,
  useAccounts,
} from '../hooks';
import { BudgetForm } from '../components/budget';
import { useCurrency } from '../context/CurrencyContext';
import { formatCurrency } from '../services/currencyService';
import type { Budget, CreateBudgetRequest, UpdateBudgetRequest } from '../types/budgets';
import { getBudgetStatus, budgetStatusColors, budgetPeriodConfig } from '../types/budgets';

type BudgetFilter = 'all' | 'healthy' | 'warning' | 'exceeded';

// Budget card with edit/delete actions
function BudgetCardWithActions({
  budget,
  onEdit,
  onDelete
}: {
  budget: Budget;
  onEdit: (budget: Budget) => void;
  onDelete: (budgetId: string) => void;
}) {
  const status = getBudgetStatus(budget);
  const colors = budgetStatusColors[status];
  const periodConfig = budgetPeriodConfig[budget.period];
  const barWidth = Math.min(budget.percentUsed, 100);

  return (
    <div className={`p-4 rounded-xl border border-gray-200 dark:border-gray-700 transition-all ${colors.bg}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {budget.icon ? (
            <span className="text-2xl">{budget.icon}</span>
          ) : (
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: budget.color || '#3B82F6' }}
            >
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          )}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{budget.name}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {periodConfig.label} • {budget.daysRemaining} days left
            </p>
          </div>
        </div>
        
        {/* Actions dropdown */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(budget)}
            className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400
              hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Edit"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(budget.id)}
            className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400
              hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Delete"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* Progress section */}
      <div className="mb-3">
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-2">
          <div
            className={`h-full ${colors.bar} transition-all duration-500 ease-out`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">
            <span className={`font-semibold ${colors.text}`}>
              {formatCurrency(budget.amountSpent, budget.currency)}
            </span>
            {' '}of {formatCurrency(budget.amount, budget.currency)}
          </span>
          <span className={`font-medium ${colors.text}`}>
            {budget.percentUsed.toFixed(0)}%
          </span>
        </div>
      </div>
      
      {/* Remaining amount */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500 dark:text-gray-400">Remaining</span>
        <span className={`font-semibold ${budget.amountRemaining >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {budget.amountRemaining >= 0
            ? formatCurrency(budget.amountRemaining, budget.currency)
            : `-${formatCurrency(Math.abs(budget.amountRemaining), budget.currency)}`
          }
        </span>
      </div>
      
      {/* Labels/categories */}
      {budget.labels.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-wrap gap-1.5">
            {budget.labels.slice(0, 3).map((label) => (
              <span
                key={label.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
              >
                {label.icon && <span>{label.icon}</span>}
                {label.name}
              </span>
            ))}
            {budget.labels.length > 3 && (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                +{budget.labels.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function BudgetsPage() {
  const { primaryCurrency } = useCurrency();
  
  // Data fetching
  const { data: budgetSummary, isLoading } = useBudgets(true);
  const { data: labels = [] } = useLabels();
  const { data: accounts = [] } = useAccounts();
  
  // Mutations
  const createBudget = useCreateBudget();
  const updateBudget = useUpdateBudget();
  const deleteBudget = useDeleteBudget();
  
  // UI state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [filter, setFilter] = useState<BudgetFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const budgets = budgetSummary?.budgets ?? [];
  const activeBudgets = budgetSummary?.activeBudgets ?? 0;
  const exceededBudgets = budgetSummary?.overBudgetCount ?? 0;
  const totalBudgeted = budgetSummary?.totalBudgetAmount ?? 0;
  const totalSpent = budgetSummary?.totalSpent ?? 0;

  // Filter and search budgets
  const filteredBudgets = useMemo(() => {
    let result = budgets;
    
    // Apply status filter
    if (filter !== 'all') {
      result = result.filter(budget => {
        const status = getBudgetStatus(budget);
        if (filter === 'healthy') return status === 'healthy';
        if (filter === 'warning') return status === 'warning' || status === 'danger';
        if (filter === 'exceeded') return status === 'exceeded';
        return true;
      });
    }
    
    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(budget => 
        budget.name.toLowerCase().includes(query) ||
        budget.description?.toLowerCase().includes(query)
      );
    }
    
    return result;
  }, [budgets, filter, searchQuery]);

  // Handlers
  const handleCreate = useCallback(() => {
    setEditingBudget(null);
    setFormError(null);
    setIsFormOpen(true);
  }, []);

  const handleEdit = useCallback((budget: Budget) => {
    setEditingBudget(budget);
    setFormError(null);
    setIsFormOpen(true);
  }, []);

  const handleDelete = useCallback(async (budgetId: string) => {
    if (!confirm('Are you sure you want to delete this budget?')) {
      return;
    }
    try {
      await deleteBudget.mutateAsync(budgetId);
    } catch (err) {
      console.error('Failed to delete budget:', err);
    }
  }, [deleteBudget]);

  const handleFormSubmit = useCallback(async (data: CreateBudgetRequest | UpdateBudgetRequest) => {
    setFormError(null);
    try {
      if (editingBudget) {
        await updateBudget.mutateAsync({ id: editingBudget.id, data: data as UpdateBudgetRequest });
      } else {
        await createBudget.mutateAsync(data as CreateBudgetRequest);
      }
      setIsFormOpen(false);
      setEditingBudget(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save budget');
    }
  }, [editingBudget, createBudget, updateBudget]);

  const handleFormClose = useCallback(() => {
    setIsFormOpen(false);
    setEditingBudget(null);
    setFormError(null);
  }, []);

  // Stats
  const overallProgress = totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Budgets</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Track spending limits for your categories
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-blue-600 to-blue-700 
            dark:from-blue-900 dark:to-blue-950 text-white rounded-lg 
            hover:from-blue-700 hover:to-blue-800 dark:hover:from-blue-800 dark:hover:to-blue-900
            transition-colors font-medium"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Budget
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Active Budgets</div>
          <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{activeBudgets}</div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Budgeted</div>
          <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
            {formatCurrency(totalBudgeted, primaryCurrency)}
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Spent</div>
          <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
            {formatCurrency(totalSpent, primaryCurrency)}
          </div>
          <div className="mt-1 text-xs text-gray-400">{overallProgress}% of budget</div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Exceeded</div>
          <div className={`mt-1 text-2xl font-bold ${exceededBudgets > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>
            {exceededBudgets}
          </div>
          {exceededBudgets > 0 && (
            <div className="mt-1 text-xs text-red-500">Needs attention</div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Search */}
        <div className="flex-1 min-w-[200px] max-w-md relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search budgets..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
              bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
              placeholder-gray-400 dark:placeholder-gray-500
              focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Status filter chips */}
        <div className="flex items-center gap-2">
          {(['all', 'healthy', 'warning', 'exceeded'] as BudgetFilter[]).map((f) => {
            const isActive = filter === f;
            const getColors = () => {
              if (f === 'all') return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
              return budgetStatusColors[f].bg + ' ' + budgetStatusColors[f].text;
            };
            
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                  isActive
                    ? getColors() + ' ring-2 ring-offset-1 ring-gray-300 dark:ring-gray-500'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {f === 'all' ? 'All' : f === 'healthy' ? 'On Track' : f === 'warning' ? 'Warning' : 'Exceeded'}
              </button>
            );
          })}
        </div>
      </div>

      {/* Budget List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredBudgets.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
          {budgets.length === 0 ? (
            <>
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <svg className="w-8 h-8 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z" />
                </svg>
              </div>
              <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No budgets yet</h2>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                Create budgets to track spending limits for your categories.
              </p>
              <button
                onClick={handleCreate}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-blue-600 to-blue-700 
                  dark:from-blue-900 dark:to-blue-950 text-white rounded-lg 
                  hover:from-blue-700 hover:to-blue-800 transition-colors font-medium"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Your First Budget
              </button>
            </>
          ) : (
            <>
              <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No matching budgets</h2>
              <p className="text-gray-500 dark:text-gray-400">
                Try adjusting your search or filter criteria.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBudgets.map((budget) => (
            <BudgetCardWithActions
              key={budget.id}
              budget={budget}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Budget Form Modal */}
      <BudgetForm
        isOpen={isFormOpen}
        onClose={handleFormClose}
        onSubmit={handleFormSubmit}
        editingBudget={editingBudget}
        labels={labels}
        accounts={accounts}
        isLoading={createBudget.isPending || updateBudget.isPending}
        error={formError}
      />
    </div>
  );
}