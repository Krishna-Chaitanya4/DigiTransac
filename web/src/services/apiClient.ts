// Global API client with session expiration handling
import { getStoredAccessToken } from './tokenStorage';

const API_BASE_URL = '/api';

// Event for session expiration
export const SESSION_EXPIRED_EVENT = 'session-expired';

export function emitSessionExpired() {
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
}

export interface ApiError {
  message: string;
  status: number;
}

// Re-export for backward compatibility
export { getStoredAccessToken } from './tokenStorage';

function getAuthHeaders(): HeadersInit {
  const token = getStoredAccessToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

function getFriendlyErrorMessage(status: number): string {
  switch (status) {
    case 400:
      return 'Invalid request. Please check your input.';
    case 401:
      return 'Your session has expired. Please log in again.';
    case 403:
      return 'You do not have permission to perform this action.';
    case 404:
      return 'The requested item was not found.';
    case 409:
      return 'This item already exists.';
    case 429:
      return 'Too many requests. Please wait a moment and try again.';
    case 500:
      return 'Server error. Please try again later.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    // Handle 401 - session expired
    if (response.status === 401) {
      emitSessionExpired();
      throw new Error('Your session has expired. Please log in again.');
    }

    let errorMessage = getFriendlyErrorMessage(response.status);
    
    try {
      const error = await response.json();
      if (error.message) {
        errorMessage = error.message;
      }
    } catch {
      // Couldn't parse JSON, use status-based message
    }
    
    throw new Error(errorMessage);
  }
  
  // Handle empty responses
  const text = await response.text();
  if (!text) {
    return {} as T;
  }
  
  return JSON.parse(text);
}

// Generic API client methods
// Note: credentials: 'include' is needed for HttpOnly cookies to be sent
export const apiClient = {
  async get<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'GET',
      headers: getAuthHeaders(),
      credentials: 'include', // Include HttpOnly cookies
    });
    return handleResponse<T>(response);
  },

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include', // Include HttpOnly cookies
      body: data ? JSON.stringify(data) : undefined,
    });
    return handleResponse<T>(response);
  },

  async put<T>(endpoint: string, data: unknown): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      credentials: 'include', // Include HttpOnly cookies
      body: JSON.stringify(data),
    });
    return handleResponse<T>(response);
  },

  async delete<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      credentials: 'include', // Include HttpOnly cookies
    });
    return handleResponse<T>(response);
  },
};
