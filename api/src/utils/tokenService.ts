/**
 * Token Service
 * Handles JWT token generation, verification, and extraction
 */

import * as jwt from 'jsonwebtoken';
import { HttpRequest } from '@azure/functions';
import { TokenPayload } from '../types';

// JWT secret from environment or fallback for local development
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

// Token expiration time (24 hours)
const TOKEN_EXPIRATION = '24h';

/**
 * Generate a JWT token for a user
 * @param userId - User ID
 * @param username - Username
 * @param role - User role (admin, doctor, viewer)
 * @returns string - JWT token
 */
export const generateToken = (
    userId: string,
    username: string,
    role: string
): string => {
    try {
        const payload: TokenPayload = {
            userId,
            username,
            role
        };

        const token = jwt.sign(payload, JWT_SECRET, {
            expiresIn: TOKEN_EXPIRATION,
            issuer: 'ag-forms-api',
            audience: 'ag-forms-client'
        });

        return token;
    } catch (error: any) {
        throw new Error(`Failed to generate token: ${error.message}`);
    }
};

/**
 * Verify and decode a JWT token
 * @param token - JWT token to verify
 * @returns TokenPayload | null - Decoded token payload or null if invalid
 */
export const verifyToken = (token: string): TokenPayload | null => {
    try {
        const decoded = jwt.verify(token, JWT_SECRET, {
            issuer: 'ag-forms-api',
            audience: 'ag-forms-client'
        }) as TokenPayload;

        return decoded;
    } catch (error: any) {
        // Token is invalid, expired, or malformed
        return null;
    }
};

/**
 * Extract token from HTTP request
 * Checks Authorization header (Bearer token) and cookies
 * 
 * @param req - Azure Functions HTTP request
 * @returns string | null - Extracted token or null if not found
 */
export const extractTokenFromRequest = (req: HttpRequest): string | null => {
    // Check Authorization header (Bearer token)
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7); // Remove 'Bearer ' prefix
        return token;
    }

    // Check cookies
    const cookieHeader = req.headers.get('cookie');
    if (cookieHeader) {
        const cookies = parseCookies(cookieHeader);
        if (cookies.token) {
            return cookies.token;
        }
    }

    return null;
};

/**
 * Parse cookie header string into key-value pairs
 * @param cookieHeader - Cookie header string
 * @returns Record<string, string> - Parsed cookies
 */
const parseCookies = (cookieHeader: string): Record<string, string> => {
    const cookies: Record<string, string> = {};
    
    cookieHeader.split(';').forEach(cookie => {
        const [name, ...rest] = cookie.split('=');
        const value = rest.join('=').trim();
        if (name && value) {
            cookies[name.trim()] = decodeURIComponent(value);
        }
    });

    return cookies;
};

/**
 * Decode a token without verification (for debugging/logging purposes only)
 * WARNING: Do not use for authentication - always use verifyToken()
 * 
 * @param token - JWT token to decode
 * @returns TokenPayload | null - Decoded payload or null if invalid
 */
export const decodeTokenUnsafe = (token: string): TokenPayload | null => {
    try {
        const decoded = jwt.decode(token) as TokenPayload;
        return decoded;
    } catch (error) {
        return null;
    }
};

/**
 * Check if a token is expired
 * @param token - JWT token to check
 * @returns boolean - True if expired, false otherwise
 */
export const isTokenExpired = (token: string): boolean => {
    try {
        const decoded = jwt.decode(token) as TokenPayload;
        if (!decoded || !decoded.exp) {
            return true;
        }

        const currentTime = Math.floor(Date.now() / 1000);
        return decoded.exp < currentTime;
    } catch (error) {
        return true;
    }
};

/**
 * Refresh a token (generate new token with same payload but new expiration)
 * @param token - Existing JWT token
 * @returns string | null - New token or null if original token is invalid
 */
export const refreshToken = (token: string): string | null => {
    const payload = verifyToken(token);
    if (!payload) {
        return null;
    }

    return generateToken(payload.userId, payload.username, payload.role);
};

// Made with Bob
