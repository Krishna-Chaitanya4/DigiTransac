// Shared constants for services
export const ACCESS_TOKEN_KEY = 'digitransac_access_token';

/**
 * Get the stored access token from localStorage
 */
export function getStoredAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}
