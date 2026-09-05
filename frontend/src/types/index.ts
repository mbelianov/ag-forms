/**
 * Frontend type definitions.
 *
 * ST-04: Replaced flat Biometry/Doppler/FtBiometry/FtDoppler/FtMarkers/FtUltrasoundFindings
 *         and the legacy ExaminationData with the Observable fetus-array model.
 *        Removed top-level biometry/doppler/biometry2/doppler2/gestationalAgeFromBiometry
 *        fields from Examination — all measurement data now lives in data.fetuses[].
 *        Added Observable, GaFromBiometry, FetusSectionData, new ExaminationData.
 */

// User types
export interface User {
  id: string;
  username: string;
  full_name: string;
  email: string;
  role: 'admin' | 'doctor' | 'viewer';
  last_login?: string;
}

// Patient types
export interface Patient {
  patientId: string;
  name: string;
  age?: number;        // legacy — still returned for old records
  birthDate?: string;  // TASK-038: YYYY-MM-DD — replaces age
  phone: string;
  email?: string;
  address?: string;
  mrn?: string;
  createdAt: string;
  updatedAt?: string;
  isDeleted: boolean;
  etag?: string;
}

export interface CreatePatientRequest {
  name: string;
  age?: number;
  birthDate?: string;
  phone: string;
  email?: string;
  address?: string;
}

export interface UpdatePatientRequest {
  name: string;
  age?: number;
  birthDate?: string;
  phone: string;
  email?: string;
  address?: string;
}

export interface PatientsListResponse {
  patients: Patient[];
  continuationToken?: string;
}

export interface PatientCountResponse {
  count: number;
}

// ── Observable Type Config interfaces (ST-06) ────────────────────────────────
// Defined here (not in examinationTypes.ts) to break the circular dependency
// between examinationTypes.ts and observableRegistry.ts.

export interface ObservableTypeConfig {
  type: string;             // canonical key: "bpd", "crl", etc.
  label: string;            // display label: "BPD", "CRL", etc.
  unit: string;             // unit string: "mm", "g", "bpm", "" for dimensionless
  hasPercentile: boolean;   // whether a percentile column is rendered and calculated
  hasGa: boolean;           // whether a GA column is rendered and calculated
  validRange?: { min: number; max: number }; // valid input range (from registry)
  sourceTag?: string;       // attribution label (e.g. "Hadlock") — from registry
}

export interface DescriptorOption {
  value: string; // Stored value, e.g. "cephalic"
  label: string; // User-facing label, e.g. "Cephalic"
}

export interface DescriptorTypeConfig {
  key: string;                           // Storage key: "presentation", "gender", "head", "heart_rate"
  label: string;                         // Display title: "Presentation", "FHR (bpm)", "Head"
  inputType?: 'select' | 'text';         // UI control type (default: 'text')
  options?: readonly DescriptorOption[]; // Allowed dropdown options (when inputType === 'select')
  unit?: string;                         // Optional unit suffix: "bpm", etc.
  placeholder?: string;                  // Optional placeholder text: "e.g. 145"
}

export interface MarkerTypeConfig {
  key: string;                    // storage key: "arrhythmia", "cordInsertion", etc.
  label: string;                  // display label
  inputType: 'boolean' | 'text'; // 'boolean' → Yes/No radios; 'text' → plain TextInput
}

export interface ExamTypeConfig {
  label: string;                              // display label for the exam type
  trimester: 'first' | 'second';             // 'first' → render markers block
  biometryTypes: readonly ObservableTypeConfig[];
  dopplerVessels: readonly ObservableTypeConfig[]; // PI+RI pairs — rendered 2-per-row
  dopplerSingle: readonly ObservableTypeConfig[];  // single-value rows (CMA PI, PSV, CPR, DucVen)
  ultrasoundFindingTypes: readonly DescriptorTypeConfig[];
  anatomyTypes: readonly DescriptorTypeConfig[];
  markerTypes: readonly MarkerTypeConfig[];        // empty for prenatal; defined for first_trimester
  // fetusSectionCount is NOT here — runtime state
}

// ── Observable Fetus-Array Data Model (ST-04) ─────────────────────────────────

/**
 * A single ultrasound measurement with all its derived quantities co-located.
 * §14.2 authoritative definition.
 */
export interface Observable {
  type: string;              // canonical key: "bpd", "hc", "crl", "pi", etc.
  value: number | string;    // raw measurement; string for free-text (vp, la)
  isManual?: boolean;        // ONLY set on EFW
  percentile?: {
    value: number;           // integer [1–99]
    isManual?: boolean;
  };
  ga?: {
    value: string;           // "Xw Yd"
    isManual?: boolean;
  };
}

/**
 * Fetus-level composite GA.
 */
export interface GaFromBiometry {
  value: string;
  isManual?: boolean;
}

/**
 * Clinical sub-data for a single fetus.
 */
export interface FetusSectionData {
  index: number;
  gaFromBiometry?: GaFromBiometry;
  biometry?: Observable[];
  doppler?: Observable[];
  ultrasoundFindings?: Record<string, string | number>;
  anatomy?: Record<string, string>;
  markers?: Record<string, string>;  // first_trimester only
}

/**
 * Top-level clinical data container for an examination.
 */
export interface ExaminationData {
  pregnancyData?: {
    lastMenstrualPeriod?: string;  // YYYY-MM-DD
    obstetricHistory?: string;
    familyHistory?: string;
  };
  comments?: string;
  fetuses: FetusSectionData[];
}

// ── Examination types ──────────────────────────────────────────────────────────

export interface Examination {
  examinationId: string;
  mrn: string;
  patientId: string;
  patientName: string;
  examDate: string;
  gestationalAge?: string;       // "Xw Yd" — GA from LMP
  gestationalAgeIsManual?: boolean;
  status: 'draft' | 'completed' | 'reviewed';
  examinationType?: string;      // "prenatal" | "first_trimester"
  notes?: string;
  findings?: string;
  data?: ExaminationData;        // all clinical measurement data
  patientAgeAtExam?: number;
  primaryRowKey?: string;        // ST-02
  createdBy: string;
  createdByName?: string;
  createdAt: string;
  updatedAt?: string;
  isDeleted: boolean;
  etag?: string;
}

export interface CreateExaminationRequest {
  patientId: string;
  examDate: string;
  gestationalAge?: string;
  gestationalAgeIsManual?: boolean;
  status: 'draft' | 'completed' | 'reviewed';
  examinationType?: string;
  notes?: string;
  findings?: string;
  data?: ExaminationData;
  patientAgeAtExam?: number;
}

export interface UpdateExaminationRequest {
  examDate: string;
  gestationalAge?: string;
  gestationalAgeIsManual?: boolean;
  status: 'draft' | 'completed' | 'reviewed';
  examinationType?: string;
  notes?: string;
  findings?: string;
  data?: ExaminationData;
  patientAgeAtExam?: number;
  etag: string;
}

export interface ExaminationsListResponse {
  examinations: Examination[];
  continuationToken?: string;
}

// API Response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

// Auth types
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  token: string;
}

// Made with Bob
