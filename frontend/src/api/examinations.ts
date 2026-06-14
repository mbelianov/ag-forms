import { apiClient } from './client';
import type {
    Examination,
    CreateExaminationRequest,
    UpdateExaminationRequest,
    CalculateExaminationRequest,
    CalculateExaminationResponse,
    EmailExaminationRequest,
    GetExaminationsParams,
    PaginatedResponse,
    ApiResponse,
} from '../types';

/**
 * Get all examinations with pagination and filters
 */
export const getExaminations = async (
    params?: GetExaminationsParams
): Promise<PaginatedResponse<Examination>> => {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<Examination>>>('/examinations', {
        params,
    });
    
    if (!response.data.success || !response.data.data) {
        throw new Error('Failed to fetch examinations');
    }
    
    return response.data.data;
};

/**
 * Get examination by ID
 */
export const getExamination = async (examinationId: string): Promise<Examination> => {
    const response = await apiClient.get<ApiResponse<Examination>>(`/examinations/${examinationId}`);
    
    if (!response.data.success || !response.data.data) {
        throw new Error('Failed to fetch examination');
    }
    
    return response.data.data;
};

/**
 * Create new examination
 */
export const createExamination = async (data: CreateExaminationRequest): Promise<Examination> => {
    const response = await apiClient.post<ApiResponse<Examination>>('/examinations', data);
    
    if (!response.data.success || !response.data.data) {
        throw new Error('Failed to create examination');
    }
    
    return response.data.data;
};

/**
 * Update examination
 */
export const updateExamination = async (
    examinationId: string,
    data: UpdateExaminationRequest,
    etag?: string
): Promise<Examination> => {
    const response = await apiClient.put<ApiResponse<Examination>>(
        `/examinations/${examinationId}`,
        data,
        {
            headers: etag ? { 'If-Match': etag } : {},
        }
    );
    
    if (!response.data.success || !response.data.data) {
        throw new Error('Failed to update examination');
    }
    
    return response.data.data;
};

/**
 * Delete examination (soft delete)
 */
export const deleteExamination = async (examinationId: string, etag?: string): Promise<void> => {
    const response = await apiClient.delete<ApiResponse<void>>(`/examinations/${examinationId}`, {
        headers: etag ? { 'If-Match': etag } : {},
    });
    
    if (!response.data.success) {
        throw new Error('Failed to delete examination');
    }
};

/**
 * Calculate examination metrics (percentiles, EFW, etc.)
 */
export const calculateExamination = async (
    data: CalculateExaminationRequest
): Promise<CalculateExaminationResponse> => {
    const response = await apiClient.post<ApiResponse<CalculateExaminationResponse>>(
        '/examinations/calculate',
        data
    );
    
    if (!response.data.success || !response.data.data) {
        throw new Error('Failed to calculate examination metrics');
    }
    
    return response.data.data;
};

/**
 * Email examination report to patient
 */
export const emailExaminationReport = async (data: EmailExaminationRequest): Promise<void> => {
    const response = await apiClient.post<ApiResponse<void>>('/examinations/email', data);
    
    if (!response.data.success) {
        throw new Error('Failed to email examination report');
    }
};

// Made with Bob
