export interface AuthResponse {
  accessToken: string;
  refreshToken: string; // Kept for type compatibility, but now stored in HttpOnly cookie
  email: string;
  fullName: string;
  isEmailVerified: boolean;
  primaryCurrency: string;
}

export interface User {
  email: string;
  fullName: string;
  isEmailVerified: boolean;
  primaryCurrency: string;
}

export interface VerificationResponse {
  message: string;
  verificationToken?: string;
}

export interface ApiError {
  message: string;
}
