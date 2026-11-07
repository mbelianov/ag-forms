import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAuth, requireRole } from '../../shared/auth/authMiddleware';
import { handleError } from '../../shared/http/errorHandler';
import {
    successResponse,
    errorResponse,
    unauthorizedResponse,
    forbiddenResponse,
    conflictResponse,
    validationErrorResponse
} from '../../shared/http/responseHelpers';
import { ensureTableExists, getEntity, createEntity, updateEntity } from '../../shared/storage/tableClient';
import { validateEmailProvider } from '../../shared/validation/validation';
import { logEmailProviderSaved } from '../../shared/audit/auditService';
import {
    EMAIL_PROVIDER_PARTITION,
    USERS_TABLE,
    toEmailProviderDto,
    resolveProviderConnection,
    validateHost,
    loadMasterKey,
    encryptSecret,
    decryptSecret,
    EmailCryptoAad,
    EncryptedEmailSecret
} from '../../shared/email';
import { EmailProviderSettings, EmailProviderUpdateRequest } from '../../types';

/**
 * PUT /v1/profile/email-provider
 * Creates or updates the authenticated user's own provider settings (REQ-EML-02, REQ-EML-07).
 *
 * - Google/Yahoo: host, port and security are overwritten with the preset values.
 * - Generic: host must pass the SSRF guard.
 * - Password required on create; empty password on update keeps the stored secret.
 * - If a connection field bound as AAD changes (or the secret was written with the previous
 *   master key), the stored secret is decrypted with the OLD values and re-encrypted with the
 *   NEW values in the same write (7.3d, 7.3b).
 * - Update requires the ETag in the request body.
 */
export async function saveEmailProvider(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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

        let body: EmailProviderUpdateRequest;
        try {
            body = await request.json() as EmailProviderUpdateRequest;
        } catch {
            return errorResponse('Invalid request body', 400);
        }
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
            return errorResponse('Invalid request body', 400);
        }

        const validation = validateEmailProvider(body);
        if (!validation.valid) {
            return validationErrorResponse(validation.errors);
        }

        const provider = body.provider;
        const username = body.username.trim();
        const fromEmail = body.from_email.trim();
        if (!username) {
            return validationErrorResponse(['Username is required']);
        }

        const connection = resolveProviderConnection({
            provider,
            host: typeof body.host === 'string' ? body.host.trim().toLowerCase() : undefined,
            port: body.port !== undefined && body.port !== null ? Number(body.port) : undefined,
            security: body.security || undefined
        });

        // SSRF guard for user-supplied hosts (presets are trusted constants).
        if (provider === 'generic') {
            const hostCheck = await validateHost(connection.host);
            if (!hostCheck.allowed) {
                context.warn('Email provider host rejected by host guard for user:', user.userId);
                return validationErrorResponse(['Host is not allowed']);
            }
        }

        // Password: trimmed; internal spaces removed for Google (app passwords are shown with spaces).
        let password = typeof body.password === 'string' ? body.password.trim() : '';
        if (provider === 'google') {
            password = password.replace(/\s+/g, '');
        }

        const fromName = (body.from_name || '').trim();
        const footer = body.footer || '';
        const now = new Date().toISOString();

        const newAad: EmailCryptoAad = {
            userId: user.userId,
            provider,
            host: connection.host,
            port: connection.port,
            security: connection.security,
            username
        };

        await ensureTableExists(USERS_TABLE);
        const existing = await getEntity<EmailProviderSettings>(USERS_TABLE, EMAIL_PROVIDER_PARTITION, user.userId);

        let credentialsReplaced = false;

        if (!existing) {
            // Create: password is mandatory.
            if (!password) {
                return validationErrorResponse(['Password is required']);
            }

            const encrypted = encryptSecret(password, newAad);
            credentialsReplaced = true;

            const entity: EmailProviderSettings = {
                partitionKey: EMAIL_PROVIDER_PARTITION,
                rowKey: user.userId,
                provider,
                host: connection.host,
                port: connection.port,
                security: connection.security,
                username,
                fromEmail,
                fromName,
                footer,
                ...encrypted,
                createdAt: now,
                updatedAt: now
            };

            await createEntity(USERS_TABLE, entity);
        } else {
            if (!body.etag) {
                return errorResponse('ETag is required', 400);
            }

            const connectionChanged =
                existing.provider !== provider ||
                existing.host !== connection.host ||
                Number(existing.port) !== connection.port ||
                existing.security !== connection.security ||
                existing.username !== username;

            let encrypted: EncryptedEmailSecret | undefined;

            if (password) {
                encrypted = encryptSecret(password, newAad);
                credentialsReplaced = true;
            } else {
                // Keep the stored secret. Decrypt with the OLD connection values; re-encrypt with
                // the NEW values when the connection changed or the row uses the previous master key.
                const oldAad: EmailCryptoAad = {
                    userId: user.userId,
                    provider: existing.provider,
                    host: existing.host,
                    port: Number(existing.port),
                    security: existing.security,
                    username: existing.username
                };

                let plaintext: string | null = null;
                let keyRotated = false;
                try {
                    const result = decryptSecret(existing, oldAad);
                    plaintext = result.plaintext;
                    keyRotated = result.keyRotated;
                } catch {
                    plaintext = null;
                }

                if (connectionChanged && plaintext === null) {
                    return errorResponse('Stored password cannot be reused. Please enter the password again.', 400);
                }
                if (plaintext !== null && (connectionChanged || keyRotated)) {
                    encrypted = encryptSecret(plaintext, newAad);
                }
            }

            const entity: EmailProviderSettings = {
                ...existing,
                provider,
                host: connection.host,
                port: connection.port,
                security: connection.security,
                username,
                fromEmail,
                fromName,
                footer,
                ...(encrypted || {}),
                // A previous test result no longer describes the changed connection or secret.
                ...((connectionChanged || credentialsReplaced) ? { lastTestedAt: '', lastTestStatus: '' } : {}),
                updatedAt: now,
                etag: body.etag
            };

            try {
                await updateEntity(USERS_TABLE, entity);
            } catch (error: any) {
                if (error.message?.includes('Concurrency conflict')) {
                    return conflictResponse('Email settings were modified by another process. Please reload and retry.');
                }
                throw error;
            }
        }

        await logEmailProviderSaved(user.userId, user.username, {
            provider,
            host: connection.host,
            port: connection.port,
            security: connection.security,
            username,
            fromEmail,
            credentialsReplaced
        });

        context.log('Email provider settings saved for user:', user.userId);

        const saved = await getEntity<EmailProviderSettings>(USERS_TABLE, EMAIL_PROVIDER_PARTITION, user.userId);
        return successResponse(toEmailProviderDto(saved));
    } catch (error) {
        context.error('Error in saveEmailProvider:', error);
        return handleError(error, context);
    }
}

app.http('SaveEmailProvider', {
    methods: ['PUT'],
    authLevel: 'anonymous',
    route: 'v1/profile/email-provider',
    handler: saveEmailProvider
});

// Made with Bob
