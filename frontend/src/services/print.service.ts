import {
  calcEDD,
  calcBiometryPercentiles,
  calcEFWPercentile,
  fmtBiometry,
} from '../utils/calculations';
import type { Examination } from '../types';

// ─── View model ──────────────────────────────────────────────────────────────

export interface BiometryViewModel {
  bpd?: string;
  hc?: string;
  ac?: string;
  fl?: string;
  efw?: string;
  ofd?: string;
  vp?: string;
  tcd?: string;
  cm?: string;
  nuchalFold?: string;
  nb?: string;
  apad?: string;
  tad?: string;
  la?: string;
  lc?: string;
}

export interface DopplerViewModel {
  pi?: string;
  ri?: string;
  vessel?: string;
  utADexPI?: string;
  utADexRI?: string;
  utASinPI?: string;
  utASinRI?: string;
  cma?: string;
  psv?: string;
  cpr?: string;
  ducVen?: string;
}

export interface UltrasoundViewModel {
  presentation?: string;
  gender?: string;
  heartRate?: string;
  fetalMovement?: string;
  placenta?: string;
  umbilicalCord?: string;
}

export interface AnatomyViewModel {
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
}

export interface ExamPdfViewModel {
  patientName: string;
  mrn: string;
  examDate: string;
  status: string;
  examinationType?: string;        // TASK-033
  patientAgeAtExam?: number;       // TASK-037

  gestationalAge?: string;
  gestationalAgeFromBiometry?: string;
  expectedDeliveryDate?: string;

  // uzd-twins: T2 blocks (absent for single-fetus exams)
  gestationalAgeFromBiometry2?: string;
  biometry2?: BiometryViewModel;
  doppler2?: DopplerViewModel;
  ultrasound2?: UltrasoundViewModel;
  anatomy2?: AnatomyViewModel;

  biometry: {
    // Core
    bpd?: string;
    hc?: string;
    ac?: string;
    fl?: string;
    efw?: string;
    // TASK-034: Extended biometry
    ofd?: string;
    vp?: string;
    tcd?: string;
    cm?: string;
    nuchalFold?: string;
    nb?: string;
    apad?: string;
    tad?: string;
    // TASK-035: LA/LC
    la?: string;
    lc?: string;
  };

  doppler: DopplerViewModel;

  pregnancy: {
    lmp?: string;
    obstetricHistory?: string;
    familyHistory?: string;
  };

  ultrasound: UltrasoundViewModel;

  anatomy: AnatomyViewModel;

  findings?: string;
  notes?: string;
  comments?: string;
  createdBy: string;
  createdAt: string;
}

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

function withPct(value: number, pct: number | undefined): string {
  return pct !== undefined ? `${fmtBiometry(value)} mm (${ordinal(pct)} %ile)` : `${fmtBiometry(value)} mm`;
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

  // uzd-twins: build T2 blocks when twins exam type
  const isTwins = exam.examinationType === 'ultrasound_prenatal_twins';
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
      bpd: exam.biometry2?.bpd != null ? withPct(exam.biometry2.bpd, percentiles2?.bpd) : undefined,
      hc:  exam.biometry2?.hc  != null ? withPct(exam.biometry2.hc,  percentiles2?.hc)  : undefined,
      ac:  exam.biometry2?.ac  != null ? withPct(exam.biometry2.ac,  percentiles2?.ac)  : undefined,
      fl:  exam.biometry2?.fl  != null ? withPct(exam.biometry2.fl,  percentiles2?.fl)  : undefined,
      efw: exam.biometry2?.efw != null
        ? (efwPct2 !== undefined ? `${fmtBiometry(exam.biometry2.efw)} g (${ordinal(efwPct2)} %ile)` : `${fmtBiometry(exam.biometry2.efw)} g`)
        : undefined,
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
      vessel: exam.doppler2?.vessel ?? undefined,
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
    // uzd-twins: T2 fields
    gestationalAgeFromBiometry2: exam.gestationalAgeFromBiometry2,
    biometry2,
    doppler2,
    ultrasound2,
    anatomy2,

    biometry: {
      bpd: exam.biometry?.bpd != null ? withPct(exam.biometry.bpd, percentiles?.bpd) : undefined,
      hc:  exam.biometry?.hc  != null ? withPct(exam.biometry.hc,  percentiles?.hc)  : undefined,
      ac:  exam.biometry?.ac  != null ? withPct(exam.biometry.ac,  percentiles?.ac)  : undefined,
      fl:  exam.biometry?.fl  != null ? withPct(exam.biometry.fl,  percentiles?.fl)  : undefined,
      efw: exam.biometry?.efw != null
        ? (efwPct !== undefined ? `${fmtBiometry(exam.biometry.efw)} g (${ordinal(efwPct)} %ile)` : `${fmtBiometry(exam.biometry.efw)} g`)
        : undefined,
      // TASK-034
      ofd:       exam.biometry?.ofd       != null ? `${fmtBiometry(exam.biometry.ofd)} mm`       : undefined,
      vp:        exam.biometry?.vp        != null ? `${fmtBiometry(exam.biometry.vp)} mm`        : undefined,
      tcd:       exam.biometry?.tcd       != null ? `${fmtBiometry(exam.biometry.tcd)} mm`       : undefined,
      cm:        exam.biometry?.cm        != null ? `${fmtBiometry(exam.biometry.cm)} mm`        : undefined,
      nuchalFold: exam.biometry?.nuchalFold != null ? `${fmtBiometry(exam.biometry.nuchalFold)} mm` : undefined,
      nb:        exam.biometry?.nb        != null ? `${fmtBiometry(exam.biometry.nb)} mm`        : undefined,
      apad:      exam.biometry?.apad      != null ? `${fmtBiometry(exam.biometry.apad)} mm`      : undefined,
      tad:       exam.biometry?.tad       != null ? `${fmtBiometry(exam.biometry.tad)} mm`       : undefined,
      // TASK-035
      la: exam.biometry?.la != null ? `${fmtBiometry(exam.biometry.la)} mm` : undefined,
      lc: exam.biometry?.lc != null ? `${fmtBiometry(exam.biometry.lc)} mm` : undefined,
    },

    doppler: {
      pi:     exam.doppler?.pi     != null ? String(exam.doppler.pi)     : undefined,
      ri:     exam.doppler?.ri     != null ? String(exam.doppler.ri)     : undefined,
      vessel: exam.doppler?.vessel ?? undefined,
      // TASK-036
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
      // TASK-036
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

// ─── Service ──────────────────────────────────────────────────────────────────

import { buildExaminationPDF } from '../components/reports/pdfDocument';

class PrintService {
  /** Save the PDF to the user's disk. */
  async downloadPdf(exam: Examination): Promise<void> {
    const vm = buildViewModel(exam);
    const doc = await buildExaminationPDF(vm);
    doc.save(`${exam.mrn}_${exam.examDate}.pdf`);
  }

  /** Generate the PDF and return it as a Blob (for email delivery). */
  async getPdfBlob(exam: Examination): Promise<Blob> {
    const vm = buildViewModel(exam);
    const doc = await buildExaminationPDF(vm);
    return doc.output('blob');
  }

  /** Open the browser print dialog for the PDF. */
  async printExamination(exam: Examination): Promise<void> {
    const vm = buildViewModel(exam);
    const doc = await buildExaminationPDF(vm);
    doc.autoPrint();
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const win = window.open(url);
    if (!win) {
      // Fallback: let jsPDF open it via data URI
      doc.output('dataurlnewwindow');
    }
    setTimeout(() => URL.revokeObjectURL(url), 15_000);
  }
}

export const printService = new PrintService();

// Made with Bob
