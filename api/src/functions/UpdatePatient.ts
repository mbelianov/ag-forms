import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAuth, requireRole } from '../utils/authMiddleware';
import { handleError } from '../utils/errorHandler';
import { successResponse, unauthorizedResponse, forbiddenResponse, notFoundResponse, errorResponse, conflictResponse } from '../utils/responseHelpers';
import { ensureTableExists, getEntity, updateEntity, deleteEntity, createEntity } from '../utils/tableClient';
import { Patient, BaseEntity } from '../types';
import { validatePatient } from '../utils/validation';
import { logPatientUpdated } from '../utils/auditService';

const PATIENTS_TABLE = 'Patients';

interface PatientSearchEntity extends BaseEntity {
    patientId: string;
    name: string;
    normalizedName: string;
    mrn: string;
    createdAt: string;
}

const normalizePatientName = (name: string): string => {
    return name.trim().toLowerCase().replace(/\s+/g, ' ');
};

const getSearchPartitionKey = (normalizedName: string): string => {
    const firstLetter = normalizedName.charAt(0) || 'unknown';
    return `PATIENT_SEARCH_${firstLetter}`;
};

export async function updatePatient(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
        const user = await requireAuth(request);
        if (!user) {
            return unauthorizedResponse('Authentication required');
        }

        const hasRole = requireRole(user, ['doctor', 'admin']);
        if (!hasRole) {
            return forbiddenResponse('Doctor or admin role required');
        }

        const patientId = request.params.id;
        if (!patientId) {
            return errorResponse('Patient ID is required', 400);
        }

        const body = await request.json() as any;
        const { name, age, phone, email, address, etag } = body;

        if (!etag) {
            return errorResponse('ETag is required', 400);
        }

        await ensureTableExists(PATIENTS_TABLE);

        const existingPatient = await getEntity<Patient & { createdBy?: string; updatedBy?: string; deletedBy?: string }>(
            PATIENTS_TABLE,
            'PATIENT',
            patientId
        );

        if (!existingPatient || existingPatient.isDeleted) {
            return notFoundResponse('Patient not found');
        }

        const mergedPatientData = {
            name: name !== undefined ? name : existingPatient.name,
            age: age !== undefined ? age : existingPatient.age,
            phone: phone !== undefined ? phone : existingPatient.phone,
            email: email !== undefined ? email : existingPatient.email,
            address: address !== undefined ? address : existingPatient.address
        };

        const validation = validatePatient(mergedPatientData);
        if (!validation.valid) {
            return errorResponse(validation.errors.join(', '), 400);
        }

        const now = new Date().toISOString();
        const updatedPatient: Patient & { createdBy?: string; updatedBy: string; deletedBy?: string } = {
            ...existingPatient,
            name: mergedPatientData.name.trim(),
            age: mergedPatientData.age,
            phone: mergedPatientData.phone.trim(),
            email: mergedPatientData.email ? mergedPatientData.email.trim() : undefined,
            address: mergedPatientData.address ? mergedPatientData.address.trim() : undefined,
            updatedAt: now,
            updatedBy: user.userId,
            etag
        };

        const changes: Record<string, any> = {};
        if (existingPatient.name !== updatedPatient.name) changes.name = updatedPatient.name;
        if (existingPatient.age !== updatedPatient.age) changes.age = updatedPatient.age;
        if (existingPatient.phone !== updatedPatient.phone) changes.phone = updatedPatient.phone;
        if (existingPatient.email !== updatedPatient.email) changes.email = updatedPatient.email;
        if (existingPatient.address !== updatedPatient.address) changes.address = updatedPatient.address;

        const oldNormalizedName = normalizePatientName(existingPatient.name);
        const newNormalizedName = normalizePatientName(updatedPatient.name);

        try {
            await updateEntity(PATIENTS_TABLE, updatedPatient);
        } catch (error: any) {
            if (error.message.includes('Concurrency conflict')) {
                return conflictResponse('Patient was modified by another process. Please retry with the latest ETag.');
            }
            throw error;
        }

        if (oldNormalizedName !== newNormalizedName) {
            const oldSearchPartitionKey = getSearchPartitionKey(oldNormalizedName);
            const oldSearchRowKey = `${oldNormalizedName}_${patientId}`;

            try {
                await deleteEntity(PATIENTS_TABLE, oldSearchPartitionKey, oldSearchRowKey, '*');
            } catch (error: any) {
                if (!error.message.includes('not found')) {
                    throw error;
                }
            }

            const newSearchEntity: PatientSearchEntity = {
                partitionKey: getSearchPartitionKey(newNormalizedName),
                rowKey: `${newNormalizedName}_${patientId}`,
                patientId,
                name: updatedPatient.name,
                normalizedName: newNormalizedName,
                mrn: updatedPatient.mrn,
                createdAt: existingPatient.createdAt
            };

            await createEntity(PATIENTS_TABLE, newSearchEntity);
        }

        await logPatientUpdated(user.userId, patientId, changes);

        context.log('Patient updated:', {
            patientId,
            updatedBy: user.userId,
            changedFields: Object.keys(changes)
        });

        return successResponse({
            message: 'Patient updated successfully',
            patient: updatedPatient
        });
    } catch (error) {
        context.error('Error in updatePatient:', error);
        return handleError(error, context);
    }
}

app.http('UpdatePatient', {
    methods: ['PUT'],
    authLevel: 'function',
    route: 'v1/patients/{id}',
    handler: updatePatient
});

// Made with Bob