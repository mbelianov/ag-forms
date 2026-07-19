import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAuth, requireRole } from '../utils/authMiddleware';
import { handleError } from '../utils/errorHandler';
import {
    successResponse,
    errorResponse,
    unauthorizedResponse,
    forbiddenResponse,
    notFoundResponse,
} from '../utils/responseHelpers';
import { getTableClient, getEntity, ensureTableExists, updateEntity, deleteEntity } from '../utils/tableClient';
import { logUserDeleted, logExaminationsReassigned } from '../utils/auditService';
import { Examination, MRNLookup } from '../types';

const USERS_TABLE = 'Users';
const EXAMINATIONS_TABLE = 'Examinations';

export async function deleteUser(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
        const tokenUser = requireAuth(request);
        if (!tokenUser) {
            return unauthorizedResponse('Authentication required');
        }
        if (!requireRole(tokenUser, ['admin'])) {
            return forbiddenResponse('Admin role required to delete users');
        }

        const userId = request.params.id;
        if (!userId) {
            return errorResponse('User ID is required', 400);
        }

        // Guard: cannot delete own account
        if (userId === tokenUser.userId) {
            return errorResponse('Cannot delete your own account', 400);
        }

        await ensureTableExists(USERS_TABLE);
        await ensureTableExists(EXAMINATIONS_TABLE);

        const usersTable = getTableClient(USERS_TABLE);

        // Fetch target user entity
        let targetUser: any;
        try {
            targetUser = await usersTable.getEntity('USER', userId);
        } catch (err: any) {
            if (err.statusCode === 404 || err.details?.errorCode === 'ResourceNotFound') {
                return notFoundResponse('User not found');
            }
            throw err;
        }

        if (targetUser.isDeleted) {
            return notFoundResponse('User not found');
        }

        // Guard: cannot delete the last active admin
        if (targetUser.role === 'admin') {
            const activeAdmins: any[] = [];
            const adminIter = usersTable.listEntities({
                queryOptions: {
                    filter: `PartitionKey eq 'USER' and isDeleted eq false and isActive eq true and role eq 'admin'`,
                },
            });
            for await (const entity of adminIter) {
                activeAdmins.push(entity);
            }
            if (activeAdmins.length <= 1) {
                return errorResponse('Cannot delete the last admin account', 400);
            }
        }

        // Parse optional request body for reassignTo
        let reassignTo: string | undefined;
        let reassignTargetUser: any | undefined;
        try {
            interface DeleteUserBody { reassignTo?: string; }
            const body = await request.json() as DeleteUserBody;
            if (body && body.reassignTo) {
                reassignTo = body.reassignTo;
            }
        } catch {
            // body is optional
        }

        // Validate reassignTo target if provided
        if (reassignTo) {
            try {
                reassignTargetUser = await usersTable.getEntity('USER', reassignTo);
            } catch (err: any) {
                if (err.statusCode === 404 || err.details?.errorCode === 'ResourceNotFound') {
                    return errorResponse('Reassign target user not found', 400);
                }
                throw err;
            }
            if (reassignTargetUser.isDeleted || !reassignTargetUser.isActive) {
                return errorResponse('Reassign target user is not active', 400);
            }
        }

        // Query all non-deleted examinations created by the target user (EXAM partition)
        const examinationsTable = getTableClient(EXAMINATIONS_TABLE);
        const examinations: Examination[] = [];
        const examIter = examinationsTable.listEntities<Examination>({
            queryOptions: {
                filter: `PartitionKey eq 'EXAM' and createdBy eq '${userId}' and isDeleted eq false`,
            },
        });
        for await (const entity of examIter) {
            examinations.push(entity as Examination);
        }

        // Guard: examinations exist but no reassignTo provided
        if (examinations.length > 0 && !reassignTo) {
            return errorResponse('User has examinations; provide reassignTo', 400);
        }

        // NOTE: Non-transactional race window — examinations created after the query but before
        // this loop finishes will not be reassigned. This is a known limitation of Azure Table
        // Storage's lack of multi-row transactions.
        if (examinations.length > 0 && reassignTo && reassignTargetUser) {
            for (const exam of examinations) {
                const newCreatedBy = reassignTargetUser.userId;
                const newCreatedByName = reassignTargetUser.username;

                // EXAM partition
                const examCopy = await getEntity<Examination>(EXAMINATIONS_TABLE, 'EXAM', exam.examinationId);
                if (examCopy) {
                    await updateEntity(EXAMINATIONS_TABLE, { ...examCopy, createdBy: newCreatedBy, createdByName: newCreatedByName, etag: '*' } as any);
                }

                // PATIENT_ partition
                const patientCopy = await getEntity<Examination>(
                    EXAMINATIONS_TABLE,
                    `PATIENT_${exam.patientId}`,
                    exam.rowKey
                );
                if (patientCopy) {
                    await updateEntity(EXAMINATIONS_TABLE, { ...patientCopy, createdBy: newCreatedBy, createdByName: newCreatedByName, etag: '*' } as any);
                }

                // MRN partition
                if (exam.mrn) {
                    const mrnCopy = await getEntity<MRNLookup & Examination>(EXAMINATIONS_TABLE, 'MRN', exam.mrn);
                    if (mrnCopy) {
                        await updateEntity(EXAMINATIONS_TABLE, { ...mrnCopy, createdBy: newCreatedBy, createdByName: newCreatedByName, etag: '*' } as any);
                    }
                }

                context.log('Examination reassigned:', { examinationId: exam.examinationId, from: userId, to: newCreatedBy });
            }
        }

        // Soft-delete the USER entity
        const now = new Date().toISOString();
        await usersTable.updateEntity(
            { ...targetUser, isDeleted: true, isActive: false, deletedAt: now },
            'Merge',
            { etag: '*' }
        );

        // Remove USERNAME lookup row
        const normalizedUsername: string = targetUser.normalizedUsername || targetUser.username?.toLowerCase();
        if (normalizedUsername) {
            try {
                await deleteEntity(USERS_TABLE, 'USERNAME', normalizedUsername);
            } catch {
                // USERNAME row may already be gone; non-fatal
            }
        }

        // Audit events (fire-and-forget)
        logUserDeleted(tokenUser.userId, userId, targetUser.username).catch(() => {});
        if (examinations.length > 0 && reassignTo) {
            logExaminationsReassigned(tokenUser.userId, userId, reassignTo, examinations.length).catch(() => {});
        }

        context.log('User soft deleted:', { userId, deletedBy: tokenUser.userId, reassignedExams: examinations.length });

        return successResponse({ message: 'User deleted successfully' });
    } catch (error) {
        context.error('Error in deleteUser:', error);
        return handleError(error, context);
    }
}

app.http('DeleteUser', {
    methods: ['DELETE'],
    authLevel: 'function',
    route: 'v1/users/{id}',
    handler: deleteUser,
});

// Made with Bob
