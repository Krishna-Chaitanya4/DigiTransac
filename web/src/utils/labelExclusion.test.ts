import { describe, it, expect } from 'vitest';
import { isLabelEffectivelyExcluded, isTransactionExcluded } from './labelExclusion';
import type { Label } from '../types/labels';

function makeLabelMap(labels: Partial<Label>[]): Map<string, Label> {
  const map = new Map<string, Label>();
  for (const l of labels) {
    map.set(l.id!, l as Label);
  }
  return map;
}

describe('isLabelEffectivelyExcluded', () => {
  it('returns false for non-excluded label', () => {
    const map = makeLabelMap([
      { id: 'l1', name: 'Food', excludeFromAnalytics: false },
    ]);
    expect(isLabelEffectivelyExcluded('l1', map)).toBe(false);
  });

  it('returns true for directly excluded label', () => {
    const map = makeLabelMap([
      { id: 'l1', name: 'Internal', excludeFromAnalytics: true },
    ]);
    expect(isLabelEffectivelyExcluded('l1', map)).toBe(true);
  });

  it('inherits exclusion from parent', () => {
    const map = makeLabelMap([
      { id: 'folder1', name: 'Excluded Folder', excludeFromAnalytics: true },
      { id: 'l1', name: 'Child', parentId: 'folder1', excludeFromAnalytics: false },
    ]);
    expect(isLabelEffectivelyExcluded('l1', map)).toBe(true);
  });

  it('returns false for label with non-excluded parent', () => {
    const map = makeLabelMap([
      { id: 'folder1', name: 'Normal Folder', excludeFromAnalytics: false },
      { id: 'l1', name: 'Child', parentId: 'folder1', excludeFromAnalytics: false },
    ]);
    expect(isLabelEffectivelyExcluded('l1', map)).toBe(false);
  });

  it('returns false for unknown label', () => {
    const map = makeLabelMap([]);
    expect(isLabelEffectivelyExcluded('unknown', map)).toBe(false);
  });
});

describe('isTransactionExcluded', () => {
  it('returns false for empty splits', () => {
    const map = makeLabelMap([]);
    expect(isTransactionExcluded({ splits: [] }, map)).toBe(false);
  });

  it('returns false when some splits are not excluded', () => {
    const map = makeLabelMap([
      { id: 'l1', name: 'Excluded', excludeFromAnalytics: true },
      { id: 'l2', name: 'Normal', excludeFromAnalytics: false },
    ]);
    expect(
      isTransactionExcluded(
        { splits: [{ labelId: 'l1' }, { labelId: 'l2' }] },
        map
      )
    ).toBe(false);
  });

  it('returns true when all splits are excluded', () => {
    const map = makeLabelMap([
      { id: 'l1', name: 'Excluded1', excludeFromAnalytics: true },
      { id: 'l2', name: 'Excluded2', excludeFromAnalytics: true },
    ]);
    expect(
      isTransactionExcluded(
        { splits: [{ labelId: 'l1' }, { labelId: 'l2' }] },
        map
      )
    ).toBe(true);
  });
});
