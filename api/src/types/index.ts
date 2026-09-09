/**
 * Type definitions for the prenatal ultrasound documentation system
 * These interfaces represent entities stored in Azure Table Storage
 *
 * ST-04: Replaced flat BiometryData/DopplerData/FtBiometry/FtDoppler/FtMarkers/FtUltrasoundFindings
 *         and the legacy ExaminationData with the Observable fetus-array model.
 *        Removed top-level biometry/doppler/biometry2/doppler2/gestationalAgeFromBiometry fields
 *        from Examination — all measurement data now lives in data.fetuses[].
 * ST-02: Added primaryRowKey? to Examination.
 * ST-03: Added ExaminationCreateRequest and ExaminationUpdateRequest.
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

// ── Observable Fetus-Array Data Model (ST-04) ─────────────────────────────────

/**
 * A single ultrasound measurement with all its derived quantities co-located.
 * §14.2 authoritative definition.
 */
export interface Observable {
    type: string;              // canonical measurement key: "bpd", "hc", "crl", "pi", etc.
    value: number | string;    // raw measurement value; string for free-text (vp, la)
    isManual?: boolean;        // ONLY set on EFW — true when user typed EFW directly
    percentile?: {
        value: number;         // integer [1–99]
        isManual?: boolean;    // true when user overrode; absent/false when auto-calculated
    };
    ga?: {
        value: string;         // "Xw Yd" — GA derived from this single measurement
        isManual?: boolean;    // true when user overrode; absent/false when auto-calculated
    };
}

/**
 * Fetus-level composite GA — summarises all biometry observables for this fetus.
 */
export interface GaFromBiometry {
    value: string;       // "Xw Yd"
    isManual?: boolean;  // true when user manually set; absent/false when auto-calculated
}

/**
 * Clinical sub-data for a single fetus.
 * Shared structure for both prenatal and first-trimester exams.
 */
export interface FetusSectionData {
    index: number;
    gaFromBiometry?: GaFromBiometry;
    biometry?: Observable[];                               // type set per exam type (§14.3)
    doppler?: Observable[];                                // type set per exam type (§14.3)
    ultrasoundFindings?: Record<string, string>; // purely descriptive
    anatomy?: Record<string, string>;                     // purely descriptive free-text
    markers?: Record<string, string>;                     // first_trimester only: soft markers
}

/**
 * Top-level clinical data container for an examination.
 * All measurement data lives inside fetuses[].
 */
export interface ExaminationData {
    pregnancyData?: {
        lastMenstrualPeriod?: string;  // YYYY-MM-DD
        obstetricHistory?: string;
        familyHistory?: string;
    };
    comments?: string;
    fetuses: FetusSectionData[];       // length = fetus count; index 0 = fetus 1, etc.
}

// ── Examination Request Types (ST-03) ─────────────────────────────────────────

/**
 * Request body for POST /v1/examinations
 * Moved from local scope in CreateExamination.ts (ST-03: §4.4).
 */
export interface ExaminationCreateRequest {
    patientId: string;
    examDate: string;
    gestationalAge?: string;
    gestationalAgeIsManual?: boolean;
    status: string;
    examinationType?: string;
    findings?: string;
    notes?: string;
    data?: ExaminationData;
    patientAgeAtExam?: number;
    etag?: never; // client must not provide etag on create
}

/**
 * Request body for PUT /v1/examinations/{id}
 * Moved from local scope in UpdateExamination.ts (ST-03: §4.4).
 * etag is required for optimistic concurrency.
 */
export interface ExaminationUpdateRequest {
    mrn?: never;            // immutable — rejected on update
    examDate?: string;
    gestationalAge?: string;
    gestationalAgeIsManual?: boolean;
    status?: string;
    examinationType?: string;
    findings?: string;
    notes?: string;
    data?: ExaminationData;
    patientAgeAtExam?: number;
    etag: string;           // required for optimistic concurrency
}

// ── Clinical sub-data — pregnancy / ultrasound / anatomy ──────────────────────

export interface PregnancyData {
    last_menstrual_period?: string; // YYYY-MM-DD
    obstetric_history?: string;     // e.g. "G1P0"
    family_history?: string;
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

/**
 * Examination entity
 * PartitionKey: "PATIENT_{patientId}" (primary) or "EXAM" (lookup)
 * RowKey: "{reverseTicks}_{examinationId}" (primary) or examinationId (lookup)
 *
 * ST-04: Removed top-level biometry/doppler/biometry2/doppler2/gestationalAgeFromBiometry*
 *         fields — all measurement data now lives in data.fetuses[].
 * ST-02: Added primaryRowKey for O(1) primary entity lookup during updates.
 */
export interface Examination extends BaseEntity {
    examinationId: string;
    mrn: string; // MRN-PatientName-YYYY-NNNNNN; assigned at creation, immutable
    patientId: string;
    patientName: string; // Denormalized for list views
    examDate: string; // ISO 8601 date string
    gestationalAge?: string; // e.g., "28w 3d" — GA from LMP
    gestationalAgeIsManual?: boolean;
    status: 'draft' | 'completed' | 'reviewed';
    examinationType?: string; // "prenatal" | "first_trimester"
    notes?: string;
    findings?: string;
    data?: ExaminationData; // all clinical measurement data (serialized as JSON in Table Storage)
    patientAgeAtExam?: number; // patient age (whole years) at exam date
    primaryRowKey?: string;    // ST-02: row key of the primary PATIENT_ entity for O(1) lookup
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
    details: Record<string, any> | string; // Additional context (no sensitive data)
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
