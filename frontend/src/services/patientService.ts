import api from './api';
import type { Patient, CreatePatientRequest, UpdatePatientRequest, PatientsListResponse, PatientCountResponse } from '../types';

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
    } catch (error: any) {
      if (error.code === 'ERR_CANCELED' || error.name === 'AbortError' || (error as any).name === 'CanceledError') throw error;
      const message = error.response?.data?.error?.message || error.response?.data?.error || 'Failed to fetch patients';
      throw new Error(message);
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
    } catch (error: any) {
      const message = error.response?.data?.error?.message || error.response?.data?.error || 'Failed to fetch patient';
      throw new Error(message);
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
    } catch (error: any) {
      const message = error.response?.data?.error?.message || error.response?.data?.error || 'Failed to create patient';
      throw new Error(message);
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
    } catch (error: any) {
      const status = error.response?.status;
      // Backend returns 409 for concurrency conflicts (conflictResponse helper)
      if (status === 409) {
        const conflictError: any = new Error(
          'This patient record was modified by another user. Please go back and reload before editing.'
        );
        conflictError.isConcurrencyConflict = true;
        throw conflictError;
      }
      const message = error.response?.data?.error?.message || error.response?.data?.error || 'Failed to update patient';
      throw new Error(message);
    }
  }

  /**
   * Delete a patient (and cascade-delete all associated examinations)
   * @param id - Patient ID
   */
  async deletePatient(id: string): Promise<void> {
    try {
      await api.delete(`${this.PATIENTS_BASE_URL}/${id}`);
    } catch (error: any) {
      const message = error.response?.data?.error?.message || error.response?.data?.error || 'Failed to delete patient';
      throw new Error(message);
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
    } catch (error: any) {
      const message = error.response?.data?.error?.message || error.response?.data?.error || 'Failed to fetch patient count';
      throw new Error(message);
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
    } catch (error: any) {
      if (error.code === 'ERR_CANCELED' || error.name === 'AbortError' || (error as any).name === 'CanceledError') throw error;
      const message = error.response?.data?.error?.message || error.response?.data?.error || 'Failed to search patients';
      throw new Error(message);
    }
  }
}

// Export singleton instance
export const patientService = new PatientService();

// Made with Bob