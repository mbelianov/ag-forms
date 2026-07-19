import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAuth } from '../utils/authMiddleware';
import { handleError } from '../utils/errorHandler';
import { successResponse, errorResponse, unauthorizedResponse } from '../utils/responseHelpers';
import { getTableClient, ensureTableExists } from '../utils/tableClient';
import { hashPassword, verifyPassword, validatePasswordStrength } from '../utils/passwordService';
import { logPasswordChanged } from '../utils/auditService';
import { User } from '../types';

/**
 * Change user password
 * Requires current password verification
 * Validates new password strength
 */
export async function changePassword(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
        // Extract and validate authentication
        const tokenUser = await requireAuth(request);
        if (!tokenUser) {
            return unauthorizedResponse();
        }

        context.log('Password change request for user:', tokenUser.userId);

        // Parse request body
        interface ChangePasswordBody { currentPassword?: string; newPassword?: string; confirmPassword?: string; }
        const body = await request.json() as ChangePasswordBody;
        const { currentPassword, newPassword, confirmPassword } = body;

        // Validate input — presence check first
        if (!currentPassword || !newPassword) {
            return errorResponse('Current password and new password are required', 400);
        }

        // Server-side confirmPassword check (cannot be bypassed by direct API callers)
        if (!confirmPassword) {
            return errorResponse('Password confirmation is required', 400);
        }
        if (newPassword !== confirmPassword) {
            return errorResponse('New password and confirmation do not match', 400);
        }

        // Validate new password strength
        const passwordValidation = validatePasswordStrength(newPassword);
        if (!passwordValidation.valid) {
            return errorResponse(passwordValidation.errors.join(', '), 400);
        }

        // Ensure Users table exists
        await ensureTableExists('Users');
        const usersTable = getTableClient('Users');

        // Get user entity
        let user: User & { failedLoginAttempts?: number; lockedUntil?: string; normalizedUsername?: string; isDeleted?: boolean };
        try {
            user = await usersTable.getEntity('USER', tokenUser.userId) as any;
        } catch (error: any) {
            context.error('User entity not found for userId:', tokenUser.userId);
            return unauthorizedResponse('User not found');
        }

        // Check if user is deleted
        if (user.isDeleted) {
            context.log('Attempt to change password for deleted user:', tokenUser.userId);
            return unauthorizedResponse('User not found');
        }

        // Verify current password
        const isCurrentPasswordValid = await verifyPassword(currentPassword, user.passwordHash);
        if (!isCurrentPasswordValid) {
            context.log('Invalid current password for user:', tokenUser.userId);
            return errorResponse('Current password is incorrect', 401);
        }

        // Check if new password is the same as the current password (using bcrypt — not plaintext)
        const isSamePassword = await verifyPassword(newPassword, user.passwordHash);
        if (isSamePassword) {
            return errorResponse('New password must be different from current password', 400);
        }

        // Hash new password
        const newPasswordHash = await hashPassword(newPassword);

        // Update user entity with new password
        user.passwordHash = newPasswordHash;
        user.updatedAt = new Date().toISOString();

        // Update password — use wildcard ETag for unconditional merge
        // (password changes are not contended: same user changing own password)
        try {
            await usersTable.updateEntity(user, 'Merge');
        } catch (error: any) {
            if (error.statusCode === 412) {
                context.error('Concurrency conflict when updating password for user:', tokenUser.userId);
                return errorResponse('Password change failed due to concurrent modification. Please try again.', 409);
            }
            throw error;
        }

        context.log('Password changed successfully for user:', tokenUser.userId);

        // Log audit event
        await logPasswordChanged(tokenUser.userId, tokenUser.username);

        return successResponse({
            message: 'Password changed successfully'
        });
    } catch (error) {
        context.error('Error in changePassword:', error);
        return handleError(error, context);
    }
}

app.http('ChangePassword', {
    methods: ['POST'],
    authLevel: 'function',
    route: 'v1/auth/change-password',
    handler: changePassword
});

// Made with Bob
