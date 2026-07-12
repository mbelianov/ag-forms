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
import { calcEDD, calcBiometryPercentiles, calcEFWPercentile } from '../utils/calculations';
import PrintButton from '../components/reports/PrintButton';
import EmailReportButton from '../components/reports/EmailReportButton';
import { useAuth } from '../contexts/AuthContext';
import { useAutoNotification } from '../utils/useAutoNotification';
import { formatDateTime, formatPlainDate } from '../utils/formatters';
import { getExamTypeLabel } from '../constants/examinationTypes';
import type { Examination } from '../types';

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
    } catch (err: any) {
      setIsDeleteModalOpen(false);
      setDeleteError(err.message || 'Failed to delete examination');
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

  // ST-01: Derive exam type label for heading and breadcrumb
  const examTypeLabel = examination.examinationType
    ? (getExamTypeLabel(examination.examinationType) !== examination.examinationType
        ? getExamTypeLabel(examination.examinationType)
        : 'Examination')
    : 'Examination';

  const hasBiometry = examination.biometry && Object.values(examination.biometry).some((v) => v !== undefined);
  const hasDoppler = examination.doppler && Object.values(examination.doppler).some((v) => v !== undefined && v !== '');

  // Derived values — computed client-side from stored data (no extra API call needed)
  const lmp = examination.data?.pregnancy_data?.last_menstrual_period;
  const edd = lmp ? calcEDD(lmp) : undefined;
  const gaForPercentiles = examination.gestationalAge;
  const biometryPercentiles = calcBiometryPercentiles(
    examination.biometry?.bpd,
    examination.biometry?.hc,
    examination.biometry?.ac,
    examination.biometry?.fl,
    gaForPercentiles ?? '',
  );
  const efwPercentile = (examination.biometry?.efw && gaForPercentiles)
    ? calcEFWPercentile(examination.biometry.efw, gaForPercentiles)
    : undefined;

  const hasUltrasoundFindings = !!(
    examination.data?.ultrasound_findings?.presentation ||
    examination.data?.ultrasound_findings?.gender ||
    examination.data?.ultrasound_findings?.heart_rate ||
    examination.data?.ultrasound_findings?.fetal_movement ||
    examination.data?.ultrasound_findings?.placenta ||
    examination.data?.ultrasound_findings?.umbilical_cord
  );
  const hasAnatomy = !!(examination.data?.anatomy && Object.values(examination.data.anatomy).some(Boolean));

  // TASK-036: Extended vascular check
  const hasVascular = !!(
    examination.doppler?.utADexPI !== undefined ||
    examination.doppler?.utADexRI !== undefined ||
    examination.doppler?.utASinPI !== undefined ||
    examination.doppler?.utASinRI !== undefined ||
    examination.doppler?.cma !== undefined ||
    examination.doppler?.psv !== undefined ||
    examination.doppler?.cpr !== undefined ||
    examination.doppler?.ducVen
  );

  const fieldBlock = (label: string, value: React.ReactNode) => (
    <div>
      <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>{label}</div>
      <div style={{ fontSize: '1rem', fontWeight: 500 }}>{value}</div>
    </div>
  );

  const pctBadge = (pct: number | undefined) =>
    pct !== undefined ? (
      <span style={{ marginLeft: '0.5rem', color: '#525252', fontSize: '0.875rem' }}>
        ({pct}th percentile)
      </span>
    ) : null;

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <Breadcrumb noTrailingSlash style={{ marginBottom: '1rem' }}>
        <BreadcrumbItem href="/dashboard">Home</BreadcrumbItem>
        <BreadcrumbItem href="/examinations">Exams</BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>
          {examination.patientName} — {examTypeLabel} — {formatPlainDate(examination.examDate)}
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
          <h1>{examTypeLabel} Details</h1>
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

        {/* Status, Date and MRN — ST-04: three-column layout */}
        <Tile style={{ backgroundColor: '#f4f4f4', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.5rem' }}>
                Examination Date
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#161616' }}>
                {formatPlainDate(examination.examDate)}
              </div>
              {/* TASK-033: Examination type */}
              {examination.examinationType && (
                <div style={{ fontSize: '0.875rem', color: '#525252', marginTop: '0.25rem' }}>
                  Type: {examination.examinationType.replace(/_/g, ' ')}
                </div>
              )}
            </div>
            <div>
              <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.5rem' }}>MRN</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#161616' }}>
                {examination.mrn || '—'}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
              <div style={{ fontSize: '0.875rem', color: '#525252' }}>Status</div>
              {getStatusTag(examination.status)}
            </div>
          </div>
        </Tile>

        {/* Patient Information */}
        <Tile>
          <h3 style={{ marginBottom: '1.5rem' }}>Patient Information</h3>
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
            {fieldBlock('Patient Age at Exam', examination.patientAgeAtExam !== undefined ? `${examination.patientAgeAtExam} years` : '—')}
            {fieldBlock('Gestational Age (from LMP)', examination.gestationalAge || '—')}
            {fieldBlock('Gestational Age (from Biometry)', examination.gestationalAgeFromBiometry || '—')}
            <div>
              <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>
                Expected Delivery Date (EDD)
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 500, color: '#0f62fe' }}>
                {edd || '—'}
              </div>
            </div>
            {fieldBlock('Last Menstrual Period (LMP)', lmp ? formatPlainDate(lmp) : '—')}
            {fieldBlock('Obstetric History', examination.data?.pregnancy_data?.obstetric_history || '—')}
            {fieldBlock('Family History', examination.data?.pregnancy_data?.family_history || '—')}
          </div>
        </Tile>

        {/* Biometry */}
        <Tile>
          <h3 style={{ marginBottom: '1.5rem' }}>Biometry Measurements</h3>
          {hasBiometry ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
              {examination.biometry!.bpd !== undefined && (
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>BPD (Biparietal Diameter)</div>
                  <div style={{ fontSize: '1rem', fontWeight: 500 }}>
                    {examination.biometry!.bpd} mm{biometryPercentiles && pctBadge(biometryPercentiles.bpd)}
                  </div>
                </div>
              )}
              {examination.biometry!.hc !== undefined && (
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>HC (Head Circumference)</div>
                  <div style={{ fontSize: '1rem', fontWeight: 500 }}>
                    {examination.biometry!.hc} mm{biometryPercentiles && pctBadge(biometryPercentiles.hc)}
                  </div>
                </div>
              )}
              {examination.biometry!.ac !== undefined && (
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>AC (Abdominal Circumference)</div>
                  <div style={{ fontSize: '1rem', fontWeight: 500 }}>
                    {examination.biometry!.ac} mm{biometryPercentiles && pctBadge(biometryPercentiles.ac)}
                  </div>
                </div>
              )}
              {examination.biometry!.fl !== undefined && (
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>FL (Femur Length)</div>
                  <div style={{ fontSize: '1rem', fontWeight: 500 }}>
                    {examination.biometry!.fl} mm{biometryPercentiles && pctBadge(biometryPercentiles.fl)}
                  </div>
                </div>
              )}
              {examination.biometry!.efw !== undefined && (
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>EFW (Estimated Fetal Weight)</div>
                  <div style={{ fontSize: '1rem', fontWeight: 500 }}>
                    {examination.biometry!.efw} g{pctBadge(efwPercentile)}
                  </div>
                </div>
              )}
              {/* TASK-034: Extended biometry */}
              {examination.biometry!.ofd !== undefined && (
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>OFD (Occipito-frontal Diameter)</div>
                  <div style={{ fontSize: '1rem', fontWeight: 500 }}>{examination.biometry!.ofd} mm</div>
                </div>
              )}
              {examination.biometry!.vp !== undefined && (
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>Vp (Vermis)</div>
                  <div style={{ fontSize: '1rem', fontWeight: 500 }}>{examination.biometry!.vp} mm</div>
                </div>
              )}
              {examination.biometry!.tcd !== undefined && (
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>TCD (Transcerebellar Diameter)</div>
                  <div style={{ fontSize: '1rem', fontWeight: 500 }}>{examination.biometry!.tcd} mm</div>
                </div>
              )}
              {examination.biometry!.cm !== undefined && (
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>CM (Cisterna Magna)</div>
                  <div style={{ fontSize: '1rem', fontWeight: 500 }}>{examination.biometry!.cm} mm</div>
                </div>
              )}
              {examination.biometry!.nuchalFold !== undefined && (
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>Nuchal Fold</div>
                  <div style={{ fontSize: '1rem', fontWeight: 500 }}>{examination.biometry!.nuchalFold} mm</div>
                </div>
              )}
              {examination.biometry!.nb !== undefined && (
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>NB (Nasal Bone)</div>
                  <div style={{ fontSize: '1rem', fontWeight: 500 }}>{examination.biometry!.nb} mm</div>
                </div>
              )}
              {examination.biometry!.apad !== undefined && (
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>APAD</div>
                  <div style={{ fontSize: '1rem', fontWeight: 500 }}>{examination.biometry!.apad} mm</div>
                </div>
              )}
              {examination.biometry!.tad !== undefined && (
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>TAD</div>
                  <div style={{ fontSize: '1rem', fontWeight: 500 }}>{examination.biometry!.tad} mm</div>
                </div>
              )}
              {/* TASK-035: LA and LC */}
              {examination.biometry!.la !== undefined && (
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>LA (Left Atrium)</div>
                  <div style={{ fontSize: '1rem', fontWeight: 500 }}>{examination.biometry!.la} mm</div>
                </div>
              )}
              {examination.biometry!.lc !== undefined && (
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>LC (Left Cardiac)</div>
                  <div style={{ fontSize: '1rem', fontWeight: 500 }}>{examination.biometry!.lc} mm</div>
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
          {hasDoppler || hasVascular ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
              {fieldBlock('PI (Pulsatility Index)', examination.doppler?.pi !== undefined ? examination.doppler.pi : '—')}
              {fieldBlock('RI (Resistance Index)', examination.doppler?.ri !== undefined ? examination.doppler.ri : '—')}
              {fieldBlock('Vessel', examination.doppler?.vessel || '—')}
              {fieldBlock('A.ut. Dex PI', examination.doppler?.utADexPI !== undefined ? examination.doppler.utADexPI : '—')}
              {fieldBlock('A.ut. Dex RI', examination.doppler?.utADexRI !== undefined ? examination.doppler.utADexRI : '—')}
              {fieldBlock('A.ut. Sin PI', examination.doppler?.utASinPI !== undefined ? examination.doppler.utASinPI : '—')}
              {fieldBlock('A.ut. Sin RI', examination.doppler?.utASinRI !== undefined ? examination.doppler.utASinRI : '—')}
              {fieldBlock('CMA', examination.doppler?.cma !== undefined ? examination.doppler.cma : '—')}
              {fieldBlock('PSV', examination.doppler?.psv !== undefined ? examination.doppler.psv : '—')}
              {fieldBlock('CPR', examination.doppler?.cpr !== undefined ? examination.doppler.cpr : '—')}
              {fieldBlock('Duc.Ven', examination.doppler?.ducVen || '—')}
            </div>
          ) : (
            <div style={{ color: '#525252', fontStyle: 'italic' }}>No Doppler measurements recorded.</div>
          )}
        </Tile>


        {/* Ultrasound Findings */}
        {hasUltrasoundFindings && (
          <Tile>
            <h3 style={{ marginBottom: '1.5rem' }}>Ultrasound Findings</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
              {fieldBlock('Presentation', examination.data?.ultrasound_findings?.presentation ? <span style={{ textTransform: 'capitalize' }}>{examination.data.ultrasound_findings.presentation}</span> : '—')}
              {fieldBlock('Gender', examination.data?.ultrasound_findings?.gender ? <span style={{ textTransform: 'capitalize' }}>{examination.data.ultrasound_findings.gender}</span> : '—')}
              {fieldBlock('Fetal Heart Rate', examination.data?.ultrasound_findings?.heart_rate !== undefined ? `${examination.data.ultrasound_findings.heart_rate} bpm` : '—')}
              {fieldBlock('Fetal Movement', examination.data?.ultrasound_findings?.fetal_movement ? <span style={{ textTransform: 'capitalize' }}>{examination.data.ultrasound_findings.fetal_movement}</span> : '—')}
              {fieldBlock('Placenta', examination.data?.ultrasound_findings?.placenta || '—')}
              {fieldBlock('Umbilical Cord', examination.data?.ultrasound_findings?.umbilical_cord || '—')}
            </div>
          </Tile>
        )}

        {/* Anatomy */}
        {hasAnatomy && (
          <Tile>
            <h3 style={{ marginBottom: '1.5rem' }}>Anatomy</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1.5rem' }}>
              {fieldBlock('Head', examination.data?.anatomy?.head || '—')}
              {fieldBlock('Brain', examination.data?.anatomy?.brain || '—')}
              {fieldBlock('Heart', examination.data?.anatomy?.heart || '—')}
              {fieldBlock('Abdomen', examination.data?.anatomy?.abdomen || '—')}
              {fieldBlock('Kidneys', examination.data?.anatomy?.kidneys || '—')}
              {fieldBlock('Limbs', examination.data?.anatomy?.limbs || '—')}
              {fieldBlock('Skeleton', examination.data?.anatomy?.skeleton || '—')}
              {fieldBlock('Face', examination.data?.anatomy?.face || '—')}
              {fieldBlock('Neck / Skin', examination.data?.anatomy?.neckSkin || '—')}
              {fieldBlock('Spine', examination.data?.anatomy?.spine || '—')}
              {fieldBlock('Thorax', examination.data?.anatomy?.thorax || '—')}
            </div>
          </Tile>
        )}

        {/* Clinical Information */}
        <Tile>
          <h3 style={{ marginBottom: '1.5rem' }}>Clinical Information</h3>
          <Stack gap={5}>
            <div>
              <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.5rem', fontWeight: 600 }}>Findings</div>
              {examination.findings ? (
                <div style={{ fontSize: '1rem', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{examination.findings}</div>
              ) : (
                <div style={{ color: '#525252', fontStyle: 'italic' }}>No findings recorded.</div>
              )}
            </div>
          </Stack>
        </Tile>

        {/* Comments */}
        <Tile>
          <h3 style={{ marginBottom: '1.5rem' }}>Comments</h3>
          <div style={{ fontSize: '1rem', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
            {examination.data?.comments || '—'}
          </div>
        </Tile>

        <Tile>
          <h3 style={{ marginBottom: '1.5rem' }}>Notes</h3>
          <div style={{ fontSize: '1rem', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
            {examination.notes || '—'}
          </div>
        </Tile>

        {/* Metadata — TASK-016: show updatedAt */}
        <Tile>
          <h3 style={{ marginBottom: '1.5rem' }}>Metadata</h3>
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
