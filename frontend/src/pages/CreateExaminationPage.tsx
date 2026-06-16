import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { InlineLoading } from '@carbon/react';
import ExaminationForm from '../components/ExaminationForm';
import { examinationService } from '../services/examinationService';
import { patientService } from '../services/patientService';
import type { CreateExaminationRequest, Patient } from '../types';

export default function CreateExaminationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedPatientId = searchParams.get('patientId');
  
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoadingPatients, setIsLoadingPatients] = useState(true);

  useEffect(() => {
    const loadPatients = async () => {
      try {
        const response = await patientService.getPatients();
        setPatients(response.patients);
      } catch (error) {
        console.error('Failed to load patients:', error);
      } finally {
        setIsLoadingPatients(false);
      }
    };

    loadPatients();
  }, []);

  const handleSubmit = async (data: CreateExaminationRequest) => {
    try {
      const examination = await examinationService.createExamination(data);
      
      // Show success notification
      console.log('Examination created successfully:', examination);
      
      // Navigate to examination detail page
      navigate(`/examinations/${examination.examinationId}`);
    } catch (error) {
      // Error is handled by ExaminationForm component
      throw error;
    }
  };

  const handleCancel = () => {
    // If came from patient detail, go back there, otherwise go to examinations list
    if (preselectedPatientId) {
      navigate(`/patients/${preselectedPatientId}`);
    } else {
      navigate('/examinations');
    }
  };

  if (isLoadingPatients) {
    return (
      <div style={{ padding: '2rem' }}>
        <InlineLoading description="Loading patients..." />
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '2rem' }}>Create Examination</h1>
      <ExaminationForm 
        patients={patients}
        preselectedPatientId={preselectedPatientId || undefined}
        onSubmit={handleSubmit} 
        onCancel={handleCancel} 
      />
    </div>
  );
}

// Made with Bob