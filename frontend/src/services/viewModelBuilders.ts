/**
 * viewModelBuilders.ts — extracted from print.service.ts (Sub-Task 0d).
 * Contains buildViewModel and its helpers (fmtDate, withPct, pctStr).
 * print.service.ts imports buildViewModel from here.
 *
 * KI-009: Percentile and GA-from-measurement values are now sourced from stored exam data.
 * calcBiometryPercentiles and calcEFWPercentile are no longer called from this file.
 */
import {
  calcEDD,
  fmtBiometry,
} from '../utils/calculations';
import { isFirstTrimester, isFtTwins } from '../constants/examinationTypes';
import type { Examination } from '../types';
import type { ExamPdfViewModel, FtBiometryViewModel, FtMarkersViewModel, FtUltrasoundViewModel, FtDopplerViewModel } from './print.service';
import type { AnatomyViewModel } from './print.service';

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

function withPct(value: number): string {
  // withPct now returns just the value (no inline percentile) —
  // the row-by-row biometry renderer places percentile in its own column.
  return `${fmtBiometry(value)} mm`;
}

function withManualMarker(value: string | undefined, isManual?: boolean): string | undefined {
  if (!value) {
    return value;
  }

  return isManual ? `${value} †` : value;
}

/** Returns a "N %-ile" percentile string (e.g. "45 %-ile") or undefined when pct is absent. */
function pctStr(pct: number | undefined, isManual?: boolean): string | undefined {
  if (pct === undefined) {
    return undefined;
  }

  return withManualMarker(`${pct} %-ile`, isManual);
}

// ─── KI-009: Biometric citation constants ────────────────────────────────────
// Static small-print citations appended to the PDF Notes section.
// Prenatal exams use PRENATAL_BIOMETRY_CITATIONS; FT exams use FT_BIOMETRY_CITATIONS.

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
  '7. Robinson HP. Br Med J. 1975;4(5986):28–31. PMID 1182090. (GA from CRL)';

// ─── Build view model ─────────────────────────────────────────────────────────

export function buildViewModel(exam: Examination): ExamPdfViewModel {
  const lmp = exam.data?.pregnancy_data?.last_menstrual_period;

  // KI-009: Percentiles sourced from stored exam data — no client-side recomputation
  // uzd-twins / UZPT detection
  const isTwins = exam.examinationType === 'ultrasound_prenatal_twins';
  const isFt = isFirstTrimester(exam.examinationType);
  const isFtTwinsExam = isFtTwins(exam.examinationType);

  // ── FT view model helpers ────────────────────────────────────────────────────
  const buildFtBiometry = (b: typeof exam.data.ft_biometry): FtBiometryViewModel | undefined => {
    if (!b) return undefined;
    return {
      crl:       b.crl  != null ? `${b.crl.toFixed(2)} mm` : undefined,
      // KI-009: prefer stored gaFromBio; fallback to gaFromCrl for backward compat
      // Sub-Task 5: use gaFromBioIsManual (with fallback to gaFromCrlIsManual for older records)
      gaFromCrl: withManualMarker(b.gaFromBio ?? b.gaFromCrl ?? undefined, b.gaFromBioIsManual ?? b.gaFromCrlIsManual),
      nt:        b.nt   != null ? `${b.nt.toFixed(2)} mm` : undefined,
      nb:        b.nb   != null ? `${b.nb.toFixed(2)} mm` : undefined,
      puls:      b.puls != null ? `${b.puls} bpm` : undefined,
      // Sub-Task 4: per-measurement GA for NT and NB (placeholder until calculation wired)
      gaFromNt:  b.ntGa ?? undefined,
      gaFromNb:  b.nbGa ?? undefined,
    };
  };
  const buildFtMarkers = (m: typeof exam.data.ft_markers): FtMarkersViewModel | undefined => {
    if (!m) return undefined;
    const yn = (v: string | undefined) => v === 'yes' ? 'Yes' : v === 'no' ? 'No' : undefined;
    return {
      arrhythmia:             yn(m.arrhythmia),
      tricuspidRegurgitation: yn(m.tricuspidRegurgitation),
      abnormalDvFlow:         yn(m.abnormalDvFlow),
      echogenicCardiacFocus:  yn(m.echogenicCardiacFocus),
      singleUmbilicalArtery:  yn(m.singleUmbilicalArtery),
      choroidPlexusCysts:     yn(m.choroidPlexusCysts),
      exomphalos:             yn(m.exomphalos),
      megacystis:             yn(m.megacystis),
      placenta:               m.placenta ?? undefined,
      cordInsertion:          m.cordInsertion ?? undefined,
    };
  };
  const buildFtUltrasound = (u: typeof exam.data.ft_ultrasound): FtUltrasoundViewModel | undefined => {
    if (!u) return undefined;
    return {
      placenta:     u.placenta ?? undefined,
      heartRate:    u.heartRate != null ? `${u.heartRate} bpm` : undefined,
      umbilicalCord: u.umbilicalCord ?? undefined,
    };
  };
  const buildFtAnatomy = (a: typeof exam.data.ft_anatomy): AnatomyViewModel | undefined => {
    if (!a) return undefined;
    return {
      head: a.head, brain: a.brain, heart: a.heart, abdomen: a.abdomen,
      kidneys: a.kidneys, limbs: a.limbs, skeleton: a.skeleton, face: a.face,
      neckSkin: a.neckSkin, spine: a.spine, thorax: a.thorax,
    };
  };
  const buildFtDoppler = (d: typeof exam.data.ft_doppler): FtDopplerViewModel | undefined => {
    if (!d) return undefined;
    return {
      utADexPI: d.utADexPI != null ? d.utADexPI.toFixed(2) : undefined,
      utADexRI: d.utADexRI != null ? d.utADexRI.toFixed(2) : undefined,
      utASinPI: d.utASinPI != null ? d.utASinPI.toFixed(2) : undefined,
      utASinRI: d.utASinRI != null ? d.utASinRI.toFixed(2) : undefined,
    };
  };
  let biometry2: ExamPdfViewModel['biometry2'] | undefined;
  let doppler2: ExamPdfViewModel['doppler2'] | undefined;
  let ultrasound2: ExamPdfViewModel['ultrasound2'] | undefined;
  let anatomy2: ExamPdfViewModel['anatomy2'] | undefined;

  if (isTwins) {
    biometry2 = {
      bpd: exam.biometry2?.bpd != null ? withPct(exam.biometry2.bpd) : undefined,
      hc:  exam.biometry2?.hc  != null ? withPct(exam.biometry2.hc)  : undefined,
      ac:  exam.biometry2?.ac  != null ? withPct(exam.biometry2.ac)  : undefined,
      fl:  exam.biometry2?.fl  != null ? withPct(exam.biometry2.fl)  : undefined,
      efw: exam.biometry2?.efw != null ? `${fmtBiometry(exam.biometry2.efw)} g` : undefined,
      // KI-009: percentiles sourced from stored data
      bpdPct: pctStr(exam.biometry2?.bpdPercentile, exam.biometry2?.bpdPercentileIsManual),
      hcPct:  pctStr(exam.biometry2?.hcPercentile, exam.biometry2?.hcPercentileIsManual),
      acPct:  pctStr(exam.biometry2?.acPercentile, exam.biometry2?.acPercentileIsManual),
      flPct:  pctStr(exam.biometry2?.flPercentile, exam.biometry2?.flPercentileIsManual),
      efwPct: pctStr(exam.biometry2?.efwPercentile, exam.biometry2?.efwPercentileIsManual),
      // Sub-Task 4: expanded percentile set for T2
      ofdPct:  pctStr(exam.biometry2?.ofdPercentile, exam.biometry2?.ofdPercentileIsManual),
      tadPct:  pctStr(exam.biometry2?.tadPercentile),
      apadPct: pctStr(exam.biometry2?.apadPercentile),
      tcdPct:  pctStr(exam.biometry2?.tcdPercentile, exam.biometry2?.tcdPercentileIsManual),
      // Sub-Task 4: per-measurement GA for T2
      bpdGa:  withManualMarker(exam.biometry2?.bpdGa  ?? undefined, exam.biometry2?.bpdGaIsManual),
      ofdGa:  withManualMarker(exam.biometry2?.ofdGa  ?? undefined, exam.biometry2?.ofdGaIsManual),
      hcGa:   withManualMarker(exam.biometry2?.hcGa   ?? undefined, exam.biometry2?.hcGaIsManual),
      tadGa:  exam.biometry2?.tadGa  ?? undefined,
      apadGa: exam.biometry2?.apadGa ?? undefined,
      acGa:   withManualMarker(exam.biometry2?.acGa   ?? undefined, exam.biometry2?.acGaIsManual),
      flGa:   withManualMarker(exam.biometry2?.flGa   ?? undefined, exam.biometry2?.flGaIsManual),
      efwGa:  withManualMarker(exam.biometry2?.efwGa  ?? undefined, exam.biometry2?.efwGaIsManual),
      tcdGa:  withManualMarker(exam.biometry2?.tcdGa  ?? undefined, exam.biometry2?.tcdGaIsManual),
      ofd:       exam.biometry2?.ofd       != null ? `${fmtBiometry(exam.biometry2.ofd)} mm`       : undefined,
      vp:        exam.biometry2?.vp?.trim() || undefined,
      tcd:       exam.biometry2?.tcd       != null ? `${fmtBiometry(exam.biometry2.tcd)} mm`       : undefined,
      cm:        exam.biometry2?.cm        != null ? `${fmtBiometry(exam.biometry2.cm)} mm`        : undefined,
      nuchalFold: exam.biometry2?.nuchalFold != null ? `${fmtBiometry(exam.biometry2.nuchalFold)} mm` : undefined,
      nb:        exam.biometry2?.nb        != null ? `${fmtBiometry(exam.biometry2.nb)} mm`        : undefined,
      apad:      exam.biometry2?.apad      != null ? `${fmtBiometry(exam.biometry2.apad)} mm`      : undefined,
      tad:       exam.biometry2?.tad       != null ? `${fmtBiometry(exam.biometry2.tad)} mm`       : undefined,
      la:  exam.biometry2?.la?.trim() || undefined,
      lc:  exam.biometry2?.lc != null ? `${fmtBiometry(exam.biometry2.lc)} mm` : undefined,
    };

    doppler2 = {
      pi:     exam.doppler2?.pi     != null ? exam.doppler2.pi.toFixed(2)     : undefined,
      ri:     exam.doppler2?.ri     != null ? exam.doppler2.ri.toFixed(2)     : undefined,
      utADexPI: exam.doppler2?.utADexPI != null ? exam.doppler2.utADexPI.toFixed(2) : undefined,
      utADexRI: exam.doppler2?.utADexRI != null ? exam.doppler2.utADexRI.toFixed(2) : undefined,
      utASinPI: exam.doppler2?.utASinPI != null ? exam.doppler2.utASinPI.toFixed(2) : undefined,
      utASinRI: exam.doppler2?.utASinRI != null ? exam.doppler2.utASinRI.toFixed(2) : undefined,
      cma:    exam.doppler2?.cma     != null ? exam.doppler2.cma.toFixed(2)    : undefined,
      psv:    exam.doppler2?.psv     != null ? exam.doppler2.psv.toFixed(2)    : undefined,
      cpr:    exam.doppler2?.cpr     != null ? exam.doppler2.cpr.toFixed(2)    : undefined,
      ducVen: exam.doppler2?.ducVen  ?? undefined,
    };

    ultrasound2 = {
      presentation: exam.data?.twin2_ultrasound_findings?.presentation,
      gender: exam.data?.twin2_ultrasound_findings?.gender,
      heartRate: exam.data?.twin2_ultrasound_findings?.heart_rate != null
        ? `${exam.data.twin2_ultrasound_findings.heart_rate} bpm`
        : undefined,
      fetalMovement: exam.data?.twin2_ultrasound_findings?.fetal_movement,
      placenta: exam.data?.twin2_ultrasound_findings?.placenta,
      umbilicalCord: exam.data?.twin2_ultrasound_findings?.umbilical_cord,
    };

    anatomy2 = {
      head:     exam.data?.twin2_anatomy?.head,
      brain:    exam.data?.twin2_anatomy?.brain,
      heart:    exam.data?.twin2_anatomy?.heart,
      abdomen:  exam.data?.twin2_anatomy?.abdomen,
      kidneys:  exam.data?.twin2_anatomy?.kidneys,
      limbs:    exam.data?.twin2_anatomy?.limbs,
      skeleton: exam.data?.twin2_anatomy?.skeleton,
      face:     exam.data?.twin2_anatomy?.face,
      neckSkin: exam.data?.twin2_anatomy?.neckSkin,
      spine:    exam.data?.twin2_anatomy?.spine,
      thorax:   exam.data?.twin2_anatomy?.thorax,
    };
  }

  // ── FT view model population ──────────────────────────────────────────────────
  const ftBiometry     = isFt ? buildFtBiometry(exam.data?.ft_biometry)       : undefined;
  const ftMarkers      = isFt ? buildFtMarkers(exam.data?.ft_markers)         : undefined;
  const ftUltrasound   = isFt ? buildFtUltrasound(exam.data?.ft_ultrasound)   : undefined;
  const ftAnatomy      = isFt ? buildFtAnatomy(exam.data?.ft_anatomy)         : undefined;
  const ftDoppler      = isFt ? buildFtDoppler(exam.data?.ft_doppler)         : undefined;
  const twin2FtBiometry    = isFtTwinsExam ? buildFtBiometry(exam.data?.twin2_ft_biometry)       : undefined;
  const twin2FtMarkers     = isFtTwinsExam ? buildFtMarkers(exam.data?.twin2_ft_markers)         : undefined;
  const twin2FtUltrasound  = isFtTwinsExam ? buildFtUltrasound(exam.data?.twin2_ft_ultrasound)   : undefined;
  const twin2FtAnatomy     = isFtTwinsExam ? buildFtAnatomy(exam.data?.twin2_ft_anatomy)         : undefined;
  const twin2FtDoppler     = isFtTwinsExam ? buildFtDoppler(exam.data?.twin2_ft_doppler)         : undefined;

  return {
    patientName: exam.patientName,
    mrn: exam.mrn,
    examDate: fmtDate(exam.examDate),
    status: exam.status.charAt(0).toUpperCase() + exam.status.slice(1),
    examinationType: exam.examinationType,
    patientAgeAtExam: exam.patientAgeAtExam,

    gestationalAge: withManualMarker(exam.gestationalAge, exam.gestationalAgeIsManual),
    gestationalAgeFromBiometry: withManualMarker(exam.gestationalAgeFromBiometry, exam.biometry?.gestationalAgeFromBiometryIsManual),
    expectedDeliveryDate: lmp ? calcEDD(lmp) : undefined,
    // Sub-Task 5: wrap T2 GA from biometry in withManualMarker to show dagger in PDF
    gestationalAgeFromBiometry2: withManualMarker(exam.gestationalAgeFromBiometry2, exam.biometry2?.gestationalAgeFromBiometryIsManual),
    biometry2,
    doppler2,
    ultrasound2,
    anatomy2,
    ftBiometry,
    ftMarkers,
    ftUltrasound,
    ftAnatomy,
    ftDoppler,
    twin2FtBiometry,
    twin2FtMarkers,
    twin2FtUltrasound,
    twin2FtAnatomy,
    twin2FtDoppler,

    biometry: {
      bpd: exam.biometry?.bpd != null ? withPct(exam.biometry.bpd) : undefined,
      hc:  exam.biometry?.hc  != null ? withPct(exam.biometry.hc)  : undefined,
      ac:  exam.biometry?.ac  != null ? withPct(exam.biometry.ac)  : undefined,
      fl:  exam.biometry?.fl  != null ? withPct(exam.biometry.fl)  : undefined,
      efw: exam.biometry?.efw != null ? `${fmtBiometry(exam.biometry.efw)} g` : undefined,
      // KI-009: percentiles sourced from stored data
      bpdPct: pctStr(exam.biometry?.bpdPercentile, exam.biometry?.bpdPercentileIsManual),
      hcPct:  pctStr(exam.biometry?.hcPercentile, exam.biometry?.hcPercentileIsManual),
      acPct:  pctStr(exam.biometry?.acPercentile, exam.biometry?.acPercentileIsManual),
      flPct:  pctStr(exam.biometry?.flPercentile, exam.biometry?.flPercentileIsManual),
      efwPct: pctStr(exam.biometry?.efwPercentile, exam.biometry?.efwPercentileIsManual),
      // Sub-Task 4: expanded percentile set for T1
      ofdPct:  pctStr(exam.biometry?.ofdPercentile, exam.biometry?.ofdPercentileIsManual),
      tadPct:  pctStr(exam.biometry?.tadPercentile),
      apadPct: pctStr(exam.biometry?.apadPercentile),
      tcdPct:  pctStr(exam.biometry?.tcdPercentile, exam.biometry?.tcdPercentileIsManual),
      // Sub-Task 4: per-measurement GA for T1
      bpdGa:  withManualMarker(exam.biometry?.bpdGa  ?? undefined, exam.biometry?.bpdGaIsManual),
      ofdGa:  withManualMarker(exam.biometry?.ofdGa  ?? undefined, exam.biometry?.ofdGaIsManual),
      hcGa:   withManualMarker(exam.biometry?.hcGa   ?? undefined, exam.biometry?.hcGaIsManual),
      tadGa:  exam.biometry?.tadGa  ?? undefined,
      apadGa: exam.biometry?.apadGa ?? undefined,
      acGa:   withManualMarker(exam.biometry?.acGa   ?? undefined, exam.biometry?.acGaIsManual),
      flGa:   withManualMarker(exam.biometry?.flGa   ?? undefined, exam.biometry?.flGaIsManual),
      efwGa:  withManualMarker(exam.biometry?.efwGa  ?? undefined, exam.biometry?.efwGaIsManual),
      tcdGa:  withManualMarker(exam.biometry?.tcdGa  ?? undefined, exam.biometry?.tcdGaIsManual),
      ofd:       exam.biometry?.ofd       != null ? `${fmtBiometry(exam.biometry.ofd)} mm`       : undefined,
      vp:        exam.biometry?.vp?.trim() || undefined,
      tcd:       exam.biometry?.tcd       != null ? `${fmtBiometry(exam.biometry.tcd)} mm`       : undefined,
      cm:        exam.biometry?.cm        != null ? `${fmtBiometry(exam.biometry.cm)} mm`        : undefined,
      nuchalFold: exam.biometry?.nuchalFold != null ? `${fmtBiometry(exam.biometry.nuchalFold)} mm` : undefined,
      nb:        exam.biometry?.nb        != null ? `${fmtBiometry(exam.biometry.nb)} mm`        : undefined,
      apad:      exam.biometry?.apad      != null ? `${fmtBiometry(exam.biometry.apad)} mm`      : undefined,
      tad:       exam.biometry?.tad       != null ? `${fmtBiometry(exam.biometry.tad)} mm`       : undefined,
      la: exam.biometry?.la?.trim() || undefined,
      lc: exam.biometry?.lc != null ? `${fmtBiometry(exam.biometry.lc)} mm` : undefined,
    },

    doppler: {
      pi:     exam.doppler?.pi     != null ? exam.doppler.pi.toFixed(2)     : undefined,
      ri:     exam.doppler?.ri     != null ? exam.doppler.ri.toFixed(2)     : undefined,
      utADexPI: exam.doppler?.utADexPI != null ? exam.doppler.utADexPI.toFixed(2) : undefined,
      utADexRI: exam.doppler?.utADexRI != null ? exam.doppler.utADexRI.toFixed(2) : undefined,
      utASinPI: exam.doppler?.utASinPI != null ? exam.doppler.utASinPI.toFixed(2) : undefined,
      utASinRI: exam.doppler?.utASinRI != null ? exam.doppler.utASinRI.toFixed(2) : undefined,
      cma:     exam.doppler?.cma     != null ? exam.doppler.cma.toFixed(2)     : undefined,
      psv:     exam.doppler?.psv     != null ? exam.doppler.psv.toFixed(2)     : undefined,
      cpr:     exam.doppler?.cpr     != null ? exam.doppler.cpr.toFixed(2)     : undefined,
      ducVen:  exam.doppler?.ducVen  ?? undefined,
    },

    pregnancy: {
      lmp: lmp ? fmtDate(lmp) : undefined,
      obstetricHistory: exam.data?.pregnancy_data?.obstetric_history,
      familyHistory: exam.data?.pregnancy_data?.family_history,
    },

    ultrasound: {
      presentation: exam.data?.ultrasound_findings?.presentation,
      gender: exam.data?.ultrasound_findings?.gender,
      heartRate: exam.data?.ultrasound_findings?.heart_rate != null
        ? `${exam.data.ultrasound_findings.heart_rate} bpm`
        : undefined,
      fetalMovement: exam.data?.ultrasound_findings?.fetal_movement,
      placenta: exam.data?.ultrasound_findings?.placenta,
      umbilicalCord: exam.data?.ultrasound_findings?.umbilical_cord,
    },

    anatomy: {
      head:     exam.data?.anatomy?.head,
      brain:    exam.data?.anatomy?.brain,
      heart:    exam.data?.anatomy?.heart,
      abdomen:  exam.data?.anatomy?.abdomen,
      kidneys:  exam.data?.anatomy?.kidneys,
      limbs:    exam.data?.anatomy?.limbs,
      skeleton: exam.data?.anatomy?.skeleton,
      face:     exam.data?.anatomy?.face,
      neckSkin: exam.data?.anatomy?.neckSkin,
      spine:    exam.data?.anatomy?.spine,
      thorax:   exam.data?.anatomy?.thorax,
    },

    findings: exam.findings,
    // KI-009: Notes field populated with static citation text; user notes field removed from form
    notes: `${isFt ? FT_BIOMETRY_CITATIONS : PRENATAL_BIOMETRY_CITATIONS}${
      (
        (!isFt && (
          exam.gestationalAgeIsManual
          || exam.biometry?.gestationalAgeFromBiometryIsManual
          || exam.biometry?.bpdPercentileIsManual || exam.biometry?.hcPercentileIsManual || exam.biometry?.acPercentileIsManual
          || exam.biometry?.flPercentileIsManual || exam.biometry?.ofdPercentileIsManual || exam.biometry?.efwPercentileIsManual || exam.biometry?.tcdPercentileIsManual
          || exam.biometry?.bpdGaIsManual || exam.biometry?.hcGaIsManual || exam.biometry?.acGaIsManual
          || exam.biometry?.flGaIsManual || exam.biometry?.ofdGaIsManual || exam.biometry?.efwGaIsManual || exam.biometry?.tcdGaIsManual
          || exam.biometry2?.gestationalAgeFromBiometryIsManual
          || exam.biometry2?.bpdPercentileIsManual || exam.biometry2?.hcPercentileIsManual || exam.biometry2?.acPercentileIsManual
          || exam.biometry2?.flPercentileIsManual || exam.biometry2?.ofdPercentileIsManual || exam.biometry2?.efwPercentileIsManual || exam.biometry2?.tcdPercentileIsManual
          || exam.biometry2?.bpdGaIsManual || exam.biometry2?.hcGaIsManual || exam.biometry2?.acGaIsManual
          || exam.biometry2?.flGaIsManual || exam.biometry2?.ofdGaIsManual || exam.biometry2?.efwGaIsManual || exam.biometry2?.tcdGaIsManual
        ))
        || (isFt && (
          exam.data?.ft_biometry?.gaFromCrlIsManual
          || exam.data?.twin2_ft_biometry?.gaFromCrlIsManual
        ))
      )
        ? '\n† Value manually entered'
        : ''
    }`,
    comments: exam.data?.comments,
    createdBy: exam.createdByName ?? exam.createdBy,
    createdAt: new Date(exam.createdAt).toLocaleString('en-GB'),
  };
}

// Made with Bob
