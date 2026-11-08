/**
 * Email Provider Presets and Configuration Constants
 */

import { EmailProviderPreset, EmailProviderType, EmailSecurityMode } from '../../types';

export const DEFAULT_EMAIL_FOOTER = 'The examination report is attached as a PDF. This message is confidential and intended only for the addressee.';

export const EMAIL_PRESETS: Record<EmailProviderType, EmailProviderPreset> = {
    google: {
        id: 'google',
        label: 'Google (Gmail)',
        host: 'smtp.gmail.com',
        port: 587,
        security: 'starttls',
        isLocked: true
    },
    yahoo: {
        id: 'yahoo',
        label: 'Yahoo Mail',
        host: 'smtp.mail.yahoo.com',
        port: 587,
        security: 'starttls',
        isLocked: true
    },
    generic: {
        id: 'generic',
        label: 'Generic SMTP',
        host: '',
        port: 587,
        security: 'starttls',
        isLocked: false
    }
};

/**
 * Returns preset definition for a provider type
 */
export const getProviderPreset = (provider: EmailProviderType): EmailProviderPreset => {
    return EMAIL_PRESETS[provider] || EMAIL_PRESETS.generic;
};

/**
 * Ensures server-side preset enforcement: for locked providers (Google, Yahoo),
 * overwrites host, port, and security with preset values.
 */
export const resolveProviderConnection = (params: {
    provider: EmailProviderType;
    host?: string;
    port?: number;
    security?: EmailSecurityMode;
}): { host: string; port: number; security: EmailSecurityMode } => {
    const preset = getProviderPreset(params.provider);
    if (preset.isLocked) {
        return {
            host: preset.host,
            port: preset.port,
            security: preset.security
        };
    }

    return {
        host: params.host || '',
        port: params.port || 587,
        security: params.security || 'starttls'
    };
};

// Made with Bob
