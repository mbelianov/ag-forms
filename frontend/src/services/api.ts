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

/**
 * Read the machine-readable code (error.code in the backend envelope, e.g. EMAIL_AUTH_FAILED)
 * from a failed request. Returns undefined for the generic 'ERROR' code.
 * Not stored on error.code itself: axios already uses that property (e.g. ERR_CANCELED).
 */
export function getApiErrorCode(err: unknown): string | undefined {
  if (err && typeof err === 'object' && 'response' in err) {
    const e = (err as { response?: { data?: { error?: { code?: unknown } | string } } }).response?.data?.error;
    if (e && typeof e === 'object' && typeof e.code === 'string' && e.code !== 'ERROR') {
      return e.code;
    }
  }
  return undefined;
}

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
    // Expose the backend error code to callers as error.apiErrorCode (error.message is untouched)
    error.apiErrorCode = getApiErrorCode(error);

    // Handle common errors
    if (error.response?.status === 401) {
      // Unauthorized - redirect to login
      // Only redirect if not already on login page or calling auth endpoints
      const isAuthEndpoint = error.config?.url?.includes('/auth/');
      const isLoginPage = window.location.pathname === '/login';

      if (!isAuthEndpoint && !isLoginPage) {
        // TASK-019: Store session-expired flag so LoginPage can show a warning
        sessionStorage.setItem('session_expired', 'true');
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
