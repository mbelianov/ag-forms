import api from './api';
import type { User, LoginRequest } from '../types';

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
    } catch (error: any) {
      // Return generic error message per security requirements
      const message = error.response?.data?.error?.message || error.response?.data?.error || 'Login failed. Please check your credentials.';
      throw new Error(message);
    }
  }

  /**
   * Logout current user
   */
  async logout(): Promise<void> {
    try {
      await api.post(`${this.AUTH_BASE_URL}/logout`);
    } catch (error: any) {
      // Log error but don't throw - allow logout to proceed
      console.error('Logout error:', error);
    }
  }

  /**
   * Get current authenticated user
   * @returns User object if authenticated, null otherwise
   */
  async getCurrentUser(): Promise<User | null> {
    try {
      // Interceptor unwraps the envelope; response.data is now the user object directly
      const response = await api.get<{ id: string; username: string; full_name: string; email: string; role: string; last_login?: string }>(
        `${this.AUTH_BASE_URL}/me`
      );
      const apiUser = response.data;
      return {
        id: apiUser.id,
        username: apiUser.username,
        full_name: apiUser.full_name,
        email: apiUser.email,
        role: apiUser.role as 'admin' | 'doctor' | 'viewer',
      };
    } catch (error: any) {
      // Return null if not authenticated (401) or any other error
      if (error.response?.status === 401) {
        return null;
      }
      console.error('Get current user error:', error);
      return null;
    }
  }
}

// Export singleton instance
export const authService = new AuthService();

// Made with Bob