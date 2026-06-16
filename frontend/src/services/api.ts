import axios from 'axios';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Include cookies for authentication
});

// Request interceptor for adding auth token
api.interceptors.request.use(
  (config) => {
    // Token will be sent via cookies, but can add Authorization header if needed
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for handling errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle common errors
    if (error.response?.status === 401) {
      // Unauthorized - redirect to login
      // Only redirect if not already on login page or calling auth endpoints
      const isAuthEndpoint = error.config?.url?.includes('/auth/');
      const isLoginPage = window.location.pathname === '/login';
      
      if (!isAuthEndpoint && !isLoginPage) {
        console.error('Unauthorized access - redirecting to login');
        window.location.href = '/login';
      }
    } else if (error.response?.status === 403) {
      // Forbidden
      console.error('Forbidden access');
    }
    return Promise.reject(error);
  }
);

export default api;

// Made with Bob
