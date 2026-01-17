import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiClient, SESSION_EXPIRED_EVENT, emitSessionExpired } from './apiClient';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('apiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('get', () => {
    it('should make GET request with auth header', async () => {
      // Arrange
      localStorage.setItem('digitransac_access_token', 'test-token');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ data: 'test' })),
      });

      // Act
      const result = await apiClient.get('/test');

      // Assert
      expect(mockFetch).toHaveBeenCalledWith('/api/test', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
        },
      });
      expect(result).toEqual({ data: 'test' });
    });

    it('should work without auth token', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ data: 'test' })),
      });

      // Act
      await apiClient.get('/test');

      // Assert
      expect(mockFetch).toHaveBeenCalledWith('/api/test', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });
  });

  describe('post', () => {
    it('should make POST request with body', async () => {
      // Arrange
      localStorage.setItem('digitransac_access_token', 'test-token');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ id: '123' })),
      });

      // Act
      const result = await apiClient.post('/items', { name: 'test' });

      // Assert
      expect(mockFetch).toHaveBeenCalledWith('/api/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
        },
        body: JSON.stringify({ name: 'test' }),
      });
      expect(result).toEqual({ id: '123' });
    });

    it('should make POST request without body', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({})),
      });

      // Act
      await apiClient.post('/action');

      // Assert
      expect(mockFetch).toHaveBeenCalledWith('/api/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: undefined,
      });
    });
  });

  describe('put', () => {
    it('should make PUT request with body', async () => {
      // Arrange
      localStorage.setItem('digitransac_access_token', 'test-token');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ updated: true })),
      });

      // Act
      const result = await apiClient.put('/items/123', { name: 'updated' });

      // Assert
      expect(mockFetch).toHaveBeenCalledWith('/api/items/123', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
        },
        body: JSON.stringify({ name: 'updated' }),
      });
      expect(result).toEqual({ updated: true });
    });
  });

  describe('delete', () => {
    it('should make DELETE request', async () => {
      // Arrange
      localStorage.setItem('digitransac_access_token', 'test-token');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(''),
      });

      // Act
      await apiClient.delete('/items/123');

      // Assert
      expect(mockFetch).toHaveBeenCalledWith('/api/items/123', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
        },
      });
    });
  });

  describe('error handling', () => {
    it('should throw user-friendly error for 400', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      // Act & Assert
      await expect(apiClient.get('/test')).rejects.toThrow('Invalid request. Please check your input.');
    });

    it('should throw user-friendly error for 403', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      // Act & Assert
      await expect(apiClient.get('/test')).rejects.toThrow('You do not have permission to perform this action.');
    });

    it('should throw user-friendly error for 404', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      // Act & Assert
      await expect(apiClient.get('/test')).rejects.toThrow('The requested item was not found.');
    });

    it('should throw user-friendly error for 500', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      // Act & Assert
      await expect(apiClient.get('/test')).rejects.toThrow('Server error. Please try again later.');
    });

    it('should use server error message if available', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ message: 'Custom error message' }),
      });

      // Act & Assert
      await expect(apiClient.get('/test')).rejects.toThrow('Custom error message');
    });

    it('should emit session expired event on 401', async () => {
      // Arrange
      const sessionExpiredHandler = vi.fn();
      window.addEventListener(SESSION_EXPIRED_EVENT, sessionExpiredHandler);
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      // Act & Assert
      await expect(apiClient.get('/test')).rejects.toThrow('Your session has expired. Please log in again.');
      expect(sessionExpiredHandler).toHaveBeenCalled();

      // Cleanup
      window.removeEventListener(SESSION_EXPIRED_EVENT, sessionExpiredHandler);
    });
  });

  describe('emitSessionExpired', () => {
    it('should dispatch session expired event', () => {
      // Arrange
      const handler = vi.fn();
      window.addEventListener(SESSION_EXPIRED_EVENT, handler);

      // Act
      emitSessionExpired();

      // Assert
      expect(handler).toHaveBeenCalled();

      // Cleanup
      window.removeEventListener(SESSION_EXPIRED_EVENT, handler);
    });
  });

  describe('empty response handling', () => {
    it('should handle empty response body', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(''),
      });

      // Act
      const result = await apiClient.delete('/items/123');

      // Assert
      expect(result).toEqual({});
    });
  });
});
