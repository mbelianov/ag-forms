import { useState, useEffect } from 'react';
import {
  Form,
  Stack,
  TextInput,
  NumberInput,
  TextArea,
  Button,
  InlineNotification,
} from '@carbon/react';
import type { Patient, CreatePatientRequest, UpdatePatientRequest } from '../types';

interface PatientFormProps {
  patient?: Patient;
  onSubmit: (data: CreatePatientRequest | UpdatePatientRequest) => Promise<void>;
  onCancel: () => void;
  isEdit?: boolean;
}

export default function PatientForm({ patient, onSubmit, onCancel, isEdit = false }: PatientFormProps) {
  const [formData, setFormData] = useState({
    name: patient?.name || '',
    age: patient?.age || 2,
    phone: patient?.phone || '',
    email: patient?.email || '',
    address: patient?.address || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (patient) {
      setFormData({
        name: patient.name,
        age: patient.age,
        phone: patient.phone,
        email: patient.email || '',
        address: patient.address || '',
      });
    }
  }, [patient]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    // Age validation (2-99 years per AGENTS.md)
    if (formData.age < 2 || formData.age > 99) {
      newErrors.age = 'Age must be between 2 and 99 years';
    }

    // Phone validation
    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone is required';
    }

    // Email validation (optional but must be valid if provided)
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
        age: formData.age,
        phone: formData.phone.trim(),
        email: formData.email.trim() || undefined,
        address: formData.address.trim() || undefined,
      };

      await onSubmit(submitData);
    } catch (error: any) {
      setSubmitError(error.message || 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: string, value: string | number) => {
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

        {isEdit && patient && (
          <TextInput
            id="mrn"
            labelText="MRN"
            value={patient.mrn}
            readOnly
            disabled
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
          required
          disabled={isSubmitting}
        />

        <NumberInput
          id="age"
          label="Age (years)"
          min={2}
          max={99}
          value={formData.age}
          onChange={(_e, { value }) => handleChange('age', value || 2)}
          invalid={!!errors.age}
          invalidText={errors.age}
          required
          disabled={isSubmitting}
        />

        <TextInput
          id="phone"
          labelText="Phone"
          placeholder="Enter phone number"
          value={formData.phone}
          onChange={(e) => handleChange('phone', e.target.value)}
          invalid={!!errors.phone}
          invalidText={errors.phone}
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
          disabled={isSubmitting}
        />

        <TextArea
          id="address"
          labelText="Address (optional)"
          placeholder="Enter address"
          value={formData.address}
          onChange={(e) => handleChange('address', e.target.value)}
          rows={3}
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