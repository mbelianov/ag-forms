declare const describe: any;
declare const test: any;
declare const expect: any;
declare const beforeEach: any;
declare const afterEach: any;

import { getAuditLogs } from '../../functions/GetAuditLogs';
import { login } from '../../functions/Login';
import { createTestUser, cleanupTestData, mockHttpRequest, mockInvocationContext } from '../testUtils';

const parseBody = (response: any) => JSON.parse(response.body);

describe('AuditLogs Integration', () => {
    beforeEach(async () => {
        await cleanupTestData();
    });

    afterEach(async () => {
        await cleanupTestData();
    });

    test('non-admin returns 403', async () => {
        const doctor = await createTestUser('doctor');
        const request = mockHttpRequest('GET', undefined, {
            cookie: `session_token=${doctor.token}`
        });

        const response = await getAuditLogs(request, mockInvocationContext());
        const body = parseBody(response);

        expect(response.status).toBe(403);
        expect(body.error.message).toContain('Admin role required');
    });

    test('unauthenticated returns 401', async () => {
        const response = await getAuditLogs(mockHttpRequest('GET'), mockInvocationContext());
        const body = parseBody(response);

        expect(response.status).toBe(401);
        expect(body.error.message).toBe('Authentication required');
    });

    test('valid admin token returns 200 with logs array', async () => {
        const admin = await createTestUser('admin');
        const request = mockHttpRequest('GET', undefined, {
            cookie: `session_token=${admin.token}`
        });

        const response = await getAuditLogs(request, mockInvocationContext());
        const body = parseBody(response);

        expect(response.status).toBe(200);
        expect(body.success).toBe(true);
        expect(Array.isArray(body.data.logs)).toBe(true);
        // continuationToken is present when there are more pages; may be undefined when results fit in one page
        // The shape assertion: logs must exist
        expect(body.data).toHaveProperty('logs');
    });

    test('after a login event audit logs contain USER_LOGIN_SUCCESS', async () => {
        const doctor = await createTestUser('doctor');
        const context = mockInvocationContext();

        // Trigger a login to produce a USER_LOGIN_SUCCESS audit event
        await login(mockHttpRequest('POST', {
            username: doctor.user.username,
            password: doctor.password
        }), context);

        // Allow audit write to complete (fire-and-forget)
        await new Promise(r => setTimeout(r, 200));

        const admin = await createTestUser('admin');
        const request = mockHttpRequest('GET', undefined, {
            cookie: `session_token=${admin.token}`
        });

        const response = await getAuditLogs(request, mockInvocationContext());
        const body = parseBody(response);

        expect(response.status).toBe(200);
        const loginEntries = body.data.logs.filter((l: any) => l.action === 'USER_LOGIN_SUCCESS');
        expect(loginEntries.length).toBeGreaterThanOrEqual(1);
    });

    test('action=USER_LOGIN_SUCCESS filter returns only that action', async () => {
        const doctor = await createTestUser('doctor');
        const context = mockInvocationContext();
        await login(mockHttpRequest('POST', {
            username: doctor.user.username,
            password: doctor.password
        }), context);
        await new Promise(r => setTimeout(r, 200));

        const admin = await createTestUser('admin');
        const request = mockHttpRequest('GET', undefined, {
            cookie: `session_token=${admin.token}`
        });
        (request as any).query = new URLSearchParams('action=USER_LOGIN_SUCCESS');

        const response = await getAuditLogs(request, mockInvocationContext());
        const body = parseBody(response);

        expect(response.status).toBe(200);
        if (body.data.logs.length > 0) {
            expect(body.data.logs.every((l: any) => l.action === 'USER_LOGIN_SUCCESS')).toBe(true);
        }
    });

    test('invalid action filter returns 400', async () => {
        const admin = await createTestUser('admin');
        const request = mockHttpRequest('GET', undefined, {
            cookie: `session_token=${admin.token}`
        });
        (request as any).query = new URLSearchParams('action=INVALID_ACTION');

        const response = await getAuditLogs(request, mockInvocationContext());
        const body = parseBody(response);

        expect(response.status).toBe(400);
        expect(body.error.message).toContain('Invalid action');
    });

    test('pageSize=5 returns at most 5 records', async () => {
        const admin = await createTestUser('admin');
        const request = mockHttpRequest('GET', undefined, {
            cookie: `session_token=${admin.token}`
        });
        (request as any).query = new URLSearchParams('pageSize=5');

        const response = await getAuditLogs(request, mockInvocationContext());
        const body = parseBody(response);

        expect(response.status).toBe(200);
        expect(body.data.logs.length).toBeLessThanOrEqual(5);
    });

    test('month=YYYYMM returns no error even if partition is empty', async () => {
        const admin = await createTestUser('admin');
        const request = mockHttpRequest('GET', undefined, {
            cookie: `session_token=${admin.token}`
        });
        (request as any).query = new URLSearchParams('month=199001');

        const response = await getAuditLogs(request, mockInvocationContext());
        const body = parseBody(response);

        expect(response.status).toBe(200);
        expect(Array.isArray(body.data.logs)).toBe(true);
    });
});

// Made with Bob
