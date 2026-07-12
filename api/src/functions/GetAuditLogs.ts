import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAuth, requireRole } from '../utils/authMiddleware';
import { handleError } from '../utils/errorHandler';
import { successResponse, unauthorizedResponse, forbiddenResponse } from '../utils/responseHelpers';
import { ensureTableExists, getTableClient } from '../utils/tableClient';
import { AuditLog } from '../types';

const AUDIT_TABLE = 'AuditLogs';
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

/**
 * Return the AUDIT_{yyyyMM} partition keys to scan.
 * When an explicit month (e.g. "202506") is provided only that partition is
 * queried; otherwise the current month and the previous month are included so
 * the default view always has recent data.
 */
function getPartitionKeys(month?: string): string[] {
    if (month) {
        return [`AUDIT_${month}`];
    }
    const now = new Date();
    const thisMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonth = `${prev.getFullYear()}${String(prev.getMonth() + 1).padStart(2, '0')}`;
    return [`AUDIT_${thisMonth}`, `AUDIT_${prevMonth}`];
}

export async function getAuditLogs(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
        const user = requireAuth(request);
        if (!user) {
            return unauthorizedResponse('Authentication required');
        }
        if (!requireRole(user, ['admin'])) {
            return forbiddenResponse('Admin role required');
        }

        await ensureTableExists(AUDIT_TABLE);

        const month = request.query.get('month') || undefined;
        const filterUser = request.query.get('user') || undefined;
        const filterAction = request.query.get('action') || undefined;
        const continuationTokenParam = request.query.get('continuationToken') || undefined;
        const requestedPageSize = parseInt(request.query.get('pageSize') || `${DEFAULT_PAGE_SIZE}`, 10);
        const pageSize = Math.min(
            MAX_PAGE_SIZE,
            Math.max(1, Number.isNaN(requestedPageSize) ? DEFAULT_PAGE_SIZE : requestedPageSize)
        );

        const tableClient = getTableClient(AUDIT_TABLE);
        const partitionKeys = getPartitionKeys(month);
        const logs: AuditLog[] = [];
        let nextContinuationToken: string | undefined;

        for (const partitionKey of partitionKeys) {
            if (logs.length >= pageSize) break;

            let filter = `PartitionKey eq '${partitionKey}'`;
            if (filterUser) {
                filter += ` and (userId eq '${filterUser}' or username eq '${filterUser}')`;
            }
            if (filterAction) {
                filter += ` and action eq '${filterAction}'`;
            }

            const pages = tableClient.listEntities<AuditLog>({
                queryOptions: { filter }
            }).byPage({
                continuationToken: partitionKeys.indexOf(partitionKey) === 0 ? continuationTokenParam : undefined,
                maxPageSize: pageSize - logs.length,
            });

            for await (const page of pages) {
                for (const entity of page) {
                    logs.push(entity as AuditLog);
                }
                nextContinuationToken = (page as any).continuationToken;
                break; // one page per partition per request
            }
        }

        context.log('Audit logs retrieved:', logs.length);

        return successResponse({ logs, continuationToken: nextContinuationToken });
    } catch (error) {
        context.error('Error in getAuditLogs:', error);
        return handleError(error, context);
    }
}

app.http('GetAuditLogs', {
    methods: ['GET'],
    authLevel: 'function',
    route: 'v1/audit-logs',
    handler: getAuditLogs,
});

// Made with Bob
