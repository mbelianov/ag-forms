/**
 * viewModelBuilders.ts — ST-08 rewrite.
 * Replaces flat-field twin/FT model with fetuses-array model.
 * buildViewModel iterates exam.data.fetuses[] and builds FetusPdfViewModel[].
 * Header title uses type + fetus count composite (§13.5).
 * Dagger footnote is always statically appended — no conditional flag scanning.
 */
import {
  calcEDD,
  fmtBiometry,
} from '../utils/calculations';
import { EXAM_TYPE_CONFIG } from '../constants/examinationTypes';
import type { Examination, Observable, FetusSectionData } from '../types';
import type { ExamPdfViewModel, FetusPdfViewModel, ObservablePdfEntry } from './print.service';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function withManualMarker(value: string | undefined, isManual?: boolean): string | undefined {
  if (!value) return value;
  return isManual ? `${value} †` : value;
}

function pctStr(pct: number | undefined, isManual?: boolean): string | undefined {
  if (pct === undefined) return undefined;
  return withManualMarker(`${pct} %-ile`, isManual);
}

// ─── Static citation notes ────────────────────────────────────────────────────

const PRENATAL_BIOMETRY_CITATIONS =
  '1. Hadlock FP, Deter RL, Harrist RB, Park SK. Radiology. 1984;152(2):497–501. PMID 6739822. ' +
  '(GA from BPD, HC, AC, FL — direct regression)\n' +
  '2. Hadlock FP, Deter RL, Harrist RB, Park SK. Obstet Gynecol. 1984;63(4):457–65. ' +
  '(BPD, HC, AC, FL, OFD percentile reference ranges)\n' +
  '3. Hadlock FP, et al. Am J Obstet Gynecol. 1985;150(5):535–40. (EFW formula)\n' +
  '4. Hadlock FP, et al. Am J Obstet Gynecol. 1985;151(7):333–7. (Composite GA from BPD+HC+AC+FL)\n' +
  '5. Combs CA, et al. Am J Obstet Gynecol. 1993;169(4):775–83. (EFW percentile and GA from EFW)\n' +
  '6. Chang CH, Chang FM, Yu CH, et al. Ultrasound Med Biol. 2000;26(3):341–7. PMID 10722905. (TCD percentile and GA from TCD)';

const FT_BIOMETRY_CITATIONS =
  '1. Robinson HP. Br Med J. 1975;4(5986):28–31. PMID 1182090. (GA from CRL)';

// ─── OBSERVABLE_PDF_META ──────────────────────────────────────────────────────
// Maps type key → { label with unit } for PDF row rendering.
// Covers all observable types from §14.3 for both exam types.

const OBSERVABLE_PDF_META: Record<string, { label: string }> = {
  // Prenatal biometry
  bpd:       { label: 'BPD (mm)' },
  ofd:       { label: 'OFD (mm)' },
  hc:        { label: 'HC (mm)' },
  tad:       { label: 'TAD (mm)' },
  apad:      { label: 'APAD (mm)' },
  ac:        { label: 'AC (mm)' },
  fl:        { label: 'FL (mm)' },
  efw:       { label: 'EFW (grams)' },
  tcd:       { label: 'TCD (mm)' },
  vp:        { label: 'Vp' },
  cm:        { label: 'CM (mm)' },
  nuchalFold: { label: 'NF (mm)' },
  nb:        { label: 'NB (mm)' },
  la:        { label: 'LA' },
  lc:        { label: 'LC (mm)' },
  // Prenatal doppler
  pi:        { label: 'PI (Umb.)' },
  ri:        { label: 'RI (Umb.)' },
  utADexPI:  { label: 'A.ut.Dex PI' },
  utADexRI:  { label: 'A.ut.Dex RI' },
  utASinPI:  { label: 'A.ut.Sin PI' },
  utASinRI:  { label: 'A.ut.Sin RI' },
  cma:       { label: 'CMA PI' },
  psv:       { label: 'PSV' },
  cpr:       { label: 'CPR' },
  ducVen:    { label: 'Duc. Ven.' },
  // First trimester biometry
  crl:       { label: 'CRL (mm)' },
  nt:        { label: 'NT (mm)' },
  puls:      { label: 'Heart Rate (bpm)' },
};

// ─── Fetus observable serializer ─────────────────────────────────────────────

function fmtObservableValue(obs: Observable): string {
  const val = obs.value;
  if (val === undefined || val === null || val === '') return '—';
  if (typeof val === 'string') return val;
  // EFW in grams — no unit appended (label already says "grams")
  if (obs.type === 'efw') return `${fmtBiometry(val)} g`;
  // Heart rate, dimensionless doppler — no unit appended
  if (['pi', 'ri', 'utADexPI', 'utADexRI', 'utASinPI', 'utASinRI',
       'cma', 'psv', 'cpr', 'puls'].includes(obs.type)) {
    return typeof val === 'number' ? val.toFixed(2) : String(val);
  }
  // Free-text (vp, la, ducVen)
  if (['vp', 'la', 'ducVen'].includes(obs.type)) return String(val);
  // Default mm measurements
  return `${fmtBiometry(Number(val))} mm`;
}

function buildObservablePdfEntry(obs: Observable): ObservablePdfEntry {
  const meta = OBSERVABLE_PDF_META[obs.type] ?? { label: obs.type };
  return {
    type: obs.type,
    label: meta.label,
    value: fmtObservableValue(obs),
    percentile: pctStr(obs.percentile?.value, obs.percentile?.isManual),
    ga: obs.ga?.value
      ? withManualMarker(obs.ga.value, obs.ga.isManual)
      : undefined,
  };
}

function buildFetusPdfViewModel(
  fetus: FetusSectionData,
  examType: string,
): FetusPdfViewModel {
  const config = EXAM_TYPE_CONFIG[examType] ?? EXAM_TYPE_CONFIG['prenatal'];
  const result: FetusPdfViewModel = {
    index: fetus.index,
    biometry: (fetus.biometry ?? []).map(buildObservablePdfEntry),
    doppler: (fetus.doppler ?? []).map(buildObservablePdfEntry),
  };

  // Ultrasound findings — config-driven
  const uf = fetus.ultrasoundFindings;
  if (uf) {
    const ufResult: Record<string, string | undefined> = {};
    for (const tc of config.ultrasoundFindingTypes) {
      const raw = uf[tc.key];
      if (raw != null && raw !== '') {
        const opt = tc.options?.find(o => o.value === raw);
        if (opt) {
          ufResult[tc.key] = opt.label;
        } else {
          const s = String(raw);
          const capitalized = s.charAt(0).toUpperCase() + s.slice(1);
          ufResult[tc.key] = tc.unit && !s.includes(tc.unit) ? `${capitalized} ${tc.unit}` : capitalized;
        }
      } else {
        ufResult[tc.key] = undefined;
      }
    }
    // Set explicit named aliases
    ufResult.heartRate = ufResult['heart_rate'];
    ufResult.fetalMovement = ufResult['fetal_movement'];
    ufResult.umbilicalCord = ufResult['umbilical_cord'];
    result.ultrasound = ufResult as FetusPdfViewModel['ultrasound'];
  }

  // Anatomy — config-driven
  const an = fetus.anatomy;
  if (an) {
    const anResult: Record<string, string | undefined> = {};
    for (const tc of config.anatomyTypes) {
      const raw = an[tc.key];
      anResult[tc.key] = raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : undefined;
    }
    result.anatomy = anResult as FetusPdfViewModel['anatomy'];
  }

  // Markers — config-driven (KI-011 fix)
  if (config.markerTypes.length > 0 && fetus.markers) {
    const mk = fetus.markers;
    const mkResult: Record<string, string | undefined> = {};
    for (const mt of config.markerTypes) {
      const val = mk[mt.key];
      if (mt.inputType === 'boolean') {
        mkResult[mt.key] = val === 'yes' || val === 'true' ? 'Yes' : val === 'no' || val === 'false' ? 'No' : val;
      } else {
        mkResult[mt.key] = val || undefined;
      }
    }
    result.markers = mkResult as FetusPdfViewModel['markers'];
  }

  // GA from biometry composite
  if (fetus.gaFromBiometry?.value) {
    result.gaFromBiometry = withManualMarker(
      fetus.gaFromBiometry.value,
      fetus.gaFromBiometry.isManual,
    );
  }

  return result;
}

// ─── Build view model ─────────────────────────────────────────────────────────

export function buildViewModel(exam: Examination): ExamPdfViewModel {
  const lmp = exam.data?.pregnancyData?.lastMenstrualPeriod;
  const examType = exam.examinationType ?? 'prenatal';
  const isFt = examType === 'first_trimester';
  const fetuses = exam.data?.fetuses ?? [];

  // Notes: citations + always-static dagger footnote (§13.4 R-11)
  const citations = isFt ? FT_BIOMETRY_CITATIONS : PRENATAL_BIOMETRY_CITATIONS;
  const notes = `${citations}\n† Value manually entered`;

  return {
    patientName: exam.patientName,
    mrn: exam.mrn,
    examDate: fmtDate(exam.examDate),
    status: exam.status.charAt(0).toUpperCase() + exam.status.slice(1),
    examinationType: exam.examinationType,
    patientAgeAtExam: exam.patientAgeAtExam,

    gestationalAge: withManualMarker(exam.gestationalAge, exam.gestationalAgeIsManual),
    expectedDeliveryDate: lmp ? calcEDD(lmp) : undefined,

    fetuses: fetuses.map(f => buildFetusPdfViewModel(f, examType)),

    pregnancy: {
      lmp: lmp ? fmtDate(lmp) : undefined,
      obstetricHistory: exam.data?.pregnancyData?.obstetricHistory,
      familyHistory: exam.data?.pregnancyData?.familyHistory,
    },

    findings: exam.findings,
    notes,
    comments: exam.data?.comments,
    createdBy: exam.createdByName ?? exam.createdBy,
    createdAt: new Date(exam.createdAt).toLocaleString('en-GB'),
  };
}

// Made with Bob
