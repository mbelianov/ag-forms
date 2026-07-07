import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAuth, requireRole } from '../utils/authMiddleware';
import { handleError } from '../utils/errorHandler';
import { successResponse, unauthorizedResponse, forbiddenResponse, errorResponse } from '../utils/responseHelpers';
import { getEntity, updateEntity, ensureTableExists, getTableClient } from '../utils/tableClient';
import { validateExamination } from '../utils/validation';
import { logExaminationUpdated } from '../utils/auditService';
import { Examination } from '../types';

const EXAMINATIONS_TABLE = 'Examinations';

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

        const body = await request.json() as any;
        // Strip any client-supplied mrn — MRN is immutable once assigned
        const { mrn: _discardedMrn, examDate, gestationalAge, gestationalAgeFromBiometry, biometry, doppler, findings, notes, status, data, etag, examinationType, patientAgeAtExam } = body;

        // Require ETag for optimistic concurrency
        if (!etag) {
            return errorResponse('ETag is required for updates', 400);
        }

        // Validate update data (partial validation)
        const updateData: any = {};
        if (examDate !== undefined) updateData.examDate = examDate;
        if (gestationalAge !== undefined) updateData.gestationalAge = gestationalAge;
        if (gestationalAgeFromBiometry !== undefined) updateData.gestationalAgeFromBiometry = gestationalAgeFromBiometry;
        if (biometry !== undefined) updateData.biometry = biometry;
        if (doppler !== undefined) updateData.doppler = doppler;
        if (findings !== undefined) updateData.findings = findings;
        if (notes !== undefined) updateData.notes = notes;
        if (status !== undefined) updateData.status = status;
        if (data !== undefined) updateData.data = data;
        if (examinationType !== undefined) updateData.examinationType = examinationType;
        if (patientAgeAtExam !== undefined) updateData.patientAgeAtExam = patientAgeAtExam;

        // Add required fields for validation
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

        // Validate with patientId from existing exam
        const validationData = {
            patientId: existingExam.patientId,
            examDate: examDate || existingExam.examDate,
            status: status || existingExam.status,
            gestationalAge: gestationalAge !== undefined ? gestationalAge : existingExam.gestationalAge,
            gestationalAgeFromBiometry: gestationalAgeFromBiometry !== undefined ? gestationalAgeFromBiometry : existingExam.gestationalAgeFromBiometry,
            biometry: biometry !== undefined ? biometry : existingExam.biometry,
            doppler: doppler !== undefined ? doppler : existingExam.doppler,
            findings: findings !== undefined ? findings : existingExam.findings,
            notes: notes !== undefined ? notes : existingExam.notes,
            data: data !== undefined ? data : undefined,
            examinationType: examinationType !== undefined ? examinationType : existingExam.examinationType,
            patientAgeAtExam: patientAgeAtExam !== undefined ? patientAgeAtExam : existingExam.patientAgeAtExam
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
        if (gestationalAgeFromBiometry !== undefined && gestationalAgeFromBiometry !== existingExam.gestationalAgeFromBiometry) {
            updatedLookupEntity.gestationalAgeFromBiometry = gestationalAgeFromBiometry;
            changedFields.push('gestationalAgeFromBiometry');
        }
        if (biometry !== undefined) {
            // Serialize to JSON string for Azure Table Storage
            updatedLookupEntity.biometry = (typeof biometry === 'string' ? biometry : JSON.stringify(biometry)) as any;
            changedFields.push('biometry');
        }
        if (doppler !== undefined) {
            // Serialize to JSON string for Azure Table Storage
            updatedLookupEntity.doppler = (typeof doppler === 'string' ? doppler : JSON.stringify(doppler)) as any;
            changedFields.push('doppler');
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
            updatedLookupEntity.status = status;
            changedFields.push('status');
        }
        if (data !== undefined) {
            // Serialize to JSON string for Azure Table Storage
            updatedLookupEntity.data = (typeof data === 'string' ? data : JSON.stringify(data)) as any;
            changedFields.push('data');
        }
        if (examinationType !== undefined && examinationType !== existingExam.examinationType) {
            updatedLookupEntity.examinationType = examinationType;
            changedFields.push('examinationType');
        }
        if (patientAgeAtExam !== undefined && patientAgeAtExam !== existingExam.patientAgeAtExam) {
            updatedLookupEntity.patientAgeAtExam = patientAgeAtExam;
            changedFields.push('patientAgeAtExam');
        }

        updatedLookupEntity.updatedAt = now;
        updatedLookupEntity.updatedBy = user.userId;

        // Update lookup entity
        await updateEntity(EXAMINATIONS_TABLE, updatedLookupEntity);

        // Also update primary entity (PATIENT_{patientId} partition)
        // The primary entity has rowKey = "${reverseTicks}_${examinationId}" — query to find it
        const tableClient = getTableClient(EXAMINATIONS_TABLE);
        let primaryEntity: (Examination & any) | null = null;
        for await (const ent of tableClient.listEntities<Examination>({
            queryOptions: {
                filter: `PartitionKey eq 'PATIENT_${existingExam.patientId}' and examinationId eq '${examinationId}'`
            }
        })) {
            primaryEntity = ent;
            break;
        }

        if (primaryEntity) {
            const updatedPrimaryEntity: Examination & { updatedBy: string } = {
                ...primaryEntity,
                examDate: updatedLookupEntity.examDate,
                gestationalAge: updatedLookupEntity.gestationalAge,
                gestationalAgeFromBiometry: updatedLookupEntity.gestationalAgeFromBiometry,
                biometry: updatedLookupEntity.biometry,
                doppler: updatedLookupEntity.doppler,
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
    authLevel: 'function',
    route: 'v1/examinations/{id}',
    handler: updateExamination
});

// Made with Bob