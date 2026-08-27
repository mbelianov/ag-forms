declare const describe: any;
declare const test: any;
declare const expect: any;

import { handleError } from '../../utils/errorHandler';
import { mockInvocationContext } from '../testUtils';

const parseBody = (response: any) => JSON.parse(response.body);

describe('errorHandler', () => {
    test('maps "Entity not found" to 404', () => {
        const response = handleError(new Error('Entity not found in Users'), mockInvocationContext());
        const body = parseBody(response);

        expect(response.status).toBe(404);
        expect(body.success).toBe(false);
    });

    test('maps "Entity already exists" to 409', () => {
        const response = handleError(new Error('Entity already exists in Users'), mockInvocationContext());
        const body = parseBody(response);

        expect(response.status).toBe(409);
        expect(body.success).toBe(false);
    });

    test('maps "Concurrency conflict" to 409', () => {
        const response = handleError(new Error('Concurrency conflict: stale etag'), mockInvocationContext());
        const body = parseBody(response);

        expect(response.status).toBe(409);
        expect(body.success).toBe(false);
    });

    test('maps validation failures to 400', () => {
        const response = handleError(new Error('Validation failed: bad field'), mockInvocationContext());
        const body = parseBody(response);

        expect(response.status).toBe(400);
        expect(body.success).toBe(false);
    });

    test.each([
        [400, 400],
        [404, 404],
        [412, 412],
        [429, 429],
        [500, 500],
        [503, 500]
    ])('maps statusCode %s to response %s', (statusCode: number, expectedStatus: number) => {
        const response = handleError({ message: 'storage failure', statusCode }, mockInvocationContext());
        const body = parseBody(response);

        expect(response.status).toBe(expectedStatus);
        expect(body.success).toBe(false);
    });

    test('returns 500 for unknown errors', () => {
        const response = handleError(new Error('Totally unexpected issue'), mockInvocationContext());
        const body = parseBody(response);

        expect(response.status).toBe(500);
        expect(body.success).toBe(false);
    });

    test('does not expose internal error details in the response body', () => {
        const response = handleError(
            new Error('Database crashed with connection string DefaultEndpointsProtocol=https;AccountKey=secret; stack trace here'),
            mockInvocationContext()
        );
        const bodyText = response.body as string;
        const body = parseBody(response);

        expect(response.status).toBe(500);
        expect(body.success).toBe(false);
        expect(bodyText).not.toContain('AccountKey=secret');
        expect(bodyText).not.toContain('stack trace here');
    });
});

// Made with Bob
