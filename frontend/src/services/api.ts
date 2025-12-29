import axios, { AxiosError } from 'axios';
import { configService } from '../services/config.service';

/**
 * Centralized API client
 * Eliminates duplicate axios configuration and error handling
 */

const apiClient = axios.create({
  baseURL: configService.getApiUrl(),
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth-token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response.data,
  (error: AxiosError<any>) => {
    // Handle 401 Unauthorized
    if (error.response?.status === 401) {
      localStorage.removeItem('auth-token');
      localStorage.removeItem('auth-user');
      window.location.href = '/login';
    }

    // Extract error message
    const message = error.response?.data?.error || error.response?.data?.message || error.message;
    
    return Promise.reject(new Error(message));
  }
);

export { apiClient };

/**
 * Generic API methods
 */
export const api = {
  get: <T = any>(url: string, params?: any) => 
    apiClient.get<any, T>(url, { params }),
  
  post: <T = any>(url: string, data?: any) => 
    apiClient.post<any, T>(url, data),
  
  put: <T = any>(url: string, data?: any) => 
    apiClient.put<any, T>(url, data),
  
  patch: <T = any>(url: string, data?: any) => 
    apiClient.patch<any, T>(url, data),
  
  delete: <T = any>(url: string) => 
    apiClient.delete<any, T>(url),
};
