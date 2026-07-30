# Plan: UZD Twins — Wave 2 UI Refinements

## Top-Level Overview

**Goal:** Apply a series of targeted UI layout and label refinements to the Ultrasound Prenatal Exam for Twins examination form. All changes affect visual presentation only — no new data fields, no backend changes, no changes to single-fetus exams.

**Scope:**
- Examination header row: wider exam-type dropdown, narrower date field, Status and Age columns unchanged — applied to all exam types
- BiometrySection: remove "Singleton ref." helper text; 4-column layout for all biometry rows
- DopplerSection: 4-column layout
- UltrasoundFindingsSection: 4-column layout
- AnatomySection: 4-column layout
- Label renames: "Nuchal Fold" → "NF", "LA — Left Atrium" → "LA", "LC — Left Cardiac" → "LC"

**Files in scope:**
- [`frontend/src/components/ExaminationForm.tsx`](frontend/src/components/ExaminationForm.tsx)
- [`frontend/src/components/sections/BiometrySection.tsx`](frontend/src/components/sections/BiometrySection.tsx)
- [`frontend/src/components/sections/DopplerSection.tsx`](frontend/src/components/sections/DopplerSection.tsx)
- [`frontend/src/components/sections/UltrasoundFindingsSection.tsx`](frontend/src/components/sections/UltrasoundFindingsSection.tsx)
- [`frontend/src/components/sections/AnatomySection.tsx`](frontend/src/components/sections/AnatomySection.tsx)

**Out of scope:**
- Any backend changes
- Single-fetus `ultrasound_prenatal` form layout (must remain unchanged unless a section component is shared)
- PDF layout changes
- Detail page changes

---

## Requirements (from docs2/uzd-twins-requirements.txt — Wave 2)

| # | Requirement |
|---|-------------|
| W2-R1 | Examination Type dropdown: 5 columns wide; Examination Date: 3 columns wide |
| W2-R2 | No "Singleton ref." mark in Biometry section |
| W2-R3 | BPD, HC, AC, FL + percentiles → 4 columns per row (each twin section) |
| W2-R4 | TCD, CM, OFD, Vp, Nuchal Fold, NB, APAD, TAD, LA, LC → 4 columns per row (each twin section) |
| W2-R5 | Label: "Nuchal Fold" → "NF" |
| W2-R6 | Label: "LA — Left Atrium" → "LA" |
| W2-R7 | Label: "LC — Left Cardiac" → "LC" |
| W2-R8 | Doppler sections → 4 columns per row |
| W2-R9 | Ultrasound Findings sections → 4 columns per row |
| W2-R10 | Anatomy sections → 4 columns per row |

---

## Current State (from code research)

| Area | Current |
|---|---|
| Header row layout | `row4`: `2fr 1fr 1fr 1fr` — Type (2fr), Date (1fr), Status (1fr), Age (1fr) |
| Section grid | `row6`: `repeat(6, 1fr)` — used by all four section components |
| Singleton ref. text | `helperText="Singleton ref."` on all 5 percentile fields in `BiometrySection.tsx` (lines 81, 85, 89, 93, 122) |
| Nuchal Fold label | `'Nuchal Fold (mm)'` in `BiometrySection.tsx` |
| LA label | `'LA — Left Atrium (mm)'` in `BiometrySection.tsx` |
| LC label | `'LC — Left Cardiac (mm)'` in `BiometrySection.tsx` |
| Doppler | 2 rows, each `row6` (`repeat(6, 1fr)`) |
| Ultrasound Findings | 1 row, `row6` (`repeat(6, 1fr)`) |
| Anatomy | 1 row, `row6` wrapping 11 fields |

---

## Design Decisions

| Topic | Decision |
|---|---|
| Scope of column change | The `row6` → 4-column changes apply to the **twins form only**. The header row ratio change applies to **all exam types** — it is a shared form section. |
| Shared section component approach | Section components (`BiometrySection`, `DopplerSection`, etc.) currently hard-code `row6`. An optional `columns` prop (defaulting to `6`) will be added to each. When the twins form renders them, it passes `columns={4}`. The single-fetus path passes nothing (defaults to `6`). |
| "Singleton ref." removal scope | The `helperText="Singleton ref."` is only in `BiometrySection.tsx`. It must be removed entirely — R2 says "no Singleton ref. mark". This affects both twins and single-fetus rendering of `BiometrySection`, which is acceptable. |
| Label renames scope | Label changes in `BiometrySection.tsx` affect all exam types that use it, which is acceptable — they are pure abbreviations of the same concept. |
| Header row column change | W2-R1 specifies "5 columns for Type, 3 columns for Date" as relative widths within the row. The header row is shared across all exam types and the change applies globally. Naïvely applying `5fr 3fr 1fr 1fr` (10fr total) would halve Status and Age from 20% to 10% of the row — unacceptable. The correct formula keeps Status and Age at 2fr each: `5fr 3fr 2fr 2fr` (12fr total). Type = 41.7%, Date = 25%, Status = 16.7%, Age = 16.7% — materially unchanged from current 20%. The existing `row4` constant **is updated in-place** — no conditional, no new constant needed. |

---

## Header Row Column Change — Detailed Analysis (W2-R1)

### Why a naïve `fr` ratio change is wrong

The current `row4` layout divides the full container into 5 equal parts (`2+1+1+1 = 5fr`):

```
Type (40%) │ Date (20%) │ Status (20%) │ Age (20%)
```

Applying `5fr 3fr 1fr 1fr` (10fr total) makes each `1fr` unit half as wide:

```
Type (50%) │ Date (30%) │ Status (10%) │ Age (10%)   ← Status/Age HALVED ✗
```

### Correct formula

Status and Age currently occupy 1fr out of 5fr total = 20% each. To preserve that proportional size while satisfying the 5:3 Type:Date ratio, scale Status and Age to 2fr each:

```
5fr + 3fr + 2fr + 2fr = 12fr total

Type (41.7%) │ Date (25%) │ Status (16.7%) │ Age (16.7%)
```

- Examination Type: wider ✓
- Examination Date: narrower relative to Type ✓
- Status and Age: lose only ~3 percentage points — not materially shorter ✓

### Implementation

- **Modify `row4` in-place** — the header row is shared across all exam types, so updating the constant propagates to all forms automatically. No conditional, no new constant needed.
- Change `gridTemplateColumns` from `'2fr 1fr 1fr 1fr'` to `'5fr 3fr 2fr 2fr'`.

---

## Sub-Tasks

---

### Sub-Task W2-1: Update header row column proportions (all exam types)

**Intent:** Make the Examination Type dropdown visually wider and the Date picker narrower across all exam types, while keeping Status and Patient Age at their current proportional size. Satisfies W2-R1. Because the header row is shared, a single edit to the `row4` constant propagates to all forms — no conditional logic needed.

**Expected Outcomes:**
- The `row4` style constant in `ExaminationForm.tsx` is updated from `'2fr 1fr 1fr 1fr'` to `'5fr 3fr 2fr 2fr'`.
- All exam types (twins and single-fetus) show the wider Examination Type dropdown and narrower Date field.
- Status and Age columns are not materially shorter (16.7% vs current 20%).

**Todo:**
1. Edit [`frontend/src/components/ExaminationForm.tsx`](frontend/src/components/ExaminationForm.tsx) line 715:
   - Change `gridTemplateColumns: '2fr 1fr 1fr 1fr'` → `gridTemplateColumns: '5fr 3fr 2fr 2fr'` in the `row4` constant.

**Relevant Context:**
- [`frontend/src/components/ExaminationForm.tsx:715`](frontend/src/components/ExaminationForm.tsx:715) — `row4` definition

**Status:** `[DONE]`

---

### Sub-Task W2-2: Add `columns` prop to section components

**Intent:** Allow the section components to render in 4-column mode when used in the twins form, while defaulting to 6-column mode for the single-fetus form. This is the minimal change that satisfies W2-R3, W2-R4, W2-R8, W2-R9, W2-R10 without breaking the existing single-fetus layout.

**Expected Outcomes:**
- Each of the four section components accepts an optional `columns?: 4 | 6` prop (default `6`).
- The internal grid style switches between `repeat(4, 1fr)` and `repeat(6, 1fr)` based on the prop.
- Where the grid is defined as the `row6` constant (imported from or duplicated from `ExaminationForm.tsx`), it is replaced with a computed style.
- Components that have multiple rows (Doppler has 2, Biometry has 2 data rows + calc rows) apply the prop to all their data rows.
- The `columns` prop is threaded through: `ExaminationForm.tsx` passes `columns={4}` to all four section components when `isTwins === true`, and passes nothing (or `columns={6}`) when `!isTwins`.

**Note on BPD/HC/AC/FL layout at 4 columns:** Each of BPD, HC, AC, FL is currently a nested flex column (measurement + percentile stacked). At 6 columns, 4 pairs fit in 4 of 6 columns. At 4 columns, 4 pairs fill all 4 columns — this is exactly W2-R3's intent. The nested structure does not need to change.

**Note on TCD…LC row at 4 columns:** 10 fields in a 4-column grid → 2.5 rows (i.e. 3 rows: 4+4+2). This is the correct and expected layout for W2-R4.

**Note on Doppler at 4 columns:** Row A has 6 fields, Row B has 5 fields + spacer. At 4 columns: Row A becomes 2 rows (4+2), Row B becomes 2 rows (4+1+spacer). The spacer `<div />` in Row B can remain or be removed — keep it for simplicity.

**Note on Anatomy at 4 columns:** 11 fields in 4 columns → 3 rows (4+4+3). This is correct for W2-R10.

**Todo:**
1. Edit [`frontend/src/components/sections/BiometrySection.tsx`](frontend/src/components/sections/BiometrySection.tsx):
   - Add `columns?: 4 | 6` to the props interface (default `6`).
   - Replace the two hard-coded `row6` inline styles (BPD/HC/AC/FL row and TCD…LC row) with `{ display: 'grid', gridTemplateColumns: \`repeat(${columns}, 1fr)\`, gap: '0.75rem' }`.
2. Edit [`frontend/src/components/sections/DopplerSection.tsx`](frontend/src/components/sections/DopplerSection.tsx):
   - Add `columns?: 4 | 6` to props interface (default `6`).
   - Replace both `row6` inline styles with the computed grid style.
3. Edit [`frontend/src/components/sections/UltrasoundFindingsSection.tsx`](frontend/src/components/sections/UltrasoundFindingsSection.tsx):
   - Add `columns?: 4 | 6` to props interface (default `6`).
   - Replace the `row6` inline style with the computed grid style.
4. Edit [`frontend/src/components/sections/AnatomySection.tsx`](frontend/src/components/sections/AnatomySection.tsx):
   - Add `columns?: 4 | 6` to props interface (default `6`).
   - Replace the `row6` inline style with the computed grid style.
5. Edit [`frontend/src/components/ExaminationForm.tsx`](frontend/src/components/ExaminationForm.tsx):
   - In the twin rendering branch (where `<BiometrySection prefix="t1" .../>` and `<BiometrySection prefix="t2" .../>` are rendered), add `columns={4}` to all four section component usages for both T1 and T2.
   - In the single-fetus rendering branch (where `<BiometrySection prefix="t1" .../>` etc. are rendered without `isTwins`), do not pass `columns` (defaults to 6, preserving current layout).

**Relevant Context:**
- [`frontend/src/components/sections/BiometrySection.tsx`](frontend/src/components/sections/BiometrySection.tsx)
- [`frontend/src/components/sections/DopplerSection.tsx`](frontend/src/components/sections/DopplerSection.tsx)
- [`frontend/src/components/sections/UltrasoundFindingsSection.tsx`](frontend/src/components/sections/UltrasoundFindingsSection.tsx)
- [`frontend/src/components/sections/AnatomySection.tsx`](frontend/src/components/sections/AnatomySection.tsx)
- [`frontend/src/components/ExaminationForm.tsx`](frontend/src/components/ExaminationForm.tsx) — twins rendering branch

**Status:** `[DONE]`

---

### Sub-Task W2-3: Remove "Singleton ref." helper text from BiometrySection

**Intent:** Remove the `helperText="Singleton ref."` annotation from all percentile fields in `BiometrySection.tsx` to satisfy W2-R2. The percentile values are still calculated and displayed; only the label text is removed.

**Expected Outcomes:**
- All 5 occurrences of `helperText="Singleton ref."` in `BiometrySection.tsx` are removed (BPD, HC, AC, FL percentiles at lines ~81, 85, 89, 93, and EFW percentile at line ~122).
- Percentile fields continue to display calculated values.
- No other changes to the component.

**Todo:**
1. Edit [`frontend/src/components/sections/BiometrySection.tsx`](frontend/src/components/sections/BiometrySection.tsx):
   - Remove `helperText="Singleton ref."` from the BPD percentile `TextInput`.
   - Remove `helperText="Singleton ref."` from the HC percentile `TextInput`.
   - Remove `helperText="Singleton ref."` from the AC percentile `TextInput`.
   - Remove `helperText="Singleton ref."` from the FL percentile `TextInput`.
   - Remove `helperText="Singleton ref."` from the EFW percentile `TextInput`.

**Relevant Context:**
- [`frontend/src/components/sections/BiometrySection.tsx:81`](frontend/src/components/sections/BiometrySection.tsx:81) — BPD percentile
- [`frontend/src/components/sections/BiometrySection.tsx:85`](frontend/src/components/sections/BiometrySection.tsx:85) — HC percentile
- [`frontend/src/components/sections/BiometrySection.tsx:89`](frontend/src/components/sections/BiometrySection.tsx:89) — AC percentile
- [`frontend/src/components/sections/BiometrySection.tsx:93`](frontend/src/components/sections/BiometrySection.tsx:93) — FL percentile
- [`frontend/src/components/sections/BiometrySection.tsx:122`](frontend/src/components/sections/BiometrySection.tsx:122) — EFW percentile

**Status:** `[DONE]`

---

### Sub-Task W2-4: Rename Nuchal Fold, LA, and LC labels

**Intent:** Shorten three verbose field labels in `BiometrySection.tsx` to their abbreviations, satisfying W2-R5, W2-R6, W2-R7.

**Expected Outcomes:**
- `'Nuchal Fold (mm)'` → `'NF (mm)'`
- `'LA — Left Atrium (mm)'` → `'LA (mm)'`
- `'LC — Left Cardiac (mm)'` → `'LC (mm)'`
- All three changes are in `BiometrySection.tsx` only (the single-fetus inline path in `ExaminationForm.tsx` uses the same section component, so it also gets the shorter labels — this is acceptable and correct per the requirements).

**Todo:**
1. Edit [`frontend/src/components/sections/BiometrySection.tsx`](frontend/src/components/sections/BiometrySection.tsx):
   - In the `labels` record, change `nuchalFold: 'Nuchal Fold (mm)'` → `nuchalFold: 'NF (mm)'`.
   - Change the LA `TextInput` label from `'LA — Left Atrium (mm)'` → `'LA (mm)'`.
   - Change the LC `TextInput` label from `'LC — Left Cardiac (mm)'` → `'LC (mm)'`.

**Relevant Context:**
- [`frontend/src/components/sections/BiometrySection.tsx:129`](frontend/src/components/sections/BiometrySection.tsx:129) — `labels` record (nuchalFold key)
- [`frontend/src/components/sections/BiometrySection.tsx:139`](frontend/src/components/sections/BiometrySection.tsx:139) — LA TextInput label
- [`frontend/src/components/sections/BiometrySection.tsx:142`](frontend/src/components/sections/BiometrySection.tsx:142) — LC TextInput label

**Status:** `[DONE]`

---

## Dependency Graph

```
W2-1  (header row)          — independent, no dependencies
W2-2  (columns prop)        — independent, no dependencies
W2-3  (remove singleton)    — independent, no dependencies
W2-4  (label renames)       — independent, no dependencies
```

All four sub-tasks are independent and can be implemented in any order, or together in a single pass.

---

## Risk Register

| Risk | Sub-Task | Mitigation |
|------|----------|-----------|
| `row6` is defined as a local const in each section file vs imported | W2-2 | The subagent confirmed each section uses an inline `row6` style — replace in-place with the computed version. No import needed. |
| Single-fetus form acquires 4-column layout unintentionally | W2-2 | The `columns` prop defaults to `6`; single-fetus path does not pass `columns={4}`, so no change. Verify single-fetus rendering in browser after implementation. |
| Label rename affects printed PDF | W2-4 | The PDF ViewModel in `print.service.ts` uses field keys (not display labels) to build the PDF — label changes in section components do not affect PDF output. |
| Removing singleton disclaimer affects clinical workflow | W2-3 | This is a deliberate product decision in W2-R2. The values are still shown; only the label is removed. |
