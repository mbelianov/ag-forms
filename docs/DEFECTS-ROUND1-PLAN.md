# Defects Round 1 — Implementation Plan

> **Source Specification:** [`docs/REQUIREMENTS-SPEC-DEFECTS-ROUND1.md`](REQUIREMENTS-SPEC-DEFECTS-ROUND1.md)  
> **Requirement prefix:** `DR1-` (18 requirements across 9 source defects)  
> **Scope:** Frontend-only changes (React/Carbon UI). No backend API changes required.

---

## Executive Summary

This plan addresses 18 requirements derived from Defects Round 1, all of which are confined to the
**frontend layer**. The changes fall into four categories:

1. **Label/copy renames** — Navigation, page headings, buttons (DR1-01, DR1-04, DR1-05, DR1-16, DR1-17)
2. **Table structure changes** — Column additions/removals in the Patients and Patient Detail exam tables (DR1-02, DR1-03, DR1-06)
3. **Form layout changes** — Biometry field grouping, percentile field placement, and column widths in `ExaminationForm` (DR1-08, DR1-09, DR1-10)
4. **Examination Detail view restructuring** — Patient information compaction, section merging, section re-ordering, and unconditional field rendering (DR1-07, DR1-11–DR1-15, DR1-18)

No changes to the backend API, Azure Table Storage schema, type definitions, or shared services are
required. All work is confined to the following frontend files:

| File | Affected DRs |
|------|-------------|
| `frontend/src/components/Layout.tsx` | DR1-16 |
| `frontend/src/pages/ExaminationsPage.tsx` | DR1-17 |
| `frontend/src/pages/PatientDetailPage.tsx` | DR1-01, DR1-02, DR1-03, DR1-04, DR1-05, DR1-07 |
| `frontend/src/pages/PatientsPage.tsx` | DR1-06 |
| `frontend/src/components/ExaminationForm.tsx` | DR1-08, DR1-09, DR1-10 |
| `frontend/src/pages/ExaminationDetailPage.tsx` | DR1-11, DR1-12, DR1-13, DR1-14, DR1-15, DR1-18 |
| `frontend/src/components/reports/` (PDF report) | DR1-14, DR1-18 |

---

## Defect / Requirement Breakdown

| ID | Title | Priority | Affected File(s) |
|----|-------|----------|-----------------|
| DR1-01 | Rename exam section title on Patient Detail Page | P1 | `PatientDetailPage.tsx` |
| DR1-02 | Add Exam Type and Date columns to Patient Detail exam list | P1 | `PatientDetailPage.tsx` |
| DR1-03 | Add "Filter by Exam Type" to Patient Detail exam list | P2 | `PatientDetailPage.tsx` |
| DR1-04 | Rename "Add Test" button to "Add Exam" | P1 | `PatientDetailPage.tsx` |
| DR1-05 | Rename "Create Test" button to "Create Exam" | P1 | `PatientDetailPage.tsx` |
| DR1-06 | Remove MRN column from Patients list table | P1 | `PatientsPage.tsx` |
| DR1-07 | Compact Patient Information on Patient Detail Page | P2 | `PatientDetailPage.tsx` |
| DR1-08 | Widen Exam Type / narrow Exam Date in Create Exam form | P2 | `ExaminationForm.tsx` |
| DR1-09 | Align percentile fields below biometry fields in form | P2 | `ExaminationForm.tsx` |
| DR1-10 | Regroup OFD, Vp, TCD, CM into 6-col 2-row layout in form | P2 | `ExaminationForm.tsx` |
| DR1-11 | Compact Patient Info on Exam Detail to two columns | P2 | `ExaminationDetailPage.tsx` |
| DR1-12 | Merge Pregnancy Data into Patient Info on Exam Detail | P2 | `ExaminationDetailPage.tsx` |
| DR1-13 | Restrict percentile display to BPD, HC, AC, FL, EFW | P1 | `ExaminationDetailPage.tsx` |
| DR1-14 | Ensure all form fields displayed on Detail view and PDF | P1 | `ExaminationDetailPage.tsx`, PDF report |
| DR1-15 | Move Clinical Information before Notes on Exam Detail | P2 | `ExaminationDetailPage.tsx` |
| DR1-16 | Rename nav menu item to "Exams" | P1 | `Layout.tsx` |
| DR1-17 | Rename Examinations page title to "All Exams" | P1 | `ExaminationsPage.tsx` |
| DR1-18 | No conditional rendering of fields on Exam Detail & PDF | P1 | `ExaminationDetailPage.tsx`, PDF report |

---

## Sub-Tasks

---

### Sub-Task 1 — Label and Copy Renames (DR1-01, DR1-04, DR1-05, DR1-16, DR1-17)

**Intent:**  
Apply all straightforward string-literal renames across Layout, ExaminationsPage, and PatientDetailPage.
These are pure copy changes with no logic impact — they should be batched together and completed first
so that reviewers can verify them independently of structural changes.

**Expected Outcomes:**
- Navigation menu item reads `"Exams"` (DR1-16)
- Examinations page `<h1>` reads `"All Exams"` (DR1-17)
- `<TableContainer title>` on ExaminationsPage reads `"All Exams"` (DR1-17)
- `<PageLoader description>` reads `"Loading exams..."` (DR1-17)
- `aria-label` on table and create button updated on ExaminationsPage (DR1-17)
- Patient Detail exam tile heading reads `"Available Exams"` (DR1-01)
- "Add Test" button reads `"Add Exam"` (DR1-04)
- "Create Test" button reads `"Create Exam"` (DR1-05)

**Todo List:**
1. In [`frontend/src/components/Layout.tsx`](../frontend/src/components/Layout.tsx):
   - Change `"Ultrasound Prenatal Exams"` → `"Exams"` on the `<HeaderMenuItem href="/examinations">` (line ~62).
2. In [`frontend/src/pages/ExaminationsPage.tsx`](../frontend/src/pages/ExaminationsPage.tsx):
   - Change `<h1>` text `"Ultrasound Prenatal Exams"` → `"All Exams"` (line ~242).
   - Change `<TableContainer title>` value `"Ultrasound Prenatal Exams"` → `"All Exams"` (line ~348).
   - Change `<PageLoader description>` `"Loading ultrasound prenatal exams..."` → `"Loading exams..."` (line ~237).
   - Change `<Table aria-label>` `"Ultrasound Prenatal Exams table"` → `"All Exams table"` (line ~372).
   - Change create `<Button aria-label>` `"Create new ultrasound prenatal exam"` → `"Create new exam"` (line ~365).
3. In [`frontend/src/pages/PatientDetailPage.tsx`](../frontend/src/pages/PatientDetailPage.tsx):
   - Change exam tile heading `"Ultrasound Prenatal Exams"` → `"Available Exams"` (line ~330).
   - Change `"Add Test"` button label → `"Add Exam"` (line ~338).
   - Change `"Create Test"` button label → `"Create Exam"` (line ~234).

**Relevant Context:**
- Layout nav items: [`Layout.tsx:62`](../frontend/src/components/Layout.tsx)
- ExaminationsPage headings: [`ExaminationsPage.tsx:237,242,348,365,372`](../frontend/src/pages/ExaminationsPage.tsx)
- PatientDetailPage labels: [`PatientDetailPage.tsx:234,330,338`](../frontend/src/pages/PatientDetailPage.tsx)

**Status:** `[x] done`

---

### Sub-Task 2 — Remove MRN Column from Patients List Table (DR1-06)

**Intent:**  
Remove the MRN column from the patient list table in `PatientsPage.tsx`. MRN is examination-level data
and is not meaningful at the patient list view. The MRN field remains on the `Patient` type and continues
to be displayed on the Patient Detail Page.

**Expected Outcomes:**
- Patients list table shows columns: Name, Age, Phone, Created Date (no MRN column).
- No visual gap or column misalignment introduced.
- No changes to the `Patient` type, Patient Detail Page, or any other component.

**Todo List:**
1. In [`frontend/src/pages/PatientsPage.tsx`](../frontend/src/pages/PatientsPage.tsx):
   - Remove `{ key: 'mrn', header: 'MRN' }` from the `headers` array (line ~26–32).
   - Remove the `mrn` field from the row-mapping object inside the `Array.map()` call (line ~145).

**Relevant Context:**
- Headers array and row mapping: [`PatientsPage.tsx:26-32, ~145`](../frontend/src/pages/PatientsPage.tsx)

**Status:** `[x] done`

---

### Sub-Task 3 — Update Patient Detail Exam Table: Columns + Filter (DR1-02, DR1-03)

**Intent:**  
Extend the examination table on the Patient Detail Page to show the exam `Type` column (resolved via
`getExamTypeLabel`) and remove the `Gestational Age` column. Add a "Filter by Type" dropdown above the
table that re-fetches from the server so that pagination still works correctly across all matching records.

**Expected Outcomes:**
- Exam table column order: **Exam Date | Type | Status**
- Type column shows human-readable label (e.g., `"Ultrasound Prenatal Exam"`) or `"—"` fallback.
- A `<Select>` (or `<Dropdown>`) labelled "Filter by Type" appears above the table.
- Dropdown options: "All Types" (default) + one entry per `EXAM_TYPES` constant item.
- Selecting a type resets the exam list and re-fetches with `examination_type` query param.
- Selecting "All Types" resets and re-fetches without the `examination_type` param.
- "Load More" continues to work after filtered fetch (uses `continuationToken`).
- Loading state shown during filter-triggered fetch.
- Empty state shown when filtered result is empty.

**Todo List:**
1. Import `getExamTypeLabel` from `frontend/src/constants/examinationTypes.ts` into `PatientDetailPage.tsx`.
2. Import `EXAM_TYPES` from `frontend/src/constants/examinationTypes.ts`.
3. Add local state `selectedExamType` (default `''`) for the filter value.
4. Replace `examinationHeaders` definition (line ~33): remove `Gestational Age`, add `Type` between `Exam Date` and `Status`.
5. Update the row-mapping for the exam table to include a `type` column using `getExamTypeLabel(exam.examinationType) || '—'`.
6. Add a `<Select>` or `<Dropdown>` control above the exam table:
   - Label: `"Filter by Type"`
   - Options: `[{ value: '', label: 'All Types' }, ...EXAM_TYPES.map(t => ({ value: t.key, label: t.label }))]`
   - `onChange` → set `selectedExamType` state and trigger `loadExaminations(patientId, type)`.
7. Extract the initial exam-fetch logic into a `loadExaminations(patientId, examinationType?)` function that:
   - Resets `examinations` state to `[]` and clears `continuationToken`.
   - Calls `examinationService.getExaminations({ patientId, examination_type: examinationType || undefined })`.
   - Updates `examinations` and `continuationToken` state.
8. Call `loadExaminations` on mount (with no type) and when `selectedExamType` changes.
9. Ensure the existing "Load More" handler passes the currently active `selectedExamType` to the service call.
10. Confirm `InlineLoading` is shown while the filtered fetch is in progress.

**Relevant Context:**
- Service interface: [`examinationService.ts`](../frontend/src/services/examinationService.ts) — `getExaminations({ patientId, examination_type })`
- `getExamTypeLabel` helper: [`frontend/src/constants/examinationTypes.ts`](../frontend/src/constants/examinationTypes.ts)
- Pattern reference (type filter): [`ExaminationsPage.tsx:105`](../frontend/src/pages/ExaminationsPage.tsx)
- Current exam headers: [`PatientDetailPage.tsx:33`](../frontend/src/pages/PatientDetailPage.tsx)

**Status:** `[ ] blocked` — filter and type column added, but the planned "Load More" behavior cannot be completed because [`frontend/src/pages/PatientDetailPage.tsx`](../frontend/src/pages/PatientDetailPage.tsx) currently has no existing load-more UI/handler to extend.

---

### Sub-Task 4 — Compact Patient Information on Patient Detail Page (DR1-07)

**Intent:**  
Replace the single-column `<Stack gap={5}>` Patient Information layout on the Patient Detail Page with a
CSS grid of at least two or three columns so the tile takes up significantly less vertical space.

**Expected Outcomes:**
- Patient Information fields (Name, DOB/Age, Phone, Email, Address, Created, Last Updated) render in a
  multi-column grid (minimum two columns; three columns preferred).
- No fields are hidden or removed.
- Conditional fields (Email, Address, Last Updated) continue to render only when data is present.
- The `"Patient Information"` `<h3>` heading remains visible.

**Todo List:**
1. In [`frontend/src/pages/PatientDetailPage.tsx`](../frontend/src/pages/PatientDetailPage.tsx):
   - Replace the `<Stack gap={5}>` wrapping Patient Information fields with a `<div>` styled with
     `display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem` (or equivalent inline style / className).
   - Each field (Name, DOB/Age, Phone, Email, Address, Created, Last Updated) becomes a direct grid child.
   - Keep the conditional wrappers for Email, Address, and Last Updated unchanged — only the layout changes.

**Relevant Context:**
- Patient Info tile: [`PatientDetailPage.tsx:~250–290`](../frontend/src/pages/PatientDetailPage.tsx)
- Pattern reference: ExaminationDetailPage already uses CSS grid for its patient info section.

**Status:** `[x] done`

---

### Sub-Task 5 — ExaminationForm Layout: Widen Type Field, Narrow Date Field (DR1-08)

**Intent:**  
Adjust the `row4` grid in `ExaminationForm.tsx` so that the Examination Type field spans two columns
and the Examination Date field spans one narrow column, preventing truncation of long type labels.

**Expected Outcomes:**
- `row4` grid uses a non-equal column distribution (e.g., `2fr 1fr 1fr 1fr` or `grid-template-columns`
  where Type spans 2 cols and Date gets ~1 col).
- No other fields in the row are visually disrupted.
- Change applies to both Create and Edit form paths.

**Todo List:**
1. In [`frontend/src/components/ExaminationForm.tsx`](../frontend/src/components/ExaminationForm.tsx):
   - Locate the `row4` style object (line ~576).
   - Change `gridTemplateColumns` so the first column (Examination Type) is wider than the others.
     Recommended approach: set `gridTemplateColumns: '2fr 1fr 1fr 1fr'` (Type | Date | Status | Age at Exam).
   - Alternatively, keep a uniform grid and add `gridColumn: 'span 2'` on the Type field wrapper and
     adjust the row to 5 columns. The net effect must be: Type wider, Date narrower than today.
   - Verify the change looks correct in both `isEdit` (TextInput for type) and create (Select for type) paths.

**Relevant Context:**
- `row4` style object: [`ExaminationForm.tsx:~576`](../frontend/src/components/ExaminationForm.tsx)
- Examination Type `Select`/`TextInput` and `DatePicker` are siblings in `row4`.

**Status:** `[x] done`

---

### Sub-Task 6 — ExaminationForm: Move Percentile Fields Below Biometry Inputs (DR1-09)

**Intent:**  
Move the BPD, HC, AC, and FL percentile read-only display fields from the detached post-biometry summary
block (lines ~801–820 of `ExaminationForm.tsx`) to be inline directly below each parent biometry input.
The EFW percentile remains in its current location.

**Expected Outcomes:**
- BPD Percentile `TextInput` (read-only) is rendered immediately below the BPD input, in the same grid column.
- HC Percentile is rendered immediately below HC.
- AC Percentile is rendered immediately below AC.
- FL Percentile is rendered immediately below FL.
- Percentile fields show `"Nth"` format (e.g., `"50th"`) or empty string when not yet calculated.
- The "Auto Calc GA" button is unchanged in position and function.
- The existing `percentiles &&` summary block (lines ~801–820) is removed.
- The `percentiles` state variable is kept.

**Todo List:**
1. In [`frontend/src/components/ExaminationForm.tsx`](../frontend/src/components/ExaminationForm.tsx):
   - In the biometry grid row containing BPD, HC, AC, FL: after each input field, add a read-only
     `<TextInput>` for the corresponding percentile, within the same grid column wrapper (use a `<div>`
     with `display: flex; flex-direction: column; gap: 0.5rem` or similar if the grid is flat).
   - Percentile field props: `readOnly`, `labelText="BPD Percentile"`, `value={percentiles?.bpdPct ? `${percentiles.bpdPct}th` : ''}`.
   - Repeat for HC, AC, FL using the appropriate `percentiles` sub-keys.
   - Remove the `{percentiles && (...)}` block that currently renders the detached summary (lines ~801–820).

**Relevant Context:**
- Existing percentile summary block: [`ExaminationForm.tsx:~801–820`](../frontend/src/components/ExaminationForm.tsx)
- `percentiles` state: populated by `calcBiometryPercentiles()` called from "Auto Calc GA".
- Biometry row with BPD/HC/AC/FL: [`ExaminationForm.tsx:~700–760`](../frontend/src/components/ExaminationForm.tsx)

**Status:** `[x] done`

---

### Sub-Task 7 — ExaminationForm: Regroup Extended Biometry into 6-Column 2-Row Layout (DR1-10)

**Intent:**  
Replace the `rowAuto` (auto-fit minmax) layout for the extended biometry fields with an explicit
`repeat(6, 1fr)` grid so that TCD, CM, OFD, and Vp are grouped in the same row alongside Nuchal Fold
and NB, and APAD, TAD, LA, LC occupy the second row.

**Expected Outcomes:**
- Row 1 of the 6-column grid: TCD | CM | OFD | Vp | Nuchal Fold | NB
- Row 2 of the 6-column grid: APAD | TAD | LA | LC | (empty) | (empty)
- `rowAuto` layout no longer used for this section.
- A `row6` helper style `{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.75rem' }` is
  added to the `styles` object (or defined inline).
- Field labels, types, and validation remain unchanged.

**Todo List:**
1. In [`frontend/src/components/ExaminationForm.tsx`](../frontend/src/components/ExaminationForm.tsx):
   - Add a `row6` style entry to the inline styles object: `{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.75rem' }`.
   - Find the `rowAuto` div wrapping OFD, Vp, TCD, CM, Nuchal Fold, NB, APAD, TAD, LA, LC.
   - Replace the single `rowAuto` container with a single `row6` container.
   - Re-order the fields within the container so CSS grid auto-placement produces the two rows as specified:
     TCD, CM, OFD, Vp, Nuchal Fold, NB (positions 1–6), then APAD, TAD, LA, LC (positions 7–10).
   - No manual `grid-row` or `grid-column` overrides are needed; auto-placement handles the wrapping.

**Relevant Context:**
- `rowAuto` style: [`ExaminationForm.tsx`](../frontend/src/components/ExaminationForm.tsx) — search for `rowAuto`.
- OFD, Vp are currently rendered in a different row from TCD, CM; they need to be placed in the same `row6` container.

**Status:** `[x] done`

---

### Sub-Task 8 — Examination Detail: Compact Patient Info + Merge Pregnancy Data (DR1-11, DR1-12, DR1-18 partial)

**Intent:**  
Replace the vertical `<Stack>` layout in the Patient Information tile on the Examination Detail Page with
a two-column CSS grid, and merge the Pregnancy Data fields (LMP, Obstetric History, Family History) into
the same tile. Per DR1-18, all fields — including calculated fields and pregnancy data — must be rendered
unconditionally (even when empty).

**Expected Outcomes:**
- A single "Patient Information" `<Tile>` contains: Patient Name (link), MRN, Patient Age at Exam,
  Gestational Age from LMP, Gestational Age from Biometry, EDD, LMP, Obstetric History, Family History.
- Fields are displayed in a two-column CSS grid.
- All fields render unconditionally; empty fields appear with their label and an empty/`"—"` value.
- The standalone Pregnancy Data `<Tile>` is removed (including its `hasPregnancyData` conditional wrapper).
- No currently visible data is lost.

**Todo List:**
1. In [`frontend/src/pages/ExaminationDetailPage.tsx`](../frontend/src/pages/ExaminationDetailPage.tsx):
   - Find the Patient Information `<Tile>` (lines ~297–330) using `<Stack gap={4}>`.
   - Replace the `<Stack>` with a `<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>`.
   - Remove all conditional wrappers (`&&` short-circuits, ternaries) from individual field renders
     inside this tile. Each field must render unconditionally; use `|| '—'` for the value when appropriate.
   - After the existing fields, add the Pregnancy Data fields (LMP, Obstetric History, Family History)
     also rendered unconditionally with `|| '—'` fallback.
   - Remove the standalone Pregnancy Data `<Tile>` block (lines ~468–478) and its wrapping conditional
     `{hasPregnancyData && (...)}`.
   - Remove the `hasPregnancyData` derived variable if it is no longer used.

**Relevant Context:**
- Patient Info tile: [`ExaminationDetailPage.tsx:~297–330`](../frontend/src/pages/ExaminationDetailPage.tsx)
- Pregnancy Data tile: [`ExaminationDetailPage.tsx:~468–478`](../frontend/src/pages/ExaminationDetailPage.tsx)
- DR1-18 overrides DR1-11 AC4 and DR1-12 AC4 — no conditional field omission allowed.

**Status:** `[x] done`

---

### Sub-Task 9 — Examination Detail: Remove Unneeded Percentile Badges (DR1-13)

**Intent:**  
Remove `pctBadge()` calls for OFD, TCD, Nuchal Fold, APAD, and TAD in the Biometry Measurements tile.
Retain percentile badges only for BPD, HC, AC, FL, and EFW.

**Expected Outcomes:**
- `pctBadge(ofdPct)`, `pctBadge(tcdPct)`, `pctBadge(nfPct)`, `pctBadge(apadPct)`, `pctBadge(tadPct)`
  are absent from the Biometry Measurements tile JSX.
- BPD, HC, AC, FL, EFW retain their percentile badges.
- The corresponding percentile computation calls (`calcOFDPercentile`, `calcTCDPercentile`,
  `calcNuchalFoldPercentile`, `calcAPADPercentile`, `calcTADPercentile`) are checked: if not referenced
  elsewhere in the page or PDF report, they are removed; otherwise they are kept.
- Biometry tile layout is otherwise unchanged.

**Todo List:**
1. In [`frontend/src/pages/ExaminationDetailPage.tsx`](../frontend/src/pages/ExaminationDetailPage.tsx):
   - Locate `pctBadge(ofdPct)`, `pctBadge(tcdPct)`, `pctBadge(nfPct)`, `pctBadge(apadPct)`, `pctBadge(tadPct)`
     in the Biometry Measurements tile (lines ~341–423).
   - Remove those five `pctBadge()` calls from the JSX.
   - Search the entire file and the PDF report component for references to `ofdPct`, `tcdPct`, `nfPct`,
     `apadPct`, `tadPct`.
   - If those variables are only used for the now-removed badge calls, remove their computation lines
     (lines ~152–156: `calcOFDPercentile`, `calcTCDPercentile`, etc.) as well.

**Relevant Context:**
- Biometry tile: [`ExaminationDetailPage.tsx:~341–423`](../frontend/src/pages/ExaminationDetailPage.tsx)
- Percentile computations: [`ExaminationDetailPage.tsx:~152–156`](../frontend/src/pages/ExaminationDetailPage.tsx)

**Status:** `[x] done`

---

### Sub-Task 10 — Examination Detail: Full Field Audit + Add Missing Fields (DR1-14, DR1-18 partial)

**Intent:**  
Perform a field-by-field audit comparing every named field in `ExaminationForm.tsx`'s `formData` against
what is displayed on the Examination Detail Page. Add any missing fields unconditionally. Apply the same
audit to the PDF report component.

**Expected Outcomes:**
- Every field from `ExaminationForm.tsx` has a corresponding display element on the Examination Detail Page.
- All displays are unconditional (per DR1-18): no field is hidden based on its value.
- In particular, the following are confirmed present and unconditional:
  - `gestationalAgeFromBiometry`
  - `biometry.efw`
  - EDD (derived from LMP)
  - `patientAgeAtExam`
  - BPD, HC, AC, FL, EFW percentiles
  - `examination.data.comments`
  - All anatomy sub-fields (face, neckSkin, spine, thorax)
  - All ultrasound findings sub-fields
  - All doppler extended sub-fields
  - `findings`, `notes`
- PDF report updated to match.

**Todo List:**
1. Open `ExaminationForm.tsx` and enumerate all `formData` sub-fields (biometry, doppler, data sub-sections,
   notes, findings, pregnancy_data, anatomy, ultrasound_findings).
2. Open `ExaminationDetailPage.tsx` and check each enumerated field for a display element.
3. For each missing field: add a read-only display row to the appropriate tile section on the detail page,
   rendered unconditionally (no `&&` guard on the field itself; use `|| '—'` for empty values).
4. Remove any remaining `{value && <FieldDisplay />}` conditional wrappers on individual fields across the
   entire detail page (section-level conditionals that hide whole optional sections like "Doppler" when no
   doppler data exists may remain at sub-task author's discretion, but individual fields must not be gated).
5. Open the PDF report component (`frontend/src/components/reports/`):
   - Repeat the audit for the PDF template.
   - Add any missing fields to the PDF output with the same unconditional rendering rule.
   - Ensure `comments` field is present in the PDF.
6. Document the audit outcome in a brief comment at the top of `ExaminationDetailPage.tsx` or in a separate
   audit note file if requested.

**Relevant Context:**
- Form fields: [`ExaminationForm.tsx`](../frontend/src/components/ExaminationForm.tsx) — all `formData.*` references
- Detail page tiles: [`ExaminationDetailPage.tsx`](../frontend/src/pages/ExaminationDetailPage.tsx)
- PDF report: [`frontend/src/components/reports/`](../frontend/src/components/reports/) — search for report component files
- `ExaminationData` type with all sub-fields: [`frontend/src/types/index.ts`](../frontend/src/types/index.ts)

**Status:** `[x] done`

---

### Sub-Task 11 — Examination Detail: Reorder Sections + Move Clinical Info Before Notes (DR1-15)

**Intent:**  
Reorder tiles on the Examination Detail Page so that Clinical Information (Findings) appears immediately
before Comments/Notes. If Notes is currently inside the Clinical Information tile, extract it into a
separate tile positioned after Clinical Information.

**Expected Outcomes:**
- Section order on the Examination Detail Page from top to bottom:
  1. Status and Date banner
  2. Patient Information (merged, per Sub-Task 8)
  3. Biometry Measurements
  4. Doppler Measurements
  5. Ultrasound Findings
  6. Anatomy
  7. Clinical Information (Findings)
  8. Comments / Notes
  9. Metadata
- No content is removed.

**Todo List:**
1. In [`frontend/src/pages/ExaminationDetailPage.tsx`](../frontend/src/pages/ExaminationDetailPage.tsx):
   - Locate the Comments tile (lines ~516–524) and the Clinical Information tile (lines ~527–547).
   - Move the Clinical Information tile's JSX block to appear **before** the Comments tile.
   - If `examination.notes` is currently rendered inside the Clinical Information tile:
     - Move it out to a standalone tile labelled `"Notes"`.
     - Position the Notes tile after the Clinical Information tile and before the Metadata section.
   - Verify no JSX key collisions are introduced by the reorder.

**Relevant Context:**
- Comments tile: [`ExaminationDetailPage.tsx:~516–524`](../frontend/src/pages/ExaminationDetailPage.tsx)
- Clinical Information tile: [`ExaminationDetailPage.tsx:~527–547`](../frontend/src/pages/ExaminationDetailPage.tsx)

**Status:** `[x] done`

---

## Testing and Validation Strategy

### Per-DR Acceptance Criteria Verification

| ID | Verification Method |
|----|-------------------|
| DR1-01 | Visual inspection of Patient Detail Page exam tile heading |
| DR1-02 | Verify columns in Patient Detail exam table: Date, Type, Status; check `getExamTypeLabel` resolves correctly |
| DR1-03 | Select a type → observe API request includes `examination_type`; select "All Types" → no param; "Load More" works post-filter |
| DR1-04 | Visual: button inside exam tile reads "Add Exam" |
| DR1-05 | Visual: header button reads "Create Exam" |
| DR1-06 | Patient list table has no MRN column; Patient Detail still shows MRN |
| DR1-07 | Patient Info tile is multi-column; all fields visible; conditionals unchanged |
| DR1-08 | Type field visually wider; date field narrower; no layout breakage |
| DR1-09 | BPD/HC/AC/FL percentile fields appear below their inputs after calc; detached block gone |
| DR1-10 | TCD, CM, OFD, Vp appear in same row; 6-col grid; APAD/TAD/LA/LC in row 2 |
| DR1-11 | Patient Info tile on Exam Detail is 2-column grid |
| DR1-12 | Pregnancy Data fields in Patient Info tile; standalone Pregnancy tile absent |
| DR1-13 | OFD/TCD/NF/APAD/TAD have no percentile badge; BPD/HC/AC/FL/EFW retain badges |
| DR1-14 | Field audit complete; every `formData` key has display on detail page; PDF updated |
| DR1-15 | Clinical Info tile above Comments tile in page DOM |
| DR1-16 | Nav item reads "Exams" |
| DR1-17 | Page h1, TableContainer title, PageLoader description, aria-labels all updated |
| DR1-18 | No `{value && <Field />}` patterns on individual fields in detail page or PDF |

### Edge Cases

- **DR1-02/DR1-03:** Patient with no exams — filter shows empty state; `getExamTypeLabel` with unknown key returns `"—"`.
- **DR1-03:** Switching filter type rapidly — only the last request's result should be applied (consider a basic loading guard or use the existing `isLoading` state).
- **DR1-09:** Percentile fields before first calc — fields render with empty value (not `"undefinedth"`); confirm no crash.
- **DR1-10:** 4 fields in row 2 (APAD, TAD, LA, LC) — CSS auto-placement leaves two empty cells; no visual artifact.
- **DR1-18:** Fields with value `0` — must still render (e.g., a biometry value of `0`); do not filter on falsy.

### Regression Risks

- **PatientDetailPage exam table (Sub-Tasks 1, 3, 4):** Three sub-tasks touch the same file; implement in order to avoid merge conflicts.
- **ExaminationDetailPage (Sub-Tasks 8–11):** All four sub-tasks touch the same file; implement in listed order (8 → 9 → 10 → 11).
- **ExaminationForm.tsx (Sub-Tasks 5–7):** Three sub-tasks touch the same file; implement 5 → 6 → 7.
- **PDF report:** Only touched in Sub-Tasks 10; no other sub-tasks affect it. Verify print/email flow still works after changes.

---

## Development Sequencing and Dependencies

The sub-tasks are sequenced to minimise intra-file conflicts and allow independent review of each group.

```
Phase 1 (no dependencies — start immediately, can be parallelised):
  Sub-Task 1 — Label renames (Layout, ExaminationsPage, PatientDetailPage copy)
  Sub-Task 2 — Remove MRN column (PatientsPage — isolated file)

Phase 2 (depends on Phase 1 PatientDetailPage state):
  Sub-Task 3 — Patient Detail exam table columns + filter
  Sub-Task 4 — Patient Info compact layout

Phase 3 (ExaminationForm — isolated file, can start in parallel with Phase 2):
  Sub-Task 5 — Row4 column widths
  Sub-Task 6 — Inline percentile fields
  Sub-Task 7 — 6-column biometry regrouping

Phase 4 (ExaminationDetailPage — all touch same file, must be sequential):
  Sub-Task 8  — Compact Patient Info + merge Pregnancy Data
  Sub-Task 9  — Remove unneeded percentile badges
  Sub-Task 10 — Full field audit + add missing fields + PDF update
  Sub-Task 11 — Reorder sections
```

**Parallelisable pairs:**
- Sub-Task 1 + Sub-Task 2 (different files, no shared state)
- Phase 2 group (PatientDetailPage) + Phase 3 group (ExaminationForm) can proceed simultaneously
- Sub-Tasks 5, 6, 7 can be done together in a single PR if the implementer is comfortable with
  the combined diff; however sequential implementation and review is preferred for clarity.

---

## Assumptions and Open Questions

| # | Topic | Assumption / Question |
|---|-------|-----------------------|
| A1 | `PatientsPage.tsx` location | Assumed to be at `frontend/src/pages/PatientsPage.tsx` (not explicitly in the explored file list but referenced in the spec). **Verify file exists at that path before implementation.** |
| A2 | DR1-03 rapid filter switching | No debounce is required on the filter dropdown change (each selection is discrete). If the API is slow, a simple `isLoading` guard that disables the dropdown during fetch is sufficient. |
| A3 | DR1-09 percentile key names | The `percentiles` state object populated by `calcBiometryPercentiles()` is assumed to have keys `bpdPct`, `hcPct`, `acPct`, `flPct`. **Verify exact key names before coding the inline fields.** |
| A4 | DR1-10 OFD/Vp current location | OFD and Vp are stated to currently appear in a "different row position" from TCD/CM. **Verify which `rowX` div they are currently in; they may need to be physically moved between JSX blocks.** |
| A5 | DR1-14 PDF report component | The PDF report file(s) are under `frontend/src/components/reports/` but the exact component name was not read. **Read the reports directory to identify which component(s) generate the PDF before implementing Sub-Task 10.** |
| A6 | DR1-15 Notes field location | The spec states Notes may be inside the Clinical Information tile. **Verify whether `examination.notes` is rendered inside or outside the Clinical Information tile before implementing Sub-Task 11.** |
| A7 | DR1-18 section-level conditionals | The spec permits section-level conditionals (e.g., hiding the entire Doppler tile if no doppler data). This plan assumes those are acceptable to leave unless they would hide individual input fields. **Confirm with stakeholders whether entire-section hiding is acceptable.** |
| A8 | `getExamTypeLabel` import path | Assumed to be exported from `frontend/src/constants/examinationTypes.ts`. **Verify the export name matches before importing in PatientDetailPage.** |

---

## Definition of Done

The full set of requirements from `REQUIREMENTS-SPEC-DEFECTS-ROUND1.md` is considered complete and
ready for release when **all** of the following criteria are met:

1. **All 18 DR1 requirements implemented** — Each requirement's acceptance criteria are satisfied as
   defined in the spec; no acceptance criterion is partially addressed.
2. **No regressions** — All existing frontend pages load without console errors. Examination create,
   edit, list, and delete flows complete successfully in a local development environment.
3. **DR1-18 unconditional rendering** — A field-by-field audit has been completed confirming that no
   individual input field on the Examination Detail Page or in the PDF report is subject to conditional
   omission. The audit result is documented (inline comment or noted in the implementation notes).
4. **DR1-14 field parity** — Every field present in `ExaminationForm.tsx` has a corresponding display
   element on the Examination Detail Page and in the PDF report.
5. **DR1-03 server-side filter** — The "Filter by Type" on the Patient Detail Page triggers an API
   request with the correct `examination_type` query parameter (verified in browser DevTools Network tab).
6. **Sub-Task sequencing respected** — Phase 4 sub-tasks (8–11) have been implemented in order with
   no JSX errors or broken component tree.
7. **No new TypeScript compilation errors** — The frontend project compiles without errors after all changes.
8. **No new lint warnings** — ESLint/TSLint passes without new warnings introduced by the changes.
