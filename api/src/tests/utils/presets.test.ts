declare const describe: any;
declare const test: any;
declare const expect: any;

import {
    EMAIL_PRESETS,
    getProviderPreset,
    resolveProviderConnection,
    DEFAULT_EMAIL_FOOTER
} from '../../shared/email/presets';

describe('Email Provider Presets', () => {
    test('defines locked Google preset with STARTTLS on port 587 (A-01, REQ-EML-01 1.3)', () => {
        const google = EMAIL_PRESETS.google;
        expect(google).toBeDefined();
        expect(google.id).toBe('google');
        expect(google.host).toBe('smtp.gmail.com');
        expect(google.port).toBe(587);
        expect(google.security).toBe('starttls');
        expect(google.isLocked).toBe(true);
    });

    test('defines locked Yahoo preset with STARTTLS on port 587 (A-01, REQ-EML-01 1.4)', () => {
        const yahoo = EMAIL_PRESETS.yahoo;
        expect(yahoo).toBeDefined();
        expect(yahoo.id).toBe('yahoo');
        expect(yahoo.host).toBe('smtp.mail.yahoo.com');
        expect(yahoo.port).toBe(587);
        expect(yahoo.security).toBe('starttls');
        expect(yahoo.isLocked).toBe(true);
    });

    test('defines editable Generic preset (REQ-EML-01 1.5)', () => {
        const generic = EMAIL_PRESETS.generic;
        expect(generic).toBeDefined();
        expect(generic.id).toBe('generic');
        expect(generic.isLocked).toBe(false);
    });

    test('exports non-empty DEFAULT_EMAIL_FOOTER (REQ-EML-01 1.6a)', () => {
        expect(typeof DEFAULT_EMAIL_FOOTER).toBe('string');
        expect(DEFAULT_EMAIL_FOOTER.length).toBeGreaterThan(0);
        expect(DEFAULT_EMAIL_FOOTER).toContain('examination report is attached as a PDF');
    });

    describe('resolveProviderConnection (TC-EMAIL-012)', () => {
        test('overwrites host, port and security for Google preset regardless of client input', () => {
            const resolved = resolveProviderConnection({
                provider: 'google',
                host: 'evil.attacker.com',
                port: 25,
                security: 'ssl'
            });

            expect(resolved.host).toBe('smtp.gmail.com');
            expect(resolved.port).toBe(587);
            expect(resolved.security).toBe('starttls');
        });

        test('overwrites host, port and security for Yahoo preset regardless of client input', () => {
            const resolved = resolveProviderConnection({
                provider: 'yahoo',
                host: 'evil.attacker.com',
                port: 465,
                security: 'ssl'
            });

            expect(resolved.host).toBe('smtp.mail.yahoo.com');
            expect(resolved.port).toBe(587);
            expect(resolved.security).toBe('starttls');
        });

        test('preserves host, port and security for Generic provider', () => {
            const resolved = resolveProviderConnection({
                provider: 'generic',
                host: 'mail.custom-clinic.bg',
                port: 465,
                security: 'ssl'
            });

            expect(resolved.host).toBe('mail.custom-clinic.bg');
            expect(resolved.port).toBe(465);
            expect(resolved.security).toBe('ssl');
        });
    });

    describe('getProviderPreset', () => {
        test('returns corresponding preset or defaults to generic', () => {
            expect(getProviderPreset('google').id).toBe('google');
            expect(getProviderPreset('yahoo').id).toBe('yahoo');
            expect(getProviderPreset('generic').id).toBe('generic');
            expect(getProviderPreset('unknown' as any).id).toBe('generic');
        });
    });
});

// Made with Bob
