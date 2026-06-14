import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAuth } from '../utils/authMiddleware';
import { handleError } from '../utils/errorHandler';
import { successResponse, unauthorizedResponse, notFoundResponse, errorResponse } from '../utils/responseHelpers';
import { ensureTableExists, getEntity } from '../utils/tableClient';
import { isValidMRN } from '../utils/mrnGenerator';
import { Patient, MRNLookup } from '../types';

const PATIENTS_TABLE = 'Patients';

export async function getPatientByMRN(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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

        await ensureTableExists(PATIENTS_TABLE);

        const mrnLookup = await getEntity<MRNLookup>(PATIENTS_TABLE, 'MRN', mrn);
        if (!mrnLookup) {
            return notFoundResponse('Patient not found');
        }

        const patient = await getEntity<Patient>(PATIENTS_TABLE, 'PATIENT', mrnLookup.patientId);
        if (!patient || patient.isDeleted) {
            return notFoundResponse('Patient not found');
        }

        context.log('Patient retrieved by MRN:', { mrn, patientId: patient.patientId, requestedBy: user.userId });

        return successResponse({
            patient
        });
    } catch (error) {
        context.error('Error in getPatientByMRN:', error);
        return handleError(error, context);
    }
}

app.http('GetPatientByMRN', {
    methods: ['GET'],
    authLevel: 'function',
    route: 'v1/patients/mrn/{mrn}',
    handler: getPatientByMRN
});

// Made with Bob