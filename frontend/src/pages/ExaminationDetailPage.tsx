import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Button,
  Stack,
  InlineLoading,
  InlineNotification,
  Tile,
  Tag,
} from '@carbon/react';
import { Edit, ArrowLeft } from '@carbon/icons-react';
import { examinationService } from '../services/examinationService';
import type { Examination } from '../types';

export default function ExaminationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [examination, setExamination] = useState<Examination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadExamination = async () => {
      if (!id) {
        setError('Examination ID is required');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const examinationData = await examinationService.getExamination(id);
        setExamination(examinationData);
      } catch (err: any) {
        setError(err.message || 'Failed to load examination');
      } finally {
        setIsLoading(false);
      }
    };

    loadExamination();
  }, [id]);

  const handleEdit = () => {
    navigate(`/examinations/${id}/edit`);
  };

  const handleBack = () => {
    navigate('/examinations');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusTag = (status: string) => {
    const statusConfig = {
      draft: { type: 'gray' as const, label: 'Draft' },
      completed: { type: 'blue' as const, label: 'Completed' },
      reviewed: { type: 'green' as const, label: 'Reviewed' },
    };
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    return <Tag type={config.type}>{config.label}</Tag>;
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
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <Stack gap={6}>
        {/* Header with actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>Examination Details</h1>
          <Stack orientation="horizontal" gap={4}>
            <Button
              kind="tertiary"
              renderIcon={ArrowLeft}
              onClick={handleBack}
            >
              Back to Examinations
            </Button>
            <Button
              kind="primary"
              renderIcon={Edit}
              onClick={handleEdit}
            >
              Edit Examination
            </Button>
          </Stack>
        </div>

        {/* Status and Date */}
        <Tile style={{ backgroundColor: '#f4f4f4', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.5rem' }}>
                Examination Date
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#161616' }}>
                {formatDate(examination.examDate)}
              </div>
            </div>
            <div>
              {getStatusTag(examination.status)}
            </div>
          </div>
        </Tile>

        {/* Patient Information */}
        <Tile>
          <h3 style={{ marginBottom: '1.5rem' }}>Patient Information</h3>
          <Stack gap={4}>
            <div>
              <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>
                Patient Name
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 500 }}>
                <Link 
                  to={`/patients/${examination.patientId}`}
                  style={{ color: '#0f62fe', textDecoration: 'none' }}
                >
                  {examination.patientName}
                </Link>
              </div>
            </div>

            {examination.gestationalAge && (
              <div>
                <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>
                  Gestational Age
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 500 }}>
                  {examination.gestationalAge}
                </div>
              </div>
            )}
          </Stack>
        </Tile>

        {/* Biometry */}
        {examination.biometry && Object.keys(examination.biometry).length > 0 && (
          <Tile>
            <h3 style={{ marginBottom: '1.5rem' }}>Biometry</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
              {examination.biometry.bpd !== undefined && (
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>
                    BPD (Biparietal Diameter)
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 500 }}>
                    {examination.biometry.bpd} mm
                  </div>
                </div>
              )}

              {examination.biometry.hc !== undefined && (
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>
                    HC (Head Circumference)
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 500 }}>
                    {examination.biometry.hc} mm
                  </div>
                </div>
              )}

              {examination.biometry.ac !== undefined && (
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>
                    AC (Abdominal Circumference)
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 500 }}>
                    {examination.biometry.ac} mm
                  </div>
                </div>
              )}

              {examination.biometry.fl !== undefined && (
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>
                    FL (Femur Length)
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 500 }}>
                    {examination.biometry.fl} mm
                  </div>
                </div>
              )}

              {examination.biometry.efw !== undefined && (
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>
                    EFW (Estimated Fetal Weight)
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 500 }}>
                    {examination.biometry.efw} grams
                  </div>
                </div>
              )}
            </div>
          </Tile>
        )}

        {/* Doppler */}
        {examination.doppler && Object.keys(examination.doppler).length > 0 && (
          <Tile>
            <h3 style={{ marginBottom: '1.5rem' }}>Doppler</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
              {examination.doppler.pi !== undefined && (
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>
                    PI (Pulsatility Index)
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 500 }}>
                    {examination.doppler.pi}
                  </div>
                </div>
              )}

              {examination.doppler.ri !== undefined && (
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>
                    RI (Resistance Index)
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 500 }}>
                    {examination.doppler.ri}
                  </div>
                </div>
              )}

              {examination.doppler.vessel && (
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>
                    Vessel
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 500 }}>
                    {examination.doppler.vessel}
                  </div>
                </div>
              )}
            </div>
          </Tile>
        )}

        {/* Findings */}
        {examination.findings && (
          <Tile>
            <h3 style={{ marginBottom: '1.5rem' }}>Findings</h3>
            <div style={{ fontSize: '1rem', whiteSpace: 'pre-wrap' }}>
              {examination.findings}
            </div>
          </Tile>
        )}

        {/* Notes */}
        {examination.notes && (
          <Tile>
            <h3 style={{ marginBottom: '1.5rem' }}>Notes</h3>
            <div style={{ fontSize: '1rem', whiteSpace: 'pre-wrap' }}>
              {examination.notes}
            </div>
          </Tile>
        )}

        {/* Metadata */}
        <Tile>
          <h3 style={{ marginBottom: '1.5rem' }}>Metadata</h3>
          <Stack gap={4}>
            <div>
              <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>
                Created By
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 500 }}>
                {examination.createdBy}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>
                Created At
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 500 }}>
                {formatDateTime(examination.createdAt)}
              </div>
            </div>
          </Stack>
        </Tile>
      </Stack>
    </div>
  );
}

// Made with Bob