import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, render } from '@testing-library/react';
import OfflineIndicator from './OfflineIndicator';
import * as useOfflineModule from '../hooks/useOffline';

// Mock the useOffline hooks
vi.mock('../hooks/useOffline', () => ({
  useOnlineStatus: vi.fn(),
  useOfflineQueue: vi.fn(),
}));

describe('OfflineIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render nothing when online and no pending items', () => {
    vi.mocked(useOfflineModule.useOnlineStatus).mockReturnValue(true);
    vi.mocked(useOfflineModule.useOfflineQueue).mockReturnValue({
      queue: [],
      addToQueue: vi.fn(),
      syncQueue: vi.fn(),
      isSyncing: false,
    });

    const { container } = render(<OfflineIndicator />);
    expect(container.firstChild).toBeNull();
  });

  it('should show offline indicator when offline', () => {
    vi.mocked(useOfflineModule.useOnlineStatus).mockReturnValue(false);
    vi.mocked(useOfflineModule.useOfflineQueue).mockReturnValue({
      queue: [],
      addToQueue: vi.fn(),
      syncQueue: vi.fn(),
      isSyncing: false,
    });

    render(<OfflineIndicator />);
    expect(screen.getByText("You're offline")).toBeInTheDocument();
  });

  it('should show pending changes count when queue has items', () => {
    vi.mocked(useOfflineModule.useOnlineStatus).mockReturnValue(true);
    vi.mocked(useOfflineModule.useOfflineQueue).mockReturnValue({
      queue: [
        { id: '1', type: 'CREATE_TRANSACTION', payload: {}, timestamp: new Date().toISOString() },
        { id: '2', type: 'UPDATE_TRANSACTION', payload: {}, timestamp: new Date().toISOString() },
      ],
      addToQueue: vi.fn(),
      syncQueue: vi.fn(),
      isSyncing: false,
    });

    render(<OfflineIndicator />);
    expect(screen.getByText('2 pending changes')).toBeInTheDocument();
  });

  it('should show singular form for single pending change', () => {
    vi.mocked(useOfflineModule.useOnlineStatus).mockReturnValue(true);
    vi.mocked(useOfflineModule.useOfflineQueue).mockReturnValue({
      queue: [
        { id: '1', type: 'CREATE_TRANSACTION', payload: {}, timestamp: new Date().toISOString() },
      ],
      addToQueue: vi.fn(),
      syncQueue: vi.fn(),
      isSyncing: false,
    });

    render(<OfflineIndicator />);
    expect(screen.getByText('1 pending change')).toBeInTheDocument();
  });

  it('should show syncing indicator when syncing', () => {
    vi.mocked(useOfflineModule.useOnlineStatus).mockReturnValue(true);
    vi.mocked(useOfflineModule.useOfflineQueue).mockReturnValue({
      queue: [
        { id: '1', type: 'CREATE_TRANSACTION', payload: {}, timestamp: new Date().toISOString() },
      ],
      addToQueue: vi.fn(),
      syncQueue: vi.fn(),
      isSyncing: true,
    });

    render(<OfflineIndicator />);
    expect(screen.getByText(/Syncing 1 item/)).toBeInTheDocument();
  });

  it('should show both offline and pending indicators when offline with queue', () => {
    vi.mocked(useOfflineModule.useOnlineStatus).mockReturnValue(false);
    vi.mocked(useOfflineModule.useOfflineQueue).mockReturnValue({
      queue: [
        { id: '1', type: 'CREATE_TRANSACTION', payload: {}, timestamp: new Date().toISOString() },
      ],
      addToQueue: vi.fn(),
      syncQueue: vi.fn(),
      isSyncing: false,
    });

    render(<OfflineIndicator />);
    expect(screen.getByText("You're offline")).toBeInTheDocument();
    expect(screen.getByText('1 pending change')).toBeInTheDocument();
  });
});
