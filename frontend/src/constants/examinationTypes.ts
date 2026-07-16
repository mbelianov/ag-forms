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

// ── Section visibility map keyed by examinationType ───────────────────────────
// Add a new entry here when registering a new examination type.
// Without an entry the fallback to 'ultrasound_prenatal' silently applies.
export const SECTION_VISIBILITY: Record<string, Record<string, boolean>> = {
  ultrasound_prenatal: {
    pregnancyData:      true,
    ultrasoundFindings: true,
    anatomy:            true,
    biometry:           true,
    doppler:            true,
  },
};

/** Returns the visibility map for the given examination type.
 *  Falls back to 'ultrasound_prenatal' for unknown or undefined types. */
export function getSectionVisibility(type: string | undefined): Record<string, boolean> {
  return SECTION_VISIBILITY[type ?? ''] ?? SECTION_VISIBILITY['ultrasound_prenatal'];
}

// Made with Bob
