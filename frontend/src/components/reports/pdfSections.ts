/**
 * pdfSections.ts — ST-08 rewrite.
 * Replaced flat twin/FT model with FetusPdfViewModel pair-loop (§13.4).
 *
 * Exports:
 *   - PdfDrawHelpers (TWIN_COL_W/T1_X/T2_X removed — layout passed via PairLayout)
 *   - PairLayout — computed by computePairLayout
 *   - chunkFetuses — splits fetuses into pairs (max 2 per page)
 *   - computePairLayout — derives x positions and colW for 1 or 2 fetuses
 *   - renderClinicalSectionsPair — renders one pair of fetuses
 */
import type { jsPDF } from 'jspdf';
import { EXAM_TYPE_CONFIG } from '../../constants/examinationTypes';
import type { ExamPdfViewModel, FetusPdfViewModel } from '../../services/print.service';

// ─── PdfDrawHelpers ───────────────────────────────────────────────────────────

export interface PdfDrawHelpers {
  rule: (doc: jsPDF, y: number) => void;
  sectionHeading: (doc: jsPDF, label: string, y: number) => number;
  sectionHeadingAt: (doc: jsPDF, label: string, y: number, xStart: number, xEnd: number) => number;
  kvGrid: (doc: jsPDF, pairs: Array<[string, string | undefined]>, y: number, cols?: number) => number;
  kvGridAt: (doc: jsPDF, pairs: Array<[string, string | undefined]>, y: number, cols: number, xStart: number, colW: number, fontSize?: number) => number;
  FONT_ID: string;
}

// ─── PairLayout ───────────────────────────────────────────────────────────────

export interface PairLayout {
  colW: number;               // width of each fetus column (always 88 mm)
  xStart: number[];           // x left edge for each column in the pair
  xEnd: number[];             // x right edge for each column in the pair
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

// ─── chunkFetuses ─────────────────────────────────────────────────────────────

/**
 * Split a FetusPdfViewModel array into groups of at most 2.
 * chunkFetuses([F1, F2, F3]) === [[F1, F2], [F3]]
 * chunkFetuses([F1])         === [[F1]]
 */
export function chunkFetuses(fetuses: FetusPdfViewModel[]): FetusPdfViewModel[][] {
  const chunks: FetusPdfViewModel[][] = [];
  for (let i = 0; i < fetuses.length; i += 2) {
    chunks.push(fetuses.slice(i, i + 2));
  }
  // Guarantee at least one chunk even for empty arrays
  if (chunks.length === 0) chunks.push([]);
  return chunks;
}

// ─── computePairLayout ───────────────────────────────────────────────────────

const MARGIN_L = 14;
const COL_W_TWIN = 88;   // mm — each fetus column width (same as legacy TWIN_COL_W)
const TWIN_GUTTER = 6;   // mm — gap between twin columns

/**
 * Compute x positions for a pair of 1 or 2 fetuses.
 * Single fetus: xStart=[14], xEnd=[102] (colW=88 mm)
 * Two fetuses:  xStart=[14, 108], xEnd=[102, 196] (88 mm each, 6 mm gutter)
 */
export function computePairLayout(pairSize: number): PairLayout {
  const colW = COL_W_TWIN;
  if (pairSize <= 1) {
    return {
      colW,
      xStart: [MARGIN_L],
      xEnd: [MARGIN_L + colW],
    };
  }
  return {
    colW,
    xStart: [MARGIN_L, MARGIN_L + colW + TWIN_GUTTER],
    xEnd: [MARGIN_L + colW, MARGIN_L + colW + TWIN_GUTTER + colW],
  };
}

// ─── Anatomy & Ultrasound pair builders (Config-driven) ───────────────────────

function mkAnatomyPairs(a: FetusPdfViewModel['anatomy'], examType = 'prenatal'): Array<[string, string | undefined]> {
  if (!a) return [];
  const config = EXAM_TYPE_CONFIG[examType] ?? EXAM_TYPE_CONFIG['prenatal'];
  return config.anatomyTypes.map(tc => [tc.label, a[tc.key]]);
}

function mkUltrasoundPairs(u: FetusPdfViewModel['ultrasound'], examType = 'prenatal'): Array<[string, string | undefined]> {
  if (!u) return [];
  const config = EXAM_TYPE_CONFIG[examType] ?? EXAM_TYPE_CONFIG['prenatal'];
  return config.ultrasoundFindingTypes.map(tc => {
    const val = u[tc.key];
    const label = tc.unit && tc.inputType === 'text' && tc.key === 'heart_rate' ? 'FHR (bpm)' : tc.label;
    return [label, val];
  });
}

// ─── Biometry row-by-row renderer ─────────────────────────────────────────────

/**
 * Render biometry measurements as a 4-column table:
 *   Measurement | Value | Percentile | GA
 * Rows come from fetus.biometry (ObservablePdfEntry[]).
 */
function renderBiometryBlock(
  doc: jsPDF,
  fetus: FetusPdfViewModel,
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

  // Header row
  doc.setFont(fontId, 'normal');
  doc.setFontSize(7);
  setTextColor(doc, C_MID);
  doc.text('Measurement', xStart, y);
  doc.text('Value',       xValue, y);
  doc.text('Percentile',  xPct,   y);
  doc.text('GA',          xGA,    y);
  y += PITCH;

  for (const entry of fetus.biometry) {
    // Label
    doc.setFont(fontId, 'normal');
    doc.setFontSize(7.5);
    setTextColor(doc, C_MID);
    doc.text(entry.label, xStart, y);

    // Value
    doc.setFont(fontId, 'bold');
    doc.setFontSize(8);
    setTextColor(doc, C_DARK);
    doc.text(entry.value || '—', xValue, y);

    // Percentile
    doc.setFont(fontId, 'normal');
    doc.setFontSize(7.5);
    setTextColor(doc, C_MID);
    doc.text(entry.percentile ?? '—', xPct, y);

    // GA — only if present
    if (entry.ga) {
      doc.text(entry.ga, xGA, y);
    }

    y += PITCH;
  }

  if (fetus.biometry.length > 0) y -= PITCH / 2;
  return y;
}

// ─── Doppler vessel-table renderer ────────────────────────────────────────────

function renderDopplerBlock(
  doc: jsPDF,
  fetus: FetusPdfViewModel,
  y: number,
  xStart: number,
  colW: number,
  fontId: string,
  examType = 'prenatal',
): number {
  if (fetus.doppler.length === 0) return y;

  const PITCH = 3.85;
  const labelW = colW * 0.35;
  const halfW  = (colW - labelW) / 2;

  const xPI = xStart + labelW;
  const xRI = xStart + labelW + halfW;
  const config = EXAM_TYPE_CONFIG[examType] ?? EXAM_TYPE_CONFIG['prenatal'];
  const dopplerMap = new Map<string, string | undefined>(fetus.doppler.map(d => [d.type, d.value]));

  // Pair vessel configs in chunks of 2: [PI, RI]
  const vesselPairs: [import('../../types').ObservableTypeConfig, import('../../types').ObservableTypeConfig][] = [];
  for (let i = 0; i + 1 < config.dopplerVessels.length; i += 2) {
    vesselPairs.push([config.dopplerVessels[i], config.dopplerVessels[i + 1]]);
  }

  if (vesselPairs.length > 0) {
    // Header: Vessel | PI | RI
    doc.setFont(fontId, 'normal');
    doc.setFontSize(7.5);
    setTextColor(doc, C_MID);
    doc.text('Vessel', xStart, y);
    doc.text('PI', xPI, y);
    doc.text('RI', xRI, y);
    y += PITCH;

    for (const [piConfig, riConfig] of vesselPairs) {
      const piVal = dopplerMap.get(piConfig.type) || '—';
      const riVal = dopplerMap.get(riConfig.type) || '—';
      const vesselLabel = piConfig.label.replace(/\s*PI$/i, '').trim();

      doc.setFont(fontId, 'normal');
      doc.setFontSize(7.5);
      setTextColor(doc, C_MID);
      doc.text(vesselLabel, xStart, y);
      doc.setFont(fontId, 'bold');
      doc.setFontSize(8);
      setTextColor(doc, C_DARK);
      doc.text(piVal, xPI, y);
      doc.text(riVal, xRI, y);
      y += PITCH;
    }
    y -= PITCH / 2;
  }

  const singleEntries = config.dopplerSingle;

  if (singleEntries.length > 0) {
    const xValue = xStart + labelW;
    y += PITCH;

    for (const tc of singleEntries) {
      const val = dopplerMap.get(tc.type) || '—';
      doc.setFont(fontId, 'normal');
      doc.setFontSize(7.5);
      setTextColor(doc, C_MID);
      doc.text(tc.label, xStart, y);
      doc.setFont(fontId, 'bold');
      doc.setFontSize(8);
      setTextColor(doc, C_DARK);
      doc.text(val, xValue, y);
      y += PITCH;
    }
    y -= PITCH / 2;
  }

  return y;
}

// ─── Markers renderer (first trimester) ────────────────────────────────────────

function renderMarkersBlock(
  doc: jsPDF,
  markers: NonNullable<FetusPdfViewModel['markers']>,
  y: number,
  xStart: number,
  fontId: string,
  examType = 'first_trimester',
): number {
  const PITCH = 3.85;
  const labelW = 52;
  const xValue = xStart + labelW;
  const config = EXAM_TYPE_CONFIG[examType] ?? EXAM_TYPE_CONFIG['first_trimester'];

  doc.setFont(fontId, 'normal');
  doc.setFontSize(7.5);
  setTextColor(doc, C_MID);
  doc.text('Marker', xStart, y);
  doc.text('Value', xValue, y);
  y += PITCH;

  const rows: Array<[string, string | undefined]> = config.markerTypes.map(mt => [
    mt.label,
    markers[mt.key],
  ]);

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
  y -= PITCH / 2;
  return y;
}

// ─── kvGridAtStacked ─────────────────────────────────────────────────────────

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
    doc.setFont(fontId, 'normal');
    doc.setFontSize(7);
    setTextColor(doc, C_MID);
    doc.text(label, x + cW / 2, rowY, { align: 'center', maxWidth: cW });
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

// ─── renderClinicalSectionsPair ───────────────────────────────────────────────

/**
 * Render all clinical sections for one pair of fetuses (1 or 2).
 * Section order: Ultrasound Findings → Biometry → Anatomy → Doppler [→ Markers if FT]
 * Returns updated Y after all sections.
 */
export function renderClinicalSectionsPair(
  doc: jsPDF,
  vm: ExamPdfViewModel,
  pair: FetusPdfViewModel[],
  layout: PairLayout,
  y: number,
  helpers: PdfDrawHelpers,
): number {
  const { rule, sectionHeadingAt, kvGridAt, FONT_ID } = helpers;
  const { colW, xStart, xEnd } = layout;
  const isFt = vm.examinationType === 'first_trimester';

  // Helper: render a section for each fetus in the pair side-by-side
  const renderPairSection = (
    label: string,
    renderFn: (fetus: FetusPdfViewModel, xS: number, xE: number) => number,
  ) => {
    rule(doc, y); y += 4;
    const yStart = y;
    let maxY = yStart;

    for (let i = 0; i < pair.length; i++) {
      const y1 = sectionHeadingAt(doc, pair.length > 1 ? `${label} — Fetus ${pair[i].index + 1}` : label, yStart, xStart[i], xEnd[i]);
      const yAfter = renderFn(pair[i], xStart[i], xEnd[i]);
      if (yAfter > maxY) maxY = yAfter;
      y = y1; // y is only used to start rendering in renderFn; maxY tracks real bottom
    }

    y = maxY + 1;
  };

  // ── Ultrasound Findings ──────────────────────────────────────────────────────
  const hasUF = pair.some(f => f.ultrasound && Object.values(f.ultrasound).some(Boolean));
  if (hasUF) {
    renderPairSection('Ultrasound Findings', (fetus, xS) => {
      const pairs = mkUltrasoundPairs(fetus.ultrasound);
      return kvGridAt(doc, pairs, sectionHeadingAt(doc, '', y + 4, xS, xS + colW) - 5 + 5, 2, xS, colW, 7);
    });
  } else {
    // Render with empty fields
    rule(doc, y); y += 4;
    const yStart = y;
    let maxY = yStart;
    for (let i = 0; i < pair.length; i++) {
      const heading = pair.length > 1 ? `Ultrasound Findings — Fetus ${pair[i].index + 1}` : 'Ultrasound Findings';
      const y1 = sectionHeadingAt(doc, heading, yStart, xStart[i], xEnd[i]);
      const ySec = kvGridAt(doc, mkUltrasoundPairs(pair[i].ultrasound, vm.examinationType), y1, 2, xStart[i], colW, 7);
      if (ySec > maxY) maxY = ySec;
    }
    y = maxY + 1;
  }

  // ── Biometry ─────────────────────────────────────────────────────────────────
  {
    rule(doc, y); y += 4;
    const yStart = y;
    let maxY = yStart;
    for (let i = 0; i < pair.length; i++) {
      const label = pair.length > 1 ? `Biometry — Fetus ${pair[i].index + 1}` : 'Biometry Measurements';
      const y1 = sectionHeadingAt(doc, label, yStart, xStart[i], xEnd[i]);
      const yAfter = renderBiometryBlock(doc, pair[i], y1, xStart[i], colW, FONT_ID);
      if (yAfter > maxY) maxY = yAfter;
    }
    y = maxY + 1;
  }

  // ── Markers (first trimester only) ───────────────────────────────────────────
  if (isFt) {
    rule(doc, y); y += 4;
    const yStart = y;
    let maxY = yStart;
    for (let i = 0; i < pair.length; i++) {
      const label = pair.length > 1 ? `Markers — Fetus ${pair[i].index + 1}` : 'Markers';
      const y1 = sectionHeadingAt(doc, label, yStart, xStart[i], xEnd[i]);
      const markers = pair[i].markers ?? {};
      const yAfter = renderMarkersBlock(doc, markers, y1, xStart[i], FONT_ID, vm.examinationType);
      if (yAfter > maxY) maxY = yAfter;
    }
    y = maxY + 1;
  }

  // ── Anatomy ───────────────────────────────────────────────────────────────────
  {
    rule(doc, y); y += 4;
    const yStart = y;
    let maxY = yStart;
    for (let i = 0; i < pair.length; i++) {
      const label = pair.length > 1 ? `Anatomy — Fetus ${pair[i].index + 1}` : 'Anatomy';
      const y1 = sectionHeadingAt(doc, label, yStart, xStart[i], xEnd[i]);
      const yAfter = kvGridAtStacked(doc, mkAnatomyPairs(pair[i].anatomy, vm.examinationType), y1, 6, xStart[i], colW, FONT_ID);
      if (yAfter > maxY) maxY = yAfter;
    }
    y = maxY + 1;
  }

  // ── Doppler ───────────────────────────────────────────────────────────────────
  {
    rule(doc, y); y += 4;
    const yStart = y;
    let maxY = yStart;
    for (let i = 0; i < pair.length; i++) {
      const label = pair.length > 1 ? `Doppler — Fetus ${pair[i].index + 1}` : 'Doppler Measurements';
      const y1 = sectionHeadingAt(doc, label, yStart, xStart[i], xEnd[i]);
      const yAfter = renderDopplerBlock(doc, pair[i], y1, xStart[i], colW, FONT_ID, vm.examinationType);
      if (yAfter > maxY) maxY = yAfter;
    }
    y = maxY + 1;
  }

  // Single-fetus convenience — use full-width kvGrid for anatomy/ultrasound
  // (already handled above via sectionHeadingAt with same xStart/xEnd for single)

  return y;
}

// Made with Bob
