import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAuth, requireRole } from '../../shared/auth/authMiddleware';
import { handleError } from '../../shared/http/errorHandler';
import {
    successResponse,
    errorResponse,
    unauthorizedResponse,
    forbiddenResponse
} from '../../shared/http/responseHelpers';
import { ensureTableExists, getEntity, updateEntity } from '../../shared/storage/tableClient';
import { logEmailProviderTest } from '../../shared/audit/auditService';
import {
    EMAIL_PROVIDER_PARTITION,
    USERS_TABLE,
    loadMasterKey,
    encryptSecret,
    decryptSecret,
    sendEmail,
    EmailSendError,
    EmailCryptoAad,
    EncryptedEmailSecret,
    EMAIL_FAILURE_MESSAGES
} from '../../shared/email';
import { EmailProviderSettings, User } from '../../types';

const TEST_SUBJECT = 'Test email from your examination reports application';
const TEST_BODY =
    'This is a test message.\n\n' +
    'Your email settings work: the application can send examination reports through this mailbox.\n' +
    'No action is needed.';

/**
 * POST /v1/profile/email-provider/test
 * Sends a short test message from the caller's saved provider settings to the caller's own
 * account email (REQ-EML-01 1.10, REQ-EML-02, REQ-EML-05, REQ-EML-06).
 *
 * - The recipient is always `User.email` of the authenticated user; nothing is taken from the request.
 * - The secret is decrypted in memory using the AAD of the STORED row (7.3a); decryption failure
 *   returns a generic 500 and no SMTP connection is opened.
 * - Persists `lastTestedAt` / `lastTestStatus` (and re-encrypts a secret written with the previous
 *   master key, 7.3b) with a merge update guarded by the row's ETag.
 * - Provider failures return 502 with the mapped code; the audit event records only the code.
 */
export async function testEmailProvider(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
        const user = requireAuth(request);
        if (!user) {
            return unauthorizedResponse('Authentication required');
        }
        if (!requireRole(user, ['doctor', 'admin'])) {
            return forbiddenResponse('Doctor or admin role required');
        }

        // Fail closed when the master key is missing or malformed (no fallback).
        try {
            loadMasterKey('current');
        } catch {
            return errorResponse('Email settings are temporarily unavailable', 500);
        }

        await ensureTableExists(USERS_TABLE);

        const row = await getEntity<EmailProviderSettings>(USERS_TABLE, EMAIL_PROVIDER_PARTITION, user.userId);
        if (!row) {
            return errorResponse(
                'Configure your email provider in Email Settings',
                409,
                undefined,
                'EMAIL_PROVIDER_NOT_CONFIGURED'
            );
        }

        const account = await getEntity<User>(USERS_TABLE, 'USER', user.userId);
        const recipient = account?.email?.trim();
        if (!recipient) {
            return errorResponse('No account email available', 422);
        }

        // AAD comes from the stored row, never from the request.
        const aad: EmailCryptoAad = {
            userId: user.userId,
            provider: row.provider,
            host: row.host,
            port: Number(row.port),
            security: row.security,
            username: row.username
        };

        let password: string;
        let keyRotated: boolean;
        try {
            const decrypted = decryptSecret(row, aad);
            password = decrypted.plaintext;
            keyRotated = decrypted.keyRotated;
        } catch {
            context.error('Email provider secret could not be decrypted for user:', user.userId);
            return errorResponse('Email settings are temporarily unavailable', 500);
        }

        let failureCode: string | null = null;
        try {
            await sendEmail(
                {
                    host: row.host,
                    port: Number(row.port),
                    security: row.security,
                    username: row.username,
                    password
                },
                {
                    fromEmail: row.fromEmail,
                    fromName: row.fromName,
                    to: recipient,
                    subject: TEST_SUBJECT,
                    text: TEST_BODY
                },
                { logger: context }
            );
        } catch (error: any) {
            failureCode = error instanceof EmailSendError ? error.code : 'EMAIL_CONNECTION_FAILED';
        }

        // Persist the test result (merge update, ETag-guarded). The message outcome is already
        // known, so a storage problem here is logged and does not change the response.
        try {
            let rotated: Partial<EncryptedEmailSecret> = {};
            if (!failureCode && keyRotated) {
                rotated = encryptSecret(password, aad);
            }
            await updateEntity(USERS_TABLE, {
                partitionKey: EMAIL_PROVIDER_PARTITION,
                rowKey: user.userId,
                lastTestedAt: new Date().toISOString(),
                lastTestStatus: failureCode || 'success',
                ...rotated,
                etag: row.etag
            } as any);
        } catch (error: any) {
            context.warn('Could not persist email provider test result for user:', user.userId, error?.message);
        }

        await logEmailProviderTest(user.userId, user.username, failureCode || 'success');

        if (failureCode) {
            return errorResponse(
                EMAIL_FAILURE_MESSAGES[failureCode as keyof typeof EMAIL_FAILURE_MESSAGES],
                502,
                undefined,
                failureCode
            );
        }

        context.log('Email provider test succeeded for user:', user.userId);
        return successResponse({ message: 'Test email sent', recipient_email: recipient, result: 'success' });
    } catch (error) {
        context.error('Error in testEmailProvider:', error);
        return handleError(error, context);
    }
}

app.http('TestEmailProvider', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'v1/profile/email-provider/test',
    handler: testEmailProvider
});

// Made with Bob
