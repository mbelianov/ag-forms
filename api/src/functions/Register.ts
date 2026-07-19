import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth, requireRole } from '../utils/authMiddleware';
import { handleError } from '../utils/errorHandler';
import { successResponse, errorResponse, forbiddenResponse } from '../utils/responseHelpers';
import { getTableClient, ensureTableExists } from '../utils/tableClient';
import { hashPassword } from '../utils/passwordService';
import { validateUser } from '../utils/validation';
import { logUserCreated } from '../utils/auditService';
import { User } from '../types';

/**
 * Register a new user
 * First user can self-register as admin
 * Subsequent registrations require admin authentication
 */
export async function register(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
        // Parse request body
        interface CreateUserBody { username?: string; password?: string; fullName?: string; email?: string; role?: string; }
        const body = await request.json() as CreateUserBody;
        const { username, password, fullName, email, role } = body;

        // Validate input
        const validation = validateUser({ username, password, fullName, email, role });
        if (!validation.valid) {
            return errorResponse(validation.errors.join(', '), 400);
        }

        // Normalize username to lowercase for case-insensitive lookup
        const normalizedUsername = username.toLowerCase();

        // Extract auth token early (used for fail-fast on non-first-user requests)
        const authUser = requireAuth(request);

        // **CRITICAL: Ensure Users table exists BEFORE any queries**
        await ensureTableExists('Users');
        
        // Get table client after ensuring table exists
        const usersTable = getTableClient('Users');

        // Check if this is the first user (no admin check needed)
        let isFirstUser = false;
        try {
            // Try to find any user with PartitionKey = "USER"
            const existingUsers = usersTable.listEntities({
                queryOptions: { filter: `PartitionKey eq 'USER'` }
            });
            
            let userCount = 0;
            for await (const user of existingUsers) {
                userCount++;
                break; // We only need to know if at least one exists
            }
            
            isFirstUser = userCount === 0;
        } catch (error: any) {
            // Only treat a confirmed 404/ResourceNotFound as "table missing → first user".
            // Any other error (throttling, network, SDK exception) must fail closed with 503
            // to prevent a storage-error bypass that would grant unauthenticated admin registration.
            if (error.statusCode === 404 || error.details?.errorCode === 'ResourceNotFound') {
                context.log('Users table does not exist yet - this is the first user');
                isFirstUser = true;
            } else {
                context.log('Error checking for existing users:', error.message);
                return errorResponse('Service temporarily unavailable. Please try again.', 503);
            }
        }

        // If not first user, require admin authentication (check uses the early-extracted token)
        if (!isFirstUser) {
            if (!authUser) {
                return errorResponse('Authentication required', 401);
            }

            const hasRole = requireRole(authUser, ['admin']);
            if (!hasRole) {
                return forbiddenResponse('Admin role required to create users');
            }
        }

        // Check if username already exists
        try {
            const existingUser = await usersTable.getEntity('USERNAME', normalizedUsername);
            if (existingUser) {
                return errorResponse('Username already exists', 409);
            }
        } catch (error: any) {
            // 404 means entity not found OR table doesn't exist - both mean username is available
            if (error.statusCode === 404 || error.details?.errorCode === 'ResourceNotFound') {
                // Username is available - continue with registration
                context.log('Username is available:', normalizedUsername);
            } else {
                // Unexpected error - re-throw
                throw error;
            }
        }

        // Generate user ID
        const userId = uuidv4();

        // Hash password
        const passwordHash = await hashPassword(password);

        // Create user entity
        const now = new Date().toISOString();
        const userEntity: User & { normalizedUsername: string; isDeleted: boolean; failedLoginAttempts: number; lockedUntil?: string } = {
            partitionKey: 'USER',
            rowKey: userId,
            userId,
            username,
            normalizedUsername,
            passwordHash,
            fullName,
            email,
            role: (isFirstUser ? 'admin' : role) as 'admin' | 'doctor' | 'viewer', // First user is always admin
            isActive: true,
            isDeleted: false,
            failedLoginAttempts: 0,
            createdAt: now,
            updatedAt: now
        };

        // Create username lookup entity
        const usernameLookup = {
            partitionKey: 'USERNAME',
            rowKey: normalizedUsername,
            userId,
            username,
            createdAt: now
        };

        // Insert both entities
        await usersTable.createEntity(userEntity);
        await usersTable.createEntity(usernameLookup);

        context.log('User created:', userId, username);

        // Log audit event
        await logUserCreated(userId, userId, username, userEntity.role);

        // Return success (exclude sensitive data and map to API spec format)
        const { passwordHash: _, failedLoginAttempts, lockedUntil, normalizedUsername: __, isDeleted, partitionKey, rowKey, timestamp, etag, ...safeUser } = userEntity;
        
        // Map to API specification format
        const userResponse = {
            id: userEntity.userId,
            username: userEntity.username,
            full_name: userEntity.fullName,
            email: userEntity.email,
            role: userEntity.role
        };
        
        // By design, no token or session cookie is issued here.
        // The caller must authenticate via POST /v1/auth/login to obtain a session.
        return successResponse({
            message: 'User registered successfully. Please log in to continue.',
            user: userResponse
        }, 201);
    } catch (error) {
        context.error('Error in register:', error);
        return handleError(error, context);
    }
}

app.http('Register', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'v1/auth/register',
    handler: register
});

// Made with Bob
