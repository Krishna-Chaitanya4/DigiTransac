import { memo } from 'react';
import { formatCurrency } from '../../services/currencyService';
import type { Budget } from '../../types/budgets';
import { getBudgetStatus, budgetStatusColors, budgetPeriodConfig } from '../../types/budgets';

interface BudgetCardProps {
  budget: Budget;
  onClick?: (budget: Budget) => void;
  compact?: boolean;
}

export const BudgetCard = memo(function BudgetCard({
  budget,
  onClick,
  compact = false,
}: BudgetCardProps) {
  const status = getBudgetStatus(budget);
  const colors = budgetStatusColors[status];
  const periodConfig = budgetPeriodConfig[budget.period];
  
  // Clamp percentage for visual display (max 100% for bar width)
  const barWidth = Math.min(budget.percentUsed, 100);
  
  if (compact) {
    return (
      <button
        onClick={() => onClick?.(budget)}
        className={`w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 
          hover:border-gray-300 dark:hover:border-gray-600 transition-colors ${colors.bg}`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {budget.icon && <span className="text-lg">{budget.icon}</span>}
            <span className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate">
              {budget.name}
            </span>
          </div>
          <span className={`text-xs font-medium ${colors.text}`}>
            {budget.percentUsed.toFixed(0)}%
          </span>
        </div>
        
        {/* Progress bar */}
        <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div 
            className={`h-full ${colors.bar} transition-all duration-300`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
      </button>
    );
  }
  
  return (
    <div
      onClick={() => onClick?.(budget)}
      className={`p-4 rounded-xl border border-gray-200 dark:border-gray-700 
        ${onClick ? 'cursor-pointer hover:border-gray-300 dark:hover:border-gray-600' : ''} 
        transition-all ${colors.bg}`}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick(budget) : undefined}
    >
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
        
        {/* Status indicator */}
        <div className={`px-2 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
          {status === 'exceeded' ? 'Over budget' : 
           status === 'danger' ? 'Almost there' : 
           status === 'warning' ? 'On track' : 'Healthy'}
        </div>
      </div>
      
      {/* Progress section */}
      <div className="mb-3">
        {/* Progress bar */}
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-2">
          <div 
            className={`h-full ${colors.bar} transition-all duration-500 ease-out`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
        
        {/* Amount info */}
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
});