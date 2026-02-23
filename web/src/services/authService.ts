import { AuthResponse, ApiError, VerificationResponse } from '../types/auth';
import { API_BASE_URL, handleResponse } from './apiClient';

// Re-export for backward compatibility
export { getStoredAccessToken } from './tokenStorage';

// Wrapper to handle network errors
async function fetchWithErrorHandling(url: string, options: RequestInit): Promise<Response> {
  try {
    return await fetch(url, options);
  } catch {
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

// Step 3: Complete registration (refresh token comes back in HttpOnly cookie)
export async function completeRegistration(
  email: string, 
  verificationToken: string, 
  password: string, 
  fullName: string,
  primaryCurrency?: string
): Promise<AuthResponse> {
  const response = await fetchWithErrorHandling(`${API_BASE_URL}/auth/complete-registration`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // Required for HttpOnly cookie
    body: JSON.stringify({ email, verificationToken, password, fullName, primaryCurrency }),
  });
  return handleResponse<AuthResponse>(response);
}

// Login response that may require 2FA (refresh token in HttpOnly cookie)
export interface LoginResponse {
  accessToken?: string;
  email?: string;
  fullName?: string;
  isEmailVerified?: boolean;
  primaryCurrency?: string;
  requiresTwoFactor?: boolean;
  twoFactorToken?: string;
}

export async function login(email: string, password: string, rememberMe: boolean = false): Promise<LoginResponse> {
  const response = await fetchWithErrorHandling(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // Required for HttpOnly cookie
    body: JSON.stringify({ email, password, rememberMe }),
  });
  return handleResponse<LoginResponse>(response);
}

// Verify 2FA code during login (refresh token comes back in HttpOnly cookie)
export async function verifyTwoFactorLogin(twoFactorToken: string, code: string, rememberMe: boolean = false): Promise<AuthResponse> {
  const response = await fetchWithErrorHandling(`${API_BASE_URL}/auth/2fa/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // Required for HttpOnly cookie
    body: JSON.stringify({ twoFactorToken, code, rememberMe }),
  });
  return handleResponse<AuthResponse>(response);
}

export async function getCurrentUser(token: string): Promise<{ email: string; fullName: string; isEmailVerified: boolean; primaryCurrency: string }> {
  const response = await fetchWithErrorHandling(`${API_BASE_URL}/auth/me`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return handleResponse<{ email: string; fullName: string; isEmailVerified: boolean; primaryCurrency: string }>(response);
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

// Profile update
export async function updateName(token: string, fullName: string): Promise<{ message: string }> {
  const response = await fetchWithErrorHandling(`${API_BASE_URL}/auth/profile/name`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ fullName }),
  });
  return handleResponse<{ message: string }>(response);
}

export async function sendEmailChangeCode(token: string, newEmail: string): Promise<{ message: string }> {
  const response = await fetchWithErrorHandling(`${API_BASE_URL}/auth/profile/email/send-code`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ newEmail }),
  });
  return handleResponse<{ message: string }>(response);
}

export async function verifyEmailChange(token: string, newEmail: string, code: string): Promise<{ message: string }> {
  const response = await fetchWithErrorHandling(`${API_BASE_URL}/auth/profile/email/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ newEmail, code }),
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

// Refresh access token (refresh token is sent automatically via HttpOnly cookie)
export async function refreshToken(): Promise<AuthResponse> {
  const response = await fetchWithErrorHandling(`${API_BASE_URL}/auth/refresh-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // Required for HttpOnly cookie
  });
  return handleResponse<AuthResponse>(response);
}

// Revoke refresh token (logout from current device)
export async function revokeToken(accessToken: string): Promise<{ message: string }> {
  const response = await fetchWithErrorHandling(`${API_BASE_URL}/auth/revoke-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    credentials: 'include', // Required for HttpOnly cookie
  });
  return handleResponse<{ message: string }>(response);
}

// Revoke all refresh tokens (logout from all devices)
export async function revokeAllTokens(accessToken: string): Promise<{ message: string }> {
  const response = await fetchWithErrorHandling(`${API_BASE_URL}/auth/revoke-all-tokens`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
    credentials: 'include', // Required for HttpOnly cookie
  });
  return handleResponse<{ message: string }>(response);
}

// Two-Factor Authentication
export interface TwoFactorStatus {
  enabled: boolean;
}

export interface TwoFactorSetup {
  secret: string;
  qrCodeUri: string;
  manualEntryKey: string;
}

export async function getTwoFactorStatus(token: string): Promise<TwoFactorStatus> {
  const response = await fetchWithErrorHandling(`${API_BASE_URL}/auth/2fa/status`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return handleResponse<TwoFactorStatus>(response);
}

export async function setupTwoFactor(token: string): Promise<TwoFactorSetup> {
  const response = await fetchWithErrorHandling(`${API_BASE_URL}/auth/2fa/setup`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return handleResponse<TwoFactorSetup>(response);
}

export async function enableTwoFactor(token: string, code: string): Promise<{ message: string }> {
  const response = await fetchWithErrorHandling(`${API_BASE_URL}/auth/2fa/enable`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ code }),
  });
  return handleResponse<{ message: string }>(response);
}

export async function disableTwoFactor(token: string, password: string): Promise<{ message: string }> {
  const response = await fetchWithErrorHandling(`${API_BASE_URL}/auth/2fa/disable`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ password }),
  });
  return handleResponse<{ message: string }>(response);
}

// Send email OTP as backup for 2FA login
export async function sendTwoFactorEmailOtp(twoFactorToken: string): Promise<{ message: string }> {
  const response = await fetchWithErrorHandling(`${API_BASE_URL}/auth/2fa/send-email-code`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ twoFactorToken }),
  });
  return handleResponse<{ message: string }>(response);
}

// Verify email OTP for 2FA login (refresh token comes back in HttpOnly cookie)
export async function verifyTwoFactorEmailOtp(twoFactorToken: string, emailCode: string, rememberMe: boolean = false): Promise<AuthResponse> {
  const response = await fetchWithErrorHandling(`${API_BASE_URL}/auth/2fa/verify-email-code`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // Required for HttpOnly cookie
    body: JSON.stringify({ twoFactorToken, emailCode, rememberMe }),
  });
  return handleResponse<AuthResponse>(response);
}
