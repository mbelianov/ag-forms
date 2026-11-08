import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAuth, requireRole } from '../../shared/auth/authMiddleware';
import { handleError } from '../../shared/http/errorHandler';
import {
    successResponse,
    errorResponse,
    unauthorizedResponse,
    forbiddenResponse,
    validationErrorResponse
} from '../../shared/http/responseHelpers';
import { ensureTableExists, getEntity, updateEntity } from '../../shared/storage/tableClient';
import { logExaminationEmailSent, logExaminationEmailFailed } from '../../shared/audit/auditService';
import { validateEmailReport } from '../../shared/validation/validation';
import { EXAM_TYPES } from '../../constants/examinationTypes';
import {
    EMAIL_PROVIDER_PARTITION,
    USERS_TABLE,
    loadMasterKey,
    decryptSecret,
    encryptSecret,
    sendEmail,
    EmailSendError,
    EmailCryptoAad,
    EncryptedEmailSecret,
    EMAIL_FAILURE_MESSAGES,
    DEFAULT_EMAIL_FOOTER
} from '../../shared/email';
import { Examination, Patient, EmailProviderSettings, EmailReportRequest } from '../../types';

const EXAMINATIONS_TABLE = 'Examinations';
const PATIENTS_TABLE = 'Patients';

/** Returns the label for an examination type key, or falls back to the raw key. */
function getExamTypeLabel(key: string | undefined): string {
    if (!key) return 'Examination';
    const found = EXAM_TYPES.find(t => t.key === key);
    return found ? found.label : key;
}

/** Formats the default attachment file name: {mrn}_{examDate}.pdf */
function defaultFileName(mrn: string, examDate: string): string {
    // Use YYYY-MM-DD portion of the ISO string; strip characters unsafe for file names.
    const datePart = (examDate || '').slice(0, 10).replace(/[^0-9-]/g, '') || 'date';
    const mrnPart = (mrn || 'report').replace(/[^A-Za-z0-9_-]/g, '_');
    return `${mrnPart}_${datePart}.pdf`;
}

/** Formats the default subject: Examination report — {label} — {YYYY-MM-DD} */
function defaultSubject(examinationType: string | undefined, examDate: string): string {
    const label = getExamTypeLabel(examinationType);
    const datePart = (examDate || '').slice(0, 10) || 'unknown date';
    return `Examination report \u2014 ${label} \u2014 ${datePart}`;
}

/**
 * POST /v1/examinations/{id}/email-report
 *
 * Sends the examination PDF to a recipient using the caller's saved SMTP provider settings.
 * Implements REQ-EML-03, REQ-EML-05, REQ-EML-06.
 *
 * Flow:
 *   auth → role → validate body → load examination (not deleted) → load patient → resolve
 *   recipient → validate → load provider (409 if missing) → decrypt secret → send → audit → 202
 *
 * All validation (including PDF checks) happens before any SMTP connection is opened (AC-4).
 */
export async function emailExaminationReport(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
        // ── 1. Auth & role ────────────────────────────────────────────────────
        const user = requireAuth(request);
        if (!user) {
            return unauthorizedResponse('Authentication required');
        }
        if (!requireRole(user, ['doctor', 'admin'])) {
            return forbiddenResponse('Doctor or admin role required');
        }

        // ── 2. Parse & validate body ──────────────────────────────────────────
        const body = await request.json() as EmailReportRequest;
        const validation = validateEmailReport(body);
        if (!validation.valid) {
            return validationErrorResponse(validation.errors);
        }

        const { recipient_email, subject, message, file_name, pdf_base64 } = body;

        // ── 3. Load examination ───────────────────────────────────────────────
        const examinationId = request.params.id;
        if (!examinationId) {
            return errorResponse('Examination ID is required', 400);
        }

        await ensureTableExists(EXAMINATIONS_TABLE);
        await ensureTableExists(PATIENTS_TABLE);

        const examination = await getEntity<Examination>(EXAMINATIONS_TABLE, 'EXAM', examinationId);
        if (!examination || examination.isDeleted) {
            return errorResponse('Examination not found', 404);
        }

        // ── 4. Load patient ───────────────────────────────────────────────────
        const patient = await getEntity<Patient>(PATIENTS_TABLE, 'PATIENT', examination.patientId);
        if (!patient || patient.isDeleted) {
            return errorResponse('Patient not found', 404);
        }

        // ── 5. Resolve recipient ──────────────────────────────────────────────
        const overrideEmail = recipient_email?.trim() || '';
        const profileEmail = patient.email?.trim() || '';
        const recipientOverridden = overrideEmail.length > 0;
        const resolvedRecipient = recipientOverridden ? overrideEmail : profileEmail;

        if (!resolvedRecipient) {
            return errorResponse('No recipient email available', 422);
        }

        // ── 6. Check master key (fail closed) ─────────────────────────────────
        try {
            loadMasterKey('current');
        } catch {
            return errorResponse('Email settings are temporarily unavailable', 500);
        }

        // ── 7. Load provider settings ─────────────────────────────────────────
        await ensureTableExists(USERS_TABLE);
        const row = await getEntity<EmailProviderSettings>(USERS_TABLE, EMAIL_PROVIDER_PARTITION, user.userId);
        if (!row) {
            return errorResponse(
                'Configure your email provider in Email Settings',
                409,
                undefined,
                'EMAIL_PROVIDER_NOT_CONFIGURED'
            );
        }

        // ── 8. Decrypt provider secret (AAD from the stored row, 7.3a) ────────
        const aad: EmailCryptoAad = {
            userId: user.userId,
            provider: row.provider,
            host: row.host,
            port: Number(row.port),
            security: row.security,
            username: row.username
        };

        let password: string;
        let keyRotated: boolean;
        try {
            const decrypted = decryptSecret(row, aad);
            password = decrypted.plaintext;
            keyRotated = decrypted.keyRotated;
        } catch {
            context.error('Email provider secret could not be decrypted for user:', user.userId);
            return errorResponse('Email settings are temporarily unavailable', 500);
        }

        // ── 9. Compose message ────────────────────────────────────────────────
        // Subject: from request or default
        const resolvedSubject = subject?.trim() || defaultSubject(examination.examinationType, examination.examDate);

        // Body: optional message + footer (profile footer or built-in default)
        const footer = row.footer?.trim() || DEFAULT_EMAIL_FOOTER;
        const emailBody = message?.trim()
            ? `${message.trim()}\n\n${footer}`
            : footer;

        // Attachment
        const cleanBase64 = pdf_base64.replace(/[\r\n\s]/g, '');
        const pdfBuffer = Buffer.from(cleanBase64, 'base64');
        const attachmentName = file_name?.trim() || defaultFileName(examination.mrn, examination.examDate);
        const pdfSizeKB = Math.round(pdfBuffer.length / 1024);

        // ── 10. Send email ────────────────────────────────────────────────────
        let failureCode: string | null = null;
        try {
            await sendEmail(
                {
                    host: row.host,
                    port: Number(row.port),
                    security: row.security,
                    username: row.username,
                    password
                },
                {
                    fromEmail: row.fromEmail,
                    fromName: row.fromName,
                    to: resolvedRecipient,
                    subject: resolvedSubject,
                    text: emailBody,
                    attachments: [{ filename: attachmentName, content: pdfBuffer, contentType: 'application/pdf' }]
                },
                { logger: context }
            );
        } catch (error: any) {
            failureCode = error instanceof EmailSendError ? error.code : 'EMAIL_CONNECTION_FAILED';
        }

        // ── 11. Re-encrypt if key rotated on a successful send (7.3b) ─────────
        if (!failureCode && keyRotated) {
            try {
                const rotated: Partial<EncryptedEmailSecret> = encryptSecret(password, aad);
                await updateEntity(USERS_TABLE, {
                    partitionKey: EMAIL_PROVIDER_PARTITION,
                    rowKey: user.userId,
                    ...rotated,
                    etag: row.etag
                } as any);
            } catch (err: any) {
                context.warn('Could not re-encrypt rotated key for user:', user.userId, err?.message);
            }
        }

        // ── 12. Audit (fire-and-forget) ───────────────────────────────────────
        if (failureCode) {
            await logExaminationEmailFailed(user.userId, examinationId, resolvedRecipient, failureCode);
            return errorResponse(
                EMAIL_FAILURE_MESSAGES[failureCode as keyof typeof EMAIL_FAILURE_MESSAGES] || EMAIL_FAILURE_MESSAGES.EMAIL_CONNECTION_FAILED,
                502,
                undefined,
                failureCode
            );
        }

        await logExaminationEmailSent(user.userId, user.username, {
            examinationId,
            patientId: patient.patientId,
            examinationStatus: examination.status,
            recipientEmail: resolvedRecipient,
            patientProfileEmail: profileEmail || null,
            recipientOverridden,
            fromEmail: row.fromEmail,
            pdfSizeKB,
            deliveryStatus: 'accepted'
        });

        context.log('Examination email accepted:', { examinationId, pdfSizeKB, sentBy: user.userId, recipientOverridden });

        return successResponse({
            message: 'Report accepted for delivery',
            recipient_email: resolvedRecipient,
            delivery_status: 'accepted',
            recipient_overridden: recipientOverridden
        }, 202);

    } catch (error) {
        context.error('Error in emailExaminationReport:', error);
        return handleError(error, context);
    }
}

app.http('EmailExaminationReport', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'v1/examinations/{id}/email-report',
    handler: emailExaminationReport
});

// Made with Bob
