// User types
export interface User {
    userId: string;
    username: string;
    email: string;
    role: 'admin' | 'doctor' | 'viewer';
    createdAt?: string;
}

// Authentication types
export interface LoginRequest {
    username: string;
    password: string;
}

export interface LoginResponse {
    token: string;
    user: User;
}

export interface RegisterRequest {
    username: string;
    email: string;
    password: string;
    role?: 'admin' | 'doctor' | 'viewer';
}

export interface ChangePasswordRequest {
    currentPassword: string;
    newPassword: string;
}

// Patient types
export interface Patient {
    patientId: string;
    name: string;
    age: number;
    phone: string;
    email?: string;
    address?: string;
    mrn: string;
    createdAt: string;
    updatedAt?: string;
    etag?: string;
    is_deleted?: boolean;
}

export interface CreatePatientRequest {
    name: string;
    age: number;
    phone: string;
    email?: string;
    address?: string;
}

export interface UpdatePatientRequest {
    name?: string;
    age?: number;
    phone?: string;
    email?: string;
    address?: string;
}

// Examination types
export interface Biometry {
    bpd?: number;
    hc?: number;
    ac?: number;
    fl?: number;
    efw?: number;
}

export interface Doppler {
    umbilicalArteryPI?: number;
    umbilicalArteryRI?: number;
    middleCerebralArteryPI?: number;
    middleCerebralArteryRI?: number;
}

export interface Examination {
    examinationId: string;
    patientId: string;
    patientName: string;
    examDate: string;
    gestationalAge?: string;
    biometry?: Biometry;
    doppler?: Doppler;
    findings?: string;
    status: 'draft' | 'completed' | 'reviewed';
    createdAt: string;
    updatedAt?: string;
    createdBy?: string;
    etag?: string;
    is_deleted?: boolean;
}

export interface CreateExaminationRequest {
    patientId: string;
    examDate: string;
    gestationalAge?: string;
    biometry?: Biometry;
    doppler?: Doppler;
    findings?: string;
    status?: 'draft' | 'completed' | 'reviewed';
}

export interface UpdateExaminationRequest {
    examDate?: string;
    gestationalAge?: string;
    biometry?: Biometry;
    doppler?: Doppler;
    findings?: string;
    status?: 'draft' | 'completed' | 'reviewed';
}

export interface CalculateExaminationRequest {
    biometry: Biometry;
    gestationalAge?: string;
}

export interface CalculateExaminationResponse {
    calculations: {
        estimatedFetalWeight?: number;
        percentiles?: {
            bpd?: number;
            hc?: number;
            ac?: number;
            fl?: number;
            efw?: number;
        };
    };
}

// API Response types
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: any;
    };
}

export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
}

// Search and filter types
export interface SearchPatientsParams {
    query: string;
    searchBy?: 'name' | 'mrn' | 'phone';
}

export interface GetPatientsParams {
    page?: number;
    pageSize?: number;
    sortBy?: 'name' | 'createdAt' | 'mrn';
    sortOrder?: 'asc' | 'desc';
}

export interface GetExaminationsParams {
    patientId?: string;
    page?: number;
    pageSize?: number;
    sortBy?: 'examDate' | 'createdAt';
    sortOrder?: 'asc' | 'desc';
    status?: 'draft' | 'completed' | 'reviewed';
}

// Email types
export interface EmailExaminationRequest {
    examinationId: string;
    pdfBase64: string;
}

// Made with Bob
