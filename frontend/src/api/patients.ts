import { apiClient } from './client';
import type {
    Patient,
    CreatePatientRequest,
    UpdatePatientRequest,
    SearchPatientsParams,
    GetPatientsParams,
    PaginatedResponse,
    ApiResponse,
} from '../types';

/**
 * Get all patients with pagination
 */
export const getPatients = async (params?: GetPatientsParams): Promise<PaginatedResponse<Patient>> => {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<Patient>>>('/patients', {
        params,
    });
    
    if (!response.data.success || !response.data.data) {
        throw new Error('Failed to fetch patients');
    }
    
    return response.data.data;
};

/**
 * Get patient by ID
 */
export const getPatient = async (patientId: string): Promise<Patient> => {
    const response = await apiClient.get<ApiResponse<Patient>>(`/patients/${patientId}`);
    
    if (!response.data.success || !response.data.data) {
        throw new Error('Failed to fetch patient');
    }
    
    return response.data.data;
};

/**
 * Get patient by Medical Record Number (MRN)
 */
export const getPatientByMRN = async (mrn: string): Promise<Patient> => {
    const response = await apiClient.get<ApiResponse<Patient>>(`/patients/mrn/${mrn}`);
    
    if (!response.data.success || !response.data.data) {
        throw new Error('Failed to fetch patient by MRN');
    }
    
    return response.data.data;
};

/**
 * Search patients
 */
export const searchPatients = async (params: SearchPatientsParams): Promise<Patient[]> => {
    const response = await apiClient.get<ApiResponse<Patient[]>>('/patients/search', {
        params,
    });
    
    if (!response.data.success || !response.data.data) {
        throw new Error('Failed to search patients');
    }
    
    return response.data.data;
};

/**
 * Create new patient
 */
export const createPatient = async (data: CreatePatientRequest): Promise<Patient> => {
    const response = await apiClient.post<ApiResponse<Patient>>('/patients', data);
    
    if (!response.data.success || !response.data.data) {
        throw new Error('Failed to create patient');
    }
    
    return response.data.data;
};

/**
 * Update patient
 */
export const updatePatient = async (
    patientId: string,
    data: UpdatePatientRequest,
    etag?: string
): Promise<Patient> => {
    const response = await apiClient.put<ApiResponse<Patient>>(
        `/patients/${patientId}`,
        data,
        {
            headers: etag ? { 'If-Match': etag } : {},
        }
    );
    
    if (!response.data.success || !response.data.data) {
        throw new Error('Failed to update patient');
    }
    
    return response.data.data;
};

/**
 * Delete patient (soft delete)
 */
export const deletePatient = async (patientId: string, etag?: string): Promise<void> => {
    const response = await apiClient.delete<ApiResponse<void>>(`/patients/${patientId}`, {
        headers: etag ? { 'If-Match': etag } : {},
    });
    
    if (!response.data.success) {
        throw new Error('Failed to delete patient');
    }
};

// Made with Bob
