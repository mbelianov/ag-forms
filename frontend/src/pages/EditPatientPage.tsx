import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Breadcrumb, BreadcrumbItem, InlineNotification, Button } from '@carbon/react';
import { ArrowLeft } from '@carbon/icons-react';
import PatientForm from '../components/PatientForm';
import { patientService } from '../services/patientService';
import PageLoader from '../components/PageLoader';
import ErrorMessage from '../components/ErrorMessage';
import { useAutoNotification } from '../utils/useAutoNotification';
import type { Patient, UpdatePatientRequest } from '../types';

export default function EditPatientPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const clearSuccess = useCallback(() => setSuccessMessage(null), []);
  useAutoNotification(successMessage, clearSuccess);

  const loadPatient = useCallback(async () => {
    if (!id) {
      setError('Patient ID is required');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const patientData = await patientService.getPatient(id);
      setPatient(patientData);
    } catch (err: any) {
      console.error('[EditPatient] Failed to load patient:', err);
      setError(err.message || 'Failed to load patient');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadPatient();
  }, [loadPatient]);

  const handleSubmit = async (data: UpdatePatientRequest) => {
    if (!patient || !id) {
      throw new Error('Patient data not available');
    }

    if (!patient.etag) {
      throw new Error('ETag not available for optimistic concurrency');
    }

    // patientService.updatePatient throws an error with isConcurrencyConflict=true on 409.
    // Any other errors bubble up to PatientForm's catch block and are shown as submitError.
    const updatedPatient = await patientService.updatePatient(id, data, patient.etag);
    setSuccessMessage(`Patient "${updatedPatient.name}" updated successfully.`);
    // Brief delay so user sees the success notification before redirect
    setTimeout(() => {
      navigate(`/patients/${id}`);
    }, 1200);
  };

  const handleCancel = () => {
    navigate(`/patients/${id}`);
  };

  const handleBack = () => {
    navigate('/patients');
  };

  if (isLoading) {
    return <PageLoader description="Loading patient details..." />;
  }

  if (error || !patient) {
    return (
      <div style={{ padding: '2rem' }}>
        <ErrorMessage
          message={error || 'Patient not found'}
          onRetry={error ? loadPatient : undefined}
        />
        <Button
          kind="tertiary"
          renderIcon={ArrowLeft}
          onClick={handleBack}
          style={{ marginTop: '1rem' }}
        >
          Back to Patients
        </Button>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <Breadcrumb noTrailingSlash style={{ marginBottom: '1rem' }}>
        <BreadcrumbItem href="/dashboard">Home</BreadcrumbItem>
        <BreadcrumbItem href="/patients">Patients</BreadcrumbItem>
        <BreadcrumbItem href={`/patients/${id}`}>{patient.name}</BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>Edit</BreadcrumbItem>
      </Breadcrumb>

      <h1 style={{ marginBottom: '2rem' }}>Edit Patient</h1>

      {successMessage && (
        <InlineNotification
          kind="success"
          title="Patient Updated"
          subtitle={successMessage}
          lowContrast
          style={{ marginBottom: '1.5rem' }}
        />
      )}

      <PatientForm
        patient={patient}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isEdit={true}
      />
    </div>
  );
}

// Made with Bob
