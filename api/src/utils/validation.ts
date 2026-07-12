/**
 * Validation Schemas
 * Input validation using Joi for all API endpoints
 */

import * as Joi from 'joi';
import { ValidationResult } from '../types';
import { EXAM_TYPE_KEYS } from '../constants/examinationTypes';

/**
 * User validation schema
 */
const userSchema = Joi.object({
    username: Joi.string()
        .min(3)
        .max(50)
        .pattern(/^[a-zA-Z0-9_-]+$/)
        .required()
        .messages({
            'string.min': 'Username must be at least 3 characters long',
            'string.max': 'Username must not exceed 50 characters',
            'string.pattern.base': 'Username can only contain letters, numbers, underscores, and hyphens',
            'any.required': 'Username is required'
        }),
    password: Joi.string()
        .min(12)
        .required()
        .messages({
            'string.min': 'Password must be at least 12 characters long',
            'any.required': 'Password is required'
        }),
    fullName: Joi.string()
        .min(2)
        .max(255)
        .optional()
        .messages({
            'string.min': 'Full name must be at least 2 characters long',
            'string.max': 'Full name must not exceed 255 characters'
        }),
    email: Joi.string()
        .email()
        .required()
        .messages({
            'string.email': 'Email must be a valid email address',
            'any.required': 'Email is required'
        }),
    role: Joi.string()
        .valid('admin', 'doctor', 'viewer')
        .required()
        .messages({
            'any.only': 'Role must be one of: admin, doctor, viewer',
            'any.required': 'Role is required'
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

/**
 * Biometry data validation schema
 * TASK-034/035: Extended biometry parameters added.
 */
const biometrySchema = Joi.object({
    bpd: Joi.number().integer().min(0).max(200).optional().messages({
        'number.base': 'BPD must be an integer',
        'number.min': 'BPD must be a positive value',
        'number.max': 'BPD value is out of valid range'
    }),
    hc: Joi.number().integer().min(0).max(500).optional().messages({
        'number.base': 'HC must be an integer',
        'number.min': 'HC must be a positive value',
        'number.max': 'HC value is out of valid range'
    }),
    ac: Joi.number().integer().min(0).max(500).optional().messages({
        'number.base': 'AC must be an integer',
        'number.min': 'AC must be a positive value',
        'number.max': 'AC value is out of valid range'
    }),
    fl: Joi.number().integer().min(0).max(100).optional().messages({
        'number.base': 'FL must be an integer',
        'number.min': 'FL must be a positive value',
        'number.max': 'FL value is out of valid range'
    }),
    efw: Joi.number().integer().min(0).max(10000).optional().messages({
        'number.base': 'EFW must be an integer',
        'number.min': 'EFW must be a positive value',
        'number.max': 'EFW value is out of valid range'
    }),
    // TASK-034: Extended biometry
    ofd: Joi.number().integer().min(0).max(200).optional().messages({ 'number.base': 'OFD must be an integer' }),
    vp:  Joi.number().integer().min(0).max(100).optional().messages({ 'number.base': 'Vp must be an integer' }),
    tcd: Joi.number().integer().min(0).max(100).optional().messages({ 'number.base': 'TCD must be an integer' }),
    cm:  Joi.number().integer().min(0).max(50).optional().messages({ 'number.base': 'CM must be an integer' }),
    nuchalFold: Joi.number().integer().min(0).max(30).optional().messages({ 'number.base': 'Nuchal Fold must be an integer' }),
    nb:  Joi.number().integer().min(0).max(30).optional().messages({ 'number.base': 'NB must be an integer' }),
    apad: Joi.number().integer().min(0).max(200).optional().messages({ 'number.base': 'APAD must be an integer' }),
    tad:  Joi.number().integer().min(0).max(200).optional().messages({ 'number.base': 'TAD must be an integer' }),
    // TASK-035: LA and LC
    la: Joi.number().integer().min(0).max(100).optional().messages({ 'number.base': 'LA must be an integer' }),
    lc: Joi.number().integer().min(0).max(100).optional().messages({ 'number.base': 'LC must be an integer' })
}).optional();

/**
 * Doppler data validation schema
 * TASK-036: Extended vascular parameters added.
 */
const dopplerSchema = Joi.object({
    pi: Joi.number().min(0).max(10).optional().messages({
        'number.min': 'PI must be a positive value',
        'number.max': 'PI value is out of valid range'
    }),
    ri: Joi.number().min(0).max(1).optional().messages({
        'number.min': 'RI must be a positive value',
        'number.max': 'RI must be between 0 and 1'
    }),
    vessel: Joi.string().max(100).optional().allow('').messages({
        'string.max': 'Vessel name must not exceed 100 characters'
    }),
    // TASK-036: Extended vascular parameters
    utADexPI: Joi.number().min(0).max(10).optional(),
    utADexRI: Joi.number().min(0).max(1).optional(),
    utASinPI: Joi.number().min(0).max(10).optional(),
    utASinRI: Joi.number().min(0).max(1).optional(),
    cma:      Joi.number().min(0).max(10).optional(),
    psv:      Joi.number().min(0).max(200).optional(),
    cpr:      Joi.number().min(0).max(10).optional(),
    ducVen:   Joi.string().max(200).optional().allow('')
}).optional();

/**
 * Pregnancy data sub-schema
 */
const pregnancyDataSchema = Joi.object({
    last_menstrual_period: Joi.string()
        .pattern(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .allow('')
        .messages({ 'string.pattern.base': 'LMP must be in YYYY-MM-DD format' }),
    obstetric_history: Joi.string().max(500).optional().allow(''),
    family_history: Joi.string().max(500).optional().allow('')
}).optional();

/**
 * Ultrasound findings sub-schema
 */
const ultrasoundFindingsSchema = Joi.object({
    presentation: Joi.string().max(100).optional().allow(''),
    gender: Joi.string().valid('male', 'female', 'unknown').optional().allow(''),
    heart_rate: Joi.number().integer().min(1).max(300).optional().messages({
        'number.min': 'Heart rate must be a positive value',
        'number.max': 'Heart rate value is out of valid range'
    }),
    fetal_movement: Joi.string().max(100).optional().allow(''),
    placenta: Joi.string().max(500).optional().allow(''),
    umbilical_cord: Joi.string().max(500).optional().allow('')
}).optional();

/**
 * Anatomy sub-schema
 * TASK-036: Extended anatomy fields added.
 */
const anatomySchema = Joi.object({
    head: Joi.string().max(500).optional().allow(''),
    brain: Joi.string().max(500).optional().allow(''),
    heart: Joi.string().max(500).optional().allow(''),
    abdomen: Joi.string().max(500).optional().allow(''),
    kidneys: Joi.string().max(500).optional().allow(''),
    limbs: Joi.string().max(500).optional().allow(''),
    skeleton: Joi.string().max(500).optional().allow(''),
    // TASK-036: Extended anatomy fields
    face:     Joi.string().max(500).optional().allow(''),
    neckSkin: Joi.string().max(500).optional().allow(''),
    spine:    Joi.string().max(500).optional().allow(''),
    thorax:   Joi.string().max(500).optional().allow('')
}).optional();

/**
 * Examination clinical data sub-schema
 */
const examinationDataSchema = Joi.object({
    pregnancy_data: pregnancyDataSchema,
    ultrasound_findings: ultrasoundFindingsSchema,
    anatomy: anatomySchema,
    comments: Joi.string().max(5000).optional().allow('')
}).optional();

/**
 * Examination validation schema
 * TASK-033: examinationType added.
 * TASK-037: patientAgeAtExam added.
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
        .pattern(/^\d{1,2}w\s?\d{1}d$/)
        .optional()
        .allow('')
        .messages({
            'string.pattern.base': 'Gestational age must be in format "28w 3d"'
        }),
    gestationalAgeFromBiometry: Joi.string()
        .pattern(/^\d{1,2}w\s?\d{1}d$/)
        .optional()
        .allow('')
        .messages({
            'string.pattern.base': 'Gestational age from biometry must be in format "28w 3d"'
        }),
    status: Joi.string()
        .valid('draft', 'completed', 'reviewed')
        .required()
        .messages({
            'any.only': 'Status must be one of: draft, completed, reviewed',
            'any.required': 'Status is required'
        }),
    examinationType: Joi.string().valid(...EXAM_TYPE_KEYS).optional().allow(''), // FLAG-03, REQ-01
    biometry: biometrySchema,
    doppler: dopplerSchema,
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
    patientAgeAtExam: Joi.number().integer().min(2).max(99).optional() // TASK-037
});

/**
 * Validate user data
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

/**
 * Validate partial update data (allows partial objects)
 * @param data - Data to validate
 * @param schema - Joi schema to use
 * @returns ValidationResult
 */
export const validatePartialUpdate = (data: any, schema: Joi.ObjectSchema): ValidationResult => {
    const result = schema.validate(data, { abortEarly: false, presence: 'optional' });
    
    if (result.error) {
        return {
            valid: false,
            errors: result.error.details.map(detail => detail.message)
        };
    }

    return { valid: true, errors: [] };
};

// Made with Bob
