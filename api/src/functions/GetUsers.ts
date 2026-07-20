import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAuth, requireRole } from '../utils/authMiddleware';
import { handleError } from '../utils/errorHandler';
import { successResponse, unauthorizedResponse, forbiddenResponse } from '../utils/responseHelpers';
import { ensureTableExists, getTableClient } from '../utils/tableClient';
import { User } from '../types';

const USERS_TABLE = 'Users';

export async function getUsers(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
        const user = requireAuth(request);
        if (!user) {
            return unauthorizedResponse('Authentication required');
        }
        if (!requireRole(user, ['admin'])) {
            return forbiddenResponse('Admin role required');
        }

        await ensureTableExists(USERS_TABLE);

        const tableClient = getTableClient(USERS_TABLE);
        const filter = `PartitionKey eq 'USER' and isDeleted eq false`;
        const users: Partial<User>[] = [];

        const iter = tableClient.listEntities<User>({ queryOptions: { filter } });
        for await (const entity of iter) {
            // Strip sensitive fields before returning
            const { passwordHash, partitionKey, rowKey, timestamp, etag, failedLoginAttempts, lockedUntil, normalizedUsername, ...safe } = entity as any;
            users.push(safe);
        }

        context.log('Users retrieved:', users.length);

        return successResponse({ users });
    } catch (error) {
        context.error('Error in getUsers:', error);
        return handleError(error, context);
    }
}

app.http('GetUsers', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'v1/users',
    handler: getUsers,
});

// Made with Bob
