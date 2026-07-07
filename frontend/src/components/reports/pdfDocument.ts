import { jsPDF } from 'jspdf';
import type { ExamPdfViewModel } from '../../services/print.service';

// ─── Layout constants (mm on A4: 210 × 297) ──────────────────────────────────

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN_L = 14;
const MARGIN_R = PAGE_W - 14;
const COL_W = PAGE_W - MARGIN_L * 2; // 182 mm usable width

// ─── Colour palette ───────────────────────────────────────────────────────────

const C_DARK = '#161616';
const C_MID = '#525252';
const C_RULE = '#e5e7eb';
const C_ACCENT = '#0f62fe';
const C_HEADER_BG = '#f4f4f4';

// ─── Font registration ────────────────────────────────────────────────────────

// NotoSans covers full Latin + Cyrillic with Identity-H (Unicode) encoding.
// TTFs are served from /public/fonts/, fetched at runtime, and loaded into
// jsPDF's virtual file system (VFS) as base64 — the only supported path.
const FONT_ID = 'NotoSans';

async function fetchBase64(url: string): Promise<string> {
  const resp = await fetch(url);
  const buf = await resp.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function registerFonts(doc: jsPDF): Promise<void> {
  const base = import.meta.env.BASE_URL ?? '/';
  const root = window.location.origin;

  const [regB64, boldB64] = await Promise.all([
    fetchBase64(`${root}${base}fonts/NotoSans-Regular.ttf`),
    fetchBase64(`${root}${base}fonts/NotoSans-Bold.ttf`),
  ]);

  // Register binary data in VFS, then declare the font with Identity-H (Unicode)
  doc.addFileToVFS('NotoSans-Regular.ttf', regB64);
  doc.addFont('NotoSans-Regular.ttf', FONT_ID, 'normal', 'Identity-H');

  doc.addFileToVFS('NotoSans-Bold.ttf', boldB64);
  doc.addFont('NotoSans-Bold.ttf', FONT_ID, 'bold', 'Identity-H');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexColor(color: string): [number, number, number] {
  return [
    parseInt(color.slice(1, 3), 16),
    parseInt(color.slice(3, 5), 16),
    parseInt(color.slice(5, 7), 16),
  ];
}

function setFill(doc: jsPDF, color: string) {
  doc.setFillColor(...hexColor(color));
}

function setTextColor(doc: jsPDF, color: string) {
  doc.setTextColor(...hexColor(color));
}

function setDrawColor(doc: jsPDF, color: string) {
  doc.setDrawColor(...hexColor(color));
}

/** Draw a thin horizontal rule. */
function rule(doc: jsPDF, y: number) {
  setDrawColor(doc, C_RULE);
  doc.setLineWidth(0.2);
  doc.line(MARGIN_L, y, MARGIN_R, y);
}

/** Draw a section heading with a short accent underline, then a light rule extending to the right margin. */
function sectionHeading(doc: jsPDF, label: string, y: number): number {
  doc.setFont(FONT_ID, 'bold');
  doc.setFontSize(8.5);
  setTextColor(doc, C_DARK);
  const upper = label.toUpperCase();
  doc.text(upper, MARGIN_L, y);
  const labelW = doc.getTextWidth(upper);
  setDrawColor(doc, C_ACCENT);
  doc.setLineWidth(0.5);
  doc.line(MARGIN_L, y + 1, MARGIN_L + labelW, y + 1);
  setDrawColor(doc, C_RULE);
  doc.setLineWidth(0.2);
  doc.line(MARGIN_L + labelW + 1, y + 1, MARGIN_R, y + 1);
  return y + 6;
}

/**
 * Render a grid of non-empty label/value pairs in N columns.
 * Only visible pairs occupy rows — empty pairs are skipped entirely.
 * Returns new Y after the block.
 */
function kvGrid(
  doc: jsPDF,
  pairs: Array<[string, string | undefined]>,
  y: number,
  cols = 2,
): number {
  const visible = pairs.filter(([, v]) => v) as Array<[string, string]>;
  if (visible.length === 0) return y;

  const colW = COL_W / cols;
  const labelW = colW * 0.43;
  const valueW = colW * 0.54;

  // Track the actual Y bottom of each rendered row
  let rowY = y;
  let col = 0;
  let rowBottom = y;

  visible.forEach(([label, value]) => {
    const x = MARGIN_L + col * colW;

    // Label
    doc.setFont(FONT_ID, 'normal');
    doc.setFontSize(7.5);
    setTextColor(doc, C_MID);
    doc.text(label, x, rowY);

    // Value (may wrap)
    doc.setFont(FONT_ID, 'bold');
    doc.setFontSize(8);
    setTextColor(doc, C_DARK);
    const lines = doc.splitTextToSize(value, valueW) as string[];
    doc.text(lines, x + labelW, rowY);

    const cellBottom = rowY + (lines.length - 1) * 4;
    if (cellBottom > rowBottom) rowBottom = cellBottom;

    col++;
    if (col >= cols) {
      col = 0;
      rowY = rowBottom + 7;
      rowBottom = rowY;
    }
  });

  // If the last row wasn't flushed (partial row), advance from rowBottom
  return rowBottom + 7;
}

/**
 * Render a wrapped paragraph with a bold caption.
 * Returns new Y after the block.
 */
function textBlock(
  doc: jsPDF,
  caption: string,
  body: string | undefined,
  y: number,
  maxLines = 6,
): number {
  if (!body) return y;

  doc.setFont(FONT_ID, 'bold');
  doc.setFontSize(8);
  setTextColor(doc, C_MID);
  doc.text(caption + ':', MARGIN_L, y);

  doc.setFont(FONT_ID, 'normal');
  setTextColor(doc, C_DARK);
  let lines = doc.splitTextToSize(body, COL_W) as string[];
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S+$/, '') + '… (continued)';
  }
  doc.text(lines, MARGIN_L, y + 4.5);
  return y + 5 + lines.length * 4.5;
}

// ─── Main document builder ────────────────────────────────────────────────────

/**
 * Build an A4 PDF document for one examination.
 * Async because font loading from /public is async.
 * Returns the jsPDF instance — caller decides whether to save or print.
 */
export async function buildExaminationPDF(vm: ExamPdfViewModel): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  // Register Unicode fonts before drawing any text
  await registerFonts(doc);

  let y = 0;

  // ── 1. Header bar ────────────────────────────────────────────────────────────
  setFill(doc, C_HEADER_BG);
  doc.rect(0, 0, PAGE_W, 22, 'F');

  doc.setFont(FONT_ID, 'bold');
  doc.setFontSize(13);
  setTextColor(doc, C_DARK);
  doc.text('Prenatal Ultrasound Report', MARGIN_L, 10);

  doc.setFont(FONT_ID, 'normal');
  doc.setFontSize(8);
  setTextColor(doc, C_MID);
  doc.text(`MRN: ${vm.mrn}`, MARGIN_L, 16);
  doc.text(`Exam Date: ${vm.examDate}`, MARGIN_R, 16, { align: 'right' });

  y = 26;

  // ── 2. Patient block ─────────────────────────────────────────────────────────
  doc.setFont(FONT_ID, 'bold');
  doc.setFontSize(11);
  setTextColor(doc, C_DARK);
  doc.text(vm.patientName, MARGIN_L, y);

  doc.setFont(FONT_ID, 'normal');
  doc.setFontSize(8.5);
  setTextColor(doc, C_MID);
  const statusLabel = 'Status: ';
  doc.text(statusLabel, MARGIN_R - 42, y);
  doc.setFont(FONT_ID, 'bold');
  setTextColor(doc, C_DARK);
  doc.text(vm.status, MARGIN_R - 42 + doc.getTextWidth(statusLabel), y);

  y += 5;
  doc.setFont(FONT_ID, 'normal');
  doc.setFontSize(8);
  setTextColor(doc, C_MID);

  if (vm.examinationType) {
    doc.text(`Type: ${vm.examinationType.replace(/_/g, ' ')}`, MARGIN_L, y);
    y += 4;
  }

  if (vm.patientAgeAtExam !== undefined) {
    doc.text(`Patient age at exam: ${vm.patientAgeAtExam} years`, MARGIN_L, y);
    y += 4;
  }

  if (vm.gestationalAge) {
    const gaLabel = 'GA (LMP): ';
    doc.text(gaLabel, MARGIN_L, y);
    doc.setFont(FONT_ID, 'bold');
    setTextColor(doc, C_DARK);
    doc.text(vm.gestationalAge, MARGIN_L + doc.getTextWidth(gaLabel), y);
    doc.setFont(FONT_ID, 'normal');
    setTextColor(doc, C_MID);
  }

  if (vm.gestationalAgeFromBiometry) {
    const bioLabel = '  GA (Bio): ';
    doc.text(bioLabel, MARGIN_L + 42, y);
    doc.setFont(FONT_ID, 'bold');
    setTextColor(doc, C_DARK);
    doc.text(vm.gestationalAgeFromBiometry, MARGIN_L + 42 + doc.getTextWidth(bioLabel), y);
    doc.setFont(FONT_ID, 'normal');
    setTextColor(doc, C_MID);
  }

  if (vm.expectedDeliveryDate) {
    doc.setFont(FONT_ID, 'bold');
    setTextColor(doc, C_ACCENT);
    doc.setFontSize(8.5);
    doc.text(`EDD: ${vm.expectedDeliveryDate}`, MARGIN_R, y, { align: 'right' });
    doc.setFont(FONT_ID, 'normal');
    setTextColor(doc, C_MID);
    doc.setFontSize(8);
  }

  y += 6;
  rule(doc, y);
  y += 5;

  // ── 3. Biometry ──────────────────────────────────────────────────────────────
  const biometryPairs: Array<[string, string | undefined]> = [
    ['BPD', vm.biometry.bpd],
    ['HC', vm.biometry.hc],
    ['AC', vm.biometry.ac],
    ['FL', vm.biometry.fl],
    ['EFW', vm.biometry.efw],
    // TASK-034: Extended biometry
    ['OFD', vm.biometry.ofd],
    ['Vp', vm.biometry.vp],
    ['TCD', vm.biometry.tcd],
    ['CM', vm.biometry.cm],
    ['Nuchal Fold', vm.biometry.nuchalFold],
    ['NB', vm.biometry.nb],
    ['APAD', vm.biometry.apad],
    ['TAD', vm.biometry.tad],
    // TASK-035: LA/LC
    ['LA', vm.biometry.la],
    ['LC', vm.biometry.lc],
  ];
  if (biometryPairs.some(([, v]) => v)) {
    y = sectionHeading(doc, 'Biometry Measurements', y);
    y = kvGrid(doc, biometryPairs, y, 2);
    y += 1;
  }

  // ── 4. Doppler ───────────────────────────────────────────────────────────────
  const dopplerPairs: Array<[string, string | undefined]> = [
    ['PI', vm.doppler.pi],
    ['RI', vm.doppler.ri],
    ['Vessel', vm.doppler.vessel],
    // TASK-036: Extended vascular
    ['A.ut. Dex PI', vm.doppler.utADexPI],
    ['A.ut. Dex RI', vm.doppler.utADexRI],
    ['A.ut. Sin PI', vm.doppler.utASinPI],
    ['A.ut. Sin RI', vm.doppler.utASinRI],
    ['CMA', vm.doppler.cma],
    ['PSV', vm.doppler.psv],
    ['CPR', vm.doppler.cpr],
    ['Duc.Ven', vm.doppler.ducVen],
  ];
  if (dopplerPairs.some(([, v]) => v)) {
    rule(doc, y);
    y += 4;
    y = sectionHeading(doc, 'Doppler Measurements', y);
    y = kvGrid(doc, dopplerPairs, y, 3);
    y += 1;
  }

  // ── 5. Pregnancy Data ────────────────────────────────────────────────────────
  const pregnancyPairs: Array<[string, string | undefined]> = [
    ['LMP', vm.pregnancy.lmp],
    ['Obstetric History', vm.pregnancy.obstetricHistory],
    ['Family History', vm.pregnancy.familyHistory],
  ];
  if (pregnancyPairs.some(([, v]) => v)) {
    rule(doc, y);
    y += 4;
    y = sectionHeading(doc, 'Pregnancy Data', y);
    y = kvGrid(doc, pregnancyPairs, y, 3);
    y += 1;
  }

  // ── 6. Ultrasound Findings ───────────────────────────────────────────────────
  const ultrasoundPairs: Array<[string, string | undefined]> = [
    ['Presentation', vm.ultrasound.presentation],
    ['Gender', vm.ultrasound.gender],
    ['Fetal Heart Rate', vm.ultrasound.heartRate],
    ['Fetal Movement', vm.ultrasound.fetalMovement],
    ['Placenta', vm.ultrasound.placenta],
    ['Umbilical Cord', vm.ultrasound.umbilicalCord],
  ];
  if (ultrasoundPairs.some(([, v]) => v)) {
    rule(doc, y);
    y += 4;
    y = sectionHeading(doc, 'Ultrasound Findings', y);
    y = kvGrid(doc, ultrasoundPairs, y, 3);
    y += 1;
  }

  // ── 7. Anatomy ───────────────────────────────────────────────────────────────
  const anatomyPairs: Array<[string, string | undefined]> = [
    ['Head', vm.anatomy.head],
    ['Brain', vm.anatomy.brain],
    ['Heart', vm.anatomy.heart],
    ['Abdomen', vm.anatomy.abdomen],
    ['Kidneys', vm.anatomy.kidneys],
    ['Limbs', vm.anatomy.limbs],
    ['Skeleton', vm.anatomy.skeleton],
    // TASK-036: Extended anatomy
    ['Face', vm.anatomy.face],
    ['Neck Skin', vm.anatomy.neckSkin],
    ['Spine', vm.anatomy.spine],
    ['Thorax', vm.anatomy.thorax],
  ];
  if (anatomyPairs.some(([, v]) => v)) {
    rule(doc, y);
    y += 4;
    y = sectionHeading(doc, 'Anatomy', y);
    y = kvGrid(doc, anatomyPairs, y, 3);
    y += 1;
  }

  // ── 8. Clinical Information — always rendered (matches UI behaviour) ──────────
  rule(doc, y);
  y += 4;
  y = sectionHeading(doc, 'Clinical Information', y);
  y = textBlock(doc, 'Findings', vm.findings ?? 'No findings recorded.', y, 5);
  y += 2;
  y = textBlock(doc, 'Notes', vm.notes ?? 'No notes recorded.', y, 5);
  if (vm.comments) {
    y += 2;
    y = textBlock(doc, 'Comments', vm.comments, y, 4);
  }
  y += 2;

  // ── 9. Doctor Signature ──────────────────────────────────────────────────────
  // Fixed position from bottom — always visible regardless of content above
  const SIG_Y = PAGE_H - 28;
  rule(doc, SIG_Y);

  doc.setFont(FONT_ID, 'bold');
  doc.setFontSize(8);
  setTextColor(doc, C_MID);
  doc.text('Examining Doctor:', MARGIN_L, SIG_Y + 8);
  setDrawColor(doc, C_DARK);
  doc.setLineWidth(0.3);
  doc.line(MARGIN_L + 40, SIG_Y + 8, MARGIN_L + 40 + 68, SIG_Y + 8);

  doc.text('Date:', MARGIN_R - 52, SIG_Y + 8);
  doc.line(MARGIN_R - 41, SIG_Y + 8, MARGIN_R, SIG_Y + 8);

  doc.setFont(FONT_ID, 'normal');
  doc.setFontSize(7);
  setTextColor(doc, C_MID);
  doc.text('Signature', MARGIN_L + 40, SIG_Y + 11.5);

  // ── 10. Footer ───────────────────────────────────────────────────────────────
  const FOOTER_Y = PAGE_H - 8;
  rule(doc, FOOTER_Y - 3);

  doc.setFont(FONT_ID, 'normal');
  doc.setFontSize(6.5);
  setTextColor(doc, C_MID);
  doc.text(`Generated: ${new Date().toLocaleString('en-GB')}`, MARGIN_L, FOOTER_Y);
  doc.text('CONFIDENTIAL — For clinical use only', PAGE_W / 2, FOOTER_Y, { align: 'center' });
  doc.text('Page 1 of 1', MARGIN_R, FOOTER_Y, { align: 'right' });

  return doc;
}

// Made with Bob
