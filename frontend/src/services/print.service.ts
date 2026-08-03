import type { Examination } from '../types';
import { buildViewModel } from './viewModelBuilders';

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
  // Percentile strings for the row-by-row biometry renderer
  bpdPct?: string;
  hcPct?: string;
  acPct?: string;
  flPct?: string;
  efwPct?: string;
  // Sub-Task 4: Expanded percentile set (OFD, TAD, APAD — NEW in v2)
  ofdPct?: string;
  tadPct?: string;
  apadPct?: string;
  // Sub-Task 4: Per-measurement GA strings (all string | undefined)
  bpdGa?: string;
  ofdGa?: string;
  hcGa?: string;
  tadGa?: string;
  apadGa?: string;
  acGa?: string;
  flGa?: string;
  efwGa?: string;
}

export interface DopplerViewModel {
  pi?: string;
  ri?: string;
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

export interface FtBiometryViewModel {
  crl?: string;
  gaFromCrl?: string;
  nt?: string;
  nb?: string;
  puls?: string;
  // Sub-Task 4: NT and NB per-measurement GA strings
  gaFromNt?: string;
  gaFromNb?: string;
}

export interface FtMarkersViewModel {
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
}

export interface FtUltrasoundViewModel {
  placenta?: string;
  heartRate?: string;
  umbilicalCord?: string;
}

export interface FtDopplerViewModel {
  utADexPI?: string;
  utADexRI?: string;
  utASinPI?: string;
  utASinRI?: string;
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

  // UZPT — FT blocks
  ftBiometry?: FtBiometryViewModel;
  ftMarkers?: FtMarkersViewModel;
  ftUltrasound?: FtUltrasoundViewModel;
  ftAnatomy?: AnatomyViewModel;
  ftDoppler?: FtDopplerViewModel;
  twin2FtBiometry?: FtBiometryViewModel;
  twin2FtMarkers?: FtMarkersViewModel;
  twin2FtUltrasound?: FtUltrasoundViewModel;
  twin2FtAnatomy?: AnatomyViewModel;
  twin2FtDoppler?: FtDopplerViewModel;

  biometry: BiometryViewModel;

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
      // Fallback: let jsPDF open it via data URI
      doc.output('dataurlnewwindow');
    }
    setTimeout(() => URL.revokeObjectURL(url), 15_000);
  }
}

export const printService = new PrintService();

// Made with Bob
