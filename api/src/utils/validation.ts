/**
 * Validation Schemas
 * Input validation using Joi for all API endpoints
 */

import * as Joi from 'joi';
import { ValidationResult } from '../types';

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
    age: Joi.number()
        .integer()
        .min(2)
        .max(99)
        .required()
        .messages({
            'number.min': 'Age must be between 2 and 99 years',
            'number.max': 'Age must be between 2 and 99 years',
            'any.required': 'Age is required'
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
    })
}).optional();

/**
 * Doppler data validation schema
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
    vessel: Joi.string().max(100).optional().messages({
        'string.max': 'Vessel name must not exceed 100 characters'
    })
}).optional();

/**
 * Examination validation schema
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
    status: Joi.string()
        .valid('draft', 'completed', 'reviewed')
        .required()
        .messages({
            'any.only': 'Status must be one of: draft, completed, reviewed',
            'any.required': 'Status is required'
        }),
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
        })
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
