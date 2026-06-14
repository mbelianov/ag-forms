import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAuth, requireRole } from '../utils/authMiddleware';
import { handleError } from '../utils/errorHandler';
import { successResponse, unauthorizedResponse, forbiddenResponse } from '../utils/responseHelpers';
import { ensureTableExists } from '../utils/tableClient';
import { initializeCounterTable } from '../utils/mrnGenerator';
import { initializeAuditTable } from '../utils/auditService';

/**
 * Initialize all required Azure Table Storage tables
 * Admin-only endpoint for setting up the database structure
 */
export async function initializeTables(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
        // Extract and validate authentication
        const user = await requireAuth(request);
        if (!user) {
            return unauthorizedResponse();
        }

        // Check admin role
        const hasRole = requireRole(user, ['admin']);
        if (!hasRole) {
            return forbiddenResponse('Admin role required');
        }

        context.log('Initializing tables for user:', user.userId);

        // Initialize all required tables
        const tables = ['Users', 'Patients', 'Examinations', 'AuditLogs'];
        const createdTables: string[] = [];

        for (const tableName of tables) {
            await ensureTableExists(tableName);
            createdTables.push(tableName);
            context.log(`Table ${tableName} initialized`);
        }

        // Initialize counter table for MRN generation
        await initializeCounterTable();
        createdTables.push('Counters');
        context.log('Counter table initialized');

        // Initialize audit table structure
        await initializeAuditTable();
        context.log('Audit table structure initialized');

        return successResponse({
            message: 'All tables initialized successfully',
            tables: createdTables
        });
    } catch (error) {
        context.error('Error in initializeTables:', error);
        return handleError(error, context);
    }
}

app.http('InitializeTables', {
    methods: ['POST'],
    authLevel: 'function',
    route: 'v1/admin/initialize-tables',
    handler: initializeTables
});

// Made with Bob
