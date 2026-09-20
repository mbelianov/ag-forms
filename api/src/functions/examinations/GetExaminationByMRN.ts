import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAuth } from '../../shared/auth/authMiddleware';
import { handleError } from '../../shared/http/errorHandler';
import { successResponse, unauthorizedResponse, notFoundResponse, errorResponse } from '../../shared/http/responseHelpers';
import { ensureTableExists, getEntity } from '../../shared/storage/tableClient';
import { isValidMRN } from '../../shared/mrn/mrnGenerator';
import { deserializeExaminationData } from '../../shared/storage/examinationSerializer';
import { Examination, MRNLookup } from '../../types';

const EXAMINATIONS_TABLE = 'Examinations';

export async function getExaminationByMRN(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
        const user = await requireAuth(request);
        if (!user) {
            return unauthorizedResponse('Authentication required');
        }

        const mrn = request.params.mrn;
        if (!mrn) {
            return errorResponse('MRN is required', 400);
        }

        if (!isValidMRN(mrn)) {
            return errorResponse('Invalid MRN format', 400);
        }

        await ensureTableExists(EXAMINATIONS_TABLE);

        // Look up MRN → examinationId via the MRN partition
        const mrnLookup = await getEntity<MRNLookup & { isDeleted?: boolean }>(
            EXAMINATIONS_TABLE,
            'MRN',
            mrn
        );

        if (!mrnLookup || mrnLookup.isDeleted) {
            return notFoundResponse('Examination not found');
        }

        // Fetch the full examination from the EXAM partition
        const examination = await getEntity<Examination>(
            EXAMINATIONS_TABLE,
            'EXAM',
            mrnLookup.examinationId
        );

        if (!examination || examination.isDeleted) {
            return notFoundResponse('Examination not found');
        }

        // ST-03: Deserialize the data blob using the shared utility
        const deserializedExamination = {
            ...examination,
            data: deserializeExaminationData(examination.data as any)
        };

        context.log('Examination retrieved by MRN:', { mrn, examinationId: examination.examinationId, requestedBy: user.userId });

        return successResponse({
            examination: deserializedExamination
        });
    } catch (error) {
        context.error('Error in getExaminationByMRN:', error);
        return handleError(error, context);
    }
}

app.http('GetExaminationByMRN', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'v1/examinations/mrn/{mrn}',
    handler: getExaminationByMRN
});

// Made with Bob
