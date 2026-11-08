declare const describe: any;
declare const test: any;
declare const expect: any;
declare const beforeEach: any;
declare const afterEach: any;

import {
    encryptSecret,
    decryptSecret,
    loadMasterKey,
    EmailCryptoAad,
    EncryptedEmailSecret
} from '../../shared/email/emailCrypto';

describe('Email Crypto Module', () => {
    const validMasterKeyHex = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const previousMasterKeyHex = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';

    const testAad: EmailCryptoAad = {
        userId: 'user-uuid-1234',
        provider: 'google',
        host: 'smtp.gmail.com',
        port: 587,
        security: 'starttls',
        username: 'doctor@gmail.com'
    };

    let originalEnvKey: string | undefined;
    let originalPrevEnvKey: string | undefined;

    beforeEach(() => {
        originalEnvKey = process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY;
        originalPrevEnvKey = process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS;
        process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY = validMasterKeyHex;
        delete process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS;
    });

    afterEach(() => {
        if (originalEnvKey !== undefined) {
            process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY = originalEnvKey;
        } else {
            delete process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY;
        }

        if (originalPrevEnvKey !== undefined) {
            process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS = originalPrevEnvKey;
        } else {
            delete process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS;
        }
    });

    describe('loadMasterKey', () => {
        test('loads 32-byte buffer when key is valid 64-hex string', () => {
            const buf = loadMasterKey('current');
            expect(buf).toBeInstanceOf(Buffer);
            expect(buf?.length).toBe(32);
        });

        test('throws error when master key is missing', () => {
            delete process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY;
            expect(() => loadMasterKey('current')).toThrow('Email credentials encryption key is not configured');
        });

        test('throws error when master key is malformed (not 64 hex chars)', () => {
            process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY = 'tooshort';
            expect(() => loadMasterKey('current')).toThrow('Email credentials encryption key is invalid');
        });

        test('returns null when previous key is not set', () => {
            const buf = loadMasterKey('previous');
            expect(buf).toBeNull();
        });

        test('loads previous key when set and valid', () => {
            process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS = previousMasterKeyHex;
            const buf = loadMasterKey('previous');
            expect(buf).toBeInstanceOf(Buffer);
            expect(buf?.length).toBe(32);
        });
    });

    describe('encryptSecret and decryptSecret', () => {
        test('encrypts and decrypts secret correctly', () => {
            const plaintext = 'my-secret-app-password-1234';
            const encrypted = encryptSecret(plaintext, testAad);

            expect(encrypted.secretCiphertext).toBeDefined();
            expect(encrypted.secretIv).toBeDefined();
            expect(encrypted.secretAuthTag).toBeDefined();
            expect(encrypted.secretSalt).toBeDefined();
            expect(encrypted.keyVersion).toBe(1);

            const result = decryptSecret(encrypted, testAad);
            expect(result.plaintext).toBe(plaintext);
            expect(result.keyRotated).toBe(false);
        });

        test('produces different ciphertext, IV and salt for repeated saves of identical plaintext', () => {
            const plaintext = 'app-password-repeat';
            const enc1 = encryptSecret(plaintext, testAad);
            const enc2 = encryptSecret(plaintext, testAad);

            expect(enc1.secretCiphertext).not.toBe(enc2.secretCiphertext);
            expect(enc1.secretIv).not.toBe(enc2.secretIv);
            expect(enc1.secretSalt).not.toBe(enc2.secretSalt);

            expect(decryptSecret(enc1, testAad).plaintext).toBe(plaintext);
            expect(decryptSecret(enc2, testAad).plaintext).toBe(plaintext);
        });

        describe('AAD Tamper Resistance (INV-02a / TC-EMAIL-014a, TC-EMAIL-014e)', () => {
            test('fails decryption when userId is modified or copied to another user', () => {
                const encrypted = encryptSecret('secret123', testAad);
                const tamperedAad = { ...testAad, userId: 'different-user-uuid' };

                expect(() => decryptSecret(encrypted, tamperedAad)).toThrow('Failed to decrypt email credentials');
            });

            test('fails decryption when provider is modified', () => {
                const encrypted = encryptSecret('secret123', testAad);
                const tamperedAad = { ...testAad, provider: 'yahoo' };

                expect(() => decryptSecret(encrypted, tamperedAad)).toThrow('Failed to decrypt email credentials');
            });

            test('fails decryption when host is modified', () => {
                const encrypted = encryptSecret('secret123', testAad);
                const tamperedAad = { ...testAad, host: 'attacker.example.com' };

                expect(() => decryptSecret(encrypted, tamperedAad)).toThrow('Failed to decrypt email credentials');
            });

            test('fails decryption when port is modified', () => {
                const encrypted = encryptSecret('secret123', testAad);
                const tamperedAad = { ...testAad, port: 465 };

                expect(() => decryptSecret(encrypted, tamperedAad)).toThrow('Failed to decrypt email credentials');
            });

            test('fails decryption when security mode is modified', () => {
                const encrypted = encryptSecret('secret123', testAad);
                const tamperedAad = { ...testAad, security: 'ssl' };

                expect(() => decryptSecret(encrypted, tamperedAad)).toThrow('Failed to decrypt email credentials');
            });

            test('fails decryption when username is modified', () => {
                const encrypted = encryptSecret('secret123', testAad);
                const tamperedAad = { ...testAad, username: 'other@gmail.com' };

                expect(() => decryptSecret(encrypted, tamperedAad)).toThrow('Failed to decrypt email credentials');
            });

            test('fails decryption when ciphertext is tampered with', () => {
                const encrypted = encryptSecret('secret123', testAad);
                const tampered: EncryptedEmailSecret = {
                    ...encrypted,
                    secretCiphertext: encrypted.secretCiphertext.substring(0, encrypted.secretCiphertext.length - 2) + '00'
                };

                expect(() => decryptSecret(tampered, testAad)).toThrow('Failed to decrypt email credentials');
            });

            test('fails decryption when authTag is tampered with', () => {
                const encrypted = encryptSecret('secret123', testAad);
                const tampered: EncryptedEmailSecret = {
                    ...encrypted,
                    secretAuthTag: '00' + encrypted.secretAuthTag.substring(2)
                };

                expect(() => decryptSecret(tampered, testAad)).toThrow('Failed to decrypt email credentials');
            });
        });

        describe('Key Rotation (TC-EMAIL-014c)', () => {
            test('decrypts secret encrypted with previous master key and flags keyRotated: true', () => {
                // 1. Encrypt with old master key
                process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY = previousMasterKeyHex;
                const encryptedWithOldKey = encryptSecret('secret-pre-rotation', testAad);

                // 2. Rotate master key: set current to new, previous to old
                process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY = validMasterKeyHex;
                process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS = previousMasterKeyHex;

                // 3. Decrypt should succeed and report keyRotated = true
                const result = decryptSecret(encryptedWithOldKey, testAad);
                expect(result.plaintext).toBe('secret-pre-rotation');
                expect(result.keyRotated).toBe(true);
            });

            test('fails to decrypt if encrypted with old key but no previous key configured', () => {
                // 1. Encrypt with old master key
                process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY = previousMasterKeyHex;
                const encryptedWithOldKey = encryptSecret('secret-pre-rotation', testAad);

                // 2. Change master key without providing previous key
                process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY = validMasterKeyHex;
                delete process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS;

                // 3. Decrypt should fail
                expect(() => decryptSecret(encryptedWithOldKey, testAad)).toThrow('Failed to decrypt email credentials');
            });
        });
    });
});

// Made with Bob
