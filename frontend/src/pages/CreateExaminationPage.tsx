import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { InlineLoading, InlineNotification } from '@carbon/react';
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
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
    const examination = await examinationService.createExamination(data);
    const patientName = patients.find((p) => p.patientId === data.patientId)?.name || 'patient';
    setSuccessMessage(`Examination for ${patientName} created successfully.`);
    setTimeout(() => {
      navigate(`/examinations/${examination.examinationId}`);
    }, 1200);
  };

  const handleCancel = () => {
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

      {successMessage && (
        <InlineNotification
          kind="success"
          title="Examination Created"
          subtitle={successMessage}
          lowContrast
          style={{ marginBottom: '1.5rem' }}
        />
      )}

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
