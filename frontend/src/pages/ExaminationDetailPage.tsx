import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Breadcrumb,
  BreadcrumbItem,
  Button,
  Stack,
  Tile,
} from '@carbon/react';
import { Edit, ArrowLeft } from '@carbon/icons-react';
import { examinationService } from '../services/examinationService';
import PageLoader from '../components/PageLoader';
import ErrorMessage from '../components/ErrorMessage';
import { getStatusTag } from '../utils/statusHelpers';
import type { Examination } from '../types';

export default function ExaminationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [examination, setExamination] = useState<Examination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadExamination = useCallback(async () => {
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
      console.error('[ExaminationDetail] Failed to load examination:', err);
      setError(err.message || 'Failed to load examination');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadExamination();
  }, [loadExamination]);

  const handleEdit = () => {
    navigate(`/examinations/${id}/edit`);
  };

  const handleBackToExaminations = () => {
    navigate('/examinations');
  };

  const handleBackToPatient = () => {
    if (examination) {
      navigate(`/patients/${examination.patientId}`);
    }
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

  if (isLoading) {
    return <PageLoader description="Loading examination details..." />;
  }

  if (error || !examination) {
    return (
      <div style={{ padding: '2rem' }}>
        <ErrorMessage
          message={error || 'Examination not found'}
          onRetry={error ? loadExamination : undefined}
        />
        <Button
          kind="tertiary"
          renderIcon={ArrowLeft}
          onClick={handleBackToExaminations}
          style={{ marginTop: '1rem' }}
        >
          Back to Examinations
        </Button>
      </div>
    );
  }

  const hasBiometry = examination.biometry && Object.values(examination.biometry).some((v) => v !== undefined);
  const hasDoppler = examination.doppler && Object.values(examination.doppler).some((v) => v !== undefined && v !== '');

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <Breadcrumb noTrailingSlash style={{ marginBottom: '1rem' }}>
        <BreadcrumbItem href="/dashboard">Home</BreadcrumbItem>
        <BreadcrumbItem href="/examinations">Examinations</BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>
          {examination.patientName} — {formatDate(examination.examDate)}
        </BreadcrumbItem>
      </Breadcrumb>

      <Stack gap={6}>
        {/* Header with actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <h1>Examination Details</h1>
          <Stack orientation="horizontal" gap={4} style={{ flexWrap: 'wrap' }}>
            <Button
              kind="tertiary"
              renderIcon={ArrowLeft}
              onClick={handleBackToExaminations}
              aria-label="Back to examinations list"
            >
              All Examinations
            </Button>
            <Button
              kind="secondary"
              renderIcon={ArrowLeft}
              onClick={handleBackToPatient}
              aria-label={`Back to patient ${examination.patientName}`}
            >
              Back to Patient Details
            </Button>
            <Button
              kind="primary"
              renderIcon={Edit}
              onClick={handleEdit}
              aria-label="Edit this examination"
            >
              Edit Examination
            </Button>
          </Stack>
        </div>

        {/* Status and Date */}
        <Tile style={{ backgroundColor: '#f4f4f4', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.5rem' }}>
                Examination Date
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#161616' }}>
                {formatDate(examination.examDate)}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
              <div style={{ fontSize: '0.875rem', color: '#525252' }}>Status</div>
              {getStatusTag(examination.status)}
            </div>
          </div>
        </Tile>

        {/* Patient Header — name (clickable), MRN, link back to patient */}
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
                  aria-label={`View patient ${examination.patientName}`}
                >
                  {examination.patientName}
                </Link>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>
                MRN
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 500 }}>
                {examination.mrn}
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
        <Tile>
          <h3 style={{ marginBottom: '1.5rem' }}>Biometry Measurements</h3>
          {hasBiometry ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
              {examination.biometry!.bpd !== undefined && (
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>
                    BPD (Biparietal Diameter)
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 500 }}>
                    {examination.biometry!.bpd} mm
                  </div>
                </div>
              )}
              {examination.biometry!.hc !== undefined && (
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>
                    HC (Head Circumference)
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 500 }}>
                    {examination.biometry!.hc} mm
                  </div>
                </div>
              )}
              {examination.biometry!.ac !== undefined && (
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>
                    AC (Abdominal Circumference)
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 500 }}>
                    {examination.biometry!.ac} mm
                  </div>
                </div>
              )}
              {examination.biometry!.fl !== undefined && (
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>
                    FL (Femur Length)
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 500 }}>
                    {examination.biometry!.fl} mm
                  </div>
                </div>
              )}
              {examination.biometry!.efw !== undefined && (
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>
                    EFW (Estimated Fetal Weight)
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 500 }}>
                    {examination.biometry!.efw} g
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: '#525252', fontStyle: 'italic' }}>No biometry measurements recorded.</div>
          )}
        </Tile>

        {/* Doppler */}
        <Tile>
          <h3 style={{ marginBottom: '1.5rem' }}>Doppler Measurements</h3>
          {hasDoppler ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
              {examination.doppler!.pi !== undefined && (
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>
                    PI (Pulsatility Index)
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 500 }}>
                    {examination.doppler!.pi}
                  </div>
                </div>
              )}
              {examination.doppler!.ri !== undefined && (
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>
                    RI (Resistance Index)
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 500 }}>
                    {examination.doppler!.ri}
                  </div>
                </div>
              )}
              {examination.doppler!.vessel && (
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>
                    Vessel
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 500 }}>
                    {examination.doppler!.vessel}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: '#525252', fontStyle: 'italic' }}>No Doppler measurements recorded.</div>
          )}
        </Tile>

        {/* Clinical Information */}
        <Tile>
          <h3 style={{ marginBottom: '1.5rem' }}>Clinical Information</h3>
          <Stack gap={5}>
            <div>
              <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.5rem', fontWeight: 600 }}>
                Findings
              </div>
              {examination.findings ? (
                <div style={{ fontSize: '1rem', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                  {examination.findings}
                </div>
              ) : (
                <div style={{ color: '#525252', fontStyle: 'italic' }}>No findings recorded.</div>
              )}
            </div>
            <div>
              <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.5rem', fontWeight: 600 }}>
                Notes
              </div>
              {examination.notes ? (
                <div style={{ fontSize: '1rem', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                  {examination.notes}
                </div>
              ) : (
                <div style={{ color: '#525252', fontStyle: 'italic' }}>No notes recorded.</div>
              )}
            </div>
          </Stack>
        </Tile>

        {/* Metadata */}
        <Tile>
          <h3 style={{ marginBottom: '1.5rem' }}>Metadata</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
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
          </div>
        </Tile>

        {/* Bottom action bar */}
        <Stack orientation="horizontal" gap={4}>
          <Button
            kind="tertiary"
            renderIcon={ArrowLeft}
            onClick={handleBackToExaminations}
          >
            All Examinations
          </Button>
          <Button
            kind="secondary"
            renderIcon={ArrowLeft}
            onClick={handleBackToPatient}
          >
            Back to Patient Details
          </Button>
          <Button
            kind="primary"
            renderIcon={Edit}
            onClick={handleEdit}
          >
            Edit Examination
          </Button>
        </Stack>
      </Stack>
    </div>
  );
}

// Made with Bob
