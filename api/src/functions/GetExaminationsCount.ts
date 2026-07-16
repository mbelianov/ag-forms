import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAuth } from '../utils/authMiddleware';
import { handleError } from '../utils/errorHandler';
import { successResponse, unauthorizedResponse } from '../utils/responseHelpers';
import { getEntity } from '../utils/tableClient';
import { Counter } from '../types';

export async function getExaminationsCount(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
        const user = await requireAuth(request);
        if (!user) {
            return unauthorizedResponse('Authentication required');
        }

        const counter = await getEntity<Counter>('Counters', 'COUNTER', 'EXAM_TOTAL');
        const count = counter ? counter.value : 0;

        context.log('Examination count retrieved:', { count, requestedBy: user.userId });

        return successResponse({ count });
    } catch (error) {
        context.error('Error in getExaminationsCount:', error);
        return handleError(error, context);
    }
}

app.http('GetExaminationsCount', {
    methods: ['GET'],
    authLevel: 'function',
    route: 'v1/examinations-count',
    handler: getExaminationsCount
});

// Made with Bob
