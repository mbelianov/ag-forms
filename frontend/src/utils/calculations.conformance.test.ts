// ============================================================================
// FILE: frontend/src/utils/calculations.conformance.test.ts
// PURPOSE: Auto-executable Vitest conformance assessment for biometry formulas.
//
// HOW TO USE
// ----------
// 1. Run:
//    cd frontend && npx vitest run src/utils/calculations.conformance.test.ts --reporter=verbose 2>&1
//
// 2. Results are written to two files (created/overwritten on each run):
//    docs2/conformance-results.txt  — human-readable ASCII tables
//    docs2/conformance-results.csv  — CSV for spreadsheet analysis
//
// NO TEST IN THIS FILE EVER FAILS. Every it() block ends with expect(true).toBe(true).
// The purpose is solely to emit the comparison tables to file for human review.
//
// REFERENCE SOURCES
// -----------------
// GE:  GE LOGIQ 500 Advanced Reference Manual, Chapter 18 OB Tables
//      - Table 18-8  BPD : Hadlock (Radiology 1984, vol 152:497)
//      - Table 18-7  AC  : Hadlock (Radiology 1984, vol 152:497)
//      - Table 18-10 FL  : Hadlock (Radiology 1984, vol 152:497)
//      - Table 18-11 HC  : Hadlock (Radiology 1984, vol 152:497)
//      - Table 18-18 OFD : Hansmann
// P31: perinatology.com Fetal Biometry Calculator 3.1
//      URL: https://perinatology.com/calculators/Fetal%20Biometry%203.0.html
//      NOTE: P3.1 gives PERCENTILE at a given GA+measurement, not GA-from-measurement.
//            REF_P31_*_PCT arrays contain percentile output for the paired input GA.
//            EFW at 16w uses Combs mean; >99th percentile represented as 99.
// P50: perinatology.com Fetal Biometry 5.0
//      URL: https://perinatology.com/calculators/Fetal%20Biometry%205.0.html
//      NOTE: Gives median-equivalent GA and percentile.
//            BPD/HC/AC/FL SD models differ from app (fixed absolute vs proportional CV).
//            TCD uses Goldstein nomogram (not Chang 2000 or Pinar 2002).
//            EFW uses Hadlock 1991 p50 normative table + sigma_ln=0.127.
//
// DATA COLLECTION DATE: 2025-07 (reference data collected by automated browser scripting)
//
// See docs2/biometry-formula-test-plan.md for the full assessment plan.
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect, afterAll } from 'vitest';
import {
  calcGAFromBPD,
  calcBPDPercentile,
  calcGAFromHC,
  calcHCPercentile,
  calcGAFromAC,
  calcACPercentile,
  calcGAFromFL,
  calcFLPercentile,
  calcGAFromOFD,
  calcOFDPercentile,
  calcEFW,
  calcGAFromEFW,
  calcEFWPercentile,
  calcGAFromTCD,
  calcTCDPercentile,
} from './calculations';

// ---------------------------------------------------------------------------
// Output buffers — accumulated across all it() blocks, written in afterAll.
// ---------------------------------------------------------------------------
const OUT_DIR = path.resolve(__dirname, '../../../docs2');
const txtLines: string[] = [];
const csvRows: string[][] = [];
let csvHeaderWritten = false;

function str(v: unknown): string {
  if (v === null || v === undefined) return '—';
  return String(v);
}

/** Append a section heading to TXT only. */
function writeHeading(title: string): void {
  txtLines.push('');
  txtLines.push('='.repeat(72));
  txtLines.push(title);
  txtLines.push('='.repeat(72));
}

/** Append a note line to TXT only. */
function writeNote(note: string): void {
  txtLines.push('  ' + note);
}

/**
 * Append a table of row objects to both TXT and CSV.
 * TXT: fixed-width ASCII table.
 * CSV: one header row (first table in file), then data rows.
 *      A "Section" column is prepended so all sections share one sheet.
 */
function writeTable(sectionLabel: string, rows: Record<string, unknown>[]): void {
  if (rows.length === 0) return;
  const keys = Object.keys(rows[0]);

  // --- TXT ---
  const colWidths = keys.map(k =>
    Math.max(k.length, ...rows.map(r => str(r[k]).length))
  );
  const sep = '+' + colWidths.map(w => '-'.repeat(w + 2)).join('+') + '+';
  const header = '|' + keys.map((k, i) => ' ' + k.padEnd(colWidths[i]) + ' ').join('|') + '|';
  txtLines.push(sep, header, sep);
  for (const row of rows) {
    const line = '|' + keys.map((k, i) => ' ' + str(row[k]).padEnd(colWidths[i]) + ' ').join('|') + '|';
    txtLines.push(line);
  }
  txtLines.push(sep);

  // --- CSV ---
  const csvEscape = (v: unknown) => {
    const s = str(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? '"' + s.replace(/"/g, '""') + '"'
      : s;
  };
  if (!csvHeaderWritten) {
    csvRows.push(['Section', ...keys]);
    csvHeaderWritten = true;
  }
  for (const row of rows) {
    csvRows.push([sectionLabel, ...keys.map(k => csvEscape(row[k]))]);
  }
  // Blank separator row in CSV between sections
  csvRows.push([]);
}

// ---------------------------------------------------------------------------
// Helper: compute delta in whole days between two "Xw Yd" strings.
// Returns null if either value is null/undefined.
// ---------------------------------------------------------------------------
function gaDeltaDays(appGa: string | undefined, refGa: string | null): number | null {
  if (!appGa || refGa === null) return null;
  const parse = (s: string) => {
    const m = s.match(/(\d+)w\s*(\d+)d/);
    return m ? parseInt(m[1]) * 7 + parseInt(m[2]) : null;
  };
  const a = parse(appGa);
  const b = parse(refGa);
  if (a === null || b === null) return null;
  return a - b;
}

// ---------------------------------------------------------------------------
// afterAll — write both output files once all tests have run.
// ---------------------------------------------------------------------------
afterAll(() => {
  const txtPath = path.join(OUT_DIR, 'conformance-results.txt');
  const csvPath = path.join(OUT_DIR, 'conformance-results.csv');
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(txtPath, txtLines.join('\n') + '\n', 'utf8');
  fs.writeFileSync(csvPath, csvRows.map(r => r.join(',')).join('\n') + '\n', 'utf8');
  console.log('\nConformance results written to:');
  console.log('  TXT:', txtPath);
  console.log('  CSV:', csvPath);
});

// ---------------------------------------------------------------------------
// SECTION 1 — BPD
// ---------------------------------------------------------------------------
describe('FORM-4 BPD — GA-from-measurement and percentile', () => {
  // 12 BPD values in mm, spanning ~14w to ~38w
  const INPUT_BPD_MM = [25, 35, 44, 50, 55, 62, 70, 75, 80, 85, 89, 93];

  // Paired round GAs for percentile calculation (one per BPD input, same order)
  // These are the app-computed GAs for each BPD value (used as GA input to percentile fn)
  const INPUT_BPD_PERC_GA = [
    '14w 2d', '16w 6d', '19w 3d', '21w 1d', '22w 6d', '25w 2d',
    '28w 1d', '30w 1d', '32w 1d', '34w 2d', '36w 0d', '37w 6d',
  ];

  // --- GE Manual Table 18-8 BPD : Hadlock (Radiology 1984) ---
  // Format: "Xw Yd" interpolated from the table's decimal-week entries
  const REF_GE_BPD_GA: (string | null)[] = [
    '14w 2d', '16w 6d', '19w 3d', '21w 1d', '22w 6d', '25w 2d',
    '28w 1d', '30w 1d', '32w 1d', '34w 2d', '36w 0d', '37w 6d',
  ];

  // --- perinatology.com 3.1: percentile at each BPD + paired GA ---
  // Button: BPD (Hadlock formula: BPD = -3.08 + 0.41*MA - 0.000061*MA^3)
  const REF_P31_BPD_PCT: (number | null)[] = [
    37, 45, 45, 49, 42, 37, 37, 36, 41, 47, 59, 71,
  ];

  // --- perinatology.com 5.0: median-equivalent GA and percentile ---
  // Field: bpd; SD model: fixed 0.30 cm (not proportional CV)
  const REF_P50_BPD_MEDIAN_GA: (string | null)[] = [
    '14w 0d', '16w 5d', '19w 2d', '21w 1d', '22w 5d', '25w 0d',
    '27w 5d', '29w 5d', '31w 6d', '34w 1d', '36w 3d', '39w 0d',
  ];
  const REF_P50_BPD_PERCENTILE: (number | null)[] = [
    37.0, 44.8, 44.9, 48.4, 41.7, 36.8, 37.1, 36.0, 40.4, 47.5, 58.7, 71.2,
  ];

  it('BPD GA-from-measurement: app vs GE manual vs perinatology.com 5.0', () => {
    const rows = INPUT_BPD_MM.map((bpd, i) => {
      const appGa = calcGAFromBPD(bpd);
      const deltaGe = gaDeltaDays(appGa, REF_GE_BPD_GA[i]);
      const deltaP50 = gaDeltaDays(appGa, REF_P50_BPD_MEDIAN_GA[i]);
      return {
        'BPD (mm)': bpd,
        'App GA': appGa ?? 'out of range',
        'GE Table GA': REF_GE_BPD_GA[i] ?? '—',
        'delta days (GE)': deltaGe !== null ? deltaGe : '—',
        'P5.0 median GA': REF_P50_BPD_MEDIAN_GA[i] ?? '—',
        'delta days (P5.0)': deltaP50 !== null ? deltaP50 : '—',
      };
    });
    writeHeading('FORM-4a  BPD  GA-from-measurement (Hadlock Radiology 1984)');
    writeNote('GE table uses same Hadlock 1984 formula — expect ≤1 day difference (rounding).');
    writeTable('FORM-4a BPD GA', rows);
    expect(true).toBe(true);
  });

  it('BPD percentile: app (CV SD mean*0.043) vs P3.1 vs P5.0 (fixed 0.30 cm SD)', () => {
    const rows = INPUT_BPD_MM.map((bpd, i) => {
      const ga = INPUT_BPD_PERC_GA[i];
      const appPct = calcBPDPercentile(bpd, ga);
      const p31Pct = REF_P31_BPD_PCT[i];
      const p50Pct = REF_P50_BPD_PERCENTILE[i];
      return {
        'BPD (mm)': bpd,
        'GA': ga,
        'App %': appPct ?? '—',
        'P3.1 %': p31Pct ?? '—',
        'P5.0 %': p50Pct ?? '—',
        'App-P3.1 Δ': appPct != null && p31Pct != null ? +(appPct - p31Pct).toFixed(1) : '—',
        'App-P5.0 Δ': appPct != null && p50Pct != null ? +(appPct - p50Pct).toFixed(1) : '—',
        'SD note': 'App: mean×0.043 | P5.0: fixed 0.30cm',
      };
    });
    writeHeading('FORM-4b  BPD  Percentile (Hadlock OG 1984)');
    writeNote('SD divergence: App uses proportional CV; P5.0 uses fixed absolute SD.');
    writeNote('Near-median measurements (pct~50) should agree closely regardless of SD model.');
    writeTable('FORM-4b BPD %', rows);
    expect(true).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// SECTION 2 — HC
// ---------------------------------------------------------------------------
describe('FORM-5 HC — GA-from-measurement and percentile', () => {
  const INPUT_HC_MM = [100, 130, 158, 175, 197, 220, 252, 270, 293, 310, 325, 340];
  const INPUT_HC_PERC_GA = [
    '14w 0d', '16w 0d', '18w 0d', '20w 0d', '22w 0d', '24w 0d',
    '28w 0d', '30w 0d', '32w 0d', '34w 0d', '36w 0d', '38w 0d',
  ];

  // GE Manual Table 18-11 HC : Hadlock (Radiology 1984)
  const REF_GE_HC_GA: (string | null)[] = [
    '14w 5d', '16w 4d', '18w 4d', '20w 0d', '21w 6d', '24w 0d',
    '27w 2d', '29w 3d', '32w 2d', '34w 4d', '36w 6d', '39w 1d',
  ];

  // P3.1 percentile at each HC + paired GA (HC Hadlock button)
  const REF_P31_HC_PCT: (number | null)[] = [
    62, 73, 76, 42, 34, 34, 8, 8, 21, 31, 38, 58,
  ];

  // P5.0 median-equivalent GA and percentile (fixed 1.00 cm SD)
  const REF_P50_HC_MEDIAN_GA: (string | null)[] = [
    '14w 2d', '16w 3d', '18w 4d', '19w 6d', '21w 5d', '23w 4d',
    '26w 4d', '28w 3d', '31w 0d', '33w 2d', '35w 3d', '38w 3d',
  ];
  const REF_P50_HC_PERCENTILE: (number | null)[] = [
    63.3, 71.4, 75.4, 42.8, 33.5, 33.1, 8.0, 7.5, 21.5, 29.3, 38.5, 57.2,
  ];

  it('HC GA-from-measurement: app vs GE manual vs perinatology.com 5.0', () => {
    const rows = INPUT_HC_MM.map((hc, i) => {
      const appGa = calcGAFromHC(hc);
      return {
        'HC (mm)': hc,
        'App GA': appGa ?? 'out of range',
        'GE Table GA': REF_GE_HC_GA[i] ?? '—',
        'delta days (GE)': gaDeltaDays(appGa, REF_GE_HC_GA[i]) !== null ? gaDeltaDays(appGa, REF_GE_HC_GA[i]) : '—',
        'P5.0 median GA': REF_P50_HC_MEDIAN_GA[i] ?? '—',
        'delta days (P5.0)': gaDeltaDays(appGa, REF_P50_HC_MEDIAN_GA[i]) !== null ? gaDeltaDays(appGa, REF_P50_HC_MEDIAN_GA[i]) : '—',
      };
    });
    writeHeading('FORM-5a  HC  GA-from-measurement (Hadlock Radiology 1984)');
    writeTable('FORM-5a HC GA', rows);
    expect(true).toBe(true);
  });

  it('HC percentile: app (CV SD mean*0.041) vs P3.1 vs P5.0 (fixed 1.00 cm SD)', () => {
    const rows = INPUT_HC_MM.map((hc, i) => {
      const ga = INPUT_HC_PERC_GA[i];
      const appPct = calcHCPercentile(hc, ga);
      const p31Pct = REF_P31_HC_PCT[i];
      const p50Pct = REF_P50_HC_PERCENTILE[i];
      return {
        'HC (mm)': hc,
        'GA': ga,
        'App %': appPct ?? '—',
        'P3.1 %': p31Pct ?? '—',
        'P5.0 %': p50Pct ?? '—',
        'App-P3.1 Δ': appPct != null && p31Pct != null ? +(appPct - p31Pct).toFixed(1) : '—',
        'App-P5.0 Δ': appPct != null && p50Pct != null ? +(appPct - p50Pct).toFixed(1) : '—',
        'SD note': 'App: mean×0.041 | P5.0: fixed 1.00cm',
      };
    });
    writeHeading('FORM-5b  HC  Percentile (Hadlock OG 1984)');
    writeTable('FORM-5b HC %', rows);
    expect(true).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// SECTION 3 — AC
// ---------------------------------------------------------------------------
describe('FORM-6 AC — GA-from-measurement and percentile', () => {
  const INPUT_AC_MM = [75, 100, 127, 148, 168, 195, 222, 242, 260, 278, 295, 310];
  const INPUT_AC_PERC_GA = [
    '14w 0d', '16w 0d', '18w 0d', '20w 0d', '22w 0d', '24w 0d',
    '28w 0d', '30w 0d', '32w 0d', '34w 0d', '36w 0d', '38w 0d',
  ];

  // GE Manual Table 18-7 AC : Hadlock (Radiology 1984)
  const REF_GE_AC_GA: (string | null)[] = [
    '14w 0d', '16w 0d', '18w 2d', '20w 0d', '21w 6d', '24w 1d',
    '26w 5d', '28w 3d', '30w 1d', '31w 5d', '33w 3d', '34w 6d',
  ];

  // P3.1 percentile at each AC + paired GA (AC Hadlock button)
  const REF_P31_AC_PCT: (number | null)[] = [
    56, 53, 59, 47, 35, 47, 9, 9, 7, 6, 5, 3,
  ];

  // P5.0 median-equivalent GA and percentile (fixed 1.34 cm SD)
  const REF_P50_AC_MEDIAN_GA: (string | null)[] = [
    '14w 1d', '16w 1d', '18w 1d', '19w 6d', '21w 4d', '23w 6d',
    '26w 2d', '28w 2d', '30w 0d', '31w 6d', '33w 4d', '35w 1d',
  ];
  const REF_P50_AC_PERCENTILE: (number | null)[] = [
    56.4, 52.8, 57.5, 46.8, 35.7, 47.3, 9.5, 8.7, 6.8, 5.8, 4.8, 3.3,
  ];

  it('AC GA-from-measurement: app vs GE manual vs perinatology.com 5.0', () => {
    const rows = INPUT_AC_MM.map((ac, i) => {
      const appGa = calcGAFromAC(ac);
      return {
        'AC (mm)': ac,
        'App GA': appGa ?? 'out of range',
        'GE Table GA': REF_GE_AC_GA[i] ?? '—',
        'delta days (GE)': gaDeltaDays(appGa, REF_GE_AC_GA[i]) !== null ? gaDeltaDays(appGa, REF_GE_AC_GA[i]) : '—',
        'P5.0 median GA': REF_P50_AC_MEDIAN_GA[i] ?? '—',
        'delta days (P5.0)': gaDeltaDays(appGa, REF_P50_AC_MEDIAN_GA[i]) !== null ? gaDeltaDays(appGa, REF_P50_AC_MEDIAN_GA[i]) : '—',
      };
    });
    writeHeading('FORM-6a  AC  GA-from-measurement (Hadlock Radiology 1984)');
    writeTable('FORM-6a AC GA', rows);
    expect(true).toBe(true);
  });

  it('AC percentile: app (CV SD mean*0.057) vs P3.1 vs P5.0 (fixed 1.34 cm SD)', () => {
    const rows = INPUT_AC_MM.map((ac, i) => {
      const ga = INPUT_AC_PERC_GA[i];
      const appPct = calcACPercentile(ac, ga);
      const p31Pct = REF_P31_AC_PCT[i];
      const p50Pct = REF_P50_AC_PERCENTILE[i];
      return {
        'AC (mm)': ac,
        'GA': ga,
        'App %': appPct ?? '—',
        'P3.1 %': p31Pct ?? '—',
        'P5.0 %': p50Pct ?? '—',
        'App-P3.1 Δ': appPct != null && p31Pct != null ? +(appPct - p31Pct).toFixed(1) : '—',
        'App-P5.0 Δ': appPct != null && p50Pct != null ? +(appPct - p50Pct).toFixed(1) : '—',
        'SD note': 'App: mean×0.057 | P5.0: fixed 1.34cm',
      };
    });
    writeHeading('FORM-6b  AC  Percentile (Hadlock OG 1984)');
    writeTable('FORM-6b AC %', rows);
    expect(true).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// SECTION 4 — FL
// ---------------------------------------------------------------------------
describe('FORM-7 FL — GA-from-measurement and percentile', () => {
  const INPUT_FL_MM = [11, 20, 30, 36, 42, 48, 55, 59, 63, 67, 70, 73];
  const INPUT_FL_PERC_GA = [
    '14w 0d', '16w 0d', '18w 0d', '20w 0d', '22w 0d', '24w 0d',
    '28w 0d', '30w 0d', '32w 0d', '34w 0d', '36w 0d', '38w 0d',
  ];

  // GE Manual Table 18-10 FL : Hadlock (Radiology 1984)
  const REF_GE_FL_GA: (string | null)[] = [
    '13w 3d', '16w 0d', '19w 2d', '21w 3d', '23w 5d', '26w 1d',
    '29w 0d', '30w 6d', '32w 4d', '34w 3d', '35w 6d', '37w 3d',
  ];

  // P3.1 percentile at each FL + paired GA (Femur Hadlock button)
  const REF_P31_FL_PCT: (number | null)[] = [
    16, 43, 86, 86, 88, 92, 66, 58, 54, 53, 42, 36,
  ];

  // P5.0 median-equivalent GA and percentile (fixed 0.30 cm SD)
  const REF_P50_FL_MEDIAN_GA: (string | null)[] = [
    '13w 1d', '15w 6d', '19w 1d', '21w 1d', '23w 2d', '25w 4d',
    '28w 4d', '30w 2d', '32w 1d', '34w 1d', '35w 5d', '37w 3d',
  ];
  const REF_P50_FL_PERCENTILE: (number | null)[] = [
    15.7, 43.2, 86.1, 86.4, 88.6, 91.9, 65.5, 57.9, 53.7, 53.0, 42.6, 36.1,
  ];

  it('FL GA-from-measurement: app vs GE manual vs perinatology.com 5.0', () => {
    const rows = INPUT_FL_MM.map((fl, i) => {
      const appGa = calcGAFromFL(fl);
      return {
        'FL (mm)': fl,
        'App GA': appGa ?? 'out of range',
        'GE Table GA': REF_GE_FL_GA[i] ?? '—',
        'delta days (GE)': gaDeltaDays(appGa, REF_GE_FL_GA[i]) !== null ? gaDeltaDays(appGa, REF_GE_FL_GA[i]) : '—',
        'P5.0 median GA': REF_P50_FL_MEDIAN_GA[i] ?? '—',
        'delta days (P5.0)': gaDeltaDays(appGa, REF_P50_FL_MEDIAN_GA[i]) !== null ? gaDeltaDays(appGa, REF_P50_FL_MEDIAN_GA[i]) : '—',
      };
    });
    writeHeading('FORM-7a  FL  GA-from-measurement (Hadlock Radiology 1984)');
    writeTable('FORM-7a FL GA', rows);
    expect(true).toBe(true);
  });

  it('FL percentile: app (CV SD mean*0.050) vs P3.1 vs P5.0 (fixed 0.30 cm SD)', () => {
    const rows = INPUT_FL_MM.map((fl, i) => {
      const ga = INPUT_FL_PERC_GA[i];
      const appPct = calcFLPercentile(fl, ga);
      const p31Pct = REF_P31_FL_PCT[i];
      const p50Pct = REF_P50_FL_PERCENTILE[i];
      return {
        'FL (mm)': fl,
        'GA': ga,
        'App %': appPct ?? '—',
        'P3.1 %': p31Pct ?? '—',
        'P5.0 %': p50Pct ?? '—',
        'App-P3.1 Δ': appPct != null && p31Pct != null ? +(appPct - p31Pct).toFixed(1) : '—',
        'App-P5.0 Δ': appPct != null && p50Pct != null ? +(appPct - p50Pct).toFixed(1) : '—',
        'SD note': 'App: mean×0.050 | P5.0: fixed 0.30cm',
      };
    });
    writeHeading('FORM-7b  FL  Percentile (Hadlock OG 1984)');
    writeTable('FORM-7b FL %', rows);
    expect(true).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// SECTION 5 — OFD
// ---------------------------------------------------------------------------
describe('FORM-8 OFD — GA-from-measurement and percentile self-consistency', () => {
  // 12 OFD values in mm spanning ~15w to ~35w (Hansmann table range)
  const INPUT_OFD_MM = [40, 50, 60, 66, 72, 78, 84, 91, 97, 100, 105, 110];

  // Paired GAs for percentile calculation (based on GE Hansmann table entries)
  const INPUT_OFD_PERC_GA = [
    '15w 1d', '17w 4d', '20w 0d', '21w 2d', '22w 4d', '24w 1d',
    '25w 4d', '27w 4d', '29w 3d', '30w 3d', '32w 3d', '35w 0d',
  ];

  // GE Table 18-18 OFD : Hansmann (directly from the table, not interpolated)
  const REF_GE_OFD_GA: (string | null)[] = [
    '15w 1d', '17w 4d', '20w 0d', '21w 2d', '22w 4d', '24w 1d',
    '25w 4d', '27w 4d', '29w 3d', '30w 3d', '32w 3d', '35w 0d',
  ];

  // P5.0 has no OFD nomogram — all null
  const REF_P50_OFD_GA: (string | null)[] = [
    null, null, null, null, null, null,
    null, null, null, null, null, null,
  ];
  const REF_P50_OFD_PERCENTILE: (number | null)[] = [
    null, null, null, null, null, null,
    null, null, null, null, null, null,
  ];

  it('OFD GA-from-measurement: app vs GE Table 18-18 (Hansmann)', () => {
    const rows = INPUT_OFD_MM.map((ofd, i) => {
      const appGa = calcGAFromOFD(ofd);
      return {
        'OFD (mm)': ofd,
        'App GA': appGa ?? 'out of range',
        'GE T18-18 GA (Hansmann)': REF_GE_OFD_GA[i] ?? '—',
        'delta days (GE)': gaDeltaDays(appGa, REF_GE_OFD_GA[i]) !== null ? gaDeltaDays(appGa, REF_GE_OFD_GA[i]) : '—',
        'note': 'GE=Hansmann; App=Hadlock. Independent studies.',
      };
    });
    writeHeading('FORM-8a  OFD  GA-from-measurement');
    writeNote('GE uses Hansmann reference; App uses Hadlock (corrected). Independent — cross-study differences expected.');
    writeNote('P3.1 has no OFD button. P5.0 has no OFD percentile nomogram.');
    writeTable('FORM-8a OFD GA', rows);
    expect(true).toBe(true);
  });

  it('OFD percentile: app self-consistency (percentile at Hansmann GA should be ~50th)', () => {
    const rows = INPUT_OFD_MM.map((ofd, i) => {
      const ga = INPUT_OFD_PERC_GA[i];
      const appPct = calcOFDPercentile(ofd, ga);
      return {
        'OFD (mm)': ofd,
        'GA (Hansmann p50)': ga,
        'App %': appPct ?? '—',
        'expected ~50': appPct != null ? (Math.abs(appPct - 50) < 20 ? 'near 50th ✓' : 'DIVERGED') : '—',
        'SD note': 'App: mean×0.043 CV (same as BPD)',
      };
    });
    writeHeading('FORM-8b  OFD  Percentile self-consistency');
    writeNote('Using Hansmann p50 GA as input: if app GA-from-OFD formula agrees with Hansmann,');
    writeNote('the percentile at the Hansmann GA should be near the 50th percentile.');
    writeTable('FORM-8b OFD %', rows);
    expect(true).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// SECTION 6 — EFW
// ---------------------------------------------------------------------------
describe('FORM-11 EFW — calculation, GA-from-EFW, and percentile', () => {
  // 12 biometry sets [BPD, HC, AC, FL] in mm at round GAs
  const INPUT_EFW_SETS: [number, number, number, number][] = [
    [38, 136, 110, 28],  // ~16w
    [44, 158, 127, 30],  // ~18w
    [50, 175, 148, 36],  // ~20w
    [55, 197, 168, 42],  // ~22w
    [60, 213, 188, 46],  // ~24w
    [65, 230, 205, 50],  // ~26w
    [70, 252, 222, 55],  // ~28w
    [75, 268, 240, 59],  // ~30w
    [80, 293, 260, 63],  // ~32w
    [84, 305, 278, 67],  // ~34w
    [89, 325, 295, 70],  // ~36w
    [93, 338, 310, 73],  // ~38w
  ];
  const INPUT_EFW_GA = [
    '16w 0d', '18w 0d', '20w 0d', '22w 0d',
    '24w 0d', '26w 0d', '28w 0d', '30w 0d',
    '32w 0d', '34w 0d', '36w 0d', '38w 0d',
  ];

  // P5.0 — enter same biometry, Hadlock 4-param EFW formula selected
  // P5.0 computed EFW in grams (same Hadlock 1985 formula — should match app closely)
  const REF_P50_EFW_G: (number | null)[] = [
    203, 256, 367, 516, 674, 854, 1103, 1376, 1739, 2103, 2509, 2903,
  ];

  // P5.0 normative expected mean at each GA (Hadlock 1991 p50 table)
  const REF_P50_EFW_EXPECTED_MEAN_G: (number | null)[] = [
    146, 223, 331, 478, 670, 913, 1210, 1559, 1953, 2377, 2813, 3236,
  ];

  // P5.0 median-equivalent GA for each computed EFW
  const REF_P50_EFW_MEDIAN_GA: (string | null)[] = [
    '17w 4d', '18w 5d', '20w 4d', '22w 3d', '24w 0d', '25w 4d',
    '27w 2d', '29w 0d', '31w 0d', '32w 5d', '34w 4d', '36w 3d',
  ];

  // P5.0 EFW percentile (Hadlock 1991 p50 table + sigma_ln=0.127)
  const REF_P50_EFW_PERCENTILE: (number | null)[] = [
    99.5, 86.1, 79.4, 72.7, 51.7, 30.1, 23.3, 16.2, 18.1, 16.7, 18.4, 19.6,
  ];

  // P3.1 EFW percentile (EFW Hadlock 1991 button; uses 13.25% CV SD model)
  // Note: 16w EFW=203g was >99th pct on P3.1 (mean only 146g at 16w)
  const REF_P31_EFW_PERCENTILE: (number | null)[] = [
    99, 87, 79, 73, 52, 31, 25, 19, 20, 19, 21, 22,
  ];

  it('EFW calculation: app (Hadlock 1985) vs P5.0 (same formula)', () => {
    const rows = INPUT_EFW_SETS.map(([bpd, hc, ac, fl], i) => {
      const appEfw = calcEFW(bpd, hc, ac, fl);
      const p50Ref = REF_P50_EFW_G[i];
      return {
        'GA': INPUT_EFW_GA[i],
        'BPD/HC/AC/FL': `${bpd}/${hc}/${ac}/${fl}`,
        'App EFW (g)': appEfw ?? '—',
        'P5.0 EFW (g)': p50Ref ?? '—',
        'delta (g)': appEfw != null && p50Ref != null ? appEfw - p50Ref : '—',
        'note': 'Both use Hadlock 1985 4-param — should match exactly',
      };
    });
    writeHeading('FORM-11a  EFW  Calculation (Hadlock 1985 4-parameter)');
    writeNote('App and P5.0 use the same formula — delta should be 0 or ≤1g (rounding).');
    writeTable('FORM-11a EFW calc', rows);
    expect(true).toBe(true);
  });

  it('EFW GA-from-EFW: app (Combs 1993 inverse) vs P5.0 median-equivalent GA', () => {
    const rows = INPUT_EFW_SETS.map(([bpd, hc, ac, fl], i) => {
      const appEfw = calcEFW(bpd, hc, ac, fl);
      const appEfwGa = calcGAFromEFW(appEfw);
      const refMedianGa = REF_P50_EFW_MEDIAN_GA[i];
      return {
        'GA': INPUT_EFW_GA[i],
        'App EFW (g)': appEfw ?? '—',
        'App efwGa': appEfwGa ?? '—',
        'P5.0 median GA': refMedianGa ?? '—',
        'delta days (P5.0)': gaDeltaDays(appEfwGa, refMedianGa) !== null ? gaDeltaDays(appEfwGa, refMedianGa) : '—',
        'note': 'App: Combs 1993 inverse quadratic | P5.0: Hadlock 1991 table',
      };
    });
    writeHeading('FORM-11b  EFW  GA-from-EFW');
    writeNote('App uses Combs 1993 inverse; P5.0 uses Hadlock 1991 p50 table — cross-study differences expected.');
    writeTable('FORM-11b EFW GA', rows);
    expect(true).toBe(true);
  });

  it('EFW percentile: app (Combs sigma_ln=0.127) vs P5.0 (Hadlock 1991 p50) vs P3.1 (13.25% CV)', () => {
    const rows = INPUT_EFW_SETS.map(([bpd, hc, ac, fl], i) => {
      const appEfw = calcEFW(bpd, hc, ac, fl);
      const ga = INPUT_EFW_GA[i];
      const appPct = appEfw != null ? calcEFWPercentile(appEfw, ga) : undefined;
      const p50Pct = REF_P50_EFW_PERCENTILE[i];
      const p31Pct = REF_P31_EFW_PERCENTILE[i];
      return {
        'GA': ga,
        'App EFW (g)': appEfw ?? '—',
        'App % (Combs)': appPct ?? '—',
        'P5.0 % (H91)': p50Pct ?? '—',
        'P3.1 % (13.25CV)': p31Pct ?? '—',
        'App-P5.0 Δ': appPct != null && p50Pct != null ? +(appPct - p50Pct).toFixed(1) : '—',
        'App-P3.1 Δ': appPct != null && p31Pct != null ? +(appPct - p31Pct).toFixed(1) : '—',
      };
    });
    writeHeading('FORM-11c  EFW  Percentile (3 implementations compared)');
    writeNote('App:  Combs 1993 sigma_ln=0.127, p50 from inverse Combs formula');
    writeNote('P5.0: Hadlock 1991 p50 normative table + sigma_ln=0.127');
    writeNote('P3.1: 13.25% CV  (SD = 0.1325 × EFW_mean)');
    writeNote('NOTE: Large divergence at 16w expected — app EFW biometry set produces');
    writeNote('203g which is far above the Hadlock 1991 mean of 146g at 16w.');
    writeTable('FORM-11c EFW %', rows);
    expect(true).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// SECTION 7 — TCD
// ---------------------------------------------------------------------------
describe('FORM-15 TCD — GA-from-measurement and percentile', () => {
  // 12 TCD values in mm spanning ~14w to ~40w
  // Values 26.5, 32.7, 38.9, 45.1 are the Chang 2000 formula means at 24w, 28w, 32w, 36w
  // — they serve as a self-consistency check (round-trip GA should equal input GA)
  const INPUT_TCD_MM = [11, 16, 20, 24, 26.5, 32.7, 38.9, 42, 45.1, 48, 51, 54];

  const INPUT_TCD_PERC_GA = [
    '14w 0d', '17w 0d', '20w 0d', '22w 0d', '24w 0d', '28w 0d',
    '32w 0d', '34w 0d', '36w 0d', '38w 0d', '40w 0d', '40w 0d',
  ];

  // GE manual has no TCD table — all null
  // P3.1 — Transcerebellar diameter button — gives percentile at GA+TCD
  const REF_P31_TCD_PCT: (number | null)[] = [
    50, 54, 46, 58, 50, 50, 50, 50, 50, 47, 46, 82,
  ];

  // P5.0 Head panel TCD — uses Goldstein nomogram
  const REF_P50_TCD_MEDIAN_GA: (string | null)[] = [
    '12w 0d', '15w 0d', '20w 0d', '23w 0d', '24w 4d', '28w 2d',
    '31w 3d', '33w 0d', '34w 4d', '36w 0d', '37w 3d', '39w 0d',
  ];
  const REF_P50_TCD_PERCENTILE: (number | null)[] = [
    0, 2.3, 50.0, 74.8, 59.9, 61.0, 37.7, 29.7, 24.8, 21.2, 17.0, 35.2,
  ];

  it('TCD GA-from-measurement: app (Chang 2000) vs P3.1 vs P5.0 (Goldstein)', () => {
    const rows = INPUT_TCD_MM.map((tcd, i) => {
      const appGa = calcGAFromTCD(tcd);
      return {
        'TCD (mm)': tcd,
        'App GA': appGa ?? 'out of range',
        'P5.0 median GA (Goldstein)': REF_P50_TCD_MEDIAN_GA[i] ?? '—',
        'delta days (P5.0)': gaDeltaDays(appGa, REF_P50_TCD_MEDIAN_GA[i]) !== null ? gaDeltaDays(appGa, REF_P50_TCD_MEDIAN_GA[i]) : '—',
        'note': 'App: Chang2000 | P5.0: Goldstein — independent',
      };
    });
    writeHeading('FORM-15a  TCD  GA-from-measurement');
    writeNote('App uses Chang 2000; P5.0 uses Goldstein — independent studies, cross-source differences expected.');
    writeNote('Self-check: TCD=26.5mm at 24w, TCD=32.7mm at 28w, TCD=38.9mm at 32w, TCD=45.1mm at 36w');
    writeNote('are Chang 2000 p50 values — app should return exactly those GAs (round-trip).');
    writeTable('FORM-15a TCD GA', rows);
    expect(true).toBe(true);
  });

  it('TCD percentile: app (Chang 2000 abs SD=2.96 mm) vs P3.1 vs P5.0 (Goldstein)', () => {
    const rows = INPUT_TCD_MM.map((tcd, i) => {
      const ga = INPUT_TCD_PERC_GA[i];
      const appPct = calcTCDPercentile(tcd, ga);
      const p31Pct = REF_P31_TCD_PCT[i];
      const p50Pct = REF_P50_TCD_PERCENTILE[i];
      return {
        'TCD (mm)': tcd,
        'GA': ga,
        'App %': appPct ?? '—',
        'P3.1 %': p31Pct ?? '—',
        'P5.0 %': p50Pct ?? '—',
        'App-P3.1 Δ': appPct != null && p31Pct != null ? +(appPct - p31Pct).toFixed(1) : '—',
        'App-P5.0 Δ': appPct != null && p50Pct != null ? +(appPct - p50Pct).toFixed(1) : '—',
        'SD note': 'App: abs 2.96mm | P5.0: Goldstein table',
      };
    });
    writeHeading('FORM-15b  TCD  Percentile');
    writeNote('App uses Chang 2000 absolute SD=2.96mm; references use different nomograms.');
    writeNote('Self-check (TCD=26.5/32.7/38.9/45.1 at their Chang p50 GAs): app should give ~50th pct.');
    writeTable('FORM-15b TCD %', rows);
    expect(true).toBe(true);
  });
});
