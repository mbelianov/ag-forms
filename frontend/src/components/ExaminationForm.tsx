import { useState, useEffect } from 'react';
import {
  Form,
  Stack,
  TextInput,
  NumberInput,
  TextArea,
  Button,
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
  Patient 
} from '../types';

interface ExaminationFormProps {
  examination?: Examination;
  patients: Patient[];
  preselectedPatientId?: string;
  onSubmit: (data: CreateExaminationRequest | UpdateExaminationRequest) => Promise<void>;
  onCancel: () => void;
  isEdit?: boolean;
}

export default function ExaminationForm({ 
  examination, 
  patients,
  preselectedPatientId,
  onSubmit, 
  onCancel, 
  isEdit = false 
}: ExaminationFormProps) {
  const [formData, setFormData] = useState({
    patientId: examination?.patientId || preselectedPatientId || '',
    examDate: examination?.examDate ? new Date(examination.examDate).toISOString().split('T')[0] : '',
    gestationalAge: examination?.gestationalAge || '',
    status: examination?.status || 'draft' as 'draft' | 'completed' | 'reviewed',
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
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (examination) {
      setFormData({
        patientId: examination.patientId,
        examDate: new Date(examination.examDate).toISOString().split('T')[0],
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
      });
    }
  }, [examination]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Patient ID validation (only for create)
    if (!isEdit && !formData.patientId) {
      newErrors.patientId = 'Patient is required';
    }

    // Exam date validation
    if (!formData.examDate) {
      newErrors.examDate = 'Examination date is required';
    } else {
      const examDate = new Date(formData.examDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (examDate > today) {
        newErrors.examDate = 'Examination date cannot be in the future';
      }
    }

    // Gestational age validation (optional but must match format if provided)
    if (formData.gestationalAge) {
      const gestationalAgeRegex = /^\d{1,2}w\s?\d{1}d$/;
      if (!gestationalAgeRegex.test(formData.gestationalAge)) {
        newErrors.gestationalAge = 'Format must be "28w 3d" (weeks and days)';
      }
    }

    // Biometry validation (must be integers if provided)
    const biometryFields = ['bpd', 'hc', 'ac', 'fl', 'efw'];
    biometryFields.forEach(field => {
      const value = formData[field as keyof typeof formData] as string;
      if (value && value.trim()) {
        const parsed = parseInt(value);
        if (isNaN(parsed) || parsed.toString() !== value.trim()) {
          newErrors[field] = 'Must be a whole number (integer)';
        } else if (parsed < 0) {
          newErrors[field] = 'Must be a positive number';
        }
      }
    });

    // Doppler validation (floats allowed)
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
      // Build biometry object (integers only - use parseInt)
      const biometry = (formData.bpd || formData.hc || formData.ac || formData.fl || formData.efw) ? {
        bpd: formData.bpd ? parseInt(formData.bpd) : undefined,
        hc: formData.hc ? parseInt(formData.hc) : undefined,
        ac: formData.ac ? parseInt(formData.ac) : undefined,
        fl: formData.fl ? parseInt(formData.fl) : undefined,
        efw: formData.efw ? parseInt(formData.efw) : undefined,
      } : undefined;

      // Build doppler object (floats allowed - use parseFloat)
      const doppler = (formData.pi || formData.ri || formData.vessel) ? {
        pi: formData.pi ? parseFloat(formData.pi) : undefined,
        ri: formData.ri ? parseFloat(formData.ri) : undefined,
        vessel: formData.vessel.trim() || undefined,
      } : undefined;

      const submitData: CreateExaminationRequest | UpdateExaminationRequest = {
        ...(isEdit ? {} : { patientId: formData.patientId }),
        examDate: new Date(formData.examDate).toISOString(),
        gestationalAge: formData.gestationalAge.trim() || undefined,
        status: formData.status,
        biometry,
        doppler,
        notes: formData.notes.trim() || undefined,
        findings: formData.findings.trim() || undefined,
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
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

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

        <DatePicker
          datePickerType="single"
          value={formData.examDate}
          onChange={(dates: Date[]) => {
            if (dates[0]) {
              handleChange('examDate', dates[0].toISOString().split('T')[0]);
            }
          }}
          maxDate={new Date().toISOString().split('T')[0]}
        >
          <DatePickerInput
            id="examDate"
            labelText="Examination Date"
            placeholder="mm/dd/yyyy"
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

        <FormGroup legendText="Biometry (integers only, in mm/grams)">
          <Stack gap={4}>
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
          </Stack>
        </FormGroup>

        <FormGroup legendText="Doppler (floats allowed)">
          <Stack gap={4}>
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
          </Stack>
        </FormGroup>

        <TextArea
          id="findings"
          labelText="Findings (optional)"
          placeholder="Enter examination findings"
          value={formData.findings}
          onChange={(e) => handleChange('findings', e.target.value)}
          rows={4}
          disabled={isSubmitting}
        />

        <TextArea
          id="notes"
          labelText="Notes (optional)"
          placeholder="Enter additional notes"
          value={formData.notes}
          onChange={(e) => handleChange('notes', e.target.value)}
          rows={3}
          disabled={isSubmitting}
        />

        <Stack orientation="horizontal" gap={4}>
          <Button
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : isEdit ? 'Update Examination' : 'Create Examination'}
          </Button>
          <Button
            kind="secondary"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        </Stack>
      </Stack>
    </Form>
  );
}

// Made with Bob