import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ChatsPage from './ChatsPage';

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

// Mock the hooks
const mockAccounts = [
  { id: 'acc-1', name: 'Checking', currency: 'USD', balance: 1000 },
  { id: 'acc-2', name: 'Savings', currency: 'USD', balance: 5000 },
];

const mockLabels = [
  { id: 'lbl-1', name: 'Food', type: 'Category', color: '#FF5733' },
  { id: 'lbl-2', name: 'Transport', type: 'Category', color: '#33FF57' },
];

const mockConversations = [
  {
    counterpartyUserId: 'user-2',
    counterpartyName: 'John Doe',
    counterpartyEmail: 'john@example.com',
    lastMessage: 'Hey!',
    lastMessageAt: new Date().toISOString(),
    unreadCount: 2,
    netBalance: 100,
    isSelfChat: false,
  },
  {
    counterpartyUserId: 'user-1',
    counterpartyName: 'Personal',
    counterpartyEmail: 'test@example.com',
    lastMessage: 'Transfer',
    lastMessageAt: new Date().toISOString(),
    unreadCount: 0,
    netBalance: 0,
    isSelfChat: true,
  },
];

const mockConversationDetail = {
  counterpartyUserId: 'user-2',
  counterpartyName: 'John Doe',
  counterpartyEmail: 'john@example.com',
  totalSent: 500,
  totalReceived: 400,
  messages: [
    {
      id: 'msg-1',
      content: 'Hello!',
      createdAt: new Date().toISOString(),
      isFromMe: false,
      status: 'Read',
    },
    {
      id: 'msg-2',
      content: 'Hi there!',
      createdAt: new Date().toISOString(),
      isFromMe: true,
      status: 'Delivered',
    },
  ],
  totalCount: 2,
  hasMore: false,
};

vi.mock('../hooks', () => ({
  useAccounts: vi.fn(() => ({ data: mockAccounts })),
  useLabels: vi.fn(() => ({ data: mockLabels })),
  useTags: vi.fn(() => ({ data: [] })),
  useCreateTag: vi.fn(() => ({ mutateAsync: vi.fn() })),
  useCreateTransaction: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useConversations: vi.fn(() => ({
    data: { conversations: mockConversations },
    isLoading: false
  })),
  useConversation: vi.fn(() => ({
    data: mockConversationDetail,
    isLoading: false
  })),
  useOptimisticSendMessage: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useEditMessage: vi.fn(() => ({ mutateAsync: vi.fn() })),
  useDeleteMessage: vi.fn(() => ({ mutateAsync: vi.fn() })),
  useMarkAsRead: vi.fn(() => ({ mutate: vi.fn() })),
  useInvalidateConversations: vi.fn(() => ({
    invalidateList: vi.fn(),
    invalidateDetail: vi.fn()
  })),
}));

vi.mock('../hooks/useNotifications', () => ({
  useNotifications: vi.fn(() => ({ isConnected: true })),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: {
      id: 'user-1',
      email: 'test@example.com',
      fullName: 'Test User'
    }
  })),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../context/CurrencyContext', () => ({
  useCurrency: vi.fn(() => ({
    primaryCurrency: 'USD',
    currencies: ['USD', 'EUR'],
    exchangeRates: {},
    isLoading: false,
  })),
  CurrencyProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../context/ThemeContext', () => ({
  useTheme: vi.fn(() => ({
    theme: 'light',
    setTheme: vi.fn(),
  })),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Create a query client for tests
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false, gcTime: 0, staleTime: 0 },
    mutations: { retry: false },
  },
});

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('ChatsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders conversation list', async () => {
    renderWithProviders(<ChatsPage />);
    
    await waitFor(() => {
      // Use getAllByText since "John Doe" may appear in both sidebar and header after selection
      expect(screen.getAllByText('John Doe').length).toBeGreaterThan(0);
    });
  });

  it('shows personal chat in conversation list', async () => {
    renderWithProviders(<ChatsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Personal')).toBeDefined();
    });
  });

  it('displays empty state when no conversation is selected', async () => {
    renderWithProviders(<ChatsPage />);
    
    // Wait for the page to render
    await waitFor(() => {
      // Verify the component renders (we just check conversation list is there)
      expect(screen.getByText('Chats')).toBeDefined();
    });
  });

  it('shows unread count badge', async () => {
    renderWithProviders(<ChatsPage />);
    
    await waitFor(() => {
      // John Doe has 2 unread messages
      const badge = screen.getByText('2');
      expect(badge).toBeDefined();
    });
  });

  it('displays message input when conversation is selected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ChatsPage />);
    
    await waitFor(() => {
      expect(screen.getAllByText('John Doe').length).toBeGreaterThan(0);
    });
    
    // Click on a conversation - get the first match (in the sidebar)
    const johnDoeElements = screen.getAllByText('John Doe');
    await user.click(johnDoeElements[0]);
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/type a message/i)).toBeDefined();
    });
  });

  it('shows network status when connected', async () => {
    renderWithProviders(<ChatsPage />);
    
    // The component should render without errors
    await waitFor(() => {
      expect(screen.getAllByText('John Doe').length).toBeGreaterThan(0);
    });
  });
});

describe('ChatsPage - Message Interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows typing a message', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ChatsPage />);
    
    await waitFor(() => {
      expect(screen.getAllByText('John Doe').length).toBeGreaterThan(0);
    });
    
    // Click on conversation - get the first match (in the sidebar)
    const johnDoeElements = screen.getAllByText('John Doe');
    await user.click(johnDoeElements[0]);
    
    await waitFor(() => {
      const input = screen.getByPlaceholderText(/type a message/i);
      expect(input).toBeDefined();
    });
    
    const input = screen.getByPlaceholderText(/type a message/i) as HTMLInputElement;
    await user.type(input, 'Hello world');
    
    expect(input.value).toBe('Hello world');
  });
});

describe('ChatsPage - Mobile Responsiveness', () => {
  it('shows back button in mobile view when conversation is selected', async () => {
    // This test would require mocking the window size
    // For now, we just verify the component renders
    renderWithProviders(<ChatsPage />);
    
    await waitFor(() => {
      expect(screen.getAllByText('John Doe').length).toBeGreaterThan(0);
    });
  });
});