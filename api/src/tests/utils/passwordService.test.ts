declare const describe: any;
declare const test: any;
declare const expect: any;

import { hashPassword, verifyPassword, validatePasswordStrength, generateSecurePassword } from '../../utils/passwordService';

describe('Password Service', () => {
    describe('hashPassword', () => {
        test('should hash password successfully', async () => {
            const password = 'TestPassword123!';
            const hash = await hashPassword(password);

            expect(hash).toBeDefined();
            expect(hash).not.toBe(password);
            expect(hash.length).toBeGreaterThan(0);
        });

        test('should generate different hashes for same password', async () => {
            const password = 'TestPassword123!';
            const hash1 = await hashPassword(password);
            const hash2 = await hashPassword(password);

            expect(hash1).not.toBe(hash2);
        });
    });

    describe('verifyPassword', () => {
        test('should verify correct password', async () => {
            const password = 'TestPassword123!';
            const hash = await hashPassword(password);

            const isValid = await verifyPassword(password, hash);

            expect(isValid).toBe(true);
        });

        test('should reject incorrect password', async () => {
            const password = 'TestPassword123!';
            const hash = await hashPassword(password);

            const isValid = await verifyPassword('WrongPassword123!', hash);

            expect(isValid).toBe(false);
        });

        test('should reject malformed hash safely', async () => {
            const result = await verifyPassword('TestPassword123!', 'not-a-valid-hash');

            expect(result).toBe(false);
        });
    });

    describe('validatePasswordStrength', () => {
        test('should accept strong password', () => {
            const result = validatePasswordStrength('StrongPass123!@#');

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('should reject password without uppercase', () => {
            const result = validatePasswordStrength('weakpassword123!');

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Password must contain at least one uppercase letter');
        });

        test('should reject password without lowercase', () => {
            const result = validatePasswordStrength('WEAKPASSWORD123!');

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Password must contain at least one lowercase letter');
        });

        test('should reject password without number', () => {
            const result = validatePasswordStrength('WeakPassword!!!');

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Password must contain at least one number');
        });

        test('should reject password without special character', () => {
            const result = validatePasswordStrength('WeakPassword123');

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Password must contain at least one special character');
        });

        test('should reject short password', () => {
            const result = validatePasswordStrength('Short1!');

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Password must be at least 12 characters long');
        });

        test('should report multiple validation errors', () => {
            const result = validatePasswordStrength('short');

            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(1);
        });
    });

    describe('generateSecurePassword', () => {
        test('should generate password with default length', () => {
            const password = generateSecurePassword();

            expect(password.length).toBe(16);
            expect(validatePasswordStrength(password).valid).toBe(true);
        });

        test('should generate password with requested length', () => {
            const password = generateSecurePassword(20);

            expect(password.length).toBe(20);
            expect(validatePasswordStrength(password).valid).toBe(true);
        });

        test('should still include required character classes for minimum supported length', () => {
            const password = generateSecurePassword(12);

            expect(password.length).toBe(12);
            expect(/[A-Z]/.test(password)).toBe(true);
            expect(/[a-z]/.test(password)).toBe(true);
            expect(/[0-9]/.test(password)).toBe(true);
            expect(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)).toBe(true);
        });
    });
});

// Made with Bob
