/**
 * Client-side validation utilities shared between PatientForm and ExaminationForm.
 * TASK-026: Extracted from duplicated validation blocks in form components.
 */

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export const GA_REGEX = /^(\d{1,2}w\s?\d{1}d|\d{1,2}с\s?\d{1}д)$/;
const PHONE_REGEX = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate patient form data.
 * Accepts both legacy `age` and new `birthDate` formats (TASK-038).
 */
export function validatePatient(data: {
  name?: string;
  age?: number | string;
  birthDate?: string;
  phone?: string;
  email?: string;
}): ValidationResult {
  const errors: Record<string, string> = {};

  if (!data.name || !data.name.trim()) {
    errors.name = 'Name is required';
  } else if (data.name.trim().length < 2) {
    errors.name = 'Name must be at least 2 characters';
  }

  // Support either age or birthDate
  if (data.birthDate !== undefined && data.birthDate !== '') {
    const [y, m, d] = data.birthDate.split('-').map(Number);
    if (!y || !m || !d) {
      errors.birthDate = 'Please enter a valid date of birth (YYYY-MM-DD)';
    } else {
      const dob = new Date(y, m - 1, d);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (dob >= today) {
        errors.birthDate = 'Date of birth must be in the past';
      } else {
        // Calculate age and check 2–99 range
        let age = today.getFullYear() - y;
        if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) {
          age--;
        }
        if (age < 2 || age > 99) {
          errors.birthDate = 'Patient age must be between 2 and 99 years';
        }
      }
    }
  } else if (data.age !== undefined && data.age !== '') {
    const age = Number(data.age);
    if (isNaN(age) || age < 2 || age > 99) {
      errors.age = 'Age must be between 2 and 99 years';
    }
  }

  if (!data.phone || !data.phone.trim()) {
    errors.phone = 'Phone is required';
  } else if (!PHONE_REGEX.test(data.phone.trim())) {
    errors.phone = 'Phone must be a valid phone number (e.g. +1234567890)';
  }

  if (data.email && !EMAIL_REGEX.test(data.email)) {
    errors.email = 'Invalid email format';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * Validate a gestational age string (must be "NNw Nd" format).
 */
export function validateGestationalAge(ga: string): string | undefined {
  if (!ga) return undefined;
  if (!GA_REGEX.test(ga)) return 'Format must be "28w 3d" or "28с 3д"';
  return undefined;
}

/** Strict numeric regex — rejects "1abc", "1,5", "1e5" */
const NUMERIC_REGEX = /^\d+(\.\d+)?$/;

/**
 * Validate a positive float field (biometry).
 * Rejects "1abc", "1,5". Accepts empty (optional field).
 * Returns an error string if invalid, undefined if empty or valid.
 */
export function validatePositiveFloat(raw: string, label: string): string | undefined {
  if (!raw || !raw.trim()) return undefined;
  const trimmed = raw.trim();
  if (!NUMERIC_REGEX.test(trimmed)) return `${label} must be a positive number`;
  const v = parseFloat(trimmed);
  if (v <= 0) return `${label} must be a positive number`;
  return undefined;
}

/**
 * Validate a non-negative float field (doppler).
 * Same strict regex as validatePositiveFloat; accepts 0.
 */
export function validateNonNegativeFloat(raw: string, label: string): string | undefined {
  if (!raw || !raw.trim()) return undefined;
  const trimmed = raw.trim();
  if (!NUMERIC_REGEX.test(trimmed)) return `${label} must be a valid number`;
  const v = parseFloat(trimmed);
  if (v < 0) return `${label} must be a valid number`;
  return undefined;
}

/**
 * Validate an integer field (heart rate / pulse).
 * Accepts "145" or "145.7" (fraction will be truncated at submit). Rejects "145abc".
 * Value must be > 0.
 */
export function validateIntegerField(raw: string, label: string): string | undefined {
  if (!raw || !raw.trim()) return undefined;
  const trimmed = raw.trim();
  if (!NUMERIC_REGEX.test(trimmed)) return `${label} must be a whole number`;
  const v = parseFloat(trimmed);
  if (v <= 0) return `${label} must be a positive number`;
  return undefined;
}

/**
 * Validate a biometry float field.
 * Delegates to validatePositiveFloat.
 */
export function validateBiometryField(value: string, fieldName: string): string | undefined {
  return validatePositiveFloat(value, fieldName);
}

/**
 * Validate a doppler float field.
 * Delegates to validateNonNegativeFloat.
 */
export function validateDopplerField(value: string, fieldName: string): string | undefined {
  return validateNonNegativeFloat(value, fieldName);
}

// Made with Bob
