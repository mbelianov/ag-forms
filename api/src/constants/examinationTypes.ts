/**
 * Canonical examination type registry.
 * This is the single source of truth for valid examination type keys and labels on the backend.
 * Frontend mirror: frontend/src/constants/examinationTypes.ts
 *
 * ST-01: Labels aligned with frontend (identical strings).
 * ST-04: Reduced from 4 keys to 2 keys (prenatal, first_trimester).
 */

export const EXAM_TYPES: ReadonlyArray<{ key: string; label: string }> = [
    { key: 'prenatal',        label: 'Prenatal' },
    { key: 'first_trimester', label: 'First Trimester' },
];

/** Derived array of valid key strings — use with Joi.valid(...EXAM_TYPE_KEYS) */
export const EXAM_TYPE_KEYS: string[] = EXAM_TYPES.map(t => t.key);

// Made with Bob
