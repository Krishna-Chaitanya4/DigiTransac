import type { Label } from '../types/labels';

/**
 * Check if a label is effectively excluded from calculations,
 * including parent folder inheritance (walks up the parent chain).
 */
export function isLabelEffectivelyExcluded(labelId: string, labelMap: Map<string, Label>): boolean {
  let current = labelMap.get(labelId);
  while (current) {
    if (current.excludeFromAnalytics) return true;
    if (!current.parentId) break;
    current = labelMap.get(current.parentId);
  }
  return false;
}

/**
 * Check if a transaction is fully excluded from calculations.
 * A transaction is excluded only when ALL of its splits belong to excluded categories.
 */
export function isTransactionExcluded(
  transaction: { splits: Array<{ labelId: string }> },
  labelMap: Map<string, Label>
): boolean {
  if (transaction.splits.length === 0) return false;
  return transaction.splits.every(split => isLabelEffectivelyExcluded(split.labelId, labelMap));
}