import { Label, LabelTree, CreateLabelRequest, UpdateLabelRequest } from '../types/labels';
import { apiClient } from './apiClient';

// Get all labels (flat list)
export async function getLabels(): Promise<Label[]> {
  return apiClient.get<Label[]>('/labels');
}

// Get labels as tree structure
export async function getLabelsTree(): Promise<LabelTree[]> {
  return apiClient.get<LabelTree[]>('/labels/tree');
}

// Get single label
export async function getLabel(id: string): Promise<Label> {
  return apiClient.get<Label>(`/labels/${id}`);
}

// Create label
export async function createLabel(request: CreateLabelRequest): Promise<Label> {
  return apiClient.post<Label>('/labels', request);
}

// Update label
export async function updateLabel(id: string, request: UpdateLabelRequest): Promise<Label> {
  return apiClient.put<Label>(`/labels/${id}`, request);
}

// Delete label
export async function deleteLabel(id: string): Promise<void> {
  return apiClient.delete<void>(`/labels/${id}`);
}

// Reorder labels
export async function reorderLabels(items: { id: string; order: number }[]): Promise<void> {
  return apiClient.post<void>('/labels/reorder', { items });
}
