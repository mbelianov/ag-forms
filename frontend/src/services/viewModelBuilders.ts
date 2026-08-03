/**
 * viewModelBuilders.ts — extracted from print.service.ts (Sub-Task 0d).
 * Contains buildViewModel and its helpers (fmtDate, withPct, pctStr).
 * print.service.ts imports buildViewModel from here.
 */
import {
  calcEDD,
  calcBiometryPercentiles,
  calcEFWPercentile,
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

/** Returns a "N %-ile" percentile string (e.g. "45 %-ile") or undefined when pct is absent. */
function pctStr(pct: number | undefined): string | undefined {
  return pct !== undefined ? `${pct} %-ile` : undefined;
}

// ─── Build view model ─────────────────────────────────────────────────────────

export function buildViewModel(exam: Examination): ExamPdfViewModel {
  const lmp = exam.data?.pregnancy_data?.last_menstrual_period;
  const gaForPct = exam.gestationalAge;

  const percentiles = calcBiometryPercentiles(
    exam.biometry?.bpd,
    exam.biometry?.hc,
    exam.biometry?.ac,
    exam.biometry?.fl,
    gaForPct ?? '',
  );

  const efwPct =
    exam.biometry?.efw && gaForPct
      ? calcEFWPercentile(exam.biometry.efw, gaForPct)
      : undefined;

  // uzd-twins / UZPT detection
  const isTwins = exam.examinationType === 'ultrasound_prenatal_twins';
  const isFt = isFirstTrimester(exam.examinationType);
  const isFtTwinsExam = isFtTwins(exam.examinationType);

  // ── FT view model helpers ────────────────────────────────────────────────────
  const buildFtBiometry = (b: typeof exam.data.ft_biometry): FtBiometryViewModel | undefined => {
    if (!b) return undefined;
    return {
      crl:       b.crl  != null ? `${b.crl.toFixed(2)} mm` : undefined,
      gaFromCrl: b.gaFromCrl ?? undefined,
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
    const percentiles2 = calcBiometryPercentiles(
      exam.biometry2?.bpd, exam.biometry2?.hc, exam.biometry2?.ac, exam.biometry2?.fl,
      gaForPct ?? '',
    );
    const efwPct2 = exam.biometry2?.efw && gaForPct
      ? calcEFWPercentile(exam.biometry2.efw, gaForPct)
      : undefined;

    biometry2 = {
      bpd: exam.biometry2?.bpd != null ? withPct(exam.biometry2.bpd) : undefined,
      hc:  exam.biometry2?.hc  != null ? withPct(exam.biometry2.hc)  : undefined,
      ac:  exam.biometry2?.ac  != null ? withPct(exam.biometry2.ac)  : undefined,
      fl:  exam.biometry2?.fl  != null ? withPct(exam.biometry2.fl)  : undefined,
      efw: exam.biometry2?.efw != null ? `${fmtBiometry(exam.biometry2.efw)} g` : undefined,
      bpdPct: pctStr(percentiles2?.bpd),
      hcPct:  pctStr(percentiles2?.hc),
      acPct:  pctStr(percentiles2?.ac),
      flPct:  pctStr(percentiles2?.fl),
      efwPct: pctStr(efwPct2),
      // Sub-Task 4: expanded percentile set for T2
      ofdPct:  pctStr(exam.biometry2?.ofdPercentile),
      tadPct:  pctStr(exam.biometry2?.tadPercentile),
      apadPct: pctStr(exam.biometry2?.apadPercentile),
      // Sub-Task 4: per-measurement GA for T2
      bpdGa:  exam.biometry2?.bpdGa  ?? undefined,
      ofdGa:  exam.biometry2?.ofdGa  ?? undefined,
      hcGa:   exam.biometry2?.hcGa   ?? undefined,
      tadGa:  exam.biometry2?.tadGa  ?? undefined,
      apadGa: exam.biometry2?.apadGa ?? undefined,
      acGa:   exam.biometry2?.acGa   ?? undefined,
      flGa:   exam.biometry2?.flGa   ?? undefined,
      efwGa:  exam.biometry2?.efwGa  ?? undefined,
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

    gestationalAge: exam.gestationalAge,
    gestationalAgeFromBiometry: exam.gestationalAgeFromBiometry,
    expectedDeliveryDate: lmp ? calcEDD(lmp) : undefined,
    gestationalAgeFromBiometry2: exam.gestationalAgeFromBiometry2,
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
      bpdPct: pctStr(percentiles?.bpd),
      hcPct:  pctStr(percentiles?.hc),
      acPct:  pctStr(percentiles?.ac),
      flPct:  pctStr(percentiles?.fl),
      efwPct: pctStr(efwPct),
      // Sub-Task 4: expanded percentile set for T1
      ofdPct:  pctStr(exam.biometry?.ofdPercentile),
      tadPct:  pctStr(exam.biometry?.tadPercentile),
      apadPct: pctStr(exam.biometry?.apadPercentile),
      // Sub-Task 4: per-measurement GA for T1
      bpdGa:  exam.biometry?.bpdGa  ?? undefined,
      ofdGa:  exam.biometry?.ofdGa  ?? undefined,
      hcGa:   exam.biometry?.hcGa   ?? undefined,
      tadGa:  exam.biometry?.tadGa  ?? undefined,
      apadGa: exam.biometry?.apadGa ?? undefined,
      acGa:   exam.biometry?.acGa   ?? undefined,
      flGa:   exam.biometry?.flGa   ?? undefined,
      efwGa:  exam.biometry?.efwGa  ?? undefined,
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
    notes: exam.notes,
    comments: exam.data?.comments,
    createdBy: exam.createdByName ?? exam.createdBy,
    createdAt: new Date(exam.createdAt).toLocaleString('en-GB'),
  };
}

// Made with Bob
