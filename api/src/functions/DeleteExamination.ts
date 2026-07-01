import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAuth } from '../utils/authMiddleware';
import { handleError } from '../utils/errorHandler';
import { successResponse, unauthorizedResponse, forbiddenResponse, errorResponse } from '../utils/responseHelpers';
import { getEntity, ensureTableExists, updateEntity } from '../utils/tableClient';
import { logExaminationDeleted } from '../utils/auditService';
import { Examination, MRNLookup } from '../types';

const EXAMINATIONS_TABLE = 'Examinations';

/**
 * Check if user is admin
 */
const isAdmin = (user: any): boolean => {
    return user.role === 'admin';
};

export async function deleteExamination(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
        const user = await requireAuth(request);
        if (!user) {
            return unauthorizedResponse('Authentication required');
        }

        // Only admins can delete examinations
        if (!isAdmin(user)) {
            return forbiddenResponse('Admin role required to delete examinations');
        }

        await ensureTableExists(EXAMINATIONS_TABLE);

        // Get examination ID from route parameter
        const examinationId = request.params.id;
        if (!examinationId) {
            return errorResponse('Examination ID is required', 400);
        }

        // Get examination from EXAM partition
        const examination = await getEntity<Examination>(
            EXAMINATIONS_TABLE,
            'EXAM',
            examinationId
        );

        if (!examination) {
            return errorResponse('Examination not found', 404);
        }

        if (examination.isDeleted) {
            return errorResponse('Examination is already deleted', 400);
        }

        const now = new Date().toISOString();

        // Soft delete lookup entity (EXAM partition)
        const deletedLookupEntity: Examination & { deletedBy: string } = {
            ...examination,
            isDeleted: true,
            deletedAt: now,
            deletedBy: user.userId
        };

        await updateEntity(EXAMINATIONS_TABLE, deletedLookupEntity);

        // Also soft delete primary entity (PATIENT_{patientId} partition)
        const primaryEntity = await getEntity<Examination>(
            EXAMINATIONS_TABLE,
            `PATIENT_${examination.patientId}`,
            examination.rowKey
        );

        if (primaryEntity) {
            const deletedPrimaryEntity: Examination & { deletedBy: string } = {
                ...primaryEntity,
                isDeleted: true,
                deletedAt: now,
                deletedBy: user.userId
            };

            await updateEntity(EXAMINATIONS_TABLE, deletedPrimaryEntity);
        }

        // Also soft delete MRN lookup entity (MRN partition)
        if (examination.mrn) {
            const mrnLookup = await getEntity<MRNLookup & { isDeleted: boolean; deletedAt?: string; deletedBy?: string }>(
                EXAMINATIONS_TABLE,
                'MRN',
                examination.mrn
            );

            if (mrnLookup) {
                const deletedMrnLookup = {
                    ...mrnLookup,
                    isDeleted: true,
                    deletedAt: now,
                    deletedBy: user.userId
                };
                await updateEntity(EXAMINATIONS_TABLE, deletedMrnLookup);
            }
        }

        await logExaminationDeleted(user.userId, examinationId);

        context.log('Examination soft deleted:', { examinationId, deletedBy: user.userId });

        return successResponse({
            message: 'Examination deleted successfully'
        });
    } catch (error) {
        context.error('Error in deleteExamination:', error);
        return handleError(error, context);
    }
}

app.http('DeleteExamination', {
    methods: ['DELETE'],
    authLevel: 'function',
    route: 'v1/examinations/{id}',
    handler: deleteExamination
});

// Made with Bob