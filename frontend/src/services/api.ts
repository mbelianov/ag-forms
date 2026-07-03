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

// Response interceptor — unwrap the backend's { success, data, meta } envelope
// so every service reads response.data and gets the inner payload directly.
api.interceptors.response.use(
  (response) => {
    // All successResponse() calls wrap the payload as { success: true, data: <payload>, meta: {...} }
    if (response.data && response.data.success === true && 'data' in response.data) {
      response.data = response.data.data;
    }
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
    } else if (error.response?.status === 423) {
      // Account locked — attach a human-readable message
      error.isAccountLocked = true;
      error.message = 'Account locked. Please try again in 30 minutes.';
    }
    return Promise.reject(error);
  }
);

export default api;

// Made with Bob
