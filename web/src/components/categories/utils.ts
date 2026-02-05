import { Label } from '../../types/labels';

/**
 * Helper to get the full path for a label (e.g., "Food → Groceries → Vegetables")
 */
export function getLabelPath(labelId: string, allLabels: Label[]): string {
  const labelMap = new Map(allLabels.map(l => [l.id, l]));
  const path: string[] = [];
  let current = labelMap.get(labelId);
  
  while (current) {
    path.unshift(current.name);
    current = current.parentId ? labelMap.get(current.parentId) : undefined;
  }
  
  return path.join(' → ');
}

/**
 * Get all descendant IDs for a given parent label
 */
export function getDescendantIds(parentId: string, allLabels: Label[]): Set<string> {
  const ids = new Set<string>([parentId]);
  const children = allLabels.filter(l => l.parentId === parentId);
  children.forEach(child => {
    const childDescendants = getDescendantIds(child.id, allLabels);
    childDescendants.forEach(id => ids.add(id));
  });
  return ids;
}
