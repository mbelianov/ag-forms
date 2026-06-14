declare const describe: any;
declare const test: any;
declare const expect: any;

import {
    requireAuth,
    requireRole,
    isAdmin,
    isDoctor,
    isViewer,
    authorize,
    canAccessResource,
    getUserId,
    getUsername,
    getUserRole
} from '../../utils/authMiddleware';
import { generateToken } from '../../utils/tokenService';
import { mockHttpRequest } from '../testUtils';

describe('Auth Middleware', () => {
    const adminUser = { userId: 'admin-1', username: 'admin', role: 'admin' };
    const doctorUser = { userId: 'doctor-1', username: 'doctor', role: 'doctor' };
    const viewerUser = { userId: 'viewer-1', username: 'viewer', role: 'viewer' };

    test('should authenticate valid token', () => {
        const token = generateToken(adminUser.userId, adminUser.username, adminUser.role);
        const request = mockHttpRequest('GET', undefined, {
            authorization: `Bearer ${token}`
        });

        const user = requireAuth(request);

        expect(user).not.toBeNull();
        expect(user.userId).toBe(adminUser.userId);
    });

    test('should reject missing token', () => {
        const request = mockHttpRequest('GET');

        expect(requireAuth(request)).toBeNull();
    });

    test('should reject invalid token', () => {
        const request = mockHttpRequest('GET', undefined, {
            authorization: 'Bearer invalid-token'
        });

        expect(requireAuth(request)).toBeNull();
    });

    test('should allow required role', () => {
        expect(requireRole(adminUser, ['admin'])).toBe(true);
        expect(requireRole(doctorUser, ['doctor', 'admin'])).toBe(true);
    });

    test('should reject disallowed role', () => {
        expect(requireRole(viewerUser, ['admin', 'doctor'])).toBe(false);
        expect(requireRole(null, ['admin'])).toBe(false);
    });

    test('should identify admin correctly', () => {
        expect(isAdmin(adminUser)).toBe(true);
        expect(isAdmin(doctorUser)).toBe(false);
    });

    test('should identify doctor access correctly', () => {
        expect(isDoctor(adminUser)).toBe(true);
        expect(isDoctor(doctorUser)).toBe(true);
        expect(isDoctor(viewerUser)).toBe(false);
    });

    test('should identify viewer access correctly', () => {
        expect(isViewer(adminUser)).toBe(true);
        expect(isViewer(doctorUser)).toBe(true);
        expect(isViewer(viewerUser)).toBe(true);
        expect(isViewer(null)).toBe(false);
    });

    test('should authorize authenticated user without role restriction', () => {
        const token = generateToken(viewerUser.userId, viewerUser.username, viewerUser.role);
        const request = mockHttpRequest('GET', undefined, {
            authorization: `Bearer ${token}`
        });

        const result = authorize(request);

        expect(result.authorized).toBe(true);
        expect(result.user.userId).toBe(viewerUser.userId);
    });

    test('should reject unauthorized request in authorize', () => {
        const request = mockHttpRequest('GET');
        const result = authorize(request, ['admin']);

        expect(result.authorized).toBe(false);
        expect(result.message).toBe('Authentication required');
    });

    test('should reject insufficient permissions in authorize', () => {
        const token = generateToken(viewerUser.userId, viewerUser.username, viewerUser.role);
        const request = mockHttpRequest('GET', undefined, {
            authorization: `Bearer ${token}`
        });

        const result = authorize(request, ['admin']);

        expect(result.authorized).toBe(false);
        expect(result.message).toBe('Insufficient permissions');
    });

    test('should enforce resource access rules', () => {
        expect(canAccessResource(adminUser, 'someone-else', 'delete')).toBe(true);
        expect(canAccessResource(doctorUser, 'doctor-1', 'write')).toBe(true);
        expect(canAccessResource(doctorUser, 'other-user', 'write')).toBe(false);
        expect(canAccessResource(doctorUser, 'other-user', 'read')).toBe(true);
        expect(canAccessResource(viewerUser, 'viewer-1', 'read')).toBe(true);
        expect(canAccessResource(viewerUser, 'viewer-1', 'write')).toBe(false);
    });

    test('should extract user identity helpers from request', () => {
        const token = generateToken(doctorUser.userId, doctorUser.username, doctorUser.role);
        const request = mockHttpRequest('GET', undefined, {
            authorization: `Bearer ${token}`
        });

        expect(getUserId(request)).toBe(doctorUser.userId);
        expect(getUsername(request)).toBe(doctorUser.username);
        expect(getUserRole(request)).toBe(doctorUser.role);
    });
});

// Made with Bob
