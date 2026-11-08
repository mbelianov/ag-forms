declare const describe: any;
declare const test: any;
declare const expect: any;
declare const jest: any;
declare const beforeEach: any;
declare const afterEach: any;
declare const beforeAll: any;
declare const afterAll: any;

import { testEmailProvider } from '../../functions/profile/TestEmailProvider';
import { saveEmailProvider } from '../../functions/profile/SaveEmailProvider';
import { createTestUser, cleanupTestData, mockHttpRequest, mockInvocationContext } from '../testUtils';
import { getTableClient } from '../../shared/storage/tableClient';
import {
    decryptSecret,
    setEmailTransportTestHooks,
    resetEmailTransportTestHooks
} from '../../shared/email';

const parseBody = (response: any) => JSON.parse(response.body);

const MASTER_KEY = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';
const OTHER_KEY = '0f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c4b5a69788796a5b4c3d2e1f0';
const PASSWORD = 'abcd efgh ijkl mnop';
const PASSWORD_STORED = 'abcdefghijklmnop'; // Google: internal spaces are removed on save

const withAuth = (token: string) => ({ cookie: `session_token=${token}` });

const googleBody = (overrides: Record<string, any> = {}) => ({
    provider: 'google',
    username: 'dr.ivanova@gmail.com',
    password: PASSWORD,
    from_email: 'dr.ivanova@gmail.com',
    from_name: 'Dr. Ivanova',
    footer: 'Clinic footer',
    ...overrides
});

const save = (token: string, body: any) =>
    saveEmailProvider(mockHttpRequest('PUT', body, withAuth(token)), mockInvocationContext());
const runTest = (token: string, body?: any, context = mockInvocationContext()) =>
    testEmailProvider(mockHttpRequest('POST', body, withAuth(token)), context);

const readRow = async (userId: string): Promise<any> =>
    getTableClient('Users').getEntity<any>('EMAIL_PROVIDER', userId);

const listAudit = async (action: string): Promise<any[]> => {
    const rows: any[] = [];
    for await (const entity of getTableClient('AuditLogs').listEntities({ queryOptions: { filter: `action eq '${action}'` } })) {
        rows.push(entity);
    }
    return rows;
};

const publicLookup = async () => ['93.184.216.34'];

const installFakeTransport = (sendMail: any, lookup: any = publicLookup) => {
    const close = jest.fn();
    const factory = jest.fn(() => ({ sendMail, close }));
    setEmailTransportTestHooks({ transportFactory: factory as any, lookup });
    return { factory, close, sendMail };
};

const smtpError = (props: Record<string, any>) => Object.assign(new Error('provider says no'), props);

describe('POST /v1/profile/email-provider/test (fake transport, no network)', () => {
    let originalKey: string | undefined;
    let originalPrevKey: string | undefined;

    beforeAll(() => {
        originalKey = process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY;
        originalPrevKey = process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS;
    });

    afterAll(() => {
        if (originalKey === undefined) delete process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY;
        else process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY = originalKey;
        if (originalPrevKey === undefined) delete process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS;
        else process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS = originalPrevKey;
    });

    beforeEach(async () => {
        process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY = MASTER_KEY;
        delete process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS;
        await cleanupTestData();
    });

    afterEach(async () => {
        resetEmailTransportTestHooks();
        await cleanupTestData();
    });

    describe('authentication and authorization', () => {
        test('unauthenticated request — 401', async () => {
            const res = await testEmailProvider(mockHttpRequest('POST'), mockInvocationContext());
            expect(res.status).toBe(401);
        });

        test('viewer — 403 and no connection is opened', async () => {
            const { token } = await createTestUser('viewer');
            const { factory } = installFakeTransport(jest.fn());
            const res = await runTest(token);
            expect(res.status).toBe(403);
            expect(factory).not.toHaveBeenCalled();
        });
    });

    describe('preconditions', () => {
        test('no saved settings — 409 EMAIL_PROVIDER_NOT_CONFIGURED', async () => {
            const { token } = await createTestUser('doctor');
            const { factory } = installFakeTransport(jest.fn());
            const res = await runTest(token);
            expect(res.status).toBe(409);
            expect(parseBody(res).error.code).toBe('EMAIL_PROVIDER_NOT_CONFIGURED');
            expect(factory).not.toHaveBeenCalled();
        });

        test('missing master key — generic 500 without key name, no connection', async () => {
            const { token } = await createTestUser('doctor');
            await save(token, googleBody());
            delete process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY;
            const { factory } = installFakeTransport(jest.fn());

            const res = await runTest(token);

            expect(res.status).toBe(500);
            expect(res.body).not.toContain('EMAIL_CREDENTIALS_ENCRYPTION_KEY');
            expect(factory).not.toHaveBeenCalled();
        });

        test('tampered stored host — decryption fails, generic 500, no connection', async () => {
            const { user, token } = await createTestUser('doctor');
            await save(token, googleBody());
            await getTableClient('Users').updateEntity(
                { partitionKey: 'EMAIL_PROVIDER', rowKey: user.userId, host: 'smtp.evil.example.com' },
                'Merge'
            );
            const { factory } = installFakeTransport(jest.fn());

            const res = await runTest(token);

            expect(res.status).toBe(500);
            expect(res.body).not.toContain('evil');
            expect(factory).not.toHaveBeenCalled();
        });
    });

    describe('success', () => {
        test('sends to the doctor\'s own account email using the decrypted secret and the resolved IP', async () => {
            const { user, token } = await createTestUser('doctor');
            await save(token, googleBody());
            const { factory, close, sendMail } = installFakeTransport(jest.fn().mockResolvedValue({ accepted: [user.email] }));

            const res = await runTest(token);
            const body = parseBody(res);

            expect(res.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.recipient_email).toBe(user.email);

            const opts: any = (factory.mock.calls[0] as any[])[0];
            expect(opts.host).toBe('93.184.216.34');
            expect(opts.port).toBe(587);
            expect(opts.requireTLS).toBe(true);
            expect(opts.secure).toBe(false);
            expect(opts.tls.servername).toBe('smtp.gmail.com');
            expect(opts.tls.minVersion).toBe('TLSv1.2');
            expect(opts.tls.rejectUnauthorized).toBe(true);
            expect(opts.auth).toEqual({ user: 'dr.ivanova@gmail.com', pass: PASSWORD_STORED });

            expect(sendMail).toHaveBeenCalledTimes(1);
            const message: any = (sendMail.mock.calls[0] as any[])[0];
            expect(message.to).toBe(user.email);
            expect(message.from).toEqual({ name: 'Dr. Ivanova', address: 'dr.ivanova@gmail.com' });
            expect(message.attachments).toEqual([]);
            expect(close).toHaveBeenCalledTimes(1);
        });

        test('ignores any recipient supplied in the request body', async () => {
            const { user, token } = await createTestUser('doctor');
            await save(token, googleBody());
            const { sendMail } = installFakeTransport(jest.fn().mockResolvedValue({}));

            await runTest(token, { recipient_email: 'attacker@example.com', to: 'attacker@example.com' });

            expect(((sendMail.mock.calls[0] as any[])[0]).to).toBe(user.email);
        });

        test('persists lastTestedAt / lastTestStatus and GET-visible fields; keeps the secret intact', async () => {
            const { user, token } = await createTestUser('doctor');
            await save(token, googleBody());
            installFakeTransport(jest.fn().mockResolvedValue({}));

            await runTest(token);

            const row = await readRow(user.userId);
            expect(row.lastTestStatus).toBe('success');
            expect(Number.isNaN(Date.parse(row.lastTestedAt))).toBe(false);
            const aad = { userId: user.userId, provider: row.provider, host: row.host, port: Number(row.port), security: row.security, username: row.username };
            expect(decryptSecret(row, aad).plaintext).toBe(PASSWORD_STORED);
        });

        test('writes an EMAIL_PROVIDER_TEST audit event with result success only', async () => {
            const { user, token } = await createTestUser('doctor');
            await save(token, googleBody());
            installFakeTransport(jest.fn().mockResolvedValue({}));

            await runTest(token);

            const events = await listAudit('EMAIL_PROVIDER_TEST');
            expect(events).toHaveLength(1);
            expect(events[0].userId).toBe(user.userId);
            expect(JSON.parse(events[0].details)).toEqual({ result: 'success' });
        });

        test('response, audit and logs never contain the password or ciphertext', async () => {
            const { user, token } = await createTestUser('doctor');
            await save(token, googleBody());
            installFakeTransport(jest.fn().mockResolvedValue({}));
            const context = mockInvocationContext();

            const res = await runTest(token, undefined, context);
            const row = await readRow(user.userId);
            const audit = JSON.stringify(await listAudit('EMAIL_PROVIDER_TEST'));
            const logs = JSON.stringify([
                (context.log as any).mock?.calls,
                (context.warn as any).mock?.calls,
                (context.error as any).mock?.calls
            ]);

            for (const text of [res.body, audit, logs]) {
                expect(text).not.toContain(PASSWORD_STORED);
                expect(text).not.toContain(PASSWORD);
                expect(text).not.toContain(row.secretCiphertext);
            }
        });

        test('re-encrypts a secret written with the previous master key after a successful test (7.3b)', async () => {
            const { user, token } = await createTestUser('doctor');
            await save(token, googleBody());
            const before = await readRow(user.userId);

            process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY = OTHER_KEY;
            process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS = MASTER_KEY;
            installFakeTransport(jest.fn().mockResolvedValue({}));

            const res = await runTest(token);
            expect(res.status).toBe(200);

            const after = await readRow(user.userId);
            expect(after.secretCiphertext).not.toBe(before.secretCiphertext);

            // Now decryptable with the new key alone.
            delete process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS;
            const aad = { userId: user.userId, provider: after.provider, host: after.host, port: Number(after.port), security: after.security, username: after.username };
            expect(decryptSecret(after, aad)).toEqual({ plaintext: PASSWORD_STORED, keyRotated: false });
        });
    });

    describe('provider failures — 502 with mapped code', () => {
        test.each([
            [smtpError({ code: 'EAUTH', responseCode: 535, response: '535 5.7.8 Username and Password not accepted' }), 'EMAIL_AUTH_FAILED'],
            [smtpError({ code: 'ECONNECTION' }), 'EMAIL_CONNECTION_FAILED'],
            [smtpError({ code: 'ETIMEDOUT' }), 'EMAIL_CONNECTION_FAILED'],
            [smtpError({ code: 'ESOCKET', message: 'self-signed certificate' }), 'EMAIL_CONNECTION_FAILED'],
            [smtpError({ code: 'EENVELOPE', command: 'RCPT TO', responseCode: 550, response: '550 no such user' }), 'EMAIL_REJECTED']
        ])('%# maps to %s with a generic message', async (providerError: any, expectedCode: string) => {
            const { user, token } = await createTestUser('doctor');
            await save(token, googleBody());
            installFakeTransport(jest.fn().mockRejectedValue(providerError));

            const res = await runTest(token);
            const body = parseBody(res);

            expect(res.status).toBe(502);
            expect(body.success).toBe(false);
            expect(body.error.code).toBe(expectedCode);
            expect(res.body).not.toContain('Username and Password');
            expect(res.body).not.toContain('no such user');
            expect(res.body).not.toContain('smtp.gmail.com');
            expect(res.body).not.toContain(PASSWORD_STORED);

            const row = await readRow(user.userId);
            expect(row.lastTestStatus).toBe(expectedCode);

            const events = await listAudit('EMAIL_PROVIDER_TEST');
            expect(JSON.parse(events[0].details)).toEqual({ result: expectedCode });
        });

        test('a failing test does not re-encrypt the secret', async () => {
            const { user, token } = await createTestUser('doctor');
            await save(token, googleBody());
            const before = await readRow(user.userId);
            process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY = OTHER_KEY;
            process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS = MASTER_KEY;
            installFakeTransport(jest.fn().mockRejectedValue(smtpError({ code: 'EAUTH', responseCode: 535 })));

            await runTest(token);

            const after = await readRow(user.userId);
            expect(after.secretCiphertext).toBe(before.secretCiphertext);
        });

        test('host re-check at send time — DNS now points to a private address: 502 EMAIL_CONNECTION_FAILED, no connection', async () => {
            const { token } = await createTestUser('doctor');
            await save(token, googleBody());
            const { factory } = installFakeTransport(jest.fn(), async () => ['169.254.169.254']);

            const res = await runTest(token);

            expect(res.status).toBe(502);
            expect(parseBody(res).error.code).toBe('EMAIL_CONNECTION_FAILED');
            expect(factory).not.toHaveBeenCalled();
        });

        test('implicit TLS settings use secure and no requireTLS', async () => {
            const { token } = await createTestUser('doctor');
            await save(token, {
                provider: 'generic',
                host: '8.8.8.8',
                port: 465,
                security: 'ssl',
                username: 'mailer',
                password: 'generic-secret',
                from_email: 'mailer@example.com'
            });
            const { factory } = installFakeTransport(jest.fn().mockResolvedValue({}));

            const res = await runTest(token);

            expect(res.status).toBe(200);
            const opts: any = (factory.mock.calls[0] as any[])[0];
            expect(opts.secure).toBe(true);
            expect(opts.requireTLS).toBe(false);
            // IP literal host: no DNS lookup, connect to the literal itself.
            expect(opts.host).toBe('8.8.8.8');
            expect(opts.tls.servername).toBe('8.8.8.8');
        });
    });
});

// Made with Bob
