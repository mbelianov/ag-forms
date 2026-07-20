import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { odata } from '@azure/data-tables';
import { requireAuth } from '../utils/authMiddleware';
import { handleError } from '../utils/errorHandler';
import { successResponse, unauthorizedResponse, errorResponse } from '../utils/responseHelpers';
import { getTableClient, ensureTableExists } from '../utils/tableClient';
import { Examination } from '../types';
import { EXAM_TYPE_KEYS } from '../constants/examinationTypes';

const EXAMINATIONS_TABLE = 'Examinations';

export async function getExaminations(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
        const user = await requireAuth(request);
        if (!user) {
            return unauthorizedResponse('Authentication required');
        }

        await ensureTableExists(EXAMINATIONS_TABLE);

        // Get query parameters
        const patientId = request.query.get('patient_id');
        const examinationType = request.query.get('examination_type') || undefined;
        const continuationToken = request.query.get('continuationToken') || undefined;
        const status = request.query.get('status') || undefined;
        const fromDate = request.query.get('from_date') || undefined;
        const toDate = request.query.get('to_date') || undefined;
        const patientNameRaw = request.query.get('patient_name') || undefined;
        const patientName = patientNameRaw ? patientNameRaw.toLowerCase() : undefined;
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

        // Allowlist validation for enum parameters
        const VALID_STATUSES = ['draft', 'completed', 'reviewed'];
        if (status && !VALID_STATUSES.includes(status)) {
            return errorResponse(`Invalid status value. Must be one of: ${VALID_STATUSES.join(', ')}`, 400);
        }
        if (examinationType && !EXAM_TYPE_KEYS.includes(examinationType)) {
            return errorResponse(`Invalid examinationType value`, 400);
        }

        let filter: string;

        if (patientId) {
            // Query specific patient's examinations
            filter = odata`PartitionKey eq ${'PATIENT_' + patientId} and isDeleted eq false`;
        } else {
            // Query all examinations from EXAM partition
            filter = odata`PartitionKey eq ${'EXAM'} and isDeleted eq false`;
        }

        if (examinationType) {
            filter += odata` and examinationType eq ${examinationType}`;
        }

        if (status) {
            filter += odata` and status eq ${status}`;
        }

        if (fromDate) {
            filter += odata` and examDate ge ${fromDate}`;
        }

        if (toDate) {
            filter += odata` and examDate le ${toDate}`;
        }

        // patient_name range filter only applies to EXAM partition (no patient_id given)
        if (!patientId && patientName) {
            filter += odata` and patientNameLower ge ${patientName} and patientNameLower lt ${patientName + '\uFFFF'}`;
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
                const exam = entity as any;
                // Deserialize biometry/doppler from JSON strings
                examinations.push({
                    ...exam,
                    biometry: exam.biometry && typeof exam.biometry === 'string'
                        ? JSON.parse(exam.biometry)
                        : exam.biometry,
                    doppler: exam.doppler && typeof exam.doppler === 'string'
                        ? JSON.parse(exam.doppler)
                        : exam.doppler
                } as Examination);
            }
            nextContinuationToken = page.continuationToken;
            break; // Only get first page
        }

        context.log('Examinations retrieved:', {
            count: examinations.length,
            patientId: patientId || 'all',
            status: status || undefined,
            examinationType: examinationType || undefined,
            fromDate: fromDate || undefined,
            toDate: toDate || undefined,
            patientName: patientName || undefined,
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
    authLevel: 'anonymous',
    route: 'v1/examinations',
    handler: getExaminations
});

// Made with Bob