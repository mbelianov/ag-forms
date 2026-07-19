import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAuth, requireRole } from '../utils/authMiddleware';
import { handleError } from '../utils/errorHandler';
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse, notFoundResponse } from '../utils/responseHelpers';
import { getTableClient, ensureTableExists } from '../utils/tableClient';

const USERS_TABLE = 'Users';

export async function updateUser(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
        const user = requireAuth(request);
        if (!user) {
            return unauthorizedResponse('Authentication required');
        }
        if (!requireRole(user, ['admin'])) {
            return forbiddenResponse('Admin role required to update users');
        }

        const userId = request.params.id;
        if (!userId) {
            return errorResponse('User ID is required', 400);
        }

        interface UpdateUserBody { fullName?: string; role?: string; isActive?: boolean; }
        const body = await request.json() as UpdateUserBody;
        const { fullName, role, isActive } = body;

        if (role !== undefined && !['admin', 'doctor', 'viewer'].includes(role)) {
            return errorResponse('Invalid role', 400);
        }

        await ensureTableExists(USERS_TABLE);
        const usersTable = getTableClient(USERS_TABLE);

        let existing: any;
        try {
            existing = await usersTable.getEntity('USER', userId);
        } catch (err: any) {
            if (err.statusCode === 404 || err.details?.errorCode === 'ResourceNotFound') {
                return notFoundResponse('User not found');
            }
            throw err;
        }

        if (existing.isDeleted) {
            return notFoundResponse('User not found');
        }

        const updated: any = {
            ...existing,
            updatedAt: new Date().toISOString(),
        };

        if (fullName !== undefined) updated.fullName = fullName;
        if (role !== undefined) updated.role = role;
        if (isActive !== undefined) updated.isActive = isActive;

        await usersTable.updateEntity(updated, 'Merge', { etag: existing.etag || '*' });

        const { passwordHash, failedLoginAttempts, lockedUntil, normalizedUsername, isDeleted, partitionKey, rowKey, timestamp, etag, ...safeUser } = updated;
        context.log('User updated by admin:', userId);
        return successResponse({ user: safeUser });
    } catch (error) {
        context.error('Error in updateUser:', error);
        return handleError(error, context);
    }
}

app.http('UpdateUser', {
    methods: ['PUT'],
    authLevel: 'function',
    route: 'v1/users/{id}',
    handler: updateUser,
});

// Made with Bob
