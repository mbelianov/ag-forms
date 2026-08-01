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
    ['Heart Rate', u.heartRate], ['Fetal Mvmt', u.fetalMovement],
    ['Placenta', u.placenta], ['Umbilical', u.umbilicalCord],
  ];
}

function mkAnatomyPairs(a: ExamPdfViewModel['anatomy'] | AnatomyViewModel): Array<[string, string | undefined]> {
  return [
    ['Head', a.head], ['Brain', a.brain], ['Heart', a.heart], ['Abdomen', a.abdomen],
    ['Kidneys', a.kidneys], ['Limbs', a.limbs], ['Skeleton', a.skeleton],
    ['Face', a.face], ['Neck Skin', a.neckSkin], ['Spine', a.spine], ['Thorax', a.thorax],
  ];
}

// ─── FT pair builders ────────────────────────────────────────────────────────

function mkFtBiometryPairs(b: FtBiometryViewModel): Array<[string, string | undefined]> {
  return [
    ['CRL', b.crl], ['GA from CRL', b.gaFromCrl], ['NT', b.nt], ['NB', b.nb], ['Heart Rate', b.puls],
  ];
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

  const rows: Array<[string, string | undefined]> = [
    ['Arrhythmia',              m.arrhythmia],
    ['Tricusp. Regurg.',        m.tricuspidRegurgitation],
    ['Abnorm. D.Venosus Flow',  m.abnormalDvFlow],
    ['Echogenic Cardiac Focus', m.echogenicCardiacFocus],
    ['Single Umbilical Artery', m.singleUmbilicalArtery],
    ['Choroid Plexus Cysts',    m.choroidPlexusCysts],
    ['Exomphalos',              m.exomphalos],
    ['Megacystis',              m.megacystis],
    ['Placenta',                m.placenta],
    ['Cord Insertion',          m.cordInsertion],
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
    ['Placenta', u.placenta], ['FHR', u.heartRate], ['Umbilical Cord', u.umbilicalCord],
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

  // Header row
  doc.setFont(fontId, 'normal');
  doc.setFontSize(7.5);
  setTextColor(doc, C_MID);
  doc.text('PI', xPI, y);
  doc.text('RI', xRI, y);
  y += PITCH;

  const rows: Array<{ label: string; pi: string | undefined; ri: string | undefined }> = [
    { label: 'A.ut.Dex.', pi: d.utADexPI, ri: d.utADexRI },
    { label: 'A.ut.Sin.', pi: d.utASinPI, ri: d.utASinRI },
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
 * Layout per row: label | value | percentile | (GA from Bio on BPD row)
 * Row pitch: 4.5 mm. Returns Y after all rows.
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
  // const gaW  = colW * 0.15; // GA col (not needed for positioning)

  const xValue = xStart + labelW;
  const xPct   = xStart + labelW + valueW;
  const xGA    = xStart + labelW + valueW + pctW;

  // Rows: label, value field, percentile field (all optional)
  type BioRow = { label: string; value: string | undefined; pct?: string; gaAppend?: string };
  const rows: BioRow[] = [
    { label: 'BPD',    value: b.bpd,        pct: b.bpdPct, gaAppend: gaFromBio },
    { label: 'OFD',    value: b.ofd },
    { label: 'HC',     value: b.hc,         pct: b.hcPct },
    { label: 'TAD',    value: b.tad },
    { label: 'APAD',   value: b.apad },
    { label: 'AC',     value: b.ac,         pct: b.acPct },
    { label: 'FL',     value: b.fl,         pct: b.flPct },
    { label: 'TCD',    value: b.tcd },
    { label: 'Vp',     value: b.vp },
    { label: 'CM',     value: b.cm },
    { label: 'NF',     value: b.nuchalFold },
    { label: 'NB',     value: b.nb },
    { label: 'EFW',    value: b.efw,        pct: b.efwPct },
    { label: 'LA',     value: b.la },
    { label: 'LC',     value: b.lc },
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

    // Percentile — normal, 7.5pt, muted
    if (row.pct) {
      doc.setFont(fontId, 'normal');
      doc.setFontSize(7.5);
      setTextColor(doc, C_MID);
      doc.text(row.pct, xPct, y);
    }

    // GA from Bio inline on BPD row — normal, 7.5pt, muted
    if (row.gaAppend) {
      doc.setFont(fontId, 'normal');
      doc.setFontSize(7.5);
      setTextColor(doc, C_MID);
      doc.text(row.gaAppend, xGA, y);
    }

    y += PITCH;
  }

  return y;
}

// ─── Doppler: vessel-table renderer ──────────────────────────────────────────

/**
 * Render doppler as a vessel-table matching the detail view structure:
 *   Sub-section A: header (PI | RI) + 3 vessel rows (A.ut.Dex / A.ut.Sin / A.Umb)
 *   Sub-section B: 4 single-field rows (CMA PI / PSV / CPR / Duc.Ven)
 * Row pitch: 5.5 mm. Returns Y after all rows.
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

  // ── Sub-section A: header row ────────────────────────────────────────────────
  doc.setFont(fontId, 'normal');
  doc.setFontSize(7.5);
  setTextColor(doc, C_MID);
  doc.text('PI', xPI, y);
  doc.text('RI', xRI, y);
  y += PITCH;

  // ── Sub-section A: vessel rows ───────────────────────────────────────────────
  type VesselRow = { label: string; pi: string | undefined; ri: string | undefined };
  const vesselRows: VesselRow[] = [
    { label: 'A.ut.Dex.', pi: d.utADexPI, ri: d.utADexRI },
    { label: 'A.ut.Sin.', pi: d.utASinPI, ri: d.utASinRI },
    { label: 'A.Umb.',    pi: d.pi,        ri: d.ri },
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

  // ── Sub-section B: single-field rows ─────────────────────────────────────────
  type SingleRow = { label: string; value: string | undefined };
  const singleRows: SingleRow[] = [
    { label: 'CMA PI',   value: d.cma },
    { label: 'PSV',      value: d.psv },
    { label: 'CPR',      value: d.cpr },
    { label: 'Duc.Ven',  value: d.ducVen },
  ];

  const xValue = xStart + labelW;

  // Empty line gap between vessel rows and single-field rows
  y += PITCH;

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

// ─── Main export ──────────────────────────────────────────────────────────────

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
    y = kvGrid(doc, mkFtBiometryPairs(vm.ftBiometry ?? emptyB), y, 3);
    y += 1;

    rule(doc, y); y += 4;
    y = sectionHeading(doc, 'Markers', y);
    y = renderFtMarkersBlock(doc, vm.ftMarkers ?? emptyM, y, 14, FONT_ID);
    y += 1;

    rule(doc, y); y += 4;
    y = sectionHeading(doc, 'Anatomy', y);
    y = kvGrid(doc, mkAnatomyPairs(vm.ftAnatomy ?? emptyA), y, 3);
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
    renderFtTwinSection('Biometry', mkFtBiometryPairs(vm.ftBiometry ?? emptyB), mkFtBiometryPairs(vm.twin2FtBiometry ?? emptyB));

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
    renderFtTwinSection('Anatomy', mkAnatomyPairs(vm.ftAnatomy ?? emptyA), mkAnatomyPairs(vm.twin2FtAnatomy ?? emptyA));

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
      y = kvGrid(doc, mkAnatomyPairs(vm.anatomy), y, 3);
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

    if (visibility.ultrasoundFindings && vm.ultrasound2) {
      renderTwinSection('Ultrasound', mkUltraPairs(vm.ultrasound), mkUltraPairs(vm.ultrasound2), 2);
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
      renderTwinSection('Anatomy', mkAnatomyPairs(vm.anatomy), mkAnatomyPairs(vm.anatomy2));
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
