import { useNavigate } from 'react-router-dom';
import PatientForm from '../components/PatientForm';
import { patientService } from '../services/patientService';
import type { CreatePatientRequest } from '../types';

export default function CreatePatientPage() {
  const navigate = useNavigate();

  const handleSubmit = async (data: CreatePatientRequest) => {
    try {
      const patient = await patientService.createPatient(data);
      
      // Show success notification (Carbon toast would be ideal but using simple approach)
      console.log('Patient created successfully:', patient);
      
      // Navigate to patient detail page
      navigate(`/patients/${patient.patientId}`);
    } catch (error) {
      // Error is handled by PatientForm component
      throw error;
    }
  };

  const handleCancel = () => {
    navigate('/patients');
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '2rem' }}>Create Patient</h1>
      <PatientForm onSubmit={handleSubmit} onCancel={handleCancel} />
    </div>
  );
}

// Made with Bob