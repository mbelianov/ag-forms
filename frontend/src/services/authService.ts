import api from './api';
import type { User, LoginRequest } from '../types';

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

function extractMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const r = (err as { response?: { data?: { error?: { message?: string } | string } } }).response;
    const e = r?.data?.error;
    if (typeof e === 'object' && e?.message) return e.message;
    if (typeof e === 'string') return e;
  }
  return fallback;
}

function getResponseStatus(err: unknown): number | undefined {
  if (err && typeof err === 'object' && 'response' in err) {
    return (err as { response?: { status?: number } }).response?.status;
  }
  return undefined;
}

/**
 * Authentication service for handling user authentication operations
 */
class AuthService {
  private readonly AUTH_BASE_URL = '/v1/auth';

  /**
   * Login user with username and password
   * @param username - User's username (will be converted to lowercase)
   * @param password - User's password
   * @returns User object on success
   */
  async login(username: string, password: string): Promise<User> {
    try {
      const loginData: LoginRequest = {
        username: username.toLowerCase().trim(), // Normalize username to lowercase
        password,
      };

      const response = await api.post<{ user: User }>(
        `${this.AUTH_BASE_URL}/login`,
        loginData
      );

      // Interceptor unwraps the envelope; response.data is now { user: User }
      return response.data.user;
    } catch (err) {
      // Return generic error message per security requirements
      throw new Error(extractMessage(err, 'Login failed. Please check your credentials.'), { cause: err });
    }
  }

  /**
   * Logout current user
   */
  async logout(): Promise<void> {
    try {
      await api.post(`${this.AUTH_BASE_URL}/logout`);
    } catch (err) {
      // Log error but don't throw - allow logout to proceed
      console.error('Logout error:', err);
    }
  }

  /**
   * Get current authenticated user
   * @returns User object if authenticated, null otherwise
   */
  async getCurrentUser(): Promise<User | null> {
    try {
      // Interceptor unwraps the outer envelope; response.data is now { user: {...} }
      const response = await api.get<{ user: User }>(
        `${this.AUTH_BASE_URL}/me`
      );
      return response.data.user;
    } catch (err) {
      // Return null if not authenticated (401) or any other error
      if (getResponseStatus(err) === 401) {
        return null;
      }
      console.error('Get current user error:', err);
      return null;
    }
  }

  /**
   * Change the current user's password
   * @param currentPassword - The current password
   * @param newPassword - The new password
   * @param confirmPassword - Confirmation of the new password
   */
  async changePassword(currentPassword: string, newPassword: string, confirmPassword: string): Promise<void> {
    try {
      await api.post(`${this.AUTH_BASE_URL}/change-password`, {
        currentPassword,
        newPassword,
        confirmPassword,
      });
    } catch (err) {
      if (getResponseStatus(err) === 401) {
        throw new Error('Current password is incorrect.', { cause: err });
      }
      throw new Error(extractMessage(err, 'Failed to change password'), { cause: err });
    }
  }
}

// Export singleton instance
export const authService = new AuthService();

// Made with Bob
