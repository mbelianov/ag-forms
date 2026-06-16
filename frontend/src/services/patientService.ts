import api from './api';
import type { Patient, CreatePatientRequest, UpdatePatientRequest, PatientsListResponse } from '../types';

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
  async getPatients(continuationToken?: string): Promise<PatientsListResponse> {
    try {
      const params = continuationToken ? { continuationToken } : {};
      const response = await api.get<PatientsListResponse>(this.PATIENTS_BASE_URL, { params });
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error || 'Failed to fetch patients';
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
      const message = error.response?.data?.error || 'Failed to fetch patient';
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
      const message = error.response?.data?.error || 'Failed to create patient';
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
      const response = await api.put<{ patient: Patient }>(
        `${this.PATIENTS_BASE_URL}/${id}`,
        data,
        {
          headers: {
            'If-Match': etag,
          },
        }
      );
      return response.data.patient;
    } catch (error: any) {
      const message = error.response?.data?.error || 'Failed to update patient';
      throw new Error(message);
    }
  }

  /**
   * Search patients by name or MRN
   * @param query - Search query string
   * @returns List of matching patients
   */
  async searchPatients(query: string): Promise<Patient[]> {
    try {
      const response = await api.get<{ patients: Patient[] }>(`${this.PATIENTS_BASE_URL}/search`, {
        params: { q: query },
      });
      return response.data.patients;
    } catch (error: any) {
      const message = error.response?.data?.error || 'Failed to search patients';
      throw new Error(message);
    }
  }
}

// Export singleton instance
export const patientService = new PatientService();

// Made with Bob