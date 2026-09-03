/**
 * Validation Schemas
 * Input validation using Joi for all API endpoints
 */

import * as Joi from 'joi';
import { ValidationResult } from '../types';
import { EXAM_TYPE_KEYS } from '../constants/examinationTypes';

const GA_REGEX = /^(\d{1,2}w\s?\d{1}d|\d{1,2}с\s?\d{1}д)$/;

/**
 * User validation schema
 */
/** Shared field definitions reused across user schemas */
const usernameField = Joi.string()
    .min(3)
    .max(50)
    .pattern(/^[a-zA-Z0-9_-]+$/)
    .required()
    .messages({
        'string.min': 'Username must be at least 3 characters long',
        'string.max': 'Username must not exceed 50 characters',
        'string.pattern.base': 'Username can only contain letters, numbers, underscores, and hyphens',
        'any.required': 'Username is required'
    });

const passwordField = Joi.string()
    .min(12)
    .required()
    .messages({
        'string.min': 'Password must be at least 12 characters long',
        'any.required': 'Password is required'
    });

const fullNameField = Joi.string()
    .min(2)
    .max(255)
    .optional()
    .messages({
        'string.min': 'Full name must be at least 2 characters long',
        'string.max': 'Full name must not exceed 255 characters'
    });

const emailField = Joi.string()
    .email({ tlds: { allow: false } })
    .required()
    .messages({
        'string.email': 'Email must be a valid email address',
        'any.required': 'Email is required'
    });

const roleField = Joi.string()
    .valid('admin', 'doctor', 'viewer')
    .required()
    .messages({
        'any.only': 'Role must be one of: admin, doctor, viewer',
        'any.required': 'Role is required'
    });

/**
 * Admin-facing user schema — role is required.
 * Used by CreateUser (admin creates a user with an explicit role).
 */
const userSchema = Joi.object({
    username: usernameField,
    password: passwordField,
    fullName: fullNameField,
    email:    emailField,
    role:     roleField
});

/**
 * Self-registration schema — role is optional.
 * The first user always gets role='admin' assigned by the server regardless of
 * what was submitted; subsequent registrations must supply a valid role but that
 * is enforced programmatically in Register.ts AFTER the isFirstUser check, not
 * here, so the schema itself leaves role optional to avoid a 400 before we even
 * know whether this is the first user.
 */
const registerSchema = Joi.object({
    username: usernameField,
    password: passwordField,
    fullName: fullNameField,
    email:    emailField,
    role: Joi.string()
        .valid('admin', 'doctor', 'viewer')
        .optional()
        .allow('')
        .messages({
            'any.only': 'Role must be one of: admin, doctor, viewer'
        })
});

/**
 * Patient validation schema
 * TASK-038: birthDate (YYYY-MM-DD) replaces required age; age kept as optional for legacy records.
 */
const patientSchema = Joi.object({
    name: Joi.string()
        .min(2)
        .max(255)
        .required()
        .messages({
            'string.min': 'Name must be at least 2 characters long',
            'string.max': 'Name must not exceed 255 characters',
            'any.required': 'Name is required'
        }),
    birthDate: Joi.string()
        .pattern(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .allow('')
        .messages({
            'string.pattern.base': 'Birth date must be in YYYY-MM-DD format'
        }),
    age: Joi.number()
        .integer()
        .min(2)
        .max(99)
        .optional()
        .messages({
            'number.min': 'Age must be between 2 and 99 years',
            'number.max': 'Age must be between 2 and 99 years'
        }),
    phone: Joi.string()
        .pattern(/^[+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/)
        .required()
        .messages({
            'string.pattern.base': 'Phone must be a valid phone number',
            'any.required': 'Phone is required'
        }),
    email: Joi.string()
        .email()
        .optional()
        .allow('')
        .messages({
            'string.email': 'Email must be a valid email address'
        }),
    address: Joi.string()
        .max(500)
        .optional()
        .allow('')
        .messages({
            'string.max': 'Address must not exceed 500 characters'
        })
});

// ── ST-04: Observable fetus-array data validation schemas ─────────────────────

/**
 * Observable sub-schema — a single measurement with optional percentile and GA.
 * value may be a number (most measurements) or a string (free-text: vp, la, ducVen).
 */
const observableSchema = Joi.object({
    type: Joi.string().required(),
    value: Joi.alternatives().try(
        Joi.number(),
        Joi.string().allow('')
    ).required(),
    isManual: Joi.boolean().optional(),
    percentile: Joi.object({
        value: Joi.number().integer().min(1).max(99).required(),
        isManual: Joi.boolean().optional()
    }).optional(),
    ga: Joi.object({
        value: Joi.string().pattern(GA_REGEX).required()
            .messages({ 'string.pattern.base': 'GA must be in format "Xw Yd"' }),
        isManual: Joi.boolean().optional()
    }).optional()
}).optional();

/**
 * GaFromBiometry sub-schema — fetus-level composite GA.
 */
const gaFromBiometrySchema = Joi.object({
    value: Joi.string().pattern(GA_REGEX).required()
        .messages({ 'string.pattern.base': 'GA from biometry must be in format "Xw Yd"' }),
    isManual: Joi.boolean().optional()
}).optional();

/**
 * Fetus section sub-schema — one entry per fetus in data.fetuses[].
 */
const fetusSectionSchema = Joi.object({
    index: Joi.number().integer().min(0).required(),
    gaFromBiometry: gaFromBiometrySchema,
    biometry:  Joi.array().items(observableSchema).optional(),
    doppler:   Joi.array().items(observableSchema).optional(),
    ultrasoundFindings: Joi.object().optional(),
    anatomy:   Joi.object().optional(),
    markers:   Joi.object().optional()
}).optional();

/**
 * ST-04: Examination data sub-schema — replaces all legacy ft_* / twin2_* schemas.
 * All measurement data now lives inside fetuses[].
 */
const examinationDataSchema = Joi.object({
    pregnancyData: Joi.object({
        lastMenstrualPeriod: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional().allow('')
            .messages({ 'string.pattern.base': 'LMP must be in YYYY-MM-DD format' }),
        obstetricHistory: Joi.string().max(500).optional().allow(''),
        familyHistory:    Joi.string().max(500).optional().allow('')
    }).optional(),
    comments: Joi.string().max(5000).optional().allow(''),
    fetuses: Joi.array().items(fetusSectionSchema).min(1).required()
}).optional();

/**
 * Examination validation schema
 * ST-04: Removed top-level biometry/doppler/biometry2/doppler2/gestationalAgeFromBiometry* fields.
 *        All measurement data now lives inside data.fetuses[].
 */
const examinationSchema = Joi.object({
    mrn: Joi.forbidden()
        .messages({
            'any.unknown': 'MRN is assigned by the system and cannot be provided'
        }),
    patientId: Joi.string()
        .required()
        .messages({
            'any.required': 'Patient ID is required'
        }),
    examDate: Joi.date()
        .max('now')
        .required()
        .messages({
            'date.max': 'Exam date cannot be in the future',
            'any.required': 'Exam date is required'
        }),
    gestationalAge: Joi.string()
        .pattern(GA_REGEX)
        .optional()
        .allow('')
        .messages({
            'string.pattern.base': 'Gestational age must be in format "28w 3d" or "28с 3д"'
        }),
    gestationalAgeIsManual: Joi.boolean().optional(),
    status: Joi.string()
        .valid('draft', 'completed', 'reviewed')
        .required()
        .messages({
            'any.only': 'Status must be one of: draft, completed, reviewed',
            'any.required': 'Status is required'
        }),
    examinationType: Joi.string().valid(...EXAM_TYPE_KEYS).optional().allow(''),
    notes: Joi.string()
        .max(5000)
        .optional()
        .allow('')
        .messages({
            'string.max': 'Notes must not exceed 5000 characters'
        }),
    findings: Joi.string()
        .max(5000)
        .optional()
        .allow('')
        .messages({
            'string.max': 'Findings must not exceed 5000 characters'
        }),
    data: examinationDataSchema,
    patientAgeAtExam: Joi.number().integer().min(2).max(99).optional()
});

/**
 * Validate user data (admin-facing — role is required).
 * Used by CreateUser when an admin creates a new user with an explicit role.
 * @param data - User data to validate
 * @returns ValidationResult
 */
export const validateUser = (data: any): ValidationResult => {
    const result = userSchema.validate(data, { abortEarly: false });
    
    if (result.error) {
        return {
            valid: false,
            errors: result.error.details.map(detail => detail.message)
        };
    }

    return { valid: true, errors: [] };
};

/**
 * Validate self-registration data (role is optional — first user gets 'admin' forced by server;
 * subsequent users must supply a valid role, but that is checked programmatically in Register.ts
 * after the isFirstUser determination so the schema itself does not require it).
 * @param data - Registration data to validate
 * @returns ValidationResult
 */
export const validateRegister = (data: any): ValidationResult => {
    const result = registerSchema.validate(data, { abortEarly: false });

    if (result.error) {
        return {
            valid: false,
            errors: result.error.details.map(detail => detail.message)
        };
    }

    return { valid: true, errors: [] };
};

/**
 * Validate patient data
 * @param data - Patient data to validate
 * @returns ValidationResult
 */
export const validatePatient = (data: any): ValidationResult => {
    const result = patientSchema.validate(data, { abortEarly: false });
    
    if (result.error) {
        return {
            valid: false,
            errors: result.error.details.map(detail => detail.message)
        };
    }

    return { valid: true, errors: [] };
};

/**
 * Validate examination data
 * @param data - Examination data to validate
 * @returns ValidationResult
 */
export const validateExamination = (data: any): ValidationResult => {
    const result = examinationSchema.validate(data, { abortEarly: false });
    
    if (result.error) {
        return {
            valid: false,
            errors: result.error.details.map(detail => detail.message)
        };
    }

    return { valid: true, errors: [] };
};

/**
 * Validate login credentials
 * @param data - Login data to validate
 * @returns ValidationResult
 */
export const validateLogin = (data: any): ValidationResult => {
    const loginSchema = Joi.object({
        username: Joi.string().required().messages({
            'any.required': 'Username is required'
        }),
        password: Joi.string().required().messages({
            'any.required': 'Password is required'
        })
    });

    const result = loginSchema.validate(data, { abortEarly: false });
    
    if (result.error) {
        return {
            valid: false,
            errors: result.error.details.map(detail => detail.message)
        };
    }

    return { valid: true, errors: [] };
};

// Made with Bob
