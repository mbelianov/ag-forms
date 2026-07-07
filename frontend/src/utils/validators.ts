/**
 * Client-side validation utilities shared between PatientForm and ExaminationForm.
 * TASK-026: Extracted from duplicated validation blocks in form components.
 */

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

const GA_REGEX = /^\d{1,2}w\s?\d{1}d$/;
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
  if (!GA_REGEX.test(ga)) return 'Format must be "28w 3d"';
  return undefined;
}

/**
 * Validate a biometry integer field.
 * Returns an error message string or undefined if valid.
 */
export function validateBiometryField(value: string, fieldName: string): string | undefined {
  if (!value || !value.trim()) return undefined;
  const parsed = parseInt(value);
  if (isNaN(parsed) || parsed.toString() !== value.trim()) {
    return `${fieldName} must be a whole number (integer)`;
  }
  if (parsed <= 0) {
    return `${fieldName} must be a positive number`;
  }
  return undefined;
}

/**
 * Validate a doppler float field.
 * Returns an error message string or undefined if valid.
 */
export function validateDopplerField(value: string, fieldName: string): string | undefined {
  if (!value || !value.trim()) return undefined;
  const parsed = parseFloat(value);
  if (isNaN(parsed)) {
    return `${fieldName} must be a valid number`;
  }
  if (parsed < 0) {
    return `${fieldName} must be a positive number`;
  }
  return undefined;
}

// Made with Bob
