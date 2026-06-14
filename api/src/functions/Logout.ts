import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAuth } from '../utils/authMiddleware';
import { handleError } from '../utils/errorHandler';
import { successResponse, unauthorizedResponse } from '../utils/responseHelpers';
import { logUserLogout } from '../utils/auditService';

/**
 * User logout endpoint
 * Logs the logout event for audit purposes
 * Note: JWT tokens are stateless, so actual invalidation happens client-side
 * The client should discard the token after receiving this response
 */
export async function logout(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
        // Extract and validate authentication
        const user = await requireAuth(request);
        if (!user) {
            return unauthorizedResponse();
        }

        context.log('User logout:', user.userId);

        // Log audit event
        await logUserLogout(user.userId, user.username);

        return successResponse({
            message: 'Logout successful'
        });
    } catch (error) {
        context.error('Error in logout:', error);
        return handleError(error, context);
    }
}

app.http('Logout', {
    methods: ['POST'],
    authLevel: 'function',
    route: 'v1/auth/logout',
    handler: logout
});

// Made with Bob
