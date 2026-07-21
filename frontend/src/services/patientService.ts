import api from './api';
import type { Patient, CreatePatientRequest, UpdatePatientRequest, PatientsListResponse, PatientCountResponse } from '../types';

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
 * Patient service for handling patient-related API operations
 */
class PatientService {
  private readonly PATIENTS_BASE_URL = '/v1/patients';

  /**
   * Get list of patients with optional pagination
   * @param continuationToken - Optional continuation token for pagination
   * @returns List of patients and optional continuation token
   */
  async getPatients(continuationToken?: string, signal?: AbortSignal): Promise<PatientsListResponse> {
    try {
      const params = continuationToken ? { continuationToken } : {};
      // Interceptor unwraps envelope; response.data is now { patients, continuationToken? }
      const response = await api.get<PatientsListResponse>(this.PATIENTS_BASE_URL, { params, signal });
      return response.data;
    } catch (err) {
      if (isCanceledError(err)) throw err;
      throw new Error(extractMessage(err, 'Failed to fetch patients'), { cause: err });
    }
  }

  /**
   * Get a single patient by ID
   * @param id - Patient ID
   * @returns Patient object
   */
  async getPatient(id: string): Promise<Patient> {
    try {
      const response = await api.get<{ patient: Patient }>(`${this.PATIENTS_BASE_URL}/${id}`);
      return response.data.patient;
    } catch (err) {
      throw new Error(extractMessage(err, 'Failed to fetch patient'), { cause: err });
    }
  }

  /**
   * Create a new patient
   * @param data - Patient data (MRN will be auto-generated)
   * @returns Created patient object
   */
  async createPatient(data: CreatePatientRequest): Promise<Patient> {
    try {
      const response = await api.post<{ patient: Patient }>(this.PATIENTS_BASE_URL, data);
      return response.data.patient;
    } catch (err) {
      throw new Error(extractMessage(err, 'Failed to create patient'), { cause: err });
    }
  }

  /**
   * Update an existing patient
   * @param id - Patient ID
   * @param data - Updated patient data
   * @param etag - ETag for optimistic concurrency control
   * @returns Updated patient object
   */
  async updatePatient(id: string, data: UpdatePatientRequest, etag: string): Promise<Patient> {
    try {
      // Backend reads etag from the request body (see UpdatePatient.ts)
      // Response shape: { patient: Patient (no internal fields), etag: string }
      const response = await api.put<{ patient: Patient; etag?: string }>(
        `${this.PATIENTS_BASE_URL}/${id}`,
        { ...data, etag }
      );
      // Merge the top-level etag back into the patient object so callers can
      // use patient.etag for subsequent optimistic-concurrency updates.
      return { ...response.data.patient, etag: response.data.etag } as Patient;
    } catch (err) {
      const status = getResponseStatus(err);
      // Backend returns 409 for concurrency conflicts (conflictResponse helper)
      if (status === 409) {
        const conflictError = new Error(
          'This patient record was modified by another user. Please go back and reload before editing.',
          { cause: err }
        ) as Error & { isConcurrencyConflict: boolean };
        conflictError.isConcurrencyConflict = true;
        throw conflictError;
      }
      throw new Error(extractMessage(err, 'Failed to update patient'), { cause: err });
    }
  }

  /**
   * Delete a patient (and cascade-delete all associated examinations)
   * @param id - Patient ID
   */
  async deletePatient(id: string): Promise<void> {
    try {
      await api.delete(`${this.PATIENTS_BASE_URL}/${id}`);
    } catch (err) {
      throw new Error(extractMessage(err, 'Failed to delete patient'), { cause: err });
    }
  }

  /**
   * Get total count of non-deleted patients
   * @returns Total patient count
   */
  async getPatientCount(): Promise<number> {
    try {
      const response = await api.get<PatientCountResponse>('/v1/patients-count');
      return response.data.count;
    } catch (err) {
      throw new Error(extractMessage(err, 'Failed to fetch patient count'), { cause: err });
    }
  }

  /**
   * Search patients by name or MRN
   * @param query - Search query string
   * @returns List of matching patients
   */
  async searchPatients(query: string, signal?: AbortSignal): Promise<Patient[]> {
    try {
      // Route: v1/patients-search (avoids collision with v1/patients/{id})
      // Parameter: name (matches backend SearchPatients.ts)
      const response = await api.get<{ patients: Patient[] }>('/v1/patients-search', {
        params: { name: query },
        signal,
      });
      return response.data.patients;
    } catch (err) {
      if (isCanceledError(err)) throw err;
      throw new Error(extractMessage(err, 'Failed to search patients'), { cause: err });
    }
  }
}

// Export singleton instance
export const patientService = new PatientService();

// Made with Bob
