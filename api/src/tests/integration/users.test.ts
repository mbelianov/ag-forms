declare const describe: any;
declare const test: any;
declare const expect: any;
declare const beforeEach: any;
declare const afterEach: any;

import { createUser } from '../../functions/CreateUser';
import { getUsers } from '../../functions/GetUsers';
import { updateUser } from '../../functions/UpdateUser';
import { deleteUser } from '../../functions/DeleteUser';
import { resetUserPassword } from '../../functions/ResetUserPassword';
import { login } from '../../functions/Login';
import { createTestUser, createTestExamination, createTestPatient, cleanupTestData, mockHttpRequest, mockInvocationContext } from '../testUtils';
import { getTableClient } from '../../utils/tableClient';

const parseBody = (response: any) => JSON.parse(response.body);

describe('Users Integration', () => {
    beforeEach(async () => {
        await cleanupTestData();
    });

    afterEach(async () => {
        await cleanupTestData();
    });

    test('admin creates user — 201 with safe user object (no passwordHash)', async () => {
        const admin = await createTestUser('admin');
        const request = mockHttpRequest('POST', {
            username: 'new_doctor',
            password: 'StrongPassword123!',
            fullName: 'New Doctor',
            email: 'new.doctor@example.com',
            role: 'doctor'
        }, {
            cookie: `session_token=${admin.token}`
        });

        const response = await createUser(request, mockInvocationContext());
        const body = parseBody(response);

        expect(response.status).toBe(201);
        expect(body.success).toBe(true);
        expect(body.data.user.username).toBe('new_doctor');
        expect(body.data.user.passwordHash).toBeUndefined();
        expect(body.data.user.failedLoginAttempts).toBeUndefined();
        expect(body.data.user.normalizedUsername).toBeUndefined();
    });

    test('duplicate username — 409', async () => {
        const admin = await createTestUser('admin');
        const existingUser = await createTestUser('doctor');
        const request = mockHttpRequest('POST', {
            username: existingUser.user.username,
            password: 'StrongPassword123!',
            fullName: 'Duplicate',
            email: 'dup@example.com',
            role: 'doctor'
        }, {
            cookie: `session_token=${admin.token}`
        });

        const response = await createUser(request, mockInvocationContext());
        const body = parseBody(response);

        expect(response.status).toBe(409);
        expect(body.error.message).toContain('already exists');
    });

    test('non-admin tries to create user — 403', async () => {
        const doctor = await createTestUser('doctor');
        const request = mockHttpRequest('POST', {
            username: 'another_user',
            password: 'StrongPassword123!',
            fullName: 'Another User',
            email: 'another@example.com',
            role: 'viewer'
        }, {
            cookie: `session_token=${doctor.token}`
        });

        const response = await createUser(request, mockInvocationContext());
        const body = parseBody(response);

        expect(response.status).toBe(403);
        expect(body.error.message).toContain('Admin role required');
    });

    test('admin lists users — 200, sensitive fields absent', async () => {
        const admin = await createTestUser('admin');
        await createTestUser('doctor');
        const request = mockHttpRequest('GET', undefined, {
            cookie: `session_token=${admin.token}`
        });

        const response = await getUsers(request, mockInvocationContext());
        const body = parseBody(response);

        expect(response.status).toBe(200);
        expect(Array.isArray(body.data.users)).toBe(true);
        body.data.users.forEach((u: any) => {
            expect(u.passwordHash).toBeUndefined();
            expect(u.failedLoginAttempts).toBeUndefined();
            expect(u.lockedUntil).toBeUndefined();
            expect(u.normalizedUsername).toBeUndefined();
        });
    });

    test('admin updates user role — 200, role changed', async () => {
        const admin = await createTestUser('admin');
        const doctor = await createTestUser('doctor');
        const request = mockHttpRequest('PUT', { role: 'viewer' }, {
            cookie: `session_token=${admin.token}`
        });
        (request as any).params = { id: doctor.user.userId };

        const response = await updateUser(request, mockInvocationContext());
        const body = parseBody(response);

        expect(response.status).toBe(200);
        expect(body.data.user.role).toBe('viewer');
    });

    test('invalid role on update — 400', async () => {
        const admin = await createTestUser('admin');
        const doctor = await createTestUser('doctor');
        const request = mockHttpRequest('PUT', { role: 'superadmin' }, {
            cookie: `session_token=${admin.token}`
        });
        (request as any).params = { id: doctor.user.userId };

        const response = await updateUser(request, mockInvocationContext());
        const body = parseBody(response);

        expect(response.status).toBe(400);
        expect(body.error.message).toContain('Invalid role');
    });

    test('admin deletes doctor user with no examinations — 200', async () => {
        const admin = await createTestUser('admin');
        const doctor = await createTestUser('doctor');
        const request = mockHttpRequest('DELETE', undefined, {
            cookie: `session_token=${admin.token}`
        });
        (request as any).params = { id: doctor.user.userId };

        const response = await deleteUser(request, mockInvocationContext());
        const body = parseBody(response);

        expect(response.status).toBe(200);
        expect(body.data.message).toContain('deleted successfully');
    });

    test('admin cannot delete own account — 400', async () => {
        const admin = await createTestUser('admin');
        const request = mockHttpRequest('DELETE', undefined, {
            cookie: `session_token=${admin.token}`
        });
        (request as any).params = { id: admin.user.userId };

        const response = await deleteUser(request, mockInvocationContext());
        const body = parseBody(response);

        expect(response.status).toBe(400);
        expect(body.error.message).toContain('Cannot delete your own account');
    });

    test('admin cannot delete last admin — 400', async () => {
        // The guard fires when activeAdmins.length <= 1 at the time of the delete call.
        // To trigger it: caller is admin1 (active), target is admin2 (active admin).
        // But the guard counts ALL active admins — including admin1. With 2 admins, count=2 > 1, no guard.
        // The guard is reachable if the caller somehow does not appear in the active-admin query,
        // which can only happen if the caller's own account was soft-deleted between auth and the guard check.
        // In practice, having caller admin1 and target admin2 with exactly 2 active admins: guard won't fire.
        // The only triggerable scenario: caller=admin1, target=admin2, and admin1 was already soft-deleted
        // (so count for target = 1). We simulate this by calling deleteUser for admin1 first (by admin2),
        // then admin1's token is still valid but admin1 is soft-deleted in the table.
        const admin1 = await createTestUser('admin');
        const admin2 = await createTestUser('admin');

        // admin2 deletes admin1 (2 admins → guard doesn't fire, succeeds)
        const deleteAdmin1Req = mockHttpRequest('DELETE', undefined, { cookie: `session_token=${admin2.token}` });
        (deleteAdmin1Req as any).params = { id: admin1.user.userId };
        const delResp = await deleteUser(deleteAdmin1Req, mockInvocationContext());
        expect(delResp.status).toBe(200);

        // Now admin2 is the last active admin. admin1's token is still valid.
        // admin1 (soft-deleted, but token still valid) tries to delete admin2.
        // The auth middleware validates the token (still valid JWT) but the guard now sees 1 active admin.
        const tryDeleteLastAdminReq = mockHttpRequest('DELETE', undefined, { cookie: `session_token=${admin1.token}` });
        (tryDeleteLastAdminReq as any).params = { id: admin2.user.userId };
        const response = await deleteUser(tryDeleteLastAdminReq, mockInvocationContext());
        const body = parseBody(response);

        expect(response.status).toBe(400);
        expect(body.error.message).toContain('last admin');
    });

    test('delete user with examinations but no reassignTo — 400', async () => {
        const admin = await createTestUser('admin');
        const doctor = await createTestUser('doctor');
        const patient = await createTestPatient();
        await createTestExamination(patient.patientId);

        // Reassign the examination createdBy to the doctor being deleted
        const examTable = getTableClient('Examinations');
        const examEntities: any[] = [];
        for await (const e of examTable.listEntities({ queryOptions: { filter: `PartitionKey eq 'EXAM' and isDeleted eq false` } })) {
            examEntities.push(e);
        }
        for (const exam of examEntities) {
            await examTable.updateEntity({ ...exam, createdBy: doctor.user.userId }, 'Merge', { etag: '*' });
        }

        const request = mockHttpRequest('DELETE', undefined, {
            cookie: `session_token=${admin.token}`
        });
        (request as any).params = { id: doctor.user.userId };

        const response = await deleteUser(request, mockInvocationContext());
        const body = parseBody(response);

        expect(response.status).toBe(400);
        expect(body.error.message).toContain('reassignTo');
    });

    test('delete user with examinations and valid reassignTo — 200, examinations reassigned, counter unchanged', async () => {
        const admin = await createTestUser('admin');
        const doctor = await createTestUser('doctor');
        const reassignTarget = await createTestUser('doctor');
        const patient = await createTestPatient();
        await createTestExamination(patient.patientId);

        // Reassign the examination createdBy to the doctor being deleted
        const examTable = getTableClient('Examinations');
        const examEntities: any[] = [];
        for await (const e of examTable.listEntities({ queryOptions: { filter: `PartitionKey eq 'EXAM' and isDeleted eq false` } })) {
            examEntities.push(e);
        }
        let examinationId: string | undefined;
        for (const exam of examEntities) {
            examinationId = exam.examinationId;
            await examTable.updateEntity({ ...exam, createdBy: doctor.user.userId }, 'Merge', { etag: '*' });
        }

        // Seed a known EXAM_TOTAL value so we can assert it is unchanged after delete
        const countersTable = getTableClient('Counters');
        await countersTable.upsertEntity({
            partitionKey: 'COUNTER',
            rowKey: 'EXAM_TOTAL',
            counterType: 'EXAM_TOTAL',
            value: 3,
            lastUpdated: new Date().toISOString()
        }, 'Merge');

        const request = mockHttpRequest('DELETE', { reassignTo: reassignTarget.user.userId }, {
            cookie: `session_token=${admin.token}`
        });
        (request as any).params = { id: doctor.user.userId };

        const response = await deleteUser(request, mockInvocationContext());
        const body = parseBody(response);

        expect(response.status).toBe(200);
        expect(body.data.message).toContain('deleted successfully');

        // Verify storage: EXAM entity has createdBy updated to reassignTarget
        if (examinationId) {
            const updatedExam = await examTable.getEntity<any>('EXAM', examinationId);
            expect(updatedExam.createdBy).toBe(reassignTarget.user.userId);
        }

        // Verify EXAM_TOTAL counter was NOT decremented — reassignment ≠ deletion
        const counterAfter = await countersTable.getEntity<any>('COUNTER', 'EXAM_TOTAL');
        expect(counterAfter.value).toBe(3);
    });

    test('non-admin tries to delete user — 403', async () => {
        const doctor = await createTestUser('doctor');
        const viewer = await createTestUser('viewer');
        const request = mockHttpRequest('DELETE', undefined, {
            cookie: `session_token=${doctor.token}`
        });
        (request as any).params = { id: viewer.user.userId };

        const response = await deleteUser(request, mockInvocationContext());
        const body = parseBody(response);

        expect(response.status).toBe(403);
        expect(body.error.message).toContain('Admin role required');
    });

    test('admin resets another user password — 200', async () => {
        const admin = await createTestUser('admin');
        const doctor = await createTestUser('doctor');
        const request = mockHttpRequest('POST', { newPassword: 'NewStrongPassword123!' }, {
            cookie: `session_token=${admin.token}`
        });
        (request as any).params = { id: doctor.user.userId };

        const response = await resetUserPassword(request, mockInvocationContext());
        const body = parseBody(response);

        expect(response.status).toBe(200);
        expect(body.success).toBe(true);
    });

    test('admin cannot reset own password via reset-password — 400', async () => {
        const admin = await createTestUser('admin');
        const request = mockHttpRequest('POST', { newPassword: 'NewStrongPassword123!' }, {
            cookie: `session_token=${admin.token}`
        });
        (request as any).params = { id: admin.user.userId };

        const response = await resetUserPassword(request, mockInvocationContext());
        const body = parseBody(response);

        expect(response.status).toBe(400);
        expect(body.error.message).toBe('Use change-password to update your own password');
    });

    test('reset password for non-existent user — 404', async () => {
        const admin = await createTestUser('admin');
        const request = mockHttpRequest('POST', { newPassword: 'NewStrongPassword123!' }, {
            cookie: `session_token=${admin.token}`
        });
        (request as any).params = { id: '00000000-0000-0000-0000-000000000000' };

        const response = await resetUserPassword(request, mockInvocationContext());
        const body = parseBody(response);

        expect(response.status).toBe(404);
        expect(body.error.message).toContain('not found');
    });

    test('weak new password on reset — 400', async () => {
        const admin = await createTestUser('admin');
        const doctor = await createTestUser('doctor');
        const request = mockHttpRequest('POST', { newPassword: 'weak' }, {
            cookie: `session_token=${admin.token}`
        });
        (request as any).params = { id: doctor.user.userId };

        const response = await resetUserPassword(request, mockInvocationContext());
        const body = parseBody(response);

        expect(response.status).toBe(400);
    });

    test('non-admin tries to reset password — 403', async () => {
        const doctor = await createTestUser('doctor');
        const viewer = await createTestUser('viewer');
        const request = mockHttpRequest('POST', { newPassword: 'NewStrongPassword123!' }, {
            cookie: `session_token=${doctor.token}`
        });
        (request as any).params = { id: viewer.user.userId };

        const response = await resetUserPassword(request, mockInvocationContext());
        const body = parseBody(response);

        expect(response.status).toBe(403);
        expect(body.error.message).toContain('Admin role required');
    });

    test('after password reset old password rejected and new password accepted', async () => {
        const admin = await createTestUser('admin');
        const doctor = await createTestUser('doctor');
        const context = mockInvocationContext();

        // Reset doctor's password
        const resetRequest = mockHttpRequest('POST', { newPassword: 'NewPassword456!!' }, {
            cookie: `session_token=${admin.token}`
        });
        (resetRequest as any).params = { id: doctor.user.userId };
        await resetUserPassword(resetRequest, context);

        // Old password should be rejected
        const oldLoginResponse = await login(mockHttpRequest('POST', {
            username: doctor.user.username,
            password: doctor.password
        }), context);
        expect(oldLoginResponse.status).toBe(401);

        // New password should be accepted
        const newLoginResponse = await login(mockHttpRequest('POST', {
            username: doctor.user.username,
            password: 'NewPassword456!!'
        }), context);
        expect(newLoginResponse.status).toBe(200);
    });
});

// Made with Bob
