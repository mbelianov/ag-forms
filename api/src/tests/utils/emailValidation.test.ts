declare const describe: any;
declare const test: any;
declare const expect: any;

import {
    validateEmailProvider,
    validateEmailReport
} from '../../shared/validation/validation';

describe('Email Validation Schemas', () => {
    describe('validateEmailProvider', () => {
        test('accepts valid Google provider settings', () => {
            const result = validateEmailProvider({
                provider: 'google',
                username: 'dr.ivanova@gmail.com',
                password: 'abcd efgh ijkl mnop',
                from_email: 'dr.ivanova@gmail.com',
                from_name: 'Dr. Maria Ivanova',
                footer: 'Clinic Name, Sofia\nTel: +359 2 123 4567'
            });

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('accepts valid Yahoo provider settings', () => {
            const result = validateEmailProvider({
                provider: 'yahoo',
                username: 'dr.ivanova@yahoo.com',
                password: 'abcdefghijklmnop',
                from_email: 'dr.ivanova@yahoo.com',
                from_name: 'Dr. Maria Ivanova'
            });

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('accepts valid Generic provider settings with explicit host, port and security', () => {
            const result = validateEmailProvider({
                provider: 'generic',
                host: 'mail.custom-clinic.bg',
                port: 587,
                security: 'starttls',
                username: 'dr.ivanova',
                password: 'smtp_api_key_secret',
                from_email: 'dr.ivanova@custom-clinic.bg',
                from_name: 'Dr. Maria Ivanova',
                footer: 'Confidential footer'
            });

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('accepts update without password (to keep existing secret)', () => {
            const result = validateEmailProvider({
                provider: 'google',
                username: 'dr.ivanova@gmail.com',
                password: '',
                from_email: 'dr.ivanova@gmail.com',
                etag: 'W/"datetime\'2026-11-07T10:00:00Z\'"'
            });

            expect(result.valid).toBe(true);
        });

        test('rejects invalid provider type', () => {
            const result = validateEmailProvider({
                provider: 'outlook',
                username: 'dr.ivanova@outlook.com',
                from_email: 'dr.ivanova@outlook.com'
            });

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Provider must be one of: google, yahoo, generic');
        });

        test('requires host, port and security for Generic provider', () => {
            const result = validateEmailProvider({
                provider: 'generic',
                username: 'dr.ivanova',
                from_email: 'dr.ivanova@custom-clinic.bg'
            });

            expect(result.valid).toBe(false);
            expect(result.errors.some((e: string) => e.includes('Host is required'))).toBe(true);
            expect(result.errors.some((e: string) => e.includes('Port is required'))).toBe(true);
            expect(result.errors.some((e: string) => e.includes('Security is required'))).toBe(true);
        });

        test('rejects generic port out of range', () => {
            const result = validateEmailProvider({
                provider: 'generic',
                host: 'mail.example.com',
                port: 70000,
                security: 'ssl',
                username: 'dr.ivanova',
                from_email: 'dr.ivanova@example.com'
            });

            expect(result.valid).toBe(false);
            expect(result.errors.some((e: string) => e.includes('Port must be between 1 and 65535'))).toBe(true);
        });

        test('rejects from_email mismatch for Google and Yahoo providers', () => {
            const googleResult = validateEmailProvider({
                provider: 'google',
                username: 'dr.ivanova@gmail.com',
                from_email: 'different.sender@gmail.com'
            });
            expect(googleResult.valid).toBe(false);
            expect(googleResult.errors).toContain('For google, from_email must match username');

            const yahooResult = validateEmailProvider({
                provider: 'yahoo',
                username: 'dr.ivanova@yahoo.com',
                from_email: 'different.sender@yahoo.com'
            });
            expect(yahooResult.valid).toBe(false);
            expect(yahooResult.errors).toContain('For yahoo, from_email must match username');
        });

        test('rejects control characters in username', () => {
            const result = validateEmailProvider({
                provider: 'google',
                username: 'dr.ivanova\x00@gmail.com',
                from_email: 'dr.ivanova\x00@gmail.com'
            });

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Username cannot contain control characters');
        });

        test('rejects line breaks in from_name', () => {
            const result = validateEmailProvider({
                provider: 'generic',
                host: 'mail.example.com',
                port: 587,
                security: 'starttls',
                username: 'user',
                from_email: 'user@example.com',
                from_name: 'Dr. Maria\r\nBcc: evil@attacker.com'
            });

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('From name cannot contain line breaks');
        });

        test('rejects footer exceeding 500 characters', () => {
            const result = validateEmailProvider({
                provider: 'google',
                username: 'dr.ivanova@gmail.com',
                from_email: 'dr.ivanova@gmail.com',
                footer: 'a'.repeat(501)
            });

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Footer must not exceed 500 characters');
        });
    });

    describe('validateEmailReport', () => {
        const samplePdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
        const validPdfBase64 = samplePdfBuffer.toString('base64');

        test('accepts valid email report payload', () => {
            const result = validateEmailReport({
                recipient_email: 'patient@example.com',
                subject: 'Examination report — Prenatal — 2026-11-07',
                message: 'Hello, please find your examination report attached.',
                file_name: 'MRN-maria-ivanova-2026-000001_2026-11-07.pdf',
                pdf_base64: validPdfBase64
            });

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('accepts payload without optional fields (recipient_email defaults to profile email server-side)', () => {
            const result = validateEmailReport({
                pdf_base64: validPdfBase64
            });

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('rejects missing or empty pdf_base64', () => {
            const result = validateEmailReport({
                recipient_email: 'patient@example.com'
            });

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('PDF data is required');
        });

        test('rejects non-base64 pdf_base64', () => {
            const result = validateEmailReport({
                pdf_base64: 'this-is-not-valid-base64!!!'
            });

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('PDF data must be valid base64 encoded string');
        });

        test('rejects base64 payload that does not start with %PDF- (REQ-EML-03 3.6 / TC-EMAIL-019)', () => {
            const nonPdfBase64 = Buffer.from('NOT A PDF FILE CONTENT').toString('base64');
            const result = validateEmailReport({
                pdf_base64: nonPdfBase64
            });

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Invalid PDF payload: must start with %PDF- header');
        });

        test('rejects PDF exceeding 10 MB limit (A-05 / TC-EMAIL-019)', () => {
            // Create a fake PDF header followed by > 10 MB payload
            const largeBuffer = Buffer.alloc(10 * 1024 * 1024 + 100);
            largeBuffer.write('%PDF-1.4');
            const largeBase64 = largeBuffer.toString('base64');

            const result = validateEmailReport({
                pdf_base64: largeBase64
            });

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('PDF size must not exceed 10 MB');
        });

        test('rejects multiple recipient addresses, commas or semicolons (REQ-EML-03 3.4 / TC-EMAIL-018)', () => {
            const commaResult = validateEmailReport({
                recipient_email: 'patient1@example.com, patient2@example.com',
                pdf_base64: validPdfBase64
            });
            expect(commaResult.valid).toBe(false);

            const semiResult = validateEmailReport({
                recipient_email: 'patient1@example.com; patient2@example.com',
                pdf_base64: validPdfBase64
            });
            expect(semiResult.valid).toBe(false);
        });

        test('rejects line breaks in recipient_email or subject (header injection protection)', () => {
            const crlfRecipient = validateEmailReport({
                recipient_email: 'patient@example.com\r\nBcc: evil@example.com',
                pdf_base64: validPdfBase64
            });
            expect(crlfRecipient.valid).toBe(false);

            const crlfSubject = validateEmailReport({
                subject: 'Exam report\r\nBcc: evil@example.com',
                pdf_base64: validPdfBase64
            });
            expect(crlfSubject.valid).toBe(false);
            expect(crlfSubject.errors).toContain('Subject cannot contain line breaks');
        });

        test('rejects subject exceeding 200 characters or message exceeding 2000 characters', () => {
            const longSubject = validateEmailReport({
                subject: 's'.repeat(201),
                pdf_base64: validPdfBase64
            });
            expect(longSubject.valid).toBe(false);
            expect(longSubject.errors).toContain('Subject must not exceed 200 characters');

            const longMessage = validateEmailReport({
                message: 'm'.repeat(2001),
                pdf_base64: validPdfBase64
            });
            expect(longMessage.valid).toBe(false);
            expect(longMessage.errors).toContain('Message must not exceed 2000 characters');
        });
    });
});

// Made with Bob
