/**
 * Canonical examination type registry — frontend mirror of api/src/constants/examinationTypes.ts.
 * ST-06: Replaced SECTION_VISIBILITY / getSectionVisibility / isFirstTrimester / isFtTwins
 *        with EXAM_TYPE_CONFIG (2 entries) carrying full ObservableTypeConfig metadata.
 *        fetusSectionCount is NOT here — it is runtime state in ExaminationFormData.
 *
 * NOTE: ObservableTypeConfig and ExamTypeConfig interfaces are defined in ../types/index.ts
 *       to avoid a circular dependency with observableRegistry.ts.
 */
import { enrichTypeConfig } from '../utils/observableRegistry';
import type { ObservableTypeConfig, ExamTypeConfig, MarkerTypeConfig, DescriptorTypeConfig, DescriptorOption } from '../types';

// Re-export for convenience so callers can import from a single place
export type { ObservableTypeConfig, ExamTypeConfig, MarkerTypeConfig, DescriptorTypeConfig, DescriptorOption };

// ── Examination type list (2 entries) ─────────────────────────────────────────

export const EXAM_TYPES: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'prenatal',        label: 'Prenatal' },
  { key: 'first_trimester', label: 'First Trimester' },
];

/** Derive the set of valid type keys. */
export const EXAM_TYPE_KEYS: ReadonlyArray<string> = EXAM_TYPES.map(t => t.key);

/** Returns the human-readable label for a type key; falls back to the key itself. */
export function getExamTypeLabel(key: string): string {
  return EXAM_TYPE_CONFIG[key]?.label ?? key;
}

// ── Shared Descriptor Configurations ──────────────────────────────────────────

export const COMMON_ANATOMY_CONFIG: readonly DescriptorTypeConfig[] = [
  { key: 'head',     label: 'Head',       inputType: 'text' },
  { key: 'brain',    label: 'Brain',      inputType: 'text' },
  { key: 'heart',    label: 'Heart',      inputType: 'text' },
  { key: 'abdomen',  label: 'Abdomen',    inputType: 'text' },
  { key: 'kidneys',  label: 'Kidneys',    inputType: 'text' },
  { key: 'limbs',    label: 'Limbs',      inputType: 'text' },
  { key: 'skeleton', label: 'Skeleton',   inputType: 'text' },
  { key: 'face',     label: 'Face',       inputType: 'text' },
  { key: 'neckSkin', label: 'Neck/Skin',  inputType: 'text' },
  { key: 'spine',    label: 'Spine',      inputType: 'text' },
  { key: 'thorax',   label: 'Thorax',     inputType: 'text' },
];

export const PRENATAL_UF_CONFIG: readonly DescriptorTypeConfig[] = [
  {
    key: 'presentation',
    label: 'Presentation',
    inputType: 'select',
    options: [
      { value: 'cephalic',   label: 'Cephalic' },
      { value: 'breech',     label: 'Breech' },
      { value: 'transverse', label: 'Transverse' },
      { value: 'oblique',    label: 'Oblique' },
    ],
  },
  {
    key: 'gender',
    label: 'Gender',
    inputType: 'select',
    options: [
      { value: 'male',    label: 'Male' },
      { value: 'female',  label: 'Female' },
      { value: 'unknown', label: 'Unknown' },
    ],
  },
  {
    key: 'heart_rate',
    label: 'FHR',
    inputType: 'text',
    unit: 'bpm',
    placeholder: 'e.g. 145',
  },
  {
    key: 'fetal_movement',
    label: 'Fetal Movement',
    inputType: 'select',
    options: [
      { value: 'active',  label: 'Active' },
      { value: 'present', label: 'Present' },
      { value: 'reduced', label: 'Reduced' },
      { value: 'absent',  label: 'Absent' },
    ],
  },
  {
    key: 'placenta',
    label: 'Placenta',
    inputType: 'text',
  },
  {
    key: 'umbilical_cord',
    label: 'Umbilical Cord',
    inputType: 'text',
  },
];

export const FT_UF_CONFIG: readonly DescriptorTypeConfig[] = [
  {
    key: 'placenta',
    label: 'Placenta',
    inputType: 'text',
  },
  {
    key: 'heart_rate',
    label: 'FHR',
    inputType: 'text',
    unit: 'bpm',
    placeholder: 'e.g. 160',
  },
  {
    key: 'umbilical_cord',
    label: 'Umbilical Cord',
    inputType: 'text',
  },
];

// ── EXAM_TYPE_CONFIG ───────────────────────────────────────────────────────────

export const EXAM_TYPE_CONFIG: Record<string, ExamTypeConfig> = {
  prenatal: {
    label: 'Prenatal',
    trimester: 'second',
    biometryTypes: [
      enrichTypeConfig({ type: 'bpd',        label: 'BPD',         unit: 'mm', hasPercentile: true,  hasGa: true  }),
      enrichTypeConfig({ type: 'ofd',        label: 'OFD',         unit: 'mm', hasPercentile: true,  hasGa: true  }),
      enrichTypeConfig({ type: 'hc',         label: 'HC',          unit: 'mm', hasPercentile: true,  hasGa: true  }),
      enrichTypeConfig({ type: 'tad',        label: 'TAD',         unit: 'mm', hasPercentile: true,  hasGa: true }),
      enrichTypeConfig({ type: 'apad',       label: 'APAD',        unit: 'mm', hasPercentile: true,  hasGa: true }),
      enrichTypeConfig({ type: 'ac',         label: 'AC',          unit: 'mm', hasPercentile: true,  hasGa: true  }),
      enrichTypeConfig({ type: 'fl',         label: 'FL',          unit: 'mm', hasPercentile: true,  hasGa: true  }),
      enrichTypeConfig({ type: 'efw',        label: 'EFW',         unit: 'g',  hasPercentile: true,  hasGa: true  }),
      enrichTypeConfig({ type: 'tcd',        label: 'TCD',         unit: 'mm', hasPercentile: true,  hasGa: true  }),
      enrichTypeConfig({ type: 'vp',         label: 'Vp',          unit: '',   hasPercentile: false, hasGa: false }),
      enrichTypeConfig({ type: 'cm',         label: 'CM',          unit: 'mm', hasPercentile: false, hasGa: false }),
      enrichTypeConfig({ type: 'nuchalFold', label: 'NF',          unit: 'mm', hasPercentile: false, hasGa: false }),
      enrichTypeConfig({ type: 'nb',         label: 'NB',          unit: 'mm', hasPercentile: false, hasGa: false }),
      enrichTypeConfig({ type: 'la',         label: 'LA',          unit: '',   hasPercentile: false, hasGa: false }),
      enrichTypeConfig({ type: 'lc',         label: 'LC',          unit: 'mm', hasPercentile: false, hasGa: false }),
    ],
    dopplerVessels: [
      enrichTypeConfig({ type: 'utADexPI', label: 'A.ut.Dex PI', unit: '', hasPercentile: false, hasGa: false }),
      enrichTypeConfig({ type: 'utADexRI', label: 'A.ut.Dex RI', unit: '', hasPercentile: false, hasGa: false }),
      enrichTypeConfig({ type: 'utASinPI', label: 'A.ut.Sin PI', unit: '', hasPercentile: false, hasGa: false }),
      enrichTypeConfig({ type: 'utASinRI', label: 'A.ut.Sin RI', unit: '', hasPercentile: false, hasGa: false }),
      enrichTypeConfig({ type: 'pi',       label: 'A.Umb. PI',   unit: '', hasPercentile: false, hasGa: false }),
      enrichTypeConfig({ type: 'ri',       label: 'A.Umb. RI',   unit: '', hasPercentile: false, hasGa: false }),
    ],
    dopplerSingle: [
      enrichTypeConfig({ type: 'cma',    label: 'CMA PI',    unit: '', hasPercentile: false, hasGa: false }),
      enrichTypeConfig({ type: 'psv',    label: 'PSV',       unit: '', hasPercentile: false, hasGa: false }),
      enrichTypeConfig({ type: 'cpr',    label: 'CPR',       unit: '', hasPercentile: false, hasGa: false }),
      enrichTypeConfig({ type: 'ducVen', label: 'Duc. Ven.', unit: '', hasPercentile: false, hasGa: false }),
    ],
    ultrasoundFindingTypes: PRENATAL_UF_CONFIG,
    anatomyTypes: COMMON_ANATOMY_CONFIG,
    markerTypes: [],
  },

  first_trimester: {
    label: 'First Trimester',
    trimester: 'first',
    biometryTypes: [
      enrichTypeConfig({ type: 'crl',  label: 'CRL',        unit: 'mm',  hasPercentile: false, hasGa: true  }),
      enrichTypeConfig({ type: 'nt',   label: 'NT',         unit: 'mm',  hasPercentile: false, hasGa: false }),
      enrichTypeConfig({ type: 'nb',   label: 'NB',         unit: 'mm',  hasPercentile: false, hasGa: false }),
      enrichTypeConfig({ type: 'puls', label: 'Heart Rate', unit: 'bpm', hasPercentile: false, hasGa: false }),
    ],
    dopplerVessels: [
      enrichTypeConfig({ type: 'utADexPI', label: 'A.ut.Dex PI', unit: '', hasPercentile: false, hasGa: false }),
      enrichTypeConfig({ type: 'utADexRI', label: 'A.ut.Dex RI', unit: '', hasPercentile: false, hasGa: false }),
      enrichTypeConfig({ type: 'utASinPI', label: 'A.ut.Sin PI', unit: '', hasPercentile: false, hasGa: false }),
      enrichTypeConfig({ type: 'utASinRI', label: 'A.ut.Sin RI', unit: '', hasPercentile: false, hasGa: false }),
    ],
    dopplerSingle: [],
    ultrasoundFindingTypes: FT_UF_CONFIG,
    anatomyTypes: COMMON_ANATOMY_CONFIG,
    markerTypes: [
      { key: 'arrhythmia',             label: 'Arrhythmia',              inputType: 'boolean' as const },
      { key: 'tricuspidRegurgitation', label: 'Tricuspid Regurgitation', inputType: 'boolean' as const },
      { key: 'abnormalDvFlow',         label: 'Abnormal DV Flow',        inputType: 'boolean' as const },
      { key: 'echogenicCardiacFocus',  label: 'Echogenic Cardiac Focus', inputType: 'boolean' as const },
      { key: 'singleUmbilicalArtery',  label: 'Single Umbilical Artery', inputType: 'boolean' as const },
      { key: 'choroidPlexusCysts',     label: 'Choroid Plexus Cysts',    inputType: 'boolean' as const },
      { key: 'exomphalos',             label: 'Exomphalos',              inputType: 'boolean' as const },
      { key: 'megacystis',             label: 'Megacystis',              inputType: 'boolean' as const },
      { key: 'placenta',               label: 'Placenta',                inputType: 'text'    as const },
      { key: 'cordInsertion',          label: 'Cord Insertion',          inputType: 'text'    as const },
    ],
  },
};

// Made with Bob
