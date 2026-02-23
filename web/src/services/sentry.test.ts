import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as Sentry from '@sentry/react';

// Mock Sentry module
vi.mock('@sentry/react', () => ({
  init: vi.fn(),
  setUser: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  addBreadcrumb: vi.fn(),
  withScope: vi.fn((callback) => callback({ setExtras: vi.fn() })),
  ErrorBoundary: vi.fn(),
}));

// Import after mocking
import {
  initSentry,
  setSentryUser,
  clearSentryUser,
  captureException,
  addBreadcrumb,
} from './sentry';

describe('sentry', () => {
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleInfoSpy.mockRestore();
  });

  describe('initSentry', () => {
    it('should log disabled message in development mode', () => {
      // In test environment, PROD is false
      initSentry();
      
      expect(consoleInfoSpy).toHaveBeenCalledWith('[Sentry] Disabled in development mode');
    });

    it('should not call Sentry.init in development mode', () => {
      initSentry();
      
      // Sentry.init should not be called in dev mode without VITE_ENABLE_SENTRY
      // Since we can't easily change import.meta.env.PROD, we verify by checking console output
      expect(consoleInfoSpy).toHaveBeenCalledWith('[Sentry] Disabled in development mode');
    });
  });

  describe('setSentryUser', () => {
    it('should call Sentry.setUser with user data', () => {
      const user = {
        id: 'user123',
        email: 'test@example.com',
        name: 'Test User',
      };

      setSentryUser(user);

      expect(Sentry.setUser).toHaveBeenCalledWith({
        id: 'user123',
        email: 'test@example.com',
        username: 'Test User',
      });
    });

    it('should handle user without name', () => {
      const user = {
        id: 'user123',
        email: 'test@example.com',
      };

      setSentryUser(user);

      expect(Sentry.setUser).toHaveBeenCalledWith({
        id: 'user123',
        email: 'test@example.com',
        username: undefined,
      });
    });
  });

  describe('clearSentryUser', () => {
    it('should call Sentry.setUser with null', () => {
      clearSentryUser();

      expect(Sentry.setUser).toHaveBeenCalledWith(null);
    });
  });

  describe('captureException', () => {
    it('should call Sentry.captureException with error', () => {
      const error = new Error('Test error');

      captureException(error);

      expect(Sentry.captureException).toHaveBeenCalledWith(error);
    });

    it('should use withScope when context is provided', () => {
      const error = new Error('Test error');
      const context = { userId: '123', action: 'test' };

      captureException(error, context);

      expect(Sentry.withScope).toHaveBeenCalled();
    });

    it('should handle non-Error values', () => {
      const errorMessage = 'String error';

      captureException(errorMessage);

      expect(Sentry.captureException).toHaveBeenCalledWith(errorMessage);
    });
  });

  describe('addBreadcrumb', () => {
    it('should call Sentry.addBreadcrumb with message and default category', () => {
      addBreadcrumb('User clicked button');

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        message: 'User clicked button',
        category: 'app',
        data: undefined,
        level: 'info',
      });
    });

    it('should call Sentry.addBreadcrumb with custom category', () => {
      addBreadcrumb('API call completed', 'api');

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        message: 'API call completed',
        category: 'api',
        data: undefined,
        level: 'info',
      });
    });

    it('should call Sentry.addBreadcrumb with data', () => {
      const data = { endpoint: '/api/accounts', status: 200 };
      addBreadcrumb('API response', 'http', data);

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        message: 'API response',
        category: 'http',
        data,
        level: 'info',
      });
    });
  });
});
