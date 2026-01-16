export interface AuthResponse {
  token: string;
  email: string;
  fullName: string;
  isEmailVerified: boolean;
}

export interface User {
  email: string;
  fullName: string;
  isEmailVerified: boolean;
}

export interface VerificationResponse {
  message: string;
  verificationToken?: string;
}

export interface ApiError {
  message: string;
}
