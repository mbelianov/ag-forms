import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Breadcrumb, BreadcrumbItem, InlineNotification, Button } from '@carbon/react';
import { ArrowLeft } from '@carbon/icons-react';
import ExaminationForm from '../components/ExaminationForm';
import { examinationService } from '../services/examinationService';
import { patientService } from '../services/patientService';
import PageLoader from '../components/PageLoader';
import ErrorMessage from '../components/ErrorMessage';
import { useAutoNotification } from '../utils/useAutoNotification';
import type { Examination, UpdateExaminationRequest, Patient } from '../types';

export default function EditExaminationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [examination, setExamination] = useState<Examination | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const clearSuccess = useCallback(() => setSuccessMessage(null), []);
  useAutoNotification(successMessage, clearSuccess);

  const loadData = useCallback(async () => {
    if (!id) {
      setError('Examination ID is required');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const [examinationData, patientsResponse] = await Promise.all([
        examinationService.getExamination(id),
        patientService.getPatients(),
      ]);
      setExamination(examinationData);
      setPatients(patientsResponse.patients);
    } catch (err: any) {
      console.error('[EditExamination] Failed to load data:', err);
      setError(err.message || 'Failed to load examination');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (data: UpdateExaminationRequest) => {
    if (!examination || !id) {
      throw new Error('Examination data not available');
    }

    if (!examination.etag) {
      throw new Error('ETag not available for optimistic concurrency');
    }

    // examinationService.updateExamination already converts 409 conflicts into a
    // decorated Error (isConcurrencyConflict=true) — no need to inspect .response here.
    const updatedExamination = await examinationService.updateExamination(
      id,
      data,
      examination.etag
    );
    setSuccessMessage(
      `Examination for ${updatedExamination.patientName} updated successfully.`
    );
    setTimeout(() => {
      navigate(`/examinations/${id}`);
    }, 1200);
  };

  const handleCancel = () => {
    navigate(`/examinations/${id}`);
  };

  const handleBack = () => {
    navigate('/examinations');
  };

  if (isLoading) {
    return <PageLoader description="Loading examination details..." />;
  }

  if (error || !examination) {
    return (
      <div style={{ padding: '2rem' }}>
        <ErrorMessage
          message={error || 'Examination not found'}
          onRetry={error ? loadData : undefined}
        />
        <Button
          kind="tertiary"
          renderIcon={ArrowLeft}
          onClick={handleBack}
          style={{ marginTop: '1rem' }}
        >
          Back to Examinations
        </Button>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <Breadcrumb noTrailingSlash style={{ marginBottom: '1rem' }}>
        <BreadcrumbItem href="/dashboard">Home</BreadcrumbItem>
        <BreadcrumbItem href="/examinations">Examinations</BreadcrumbItem>
        <BreadcrumbItem href={`/examinations/${id}`}>
          {examination.patientName}
        </BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>Edit</BreadcrumbItem>
      </Breadcrumb>

      <h1 style={{ marginBottom: '2rem' }}>Edit Examination</h1>

      {successMessage && (
        <InlineNotification
          kind="success"
          title="Examination Updated"
          subtitle={successMessage}
          lowContrast
          style={{ marginBottom: '1.5rem' }}
        />
      )}

      <ExaminationForm
        examination={examination}
        patients={patients}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isEdit={true}
      />
    </div>
  );
}

// Made with Bob
