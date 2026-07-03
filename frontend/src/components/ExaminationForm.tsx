import { useState, useEffect } from 'react';
import {
  Form,
  Stack,
  TextInput,
  TextArea,
  Button,
  InlineNotification,
  Select,
  SelectItem,
  DatePicker,
  DatePickerInput,
  FormGroup,
  Accordion,
  AccordionItem,
} from '@carbon/react';
import type {
  Examination,
  CreateExaminationRequest,
  UpdateExaminationRequest,
  Patient,
  ExaminationData,
} from '../types';

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
    gestationalAge: examination?.gestationalAge || '',
    status: (examination?.status || 'draft') as 'draft' | 'completed' | 'reviewed',
    // Biometry (integers only)
    bpd: examination?.biometry?.bpd?.toString() || '',
    hc: examination?.biometry?.hc?.toString() || '',
    ac: examination?.biometry?.ac?.toString() || '',
    fl: examination?.biometry?.fl?.toString() || '',
    efw: examination?.biometry?.efw?.toString() || '',
    // Doppler (floats allowed)
    pi: examination?.doppler?.pi?.toString() || '',
    ri: examination?.doppler?.ri?.toString() || '',
    vessel: examination?.doppler?.vessel || '',
    notes: examination?.notes || '',
    findings: examination?.findings || '',
    // Pregnancy data
    last_menstrual_period: examination?.data?.pregnancy_data?.last_menstrual_period || '',
    ultrasound_date: examination?.data?.pregnancy_data?.ultrasound_date || '',
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
    // Top-level data comment
    comments: examination?.data?.comments || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (examination) {
      setFormData({
        patientId: examination.patientId,
        examDate: examDateToYMD(examination.examDate),
        gestationalAge: examination.gestationalAge || '',
        status: examination.status,
        bpd: examination.biometry?.bpd?.toString() || '',
        hc: examination.biometry?.hc?.toString() || '',
        ac: examination.biometry?.ac?.toString() || '',
        fl: examination.biometry?.fl?.toString() || '',
        efw: examination.biometry?.efw?.toString() || '',
        pi: examination.doppler?.pi?.toString() || '',
        ri: examination.doppler?.ri?.toString() || '',
        vessel: examination.doppler?.vessel || '',
        notes: examination.notes || '',
        findings: examination.findings || '',
        last_menstrual_period: examination.data?.pregnancy_data?.last_menstrual_period || '',
        ultrasound_date: examination.data?.pregnancy_data?.ultrasound_date || '',
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
        comments: examination.data?.comments || '',
      });
    }
  }, [examination]);

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

    if (formData.gestationalAge) {
      const gestationalAgeRegex = /^\d{1,2}w\s?\d{1}d$/;
      if (!gestationalAgeRegex.test(formData.gestationalAge)) {
        newErrors.gestationalAge = 'Format must be "28w 3d" (weeks and days)';
      }
    }

    // Biometry validation (integers, > 0 if provided)
    const biometryFields = ['bpd', 'hc', 'ac', 'fl', 'efw'];
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

    // Doppler validation (floats, >= 0 if provided)
    const dopplerFields = ['pi', 'ri'];
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const biometry = (formData.bpd || formData.hc || formData.ac || formData.fl || formData.efw) ? {
        bpd: formData.bpd ? parseInt(formData.bpd) : undefined,
        hc: formData.hc ? parseInt(formData.hc) : undefined,
        ac: formData.ac ? parseInt(formData.ac) : undefined,
        fl: formData.fl ? parseInt(formData.fl) : undefined,
        efw: formData.efw ? parseInt(formData.efw) : undefined,
      } : undefined;

      const doppler = (formData.pi || formData.ri || formData.vessel) ? {
        pi: formData.pi ? parseFloat(formData.pi) : undefined,
        ri: formData.ri ? parseFloat(formData.ri) : undefined,
        vessel: formData.vessel.trim() || undefined,
      } : undefined;

      // Build the nested `data` object — only include sub-objects that have at
      // least one non-empty field so we don't send empty structures.
      const pregnancy_data = (
        formData.last_menstrual_period ||
        formData.ultrasound_date ||
        formData.obstetric_history ||
        formData.family_history
      ) ? {
        last_menstrual_period: formData.last_menstrual_period || undefined,
        ultrasound_date: formData.ultrasound_date || undefined,
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
        formData.anat_skeleton
      ) ? {
        head: formData.anat_head.trim() || undefined,
        brain: formData.anat_brain.trim() || undefined,
        heart: formData.anat_heart.trim() || undefined,
        abdomen: formData.anat_abdomen.trim() || undefined,
        kidneys: formData.anat_kidneys.trim() || undefined,
        limbs: formData.anat_limbs.trim() || undefined,
        skeleton: formData.anat_skeleton.trim() || undefined,
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
        status: formData.status,
        biometry,
        doppler,
        notes: formData.notes.trim() || undefined,
        findings: formData.findings.trim() || undefined,
        data,
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

  // Grid layout helpers — plain CSS, no new imports needed
  const row2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' };
  const row3: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' };
  const rowAuto: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem' };

  return (
    <Form onSubmit={handleSubmit}>
      <Stack gap={6}>
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

        {/* ── Exam Date | Gestational Age | Status — one row ── */}
        <div style={row3}>
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

          <TextInput
            id="gestationalAge"
            labelText="Gestational Age (optional)"
            placeholder="e.g., 28w 3d"
            value={formData.gestationalAge}
            onChange={(e) => handleChange('gestationalAge', e.target.value)}
            invalid={!!errors.gestationalAge}
            invalidText={errors.gestationalAge}
            disabled={isSubmitting}
          />

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
        </div>

        {/* ── Clinical data sections ── */}
        <Accordion>

          {/* ── Pregnancy Data ── */}
          <AccordionItem title="Pregnancy Data" open>
            <Stack gap={4}>
              {/* LMP | Ultrasound Date */}
              <div style={row2}>
                <DatePicker
                  datePickerType="single"
                  dateFormat="d/m/Y"
                  value={formData.last_menstrual_period ? toDisplayDate(formData.last_menstrual_period) : ''}
                  onChange={(dates: Date[]) => {
                    if (dates[0]) handleChange('last_menstrual_period', toISODate(dates[0]));
                  }}
                >
                  <DatePickerInput
                    id="last_menstrual_period"
                    labelText="Last Menstrual Period (LMP)"
                    placeholder="dd/mm/yyyy"
                    disabled={isSubmitting}
                  />
                </DatePicker>

                <DatePicker
                  datePickerType="single"
                  dateFormat="d/m/Y"
                  value={formData.ultrasound_date ? toDisplayDate(formData.ultrasound_date) : ''}
                  onChange={(dates: Date[]) => {
                    if (dates[0]) handleChange('ultrasound_date', toISODate(dates[0]));
                  }}
                >
                  <DatePickerInput
                    id="ultrasound_date"
                    labelText="Ultrasound Date"
                    placeholder="dd/mm/yyyy"
                    disabled={isSubmitting}
                  />
                </DatePicker>
              </div>

              {/* Obstetric History | Family History */}
              <div style={row2}>
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
          </AccordionItem>

          {/* ── Ultrasound Findings ── */}
          <AccordionItem title="Ultrasound Findings" open>
            <Stack gap={4}>
              {/* Presentation | Gender */}
              <div style={row2}>
                <Select
                  id="presentation"
                  labelText="Presentation"
                  value={formData.presentation}
                  onChange={(e) => handleChange('presentation', e.target.value)}
                  disabled={isSubmitting}
                >
                  <SelectItem value="" text="Select presentation" />
                  <SelectItem value="cephalic" text="Cephalic" />
                  <SelectItem value="breech" text="Breech" />
                  <SelectItem value="transverse" text="Transverse" />
                  <SelectItem value="oblique" text="Oblique" />
                </Select>

                <Select
                  id="gender"
                  labelText="Gender"
                  value={formData.gender}
                  onChange={(e) => handleChange('gender', e.target.value)}
                  disabled={isSubmitting}
                >
                  <SelectItem value="" text="Select gender" />
                  <SelectItem value="male" text="Male" />
                  <SelectItem value="female" text="Female" />
                  <SelectItem value="unknown" text="Unknown" />
                </Select>
              </div>

              {/* Heart Rate | Fetal Movement */}
              <div style={row2}>
                <TextInput
                  id="heart_rate"
                  labelText="Fetal Heart Rate (bpm)"
                  placeholder="e.g., 145"
                  value={formData.heart_rate}
                  invalid={!!errors.heart_rate}
                  invalidText={errors.heart_rate}
                  disabled={isSubmitting}
                  onChange={(e) => handleChange('heart_rate', e.target.value)}
                />

                <Select
                  id="fetal_movement"
                  labelText="Fetal Movement"
                  value={formData.fetal_movement}
                  onChange={(e) => handleChange('fetal_movement', e.target.value)}
                  disabled={isSubmitting}
                >
                  <SelectItem value="" text="Select fetal movement" />
                  <SelectItem value="active" text="Active" />
                  <SelectItem value="present" text="Present" />
                  <SelectItem value="reduced" text="Reduced" />
                  <SelectItem value="absent" text="Absent" />
                </Select>
              </div>

              {/* Placenta | Umbilical Cord */}
              <div style={row2}>
                <TextInput
                  id="placenta"
                  labelText="Placenta"
                  placeholder="e.g., anterior, grade 1"
                  value={formData.placenta}
                  onChange={(e) => handleChange('placenta', e.target.value)}
                  disabled={isSubmitting}
                />

                <TextInput
                  id="umbilical_cord"
                  labelText="Umbilical Cord"
                  placeholder="e.g., 3 vessels"
                  value={formData.umbilical_cord}
                  onChange={(e) => handleChange('umbilical_cord', e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            </Stack>
          </AccordionItem>

          {/* ── Anatomy ── */}
          <AccordionItem title="Anatomy" open>
            <Stack gap={4}>
              {/* Head | Brain | Heart */}
              <div style={row3}>
                <TextInput id="anat_head"    labelText="Head"    placeholder="e.g., normal" value={formData.anat_head}    onChange={(e) => handleChange('anat_head',    e.target.value)} disabled={isSubmitting} />
                <TextInput id="anat_brain"   labelText="Brain"   placeholder="e.g., normal" value={formData.anat_brain}   onChange={(e) => handleChange('anat_brain',   e.target.value)} disabled={isSubmitting} />
                <TextInput id="anat_heart"   labelText="Heart"   placeholder="e.g., normal" value={formData.anat_heart}   onChange={(e) => handleChange('anat_heart',   e.target.value)} disabled={isSubmitting} />
              </div>
              {/* Abdomen | Kidneys | Limbs */}
              <div style={row3}>
                <TextInput id="anat_abdomen" labelText="Abdomen" placeholder="e.g., normal" value={formData.anat_abdomen} onChange={(e) => handleChange('anat_abdomen', e.target.value)} disabled={isSubmitting} />
                <TextInput id="anat_kidneys" labelText="Kidneys" placeholder="e.g., normal" value={formData.anat_kidneys} onChange={(e) => handleChange('anat_kidneys', e.target.value)} disabled={isSubmitting} />
                <TextInput id="anat_limbs"   labelText="Limbs"   placeholder="e.g., normal" value={formData.anat_limbs}   onChange={(e) => handleChange('anat_limbs',   e.target.value)} disabled={isSubmitting} />
              </div>
              {/* Skeleton (half width, keeps left-alignment) */}
              <div style={row2}>
                <TextInput id="anat_skeleton" labelText="Skeleton" placeholder="e.g., normal" value={formData.anat_skeleton} onChange={(e) => handleChange('anat_skeleton', e.target.value)} disabled={isSubmitting} />
              </div>
            </Stack>
          </AccordionItem>

        </Accordion>

        {/* ── Biometry — all 5 on one auto-fit row ── */}
        <FormGroup legendText="Biometry (integers only, in mm/grams)">
          <div style={rowAuto}>
            <TextInput
              id="bpd"
              labelText="BPD (mm)"
              placeholder="e.g., 85"
              value={formData.bpd}
              onChange={(e) => handleChange('bpd', e.target.value)}
              invalid={!!errors.bpd}
              invalidText={errors.bpd}
              disabled={isSubmitting}
            />

            <TextInput
              id="hc"
              labelText="HC (mm)"
              placeholder="e.g., 310"
              value={formData.hc}
              onChange={(e) => handleChange('hc', e.target.value)}
              invalid={!!errors.hc}
              invalidText={errors.hc}
              disabled={isSubmitting}
            />

            <TextInput
              id="ac"
              labelText="AC (mm)"
              placeholder="e.g., 280"
              value={formData.ac}
              onChange={(e) => handleChange('ac', e.target.value)}
              invalid={!!errors.ac}
              invalidText={errors.ac}
              disabled={isSubmitting}
            />

            <TextInput
              id="fl"
              labelText="FL (mm)"
              placeholder="e.g., 55"
              value={formData.fl}
              onChange={(e) => handleChange('fl', e.target.value)}
              invalid={!!errors.fl}
              invalidText={errors.fl}
              disabled={isSubmitting}
            />

            <TextInput
              id="efw"
              labelText="EFW (grams)"
              placeholder="e.g., 1500"
              value={formData.efw}
              onChange={(e) => handleChange('efw', e.target.value)}
              invalid={!!errors.efw}
              invalidText={errors.efw}
              disabled={isSubmitting}
            />
          </div>
        </FormGroup>

        {/* ── Doppler — PI | RI | Vessel on one row ── */}
        <FormGroup legendText="Doppler (floats allowed)">
          <div style={row3}>
            <TextInput
              id="pi"
              labelText="PI (Pulsatility Index)"
              placeholder="e.g., 1.25"
              value={formData.pi}
              onChange={(e) => handleChange('pi', e.target.value)}
              invalid={!!errors.pi}
              invalidText={errors.pi}
              disabled={isSubmitting}
            />

            <TextInput
              id="ri"
              labelText="RI (Resistance Index)"
              placeholder="e.g., 0.65"
              value={formData.ri}
              onChange={(e) => handleChange('ri', e.target.value)}
              invalid={!!errors.ri}
              invalidText={errors.ri}
              disabled={isSubmitting}
            />

            <TextInput
              id="vessel"
              labelText="Vessel"
              placeholder="e.g., Umbilical artery"
              value={formData.vessel}
              onChange={(e) => handleChange('vessel', e.target.value)}
              disabled={isSubmitting}
            />
          </div>
        </FormGroup>

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

        <Stack orientation="horizontal" gap={4}>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : isEdit ? 'Update Examination' : 'Create Examination'}
          </Button>
          <Button kind="secondary" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        </Stack>
      </Stack>
    </Form>
  );
}

// Made with Bob
