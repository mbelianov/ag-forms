declare const describe: any;
declare const test: any;
declare const expect: any;
declare const jest: any;

import {
    buildTransportOptions,
    buildMailMessage,
    mapSmtpError,
    sanitizeHeaderValue,
    sanitizeAddress,
    sendEmail,
    EmailSendError,
    EMAIL_FAILURE_MESSAGES,
    CONNECT_TIMEOUT_MS,
    TOTAL_TIMEOUT_MS,
    SmtpConnectionConfig
} from '../../shared/email/mailTransport';

const PASSWORD = 'super-secret-app-password';

const starttls: SmtpConnectionConfig = {
    host: 'smtp.example.com',
    port: 587,
    security: 'starttls',
    username: 'doc@example.com',
    password: PASSWORD
};

const lookupPublic = async () => ['93.184.216.34'];

const mail = {
    fromEmail: 'doc@example.com',
    fromName: 'Dr. Doc',
    to: 'patient@example.com',
    subject: 'Report',
    text: 'Hello'
};

const fakeFactory = (sendMail: any) => {
    const close = jest.fn();
    const factory = jest.fn(() => ({ sendMail, close }));
    return { factory, close };
};

const smtpError = (props: Record<string, any>) => Object.assign(new Error('provider says no'), props);

describe('mailTransport', () => {
    describe('buildTransportOptions', () => {
        test('STARTTLS requires TLS, is not implicit, and never offers plaintext', () => {
            const o: any = buildTransportOptions(starttls, '93.184.216.34');
            expect(o.secure).toBe(false);
            expect(o.requireTLS).toBe(true);
            expect(o.ignoreTLS).toBe(false);
            expect(o.opportunisticTLS).toBe(false);
        });

        test('implicit TLS uses secure and does not need requireTLS', () => {
            const o: any = buildTransportOptions({ ...starttls, port: 465, security: 'ssl' }, '93.184.216.34');
            expect(o.secure).toBe(true);
            expect(o.requireTLS).toBe(false);
            expect(o.ignoreTLS).toBe(false);
        });

        test('connects to the resolved IP and keeps the original hostname as TLS servername', () => {
            const o: any = buildTransportOptions(starttls, '93.184.216.34');
            expect(o.host).toBe('93.184.216.34');
            expect(o.tls.servername).toBe('smtp.example.com');
        });

        test('TLS >= 1.2, certificate validation on, and no override that disables it', () => {
            const o: any = buildTransportOptions(starttls, '93.184.216.34');
            expect(o.tls.minVersion).toBe('TLSv1.2');
            expect(o.tls.rejectUnauthorized).toBe(true);
            expect(JSON.stringify(o)).not.toContain('"rejectUnauthorized":false');
        });

        test('timeouts: connect 10 s, total (socket) 30 s', () => {
            const o: any = buildTransportOptions(starttls, '93.184.216.34');
            expect(CONNECT_TIMEOUT_MS).toBe(10000);
            expect(TOTAL_TIMEOUT_MS).toBe(30000);
            expect(o.connectionTimeout).toBe(10000);
            expect(o.socketTimeout).toBe(30000);
        });

        test('disables file/url access and transport logging', () => {
            const o: any = buildTransportOptions(starttls, '93.184.216.34');
            expect(o.disableFileAccess).toBe(true);
            expect(o.disableUrlAccess).toBe(true);
            expect(o.logger).toBe(false);
            expect(o.debug).toBe(false);
        });
    });

    describe('header-injection sanitisation', () => {
        test('sanitizeHeaderValue strips CR/LF and control characters', () => {
            expect(sanitizeHeaderValue('Subject\r\nBcc: evil@example.com')).toBe('Subject Bcc: evil@example.com');
            expect(sanitizeHeaderValue('a\u0000b\u007Fc')).toBe('a b c');
        });

        test('sanitizeAddress accepts one clean address', () => {
            expect(sanitizeAddress(' a@example.com ')).toBe('a@example.com');
        });

        test.each([
            'a@example.com, b@example.com',
            'a@example.com;b@example.com',
            'Name <a@example.com>',
            'no-at-sign',
            ''
        ])('sanitizeAddress rejects %p', (value: string) => {
            expect(() => sanitizeAddress(value)).toThrow(EmailSendError);
        });

        test('sanitizeAddress rejects an address with an injected header line', () => {
            expect(() => sanitizeAddress('a@example.com\r\nBcc: x@example.com')).toThrow(EmailSendError);
        });

        test('buildMailMessage cleans subject, name and filename', () => {
            const msg: any = buildMailMessage({
                ...mail,
                fromName: 'Dr. Doc\r\nBcc: evil@example.com',
                subject: 'Hi\r\nBcc: evil@example.com',
                attachments: [{ filename: 'a/b"\r\n.pdf', content: Buffer.from('%PDF-1') }]
            });
            expect(msg.subject).not.toMatch(/[\r\n]/);
            expect(msg.from.name).not.toMatch(/[\r\n]/);
            expect(msg.attachments[0].filename).not.toMatch(/[\r\n"/\\]/);
            expect(msg.attachments[0].contentType).toBe('application/pdf');
            expect(msg.to).toBe('patient@example.com');
            expect(msg.replyTo).toEqual(msg.from);
        });

        test('buildMailMessage uses the bare address when there is no display name', () => {
            const msg: any = buildMailMessage({ ...mail, fromName: '' });
            expect(msg.from).toBe('doc@example.com');
        });
    });

    describe('mapSmtpError', () => {
        test.each([
            [{ code: 'EAUTH', responseCode: 535 }, 'EMAIL_AUTH_FAILED'],
            [{ responseCode: 534 }, 'EMAIL_AUTH_FAILED'],
            [{ responseCode: 530 }, 'EMAIL_AUTH_FAILED'],
            [{ code: 'EENVELOPE', command: 'RCPT TO', responseCode: 550 }, 'EMAIL_REJECTED'],
            [{ code: 'EMESSAGE', command: 'DATA', responseCode: 552 }, 'EMAIL_REJECTED'],
            [{ command: 'MAIL FROM', responseCode: 553 }, 'EMAIL_REJECTED'],
            [{ code: 'ECONNECTION' }, 'EMAIL_CONNECTION_FAILED'],
            [{ code: 'ETIMEDOUT' }, 'EMAIL_CONNECTION_FAILED'],
            [{ code: 'ESOCKET', message: 'self-signed certificate' }, 'EMAIL_CONNECTION_FAILED'],
            [{ code: 'ETLS' }, 'EMAIL_CONNECTION_FAILED'],
            [{}, 'EMAIL_CONNECTION_FAILED']
        ])('maps %j to %s', (err: any, expected: string) => {
            expect(mapSmtpError(smtpError(err))).toBe(expected);
        });

        test('keeps the code of an existing EmailSendError', () => {
            expect(mapSmtpError(new EmailSendError('EMAIL_REJECTED'))).toBe('EMAIL_REJECTED');
        });

        test('client messages are generic', () => {
            expect(new EmailSendError('EMAIL_AUTH_FAILED').message).toBe(EMAIL_FAILURE_MESSAGES.EMAIL_AUTH_FAILED);
            expect(EMAIL_FAILURE_MESSAGES.EMAIL_CONNECTION_FAILED).toBe('Could not reach your mail server');
            expect(EMAIL_FAILURE_MESSAGES.EMAIL_REJECTED).toBe('Your mail provider rejected the message');
        });
    });

    describe('sendEmail', () => {
        test('sends through the injected factory using the resolved IP and closes the transport', async () => {
            const sendMail = jest.fn().mockResolvedValue({ accepted: ['patient@example.com'] });
            const { factory, close } = fakeFactory(sendMail);

            await sendEmail(starttls, mail, { transportFactory: factory, lookup: lookupPublic });

            expect(factory).toHaveBeenCalledTimes(1);
            const opts: any = (factory.mock.calls[0] as any[])[0];
            expect(opts.host).toBe('93.184.216.34');
            expect(opts.tls.servername).toBe('smtp.example.com');
            expect(opts.auth).toEqual({ user: 'doc@example.com', pass: PASSWORD });
            expect(sendMail).toHaveBeenCalledTimes(1);
            expect(close).toHaveBeenCalledTimes(1);
        });

        test('re-checks the host at send time and opens no connection for a private address', async () => {
            const { factory } = fakeFactory(jest.fn());
            await expect(
                sendEmail(starttls, mail, { transportFactory: factory, lookup: async () => ['10.0.0.5'] })
            ).rejects.toMatchObject({ code: 'EMAIL_CONNECTION_FAILED' });
            expect(factory).not.toHaveBeenCalled();
        });

        test('rejects a metadata address resolved for a public-looking name', async () => {
            const { factory } = fakeFactory(jest.fn());
            await expect(
                sendEmail(starttls, mail, { transportFactory: factory, lookup: async () => ['93.184.216.34', '169.254.169.254'] })
            ).rejects.toMatchObject({ code: 'EMAIL_CONNECTION_FAILED' });
            expect(factory).not.toHaveBeenCalled();
        });

        test('rejects an unresolvable host without opening a connection', async () => {
            const { factory } = fakeFactory(jest.fn());
            await expect(
                sendEmail(starttls, mail, { transportFactory: factory, lookup: async () => [] })
            ).rejects.toMatchObject({ code: 'EMAIL_CONNECTION_FAILED' });
            expect(factory).not.toHaveBeenCalled();
        });

        test('rejects an invalid recipient before any host lookup or connection', async () => {
            const { factory } = fakeFactory(jest.fn());
            const lookup = jest.fn(lookupPublic);
            await expect(
                sendEmail(starttls, { ...mail, to: 'a@example.com, b@example.com' }, { transportFactory: factory, lookup })
            ).rejects.toMatchObject({ code: 'EMAIL_REJECTED' });
            expect(lookup).not.toHaveBeenCalled();
            expect(factory).not.toHaveBeenCalled();
        });

        test('maps a provider auth failure and closes the transport', async () => {
            const sendMail = jest.fn().mockRejectedValue(smtpError({ code: 'EAUTH', responseCode: 535, response: '535 bad credentials' }));
            const { factory, close } = fakeFactory(sendMail);
            const logger = { warn: jest.fn() };

            const err: any = await sendEmail(starttls, mail, { transportFactory: factory, lookup: lookupPublic, logger }).catch((e: any) => e);

            expect(err).toBeInstanceOf(EmailSendError);
            expect(err.code).toBe('EMAIL_AUTH_FAILED');
            expect(err.message).toBe(EMAIL_FAILURE_MESSAGES.EMAIL_AUTH_FAILED);
            expect(close).toHaveBeenCalledTimes(1);
        });

        test('times out with EMAIL_CONNECTION_FAILED when the provider hangs', async () => {
            const sendMail = jest.fn(() => new Promise(() => { /* never settles */ }));
            const { factory, close } = fakeFactory(sendMail);

            await expect(
                sendEmail(starttls, mail, { transportFactory: factory, lookup: lookupPublic, totalTimeoutMs: 20, logger: { warn: jest.fn() } })
            ).rejects.toMatchObject({ code: 'EMAIL_CONNECTION_FAILED' });
            expect(close).toHaveBeenCalledTimes(1);
        });

        test('logs and throws nothing that contains the password, even if the provider echoes it', async () => {
            const sendMail = jest.fn().mockRejectedValue(
                smtpError({ code: 'EAUTH', responseCode: 535, response: `535 login ${PASSWORD} rejected`, message: `bad ${PASSWORD}` })
            );
            const { factory } = fakeFactory(sendMail);
            const logger = { warn: jest.fn() };

            const err: any = await sendEmail(starttls, mail, { transportFactory: factory, lookup: lookupPublic, logger }).catch((e: any) => e);

            const logged = JSON.stringify(logger.warn.mock.calls);
            expect(logged).not.toContain(PASSWORD);
            expect(logged).toContain('EMAIL_AUTH_FAILED');
            expect(err.message).not.toContain(PASSWORD);
            expect(JSON.stringify(err)).not.toContain(PASSWORD);
        });
    });
});

// Made with Bob
