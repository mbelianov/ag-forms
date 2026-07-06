import {
  calcEDD,
  calcBiometryPercentiles,
  calcEFWPercentile,
} from '../utils/calculations';
import type { Examination } from '../types';

// ─── View model ──────────────────────────────────────────────────────────────

export interface ExamPdfViewModel {
  patientName: string;
  mrn: string;
  examDate: string;
  status: string;

  gestationalAge?: string;
  gestationalAgeFromBiometry?: string;
  expectedDeliveryDate?: string;

  biometry: {
    bpd?: string;
    hc?: string;
    ac?: string;
    fl?: string;
    efw?: string;
  };

  doppler: {
    pi?: string;
    ri?: string;
    vessel?: string;
  };

  pregnancy: {
    lmp?: string;
    obstetricHistory?: string;
    familyHistory?: string;
  };

  ultrasound: {
    presentation?: string;
    gender?: string;
    heartRate?: string;
    fetalMovement?: string;
    placenta?: string;
    umbilicalCord?: string;
  };

  anatomy: {
    head?: string;
    brain?: string;
    heart?: string;
    abdomen?: string;
    kidneys?: string;
    limbs?: string;
    skeleton?: string;
  };

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
  return pct !== undefined ? `${value} mm (${ordinal(pct)} %ile)` : `${value} mm`;
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

  return {
    patientName: exam.patientName,
    mrn: exam.mrn,
    examDate: fmtDate(exam.examDate),
    status: exam.status.charAt(0).toUpperCase() + exam.status.slice(1),

    gestationalAge: exam.gestationalAge,
    gestationalAgeFromBiometry: exam.gestationalAgeFromBiometry,
    expectedDeliveryDate: lmp ? calcEDD(lmp) : undefined,

    biometry: {
      bpd: exam.biometry?.bpd != null ? withPct(exam.biometry.bpd, percentiles?.bpd) : undefined,
      hc: exam.biometry?.hc != null ? withPct(exam.biometry.hc, percentiles?.hc) : undefined,
      ac: exam.biometry?.ac != null ? withPct(exam.biometry.ac, percentiles?.ac) : undefined,
      fl: exam.biometry?.fl != null ? withPct(exam.biometry.fl, percentiles?.fl) : undefined,
      efw: exam.biometry?.efw != null
        ? (efwPct !== undefined ? `${exam.biometry.efw} g (${ordinal(efwPct)} %ile)` : `${exam.biometry.efw} g`)
        : undefined,
    },

    doppler: {
      pi: exam.doppler?.pi != null ? String(exam.doppler.pi) : undefined,
      ri: exam.doppler?.ri != null ? String(exam.doppler.ri) : undefined,
      vessel: exam.doppler?.vessel ?? undefined,
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
      head: exam.data?.anatomy?.head,
      brain: exam.data?.anatomy?.brain,
      heart: exam.data?.anatomy?.heart,
      abdomen: exam.data?.anatomy?.abdomen,
      kidneys: exam.data?.anatomy?.kidneys,
      limbs: exam.data?.anatomy?.limbs,
      skeleton: exam.data?.anatomy?.skeleton,
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
