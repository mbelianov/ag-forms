# Biometry View & Form Update — Implementation Plan

## Overview

This plan delivers the changes introduced in `exam-details-view-template_v2.txt` relative to
the baseline `exam-details-view-template.txt`. It covers four coordinated areas:

1. **Biometric field order** — synchronise the input form's field order to match the view template.
2. **Calculate button relocation** — move the "Biometry / EFW" button to the last row of the
   Biometric section, column 4.
3. **Preparatory groundwork** — structural, layout, and data-model accommodations for future
   per-measurement GA calculations and percentile persistency.
4. **PDF report updates** — mirror all v2 biometry changes in the jsPDF renderer.

Sub-Tasks 1 and 2 are frontend-form-only. Sub-Task 3 requires a coordinated backend change
(schema extension) and is explicitly preparatory. Sub-Task 4 is PDF-layer only and depends
on Sub-Task 3's interface contracts.

Additionally, a consistency decision was made to **unify the `"GA (Bio)"` label** in the PDF
patient header block: both prenatal and first-trimester exams will show `"GA (Bio): "` —
eliminating the current `"GA (CRL): "` / `"GA (Bio): "` split. See Sub-Task 5.

---

## Diff Analysis: v1 → v2 Changes

> This section is cumulative — it covers all changes across the initial v2 authoring and
> the subsequent external update to v2.

### Document Header
| Area | v1 | v2 |
|------|----|----|
| Title format | `EXAMINATION DETAIL VIEW —` | `EXAMINATION DETAIL VIEW Version 2 —` |
| Date | `2025-07` | `2026-08` |
| Changes block | absent | present (3 lines describing biometry changes) |

### TILE A2 — Biometry Measurements (Path A — Prenatal)

#### 1. Column 4 header
| v1 | v2 |
|----|----|
| `"GA from Bio"` | `"GA"` |

#### 2. Column 4 description
| v1 | v2 |
|----|----|
| Single value on BPD row only; all other col-4 cells empty | Per-measurement GA shown on each row that has a derivable GA formula |

#### 3. Biometric field order (MAJOR change)
The order of rows in TILE A2 differs between v1 and v2:

| Position | v1 field | v2 field |
|----------|----------|----------|
| 1 | BPD (mm) | BPD (mm) — unchanged |
| 2 | OFD (mm) | OFD (mm) — unchanged |
| 3 | HC (mm) | HC (mm) — unchanged |
| 4 | TAD (mm) | TAD (mm) — unchanged |
| 5 | APAD (mm) | APAD (mm) — unchanged |
| 6 | AC (mm) | AC (mm) — unchanged |
| 7 | FL (mm) | FL (mm) — unchanged |
| 8 | TCD (mm) | **EFW (grams)** ← moved up |
| 9 | Vp (mm) | TCD (mm) ← shifted down |
| 10 | CM (mm) | Vp (mm) ← shifted down |
| 11 | NF (mm) | CM (mm) ← shifted down |
| 12 | NB (mm) | NF (mm) ← shifted down |
| 13 | **EFW (grams)** | NB (mm) ← shifted down |
| 14 | LA (mm) | LA (mm) — unchanged |
| 15 | LC (mm) | LC (mm) — unchanged |

**Summary:** EFW moved from position 13 to position 8 (immediately after FL). Positions 8–12
shift down by one.

#### 4. GA values in column 4
v2 now shows individual `[ga from X]` values on specific measurement rows:

| Row | v1 col 4 | v2 col 4 |
|-----|----------|----------|
| BPD | `[ga from bio]` (single summary) | `[ga from bpd]` |
| OFD | empty | `[ga from ofd]` |
| HC  | empty | `[ga from hc]` |
| TAD | empty | `[ga from tad]` |
| APAD | empty | `[ga from apad]` |
| AC  | empty | `[ga from ac]` |
| FL  | empty | `[ga from fl]` |
| EFW | — (was at row 13, empty) | `[ga from efw]` |
| TCD–LC | empty | empty (unchanged) |

#### 5. Percentile column — expanded field set (NEW — introduced in external v2 update)
v2 expands percentile display beyond the original BPD, HC, AC, FL, EFW set:

| Row | v1 Percentile col | v2 Percentile col |
|-----|-------------------|-------------------|
| BPD | `[N] "%-ile"` | `[N] "%-ile"` — unchanged |
| OFD | `"—"` | **`[N] "%-ile"`** ← new |
| HC  | `[N] "%-ile"` | `[N] "%-ile"` — unchanged |
| TAD | `"—"` | **`[N] "%-ile"`** ← new |
| APAD | `"—"` | **`[N] "%-ile"`** ← new |
| AC  | `[N] "%-ile"` | `[N] "%-ile"` — unchanged |
| FL  | `[N] "%-ile"` | `[N] "%-ile"` — unchanged |
| EFW | `[N] "%-ile"` | `[N] "%-ile"` — unchanged |
| TCD–LC | `"—"` | `"—"` — unchanged |

**Full v2 percentile set: BPD, OFD, HC, TAD, APAD, AC, FL, EFW** (8 fields; adds OFD, TAD, APAD).

### TILE B2 — Biometry (First Trimester)

#### 1. Column 3 header renamed (NEW — introduced in external v2 update)
| v1 | v2 |
|----|----|
| `"GA from CRL"` | `"GA"` |

This aligns TILE B2's col-3 header with TILE A2's col-4 header, establishing a
consistent `"GA"` label across all biometry grids.

#### 2. Column 3 GA values
| Row | v1 col 3 | v2 col 3 |
|-----|----------|----------|
| CRL | `[ga from crl]` | `[ga from crl]` — unchanged |
| NT  | empty | **`[ga from nt]`** ← new |
| NB  | empty | **`[ga from nb]`** ← new |
| Heart Rate | empty | empty — unchanged |

### Inconsistencies corrected in v2 (Task 2 — all rounds)
All inconsistencies found across the initial v2 file and the subsequent external update have
been corrected directly in `exam-details-view-template_v2.txt`:

| Location | Issue | Correction |
|----------|-------|------------|
| Header line 2 | `Version 2—` (no space before em-dash) | `Version 2 —` |
| Header line 4 | `Biomteric` typo | `Biometric` |
| Header line 5 | "GA from Bio removed" — misleading | Replaced with accurate description |
| Header line 6 | `Biomteric` typo (×2) | `Biometric` |
| TILE A2 layout prose | "spans only one row … single value cell on BPD row" | Updated to describe per-measurement GA; column label corrected to `GA` |
| TILE A2 field notes | `[ga from bio]` singular | Updated to `[ga from X]` per-measurement |
| TILE A2 field notes | Only listed BPD, HC, AC, FL, EFW as having percentiles | Updated to BPD, OFD, HC, TAD, APAD, AC, FL, EFW |
| TILE B2 layout prose | `"GA from CRL"` column description; "spans only one row" text | Updated to `"GA"` label; updated to per-measurement description |
| TILE B2 field notes | `[ga from crl]` singular | Updated to `[ga from X]` per-measurement |

---

## Sub-Task 1 — Input Form Field Order Update

### Intent
The biometric input form (`BiometrySection.tsx`) currently renders fields in an order that
does not match the v2 view template. Specifically, EFW appears at position 13 in the form but
must move to position 8 (immediately after FL). This ensures the form mirrors what the
clinician sees in the read-only detail view, reducing cognitive dissonance.

### Expected Outcomes
- `BiometrySection.tsx` renders biometry input rows in this exact order:
  BPD → OFD → HC → TAD → APAD → AC → FL → **EFW** → TCD → Vp → CM → NF → NB → LA → LC
- The visual order in the form matches TILE A2 of `exam-details-view-template_v2.txt`.
- No field is added, removed, renamed, or functionally changed.
- All existing validation, state binding, and error handling remain intact.

### Todo List
1. Open `frontend/src/components/sections/BiometrySection.tsx`.
2. Locate the JSX block for EFW (currently after NB, before LA — around line 178).
3. Cut the entire EFW row block (TextInput for value + read-only percentile cell + empty
   placeholder div for col 3).
4. Paste it immediately after the FL row block (currently around line 132–145).
5. Verify the resulting order in the JSX matches: BPD, OFD, HC, TAD, APAD, AC, FL,
   **EFW**, TCD, Vp, CM, NF, NB, LA, LC.
6. Confirm there are no index-based or positional dependencies in the parent component
   (`ExaminationForm.tsx` or `useExaminationForm.ts`) that rely on render order.
7. Smoke-test the form visually in the browser for both single and twin prenatal exams.

### Relevant Context
- **File:** `frontend/src/components/sections/BiometrySection.tsx`
  - EFW input: ~line 178; FL input: ~lines 132–145
  - Grid is CSS `gridTemplateColumns: '1fr 1fr 1fr'` — purely positional, no named areas
- **File:** `frontend/src/hooks/useExaminationForm.ts` — form state keyed by field name (not
  position); reorder is safe.
- **File:** `frontend/src/components/ExaminationSections.tsx` — detail view already renders
  EFW at position 8 (lines 299–302). No change needed here.

### Dependencies
- None. This change is self-contained within `BiometrySection.tsx`.

### Risks / Notes
- Low risk: the grid is position-agnostic; no array indices are used.
- Existing snapshot/visual regression tests (if any) will need updating.

### Status
- [x] **COMPLETE** — EFW row moved from position 13 to position 8 (after FL) in `BiometrySection.tsx`.

---

## Sub-Task 2 — Biometry Calculate Button Relocation

### Intent
The "Biometry / EFW" calculate button is currently in **row 7 (FL row), column 3** of the
3-column form grid. After the field-order update (Sub-Task 1), EFW moves to row 8. The
button must move to the **last row of the Biometric section** (after all 15 fields) and be
placed in **column 4** of a new 4-column layout for that row.

This matches the spirit of the v2 template where column 4 is the "action / GA" column, and
ensures the button is not interleaved with measurement input rows, which improves the form UX
and prepares for future per-row GA display actions.

### Expected Outcomes
- The "Biometry / EFW" button is no longer in the FL row.
- A dedicated "calculate row" is appended after LC (the last measurement field).
- The calculate row uses 4 columns; the button occupies column 4.
- Columns 1–3 of the calculate row are empty spacers (preserving alignment with the
  measurement rows above).
- The button's click handler, disabled state, and tooltip are unchanged.

### Current Location
| Property | Value |
|----------|-------|
| File | `frontend/src/components/sections/BiometrySection.tsx` |
| Row (visual) | 7 — the FL row |
| Column | 3 (of 3) |
| Lines | ~138–144 |

### Target Location
| Property | Value |
|----------|-------|
| Row (visual) | 16 — appended after the LC row (last measurement) |
| Column | 4 (of 4) |
| Grid change | Calculate row uses `gridTemplateColumns: '1fr 1fr 1fr 1fr'` (or a dedicated wrapper) |

### Todo List
1. Open `frontend/src/components/sections/BiometrySection.tsx`.
2. Remove the Button JSX from the FL row (the col-3 cell that currently holds the button).
   Replace it with an empty `<div />` to preserve the 3-column grid layout for the FL row.
3. After the LC row (last row), add a new "calculate row" `<div>` with its own grid style:
   `gridTemplateColumns: '1fr 1fr 1fr 1fr'` (4 equal columns), or reuse the outer grid and
   introduce a `gridColumn: '4 / 5'` span on the button.
4. Place three empty `<div />` spacers in columns 1–3 of the calculate row.
5. Move the Button JSX into column 4 of the calculate row; keep all props intact
   (`kind`, `size`, `onClick`, `disabled`, `title`).
6. Verify the `calcButtonWrap` style (currently used for vertical alignment at row end) is
   either removed or adapted — alignment is now at the natural bottom of the row.
7. Visually verify the button aligns to the right edge, consistent with column 4.
8. Verify the button enable/disable logic (`canCalcGA`) is unaffected.

### Layout Adjustment Notes
- The 15 measurement rows continue to use `gridTemplateColumns: '1fr 1fr 1fr'` (3 columns).
- The calculate row is a sibling `<div>` rendered below the measurement rows, with its own
  4-column grid — OR the entire section adopts a 4-column grid and measurement rows
  leave column 4 empty (preferred for future Sub-Task 3 work; see note below).
- **Preferred approach (preparation-friendly):** Convert the entire biometry grid to
  `gridTemplateColumns: '1fr 1fr 1fr 1fr'`. All current measurement rows have col 4 as an
  empty `<div />`. The calculate row's button sits in col 4. This makes Sub-Task 3 trivial
  to implement later.

### Dependencies
- Sub-Task 1 should be completed first (EFW relocation changes the FL row which is the
  button's current row). Completing Sub-Task 1 first avoids editing the same lines twice.

### Risks / Notes
- If the 4-column approach is adopted, every measurement row gains one extra `<div />` —
  review total DOM node count for large twin forms (2× BiometrySection instances).
- The `calcButtonWrap` inline style currently vertically aligns the button at the bottom of
  its row. After the move, standard `alignItems: 'end'` on the grid row is sufficient.

### Status
- [x] **COMPLETE** — Grid converted to 4-column; button relocated to dedicated calculate row after LC, col 4. `calcButtonWrap` style removed.

---

## Sub-Task 3 — Preparation for Additional Biometric Calculations and Percentile Persistency

### Intent
This sub-task is **explicitly preparatory** — no new calculation logic is shipped now. Its
purpose is to put in place the structural, layout, and data-model scaffolding that will allow
future per-measurement GA calculations and persisted percentile values to be added with
minimal friction.

The v2 template defines `[ga from X]` values for BPD, OFD, HC, TAD, APAD, AC, FL, EFW in
the view (col 4 of TILE A2) and GA values for NT and NB in TILE B2. The current system
computes only a single `gestationalAgeFromBiometry` (average GA) and does not persist any
percentile. These future features will require:

1. A per-measurement GA field in the data model (e.g. `bpdGa`, `ofdGa`, …)
2. Persisted percentile values in the data model (e.g. `bpdPercentile`, `hcPercentile`, …)
3. Column 4 GA slots in the form input layout.
4. Column 4 GA read-only cells in the detail view.

### Expected Outcomes (Preparatory — no calculation logic yet)
- **Data model:** `Biometry` interface extended with optional per-measurement GA fields and
  optional percentile fields (all optional, typed as `string | undefined` for GA and
  `number | undefined` for percentile).
- **Form layout:** The biometry grid is already 4 columns after Sub-Task 2. Column 4
  in measurement rows holds an empty `<div />` placeholder for now. No new inputs yet.
- **Detail view layout:** `ExaminationSections.tsx` column-4 cells for rows that will
  eventually have GA values are rendered as `{bio?.bpdGa ?? ''}` with a `—` fallback —
  same pattern already used for `[ga from bio]`.
- **Naming conventions documented** (in this file) so future implementors follow them
  consistently.
- **Backend schema:** The `Biometry` table entity gains the new optional fields; existing
  records are unaffected (all fields are optional).

### Structural Accommodations

#### Data Model — `Biometry` Interface Extension
Add the following optional fields to `frontend/src/types/index.ts` `Biometry` interface.
Also add matching fields to the API-side `Biometry` type (if it exists as a separate
interface in `api/src/`):

**Per-measurement GA fields (format: "Xw Yd"):**
```
bpdGa?:   string   // GA derived from BPD
ofdGa?:   string   // GA derived from OFD
hcGa?:    string   // GA derived from HC
tadGa?:   string   // GA derived from TAD
apadGa?:  string   // GA derived from APAD
acGa?:    string   // GA derived from AC
flGa?:    string   // GA derived from FL
efwGa?:   string   // GA derived from EFW
// First trimester
crlGa?:   string   // GA derived from CRL (already exists as gestationalAgeFromCRL — review naming)
ntGa?:    string   // GA derived from NT
nbGa?:    string   // GA derived from NB (first trimester)
```

**Persisted percentile fields** (v2 expanded set — BPD, OFD, HC, TAD, APAD, AC, FL, EFW):
```
bpdPercentile?:   number
ofdPercentile?:   number   // NEW — added in v2 external update
hcPercentile?:    number
tadPercentile?:   number   // NEW — added in v2 external update
apadPercentile?:  number   // NEW — added in v2 external update
acPercentile?:    number
flPercentile?:    number
efwPercentile?:   number
```

> Note: `gestationalAgeFromBiometry` (the existing average GA field) is retained for
> backward compatibility. The new per-measurement GA fields supplement it.

#### Layout — Form (`BiometrySection.tsx`)
After Sub-Task 2 the grid is already 4-column. Each measurement row's col-4 cell is an
empty `<div />` placeholder. No additional layout change is needed here — the placeholders
are already in place.

When per-measurement GA calculation is implemented in a future task, each placeholder is
replaced by a read-only `<TextInput readOnly />` displaying the calculated GA value.

#### Layout — Detail View (`ExaminationSections.tsx`)
The existing 4-column `bioGridStyle4col` grid is already in place. Col 4 currently shows
`[ga from bio]` on the BPD row only (v1 behaviour). After this preparatory task it will
display `{bio?.bpdGa ?? '—'}`, `{bio?.ofdGa ?? '—'}`, etc., in each row — using `'—'`
as the empty-state sentinel consistent with other fields in the view.

#### Backend — Azure Table Storage (`Examinations` table)
Azure Table Storage is schema-less, so no migration DDL is needed. The new fields will
simply be absent on existing records (undefined → displayed as `'—'`). The API endpoint
for `updateExamination` / `createExamination` must be updated to write and read the new
fields when they are present.

#### Naming Conventions
| Domain | Convention | Example |
|--------|------------|---------|
| Per-measurement GA (data model) | `{measurementKey}Ga` | `bpdGa`, `hcGa` |
| Persisted percentile (data model) | `{measurementKey}Percentile` | `bpdPercentile` |
| Form field key (string) | same as data model key | `bpdGa`, `bpdPercentile` |
| Form error key | `t1_{measurementKey}Ga` | `t1_bpdGa` |
| Twin 2 state prefix | `t2_` | `t2_bpdGa` |
| Display label in template | `[ga from {FIELD}]` | `[ga from bpd]` |

### Todo List
1. Add per-measurement GA fields and percentile fields to `Biometry` interface in
   `frontend/src/types/index.ts`. Use the full v2 set:
   - GA fields: `bpdGa`, `ofdGa`, `hcGa`, `tadGa`, `apadGa`, `acGa`, `flGa`, `efwGa`,
     `ntGa`, `nbGa`, `crlGa` (first-trimester)
   - Percentile fields: `bpdPercentile`, `ofdPercentile`, `hcPercentile`, `tadPercentile`,
     `apadPercentile`, `acPercentile`, `flPercentile`, `efwPercentile`
2. Add the same fields to the API-side type in `api/src/` if a separate `Biometry`
   interface exists there.
3. In `BiometrySection.tsx` (after Sub-Task 2), ensure every col-4 measurement row
   cell is an explicit `<div />` placeholder (not a missing cell that would break grid
   alignment). Add a `data-slot="ga"` attribute for future targeting.
4. In `ExaminationSections.tsx`, update the col-4 cells for rows BPD through EFW to
   render `{bio?.bpdGa ?? '—'}` etc. instead of the current single `[ga from bio]` on
   the BPD row. The remaining rows already render empty — change their empty cells to
   explicit `'—'` to be consistent with the future pattern.
5. In `ExaminationSections.tsx`, update the percentile column cells for OFD, TAD, and
   APAD rows to render `{fmtPct(bio?.ofdPercentile)}` etc. instead of the hard-coded `'—'`.
   This enables the expanded percentile display required by v2 once calculation is wired up.
6. In `useExaminationForm.ts`, add the new GA and percentile keys to the initial form
   state object (initialised as empty string for GA fields, `undefined` for percentile
   fields).
7. In `useExaminationForm.ts`, add the new fields to the submit payload mapping (pass
   through the stored values; do not compute them yet).
8. In the API functions `CreateExamination.ts` and `UpdateExamination.ts`, ensure the
   new optional biometry fields are read from the request body and written to storage
   (pass-through; no calculation logic).
9. Document the reserved field names in a comment block at the top of `Biometry`
   interface in `index.ts`.

### Dependencies
- Sub-Task 2 must be complete (4-column grid must exist in the form).
- Sub-Task 3 has no dependency on runtime calculation work — it is purely structural.

### Risks / Notes
- **Backward compatibility:** All new fields are optional. Existing records display `'—'`
  for unpopulated GA/percentile columns. No data loss risk.
- **Twin forms:** All new fields need twin variants (`t2_` prefix) in form state and in
  the `biometry2` object in the data model. Ensure `biometry2` interface is extended in
  parallel with `biometry`.
- **`gestationalAgeFromBiometry` retention:** Do NOT remove this field. It is the
  currently-persisted single GA value. Future work will populate both the legacy field and
  the new per-measurement fields simultaneously.
- **Percentile non-persistence today:** The in-memory percentile calculation
  (`calcBiometryPercentiles`) is already correct. Sub-Task 3 only adds the _storage_
  plumbing. The calculation step of writing these percentile values through the button
  handler is deferred to the future implementation task.
- **First-trimester GA fields** (`ntGa`, `nbGa`): These affect `FirstTrimesterSection.tsx`
  and its data model. Scope them as part of this sub-task's data model extension but
  defer layout changes in the first-trimester form to the future implementation task.
- **New percentile fields (OFD, TAD, APAD):** These three fields have no reference formula
  today. The data model and display plumbing (Step 5 in Todo List) are added now as
  structural scaffolding. Calculation logic is deferred. Until a formula exists, values will
  display as `'—'` in both the form and the detail view.
- **TILE B2 `"GA"` header:** The first-trimester biometry grid's column 3 header is renamed
  from `"GA from CRL"` to `"GA"` to match the prenatal convention. This is a view-only
  label change in `ExaminationSections.tsx` and does not affect data or calculations.

### Status
- [x] **COMPLETE** — `Biometry`/`BiometryData` interfaces extended with GA+percentile fields. `FtBiometry` extended with `ntGa`/`nbGa`/`crlGa`. Detail view updated (per-row GA, expanded percentiles, col-4 header = "GA"). TILE B2 col-3 header = "GA". Form state + FIELD_REGISTRY updated for T1/T2 pass-through.

---

## Sub-Task 4 — PDF Report: Biometry Section Updates

### Intent
The PDF report is generated entirely on the client by jsPDF via `renderBiometryBlock()`
(prenatal) and `renderFtBiometryBlock()` (first trimester) in
`frontend/src/components/reports/pdfSections.ts`, fed by a view model built in
`frontend/src/services/viewModelBuilders.ts`. These PDF functions mirror the detail view
template and must be updated to match v2 in the same three areas:

1. **Prenatal biometry field order** — EFW must move from row 13 to row 8.
2. **Prenatal col-4 GA** — change from single `gaFromBio` on BPD row to per-measurement
   `[ga from X]` values on each supported row; rename col header from `"GA from Bio"` to `"GA"`.
3. **Prenatal col-3 percentile expansion** — OFD, TAD, APAD join the percentile-capable set.
4. **First-trimester col-3 GA expansion** — NT and NB rows gain GA values; col-3 header
   renamed from `"GA from CRL"` to `"GA"`.
5. **View model** — `buildViewModel()` must supply the new per-measurement GA and
   expanded percentile fields to both PDF render functions.

### PDF Architecture Overview
| Layer | File | Role |
|-------|------|------|
| View model builder | `frontend/src/services/viewModelBuilders.ts` | Transforms `Examination` → `ExamPdfViewModel`; sources all data for PDF |
| PDF renderer — sections | `frontend/src/components/reports/pdfSections.ts` | `renderBiometryBlock()` (prenatal) · `renderFtBiometryBlock()` (FT) |
| PDF renderer — document | `frontend/src/components/reports/pdfDocument.ts` | Calls section renderers with view model data |
| Print service | `frontend/src/services/print.service.ts` | Orchestrates download / blob / print flows |

### Current State vs. Required State

#### Prenatal — `renderBiometryBlock()` (pdfSections.ts ~lines 229–309)

| Property | Current (v1) | Required (v2) |
|----------|-------------|---------------|
| Field order | BPD OFD HC TAD APAD AC FL **TCD Vp CM NF NB EFW** LA LC | BPD OFD HC TAD APAD AC FL **EFW TCD Vp CM NF NB** LA LC |
| Col 4 header | `"GA from Bio"` | `"GA"` |
| Col 4 values | `gaFromBio` on BPD row only; empty on all other rows | Per-measurement GA on BPD, OFD, HC, TAD, APAD, AC, FL, EFW rows; empty on TCD–LC |
| Function signature | `gaFromBio: string \| undefined` (single param) | Replace with per-measurement GA object or individual params |
| Col 3 percentile set | BPD, HC, AC, FL, EFW | BPD, **OFD**, HC, **TAD**, **APAD**, AC, FL, EFW |

#### First Trimester — `renderFtBiometryBlock()` (pdfSections.ts ~lines 66–122)

| Property | Current (v1) | Required (v2) |
|----------|-------------|---------------|
| Col 3 header | `"GA from CRL"` | `"GA"` |
| Col 3 values | `gaFromCrl` on CRL row only; empty on NT, NB, Heart Rate | `gaFromCrl` on CRL · `gaFromNt` on NT · `gaFromNb` on NB · empty on Heart Rate |
| Function signature | Single `gaFromCrl` field on view model | Add `gaFromNt`, `gaFromNb` fields to `FtBiometryViewModel` |

#### View Model — `buildViewModel()` (viewModelBuilders.ts)

| Property | Current | Required |
|----------|---------|---------|
| Prenatal biometry | Passes `gestationalAgeFromBiometry` (single string) | Add per-measurement GA fields: `bpdGa`, `ofdGa`, `hcGa`, `tadGa`, `apadGa`, `acGa`, `flGa`, `efwGa` |
| Prenatal percentiles | Passes `bpdPct`, `hcPct`, `acPct`, `flPct`, `efwPct` | Add `ofdPct`, `tadPct`, `apadPct` |
| FT biometry | Passes `gaFromCrl` only | Add `gaFromNt`, `gaFromNb` |

### Expected Outcomes
- Printed/downloaded PDF prenatal biometry table matches the v2 view template exactly:
  correct row order, `"GA"` column header, per-measurement GA values, expanded percentile set.
- Printed/downloaded PDF first-trimester biometry table matches v2: `"GA"` column header,
  NT and NB rows show their derived GA values.
- The summary `"GA (Bio)"` label in the PDF header block (`pdfDocument.ts`) is **not changed**
  — it refers to the overall GA-from-biometry summary, not a column header, and is unaffected
  by this work.
- Twin prenatal and twin first-trimester exams are updated via the same `renderBiometryBlock`
  / `renderFtBiometryBlock` calls (twins call the same functions twice); no separate twin-path
  changes are needed beyond the view model supplying correct T2 data.

### Todo List

**Step 1 — View model: prenatal per-measurement GA fields**
1. Open `frontend/src/services/viewModelBuilders.ts`.
2. Locate the `BiometryViewModel` (or equivalent inline type) used by `renderBiometryBlock`.
3. Add per-measurement GA fields: `bpdGa`, `ofdGa`, `hcGa`, `tadGa`, `apadGa`, `acGa`,
   `flGa`, `efwGa` (all `string | undefined`).
4. In `buildViewModel()`, populate these fields from `exam.biometry.bpdGa` etc.
   (the new fields added to the `Biometry` interface in Sub-Task 3). Until calculation is
   wired up, they will be `undefined` and render as empty cells.
5. Repeat for Twin 2 (`biometry2` → `biometry2ViewModel`).

**Step 2 — View model: prenatal expanded percentile fields**
6. In the same view model, add `ofdPct`, `tadPct`, `apadPct` fields (`number | undefined`).
7. In `buildViewModel()`, populate from `exam.biometry.ofdPercentile` etc.
8. Repeat for Twin 2.

**Step 3 — View model: first-trimester NT/NB GA fields**
9. Locate `FtBiometryViewModel` in `viewModelBuilders.ts` or the inline type near
   `renderFtBiometryBlock`.
10. Add `gaFromNt: string | undefined` and `gaFromNb: string | undefined`.
11. In `buildViewModel()`, populate from `exam.biometry.ntGa` / `exam.biometry.nbGa`.
12. Repeat for Twin 2 FT biometry.

**Step 4 — `renderBiometryBlock`: field order (EFW relocation)**
13. Open `frontend/src/components/reports/pdfSections.ts`.
14. In `renderBiometryBlock()`, locate the row array / draw loop that renders the 15
    measurement rows.
15. Move the EFW row definition from position 13 to position 8 (immediately after FL).
    Resulting order: BPD, OFD, HC, TAD, APAD, AC, FL, **EFW**, TCD, Vp, CM, NF, NB, LA, LC.

**Step 5 — `renderBiometryBlock`: col-4 GA — per-measurement**
16. Change the function signature: replace the single `gaFromBio: string | undefined`
    parameter with a GA object (or an updated view model reference) supplying individual
    per-measurement GA strings.
17. Update the column-4 header text from `"GA from Bio"` to `"GA"`.
18. For each of the 8 GA-capable rows (BPD, OFD, HC, TAD, APAD, AC, FL, EFW), set
    `gaAppend` (or equivalent) to the appropriate per-measurement GA field from the view
    model. Leave TCD–LC with an empty string.
19. Update all call-sites in `pdfDocument.ts` that call `renderBiometryBlock` — update
    argument list to pass the new GA object/fields.

**Step 6 — `renderBiometryBlock`: expanded percentile set**
20. In the row definitions for OFD, TAD, and APAD, change their percentile source from a
    hard-coded `'—'` to `pctStr(vm.ofdPct)` / `pctStr(vm.tadPct)` / `pctStr(vm.apadPct)`
    (using the same `pctStr()` helper already applied to BPD, HC, AC, FL, EFW).
21. Until calculation provides real values, these will render as `'—'` (the `pctStr()`
    function returns `'—'` for `undefined`).

**Step 7 — `renderFtBiometryBlock`: col-3 header and NT/NB GA**
22. Change the column-3 header text from `"GA from CRL"` to `"GA"`.
23. Add `gaFromNt` and `gaFromNb` to the row definitions for the NT and NB rows
    (sourced from the updated `FtBiometryViewModel`). Heart Rate row remains empty.

**Step 8 — Update call-sites in `pdfDocument.ts`**
24. Locate every call to `renderBiometryBlock()` (single-fetus ~line 625; twin T1 / T2
    ~lines 662–669) and update the argument list to supply the new per-measurement GA
    fields alongside the updated view model.
25. No call-site changes required for `renderFtBiometryBlock()` if it reads directly from
    an updated `FtBiometryViewModel` reference.

**Step 9 — Smoke-test**
26. Generate a PDF for a single prenatal exam and verify: row order, `"GA"` header, per-row
    GA values (will be `'—'` until calculation wired up), expanded percentile columns.
27. Generate a PDF for a twin prenatal exam and verify both columns.
28. Generate a PDF for a first-trimester exam and verify `"GA"` header and NT/NB rows.

### Relevant Context
| Symbol | File | Lines |
|--------|------|-------|
| `renderBiometryBlock` | `frontend/src/components/reports/pdfSections.ts` | ~229–309 |
| `renderFtBiometryBlock` | `frontend/src/components/reports/pdfSections.ts` | ~66–122 |
| `buildViewModel` | `frontend/src/services/viewModelBuilders.ts` | ~42–304 |
| `buildExaminationPDF` | `frontend/src/components/reports/pdfDocument.ts` | ~216–446 |
| `renderClinicalSections` | `frontend/src/components/reports/pdfSections.ts` | ~488–691 |
| `pctStr()` helper | `frontend/src/services/viewModelBuilders.ts` | ~36–38 |

### Dependencies
- Sub-Task 3 must be complete: the `Biometry` interface needs the new GA and percentile
  fields (Steps 1–3 above draw from those fields).
- Steps 1–3 (view model) must be complete before Steps 4–7 (renderers) — the renderers
  consume the view model.
- Steps 4–7 are independent of each other within Sub-Task 4 and can be done in any order
  once the view model is ready.

### Risks / Notes
- **Function signature change:** `renderBiometryBlock`'s `gaFromBio` parameter becomes an
  object or is replaced by fields on the view model. Every call-site in `pdfDocument.ts`
  must be updated simultaneously to avoid a type error.
- **Column width:** Col 4 currently has ~15% of usable width (≈27mm for single, ~13mm for
  twins). Per-measurement GA strings ("28w 3d") fit within this space — no layout reflow
  needed. Verify visually for twin exams where column space is tighter.
- **Row height / page overflow:** Adding GA values to 8 rows (instead of 1) does not change
  the row count (15 rows) or row pitch (3.3mm). No page-break logic change is needed.
- **Backward compatibility in PDF:** PDFs are generated on demand from live data. No stored
  PDFs are affected. Once the view model supplies `undefined` for new fields, the renderers
  display `'—'`/empty safely.
- **`"GA (Bio)"` summary in header block:** The patient-block label in `pdfDocument.ts`
  (lines ~289–295) shows the overall GA from biometry summary. This label and its data
  source (`vm.gestationalAgeFromBiometry`) are **unchanged** — they are separate from the
  per-measurement GA column introduced in this sub-task.

### Status
- [x] **COMPLETE** — `renderBiometryBlock` updated: EFW at row 8, col-4 header = "GA", per-measurement GA, expanded percentiles. `renderFtBiometryBlock` updated: col-3 header = "GA", NT/NB rows get `gaFromNt`/`gaFromNb`. View model builders updated for T1/T2. All call-sites updated.

---

---

## Sub-Task 5 — Unify `"GA from Bio"` Label Across All Surfaces

### Intent
The general rule established for this system is:

> **"GA from Bio"** is a composite gestational age calculated from whichever biometry
> parameters are relevant to the exam type. This label is used consistently across ALL
> exam types and ALL surfaces. At the current level of development for first-trimester
> exams, GA from Bio equals GA from CRL (Robinson 1975 formula). The label is the same;
> only the underlying formula differs by exam type.

This replaces the previous per-type label split (`"GA from CRL"` for FT, `"GA from Bio"`
for prenatal). Every displayed label that currently reads `"GA from CRL"` is renamed to
`"GA from Bio"`. The internal data field name `gaFromCrl` is **not** renamed (it is a
storage key, not a display string).

### Scope — Full Surface Inventory

| Surface | File | Current label | After Sub-Task 5 |
|---------|------|---------------|-----------------|
| **Web — Pregnancy Data tile (row 2 right)** | `ExaminationDetailPage.tsx` line 343 | `'GA from CRL'` (FT) / `'GA from Bio'` (prenatal) | `'GA from Bio'` — **both types** |
| **Web — input form (FT GA field label)** | `FirstTrimesterSection.tsx` line 142 | `"GA from CRL"` | `"GA from Bio"` |
| **Web — input form (FT calculate button)** | `FirstTrimesterSection.tsx` line 160 | `GA from CRL` | `GA from Bio` |
| **Web — input form (FT calculate button tooltip)** | `FirstTrimesterSection.tsx` line 157 | `'Calculate GA from CRL (Robinson 1975, valid range 10–65 mm)'` | `'Calculate GA from Bio (CRL · Robinson 1975, valid range 10–65 mm)'` |
| **Web — biometry section (prenatal GA field label)** | `BiometrySection.tsx` line 91 | `"GA from Bio"` | `"GA from Bio"` — **already correct, unchanged** |
| **PDF — patient header secondary label** | `pdfDocument.ts` line 293 | `'  GA (CRL): '` (FT) / `'  GA (Bio): '` (prenatal) | `'  GA (Bio): '` — **both types** |
| **PDF — Pregnancy Data inline cell label** | `pdfDocument.ts` line 366 | `'GA from CRL: '` (FT) / `'GA from Bio: '` (prenatal) | `'GA from Bio: '` — **both types** |
| **PDF — FT biometry col-3 header** | `pdfSections.ts` line 88 | `'GA from CRL'` | `'GA'` — already planned in Sub-Task 4, confirmed here |
| **Internal field name `gaFromCrl`** | `types/index.ts`, hooks, view model | data key | **unchanged** — storage key, not a display string |

### Affected Lines — Detail

#### Web detail view — `ExaminationDetailPage.tsx` (~line 342–348)
Replace the ternary that renders `'GA from CRL'` for FT with a constant `'GA from Bio'`:
```
// before
isFt
  ? fieldBlock('GA from CRL', ...)
  : fieldBlock('GA from Bio', ...)

// after
fieldBlock('GA from Bio', isFt
  ? (examination.data?.ft_biometry?.gaFromCrl || '—')   ← value source unchanged
  : ...)
```

#### Web input form — `FirstTrimesterSection.tsx` (~lines 141–160)
Three string literals change:
| Location | Before | After |
|----------|--------|-------|
| `labelText` prop (~line 142) | `"GA from CRL"` | `"GA from Bio"` |
| Button text (~line 160) | `GA from CRL` | `GA from Bio` |
| Button tooltip (~line 157) | `'Calculate GA from CRL (Robinson 1975, valid range 10–65 mm)'` | `'Calculate GA from Bio (CRL · Robinson 1975, valid range 10–65 mm)'` |

#### PDF patient header — `pdfDocument.ts` (~lines 293–294, 366)
| Line | Before | After |
|------|--------|-------|
| 293 | `isFt ? '  GA (CRL): ' : '  GA (Bio): '` | `'  GA (Bio): '` (constant) |
| 294 | `isFt ? (gaFromCrlDisplay \|\| '—') : (gaBioDisplay \|\| '—')` | value ternary kept — only label on line 293 changes |
| 366 | `(isFt ? 'GA from CRL: ' : 'GA from Bio: ')` | `'GA from Bio: '` (constant) |

### Expected Outcomes
- The label `"GA from CRL"` is completely absent from all rendered UI and PDF surfaces.
- Every surface shows `"GA from Bio"` regardless of exam type.
- The underlying values are unchanged: FT continues to derive from `gaFromCrl`; prenatal
  continues to derive from `gestationalAgeFromBiometry`.
- The internal field name `gaFromCrl` in types, hooks, and view model is untouched.
- A code comment is added near the FT rendering logic in `ExaminationDetailPage.tsx` and
  `pdfDocument.ts` explaining: *"GA from Bio = GA from CRL for FT exams at current level"*.

### Todo List
1. **`ExaminationDetailPage.tsx`** (~line 342): Replace the `isFt ? fieldBlock('GA from CRL', ...) : fieldBlock('GA from Bio', ...)` ternary with `fieldBlock('GA from Bio', isFt ? (ft gaFromCrl value) : (prenatal gestationalAgeFromBiometry value))`. Add explanatory comment.
2. **`FirstTrimesterSection.tsx`** (~line 142): Change `labelText` from `"GA from CRL"` to `"GA from Bio"`.
3. **`FirstTrimesterSection.tsx`** (~line 157): Update button tooltip to `'Calculate GA from Bio (CRL · Robinson 1975, valid range 10–65 mm)'`.
4. **`FirstTrimesterSection.tsx`** (~line 160): Change button text from `GA from CRL` to `GA from Bio`.
5. **`pdfDocument.ts`** (~line 293): Replace ternary label with constant `'  GA (Bio): '`. Add explanatory comment.
6. **`pdfDocument.ts`** (~line 366): Replace ternary label with constant `'GA from Bio: '`.
7. Verify no other string literal `"GA from CRL"` remains in any `.tsx` / `.ts` UI or PDF
   file (use a codebase-wide search). The data field name `gaFromCrl` is allowed to remain.
8. Smoke-test all four exam types (single prenatal, twin prenatal, single FT, twin FT):
   - Web detail view Pregnancy Data tile shows `"GA from Bio"` in all cases.
   - FT input form shows `"GA from Bio"` on the label and button.
   - PDF header shows `"GA (Bio): "` in all cases.

### Relevant Context
| Symbol | File | Lines |
|--------|------|-------|
| Web Pregnancy Data tile | `frontend/src/pages/ExaminationDetailPage.tsx` | ~342–348 |
| FT GA field + button | `frontend/src/components/sections/FirstTrimesterSection.tsx` | ~141–160 |
| PDF secondary GA label | `frontend/src/components/reports/pdfDocument.ts` | 293–294 |
| PDF Pregnancy Data inline cell | `frontend/src/components/reports/pdfDocument.ts` | 366 |
| `gaFromCrlDisplay` declaration | `frontend/src/components/reports/pdfDocument.ts` | 230–232 |

### Dependencies
- None. This sub-task is independent of all others — it touches display labels only.
  It can be implemented at any point in the sequence, even as the first PR.
- The PDF biometry column header rename to `"GA"` (Sub-Task 4, Step 7) is a separate
  change already planned; it is consistent with this rule and needs no modification.

### Risks / Notes
- **Low risk across the board:** only display label strings change; no logic, no data
  model, no API contracts.
- **`gaFromCrl` field name stays:** Do not rename the storage field. It is an internal key
  that accurately describes the calculation source. The public-facing label is decoupled.
- **FT input form comment:** When `labelText="GA from Bio"` is set on the CRL-calculate
  field, add a JSX comment `{/* GA from Bio = GA from CRL for FT exams */}` so the
  rationale is preserved in code.
- **Future FT biometry expansion:** When additional FT measurements gain GA formulas, the
  composite `GA from Bio` for FT will aggregate them — the label will remain correct
  without any future rename.

### Status
- [x] **COMPLETE** — All surfaces unified: `ExaminationDetailPage.tsx` (Pregnancy Data tile), `FirstTrimesterSection.tsx` (field label, button text, tooltip), `pdfDocument.ts` (patient header secondary label + Pregnancy Data inline cell). `gaFromCrl` internal field name untouched.

---

## File Impact Summary

| File | Sub-Tasks | Nature of Change |
|------|-----------|-----------------|
| `frontend/src/components/sections/BiometrySection.tsx` | 1, 2, 3 | Field reorder; button relocation; 4-col grid; col-4 placeholders |
| `frontend/src/components/ExaminationSections.tsx` | 3 | Per-row GA display in col 4; TILE B2 col header; expanded percentile cells |
| `frontend/src/types/index.ts` | 3 | New optional fields on `Biometry` |
| `frontend/src/hooks/useExaminationForm.ts` | 3 | New fields in state init + submit mapping |
| `api/src/functions/CreateExamination.ts` | 3 | Pass-through new biometry fields |
| `api/src/functions/UpdateExamination.ts` | 3 | Pass-through new biometry fields |
| `api/src/` (Biometry type, if present) | 3 | Mirror frontend interface extension |
| `frontend/src/services/viewModelBuilders.ts` | 4 | Add per-measurement GA fields; add OFD/TAD/APAD percentile fields; add FT ntGa/nbGa |
| `frontend/src/components/reports/pdfSections.ts` | 4 | EFW row reorder; col-4 per-row GA; col header rename; FT col-3 header + NT/NB GA |
| `frontend/src/components/reports/pdfDocument.ts` | 4, 5 | Update `renderBiometryBlock` call-sites (Sub-Task 4); unify `"GA (Bio)"` labels (Sub-Task 5) |
| `frontend/src/pages/ExaminationDetailPage.tsx` | 5 | Pregnancy Data tile row 2: `"GA from CRL"` → `"GA from Bio"` for FT exams |
| `frontend/src/components/sections/FirstTrimesterSection.tsx` | 5 | Field label, button text, and tooltip: `"GA from CRL"` → `"GA from Bio"` |

---

## Execution Order

```
Sub-Task 1  →  Sub-Task 2  →  Sub-Task 3  →  Sub-Task 4
(reorder)      (button)       (scaffolding)   (PDF sections)

Sub-Task 5  — independent, can run at any point
("GA from Bio" label unification — all surfaces)
```

Sub-Tasks 1 and 2 touch `BiometrySection.tsx` and must run sequentially. Sub-Task 3
extends the data model — Sub-Task 4 depends on those new fields being present. Sub-Task 4
is otherwise independent of Sub-Tasks 1 and 2 and can be worked in parallel with Sub-Task 3
once interface contracts are agreed. Sub-Task 5 touches only display labels across separate
files and has no dependencies — it can be merged as a standalone PR at any point.
