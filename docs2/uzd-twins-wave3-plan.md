# Plan: UZD Twins — Wave 3 Refinements

## Top-Level Overview

**Goal:** Apply five targeted refinements to the `ultrasound_prenatal_twins` examination type: three label
shortening changes on the form, one column-count change in the Ultrasound Findings section (form: 3 cols
instead of 4; PDF: 2 cols instead of 3), a composite GA display in the PDF header/Pregnancy Data area, and a
correct tab order that interleaves T1/T2 by section and skips read-only fields.

**Scope:** Frontend only — no backend changes, no database changes, no new data fields.

**Files in scope:**
- [`frontend/src/components/sections/DopplerSection.tsx`](frontend/src/components/sections/DopplerSection.tsx)
- [`frontend/src/components/sections/UltrasoundFindingsSection.tsx`](frontend/src/components/sections/UltrasoundFindingsSection.tsx)
- [`frontend/src/components/sections/BiometrySection.tsx`](frontend/src/components/sections/BiometrySection.tsx)
- [`frontend/src/components/ExaminationForm.tsx`](frontend/src/components/ExaminationForm.tsx)
- [`frontend/src/components/reports/pdfDocument.ts`](frontend/src/components/reports/pdfDocument.ts)

**Out of scope:**
- Any backend changes
- Single-fetus `ultrasound_prenatal` form or PDF (must remain unchanged)
- Detail page changes

---

## Requirements (from docs2/uzd-twins-requirements.txt — Wave 3)

| # | Requirement |
|---|-------------|
| W3-R1 | Form label: "PI (Pulsatility Index)" → "PI" |
| W3-R2 | Form label: "RI (Resistance Index)" → "RI" |
| W3-R3 | Form label: "Fetal Heart Rate (bpm)" → "FHR (bpm)" |
| W3-R4 | Ultrasound Findings section (form, twins only): 3 columns per row (down from 4) |
| W3-R5 | Ultrasound Findings section (PDF, twins only): 2 columns per row per twin section (down from 3) |
| W3-R6 | Tab sequence: T1-Bio → T2-Bio → T1-Dop → T2-Dop → T1-Ultra → T2-Ultra → T1-Anatomy → T2-Anatomy; read-only fields excluded |
| W3-R7 | PDF: GA from Biometry in common sections → composite "GA Twin 1 / GA Twin 2" (e.g. `28w 5d / 28w 3d`) |

---

## Current State (from code research)

| Area | Current |
|---|---|
| PI label | `"PI (Pulsatility Index)"` in `DopplerSection.tsx` line 40 |
| RI label | `"RI (Resistance Index)"` in `DopplerSection.tsx` line 41 |
| FHR label | `"Fetal Heart Rate (bpm)"` in `UltrasoundFindingsSection.tsx` line 46 |
| UltrasoundFindings columns prop | `columns?: 4 \| 6` — twins form passes `columns={4}` |
| UltrasoundFindings PDF twin rendering | `kvGridAt(doc, mkUltraPairs(...), y, 3, ...)` — 3 cols per twin column (line 392 of `pdfDocument.ts`) |
| GA Bio in PDF header | Renders only T1: `vm.gestationalAgeFromBiometry \|\| '—'` (line 285) |
| GA Bio in PDF Pregnancy Data | Renders only T1 as separate row: `['GA from Biometry', vm.gestationalAgeFromBiometry]` (line 310) |
| Twin layout DOM structure | All T1 sections grouped in a left `<div>`, all T2 sections in a right `<div>` inside a `1fr 1fr` grid. Tab order is T1-Bio → T1-Dop → T1-Ultra → T1-Anatomy → T2-Bio → T2-Dop → … (column-first — **wrong per W3-R6**). |
| Read-only tab participation | No `tabIndex` anywhere — read-only fields (GA from LMP, percentiles) participate in Tab sequence and must be suppressed. |
| columns prop type | `columns?: 4 \| 6` (union type) |

---

## Design Decisions

| Topic | Decision |
|---|---|
| W3-R1 / W3-R2 scope | Label changes in `DopplerSection.tsx` affect all exam types. Single-fetus exams also get the shorter labels — acceptable (pure abbreviations). |
| W3-R3 scope | Label change in `UltrasoundFindingsSection.tsx` affects all exam types. Acceptable for the same reason. |
| W3-R4 — columns prop extension | The existing `columns?: 4 \| 6` union must be widened to `columns?: 2 \| 3 \| 4 \| 6`. The default stays `6`. The twins form passes `columns={3}` to `UltrasoundFindingsSection` (down from 4). No other section component needs a new value in this wave. |
| W3-R5 — PDF twin Ultrasound column count | The `renderTwinSection` call for `'Ultrasound'` currently passes `3` as the `cols` arg to `kvGridAt`. Change it to `2`. The twin Biometry, Doppler, and Anatomy calls keep their current `3` columns. |
| W3-R6 — root cause | The current DOM structure is `[T1 column div with Bio+Dop+Ultra+Anatomy] [T2 column div with Bio+Dop+Ultra+Anatomy]`. Tab follows DOM order: T1-Bio → T1-Dop → T1-Ultra → T1-Anatomy → T2-Bio → … The required order is section-interleaved: T1-Bio → T2-Bio → T1-Dop → T2-Dop → … This requires restructuring the JSX so each section pair sits in its own row. |
| W3-R6 — fix approach | Replace the current `[T1-div, T2-div]` structure with a flat grid where each section pair occupies a row: `[T1-Bio-div, T2-Bio-div]`, `[T1-Dop-div, T2-Dop-div]`, etc. Each pair-row uses `grid-template-columns: 1fr 1fr` independently. The Twin 1 / Twin 2 column headings remain at the top as a shared header row (also `1fr 1fr`). |
| W3-R6 — read-only fields | In `BiometrySection`: `gestationalAgeFromLMPReadonly` TextInput (always `readOnly`) + five percentile TextInputs (bpd, hc, ac, fl, efw — all `readOnly`). These must receive `tabIndex={-1}`. This also improves the single-fetus form tab flow — acceptable. |
| W3-R6 — responsive collapse | The current `twins-grid` CSS class handles the narrow-screen collapse. The restructured JSX must keep the `twins-grid` class on each section-pair row's outer div (or use a wrapper), so the existing media query still collapses all rows to single column on narrow screens. |
| W3-R7 — composite GA format | For twins exams only, replace the single-fetus `vm.gestationalAgeFromBiometry` display in the PDF with `${ga1} / ${ga2}` (e.g. `28w 5d / 28w 3d`). Absent values render as `—` in their slot. Single-fetus path unchanged. |
| W3-R7 — construction location | Constructed inline in `pdfDocument.ts` as a `gaBioDisplay` constant. `vm.gestationalAgeFromBiometry` and `vm.gestationalAgeFromBiometry2` are already in the ViewModel. |

---

## Sub-Tasks

---

### Sub-Task W3-1: Rename PI, RI, and FHR labels

**Intent:** Shorten three verbose field labels to their abbreviations as specified in W3-R1, W3-R2, W3-R3. Pure label changes — no logic, validation, or ID changes.

**Expected Outcomes:**
- `DopplerSection.tsx`: `"PI (Pulsatility Index)"` → `"PI"`, `"RI (Resistance Index)"` → `"RI"`.
- `UltrasoundFindingsSection.tsx`: `"Fetal Heart Rate (bpm)"` → `"FHR (bpm)"`.
- All exam types that use these components also see the shorter labels (acceptable — pure abbreviations).
- PDF output is unaffected (PDF uses its own `mkDopplerPairs` / `mkUltraPairs` label strings, not the React component labels).

**Todo:**
1. Edit [`frontend/src/components/sections/DopplerSection.tsx:40`](frontend/src/components/sections/DopplerSection.tsx:40):
   - Change `labelText="PI (Pulsatility Index)"` → `labelText="PI"`.
2. Edit [`frontend/src/components/sections/DopplerSection.tsx:41`](frontend/src/components/sections/DopplerSection.tsx:41):
   - Change `labelText="RI (Resistance Index)"` → `labelText="RI"`.
3. Edit [`frontend/src/components/sections/UltrasoundFindingsSection.tsx:46`](frontend/src/components/sections/UltrasoundFindingsSection.tsx:46):
   - Change `labelText="Fetal Heart Rate (bpm)"` → `labelText="FHR (bpm)"`.

**Relevant Context:**
- [`frontend/src/components/sections/DopplerSection.tsx:40`](frontend/src/components/sections/DopplerSection.tsx:40)
- [`frontend/src/components/sections/UltrasoundFindingsSection.tsx:46`](frontend/src/components/sections/UltrasoundFindingsSection.tsx:46)

**Status:** `[x] done`

---

### Sub-Task W3-2: Ultrasound Findings — 3 columns in form, 2 columns in PDF (twins only)

**Intent:** In the twins form, `UltrasoundFindingsSection` currently renders at 4 columns. Change to 3 (W3-R4). In the PDF, the twin Ultrasound section currently renders at 3 `kvGridAt` columns; change to 2 (W3-R5). Both changes are twins-only.

**Expected Outcomes:**
- `UltrasoundFindingsSection.tsx` `columns` prop type widened from `4 | 6` to `2 | 3 | 4 | 6`.
- In `ExaminationForm.tsx`, both `<UltrasoundFindingsSection ... columns={4} />` calls (T1 and T2 in the twins branch) changed to `columns={3}`.
- In `pdfDocument.ts`, the `renderTwinSection('Ultrasound', ...)` call passes `cols = 2` (via an added optional `cols` parameter on `renderTwinSection`).
- Single-fetus form (no `columns` prop — defaults to `6`) unchanged.
- Single-fetus PDF `kvGrid(doc, mkUltraPairs(vm.ultrasound), y, 3)` call unchanged.

**Todo:**
1. Edit [`frontend/src/components/sections/UltrasoundFindingsSection.tsx`](frontend/src/components/sections/UltrasoundFindingsSection.tsx):
   - Widen `columns` prop type: `columns?: 4 | 6` → `columns?: 2 | 3 | 4 | 6`.
2. Edit [`frontend/src/components/ExaminationForm.tsx`](frontend/src/components/ExaminationForm.tsx):
   - In the twins rendering branch, find the two `<UltrasoundFindingsSection ... columns={4} />` usages (T1 at ~line 1042, T2 at ~line 1124) and change `columns={4}` → `columns={3}`.
3. Edit [`frontend/src/components/reports/pdfDocument.ts`](frontend/src/components/reports/pdfDocument.ts):
   - Add an optional `cols?: number` parameter (default `3`) to the `renderTwinSection` closure.
   - Pass `cols = 2` for the `'Ultrasound'` call. Biometry, Doppler, Anatomy calls unchanged (use default `3`).

**Relevant Context:**
- [`frontend/src/components/sections/UltrasoundFindingsSection.tsx:23`](frontend/src/components/sections/UltrasoundFindingsSection.tsx:23) — `columns` prop type
- [`frontend/src/components/ExaminationForm.tsx:1042`](frontend/src/components/ExaminationForm.tsx:1042) — T1 UltrasoundFindingsSection (twins branch)
- [`frontend/src/components/ExaminationForm.tsx:1124`](frontend/src/components/ExaminationForm.tsx:1124) — T2 UltrasoundFindingsSection (twins branch)
- [`frontend/src/components/reports/pdfDocument.ts:383`](frontend/src/components/reports/pdfDocument.ts:383) — `renderTwinSection` closure

**Status:** `[x] done`

---

### Sub-Task W3-3: Tab order — interleave by section and suppress read-only fields

**Intent:** Satisfy W3-R6. Currently the DOM structure groups all T1 sections in one `<div>` and all T2 sections in another, so Tab traverses T1-all then T2-all (column-first). The required order is section-interleaved: T1-Bio → T2-Bio → T1-Dop → T2-Dop → T1-Ultra → T2-Ultra → T1-Anatomy → T2-Anatomy. This requires restructuring the JSX. Additionally, read-only fields must be excluded from the Tab sequence.

**Expected Outcomes:**
- The twin rendering branch in `ExaminationForm.tsx` (lines ~991–1159) is restructured from `[T1-column-div, T2-column-div]` to a series of section-pair rows, each with its own `1fr 1fr` grid:
  - **Header row**: `[Twin 1 heading, Twin 2 heading]` — `1fr 1fr` grid, `twins-grid` class.
  - **Biometry row**: `[T1-BiometrySection-div, T2-BiometrySection-div]` — `1fr 1fr` grid, `twins-grid` class.
  - **Doppler row**: `[T1-DopplerSection-div, T2-DopplerSection-div]` — `1fr 1fr` grid, `twins-grid` class.
  - **Ultrasound row**: `[T1-UltrasoundFindingsSection-div, T2-UltrasoundFindingsSection-div]` — `1fr 1fr` grid, `twins-grid` class.
  - **Anatomy row**: `[T1-AnatomySection-div, T2-AnatomySection-div]` — `1fr 1fr` grid, `twins-grid` class.
- All `section-component props` (prefix, data, errors, onChange, isSubmitting, columns) are preserved exactly — only the wrapping structure changes.
- The `twins-grid` CSS class is applied to each row's outer div so the existing narrow-screen media query collapses all rows to a single column.
- Tab sequence after restructure: T1-Bio fields → T2-Bio fields → T1-Dop fields → T2-Dop fields → T1-Ultra fields → T2-Ultra fields → T1-Anatomy fields → T2-Anatomy fields.
- In `BiometrySection.tsx`: `tabIndex={-1}` added to the GA-from-LMP `TextInput` and to all five percentile `TextInput`s so they are skipped by Tab in both twins and single-fetus forms.

**Todo:**
1. Edit [`frontend/src/components/ExaminationForm.tsx`](frontend/src/components/ExaminationForm.tsx), twins branch (~lines 991–1159):
   - Remove the outer single `<div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', ... }} className="twins-grid">` wrapping both T1 and T2 column divs.
   - Remove the T1 column `<div>` wrapper (lines ~996–1075) and T2 column `<div>` wrapper (lines ~1078–1157) entirely.
   - Replace the whole block with the following structure (one outer `<div>` for spacing, five inner pair rows):
     ```jsx
     <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
       {/* Header row */}
       <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }} className="twins-grid">
         <h4 style={{ ... }}>Twin 1</h4>
         <h4 style={{ ... }}>Twin 2</h4>
       </div>

       {/* Biometry row */}
       {visibility.biometry && (
         <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }} className="twins-grid">
           <div>
             <h5>Biometry</h5>
             <BiometrySection prefix="t1" columns={4} data={...} ... />
           </div>
           <div>
             <h5>Biometry</h5>
             <BiometrySection prefix="t2" columns={4} data={...} ... />
           </div>
         </div>
       )}

       {/* Doppler row */}
       {visibility.doppler && (
         <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }} className="twins-grid">
           <div>
             <h5>Doppler</h5>
             <DopplerSection prefix="t1" columns={4} data={...} ... />
           </div>
           <div>
             <h5>Doppler</h5>
             <DopplerSection prefix="t2" columns={4} data={...} ... />
           </div>
         </div>
       )}

       {/* Ultrasound Findings row */}
       {visibility.ultrasoundFindings && (
         <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }} className="twins-grid">
           <div>
             <h5>Ultrasound Findings</h5>
             <UltrasoundFindingsSection prefix="t1" columns={3} data={...} ... />
           </div>
           <div>
             <h5>Ultrasound Findings</h5>
             <UltrasoundFindingsSection prefix="t2" columns={3} data={...} ... />
           </div>
         </div>
       )}

       {/* Anatomy row */}
       {visibility.anatomy && (
         <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }} className="twins-grid">
           <div>
             <h5>Anatomy</h5>
             <AnatomySection prefix="t1" columns={4} data={...} ... />
           </div>
           <div>
             <h5>Anatomy</h5>
             <AnatomySection prefix="t2" columns={4} data={...} ... />
           </div>
         </div>
       )}
     </div>
     ```
   - All existing `data={...}`, `errors`, `onChange`, `isSubmitting` prop values are carried over verbatim from the current T1 and T2 usages. Only the structural wrapping changes.
   - **Note:** This sub-task also applies the `columns={3}` change for `UltrasoundFindingsSection` (satisfying W3-R4 at the same time as the restructure — do not pass `columns={4}` to `UltrasoundFindingsSection` in this new structure).
2. Edit [`frontend/src/components/sections/BiometrySection.tsx`](frontend/src/components/sections/BiometrySection.tsx):
   - Add `tabIndex={-1}` to the `TextInput` with `id={p('gestationalAgeFromLMPReadonly')}` (~line 110).
   - Add `tabIndex={-1}` to the BPD percentile `TextInput` (~line 81).
   - Add `tabIndex={-1}` to the HC percentile `TextInput` (~line 85).
   - Add `tabIndex={-1}` to the AC percentile `TextInput` (~line 89).
   - Add `tabIndex={-1}` to the FL percentile `TextInput` (~line 93).
   - Add `tabIndex={-1}` to the EFW percentile `TextInput` (~line 122).

**Relevant Context:**
- [`frontend/src/components/ExaminationForm.tsx:991`](frontend/src/components/ExaminationForm.tsx:991) — twins rendering branch start
- [`frontend/src/components/ExaminationForm.tsx:996`](frontend/src/components/ExaminationForm.tsx:996) — T1 column `<div>` (to be broken into per-section rows)
- [`frontend/src/components/ExaminationForm.tsx:1078`](frontend/src/components/ExaminationForm.tsx:1078) — T2 column `<div>` (to be broken into per-section rows)
- [`frontend/src/components/sections/BiometrySection.tsx`](frontend/src/components/sections/BiometrySection.tsx) — read-only inputs at ~lines 81, 85, 89, 93, 110, 122

**Status:** `[x] done`

---

### Sub-Task W3-4: PDF — composite GA from Biometry for twins

**Intent:** In the PDF for `ultrasound_prenatal_twins` exams, the header inline GA-from-Biometry display and the Pregnancy Data section row must show both twins' values as a composite string (e.g. `28w 5d / 28w 3d`) instead of only T1's value. Single-fetus PDF is completely unchanged.

**Expected Outcomes:**
- In `pdfDocument.ts`, for `isTwins === true`:
  - The inline header line (~line 285, currently `vm.gestationalAgeFromBiometry || '—'`) shows `${t1} / ${t2}`.
  - The Pregnancy Data `kvGrid` entry (~line 310, currently `['GA from Biometry', vm.gestationalAgeFromBiometry]`) shows the composite value.
- For `isTwins === false`: both rendering sites are completely unchanged.
- A single `gaBioDisplay` local variable is computed once and reused at both sites.

**Todo:**
1. Edit [`frontend/src/components/reports/pdfDocument.ts`](frontend/src/components/reports/pdfDocument.ts):
   - Immediately after the `isTwins` declaration (~line 222), add:
     ```typescript
     const gaBioDisplay = isTwins
       ? `${vm.gestationalAgeFromBiometry || '—'} / ${vm.gestationalAgeFromBiometry2 || '—'}`
       : vm.gestationalAgeFromBiometry;
     ```
   - At line ~285 (inline header), replace `vm.gestationalAgeFromBiometry || '—'` with `gaBioDisplay || '—'`.
   - At line ~310 (Pregnancy Data kvGrid), replace `vm.gestationalAgeFromBiometry` with `gaBioDisplay`.

**Relevant Context:**
- [`frontend/src/components/reports/pdfDocument.ts:222`](frontend/src/components/reports/pdfDocument.ts:222) — `isTwins` declaration
- [`frontend/src/components/reports/pdfDocument.ts:285`](frontend/src/components/reports/pdfDocument.ts:285) — inline GA Bio header line
- [`frontend/src/components/reports/pdfDocument.ts:310`](frontend/src/components/reports/pdfDocument.ts:310) — Pregnancy Data kvGrid entry

**Status:** `[x] done`

---

## Dependency Graph

```
W3-1  (label renames)                — independent
W3-2  (UltrasoundFindings columns)   — absorbed into W3-3 for UltrasoundFindingsSection; pdfDocument change is independent
W3-3  (tab order + layout restructure) — absorbs the form-side of W3-2 (columns={3} applied during restructure)
W3-4  (composite GA in PDF)          — independent
```

**Note:** The `ExaminationForm.tsx` edit for W3-2 (changing `columns={4}` → `columns={3}` for UltrasoundFindingsSection) and the W3-3 JSX restructure both touch the same lines in the twins branch. Implement them together in a single pass on `ExaminationForm.tsx` to avoid conflicts. The `UltrasoundFindingsSection.tsx` prop type widening and `pdfDocument.ts` changes are independent of the form restructure.

---

## Risk Register

| Risk | Sub-Task | Mitigation |
|------|----------|-----------|
| Label renames affect single-fetus form | W3-1 | Acceptable per design decision — pure abbreviations, no data impact. Verify single-fetus form visually after implementation. |
| `columns` prop type widening breaks TypeScript | W3-2 | Widen union to `2 \| 3 \| 4 \| 6`. No other callers pass `2` or `3` today so no ripple. |
| Section-pair row restructure duplicates section headings | W3-3 | Each row now shows "Biometry / Biometry" side by side as sub-headings. This is correct visual behaviour — T1 and T2 column context is set by the shared header row. Verify visually after implementation. |
| Narrow-screen collapse | W3-3 | The `twins-grid` CSS class must be applied to each section-pair row's outer div. Confirm the existing media query targets `.twins-grid` and applies `grid-template-columns: 1fr` — if it targets a parent-only selector it may need updating. Check `ExaminationForm.css` or the global stylesheet for `.twins-grid` definition. |
| `tabIndex={-1}` on read-only fields | W3-3 | `tabIndex={-1}` removes keyboard Tab focus but the field value remains in the DOM and is announced by screen readers when the parent group is navigated. Acceptable per the explicit requirement. |
| Composite GA string overlaps EDD in PDF header | W3-4 | Composite string is ~15 chars vs ~7 chars currently. EDD is right-aligned at `MARGIN_R`. Check for collision in a test render. If overlap occurs, abbreviate `'  GA (Bio): '` to `'  GAB: '` or reduce inline header font to 7.5 pt. |
