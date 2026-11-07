import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAuth, requireRole } from '../../shared/auth/authMiddleware';
import { handleError } from '../../shared/http/errorHandler';
import { successResponse, unauthorizedResponse, forbiddenResponse } from '../../shared/http/responseHelpers';
import { ensureTableExists, getEntity } from '../../shared/storage/tableClient';
import { EMAIL_PROVIDER_PARTITION, USERS_TABLE, toEmailProviderDto } from '../../shared/email/providerDto';
import { EmailProviderSettings } from '../../types';

/**
 * GET /v1/profile/email-provider
 * Returns the authenticated user's own provider settings (REQ-EML-02).
 * The secret and all ciphertext fields are never part of the response.
 */
export async function getEmailProvider(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
        const user = requireAuth(request);
        if (!user) {
            return unauthorizedResponse('Authentication required');
        }
        if (!requireRole(user, ['doctor', 'admin'])) {
            return forbiddenResponse('Doctor or admin role required');
        }

        await ensureTableExists(USERS_TABLE);

        const entity = await getEntity<EmailProviderSettings>(USERS_TABLE, EMAIL_PROVIDER_PARTITION, user.userId);

        return successResponse(toEmailProviderDto(entity));
    } catch (error) {
        context.error('Error in getEmailProvider:', error);
        return handleError(error, context);
    }
}

app.http('GetEmailProvider', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'v1/profile/email-provider',
    handler: getEmailProvider
});

// Made with Bob
