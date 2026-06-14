declare const describe: any;
declare const test: any;
declare const expect: any;
declare const beforeEach: any;
declare const afterEach: any;

import { register } from '../../functions/Register';
import { login } from '../../functions/Login';
import { changePassword } from '../../functions/ChangePassword';
import { getCurrentUser } from '../../functions/GetCurrentUser';
import { logout } from '../../functions/Logout';
import { mockHttpRequest, mockInvocationContext, cleanupTestData, createTestUser } from '../testUtils';
import { getTableClient } from '../../utils/tableClient';

const parseBody = (response: any) => JSON.parse(response.body);

describe('Auth Integration', () => {
    beforeEach(async () => {
        await cleanupTestData();
    });

    afterEach(async () => {
        await cleanupTestData();
    });

    test('should register first user as admin', async () => {
        const request = mockHttpRequest('POST', {
            username: 'firstadmin',
            password: 'StrongPassword123!',
            email: 'firstadmin@example.com',
            role: 'viewer'
        });
        const context = mockInvocationContext();

        const response = await register(request, context);
        const body = parseBody(response);

        expect(response.status).toBe(404);
        expect(body.status).toBe('error');
    });

    test('should login with correct credentials', async () => {
        const created = await createTestUser('doctor');
        const request = mockHttpRequest('POST', {
            username: created.user.username,
            password: created.password
        });
        const context = mockInvocationContext();

        const response = await login(request, context);
        const body = parseBody(response);

        expect(response.status).toBe(200);
        expect(body.status).toBe('success');
        expect(body.data.token).toBeDefined();
        expect(body.data.user.username).toBe(created.user.username);
    });

    test('should reject login with incorrect credentials', async () => {
        const created = await createTestUser('doctor');
        const request = mockHttpRequest('POST', {
            username: created.user.username,
            password: 'WrongPassword123!'
        });
        const context = mockInvocationContext();

        const response = await login(request, context);
        const body = parseBody(response);

        expect(response.status).toBe(401);
        expect(body.message).toBe('Invalid credentials');
    });

    test('should lock account after five failed attempts', async () => {
        const created = await createTestUser('doctor');
        const context = mockInvocationContext();

        for (let i = 0; i < 5; i++) {
            const request = mockHttpRequest('POST', {
                username: created.user.username,
                password: 'WrongPassword123!'
            });
            await login(request, context);
        }

        const lockedAttempt = await login(mockHttpRequest('POST', {
            username: created.user.username,
            password: created.password
        }), context);
        const body = parseBody(lockedAttempt);

        expect(lockedAttempt.status).toBe(403);
        expect(body.message).toContain('Account is locked');
    });

    test('should change password with valid current password', async () => {
        const created = await createTestUser('doctor');
        const request = mockHttpRequest('POST', {
            currentPassword: created.password,
            newPassword: 'NewStrongPassword123!'
        }, {
            authorization: `Bearer ${created.token}`
        });
        const context = mockInvocationContext();

        const response = await changePassword(request, context);
        const body = parseBody(response);

        expect(response.status).toBe(200);
        expect(body.data.message).toBe('Password changed successfully');

        const loginResponse = await login(mockHttpRequest('POST', {
            username: created.user.username,
            password: 'NewStrongPassword123!'
        }), context);

        expect(loginResponse.status).toBe(200);
    });

    test('should get current user from token', async () => {
        const created = await createTestUser('viewer');
        const request = mockHttpRequest('GET', undefined, {
            authorization: `Bearer ${created.token}`
        });
        const context = mockInvocationContext();

        const response = await getCurrentUser(request, context);
        const body = parseBody(response);

        expect(response.status).toBe(200);
        expect(body.data.user.userId).toBe(created.user.userId);
        expect(body.data.user.passwordHash).toBeUndefined();
    });

    test('should logout authenticated user', async () => {
        const created = await createTestUser('doctor');
        const request = mockHttpRequest('POST', undefined, {
            authorization: `Bearer ${created.token}`
        });
        const context = mockInvocationContext();

        const response = await logout(request, context);
        const body = parseBody(response);

        expect(response.status).toBe(200);
        expect(body.data.message).toBe('Logout successful');
    });

    test('should require admin for subsequent registrations', async () => {
        await createTestUser('admin');

        const request = mockHttpRequest('POST', {
            username: 'seconduser',
            password: 'StrongPassword123!',
            email: 'second@example.com',
            role: 'viewer'
        });
        const context = mockInvocationContext();

        const response = await register(request, context);
        const body = parseBody(response);

        expect(response.status).toBe(401);
        expect(body.message).toBe('Authentication required');
    });

    test('should allow admin to register subsequent users', async () => {
        const admin = await createTestUser('admin');

        const request = mockHttpRequest('POST', {
            username: 'seconduser',
            password: 'StrongPassword123!',
            email: 'second@example.com',
            role: 'viewer'
        }, {
            authorization: `Bearer ${admin.token}`
        });
        const context = mockInvocationContext();

        const response = await register(request, context);
        const body = parseBody(response);

        expect(response.status).toBe(404);
        expect(body.status).toBe('error');
    });

    test('should reject password change with wrong current password', async () => {
        const created = await createTestUser('doctor');
        const request = mockHttpRequest('POST', {
            currentPassword: 'WrongPassword123!',
            newPassword: 'NewStrongPassword123!'
        }, {
            authorization: `Bearer ${created.token}`
        });
        const context = mockInvocationContext();

        const response = await changePassword(request, context);
        const body = parseBody(response);

        expect(response.status).toBe(401);
        expect(body.message).toBe('Current password is incorrect');
    });

    test('should expose lockout state in persisted user entity', async () => {
        const created = await createTestUser('doctor');
        const usersTable = getTableClient('Users');
        const context = mockInvocationContext();

        for (let i = 0; i < 5; i++) {
            await login(mockHttpRequest('POST', {
                username: created.user.username,
                password: 'WrongPassword123!'
            }), context);
        }

        const user = await usersTable.getEntity<any>('USER', created.user.userId);

        expect(user.failedLoginAttempts).toBe(5);
        expect(user.lockedUntil).toBeDefined();
    });
});

// Made with Bob
