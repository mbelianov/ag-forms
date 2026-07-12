import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAuth } from '../utils/authMiddleware';
import { handleError } from '../utils/errorHandler';
import { successResponse, unauthorizedResponse } from '../utils/responseHelpers';
import { ensureTableExists, getTableClient } from '../utils/tableClient';

const PATIENTS_TABLE = 'Patients';

export async function getPatientsCount(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
        const user = await requireAuth(request);
        if (!user) {
            return unauthorizedResponse('Authentication required');
        }

        await ensureTableExists(PATIENTS_TABLE);

        const tableClient = getTableClient(PATIENTS_TABLE);
        const filter = `PartitionKey eq 'PATIENT' and isDeleted eq false`;

        let count = 0;
        for await (const _ of tableClient.listEntities({ queryOptions: { filter, select: ['PartitionKey'] } })) {
            count++;
        }

        context.log('Patient count retrieved:', { count, requestedBy: user.userId });

        return successResponse({ count });
    } catch (error) {
        context.error('Error in getPatientsCount:', error);
        return handleError(error, context);
    }
}

app.http('GetPatientsCount', {
    methods: ['GET'],
    authLevel: 'function',
    route: 'v1/patients-count',
    handler: getPatientsCount
});

// Made with Bob
