import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { InlineNotification } from '@carbon/react';
import PatientForm from '../components/PatientForm';
import { patientService } from '../services/patientService';
import type { CreatePatientRequest } from '../types';

export default function CreatePatientPage() {
  const navigate = useNavigate();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (data: CreatePatientRequest) => {
    const patient = await patientService.createPatient(data);
    setSuccessMessage(`Patient "${patient.name}" created successfully.`);
    // Brief delay so user sees the success notification before redirect
    setTimeout(() => {
      navigate(`/patients/${patient.patientId}`);
    }, 1200);
  };

  const handleCancel = () => {
    navigate('/patients');
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '2rem' }}>Create Patient</h1>

      {successMessage && (
        <InlineNotification
          kind="success"
          title="Patient Created"
          subtitle={successMessage}
          lowContrast
          style={{ marginBottom: '1.5rem' }}
        />
      )}

      <PatientForm onSubmit={handleSubmit} onCancel={handleCancel} />
    </div>
  );
}

// Made with Bob
