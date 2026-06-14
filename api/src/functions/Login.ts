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

        // Update user entity
        await usersTable.updateEntity(user, 'Merge');

        // Generate JWT token
        const token = generateToken(user.userId, user.username, user.role);

        context.log('User logged in successfully:', userId);
        await logUserLogin(userId, user.username, true);

        // Return token and user data (exclude sensitive fields)
        const { passwordHash, failedLoginAttempts, lockedUntil, normalizedUsername: _, isDeleted, ...safeUser } = user;

        return successResponse({
            token,
            user: safeUser
        });
    } catch (error) {
        context.error('Error in login:', error);
        return handleError(error, context);
    }
}

app.http('Login', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'v1/auth/login',
    handler: login
});

// Made with Bob
