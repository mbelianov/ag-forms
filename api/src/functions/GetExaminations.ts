import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAuth } from '../utils/authMiddleware';
import { handleError } from '../utils/errorHandler';
import { successResponse, unauthorizedResponse, errorResponse } from '../utils/responseHelpers';
import { getTableClient, ensureTableExists } from '../utils/tableClient';
import { Examination } from '../types';

const EXAMINATIONS_TABLE = 'Examinations';

export async function getExaminations(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
        const user = await requireAuth(request);
        if (!user) {
            return unauthorizedResponse('Authentication required');
        }

        await ensureTableExists(EXAMINATIONS_TABLE);

        // Get query parameters
        const patientId = request.query.get('patientId');
        const continuationToken = request.query.get('continuationToken') || undefined;
        const pageSizeParam = request.query.get('pageSize');
        
        // Parse and validate page size (default 50, max 100)
        let pageSize = 50;
        if (pageSizeParam) {
            const parsed = parseInt(pageSizeParam, 10);
            if (isNaN(parsed) || parsed < 1) {
                return errorResponse('Page size must be a positive number', 400);
            }
            pageSize = Math.min(parsed, 100);
        }

        let filter: string;

        if (patientId) {
            // Query specific patient's examinations
            const partitionKey = `PATIENT_${patientId}`;
            filter = `PartitionKey eq '${partitionKey}' and isDeleted eq false`;
        } else {
            // Query all examinations from EXAM partition
            filter = `PartitionKey eq 'EXAM' and isDeleted eq false`;
        }

        const tableClient = getTableClient(EXAMINATIONS_TABLE);
        const examinations: Examination[] = [];
        let nextContinuationToken: string | undefined = undefined;

        const entitiesIter = tableClient.listEntities<Examination>({
            queryOptions: { filter }
        }).byPage({
            maxPageSize: pageSize,
            continuationToken: continuationToken
        });

        // Get first page only
        for await (const page of entitiesIter) {
            for (const entity of page) {
                examinations.push(entity as Examination);
            }
            nextContinuationToken = page.continuationToken;
            break; // Only get first page
        }

        context.log('Examinations retrieved:', {
            count: examinations.length,
            patientId: patientId || 'all',
            hasMore: !!nextContinuationToken
        });

        return successResponse({
            examinations,
            continuationToken: nextContinuationToken,
            pageSize,
            count: examinations.length
        });
    } catch (error) {
        context.error('Error in getExaminations:', error);
        return handleError(error, context);
    }
}

app.http('GetExaminations', {
    methods: ['GET'],
    authLevel: 'function',
    route: 'v1/examinations',
    handler: getExaminations
});

// Made with Bob