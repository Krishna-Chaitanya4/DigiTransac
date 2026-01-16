import { ReactElement, ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';

interface WrapperOptions {
  initialEntries?: string[];
  withAuth?: boolean;
}

export function createWrapper(options: WrapperOptions = {}) {
  const { initialEntries = ['/'], withAuth = true } = options;
  
  return function Wrapper({ children }: { children: ReactNode }) {
    const content = (
      <MemoryRouter initialEntries={initialEntries}>
        {children}
      </MemoryRouter>
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
