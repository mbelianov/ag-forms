import api from './api';
import type { 
  Examination, 
  CreateExaminationRequest, 
  UpdateExaminationRequest, 
  ExaminationsListResponse 
} from '../types';

export interface GetExaminationsOptions {
  patientId?: string;
  status?: string;
  from_date?: string;
  to_date?: string;
  continuationToken?: string;
}

/**
 * Examination service for handling examination-related API operations
 */
class ExaminationService {
  private readonly EXAMINATIONS_BASE_URL = '/v1/examinations';

  /**
   * Get list of examinations with optional filters and pagination.
   * Accepts either a plain patientId string (legacy callers) or an options object.
   */
  async getExaminations(
    optsOrPatientId?: string | GetExaminationsOptions
  ): Promise<ExaminationsListResponse> {
    try {
      let params: Record<string, string | undefined> = {};
      if (typeof optsOrPatientId === 'string') {
        // Legacy call: getExaminations(patientId)
        if (optsOrPatientId) params.patient_id = optsOrPatientId;
      } else if (optsOrPatientId) {
        const opts = optsOrPatientId;
        // TASK-017: query param is patient_id, not patientId
        if (opts.patientId) params.patient_id = opts.patientId;
        if (opts.status)    params.status = opts.status;
        if (opts.from_date) params.from_date = opts.from_date;
        if (opts.to_date)   params.to_date = opts.to_date;
        if (opts.continuationToken) params.continuationToken = opts.continuationToken;
      }
      const response = await api.get<ExaminationsListResponse>(this.EXAMINATIONS_BASE_URL, { params });
      // Backend returns { examinations: [...], continuationToken?: string }
      // After envelope unwrap, response.data is that inner object
      const data = response.data as any;
      if (data && Array.isArray(data.examinations)) {
        return { examinations: data.examinations, continuationToken: data.continuationToken };
      }
      // Fallback for legacy responses that return an array directly
      if (Array.isArray(data)) {
        return { examinations: data };
      }
      return { examinations: [] };
    } catch (error: any) {
      const message = error.response?.data?.error?.message || error.response?.data?.error || 'Failed to fetch examinations';
      throw new Error(message);
    }
  }

  /**
   * Get a single examination by ID
   * @param id - Examination ID
   * @returns Examination object
   */
  async getExamination(id: string): Promise<Examination> {
    try {
      const response = await api.get<{ examination: Examination }>(`${this.EXAMINATIONS_BASE_URL}/${id}`);
      return response.data.examination;
    } catch (error: any) {
      const message = error.response?.data?.error?.message || error.response?.data?.error || 'Failed to fetch examination';
      throw new Error(message);
    }
  }

  /**
   * Create a new examination
   * @param data - Examination data
   * @returns Created examination object
   */
  async createExamination(data: CreateExaminationRequest): Promise<Examination> {
    try {
      const response = await api.post<{ examination: Examination }>(this.EXAMINATIONS_BASE_URL, data);
      return response.data.examination;
    } catch (error: any) {
      const message = error.response?.data?.error?.message || error.response?.data?.error || 'Failed to create examination';
      throw new Error(message);
    }
  }

  /**
   * Update an existing examination
   * @param id - Examination ID
   * @param data - Updated examination data
   * @param etag - ETag for optimistic concurrency control
   * @returns Updated examination object
   */
  async updateExamination(id: string, data: UpdateExaminationRequest, etag: string): Promise<Examination> {
    try {
      // Backend reads etag from the request body (see UpdateExamination.ts)
      const response = await api.put<{ examination: Examination }>(
        `${this.EXAMINATIONS_BASE_URL}/${id}`,
        { ...data, etag }
      );
      return response.data.examination;
    } catch (error: any) {
      const status = error.response?.status;
      // Backend returns 409 for concurrency conflicts (conflictResponse helper)
      if (status === 409) {
        const conflictError: any = new Error(
          'This examination record was modified by another user. Please go back and reload before editing.'
        );
        conflictError.isConcurrencyConflict = true;
        throw conflictError;
      }
      const message = error.response?.data?.error?.message || error.response?.data?.error || 'Failed to update examination';
      throw new Error(message);
    }
  }

  /**
   * Delete an examination (admin and doctor roles)
   * @param id - Examination ID
   */
  async deleteExamination(id: string): Promise<void> {
    try {
      await api.delete(`${this.EXAMINATIONS_BASE_URL}/${id}`);
    } catch (error: any) {
      const message = error.response?.data?.error?.message || error.response?.data?.error || 'Failed to delete examination';
      throw new Error(message);
    }
  }
}

// Export singleton instance
export const examinationService = new ExaminationService();

// Made with Bob
