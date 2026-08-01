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
} from '@carbon/react';
import { EXAM_TYPES, getExamTypeLabel } from '../constants/examinationTypes';
import BiometrySection from './sections/BiometrySection';
import DopplerSection from './sections/DopplerSection';
import UltrasoundFindingsSection from './sections/UltrasoundFindingsSection';
import AnatomySection from './sections/AnatomySection';
import FirstTrimesterSection from './sections/FirstTrimesterSection';
import type { FirstTrimesterSectionFormData } from './sections/FirstTrimesterSection';
import { useExaminationForm } from '../hooks/useExaminationForm';
import type { ExaminationFormProps } from '../hooks/useExaminationForm';

export type { ExaminationFormProps };

// Helper: parse a stored YYYY-MM-DD string into the DatePicker's dd/mm/yyyy display format
function toDisplayDate(iso: string): string {
  const [yyyy, mm, dd] = iso.split('-');
  return `${dd}/${mm}/${yyyy}`;
}

// Helper: format a Date object picked by the DatePicker into YYYY-MM-DD
function toISODate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Helper: today as YYYY-MM-DD for DatePicker maxDate (dd/mm/yyyy display)
function todayDisplayDate(): string {
  return toDisplayDate(toISODate(new Date()));
}

export default function ExaminationForm(props: ExaminationFormProps) {
  const {
    formData,
    errors,
    isSubmitting,
    submitError,
    setSubmitError,
    isTwins,
    isFt,
    isFtTwinsMode,
    canCalcGAFromLMP,
    edd,
    handleCalcGAFromLMP,
    handleChange,
    handleChangeT1,
    handleSubmit,
    visibility,
    patientAge,
  } = useExaminationForm(props);

  const { examination, patients, preselectedPatientId, onCancel, isEdit = false } = props;

  // ── Layout helpers ────────────────────────────────────────────────────────
  const row2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' };
  const row3: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' };
  const row4: React.CSSProperties = { display: 'grid', gridTemplateColumns: '5fr 3fr 2fr 2fr', gap: '0.75rem' };
  const row6: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.75rem' };

  const calcButtonWrap: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
  };

  return (
    <Form onSubmit={handleSubmit} autoComplete="off">
      <Stack gap={4}>
        {submitError && (
          <InlineNotification
            kind="error"
            title="Error"
            subtitle={submitError}
            onCloseButtonClick={() => setSubmitError(null)}
            lowContrast
          />
        )}

        {/* ── Patient (full width) ── */}
        {!isEdit && (
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
              <SelectItem
                key={patient.patientId}
                value={patient.patientId}
                text={patient.name}
              />
            ))}
          </Select>
        )}

        {isEdit && examination && (
          <TextInput
            id="patientName"
            labelText="Patient"
            value={examination.patientName}
            readOnly
            disabled
          />
        )}

        {/* ── Examination Type (locked on edit) | Exam Date | Status | Patient Age (row4, REQ-08) ── */}
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

          <DatePicker
            datePickerType="single"
            dateFormat="d/m/Y"
            value={formData.examDate ? toDisplayDate(formData.examDate) : ''}
            onChange={(dates: Date[]) => {
              if (dates[0]) {
                handleChange('examDate', toISODate(dates[0]));
              }
            }}
            maxDate={todayDisplayDate()}
          >
            <DatePickerInput
              id="examDate"
              labelText="Examination Date"
              placeholder="dd/mm/yyyy"
              invalid={!!errors.examDate}
              invalidText={errors.examDate}
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

          {/* Patient Age at Exam occupies the 4th slot in the row4 ── */}
          <TextInput
            id="patientAgeAtExam"
            labelText="Patient Age at Exam"
            value={patientAge !== undefined ? `${patientAge} yrs` : '—'}
            readOnly
            disabled
          />
        </div>

        {/* ── Clinical data sections ── */}
        <div>

          {/* ── Pregnancy Data ── */}
          {visibility.pregnancyData && (
          <div>
            <h4 style={{ marginBottom: '0.5rem', fontWeight: 600 }}>Pregnancy Data</h4>
            <Stack gap={3}>

              {/* LMP | Calc | GA from LMP — single row */}
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

                <div style={calcButtonWrap}>
                  <Button
                    kind="tertiary"
                    size="md"
                    onClick={handleCalcGAFromLMP}
                    disabled={!canCalcGAFromLMP || isSubmitting}
                    title={canCalcGAFromLMP ? 'Calculate GA from LMP and Exam Date' : 'Enter LMP to enable calculation'}
                  >
                    Calc
                  </Button>
                </div>

                <div style={{ flex: 1, minWidth: '180px' }}>
                  <TextInput
                    id="gestationalAge"
                    labelText="Gestational Age from LMP"
                    placeholder="e.g., 28w 3d"
                    value={formData.gestationalAge}
                    onChange={(e) => handleChange('gestationalAge', e.target.value)}
                    invalid={!!errors.gestationalAge}
                    invalidText={errors.gestationalAge}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {/* EDD | Obstetric History | Family History — always in row3 (REQ-08 rule 8) */}
              <div style={row3}>
                <TextInput
                  id="edd"
                  labelText="Expected Delivery Date (EDD)"
                  value={edd ?? '—'}
                  readOnly
                  disabled
                />
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
          )}

          {/* ── Ultrasound Findings (single-fetus path) ── */}
          {visibility.ultrasoundFindings && !isTwins && !isFt && (
          <div>
            <h4 style={{ marginBottom: '0.5rem', fontWeight: 600 }}>Ultrasound Findings</h4>
              {/* Single row6 — Presentation, Gender, HeartRate, FetalMovement, Placenta, UmbilicalCord (REQ-08 rule 7) */}
              <div style={row6}>
                <Select id="presentation" labelText="Presentation" value={formData.presentation} onChange={(e) => handleChange('presentation', e.target.value)} disabled={isSubmitting}>
                  <SelectItem value="" text="Select presentation" />
                  <SelectItem value="cephalic" text="Cephalic" />
                  <SelectItem value="breech" text="Breech" />
                  <SelectItem value="transverse" text="Transverse" />
                  <SelectItem value="oblique" text="Oblique" />
                </Select>
                <Select id="gender" labelText="Gender" value={formData.gender} onChange={(e) => handleChange('gender', e.target.value)} disabled={isSubmitting}>
                  <SelectItem value="" text="Select gender" />
                  <SelectItem value="male" text="Male" />
                  <SelectItem value="female" text="Female" />
                  <SelectItem value="unknown" text="Unknown" />
                </Select>
                <TextInput id="heart_rate" labelText="FHR (bpm)" placeholder="e.g., 145" value={formData.heart_rate} invalid={!!errors.heart_rate} invalidText={errors.heart_rate} disabled={isSubmitting} onChange={(e) => handleChange('heart_rate', e.target.value)} />
                <Select id="fetal_movement" labelText="Fetal Movement" value={formData.fetal_movement} onChange={(e) => handleChange('fetal_movement', e.target.value)} disabled={isSubmitting}>
                  <SelectItem value="" text="Select fetal movement" />
                  <SelectItem value="active" text="Active" />
                  <SelectItem value="present" text="Present" />
                  <SelectItem value="reduced" text="Reduced" />
                  <SelectItem value="absent" text="Absent" />
                </Select>
                <TextInput id="placenta" labelText="Placenta" placeholder="e.g., anterior, grade 1" value={formData.placenta} onChange={(e) => handleChange('placenta', e.target.value)} disabled={isSubmitting} />
                <TextInput id="umbilical_cord" labelText="Umbilical Cord" placeholder="e.g., 3 vessels" value={formData.umbilical_cord} onChange={(e) => handleChange('umbilical_cord', e.target.value)} disabled={isSubmitting} />
              </div>
          </div>
          )}

          {/* ── Biometry (single-fetus path) — HF-2: delegated to BiometrySection ── */}
          {visibility.biometry && !isTwins && !isFt && (
          <>
          <h4 style={{ marginBottom: '0.5rem', fontWeight: 600 }}>Biometry (decimal values accepted, in mm/grams)</h4>
          <BiometrySection
            prefix="t1"
            data={{
              bpd: formData.bpd, hc: formData.hc, ac: formData.ac, fl: formData.fl,
              efw: formData.efw, ofd: formData.ofd, vp: formData.vp, tcd: formData.tcd,
              cm: formData.cm, nuchalFold: formData.nuchalFold, nb: formData.nb,
              apad: formData.apad, tad: formData.tad, la: formData.la, lc: formData.lc,
              gestationalAgeFromBiometry: formData.gestationalAgeFromBiometry,
              gestationalAge: formData.gestationalAge,
            }}
            errors={errors}
            onChange={handleChangeT1}
            isSubmitting={isSubmitting}
          />
          </>
          )}

          {/* ── Anatomy (single-fetus path) ── */}
          {visibility.anatomy && !isTwins && !isFt && (
          <div>
            <h4 style={{ marginBottom: '0.5rem', fontWeight: 600 }}>Anatomy</h4>
            {/* Single row6 — 11 fields across 2 auto rows via CSS grid (REQ-08 rule 6) */}
            <div style={row6}>
              <TextInput id="anat_head"     labelText="Head"     placeholder="e.g., normal" value={formData.anat_head}     onChange={(e) => handleChange('anat_head',     e.target.value)} disabled={isSubmitting} />
              <TextInput id="anat_brain"    labelText="Brain"    placeholder="e.g., normal" value={formData.anat_brain}    onChange={(e) => handleChange('anat_brain',    e.target.value)} disabled={isSubmitting} />
              <TextInput id="anat_heart"    labelText="Heart"    placeholder="e.g., normal" value={formData.anat_heart}    onChange={(e) => handleChange('anat_heart',    e.target.value)} disabled={isSubmitting} />
              <TextInput id="anat_abdomen"  labelText="Abdomen"  placeholder="e.g., normal" value={formData.anat_abdomen}  onChange={(e) => handleChange('anat_abdomen',  e.target.value)} disabled={isSubmitting} />
              <TextInput id="anat_kidneys"  labelText="Kidneys"  placeholder="e.g., normal" value={formData.anat_kidneys}  onChange={(e) => handleChange('anat_kidneys',  e.target.value)} disabled={isSubmitting} />
              <TextInput id="anat_limbs"    labelText="Limbs"    placeholder="e.g., normal" value={formData.anat_limbs}    onChange={(e) => handleChange('anat_limbs',    e.target.value)} disabled={isSubmitting} />
              <TextInput id="anat_skeleton" labelText="Skeleton" placeholder="e.g., normal" value={formData.anat_skeleton} onChange={(e) => handleChange('anat_skeleton', e.target.value)} disabled={isSubmitting} />
              <TextInput id="anat_face"     labelText="Face"     placeholder="e.g., normal" value={formData.anat_face}     onChange={(e) => handleChange('anat_face',     e.target.value)} disabled={isSubmitting} />
              <TextInput id="anat_neckSkin" labelText="Neck Skin" placeholder="e.g., normal" value={formData.anat_neckSkin} onChange={(e) => handleChange('anat_neckSkin', e.target.value)} disabled={isSubmitting} />
              <TextInput id="anat_spine"    labelText="Spine"    placeholder="e.g., normal" value={formData.anat_spine}    onChange={(e) => handleChange('anat_spine',    e.target.value)} disabled={isSubmitting} />
              <TextInput id="anat_thorax"   labelText="Thorax"   placeholder="e.g., normal" value={formData.anat_thorax}   onChange={(e) => handleChange('anat_thorax',   e.target.value)} disabled={isSubmitting} />
            </div>
          </div>
          )}

          {/* ── Doppler (single-fetus path) — HF-3: uses DopplerSection component ── */}
          {visibility.doppler && !isTwins && !isFt && (
          <>
          <h4 style={{ marginBottom: '0.5rem', fontWeight: 600 }}>Doppler</h4>
          <DopplerSection
            prefix="t1"
            data={{
              pi: formData.pi, ri: formData.ri,
              ducVen: formData.ducVen, utADexPI: formData.utADexPI, utADexRI: formData.utADexRI,
              utASinPI: formData.utASinPI, utASinRI: formData.utASinRI,
              cma: formData.cma, psv: formData.psv, cpr: formData.cpr,
            }}
            errors={errors}
            onChange={handleChangeT1}
            isSubmitting={isSubmitting}
          />
          </>
          )}

        </div>

        {/* ── UZPT: Single first-trimester layout ── */}
        {isFt && !isFtTwinsMode && (
          <div>
            <h4 style={{ marginBottom: '0.5rem', fontWeight: 600 }}>Ултразвук Първи Триместър</h4>
            <FirstTrimesterSection
              prefix="t1"
              data={formData as unknown as FirstTrimesterSectionFormData}
              errors={errors}
              onChange={handleChange}
              isSubmitting={isSubmitting}
            />
          </div>
        )}

        {/* ── UZPT: Twins first-trimester side-by-side layout ── */}
        {isFtTwinsMode && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }} className="twins-grid">
              <h4 style={{ marginBottom: '0.75rem', fontWeight: 700, borderBottom: '2px solid #0f62fe', paddingBottom: '0.5rem' }}>Twin 1</h4>
              <h4 style={{ marginBottom: '0.75rem', fontWeight: 700, borderBottom: '2px solid #6929c4', paddingBottom: '0.5rem' }}>Twin 2</h4>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }} className="twins-grid">
              <div>
                <FirstTrimesterSection
                  prefix="t1"
                  data={formData as unknown as FirstTrimesterSectionFormData}
                  errors={errors}
                  onChange={handleChange}
                  isSubmitting={isSubmitting}
                />
              </div>
              <div>
                <FirstTrimesterSection
                  prefix="t2"
                  data={formData as unknown as FirstTrimesterSectionFormData}
                  errors={errors}
                  onChange={handleChange}
                  isSubmitting={isSubmitting}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── uzd-twins: Twin side-by-side layout (HF-1: reordered to UF → Bio → Anatomy → Doppler) ── */}
        {/* Breakpoint: collapses to single column below 1024px */}
        {isTwins && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }} className="twins-grid">
              <h4 style={{ marginBottom: '0.75rem', fontWeight: 700, borderBottom: '2px solid #0f62fe', paddingBottom: '0.5rem' }}>Twin 1</h4>
              <h4 style={{ marginBottom: '0.75rem', fontWeight: 700, borderBottom: '2px solid #6929c4', paddingBottom: '0.5rem' }}>Twin 2</h4>
            </div>

            {visibility.ultrasoundFindings && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }} className="twins-grid">
                <div>
                  <h5 style={{ marginBottom: '0.25rem', fontWeight: 600 }}>Ultrasound Findings</h5>
                  <UltrasoundFindingsSection
                    prefix="t1"
                    columns={3}
                    data={{
                      presentation: formData.presentation, gender: formData.gender,
                      heart_rate: formData.heart_rate, fetal_movement: formData.fetal_movement,
                      placenta: formData.placenta, umbilical_cord: formData.umbilical_cord,
                    }}
                    errors={errors}
                    onChange={handleChangeT1}
                    isSubmitting={isSubmitting}
                  />
                </div>
                <div>
                  <h5 style={{ marginBottom: '0.25rem', fontWeight: 600 }}>Ultrasound Findings</h5>
                  <UltrasoundFindingsSection
                    prefix="t2"
                    columns={3}
                    data={{
                      presentation: formData.t2_presentation, gender: formData.t2_gender,
                      heart_rate: formData.t2_heart_rate, fetal_movement: formData.t2_fetal_movement,
                      placenta: formData.t2_placenta, umbilical_cord: formData.t2_umbilical_cord,
                    }}
                    errors={errors}
                    onChange={handleChange}
                    isSubmitting={isSubmitting}
                  />
                </div>
              </div>
            )}

            {visibility.biometry && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }} className="twins-grid">
                <div>
                  <h5 style={{ marginBottom: '0.25rem', fontWeight: 600 }}>Biometry</h5>
                  <BiometrySection
                    prefix="t1"
                    data={{
                      bpd: formData.bpd, hc: formData.hc, ac: formData.ac, fl: formData.fl,
                      efw: formData.efw, ofd: formData.ofd, vp: formData.vp, tcd: formData.tcd,
                      cm: formData.cm, nuchalFold: formData.nuchalFold, nb: formData.nb,
                      apad: formData.apad, tad: formData.tad, la: formData.la, lc: formData.lc,
                      gestationalAgeFromBiometry: formData.gestationalAgeFromBiometry,
                      gestationalAge: formData.gestationalAge,
                    }}
                    errors={errors}
                    onChange={handleChangeT1}
                    isSubmitting={isSubmitting}
                  />
                </div>
                <div>
                  <h5 style={{ marginBottom: '0.25rem', fontWeight: 600 }}>Biometry</h5>
                  <BiometrySection
                    prefix="t2"
                    data={{
                      bpd: formData.t2_bpd, hc: formData.t2_hc, ac: formData.t2_ac, fl: formData.t2_fl,
                      efw: formData.t2_efw, ofd: formData.t2_ofd, vp: formData.t2_vp, tcd: formData.t2_tcd,
                      cm: formData.t2_cm, nuchalFold: formData.t2_nuchalFold, nb: formData.t2_nb,
                      apad: formData.t2_apad, tad: formData.t2_tad, la: formData.t2_la, lc: formData.t2_lc,
                      gestationalAgeFromBiometry: formData.t2_gestationalAgeFromBiometry,
                      gestationalAge: formData.gestationalAge,
                    }}
                    errors={errors}
                    onChange={handleChange}
                    isSubmitting={isSubmitting}
                  />
                </div>
              </div>
            )}

            {visibility.anatomy && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }} className="twins-grid">
                <div>
                  <h5 style={{ marginBottom: '0.25rem', fontWeight: 600 }}>Anatomy</h5>
                  <AnatomySection
                    prefix="t1"
                    columns={4}
                    data={{
                      anat_head: formData.anat_head, anat_brain: formData.anat_brain,
                      anat_heart: formData.anat_heart, anat_abdomen: formData.anat_abdomen,
                      anat_kidneys: formData.anat_kidneys, anat_limbs: formData.anat_limbs,
                      anat_skeleton: formData.anat_skeleton, anat_face: formData.anat_face,
                      anat_neckSkin: formData.anat_neckSkin, anat_spine: formData.anat_spine,
                      anat_thorax: formData.anat_thorax,
                    }}
                    errors={errors}
                    onChange={handleChangeT1}
                    isSubmitting={isSubmitting}
                  />
                </div>
                <div>
                  <h5 style={{ marginBottom: '0.25rem', fontWeight: 600 }}>Anatomy</h5>
                  <AnatomySection
                    prefix="t2"
                    columns={4}
                    data={{
                      anat_head: formData.t2_anat_head, anat_brain: formData.t2_anat_brain,
                      anat_heart: formData.t2_anat_heart, anat_abdomen: formData.t2_anat_abdomen,
                      anat_kidneys: formData.t2_anat_kidneys, anat_limbs: formData.t2_anat_limbs,
                      anat_skeleton: formData.t2_anat_skeleton, anat_face: formData.t2_anat_face,
                      anat_neckSkin: formData.t2_anat_neckSkin, anat_spine: formData.t2_anat_spine,
                      anat_thorax: formData.t2_anat_thorax,
                    }}
                    errors={errors}
                    onChange={handleChange}
                    isSubmitting={isSubmitting}
                  />
                </div>
              </div>
            )}

            {visibility.doppler && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }} className="twins-grid">
                <div>
                  <h5 style={{ marginBottom: '0.25rem', fontWeight: 600 }}>Doppler</h5>
                  <DopplerSection
                    prefix="t1"
                    data={{
                      pi: formData.pi, ri: formData.ri,
                      ducVen: formData.ducVen, utADexPI: formData.utADexPI, utADexRI: formData.utADexRI,
                      utASinPI: formData.utASinPI, utASinRI: formData.utASinRI,
                      cma: formData.cma, psv: formData.psv, cpr: formData.cpr,
                    }}
                    errors={errors}
                    onChange={handleChangeT1}
                    isSubmitting={isSubmitting}
                  />
                </div>
                <div>
                  <h5 style={{ marginBottom: '0.25rem', fontWeight: 600 }}>Doppler</h5>
                  <DopplerSection
                    prefix="t2"
                    data={{
                      pi: formData.t2_pi, ri: formData.t2_ri,
                      ducVen: formData.t2_ducVen, utADexPI: formData.t2_utADexPI, utADexRI: formData.t2_utADexRI,
                      utASinPI: formData.t2_utASinPI, utASinRI: formData.t2_utASinRI,
                      cma: formData.t2_cma, psv: formData.t2_psv, cpr: formData.t2_cpr,
                    }}
                    errors={errors}
                    onChange={handleChange}
                    isSubmitting={isSubmitting}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Narrative fields ── */}
        <TextArea
          id="findings"
          labelText="Findings (optional)"
          placeholder="Enter examination findings"
          value={formData.findings}
          onChange={(e) => handleChange('findings', e.target.value)}
          rows={4}
          disabled={isSubmitting}
        />

        {/* Notes | Comments side by side */}
        <div style={row2}>
          <TextArea
            id="notes"
            labelText="Notes (optional)"
            placeholder="Enter additional notes"
            value={formData.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            rows={3}
            disabled={isSubmitting}
          />

          <TextArea
            id="comments"
            labelText="Comments (optional)"
            placeholder="Enter general comments"
            value={formData.comments}
            onChange={(e) => handleChange('comments', e.target.value)}
            rows={3}
            disabled={isSubmitting}
          />
        </div>

        <ButtonSet style={{ justifyContent: 'flex-end' }}>
          <Button kind="secondary" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || (!isEdit && !formData.patientId)}>
            {isSubmitting ? 'Saving...' : isEdit ? `Update ${getExamTypeLabel(formData.examinationType)}` : `Create ${getExamTypeLabel(formData.examinationType)}`}
          </Button>
        </ButtonSet>
      </Stack>
    </Form>
  );
}

// Made with Bob
