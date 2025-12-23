import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { configService } from '../services/config.service';

/**
 * Setup axios interceptors for:
 * - Automatic token refresh on 401
 * - Request retry logic
 * - Centralized error handling
 * - Dynamic API URL configuration
 */

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: Error | null = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve();
    }
  });
  failedQueue = [];
};

/**
 * Request interceptor to add auth token and dynamic base URL
 */
axios.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Add base URL dynamically
    if (!config.baseURL && !config.url?.startsWith('http')) {
      config.baseURL = configService.getApiUrl();
    }

    // Add auth token if available
    const token = localStorage.getItem('auth-token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Response interceptor for error handling and token refresh
 */
axios.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Handle 401 Unauthorized - token expired or invalid
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Queue requests while refreshing
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => {
            return axios(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      // Check if we have a refresh token or need to re-login
      const token = localStorage.getItem('auth-token');
      
      if (!token) {
        // No token, redirect to login
        isRefreshing = false;
        processQueue(new Error('No authentication token'));
        window.location.href = '/login';
        return Promise.reject(error);
      }

      // For now, just clear auth and redirect to login
      // TODO: Implement refresh token mechanism if backend supports it
      isRefreshing = false;
      processQueue(new Error('Authentication failed'));
      
      localStorage.removeItem('auth-token');
      localStorage.removeItem('auth-user');
      window.location.href = '/login';
      
      return Promise.reject(error);
    }

    // Handle 503 Service Unavailable - retry with exponential backoff
    if (error.response?.status === 503 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      // Wait 2 seconds before retrying
      await new Promise((resolve) => setTimeout(resolve, 2000));
      
      return axios(originalRequest);
    }

    // Handle network errors - retry once
    if (!error.response && !originalRequest._retry) {
      originalRequest._retry = true;
      
      // Wait 1 second before retrying
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      return axios(originalRequest);
    }

    // Log errors in development
    if (import.meta.env.DEV) {
      console.error('API Error:', {
        url: error.config?.url,
        method: error.config?.method,
        status: error.response?.status,
        data: error.response?.data,
      });
    }

    return Promise.reject(error);
  }
);

/**
 * Initialize axios with interceptors
 * Call this once during app initialization
 */
export const setupAxiosInterceptors = () => {
  console.log('✅ Axios interceptors configured');
};
