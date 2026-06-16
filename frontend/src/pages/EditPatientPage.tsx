import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { InlineLoading, InlineNotification, Button } from '@carbon/react';
import { ArrowLeft } from '@carbon/icons-react';
import PatientForm from '../components/PatientForm';
import { patientService } from '../services/patientService';
import type { Patient, UpdatePatientRequest } from '../types';

export default function EditPatientPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPatient = async () => {
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
        setError(err.message || 'Failed to load patient');
      } finally {
        setIsLoading(false);
      }
    };

    loadPatient();
  }, [id]);

  const handleSubmit = async (data: UpdatePatientRequest) => {
    if (!patient || !id) {
      throw new Error('Patient data not available');
    }

    if (!patient.etag) {
      throw new Error('ETag not available for optimistic concurrency');
    }

    try {
      const updatedPatient = await patientService.updatePatient(id, data, patient.etag);
      console.log('Patient updated successfully:', updatedPatient);
      
      // Navigate back to patient detail page
      navigate(`/patients/${id}`);
    } catch (error) {
      // Error is handled by PatientForm component
      throw error;
    }
  };

  const handleCancel = () => {
    navigate(`/patients/${id}`);
  };

  const handleBack = () => {
    navigate('/patients');
  };

  if (isLoading) {
    return (
      <div style={{ padding: '2rem' }}>
        <InlineLoading description="Loading patient details..." />
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div style={{ padding: '2rem' }}>
        <InlineNotification
          kind="error"
          title="Error"
          subtitle={error || 'Patient not found'}
          lowContrast
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
      <h1 style={{ marginBottom: '2rem' }}>Edit Patient</h1>
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