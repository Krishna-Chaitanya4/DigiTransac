import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getTags, getTag, createTag, updateTag, deleteTag } from './tagService';
import { apiClient } from './apiClient';

// Mock apiClient
vi.mock('./apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('tagService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getTags', () => {
    it('should fetch all tags', async () => {
      // Arrange
      const mockTags = [
        { id: '1', name: 'Important', color: '#FF0000' },
        { id: '2', name: 'Recurring', color: '#00FF00' },
      ];
      vi.mocked(apiClient.get).mockResolvedValueOnce(mockTags);

      // Act
      const result = await getTags();

      // Assert
      expect(apiClient.get).toHaveBeenCalledWith('/tags');
      expect(result).toEqual(mockTags);
    });

    it('should return empty array when no tags exist', async () => {
      // Arrange
      vi.mocked(apiClient.get).mockResolvedValueOnce([]);

      // Act
      const result = await getTags();

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('getTag', () => {
    it('should fetch single tag by id', async () => {
      // Arrange
      const mockTag = { id: '1', name: 'Important', color: '#FF0000' };
      vi.mocked(apiClient.get).mockResolvedValueOnce(mockTag);

      // Act
      const result = await getTag('1');

      // Assert
      expect(apiClient.get).toHaveBeenCalledWith('/tags/1');
      expect(result).toEqual(mockTag);
    });

    it('should propagate error when tag not found', async () => {
      // Arrange
      vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('The requested item was not found.'));

      // Act & Assert
      await expect(getTag('non-existent')).rejects.toThrow('The requested item was not found.');
    });
  });

  describe('createTag', () => {
    it('should create tag with name only', async () => {
      // Arrange
      const request = { name: 'Important' };
      const mockTag = { id: '1', name: 'Important' };
      vi.mocked(apiClient.post).mockResolvedValueOnce(mockTag);

      // Act
      const result = await createTag(request);

      // Assert
      expect(apiClient.post).toHaveBeenCalledWith('/tags', request);
      expect(result).toEqual(mockTag);
    });

    it('should create tag with name and color', async () => {
      // Arrange
      const request = { name: 'Important', color: '#FF0000' };
      const mockTag = { id: '1', name: 'Important', color: '#FF0000' };
      vi.mocked(apiClient.post).mockResolvedValueOnce(mockTag);

      // Act
      const result = await createTag(request);

      // Assert
      expect(apiClient.post).toHaveBeenCalledWith('/tags', request);
      expect(result).toEqual(mockTag);
    });

    it('should propagate error for duplicate tag name', async () => {
      // Arrange
      const request = { name: 'Duplicate' };
      vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('A tag with this name already exists.'));

      // Act & Assert
      await expect(createTag(request)).rejects.toThrow('A tag with this name already exists.');
    });
  });

  describe('updateTag', () => {
    it('should update tag name', async () => {
      // Arrange
      const request = { name: 'Updated Name' };
      const mockTag = { id: '1', name: 'Updated Name' };
      vi.mocked(apiClient.put).mockResolvedValueOnce(mockTag);

      // Act
      const result = await updateTag('1', request);

      // Assert
      expect(apiClient.put).toHaveBeenCalledWith('/tags/1', request);
      expect(result).toEqual(mockTag);
    });

    it('should update tag color', async () => {
      // Arrange
      const request = { name: 'Important', color: '#00FF00' };
      const mockTag = { id: '1', name: 'Important', color: '#00FF00' };
      vi.mocked(apiClient.put).mockResolvedValueOnce(mockTag);

      // Act
      const result = await updateTag('1', request);

      // Assert
      expect(apiClient.put).toHaveBeenCalledWith('/tags/1', request);
      expect(result).toEqual(mockTag);
    });

    it('should update both name and color', async () => {
      // Arrange
      const request = { name: 'New Name', color: '#0000FF' };
      const mockTag = { id: '1', name: 'New Name', color: '#0000FF' };
      vi.mocked(apiClient.put).mockResolvedValueOnce(mockTag);

      // Act
      const result = await updateTag('1', request);

      // Assert
      expect(apiClient.put).toHaveBeenCalledWith('/tags/1', request);
      expect(result).toEqual(mockTag);
    });

    it('should propagate error for duplicate name on update', async () => {
      // Arrange
      const request = { name: 'Existing Name' };
      vi.mocked(apiClient.put).mockRejectedValueOnce(new Error('A tag with this name already exists.'));

      // Act & Assert
      await expect(updateTag('1', request)).rejects.toThrow('A tag with this name already exists.');
    });
  });

  describe('deleteTag', () => {
    it('should delete tag by id', async () => {
      // Arrange
      vi.mocked(apiClient.delete).mockResolvedValueOnce(undefined);

      // Act
      await deleteTag('1');

      // Assert
      expect(apiClient.delete).toHaveBeenCalledWith('/tags/1');
    });

    it('should propagate error when tag not found', async () => {
      // Arrange
      vi.mocked(apiClient.delete).mockRejectedValueOnce(new Error('The requested item was not found.'));

      // Act & Assert
      await expect(deleteTag('non-existent')).rejects.toThrow('The requested item was not found.');
    });
  });
});
