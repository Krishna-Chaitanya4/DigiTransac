import { AuthResponse, ApiError, VerificationResponse } from '../types/auth';

const API_BASE_URL = '/api';

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = 'An unexpected error occurred';
    
    try {
      const error: ApiError = await response.json();
      errorMessage = error.message || errorMessage;
    } catch {
      // Couldn't parse JSON, use status-based message
      switch (response.status) {
        case 400:
          errorMessage = 'Invalid request. Please check your input.';
          break;
        case 401:
          errorMessage = 'Invalid credentials. Please try again.';
          break;
        case 403:
          errorMessage = 'You do not have permission to perform this action.';
          break;
        case 404:
          errorMessage = 'The requested resource was not found.';
          break;
        case 500:
          errorMessage = 'Server error. Please try again later.';
          break;
        default:
          errorMessage = `Request failed (${response.status})`;
      }
    }
    
    throw new Error(errorMessage);
  }
  return response.json();
}

// Wrapper to handle network errors
async function fetchWithErrorHandling(url: string, options: RequestInit): Promise<Response> {
  try {
    return await fetch(url, options);
  } catch (error) {
    // Network error - server is unreachable
    throw new Error('Unable to connect to server. Please check your internet connection and try again.');
  }
}

// Step 1: Send verification code to email
export async function sendVerificationCode(email: string): Promise<VerificationResponse> {
  const response = await fetchWithErrorHandling(`${API_BASE_URL}/auth/send-verification`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  });
  return handleResponse<VerificationResponse>(response);
}

// Step 2: Verify the code
export async function verifyCode(email: string, code: string): Promise<VerificationResponse> {
  const response = await fetchWithErrorHandling(`${API_BASE_URL}/auth/verify-code`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, code }),
  });
  return handleResponse<VerificationResponse>(response);
}

// Step 3: Complete registration
export async function completeRegistration(
  email: string, 
  verificationToken: string, 
  password: string, 
  fullName: string
): Promise<AuthResponse> {
  const response = await fetchWithErrorHandling(`${API_BASE_URL}/auth/complete-registration`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, verificationToken, password, fullName }),
  });
  return handleResponse<AuthResponse>(response);
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const response = await fetchWithErrorHandling(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  return handleResponse<AuthResponse>(response);
}

export async function getCurrentUser(token: string): Promise<{ email: string; fullName: string; isEmailVerified: boolean }> {
  const response = await fetchWithErrorHandling(`${API_BASE_URL}/auth/me`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return handleResponse<{ email: string; fullName: string; isEmailVerified: boolean }>(response);
}

export async function deleteAccount(token: string, password: string): Promise<{ message: string }> {
  const response = await fetchWithErrorHandling(`${API_BASE_URL}/auth/account`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ password }),
  });
  return handleResponse<{ message: string }>(response);
}

// Forgot password flow
export async function sendPasswordResetCode(email: string): Promise<VerificationResponse> {
  const response = await fetchWithErrorHandling(`${API_BASE_URL}/auth/forgot-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  });
  return handleResponse<VerificationResponse>(response);
}

export async function verifyResetCode(email: string, code: string): Promise<VerificationResponse> {
  const response = await fetchWithErrorHandling(`${API_BASE_URL}/auth/verify-reset-code`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, code }),
  });
  return handleResponse<VerificationResponse>(response);
}

export async function resetPassword(email: string, verificationToken: string, newPassword: string): Promise<{ message: string }> {
  const response = await fetchWithErrorHandling(`${API_BASE_URL}/auth/reset-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, verificationToken, newPassword }),
  });
  return handleResponse<{ message: string }>(response);
}
