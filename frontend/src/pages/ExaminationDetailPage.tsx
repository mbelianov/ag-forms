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
import { calcEDD, calcBiometryPercentiles, calcEFWPercentile } from '../utils/calculations';
import PrintButton from '../components/reports/PrintButton';
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
            <PrintButton examination={examination} />
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
                  Gestational Age (from LMP)
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 500 }}>
                  {examination.gestationalAge}
                </div>
              </div>
            )}

            {examination.gestationalAgeFromBiometry && (
              <div>
                <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>
                  Gestational Age (from Biometry)
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 500 }}>
                  {examination.gestationalAgeFromBiometry}
                </div>
              </div>
            )}

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
                  <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>
                    BPD (Biparietal Diameter)
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 500 }}>
                    {examination.biometry!.bpd} mm
                    {biometryPercentiles && <span style={{ marginLeft: '0.5rem', color: '#525252', fontSize: '0.875rem' }}>({biometryPercentiles.bpd}th percentile)</span>}
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
                    {biometryPercentiles && <span style={{ marginLeft: '0.5rem', color: '#525252', fontSize: '0.875rem' }}>({biometryPercentiles.hc}th percentile)</span>}
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
                    {biometryPercentiles && <span style={{ marginLeft: '0.5rem', color: '#525252', fontSize: '0.875rem' }}>({biometryPercentiles.ac}th percentile)</span>}
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
                    {biometryPercentiles && <span style={{ marginLeft: '0.5rem', color: '#525252', fontSize: '0.875rem' }}>({biometryPercentiles.fl}th percentile)</span>}
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
                    {efwPercentile !== undefined && <span style={{ marginLeft: '0.5rem', color: '#525252', fontSize: '0.875rem' }}>({efwPercentile}th percentile)</span>}
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

        {/* Pregnancy Data */}
        {hasPregnancyData && (
          <Tile>
            <h3 style={{ marginBottom: '1.5rem' }}>Pregnancy Data</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
              {lmp && (
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>Last Menstrual Period (LMP)</div>
                  <div style={{ fontSize: '1rem', fontWeight: 500 }}>{formatDate(lmp)}</div>
                </div>
              )}
              {examination.data?.pregnancy_data?.obstetric_history && (
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>Obstetric History</div>
                  <div style={{ fontSize: '1rem', fontWeight: 500 }}>{examination.data.pregnancy_data.obstetric_history}</div>
                </div>
              )}
              {examination.data?.pregnancy_data?.family_history && (
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>Family History</div>
                  <div style={{ fontSize: '1rem', fontWeight: 500 }}>{examination.data.pregnancy_data.family_history}</div>
                </div>
              )}
            </div>
          </Tile>
        )}

        {/* Ultrasound Findings */}
        {hasUltrasoundFindings && (
          <Tile>
            <h3 style={{ marginBottom: '1.5rem' }}>Ultrasound Findings</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
              {examination.data?.ultrasound_findings?.presentation && (
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>Presentation</div>
                  <div style={{ fontSize: '1rem', fontWeight: 500, textTransform: 'capitalize' }}>{examination.data.ultrasound_findings.presentation}</div>
                </div>
              )}
              {examination.data?.ultrasound_findings?.gender && (
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>Gender</div>
                  <div style={{ fontSize: '1rem', fontWeight: 500, textTransform: 'capitalize' }}>{examination.data.ultrasound_findings.gender}</div>
                </div>
              )}
              {examination.data?.ultrasound_findings?.heart_rate !== undefined && (
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>Fetal Heart Rate</div>
                  <div style={{ fontSize: '1rem', fontWeight: 500 }}>{examination.data.ultrasound_findings.heart_rate} bpm</div>
                </div>
              )}
              {examination.data?.ultrasound_findings?.fetal_movement && (
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>Fetal Movement</div>
                  <div style={{ fontSize: '1rem', fontWeight: 500, textTransform: 'capitalize' }}>{examination.data.ultrasound_findings.fetal_movement}</div>
                </div>
              )}
              {examination.data?.ultrasound_findings?.placenta && (
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>Placenta</div>
                  <div style={{ fontSize: '1rem', fontWeight: 500 }}>{examination.data.ultrasound_findings.placenta}</div>
                </div>
              )}
              {examination.data?.ultrasound_findings?.umbilical_cord && (
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>Umbilical Cord</div>
                  <div style={{ fontSize: '1rem', fontWeight: 500 }}>{examination.data.ultrasound_findings.umbilical_cord}</div>
                </div>
              )}
            </div>
          </Tile>
        )}

        {/* Anatomy */}
        {hasAnatomy && (
          <Tile>
            <h3 style={{ marginBottom: '1.5rem' }}>Anatomy</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1.5rem' }}>
              {examination.data?.anatomy?.head && (
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>Head</div>
                  <div style={{ fontSize: '1rem', fontWeight: 500 }}>{examination.data.anatomy.head}</div>
                </div>
              )}
              {examination.data?.anatomy?.brain && (
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>Brain</div>
                  <div style={{ fontSize: '1rem', fontWeight: 500 }}>{examination.data.anatomy.brain}</div>
                </div>
              )}
              {examination.data?.anatomy?.heart && (
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>Heart</div>
                  <div style={{ fontSize: '1rem', fontWeight: 500 }}>{examination.data.anatomy.heart}</div>
                </div>
              )}
              {examination.data?.anatomy?.abdomen && (
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>Abdomen</div>
                  <div style={{ fontSize: '1rem', fontWeight: 500 }}>{examination.data.anatomy.abdomen}</div>
                </div>
              )}
              {examination.data?.anatomy?.kidneys && (
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>Kidneys</div>
                  <div style={{ fontSize: '1rem', fontWeight: 500 }}>{examination.data.anatomy.kidneys}</div>
                </div>
              )}
              {examination.data?.anatomy?.limbs && (
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>Limbs</div>
                  <div style={{ fontSize: '1rem', fontWeight: 500 }}>{examination.data.anatomy.limbs}</div>
                </div>
              )}
              {examination.data?.anatomy?.skeleton && (
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>Skeleton</div>
                  <div style={{ fontSize: '1rem', fontWeight: 500 }}>{examination.data.anatomy.skeleton}</div>
                </div>
              )}
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
          <PrintButton examination={examination} />
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
