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
  RadioButtonGroup,
  RadioButton,
} from '@carbon/react';
import { EXAM_TYPES, getExamTypeLabel } from '../constants/examinationTypes';
import { autoSuffix } from './AutoCalcHelpers';
import { ObservableSection } from './sections/ObservableSection';
import { DopplerSection } from './sections/DopplerSection';
import { useExaminationForm } from '../hooks/useExaminationForm';
import type { ExaminationFormProps } from '../hooks/useExaminationForm';
import type { ExamTypeConfig } from '../types';
import type { FetusSectionFormData, ObservableFormFieldState, AutoCalcValue } from '../types/formData';

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

// ── Module-scope styles ───────────────────────────────────────────────────────

const styleRow3: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' };
const styleRow4: React.CSSProperties = { display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr', gap: '0.75rem' };

const styleFetusSectionContainer: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  flexWrap: 'nowrap',
  gap: '1.5rem',
  width: '100%',
  overflowX: 'auto',
};

const styleFetusColumn: React.CSSProperties = {
  minWidth: '480px',
  flex: '0 0 calc(50% - 0.75rem)',
};

const styleFetusHeader: React.CSSProperties = { marginBottom: '1rem', fontWeight: 600, fontSize: '1rem' };
const styleUFSection: React.CSSProperties = { marginBottom: '1rem' };
const styleUFGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' };
const styleAnatomySection: React.CSSProperties = { marginTop: '1.5rem' };
const styleAnatomyGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' };
const styleMarkersSection: React.CSSProperties = { marginTop: '1.5rem' };
const styleMarkersGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' };

// ── FetusSection ──────────────────────────────────────────────────────────────

interface FetusSectionProps {
  fi: number;
  fetus: FetusSectionFormData;
  fetusCount: number;
  examConfig: ExamTypeConfig;
  errors: Record<string, string>;
  isSubmitting: boolean;
  onFetusChange: (
    index: number,
    section: 'biometry' | 'doppler',
    type: string,
    field: keyof ObservableFormFieldState,
    next: AutoCalcValue<string>,
  ) => void;
  onFetusDescriptorChange: (
    index: number,
    section: 'ultrasoundFindings' | 'anatomy' | 'markers' | 'gaFromBiometry',
    field: string,
    value: string,
  ) => void;
}

const FetusSection = React.memo(function FetusSection({
  fi,
  fetus,
  fetusCount,
  examConfig,
  errors,
  isSubmitting,
  onFetusChange,
  onFetusDescriptorChange,
}: FetusSectionProps) {
  const uf = fetus.ultrasoundFindings as Record<string, string>;
  const anat = fetus.anatomy as Record<string, string>;
  const markers = fetus.markers as Record<string, string>;
  const prefix = `f${fi}`;

  return (
    <div style={styleFetusColumn}>
      {/* Column header — only when multiple fetuses */}
      {fetusCount > 1 && (
        <h3 style={styleFetusHeader}>
          Fetus {fi + 1}
        </h3>
      )}

      {/* Ultrasound Findings */}
      {examConfig.ultrasoundFindingTypes.length > 0 && (
        <div style={styleUFSection}>
          <h5 className="observable-section-title">Ultrasound Findings</h5>
          <div style={styleUFGrid}>
            {examConfig.ultrasoundFindingTypes.map((tc) => {
              const val = uf[tc.key] ?? '';
              const label = tc.unit && tc.inputType === 'text' && tc.key === 'heart_rate' ? 'FHR (bpm)' : tc.label;
              if (tc.inputType === 'select' && tc.options) {
                return (
                  <Select
                    key={tc.key}
                    id={`${prefix}_uf_${tc.key}`}
                    labelText={label}
                    value={val}
                    onChange={(e) => onFetusDescriptorChange(fi, 'ultrasoundFindings', tc.key, e.target.value)}
                    disabled={isSubmitting}
                    size="sm"
                  >
                    <SelectItem value="" text="Select" />
                    {tc.options.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} text={opt.label} />
                    ))}
                  </Select>
                );
              }
              return (
                <TextInput
                  key={tc.key}
                  id={`${prefix}_uf_${tc.key}`}
                  labelText={label}
                  placeholder={tc.placeholder}
                  value={val}
                  onChange={(e) => onFetusDescriptorChange(fi, 'ultrasoundFindings', tc.key, e.target.value)}
                  disabled={isSubmitting}
                  size="sm"
                />
              );
            })}
          </div>
        </div>
      )}

      <h5 className="observable-section-title">Biometry</h5>
      {/* GA from Biometry */}
      <TextInput
        id={`${prefix}_gaFromBio`}
        labelText={
          <>
            GA from Biometry {autoSuffix(
              fetus.gaFromBiometry.isManual, 
              examConfig.trimester === 'first' ? 'Robinson' : 'Hadlock', 
              !!fetus.gaFromBiometry.value)}
          </>
        }
        placeholder="auto"
        value={fetus.gaFromBiometry.value}
        onChange={(e) => onFetusDescriptorChange(fi, 'gaFromBiometry', '', e.target.value)}
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
        typeConfigs={examConfig.biometryTypes}
        data={fetus.biometry}
        disabled={isSubmitting}
        onFieldChange={onFetusChange}
      />

      {/* Doppler section */}
      <DopplerSection
        fetusIndex={fi}
        vesselConfigs={examConfig.dopplerVessels}
        singleConfigs={examConfig.dopplerSingle}
        data={fetus.doppler}
        disabled={isSubmitting}
        onFieldChange={onFetusChange}
      />

      {/* Anatomy */}
      {examConfig.anatomyTypes.length > 0 && (
        <div style={styleAnatomySection}>
          <h5 className="observable-section-title">Anatomy</h5>
          <div style={styleAnatomyGrid}>
            {examConfig.anatomyTypes.map(({ key, label }) => (
              <TextInput
                key={key}
                id={`${prefix}_anat_${key}`}
                labelText={label}
                value={anat[key] ?? ''}
                onChange={(e) => onFetusDescriptorChange(fi, 'anatomy', key, e.target.value)}
                disabled={isSubmitting}
                size="sm"
              />
            ))}
          </div>
        </div>
      )}

      {/* Markers — config-driven, only rendered when markerTypes is non-empty */}
      {examConfig.markerTypes.length > 0 && (
        <div style={styleMarkersSection}>
          <h5 className="observable-section-title">First Trimester Markers</h5>
          <div style={styleMarkersGrid}>
            {examConfig.markerTypes.map(({ key, label, inputType }) => {
              const value = markers[key] ?? '';
              if (inputType === 'text') {
                return (
                  <TextInput
                    key={key}
                    id={`${prefix}_mkr_${key}`}
                    labelText={label}
                    value={value}
                    onChange={(e) => onFetusDescriptorChange(fi, 'markers', key, e.target.value)}
                    disabled={isSubmitting}
                    size="sm"
                  />
                );
              }
              // boolean — Yes / No radio group with clear
              return (
                <div key={key}>
                  <RadioButtonGroup
                    legendText={label}
                    name={`${prefix}_mkr_${key}`}
                    valueSelected={value || 'none'}
                    onChange={(val: string) =>
                      onFetusDescriptorChange(fi, 'markers', key, val === 'none' ? '' : val)
                    }
                    disabled={isSubmitting}
                    orientation="horizontal"
                  >
                    <RadioButton labelText="Yes" value="yes" id={`${prefix}_mkr_${key}_yes`} />
                    <RadioButton labelText="No"  value="no"  id={`${prefix}_mkr_${key}_no`}  />
                    <RadioButton labelText="—"   value="none" id={`${prefix}_mkr_${key}_none`} />
                  </RadioButtonGroup>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});

// ── Component ─────────────────────────────────────────────────────────────────

export default function ExaminationForm(props: ExaminationFormProps) {
  const {
    formData,
    errors,
    isSubmitting,
    submitError,
    clearSubmitError,
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

  const fetusCount = formData.fetuses.length;

  return (
    <Form onSubmit={handleSubmit} autoComplete="off">
      <Stack gap={4}>
        {submitError && (
          <InlineNotification
            kind="error"
            title="Error"
            subtitle={submitError.includes('\n') ? '' : submitError}
            onCloseButtonClick={clearSubmitError}
            lowContrast
          >
            {submitError.includes('\n') && (
              <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                {submitError.split('\n').map((line, i) => (
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
        <div style={styleRow4}>
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
                      {autoSuffix(formData.gestationalAge.isManual, '+280days', !!formData.gestationalAge.value)}
                    </>
                  }
                  placeholder="auto"
                  value={formData.gestationalAge.value}
                  readOnly
                  //onChange={(e) => handleChange('gestationalAge', e.target.value)}
                  //invalid={!!errors.gestationalAge}
                  //invalidText={errors.gestationalAge}
                  disabled={isSubmitting}
                />
              </div>
              <div style={{ flex: 1, minWidth: '120px' }}>
                <TextInput
                  id="edd"
                  labelText="Expected Delivery Date (EDD)"
                  value={edd ?? 'auto'}
                  readOnly
                  disabled
                />
              </div>
            </div>
            <div style={styleRow3}>
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
          <div style={styleFetusSectionContainer}>
            {formData.fetuses.map((fetus, fi) => (
              <FetusSection
                key={fi}
                fi={fi}
                fetus={fetus}
                fetusCount={fetusCount}
                examConfig={examConfig}
                errors={errors}
                isSubmitting={isSubmitting}
                onFetusChange={handleFetusChange}
                onFetusDescriptorChange={handleFetusDescriptorChange}
              />
            ))}
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
