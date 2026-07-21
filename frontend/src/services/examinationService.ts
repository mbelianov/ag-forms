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
  examinationType?: string;
  patientName?: string;
  continuationToken?: string;
  signal?: AbortSignal;
}

function extractMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const r = (err as { response?: { data?: { error?: { message?: string } | string } } }).response;
    const e = r?.data?.error;
    if (typeof e === 'object' && e?.message) return e.message;
    if (typeof e === 'string') return e;
  }
  return fallback;
}

function getResponseStatus(err: unknown): number | undefined {
  if (err && typeof err === 'object' && 'response' in err) {
    return (err as { response?: { status?: number } }).response?.status;
  }
  return undefined;
}

function isCanceledError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; name?: string };
  return e.code === 'ERR_CANCELED' || e.name === 'AbortError' || e.name === 'CanceledError';
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
      const params: Record<string, string | undefined> = {};
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
        if (opts.examinationType) params.examination_type = opts.examinationType;
        if (opts.patientName) params.patient_name = opts.patientName;
        if (opts.continuationToken) params.continuationToken = opts.continuationToken;
      }
      const response = await api.get<ExaminationsListResponse>(this.EXAMINATIONS_BASE_URL, {
        params,
        signal: typeof optsOrPatientId === 'object' ? optsOrPatientId.signal : undefined,
      });
      // Backend returns { examinations: [...], continuationToken?: string }
      // After envelope unwrap, response.data is that inner object
      const data = response.data as ExaminationsListResponse & { examinations?: Examination[] };
      if (data && Array.isArray(data.examinations)) {
        return { examinations: data.examinations, continuationToken: data.continuationToken };
      }
      // Fallback for legacy responses that return an array directly
      if (Array.isArray(data)) {
        return { examinations: data as unknown as Examination[] };
      }
      return { examinations: [] };
    } catch (err) {
      if (isCanceledError(err)) throw err;
      throw new Error(extractMessage(err, 'Failed to fetch examinations'), { cause: err });
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
    } catch (err) {
      throw new Error(extractMessage(err, 'Failed to fetch examination'), { cause: err });
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
    } catch (err) {
      throw new Error(extractMessage(err, 'Failed to create examination'), { cause: err });
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
    } catch (err) {
      const status = getResponseStatus(err);
      // Backend returns 409 for concurrency conflicts (conflictResponse helper)
      if (status === 409) {
        const conflictError = new Error(
          'This examination record was modified by another user. Please go back and reload before editing.',
          { cause: err }
        ) as Error & { isConcurrencyConflict: boolean };
        conflictError.isConcurrencyConflict = true;
        throw conflictError;
      }
      throw new Error(extractMessage(err, 'Failed to update examination'), { cause: err });
    }
  }

  /**
   * Delete an examination (admin and doctor roles)
   * @param id - Examination ID
   */
  async deleteExamination(id: string): Promise<void> {
    try {
      await api.delete(`${this.EXAMINATIONS_BASE_URL}/${id}`);
    } catch (err) {
      throw new Error(extractMessage(err, 'Failed to delete examination'), { cause: err });
    }
  }

  /**
   * Get the total examination count from the counter
   * @returns Total examination count
   */
  async getExaminationCount(): Promise<number> {
    try {
      const response = await api.get<{ count: number }>('/v1/examinations-count');
      return response.data.count;
    } catch (err) {
      throw new Error(extractMessage(err, 'Failed to fetch examination count'), { cause: err });
    }
  }
}

// Export singleton instance
export const examinationService = new ExaminationService();

// Made with Bob
