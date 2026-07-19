import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth, requireRole } from '../utils/authMiddleware';
import { handleError } from '../utils/errorHandler';
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from '../utils/responseHelpers';
import { getTableClient, ensureTableExists } from '../utils/tableClient';
import { hashPassword } from '../utils/passwordService';
import { validateUser } from '../utils/validation';
import { logUserCreated } from '../utils/auditService';
import { User } from '../types';

const USERS_TABLE = 'Users';

export async function createUser(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
        const user = requireAuth(request);
        if (!user) {
            return unauthorizedResponse('Authentication required');
        }
        if (!requireRole(user, ['admin'])) {
            return forbiddenResponse('Admin role required to create users');
        }

        interface CreateUserBody { username?: string; password?: string; fullName?: string; email?: string; role?: string; }
        const body = await request.json() as CreateUserBody;
        const { username, password, fullName, email, role } = body;

        const validation = validateUser({ username, password, fullName, email, role });
        if (!validation.valid) {
            return errorResponse(validation.errors.join(', '), 400);
        }

        const normalizedUsername = username.toLowerCase();

        await ensureTableExists(USERS_TABLE);
        const usersTable = getTableClient(USERS_TABLE);

        // Check if username already exists
        try {
            const existing = await usersTable.getEntity('USERNAME', normalizedUsername);
            if (existing) {
                return errorResponse('Username already exists', 409);
            }
        } catch (err: any) {
            if (err.statusCode !== 404 && err.details?.errorCode !== 'ResourceNotFound') {
                throw err;
            }
        }

        const userId = uuidv4();
        const passwordHash = await hashPassword(password);
        const now = new Date().toISOString();

        const userEntity: any = {
            partitionKey: 'USER',
            rowKey: userId,
            userId,
            username,
            normalizedUsername,
            passwordHash,
            fullName,
            email,
            role,
            isActive: true,
            isDeleted: false,
            failedLoginAttempts: 0,
            createdAt: now,
            updatedAt: now,
        };

        const usernameLookup = {
            partitionKey: 'USERNAME',
            rowKey: normalizedUsername,
            userId,
            username,
            createdAt: now,
        };

        await usersTable.createEntity(userEntity);
        await usersTable.createEntity(usernameLookup);

        context.log('User created by admin:', userId, username);
        await logUserCreated(user.userId, userId, username, role);

        const { passwordHash: _, failedLoginAttempts, normalizedUsername: __, isDeleted, partitionKey, rowKey, timestamp, etag, ...safeUser } = userEntity;
        return successResponse({ user: safeUser }, 201);
    } catch (error) {
        context.error('Error in createUser:', error);
        return handleError(error, context);
    }
}

app.http('CreateUser', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'v1/users',
    handler: createUser,
});

// Made with Bob
