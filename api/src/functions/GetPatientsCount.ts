import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAuth } from '../utils/authMiddleware';
import { handleError } from '../utils/errorHandler';
import { successResponse, unauthorizedResponse } from '../utils/responseHelpers';
import { getEntity } from '../utils/tableClient';
import { Counter } from '../types';

export async function getPatientsCount(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
        const user = await requireAuth(request);
        if (!user) {
            return unauthorizedResponse('Authentication required');
        }

        const counter = await getEntity<Counter>('Counters', 'COUNTER', 'PATIENT_TOTAL');
        const count = counter ? counter.value : 0;

        context.log('Patient count retrieved:', { count, requestedBy: user.userId });

        return successResponse({ count });
    } catch (error) {
        context.error('Error in getPatientsCount:', error);
        return handleError(error, context);
    }
}

app.http('GetPatientsCount', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'v1/patients-count',
    handler: getPatientsCount
});

// Made with Bob
