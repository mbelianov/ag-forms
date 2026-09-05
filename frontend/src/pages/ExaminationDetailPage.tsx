import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Breadcrumb,
  BreadcrumbItem,
  Button,
  Stack,
  Tile,
  InlineNotification,
  Modal,
  InlineLoading,
} from '@carbon/react';
import { Edit, ArrowLeft, TrashCan } from '@carbon/icons-react';
import { examinationService } from '../services/examinationService';
import PageLoader from '../components/PageLoader';
import ErrorMessage from '../components/ErrorMessage';
import { getStatusTag } from '../utils/statusHelpers';
import { calcEDD } from '../utils/calculations';
import PrintButton from '../components/reports/PrintButton';
import EmailReportButton from '../components/reports/EmailReportButton';
import { useAuth } from '../contexts/AuthContext';
import { useAutoNotification } from '../utils/useAutoNotification';
import { formatDateTime, formatPlainDate } from '../utils/formatters';
import { getExamTypeLabel } from '../constants/examinationTypes';
import type { Examination } from '../types';
import ExaminationSections from '../components/ExaminationSections';

// Sub-Task 1: Tile section title style — ALL CAPS, 0.875rem, weight 600, #161616
const tileTitleStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  fontWeight: 600,
  color: '#161616',
  textTransform: 'uppercase',
  marginBottom: '1rem',
};

export default function ExaminationDetailPage() {
// DR1 audit: verified detail-page field parity and unconditional field rendering for patient, biometry,
// doppler, anatomy, ultrasound findings, comments, findings, and notes sections.

  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [examination, setExamination] = useState<Examination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState(false);

  const clearDeleteSuccess = useCallback(() => setDeleteSuccess(false), []);
  useAutoNotification(deleteSuccess ? 'done' : null, clearDeleteSuccess);

  const canEdit = user?.role === 'admin' || user?.role === 'doctor';

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
    } catch (err) {
      console.error('[ExaminationDetail] Failed to load examination:', err);
      setError(err instanceof Error ? err.message : 'Failed to load examination');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadExamination();
  }, [loadExamination]);

  const handleEdit = () => {
    navigate(`/examinations/${id}/edit`);
  };

  const handleDeleteClick = () => {
    setDeleteError(null);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteCancel = () => {
    setIsDeleteModalOpen(false);
    setDeleteError(null);
  };

  const handleDeleteConfirm = async () => {
    if (!id) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await examinationService.deleteExamination(id);
      setIsDeleteModalOpen(false);
      setDeleteSuccess(true);
      setTimeout(() => navigate('/examinations'), 1200);
    } catch (err) {
      setIsDeleteModalOpen(false);
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete examination');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBackToExaminations = () => {
    navigate('/examinations');
  };

  const handleBackToPatient = () => {
    if (examination) {
      navigate(`/patients/${examination.patientId}`);
    }
  };

  if (isLoading) {
    return <PageLoader description="Loading ultrasound prenatal exam details..." />;
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
          Back to Ultrasound Prenatal Exams
        </Button>
      </div>
    );
  }

  // ST-07: Derive exam type label + fetus count composite
  const fetusCount = examination.data?.fetuses?.length ?? 0;
  const examTypeLabel = getExamTypeLabel(examination.examinationType ?? 'prenatal');
  const fetusCountLabel = fetusCount > 1 ? ` — ${fetusCount} fetuses` : '';
  const compositeTypeLabel = `${examTypeLabel}${fetusCountLabel}`;

  // Derived values — sourced from stored data
  const lmp = examination.data?.pregnancyData?.lastMenstrualPeriod;
  const edd = lmp ? calcEDD(lmp) : undefined;

  // GA from Bio — read from first fetus (or all fetuses if multiple)
  const gaFromBioValues = (examination.data?.fetuses ?? [])
    .map(f => f.gaFromBiometry?.value ?? '')
    .filter(Boolean);
  const gaFromBioDisplay = gaFromBioValues.length > 0
    ? gaFromBioValues.join(' / ')
    : '—';
  const gaFromBioIsManual = (examination.data?.fetuses ?? []).some(
    f => f.gaFromBiometry?.isManual
  );

  const fieldBlock = (label: string, value: React.ReactNode, labelAdornment?: React.ReactNode) => (
    <div>
      <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '3px' }}>
        <span>{label}</span>
        {labelAdornment}
      </div>
      <div style={{ fontSize: '1rem', fontWeight: 500, textAlign: 'left' }}>{value}</div>
    </div>
  );

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <Breadcrumb noTrailingSlash style={{ marginBottom: '1rem' }}>
        <BreadcrumbItem href="/dashboard">Home</BreadcrumbItem>
        <BreadcrumbItem href="/examinations">Exams</BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>
          {examination.patientName} — {compositeTypeLabel} — {formatPlainDate(examination.examDate)}
        </BreadcrumbItem>
      </Breadcrumb>

      <Stack gap={6}>
        {deleteSuccess && (
          <InlineNotification
            kind="success"
            title="Ultrasound Prenatal Exam deleted"
            subtitle="Redirecting…"
            lowContrast
            hideCloseButton
          />
        )}
        {deleteError && (
          <InlineNotification
            kind="error"
            title="Delete failed"
            subtitle={deleteError}
            lowContrast
            onCloseButtonClick={() => setDeleteError(null)}
          />
        )}

        {/* Header with actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <h1>{compositeTypeLabel} Details</h1>
          <Stack orientation="horizontal" gap={4} style={{ flexWrap: 'wrap' }}>
            <Button
              kind="tertiary"
              renderIcon={ArrowLeft}
              onClick={handleBackToExaminations}
              aria-label="Back to examinations list"
            >
              All Tests
            </Button>
            <Button
              kind="secondary"
              renderIcon={ArrowLeft}
              onClick={handleBackToPatient}
              aria-label={`Back to patient ${examination.patientName}`}
            >
              Back to Patient
            </Button>
            <PrintButton examination={examination} />
            {/* TASK-021: Email report — admin/doctor only */}
            {canEdit && <EmailReportButton examination={examination} />}
            {/* TASK-010: Edit visible only to admin/doctor */}
            {canEdit && (
              <Button
                kind="primary"
                renderIcon={Edit}
                onClick={handleEdit}
                aria-label="Edit this examination"
              >
                Edit
              </Button>
            )}
            {/* TASK-006: Delete — admin/doctor only */}
            {canEdit && (
              <Button
                kind="danger"
                renderIcon={TrashCan}
                onClick={handleDeleteClick}
                aria-label="Delete this examination"
              >
                Delete
              </Button>
            )}
          </Stack>
        </div>

        {/* Status Bar — three-column grid: Date | MRN | Status */}
        <Tile style={{ backgroundColor: '#f4f4f4', padding: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', alignItems: 'start' }}>
            {/* Cell 1: Examination Date + Type */}
            <div>
              <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.5rem' }}>
                Examination Date
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#161616' }}>
                {formatPlainDate(examination.examDate)}
              </div>
              {examination.examinationType && (
                <div style={{ fontSize: '0.875rem', color: '#525252', marginTop: '0.25rem' }}>
                  Type: {compositeTypeLabel}
                </div>
              )}
            </div>
            {/* Cell 2: MRN */}
            <div>
              <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.5rem' }}>MRN</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#161616' }}>
                {examination.mrn || '—'}
              </div>
            </div>
            {/* Cell 3: Status */}
            <div>
              <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.5rem' }}>Status</div>
              {getStatusTag(examination.status)}
            </div>
          </div>
        </Tile>

        {/* Tile 2 — Patient Information */}
        <Tile>
          <div style={tileTitleStyle}>Patient Information</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            {fieldBlock(
              'Patient Name',
              <Link
                to={`/patients/${examination.patientId}`}
                style={{ color: '#0f62fe', textDecoration: 'none' }}
                aria-label={`View patient ${examination.patientName}`}
              >
                {examination.patientName}
              </Link>
            )}
            {fieldBlock('Age at Examination', examination.patientAgeAtExam !== undefined ? `${examination.patientAgeAtExam} years` : '—')}
          </div>
        </Tile>

        {/* Tile 3 — Pregnancy Data */}
        <Tile>
          <div style={tileTitleStyle}>Pregnancy Data</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', textAlign: 'left' }}>
            {/* Row 1: LMP Date | GA from LMP */}
            {fieldBlock('LMP Date', lmp ? formatPlainDate(lmp) : '—')}
            {fieldBlock('GA from LMP',
              <span>
                {examination.gestationalAge || '—'}
                {examination.gestationalAgeIsManual && (
                  <span style={{ color: '#f1c21b', marginLeft: '4px' }}>(manual)</span>
                )}
              </span>
            )}
            {/* Row 2: Expected Delivery Date | GA from Bio */}
            <div style={{ backgroundColor: '#e8f1ff', padding: '0.5rem', borderRadius: '2px', textAlign: 'left' }}>
              <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem', textAlign: 'left' }}>
                Expected Delivery Date
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: '#0f62fe', textAlign: 'left' }}>
                {edd || '—'}
              </div>
            </div>
            {fieldBlock(
              'GA from Bio',
              <span>
                {gaFromBioDisplay}
                {gaFromBioIsManual && (
                  <span style={{ color: '#f1c21b', marginLeft: '4px' }}>(manual)</span>
                )}
              </span>
            )}
            {/* Row 3: Obstetric History | Family History */}
            {fieldBlock('Obstetric History', examination.data?.pregnancyData?.obstetricHistory || '—')}
            {fieldBlock('Family History', examination.data?.pregnancyData?.familyHistory || '—')}
          </div>
        </Tile>

        {/* Ultrasound Findings, Biometry, Anatomy, Doppler sections */}
        <ExaminationSections examination={examination} />

        {/* Tile 4 — Findings */}
        <Tile>
          <div style={tileTitleStyle}>Findings</div>
          {examination.findings ? (
            <div style={{ fontSize: '1rem', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{examination.findings}</div>
          ) : (
            <div style={{ color: '#525252', fontStyle: 'italic' }}>No findings recorded.</div>
          )}
        </Tile>

        {/* Tile 5 — Comments */}
        <Tile>
          <div style={tileTitleStyle}>Comments</div>
          <div style={{ fontSize: '1rem', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
            {examination.data?.comments || '—'}
          </div>
        </Tile>

        {/* Tile 7 — Metadata */}
        <Tile>
          <div style={tileTitleStyle}>Metadata</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            {fieldBlock('Created By', examination.createdByName || examination.createdBy)}
            {fieldBlock('Created At', formatDateTime(examination.createdAt))}
            {fieldBlock('Last Updated', examination.updatedAt ? formatDateTime(examination.updatedAt) : '—')}
          </div>
        </Tile>

        {/* Bottom action bar */}
        <Stack orientation="horizontal" gap={4}>
          <Button kind="tertiary" renderIcon={ArrowLeft} onClick={handleBackToExaminations}>
            All Tests
          </Button>
          <Button kind="secondary" renderIcon={ArrowLeft} onClick={handleBackToPatient}>
            Back to Patient
          </Button>
          <PrintButton examination={examination} />
          {canEdit && <EmailReportButton examination={examination} />}
          {canEdit && (
            <Button kind="primary" renderIcon={Edit} onClick={handleEdit}>
              Edit
            </Button>
          )}
          {canEdit && (
            <Button kind="danger" renderIcon={TrashCan} onClick={handleDeleteClick}>
              Delete
            </Button>
          )}
        </Stack>
      </Stack>

      {/* Delete confirmation modal */}
      <Modal
        open={isDeleteModalOpen}
        danger
        modalHeading="Delete Ultrasound Prenatal Exam"
        primaryButtonText={isDeleting ? 'Deleting…' : 'Delete'}
        secondaryButtonText="Cancel"
        primaryButtonDisabled={isDeleting}
        onRequestSubmit={handleDeleteConfirm}
        onRequestClose={handleDeleteCancel}
        onSecondarySubmit={handleDeleteCancel}
      >
        <p>
          Are you sure you want to delete the ultrasound prenatal test for{' '}
          <strong>{examination.patientName}</strong> dated{' '}
          <strong>{formatPlainDate(examination.examDate)}</strong>?
        </p>
        <p style={{ marginTop: '0.75rem' }}>This action cannot be undone.</p>
        {isDeleting && (
          <InlineLoading description="Deleting…" style={{ marginTop: '0.75rem' }} />
        )}
      </Modal>
    </div>
  );
}

// Made with Bob
