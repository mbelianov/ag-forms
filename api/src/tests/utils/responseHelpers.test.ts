declare const describe: any;
declare const test: any;
declare const expect: any;

import { errorResponse, successResponse, validationErrorResponse } from '../../shared/http/responseHelpers';

const parseBody = (response: any) => JSON.parse(response.body);

describe('responseHelpers', () => {
    describe('errorResponse', () => {
        test('defaults error.code to ERROR and status to 400', () => {
            const response = errorResponse('Something failed');
            const body = parseBody(response);

            expect(response.status).toBe(400);
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('ERROR');
            expect(body.error.message).toBe('Something failed');
            expect(body.error.details).toBeUndefined();
        });

        test('keeps existing two- and three-argument callers unchanged', () => {
            const response = errorResponse('Bad', 422, { errors: ['x'] });
            const body = parseBody(response);

            expect(response.status).toBe(422);
            expect(body.error.code).toBe('ERROR');
            expect(body.error.details).toEqual({ errors: ['x'] });
        });

        test('uses the optional code parameter when provided', () => {
            const response = errorResponse('Email provider is not configured', 422, undefined, 'EMAIL_PROVIDER_NOT_CONFIGURED');
            const body = parseBody(response);

            expect(response.status).toBe(422);
            expect(body.error.code).toBe('EMAIL_PROVIDER_NOT_CONFIGURED');
            expect(body.error.message).toBe('Email provider is not configured');
            expect(body.error.details).toBeUndefined();
        });

        test('supports code together with details', () => {
            const response = errorResponse('Failed', 502, { hint: 'h' }, 'EMAIL_AUTH_FAILED');
            const body = parseBody(response);

            expect(body.error.code).toBe('EMAIL_AUTH_FAILED');
            expect(body.error.details).toEqual({ hint: 'h' });
        });

        test('still includes meta and CORS headers when a code is given', () => {
            const response: any = errorResponse('Failed', 502, undefined, 'EMAIL_REJECTED');
            const body = parseBody(response);

            expect(body.meta.request_id).toMatch(/^req_/);
            expect(response.headers['Content-Type']).toBe('application/json');
            expect(response.headers['Access-Control-Allow-Origin']).toBeDefined();
        });

        test('validationErrorResponse still reports code ERROR', () => {
            const body = parseBody(validationErrorResponse(['a']));

            expect(body.error.code).toBe('ERROR');
            expect(body.error.details).toEqual({ errors: ['a'] });
        });
    });

    describe('successResponse', () => {
        test('wraps data in the success envelope', () => {
            const response = successResponse({ ok: true }, 201);
            const body = parseBody(response);

            expect(response.status).toBe(201);
            expect(body.success).toBe(true);
            expect(body.data).toEqual({ ok: true });
        });
    });
});

// Made with Bob
