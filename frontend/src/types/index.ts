// User types
export interface User {
  id: string;
  username: string;
  full_name: string;
  email: string;
  role: 'admin' | 'doctor' | 'viewer';
}

// Patient types
export interface Patient {
  patientId: string;
  name: string;
  age: number;
  phone: string;
  email?: string;
  address?: string;
  createdAt: string;
  isDeleted: boolean;
  etag?: string;
}

export interface CreatePatientRequest {
  name: string;
  age: number;
  phone: string;
  email?: string;
  address?: string;
}

export interface UpdatePatientRequest {
  name: string;
  age: number;
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
  bpd?: number; // integer, mm
  hc?: number; // integer, mm
  ac?: number; // integer, mm
  fl?: number; // integer, mm
  efw?: number; // integer, grams
}

export interface Doppler {
  pi?: number; // float
  ri?: number; // float
  vessel?: string;
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
  biometry?: Biometry;
  doppler?: Doppler;
  notes?: string;
  findings?: string;
  data?: ExaminationData;
  createdBy: string;
  createdByName?: string; // denormalized username
  createdAt: string;
  isDeleted: boolean;
  etag?: string;
}

export interface CreateExaminationRequest {
  patientId: string;
  examDate: string;
  gestationalAge?: string;
  gestationalAgeFromBiometry?: string;
  status: 'draft' | 'completed' | 'reviewed';
  biometry?: Biometry;
  doppler?: Doppler;
  notes?: string;
  findings?: string;
  data?: ExaminationData;
}

export interface UpdateExaminationRequest {
  examDate: string;
  gestationalAge?: string;
  gestationalAgeFromBiometry?: string;
  status: 'draft' | 'completed' | 'reviewed';
  biometry?: Biometry;
  doppler?: Doppler;
  notes?: string;
  findings?: string;
  data?: ExaminationData;
}

export interface ExaminationsListResponse {
  examinations: Examination[];
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
