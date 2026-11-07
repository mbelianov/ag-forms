/**
 * Audit Service
 * Handles audit logging for security and compliance
 */

import { v4 as uuidv4 } from 'uuid';
import { InvocationContext } from '@azure/functions';
import { AuditLog } from '../../types';
import { createEntity, ensureTableExists } from '../storage/tableClient';

// Table name for audit logs
const AUDIT_TABLE = 'AuditLogs';

/**
 * Initialize audit table (should be called on application startup)
 */
export const initializeAuditTable = async (): Promise<void> => {
    await ensureTableExists(AUDIT_TABLE);
};

/**
 * Log an audit event
 * Creates an audit log entry in Azure Table Storage
 * 
 * Partition Key: AUDIT_{yyyyMM} for time-based retention
 * Row Key: {timestamp}_{auditId} for chronological ordering
 * 
 * @param action - Action being audited (e.g., "USER_LOGIN", "PATIENT_CREATED")
 * @param userId - ID of the user performing the action
 * @param details - Additional context (must not contain sensitive data)
 * @param username - Username (optional, for readability)
 * @param ipAddress - IP address (optional)
 * @param userAgent - User agent string (optional)
 * @param context - Azure Functions invocation context for structured logging (optional)
 * @returns Promise<void>
 */
export const logAuditEvent = async (
    action: string,
    userId: string,
    details: Record<string, any>,
    username?: string,
    ipAddress?: string,
    userAgent?: string,
    context?: Pick<InvocationContext, 'error'>
): Promise<void> => {
    try {
        // Ensure table exists
        await ensureTableExists(AUDIT_TABLE);

        const now = new Date();
        const auditId = uuidv4();
        const timestamp = now.toISOString();

        // Create partition key based on year-month for time-based retention
        const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
        const partitionKey = `AUDIT_${yearMonth}`;

        // Create row key with timestamp for chronological ordering
        const rowKey = `${timestamp}_${auditId}`;

        // Sanitize details to ensure no sensitive data is logged
        const sanitizedDetails = sanitizeAuditDetails(details);

        const auditLog: AuditLog = {
            partitionKey,
            rowKey,
            auditId,
            action,
            userId,
            username,
            actionTimestamp: timestamp,
            details: JSON.stringify(sanitizedDetails),
            ipAddress,
            userAgent
        };

        await createEntity(AUDIT_TABLE, auditLog);
    } catch (error: any) {
        // Log error but don't throw - audit failures shouldn't break application flow
        // Use context.error when available so the error is bound to the invocation trace
        (context?.error ?? console.error)('Failed to log audit event:', error.message);
    }
};

/**
 * Sanitize audit details to remove sensitive information
 * Removes passwords, tokens, and other sensitive fields
 * 
 * @param details - Details object to sanitize
 * @returns Sanitized details object
 */
const sanitizeAuditDetails = (details: Record<string, any>): Record<string, any> => {
    const sensitiveFields = [
        'password',
        'passwordHash',
        'token',
        'accessToken',
        'refreshToken',
        'secret',
        'apiKey',
        'creditCard',
        'ssn',
        'socialSecurityNumber'
    ];

    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(details)) {
        const lowerKey = key.toLowerCase();
        
        // Skip sensitive fields
        if (sensitiveFields.some(field => lowerKey.includes(field))) {
            sanitized[key] = '[REDACTED]';
            continue;
        }

        // Recursively sanitize nested objects
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            sanitized[key] = sanitizeAuditDetails(value);
        } else {
            sanitized[key] = value;
        }
    }

    return sanitized;
};

/**
 * Log user login event
 * @param userId - User ID
 * @param username - Username
 * @param success - Whether login was successful
 * @param ipAddress - IP address (optional)
 * @param userAgent - User agent (optional)
 */
export const logUserLogin = async (
    userId: string,
    username: string,
    success: boolean,
    ipAddress?: string,
    userAgent?: string
): Promise<void> => {
    await logAuditEvent(
        success ? 'USER_LOGIN_SUCCESS' : 'USER_LOGIN_FAILED',
        userId,
        { success },
        username,
        ipAddress,
        userAgent
    );
};

/**
 * Log user logout event
 * @param userId - User ID
 * @param username - Username
 * @param ipAddress - IP address (optional)
 * @param userAgent - User agent (optional)
 */
export const logUserLogout = async (
    userId: string,
    username: string,
    ipAddress?: string,
    userAgent?: string
): Promise<void> => {
    await logAuditEvent(
        'USER_LOGOUT',
        userId,
        {},
        username,
        ipAddress,
        userAgent
    );
};

/**
 * Log patient creation event
 * @param userId - User ID who created the patient
 * @param patientId - Created patient ID
 * @param patientData - Patient data snapshot
 */
export const logPatientCreated = async (
    userId: string,
    patientId: string,
    patientData: any
): Promise<void> => {
    await logAuditEvent('PATIENT_CREATED', userId, {
        patientId,
        name: patientData.name,
        mrn: patientData.mrn
    });
};

/**
 * Log patient update event
 * @param userId - User ID who updated the patient
 * @param patientId - Updated patient ID
 * @param changes - Changed fields and values
 */
export const logPatientUpdated = async (
    userId: string,
    patientId: string,
    changes: any
): Promise<void> => {
    await logAuditEvent('PATIENT_UPDATED', userId, {
        patientId,
        changes
    });
};

/**
 * Log patient deletion event (soft delete)
 * @param userId - User ID who deleted the patient
 * @param patientId - Deleted patient ID
 */
export const logPatientDeleted = async (
    userId: string,
    patientId: string
): Promise<void> => {
    await logAuditEvent('PATIENT_DELETED', userId, {
        patientId
    });
};

/**
 * Log examination creation event
 * @param userId - User ID who created the examination
 * @param examinationId - Created examination ID
 * @param patientId - Patient ID
 */
export const logExaminationCreated = async (
    userId: string,
    examinationId: string,
    patientId: string
): Promise<void> => {
    await logAuditEvent(
        'EXAMINATION_CREATED',
        userId,
        { examinationId, patientId }
    );
};

/**
 * Log examination update event
 * @param userId - User ID who updated the examination
 * @param examinationId - Updated examination ID
 * @param changes - Fields that were changed
 */
export const logExaminationUpdated = async (
    userId: string,
    examinationId: string,
    changes: string[]
): Promise<void> => {
    await logAuditEvent(
        'EXAMINATION_UPDATED',
        userId,
        { examinationId, changes }
    );
};

/**
 * Log examination deletion event (soft delete)
 * @param userId - User ID who deleted the examination
 * @param examinationId - Deleted examination ID
 */
export const logExaminationDeleted = async (
    userId: string,
    examinationId: string
): Promise<void> => {
    await logAuditEvent(
        'EXAMINATION_DELETED',
        userId,
        { examinationId }
    );
};

/**
 * Log examination email sent event
 * @param userId - User ID who sent the email
 * @param examinationId - Examination ID
 * @param recipientEmail - Recipient email address
 */
export const logExaminationEmailSent = async (
    userId: string,
    username: string,
    details: {
        examinationId: string;
        patientId: string;
        examinationStatus: string;
        recipientEmail: string;
        patientProfileEmail: string | null;
        recipientOverridden: boolean;
        fromEmail: string;
        pdfSizeKB: number;
        deliveryStatus: string;
    }
): Promise<void> => {
    await logAuditEvent(
        'EXAMINATION_EMAIL_SENT',
        userId,
        {
            examinationId: details.examinationId,
            patientId: details.patientId,
            examinationStatus: details.examinationStatus,
            recipientEmail: details.recipientEmail,
            patientProfileEmail: details.patientProfileEmail,
            recipientOverridden: details.recipientOverridden,
            fromEmail: details.fromEmail,
            pdfSizeKB: details.pdfSizeKB,
            deliveryStatus: details.deliveryStatus
        },
        username
    );
};

/**
 * Log examination email send failure (REQ-EML-06 EXAMINATION_EMAIL_FAILED).
 * Records only the failure code — never the provider message or the secret.
 * @param userId - User ID who attempted the send
 * @param examinationId - Examination ID
 * @param recipientEmail - Recipient address (may be the override; never a provider message)
 * @param failureCode - One of the REQ-EML-05 codes
 */
export const logExaminationEmailFailed = async (
    userId: string,
    examinationId: string,
    recipientEmail: string,
    failureCode: string
): Promise<void> => {
    await logAuditEvent(
        'EXAMINATION_EMAIL_FAILED',
        userId,
        { examinationId, recipientEmail, failureCode }
    );
};

/**
 * Log user creation event
 * @param userId - User ID who created the new user
 * @param newUserId - ID of the newly created user
 * @param newUsername - Username of the newly created user
 * @param newUserRole - Role of the newly created user
 */
export const logUserCreated = async (
    userId: string,
    newUserId: string,
    newUsername: string,
    newUserRole: string
): Promise<void> => {
    await logAuditEvent(
        'USER_CREATED',
        userId,
        { newUserId, newUsername, newUserRole }
    );
};

/**
 * Log password change event
 * @param userId - User ID who changed their password
 * @param username - Username
 */
export const logPasswordChanged = async (
    userId: string,
    username: string
): Promise<void> => {
    await logAuditEvent(
        'PASSWORD_CHANGED',
        userId,
        {},
        username
    );
};

/**
 * Log user deletion event
 * @param performedByUserId - Admin who performed the deletion
 * @param deletedUserId - ID of the deleted user
 * @param deletedUsername - Username of the deleted user
 */
export const logUserDeleted = async (
    performedByUserId: string,
    deletedUserId: string,
    deletedUsername: string
): Promise<void> => {
    await logAuditEvent(
        'USER_DELETED',
        performedByUserId,
        { deletedUserId, deletedUsername }
    );
};

/**
 * Log examination reassignment event (bulk, during user deletion)
 * @param performedByUserId - Admin who performed the operation
 * @param fromUserId - User whose examinations were reassigned
 * @param toUserId - User who received the examinations
 * @param count - Number of examinations reassigned
 */
export const logExaminationsReassigned = async (
    performedByUserId: string,
    fromUserId: string,
    toUserId: string,
    count: number
): Promise<void> => {
    await logAuditEvent(
        'EXAMINATIONS_REASSIGNED',
        performedByUserId,
        { fromUserId, toUserId, count }
    );
};

/**
 * Log admin-forced password reset event
 * @param performedByUserId - Admin who performed the reset
 * @param targetUserId - User whose password was reset
 * @param targetUsername - Username of the affected user
 */
export const logPasswordResetByAdmin = async (
    performedByUserId: string,
    targetUserId: string,
    targetUsername: string
): Promise<void> => {
    await logAuditEvent(
        'PASSWORD_RESET_BY_ADMIN',
        performedByUserId,
        { targetUserId, targetUsername }
    );
};

/**
 * Log email provider settings saved (created or updated).
 * Never receives the password or any ciphertext. `credentialsReplaced` is used instead of
 * `secretChanged` because the sanitizer redacts keys containing "secret" (DEC-02).
 * @param userId - Owner of the settings
 * @param username - Username (optional, for readability)
 * @param details - Non-secret connection metadata
 */
export const logEmailProviderSaved = async (
    userId: string,
    username: string,
    details: {
        provider: string;
        host: string;
        port: number;
        security: string;
        username: string;
        fromEmail: string;
        credentialsReplaced: boolean;
    }
): Promise<void> => {
    await logAuditEvent(
        'EMAIL_PROVIDER_SAVED',
        userId,
        {
            provider: details.provider,
            host: details.host,
            port: details.port,
            security: details.security,
            username: details.username,
            fromEmail: details.fromEmail,
            credentialsReplaced: details.credentialsReplaced
        },
        username
    );
};

/**
 * Log email provider settings deleted
 * @param userId - Owner of the settings
 * @param username - Username (optional, for readability)
 * @param provider - Provider type that was removed
 */
export const logEmailProviderDeleted = async (
    userId: string,
    username: string,
    provider: string
): Promise<void> => {
    await logAuditEvent(
        'EMAIL_PROVIDER_DELETED',
        userId,
        { provider },
        username
    );
};

/**
 * Log an email provider test (REQ-EML-06)
 * @param userId - Owner of the settings
 * @param username - Username (optional, for readability)
 * @param result - 'success' or the mapped failure code (never a provider message)
 */
export const logEmailProviderTest = async (
    userId: string,
    username: string,
    result: string
): Promise<void> => {
    await logAuditEvent(
        'EMAIL_PROVIDER_TEST',
        userId,
        { result },
        username
    );
};

// Made with Bob
