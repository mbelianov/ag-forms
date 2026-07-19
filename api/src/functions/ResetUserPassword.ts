import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAuth, requireRole } from '../utils/authMiddleware';
import { handleError } from '../utils/errorHandler';
import {
    successResponse,
    errorResponse,
    unauthorizedResponse,
    forbiddenResponse,
    notFoundResponse,
} from '../utils/responseHelpers';
import { getTableClient, ensureTableExists } from '../utils/tableClient';
import { hashPassword, validatePasswordStrength } from '../utils/passwordService';
import { logPasswordResetByAdmin } from '../utils/auditService';

const USERS_TABLE = 'Users';

export async function resetUserPassword(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
        const tokenUser = requireAuth(request);
        if (!tokenUser) {
            return unauthorizedResponse('Authentication required');
        }
        if (!requireRole(tokenUser, ['admin'])) {
            return forbiddenResponse('Admin role required to reset passwords');
        }

        const userId = request.params.id;
        if (!userId) {
            return errorResponse('User ID is required', 400);
        }

        // Guard: cannot use this endpoint on own account
        if (userId === tokenUser.userId) {
            return errorResponse('Use change-password to update your own password', 400);
        }

        // Parse and validate request body
        interface ResetPasswordBody { newPassword?: string; }
        const body = (await request.json() as ResetPasswordBody) || {};
        const { newPassword } = body;

        if (!newPassword) {
            return errorResponse('newPassword is required', 400);
        }

        const passwordValidation = validatePasswordStrength(newPassword);
        if (!passwordValidation.valid) {
            return errorResponse(passwordValidation.errors.join(', '), 400);
        }

        await ensureTableExists(USERS_TABLE);
        const usersTable = getTableClient(USERS_TABLE);

        // Fetch target user entity
        let targetUser: any;
        try {
            targetUser = await usersTable.getEntity('USER', userId);
        } catch (err: any) {
            if (err.statusCode === 404 || err.details?.errorCode === 'ResourceNotFound') {
                return notFoundResponse('User not found');
            }
            throw err;
        }

        if (targetUser.isDeleted) {
            return notFoundResponse('User not found');
        }

        // Hash the new password
        const newPasswordHash = await hashPassword(newPassword);

        // Merge: update passwordHash, clear lockout fields
        const now = new Date().toISOString();
        await usersTable.updateEntity(
            {
                partitionKey: 'USER',
                rowKey: userId,
                passwordHash: newPasswordHash,
                failedLoginAttempts: 0,
                lockedUntil: null,
                updatedAt: now,
            },
            'Merge',
            { etag: '*' }
        );

        context.log('Password reset by admin:', { targetUserId: userId, performedBy: tokenUser.userId });

        // Audit event (fire-and-forget)
        logPasswordResetByAdmin(tokenUser.userId, userId, targetUser.username).catch(() => {});

        return successResponse({ success: true });
    } catch (error) {
        context.error('Error in resetUserPassword:', error);
        return handleError(error, context);
    }
}

app.http('ResetUserPassword', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'v1/users/{id}/reset-password',
    handler: resetUserPassword,
});

// Made with Bob
