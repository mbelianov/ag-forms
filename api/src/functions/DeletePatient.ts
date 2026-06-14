import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAuth, isAdmin } from '../utils/authMiddleware';
import { handleError } from '../utils/errorHandler';
import { successResponse, unauthorizedResponse, forbiddenResponse, notFoundResponse, conflictResponse } from '../utils/responseHelpers';
import { ensureTableExists, getEntity, queryEntities, updateEntity } from '../utils/tableClient';
import { Patient, Examination } from '../types';
import { logPatientDeleted } from '../utils/auditService';

const PATIENTS_TABLE = 'Patients';

export async function deletePatient(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
        const user = await requireAuth(request);
        if (!user) {
            return unauthorizedResponse('Authentication required');
        }

        if (!isAdmin(user)) {
            return forbiddenResponse('Admin role required');
        }

        const patientId = request.params.id;
        if (!patientId) {
            return notFoundResponse('Patient not found');
        }

        await ensureTableExists(PATIENTS_TABLE);

        const patient = await getEntity<Patient & { deletedBy?: string; updatedBy?: string }>(
            PATIENTS_TABLE,
            'PATIENT',
            patientId
        );

        if (!patient || patient.isDeleted) {
            return notFoundResponse('Patient not found');
        }

        const examinations = await queryEntities<Examination>(PATIENTS_TABLE, `PATIENT_${patientId}`);
        const activeExaminations = examinations.filter(examination => !examination.isDeleted);

        if (activeExaminations.length > 0) {
            return conflictResponse('Patient cannot be deleted because examinations exist');
        }

        const now = new Date().toISOString();
        const deletedPatient: Patient & { deletedBy: string; updatedBy: string } = {
            ...patient,
            isDeleted: true,
            deletedAt: now,
            deletedBy: user.userId,
            updatedAt: now,
            updatedBy: user.userId
        };

        await updateEntity(PATIENTS_TABLE, deletedPatient);

        await logPatientDeleted(user.userId, patientId);

        context.log('Patient soft deleted:', {
            patientId,
            deletedBy: user.userId
        });

        return successResponse({
            message: 'Patient deleted successfully'
        });
    } catch (error) {
        context.error('Error in deletePatient:', error);
        return handleError(error, context);
    }
}

app.http('DeletePatient', {
    methods: ['DELETE'],
    authLevel: 'function',
    route: 'v1/patients/{id}',
    handler: deletePatient
});

// Made with Bob