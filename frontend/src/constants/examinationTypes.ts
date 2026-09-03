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
import type { ObservableTypeConfig, ExamTypeConfig, MarkerTypeConfig } from '../types';

// Re-export for convenience so callers can import from a single place
export type { ObservableTypeConfig, ExamTypeConfig, MarkerTypeConfig };

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
    markerTypes: [
      { key: 'arrhythmia',             label: 'Arrhythmia' },
      { key: 'tricuspidRegurgitation', label: 'Tricuspid Regurgitation' },
      { key: 'abnormalDvFlow',         label: 'Abnormal DV Flow' },
      { key: 'echogenicCardiacFocus',  label: 'Echogenic Cardiac Focus' },
      { key: 'singleUmbilicalArtery',  label: 'Single Umbilical Artery' },
      { key: 'choroidPlexusCysts',     label: 'Choroid Plexus Cysts' },
      { key: 'exomphalos',             label: 'Exomphalos' },
      { key: 'megacystis',             label: 'Megacystis' },
      { key: 'placenta',               label: 'Placenta' },
      { key: 'cordInsertion',          label: 'Cord Insertion' },
    ],
  },
};

// Made with Bob
