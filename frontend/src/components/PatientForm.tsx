import { useState, useEffect } from 'react';
import {
  Form,
  Stack,
  TextInput,
  TextArea,
  Button,
  InlineNotification,
  DatePicker,
  DatePickerInput,
} from '@carbon/react';
import type { Patient, CreatePatientRequest, UpdatePatientRequest } from '../types';

interface PatientFormProps {
  patient?: Patient;
  onSubmit: (data: CreatePatientRequest | UpdatePatientRequest) => Promise<void>;
  onCancel: () => void;
  isEdit?: boolean;
}

// Helper: YYYY-MM-DD → dd/mm/yyyy for DatePicker display
function toDisplayDate(iso: string): string {
  const [yyyy, mm, dd] = iso.split('-');
  return `${dd}/${mm}/${yyyy}`;
}

// Helper: Date → YYYY-MM-DD
function toISODate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function PatientForm({ patient, onSubmit, onCancel, isEdit = false }: PatientFormProps) {
  const [formData, setFormData] = useState({
    name: patient?.name || '',
    birthDate: patient?.birthDate || '',
    phone: patient?.phone || '',
    email: patient?.email || '',
    address: patient?.address || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (patient) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData({
        name: patient.name,
        birthDate: patient.birthDate || '',
        phone: patient.phone,
        email: patient.email || '',
        address: patient.address || '',
      });
    }
  }, [patient]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    // Birth date validation — must be in the past, patient must be 2–99 years old
    if (!formData.birthDate) {
      newErrors.birthDate = 'Date of birth is required';
    } else {
      const [by, bm, bd] = formData.birthDate.split('-').map(Number);
      const today = new Date();
      const birthDateObj = new Date(by, bm - 1, bd);
      if (birthDateObj >= today) {
        newErrors.birthDate = 'Date of birth must be in the past';
      } else {
        let age = today.getFullYear() - by;
        if (today.getMonth() + 1 < bm || (today.getMonth() + 1 === bm && today.getDate() < bd)) {
          age -= 1;
        }
        if (age < 2 || age > 99) {
          newErrors.birthDate = 'Patient must be between 2 and 99 years old';
        }
      }
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone is required';
    } else if (!/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/.test(formData.phone.trim())) {
      newErrors.phone = 'Phone must be a valid phone number (e.g. +1234567890)';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
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
      const submitData: CreatePatientRequest | UpdatePatientRequest = {
        name: formData.name.trim(),
        birthDate: formData.birthDate,
        phone: formData.phone.trim(),
        email: formData.email.trim() || undefined,
        address: formData.address.trim() || undefined,
      };

      await onSubmit(submitData);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'An error occurred');
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

        <TextInput
          id="name"
          labelText="Name"
          placeholder="Enter patient name"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          invalid={!!errors.name}
          invalidText={errors.name}
          aria-label="Patient name"
          required
          disabled={isSubmitting}
        />

        {/* TASK-038: DatePicker for birth date replaces the NumberInput age field */}
        <DatePicker
          datePickerType="single"
          dateFormat="d/m/Y"
          value={formData.birthDate ? toDisplayDate(formData.birthDate) : ''}
          maxDate={(() => {
            const today = new Date();
            const dd = String(today.getDate()).padStart(2, '0');
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const yyyy = today.getFullYear();
            return `${dd}/${mm}/${yyyy}`;
          })()}
          onChange={(dates: Date[]) => {
            if (dates[0]) {
              handleChange('birthDate', toISODate(dates[0]));
            }
          }}
        >
          <DatePickerInput
            id="birthDate"
            labelText="Date of Birth"
            placeholder="dd/mm/yyyy"
            invalid={!!errors.birthDate}
            invalidText={errors.birthDate}
            disabled={isSubmitting}
          />
        </DatePicker>

        <TextInput
          id="phone"
          labelText="Phone"
          placeholder="e.g. +1234567890"
          value={formData.phone}
          onChange={(e) => handleChange('phone', e.target.value)}
          invalid={!!errors.phone}
          invalidText={errors.phone}
          aria-label="Patient phone number"
          required
          disabled={isSubmitting}
        />

        <TextInput
          id="email"
          labelText="Email (optional)"
          placeholder="Enter email address"
          type="email"
          value={formData.email}
          onChange={(e) => handleChange('email', e.target.value)}
          invalid={!!errors.email}
          invalidText={errors.email}
          aria-label="Patient email address"
          disabled={isSubmitting}
        />

        <TextArea
          id="address"
          labelText="Address (optional)"
          placeholder="Enter address"
          value={formData.address}
          onChange={(e) => handleChange('address', e.target.value)}
          rows={3}
          aria-label="Patient address"
          disabled={isSubmitting}
        />

        <Stack orientation="horizontal" gap={4}>
          <Button
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : isEdit ? 'Update Patient' : 'Create Patient'}
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
