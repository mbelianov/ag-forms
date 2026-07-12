# Implementation Plan — Defects Round 2

> **Source spec:** [`docs/DEFECTS-ROUND2-REQ-SPEC.md`](DEFECTS-ROUND2-REQ-SPEC.md)
> **Requirement prefix:** `DR2-`
> **All defects are P1 (must fix before next release).**

---

## Overview

Five defects are addressed in this plan, all confined to two frontend files:

| File | Defects |
|------|---------|
| `frontend/src/pages/ExaminationDetailPage.tsx` | DR2-01, DR2-02, DR2-03, DR2-04 |
| `frontend/src/services/print.service.ts` | DR2-05 |

No backend changes are required. No new utilities, types, or components need to be created — all required helpers (`getExamTypeLabel`, `formatPlainDate`) already exist.

The sub-tasks below are ordered so that DR2-01 through DR2-04 are completed first (all in one file), then DR2-05 in a second file. Each sub-task can be reviewed independently before the next is started.

---

## Sub-Tasks

---

### ST-01 — Dynamic `<h1>` heading (DR2-01)

**Status:** `[x] done`

**Intent**

Replace the hardcoded `"Ultrasound Prenatal Exam Details"` heading with a dynamically derived string based on the examination type, so that the page title reflects the actual exam type loaded.

**Expected Outcomes**

- The `<h1>` on the Examination Detail page reads `"{examTypeLabel} Details"` for any recognised `examinationType`.
- When `examinationType` is absent (`undefined`/`null`) or unrecognised, the `<h1>` reads exactly `"Examination Details"`.
- The literal string `"Ultrasound Prenatal Exam Details"` no longer appears as a static value in `ExaminationDetailPage.tsx`.

**Todo List**

1. Import `getExamTypeLabel` from `../constants/examinationTypes` in `ExaminationDetailPage.tsx`. It is not currently imported in this file.
2. Derive the heading string before the JSX `return` statement. Use a local variable:
   - Look up the label via `getExamTypeLabel(examination.examinationType ?? '')`.
   - The current `getExamTypeLabel` fallback returns the raw key when unrecognised. Add a guard: if the result is an empty string (i.e. the input was `''`) or equals the raw key that was passed in and is not a recognised key, use `"Examination"` as the label.
   - A clean implementation: `const examTypeLabel = examination.examinationType ? (getExamTypeLabel(examination.examinationType) !== examination.examinationType ? getExamTypeLabel(examination.examinationType) : 'Examination') : 'Examination';`
   - Heading string: `` `${examTypeLabel} Details` ``
3. Replace the hardcoded `<h1>Ultrasound Prenatal Exam Details</h1>` at line 220 with `<h1>{examTypeLabel} Details</h1>` (using the local variable computed in step 2, not the full expression inline).

**Relevant Context**

- File: [`frontend/src/pages/ExaminationDetailPage.tsx`](../frontend/src/pages/ExaminationDetailPage.tsx), line 220
- Helper: [`frontend/src/constants/examinationTypes.ts`](../frontend/src/constants/examinationTypes.ts) — `getExamTypeLabel(key: string): string` returns the label for a known key or the key itself for unknown keys.
- The same helper is already imported and used in [`frontend/src/pages/ExaminationsPage.tsx`](../frontend/src/pages/ExaminationsPage.tsx:31) and [`frontend/src/components/ExaminationForm.tsx`](../frontend/src/components/ExaminationForm.tsx:24) — follow those as the import pattern.
- The same `examTypeLabel` variable computed here is reused in ST-02 and ST-03 — compute it once and share.

---

### ST-02 — Breadcrumb second item: fixed "Exams" label (DR2-02)

**Status:** `[x] done`

**Intent**

Fix the second breadcrumb item, which currently displays the hardcoded exam-type-specific text `"Ultrasound Prenatal Exams"`. It must always show the fixed label `"Exams"` regardless of the exam type being viewed.

**Expected Outcomes**

- The second breadcrumb item renders the visible text `"Exams"` on every Examination Detail page.
- The `href` of the second breadcrumb item remains `/examinations` — unchanged.
- The literal string `"Ultrasound Prenatal Exams"` no longer appears in the breadcrumb section.

**Todo List**

1. Locate the `<BreadcrumbItem href="/examinations">` at line 192 of `ExaminationDetailPage.tsx`.
2. Replace its text content `Ultrasound Prenatal Exams` with the fixed string `Exams`.
3. Do not change the `href` attribute — it must remain `/examinations`.

**Relevant Context**

- File: [`frontend/src/pages/ExaminationDetailPage.tsx`](../frontend/src/pages/ExaminationDetailPage.tsx), line 192
- This is a single-character-level text replacement; no logic change is needed.

---

### ST-03 — Breadcrumb current-page item: include exam type (DR2-03)

**Status:** `[x] done`

**Intent**

Extend the third breadcrumb item (the active page) to include the exam type label between the patient name and the exam date, forming the three-segment composite string `{patientName} — {examTypeLabel} — {examDate}`.

**Expected Outcomes**

- The current-page breadcrumb item displays `"{patientName} — {examTypeLabel} — {examDate}"` when the exam type is recognised.
- When `examinationType` is absent or unrecognised, the segment reads `"{patientName} — Examination — {examDate}"`.
- The previous two-segment format `"{patientName} — {examDate}"` is no longer rendered.

**Todo List**

1. Locate the `<BreadcrumbItem isCurrentPage>` block at line 193-195 of `ExaminationDetailPage.tsx`.
2. Update its content to:
   `{examination.patientName} — {examTypeLabel} — {formatPlainDate(examination.examDate)}`
   where `examTypeLabel` is the variable computed in ST-01 (not re-derived inline).
3. Verify the delimiter character is consistent with existing usage (`—` with surrounding spaces) — this is already the delimiter used in the original breadcrumb.

**Relevant Context**

- File: [`frontend/src/pages/ExaminationDetailPage.tsx`](../frontend/src/pages/ExaminationDetailPage.tsx), lines 193-195
- `formatPlainDate` is already imported in this file (line 23).
- `examTypeLabel` is derived in ST-01 and must be available in scope when ST-03 is implemented.

---

### ST-04 — Move MRN from Patient Information to summary tile (DR2-04)

**Status:** `[x] done`

**Intent**

Relocate the MRN field from the Patient Information grid to the summary tile at the top of the page, converting the summary tile from a two-column layout (Examination Date | Status) to a three-column layout (Examination Date | MRN | Status). This makes MRN immediately visible alongside the exam date and status.

**Expected Outcomes**

- The MRN label and value are removed from the Patient Information section grid.
- The summary tile renders three columns: Examination Date (left), MRN (centre), Status (right).
- The MRN column in the tile shows label `"MRN"` in small grey text above the value in large bold text, matching the visual style of the Examination Date column.
- When `examination.mrn` is absent or empty, the MRN value displays `—`.
- The Examination Date column and Status column are visually and functionally unchanged.
- MRN does not appear in two places simultaneously.

**Todo List**

1. **Remove MRN from Patient Information grid:** Delete the `{fieldBlock('MRN', examination.mrn || '—')}` call at line 304 of `ExaminationDetailPage.tsx`. No other changes are needed in the Patient Information section.

2. **Update the summary tile layout:** The current tile (lines 267-288) uses a `display: flex; justify-content: space-between` two-column layout. Restructure it to accommodate three columns:
   - Wrap the three columns in a flex container with `justify-content: space-between` (or use a three-column flex layout with even spacing).
   - Left column: existing Examination Date block (unchanged content, including the `examinationType` sub-label below the date).
   - Centre column (new): MRN block, matching the Examination Date label/value visual style:
     - Label: `"MRN"` in `fontSize: '0.875rem', color: '#525252'` with `marginBottom: '0.5rem'`.
     - Value: `examination.mrn || '—'` in `fontSize: '1.5rem', fontWeight: 600, color: '#161616'`.
   - Right column: existing Status block (unchanged).

3. The layout change must use the same CSS approach already used in the tile — inline styles with `display: flex`, matching the visual style of the Examination Date column exactly.

**Relevant Context**

- File: [`frontend/src/pages/ExaminationDetailPage.tsx`](../frontend/src/pages/ExaminationDetailPage.tsx)
  - Summary tile: lines 267-288
  - MRN in Patient Information: line 304
- The Examination Date column style is the reference for MRN column visual style (label/value typography).
- The existing TASK-033 sub-label (`Type: {examination.examinationType.replace(/_/g, ' ')}`) inside the Examination Date column remains in place after the layout change.

---

### ST-05 — Remove percentile annotations for extended biometry fields in PDF (DR2-05)

**Status:** `[x] done`

**Intent**

Restrict percentile annotations in the PDF output to the five core biometry fields (BPD, HC, AC, FL, EFW). The five extended fields (OFD, TCD, Nuchal Fold, APAD, TAD) currently receive percentile annotations via `withPct()` calls backed by dedicated percentile calculation functions. These annotations must be removed and their associated calculation code deleted as dead code.

**Expected Outcomes**

- PDF output for OFD, TCD, Nuchal Fold, APAD, and TAD shows only the raw numeric value followed by `mm`, with no `(Nth %ile)` suffix.
- PDF output for BPD, HC, AC, FL, and EFW is unchanged — percentile annotations remain.
- Variables `ofdPct`, `tcdPct`, `nfPct`, `apadPct`, `tadPct` are removed from `print.service.ts`.
- Function calls `calcOFDPercentile`, `calcTCDPercentile`, `calcNuchalFoldPercentile`, `calcAPADPercentile`, `calcTADPercentile` are removed from `print.service.ts`.
- The five corresponding import names are removed from the import statement at the top of `print.service.ts`.
- All five field values (OFD, TCD, Nuchal Fold, APAD, TAD) remain present in the PDF — only the percentile suffix is stripped.

**Todo List**

1. **Remove unused imports:** In the `import { ... } from '../utils/calculations'` statement at lines 1-10 of `print.service.ts`, remove the five function names: `calcOFDPercentile`, `calcTCDPercentile`, `calcNuchalFoldPercentile`, `calcAPADPercentile`, `calcTADPercentile`. The remaining imports (`calcEDD`, `calcBiometryPercentiles`, `calcEFWPercentile`) must be kept.

2. **Remove percentile variable declarations:** Delete the five `const xxxPct = calcXxxPercentile(...)` lines at lines 143-147 of `buildViewModel()`:
   - `const ofdPct  = calcOFDPercentile(...)`
   - `const tcdPct  = calcTCDPercentile(...)`
   - `const nfPct   = calcNuchalFoldPercentile(...)`
   - `const apadPct = calcAPADPercentile(...)`
   - `const tadPct  = calcTADPercentile(...)`
   - The `const ga = gaForPct ?? '';` line immediately above these (line 142) is still used by the removed calls only — verify whether it is referenced anywhere else in the function after the removals. If it is no longer used, remove it too.

3. **Replace `withPct(...)` calls with plain `${value} mm` format** for the five affected fields in the `biometry` object (lines 170-177):
   - `ofd`: change `withPct(exam.biometry.ofd, ofdPct)` → `` `${exam.biometry.ofd} mm` ``
   - `tcd`: change `withPct(exam.biometry.tcd, tcdPct)` → `` `${exam.biometry.tcd} mm` ``
   - `nuchalFold`: change `withPct(exam.biometry.nuchalFold, nfPct)` → `` `${exam.biometry.nuchalFold} mm` ``
   - `apad`: change `withPct(exam.biometry.apad, apadPct)` → `` `${exam.biometry.apad} mm` ``
   - `tad`: change `withPct(exam.biometry.tad, tadPct)` → `` `${exam.biometry.tad} mm` ``
   - The surrounding null-guard pattern (` != null ? ... : undefined`) must be preserved for all five fields.

4. **Verify `withPct` is still used** by the BPD, HC, AC, FL fields after step 3 — it is, so do not remove it.

**Relevant Context**

- File: [`frontend/src/services/print.service.ts`](../frontend/src/services/print.service.ts)
  - Imports: lines 1-10
  - `buildViewModel` function: lines 124-236
  - Extended percentile variables: lines 142-147
  - Biometry object with `withPct` calls for OFD/TCD/nuchalFold/apad/tad: lines 170-177
- Reference format for plain `mm` fields: `vp`, `cm`, `nb`, `la`, `lc` at lines 171, 173, 175, 179-180 — these already use the `` `${value} mm` `` pattern without percentiles.

---

## Implementation Order and Dependencies

```
ST-01  (compute examTypeLabel variable + fix <h1>)
  └─► ST-02  (change breadcrumb second item — independent text change)
  └─► ST-03  (depends on examTypeLabel from ST-01)
  └─► ST-04  (independent layout change — no dependency on ST-01/02/03)

ST-05  (independent — different file entirely)
```

ST-02 and ST-04 can be done in any order relative to ST-01/ST-03, but ST-03 must come after ST-01 (relies on the `examTypeLabel` variable). ST-05 is fully independent.

---

## Validation Checklist

After all sub-tasks are complete, verify the following before marking the work done:

- [x] `ExaminationDetailPage.tsx`: No occurrence of the literal string `"Ultrasound Prenatal Exams"` remains in breadcrumb context.
- [x] `ExaminationDetailPage.tsx`: No occurrence of the literal string `"Ultrasound Prenatal Exam Details"` remains as a static heading.
- [x] `ExaminationDetailPage.tsx`: `getExamTypeLabel` is imported from `../constants/examinationTypes`.
- [x] `ExaminationDetailPage.tsx`: `fieldBlock('MRN', ...)` is gone from the Patient Information grid.
- [x] `ExaminationDetailPage.tsx`: The summary tile renders three visible columns: Date, MRN, Status.
- [x] `print.service.ts`: None of the five removed function names (`calcOFDPercentile`, etc.) appear anywhere in the file.
- [x] `print.service.ts`: None of the five `xxxPct` variable names appear in the file.
- [x] `print.service.ts`: OFD, TCD, Nuchal Fold, APAD, TAD biometry entries use `` `${value} mm` `` format.
- [x] Frontend TypeScript compiles without new errors after the changes.
