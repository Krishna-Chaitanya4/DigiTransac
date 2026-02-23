// Global API client with session expiration handling and automatic token refresh
import { getStoredAccessToken, ACCESS_TOKEN_KEY } from './tokenStorage';

// Use environment variable for API URL in production, fallback to /api for development (Vite proxy)
export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Event for session expiration
export const SESSION_EXPIRED_EVENT = 'session-expired';

export function emitSessionExpired() {
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
}

export interface ApiError {
  message: string;
  status: number;
}


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

export async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    // 401 is handled by the retry logic in fetchWithAuth, not here
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
  
  // Handle empty responses (e.g., 204 No Content from DELETE endpoints)
  const text = await response.text();
  if (!text) {
    return undefined as T;
  }
  
  return JSON.parse(text);
}

// --- 401 interceptor with automatic token refresh ---
// Mutex to prevent multiple concurrent refresh attempts
let refreshPromise: Promise<string | null> | null = null;

async function doRefreshToken(): Promise<string | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // HttpOnly cookie carries the refresh token
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (data.accessToken) {
      localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
      return data.accessToken as string;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Attempt to refresh the access token exactly once.
 * Concurrent callers share a single in-flight refresh.
 * This is the ONLY refresh entry point — AuthContext must use this too.
 */
export async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = doRefreshToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/**
 * Core fetch wrapper: sends request → on 401, refreshes token → retries once.
 * Only emits session-expired if the refresh itself fails.
 */
async function fetchWithAuth<T>(
  url: string,
  init: RequestInit,
): Promise<T> {
  const response = await fetch(url, init);

  if (response.status === 401) {
    // Try refreshing the access token
    const newToken = await refreshAccessToken();
    if (newToken) {
      // Retry with the fresh token
      const retryHeaders = new Headers(init.headers);
      retryHeaders.set('Authorization', `Bearer ${newToken}`);
      const retryResponse = await fetch(url, { ...init, headers: retryHeaders });
      return handleResponse<T>(retryResponse);
    }
    // Refresh failed — session is truly expired
    emitSessionExpired();
    throw new Error('Your session has expired. Please log in again.');
  }

  return handleResponse<T>(response);
}

// Generic API client methods
// Note: credentials: 'include' is needed for HttpOnly cookies to be sent
export const apiClient = {
  async get<T>(endpoint: string): Promise<T> {
    return fetchWithAuth<T>(`${API_BASE_URL}${endpoint}`, {
      method: 'GET',
      headers: getAuthHeaders(),
      credentials: 'include',
    });
  },

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return fetchWithAuth<T>(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: data ? JSON.stringify(data) : undefined,
    });
  },

  async put<T>(endpoint: string, data: unknown): Promise<T> {
    return fetchWithAuth<T>(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(data),
    });
  },

  async delete<T>(endpoint: string): Promise<T> {
    return fetchWithAuth<T>(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      credentials: 'include',
    });
  },
};
