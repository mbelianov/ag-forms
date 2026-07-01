import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAuth } from '../utils/authMiddleware';
import { handleError } from '../utils/errorHandler';
import { successResponse, unauthorizedResponse, notFoundResponse, errorResponse } from '../utils/responseHelpers';
import { ensureTableExists, getEntity } from '../utils/tableClient';
import { isValidMRN } from '../utils/mrnGenerator';
import { Examination, MRNLookup } from '../types';

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

        // Deserialize biometry/doppler from JSON strings back to objects
        const deserializedExamination = {
            ...examination,
            biometry: examination.biometry && typeof examination.biometry === 'string'
                ? JSON.parse(examination.biometry as any)
                : examination.biometry,
            doppler: examination.doppler && typeof examination.doppler === 'string'
                ? JSON.parse(examination.doppler as any)
                : examination.doppler
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
    authLevel: 'function',
    route: 'v1/examinations/mrn/{mrn}',
    handler: getExaminationByMRN
});

// Made with Bob
