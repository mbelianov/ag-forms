import { useState, useCallback } from 'react';
import * as examinationsApi from '../api/examinations';
import type {
    Examination,
    CreateExaminationRequest,
    UpdateExaminationRequest,
    CalculateExaminationRequest,
    CalculateExaminationResponse,
    GetExaminationsParams,
    PaginatedResponse,
} from '../types';
import { handleApiError } from '../api/client';

/**
 * Custom hook for examination operations
 */
export const useExaminations = () => {
    const [examinations, setExaminations] = useState<Examination[]>([]);
    const [currentExamination, setCurrentExamination] = useState<Examination | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pagination, setPagination] = useState<Omit<PaginatedResponse<Examination>, 'items'> | null>(null);
    const [calculations, setCalculations] = useState<CalculateExaminationResponse | null>(null);

    const fetchExaminations = useCallback(async (params?: GetExaminationsParams) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await examinationsApi.getExaminations(params);
            setExaminations(response.items);
            setPagination({
                total: response.total,
                page: response.page,
                pageSize: response.pageSize,
                hasMore: response.hasMore,
            });
        } catch (err) {
            const errorMessage = handleApiError(err);
            setError(errorMessage);
            console.error('Failed to fetch examinations:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const fetchExamination = useCallback(async (examinationId: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const examination = await examinationsApi.getExamination(examinationId);
            setCurrentExamination(examination);
            return examination;
        } catch (err) {
            const errorMessage = handleApiError(err);
            setError(errorMessage);
            console.error('Failed to fetch examination:', err);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const createExamination = useCallback(async (data: CreateExaminationRequest) => {
        setIsLoading(true);
        setError(null);
        try {
            const newExamination = await examinationsApi.createExamination(data);
            setExaminations((prev) => [newExamination, ...prev]);
            return newExamination;
        } catch (err) {
            const errorMessage = handleApiError(err);
            setError(errorMessage);
            console.error('Failed to create examination:', err);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const updateExamination = useCallback(
        async (examinationId: string, data: UpdateExaminationRequest, etag?: string) => {
            setIsLoading(true);
            setError(null);
            try {
                const updatedExamination = await examinationsApi.updateExamination(
                    examinationId,
                    data,
                    etag
                );
                setExaminations((prev) =>
                    prev.map((e) => (e.examinationId === examinationId ? updatedExamination : e))
                );
                if (currentExamination?.examinationId === examinationId) {
                    setCurrentExamination(updatedExamination);
                }
                return updatedExamination;
            } catch (err) {
                const errorMessage = handleApiError(err);
                setError(errorMessage);
                console.error('Failed to update examination:', err);
                throw err;
            } finally {
                setIsLoading(false);
            }
        },
        [currentExamination]
    );

    const deleteExamination = useCallback(
        async (examinationId: string, etag?: string) => {
            setIsLoading(true);
            setError(null);
            try {
                await examinationsApi.deleteExamination(examinationId, etag);
                setExaminations((prev) => prev.filter((e) => e.examinationId !== examinationId));
                if (currentExamination?.examinationId === examinationId) {
                    setCurrentExamination(null);
                }
            } catch (err) {
                const errorMessage = handleApiError(err);
                setError(errorMessage);
                console.error('Failed to delete examination:', err);
                throw err;
            } finally {
                setIsLoading(false);
            }
        },
        [currentExamination]
    );

    const calculateExamination = useCallback(async (data: CalculateExaminationRequest) => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await examinationsApi.calculateExamination(data);
            setCalculations(result);
            return result;
        } catch (err) {
            const errorMessage = handleApiError(err);
            setError(errorMessage);
            console.error('Failed to calculate examination:', err);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const emailExaminationReport = useCallback(
        async (examinationId: string, pdfBase64: string) => {
            setIsLoading(true);
            setError(null);
            try {
                await examinationsApi.emailExaminationReport({
                    examinationId,
                    pdfBase64,
                });
            } catch (err) {
                const errorMessage = handleApiError(err);
                setError(errorMessage);
                console.error('Failed to email examination report:', err);
                throw err;
            } finally {
                setIsLoading(false);
            }
        },
        []
    );

    return {
        examinations,
        currentExamination,
        isLoading,
        error,
        pagination,
        calculations,
        fetchExaminations,
        fetchExamination,
        createExamination,
        updateExamination,
        deleteExamination,
        calculateExamination,
        emailExaminationReport,
    };
};

// Made with Bob
