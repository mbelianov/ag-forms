import type { Examination } from '../types';
import { buildViewModel } from './viewModelBuilders';

// ─── Observable PDF entry ─────────────────────────────────────────────────────

/** A single biometry or doppler measurement formatted for PDF rendering. */
export interface ObservablePdfEntry {
  type: string;          // canonical key: "bpd", "hc", "pi", etc.
  label: string;         // display label with unit: "BPD (mm)", "CMA PI", etc.
  value: string;         // formatted value string: "45.50 mm", "0.75", "—"
  percentile?: string;   // "45 %-ile" or "45 %-ile †" or undefined
  ga?: string;           // "28w 3d" or "28w 3d †" or undefined
}

// ─── Per-fetus view model ─────────────────────────────────────────────────────

export interface FetusPdfViewModel {
  index: number;          // 0-based fetus index
  biometry: ObservablePdfEntry[];
  doppler: ObservablePdfEntry[];
  ultrasound?: {
    presentation?: string;
    gender?: string;
    heartRate?: string;
    fetalMovement?: string;
    placenta?: string;
    umbilicalCord?: string;
  };
  anatomy?: {
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
  };
  markers?: {
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
  };
  gaFromBiometry?: string;   // "28w 3d" or "28w 3d †" for manual
}

// ─── Top-level exam view model ────────────────────────────────────────────────

export interface ExamPdfViewModel {
  patientName: string;
  mrn: string;
  examDate: string;
  status: string;
  examinationType?: string;
  patientAgeAtExam?: number;

  gestationalAge?: string;         // GA from LMP (with optional " †")
  expectedDeliveryDate?: string;

  fetuses: FetusPdfViewModel[];    // one per fetus

  pregnancy: {
    lmp?: string;
    obstetricHistory?: string;
    familyHistory?: string;
  };

  findings?: string;
  notes?: string;         // citations + static dagger footnote
  comments?: string;
  createdBy: string;
  createdAt: string;
}

export { buildViewModel };

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
      doc.output('dataurlnewwindow');
    }
    setTimeout(() => URL.revokeObjectURL(url), 15_000);
  }
}

export const printService = new PrintService();

// Made with Bob
