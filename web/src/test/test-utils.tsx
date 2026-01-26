import { ReactElement, ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';

interface WrapperOptions {
  initialEntries?: string[];
  withAuth?: boolean;
}

// Create a new QueryClient for each test to avoid state leaking between tests
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export function createWrapper(options: WrapperOptions = {}) {
  const { initialEntries = ['/'], withAuth = true } = options;
  const queryClient = createTestQueryClient();
  
  return function Wrapper({ children }: { children: ReactNode }) {
    const content = (
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <MemoryRouter initialEntries={initialEntries}>
            {children}
          </MemoryRouter>
        </ThemeProvider>
      </QueryClientProvider>
    );

    if (withAuth) {
      return <AuthProvider>{content}</AuthProvider>;
    }

    return content;
  };
}

export function renderWithRouter(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & WrapperOptions
) {
  const { initialEntries, withAuth, ...renderOptions } = options || {};
  
  return render(ui, {
    wrapper: createWrapper({ initialEntries, withAuth }),
    ...renderOptions,
  });
}

export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
