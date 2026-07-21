import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getTableServiceClient } from "../utils/tableClient";

export async function HealthCheck(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    let storage: 'healthy' | 'degraded' = 'degraded';
    try {
        const client = getTableServiceClient();
        // Iterate at most one item to verify connectivity without loading all tables
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _table of client.listTables()) {
            break;
        }
        storage = 'healthy';
    } catch {
        storage = 'degraded';
    }

    return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'healthy', storage, timestamp: new Date().toISOString() })
    };
}

app.http('HealthCheck', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'v1/health',
    handler: HealthCheck
});
