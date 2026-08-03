/**
 * Canonical examination type registry — frontend mirror of api/src/constants/examinationTypes.ts.
 * This is the single source of truth for examination type keys and labels on the frontend.
 */

export const EXAM_TYPES: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'ultrasound_prenatal', label: 'Ultrasound Prenatal Exam' },
  { key: 'ultrasound_prenatal_twins', label: 'Ultrasound Prenatal Exam for Twins' },
  { key: 'ultrasound_first_trimester', label: 'Ultrasound Exam First Trimester' },
  { key: 'ultrasound_first_trimester_twins', label: 'Ultrasound Exam First Trimester for Twins' },
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
    firstTrimester:     false,
  },
  ultrasound_prenatal_twins: {
    pregnancyData:      true,
    ultrasoundFindings: true,
    anatomy:            true,
    biometry:           true,
    doppler:            true,
    firstTrimester:     false,
  },
  ultrasound_first_trimester: {
    pregnancyData:      true,
    ultrasoundFindings: false,  // replaced by ft_ultrasound inside FirstTrimesterSection
    anatomy:            false,  // rendered inside FirstTrimesterSection
    biometry:           false,  // replaced by ft_biometry inside FirstTrimesterSection
    doppler:            false,  // replaced by ft_doppler inside FirstTrimesterSection
    firstTrimester:     true,   // triggers FT rendering path
  },
  ultrasound_first_trimester_twins: {
    pregnancyData:      true,
    ultrasoundFindings: false,
    anatomy:            false,
    biometry:           false,
    doppler:            false,
    firstTrimester:     true,
  },
};

/** Returns the visibility map for the given examination type.
 *  Falls back to 'ultrasound_prenatal' for unknown or undefined types. */
export function getSectionVisibility(type: string | undefined): Record<string, boolean> {
  return SECTION_VISIBILITY[type ?? ''] ?? SECTION_VISIBILITY['ultrasound_prenatal'];
}

/** Returns true when the exam type is first-trimester (single or twins). */
export function isFirstTrimester(type: string | undefined): boolean {
  return (type ?? '').startsWith('ultrasound_first_trimester');
}

/** Returns true when the exam type is first-trimester twins. */
export function isFtTwins(type: string | undefined): boolean {
  return type === 'ultrasound_first_trimester_twins';
}

// Made with Bob
