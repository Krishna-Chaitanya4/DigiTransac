import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from './logger';

// Mock the sentry module
vi.mock('./sentry', () => ({
  captureException: vi.fn(),
}));

import { captureException } from './sentry';

describe('logger', () => {
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleDebugSpy.mockRestore();
    consoleInfoSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('logger.debug', () => {
    it('should call console.debug with formatted message in development', () => {
      logger.debug('Debug message');
      
      expect(consoleDebugSpy).toHaveBeenCalled();
      const message = consoleDebugSpy.mock.calls[0][0];
      expect(message).toContain('[DEBUG]');
      expect(message).toContain('Debug message');
    });

    it('should include timestamp in the message', () => {
      logger.debug('Test message');
      
      const message = consoleDebugSpy.mock.calls[0][0];
      // ISO timestamp format: 2026-01-18T12:00:00.000Z
      expect(message).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/);
    });

    it('should pass additional arguments', () => {
      const data = { key: 'value' };
      logger.debug('Debug with data', data);
      
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        expect.stringContaining('Debug with data'),
        data
      );
    });
  });

  describe('logger.info', () => {
    it('should call console.info with formatted message', () => {
      logger.info('Info message');
      
      expect(consoleInfoSpy).toHaveBeenCalled();
      const message = consoleInfoSpy.mock.calls[0][0];
      expect(message).toContain('[INFO]');
      expect(message).toContain('Info message');
    });

    it('should pass multiple arguments', () => {
      logger.info('Multiple args', 'arg1', 'arg2', 123);
      
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('Multiple args'),
        'arg1',
        'arg2',
        123
      );
    });
  });

  describe('logger.warn', () => {
    it('should call console.warn with formatted message', () => {
      logger.warn('Warning message');
      
      expect(consoleWarnSpy).toHaveBeenCalled();
      const message = consoleWarnSpy.mock.calls[0][0];
      expect(message).toContain('[WARN]');
      expect(message).toContain('Warning message');
    });

    it('should pass additional context', () => {
      const context = { reason: 'test' };
      logger.warn('Warning with context', context);
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Warning with context'),
        context
      );
    });
  });

  describe('logger.error', () => {
    it('should call console.error with formatted message', () => {
      logger.error('Error message');
      
      expect(consoleErrorSpy).toHaveBeenCalled();
      const message = consoleErrorSpy.mock.calls[0][0];
      expect(message).toContain('[ERROR]');
      expect(message).toContain('Error message');
    });

    it('should pass Error object as argument', () => {
      const error = new Error('Test error');
      logger.error('An error occurred', error);
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('An error occurred'),
        error
      );
    });

    it('should call captureException for Sentry', () => {
      const error = new Error('Sentry test error');
      logger.error('Sending to Sentry', error);
      
      expect(captureException).toHaveBeenCalledWith(
        error,
        expect.objectContaining({ message: 'Sending to Sentry' })
      );
    });

    it('should create Error from message if no Error provided', () => {
      logger.error('Plain error message');
      
      expect(captureException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ message: 'Plain error message' })
      );
    });
  });

  describe('log level format', () => {
    it('should format DEBUG level correctly', () => {
      logger.debug('test');
      const message = consoleDebugSpy.mock.calls[0][0];
      expect(message).toMatch(/\[DEBUG\]/);
    });

    it('should format INFO level correctly', () => {
      logger.info('test');
      const message = consoleInfoSpy.mock.calls[0][0];
      expect(message).toMatch(/\[INFO\]/);
    });

    it('should format WARN level correctly', () => {
      logger.warn('test');
      const message = consoleWarnSpy.mock.calls[0][0];
      expect(message).toMatch(/\[WARN\]/);
    });

    it('should format ERROR level correctly', () => {
      logger.error('test');
      const message = consoleErrorSpy.mock.calls[0][0];
      expect(message).toMatch(/\[ERROR\]/);
    });
  });
});
