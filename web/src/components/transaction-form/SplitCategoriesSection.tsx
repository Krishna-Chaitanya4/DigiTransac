import { useState } from 'react';
import type { TransactionSplitRequest } from '../../types/transactions';
import type { Label } from '../../types/labels';
import { SearchableCategoryDropdown } from '../SearchableCategoryDropdown';

type SplitMode = 'amount' | 'percentage';

interface SplitCategoriesSectionProps {
  splits: TransactionSplitRequest[];
  onSplitsChange: (splits: TransactionSplitRequest[]) => void;
  categories: Label[];
  amount: number;
  currencySymbol: string;
  onCancelSplit: () => void;
}

export function SplitCategoriesSection({
  splits,
  onSplitsChange,
  categories,
  amount,
  currencySymbol,
  onCancelSplit,
}: SplitCategoriesSectionProps) {
  const [mode, setMode] = useState<SplitMode>('amount');
  // Track percentage values separately so they remain editable
  const [percentages, setPercentages] = useState<number[]>(() =>
    amount > 0 ? splits.map(s => Math.round((s.amount / amount) * 100)) : splits.map(() => 0)
  );

  // Validate splits sum
  const splitsSum = splits.reduce((sum, s) => sum + s.amount, 0);
  const splitsDiff = Math.abs(splitsSum - amount);
  const splitsValid = splitsDiff < 0.01;

  // Percentage sum validation
  const percentSum = percentages.reduce((sum, p) => sum + p, 0);
  const percentValid = Math.abs(percentSum - 100) < 0.5;

  const addSplit = () => {
    const remaining = amount - splits.reduce((sum, s) => sum + s.amount, 0);
    const usedCategoryIds = new Set(splits.map(s => s.labelId));
    const availableCategory = categories.find(c => !usedCategoryIds.has(c.id));

    if (mode === 'percentage') {
      const remainingPct = Math.max(0, 100 - percentages.reduce((sum, p) => sum + p, 0));
      setPercentages([...percentages, Math.round(remainingPct)]);
      onSplitsChange([
        ...splits,
        { labelId: availableCategory?.id || '', amount: Math.max(0, remaining), notes: undefined },
      ]);
    } else {
      onSplitsChange([
        ...splits,
        { labelId: availableCategory?.id || '', amount: Math.max(0, remaining), notes: undefined },
      ]);
      setPercentages([...percentages, amount > 0 ? Math.round((Math.max(0, remaining) / amount) * 100) : 0]);
    }
  };

  const updateSplit = (index: number, field: keyof TransactionSplitRequest, value: string | number) => {
    const newSplits = [...splits];
    newSplits[index] = { ...newSplits[index], [field]: value };
    onSplitsChange(newSplits);
    // Keep percentages in sync when amounts change directly
    if (field === 'amount' && amount > 0) {
      const newPercentages = [...percentages];
      newPercentages[index] = Math.round(((typeof value === 'number' ? value : parseFloat(value) || 0) / amount) * 100);
      setPercentages(newPercentages);
    }
  };

  const updatePercentage = (index: number, pct: number) => {
    const newPercentages = [...percentages];
    newPercentages[index] = pct;
    setPercentages(newPercentages);

    // Recalculate amounts from percentages
    const newSplits = splits.map((s, i) => ({
      ...s,
      amount: i === index
        ? Math.round((pct / 100) * amount * 100) / 100
        : Math.round((newPercentages[i] / 100) * amount * 100) / 100,
    }));
    onSplitsChange(newSplits);
  };

  const removeSplit = (index: number) => {
    onSplitsChange(splits.filter((_, i) => i !== index));
    setPercentages(percentages.filter((_, i) => i !== index));
  };

  const handleModeSwitch = (newMode: SplitMode) => {
    setMode(newMode);
    if (newMode === 'percentage' && amount > 0) {
      // Recalc percentages from current amounts
      setPercentages(splits.map(s => Math.round((s.amount / amount) * 100)));
    }
  };

  const handleEqualSplit = () => {
    const count = splits.length;
    if (count === 0 || amount <= 0) return;

    const equalPct = Math.floor(100 / count);
    const equalAmt = Math.floor((amount / count) * 100) / 100;
    // Give remainder to last split to ensure exact sum
    const lastPct = 100 - equalPct * (count - 1);
    const lastAmt = Math.round((amount - equalAmt * (count - 1)) * 100) / 100;

    const newPercentages = splits.map((_, i) => (i === count - 1 ? lastPct : equalPct));
    const newSplits = splits.map((s, i) => ({
      ...s,
      amount: i === count - 1 ? lastAmt : equalAmt,
    }));

    setPercentages(newPercentages);
    onSplitsChange(newSplits);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Split Categories
        </label>
        <button
          type="button"
          onClick={onCancelSplit}
          className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
        >
          Cancel split
        </button>
      </div>

      {/* Mode Toggle */}
      <div className="flex items-center gap-2 mb-3">
        <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-600 p-0.5 bg-gray-50 dark:bg-gray-700/50">
          <button
            type="button"
            onClick={() => handleModeSwitch('amount')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              mode === 'amount'
                ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {currencySymbol} Amount
          </button>
          <button
            type="button"
            onClick={() => handleModeSwitch('percentage')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              mode === 'percentage'
                ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            % Percent
          </button>
        </div>
        {splits.length >= 2 && (
          <button
            type="button"
            onClick={handleEqualSplit}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline ml-auto"
          >
            Split equally
          </button>
        )}
      </div>

      <div className="space-y-2">
        {splits.map((split, index) => {
          const usedCategoryIds = splits
            .filter((_, i) => i !== index)
            .map(s => s.labelId)
            .filter(id => id);

          return (
            <div key={index} className="flex gap-2 items-start">
              <SearchableCategoryDropdown
                value={split.labelId}
                onChange={(value) => updateSplit(index, 'labelId', value)}
                categories={categories}
                excludeIds={usedCategoryIds}
                placeholder="Category..."
                className="flex-1"
              />
              {mode === 'amount' ? (
                <input
                  type="number"
                  value={split.amount || ''}
                  onChange={(e) => updateSplit(index, 'amount', parseFloat(e.target.value) || 0)}
                  className="w-24 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded 
                    bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                  placeholder="Amount"
                  step="0.01"
                  min="0"
                />
              ) : (
                <div className="relative w-24">
                  <input
                    type="number"
                    value={percentages[index] ?? 0}
                    onChange={(e) => updatePercentage(index, parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1.5 pr-7 border border-gray-300 dark:border-gray-600 rounded 
                      bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                    placeholder="%"
                    step="1"
                    min="0"
                    max="100"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 dark:text-gray-500 pointer-events-none">%</span>
                </div>
              )}
              {splits.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeSplit(index)}
                  className="p-1.5 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Percentage mode: show computed amounts below */}
      {mode === 'percentage' && splits.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 px-1">
          {splits.map((split, index) => (
            <span key={index} className="text-xs text-gray-400 dark:text-gray-500">
              {currencySymbol}{split.amount.toFixed(2)}
            </span>
          ))}
        </div>
      )}

      <div className="flex justify-between items-center mt-2">
        <button
          type="button"
          onClick={addSplit}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          + Add split
        </button>
        {mode === 'amount' ? (
          <span className={`text-sm ${splitsValid ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            Total: {currencySymbol}{splitsSum.toFixed(2)} / {currencySymbol}{amount.toFixed(2)}
          </span>
        ) : (
          <span className={`text-sm ${percentValid ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            Total: {percentSum}% / 100%
          </span>
        )}
      </div>

      {mode === 'amount' && !splitsValid && (
        <p className="text-xs text-red-500 dark:text-red-400 mt-1">
          Split amounts must equal the transaction amount
        </p>
      )}
      {mode === 'percentage' && !percentValid && (
        <p className="text-xs text-red-500 dark:text-red-400 mt-1">
          Percentages must total 100%
        </p>
      )}
    </div>
  );
}

// Export splitsValid calculation for parent component
export function validateSplits(splits: TransactionSplitRequest[], amount: number): boolean {
  const splitsSum = splits.reduce((sum, s) => sum + s.amount, 0);
  return Math.abs(splitsSum - amount) < 0.01;
}
