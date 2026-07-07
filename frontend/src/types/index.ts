// User types
export interface User {
  id: string;
  username: string;
  full_name: string;
  email: string;
  role: 'admin' | 'doctor' | 'viewer';
  last_login?: string; // TASK-015: ISO date string of last login
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
  mrn?: string;        // TASK-018: MRN may be returned for display
  createdAt: string;
  updatedAt?: string;  // TASK-016
  isDeleted: boolean;
  etag?: string;
}

export interface CreatePatientRequest {
  name: string;
  age?: number;        // legacy — still accepted until TASK-038 fully deployed
  birthDate?: string;  // TASK-038: YYYY-MM-DD
  phone: string;
  email?: string;
  address?: string;
}

export interface UpdatePatientRequest {
  name: string;
  age?: number;        // legacy
  birthDate?: string;  // TASK-038
  phone: string;
  email?: string;
  address?: string;
}

export interface PatientsListResponse {
  patients: Patient[];
  continuationToken?: string;
}

// Examination types
export interface Biometry {
  // Core (original)
  bpd?: number; // integer, mm
  hc?: number;  // integer, mm
  ac?: number;  // integer, mm
  fl?: number;  // integer, mm
  efw?: number; // integer, grams
  // TASK-034: Extended biometry parameters
  ofd?: number;         // Occipito-frontal Diameter, mm
  vp?: number;          // Vermis, mm
  tcd?: number;         // Transcerebellar Diameter, mm
  cm?: number;          // Cisterna Magna, mm
  nuchalFold?: number;  // Nuchal Fold, mm
  nb?: number;          // Nasal Bone, mm
  apad?: number;        // Antero-Posterior Abdominal Diameter, mm
  tad?: number;         // Transverse Abdominal Diameter, mm
  // TASK-035: LA and LC
  la?: number;          // Left Atrium, mm
  lc?: number;          // Left Cardiac, mm
}

export interface Doppler {
  pi?: number;    // float
  ri?: number;    // float
  vessel?: string;
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

export interface Examination {
  examinationId: string;
  mrn: string; // MRN-PatientName-YYYY-NNNNNN; assigned at creation
  patientId: string;
  patientName: string; // denormalized
  examDate: string; // ISO 8601
  gestationalAge?: string; // "Xw Yd" — GA from LMP
  gestationalAgeFromBiometry?: string; // "Xw Yd" — GA derived from biometry measurements
  status: 'draft' | 'completed' | 'reviewed';
  examinationType?: string; // TASK-033: e.g. "ultrasound_prenatal"
  biometry?: Biometry;
  doppler?: Doppler;
  notes?: string;
  findings?: string;
  data?: ExaminationData;
  patientAgeAtExam?: number; // TASK-037: patient age (whole years) at exam date
  createdBy: string;
  createdByName?: string; // denormalized username
  createdAt: string;
  updatedAt?: string;  // TASK-016
  isDeleted: boolean;
  etag?: string;
}

export interface CreateExaminationRequest {
  patientId: string;
  examDate: string;
  gestationalAge?: string;
  gestationalAgeFromBiometry?: string;
  status: 'draft' | 'completed' | 'reviewed';
  examinationType?: string; // TASK-033
  biometry?: Biometry;
  doppler?: Doppler;
  notes?: string;
  findings?: string;
  data?: ExaminationData;
  patientAgeAtExam?: number; // TASK-037
}

export interface UpdateExaminationRequest {
  examDate: string;
  gestationalAge?: string;
  gestationalAgeFromBiometry?: string;
  status: 'draft' | 'completed' | 'reviewed';
  examinationType?: string; // TASK-033
  biometry?: Biometry;
  doppler?: Doppler;
  notes?: string;
  findings?: string;
  data?: ExaminationData;
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
