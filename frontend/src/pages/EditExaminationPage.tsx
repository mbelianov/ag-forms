import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { InlineLoading, InlineNotification, Button } from '@carbon/react';
import { ArrowLeft } from '@carbon/icons-react';
import ExaminationForm from '../components/ExaminationForm';
import { examinationService } from '../services/examinationService';
import { patientService } from '../services/patientService';
import type { Examination, UpdateExaminationRequest, Patient } from '../types';

export default function EditExaminationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [examination, setExamination] = useState<Examination | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
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
        setError(err.message || 'Failed to load examination');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [id]);

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
    return (
      <div style={{ padding: '2rem' }}>
        <InlineLoading description="Loading examination details..." />
      </div>
    );
  }

  if (error || !examination) {
    return (
      <div style={{ padding: '2rem' }}>
        <InlineNotification
          kind="error"
          title="Error"
          subtitle={error || 'Examination not found'}
          lowContrast
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
