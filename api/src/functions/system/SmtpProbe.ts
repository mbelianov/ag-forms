// TEMPORARY DIAGNOSTIC - verifies NFR-03 (outbound SMTP from the hosting environment).
// Never merge to master. See docs2/smtp-hosting-check-plan.md.
//
// Connects to a FIXED list of public SMTP servers and reports how far each connection gets.
// It never authenticates, never sends MAIL FROM / DATA, and never accepts a target from the caller.
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import * as dns from 'dns';
import * as net from 'net';
import * as tls from 'tls';
import { requireAuth, requireRole } from '../../shared/auth/authMiddleware';
import { handleError } from '../../shared/http/errorHandler';
import { successResponse, unauthorizedResponse, forbiddenResponse } from '../../shared/http/responseHelpers';

const TARGET_TIMEOUT_MS = 10000;
const EHLO_NAME = 'smtp-probe.invalid';

interface Target {
    host: string;
    port: number;
    mode: 'starttls' | 'tls';
    informational?: boolean;
}

interface ProbeResult {
    host: string;
    port: number;
    mode: string;
    informational: boolean;
    stagesCompleted: string[];
    ok: boolean;
    elapsedMs: number;
    tlsProtocol?: string;
    error?: string;
}

const TARGETS: Target[] = [
    { host: 'smtp.gmail.com', port: 587, mode: 'starttls' },
    { host: 'smtp.mail.yahoo.com', port: 587, mode: 'starttls' },
    { host: 'smtp.gmail.com', port: 465, mode: 'tls' },
    { host: 'smtp.mail.yahoo.com', port: 465, mode: 'tls' },
    { host: 'smtp.gmail.com', port: 25, mode: 'starttls', informational: true }
];

type AnySocket = net.Socket | tls.TLSSocket;

/** Reads one complete (possibly multi-line) SMTP reply; resolves with its lines. */
function readReply(socket: AnySocket): Promise<string[]> {
    return new Promise((resolve, reject) => {
        let buffer = '';
        const cleanup = () => {
            socket.off('data', onData);
            socket.off('error', onError);
            socket.off('close', onClose);
        };
        const onData = (chunk: Buffer) => {
            buffer += chunk.toString('latin1');
            const lines = buffer.split('\r\n').filter(l => l.length > 0);
            const last = lines[lines.length - 1];
            // A reply is complete when the last line is "NNN text" (space, not dash) and the buffer ended with CRLF.
            if (buffer.endsWith('\r\n') && last && /^\d{3}( |$)/.test(last)) {
                cleanup();
                resolve(lines);
            }
        };
        const onError = (err: Error) => { cleanup(); reject(err); };
        const onClose = () => { cleanup(); reject(new Error('CONNECTION_CLOSED')); };
        socket.on('data', onData);
        socket.once('error', onError);
        socket.once('close', onClose);
    });
}

function replyCode(lines: string[]): number {
    return parseInt(lines[lines.length - 1].slice(0, 3), 10);
}

function connectPlain(host: string, port: number): Promise<net.Socket> {
    return new Promise((resolve, reject) => {
        const socket = net.connect({ host, port });
        socket.once('connect', () => resolve(socket));
        socket.once('error', reject);
    });
}

function connectTls(host: string, port: number): Promise<tls.TLSSocket> {
    return new Promise((resolve, reject) => {
        // Certificate validation stays ON (default); servername is set for SNI and hostname verification.
        const socket = tls.connect({ host, port, servername: host });
        socket.once('secureConnect', () => resolve(socket));
        socket.once('error', reject);
    });
}

function upgradeToTls(socket: net.Socket, host: string): Promise<tls.TLSSocket> {
    return new Promise((resolve, reject) => {
        const secure = tls.connect({ socket, servername: host });
        secure.once('secureConnect', () => resolve(secure));
        secure.once('error', reject);
    });
}

function describeError(err: unknown): string {
    const e = err as NodeJS.ErrnoException;
    return String(e?.code || e?.message || 'UNKNOWN').slice(0, 80);
}

async function probeTarget(target: Target): Promise<ProbeResult> {
    const started = Date.now();
    const result: ProbeResult = {
        host: target.host,
        port: target.port,
        mode: target.mode,
        informational: !!target.informational,
        stagesCompleted: [],
        ok: false,
        elapsedMs: 0
    };
    let socket: AnySocket | undefined;
    let timer: NodeJS.Timeout | undefined;

    const run = async (): Promise<void> => {
        await dns.promises.lookup(target.host);
        result.stagesCompleted.push('dns');

        if (target.mode === 'tls') {
            const secure = await connectTls(target.host, target.port);
            socket = secure;
            result.stagesCompleted.push('tcp', 'tls');
            result.tlsProtocol = secure.getProtocol() || undefined;
            const greeting = await readReply(secure);
            if (replyCode(greeting) !== 220) throw new Error('UNEXPECTED_GREETING');
            result.stagesCompleted.push('greeting');
        } else {
            const plain = await connectPlain(target.host, target.port);
            socket = plain;
            result.stagesCompleted.push('tcp');
            const greeting = await readReply(plain);
            if (replyCode(greeting) !== 220) throw new Error('UNEXPECTED_GREETING');
            result.stagesCompleted.push('greeting');

            plain.write(`EHLO ${EHLO_NAME}\r\n`);
            const ehlo = await readReply(plain);
            if (replyCode(ehlo) !== 250) throw new Error('EHLO_REJECTED');
            if (!ehlo.some(line => /^250[- ]STARTTLS\b/i.test(line))) throw new Error('STARTTLS_NOT_ADVERTISED');

            plain.write('STARTTLS\r\n');
            const ready = await readReply(plain);
            if (replyCode(ready) !== 220) throw new Error('STARTTLS_REJECTED');
            result.stagesCompleted.push('starttls');

            const secure = await upgradeToTls(plain, target.host);
            socket = secure;
            result.stagesCompleted.push('tls');
            result.tlsProtocol = secure.getProtocol() || undefined;
        }
        result.ok = true;
    };

    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('ETIMEDOUT')), TARGET_TIMEOUT_MS);
    });

    try {
        await Promise.race([run(), timeout]);
    } catch (err) {
        result.error = describeError(err);
    } finally {
        if (timer) clearTimeout(timer);
        if (socket && !socket.destroyed) {
            try { socket.write('QUIT\r\n'); } catch { /* ignore */ }
            socket.destroy();
        }
        result.elapsedMs = Date.now() - started;
    }
    return result;
}

export async function smtpProbe(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
        const user = requireAuth(request);
        if (!user) {
            return unauthorizedResponse('Authentication required');
        }
        if (!requireRole(user, ['admin'])) {
            return forbiddenResponse('Admin role required');
        }

        const results = await Promise.all(TARGETS.map(probeTarget));
        context.log('SMTP probe finished', results.map(r => `${r.host}:${r.port}=${r.ok ? 'ok' : r.error}`));

        return successResponse({
            checkedAt: new Date().toISOString(),
            nodeVersion: process.version,
            results
        });
    } catch (error) {
        context.error('Error in smtpProbe:', error);
        return handleError(error, context);
    }
}

app.http('SmtpProbe', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'v1/diagnostics/smtp-probe',
    handler: smtpProbe
});
