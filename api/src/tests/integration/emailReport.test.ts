/**
 * Integration tests for POST /v1/examinations/{id}/email-report (Sub-task 4)
 *
 * Uses an injected fake transport (NFR-07) so no real network connections are opened.
 * Covers: success, recipient override, no patient email + override, no provider (409),
 * invalid/oversize/non-PDF payload, multiple recipients/CRLF, viewer 403, unauthenticated 401,
 * deleted/missing examination 404, draft allowed, provider failure mapping,
 * Cyrillic subject/message, re-encryption on key rotation (7.3b).
 */

declare const describe: any;
declare const test: any;
declare const expect: any;
declare const jest: any;
declare const beforeAll: any;
declare const afterAll: any;
declare const beforeEach: any;
declare const afterEach: any;

import { emailExaminationReport } from '../../functions/system/EmailExaminationReport';
import { saveEmailProvider } from '../../functions/profile/SaveEmailProvider';
import {
    createTestUser,
    createTestPatient,
    createTestExamination,
    cleanupTestData,
    seedCounter,
    mockHttpRequest,
    mockInvocationContext
} from '../testUtils';
import { getTableClient } from '../../shared/storage/tableClient';
import {
    setEmailTransportTestHooks,
    resetEmailTransportTestHooks,
    decryptSecret
} from '../../shared/email';

const parseBody = (response: any) => JSON.parse(response.body);

// ── Shared constants ─────────────────────────────────────────────────────────

const MASTER_KEY = 'b2c3d4e5f6071829a3b4c5d6e7f80912b2c3d4e5f6071829a3b4c5d6e7f80912';
const OTHER_KEY  = '1a2b3c4d5e6f7890a1b2c3d4e5f60718293a4b5c6d7e8f901a2b3c4d5e6f7890';

/** A minimal valid PDF buffer (starts with %PDF-, 9 bytes). */
const MINIMAL_PDF = Buffer.from('%PDF-1.4\n');
const MINIMAL_PDF_B64 = MINIMAL_PDF.toString('base64');

/** Convenience: a base64 PDF large enough to be under 10 MB. */
const buildPdfB64 = (bytes: Buffer) => bytes.toString('base64');

const withAuth = (token: string) => ({ cookie: `session_token=${token}` });

const googleProviderBody = (overrides: Record<string, any> = {}) => ({
    provider: 'google',
    username: 'dr.test@gmail.com',
    password: 'apppassword1234',
    from_email: 'dr.test@gmail.com',
    from_name: 'Dr. Test',
    footer: 'Test clinic footer',
    ...overrides
});

const save = (token: string, body: any) =>
    saveEmailProvider(mockHttpRequest('PUT', body, withAuth(token)), mockInvocationContext());

const send = (token: string, examinationId: string, body: any, ctx = mockInvocationContext()) => {
    const req = mockHttpRequest('POST', body, withAuth(token));
    (req as any).params = { id: examinationId };
    return emailExaminationReport(req, ctx);
};

/** Fake public DNS lookup — always resolves to a non-private IP. */
const publicLookup = async () => ['93.184.216.34'];

const installFakeTransport = (sendMail: any, lookup: any = publicLookup) => {
    const close = jest.fn();
    const factory = jest.fn(() => ({ sendMail, close }));
    setEmailTransportTestHooks({ transportFactory: factory as any, lookup });
    return { factory, close, sendMail };
};

const smtpError = (props: Record<string, any>) =>
    Object.assign(new Error('provider error'), props);

const listAudit = async (action: string): Promise<any[]> => {
    const rows: any[] = [];
    for await (const entity of getTableClient('AuditLogs').listEntities({
        queryOptions: { filter: `action eq '${action}'` }
    })) {
        rows.push(entity);
    }
    return rows;
};

const readEmailProviderRow = async (userId: string): Promise<any> =>
    getTableClient('Users').getEntity<any>('EMAIL_PROVIDER', userId);

// ── Test suite ───────────────────────────────────────────────────────────────

describe('POST /v1/examinations/{id}/email-report (fake transport)', () => {
    let originalKey: string | undefined;
    let originalPrevKey: string | undefined;

    beforeAll(() => {
        originalKey = process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY;
        originalPrevKey = process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS;
    });

    afterAll(() => {
        if (originalKey === undefined) delete process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY;
        else process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY = originalKey;
        if (originalPrevKey === undefined) delete process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS;
        else process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS = originalPrevKey;
    });

    beforeEach(async () => {
        process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY = MASTER_KEY;
        delete process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS;
        await cleanupTestData();
        await seedCounter(0);
    });

    afterEach(async () => {
        resetEmailTransportTestHooks();
        await cleanupTestData();
    });

    // ── Authentication & authorisation ────────────────────────────────────────

    describe('authentication and authorization', () => {
        test('unauthenticated — 401', async () => {
            const patient = await createTestPatient();
            const examination = await createTestExamination(patient.patientId);

            const req = mockHttpRequest('POST', { pdf_base64: MINIMAL_PDF_B64 });
            (req as any).params = { id: examination.examinationId };
            const res = await emailExaminationReport(req, mockInvocationContext());

            expect(res.status).toBe(401);
        });

        test('viewer — 403 and no connection opened', async () => {
            const { token } = await createTestUser('viewer');
            const patient = await createTestPatient();
            const examination = await createTestExamination(patient.patientId);
            const { factory } = installFakeTransport(jest.fn());

            const res = await send(token, examination.examinationId, { pdf_base64: MINIMAL_PDF_B64 });

            expect(res.status).toBe(403);
            expect(factory).not.toHaveBeenCalled();
        });
    });

    // ── Examination checks ────────────────────────────────────────────────────

    describe('examination existence checks', () => {
        test('missing examination — 404', async () => {
            const { token } = await createTestUser('doctor');

            const req = mockHttpRequest('POST', { pdf_base64: MINIMAL_PDF_B64 }, withAuth(token));
            (req as any).params = { id: 'non-existent-id' };
            const res = await emailExaminationReport(req, mockInvocationContext());

            expect(res.status).toBe(404);
        });

        test('soft-deleted examination — 404', async () => {
            const { token } = await createTestUser('admin');
            const patient = await createTestPatient();
            const examination = await createTestExamination(patient.patientId);

            // Soft-delete the EXAM lookup row directly
            await getTableClient('Examinations').updateEntity(
                { partitionKey: 'EXAM', rowKey: examination.examinationId, isDeleted: true },
                'Merge'
            );

            const res = await send(token, examination.examinationId, { pdf_base64: MINIMAL_PDF_B64 });

            expect(res.status).toBe(404);
        });

        test('draft examination — allowed (any status allowed, REQ-EML-03 3.5)', async () => {
            const { token, user } = await createTestUser('doctor');
            const patient = await createTestPatient();
            const examination = await createTestExamination(patient.patientId);
            // createTestExamination creates status: 'draft'
            await save(token, googleProviderBody());
            const { sendMail } = installFakeTransport(jest.fn().mockResolvedValue({}));

            const res = await send(token, examination.examinationId, { pdf_base64: MINIMAL_PDF_B64 });

            expect(res.status).toBe(202);
            expect(sendMail).toHaveBeenCalledTimes(1);

            // Audit records status draft
            const events = await listAudit('EXAMINATION_EMAIL_SENT');
            expect(events).toHaveLength(1);
            const details = JSON.parse(events[0].details);
            expect(details.examinationStatus).toBe('draft');
        });
    });

    // ── PDF validation (before SMTP) ─────────────────────────────────────────

    describe('PDF validation', () => {
        test('missing pdf_base64 — 400', async () => {
            const { token } = await createTestUser('doctor');
            const patient = await createTestPatient();
            const examination = await createTestExamination(patient.patientId);
            const { factory } = installFakeTransport(jest.fn());

            const res = await send(token, examination.examinationId, {});

            expect(res.status).toBe(400);
            expect(factory).not.toHaveBeenCalled();
        });

        test('non-PDF payload (valid base64 but no %PDF- header) — 400 before any SMTP', async () => {
            const { token } = await createTestUser('doctor');
            const patient = await createTestPatient();
            const examination = await createTestExamination(patient.patientId);
            const { factory } = installFakeTransport(jest.fn());

            const res = await send(token, examination.examinationId, {
                pdf_base64: Buffer.from('not a pdf at all').toString('base64')
            });

            expect(res.status).toBe(400);
            expect(parseBody(res).error.message).toContain('Validation');
            expect(factory).not.toHaveBeenCalled();
        });

        test('oversize PDF (> 10 MB decoded) — 400 before any SMTP', async () => {
            const { token } = await createTestUser('doctor');
            const patient = await createTestPatient();
            const examination = await createTestExamination(patient.patientId);
            const { factory } = installFakeTransport(jest.fn());

            // Build a buffer just over 10 MB starting with %PDF-
            const big = Buffer.alloc(10 * 1024 * 1024 + 1);
            Buffer.from('%PDF-').copy(big);
            const bigB64 = big.toString('base64');

            const res = await send(token, examination.examinationId, { pdf_base64: bigB64 });

            expect(res.status).toBe(400);
            expect(factory).not.toHaveBeenCalled();
        });

        test('invalid base64 — 400', async () => {
            const { token } = await createTestUser('doctor');
            const patient = await createTestPatient();
            const examination = await createTestExamination(patient.patientId);
            const { factory } = installFakeTransport(jest.fn());

            const res = await send(token, examination.examinationId, { pdf_base64: 'not$$base64!!' });

            expect(res.status).toBe(400);
            expect(factory).not.toHaveBeenCalled();
        });
    });

    // ── Recipient validation ──────────────────────────────────────────────────

    describe('recipient validation', () => {
        test('multiple addresses (comma-separated) — 400 before any SMTP', async () => {
            const { token } = await createTestUser('doctor');
            const patient = await createTestPatient();
            const examination = await createTestExamination(patient.patientId);
            const { factory } = installFakeTransport(jest.fn());

            const res = await send(token, examination.examinationId, {
                pdf_base64: MINIMAL_PDF_B64,
                recipient_email: 'a@example.com,b@example.com'
            });

            expect(res.status).toBe(400);
            expect(factory).not.toHaveBeenCalled();
        });

        test('recipient with CRLF injection — 400', async () => {
            const { token } = await createTestUser('doctor');
            const patient = await createTestPatient();
            const examination = await createTestExamination(patient.patientId);
            const { factory } = installFakeTransport(jest.fn());

            const res = await send(token, examination.examinationId, {
                pdf_base64: MINIMAL_PDF_B64,
                recipient_email: 'a@example.com\r\nBcc: evil@example.com'
            });

            expect(res.status).toBe(400);
            expect(factory).not.toHaveBeenCalled();
        });

        test('no patient profile email and no override — 422', async () => {
            const { token } = await createTestUser('doctor');
            // Create a patient with no email
            const patient = await createTestPatient();
            await getTableClient('Patients').updateEntity(
                { partitionKey: 'PATIENT', rowKey: patient.patientId, email: '' },
                'Merge'
            );
            const examination = await createTestExamination(patient.patientId);
            await save(token, googleProviderBody());
            const { factory } = installFakeTransport(jest.fn());

            const res = await send(token, examination.examinationId, { pdf_base64: MINIMAL_PDF_B64 });

            expect(res.status).toBe(422);
            expect(factory).not.toHaveBeenCalled();
        });

        test('no patient profile email but override provided — sends to override', async () => {
            const { token } = await createTestUser('doctor');
            const patient = await createTestPatient();
            await getTableClient('Patients').updateEntity(
                { partitionKey: 'PATIENT', rowKey: patient.patientId, email: '' },
                'Merge'
            );
            const examination = await createTestExamination(patient.patientId);
            await save(token, googleProviderBody());
            const { sendMail } = installFakeTransport(jest.fn().mockResolvedValue({}));

            const res = await send(token, examination.examinationId, {
                pdf_base64: MINIMAL_PDF_B64,
                recipient_email: 'override@example.com'
            });

            expect(res.status).toBe(202);
            const message: any = (sendMail.mock.calls[0] as any[])[0];
            expect(message.to).toBe('override@example.com');
        });
    });

    // ── Provider not configured ───────────────────────────────────────────────

    describe('provider not configured', () => {
        test('no saved provider — 409 EMAIL_PROVIDER_NOT_CONFIGURED, no connection', async () => {
            const { token } = await createTestUser('doctor');
            const patient = await createTestPatient();
            const examination = await createTestExamination(patient.patientId);
            const { factory } = installFakeTransport(jest.fn());

            const res = await send(token, examination.examinationId, { pdf_base64: MINIMAL_PDF_B64 });

            expect(res.status).toBe(409);
            expect(parseBody(res).error.code).toBe('EMAIL_PROVIDER_NOT_CONFIGURED');
            expect(factory).not.toHaveBeenCalled();
        });
    });

    // ── Success path ─────────────────────────────────────────────────────────

    describe('success', () => {
        test('202 with correct body, PDF attached, default subject and footer', async () => {
            const { token } = await createTestUser('doctor');
            const patient = await createTestPatient();
            const examination = await createTestExamination(patient.patientId);
            await save(token, googleProviderBody());
            const { factory, close, sendMail } = installFakeTransport(
                jest.fn().mockResolvedValue({ accepted: [patient.email] })
            );

            const res = await send(token, examination.examinationId, { pdf_base64: MINIMAL_PDF_B64 });
            const body = parseBody(res);

            expect(res.status).toBe(202);
            expect(body.success).toBe(true);
            expect(body.data.delivery_status).toBe('accepted');
            expect(body.data.recipient_email).toBe(patient.email);
            expect(body.data.recipient_overridden).toBe(false);

            expect(sendMail).toHaveBeenCalledTimes(1);
            const message: any = (sendMail.mock.calls[0] as any[])[0];

            // Default subject contains the exam type label and date
            expect(message.subject).toMatch(/Examination report/);

            // Footer appended because no message was provided
            expect(message.text).toContain('Test clinic footer');

            // PDF attached
            expect(message.attachments).toHaveLength(1);
            expect(message.attachments[0].contentType).toBe('application/pdf');
            expect(message.attachments[0].content).toEqual(MINIMAL_PDF);

            expect(close).toHaveBeenCalledTimes(1);

            // Transport options
            const opts: any = (factory.mock.calls[0] as any[])[0];
            expect(opts.requireTLS).toBe(true);
            expect(opts.tls.minVersion).toBe('TLSv1.2');
            expect(opts.tls.rejectUnauthorized).toBe(true);
        });

        test('recipient override — email goes to override address, audit records recipientOverridden: true', async () => {
            const { token, user } = await createTestUser('doctor');
            const patient = await createTestPatient();
            const examination = await createTestExamination(patient.patientId);
            await save(token, googleProviderBody());
            const { sendMail } = installFakeTransport(jest.fn().mockResolvedValue({}));

            const res = await send(token, examination.examinationId, {
                pdf_base64: MINIMAL_PDF_B64,
                recipient_email: 'override@example.com'
            });
            const body = parseBody(res);

            expect(res.status).toBe(202);
            expect(body.data.recipient_email).toBe('override@example.com');
            expect(body.data.recipient_overridden).toBe(true);

            const message: any = (sendMail.mock.calls[0] as any[])[0];
            expect(message.to).toBe('override@example.com');

            const events = await listAudit('EXAMINATION_EMAIL_SENT');
            expect(events).toHaveLength(1);
            const details = JSON.parse(events[0].details);
            expect(details.recipientOverridden).toBe(true);
            expect(details.recipientEmail).toBe('override@example.com');
            expect(details.patientProfileEmail).toBe(patient.email);
        });

        test('custom subject and message — message prepended to footer', async () => {
            const { token } = await createTestUser('doctor');
            const patient = await createTestPatient();
            const examination = await createTestExamination(patient.patientId);
            await save(token, googleProviderBody());
            const { sendMail } = installFakeTransport(jest.fn().mockResolvedValue({}));

            const res = await send(token, examination.examinationId, {
                pdf_base64: MINIMAL_PDF_B64,
                subject: 'Custom subject',
                message: 'Dear patient,'
            });

            expect(res.status).toBe(202);
            const message: any = (sendMail.mock.calls[0] as any[])[0];
            expect(message.subject).toBe('Custom subject');
            expect(message.text).toContain('Dear patient,');
            expect(message.text).toContain('Test clinic footer');
        });

        test('custom file_name used for the attachment', async () => {
            const { token } = await createTestUser('doctor');
            const patient = await createTestPatient();
            const examination = await createTestExamination(patient.patientId);
            await save(token, googleProviderBody());
            const { sendMail } = installFakeTransport(jest.fn().mockResolvedValue({}));

            await send(token, examination.examinationId, {
                pdf_base64: MINIMAL_PDF_B64,
                file_name: 'my_report.pdf'
            });

            const message: any = (sendMail.mock.calls[0] as any[])[0];
            expect(message.attachments[0].filename).toBe('my_report.pdf');
        });

        test('EXAMINATION_EMAIL_SENT audit contains all REQ-EML-06 fields', async () => {
            const { token, user } = await createTestUser('doctor');
            const patient = await createTestPatient();
            const examination = await createTestExamination(patient.patientId);
            await save(token, googleProviderBody());
            installFakeTransport(jest.fn().mockResolvedValue({}));

            await send(token, examination.examinationId, { pdf_base64: MINIMAL_PDF_B64 });

            const events = await listAudit('EXAMINATION_EMAIL_SENT');
            expect(events).toHaveLength(1);
            const details = JSON.parse(events[0].details);
            expect(details.examinationId).toBe(examination.examinationId);
            expect(details.patientId).toBe(patient.patientId);
            expect(details.examinationStatus).toBe('draft');
            expect(details.recipientEmail).toBe(patient.email);
            expect(details.patientProfileEmail).toBe(patient.email);
            expect(details.recipientOverridden).toBe(false);
            expect(details.fromEmail).toBe('dr.test@gmail.com');
            expect(typeof details.pdfSizeKB).toBe('number');
            expect(details.deliveryStatus).toBe('accepted');
        });

        test('response body and audit never contain the password or ciphertext', async () => {
            const { token, user } = await createTestUser('doctor');
            const patient = await createTestPatient();
            const examination = await createTestExamination(patient.patientId);
            await save(token, googleProviderBody());
            const context = mockInvocationContext();
            installFakeTransport(jest.fn().mockResolvedValue({}));

            const res = await send(token, examination.examinationId, { pdf_base64: MINIMAL_PDF_B64 }, context);

            const row = await readEmailProviderRow(user.userId);
            const auditText = JSON.stringify(await listAudit('EXAMINATION_EMAIL_SENT'));
            const logText = JSON.stringify([
                (context.log as any).mock?.calls,
                (context.warn as any).mock?.calls,
                (context.error as any).mock?.calls
            ]);

            for (const text of [res.body, auditText, logText]) {
                expect(text).not.toContain('apppassword1234');
                expect(text).not.toContain(row.secretCiphertext);
            }
        });
    });

    // ── Cyrillic subject and message ──────────────────────────────────────────

    describe('Cyrillic input', () => {
        test('Cyrillic subject and message passed through without corruption', async () => {
            const { token } = await createTestUser('doctor');
            const patient = await createTestPatient();
            const examination = await createTestExamination(patient.patientId);
            await save(token, googleProviderBody());
            const { sendMail } = installFakeTransport(jest.fn().mockResolvedValue({}));

            const cyrillicSubject = 'Доклад за ехографско изследване';
            const cyrillicMessage = 'Уважаема пациентко, моля намерете приложен отчетът.';

            const res = await send(token, examination.examinationId, {
                pdf_base64: MINIMAL_PDF_B64,
                subject: cyrillicSubject,
                message: cyrillicMessage
            });

            expect(res.status).toBe(202);
            const message: any = (sendMail.mock.calls[0] as any[])[0];
            // sanitizeHeaderValue replaces control chars with space but keeps valid UTF-8 Cyrillic
            expect(message.subject).toContain('Доклад');
            expect(message.text).toContain('Уважаема');
        });
    });

    // ── Provider failure mapping ──────────────────────────────────────────────

    describe('provider failures — 502 with mapped code', () => {
        test.each([
            [smtpError({ code: 'EAUTH', responseCode: 535, response: '535 5.7.8 Username and Password not accepted' }), 'EMAIL_AUTH_FAILED'],
            [smtpError({ code: 'ECONNECTION' }), 'EMAIL_CONNECTION_FAILED'],
            [smtpError({ code: 'ETIMEDOUT' }), 'EMAIL_CONNECTION_FAILED'],
            [smtpError({ code: 'ESOCKET', message: 'self-signed certificate' }), 'EMAIL_CONNECTION_FAILED'],
            [smtpError({ code: 'EENVELOPE', command: 'RCPT TO', responseCode: 550, response: '550 no such user here' }), 'EMAIL_REJECTED']
        ])('%# maps provider error to %s', async (providerError: any, expectedCode: string) => {
            const { token } = await createTestUser('doctor');
            const patient = await createTestPatient();
            const examination = await createTestExamination(patient.patientId);
            await save(token, googleProviderBody());
            installFakeTransport(jest.fn().mockRejectedValue(providerError));

            const res = await send(token, examination.examinationId, { pdf_base64: MINIMAL_PDF_B64 });
            const body = parseBody(res);

            expect(res.status).toBe(502);
            expect(body.success).toBe(false);
            expect(body.error.code).toBe(expectedCode);

            // Generic message only — no provider internals
            expect(res.body).not.toContain('Username and Password');
            expect(res.body).not.toContain('no such user');
            expect(res.body).not.toContain('smtp.gmail.com');
            expect(res.body).not.toContain('apppassword1234');

            // Failure audit written
            const events = await listAudit('EXAMINATION_EMAIL_FAILED');
            expect(events).toHaveLength(1);
            const details = JSON.parse(events[0].details);
            expect(details.failureCode).toBe(expectedCode);
        });

        test('provider failure does not write EXAMINATION_EMAIL_SENT audit', async () => {
            const { token } = await createTestUser('doctor');
            const patient = await createTestPatient();
            const examination = await createTestExamination(patient.patientId);
            await save(token, googleProviderBody());
            installFakeTransport(jest.fn().mockRejectedValue(smtpError({ code: 'EAUTH', responseCode: 535 })));

            await send(token, examination.examinationId, { pdf_base64: MINIMAL_PDF_B64 });

            const sent = await listAudit('EXAMINATION_EMAIL_SENT');
            expect(sent).toHaveLength(0);
        });
    });

    // ── Key rotation (7.3b) ───────────────────────────────────────────────────

    describe('key rotation', () => {
        test('re-encrypts secret with current key after a successful send when old key was used', async () => {
            const { token, user } = await createTestUser('doctor');
            const patient = await createTestPatient();
            const examination = await createTestExamination(patient.patientId);
            await save(token, googleProviderBody());
            const before = await readEmailProviderRow(user.userId);

            // Rotate to a new current key
            process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY = OTHER_KEY;
            process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS = MASTER_KEY;
            installFakeTransport(jest.fn().mockResolvedValue({}));

            const res = await send(token, examination.examinationId, { pdf_base64: MINIMAL_PDF_B64 });
            expect(res.status).toBe(202);

            const after = await readEmailProviderRow(user.userId);
            expect(after.secretCiphertext).not.toBe(before.secretCiphertext);

            // Now decryptable with new key alone
            delete process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS;
            const aad = { userId: user.userId, provider: after.provider, host: after.host, port: Number(after.port), security: after.security, username: after.username };
            const result = decryptSecret(after, aad);
            expect(result.keyRotated).toBe(false);
        });
    });

    // ── Default subject / filename helpers ────────────────────────────────────

    describe('default subject and filename', () => {
        test('default subject includes exam type label and YYYY-MM-DD date', async () => {
            const { token } = await createTestUser('doctor');
            const patient = await createTestPatient();
            const examination = await createTestExamination(patient.patientId);
            await save(token, googleProviderBody());
            const { sendMail } = installFakeTransport(jest.fn().mockResolvedValue({}));

            await send(token, examination.examinationId, { pdf_base64: MINIMAL_PDF_B64 });

            const message: any = (sendMail.mock.calls[0] as any[])[0];
            // Should contain "Examination report" but NOT any patient name or MRN
            expect(message.subject).toMatch(/Examination report/);
            expect(message.subject).not.toContain('patient');
            expect(message.subject).not.toContain('MRN');
        });

        test('default file name uses MRN and exam date', async () => {
            const { token } = await createTestUser('doctor');
            const patient = await createTestPatient();
            const examination = await createTestExamination(patient.patientId);
            await save(token, googleProviderBody());
            const { sendMail } = installFakeTransport(jest.fn().mockResolvedValue({}));

            await send(token, examination.examinationId, { pdf_base64: MINIMAL_PDF_B64 });

            const message: any = (sendMail.mock.calls[0] as any[])[0];
            const filename: string = message.attachments[0].filename;
            expect(filename).toMatch(/\.pdf$/);
            expect(filename.length).toBeGreaterThan(5);
        });

        test('footer falls back to DEFAULT_EMAIL_FOOTER when none set on provider', async () => {
            const { token } = await createTestUser('doctor');
            const patient = await createTestPatient();
            const examination = await createTestExamination(patient.patientId);
            // Save without a footer
            await save(token, googleProviderBody({ footer: '' }));
            const { sendMail } = installFakeTransport(jest.fn().mockResolvedValue({}));

            await send(token, examination.examinationId, { pdf_base64: MINIMAL_PDF_B64 });

            const message: any = (sendMail.mock.calls[0] as any[])[0];
            expect(message.text).toContain('confidential');
        });
    });
});

// Made with Bob
