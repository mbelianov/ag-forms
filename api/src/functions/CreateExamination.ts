import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth, requireRole } from '../utils/authMiddleware';
import { handleError } from '../utils/errorHandler';
import { successResponse, unauthorizedResponse, forbiddenResponse, errorResponse } from '../utils/responseHelpers';
import { createEntity, ensureTableExists, getEntity } from '../utils/tableClient';
import { validateExamination } from '../utils/validation';
import { logExaminationCreated } from '../utils/auditService';
import { Examination, Patient } from '../types';

const EXAMINATIONS_TABLE = 'Examinations';
const PATIENTS_TABLE = 'Patients';

export async function createExamination(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
        const user = await requireAuth(request);
        if (!user) {
            return unauthorizedResponse('Authentication required');
        }

        const hasRole = requireRole(user, ['doctor', 'admin']);
        if (!hasRole) {
            return forbiddenResponse('Doctor or admin role required');
        }

        const body = await request.json() as any;
        const { patientId, examDate, gestationalAge, biometry, doppler, findings, notes, status } = body;

        const validation = validateExamination({ 
            patientId, 
            examDate, 
            gestationalAge, 
            biometry, 
            doppler, 
            findings, 
            notes, 
            status 
        });
        if (!validation.valid) {
            return errorResponse(validation.errors.join(', '), 400);
        }

        await ensureTableExists(EXAMINATIONS_TABLE);
        await ensureTableExists(PATIENTS_TABLE);

        // Verify patient exists and is not deleted
        let patient: Patient;
        try {
            patient = await getEntity(PATIENTS_TABLE, 'PATIENT', patientId) as Patient;
        } catch (error) {
            return errorResponse('Patient not found', 404);
        }

        if (patient.isDeleted) {
            return errorResponse('Patient has been deleted', 400);
        }

        const examinationId = uuidv4();
        const now = new Date().toISOString();
        
        // Calculate reverse ticks for descending chronological order
        const reverseTicks = 9999999999999 - Date.now();

        // Create primary examination entity (for patient's exam list)
        const primaryExamEntity: Examination & { updatedBy: string } = {
            partitionKey: `PATIENT_${patientId}`,
            rowKey: `${reverseTicks}_${examinationId}`,
            examinationId,
            patientId,
            patientName: patient.name, // Denormalized for list views
            examDate,
            gestationalAge: gestationalAge || undefined,
            status,
            biometry: biometry || undefined,
            doppler: doppler || undefined,
            findings: findings || undefined,
            notes: notes || undefined,
            createdAt: now,
            updatedAt: now,
            createdBy: user.userId,
            updatedBy: user.userId,
            isDeleted: false
        };

        // Create lookup entity (for direct access by examination ID)
        const lookupExamEntity: Examination & { updatedBy: string } = {
            partitionKey: 'EXAM',
            rowKey: examinationId,
            examinationId,
            patientId,
            patientName: patient.name,
            examDate,
            gestationalAge: gestationalAge || undefined,
            status,
            biometry: biometry || undefined,
            doppler: doppler || undefined,
            findings: findings || undefined,
            notes: notes || undefined,
            createdAt: now,
            updatedAt: now,
            createdBy: user.userId,
            updatedBy: user.userId,
            isDeleted: false
        };

        await createEntity(EXAMINATIONS_TABLE, primaryExamEntity);
        await createEntity(EXAMINATIONS_TABLE, lookupExamEntity);

        await logExaminationCreated(user.userId, examinationId, patientId);

        context.log('Examination created:', { examinationId, patientId, createdBy: user.userId });

        return successResponse({
            message: 'Examination created successfully',
            examination: lookupExamEntity
        }, 201);
    } catch (error) {
        context.error('Error in createExamination:', error);
        return handleError(error, context);
    }
}

app.http('CreateExamination', {
    methods: ['POST'],
    authLevel: 'function',
    route: 'v1/examinations',
    handler: createExamination
});

// Made with Bob