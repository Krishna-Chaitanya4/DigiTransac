import { Tag, CreateTagRequest, UpdateTagRequest } from '../types/labels';
import { apiClient } from './apiClient';

// Get all tags
export async function getTags(): Promise<Tag[]> {
  return apiClient.get<Tag[]>('/tags');
}

// Get single tag
export async function getTag(id: string): Promise<Tag> {
  return apiClient.get<Tag>(`/tags/${id}`);
}

// Create tag
export async function createTag(request: CreateTagRequest): Promise<Tag> {
  return apiClient.post<Tag>('/tags', request);
}

// Update tag
export async function updateTag(id: string, request: UpdateTagRequest): Promise<Tag> {
  return apiClient.put<Tag>(`/tags/${id}`, request);
}

// Delete tag
export async function deleteTag(id: string): Promise<void> {
  return apiClient.delete<void>(`/tags/${id}`);
}

// Get transaction count for a tag
export async function getTagTransactionCount(id: string): Promise<{ transactionCount: number }> {
  return apiClient.get<{ transactionCount: number }>(`/tags/${id}/transaction-count`);
}

// Delete tag with confirmation (removes from all transactions)
export async function deleteTagConfirmed(id: string): Promise<void> {
  return apiClient.delete<void>(`/tags/${id}/confirmed`);
}
