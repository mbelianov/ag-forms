import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAuth } from '../../shared/auth/authMiddleware';
import { handleError } from '../../shared/http/errorHandler';
import { successResponse, unauthorizedResponse, notFoundResponse, errorResponse } from '../../shared/http/responseHelpers';
import { ensureTableExists, getEntity } from '../../shared/storage/tableClient';
import { Patient } from '../../types';

const PATIENTS_TABLE = 'Patients';

export async function getPatient(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
        const user = await requireAuth(request);
        if (!user) {
            return unauthorizedResponse('Authentication required');
        }

        const patientId = request.params.id;
        if (!patientId) {
            return errorResponse('Patient ID is required', 400);
        }

        await ensureTableExists(PATIENTS_TABLE);

        const patient = await getEntity<Patient>(PATIENTS_TABLE, 'PATIENT', patientId);

        if (!patient || patient.isDeleted) {
            return notFoundResponse('Patient not found');
        }

        context.log('Patient retrieved:', { patientId, requestedBy: user.userId });

        return successResponse({
            patient
        });
    } catch (error) {
        context.error('Error in getPatient:', error);
        return handleError(error, context);
    }
}

app.http('GetPatient', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'v1/patients/{id}',
    handler: getPatient
});

// Made with Bob