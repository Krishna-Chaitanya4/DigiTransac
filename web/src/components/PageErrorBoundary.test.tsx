import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { PageErrorBoundary } from './PageErrorBoundary';

// Mock the sentry and logger services
vi.mock('../services/sentry', () => ({
  captureException: vi.fn(),
}));

vi.mock('../services/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

// Component that throws an error
function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test page error');
  }
  return <div>Page content rendered successfully</div>;
}

// Wrapper to provide router context
function renderWithRouter(ui: React.ReactElement) {
  return render(
    <BrowserRouter>
      {ui}
    </BrowserRouter>
  );
}

// Suppress console.error during error boundary tests
const originalError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});
afterEach(() => {
  console.error = originalError;
});

describe('PageErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render children when no error occurs', () => {
    renderWithRouter(
      <PageErrorBoundary pageName="TestPage">
        <ThrowError shouldThrow={false} />
      </PageErrorBoundary>
    );

    expect(screen.getByText('Page content rendered successfully')).toBeInTheDocument();
  });

  it('should render page error UI when an error is caught', () => {
    renderWithRouter(
      <PageErrorBoundary pageName="TestPage">
        <ThrowError shouldThrow={true} />
      </PageErrorBoundary>
    );

    expect(screen.getByText('Page Error')).toBeInTheDocument();
    expect(screen.getByText(/We couldn't load this page/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /refresh page/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument();
  });

  it('should indicate error has been reported', () => {
    renderWithRouter(
      <PageErrorBoundary pageName="Dashboard">
        <ThrowError shouldThrow={true} />
      </PageErrorBoundary>
    );

    expect(screen.getByText(/The error has been reported/)).toBeInTheDocument();
  });
});
