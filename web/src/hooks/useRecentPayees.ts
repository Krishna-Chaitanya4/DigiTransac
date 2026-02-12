import { useState, useCallback, useMemo } from 'react';

const STORAGE_KEY = 'digiTransac_recentPayees';
const MAX_PAYEES = 100;

interface PayeeEntry {
  name: string;
  count: number;
  lastUsed: number; // timestamp
}

function loadPayees(): PayeeEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PayeeEntry[];
  } catch {
    return [];
  }
}

function savePayees(entries: PayeeEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

/**
 * Hook for managing recent payee suggestions with localStorage persistence.
 * Tracks usage count and recency for smart sorting.
 */
export function useRecentPayees() {
  const [entries, setEntries] = useState<PayeeEntry[]>(loadPayees);

  /** Add or update a payee in the history */
  const addPayee = useCallback((name: string) => {
    if (!name.trim()) return;
    const trimmed = name.trim();

    setEntries(prev => {
      const existing = prev.find(p => p.name.toLowerCase() === trimmed.toLowerCase());
      let updated: PayeeEntry[];

      if (existing) {
        updated = prev.map(p =>
          p.name.toLowerCase() === trimmed.toLowerCase()
            ? { ...p, name: trimmed, count: p.count + 1, lastUsed: Date.now() }
            : p
        );
      } else {
        updated = [{ name: trimmed, count: 1, lastUsed: Date.now() }, ...prev];
      }

      // Keep only the most recent MAX_PAYEES entries
      updated.sort((a, b) => b.lastUsed - a.lastUsed);
      if (updated.length > MAX_PAYEES) {
        updated = updated.slice(0, MAX_PAYEES);
      }

      savePayees(updated);
      return updated;
    });
  }, []);

  /** Get filtered suggestions for a query, sorted by relevance (frequency + recency) */
  const getSuggestions = useCallback((query: string, limit = 8): string[] => {
    if (!query.trim()) {
      // Return top payees when no query
      return entries
        .sort((a, b) => b.count - a.count || b.lastUsed - a.lastUsed)
        .slice(0, limit)
        .map(p => p.name);
    }

    const q = query.trim().toLowerCase();
    return entries
      .filter(p => p.name.toLowerCase().includes(q))
      .sort((a, b) => {
        // Prioritize starts-with matches
        const aStarts = a.name.toLowerCase().startsWith(q) ? 1 : 0;
        const bStarts = b.name.toLowerCase().startsWith(q) ? 1 : 0;
        if (aStarts !== bStarts) return bStarts - aStarts;
        // Then by frequency
        if (a.count !== b.count) return b.count - a.count;
        // Then by recency
        return b.lastUsed - a.lastUsed;
      })
      .slice(0, limit)
      .map(p => p.name);
  }, [entries]);

  /** All unique payee names (for external use) */
  const payeeNames = useMemo(() => entries.map(p => p.name), [entries]);

  return { addPayee, getSuggestions, payeeNames, payeeCount: entries.length };
}