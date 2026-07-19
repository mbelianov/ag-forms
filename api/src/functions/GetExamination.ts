import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAuth } from '../utils/authMiddleware';
import { handleError } from '../utils/errorHandler';
import { successResponse, unauthorizedResponse, errorResponse } from '../utils/responseHelpers';
import { getEntity, ensureTableExists } from '../utils/tableClient';
import { Examination } from '../types';

const EXAMINATIONS_TABLE = 'Examinations';

export async function getExamination(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
        const user = await requireAuth(request);
        if (!user) {
            return unauthorizedResponse('Authentication required');
        }

        await ensureTableExists(EXAMINATIONS_TABLE);

        // Get examination ID from route parameter
        const examinationId = request.params.id;
        if (!examinationId) {
            return errorResponse('Examination ID is required', 400);
        }

        // Query examination using EXAM partition for direct access
        const examination = await getEntity<Examination>(
            EXAMINATIONS_TABLE,
            'EXAM',
            examinationId
        );

        if (!examination) {
            return errorResponse('Examination not found', 404);
        }

        if (examination.isDeleted) {
            return errorResponse('Examination has been deleted', 404);
        }

        context.log('Examination retrieved:', { examinationId });

        // Deserialize biometry/doppler/data from JSON strings back to objects
        const deserializedExamination = {
            ...examination,
            biometry: examination.biometry && typeof examination.biometry === 'string'
                ? JSON.parse(examination.biometry as any)
                : examination.biometry,
            doppler: examination.doppler && typeof examination.doppler === 'string'
                ? JSON.parse(examination.doppler as any)
                : examination.doppler,
            data: examination.data && typeof examination.data === 'string'
                ? JSON.parse(examination.data as any)
                : examination.data,
        };

        return successResponse({
            examination: deserializedExamination
        });
    } catch (error) {
        context.error('Error in getExamination:', error);
        return handleError(error, context);
    }
}

app.http('GetExamination', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'v1/examinations/{id}',
    handler: getExamination
});

// Made with Bob