import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Breadcrumb, BreadcrumbItem, InlineNotification } from '@carbon/react';
import ExaminationForm from '../components/ExaminationForm';
import { examinationService } from '../services/examinationService';
import { patientService } from '../services/patientService';
import PageLoader from '../components/PageLoader';
import { useAutoNotification } from '../utils/useAutoNotification';
import type { CreateExaminationRequest, Patient } from '../types';

export default function CreateExaminationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedPatientId = searchParams.get('patientId');

  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoadingPatients, setIsLoadingPatients] = useState(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const clearSuccess = useCallback(() => setSuccessMessage(null), []);
  useAutoNotification(successMessage, clearSuccess);

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
    return <PageLoader description="Loading patients..." />;
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <Breadcrumb noTrailingSlash style={{ marginBottom: '1rem' }}>
        <BreadcrumbItem href="/dashboard">Home</BreadcrumbItem>
        <BreadcrumbItem href="/examinations">Examinations</BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>Create Examination</BreadcrumbItem>
      </Breadcrumb>

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
