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
        const body = await request.json() as any;
        const { username, password, email, role } = body;

        // Validate input
        const validation = validateUser({ username, password, email, role });
        if (!validation.valid) {
            return errorResponse(validation.errors.join(', '), 400);
        }

        // Normalize username to lowercase for case-insensitive lookup
        const normalizedUsername = username.toLowerCase();

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
            // If table doesn't exist (404) or other error, assume first user
            if (error.statusCode === 404 || error.details?.errorCode === 'ResourceNotFound') {
                context.log('Users table does not exist yet - this is the first user');
                isFirstUser = true;
            } else {
                context.log('Error checking for existing users (assuming first user):', error.message);
                isFirstUser = true;
            }
        }

        // If not first user, require admin authentication
        if (!isFirstUser) {
            const user = await requireAuth(request);
            if (!user) {
                return errorResponse('Authentication required', 401);
            }

            const hasRole = requireRole(user, ['admin']);
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
            email,
            role: isFirstUser ? 'admin' : role, // First user is always admin
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

        // Return success (exclude sensitive data)
        const { passwordHash: _, failedLoginAttempts, lockedUntil, ...safeUser } = userEntity;
        
        return successResponse({
            message: 'User registered successfully',
            user: safeUser
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
