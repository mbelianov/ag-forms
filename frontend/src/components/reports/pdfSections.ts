/**
 * pdfSections.ts — extracted from pdfDocument.ts (Sub-Task 0c).
 * Contains the pair-builder helpers and the per-fetus section renderers
 * (single-fetus and twin paths). Called by pdfDocument.ts via renderClinicalSections.
 */
import type { jsPDF } from 'jspdf';
import type { ExamPdfViewModel, BiometryViewModel, DopplerViewModel, FtBiometryViewModel, FtMarkersViewModel, FtUltrasoundViewModel, FtDopplerViewModel } from '../../services/print.service';
import type { AnatomyViewModel } from '../../services/print.service';

export interface PdfDrawHelpers {
  rule: (doc: jsPDF, y: number) => void;
  sectionHeading: (doc: jsPDF, label: string, y: number) => number;
  sectionHeadingAt: (doc: jsPDF, label: string, y: number, xStart: number, xEnd: number) => number;
  kvGrid: (doc: jsPDF, pairs: Array<[string, string | undefined]>, y: number, cols?: number) => number;
  kvGridAt: (doc: jsPDF, pairs: Array<[string, string | undefined]>, y: number, cols: number, xStart: number, colW: number, fontSize?: number) => number;
  TWIN_COL_W: number;
  TWIN_GUTTER: number;
  T1_X: number;
  T2_X: number;
  FONT_ID: string;
}

// ─── Colour constants (mirrors pdfDocument.ts) ───────────────────────────────

const C_DARK = '#161616';
const C_MID = '#525252';

function hexColor(color: string): [number, number, number] {
  return [
    parseInt(color.slice(1, 3), 16),
    parseInt(color.slice(3, 5), 16),
    parseInt(color.slice(5, 7), 16),
  ];
}

function setTextColor(doc: jsPDF, color: string) {
  doc.setTextColor(...hexColor(color));
}

// ─── Pair builders (still used by anatomy, ultrasound, FT sections) ──────────

function mkUltraPairs(u: ExamPdfViewModel['ultrasound']): Array<[string, string | undefined]> {
  return [
    ['Presentation', u.presentation], ['Gender', u.gender],
    ['FHR (bpm)', u.heartRate], ['Fetal Movement', u.fetalMovement],
    ['Placenta', u.placenta], ['Umbilical Cord', u.umbilicalCord],
  ];
}

function mkAnatomyPairs(a: ExamPdfViewModel['anatomy'] | AnatomyViewModel): Array<[string, string | undefined]> {
  return [
    ['Head', a.head], ['Brain', a.brain], ['Heart', a.heart], ['Abdomen', a.abdomen],
    ['Kidneys', a.kidneys], ['Limbs', a.limbs], ['Skeleton', a.skeleton],
    ['Face', a.face], ['Neck/Skin', a.neckSkin], ['Spine', a.spine], ['Thorax', a.thorax],
  ];
}

// ─── FT Biometry: structured 3-column renderer ───────────────────────────────

/**
 * Render FT biometry as a 3-column table: Measurement | Value | GA from CRL.
 * The "GA from CRL" column has a value only on the CRL row; other rows are blank in col 3.
 * Column proportions: label ~40%, value ~35%, GA ~25% of colW.
 * Row pitch: 3.85 mm. Returns Y after all rows.
 */
function renderFtBiometryBlock(
  doc: jsPDF,
  b: FtBiometryViewModel,
  y: number,
  xStart: number,
  colW: number,
  fontId: string,
): number {
  const PITCH = 3.85;
  const labelW = colW * 0.40;
  const valueW = colW * 0.35;
  // const gaW = colW * 0.25; // GA col — not needed for positioning

  const xValue = xStart + labelW;
  const xGA    = xStart + labelW + valueW;

  // Header row: "Measurement" | "Value" | "GA from CRL"
  doc.setFont(fontId, 'normal');
  doc.setFontSize(7);
  setTextColor(doc, C_MID);
  doc.text('Measurement', xStart, y);
  doc.text('Value',       xValue, y);
  doc.text('GA from CRL', xGA,    y);
  y += PITCH;

  // Data rows: label, value, optional GA from CRL (CRL row only)
  type FtBioRow = { label: string; value: string | undefined; ga?: string };
  const rows: FtBioRow[] = [
    { label: 'CRL (mm)',        value: b.crl,  ga: b.gaFromCrl },
    { label: 'NT (mm)',         value: b.nt },
    { label: 'NB (mm)',         value: b.nb },
    { label: 'Heart Rate (bpm)',value: b.puls },
  ];

  for (const row of rows) {
    doc.setFont(fontId, 'normal');
    doc.setFontSize(7.5);
    setTextColor(doc, C_MID);
    doc.text(row.label, xStart, y);

    doc.setFont(fontId, 'bold');
    doc.setFontSize(8);
    setTextColor(doc, C_DARK);
    doc.text(row.value || '—', xValue, y);

    if (row.ga) {
      doc.setFont(fontId, 'normal');
      doc.setFontSize(7.5);
      setTextColor(doc, C_MID);
      doc.text(row.ga, xGA, y);
    }

    y += PITCH;
  }

  return y;
}

/** Render FT markers one per line: label on the left, value to its right. Returns new Y. */
function renderFtMarkersBlock(
  doc: jsPDF,
  m: FtMarkersViewModel,
  y: number,
  xStart: number,
  fontId: string,
): number {
  const PITCH = 3.85;
  const labelW = 52;
  const xValue = xStart + labelW;

  // Header row: "Marker" | "Value"
  doc.setFont(fontId, 'normal');
  doc.setFontSize(7.5);
  setTextColor(doc, C_MID);
  doc.text('Marker', xStart, y);
  doc.text('Value', xValue, y);
  y += PITCH;

  const rows: Array<[string, string | undefined]> = [
    ['Arrhythmia',                 m.arrhythmia],
    ['Tricuspid Regurgitation',    m.tricuspidRegurgitation],
    ['Abnormal D.Venosus Flow',    m.abnormalDvFlow],
    ['Echogenic Cardiac Focus',    m.echogenicCardiacFocus],
    ['Single Umbilical Artery',    m.singleUmbilicalArtery],
    ['Choroid Plexus Cysts',       m.choroidPlexusCysts],
    ['Exomphalos',                 m.exomphalos],
    ['Megacystis',                 m.megacystis],
    ['Placenta',                   m.placenta],
    ['Cord Insertion',             m.cordInsertion],
  ];

  for (const [label, value] of rows) {
    doc.setFont(fontId, 'normal');
    doc.setFontSize(7.5);
    setTextColor(doc, C_MID);
    doc.text(label, xStart, y);
    doc.setFont(fontId, 'bold');
    doc.setFontSize(8);
    setTextColor(doc, C_DARK);
    doc.text(value || '—', xValue, y);
    y += PITCH;
  }
  return y;
}

function mkFtUltrasoundPairs(u: FtUltrasoundViewModel): Array<[string, string | undefined]> {
  return [
    ['Placenta', u.placenta], ['FHR (bpm)', u.heartRate], ['Umbilical Cord', u.umbilicalCord],
  ];
}

/** Render FT doppler as a PI | RI table matching the form layout. Returns new Y. */
function renderFtDopplerBlock(
  doc: jsPDF,
  d: FtDopplerViewModel,
  y: number,
  xStart: number,
  colW: number,
  fontId: string,
): number {
  const PITCH = 3.85;
  const labelW = colW * 0.40;
  const halfW  = (colW - labelW) / 2;
  const xPI = xStart + labelW;
  const xRI = xStart + labelW + halfW;

  // Header row: "Vessel" | "PI" | "RI"
  doc.setFont(fontId, 'normal');
  doc.setFontSize(7.5);
  setTextColor(doc, C_MID);
  doc.text('Vessel', xStart, y);
  doc.text('PI', xPI, y);
  doc.text('RI', xRI, y);
  y += PITCH;

  const rows: Array<{ label: string; pi: string | undefined; ri: string | undefined }> = [
    { label: 'A. ut. Dex.', pi: d.utADexPI, ri: d.utADexRI },
    { label: 'A. ut. Sin.', pi: d.utASinPI, ri: d.utASinRI },
  ];

  for (const row of rows) {
    doc.setFont(fontId, 'normal');
    doc.setFontSize(7.5);
    setTextColor(doc, C_MID);
    doc.text(row.label, xStart, y);
    doc.setFont(fontId, 'bold');
    doc.setFontSize(8);
    setTextColor(doc, C_DARK);
    doc.text(row.pi || '—', xPI, y);
    doc.text(row.ri || '—', xRI, y);
    y += PITCH;
  }
  return y;
}

// ─── Biometry: row-by-row renderer ───────────────────────────────────────────

/**
 * Render biometry measurements one row per measurement in vertical order.
 * Layout per row: Measurement | Value | Percentile | GA from Bio
 * Header row drawn first, then 15 data rows. Row pitch: 3.3 mm.
 * Returns Y after all rows.
 */
function renderBiometryBlock(
  doc: jsPDF,
  b: BiometryViewModel,
  gaFromBio: string | undefined,
  y: number,
  xStart: number,
  colW: number,
  fontId: string,
): number {
  const PITCH = 3.3;
  const labelW  = colW * 0.30;
  const valueW  = colW * 0.35;
  const pctW    = colW * 0.20;

  const xValue = xStart + labelW;
  const xPct   = xStart + labelW + valueW;
  const xGA    = xStart + labelW + valueW + pctW;

  // Header row: "Measurement" | "Value" | "Percentile" | "GA from Bio"
  doc.setFont(fontId, 'normal');
  doc.setFontSize(7);
  setTextColor(doc, C_MID);
  doc.text('Measurement', xStart, y);
  doc.text('Value',       xValue, y);
  doc.text('Percentile',  xPct,   y);
  doc.text('GA from Bio', xGA,    y);
  y += PITCH;

  // Rows: label (with unit), value field, percentile (or "—"), GA from Bio on BPD row only
  type BioRow = { label: string; value: string | undefined; hasPct: boolean; pct?: string; gaAppend?: string };
  const rows: BioRow[] = [
    { label: 'BPD (mm)',    value: b.bpd,        hasPct: true,  pct: b.bpdPct, gaAppend: gaFromBio },
    { label: 'OFD (mm)',    value: b.ofd,        hasPct: false },
    { label: 'HC (mm)',     value: b.hc,         hasPct: true,  pct: b.hcPct },
    { label: 'TAD (mm)',    value: b.tad,        hasPct: false },
    { label: 'APAD (mm)',   value: b.apad,       hasPct: false },
    { label: 'AC (mm)',     value: b.ac,         hasPct: true,  pct: b.acPct },
    { label: 'FL (mm)',     value: b.fl,         hasPct: true,  pct: b.flPct },
    { label: 'TCD (mm)',    value: b.tcd,        hasPct: false },
    { label: 'Vp (mm)',     value: b.vp,         hasPct: false },
    { label: 'CM (mm)',     value: b.cm,         hasPct: false },
    { label: 'NF (mm)',     value: b.nuchalFold, hasPct: false },
    { label: 'NB (mm)',     value: b.nb,         hasPct: false },
    { label: 'EFW (grams)', value: b.efw,        hasPct: true,  pct: b.efwPct },
    { label: 'LA (mm)',     value: b.la,         hasPct: false },
    { label: 'LC (mm)',     value: b.lc,         hasPct: false },
  ];

  for (const row of rows) {
    // Label — normal, 7.5pt, muted
    doc.setFont(fontId, 'normal');
    doc.setFontSize(7.5);
    setTextColor(doc, C_MID);
    doc.text(row.label, xStart, y);

    // Value — bold, 8pt, dark
    doc.setFont(fontId, 'bold');
    doc.setFontSize(8);
    setTextColor(doc, C_DARK);
    doc.text(row.value || '—', xValue, y);

    // Percentile — show value if present, "—" if this row has no percentile
    doc.setFont(fontId, 'normal');
    doc.setFontSize(7.5);
    setTextColor(doc, C_MID);
    if (row.pct) {
      doc.text(row.pct, xPct, y);
    } else {
      doc.text('—', xPct, y);
    }

    // GA from Bio — only on BPD row
    if (row.gaAppend) {
      doc.text(row.gaAppend, xGA, y);
    }

    y += PITCH;
  }

  return y;
}

// ─── Doppler: vessel-table renderer ──────────────────────────────────────────

/**
 * Render doppler as a vessel-table matching the detail view structure:
 *   Sub-grid A: header (Vessel | PI | RI) + 3 vessel rows
 *   Sub-grid B: header (Measurement | Value) + 4 single-field rows
 * Row pitch: 3.85 mm. Returns Y after all rows.
 */
function renderDopplerBlock(
  doc: jsPDF,
  d: DopplerViewModel,
  y: number,
  xStart: number,
  colW: number,
  fontId: string,
): number {
  const PITCH = 3.85;
  const labelW = colW * 0.35;
  const halfW  = (colW - labelW) / 2; // PI col width = RI col width

  const xPI = xStart + labelW;
  const xRI = xStart + labelW + halfW;

  // ── Sub-grid A: header row — "Vessel | PI | RI" ──────────────────────────────
  doc.setFont(fontId, 'normal');
  doc.setFontSize(7.5);
  setTextColor(doc, C_MID);
  doc.text('Vessel', xStart, y);
  doc.text('PI', xPI, y);
  doc.text('RI', xRI, y);
  y += PITCH;

  // ── Sub-grid A: vessel rows ───────────────────────────────────────────────────
  type VesselRow = { label: string; pi: string | undefined; ri: string | undefined };
  const vesselRows: VesselRow[] = [
    { label: 'A. ut. Dex.', pi: d.utADexPI, ri: d.utADexRI },
    { label: 'A. ut. Sin.', pi: d.utASinPI, ri: d.utASinRI },
    { label: 'A. Umb.',     pi: d.pi,       ri: d.ri },
  ];

  for (const row of vesselRows) {
    // Label
    doc.setFont(fontId, 'normal');
    doc.setFontSize(7.5);
    setTextColor(doc, C_MID);
    doc.text(row.label, xStart, y);

    // PI value
    doc.setFont(fontId, 'bold');
    doc.setFontSize(8);
    setTextColor(doc, C_DARK);
    doc.text(row.pi || '—', xPI, y);

    // RI value
    doc.text(row.ri || '—', xRI, y);

    y += PITCH;
  }

  // ── Sub-grid B: header row — "Measurement | Value" ───────────────────────────
  const xValue = xStart + labelW;
  y += PITCH;

  // ── Sub-grid B: single-field rows ────────────────────────────────────────────
  type SingleRow = { label: string; value: string | undefined };
  const singleRows: SingleRow[] = [
    { label: 'CMA PI',    value: d.cma },
    { label: 'PSV',       value: d.psv },
    { label: 'CPR',       value: d.cpr },
    { label: 'Duc. Ven.', value: d.ducVen },
  ];

  for (const row of singleRows) {
    // Label
    doc.setFont(fontId, 'normal');
    doc.setFontSize(7.5);
    setTextColor(doc, C_MID);
    doc.text(row.label, xStart, y);

    // Value
    doc.setFont(fontId, 'bold');
    doc.setFontSize(8);
    setTextColor(doc, C_DARK);
    doc.text(row.value || '—', xValue, y);

    y += PITCH;
  }

  return y;
}


/**
 * Like kvGridAt but stacked: label on line y, value centred below it at y+3.5.
 * Row pitch: 7 mm. Used for twin anatomy sections where cells are too narrow for inline layout.
 * Returns new Y after the block.
 */
function kvGridAtStacked(
  doc: jsPDF,
  pairs: Array<[string, string | undefined]>,
  y: number,
  cols: number,
  xStart: number,
  colW: number,
  fontId: string,
): number {
  const PITCH = 7;
  const cW = colW / cols;
  const visible = pairs.map(([label, value]) => [label, value || '\u2014'] as [string, string]);

  let rowY = y;
  let col = 0;

  for (const [label, value] of visible) {
    const x = xStart + col * cW;

    // Label — normal, 7 pt, muted, centred in cell
    doc.setFont(fontId, 'normal');
    doc.setFontSize(7);
    setTextColor(doc, C_MID);
    doc.text(label, x + cW / 2, rowY, { align: 'center', maxWidth: cW });

    // Value — bold, 7.5 pt, dark, centred in cell
    doc.setFont(fontId, 'bold');
    doc.setFontSize(7.5);
    setTextColor(doc, C_DARK);
    doc.text(value, x + cW / 2, rowY + 3.5, { align: 'center', maxWidth: cW });

    col++;
    if (col >= cols) {
      col = 0;
      rowY += PITCH;
    }
  }

  return col === 0 ? rowY : rowY + PITCH;
}


// ─── Main export ──────────────────────────────────────────────────────────────

/*
 * Y-BUDGET ANALYSIS (Sub-Task 8) — all measurements in mm
 * ─────────────────────────────────────────────────────────────────────────────
 * Page budget:
 *   Header bar:            22 mm
 *   Patient block:        ~26 mm  (y starts at ~52 mm)
 *   Pregnancy Data:       ~29 mm  (3 rows × 8 mm + heading 5 mm)
 *   → y at ~81 mm after Pregnancy Data
 *   Footer reserved:       15 mm  (footer + sig line buffer)
 *   Available for clinical content: 297 - 81 - 15 = ~201 mm
 *
 * Path A single-fetus section heights (rule+heading = 9 mm per section):
 *   Ultrasound Findings:   heading 9 + 2 rows × 3.85 = ~17 mm
 *   Biometry:              heading 9 + header + 15 rows × 3.3 = ~60 mm  ← largest
 *   Anatomy:               heading 9 + 2 rows × 3.85 = ~17 mm
 *   Doppler (A+B):         heading 9 + header + 3 rows + header + 4 rows = ~37 mm
 *   Total clinical A:      ~131 mm + Clinical Information + Signature (~53 mm) = ~184 mm ✓ fits
 *
 * Path B single-fetus section heights:
 *   Ultrasound Findings:   heading 9 + 1 row × 3.85 = ~13 mm
 *   Biometry:              heading 9 + header + 4 rows × 3.85 = ~28 mm
 *   Markers:               heading 9 + header + 10 rows × 3.85 = ~48 mm
 *   Anatomy:               heading 9 + 2 rows × 3.85 = ~17 mm
 *   Doppler:               heading 9 + header + 2 rows × 3.85 = ~20 mm
 *   Total clinical B:      ~126 mm + Clinical Information + Signature (~53 mm) = ~179 mm ✓ fits
 *
 * Both paths fit within the ~201 mm available budget. PITCH values remain at
 * PITCH=3.3 mm (Biometry) and PITCH=3.85 mm (Doppler/Markers/FT-Biometry).
 * If overflow is detected at runtime (sigYIdeal > SIG_MAX in pdfDocument.ts),
 * reduce Biometry PITCH to 3.0 and Doppler/Markers PITCH to 3.5 per Sub-Task 8.
 */

/**
 * Render all clinical sections (UF → Bio → Anatomy → Doppler) for single-fetus
 * or twins exam. Returns updated Y position after all sections are drawn.
 */
export function renderClinicalSections(
  doc: jsPDF,
  vm: ExamPdfViewModel,
  y: number,
  visibility: ReturnType<typeof import('../../constants/examinationTypes').getSectionVisibility>,
  isTwins: boolean,
  helpers: PdfDrawHelpers,
  isFt = false,
  isFtTwins = false,
): number {
  const { rule, sectionHeading, sectionHeadingAt, kvGrid, kvGridAt, TWIN_COL_W, T1_X, T2_X, FONT_ID } = helpers;

  // ── UZPT single-fetus FT layout ──────────────────────────────────────────────
  if (isFt && !isFtTwins) {
    const emptyU: FtUltrasoundViewModel = {};
    const emptyB: FtBiometryViewModel   = {};
    const emptyM: FtMarkersViewModel    = {};
    const emptyA: AnatomyViewModel      = {};
    const emptyD: FtDopplerViewModel    = {};

    rule(doc, y); y += 4;
    y = sectionHeading(doc, 'Ultrasound', y);
    y = kvGrid(doc, mkFtUltrasoundPairs(vm.ftUltrasound ?? emptyU), y, 3);
    y += 1;

    rule(doc, y); y += 4;
    y = sectionHeading(doc, 'Biometry', y);
    y = renderFtBiometryBlock(doc, vm.ftBiometry ?? emptyB, y, 14, 182, FONT_ID);
    y += 1;

    rule(doc, y); y += 4;
    y = sectionHeading(doc, 'Markers', y);
    y = renderFtMarkersBlock(doc, vm.ftMarkers ?? emptyM, y, 14, FONT_ID);
    y += 1;

    rule(doc, y); y += 4;
    y = sectionHeading(doc, 'Anatomy', y);
    y = kvGrid(doc, mkAnatomyPairs(vm.ftAnatomy ?? emptyA), y, 6);
    y += 1;

    rule(doc, y); y += 4;
    y = sectionHeading(doc, 'Doppler', y);
    y = renderFtDopplerBlock(doc, vm.ftDoppler ?? emptyD, y, 14, 182, FONT_ID);
    y += 1;

    return y;
  }

  // ── UZPT twins FT layout ─────────────────────────────────────────────────────
  if (isFtTwins) {
    const T1_XEND = T1_X + TWIN_COL_W;
    const T2_XEND = T2_X + TWIN_COL_W;

    rule(doc, y); y += 3;
    doc.setFont(FONT_ID, 'bold');
    doc.setFontSize(9);
    doc.setTextColor(22, 22, 22);
    doc.text('TWIN 1', T1_X, y);
    doc.text('TWIN 2', T2_X, y);
    y += 5;

    const emptyU: FtUltrasoundViewModel = {};
    const emptyB: FtBiometryViewModel   = {};
    const emptyM: FtMarkersViewModel    = {};
    const emptyA: AnatomyViewModel      = {};
    const emptyD: FtDopplerViewModel    = {};

    const renderFtTwinSection = (
      label: string,
      pairs1: Array<[string, string | undefined]>,
      pairs2: Array<[string, string | undefined]>,
      cols = 2,
    ) => {
      const yStart = y;
      y = sectionHeadingAt(doc, label, y, T1_X, T1_XEND);
      const y1after = kvGridAt(doc, pairs1, y, cols, T1_X, TWIN_COL_W, 8);
      const yH2 = sectionHeadingAt(doc, label, yStart, T2_X, T2_XEND);
      const y2after = kvGridAt(doc, pairs2, yH2, cols, T2_X, TWIN_COL_W, 8);
      y = Math.max(y1after, y2after) + 1;
    };

    rule(doc, y); y += 4;
    renderFtTwinSection('Ultrasound', mkFtUltrasoundPairs(vm.ftUltrasound ?? emptyU), mkFtUltrasoundPairs(vm.twin2FtUltrasound ?? emptyU));

    rule(doc, y); y += 4;
    {
      const yStart = y;
      y = sectionHeadingAt(doc, 'Biometry', y, T1_X, T1_XEND);
      const y1after = renderFtBiometryBlock(doc, vm.ftBiometry ?? emptyB, y, T1_X, TWIN_COL_W, FONT_ID);
      const yH2 = sectionHeadingAt(doc, 'Biometry', yStart, T2_X, T2_XEND);
      const y2after = renderFtBiometryBlock(doc, vm.twin2FtBiometry ?? emptyB, yH2, T2_X, TWIN_COL_W, FONT_ID);
      y = Math.max(y1after, y2after) + 1;
    }

    rule(doc, y); y += 4;
    {
      const yStart = y;
      y = sectionHeadingAt(doc, 'Markers', y, T1_X, T1_XEND);
      const y1after = renderFtMarkersBlock(doc, vm.ftMarkers ?? emptyM, y, T1_X, FONT_ID);
      const yH2 = sectionHeadingAt(doc, 'Markers', yStart, T2_X, T2_XEND);
      const y2after = renderFtMarkersBlock(doc, vm.twin2FtMarkers ?? emptyM, yH2, T2_X, FONT_ID);
      y = Math.max(y1after, y2after) + 1;
    }

    rule(doc, y); y += 4;
    {
      const yStart = y;
      y = sectionHeadingAt(doc, 'Anatomy', y, T1_X, T1_XEND);
      const y1after = kvGridAtStacked(doc, mkAnatomyPairs(vm.ftAnatomy ?? emptyA), y, 6, T1_X, TWIN_COL_W, FONT_ID);
      const yH2 = sectionHeadingAt(doc, 'Anatomy', yStart, T2_X, T2_XEND);
      const y2after = kvGridAtStacked(doc, mkAnatomyPairs(vm.twin2FtAnatomy ?? emptyA), yH2, 6, T2_X, TWIN_COL_W, FONT_ID);
      y = Math.max(y1after, y2after) + 1;
    }

    rule(doc, y); y += 4;
    {
      const yStart = y;
      y = sectionHeadingAt(doc, 'Doppler', y, T1_X, T1_XEND);
      const y1after = renderFtDopplerBlock(doc, vm.ftDoppler ?? emptyD, y, T1_X, TWIN_COL_W, FONT_ID);
      const yH2 = sectionHeadingAt(doc, 'Doppler', yStart, T2_X, T2_XEND);
      const y2after = renderFtDopplerBlock(doc, vm.twin2FtDoppler ?? emptyD, yH2, T2_X, TWIN_COL_W, FONT_ID);
      y = Math.max(y1after, y2after) + 1;
    }
    return y;
  }

  if (!isTwins) {
    // ── Single-fetus layout — HF-1 order: UF → Bio → Anatomy → Doppler ────────
    if (visibility.ultrasoundFindings) {
      rule(doc, y); y += 4;
      y = sectionHeading(doc, 'Ultrasound Findings', y);
      y = kvGrid(doc, mkUltraPairs(vm.ultrasound), y, 3);
      y += 1;
    }
    if (visibility.biometry) {
      rule(doc, y); y += 4;
      y = sectionHeading(doc, 'Biometry Measurements', y);
      y = renderBiometryBlock(doc, vm.biometry, vm.gestationalAgeFromBiometry, y, 14, 182, FONT_ID);
      y += 1;
    }
    if (visibility.anatomy) {
      rule(doc, y); y += 4;
      y = sectionHeading(doc, 'Anatomy', y);
      y = kvGrid(doc, mkAnatomyPairs(vm.anatomy), y, 6);
      y += 1;
    }
    if (visibility.doppler) {
      rule(doc, y); y += 4;
      y = sectionHeading(doc, 'Doppler Measurements', y);
      y = renderDopplerBlock(doc, vm.doppler, y, 14, 182, FONT_ID);
      y += 1;
    }
  } else {
    // ── uzd-twins: two-column layout — HF-1 order: UF → Bio → Anatomy → Doppler
    const T1_XEND = T1_X + TWIN_COL_W;
    const T2_XEND = T2_X + TWIN_COL_W;

    // Twin 1 / Twin 2 column headings
    rule(doc, y); y += 3;
    doc.setFont(FONT_ID, 'bold');
    doc.setFontSize(9);
    doc.setTextColor(22, 22, 22); // C_DARK = '#161616'
    doc.text('TWIN 1', T1_X, y);
    doc.text('TWIN 2', T2_X, y);
    y += 5;

    if (visibility.ultrasoundFindings && vm.ultrasound2) {
      const yStart = y;
      y = sectionHeadingAt(doc, 'Ultrasound', y, T1_X, T1_XEND);
      const y1after = kvGridAt(doc, mkUltraPairs(vm.ultrasound), y, 2, T1_X, TWIN_COL_W, 7);
      const yH2 = sectionHeadingAt(doc, 'Ultrasound', yStart, T2_X, T2_XEND);
      const y2after = kvGridAt(doc, mkUltraPairs(vm.ultrasound2), yH2, 2, T2_X, TWIN_COL_W, 7);
      y = Math.max(y1after, y2after) + 1;
    }
    if (visibility.biometry && vm.biometry2) {
      // Twin biometry: render side-by-side using renderBiometryBlock
      const yStart = y;
      y = sectionHeadingAt(doc, 'Biometry', y, T1_X, T1_XEND);
      const y1after = renderBiometryBlock(doc, vm.biometry, vm.gestationalAgeFromBiometry, y, T1_X, TWIN_COL_W, FONT_ID);
      const yH2 = sectionHeadingAt(doc, 'Biometry', yStart, T2_X, T2_XEND);
      const y2after = renderBiometryBlock(doc, vm.biometry2, vm.gestationalAgeFromBiometry2, yH2, T2_X, TWIN_COL_W, FONT_ID);
      y = Math.max(y1after, y2after) + 1;
    }
    if (visibility.anatomy && vm.anatomy2) {
      const yStart = y;
      y = sectionHeadingAt(doc, 'Anatomy', y, T1_X, T1_XEND);
      const y1after = kvGridAtStacked(doc, mkAnatomyPairs(vm.anatomy), y, 6, T1_X, TWIN_COL_W, FONT_ID);
      const yH2 = sectionHeadingAt(doc, 'Anatomy', yStart, T2_X, T2_XEND);
      const y2after = kvGridAtStacked(doc, mkAnatomyPairs(vm.anatomy2), yH2, 6, T2_X, TWIN_COL_W, FONT_ID);
      y = Math.max(y1after, y2after) + 1;
    }
    if (visibility.doppler && vm.doppler2) {
      // Twin doppler: render side-by-side using renderDopplerBlock
      const yStart = y;
      y = sectionHeadingAt(doc, 'Doppler', y, T1_X, T1_XEND);
      const y1after = renderDopplerBlock(doc, vm.doppler, y, T1_X, TWIN_COL_W, FONT_ID);
      const yH2 = sectionHeadingAt(doc, 'Doppler', yStart, T2_X, T2_XEND);
      const y2after = renderDopplerBlock(doc, vm.doppler2, yH2, T2_X, TWIN_COL_W, FONT_ID);
      y = Math.max(y1after, y2after) + 1;
    }
  }

  return y;
}

// Made with Bob
