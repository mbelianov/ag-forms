/**
 * Form-layer data types for the examination form (ST-05).
 *
 * The form state is layered:
 *   Storage (Observable[]) ←→ Form State (ObservableFormMap) ←→ UI inputs (strings)
 *
 * AutoCalcValue<T> wraps any field that can be auto-calculated or manually overridden.
 * ObservableFormFieldState holds one measurement row's form state.
 * FetusSectionFormData holds all per-fetus form state.
 * ExaminationFormData is the top-level form state object.
 */

/**
 * Generic Value Object: a value (string for controlled inputs) plus a manual-override flag.
 * isManual is always an explicit boolean in form state (never undefined).
 */
export interface AutoCalcValue<T = string> {
  value: T;
  isManual?: boolean;
}

/** Factory for concise AutoCalcValue construction. */
export function autoCalc<T = string>(value: T, isManual?: boolean): AutoCalcValue<T> {
  const result: AutoCalcValue<T> = { value };
  if (isManual !== undefined) {
    result.isManual = isManual;
  }
  return result;
}

/** Form state for a single observable measurement row. */
export interface ObservableFormFieldState {
  value: AutoCalcValue<string>;       // the measurement value (string for input binding)
  percentile?: AutoCalcValue<string>; // auto-calculated or manually overridden percentile
  ga?: AutoCalcValue<string>;         // auto-calculated or manually overridden per-measurement GA
}

/** A map of type-string → form field state for all observables in a section. */
export type ObservableFormMap = Record<string, ObservableFormFieldState>;

// ── Descriptive section form data types ──────────────────────────────────────

export interface UltrasoundFindingsFormData {
  presentation?: string;
  gender?: string;
  heart_rate?: string;
  fetal_movement?: string;
  placenta?: string;
  umbilical_cord?: string;
  [key: string]: string | undefined;
}

export interface AnatomyFormData {
  head?: string;
  brain?: string;
  heart?: string;
  abdomen?: string;
  kidneys?: string;
  limbs?: string;
  skeleton?: string;
  face?: string;
  neckSkin?: string;
  spine?: string;
  thorax?: string;
  [key: string]: string | undefined;
}

export interface MarkersFormData {
  arrhythmia?: string;
  tricuspidRegurgitation?: string;
  abnormalDvFlow?: string;
  echogenicCardiacFocus?: string;
  singleUmbilicalArtery?: string;
  choroidPlexusCysts?: string;
  exomphalos?: string;
  megacystis?: string;
  placenta?: string;
  cordInsertion?: string;
  [key: string]: string | undefined;
}

// ── Per-fetus form state ──────────────────────────────────────────────────────

export interface FetusSectionFormData {
  biometry: ObservableFormMap;
  doppler: ObservableFormMap;
  ultrasoundFindings: UltrasoundFindingsFormData;
  anatomy: AnatomyFormData;
  markers: MarkersFormData;  // first_trimester only — kept on all but ignored for prenatal
  gaFromBiometry: AutoCalcValue<string>; // composite GA from biometry
}

// ── Top-level form state ──────────────────────────────────────────────────────

export interface ExaminationFormData {
  patientId: string;
  examinationDate: string;       // YYYY-MM-DD
  examinationType: 'prenatal' | 'first_trimester';
  fetusCount: number;            // 1 to N (runtime state; not in EXAM_TYPE_CONFIG)
  last_menstrual_period: string; // YYYY-MM-DD
  gestationalAge: AutoCalcValue<string>; // GA from LMP
  clinicalNotes: string;
  recommendations: string;
  status: 'draft' | 'completed' | 'reviewed';
  findings: string;
  obstetric_history: string;
  family_history: string;
  comments: string;
  fetuses: FetusSectionFormData[];
}
