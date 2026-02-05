import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  getLabels, 
  getLabelsTree, 
  getLabel, 
  createLabel, 
  updateLabel, 
  deleteLabel, 
  reorderLabels,
  getLabelTransactionCount,
  deleteLabelWithReassignment 
} from './labelService';
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

describe('labelService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getLabels', () => {
    it('should fetch all labels', async () => {
      // Arrange
      const mockLabels = [
        { id: '1', name: 'Expenses', type: 'Folder', order: 0 },
        { id: '2', name: 'Income', type: 'Folder', order: 1 },
      ];
      vi.mocked(apiClient.get).mockResolvedValueOnce(mockLabels);

      // Act
      const result = await getLabels();

      // Assert
      expect(apiClient.get).toHaveBeenCalledWith('/labels');
      expect(result).toEqual(mockLabels);
    });

    it('should return empty array when no labels exist', async () => {
      // Arrange
      vi.mocked(apiClient.get).mockResolvedValueOnce([]);

      // Act
      const result = await getLabels();

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('getLabelsTree', () => {
    it('should fetch labels as tree structure', async () => {
      // Arrange
      const mockTree = [
        { 
          id: '1', 
          name: 'Expenses', 
          type: 'Folder', 
          order: 0, 
          children: [
            { id: '2', name: 'Food', type: 'Category', order: 0, parentId: '1', children: [] }
          ] 
        },
      ];
      vi.mocked(apiClient.get).mockResolvedValueOnce(mockTree);

      // Act
      const result = await getLabelsTree();

      // Assert
      expect(apiClient.get).toHaveBeenCalledWith('/labels/tree');
      expect(result).toEqual(mockTree);
    });
  });

  describe('getLabel', () => {
    it('should fetch single label by id', async () => {
      // Arrange
      const mockLabel = { id: '1', name: 'Expenses', type: 'Folder', order: 0 };
      vi.mocked(apiClient.get).mockResolvedValueOnce(mockLabel);

      // Act
      const result = await getLabel('1');

      // Assert
      expect(apiClient.get).toHaveBeenCalledWith('/labels/1');
      expect(result).toEqual(mockLabel);
    });
  });

  describe('createLabel', () => {
    it('should create folder label', async () => {
      // Arrange
      const request = { name: 'Expenses', type: 'Folder' as const };
      const mockLabel = { id: '1', name: 'Expenses', type: 'Folder', order: 0 };
      vi.mocked(apiClient.post).mockResolvedValueOnce(mockLabel);

      // Act
      const result = await createLabel(request);

      // Assert
      expect(apiClient.post).toHaveBeenCalledWith('/labels', request);
      expect(result).toEqual(mockLabel);
    });

    it('should create category label with parent', async () => {
      // Arrange
      const request = { name: 'Food', type: 'Category' as const, parentId: '1' };
      const mockLabel = { id: '2', name: 'Food', type: 'Category', parentId: '1', order: 0 };
      vi.mocked(apiClient.post).mockResolvedValueOnce(mockLabel);

      // Act
      const result = await createLabel(request);

      // Assert
      expect(apiClient.post).toHaveBeenCalledWith('/labels', request);
      expect(result).toEqual(mockLabel);
    });

    it('should create label with icon and color', async () => {
      // Arrange
      const request = { 
        name: 'Food', 
        type: 'Category' as const, 
        icon: '🍔', 
        color: '#FF0000' 
      };
      const mockLabel = { 
        id: '1', 
        name: 'Food', 
        type: 'Category', 
        icon: '🍔', 
        color: '#FF0000',
        order: 0 
      };
      vi.mocked(apiClient.post).mockResolvedValueOnce(mockLabel);

      // Act
      const result = await createLabel(request);

      // Assert
      expect(apiClient.post).toHaveBeenCalledWith('/labels', request);
      expect(result).toEqual(mockLabel);
    });
  });

  describe('updateLabel', () => {
    it('should update label name', async () => {
      // Arrange
      const request = { name: 'Updated Name' };
      const mockLabel = { id: '1', name: 'Updated Name', type: 'Folder', order: 0 };
      vi.mocked(apiClient.put).mockResolvedValueOnce(mockLabel);

      // Act
      const result = await updateLabel('1', request);

      // Assert
      expect(apiClient.put).toHaveBeenCalledWith('/labels/1', request);
      expect(result).toEqual(mockLabel);
    });

    it('should update label parent', async () => {
      // Arrange
      const request = { name: 'Food', parentId: '2' };
      const mockLabel = { id: '1', name: 'Food', type: 'Category', parentId: '2', order: 0 };
      vi.mocked(apiClient.put).mockResolvedValueOnce(mockLabel);

      // Act
      const result = await updateLabel('1', request);

      // Assert
      expect(apiClient.put).toHaveBeenCalledWith('/labels/1', request);
      expect(result).toEqual(mockLabel);
    });

    it('should update multiple properties', async () => {
      // Arrange
      const request = { name: 'New Name', icon: '🎉', color: '#00FF00' };
      const mockLabel = { 
        id: '1', 
        name: 'New Name', 
        type: 'Category', 
        icon: '🎉', 
        color: '#00FF00',
        order: 0 
      };
      vi.mocked(apiClient.put).mockResolvedValueOnce(mockLabel);

      // Act
      const result = await updateLabel('1', request);

      // Assert
      expect(apiClient.put).toHaveBeenCalledWith('/labels/1', request);
      expect(result).toEqual(mockLabel);
    });
  });

  describe('deleteLabel', () => {
    it('should delete label by id', async () => {
      // Arrange
      vi.mocked(apiClient.delete).mockResolvedValueOnce(undefined);

      // Act
      await deleteLabel('1');

      // Assert
      expect(apiClient.delete).toHaveBeenCalledWith('/labels/1');
    });
  });

  describe('reorderLabels', () => {
    it('should reorder labels', async () => {
      // Arrange
      const items = [
        { id: '1', order: 0 },
        { id: '2', order: 1 },
        { id: '3', order: 2 },
      ];
      vi.mocked(apiClient.post).mockResolvedValueOnce(undefined);

      // Act
      await reorderLabels(items);

      // Assert
      expect(apiClient.post).toHaveBeenCalledWith('/labels/reorder', { items });
    });

    it('should handle empty reorder list', async () => {
      // Arrange
      vi.mocked(apiClient.post).mockResolvedValueOnce(undefined);

      // Act
      await reorderLabels([]);

      // Assert
      expect(apiClient.post).toHaveBeenCalledWith('/labels/reorder', { items: [] });
    });
  });

  describe('getLabelTransactionCount', () => {
    it('should fetch transaction count for a label', async () => {
      // Arrange
      vi.mocked(apiClient.get).mockResolvedValueOnce({ transactionCount: 5 });

      // Act
      const result = await getLabelTransactionCount('1');

      // Assert
      expect(apiClient.get).toHaveBeenCalledWith('/labels/1/transaction-count');
      expect(result).toEqual({ transactionCount: 5 });
    });

    it('should return zero transaction count', async () => {
      // Arrange
      vi.mocked(apiClient.get).mockResolvedValueOnce({ transactionCount: 0 });

      // Act
      const result = await getLabelTransactionCount('1');

      // Assert
      expect(result).toEqual({ transactionCount: 0 });
    });
  });

  describe('deleteLabelWithReassignment', () => {
    it('should delete label without reassignment', async () => {
      // Arrange
      vi.mocked(apiClient.delete).mockResolvedValueOnce(undefined);

      // Act
      await deleteLabelWithReassignment('1');

      // Assert
      expect(apiClient.delete).toHaveBeenCalledWith('/labels/1/with-reassignment');
    });

    it('should delete label with reassignment to another label', async () => {
      // Arrange
      vi.mocked(apiClient.delete).mockResolvedValueOnce(undefined);

      // Act
      await deleteLabelWithReassignment('1', '2');

      // Assert
      expect(apiClient.delete).toHaveBeenCalledWith('/labels/1/with-reassignment?reassignToId=2');
    });
  });
});
