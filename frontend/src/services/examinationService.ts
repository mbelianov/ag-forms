import api from './api';
import type { 
  Examination, 
  CreateExaminationRequest, 
  UpdateExaminationRequest, 
  ExaminationsListResponse 
} from '../types';

/**
 * Examination service for handling examination-related API operations
 */
class ExaminationService {
  private readonly EXAMINATIONS_BASE_URL = '/v1/examinations';

  /**
   * Get list of examinations, optionally filtered by patient
   * @param patientId - Optional patient ID to filter examinations
   * @returns List of examinations
   */
  async getExaminations(patientId?: string): Promise<Examination[]> {
    try {
      const params = patientId ? { patient_id: patientId } : {};
      const response = await api.get<ExaminationsListResponse>(this.EXAMINATIONS_BASE_URL, { params });
      return response.data.examinations;
    } catch (error: any) {
      const message = error.response?.data?.error || 'Failed to fetch examinations';
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
      const message = error.response?.data?.error || 'Failed to fetch examination';
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
      const message = error.response?.data?.error || 'Failed to create examination';
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
      const response = await api.put<{ examination: Examination }>(
        `${this.EXAMINATIONS_BASE_URL}/${id}`,
        data,
        {
          headers: {
            'If-Match': etag,
          },
        }
      );
      return response.data.examination;
    } catch (error: any) {
      const message = error.response?.data?.error || 'Failed to update examination';
      throw new Error(message);
    }
  }
}

// Export singleton instance
export const examinationService = new ExaminationService();

// Made with Bob