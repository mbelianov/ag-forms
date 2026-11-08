declare const describe: any;
declare const test: any;
declare const expect: any;
declare const beforeEach: any;
declare const afterEach: any;
declare const beforeAll: any;
declare const afterAll: any;

import { getEmailProvider } from '../../functions/profile/GetEmailProvider';
import { saveEmailProvider } from '../../functions/profile/SaveEmailProvider';
import { deleteEmailProvider } from '../../functions/profile/DeleteEmailProvider';
import { deleteUser } from '../../functions/users/DeleteUser';
import { createTestUser, cleanupTestData, mockHttpRequest, mockInvocationContext } from '../testUtils';
import { getTableClient } from '../../shared/storage/tableClient';
import { decryptSecret } from '../../shared/email';

const parseBody = (response: any) => JSON.parse(response.body);

const MASTER_KEY = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';
const SECRET_PASSWORD = 'abcd efgh ijkl mnop';

const withAuth = (token: string) => ({ cookie: `session_token=${token}` });

const googleBody = (overrides: Record<string, any> = {}) => ({
    provider: 'google',
    username: 'dr.ivanova@gmail.com',
    password: SECRET_PASSWORD,
    from_email: 'dr.ivanova@gmail.com',
    from_name: 'Dr. Ivanova',
    footer: 'Clinic footer',
    ...overrides
});

const genericBody = (overrides: Record<string, any> = {}) => ({
    provider: 'generic',
    host: '8.8.8.8',
    port: 587,
    security: 'starttls',
    username: 'mailer',
    password: 'generic-secret',
    from_email: 'mailer@example.com',
    ...overrides
});

const put = (token: string, body: any) =>
    saveEmailProvider(mockHttpRequest('PUT', body, withAuth(token)), mockInvocationContext());
const get = (token: string) =>
    getEmailProvider(mockHttpRequest('GET', undefined, withAuth(token)), mockInvocationContext());
const del = (token: string) =>
    deleteEmailProvider(mockHttpRequest('DELETE', undefined, withAuth(token)), mockInvocationContext());

const readRow = async (userId: string): Promise<any> =>
    getTableClient('Users').getEntity<any>('EMAIL_PROVIDER', userId);

const listAudit = async (action: string): Promise<any[]> => {
    const rows: any[] = [];
    for await (const entity of getTableClient('AuditLogs').listEntities({ queryOptions: { filter: `action eq '${action}'` } })) {
        rows.push(entity);
    }
    return rows;
};

describe('Email provider settings integration', () => {
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
        await cleanupTestData();
    });

    describe('authentication and authorization', () => {
        test('unauthenticated requests — 401 on GET, PUT and DELETE', async () => {
            const ctx = mockInvocationContext();
            const getRes = await getEmailProvider(mockHttpRequest('GET'), ctx);
            const putRes = await saveEmailProvider(mockHttpRequest('PUT', googleBody()), ctx);
            const delRes = await deleteEmailProvider(mockHttpRequest('DELETE'), ctx);

            expect(getRes.status).toBe(401);
            expect(putRes.status).toBe(401);
            expect(delRes.status).toBe(401);
        });

        test('viewer — 403 on GET, PUT and DELETE', async () => {
            const viewer = await createTestUser('viewer');

            expect((await get(viewer.token)).status).toBe(403);
            expect((await put(viewer.token, googleBody())).status).toBe(403);
            expect((await del(viewer.token)).status).toBe(403);
        });
    });

    describe('happy path', () => {
        test('GET before configuration returns { configured: false }', async () => {
            const doctor = await createTestUser('doctor');
            const res = await get(doctor.token);
            const body = parseBody(res);

            expect(res.status).toBe(200);
            expect(body.data).toEqual({ configured: false });
        });

        test('doctor creates, reads and deletes settings; secret is never returned', async () => {
            const doctor = await createTestUser('doctor');

            const createRes = await put(doctor.token, googleBody());
            const created = parseBody(createRes);
            expect(createRes.status).toBe(200);
            expect(created.data.configured).toBe(true);
            expect(created.data.provider).toBe('google');
            expect(created.data.host).toBe('smtp.gmail.com');
            expect(created.data.port).toBe(587);
            expect(created.data.security).toBe('starttls');
            expect(created.data.username).toBe('dr.ivanova@gmail.com');
            expect(created.data.from_email).toBe('dr.ivanova@gmail.com');
            expect(created.data.from_name).toBe('Dr. Ivanova');
            expect(created.data.footer).toBe('Clinic footer');
            expect(created.data.secret_set).toBe(true);
            expect(created.data.etag).toBeDefined();

            const getRes = await get(doctor.token);
            const fetched = parseBody(getRes);
            expect(getRes.status).toBe(200);
            expect(fetched.data.configured).toBe(true);
            expect(fetched.data.secret_set).toBe(true);

            const delRes = await del(doctor.token);
            expect(delRes.status).toBe(200);

            const after = parseBody(await get(doctor.token));
            expect(after.data).toEqual({ configured: false });
            await expect(readRow(doctor.user.userId)).rejects.toBeDefined();
        });

        test('admin can also manage own settings', async () => {
            const admin = await createTestUser('admin');
            const res = await put(admin.token, googleBody());

            expect(res.status).toBe(200);
            expect(parseBody(res).data.configured).toBe(true);
        });

        test('DELETE is idempotent when nothing is stored', async () => {
            const doctor = await createTestUser('doctor');
            const res = await del(doctor.token);

            expect(res.status).toBe(200);
        });

        test('stored password is encrypted (no plaintext) and spaces are removed for google', async () => {
            const doctor = await createTestUser('doctor');
            await put(doctor.token, googleBody());

            const row = await readRow(doctor.user.userId);
            expect(JSON.stringify(row)).not.toContain(SECRET_PASSWORD);
            expect(JSON.stringify(row)).not.toContain('abcdefghijklmnop');
            expect(row.secretCiphertext).toBeDefined();
            expect(row.secretIv).toBeDefined();
            expect(row.secretAuthTag).toBeDefined();
            expect(row.secretSalt).toBeDefined();
            expect(row.keyVersion).toBe(1);

            const result = decryptSecret(row, {
                userId: doctor.user.userId,
                provider: row.provider,
                host: row.host,
                port: row.port,
                security: row.security,
                username: row.username
            });
            expect(result.plaintext).toBe('abcdefghijklmnop');
        });

        test('google preset overwrites client-supplied host, port and security', async () => {
            const doctor = await createTestUser('doctor');
            const res = await put(doctor.token, googleBody({
                host: 'evil.example.com',
                port: 25,
                security: 'ssl'
            }));
            const body = parseBody(res);

            expect(res.status).toBe(200);
            expect(body.data.host).toBe('smtp.gmail.com');
            expect(body.data.port).toBe(587);
            expect(body.data.security).toBe('starttls');
        });

        test("user A cannot read or change user B's settings", async () => {
            const doctorA = await createTestUser('doctor');
            const doctorB = await createTestUser('doctor');

            await put(doctorA.token, googleBody());

            const bView = parseBody(await get(doctorB.token));
            expect(bView.data).toEqual({ configured: false });

            const bDelete = await del(doctorB.token);
            expect(bDelete.status).toBe(200);

            const aView = parseBody(await get(doctorA.token));
            expect(aView.data.configured).toBe(true);
        });
    });

    describe('validation', () => {
        test('create without password — 400', async () => {
            const doctor = await createTestUser('doctor');
            const res = await put(doctor.token, googleBody({ password: '' }));
            const body = parseBody(res);

            expect(res.status).toBe(400);
            expect(body.error.details.errors).toContain('Password is required');
        });

        test('invalid provider — 400', async () => {
            const doctor = await createTestUser('doctor');
            const res = await put(doctor.token, googleBody({ provider: 'outlook' }));

            expect(res.status).toBe(400);
        });

        test('google from_email different from username — 400', async () => {
            const doctor = await createTestUser('doctor');
            const res = await put(doctor.token, googleBody({ from_email: 'other@gmail.com' }));

            expect(res.status).toBe(400);
        });

        test.each(['localhost', '127.0.0.1', '10.0.0.5', '169.254.169.254', '192.168.1.10'])(
            'generic host %s is rejected by the SSRF guard — 400',
            async (host: string) => {
                const doctor = await createTestUser('doctor');
                const res = await put(doctor.token, genericBody({ host }));
                const body = parseBody(res);

                expect(res.status).toBe(400);
                expect(body.error.message).toBe('Validation failed');
                // generic client message: no resolved address or hostname echoed back
                expect(JSON.stringify(body)).not.toContain('resolved');
                await expect(readRow(doctor.user.userId)).rejects.toBeDefined();
            }
        );

        test('host with scheme/path is rejected — 400', async () => {
            const doctor = await createTestUser('doctor');
            const res = await put(doctor.token, genericBody({ host: 'https://smtp.example.com/path' }));

            expect(res.status).toBe(400);
        });

        test('generic provider with valid public host is accepted', async () => {
            const doctor = await createTestUser('doctor');
            const res = await put(doctor.token, genericBody());
            const body = parseBody(res);

            expect(res.status).toBe(200);
            expect(body.data.provider).toBe('generic');
            expect(body.data.host).toBe('8.8.8.8');
            expect(body.data.port).toBe(587);
            expect(body.data.security).toBe('starttls');
        });

        test('invalid JSON body — 400', async () => {
            const doctor = await createTestUser('doctor');
            const request: any = mockHttpRequest('PUT', undefined, withAuth(doctor.token));
            request.json = async () => { throw new Error('bad json'); };
            const res = await saveEmailProvider(request, mockInvocationContext());

            expect(res.status).toBe(400);
        });
    });

    describe('updates and optimistic concurrency', () => {
        test('update without etag — 400', async () => {
            const doctor = await createTestUser('doctor');
            await put(doctor.token, googleBody());

            const res = await put(doctor.token, googleBody({ password: '' }));
            expect(res.status).toBe(400);
            expect(parseBody(res).error.message).toBe('ETag is required');
        });

        test('partial update keeps the stored secret when password is empty', async () => {
            const doctor = await createTestUser('doctor');
            const created = parseBody(await put(doctor.token, googleBody())).data;
            const rowBefore = await readRow(doctor.user.userId);

            const res = await put(doctor.token, googleBody({
                password: '',
                from_name: 'Dr. M. Ivanova',
                footer: 'New footer',
                etag: created.etag
            }));
            const body = parseBody(res);

            expect(res.status).toBe(200);
            expect(body.data.from_name).toBe('Dr. M. Ivanova');
            expect(body.data.footer).toBe('New footer');
            expect(body.data.secret_set).toBe(true);
            expect(body.data.etag).not.toBe(created.etag);

            const rowAfter = await readRow(doctor.user.userId);
            // Connection fields unchanged: ciphertext material is untouched
            expect(rowAfter.secretCiphertext).toBe(rowBefore.secretCiphertext);
            expect(rowAfter.secretIv).toBe(rowBefore.secretIv);
            expect(rowAfter.secretSalt).toBe(rowBefore.secretSalt);
            expect(rowAfter.secretAuthTag).toBe(rowBefore.secretAuthTag);
        });

        test('connection change with empty password re-encrypts the secret under the new AAD (7.3d)', async () => {
            const doctor = await createTestUser('doctor');
            const created = parseBody(await put(doctor.token, genericBody())).data;
            const rowBefore = await readRow(doctor.user.userId);

            const res = await put(doctor.token, genericBody({
                host: '1.1.1.1',
                port: 465,
                security: 'ssl',
                password: '',
                etag: created.etag
            }));
            const body = parseBody(res);

            expect(res.status).toBe(200);
            expect(body.data.host).toBe('1.1.1.1');
            expect(body.data.port).toBe(465);
            expect(body.data.security).toBe('ssl');

            const rowAfter = await readRow(doctor.user.userId);
            expect(rowAfter.secretCiphertext).not.toBe(rowBefore.secretCiphertext);
            expect(rowAfter.secretSalt).not.toBe(rowBefore.secretSalt);

            // Decrypts with the NEW connection values and returns the original password
            const result = decryptSecret(rowAfter, {
                userId: doctor.user.userId,
                provider: 'generic',
                host: '1.1.1.1',
                port: 465,
                security: 'ssl',
                username: 'mailer'
            });
            expect(result.plaintext).toBe('generic-secret');

            // And no longer decrypts with the OLD values
            expect(() => decryptSecret(rowAfter, {
                userId: doctor.user.userId,
                provider: 'generic',
                host: '8.8.8.8',
                port: 587,
                security: 'starttls',
                username: 'mailer'
            })).toThrow();
        });

        test('username change with empty password re-encrypts under the new username', async () => {
            const doctor = await createTestUser('doctor');
            const created = parseBody(await put(doctor.token, genericBody())).data;

            const res = await put(doctor.token, genericBody({
                username: 'mailer2',
                password: '',
                etag: created.etag
            }));
            expect(res.status).toBe(200);

            const row = await readRow(doctor.user.userId);
            const result = decryptSecret(row, {
                userId: doctor.user.userId,
                provider: 'generic',
                host: '8.8.8.8',
                port: 587,
                security: 'starttls',
                username: 'mailer2'
            });
            expect(result.plaintext).toBe('generic-secret');
        });

        test('connection change with a new password replaces the secret', async () => {
            const doctor = await createTestUser('doctor');
            const created = parseBody(await put(doctor.token, genericBody())).data;

            const res = await put(doctor.token, genericBody({
                host: '1.1.1.1',
                password: 'brand-new-secret',
                etag: created.etag
            }));
            expect(res.status).toBe(200);

            const row = await readRow(doctor.user.userId);
            const result = decryptSecret(row, {
                userId: doctor.user.userId,
                provider: 'generic',
                host: '1.1.1.1',
                port: 587,
                security: 'starttls',
                username: 'mailer'
            });
            expect(result.plaintext).toBe('brand-new-secret');
        });

        test('connection change with an undecryptable stored secret and empty password — 400', async () => {
            const doctor = await createTestUser('doctor');
            const created = parseBody(await put(doctor.token, genericBody())).data;

            // Tamper with the stored ciphertext so the old secret cannot be decrypted
            const table = getTableClient('Users');
            const row = await readRow(doctor.user.userId);
            const flipped = (row.secretCiphertext[0] === '0' ? '1' : '0') + row.secretCiphertext.slice(1);
            const updated = await table.updateEntity(
                { partitionKey: 'EMAIL_PROVIDER', rowKey: doctor.user.userId, secretCiphertext: flipped },
                'Merge',
                { etag: '*' }
            );

            const res = await put(doctor.token, genericBody({
                host: '1.1.1.1',
                password: '',
                etag: (updated as any).etag
            }));
            const body = parseBody(res);

            expect(res.status).toBe(400);
            expect(body.error.message).toContain('enter the password again');
            expect(created.etag).toBeDefined();
        });

        test('stale etag — 409', async () => {
            const doctor = await createTestUser('doctor');
            const created = parseBody(await put(doctor.token, googleBody())).data;

            // First update succeeds and rotates the etag
            const first = await put(doctor.token, googleBody({ password: '', footer: 'one', etag: created.etag }));
            expect(first.status).toBe(200);

            // Re-using the original etag now conflicts
            const stale = await put(doctor.token, googleBody({ password: '', footer: 'two', etag: created.etag }));
            expect(stale.status).toBe(409);
        });

        test('bogus etag — 409', async () => {
            const doctor = await createTestUser('doctor');
            await put(doctor.token, googleBody());

            const res = await put(doctor.token, googleBody({ password: '', etag: 'W/"datetime\'2000-01-01T00%3A00%3A00.0000000Z\'"' }));
            expect(res.status).toBe(409);
        });
    });

    describe('response safety', () => {
        test('no response from GET/PUT/DELETE contains secret or ciphertext fields', async () => {
            const doctor = await createTestUser('doctor');
            const responses = [
                await put(doctor.token, googleBody()),
                await get(doctor.token)
            ];
            const row = await readRow(doctor.user.userId);
            responses.push(await del(doctor.token));

            const forbidden = [
                SECRET_PASSWORD,
                'abcdefghijklmnop',
                row.secretCiphertext,
                row.secretIv,
                row.secretAuthTag,
                row.secretSalt,
                'secretCiphertext',
                'secretIv',
                'secretAuthTag',
                'secretSalt',
                'keyVersion',
                'password'
            ];

            for (const res of responses) {
                const raw = res.body as string;
                for (const needle of forbidden) {
                    expect(raw).not.toContain(needle);
                }
            }
        });

        test('missing master key — 500 with generic message and no row is written', async () => {
            delete process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY;
            const doctor = await createTestUser('doctor');
            const res = await put(doctor.token, googleBody());
            const body = parseBody(res);

            expect(res.status).toBe(500);
            expect(body.error.message).not.toContain('EMAIL_CREDENTIALS_ENCRYPTION_KEY');
            await expect(readRow(doctor.user.userId)).rejects.toBeDefined();
        });
    });

    describe('audit', () => {
        test('EMAIL_PROVIDER_SAVED records credentialsReplaced and no secrets; DELETED records provider', async () => {
            const doctor = await createTestUser('doctor');
            const created = parseBody(await put(doctor.token, googleBody())).data;
            await put(doctor.token, googleBody({ password: '', footer: 'x', etag: created.etag }));
            await del(doctor.token);

            const saved = await listAudit('EMAIL_PROVIDER_SAVED');
            const deleted = await listAudit('EMAIL_PROVIDER_DELETED');

            expect(saved).toHaveLength(2);
            const details = saved.map(r => JSON.parse(r.details));
            const replaced = details.map(d => d.credentialsReplaced).sort();
            expect(replaced).toEqual([false, true]);
            for (const d of details) {
                expect(d.provider).toBe('google');
                expect(d.host).toBe('smtp.gmail.com');
                expect(d.fromEmail).toBe('dr.ivanova@gmail.com');
            }
            for (const r of saved) {
                expect(r.details).not.toContain(SECRET_PASSWORD);
                expect(r.details).not.toContain('abcdefghijklmnop');
                expect(r.details).not.toContain('REDACTED');
                expect(r.userId).toBe(doctor.user.userId);
            }

            expect(deleted).toHaveLength(1);
            expect(JSON.parse(deleted[0].details)).toEqual({ provider: 'google' });
        });
    });

    describe('user deletion', () => {
        test('deleting a user hard-deletes their EMAIL_PROVIDER row', async () => {
            const admin = await createTestUser('admin');
            const doctor = await createTestUser('doctor');
            await put(doctor.token, googleBody());
            await expect(readRow(doctor.user.userId)).resolves.toBeDefined();

            const request: any = mockHttpRequest('DELETE', undefined, withAuth(admin.token));
            request.params = { id: doctor.user.userId };
            const res = await deleteUser(request, mockInvocationContext());

            expect(res.status).toBe(200);
            await expect(readRow(doctor.user.userId)).rejects.toBeDefined();
        });

        test('deleting a user without provider settings still succeeds', async () => {
            const admin = await createTestUser('admin');
            const doctor = await createTestUser('doctor');

            const request: any = mockHttpRequest('DELETE', undefined, withAuth(admin.token));
            request.params = { id: doctor.user.userId };
            const res = await deleteUser(request, mockInvocationContext());

            expect(res.status).toBe(200);
        });
    });

    describe('cleanup', () => {
        test('cleanupTestData sweeps the EMAIL_PROVIDER partition', async () => {
            const doctor = await createTestUser('doctor');
            await put(doctor.token, googleBody());

            await cleanupTestData();

            const rows: any[] = [];
            for await (const e of getTableClient('Users').listEntities({ queryOptions: { filter: `PartitionKey eq 'EMAIL_PROVIDER'` } })) {
                rows.push(e);
            }
            expect(rows).toHaveLength(0);
        });
    });
});

// Made with Bob
