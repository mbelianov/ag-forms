/**
 * Email provider DTO mapping
 *
 * Maps the stored EMAIL_PROVIDER entity to the public API shape (REQ-EML-02).
 * Uses an explicit allow-list of fields so that no ciphertext, IV, salt, auth tag
 * or key version can ever reach a client response.
 */

import { EmailProviderDto, EmailProviderSettings } from '../../types';

export const EMAIL_PROVIDER_PARTITION = 'EMAIL_PROVIDER';
export const USERS_TABLE = 'Users';

export const toEmailProviderDto = (entity: EmailProviderSettings | null | undefined): EmailProviderDto => {
    if (!entity) {
        return { configured: false };
    }

    return {
        configured: true,
        provider: entity.provider,
        host: entity.host,
        port: entity.port,
        security: entity.security,
        username: entity.username,
        from_email: entity.fromEmail,
        from_name: entity.fromName || '',
        footer: entity.footer || '',
        secret_set: Boolean(entity.secretCiphertext),
        last_tested_at: entity.lastTestedAt || undefined,
        last_test_status: entity.lastTestStatus || undefined,
        etag: entity.etag
    };
};

// Made with Bob
