/**
 * Canonical examination type registry.
 * This is the single source of truth for valid examination type keys and labels on the backend.
 * Frontend mirror: frontend/src/constants/examinationTypes.ts
 */

export const EXAM_TYPES: ReadonlyArray<{ key: string; label: string }> = [
    { key: 'ultrasound_prenatal', label: 'Ultrasound Prenatal Exam' },
];

/** Derived array of valid key strings — use with Joi.valid(...EXAM_TYPE_KEYS) */
export const EXAM_TYPE_KEYS: string[] = EXAM_TYPES.map(t => t.key);

// Made with Bob
