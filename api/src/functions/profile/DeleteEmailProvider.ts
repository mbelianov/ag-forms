import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAuth, requireRole } from '../../shared/auth/authMiddleware';
import { handleError } from '../../shared/http/errorHandler';
import { successResponse, unauthorizedResponse, forbiddenResponse } from '../../shared/http/responseHelpers';
import { ensureTableExists, getEntity, deleteEntity } from '../../shared/storage/tableClient';
import { logEmailProviderDeleted } from '../../shared/audit/auditService';
import { EMAIL_PROVIDER_PARTITION, USERS_TABLE } from '../../shared/email/providerDto';
import { EmailProviderSettings } from '../../types';

/**
 * DELETE /v1/profile/email-provider
 * Hard-deletes the authenticated user's own provider row, including the encrypted secret
 * (REQ-EML-01 1.11, REQ-EML-07 INV-07). Idempotent: returns 200 when nothing is stored.
 */
export async function deleteEmailProvider(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
        const user = requireAuth(request);
        if (!user) {
            return unauthorizedResponse('Authentication required');
        }
        if (!requireRole(user, ['doctor', 'admin'])) {
            return forbiddenResponse('Doctor or admin role required');
        }

        await ensureTableExists(USERS_TABLE);

        const existing = await getEntity<EmailProviderSettings>(USERS_TABLE, EMAIL_PROVIDER_PARTITION, user.userId);

        if (existing) {
            await deleteEntity(USERS_TABLE, EMAIL_PROVIDER_PARTITION, user.userId, '*');
            await logEmailProviderDeleted(user.userId, user.username, existing.provider);
            context.log('Email provider settings removed for user:', user.userId);
        }

        return successResponse({ message: 'Email provider settings removed' });
    } catch (error) {
        context.error('Error in deleteEmailProvider:', error);
        return handleError(error, context);
    }
}

app.http('DeleteEmailProvider', {
    methods: ['DELETE'],
    authLevel: 'anonymous',
    route: 'v1/profile/email-provider',
    handler: deleteEmailProvider
});

// Made with Bob
