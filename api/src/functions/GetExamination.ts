import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAuth } from '../utils/authMiddleware';
import { handleError } from '../utils/errorHandler';
import { successResponse, unauthorizedResponse, errorResponse } from '../utils/responseHelpers';
import { getEntity, ensureTableExists } from '../utils/tableClient';
import { deserializeExaminationData } from '../utils/examinationSerializer';
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

        // ST-03: Deserialize the data blob using the shared utility
        const deserializedExamination = {
            ...examination,
            data: deserializeExaminationData(examination.data as any)
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