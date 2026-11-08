/**
 * Mail transport wrapper (Nodemailer behind an injectable factory)
 *
 * Implements spec NFR-01 / NFR-05 / NFR-07, REQ-EML-03 (3.8-3.10) and REQ-EML-05:
 * - STARTTLS -> `requireTLS` (mandatory upgrade); implicit TLS -> `secure`; plain SMTP is never offered.
 * - TLS >= 1.2, certificate validation always on (never disabled).
 * - Connect timeout 10 s, total send timeout 30 s.
 * - SSRF host re-check at send time; the connection is made to the resolved IP while the original
 *   hostname is kept as TLS servername (SNI + certificate verification).
 * - Provider errors are mapped to EMAIL_AUTH_FAILED / EMAIL_CONNECTION_FAILED / EMAIL_REJECTED.
 *   Clients only ever see the generic messages; details go to the server log without secrets.
 * - Header-injection sanitisation for every header-bound value.
 *
 * The transport factory and the DNS lookup are injectable so tests never open real connections.
 */

import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import { validateHost, DnsLookupFunction } from './hostGuard';
import { EmailSecurityMode } from '../../types';

export type EmailFailureCode = 'EMAIL_AUTH_FAILED' | 'EMAIL_CONNECTION_FAILED' | 'EMAIL_REJECTED';

/** Generic client-facing messages (REQ-EML-05). */
export const EMAIL_FAILURE_MESSAGES: Record<EmailFailureCode, string> = {
    EMAIL_AUTH_FAILED: 'Your mail provider rejected the login. For Google/Yahoo use an app password',
    EMAIL_CONNECTION_FAILED: 'Could not reach your mail server',
    EMAIL_REJECTED: 'Your mail provider rejected the message'
};

export const CONNECT_TIMEOUT_MS = 10000;
export const TOTAL_TIMEOUT_MS = 30000;
const MAX_LOGGED_RESPONSE_LENGTH = 200;

/** Error carrying only the mapped code; its message is always the generic client message. */
export class EmailSendError extends Error {
    public readonly code: EmailFailureCode;

    constructor(code: EmailFailureCode) {
        super(EMAIL_FAILURE_MESSAGES[code]);
        this.name = 'EmailSendError';
        this.code = code;
        Object.setPrototypeOf(this, EmailSendError.prototype);
    }
}

export interface SmtpConnectionConfig {
    host: string;
    port: number;
    security: EmailSecurityMode;
    username: string;
    password: string;
}

export interface OutgoingAttachment {
    filename: string;
    content: Buffer;
    contentType?: string;
}

export interface OutgoingMail {
    fromEmail: string;
    fromName?: string;
    to: string;
    subject: string;
    text: string;
    attachments?: OutgoingAttachment[];
}

/** Minimal transport surface used by the wrapper (satisfied by a Nodemailer transporter). */
export interface MailTransportLike {
    sendMail(mail: any): Promise<any>;
    close(): void;
}

export type MailTransportFactory = (options: SMTPTransport.Options) => MailTransportLike;

export interface WarnLogger {
    warn: (...args: any[]) => void;
}

export interface SendEmailOptions {
    transportFactory?: MailTransportFactory;
    lookup?: DnsLookupFunction;
    totalTimeoutMs?: number;
    logger?: WarnLogger;
}

const defaultTransportFactory: MailTransportFactory = (options) =>
    nodemailer.createTransport(options) as unknown as MailTransportLike;

// Test hooks (NFR-07): integration tests that call the HTTP handlers directly cannot pass options.
let hookTransportFactory: MailTransportFactory | undefined;
let hookLookup: DnsLookupFunction | undefined;

export const setEmailTransportTestHooks = (hooks: { transportFactory?: MailTransportFactory; lookup?: DnsLookupFunction }): void => {
    hookTransportFactory = hooks.transportFactory;
    hookLookup = hooks.lookup;
};

export const resetEmailTransportTestHooks = (): void => {
    hookTransportFactory = undefined;
    hookLookup = undefined;
};

// ── Sanitisation ────────────────────────────────────────────────────────────

/** Replaces CR/LF and other control characters with a space and trims (header injection). */
export const sanitizeHeaderValue = (value: string): string =>
    String(value ?? '').replace(/[\u0000-\u001F\u007F\u2028\u2029]+/g, ' ').trim();

const SINGLE_ADDRESS_PATTERN = /^[^\s<>(),;:"\\@]+@[^\s<>(),;:"\\@]+$/;

/** Returns a clean single address or throws EMAIL_REJECTED (never lets a list or display name through). */
export const sanitizeAddress = (value: string): string => {
    const cleaned = sanitizeHeaderValue(value);
    if (!SINGLE_ADDRESS_PATTERN.test(cleaned)) {
        throw new EmailSendError('EMAIL_REJECTED');
    }
    return cleaned;
};

const sanitizeFileName = (value: string): string => {
    const cleaned = sanitizeHeaderValue(value).replace(/[\\/"]/g, '_');
    return cleaned || 'report.pdf';
};

// ── Option building ─────────────────────────────────────────────────────────

/**
 * Builds the Nodemailer SMTP options. `resolvedIp` is the address to connect to; the original
 * hostname stays in `tls.servername` for SNI and certificate verification.
 */
export const buildTransportOptions = (
    connection: SmtpConnectionConfig,
    resolvedIp: string
): SMTPTransport.Options => {
    const implicitTls = connection.security === 'ssl';

    return {
        host: resolvedIp,
        port: connection.port,
        secure: implicitTls,
        requireTLS: !implicitTls,
        ignoreTLS: false,
        opportunisticTLS: false,
        auth: { user: connection.username, pass: connection.password },
        tls: {
            servername: connection.host,
            minVersion: 'TLSv1.2',
            rejectUnauthorized: true
        },
        connectionTimeout: CONNECT_TIMEOUT_MS,
        greetingTimeout: CONNECT_TIMEOUT_MS,
        socketTimeout: TOTAL_TIMEOUT_MS,
        disableFileAccess: true,
        disableUrlAccess: true,
        logger: false,
        debug: false
    };
};

export const buildMailMessage = (mail: OutgoingMail): Record<string, any> => {
    const address = sanitizeAddress(mail.fromEmail);
    const name = sanitizeHeaderValue(mail.fromName || '').replace(/["<>\\]/g, '');
    const from = name ? { name, address } : address;

    return {
        from,
        replyTo: from,
        to: sanitizeAddress(mail.to),
        subject: sanitizeHeaderValue(mail.subject),
        text: mail.text,
        attachments: (mail.attachments || []).map(a => ({
            filename: sanitizeFileName(a.filename),
            content: a.content,
            contentType: a.contentType || 'application/pdf'
        }))
    };
};

// ── Error mapping ───────────────────────────────────────────────────────────

const AUTH_RESPONSE_CODES = [530, 534, 535, 538];
const MESSAGE_COMMANDS = ['MAIL FROM', 'RCPT TO', 'DATA'];

/** Maps a Nodemailer / SMTP error to one of the three spec codes. Unknown errors are connection failures. */
export const mapSmtpError = (error: any): EmailFailureCode => {
    if (error instanceof EmailSendError) {
        return error.code;
    }

    const code = typeof error?.code === 'string' ? error.code : '';
    const command = typeof error?.command === 'string' ? error.command : '';
    const responseCode = Number(error?.responseCode) || 0;

    if (code === 'EAUTH' || AUTH_RESPONSE_CODES.includes(responseCode)) {
        return 'EMAIL_AUTH_FAILED';
    }
    if (code === 'EENVELOPE' || code === 'EMESSAGE') {
        return 'EMAIL_REJECTED';
    }
    if (responseCode >= 400 && responseCode < 600 && MESSAGE_COMMANDS.includes(command)) {
        return 'EMAIL_REJECTED';
    }
    return 'EMAIL_CONNECTION_FAILED';
};

const redact = (text: string, secret: string): string => {
    let result = text;
    if (secret) {
        result = result.split(secret).join('[REDACTED]');
    }
    return result.length > MAX_LOGGED_RESPONSE_LENGTH ? result.slice(0, MAX_LOGGED_RESPONSE_LENGTH) + '...' : result;
};

const logFailure = (
    logger: WarnLogger | undefined,
    mapped: EmailFailureCode,
    error: any,
    connection: SmtpConnectionConfig
): void => {
    const details = {
        mappedCode: mapped,
        smtpCode: typeof error?.code === 'string' ? error.code : undefined,
        command: typeof error?.command === 'string' ? error.command : undefined,
        responseCode: error?.responseCode,
        response: typeof error?.response === 'string' ? redact(error.response, connection.password) : undefined,
        host: connection.host,
        port: connection.port
    };
    (logger ? logger.warn.bind(logger) : console.warn)('Email send failed:', JSON.stringify(details));
};

// ── Sending ─────────────────────────────────────────────────────────────────

const pickAddress = (addresses: string[]): string =>
    addresses.find(a => !a.includes(':')) || addresses[0];

/**
 * Sends one message. Resolves when the provider accepted it; throws EmailSendError otherwise.
 * Never throws raw provider errors and never includes secrets in anything it logs or throws.
 */
export const sendEmail = async (
    connection: SmtpConnectionConfig,
    mail: OutgoingMail,
    options: SendEmailOptions = {}
): Promise<void> => {
    const factory = options.transportFactory || hookTransportFactory || defaultTransportFactory;
    const lookup = options.lookup || hookLookup;
    const totalTimeoutMs = options.totalTimeoutMs ?? TOTAL_TIMEOUT_MS;
    const logger = options.logger;

    // Build and sanitise the message before any connection is opened.
    const message = buildMailMessage(mail);

    // SSRF re-check at send time (DNS may have changed since the settings were saved).
    const hostCheck = await validateHost(connection.host, lookup);
    if (!hostCheck.allowed || hostCheck.addresses.length === 0) {
        (logger ? logger.warn.bind(logger) : console.warn)('Email host rejected by host guard at send time');
        throw new EmailSendError('EMAIL_CONNECTION_FAILED');
    }

    const resolvedIp = pickAddress(hostCheck.addresses);
    const transport = factory(buildTransportOptions(connection, resolvedIp));

    let timer: NodeJS.Timeout | undefined;
    try {
        await Promise.race([
            transport.sendMail(message),
            new Promise<never>((_, reject) => {
                timer = setTimeout(() => {
                    const timeoutError: any = new Error('Total send timeout');
                    timeoutError.code = 'ETIMEDOUT';
                    reject(timeoutError);
                }, totalTimeoutMs);
            })
        ]);
    } catch (error: any) {
        const mapped = mapSmtpError(error);
        logFailure(logger, mapped, error, connection);
        throw new EmailSendError(mapped);
    } finally {
        if (timer) clearTimeout(timer);
        try {
            transport.close();
        } catch {
            // closing is best effort
        }
    }
};

// Made with Bob
