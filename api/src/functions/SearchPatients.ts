import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAuth } from '../utils/authMiddleware';
import { handleError } from '../utils/errorHandler';
import { successResponse, unauthorizedResponse, errorResponse } from '../utils/responseHelpers';
import { ensureTableExists, queryEntities, getEntity } from '../utils/tableClient';
import { normalizePatientName, getSearchPartitionKey } from '../utils/patientUtils';
import { BaseEntity, Patient } from '../types';

const PATIENTS_TABLE = 'Patients';
const MAX_RESULTS = 1000;

interface PatientSearchEntity extends BaseEntity {
    patientId: string;
    name: string;
    normalizedName: string;
    createdAt: string;
}

export async function searchPatients(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
        const user = await requireAuth(request);
        if (!user) {
            return unauthorizedResponse('Authentication required');
        }

        const name = request.query.get('name');
        if (!name) {
            return errorResponse('Search parameter "name" is required', 400);
        }

        const normalizedSearch = normalizePatientName(name);
        if (normalizedSearch.length < 2) {
            return errorResponse('Search parameter "name" must be at least 2 characters long', 400);
        }

        await ensureTableExists(PATIENTS_TABLE);

        const searchPartitionKey = getSearchPartitionKey(normalizedSearch);
        const searchEntities = await queryEntities<PatientSearchEntity>(
            PATIENTS_TABLE,
            searchPartitionKey,
            normalizedSearch
        );

        const patients: Patient[] = [];

        for (const searchEntity of searchEntities) {
            if (patients.length >= MAX_RESULTS) {
                break;
            }

            const patient = await getEntity<Patient>(PATIENTS_TABLE, 'PATIENT', searchEntity.patientId);
            if (patient && !patient.isDeleted) {
                patients.push(patient);
            }
        }

        context.log('Patient search completed:', {
            searchTerm: normalizedSearch,
            resultCount: patients.length,
            requestedBy: user.userId
        });

        return successResponse({
            patients
        });
    } catch (error) {
        context.error('Error in searchPatients:', error);
        return handleError(error, context);
    }
}

// Route uses a dedicated path to avoid collision with v1/patients/{id}
app.http('SearchPatients', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'v1/patients-search',
    handler: searchPatients
});

// Made with Bob