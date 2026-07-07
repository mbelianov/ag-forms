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
    age?: number;        // legacy — still stored for old records
    birthDate?: string;  // TASK-038: YYYY-MM-DD — replaces age
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
 * Clinical sub-data for pregnancy, ultrasound findings, and anatomy
 */
export interface PregnancyData {
    last_menstrual_period?: string; // YYYY-MM-DD
    obstetric_history?: string;     // e.g. "G1P0"
    family_history?: string;
}

export interface UltrasoundFindings {
    presentation?: string;   // e.g. "cephalic"
    gender?: string;         // e.g. "female" | "male" | "unknown"
    heart_rate?: number;     // integer, bpm
    fetal_movement?: string; // e.g. "active"
    placenta?: string;       // e.g. "anterior, grade 1"
    umbilical_cord?: string; // e.g. "3 vessels"
}

export interface AnatomyFindings {
    head?: string;
    brain?: string;
    heart?: string;
    abdomen?: string;
    kidneys?: string;
    limbs?: string;
    skeleton?: string;
    // TASK-036: Extended anatomy fields
    face?: string;
    neckSkin?: string;
    spine?: string;
    thorax?: string;
}

export interface ExaminationData {
    pregnancy_data?: PregnancyData;
    ultrasound_findings?: UltrasoundFindings;
    anatomy?: AnatomyFindings;
    comments?: string;
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
    // TASK-034: Extended biometry parameters
    ofd?: number;         // Occipito-frontal Diameter (integer, mm)
    vp?: number;          // Vermis (integer, mm)
    tcd?: number;         // Transcerebellar Diameter (integer, mm)
    cm?: number;          // Cisterna Magna (integer, mm)
    nuchalFold?: number;  // Nuchal Fold (integer, mm)
    nb?: number;          // Nasal Bone (integer, mm)
    apad?: number;        // Antero-Posterior Abdominal Diameter (integer, mm)
    tad?: number;         // Transverse Abdominal Diameter (integer, mm)
    // TASK-035: LA and LC
    la?: number;          // Left Atrium (integer, mm)
    lc?: number;          // Left Cardiac (integer, mm)
}

/**
 * Doppler measurements for ultrasound examination
 */
export interface DopplerData {
    pi?: number;     // Pulsatility Index (float)
    ri?: number;     // Resistance Index (float)
    vessel?: string; // Vessel name (e.g., "Umbilical Artery")
    // TASK-036: Extended vascular parameters
    utADexPI?: number;  // A.ut. Dex PI
    utADexRI?: number;  // A.ut. Dex RI
    utASinPI?: number;  // A.ut. Sin PI
    utASinRI?: number;  // A.ut. Sin RI
    cma?: number;       // CMA
    psv?: number;       // PSV
    cpr?: number;       // CPR
    ducVen?: string;    // Duc.Ven (free-text)
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
    gestationalAge?: string; // e.g., "28w 3d" — GA from LMP
    gestationalAgeFromBiometry?: string; // e.g., "28w 3d" — GA derived from biometry
    status: 'draft' | 'completed' | 'reviewed';
    examinationType?: string; // TASK-033: e.g. "ultrasound_prenatal"
    biometry?: BiometryData;
    doppler?: DopplerData;
    notes?: string;
    findings?: string;
    data?: ExaminationData; // nested clinical sub-data (serialized as JSON in Table Storage)
    patientAgeAtExam?: number; // TASK-037: patient age (whole years) at exam date
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
