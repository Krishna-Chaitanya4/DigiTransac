import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, render, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';
import * as sentryModule from '../services/sentry';
import * as loggerModule from '../services/logger';

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
    throw new Error('Test error message');
  }
  return <div>Child component rendered successfully</div>;
}

// Suppress console.error during error boundary tests
const originalError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});
afterEach(() => {
  console.error = originalError;
});

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Child component rendered successfully')).toBeInTheDocument();
  });

  it('should render default error UI when an error is caught', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /go to dashboard/i })).toBeInTheDocument();
  });

  it('should render custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div>Custom error fallback</div>}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom error fallback')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('should log error with boundary name', () => {
    render(
      <ErrorBoundary name="TestBoundary">
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(loggerModule.logger.error).toHaveBeenCalledWith(
      'ErrorBoundary [TestBoundary] caught an error:',
      expect.any(Error),
      expect.any(Object)
    );
  });

  it('should report error to Sentry with context', () => {
    render(
      <ErrorBoundary name="TestBoundary">
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(sentryModule.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        boundaryName: 'TestBoundary',
        componentStack: expect.any(String),
      })
    );
  });

  it('should call onError callback when provided', () => {
    const onError = vi.fn();
    
    render(
      <ErrorBoundary onError={onError}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.any(Object)
    );
  });

  it('should render inline error UI when inline prop is true', () => {
    render(
      <ErrorBoundary inline>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    // Should show inline error, not full-page error
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('This section couldn\'t be loaded.')).toBeInTheDocument();
    // Should not show full-page error buttons
    expect(screen.queryByRole('button', { name: /go to dashboard/i })).not.toBeInTheDocument();
  });

  it('should reset error state when Try Again is clicked', () => {
    // Use a ref to track whether we should throw
    let shouldThrow = true;

    function ConditionalError() {
      if (shouldThrow) {
        throw new Error('Test error');
      }
      return <div>Child component rendered successfully</div>;
    }

    const { rerender } = render(
      <ErrorBoundary>
        <ConditionalError />
      </ErrorBoundary>
    );

    // Error UI should be shown
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    // Now set to not throw and click Try Again
    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    // Should now show the recovered content after state reset triggers re-render
    expect(screen.getByText('Child component rendered successfully')).toBeInTheDocument();
  });

  it('should use "Unknown" as default boundary name', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(loggerModule.logger.error).toHaveBeenCalledWith(
      'ErrorBoundary [Unknown] caught an error:',
      expect.any(Error),
      expect.any(Object)
    );
  });

  it('should reset error state when inline Try again is clicked', () => {
    // Use a ref to track whether we should throw
    let shouldThrow = true;

    function ConditionalError() {
      if (shouldThrow) {
        throw new Error('Test error');
      }
      return <div>Child component rendered successfully</div>;
    }

    render(
      <ErrorBoundary inline>
        <ConditionalError />
      </ErrorBoundary>
    );

    // Inline error UI should be shown
    expect(screen.getByRole('alert')).toBeInTheDocument();

    // Now set to not throw and click Try again
    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    // Should now show the recovered content
    expect(screen.getByText('Child component rendered successfully')).toBeInTheDocument();
  });
});
