import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAuth } from '../utils/authMiddleware';
import { handleError } from '../utils/errorHandler';
import { successResponse, unauthorizedResponse } from '../utils/responseHelpers';
import { ensureTableExists, getTableClient } from '../utils/tableClient';
import { Patient } from '../types';

const PATIENTS_TABLE = 'Patients';
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

export async function getPatients(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
        const user = await requireAuth(request);
        if (!user) {
            return unauthorizedResponse('Authentication required');
        }

        await ensureTableExists(PATIENTS_TABLE);

        const continuationToken = request.query.get('continuationToken') || undefined;
        const requestedPageSize = parseInt(request.query.get('pageSize') || `${DEFAULT_PAGE_SIZE}`, 10);
        const pageSize = Math.min(
            MAX_PAGE_SIZE,
            Math.max(1, Number.isNaN(requestedPageSize) ? DEFAULT_PAGE_SIZE : requestedPageSize)
        );

        const tableClient = getTableClient(PATIENTS_TABLE);
        const filter = `PartitionKey eq 'PATIENT' and isDeleted eq false`;
        const patients: Patient[] = [];

        const pages = tableClient.listEntities<Patient>({
            queryOptions: { filter }
        }).byPage({
            continuationToken,
            maxPageSize: pageSize
        });

        let nextContinuationToken: string | undefined;

        for await (const page of pages) {
            for (const patient of page) {
                patients.push(patient as Patient);
            }
            nextContinuationToken = (page as any).continuationToken;
            break; // Only get the first page
        }

        context.log('Patients retrieved:', {
            count: patients.length,
            pageSize,
            hasContinuationToken: !!nextContinuationToken
        });

        return successResponse({
            patients,
            continuationToken: nextContinuationToken
        });
    } catch (error) {
        context.error('Error in getPatients:', error);
        return handleError(error, context);
    }
}

app.http('GetPatients', {
    methods: ['GET'],
    authLevel: 'function',
    route: 'v1/patients',
    handler: getPatients
});

// Made with Bob