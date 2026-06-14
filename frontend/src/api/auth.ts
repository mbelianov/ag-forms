import { apiClient } from './client';
import type {
    LoginRequest,
    LoginResponse,
    RegisterRequest,
    ChangePasswordRequest,
    User,
    ApiResponse,
} from '../types';

/**
 * Login user
 */
export const login = async (username: string, password: string): Promise<LoginResponse> => {
    const response = await apiClient.post<ApiResponse<LoginResponse>>('/auth/login', {
        username,
        password,
    } as LoginRequest);
    
    if (!response.data.success || !response.data.data) {
        throw new Error('Login failed');
    }
    
    return response.data.data;
};

/**
 * Register new user (admin only)
 */
export const register = async (data: RegisterRequest): Promise<User> => {
    const response = await apiClient.post<ApiResponse<User>>('/auth/register', data);
    
    if (!response.data.success || !response.data.data) {
        throw new Error('Registration failed');
    }
    
    return response.data.data;
};

/**
 * Logout current user
 */
export const logout = async (): Promise<void> => {
    await apiClient.post('/auth/logout');
};

/**
 * Get current user information
 */
export const getCurrentUser = async (): Promise<User> => {
    const response = await apiClient.get<ApiResponse<User>>('/auth/me');
    
    if (!response.data.success || !response.data.data) {
        throw new Error('Failed to get current user');
    }
    
    return response.data.data;
};

/**
 * Change password for current user
 */
export const changePassword = async (data: ChangePasswordRequest): Promise<void> => {
    const response = await apiClient.post<ApiResponse<void>>('/auth/change-password', data);
    
    if (!response.data.success) {
        throw new Error('Failed to change password');
    }
};

// Made with Bob
