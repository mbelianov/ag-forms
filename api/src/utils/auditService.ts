/**
 * Audit Service
 * Handles audit logging for security and compliance
 */

import { v4 as uuidv4 } from 'uuid';
import { AuditLog } from '../types';
import { createEntity, ensureTableExists } from './tableClient';

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
 * @returns Promise<void>
 */
export const logAuditEvent = async (
    action: string,
    userId: string,
    details: Record<string, any>,
    username?: string,
    ipAddress?: string,
    userAgent?: string
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
        console.error('Failed to log audit event:', error.message);
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
    examinationId: string,
    recipientEmail: string
): Promise<void> => {
    await logAuditEvent(
        'EXAMINATION_EMAIL_SENT',
        userId,
        { examinationId, recipientEmail }
    );
};

/**
 * Log unauthorized access attempt
 * @param userId - User ID (if authenticated)
 * @param resource - Resource being accessed
 * @param action - Action attempted
 * @param ipAddress - IP address (optional)
 */
export const logUnauthorizedAccess = async (
    userId: string,
    resource: string,
    action: string,
    ipAddress?: string
): Promise<void> => {
    await logAuditEvent(
        'UNAUTHORIZED_ACCESS',
        userId,
        { resource, action },
        undefined,
        ipAddress
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
 * Log data export event
 * @param userId - User ID who exported data
 * @param exportType - Type of export (e.g., "PDF", "CSV")
 * @param recordCount - Number of records exported
 */
export const logDataExport = async (
    userId: string,
    exportType: string,
    recordCount: number
): Promise<void> => {
    await logAuditEvent(
        'DATA_EXPORT',
        userId,
        { exportType, recordCount }
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

// Made with Bob
