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
import { calcOFDPercentile, calcTCDPercentile, calcNuchalFoldPercentile, calcAPADPercentile, calcTADPercentile } from '../utils/calculations';
import PrintButton from '../components/reports/PrintButton';
import EmailReportButton from '../components/reports/EmailReportButton';
import { useAuth } from '../contexts/AuthContext';
import { useAutoNotification } from '../utils/useAutoNotification';
import { formatDateTime, formatPlainDate } from '../utils/formatters';
import type { Examination } from '../types';

export default function ExaminationDetailPage() {
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
    return <PageLoader description="Loading ultrasound prenatal test details..." />;
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
          Back to Ultrasound Prenatal Tests
        </Button>
      </div>
    );
  }

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

  // TASK-034: Extended biometry percentiles
  const ga = gaForPercentiles ?? '';
  const ofdPct = calcOFDPercentile(examination.biometry?.ofd, ga);
  const tcdPct = calcTCDPercentile(examination.biometry?.tcd, ga);
  const nfPct = calcNuchalFoldPercentile(examination.biometry?.nuchalFold, ga);
  const apadPct = calcAPADPercentile(examination.biometry?.apad, ga);
  const tadPct = calcTADPercentile(examination.biometry?.tad, ga);

  const hasPregnancyData = !!(lmp || examination.data?.pregnancy_data?.obstetric_history || examination.data?.pregnancy_data?.family_history);
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
        <BreadcrumbItem href="/examinations">Ultrasound Prenatal Tests</BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>
          {examination.patientName} — {formatPlainDate(examination.examDate)}
        </BreadcrumbItem>
      </Breadcrumb>

      <Stack gap={6}>
        {deleteSuccess && (
          <InlineNotification
            kind="success"
            title="Ultrasound Prenatal Test deleted"
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
          <h1>Ultrasound Prenatal Test Details</h1>
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

        {/* Status and Date */}
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
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
              <div style={{ fontSize: '0.875rem', color: '#525252' }}>Status</div>
              {getStatusTag(examination.status)}
            </div>
          </div>
        </Tile>

        {/* Patient Information */}
        <Tile>
          <h3 style={{ marginBottom: '1.5rem' }}>Patient Information</h3>
          <Stack gap={4}>
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
            {fieldBlock('MRN', examination.mrn)}
            {/* TASK-037: Patient age at exam */}
            {examination.patientAgeAtExam !== undefined &&
              fieldBlock('Patient Age at Exam', `${examination.patientAgeAtExam} years`)}
            {examination.gestationalAge &&
              fieldBlock('Gestational Age (from LMP)', examination.gestationalAge)}
            {examination.gestationalAgeFromBiometry &&
              fieldBlock('Gestational Age (from Biometry)', examination.gestationalAgeFromBiometry)}
            {edd && (
              <div>
                <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>
                  Expected Delivery Date (EDD)
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 500, color: '#0f62fe' }}>
                  {edd}
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
                  <div style={{ fontSize: '1rem', fontWeight: 500 }}>{examination.biometry!.ofd} mm{pctBadge(ofdPct)}</div>
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
                  <div style={{ fontSize: '1rem', fontWeight: 500 }}>{examination.biometry!.tcd} mm{pctBadge(tcdPct)}</div>
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
                  <div style={{ fontSize: '1rem', fontWeight: 500 }}>{examination.biometry!.nuchalFold} mm{pctBadge(nfPct)}</div>
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
                  <div style={{ fontSize: '1rem', fontWeight: 500 }}>{examination.biometry!.apad} mm{pctBadge(apadPct)}</div>
                </div>
              )}
              {examination.biometry!.tad !== undefined && (
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>TAD</div>
                  <div style={{ fontSize: '1rem', fontWeight: 500 }}>{examination.biometry!.tad} mm{pctBadge(tadPct)}</div>
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
              {examination.doppler!.pi !== undefined && fieldBlock('PI (Pulsatility Index)', examination.doppler!.pi)}
              {examination.doppler!.ri !== undefined && fieldBlock('RI (Resistance Index)', examination.doppler!.ri)}
              {examination.doppler!.vessel && fieldBlock('Vessel', examination.doppler!.vessel)}
              {/* TASK-036: Extended vascular */}
              {examination.doppler?.utADexPI !== undefined && fieldBlock('A.ut. Dex PI', examination.doppler.utADexPI)}
              {examination.doppler?.utADexRI !== undefined && fieldBlock('A.ut. Dex RI', examination.doppler.utADexRI)}
              {examination.doppler?.utASinPI !== undefined && fieldBlock('A.ut. Sin PI', examination.doppler.utASinPI)}
              {examination.doppler?.utASinRI !== undefined && fieldBlock('A.ut. Sin RI', examination.doppler.utASinRI)}
              {examination.doppler?.cma !== undefined && fieldBlock('CMA', examination.doppler.cma)}
              {examination.doppler?.psv !== undefined && fieldBlock('PSV', examination.doppler.psv)}
              {examination.doppler?.cpr !== undefined && fieldBlock('CPR', examination.doppler.cpr)}
              {examination.doppler?.ducVen && fieldBlock('Duc.Ven', examination.doppler.ducVen)}
            </div>
          ) : (
            <div style={{ color: '#525252', fontStyle: 'italic' }}>No Doppler measurements recorded.</div>
          )}
        </Tile>

        {/* Pregnancy Data */}
        {hasPregnancyData && (
          <Tile>
            <h3 style={{ marginBottom: '1.5rem' }}>Pregnancy Data</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
              {lmp && fieldBlock('Last Menstrual Period (LMP)', formatPlainDate(lmp))}
              {examination.data?.pregnancy_data?.obstetric_history && fieldBlock('Obstetric History', examination.data.pregnancy_data.obstetric_history)}
              {examination.data?.pregnancy_data?.family_history && fieldBlock('Family History', examination.data.pregnancy_data.family_history)}
            </div>
          </Tile>
        )}

        {/* Ultrasound Findings */}
        {hasUltrasoundFindings && (
          <Tile>
            <h3 style={{ marginBottom: '1.5rem' }}>Ultrasound Findings</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
              {examination.data?.ultrasound_findings?.presentation && fieldBlock('Presentation', <span style={{ textTransform: 'capitalize' }}>{examination.data.ultrasound_findings.presentation}</span>)}
              {examination.data?.ultrasound_findings?.gender && fieldBlock('Gender', <span style={{ textTransform: 'capitalize' }}>{examination.data.ultrasound_findings.gender}</span>)}
              {examination.data?.ultrasound_findings?.heart_rate !== undefined && fieldBlock('Fetal Heart Rate', `${examination.data.ultrasound_findings.heart_rate} bpm`)}
              {examination.data?.ultrasound_findings?.fetal_movement && fieldBlock('Fetal Movement', <span style={{ textTransform: 'capitalize' }}>{examination.data.ultrasound_findings.fetal_movement}</span>)}
              {examination.data?.ultrasound_findings?.placenta && fieldBlock('Placenta', examination.data.ultrasound_findings.placenta)}
              {examination.data?.ultrasound_findings?.umbilical_cord && fieldBlock('Umbilical Cord', examination.data.ultrasound_findings.umbilical_cord)}
            </div>
          </Tile>
        )}

        {/* Anatomy */}
        {hasAnatomy && (
          <Tile>
            <h3 style={{ marginBottom: '1.5rem' }}>Anatomy</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1.5rem' }}>
              {examination.data?.anatomy?.head && fieldBlock('Head', examination.data.anatomy.head)}
              {examination.data?.anatomy?.brain && fieldBlock('Brain', examination.data.anatomy.brain)}
              {examination.data?.anatomy?.heart && fieldBlock('Heart', examination.data.anatomy.heart)}
              {examination.data?.anatomy?.abdomen && fieldBlock('Abdomen', examination.data.anatomy.abdomen)}
              {examination.data?.anatomy?.kidneys && fieldBlock('Kidneys', examination.data.anatomy.kidneys)}
              {examination.data?.anatomy?.limbs && fieldBlock('Limbs', examination.data.anatomy.limbs)}
              {examination.data?.anatomy?.skeleton && fieldBlock('Skeleton', examination.data.anatomy.skeleton)}
              {/* TASK-036: Extended anatomy */}
              {examination.data?.anatomy?.face && fieldBlock('Face', examination.data.anatomy.face)}
              {examination.data?.anatomy?.neckSkin && fieldBlock('Neck / Skin', examination.data.anatomy.neckSkin)}
              {examination.data?.anatomy?.spine && fieldBlock('Spine', examination.data.anatomy.spine)}
              {examination.data?.anatomy?.thorax && fieldBlock('Thorax', examination.data.anatomy.thorax)}
            </div>
          </Tile>
        )}

        {/* Comments */}
        {examination.data?.comments && (
          <Tile>
            <h3 style={{ marginBottom: '1.5rem' }}>Comments</h3>
            <div style={{ fontSize: '1rem', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
              {examination.data.comments}
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
            <div>
              <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.5rem', fontWeight: 600 }}>Notes</div>
              {examination.notes ? (
                <div style={{ fontSize: '1rem', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{examination.notes}</div>
              ) : (
                <div style={{ color: '#525252', fontStyle: 'italic' }}>No notes recorded.</div>
              )}
            </div>
          </Stack>
        </Tile>

        {/* Metadata — TASK-016: show updatedAt */}
        <Tile>
          <h3 style={{ marginBottom: '1.5rem' }}>Metadata</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            {fieldBlock('Created By', examination.createdByName || examination.createdBy)}
            {fieldBlock('Created At', formatDateTime(examination.createdAt))}
            {examination.updatedAt && fieldBlock('Last Updated', formatDateTime(examination.updatedAt))}
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
        modalHeading="Delete Ultrasound Prenatal Test"
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
