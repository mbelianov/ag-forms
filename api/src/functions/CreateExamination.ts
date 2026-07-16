import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth, requireRole } from '../utils/authMiddleware';
import { handleError } from '../utils/errorHandler';
import { successResponse, unauthorizedResponse, forbiddenResponse, errorResponse } from '../utils/responseHelpers';
import { createEntity, ensureTableExists, getEntity } from '../utils/tableClient';
import { validateExamination } from '../utils/validation';
import { logExaminationCreated } from '../utils/auditService';
import { adjustCounter } from '../utils/counterService';
import { generateMRN } from '../utils/mrnGenerator';
import { Examination, Patient, MRNLookup } from '../types';

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
        const { patientId, examDate, gestationalAge, gestationalAgeFromBiometry, biometry, doppler, findings, notes, status, data, examinationType, patientAgeAtExam } = body;

        const validation = validateExamination({
            patientId,
            examDate,
            gestationalAge,
            gestationalAgeFromBiometry,
            biometry,
            doppler,
            findings,
            notes,
            status,
            data,
            examinationType,
            patientAgeAtExam
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

        // Compute patientAgeAtExam server-side if not supplied by client (FLAG-08)
        const resolvedPatientAge: number | undefined = patientAgeAtExam !== undefined
            ? patientAgeAtExam
            : (patient.birthDate && examDate
                ? Math.floor((new Date(examDate).getTime() - new Date(patient.birthDate).getTime()) / (365.25 * 24 * 3600 * 1000))
                : undefined);

        const examinationId = uuidv4();
        const now = new Date().toISOString();

        // Generate MRN using patient name at exam creation time
        const mrn = await generateMRN(patient.name);
        
        // Calculate reverse ticks for descending chronological order
        const reverseTicks = 9999999999999 - Date.now();

        // Serialize nested objects to JSON strings for Azure Table Storage
        const biometryStr = biometry ? JSON.stringify(biometry) : undefined;
        const dopplerStr = doppler ? JSON.stringify(doppler) : undefined;
        const dataStr = data ? JSON.stringify(data) : undefined;

        // Create primary examination entity (for patient's exam list)
        const primaryExamEntity: Examination & { updatedBy: string; patientNameLower: string } = {
            partitionKey: `PATIENT_${patientId}`,
            rowKey: `${reverseTicks}_${examinationId}`,
            examinationId,
            mrn,
            patientId,
            patientName: patient.name, // Denormalized for list views
            patientNameLower: patient.name.toLowerCase(), // Shadow field for case-insensitive search
            examDate,
            gestationalAge: gestationalAge || undefined,
            gestationalAgeFromBiometry: gestationalAgeFromBiometry || undefined,
            status,
            examinationType: examinationType || undefined,
            biometry: biometryStr as any,
            doppler: dopplerStr as any,
            findings: findings || undefined,
            notes: notes || undefined,
            data: dataStr as any,
            patientAgeAtExam: resolvedPatientAge,
            createdAt: now,
            updatedAt: now,
            createdBy: user.userId,
            createdByName: user.username, // Denormalized for list views
            updatedBy: user.userId,
            isDeleted: false
        };

        // Create lookup entity (for direct access by examination ID)
        const lookupExamEntity: Examination & { updatedBy: string; patientNameLower: string } = {
            partitionKey: 'EXAM',
            rowKey: examinationId,
            examinationId,
            mrn,
            patientId,
            patientName: patient.name,
            patientNameLower: patient.name.toLowerCase(), // Shadow field for case-insensitive search
            examDate,
            gestationalAge: gestationalAge || undefined,
            gestationalAgeFromBiometry: gestationalAgeFromBiometry || undefined,
            status,
            examinationType: examinationType || undefined,
            biometry: biometryStr as any,
            doppler: dopplerStr as any,
            findings: findings || undefined,
            notes: notes || undefined,
            data: dataStr as any,
            patientAgeAtExam: resolvedPatientAge,
            createdAt: now,
            updatedAt: now,
            createdBy: user.userId,
            createdByName: user.username, // Denormalized for list views
            updatedBy: user.userId,
            isDeleted: false
        };

        // Create MRN lookup entity (for lookup by MRN)
        const mrnLookupEntity: MRNLookup & { examDate: string; isDeleted: boolean } = {
            partitionKey: 'MRN',
            rowKey: mrn,
            mrn,
            examinationId,
            patientId,
            examDate,
            isDeleted: false
        };

        await createEntity(EXAMINATIONS_TABLE, primaryExamEntity);
        await createEntity(EXAMINATIONS_TABLE, lookupExamEntity);
        await createEntity(EXAMINATIONS_TABLE, mrnLookupEntity);

        adjustCounter('Counters', 'COUNTER', 'EXAM_TOTAL', 1).catch(err =>
            context.error('Failed to increment EXAM_TOTAL counter:', err)
        );

        await logExaminationCreated(user.userId, examinationId, patientId);

        context.log('Examination created:', { examinationId, mrn, patientId, createdBy: user.userId });

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
