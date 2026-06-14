import { useState, useCallback } from 'react';
import * as patientsApi from '../api/patients';
import type {
    Patient,
    CreatePatientRequest,
    UpdatePatientRequest,
    SearchPatientsParams,
    GetPatientsParams,
    PaginatedResponse,
} from '../types';
import { handleApiError } from '../api/client';

/**
 * Custom hook for patient operations
 */
export const usePatients = () => {
    const [patients, setPatients] = useState<Patient[]>([]);
    const [currentPatient, setCurrentPatient] = useState<Patient | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pagination, setPagination] = useState<Omit<PaginatedResponse<Patient>, 'items'> | null>(null);

    const fetchPatients = useCallback(async (params?: GetPatientsParams) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await patientsApi.getPatients(params);
            setPatients(response.items);
            setPagination({
                total: response.total,
                page: response.page,
                pageSize: response.pageSize,
                hasMore: response.hasMore,
            });
        } catch (err) {
            const errorMessage = handleApiError(err);
            setError(errorMessage);
            console.error('Failed to fetch patients:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const fetchPatient = useCallback(async (patientId: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const patient = await patientsApi.getPatient(patientId);
            setCurrentPatient(patient);
            return patient;
        } catch (err) {
            const errorMessage = handleApiError(err);
            setError(errorMessage);
            console.error('Failed to fetch patient:', err);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const fetchPatientByMRN = useCallback(async (mrn: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const patient = await patientsApi.getPatientByMRN(mrn);
            setCurrentPatient(patient);
            return patient;
        } catch (err) {
            const errorMessage = handleApiError(err);
            setError(errorMessage);
            console.error('Failed to fetch patient by MRN:', err);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const searchPatients = useCallback(async (params: SearchPatientsParams) => {
        setIsLoading(true);
        setError(null);
        try {
            const results = await patientsApi.searchPatients(params);
            setPatients(results);
            return results;
        } catch (err) {
            const errorMessage = handleApiError(err);
            setError(errorMessage);
            console.error('Failed to search patients:', err);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const createPatient = useCallback(async (data: CreatePatientRequest) => {
        setIsLoading(true);
        setError(null);
        try {
            const newPatient = await patientsApi.createPatient(data);
            setPatients((prev) => [newPatient, ...prev]);
            return newPatient;
        } catch (err) {
            const errorMessage = handleApiError(err);
            setError(errorMessage);
            console.error('Failed to create patient:', err);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const updatePatient = useCallback(
        async (patientId: string, data: UpdatePatientRequest, etag?: string) => {
            setIsLoading(true);
            setError(null);
            try {
                const updatedPatient = await patientsApi.updatePatient(patientId, data, etag);
                setPatients((prev) =>
                    prev.map((p) => (p.patientId === patientId ? updatedPatient : p))
                );
                if (currentPatient?.patientId === patientId) {
                    setCurrentPatient(updatedPatient);
                }
                return updatedPatient;
            } catch (err) {
                const errorMessage = handleApiError(err);
                setError(errorMessage);
                console.error('Failed to update patient:', err);
                throw err;
            } finally {
                setIsLoading(false);
            }
        },
        [currentPatient]
    );

    const deletePatient = useCallback(async (patientId: string, etag?: string) => {
        setIsLoading(true);
        setError(null);
        try {
            await patientsApi.deletePatient(patientId, etag);
            setPatients((prev) => prev.filter((p) => p.patientId !== patientId));
            if (currentPatient?.patientId === patientId) {
                setCurrentPatient(null);
            }
        } catch (err) {
            const errorMessage = handleApiError(err);
            setError(errorMessage);
            console.error('Failed to delete patient:', err);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [currentPatient]);

    return {
        patients,
        currentPatient,
        isLoading,
        error,
        pagination,
        fetchPatients,
        fetchPatient,
        fetchPatientByMRN,
        searchPatients,
        createPatient,
        updatePatient,
        deletePatient,
    };
};

// Made with Bob
