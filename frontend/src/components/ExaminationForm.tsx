/**
 * ExaminationForm.tsx — Config-driven examination form (ST-07 rewrite).
 *
 * Drives all section rendering from EXAM_TYPE_CONFIG + formData.fetuses[].
 * Uses ObservableSection for biometry/doppler, existing section components for descriptive fields.
 * Fetus section container: flex row + min-width 480px + overflow-x auto (§13.3).
 * Create form: exam type selector (2 options) + fetus count selector.
 * Edit form: both exam type and fetus count are read-only.
 */
import React from 'react';
import {
  Form,
  Stack,
  TextInput,
  TextArea,
  Button,
  ButtonSet,
  InlineNotification,
  Select,
  SelectItem,
  DatePicker,
  DatePickerInput,
  NumberInput,
} from '@carbon/react';
import { EXAM_TYPES, getExamTypeLabel } from '../constants/examinationTypes';
import { autoSuffix } from './AutoCalcHelpers';
import { ObservableSection } from './sections/ObservableSection';
import { DopplerSection } from './sections/DopplerSection';
import { useExaminationForm } from '../hooks/useExaminationForm';
import type { ExaminationFormProps } from '../hooks/useExaminationForm';

export type { ExaminationFormProps };

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDisplayDate(iso: string): string {
  const [yyyy, mm, dd] = iso.split('-');
  return `${dd}/${mm}/${yyyy}`;
}

function toISODate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function todayDisplayDate(): string {
  return toDisplayDate(toISODate(new Date()));
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ExaminationForm(props: ExaminationFormProps) {
  const {
    formData,
    errors,
    isSubmitting,
    submitError,
    edd,
    examConfig,
    patientAge,
    handleChange,
    handleFetusChange,
    handleFetusDescriptorChange,
    handleFetusCountChange,
    handleSubmit,
  } = useExaminationForm(props);

  const { examination, patients, preselectedPatientId, onCancel, isEdit = false } = props;

  // Dismiss submit error helper (not exposed from hook, managed locally)
  const [localSubmitError, setLocalSubmitError] = React.useState<string | null>(null);
  React.useEffect(() => {
    setLocalSubmitError(submitError);
  }, [submitError]);

  const fetusCount = formData.fetuses.length;

  // Layout helpers
  const row3: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' };
  const row4: React.CSSProperties = { display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr', gap: '0.75rem' };

  // Fetus section container (§13.3)
  const fetusSectionContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: '1.5rem',
    width: '100%',
    overflowX: 'auto',
  };

  const fetusColumnStyle: React.CSSProperties = {
    minWidth: '480px',
    flex: '0 0 calc(50% - 0.75rem)',
  };

  const renderFetusSections = (fi: number) => {
    const fetus = formData.fetuses[fi];
    if (!fetus) return null;
    const config = examConfig;
    const uf = fetus.ultrasoundFindings as Record<string, string>;
    const anat = fetus.anatomy as Record<string, string>;
    const markers = fetus.markers as Record<string, string>;
    const prefix = `f${fi}`;

    return (
      <div key={fi} style={fetusColumnStyle}>
        {/* Column header — only when multiple fetuses */}
        {fetusCount > 1 && (
          <h3 style={{ marginBottom: '1rem', fontWeight: 600, fontSize: '1rem' }}>
            Fetus {fi + 1}
          </h3>
        )}

        {/* Ultrasound Findings */}
        <div style={{ marginBottom: '1rem' }}>
          <h5 className="observable-section-title">Ultrasound Findings</h5>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
            <Select
              id={`${prefix}_uf_presentation`}
              labelText="Presentation"
              value={uf.presentation ?? ''}
              onChange={(e) => handleFetusDescriptorChange(fi, 'ultrasoundFindings', 'presentation', e.target.value)}
              disabled={isSubmitting}
              size="sm"
            >
              <SelectItem value="" text="Select" />
              <SelectItem value="cephalic" text="Cephalic" />
              <SelectItem value="breech" text="Breech" />
              <SelectItem value="transverse" text="Transverse" />
              <SelectItem value="oblique" text="Oblique" />
            </Select>
            <Select
              id={`${prefix}_uf_gender`}
              labelText="Gender"
              value={uf.gender ?? ''}
              onChange={(e) => handleFetusDescriptorChange(fi, 'ultrasoundFindings', 'gender', e.target.value)}
              disabled={isSubmitting}
              size="sm"
            >
              <SelectItem value="" text="Select" />
              <SelectItem value="male" text="Male" />
              <SelectItem value="female" text="Female" />
              <SelectItem value="unknown" text="Unknown" />
            </Select>
            <TextInput
              id={`${prefix}_uf_heart_rate`}
              labelText="FHR (bpm)"
              placeholder="e.g. 145"
              value={uf.heart_rate ?? ''}
              onChange={(e) => handleFetusDescriptorChange(fi, 'ultrasoundFindings', 'heart_rate', e.target.value)}
              invalid={!!errors[`${prefix}_hr`]}
              invalidText={errors[`${prefix}_hr`]}
              disabled={isSubmitting}
              size="sm"
            />
            <Select
              id={`${prefix}_uf_fetal_movement`}
              labelText="Fetal Movement"
              value={uf.fetal_movement ?? ''}
              onChange={(e) => handleFetusDescriptorChange(fi, 'ultrasoundFindings', 'fetal_movement', e.target.value)}
              disabled={isSubmitting}
              size="sm"
            >
              <SelectItem value="" text="Select" />
              <SelectItem value="active" text="Active" />
              <SelectItem value="present" text="Present" />
              <SelectItem value="reduced" text="Reduced" />
              <SelectItem value="absent" text="Absent" />
            </Select>
            <TextInput
              id={`${prefix}_uf_placenta`}
              labelText="Placenta"
              value={uf.placenta ?? ''}
              onChange={(e) => handleFetusDescriptorChange(fi, 'ultrasoundFindings', 'placenta', e.target.value)}
              disabled={isSubmitting}
              size="sm"
            />
            <TextInput
              id={`${prefix}_uf_umbilical_cord`}
              labelText="Umbilical Cord"
              value={uf.umbilical_cord ?? ''}
              onChange={(e) => handleFetusDescriptorChange(fi, 'ultrasoundFindings', 'umbilical_cord', e.target.value)}
              disabled={isSubmitting}
              size="sm"
            />
          </div>
        </div>

        <h5 className="observable-section-title">Biometry</h5>
        {/* GA from Biometry */}
        <TextInput
          id={`${prefix}_gaFromBio`}
          labelText={
            <>
              GA from Biometry {autoSuffix(fetus.gaFromBiometry.isManual, undefined, !!fetus.gaFromBiometry.value)}
            </>
          }
          placeholder="auto"
          value={fetus.gaFromBiometry.value}
          onChange={(e) => handleFetusDescriptorChange(fi, 'gaFromBiometry', '', e.target.value)}
          invalid={!!errors[`${prefix}_gaFromBio`]}
          invalidText={errors[`${prefix}_gaFromBio`]}
          disabled={isSubmitting}
          style={{ marginBottom: '1rem' }}
        />

        {/* Biometry section */}
        <ObservableSection
          title="Measurements"
          fetusIndex={fi}
          sectionKey="biometry"
          typeConfigs={config.biometryTypes}
          data={fetus.biometry}
          disabled={isSubmitting}
          onFieldChange={handleFetusChange}
        />

        {/* Doppler section */}
        <DopplerSection
          fetusIndex={fi}
          vesselConfigs={config.dopplerVessels}
          singleConfigs={config.dopplerSingle}
          data={fetus.doppler}
          disabled={isSubmitting}
          onFieldChange={handleFetusChange}
        />

        {/* Anatomy */}
        <div style={{ marginTop: '1.5rem' }}>
          <h5 className="observable-section-title">Anatomy</h5>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
            {['head','brain','heart','abdomen','kidneys','limbs','skeleton','face','neckSkin','spine','thorax'].map(key => (
              <TextInput
                key={key}
                id={`${prefix}_anat_${key}`}
                labelText={key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}
                value={anat[key] ?? ''}
                onChange={(e) => handleFetusDescriptorChange(fi, 'anatomy', key, e.target.value)}
                disabled={isSubmitting}
                size="sm"
              />
            ))}
          </div>
        </div>

        {/* Markers — config-driven, only rendered when markerTypes is non-empty */}
        {examConfig.markerTypes.length > 0 && (
          <div style={{ marginTop: '1.5rem' }}>
            <h5 className="observable-section-title">First Trimester Markers</h5>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
              {examConfig.markerTypes.map(({ key, label }) => (
                <Select
                  key={key}
                  id={`${prefix}_mkr_${key}`}
                  labelText={label}
                  value={markers[key] ?? ''}
                  onChange={(e) => handleFetusDescriptorChange(fi, 'markers', key, e.target.value)}
                  disabled={isSubmitting}
                  size="sm"
                >
                  <SelectItem value="" text="Select" />
                  <SelectItem value="absent" text="Absent" />
                  <SelectItem value="present" text="Present" />
                  <SelectItem value="normal" text="Normal" />
                  <SelectItem value="abnormal" text="Abnormal" />
                </Select>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Form onSubmit={handleSubmit} autoComplete="off">
      <Stack gap={4}>
        {localSubmitError && (
          <InlineNotification
            kind="error"
            title="Error"
            subtitle={localSubmitError.includes('\n') ? '' : localSubmitError}
            onCloseButtonClick={() => setLocalSubmitError(null)}
            lowContrast
          >
            {localSubmitError.includes('\n') && (
              <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                {localSubmitError.split('\n').map((line, i) => (
                  <li key={i}>{line.startsWith('• ') ? line.slice(2) : line}</li>
                ))}
              </ul>
            )}
          </InlineNotification>
        )}

        {/* Patient selector */}
        {!isEdit ? (
          <Select
            id="patientId"
            labelText="Patient"
            value={formData.patientId}
            onChange={(e) => handleChange('patientId', e.target.value)}
            invalid={!!errors.patientId}
            invalidText={errors.patientId}
            disabled={isSubmitting || !!preselectedPatientId}
          >
            <SelectItem value="" text="Select a patient" />
            {patients.map((patient) => (
              <SelectItem key={patient.patientId} value={patient.patientId} text={patient.name} />
            ))}
          </Select>
        ) : (
          <TextInput
            id="patientName"
            labelText="Patient"
            value={examination?.patientName ?? ''}
            readOnly
            disabled
          />
        )}

        {/* Exam type | Fetus count | Exam date | Status | Patient age */}
        <div style={row4}>
          {isEdit ? (
            <TextInput
              id="examinationType"
              labelText="Examination Type"
              value={getExamTypeLabel(formData.examinationType)}
              readOnly
              disabled
            />
          ) : (
            <Select
              id="examinationType"
              labelText="Examination Type"
              value={formData.examinationType}
              onChange={(e) => handleChange('examinationType', e.target.value)}
              disabled={isSubmitting}
            >
              {EXAM_TYPES.map((t) => (
                <SelectItem key={t.key} value={t.key} text={t.label} />
              ))}
            </Select>
          )}

          {isEdit ? (
            <TextInput
              id="fetusCount"
              labelText="Number of Fetuses"
              value={String(fetusCount)}
              readOnly
              disabled
            />
          ) : (
            <NumberInput
              id="fetusCount"
              label="Number of Fetuses"
              value={formData.fetusCount}
              min={1}
              max={10}
              onChange={(_e, { value }) =>
                handleFetusCountChange(typeof value === 'number' ? value : parseInt(String(value), 10))
              }
              disabled={isSubmitting}
            />
          )}

          <DatePicker
            datePickerType="single"
            dateFormat="d/m/Y"
            value={formData.examinationDate ? toDisplayDate(formData.examinationDate) : ''}
            onChange={(dates: Date[]) => {
              if (dates[0]) handleChange('examinationDate', toISODate(dates[0]));
            }}
            onClose={(dates: Date[]) => {
              if (dates[0]) handleChange('examinationDate', toISODate(dates[0]));
            }}
            maxDate={todayDisplayDate()}
          >
            <DatePickerInput
              id="examinationDate"
              labelText="Examination Date"
              placeholder="dd/mm/yyyy"
              invalid={!!errors.examinationDate}
              invalidText={errors.examinationDate}
              disabled={isSubmitting}
            />
          </DatePicker>

          <Select
            id="status"
            labelText="Status"
            value={formData.status}
            onChange={(e) => handleChange('status', e.target.value)}
            disabled={isSubmitting}
          >
            <SelectItem value="draft" text="Draft" />
            <SelectItem value="completed" text="Completed" />
            <SelectItem value="reviewed" text="Reviewed" />
          </Select>

          <TextInput
            id="patientAgeAtExam"
            labelText="Patient Age"
            value={patientAge !== undefined ? `${patientAge} yrs` : '—'}
            readOnly
            disabled
          />
        </div>

        {/* Pregnancy Data */}
        <div>
          <h4 style={{ marginBottom: '0.5rem', fontWeight: 600 }}>Pregnancy Data</h4>
          <Stack gap={3}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'nowrap' }}>
              <div style={{ flex: '0 0 auto', minWidth: '200px' }}>
                <DatePicker
                  datePickerType="single"
                  dateFormat="d/m/Y"
                  value={formData.last_menstrual_period ? toDisplayDate(formData.last_menstrual_period) : ''}
                  maxDate={todayDisplayDate()}
                  onChange={(dates: Date[]) => {
                    if (dates[0]) handleChange('last_menstrual_period', toISODate(dates[0]));
                  }}
                  onClose={(dates: Date[]) => {
                    if (dates[0]) handleChange('last_menstrual_period', toISODate(dates[0]));
                  }}
                >
                  <DatePickerInput
                    id="last_menstrual_period"
                    labelText="Last Menstrual Period (LMP)"
                    placeholder="dd/mm/yyyy"
                    invalid={!!errors.last_menstrual_period}
                    invalidText={errors.last_menstrual_period}
                    disabled={isSubmitting}
                  />
                </DatePicker>
              </div>
              <div style={{ flex: 1, minWidth: '180px' }}>
                <TextInput
                  id="gestationalAge"
                  labelText={
                    <>
                      Gestational Age from LMP
                      {autoSuffix(formData.gestationalAge.isManual, undefined, !!formData.gestationalAge.value)}
                    </>
                  }
                  placeholder="auto"
                  value={formData.gestationalAge.value}
                  onChange={(e) => handleChange('gestationalAge', e.target.value)}
                  invalid={!!errors.gestationalAge}
                  invalidText={errors.gestationalAge}
                  disabled={isSubmitting}
                />
              </div>
              <div style={{ flex: 1, minWidth: '120px' }}>
                <TextInput
                  id="edd"
                  labelText="Expected Delivery Date (EDD)"
                  value={edd ?? '—'}
                  readOnly
                  disabled
                />
              </div>
            </div>
            <div style={row3}>
              <TextInput
                id="obstetric_history"
                labelText="Obstetric History"
                placeholder="e.g., G1P0"
                value={formData.obstetric_history}
                onChange={(e) => handleChange('obstetric_history', e.target.value)}
                disabled={isSubmitting}
              />
              <TextInput
                id="family_history"
                labelText="Family History"
                placeholder="e.g., None"
                value={formData.family_history}
                onChange={(e) => handleChange('family_history', e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </Stack>
        </div>

        {/* Per-fetus clinical sections */}
        <div style={{ overflow: 'hidden' }}>
          <h4 style={{ marginBottom: '0.75rem', fontWeight: 600 }}>
            Clinical Measurements
            {fetusCount > 1 ? ` (${fetusCount} fetuses)` : ''}
          </h4>
          <div style={fetusSectionContainerStyle}>
            {formData.fetuses.map((_, fi) => renderFetusSections(fi))}
          </div>
        </div>

        {/* Findings / Comments / Notes */}
        <TextArea
          id="findings"
          labelText="Findings"
          value={formData.findings}
          onChange={(e) => handleChange('findings', e.target.value)}
          rows={3}
          disabled={isSubmitting}
        />
        <TextArea
          id="comments"
          labelText="Comments"
          value={formData.comments}
          onChange={(e) => handleChange('comments', e.target.value)}
          rows={3}
          disabled={isSubmitting}
        />
        <TextArea
          id="clinicalNotes"
          labelText="Notes"
          value={formData.clinicalNotes}
          onChange={(e) => handleChange('clinicalNotes', e.target.value)}
          rows={3}
          disabled={isSubmitting}
        />

        <ButtonSet>
          <Button kind="secondary" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Examination'}
          </Button>
        </ButtonSet>
      </Stack>
    </Form>
  );
}
