import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

export async function HealthCheck(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    // No user input is read or reflected — static response only
    return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString() })
    };
};

app.http('HealthCheck', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'v1/health',
    handler: HealthCheck
});
