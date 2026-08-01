# Examination Detail View — Implementation Plan

## Top-Level Overview

**Goal:** Bring the Examination Detail view into full conformance with the visual layout
specification in `docs2/exam-details-view-template.txt`.

**Scope:** Read-only display only. The surrounding page chrome (breadcrumb, page header,
action buttons, delete modal) is explicitly out of scope per the template. No changes to
forms, API, or PDF generation are required unless noted.

**Primary files affected:**
- `frontend/src/pages/ExaminationDetailPage.tsx`
- `frontend/src/components/ExaminationSections.tsx`

**Out of scope (accepted deviations from template):**
- Date/datetime display format: `calcEDD()` returns its own formatted string and will be used as-is. All date values use existing `formatPlainDate` / `formatDateTime` helpers. The template's `DD.MM.YYYY` notation is treated as illustrative, not prescriptive.

**Approach:** Work tile by tile (Tiles 1–7) in declaration order, then address the
clinical section layout (Paths A and B) as a single, self-contained sub-task.

---

## Gap Analysis Summary

### What already satisfies the requirements

| Area | Status |
|---|---|
| Tile 1: Status tag (`getStatusTag`), MRN, exam date, type line | ✅ present |
| Tile 2: Patient name as link (`#0f62fe`), age at exam | ✅ present |
| Tile 3: GA from LMP, GA from Bio / GA from CRL (conditional), EDD, LMP, obstetric history, family history | ✅ all fields present (date format accepted as-is) |
| Clinical sections: field-level data completeness (all measurements stored and read) | ✅ present |
| Twin 1 / Twin 2 border-top colors (`#0f62fe` / `#6929c4`) | ✅ present |
| Markers section (Path B): all 10 boolean fields + placenta + cord insertion | ✅ present |
| Tile 4 (Findings), Tile 5 (Comments), Tile 6 (Notes) text blocks | ✅ present |
| Tile 7 (Metadata): created by, created at, last updated | ✅ present |
| Section visibility routing via `SECTION_VISIBILITY` | ✅ present |

### Gaps and conflicts by tile

**Tile 1 — Status Bar**
- The three-column cell ordering does not match the spec. Spec order: `Examination Date | MRN | Status`. Current code renders Date and Type in the left cell, MRN in the centre, Status right-aligned at the end — but the `flexDirection: 'column'` + `alignItems: 'flex-end'` makes Status visually mis-aligned.
- `[exam type]` line should read the human-readable label via `getExamTypeLabel()`, not `examination.examinationType.replace(/_/g, ' ')`.
- The spec says `font-weight: 600` for `[exam date bold]` and `[mrn bold]`. Current font-weight on the date/MRN value divs is `600` — ✅ already correct.
- The spec says the status label `"Status"` is a column header. Current code already has it — ✅.
- Missing: "Type:" prefix before the exam type label is present, but rendered using raw key instead of `getExamTypeLabel()`.

**Tile 2 — Patient Information**
- Header text: spec says `"PATIENT INFORMATION"` (ALL CAPS, 0.875rem, weight 600). Current code renders `<h3>Patient Information</h3>` — wrong capitalisation and wrong element/size.
- Label "Age at Examination" vs current "Patient Age at Exam" — label mismatch.

**Tile 3 — Pregnancy Data**
- Header text: spec says `"PREGNANCY DATA"` (ALL CAPS). Current: `<h3>Pregnancy Data</h3>`.
- Row ordering does not match spec:
  - Spec row 1: LMP Date | GA from LMP
  - Spec row 2: Expected Delivery Date (highlighted, blue bg) | GA from CRL or GA from Bio
  - Spec row 3: Obstetric History | Family History
  - Current: GA from LMP first, then GA from Bio/CRL, then EDD, then LMP, then Obstetric, then Family.
- EDD cell must have a **blue background** (spec: `highlight: blue background`). Currently only the EDD value text is styled `#0f62fe`; the cell itself has no background.
- GA label mismatch: spec says `"GA from LMP"` but current code reads `"Gestational Age (from LMP)"`.
- LMP label mismatch: spec says `"LMP Date"` but current code reads `"Last Menstrual Period (LMP)"`.
- **Date format (accepted deviation):** The template shows `DD.MM.YYYY`; existing helpers (`formatPlainDate`, `calcEDD`) are kept unchanged. Their output format is accepted.

**Clinical Section — Path A (prenatal / prenatal twins)**
- Title: spec says `"ULTRASOUND PRENATAL EXAM"` (ALL CAPS tile heading). Current code has no per-tile section heading for prenatal; sections are separate `<Tile>` elements with `<h3>` each.
- The spec mandates a single outer tile containing two fixed 50%-wide columns, even for single-fetus (right column hidden but left still 50%). Currently single-fetus uses full-width separate tiles; it does NOT preserve the 50% constraint.
- Column header text: spec says `"Single Fetus / Twin 1"` for the left column header. Current: `"Twin 1"` only (only shown when `isTwins`).
- TILE A2 (Biometry) must be a 3-column grid: `Measurement | Value | GA from Bio`. "GA from Bio" column spans only the first data row. Current biometry is a 2-column grid (label + value) with "GA from Bio" appended as an extra row at the bottom.
- Biometry percentile format: spec says `[value] - [N] "%-ile"` (e.g. `"32.4 - 45 %-ile"`). Current code uses `"32.4 mm · 45th"` — wrong separator, wrong suffix, missing explicit `%-ile`.
- Section header style: spec says ALL CAPS, 0.875rem, weight 600, `#161616`. Current uses `<h3>` and `<h4>` elements with no explicit style — sub-headings are weight 400 by default.
- TILE A3 (Anatomy): spec says auto-fit 6-column grid. Current uses `repeat(auto-fit, minmax(150px, 1fr))` which will vary by viewport — acceptable but should be documented.
- TILE A4 (Doppler): Doppler value cells currently use `color: '#525252'` (label colour) instead of `color: '#161616', fontWeight: 600` (value colour) for value cells.

**Clinical Section — Path B (first trimester)**
- Same 50% column constraint as Path A applies.
- Title heading: spec says `"FIRST TRIMESTER ULTRASOUND"`. Current code renders `"First Trimester Ultrasound"` in an `<h3>`.
- TILE B2 (FT Biometry): same 3-column grid requirement as TILE A2 (GA from CRL in third column, only first data row). Current uses `repeat(auto-fit, minmax(140px, 1fr))` flat grid.
- Sub-headings (`"ULTRASOUND FINDINGS"`, `"BIOMETRY MEASUREMENTS"`, `"MARKERS"`, `"ANATOMY"`, `"DOPPLER MEASUREMENTS"`) must match the section header style (ALL CAPS, 0.875rem, weight 600). Currently `<h4>` elements.
- TILE B5 (Doppler) in FT: the spec shows only Sub-grid A (A. ut. Dex. + A. ut. Sin.), no A. Umb. and no Sub-grid B. Current code only renders Sub-grid A for FT — ✅ already correct.

**Tile 4 — Clinical Information / Findings**
- Spec tile is labelled `"FINDINGS"` (ALL CAPS) and contains only the free-text block. Current code wraps both Findings and a `<h3>Clinical Information</h3>` heading in one tile. The spec does not show a "Clinical Information" super-heading; the tile heading IS `"FINDINGS"`.
- Label style: spec says `"FINDINGS"` as a tile heading, not a sub-label.

**Tile 5 — Comments**
- Spec: `"COMMENTS"` heading. Current: `<h3>Comments</h3>`.
- When no comments, current renders `"—"`. Spec shows `[free text]` block — no explicit empty state specified; `"—"` is acceptable.

**Tile 6 — Notes**
- Spec: `"NOTES"` heading. Current: `<h3>Notes</h3>`.

**Tile 7 — Metadata**
- Spec: `"METADATA"` heading (implied by template ALL CAPS convention). Current: `<h3>Metadata</h3>`.
- Spec row: `Created By | Created At` then `Last Updated | (empty)`. Current renders all three in one 2-column grid which means "Last Updated" occupies the first column of row 2 correctly — ✅ layout matches, but heading casing is wrong.
- **Datetime format (accepted deviation):** `formatDateTime` output is kept as-is.

---

## Sub-Tasks

---

### Sub-Task 1 — Tile heading style helper

**Status:** `[x] completed`

**Intent:** The spec defines a consistent tile section title style: ALL CAPS text,
`font-size: 0.875rem`, `font-weight: 600`, `color: #161616`. All `<h3>` and `<h4>`
tile headings need to adopt this style. A shared inline style object (not a component)
will avoid prop-drilling and keep both affected files DRY.

**Expected Outcomes:**
- A single `tileTitleStyle` constant in `ExaminationSections.tsx` (and a matching one in `ExaminationDetailPage.tsx`) applying the correct typography.
- All tile/section headings in both files use this style or an equivalent.
- No `<h3>`/`<h4>` elements retain default browser heading sizes for visible content.

**Todo List:**
1. In `ExaminationSections.tsx` define:
   ```
   const tileTitleStyle: React.CSSProperties = {
     fontSize: '0.875rem', fontWeight: 600, color: '#161616',
     textTransform: 'uppercase', marginBottom: '1rem',
   };
   ```
2. In `ExaminationDetailPage.tsx` define the same constant (or import from a shared location if the project has a styles utility).
3. Replace all `<h3 style={...}>…</h3>` and `<h4>…</h4>` heading elements that serve as tile/section titles in both files with `<div style={tileTitleStyle}>…</div>` (use semantic headings only where appropriate, but ensure visual consistency with spec).

**Relevant Context:**
- Spec STYLING REFERENCE: "Tile section title — ALL CAPS, font-size: 0.875rem, weight 600, color: #161616".
- Affects both `ExaminationDetailPage.tsx` and `ExaminationSections.tsx`.

---

### Sub-Task 2 — Tile 1 (Status Bar) fixes

**Status:** `[x] completed`

**Intent:** Fix the column ordering, exam-type label source, and alignment to match the
spec layout exactly: `Examination Date | MRN | Status` as three evenly spaced cells in a
single row. The `[exam type]` line must use `getExamTypeLabel()`.

**Expected Outcomes:**
- Tile 1 renders three equally spaced cells: Date (with sub-line "Type: [human label]"), MRN, Status tag.
- Status column uses the same left-aligned label/value pattern as the other two cells (not right-aligned).
- `examination.examinationType` is passed through `getExamTypeLabel()`.

**Todo List:**
1. In `ExaminationDetailPage.tsx`, locate the Status Bar `<Tile>` (lines ~266–293).
2. Change the flex container to `display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)'` for even spacing.
3. Re-order the three cells: Date cell first, MRN cell second, Status cell third.
4. In the Date cell, replace `.replace(/_/g, ' ')` with `getExamTypeLabel(examination.examinationType)` (already imported).
5. Remove `alignItems: 'flex-end'` from the Status cell container.

**Relevant Context:**
- `ExaminationDetailPage.tsx` lines 266–293.
- `getExamTypeLabel` is already imported from `../constants/examinationTypes`.

---

### Sub-Task 3 — Tile 3 (Pregnancy Data) restructure

**Status:** `[x] completed`

**Intent:** Reorder the Pregnancy Data grid rows to match the spec (LMP Date | GA from LMP,
EDD highlighted | GA from Bio/CRL, Obstetric | Family), apply EDD cell blue-background
highlight, fix field labels, and apply `DD.MM.YYYY` date format for LMP and EDD.

**Expected Outcomes:**
- Row 1: "LMP Date" → `formatDMY(lmp)` | "GA from LMP" → `examination.gestationalAge`
- Row 2: "Expected Delivery Date" → `formatDMY(edd)` with blue `#e8f1ff` background on the cell | "GA from Bio" or "GA from CRL" → corresponding value
- Row 3: "Obstetric History" → value | "Family History" → value
- EDD value text retains `color: '#0f62fe'`; the cell itself gains a light-blue background.
- Section heading reads `"PREGNANCY DATA"` using `tileTitleStyle`.

**Todo List:**
1. Apply `tileTitleStyle` to the Pregnancy Data heading (depends on Sub-Task 2).
2. Reorder the six `fieldBlock()` calls into the correct 3-row, 2-column sequence.
3. Replace `fieldBlock('Last Menstrual Period (LMP)', ...)` with label `"LMP Date"` (value unchanged — `lmp ? formatPlainDate(lmp) : '—'`).
4. Replace `fieldBlock('Gestational Age (from LMP)', ...)` with label `"GA from LMP"` (value unchanged).
5. For the EDD cell: use a custom block (not `fieldBlock`) with `style={{ backgroundColor: '#e8f1ff', padding: '0.5rem', borderRadius: '2px' }}` on the wrapper; value text keeps `color: '#0f62fe', fontWeight: 600`.
6. EDD value: `edd || '—'` — `calcEDD` output used as-is, no format conversion.
7. Update the conditional GA label: `"GA from CRL"` for first-trimester, `"GA from Bio"` for prenatal — labels already correct in code, just need the text to be exact.

**Relevant Context:**
- `ExaminationDetailPage.tsx` lines 313–337.

---

### Sub-Task 4 — Tiles 2, 4, 5, 6, 7 — heading and label fixes

**Status:** `[x] completed`

**Intent:** Fix all non-clinical tile headings and field labels to match spec text and
apply `tileTitleStyle`. Also fix Tile 7 datetime format and split Tile 4 ("Clinical
Information") into a dedicated "FINDINGS" tile.

**Expected Outcomes:**
- Tile 2 heading: `"PATIENT INFORMATION"`. Label: `"Age at Examination"`.
- Tile 4: heading `"FINDINGS"`, no `"Clinical Information"` super-heading.
- Tile 5 heading: `"COMMENTS"`.
- Tile 6 heading: `"NOTES"`.
- Tile 7 heading: `"METADATA"`. Datetime values use `formatDMYHHMM`.
- All headings use `tileTitleStyle`.

**Todo List:**
1. Change Tile 2 `<h3>Patient Information</h3>` to `<div style={tileTitleStyle}>PATIENT INFORMATION</div>`.
2. Change Tile 2 label `"Patient Age at Exam"` to `"Age at Examination"`.
3. Rename Tile 4 heading from `"Clinical Information"` to `"FINDINGS"` (using `tileTitleStyle`); remove the inner sub-heading for "Findings".
4. Change Tile 5 `<h3>Comments</h3>` to `<div style={tileTitleStyle}>COMMENTS</div>`.
5. Change Tile 6 `<h3>Notes</h3>` to `<div style={tileTitleStyle}>NOTES</div>`.
6. Change Tile 7 `<h3>Metadata</h3>` to `<div style={tileTitleStyle}>METADATA</div>`.
7. `formatDateTime` calls are kept as-is (date format accepted deviation).

**Relevant Context:**
- `ExaminationDetailPage.tsx` lines 296–386.

---

### Sub-Task 5 — Clinical Section layout restructure (Path A — prenatal)

**Status:** `[x] completed`

**Intent:** Restructure the prenatal (Path A) clinical section in `ExaminationSections.tsx`
to conform to the spec:
1. Wrap all four tiles (A1–A4) in a single outer `<Tile>` with heading `"ULTRASOUND PRENATAL EXAM"`.
2. Use a fixed 50%/50% two-column layout at all times — left column for Single Fetus / Twin 1, right column visible only for twins.
3. Left column header: `"Single Fetus / Twin 1"` with `border-top: 3px solid #0f62fe`.
4. Fix Biometry (TILE A2) to a 3-column grid with "GA from Bio" in the third column spanning only the first data row.
5. Fix Biometry percentile format from `"32.4 mm · 45th"` to `"32.4 - 45 %-ile"`.
6. Fix Doppler value cell colour from `#525252` (label) to `#161616` with `fontWeight: 600`.
7. Apply `tileTitleStyle` to all section headings (A1–A4 titles).

**Expected Outcomes:**
- Single-fetus prenatal exam: one tile with heading, two-column outer grid, only left column populated (right column empty but space preserved — NOT hidden).
- Twins prenatal exam: same tile, both columns populated.
- Biometry shows 3-column grid; "GA from Bio" appears in col 3, first data row only.
- Percentile format: `"32.4 - 45 %-ile"`.
- Doppler values styled with value colour.

**Todo List:**
1. Replace the separate `{!isTwins && !isFt && <> ... </>}` and `{isTwins && !isFt && <Tile>...</Tile>}` blocks with a single `{!isFt && ...}` block.
2. Inside that block, render one `<Tile>` with title `"ULTRASOUND PRENATAL EXAM"` (using `tileTitleStyle`).
3. Create an outer `<div>` with `display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem'`.
4. Left column: always render with header `"Single Fetus / Twin 1"`, `border-top: '3px solid #0f62fe'`.
5. Right column: render only when `isTwins` (`{isTwins && <div>...</div>}`), header `"Twin 2"`, `border-top: '3px solid #6929c4'`.
6. Each column contains, in order: TILE A1 (Ultrasound Findings), TILE A2 (Biometry), TILE A3 (Anatomy), TILE A4 (Doppler).
7. For TILE A2: change `bioGridStyle` to a 3-column grid: `'max-content minmax(8rem, 1fr) max-content'`. Add a `"GA from Bio"` header cell in column 3. Render `examination.gestationalAgeFromBiometry` in the first data row of column 3; remaining rows of column 3 are empty `<div />` cells.
8. Update `fmtVal` to produce `"[value] - [N] %-ile"` format: `pct !== undefined ? `${base} - ${pct} %-ile` : base`.
9. Fix Doppler value cells: change `color: '#525252'` to `color: '#161616'` and add `fontWeight: 600` on all value cells in both sub-grids.
10. Apply `tileTitleStyle` to all section-level headings (Ultrasound Findings, Biometry Measurements, Anatomy, Doppler Measurements).

**Relevant Context:**
- `ExaminationSections.tsx` lines 196–477.
- For the 3-column biometry grid: the "GA from Bio" column header uses `colSpan`-equivalent CSS: the header cell is in row 1 col 3, the value cell in row 2 col 3, and all subsequent rows get an empty `<div />` in col 3. This is accomplished with CSS Grid's implicit rows — no `rowSpan` needed.

---

### Sub-Task 6 — Clinical Section layout restructure (Path B — first trimester)

**Status:** `[x] completed`

**Intent:** Restructure the first-trimester (Path B) section to match spec:
1. Same 50%/50% outer column constraint as Path A.
2. Fix TILE B2 (FT Biometry) to a 3-column grid with "GA from CRL" in the third column.
3. Apply `tileTitleStyle` to all sub-section headings.
4. Title heading: `"FIRST TRIMESTER ULTRASOUND"`.
5. Fix Anatomy heading label to `"ANATOMY"` (was `"Anatomy"` in `<h4>`).

**Expected Outcomes:**
- Single-fetus FT exam: outer tile with one populated left column (right column space preserved at 50%).
- Twins FT exam: both columns populated.
- FT Biometry renders as 3-column grid; "GA from CRL" in col 3, first data row only.
- Sub-section headings use `tileTitleStyle`.

**Todo List:**
1. In `ExaminationSections.tsx`, update the `{isFt && !isFtTwinsExam && ...}` block:
   - Change outer `<Tile>` heading from `"First Trimester Ultrasound"` to `"FIRST TRIMESTER ULTRASOUND"` with `tileTitleStyle`.
   - Add the 2-column outer grid div (same as Path A); left column always rendered, right column hidden for single fetus.
   - Left column header: `"Single Fetus / Twin 1"` with blue border-top.
2. In `{isFtTwinsExam && ...}` block:
   - Same heading correction.
3. Update `renderFtTop()`: change the Biometry block from `repeat(auto-fit, minmax(140px, 1fr))` to a 3-column grid with "GA from CRL" header in col 3, value in first data row, empty cells for remaining rows.
4. Update `renderFtBottom()`: apply `tileTitleStyle` to "Anatomy" and "Doppler Measurements" sub-headings.
5. Apply `tileTitleStyle` to "Ultrasound Findings", "Biometry Measurements", "Markers" sub-headings.

**Relevant Context:**
- `ExaminationSections.tsx` lines 99–193.
- `renderFtTop` and `renderFtBottom` helper functions.

---

## Implementation Order

```
Sub-Task 1 → Sub-Task 2 → Sub-Task 3 → Sub-Task 4 → Sub-Task 5 → Sub-Task 6
```

Sub-Task 1 is foundational (style constant) and must be done first.
Sub-Tasks 2–4 are independent of each other once Sub-Task 1 is done (all in `ExaminationDetailPage.tsx`).
Sub-Tasks 5 and 6 are independent of each other and depend only on Sub-Task 1 (all in `ExaminationSections.tsx`).

---

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| 3-column biometry grid breaks in very narrow containers (e.g. twins column at 50%) | Test at the minimum supported viewport; if the third column is too narrow, use `minmax(0, auto)` for col 3 |
| Changing `fmtVal` percentile format affects the twins biometry column too (intentional) | Format change is spec-wide (spec line 392 confirms `[value] - [N] "%-ile"` universally) |
| ALL CAPS via `textTransform: 'uppercase'` vs literal uppercase strings | Use CSS `textTransform` so the source text remains readable in code; this matches Carbon's pattern |

---

## Assumptions

1. **Date format accepted:** `calcEDD()`, `formatPlainDate()`, and `formatDateTime()` outputs are used as-is. The template's `DD.MM.YYYY` notation is illustrative only and has been accepted as a deviation.
2. The blue EDD background colour `#e8f1ff` (Carbon blue-10) is the intended interpretation of "blue background" in the spec, as the spec does not specify an exact token. This can be adjusted.
3. No changes to the PDF report are in scope (PDF already has its own formatting layer).
4. The `tileTitleStyle` constant is defined locally in each file (not extracted to a shared module) to keep the change minimal.
5. Section sub-headings inside columns (e.g. "ULTRASOUND FINDINGS", "BIOMETRY MEASUREMENTS") use the same `tileTitleStyle` as tile-level headings, per the spec's Styling Reference which does not distinguish between levels.
