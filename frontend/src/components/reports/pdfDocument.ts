import { jsPDF } from 'jspdf';
import type { ExamPdfViewModel } from '../../services/print.service';
import { getSectionVisibility } from '../../constants/examinationTypes';

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
  return sectionHeadingAt(doc, label, y, MARGIN_L, MARGIN_R);
}

/** uzd-twins: Like sectionHeading but positional (xStart to xEnd). */
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

/**
 * Render a grid of label/value pairs in N columns.
 * Empty values render as an em dash so field presence stays unconditional.
 * Returns new Y after the block.
 */
function kvGrid(
  doc: jsPDF,
  pairs: Array<[string, string | undefined]>,
  y: number,
  cols = 2,
): number {
  return kvGridAt(doc, pairs, y, cols, MARGIN_L, COL_W);
}

/**
 * uzd-twins: Like kvGrid but positional — renders at specific xStart / colW.
 * Used by the two-column twin PDF layout.
 * Returns new Y after the block.
 */
function kvGridAt(
  doc: jsPDF,
  pairs: Array<[string, string | undefined]>,
  y: number,
  cols: number,
  xStart: number,
  colW: number,
  fontSize = 8,
): number {
  const visible = pairs.map(([label, value]) => [label, value || '—'] as [string, string]);

  const cW = colW / cols;
  const labelW = cW * 0.43;
  const valueW = cW * 0.54;

  // Track the actual Y bottom of each rendered row
  let rowY = y;
  let col = 0;
  let rowBottom = y;

  visible.forEach(([label, value]) => {
    const x = xStart + col * cW;

    // Label
    doc.setFont(FONT_ID, 'normal');
    doc.setFontSize(7.5);
    setTextColor(doc, C_MID);
    doc.text(label, x, rowY);

    // Value (may wrap)
    doc.setFont(FONT_ID, 'bold');
    doc.setFontSize(fontSize);
    setTextColor(doc, C_DARK);
    const lines = doc.splitTextToSize(value, valueW) as string[];
    doc.text(lines, x + labelW, rowY);

    const cellBottom = rowY + (lines.length - 1) * 4;
    if (cellBottom > rowBottom) rowBottom = cellBottom;

    col++;
    if (col >= cols) {
      col = 0;
      rowY = rowBottom + 5.5;
      rowBottom = rowY;
    }
  });

  // col === 0: last row was complete and already flushed; rowY holds the next-row start.
  // col > 0:  last row was partial and never flushed; add pitch from rowBottom.
  return col === 0 ? rowY : rowBottom + 5.5;
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

  const visibility = getSectionVisibility(vm.examinationType);
  // uzd-twins: detect twins exam type
  const isTwins = vm.examinationType === 'ultrasound_prenatal_twins';
  const gaBioDisplay = isTwins
    ? `${vm.gestationalAgeFromBiometry || '—'} / ${vm.gestationalAgeFromBiometry2 || '—'}`
    : vm.gestationalAgeFromBiometry;
  // uzd-twins: layout constants for twin two-column layout
  // A4 usable width: 182 mm; twin column: 88 mm each with 6 mm gutter
  const TWIN_COL_W = 88;
  const TWIN_GUTTER = 6;
  const T1_X = MARGIN_L;                     // 14
  const T2_X = MARGIN_L + TWIN_COL_W + TWIN_GUTTER; // 108
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

  let y = 26;

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

  doc.text(`Type: ${(vm.examinationType || '—').replace(/_/g, ' ')}`, MARGIN_L, y);
  y += 4;

  doc.text(`Patient age at exam: ${vm.patientAgeAtExam !== undefined ? `${vm.patientAgeAtExam} years` : '—'}`, MARGIN_L, y);
  y += 4;

  if (visibility.pregnancyData) {
    const gaLabel = 'GA (LMP): ';
    doc.text(gaLabel, MARGIN_L, y);
    doc.setFont(FONT_ID, 'bold');
    setTextColor(doc, C_DARK);
    doc.text(vm.gestationalAge || '—', MARGIN_L + doc.getTextWidth(gaLabel), y);
    doc.setFont(FONT_ID, 'normal');
    setTextColor(doc, C_MID);

    const bioLabel = '  GA (Bio): ';
    doc.text(bioLabel, MARGIN_L + 42, y);
    doc.setFont(FONT_ID, 'bold');
    setTextColor(doc, C_DARK);
    doc.text(gaBioDisplay || '—', MARGIN_L + 42 + doc.getTextWidth(bioLabel), y);
    doc.setFont(FONT_ID, 'normal');
    setTextColor(doc, C_MID);

    doc.setFont(FONT_ID, 'bold');
    setTextColor(doc, C_ACCENT);
    doc.setFontSize(8.5);
    doc.text(`EDD: ${vm.expectedDeliveryDate || '—'}`, MARGIN_R, y, { align: 'right' });
    doc.setFont(FONT_ID, 'normal');
    setTextColor(doc, C_MID);
    doc.setFontSize(8);

    y += 6;
  }

  rule(doc, y);
  y += 5;

  // ── Pregnancy Data ───────────────────────────────────────────────────────────
  if (visibility.pregnancyData) {
    y = sectionHeading(doc, 'Pregnancy Data', y);
    const pregnancyPairs: Array<[string, string | undefined]> = [
      ['LMP',              vm.pregnancy.lmp],
      ['EDD',              vm.expectedDeliveryDate],
      ['GA from LMP',      vm.gestationalAge],
      ['GA from Biometry', gaBioDisplay],
      ['Obstetric History',vm.pregnancy.obstetricHistory],
      ['Family History',   vm.pregnancy.familyHistory],
    ];
    y = kvGrid(doc, pregnancyPairs, y, 2);
    y += 1;
  }

  // ── 3–7. Per-fetus sections ───────────────────────────────────────────────────
  // Helper to build biometry pairs from a vm.biometry-shaped object
  const mkBiometryPairs = (b: typeof vm.biometry, gaLabel: string | undefined): Array<[string, string | undefined]> => [
    ...(gaLabel ? [['GA Bio', gaLabel] as [string, string]] : []),
    ['BPD', b.bpd], ['HC', b.hc], ['AC', b.ac], ['FL', b.fl], ['EFW', b.efw],
    ['OFD', b.ofd], ['Vp', b.vp], ['TCD', b.tcd], ['CM', b.cm],
    ['Nuchal', b.nuchalFold], ['NB', b.nb], ['APAD', b.apad], ['TAD', b.tad],
    ['LA', b.la], ['LC', b.lc],
  ];
  const mkDopplerPairs = (d: typeof vm.doppler): Array<[string, string | undefined]> => [
    ['PI', d.pi], ['RI', d.ri], ['Vessel', d.vessel], ['Duc.Ven', d.ducVen],
    ['Dex PI', d.utADexPI], ['Dex RI', d.utADexRI], ['Sin PI', d.utASinPI], ['Sin RI', d.utASinRI],
    ['CMA', d.cma], ['PSV', d.psv], ['CPR', d.cpr],
  ];
  const mkUltraPairs = (u: typeof vm.ultrasound): Array<[string, string | undefined]> => [
    ['Presentation', u.presentation], ['Gender', u.gender],
    ['Heart Rate', u.heartRate], ['Fetal Mvmt', u.fetalMovement],
    ['Placenta', u.placenta], ['Umbilical', u.umbilicalCord],
  ];
  const mkAnatomyPairs = (a: typeof vm.anatomy): Array<[string, string | undefined]> => [
    ['Head', a.head], ['Brain', a.brain], ['Heart', a.heart], ['Abdomen', a.abdomen],
    ['Kidneys', a.kidneys], ['Limbs', a.limbs], ['Skeleton', a.skeleton],
    ['Face', a.face], ['Neck Skin', a.neckSkin], ['Spine', a.spine], ['Thorax', a.thorax],
  ];

  if (!isTwins) {
    // ── Single-fetus layout (unchanged) ───────────────────────────────────────
    if (visibility.biometry) {
      rule(doc, y); y += 4;
      y = sectionHeading(doc, 'Biometry Measurements', y);
      y = kvGrid(doc, mkBiometryPairs(vm.biometry, vm.gestationalAgeFromBiometry), y, 3);
      y += 1;
    }
    if (visibility.doppler) {
      rule(doc, y); y += 4;
      y = sectionHeading(doc, 'Doppler Measurements', y);
      y = kvGrid(doc, mkDopplerPairs(vm.doppler), y, 3);
      y += 1;
    }
    if (visibility.ultrasoundFindings) {
      rule(doc, y); y += 4;
      y = sectionHeading(doc, 'Ultrasound Findings', y);
      y = kvGrid(doc, mkUltraPairs(vm.ultrasound), y, 3);
      y += 1;
    }
    if (visibility.anatomy) {
      rule(doc, y); y += 4;
      y = sectionHeading(doc, 'Anatomy', y);
      y = kvGrid(doc, mkAnatomyPairs(vm.anatomy), y, 3);
      y += 1;
    }
  } else {
    // ── uzd-twins: two-column layout at 8 pt ──────────────────────────────────
    // Layout: T1 at x=14, T2 at x=108, each 88 mm wide.
    // Sections rendered in pairs; y advances by max height of each pair.
    const T1_XEND = T1_X + TWIN_COL_W;
    const T2_XEND = T2_X + TWIN_COL_W;

    // Twin 1 / Twin 2 column headings
    rule(doc, y); y += 3;
    doc.setFont(FONT_ID, 'bold'); doc.setFontSize(9); setTextColor(doc, C_DARK);
    doc.text('TWIN 1', T1_X, y);
    doc.text('TWIN 2', T2_X, y);
    y += 5;

    const renderTwinSection = (
      label: string,
      pairs1: Array<[string, string | undefined]>,
      pairs2: Array<[string, string | undefined]>,
      cols = 3,
    ) => {
      const yStart = y;
      y = sectionHeadingAt(doc, label, y, T1_X, T1_XEND);
      const y1after = kvGridAt(doc, pairs1, y, cols, T1_X, TWIN_COL_W, 8);
      const yH2 = sectionHeadingAt(doc, label, yStart, T2_X, T2_XEND);
      const y2after = kvGridAt(doc, pairs2, yH2, cols, T2_X, TWIN_COL_W, 8);
      y = Math.max(y1after, y2after) + 1;
    };

    if (visibility.biometry && vm.biometry2) {
      renderTwinSection('Biometry', mkBiometryPairs(vm.biometry, vm.gestationalAgeFromBiometry), mkBiometryPairs(vm.biometry2, vm.gestationalAgeFromBiometry2));
    }
    if (visibility.doppler && vm.doppler2) {
      renderTwinSection('Doppler', mkDopplerPairs(vm.doppler), mkDopplerPairs(vm.doppler2));
    }
    if (visibility.ultrasoundFindings && vm.ultrasound2) {
      renderTwinSection('Ultrasound', mkUltraPairs(vm.ultrasound), mkUltraPairs(vm.ultrasound2), 2);
    }
    if (visibility.anatomy && vm.anatomy2) {
      renderTwinSection('Anatomy', mkAnatomyPairs(vm.anatomy), mkAnatomyPairs(vm.anatomy2));
    }
  }

  // ── 8. Clinical Information — always rendered (matches UI behaviour) ──────────
  rule(doc, y);
  y += 4;
  y = sectionHeading(doc, 'Clinical Information', y);
  y = textBlock(doc, 'Findings', vm.findings ?? 'No findings recorded.', y, 5);
  y += 2;
  y = textBlock(doc, 'Comments', vm.comments ?? '—', y, 4);
  y += 2;
  y = textBlock(doc, 'Notes', vm.notes ?? '—', y, 5);
  y += 2;

  // ── 9. Doctor Signature ──────────────────────────────────────────────────────
  // Dynamic position: pins to bottom on normal reports; overflows to page 2 when
  // clinical text is unusually long.
  let sigY = Math.max(y + 12, PAGE_H - 28);
  let totalPages = 1;
  if (sigY + 20 > PAGE_H) {
    // Content overflows page 1 — draw page-1 footer before the page break.
    const p1FooterY = PAGE_H - 8;
    rule(doc, p1FooterY - 3);
    doc.setFont(FONT_ID, 'normal');
    doc.setFontSize(6.5);
    setTextColor(doc, C_MID);
    doc.text(`Generated: ${new Date().toLocaleString('en-GB')}`, MARGIN_L, p1FooterY);
    doc.text('CONFIDENTIAL — For clinical use only', PAGE_W / 2, p1FooterY, { align: 'center' });
    doc.text('Page 1 of 2', MARGIN_R, p1FooterY, { align: 'right' });

    doc.addPage();
    sigY = 30;
    totalPages = 2;
  }

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

  // ── 10. Footer ───────────────────────────────────────────────────────────────
  const FOOTER_Y = PAGE_H - 8;
  rule(doc, FOOTER_Y - 3);

  doc.setFont(FONT_ID, 'normal');
  doc.setFontSize(6.5);
  setTextColor(doc, C_MID);
  doc.text(`Generated: ${new Date().toLocaleString('en-GB')}`, MARGIN_L, FOOTER_Y);
  doc.text('CONFIDENTIAL — For clinical use only', PAGE_W / 2, FOOTER_Y, { align: 'center' });
  doc.text(totalPages === 1 ? 'Page 1 of 1' : 'Page 2 of 2', MARGIN_R, FOOTER_Y, { align: 'right' });

  return doc;
}

// Made with Bob
