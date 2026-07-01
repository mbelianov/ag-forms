import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { handleError } from '../utils/errorHandler';
import { successResponse, errorResponse } from '../utils/responseHelpers';
import { getTableClient, ensureTableExists } from '../utils/tableClient';
import { verifyPassword } from '../utils/passwordService';
import { generateToken } from '../utils/tokenService';
import { validateLogin } from '../utils/validation';
import { logUserLogin } from '../utils/auditService';
import { User } from '../types';

// Account lockout settings
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes

/**
 * User login endpoint
 * Authenticates user and issues JWT token
 * Implements brute force protection with account lockout
 */
export async function login(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
        return {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': 'http://127.0.0.1:3000',
                'Access-Control-Allow-Credentials': 'true',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Max-Age': '86400',
            }
        };
    }

    try {
        // Parse request body
        const body = await request.json() as any;
        const { username, password } = body;

        // Validate input
        const validation = validateLogin({ username, password });
        if (!validation.valid) {
            return errorResponse(validation.errors.join(', '), 400);
        }

        // Normalize username to lowercase
        const normalizedUsername = username.toLowerCase();

        // Ensure Users table exists
        await ensureTableExists('Users');
        const usersTable = getTableClient('Users');

        // Look up user by username
        let userLookup;
        try {
            userLookup = await usersTable.getEntity('USERNAME', normalizedUsername);
        } catch (error: any) {
            // User not found - return generic error message for security
            context.log('Username not found:', normalizedUsername);
            await logUserLogin('unknown', normalizedUsername, false);
            return errorResponse('Invalid credentials', 401);
        }

        const userId = userLookup.userId as string;

        // Get user entity
        let user: User & { failedLoginAttempts?: number; lockedUntil?: string; normalizedUsername?: string; isDeleted?: boolean };
        try {
            user = await usersTable.getEntity('USER', userId) as any;
        } catch (error: any) {
            context.error('User entity not found for userId:', userId);
            await logUserLogin(userId, normalizedUsername, false);
            return errorResponse('Invalid credentials', 401);
        }

        // Check if user is deleted
        if (user.isDeleted) {
            context.log('Attempt to login with deleted user:', userId);
            await logUserLogin(userId, normalizedUsername, false);
            return errorResponse('Invalid credentials', 401);
        }

        // Check if user is active
        if (!user.isActive) {
            context.log('Attempt to login with inactive user:', userId);
            await logUserLogin(userId, normalizedUsername, false);
            return errorResponse('Account is inactive', 403);
        }

        // Check if account is locked
        if (user.lockedUntil) {
            const lockoutExpiry = new Date(user.lockedUntil);
            if (lockoutExpiry > new Date()) {
                const remainingMinutes = Math.ceil((lockoutExpiry.getTime() - Date.now()) / 60000);
                context.log('Account locked:', userId, 'until', user.lockedUntil);
                await logUserLogin(userId, normalizedUsername, false);
                return errorResponse(
                    `Account is locked due to too many failed login attempts. Please try again in ${remainingMinutes} minutes.`,
                    403
                );
            } else {
                // Lockout expired, reset failed attempts
                user.failedLoginAttempts = 0;
                user.lockedUntil = undefined;
            }
        }

        // Verify password
        const isPasswordValid = await verifyPassword(password, user.passwordHash);

        if (!isPasswordValid) {
            // Increment failed login attempts
            const failedAttempts = (user.failedLoginAttempts || 0) + 1;
            user.failedLoginAttempts = failedAttempts;

            // Lock account if max attempts reached
            if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
                const lockoutExpiry = new Date(Date.now() + LOCKOUT_DURATION_MS);
                user.lockedUntil = lockoutExpiry.toISOString();
                context.log('Account locked due to failed attempts:', userId);
            }

            user.updatedAt = new Date().toISOString();

            // Update user entity with failed attempt count
            await usersTable.updateEntity(user, 'Merge');

            context.log('Invalid password for user:', userId);
            await logUserLogin(userId, normalizedUsername, false);
            return errorResponse('Invalid credentials', 401);
        }

        // Successful login - reset failed attempts
        user.failedLoginAttempts = 0;
        user.lockedUntil = undefined;
        user.lastLoginAt = new Date().toISOString();
        user.updatedAt = new Date().toISOString();

        // Update user entity — suppress non-critical update errors (e.g. ETag conflict)
        try {
            await usersTable.updateEntity(user, 'Merge');
        } catch (updateError: any) {
            // Log but don't fail login if the audit-style update doesn't persist
            context.warn?.('Non-critical: failed to update login state for user:', userId, updateError?.message);
        }

        // Generate JWT token
        const token = generateToken(user.userId, user.username, user.role);

        context.log('User logged in successfully:', userId);
        await logUserLogin(userId, user.username, true);

        // Return user data in spec-compliant format (exclude sensitive fields)
        const { passwordHash, failedLoginAttempts, lockedUntil, normalizedUsername: _, isDeleted, partitionKey, rowKey, timestamp, etag, ...safeUser } = user;
        
        // Map to API specification format
        const userResponse = {
            id: user.userId,
            username: user.username,
            full_name: user.fullName || user.username, // Fallback to username if fullName not set
            email: user.email,
            role: user.role
        };

        // Create response with Set-Cookie header and include token in body
        const response = successResponse({ token, user: userResponse });
        
        // Use Secure flag only in production (requires HTTPS)
        const isProduction = process.env.NODE_ENV === 'production';
        const secureCookie = isProduction ? 'Secure; ' : '';
        
        return {
            ...response,
            headers: {
                ...response.headers,
                'Set-Cookie': `session_token=${token}; HttpOnly; ${secureCookie}SameSite=Strict; Max-Age=28800; Path=/`
            }
        };
    } catch (error) {
        context.error('Error in login:', error);
        return handleError(error, context);
    }
}

app.http('Login', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'v1/auth/login',
    handler: login
});

// Made with Bob
