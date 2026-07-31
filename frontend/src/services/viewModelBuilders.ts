/**
 * viewModelBuilders.ts — extracted from print.service.ts (Sub-Task 0d).
 * Contains buildViewModel and its helpers (fmtDate, ordinal, withPct).
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

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

function withPct(value: number): string {
  // withPct now returns just the value (no inline percentile) —
  // the row-by-row biometry renderer places percentile in its own column.
  return `${fmtBiometry(value)} mm`;
}

/** Returns an ordinal percentile string ("15th") or undefined when pct is absent. */
function pctStr(pct: number | undefined): string | undefined {
  return pct !== undefined ? ordinal(pct) : undefined;
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
      crl:      b.crl  != null ? `${b.crl} мм` : undefined,
      gaFromCrl: b.gaFromCrl ?? undefined,
      nt:       b.nt   != null ? `${b.nt} мм` : undefined,
      nb:       b.nb   != null ? `${b.nb} мм` : undefined,
      puls:     b.puls != null ? `${b.puls} уд/мин` : undefined,
    };
  };
  const buildFtMarkers = (m: typeof exam.data.ft_markers): FtMarkersViewModel | undefined => {
    if (!m) return undefined;
    const yn = (v: string | undefined) => v === 'yes' ? 'Да' : v === 'no' ? 'Не' : undefined;
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
      heartRate:    u.heartRate != null ? `${u.heartRate} уд/мин` : undefined,
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
      utADexPI: d.utADexPI != null ? String(d.utADexPI) : undefined,
      utADexRI: d.utADexRI != null ? String(d.utADexRI) : undefined,
      utASinPI: d.utASinPI != null ? String(d.utASinPI) : undefined,
      utASinRI: d.utASinRI != null ? String(d.utASinRI) : undefined,
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
      ofd:       exam.biometry2?.ofd       != null ? `${fmtBiometry(exam.biometry2.ofd)} mm`       : undefined,
      vp:        exam.biometry2?.vp        != null ? `${fmtBiometry(exam.biometry2.vp)} mm`        : undefined,
      tcd:       exam.biometry2?.tcd       != null ? `${fmtBiometry(exam.biometry2.tcd)} mm`       : undefined,
      cm:        exam.biometry2?.cm        != null ? `${fmtBiometry(exam.biometry2.cm)} mm`        : undefined,
      nuchalFold: exam.biometry2?.nuchalFold != null ? `${fmtBiometry(exam.biometry2.nuchalFold)} mm` : undefined,
      nb:        exam.biometry2?.nb        != null ? `${fmtBiometry(exam.biometry2.nb)} mm`        : undefined,
      apad:      exam.biometry2?.apad      != null ? `${fmtBiometry(exam.biometry2.apad)} mm`      : undefined,
      tad:       exam.biometry2?.tad       != null ? `${fmtBiometry(exam.biometry2.tad)} mm`       : undefined,
      la:  exam.biometry2?.la != null ? `${fmtBiometry(exam.biometry2.la)} mm` : undefined,
      lc:  exam.biometry2?.lc != null ? `${fmtBiometry(exam.biometry2.lc)} mm` : undefined,
    };

    doppler2 = {
      pi:     exam.doppler2?.pi     != null ? String(exam.doppler2.pi)     : undefined,
      ri:     exam.doppler2?.ri     != null ? String(exam.doppler2.ri)     : undefined,
      utADexPI: exam.doppler2?.utADexPI != null ? String(exam.doppler2.utADexPI) : undefined,
      utADexRI: exam.doppler2?.utADexRI != null ? String(exam.doppler2.utADexRI) : undefined,
      utASinPI: exam.doppler2?.utASinPI != null ? String(exam.doppler2.utASinPI) : undefined,
      utASinRI: exam.doppler2?.utASinRI != null ? String(exam.doppler2.utASinRI) : undefined,
      cma:    exam.doppler2?.cma     != null ? String(exam.doppler2.cma)    : undefined,
      psv:    exam.doppler2?.psv     != null ? String(exam.doppler2.psv)    : undefined,
      cpr:    exam.doppler2?.cpr     != null ? String(exam.doppler2.cpr)    : undefined,
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
      ofd:       exam.biometry?.ofd       != null ? `${fmtBiometry(exam.biometry.ofd)} mm`       : undefined,
      vp:        exam.biometry?.vp        != null ? `${fmtBiometry(exam.biometry.vp)} mm`        : undefined,
      tcd:       exam.biometry?.tcd       != null ? `${fmtBiometry(exam.biometry.tcd)} mm`       : undefined,
      cm:        exam.biometry?.cm        != null ? `${fmtBiometry(exam.biometry.cm)} mm`        : undefined,
      nuchalFold: exam.biometry?.nuchalFold != null ? `${fmtBiometry(exam.biometry.nuchalFold)} mm` : undefined,
      nb:        exam.biometry?.nb        != null ? `${fmtBiometry(exam.biometry.nb)} mm`        : undefined,
      apad:      exam.biometry?.apad      != null ? `${fmtBiometry(exam.biometry.apad)} mm`      : undefined,
      tad:       exam.biometry?.tad       != null ? `${fmtBiometry(exam.biometry.tad)} mm`       : undefined,
      la: exam.biometry?.la != null ? `${fmtBiometry(exam.biometry.la)} mm` : undefined,
      lc: exam.biometry?.lc != null ? `${fmtBiometry(exam.biometry.lc)} mm` : undefined,
    },

    doppler: {
      pi:     exam.doppler?.pi     != null ? String(exam.doppler.pi)     : undefined,
      ri:     exam.doppler?.ri     != null ? String(exam.doppler.ri)     : undefined,
      utADexPI: exam.doppler?.utADexPI != null ? String(exam.doppler.utADexPI) : undefined,
      utADexRI: exam.doppler?.utADexRI != null ? String(exam.doppler.utADexRI) : undefined,
      utASinPI: exam.doppler?.utASinPI != null ? String(exam.doppler.utASinPI) : undefined,
      utASinRI: exam.doppler?.utASinRI != null ? String(exam.doppler.utASinRI) : undefined,
      cma:     exam.doppler?.cma     != null ? String(exam.doppler.cma)     : undefined,
      psv:     exam.doppler?.psv     != null ? String(exam.doppler.psv)     : undefined,
      cpr:     exam.doppler?.cpr     != null ? String(exam.doppler.cpr)     : undefined,
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
