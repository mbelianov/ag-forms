import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth, requireRole } from '../utils/authMiddleware';
import { handleError } from '../utils/errorHandler';
import { successResponse, unauthorizedResponse, forbiddenResponse, errorResponse } from '../utils/responseHelpers';
import { createEntity, ensureTableExists } from '../utils/tableClient';
import { validatePatient } from '../utils/validation';
import { logPatientCreated } from '../utils/auditService';
import { Patient, BaseEntity } from '../types';

const PATIENTS_TABLE = 'Patients';

interface PatientSearchEntity extends BaseEntity {
    patientId: string;
    name: string;
    normalizedName: string;
    createdAt: string;
}

const normalizePatientName = (name: string): string => {
    return name.trim().toLowerCase().replace(/\s+/g, ' ');
};

const getSearchPartitionKey = (normalizedName: string): string => {
    const firstChar = normalizedName.charAt(0);
    // Use the Unicode code-point hex value as the bucket suffix so the partition
    // key remains pure ASCII and is safe for Azure Table Storage OData filters,
    // regardless of whether the patient name uses Latin, Cyrillic, or any other
    // Unicode script.  e.g. "a" -> "0061", "и" -> "0438".
    const bucket = firstChar
        ? firstChar.codePointAt(0)!.toString(16).padStart(4, '0')
        : 'unknown';
    return `PATIENT_SEARCH_${bucket}`;
};

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

        const body = await request.json() as any;
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

        context.log('Patient created:', { patientId, createdBy: user.userId });

        return successResponse({
            message: 'Patient created successfully',
            patient: patientEntity
        }, 201);
    } catch (error) {
        context.error('Error in createPatient:', error);
        return handleError(error, context);
    }
}

app.http('CreatePatient', {
    methods: ['POST'],
    authLevel: 'function',
    route: 'v1/patients',
    handler: createPatient
});

// Made with Bob
