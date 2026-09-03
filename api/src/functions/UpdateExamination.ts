import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAuth, requireRole } from '../utils/authMiddleware';
import { handleError } from '../utils/errorHandler';
import { successResponse, unauthorizedResponse, forbiddenResponse, errorResponse } from '../utils/responseHelpers';
import { getEntity, updateEntity, ensureTableExists } from '../utils/tableClient';
import { validateExamination } from '../utils/validation';
import { logExaminationUpdated } from '../utils/auditService';
import { serializeExaminationData, deserializeExaminationData } from '../utils/examinationSerializer';
import { Examination, Patient, ExaminationUpdateRequest } from '../types';

const EXAMINATIONS_TABLE = 'Examinations';
const PATIENTS_TABLE = 'Patients';

export async function updateExamination(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
        const user = await requireAuth(request);
        if (!user) {
            return unauthorizedResponse('Authentication required');
        }

        const hasRole = requireRole(user, ['doctor', 'admin']);
        if (!hasRole) {
            return forbiddenResponse('Doctor or admin role required');
        }

        await ensureTableExists(EXAMINATIONS_TABLE);

        // Get examination ID from route parameter
        const examinationId = request.params.id;
        if (!examinationId) {
            return errorResponse('Examination ID is required', 400);
        }

        const body = await request.json() as ExaminationUpdateRequest;
        // Strip any client-supplied mrn — MRN is immutable once assigned
        const {
            mrn: _discardedMrn, examDate, gestationalAge, gestationalAgeIsManual,
            findings, notes, status, data, etag, examinationType, patientAgeAtExam
        } = body;

        // Require ETag for optimistic concurrency
        if (!etag) {
            return errorResponse('ETag is required for updates', 400);
        }

        // Fetch the lookup entity (EXAM partition) — always available via direct key lookup
        const existingExam = await getEntity<Examination>(
            EXAMINATIONS_TABLE,
            'EXAM',
            examinationId
        );

        if (!existingExam) {
            return errorResponse('Examination not found', 404);
        }

        if (existingExam.isDeleted) {
            return errorResponse('Cannot update deleted examination', 400);
        }

        // Compute patientAgeAtExam server-side if not supplied by client (FLAG-08)
        let resolvedPatientAge: number | undefined = patientAgeAtExam !== undefined
            ? patientAgeAtExam
            : existingExam.patientAgeAtExam;

        if (patientAgeAtExam === undefined && !existingExam.patientAgeAtExam) {
            const resolvedExamDate = examDate || existingExam.examDate;
            try {
                const patient = await getEntity<Patient>(PATIENTS_TABLE, 'PATIENT', existingExam.patientId);
                if (patient?.birthDate && resolvedExamDate) {
                    resolvedPatientAge = Math.floor(
                        (new Date(resolvedExamDate).getTime() - new Date(patient.birthDate).getTime()) / (365.25 * 24 * 3600 * 1000)
                    );
                }
            } catch {
                // patient fetch failure is non-fatal for update
            }
        }

        // Validate with merged data
        const validationData = {
            patientId: existingExam.patientId,
            examDate: examDate || existingExam.examDate,
            status: status || existingExam.status,
            gestationalAge: gestationalAge !== undefined ? gestationalAge : existingExam.gestationalAge,
            gestationalAgeIsManual: gestationalAgeIsManual !== undefined ? gestationalAgeIsManual : existingExam.gestationalAgeIsManual,
            findings: findings !== undefined ? findings : existingExam.findings,
            notes: notes !== undefined ? notes : existingExam.notes,
            data: data !== undefined ? data : undefined,
            examinationType: examinationType !== undefined ? examinationType : existingExam.examinationType,
            patientAgeAtExam: resolvedPatientAge
        };

        const validation = validateExamination(validationData);
        if (!validation.valid) {
            return errorResponse(validation.errors.join(', '), 400);
        }

        const now = new Date().toISOString();
        const changedFields: string[] = [];

        // Update lookup entity (EXAM partition)
        const updatedLookupEntity: Examination & { updatedBy: string } = {
            ...existingExam,
            etag: etag,
            updatedBy: user.userId,
            updatedAt: now
        };

        if (examDate !== undefined && examDate !== existingExam.examDate) {
            updatedLookupEntity.examDate = examDate;
            changedFields.push('examDate');
        }
        if (gestationalAge !== undefined && gestationalAge !== existingExam.gestationalAge) {
            updatedLookupEntity.gestationalAge = gestationalAge;
            changedFields.push('gestationalAge');
        }
        if (gestationalAgeIsManual !== undefined && gestationalAgeIsManual !== existingExam.gestationalAgeIsManual) {
            updatedLookupEntity.gestationalAgeIsManual = gestationalAgeIsManual;
            changedFields.push('gestationalAgeIsManual');
        }
        if (findings !== undefined && findings !== existingExam.findings) {
            updatedLookupEntity.findings = findings;
            changedFields.push('findings');
        }
        if (notes !== undefined && notes !== existingExam.notes) {
            updatedLookupEntity.notes = notes;
            changedFields.push('notes');
        }
        if (status !== undefined && status !== existingExam.status) {
            updatedLookupEntity.status = status as 'completed' | 'draft' | 'reviewed';
            changedFields.push('status');
        }
        if (data !== undefined) {
            // ST-03: Serialize using the shared utility
            updatedLookupEntity.data = serializeExaminationData(data) as any;
            changedFields.push('data');
        }
        if (examinationType !== undefined && examinationType !== existingExam.examinationType) {
            updatedLookupEntity.examinationType = examinationType;
            changedFields.push('examinationType');
        }
        if (resolvedPatientAge !== undefined && resolvedPatientAge !== existingExam.patientAgeAtExam) {
            updatedLookupEntity.patientAgeAtExam = resolvedPatientAge;
            changedFields.push('patientAgeAtExam');
        }

        updatedLookupEntity.updatedAt = now;
        updatedLookupEntity.updatedBy = user.userId;

        // Update lookup entity
        await updateEntity(EXAMINATIONS_TABLE, updatedLookupEntity);

        // ST-02: Use primaryRowKey for O(1) direct lookup of the primary entity —
        //        replaces the old for-await partition scan.
        if (existingExam.primaryRowKey) {
            const primaryEntity = await getEntity<Examination>(
                EXAMINATIONS_TABLE,
                `PATIENT_${existingExam.patientId}`,
                existingExam.primaryRowKey
            );

            if (primaryEntity) {
                const updatedPrimaryEntity: Examination & { updatedBy: string } = {
                    ...primaryEntity,
                    examDate: updatedLookupEntity.examDate,
                    gestationalAge: updatedLookupEntity.gestationalAge,
                    findings: updatedLookupEntity.findings,
                    notes: updatedLookupEntity.notes,
                    status: updatedLookupEntity.status,
                    examinationType: updatedLookupEntity.examinationType,
                    data: updatedLookupEntity.data,
                    patientAgeAtExam: updatedLookupEntity.patientAgeAtExam,
                    updatedAt: now,
                    updatedBy: user.userId
                };

                await updateEntity(EXAMINATIONS_TABLE, updatedPrimaryEntity);
            }
        }

        await logExaminationUpdated(user.userId, examinationId, changedFields);

        context.log('Examination updated:', { examinationId, changedFields, updatedBy: user.userId });

        // Return updated entity without etag in response
        const responseEntity = { ...updatedLookupEntity };
        delete responseEntity.etag;

        return successResponse({
            message: 'Examination updated successfully',
            examination: responseEntity
        });
    } catch (error: any) {
        context.error('Error in updateExamination:', error);
        
        // Handle concurrency conflicts
        if (error.message && error.message.includes('Concurrency conflict')) {
            return errorResponse('Examination was modified by another user. Please refresh and try again.', 409);
        }
        
        return handleError(error, context);
    }
}

app.http('UpdateExamination', {
    methods: ['PUT'],
    authLevel: 'anonymous',
    route: 'v1/examinations/{id}',
    handler: updateExamination
});

// Made with Bob
