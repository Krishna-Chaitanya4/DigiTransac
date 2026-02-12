import { useState, useCallback, useEffect } from 'react';
import type { TransactionUIType, TransactionSplitRequest } from '../types/transactions';

export interface TransactionTemplate {
  id: string;
  name: string;
  icon: string;
  type: TransactionUIType;
  amount?: number;
  accountId?: string;
  labelId?: string;
  splits?: TransactionSplitRequest[];
  title?: string;
  payee?: string;
  tagIds?: string[];
  transferToAccountId?: string;
  createdAt: string;
  usageCount: number;
}

const STORAGE_KEY = 'digiTransac_transactionTemplates';
const MAX_TEMPLATES = 20;

function loadTemplates(): TransactionTemplate[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveTemplates(templates: TransactionTemplate[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

/**
 * Hook for managing transaction templates stored in localStorage.
 * Supports CRUD operations and usage tracking for smart sorting.
 */
export function useTransactionTemplates() {
  const [templates, setTemplates] = useState<TransactionTemplate[]>(loadTemplates);

  // Sync with localStorage on mount (for multi-tab support)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setTemplates(loadTemplates());
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const addTemplate = useCallback((
    template: Omit<TransactionTemplate, 'id' | 'createdAt' | 'usageCount'>
  ): TransactionTemplate => {
    const newTemplate: TransactionTemplate = {
      ...template,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      usageCount: 0,
    };
    setTemplates(prev => {
      const updated = [newTemplate, ...prev].slice(0, MAX_TEMPLATES);
      saveTemplates(updated);
      return updated;
    });
    return newTemplate;
  }, []);

  const removeTemplate = useCallback((id: string) => {
    setTemplates(prev => {
      const updated = prev.filter(t => t.id !== id);
      saveTemplates(updated);
      return updated;
    });
  }, []);

  const incrementUsage = useCallback((id: string) => {
    setTemplates(prev => {
      const updated = prev.map(t =>
        t.id === id ? { ...t, usageCount: t.usageCount + 1 } : t
      );
      saveTemplates(updated);
      return updated;
    });
  }, []);

  // Sorted by usage (most used first), then by creation date
  const sortedTemplates = [...templates].sort((a, b) => {
    if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return {
    templates: sortedTemplates,
    addTemplate,
    removeTemplate,
    incrementUsage,
    templateCount: templates.length,
    maxTemplates: MAX_TEMPLATES,
  };
}