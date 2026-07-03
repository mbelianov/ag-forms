/**
 * Type definitions for the prenatal ultrasound documentation system
 * These interfaces represent entities stored in Azure Table Storage
 */

/**
 * Base entity interface with Azure Table Storage required fields
 */
export interface BaseEntity {
    partitionKey: string;
    rowKey: string;
    timestamp?: Date;
    etag?: string;
}

/**
 * User entity for authentication and authorization
 * PartitionKey: "USER"
 * RowKey: userId (UUID)
 */
export interface User extends BaseEntity {
    userId: string;
    username: string;
    passwordHash: string;
    fullName: string; // Added to match API spec
    email: string;
    role: 'admin' | 'doctor' | 'viewer';
    createdAt: string;
    updatedAt: string;
    isActive: boolean;
    lastLoginAt?: string;
}

/**
 * Username lookup entity for efficient username-based queries
 * PartitionKey: "USERNAME"
 * RowKey: normalizedUsername (lowercase)
 */
export interface UsernameLookup extends BaseEntity {
    normalizedUsername: string;
    userId: string;
}

/**
 * Patient entity
 * PartitionKey: "PATIENT"
 * RowKey: patientId (UUID)
 */
export interface Patient extends BaseEntity {
    patientId: string;
    name: string;
    age: number;
    phone: string;
    email?: string;
    address?: string;
    createdAt: string;
    updatedAt: string;
    isDeleted: boolean;
    deletedAt?: string;
}

/**
 * MRN lookup entity for efficient MRN-based queries
 * PartitionKey: "MRN" (in Examinations table)
 * RowKey: mrn value (e.g. MRN-maria-ivanova-2026-000001)
 */
export interface MRNLookup extends BaseEntity {
    mrn: string;
    examinationId: string;
    patientId?: string; // Denormalized for context
}

/**
 * Biometry measurements for ultrasound examination
 */
export interface BiometryData {
    bpd?: number; // Biparietal Diameter (integer, mm)
    hc?: number;  // Head Circumference (integer, mm)
    ac?: number;  // Abdominal Circumference (integer, mm)
    fl?: number;  // Femur Length (integer, mm)
    efw?: number; // Estimated Fetal Weight (integer, grams)
}

/**
 * Doppler measurements for ultrasound examination
 */
export interface DopplerData {
    pi?: number; // Pulsatility Index (float)
    ri?: number; // Resistance Index (float)
    vessel?: string; // Vessel name (e.g., "Umbilical Artery")
}

/**
 * Examination entity
 * PartitionKey: "PATIENT_{patientId}"
 * RowKey: "{reverseTicks}_{examinationId}"
 */
export interface Examination extends BaseEntity {
    examinationId: string;
    mrn: string; // MRN-PatientName-YYYY-NNNNNN; assigned at creation, immutable
    patientId: string;
    patientName: string; // Denormalized for list views
    examDate: string; // ISO 8601 date string
    gestationalAge?: string; // e.g., "28w 3d"
    status: 'draft' | 'completed' | 'reviewed';
    biometry?: BiometryData;
    doppler?: DopplerData;
    notes?: string;
    findings?: string;
    createdAt: string;
    updatedAt: string;
    createdBy: string; // userId
    createdByName?: string; // denormalized username
    isDeleted: boolean;
    deletedAt?: string;
}

/**
 * Audit log entity
 * PartitionKey: "AUDIT_{yyyyMM}"
 * RowKey: "{timestamp}_{auditId}"
 */
export interface AuditLog extends BaseEntity {
    auditId: string;
    action: string; // e.g., "USER_LOGIN", "PATIENT_CREATED", "EXAM_UPDATED"
    userId: string;
    username?: string; // Denormalized for readability
    actionTimestamp: string; // ISO 8601 timestamp (renamed to avoid conflict with BaseEntity.timestamp)
    details: Record<string, any> | string; // Additional context (no sensitive data), serialized for Table Storage persistence when needed
    ipAddress?: string;
    userAgent?: string;
}

/**
 * Counter entity for generating sequential IDs (e.g., MRN)
 * PartitionKey: "COUNTER"
 * RowKey: "MRN_{YYYY}" or other counter types
 */
export interface Counter extends BaseEntity {
    counterType: string; // e.g., "MRN_2026"
    value: number; // Current counter value
    lastUpdated: string;
}

/**
 * JWT token payload structure
 */
export interface TokenPayload {
    userId: string;
    username: string;
    role: string;
    iat?: number; // Issued at
    exp?: number; // Expiration
}

/**
 * Validation result structure
 */
export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

/**
 * Standard API response structure
 */
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: any;
    };
    meta?: {
        timestamp: string;
        request_id: string;
    };
}

/**
 * User authentication result
 */
export interface AuthResult {
    success: boolean;
    user?: User;
    token?: string;
    message?: string;
}

// Made with Bob
