import { useState, useEffect } from 'react';
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
  FormGroup,
} from '@carbon/react';
import type {
  Examination,
  CreateExaminationRequest,
  UpdateExaminationRequest,
  Patient,
  ExaminationData,
} from '../types';
import { calcGAFromLMP, calcGAFromBiometry, calcEFW, calcEDD, calcBiometryPercentiles, calcEFWPercentile, calculateAgeAtDate } from '../utils/calculations';
import { EXAM_TYPES, getExamTypeLabel, getSectionVisibility } from '../constants/examinationTypes';
import type { BiometryPercentiles } from '../utils/calculations';

interface ExaminationFormProps {
  examination?: Examination;
  patients: Patient[];
  preselectedPatientId?: string;
  onSubmit: (data: CreateExaminationRequest | UpdateExaminationRequest) => Promise<void>;
  onCancel: () => void;
  isEdit?: boolean;
}

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

// Helper: extract YYYY-MM-DD from an Examination's examDate string
function examDateToYMD(examDate: string): string {
  const d = new Date(examDate);
  return toISODate(d);
}

export default function ExaminationForm({
  examination,
  patients,
  preselectedPatientId,
  onSubmit,
  onCancel,
  isEdit = false,
}: ExaminationFormProps) {
  const [formData, setFormData] = useState({
    // Core fields
    patientId: examination?.patientId || preselectedPatientId || '',
    examDate: examination?.examDate ? examDateToYMD(examination.examDate) : toISODate(new Date()),
    status: (examination?.status || 'draft') as 'draft' | 'completed' | 'reviewed',
    examinationType: examination?.examinationType || 'ultrasound_prenatal', // TASK-033
    // Biometry (integers only)
    bpd: examination?.biometry?.bpd?.toString() || '',
    hc: examination?.biometry?.hc?.toString() || '',
    ac: examination?.biometry?.ac?.toString() || '',
    fl: examination?.biometry?.fl?.toString() || '',
    efw: examination?.biometry?.efw?.toString() || '',
    // TASK-034: Extended biometry
    ofd: examination?.biometry?.ofd?.toString() || '',
    vp: examination?.biometry?.vp?.toString() || '',
    tcd: examination?.biometry?.tcd?.toString() || '',
    cm: examination?.biometry?.cm?.toString() || '',
    nuchalFold: examination?.biometry?.nuchalFold?.toString() || '',
    nb: examination?.biometry?.nb?.toString() || '',
    apad: examination?.biometry?.apad?.toString() || '',
    tad: examination?.biometry?.tad?.toString() || '',
    // TASK-035: LA and LC
    la: examination?.biometry?.la?.toString() || '',
    lc: examination?.biometry?.lc?.toString() || '',
    // GA fields (both stored separately)
    gestationalAge: examination?.gestationalAge || '',                         // GA from LMP
    gestationalAgeFromBiometry: examination?.gestationalAgeFromBiometry || '', // GA from Biometry
    // Doppler (floats allowed)
    pi: examination?.doppler?.pi?.toString() || '',
    ri: examination?.doppler?.ri?.toString() || '',
    vessel: examination?.doppler?.vessel || '',
    // TASK-036: Extended vascular fields
    utADexPI: examination?.doppler?.utADexPI?.toString() || '',
    utADexRI: examination?.doppler?.utADexRI?.toString() || '',
    utASinPI: examination?.doppler?.utASinPI?.toString() || '',
    utASinRI: examination?.doppler?.utASinRI?.toString() || '',
    cma: examination?.doppler?.cma?.toString() || '',
    psv: examination?.doppler?.psv?.toString() || '',
    cpr: examination?.doppler?.cpr?.toString() || '',
    ducVen: examination?.doppler?.ducVen || '',
    notes: examination?.notes || '',
    findings: examination?.findings || '',
    // Pregnancy data
    last_menstrual_period: examination?.data?.pregnancy_data?.last_menstrual_period || '',
    obstetric_history: examination?.data?.pregnancy_data?.obstetric_history || '',
    family_history: examination?.data?.pregnancy_data?.family_history || '',
    // Ultrasound findings
    presentation: examination?.data?.ultrasound_findings?.presentation || '',
    gender: examination?.data?.ultrasound_findings?.gender || '',
    heart_rate: examination?.data?.ultrasound_findings?.heart_rate?.toString() || '',
    fetal_movement: examination?.data?.ultrasound_findings?.fetal_movement || '',
    placenta: examination?.data?.ultrasound_findings?.placenta || '',
    umbilical_cord: examination?.data?.ultrasound_findings?.umbilical_cord || '',
    // Anatomy
    anat_head: examination?.data?.anatomy?.head || '',
    anat_brain: examination?.data?.anatomy?.brain || '',
    anat_heart: examination?.data?.anatomy?.heart || '',
    anat_abdomen: examination?.data?.anatomy?.abdomen || '',
    anat_kidneys: examination?.data?.anatomy?.kidneys || '',
    anat_limbs: examination?.data?.anatomy?.limbs || '',
    anat_skeleton: examination?.data?.anatomy?.skeleton || '',
    // TASK-036: Extended anatomy
    anat_face: examination?.data?.anatomy?.face || '',
    anat_neckSkin: examination?.data?.anatomy?.neckSkin || '',
    anat_spine: examination?.data?.anatomy?.spine || '',
    anat_thorax: examination?.data?.anatomy?.thorax || '',
    // Top-level data comment
    comments: examination?.data?.comments || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [percentiles, setPercentiles] = useState<BiometryPercentiles | undefined>(undefined);
  const [efwPercentile, setEfwPercentile] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (examination) {
      setFormData({
        patientId: examination.patientId,
        examDate: examDateToYMD(examination.examDate),
        status: examination.status,
        examinationType: examination.examinationType || 'ultrasound_prenatal',
        bpd: examination.biometry?.bpd?.toString() || '',
        hc: examination.biometry?.hc?.toString() || '',
        ac: examination.biometry?.ac?.toString() || '',
        fl: examination.biometry?.fl?.toString() || '',
        efw: examination.biometry?.efw?.toString() || '',
        ofd: examination.biometry?.ofd?.toString() || '',
        vp: examination.biometry?.vp?.toString() || '',
        tcd: examination.biometry?.tcd?.toString() || '',
        cm: examination.biometry?.cm?.toString() || '',
        nuchalFold: examination.biometry?.nuchalFold?.toString() || '',
        nb: examination.biometry?.nb?.toString() || '',
        apad: examination.biometry?.apad?.toString() || '',
        tad: examination.biometry?.tad?.toString() || '',
        la: examination.biometry?.la?.toString() || '',
        lc: examination.biometry?.lc?.toString() || '',
        gestationalAge: examination.gestationalAge || '',
        gestationalAgeFromBiometry: examination.gestationalAgeFromBiometry || '',
        pi: examination.doppler?.pi?.toString() || '',
        ri: examination.doppler?.ri?.toString() || '',
        vessel: examination.doppler?.vessel || '',
        utADexPI: examination.doppler?.utADexPI?.toString() || '',
        utADexRI: examination.doppler?.utADexRI?.toString() || '',
        utASinPI: examination.doppler?.utASinPI?.toString() || '',
        utASinRI: examination.doppler?.utASinRI?.toString() || '',
        cma: examination.doppler?.cma?.toString() || '',
        psv: examination.doppler?.psv?.toString() || '',
        cpr: examination.doppler?.cpr?.toString() || '',
        ducVen: examination.doppler?.ducVen || '',
        notes: examination.notes || '',
        findings: examination.findings || '',
        last_menstrual_period: examination.data?.pregnancy_data?.last_menstrual_period || '',
        obstetric_history: examination.data?.pregnancy_data?.obstetric_history || '',
        family_history: examination.data?.pregnancy_data?.family_history || '',
        presentation: examination.data?.ultrasound_findings?.presentation || '',
        gender: examination.data?.ultrasound_findings?.gender || '',
        heart_rate: examination.data?.ultrasound_findings?.heart_rate?.toString() || '',
        fetal_movement: examination.data?.ultrasound_findings?.fetal_movement || '',
        placenta: examination.data?.ultrasound_findings?.placenta || '',
        umbilical_cord: examination.data?.ultrasound_findings?.umbilical_cord || '',
        anat_head: examination.data?.anatomy?.head || '',
        anat_brain: examination.data?.anatomy?.brain || '',
        anat_heart: examination.data?.anatomy?.heart || '',
        anat_abdomen: examination.data?.anatomy?.abdomen || '',
        anat_kidneys: examination.data?.anatomy?.kidneys || '',
        anat_limbs: examination.data?.anatomy?.limbs || '',
        anat_skeleton: examination.data?.anatomy?.skeleton || '',
        anat_face: examination.data?.anatomy?.face || '',
        anat_neckSkin: examination.data?.anatomy?.neckSkin || '',
        anat_spine: examination.data?.anatomy?.spine || '',
        anat_thorax: examination.data?.anatomy?.thorax || '',
        comments: examination.data?.comments || '',
      });
    }
  }, [examination]);

  // ── Derived values ────────────────────────────────────────────────────────
  const canCalcGAFromLMP = !!(formData.last_menstrual_period && formData.examDate);

  // EDD is derived live whenever LMP changes — display-only, never stored separately
  const edd = calcEDD(formData.last_menstrual_period);

  const biometryInts = {
    bpd: formData.bpd ? parseInt(formData.bpd) : undefined,
    hc: formData.hc ? parseInt(formData.hc) : undefined,
    ac: formData.ac ? parseInt(formData.ac) : undefined,
    fl: formData.fl ? parseInt(formData.fl) : undefined,
  };

  const canCalcGAFromBiometry = !!(
    biometryInts.bpd && biometryInts.hc && biometryInts.ac && biometryInts.fl
  );

  const canCalcEFW = canCalcGAFromBiometry; // same four params required

  // ── Calc handlers ─────────────────────────────────────────────────────────

  const handleCalcGAFromLMP = () => {
    const result = calcGAFromLMP(formData.last_menstrual_period, formData.examDate);
    if (result) {
      handleChange('gestationalAge', result);
    }
  };

  const handleCalcGAFromBiometry = () => {
    const result = calcGAFromBiometry(
      biometryInts.bpd,
      biometryInts.hc,
      biometryInts.ac,
      biometryInts.fl,
    );
    if (result) {
      handleChange('gestationalAgeFromBiometry', result);
    }
    // Calculate percentiles using GA from LMP as the reference age
    const pct = calcBiometryPercentiles(
      biometryInts.bpd,
      biometryInts.hc,
      biometryInts.ac,
      biometryInts.fl,
      formData.gestationalAge,
    );
    setPercentiles(pct);
  };

  const handleCalcEFW = () => {
    const result = calcEFW(
      biometryInts.bpd,
      biometryInts.hc,
      biometryInts.ac,
      biometryInts.fl,
    );
    if (result !== undefined) {
      handleChange('efw', result.toString());
      const pct = calcEFWPercentile(result, formData.gestationalAge);
      setEfwPercentile(pct);
    }
  };

  // ── Validation ────────────────────────────────────────────────────────────

  const gaRegex = /^\d{1,2}w\s?\d{1}d$/;

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!isEdit && !formData.patientId) {
      newErrors.patientId = 'Patient is required';
    }

    if (!formData.examDate) {
      newErrors.examDate = 'Examination date is required';
    } else {
      const [yyyy, mm, dd] = formData.examDate.split('-').map(Number);
      const examDate = new Date(yyyy, mm - 1, dd);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (examDate > today) {
        newErrors.examDate = 'Examination date cannot be in the future';
      }
    }

    // LMP cannot be in the future
    if (formData.last_menstrual_period) {
      const [ly, lm, ld] = formData.last_menstrual_period.split('-').map(Number);
      const lmpDate = new Date(ly, lm - 1, ld);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (lmpDate > today) {
        newErrors.last_menstrual_period = 'LMP cannot be in the future';
      }
    }

    if (formData.gestationalAge && !gaRegex.test(formData.gestationalAge)) {
      newErrors.gestationalAge = 'Format must be "28w 3d"';
    }

    if (formData.gestationalAgeFromBiometry && !gaRegex.test(formData.gestationalAgeFromBiometry)) {
      newErrors.gestationalAgeFromBiometry = 'Format must be "28w 3d"';
    }

    // Biometry validation (integers, > 0 if provided) — TASK-034/035 extended fields
    const biometryFields = ['bpd', 'hc', 'ac', 'fl', 'efw', 'ofd', 'vp', 'tcd', 'cm', 'nuchalFold', 'nb', 'apad', 'tad', 'la', 'lc'];
    biometryFields.forEach(field => {
      const value = formData[field as keyof typeof formData] as string;
      if (value && value.trim()) {
        const parsed = parseInt(value);
        if (isNaN(parsed) || parsed.toString() !== value.trim()) {
          newErrors[field] = 'Must be a whole number (integer)';
        } else if (parsed <= 0) {
          newErrors[field] = 'Must be a positive number';
        }
      }
    });

    // Doppler validation (floats, >= 0 if provided) — TASK-036 extended vascular
    const dopplerFields = ['pi', 'ri', 'utADexPI', 'utADexRI', 'utASinPI', 'utASinRI', 'cma', 'psv', 'cpr'];
    dopplerFields.forEach(field => {
      const value = formData[field as keyof typeof formData] as string;
      if (value && value.trim()) {
        const parsed = parseFloat(value);
        if (isNaN(parsed)) {
          newErrors[field] = 'Must be a valid number';
        } else if (parsed < 0) {
          newErrors[field] = 'Must be a positive number';
        }
      }
    });

    // Heart rate: must be a positive integer if provided
    if (formData.heart_rate && formData.heart_rate.trim()) {
      const parsed = parseInt(formData.heart_rate);
      if (isNaN(parsed) || parsed.toString() !== formData.heart_rate.trim()) {
        newErrors.heart_rate = 'Must be a whole number (bpm)';
      } else if (parsed <= 0) {
        newErrors.heart_rate = 'Must be a positive number';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const intOrUndef = (v: string) => (v && v.trim() ? parseInt(v) : undefined);
      const floatOrUndef = (v: string) => (v && v.trim() ? parseFloat(v) : undefined);

      const biometry = (
        formData.bpd || formData.hc || formData.ac || formData.fl || formData.efw ||
        formData.ofd || formData.vp || formData.tcd || formData.cm || formData.nuchalFold ||
        formData.nb || formData.apad || formData.tad || formData.la || formData.lc
      ) ? {
        bpd: intOrUndef(formData.bpd),
        hc: intOrUndef(formData.hc),
        ac: intOrUndef(formData.ac),
        fl: intOrUndef(formData.fl),
        efw: intOrUndef(formData.efw),
        ofd: intOrUndef(formData.ofd),
        vp: intOrUndef(formData.vp),
        tcd: intOrUndef(formData.tcd),
        cm: intOrUndef(formData.cm),
        nuchalFold: intOrUndef(formData.nuchalFold),
        nb: intOrUndef(formData.nb),
        apad: intOrUndef(formData.apad),
        tad: intOrUndef(formData.tad),
        la: intOrUndef(formData.la),
        lc: intOrUndef(formData.lc),
      } : undefined;

      const doppler = (
        formData.pi || formData.ri || formData.vessel ||
        formData.utADexPI || formData.utADexRI || formData.utASinPI || formData.utASinRI ||
        formData.cma || formData.psv || formData.cpr || formData.ducVen
      ) ? {
        pi: floatOrUndef(formData.pi),
        ri: floatOrUndef(formData.ri),
        vessel: formData.vessel.trim() || undefined,
        utADexPI: floatOrUndef(formData.utADexPI),
        utADexRI: floatOrUndef(formData.utADexRI),
        utASinPI: floatOrUndef(formData.utASinPI),
        utASinRI: floatOrUndef(formData.utASinRI),
        cma: floatOrUndef(formData.cma),
        psv: floatOrUndef(formData.psv),
        cpr: floatOrUndef(formData.cpr),
        ducVen: formData.ducVen.trim() || undefined,
      } : undefined;

      // Build the nested `data` object — ultrasound_date intentionally excluded
      const pregnancy_data = (
        formData.last_menstrual_period ||
        formData.obstetric_history ||
        formData.family_history
      ) ? {
        last_menstrual_period: formData.last_menstrual_period || undefined,
        obstetric_history: formData.obstetric_history.trim() || undefined,
        family_history: formData.family_history.trim() || undefined,
      } : undefined;

      const ultrasound_findings = (
        formData.presentation ||
        formData.gender ||
        formData.heart_rate ||
        formData.fetal_movement ||
        formData.placenta ||
        formData.umbilical_cord
      ) ? {
        presentation: formData.presentation.trim() || undefined,
        gender: formData.gender || undefined,
        heart_rate: formData.heart_rate ? parseInt(formData.heart_rate) : undefined,
        fetal_movement: formData.fetal_movement.trim() || undefined,
        placenta: formData.placenta.trim() || undefined,
        umbilical_cord: formData.umbilical_cord.trim() || undefined,
      } : undefined;

      const anatomy = (
        formData.anat_head || formData.anat_brain || formData.anat_heart ||
        formData.anat_abdomen || formData.anat_kidneys || formData.anat_limbs ||
        formData.anat_skeleton || formData.anat_face || formData.anat_neckSkin ||
        formData.anat_spine || formData.anat_thorax
      ) ? {
        head: formData.anat_head.trim() || undefined,
        brain: formData.anat_brain.trim() || undefined,
        heart: formData.anat_heart.trim() || undefined,
        abdomen: formData.anat_abdomen.trim() || undefined,
        kidneys: formData.anat_kidneys.trim() || undefined,
        limbs: formData.anat_limbs.trim() || undefined,
        skeleton: formData.anat_skeleton.trim() || undefined,
        face: formData.anat_face.trim() || undefined,
        neckSkin: formData.anat_neckSkin.trim() || undefined,
        spine: formData.anat_spine.trim() || undefined,
        thorax: formData.anat_thorax.trim() || undefined,
      } : undefined;

      const data: ExaminationData | undefined = (pregnancy_data || ultrasound_findings || anatomy || formData.comments.trim()) ? {
        pregnancy_data,
        ultrasound_findings,
        anatomy,
        comments: formData.comments.trim() || undefined,
      } : undefined;

      const submitData: CreateExaminationRequest | UpdateExaminationRequest = {
        ...(isEdit ? {} : { patientId: formData.patientId }),
        examDate: formData.examDate,
        gestationalAge: formData.gestationalAge.trim() || undefined,
        gestationalAgeFromBiometry: formData.gestationalAgeFromBiometry.trim() || undefined,
        status: formData.status,
        examinationType: formData.examinationType || 'ultrasound_prenatal',
        biometry,
        doppler,
        notes: formData.notes.trim() || undefined,
        findings: formData.findings.trim() || undefined,
        data,
        ...(patientAge !== undefined ? { patientAgeAtExam: patientAge } : {}), // REQ-06, FLAG-07
      } as CreateExaminationRequest | UpdateExaminationRequest;

      await onSubmit(submitData);
    } catch (error: any) {
      setSubmitError(error.message || 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // ── Layout helpers ────────────────────────────────────────────────────────
  const row2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' };
  const row3: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' };
  const row4: React.CSSProperties = { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '0.75rem' };
  const row6: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.75rem' };

  // Inline style for a "Calc" button vertically aligned with an adjacent input.
  // Carbon inputs have a label (~1.125rem + 0.5rem gap) above the input itself.
  const calcButtonWrap: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
  };

  // ── Section visibility (REQ-05) ──────────────────────────────────────────
  const visibility = getSectionVisibility(formData.examinationType);

  // ── Patient age at exam (REQ-06, FLAG-07) ────────────────────────────────
  const selectedPatient = patients.find((p) => p.patientId === formData.patientId);
  const patientAge = calculateAgeAtDate(selectedPatient?.birthDate ?? '', formData.examDate);

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

          {/* ── Ultrasound Findings ── */}
          {visibility.ultrasoundFindings && (
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
                <TextInput id="heart_rate" labelText="Fetal Heart Rate (bpm)" placeholder="e.g., 145" value={formData.heart_rate} invalid={!!errors.heart_rate} invalidText={errors.heart_rate} disabled={isSubmitting} onChange={(e) => handleChange('heart_rate', e.target.value)} />
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

          {/* ── Anatomy ── */}
          {visibility.anatomy && (
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

        </div>

        {/* ── Biometry ── */}
        {visibility.biometry && (
        <>
        <h4 style={{ marginBottom: '0.5rem', fontWeight: 600 }}>Biometry (integers only, in mm/grams)</h4>
        <FormGroup legendText="">
          <Stack gap={3}>

            {/* Row A: BPD | HC | AC | FL (row6, REQ-08 rule 4) */}
            <div style={row6}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <TextInput id="bpd" labelText="BPD (mm)" placeholder="e.g., 85" value={formData.bpd} onChange={(e) => handleChange('bpd', e.target.value)} invalid={!!errors.bpd} invalidText={errors.bpd} disabled={isSubmitting} />
                <TextInput id="bpdPercentile" labelText="BPD Percentile" value={percentiles?.bpd !== undefined ? `${percentiles.bpd}th` : ''} readOnly />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <TextInput id="hc" labelText="HC (mm)" placeholder="e.g., 310" value={formData.hc} onChange={(e) => handleChange('hc', e.target.value)} invalid={!!errors.hc} invalidText={errors.hc} disabled={isSubmitting} />
                <TextInput id="hcPercentile" labelText="HC Percentile" value={percentiles?.hc !== undefined ? `${percentiles.hc}th` : ''} readOnly />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <TextInput id="ac" labelText="AC (mm)" placeholder="e.g., 280" value={formData.ac} onChange={(e) => handleChange('ac', e.target.value)} invalid={!!errors.ac} invalidText={errors.ac} disabled={isSubmitting} />
                <TextInput id="acPercentile" labelText="AC Percentile" value={percentiles?.ac !== undefined ? `${percentiles.ac}th` : ''} readOnly />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <TextInput id="fl" labelText="FL (mm)" placeholder="e.g., 55" value={formData.fl} onChange={(e) => handleChange('fl', e.target.value)} invalid={!!errors.fl} invalidText={errors.fl} disabled={isSubmitting} />
                <TextInput id="flPercentile" labelText="FL Percentile" value={percentiles?.fl !== undefined ? `${percentiles.fl}th` : ''} readOnly />
              </div>
            </div>

            {/* GA from Biometry row: Calc button | GA from Biometry field | GA from LMP (readonly) */}
            <div style={{ display: 'grid', gridTemplateColumns: '9rem 1fr 1fr', gap: '0.75rem', alignItems: 'end' }}>
              <div style={calcButtonWrap}>
                <Button
                  kind="tertiary"
                  size="md"
                  onClick={handleCalcGAFromBiometry}
                  disabled={!canCalcGAFromBiometry || isSubmitting}
                  title={
                    canCalcGAFromBiometry
                      ? 'Calculate GA from BPD, HC, AC and FL'
                      : 'All four measurements (BPD, HC, AC, FL) are required'
                  }
                >
                  AutoCalc GA
                </Button>
              </div>

              <TextInput
                id="gestationalAgeFromBiometry"
                labelText="GA from Biometry"
                placeholder="e.g., 28w 3d"
                value={formData.gestationalAgeFromBiometry}
                onChange={(e) => handleChange('gestationalAgeFromBiometry', e.target.value)}
                invalid={!!errors.gestationalAgeFromBiometry}
                invalidText={errors.gestationalAgeFromBiometry}
                disabled={isSubmitting}
              />

              <TextInput
                id="gestationalAgeFromLMPReadonly"
                labelText="GA from LMP"
                value={formData.gestationalAge}
                readOnly
              />
            </div>

            {/* EFW row: Calc button | EFW field | EFW percentile (read-only) */}
            <div style={{ display: 'grid', gridTemplateColumns: '9rem 1fr 1fr', gap: '0.75rem', alignItems: 'end' }}>
              <div style={calcButtonWrap}>
                <Button
                  kind="tertiary"
                  size="md"
                  onClick={handleCalcEFW}
                  disabled={!canCalcEFW || isSubmitting}
                  title={
                    canCalcEFW
                      ? 'Calculate EFW from BPD, HC, AC and FL (Hadlock formula)'
                      : 'All four measurements (BPD, HC, AC, FL) are required'
                  }
                >
                  AutoCalc EFW
                </Button>
              </div>

              <TextInput
                id="efw"
                labelText="EFW (grams)"
                placeholder="e.g., 1500"
                value={formData.efw}
                onChange={(e) => {
                  handleChange('efw', e.target.value);
                  setEfwPercentile(undefined);
                }}
                invalid={!!errors.efw}
                invalidText={errors.efw}
                disabled={isSubmitting}
              />

              <TextInput
                id="efwPercentile"
                labelText="EFW Percentile"
                value={efwPercentile !== undefined ? `${efwPercentile}th` : ''}
                placeholder="—"
                readOnly
              />
            </div>

            {/* Row B/C: TCD | CM | OFD | Vp | Nuchal Fold | NB | APAD | TAD | LA | LC */}
            <div style={row6}>
              {(['tcd', 'cm', 'ofd', 'vp', 'nuchalFold', 'nb', 'apad', 'tad'] as const).map((field) => {
                const labels: Record<string, string> = {
                  tcd: 'TCD (mm)', cm: 'CM (mm)', ofd: 'OFD (mm)', vp: 'Vp (mm)',
                  nuchalFold: 'Nuchal Fold (mm)', nb: 'NB (mm)', apad: 'APAD (mm)', tad: 'TAD (mm)',
                };
                return (
                  <TextInput
                    key={field}
                    id={field}
                    labelText={labels[field]}
                    placeholder="e.g., 0"
                    value={formData[field] ?? ''}
                    onChange={(e) => handleChange(field, e.target.value)}
                    invalid={!!errors[field]}
                    invalidText={errors[field]}
                    disabled={isSubmitting}
                    autoComplete="off"
                  />
                );
              })}
              <TextInput id="la" labelText="LA — Left Atrium (mm)" placeholder="e.g., 0" value={formData.la} onChange={(e) => handleChange('la', e.target.value)} invalid={!!errors.la} invalidText={errors.la} disabled={isSubmitting} autoComplete="off" />
              <TextInput id="lc" labelText="LC — Left Cardiac (mm)" placeholder="e.g., 0" value={formData.lc} onChange={(e) => handleChange('lc', e.target.value)} invalid={!!errors.lc} invalidText={errors.lc} disabled={isSubmitting} autoComplete="off" />
            </div>
          </Stack>
        </FormGroup>
        </>
        )}

        {/* ── Doppler — PI | RI | Vessel on one row ── */}
        {visibility.doppler && (
        <>
        <h4 style={{ marginBottom: '0.5rem', fontWeight: 600 }}>Doppler (floats allowed)</h4>
        <FormGroup legendText="">
          <Stack gap={3}>
            {/* Row A: PI | RI | Vessel | DucVen | A.ut.Dex PI | A.ut.Dex RI (row6) */}
            <div style={row6}>
              <TextInput id="pi" labelText="PI (Pulsatility Index)" placeholder="e.g., 1.25" value={formData.pi} onChange={(e) => handleChange('pi', e.target.value)} invalid={!!errors.pi} invalidText={errors.pi} disabled={isSubmitting} autoComplete="off" />
              <TextInput id="ri" labelText="RI (Resistance Index)" placeholder="e.g., 0.65" value={formData.ri} onChange={(e) => handleChange('ri', e.target.value)} invalid={!!errors.ri} invalidText={errors.ri} disabled={isSubmitting} autoComplete="off" />
              <TextInput id="vessel" labelText="Vessel" placeholder="e.g., Umbilical artery" value={formData.vessel} onChange={(e) => handleChange('vessel', e.target.value)} disabled={isSubmitting} autoComplete="off" />
              <TextInput id="ducVen" labelText="Duc.Ven" placeholder="e.g., normal" value={formData.ducVen} onChange={(e) => handleChange('ducVen', e.target.value)} disabled={isSubmitting} autoComplete="off" />
              <TextInput id="utADexPI" labelText="A.ut. Dex PI" placeholder="e.g., 0.0" value={formData.utADexPI} onChange={(e) => handleChange('utADexPI', e.target.value)} invalid={!!errors.utADexPI} invalidText={errors.utADexPI} disabled={isSubmitting} autoComplete="off" />
              <TextInput id="utADexRI" labelText="A.ut. Dex RI" placeholder="e.g., 0.0" value={formData.utADexRI} onChange={(e) => handleChange('utADexRI', e.target.value)} invalid={!!errors.utADexRI} invalidText={errors.utADexRI} disabled={isSubmitting} autoComplete="off" />
            </div>
            {/* Row B: A.ut.Sin PI | A.ut.Sin RI | CMA | PSV | CPR (row6, 5 fields + 1 empty) */}
            <div style={row6}>
              <TextInput id="utASinPI" labelText="A.ut. Sin PI" placeholder="e.g., 0.0" value={formData.utASinPI} onChange={(e) => handleChange('utASinPI', e.target.value)} invalid={!!errors.utASinPI} invalidText={errors.utASinPI} disabled={isSubmitting} autoComplete="off" />
              <TextInput id="utASinRI" labelText="A.ut. Sin RI" placeholder="e.g., 0.0" value={formData.utASinRI} onChange={(e) => handleChange('utASinRI', e.target.value)} invalid={!!errors.utASinRI} invalidText={errors.utASinRI} disabled={isSubmitting} autoComplete="off" />
              <TextInput id="cma" labelText="CMA" placeholder="e.g., 0.0" value={formData.cma} onChange={(e) => handleChange('cma', e.target.value)} invalid={!!errors.cma} invalidText={errors.cma} disabled={isSubmitting} autoComplete="off" />
              <TextInput id="psv" labelText="PSV" placeholder="e.g., 0.0" value={formData.psv} onChange={(e) => handleChange('psv', e.target.value)} invalid={!!errors.psv} invalidText={errors.psv} disabled={isSubmitting} autoComplete="off" />
              <TextInput id="cpr" labelText="CPR" placeholder="e.g., 0.0" value={formData.cpr} onChange={(e) => handleChange('cpr', e.target.value)} invalid={!!errors.cpr} invalidText={errors.cpr} disabled={isSubmitting} autoComplete="off" />
              <div />
            </div>
          </Stack>
        </FormGroup>
        </>
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
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : isEdit ? `Update ${getExamTypeLabel(formData.examinationType)}` : `Create ${getExamTypeLabel(formData.examinationType)}`}
          </Button>
        </ButtonSet>
      </Stack>
    </Form>
  );
}

// Made with Bob
