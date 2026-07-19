import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAuth, canAccessResource, isDoctor } from '../utils/authMiddleware';
import { handleError } from '../utils/errorHandler';
import { successResponse, unauthorizedResponse, forbiddenResponse, notFoundResponse } from '../utils/responseHelpers';
import { ensureTableExists, getEntity, queryEntities, updateEntity } from '../utils/tableClient';
import { Patient, Examination, MRNLookup } from '../types';
import { logPatientDeleted } from '../utils/auditService';
import { adjustCounter } from '../utils/counterService';

const PATIENTS_TABLE = 'Patients';
const EXAMINATIONS_TABLE = 'Examinations';

async function cascadeDeleteExaminations(
    examinations: Examination[],
    deletedBy: string,
    now: string,
    context: InvocationContext
): Promise<void> {
    for (const exam of examinations) {
        const softDeleteFields = { isDeleted: true, deletedAt: now, deletedBy };

        // Soft delete EXAM lookup entity
        const examLookup = await getEntity<Examination>(EXAMINATIONS_TABLE, 'EXAM', exam.examinationId);
        if (examLookup && !examLookup.isDeleted) {
            await updateEntity(EXAMINATIONS_TABLE, { ...examLookup, ...softDeleteFields });
        }

        // Soft delete primary entity (PATIENT_{patientId} partition)
        const primaryEntity = await getEntity<Examination>(
            EXAMINATIONS_TABLE,
            `PATIENT_${exam.patientId}`,
            exam.rowKey
        );
        if (primaryEntity && !primaryEntity.isDeleted) {
            await updateEntity(EXAMINATIONS_TABLE, { ...primaryEntity, ...softDeleteFields });
        }

        // Soft delete MRN lookup entity
        if (exam.mrn) {
            const mrnLookup = await getEntity<MRNLookup & { isDeleted: boolean; deletedAt?: string; deletedBy?: string }>(
                EXAMINATIONS_TABLE,
                'MRN',
                exam.mrn
            );
            if (mrnLookup && !mrnLookup.isDeleted) {
                await updateEntity(EXAMINATIONS_TABLE, { ...mrnLookup, ...softDeleteFields });
            }
        }

        context.log('Examination cascade-deleted:', { examinationId: exam.examinationId, deletedBy });
    }
}

export async function deletePatient(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
        const user = await requireAuth(request);
        if (!user) {
            return unauthorizedResponse('Authentication required');
        }

        // Only admins and doctors are allowed; viewers cannot delete
        if (!isDoctor(user)) {
            return forbiddenResponse('Doctor or admin role required');
        }

        const patientId = request.params.id;
        if (!patientId) {
            return notFoundResponse('Patient not found');
        }

        await ensureTableExists(PATIENTS_TABLE);
        await ensureTableExists(EXAMINATIONS_TABLE);

        const patient = await getEntity<Patient & { createdBy?: string; deletedBy?: string; updatedBy?: string }>(
            PATIENTS_TABLE,
            'PATIENT',
            patientId
        );

        if (!patient || patient.isDeleted) {
            return notFoundResponse('Patient not found');
        }

        // Doctors may only delete patients they created; admins may delete any
        if (!canAccessResource(user, patient.createdBy ?? '', 'delete')) {
            return forbiddenResponse('You do not have permission to delete this patient');
        }

        // Cascade: soft-delete all active examinations for this patient
        const allExaminations = await queryEntities<Examination>(EXAMINATIONS_TABLE, `PATIENT_${patientId}`);
        const activeExaminations = allExaminations.filter(e => !e.isDeleted);

        const now = new Date().toISOString();

        if (activeExaminations.length > 0) {
            await cascadeDeleteExaminations(activeExaminations, user.userId, now, context);
        }

        // Soft-delete the patient
        const deletedPatient: Patient & { deletedBy: string; updatedBy: string } = {
            ...patient,
            isDeleted: true,
            deletedAt: now,
            deletedBy: user.userId,
            updatedAt: now,
            updatedBy: user.userId
        };

        await updateEntity(PATIENTS_TABLE, deletedPatient);

        // Decrement PATIENT_TOTAL counter (non-fatal)
        adjustCounter('Counters', 'COUNTER', 'PATIENT_TOTAL', -1).catch(err =>
            context.error('Failed to decrement PATIENT_TOTAL counter:', err)
        );

        // Decrement EXAM_TOTAL counter by the number of cascade-deleted exams (non-fatal)
        if (activeExaminations.length > 0) {
            adjustCounter('Counters', 'COUNTER', 'EXAM_TOTAL', -activeExaminations.length).catch(err =>
                context.error('Failed to decrement EXAM_TOTAL counter:', err)
            );
        }

        await logPatientDeleted(user.userId, patientId);

        context.log('Patient soft deleted:', {
            patientId,
            deletedBy: user.userId,
            cascadedExaminations: activeExaminations.length
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
    authLevel: 'anonymous',
    route: 'v1/patients/{id}',
    handler: deletePatient
});

// Made with Bob