/**
 * Authorization Middleware
 * Handles authentication and authorization for Azure Functions
 */

import { HttpRequest } from '@azure/functions';
import { extractTokenFromRequest, verifyToken } from './tokenService';
import { TokenPayload } from '../types';

/**
 * Require authentication for a request
 * Extracts and verifies JWT token from request
 * 
 * @param req - Azure Functions HTTP request
 * @returns TokenPayload | null - User information if authenticated, null otherwise
 */
export const requireAuth = (req: HttpRequest): TokenPayload | null => {
    // Extract token from request
    const token = extractTokenFromRequest(req);
    
    if (!token) {
        return null;
    }

    // Verify token
    const payload = verifyToken(token);
    
    if (!payload) {
        return null;
    }

    return payload;
};

/**
 * Check if user has required role
 * @param user - User token payload
 * @param allowedRoles - Array of allowed roles
 * @returns boolean - True if user has required role, false otherwise
 */
export const requireRole = (user: TokenPayload | null, allowedRoles: string[]): boolean => {
    if (!user) {
        return false;
    }

    return allowedRoles.includes(user.role);
};

/**
 * Check if user is admin
 * @param user - User token payload
 * @returns boolean - True if user is admin, false otherwise
 */
export const isAdmin = (user: TokenPayload | null): boolean => {
    return requireRole(user, ['admin']);
};

/**
 * Check if user is doctor or admin
 * @param user - User token payload
 * @returns boolean - True if user is doctor or admin, false otherwise
 */
export const isDoctor = (user: TokenPayload | null): boolean => {
    return requireRole(user, ['admin', 'doctor']);
};

/**
 * Check if user is viewer, doctor, or admin (any authenticated user)
 * @param user - User token payload
 * @returns boolean - True if user is authenticated, false otherwise
 */
export const isViewer = (user: TokenPayload | null): boolean => {
    return requireRole(user, ['admin', 'doctor', 'viewer']);
};

/**
 * Authorization result with user info and error message
 */
export interface AuthorizationResult {
    authorized: boolean;
    user: TokenPayload | null;
    message?: string;
}

/**
 * Comprehensive authorization check
 * @param req - Azure Functions HTTP request
 * @param allowedRoles - Array of allowed roles (optional, defaults to any authenticated user)
 * @returns AuthorizationResult
 */
export const authorize = (
    req: HttpRequest,
    allowedRoles?: string[]
): AuthorizationResult => {
    // Check authentication
    const user = requireAuth(req);
    
    if (!user) {
        return {
            authorized: false,
            user: null,
            message: 'Authentication required'
        };
    }

    // If no specific roles required, any authenticated user is authorized
    if (!allowedRoles || allowedRoles.length === 0) {
        return {
            authorized: true,
            user
        };
    }

    // Check authorization
    const hasRole = requireRole(user, allowedRoles);
    
    if (!hasRole) {
        return {
            authorized: false,
            user,
            message: 'Insufficient permissions'
        };
    }

    return {
        authorized: true,
        user
    };
};

/**
 * Check if user can access a specific resource
 * Admins can access all resources
 * Doctors can access their own resources
 * Viewers can only read
 * 
 * @param user - User token payload
 * @param resourceOwnerId - ID of the resource owner
 * @param operation - Operation type ('read', 'write', 'delete')
 * @returns boolean - True if user can access resource, false otherwise
 */
export const canAccessResource = (
    user: TokenPayload | null,
    resourceOwnerId: string,
    operation: 'read' | 'write' | 'delete'
): boolean => {
    if (!user) {
        return false;
    }

    // Admins can do anything
    if (user.role === 'admin') {
        return true;
    }

    // Doctors can read/write their own resources
    if (user.role === 'doctor') {
        if (operation === 'read') {
            return true; // Doctors can read all
        }
        return user.userId === resourceOwnerId; // Can only write/delete own resources
    }

    // Viewers can only read
    if (user.role === 'viewer') {
        return operation === 'read';
    }

    return false;
};

/**
 * Extract user ID from authenticated request
 * @param req - Azure Functions HTTP request
 * @returns string | null - User ID if authenticated, null otherwise
 */
export const getUserId = (req: HttpRequest): string | null => {
    const user = requireAuth(req);
    return user ? user.userId : null;
};

/**
 * Extract username from authenticated request
 * @param req - Azure Functions HTTP request
 * @returns string | null - Username if authenticated, null otherwise
 */
export const getUsername = (req: HttpRequest): string | null => {
    const user = requireAuth(req);
    return user ? user.username : null;
};

/**
 * Extract user role from authenticated request
 * @param req - Azure Functions HTTP request
 * @returns string | null - User role if authenticated, null otherwise
 */
export const getUserRole = (req: HttpRequest): string | null => {
    const user = requireAuth(req);
    return user ? user.role : null;
};

// Made with Bob
