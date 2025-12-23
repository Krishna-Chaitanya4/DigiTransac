/**
 * Environment utility for determining runtime environment
 * and constructing environment-aware URLs
 */

export type Environment = 'development' | 'production';

/**
 * Determines if the current environment is development
 * based on hostname patterns
 */
export const isDevelopmentEnvironment = (): boolean => {
  const hostname = window.location.hostname;
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    hostname.startsWith('172.')
  );
};

/**
 * Gets the current environment
 */
export const getEnvironment = (): Environment => {
  return isDevelopmentEnvironment() ? 'development' : 'production';
};

/**
 * Gets the backend API URL based on current environment
 */
export const getBackendUrl = (): string => {
  const hostname = window.location.hostname;
  const isDev = isDevelopmentEnvironment();

  if (isDev) {
    // Use environment variable if set, otherwise construct from hostname
    const envUrl = import.meta.env.VITE_API_URL;
    if (envUrl) return envUrl;

    // For localhost, use localhost:5000
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:5000';
    }

    // For local network IPs, use same hostname with backend port
    return `http://${hostname}:5000`;
  }

  // Production URL
  return 'https://digitransac-backend.nicemeadow-64e62875.centralindia.azurecontainerapps.io';
};

/**
 * Logs current environment configuration
 */
export const logEnvironmentInfo = (): void => {
  const env = getEnvironment();
  const backendUrl = getBackendUrl();
  const hostname = window.location.hostname;

  console.log('🌍 Environment Configuration:');
  console.log(`  - Environment: ${env}`);
  console.log(`  - Hostname: ${hostname}`);
  console.log(`  - Backend URL: ${backendUrl}`);
};
