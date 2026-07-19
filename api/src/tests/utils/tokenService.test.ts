declare const describe: any;
declare const test: any;
declare const expect: any;

import * as jwt from 'jsonwebtoken';
import {
    generateToken,
    verifyToken,
    extractTokenFromRequest,
    decodeTokenUnsafe,
    isTokenExpired,
    refreshToken
} from '../../utils/tokenService';
import { mockHttpRequest } from '../testUtils';

describe('Token Service', () => {
    describe('generateToken and verifyToken', () => {
        test('should generate and verify a valid token', () => {
            const token = generateToken('user-1', 'doctor1', 'doctor');
            const payload = verifyToken(token);

            expect(token).toBeDefined();
            expect(payload).not.toBeNull();
            expect(payload.userId).toBe('user-1');
            expect(payload.username).toBe('doctor1');
            expect(payload.role).toBe('doctor');
        });

        test('should reject invalid token', () => {
            const payload = verifyToken('invalid.token.value');

            expect(payload).toBeNull();
        });

        test('should reject token with wrong secret', () => {
            const token = jwt.sign(
                { userId: 'user-1', username: 'doctor1', role: 'doctor' },
                'wrong-secret',
                { expiresIn: '24h', issuer: 'ag-forms-api', audience: 'ag-forms-client' }
            );

            const payload = verifyToken(token);

            expect(payload).toBeNull();
        });
    });

    describe('extractTokenFromRequest', () => {
        test('should extract bearer token from authorization header', () => {
            const token = generateToken('user-1', 'doctor1', 'doctor');
            const request = mockHttpRequest('GET', undefined, {
                authorization: `Bearer ${token}`
            });

            expect(extractTokenFromRequest(request)).toBe(token);
        });

        test('should extract token from session_token cookie header', () => {
            const token = generateToken('user-1', 'doctor1', 'doctor');
            const request = mockHttpRequest('GET', undefined, {
                cookie: `theme=dark; session_token=${encodeURIComponent(token)}`
            });

            expect(extractTokenFromRequest(request)).toBe(token);
        });

        test('should not extract token from legacy token cookie (removed)', () => {
            const token = generateToken('user-1', 'doctor1', 'doctor');
            const request = mockHttpRequest('GET', undefined, {
                cookie: `token=${encodeURIComponent(token)}`
            });

            expect(extractTokenFromRequest(request)).toBeNull();
        });

        test('should return null when token is missing', () => {
            const request = mockHttpRequest('GET');

            expect(extractTokenFromRequest(request)).toBeNull();
        });

        test('should ignore malformed authorization header', () => {
            const request = mockHttpRequest('GET', undefined, {
                authorization: 'Basic abc123'
            });

            expect(extractTokenFromRequest(request)).toBeNull();
        });
    });

    describe('decodeTokenUnsafe', () => {
        test('should decode token payload without verification', () => {
            const token = generateToken('user-2', 'viewer1', 'viewer');
            const payload = decodeTokenUnsafe(token);

            expect(payload).not.toBeNull();
            expect(payload.userId).toBe('user-2');
            expect(payload.username).toBe('viewer1');
            expect(payload.role).toBe('viewer');
        });

        test('should return null for malformed token', () => {
            expect(decodeTokenUnsafe('bad-token')).toBeNull();
        });
    });

    describe('isTokenExpired', () => {
        test('should return false for fresh token', () => {
            const token = generateToken('user-3', 'admin1', 'admin');

            expect(isTokenExpired(token)).toBe(false);
        });

        test('should return true for expired token', () => {
            const expiredToken = jwt.sign(
                { userId: 'user-4', username: 'doctor2', role: 'doctor' },
                process.env.JWT_SECRET || 'dev-secret-change-in-production',
                { expiresIn: -10, issuer: 'ag-forms-api', audience: 'ag-forms-client' }
            );

            expect(isTokenExpired(expiredToken)).toBe(true);
        });

        test('should return true for malformed token', () => {
            expect(isTokenExpired('bad-token')).toBe(true);
        });
    });

    describe('refreshToken', () => {
        test('should refresh a valid token', () => {
            const token = generateToken('user-5', 'doctor3', 'doctor');
            const refreshed = refreshToken(token);

            expect(refreshed).toBeDefined();

            const payload = verifyToken(refreshed as string);
            expect(payload.userId).toBe('user-5');
            expect(payload.username).toBe('doctor3');
            expect(payload.role).toBe('doctor');
        });

        test('should return null for invalid token refresh', () => {
            expect(refreshToken('invalid-token')).toBeNull();
        });
    });
});

// Made with Bob
