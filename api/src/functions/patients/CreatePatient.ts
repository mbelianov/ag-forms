import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth, requireRole } from '../../shared/auth/authMiddleware';
import { handleError } from '../../shared/http/errorHandler';
import { successResponse, unauthorizedResponse, forbiddenResponse, errorResponse } from '../../shared/http/responseHelpers';
import { createEntity, ensureTableExists } from '../../shared/storage/tableClient';
import { validatePatient } from '../../shared/validation/validation';
import { logPatientCreated } from '../../shared/audit/auditService';
import { adjustCounter } from '../../shared/storage/counterService';
import { normalizePatientName, getSearchPartitionKey } from '../../shared/patients/patientUtils';
import { Patient, BaseEntity } from '../../types';

const PATIENTS_TABLE = 'Patients';

interface PatientSearchEntity extends BaseEntity {
    patientId: string;
    name: string;
    normalizedName: string;
    createdAt: string;
}

export async function createPatient(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
        const user = await requireAuth(request);
        if (!user) {
            return unauthorizedResponse('Authentication required');
        }

        const hasRole = requireRole(user, ['doctor', 'admin']);
        if (!hasRole) {
            return forbiddenResponse('Doctor or admin role required');
        }

        interface PatientBody { name?: string; age?: number; birthDate?: string; phone?: string; email?: string; address?: string; }
        const body = await request.json() as PatientBody;
        const { name, age, birthDate, phone, email, address } = body;

        const validation = validatePatient({ name, age, birthDate, phone, email, address });
        if (!validation.valid) {
            return errorResponse(validation.errors.join(', '), 400);
        }

        await ensureTableExists(PATIENTS_TABLE);

        const patientId = uuidv4();
        const now = new Date().toISOString();
        const normalizedName = normalizePatientName(name);

        const patientEntity: Patient & { createdBy: string; updatedBy: string } = {
            partitionKey: 'PATIENT',
            rowKey: patientId,
            patientId,
            name: name.trim(),
            // TASK-038: store birthDate when provided; fall back to legacy age
            birthDate: birthDate || undefined,
            age: age !== undefined ? age : undefined,
            phone: phone.trim(),
            email: email ? email.trim() : undefined,
            address: address ? address.trim() : undefined,
            createdAt: now,
            updatedAt: now,
            isDeleted: false,
            createdBy: user.userId,
            updatedBy: user.userId
        };

        const searchEntity: PatientSearchEntity = {
            partitionKey: getSearchPartitionKey(normalizedName),
            rowKey: `${normalizedName}_${patientId}`,
            patientId,
            name: name.trim(),
            normalizedName,
            createdAt: now
        };

        await createEntity(PATIENTS_TABLE, patientEntity);
        await createEntity(PATIENTS_TABLE, searchEntity);

        await logPatientCreated(user.userId, patientId, patientEntity);

        adjustCounter('Counters', 'COUNTER', 'PATIENT_TOTAL', 1).catch(err =>
            context.error('Failed to increment PATIENT_TOTAL counter:', err)
        );

        context.log('Patient created:', { patientId, createdBy: user.userId });

        // Strip internal storage fields before returning — do not expose partitionKey, rowKey, isDeleted, etc.
        const { partitionKey, rowKey, isDeleted, createdBy, updatedBy, etag, timestamp, ...safePatient } = patientEntity as any;
        return successResponse({
            message: 'Patient created successfully',
            patient: safePatient
        }, 201);
    } catch (error) {
        context.error('Error in createPatient:', error);
        return handleError(error, context);
    }
}

app.http('CreatePatient', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'v1/patients',
    handler: createPatient
});

// Made with Bob
