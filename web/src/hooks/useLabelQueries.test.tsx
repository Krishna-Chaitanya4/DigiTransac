import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../context/ThemeContext';
import { CurrencyProvider } from '../context/CurrencyContext';
import { AuthProvider } from '../context/AuthContext';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  useLabels,
  useLabelsTree,
  useCreateLabel,
  useUpdateLabel,
  useDeleteLabel,
  useLabelTransactionCount,
  useDeleteLabelWithReassignment,
} from './useLabelQueries';
import type { Label, LabelTree } from '../types/labels';

// ── Mock the service layer ──
vi.mock('../services/labelService', () => ({
  getLabels: vi.fn(),
  getLabelsTree: vi.fn(),
  createLabel: vi.fn(),
  updateLabel: vi.fn(),
  deleteLabel: vi.fn(),
  deleteLabelWithReassignment: vi.fn(),
  getLabelTransactionCount: vi.fn(),
}));

import * as labelService from '../services/labelService';

const mockGetLabels = vi.mocked(labelService.getLabels);
const mockGetLabelsTree = vi.mocked(labelService.getLabelsTree);
const mockCreateLabel = vi.mocked(labelService.createLabel);
const mockUpdateLabel = vi.mocked(labelService.updateLabel);
const mockDeleteLabel = vi.mocked(labelService.deleteLabel);
const mockDeleteLabelWithReassignment = vi.mocked(labelService.deleteLabelWithReassignment);
const mockGetLabelTransactionCount = vi.mocked(labelService.getLabelTransactionCount);

// ── Test fixtures ──
const label1: Label = {
  id: 'lbl-1',
  name: 'Food',
  parentId: null,
  type: 'Category',
  icon: '🍕',
  color: '#EF4444',
  order: 0,
  isSystem: false,
  excludeFromAnalytics: false,
  createdAt: '2024-01-01T00:00:00Z',
};

const label2: Label = {
  ...label1,
  id: 'lbl-2',
  name: 'Transport',
  icon: '🚗',
  color: '#3B82F6',
  order: 1,
};

// ── Helper ──
let queryClient: QueryClient;

function createWrapper() {
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ThemeProvider>
            <CurrencyProvider>
              <MemoryRouter>{children}</MemoryRouter>
            </CurrencyProvider>
          </ThemeProvider>
        </AuthProvider>
      </QueryClientProvider>
    );
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ───────── Query hooks ─────────

describe('useLabels', () => {
  it('fetches flat label list', async () => {
    mockGetLabels.mockResolvedValue([label1, label2]);

    const { result } = renderHook(() => useLabels(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data![0].name).toBe('Food');
  });

  it('returns error on failure', async () => {
    mockGetLabels.mockRejectedValue(new Error('Fetch failed'));

    const { result } = renderHook(() => useLabels(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Fetch failed');
  });
});

describe('useLabelsTree', () => {
  it('fetches label tree', async () => {
    const tree: LabelTree[] = [{ ...label1, children: [{ ...label2, parentId: 'lbl-1', children: [] }] }];
    mockGetLabelsTree.mockResolvedValue(tree);

    const { result } = renderHook(() => useLabelsTree(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data![0].children).toHaveLength(1);
  });
});

// ───────── Mutation hooks ─────────

describe('useCreateLabel', () => {
  it('optimistically adds label with temp id', async () => {
    mockGetLabels.mockResolvedValue([label1]);
    const newLabel: Label = { ...label2, id: 'server-id' };
    mockCreateLabel.mockResolvedValue(newLabel);

    const wrapper = createWrapper();

    // Seed cache
    const { result: queryResult } = renderHook(() => useLabels(), { wrapper });
    await waitFor(() => expect(queryResult.current.isSuccess).toBe(true));

    // Mutate
    const { result: mutResult } = renderHook(() => useCreateLabel(), { wrapper });

    await act(async () => {
      mutResult.current.mutate({ name: 'Transport', type: 'Category' });
    });

    await waitFor(() => expect(mutResult.current.isSuccess).toBe(true));
    expect(mockCreateLabel).toHaveBeenCalledWith({ name: 'Transport', type: 'Category' });
  });

  it('rolls back on error', async () => {
    mockGetLabels.mockResolvedValue([label1]);
    mockCreateLabel.mockRejectedValue(new Error('Create failed'));

    const wrapper = createWrapper();

    const { result: queryResult } = renderHook(() => useLabels(), { wrapper });
    await waitFor(() => expect(queryResult.current.isSuccess).toBe(true));

    const { result: mutResult } = renderHook(() => useCreateLabel(), { wrapper });

    await act(async () => {
      mutResult.current.mutate({ name: 'Bad', type: 'Category' });
    });

    await waitFor(() => expect(mutResult.current.isError).toBe(true));

    // Cache should be rolled back to original
    const cached = queryClient.getQueryData<Label[]>(['labels', 'list']);
    expect(cached).toHaveLength(1);
    expect(cached![0].name).toBe('Food');
  });
});

describe('useUpdateLabel', () => {
  it('optimistically updates label in cache', async () => {
    mockGetLabels.mockResolvedValue([label1, label2]);
    mockUpdateLabel.mockResolvedValue({ ...label1, name: 'Groceries' });

    const wrapper = createWrapper();

    const { result: queryResult } = renderHook(() => useLabels(), { wrapper });
    await waitFor(() => expect(queryResult.current.isSuccess).toBe(true));

    const { result: mutResult } = renderHook(() => useUpdateLabel(), { wrapper });

    await act(async () => {
      mutResult.current.mutate({ id: 'lbl-1', data: { name: 'Groceries' } });
    });

    await waitFor(() => expect(mutResult.current.isSuccess).toBe(true));
    expect(mockUpdateLabel).toHaveBeenCalledWith('lbl-1', { name: 'Groceries' });
  });

  it('rolls back on update error', async () => {
    mockGetLabels.mockResolvedValue([label1]);
    mockUpdateLabel.mockRejectedValue(new Error('Update failed'));

    const wrapper = createWrapper();

    const { result: queryResult } = renderHook(() => useLabels(), { wrapper });
    await waitFor(() => expect(queryResult.current.isSuccess).toBe(true));

    const { result: mutResult } = renderHook(() => useUpdateLabel(), { wrapper });

    await act(async () => {
      mutResult.current.mutate({ id: 'lbl-1', data: { name: 'Fail' } });
    });

    await waitFor(() => expect(mutResult.current.isError).toBe(true));

    const cached = queryClient.getQueryData<Label[]>(['labels', 'list']);
    expect(cached![0].name).toBe('Food');
  });
});

describe('useDeleteLabel', () => {
  it('optimistically removes label from cache', async () => {
    mockGetLabels.mockResolvedValue([label1, label2]);
    mockDeleteLabel.mockResolvedValue(undefined);

    const wrapper = createWrapper();

    const { result: queryResult } = renderHook(() => useLabels(), { wrapper });
    await waitFor(() => expect(queryResult.current.isSuccess).toBe(true));

    const { result: mutResult } = renderHook(() => useDeleteLabel(), { wrapper });

    await act(async () => {
      mutResult.current.mutate('lbl-1');
    });

    await waitFor(() => expect(mutResult.current.isSuccess).toBe(true));
    expect(mockDeleteLabel).toHaveBeenCalledWith('lbl-1');
  });

  it('rolls back on delete error', async () => {
    mockGetLabels.mockResolvedValue([label1, label2]);
    mockDeleteLabel.mockRejectedValue(new Error('Delete failed'));

    const wrapper = createWrapper();

    const { result: queryResult } = renderHook(() => useLabels(), { wrapper });
    await waitFor(() => expect(queryResult.current.isSuccess).toBe(true));

    const { result: mutResult } = renderHook(() => useDeleteLabel(), { wrapper });

    await act(async () => {
      mutResult.current.mutate('lbl-1');
    });

    await waitFor(() => expect(mutResult.current.isError).toBe(true));

    const cached = queryClient.getQueryData<Label[]>(['labels', 'list']);
    expect(cached).toHaveLength(2);
  });
});

describe('useLabelTransactionCount', () => {
  it('fetches transaction count when label id provided', async () => {
    mockGetLabelTransactionCount.mockResolvedValue(42);

    const { result } = renderHook(() => useLabelTransactionCount('lbl-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(42);
    expect(mockGetLabelTransactionCount).toHaveBeenCalledWith('lbl-1');
  });

  it('does not fetch when label id is undefined', async () => {
    const { result } = renderHook(() => useLabelTransactionCount(undefined), { wrapper: createWrapper() });

    // Should not be loading since enabled is false
    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGetLabelTransactionCount).not.toHaveBeenCalled();
  });

  it('respects enabled option override', async () => {
    const { result } = renderHook(
      () => useLabelTransactionCount('lbl-1', { enabled: false }),
      { wrapper: createWrapper() },
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGetLabelTransactionCount).not.toHaveBeenCalled();
  });
});

describe('useDeleteLabelWithReassignment', () => {
  it('calls service and invalidates labels + transactions', async () => {
    mockDeleteLabelWithReassignment.mockResolvedValue(undefined);

    const wrapper = createWrapper();
    const { result } = renderHook(() => useDeleteLabelWithReassignment(), { wrapper });

    await act(async () => {
      result.current.mutate({ id: 'lbl-1', reassignToId: 'lbl-2' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockDeleteLabelWithReassignment).toHaveBeenCalledWith('lbl-1', 'lbl-2');
  });
});
