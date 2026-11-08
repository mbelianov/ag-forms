/**
 * Email Credentials Encryption and Key Derivation
 *
 * Implements REQ-EML-07 / Spec 7.3:
 * - Master key loaded from EMAIL_CREDENTIALS_ENCRYPTION_KEY (32 bytes / 64 hex chars, no fallback).
 * - Optional previous key from EMAIL_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS for rotation.
 * - Per-doctor, per-save data key derived via HKDF-SHA256.
 * - Context string: `email-provider-secret|v{keyVersion}|{userId}`.
 * - Random 16-byte salt and 12-byte IV per encryption.
 * - AES-256-GCM with connection identity bound as Additional Authenticated Data (AAD):
 *   `userId`, `provider`, `host`, `port`, `security`, `username`.
 */

import * as crypto from 'crypto';

export const CURRENT_KEY_VERSION = 1;

export interface EmailCryptoAad {
    userId: string;
    provider: string;
    host: string;
    port: number;
    security: string;
    username: string;
}

export interface EncryptedEmailSecret {
    secretCiphertext: string;
    secretIv: string;
    secretAuthTag: string;
    secretSalt: string;
    keyVersion: number;
}

export interface DecryptedEmailSecretResult {
    plaintext: string;
    keyRotated: boolean;
}

/**
 * Validates and loads a 32-byte master key from environment variables.
 * Fails closed without exposing key material.
 */
export const loadMasterKey = (type: 'current' | 'previous' = 'current'): Buffer | null => {
    const envVarName = type === 'current'
        ? 'EMAIL_CREDENTIALS_ENCRYPTION_KEY'
        : 'EMAIL_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS';

    const hexKey = process.env[envVarName]?.trim();

    if (!hexKey) {
        if (type === 'previous') {
            return null;
        }
        console.error(`[emailCrypto] ${envVarName} is missing.`);
        throw new Error('Email credentials encryption key is not configured');
    }

    if (!/^[0-9a-fA-F]{64}$/.test(hexKey)) {
        console.error(`[emailCrypto] ${envVarName} is invalid (must be 64 hexadecimal characters).`);
        throw new Error('Email credentials encryption key is invalid');
    }

    return Buffer.from(hexKey, 'hex');
};

/**
 * Produces canonical AAD string with fixed, unambiguous key ordering.
 */
export const generateAadString = (aad: EmailCryptoAad): string => {
    return JSON.stringify({
        host: aad.host,
        port: Number(aad.port),
        provider: aad.provider,
        security: aad.security,
        userId: aad.userId,
        username: aad.username
    });
};

/**
 * Derives a 32-byte data encryption key using HKDF-SHA256
 */
export const deriveDataKey = (
    masterKey: Buffer,
    salt: Buffer,
    userId: string,
    keyVersion: number
): Buffer => {
    const info = Buffer.from(`email-provider-secret|v${keyVersion}|${userId}`, 'utf8');
    return crypto.hkdfSync('sha256', masterKey, salt, info, 32) as unknown as Buffer;
};

/**
 * Encrypts an SMTP secret with AES-256-GCM and binds connection AAD.
 */
export const encryptSecret = (
    secret: string,
    aad: EmailCryptoAad,
    keyVersion: number = CURRENT_KEY_VERSION
): EncryptedEmailSecret => {
    const masterKey = loadMasterKey('current');
    if (!masterKey) {
        throw new Error('Email credentials encryption key is not configured');
    }

    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12);
    const dataKey = deriveDataKey(masterKey, salt, aad.userId, keyVersion);

    const cipher = crypto.createCipheriv('aes-256-gcm', dataKey, iv);
    const aadString = generateAadString(aad);
    cipher.setAAD(Buffer.from(aadString, 'utf8'));

    const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
        secretCiphertext: ciphertext.toString('hex'),
        secretIv: iv.toString('hex'),
        secretAuthTag: authTag.toString('hex'),
        secretSalt: salt.toString('hex'),
        keyVersion
    };
};

/**
 * Decrypts an SMTP secret and verifies AAD binding.
 * Tries current master key first, falls back to EMAIL_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS if available.
 */
export const decryptSecret = (
    encrypted: EncryptedEmailSecret,
    aad: EmailCryptoAad
): DecryptedEmailSecretResult => {
    if (
        !encrypted ||
        !encrypted.secretCiphertext ||
        !encrypted.secretIv ||
        !encrypted.secretAuthTag ||
        !encrypted.secretSalt
    ) {
        throw new Error('Invalid encrypted credentials payload');
    }

    const ciphertext = Buffer.from(encrypted.secretCiphertext, 'hex');
    const iv = Buffer.from(encrypted.secretIv, 'hex');
    const authTag = Buffer.from(encrypted.secretAuthTag, 'hex');
    const salt = Buffer.from(encrypted.secretSalt, 'hex');
    const keyVersion = encrypted.keyVersion || CURRENT_KEY_VERSION;
    const aadString = generateAadString(aad);
    const aadBuffer = Buffer.from(aadString, 'utf8');

    // 1. Try current master key
    const currentMasterKey = loadMasterKey('current');
    if (currentMasterKey) {
        try {
            const dataKey = deriveDataKey(currentMasterKey, salt, aad.userId, keyVersion);
            const decipher = crypto.createDecipheriv('aes-256-gcm', dataKey, iv);
            decipher.setAuthTag(authTag);
            decipher.setAAD(aadBuffer);

            const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
            return { plaintext, keyRotated: false };
        } catch (err) {
            // If decryption failed, try previous key if configured
        }
    }

    // 2. Try previous master key if configured
    let previousMasterKey: Buffer | null = null;
    try {
        previousMasterKey = loadMasterKey('previous');
    } catch {
        previousMasterKey = null;
    }

    if (previousMasterKey) {
        try {
            const dataKey = deriveDataKey(previousMasterKey, salt, aad.userId, keyVersion);
            const decipher = crypto.createDecipheriv('aes-256-gcm', dataKey, iv);
            decipher.setAuthTag(authTag);
            decipher.setAAD(aadBuffer);

            const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
            return { plaintext, keyRotated: true };
        } catch (err) {
            // Fall through to failure
        }
    }

    console.error('[emailCrypto] Decryption failed (integrity check or key mismatch).');
    throw new Error('Failed to decrypt email credentials');
};

// Made with Bob
