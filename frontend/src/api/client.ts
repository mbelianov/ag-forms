import axios, { AxiosError } from 'axios';

// API base URL from environment variable or default to localhost
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:7071/api/v1';

// Create axios instance with default configuration
export const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 30000, // 30 second timeout
});

// Request interceptor to add authentication token
apiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
    (response) => {
        return response;
    },
    (error: AxiosError) => {
        // Handle 401 Unauthorized - redirect to login
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }

        // Handle network errors
        if (!error.response) {
            console.error('Network error:', error.message);
        }

        return Promise.reject(error);
    }
);

// Helper function to handle API errors
export const handleApiError = (error: unknown): string => {
    if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<{ error?: { message?: string } }>;
        
        // Return server error message if available
        if (axiosError.response?.data?.error?.message) {
            return axiosError.response.data.error.message;
        }
        
        // Return generic error based on status code
        if (axiosError.response?.status) {
            switch (axiosError.response.status) {
                case 400:
                    return 'Invalid request. Please check your input.';
                case 401:
                    return 'Unauthorized. Please log in again.';
                case 403:
                    return 'You do not have permission to perform this action.';
                case 404:
                    return 'Resource not found.';
                case 409:
                    return 'Conflict. The resource already exists.';
                case 500:
                    return 'Server error. Please try again later.';
                default:
                    return `Error: ${axiosError.response.status}`;
            }
        }
        
        // Network error
        if (axiosError.message === 'Network Error') {
            return 'Network error. Please check your connection.';
        }
        
        return axiosError.message || 'An unexpected error occurred.';
    }
    
    // Non-axios error
    if (error instanceof Error) {
        return error.message;
    }
    
    return 'An unexpected error occurred.';
};

// Made with Bob
