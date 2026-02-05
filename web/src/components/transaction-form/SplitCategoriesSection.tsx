import type { TransactionSplitRequest } from '../../types/transactions';
import type { Label } from '../../types/labels';
import { SearchableCategoryDropdown } from '../SearchableCategoryDropdown';

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
  // Validate splits sum
  const splitsSum = splits.reduce((sum, s) => sum + s.amount, 0);
  const splitsDiff = Math.abs(splitsSum - amount);
  const splitsValid = splitsDiff < 0.01;

  const addSplit = () => {
    const remaining = amount - splits.reduce((sum, s) => sum + s.amount, 0);
    const usedCategoryIds = new Set(splits.map(s => s.labelId));
    const availableCategory = categories.find(c => !usedCategoryIds.has(c.id));
    onSplitsChange([...splits, { labelId: availableCategory?.id || '', amount: Math.max(0, remaining), notes: undefined }]);
  };

  const updateSplit = (index: number, field: keyof TransactionSplitRequest, value: string | number) => {
    const newSplits = [...splits];
    newSplits[index] = { ...newSplits[index], [field]: value };
    onSplitsChange(newSplits);
  };

  const removeSplit = (index: number) => {
    onSplitsChange(splits.filter((_, i) => i !== index));
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
      
      <div className="flex justify-between items-center mt-2">
        <button
          type="button"
          onClick={addSplit}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          + Add split
        </button>
        <span className={`text-sm ${splitsValid ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          Total: {currencySymbol}{splitsSum.toFixed(2)} / {currencySymbol}{amount.toFixed(2)}
        </span>
      </div>
      
      {!splitsValid && (
        <p className="text-xs text-red-500 dark:text-red-400 mt-1">
          Split amounts must equal the transaction amount
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
