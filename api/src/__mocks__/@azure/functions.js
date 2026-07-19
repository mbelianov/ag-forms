/**
 * Manual Jest mock for @azure/functions.
 *
 * Re-exports every real export from the package so tests have access to
 * HttpRequest, InvocationContext, etc., but replaces `app` with a silent
 * stub so that top-level app.http() registration calls in function files
 * produce no console.warn noise during test runs.
 */

const real = jest.requireActual('@azure/functions');

// Silent stub — every method (app.http, app.get, …) is a no-op
const app = new Proxy({}, {
    get() {
        return () => {};
    }
});

module.exports = { ...real, app };
