import { jsPDF } from 'jspdf';
import type { ExamPdfViewModel } from '../../services/print.service';
import { chunkFetuses, computePairLayout, renderClinicalSectionsPair } from './pdfSections';
import type { PdfDrawHelpers } from './pdfSections';

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

function rule(doc: jsPDF, y: number) {
  setDrawColor(doc, C_RULE);
  doc.setLineWidth(0.2);
  doc.line(MARGIN_L, y, MARGIN_R, y);
}

function sectionHeading(doc: jsPDF, label: string, y: number): number {
  return sectionHeadingAt(doc, label, y, MARGIN_L, MARGIN_R);
}

function sectionHeadingAt(doc: jsPDF, label: string, y: number, xStart: number, xEnd: number): number {
  doc.setFont(FONT_ID, 'bold');
  doc.setFontSize(8);
  setTextColor(doc, C_DARK);
  const upper = label.toUpperCase();
  doc.text(upper, xStart, y);
  const labelW = doc.getTextWidth(upper);
  setDrawColor(doc, C_ACCENT);
  doc.setLineWidth(0.5);
  doc.line(xStart, y + 1, xStart + labelW, y + 1);
  setDrawColor(doc, C_RULE);
  doc.setLineWidth(0.2);
  doc.line(xStart + labelW + 1, y + 1, xEnd, y + 1);
  return y + 5;
}

function kvGrid(
  doc: jsPDF,
  pairs: Array<[string, string | undefined]>,
  y: number,
  cols = 2,
): number {
  return kvGridAt(doc, pairs, y, cols, MARGIN_L, COL_W);
}

function kvGridAt(
  doc: jsPDF,
  pairs: Array<[string, string | undefined]>,
  y: number,
  cols: number,
  xStart: number,
  colW: number,
  bodyFontSize = 8,
): number {
  const visible = pairs.map(([label, value]) => [label, value || '—'] as [string, string]);
  const cW = colW / cols;
  const labelW = cW * 0.43;
  const valueW = cW * 0.54;

  let rowY = y;
  let col = 0;
  let rowBottom = y;

  visible.forEach(([label, value]) => {
    const x = xStart + col * cW;

    doc.setFont(FONT_ID, 'normal');
    doc.setFontSize(7.5);
    setTextColor(doc, C_MID);
    doc.text(label, x, rowY);

    doc.setFont(FONT_ID, 'bold');
    doc.setFontSize(bodyFontSize);
    setTextColor(doc, C_DARK);
    const lines = doc.splitTextToSize(value, valueW) as string[];
    doc.text(lines, x + labelW, rowY);

    const cellBottom = rowY + (lines.length - 1) * 4;
    if (cellBottom > rowBottom) rowBottom = cellBottom;

    col++;
    if (col >= cols) {
      col = 0;
      rowY = rowBottom + 3.85;
      rowBottom = rowY;
    }
  });

  return col === 0 ? rowY - 3.85 / 2 : rowBottom + 3.85 / 2;
}

function textBlock(
  doc: jsPDF,
  caption: string,
  body: string | undefined,
  y: number,
  maxLines = 6,
  bodyFontSize = 8,
): number {
  if (!body) return y;

  doc.setFont(FONT_ID, 'bold');
  doc.setFontSize(8);
  setTextColor(doc, C_MID);
  doc.text(caption + ':', MARGIN_L, y);

  doc.setFont(FONT_ID, 'normal');
  doc.setFontSize(bodyFontSize);
  setTextColor(doc, C_DARK);
  let lines = doc.splitTextToSize(body, COL_W) as string[];
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S+$/, '') + '… (continued)';
  }
  doc.text(lines, MARGIN_L, y + 4.5);
  return y + 5 + lines.length * 4.5;
}

// ─── Common page sections ─────────────────────────────────────────────────────

function drawHeader(doc: jsPDF, vm: ExamPdfViewModel): number {
  const isFt = vm.examinationType === 'first_trimester';
  const fetusCount = vm.fetuses.length;
  const baseTitle = isFt ? 'First Trimester Ultrasound' : 'Prenatal Ultrasound Report';
  const headerTitle = fetusCount > 1 ? `${baseTitle} (${fetusCount} fetuses)` : baseTitle;

  setFill(doc, C_HEADER_BG);
  doc.rect(0, 0, PAGE_W, 22, 'F');

  doc.setFont(FONT_ID, 'bold');
  doc.setFontSize(13);
  setTextColor(doc, C_DARK);
  doc.text(headerTitle, MARGIN_L, 10);

  doc.setFont(FONT_ID, 'normal');
  doc.setFontSize(8);
  setTextColor(doc, C_MID);
  doc.text(`MRN: ${vm.mrn}`, MARGIN_L, 16);
  doc.text(`Exam Date: ${vm.examDate}`, MARGIN_R, 16, { align: 'right' });

  return 26;
}

function drawPatientBlock(doc: jsPDF, vm: ExamPdfViewModel, y: number): number {
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
  doc.text(`Patient age at exam: ${vm.patientAgeAtExam !== undefined ? `${vm.patientAgeAtExam} years` : '—'}`, MARGIN_L, y);
  y += 4;

  // GA from LMP + GA from Bio + EDD row
  const gaLabel = 'GA (LMP): ';
  doc.text(gaLabel, MARGIN_L, y);
  doc.setFont(FONT_ID, 'bold');
  setTextColor(doc, C_DARK);
  doc.text(vm.gestationalAge || '—', MARGIN_L + doc.getTextWidth(gaLabel), y);
  doc.setFont(FONT_ID, 'normal');
  setTextColor(doc, C_MID);

  // GA from Bio — derive from first fetus gaFromBiometry
  const gaBioValues = vm.fetuses.map(f => f.gaFromBiometry).filter(Boolean) as string[];
  const gaBioDisplay = gaBioValues.length > 0 ? gaBioValues.join(' / ') : undefined;
  const gaBioLabel = '  GA (Bio): ';
  doc.text(gaBioLabel, MARGIN_L + 42, y);
  doc.setFont(FONT_ID, 'bold');
  setTextColor(doc, C_DARK);
  doc.text(gaBioDisplay || '—', MARGIN_L + 42 + doc.getTextWidth(gaBioLabel), y);
  doc.setFont(FONT_ID, 'normal');
  setTextColor(doc, C_MID);

  doc.setFont(FONT_ID, 'bold');
  setTextColor(doc, C_ACCENT);
  doc.setFontSize(8.5);
  doc.text(`EDD: ${vm.expectedDeliveryDate || '—'}`, MARGIN_R, y, { align: 'right' });
  doc.setFont(FONT_ID, 'normal');
  setTextColor(doc, C_MID);
  doc.setFontSize(8);
  y += 4;

  return y;
}

function drawPregnancyData(doc: jsPDF, vm: ExamPdfViewModel, y: number): number {
  rule(doc, y);
  y += 5;
  y = sectionHeading(doc, 'Pregnancy Data', y);

  const COL_HALF = COL_W / 2;
  const LABEL_SIZE = 7.5;
  const VALUE_SIZE = 8;
  const xL = MARGIN_L;
  const xR = MARGIN_L + COL_HALF;

  const drawInlineCell = (x: number, rowY: number, label: string, value: string | undefined, isAccent = false) => {
    doc.setFont(FONT_ID, 'normal');
    doc.setFontSize(LABEL_SIZE);
    setTextColor(doc, C_MID);
    doc.text(label, x, rowY);
    doc.setFont(FONT_ID, 'bold');
    doc.setFontSize(VALUE_SIZE);
    setTextColor(doc, isAccent ? C_ACCENT : C_DARK);
    doc.text(value || '\u2014', x + doc.getTextWidth(label), rowY);
  };

  const drawCell = (x: number, rowY: number, label: string, value: string | undefined) => {
    doc.setFont(FONT_ID, 'normal');
    doc.setFontSize(LABEL_SIZE);
    setTextColor(doc, C_MID);
    doc.text(label, x, rowY);
    doc.setFont(FONT_ID, 'bold');
    doc.setFontSize(VALUE_SIZE);
    setTextColor(doc, C_DARK);
    doc.text(value || '\u2014', x, rowY + 3.5);
  };

  drawInlineCell(xL, y, 'LMP Date: ', vm.pregnancy.lmp);
  drawInlineCell(xR, y, 'GA from LMP: ', vm.gestationalAge);
  y += 5;

  drawInlineCell(xL, y, 'Expected Delivery Date: ', vm.expectedDeliveryDate, true);
  const gaBioValues = vm.fetuses.map(f => f.gaFromBiometry).filter(Boolean) as string[];
  drawInlineCell(xR, y, 'GA from Bio: ', gaBioValues.length > 0 ? gaBioValues.join(' / ') : undefined);
  y += 5;

  drawCell(xL, y, 'Obstetric History', vm.pregnancy.obstetricHistory);
  drawCell(xR, y, 'Family History', vm.pregnancy.familyHistory);
  y += 3.5;
  y += 1;

  return y;
}

function drawClinicalInformation(doc: jsPDF, vm: ExamPdfViewModel, y: number): number {
  rule(doc, y);
  y += 4;
  y = sectionHeading(doc, 'Clinical Information', y);
  y = textBlock(doc, 'Findings', vm.findings ?? 'No findings recorded.', y, 5);
  y += 2;
  y = textBlock(doc, 'Comments', vm.comments ?? '—', y, 4);
  y += 2;
  y = textBlock(doc, 'Notes', vm.notes ?? '—', y, 10, 6);
  y += 2;
  return y;
}

function drawSignatureLine(doc: jsPDF, sigY: number) {
  rule(doc, sigY);

  doc.setFont(FONT_ID, 'bold');
  doc.setFontSize(8);
  setTextColor(doc, C_MID);
  doc.text('Examining Doctor:', MARGIN_L, sigY + 8);
  setDrawColor(doc, C_DARK);
  doc.setLineWidth(0.3);
  doc.line(MARGIN_L + 40, sigY + 8, MARGIN_L + 40 + 68, sigY + 8);

  doc.text('Date:', MARGIN_R - 52, sigY + 8);
  doc.line(MARGIN_R - 41, sigY + 8, MARGIN_R, sigY + 8);

  doc.setFont(FONT_ID, 'normal');
  doc.setFontSize(7);
  setTextColor(doc, C_MID);
  doc.text('Signature', MARGIN_L + 40, sigY + 11.5);
}

function drawFooter(doc: jsPDF, pageNum: number, totalPages: number) {
  const FOOTER_Y = PAGE_H - 8;
  rule(doc, FOOTER_Y - 3);

  doc.setFont(FONT_ID, 'normal');
  doc.setFontSize(6.5);
  setTextColor(doc, C_MID);
  doc.text(`Generated: ${new Date().toLocaleString('en-GB')}`, MARGIN_L, FOOTER_Y);
  doc.text('CONFIDENTIAL — For clinical use only', PAGE_W / 2, FOOTER_Y, { align: 'center' });
  doc.text(`Page ${pageNum} of ${totalPages}`, MARGIN_R, FOOTER_Y, { align: 'right' });
}

// ─── Main document builder ────────────────────────────────────────────────────

export async function buildExaminationPDF(vm: ExamPdfViewModel): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  await registerFonts(doc);

  // Chunk fetuses into pairs (max 2 per page)
  const pairs = chunkFetuses(vm.fetuses.length > 0 ? vm.fetuses : [{ index: 0, biometry: [], doppler: [] }]);
  const totalPages = pairs.length + 1; // 1 page per pair + clinical info page (or all on 1 if it fits)

  const pdfHelpers: PdfDrawHelpers = {
    rule, sectionHeading, sectionHeadingAt, kvGrid, kvGridAt, FONT_ID,
  };

  // ── Page 1: Header + Patient + Pregnancy Data + Pair 0 ────────────────────────
  let y = drawHeader(doc, vm);
  y = drawPatientBlock(doc, vm, y);
  y = drawPregnancyData(doc, vm, y);

  // Render first pair of fetuses on page 1
  const layout0 = computePairLayout(pairs[0].length);
  y = renderClinicalSectionsPair(doc, vm, pairs[0], layout0, y, pdfHelpers);

  // ── Additional pages for more fetus pairs ─────────────────────────────────────
  let currentPage = 1;
  for (let pi = 1; pi < pairs.length; pi++) {
    // Footer for current page before adding a new one
    drawFooter(doc, currentPage, totalPages);
    doc.addPage();
    currentPage++;

    // Repeat header + patient block on each subsequent page
    y = drawHeader(doc, vm);
    y = drawPatientBlock(doc, vm, y);
    rule(doc, y);
    y += 5;

    const layoutI = computePairLayout(pairs[pi].length);
    y = renderClinicalSectionsPair(doc, vm, pairs[pi], layoutI, y, pdfHelpers);
  }

  // ── Clinical Information + Signature ─────────────────────────────────────────
  y = drawClinicalInformation(doc, vm, y);

  const SIG_MAX = PAGE_H - 24.5;
  const sigYIdeal = Math.max(y + 6, PAGE_H - 28);
  let sigY = Math.min(sigYIdeal, SIG_MAX);

  if (sigYIdeal > SIG_MAX) {
    drawFooter(doc, currentPage, totalPages + 1);
    doc.addPage();
    currentPage++;
    sigY = 30;
  }

  drawSignatureLine(doc, sigY);
  drawFooter(doc, currentPage, currentPage);

  return doc;
}

// Made with Bob
