/**
 * Canonical examination type registry — frontend mirror of api/src/constants/examinationTypes.ts.
 * This is the single source of truth for examination type keys and labels on the frontend.
 */

export const EXAM_TYPES: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'ultrasound_prenatal', label: 'Ultrasound Prenatal Exam' },
];

/** Returns the human-readable label for a type key; falls back to the key itself. */
export function getExamTypeLabel(key: string): string {
  return EXAM_TYPES.find((t) => t.key === key)?.label ?? key;
}

// Made with Bob
