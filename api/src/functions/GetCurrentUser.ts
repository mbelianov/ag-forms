import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAuth } from '../utils/authMiddleware';
import { handleError } from '../utils/errorHandler';
import { successResponse, unauthorizedResponse } from '../utils/responseHelpers';
import { getTableClient, ensureTableExists } from '../utils/tableClient';
import { User } from '../types';

/**
 * Get current authenticated user's information
 * Returns user data excluding sensitive fields
 */
export async function getCurrentUser(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
        // Extract and validate authentication
        const tokenUser = await requireAuth(request);
        if (!tokenUser) {
            return unauthorizedResponse();
        }

        context.log('Getting current user info for:', tokenUser.userId);

        // Ensure Users table exists
        await ensureTableExists('Users');
        const usersTable = getTableClient('Users');

        // Get user entity from database
        let user: User & { failedLoginAttempts?: number; lockedUntil?: string; normalizedUsername?: string; isDeleted?: boolean };
        try {
            user = await usersTable.getEntity('USER', tokenUser.userId) as any;
        } catch (error: any) {
            context.error('User entity not found for userId:', tokenUser.userId);
            return unauthorizedResponse('User not found');
        }

        // Check if user is deleted
        if (user.isDeleted) {
            context.log('Attempt to access deleted user:', tokenUser.userId);
            return unauthorizedResponse('User not found');
        }

        // Return user data (exclude sensitive fields)
        const { 
            passwordHash, 
            failedLoginAttempts, 
            lockedUntil, 
            normalizedUsername,
            isDeleted,
            ...safeUser 
        } = user;

        return successResponse({
            user: safeUser
        });
    } catch (error) {
        context.error('Error in getCurrentUser:', error);
        return handleError(error, context);
    }
}

app.http('GetCurrentUser', {
    methods: ['GET'],
    authLevel: 'function',
    route: 'v1/auth/me',
    handler: getCurrentUser
});

// Made with Bob
