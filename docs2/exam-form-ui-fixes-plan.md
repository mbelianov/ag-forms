# Examination Form UI Fixes Plan

## Overview

Three targeted UI fixes to [`frontend/src/components/ExaminationForm.tsx`](../frontend/src/components/ExaminationForm.tsx) to improve visual consistency in the Examination input form. This plan does not introduces any new functionlaity and does not modify existing functionlaity. Just visual improvements.

---

## Sub-Task 1 — Fix Button Width Consistency (AutoCalc GA vs AutoCalc EFW)

**Status:** [x] done

**Intent:**
Both "AutoCalc GA" and "AutoCalc EFW" buttons sit in a `gridTemplateColumns: 'auto 1fr 1fr'` grid. Because the column is `auto`, each button sizes to its own text content. "AutoCalc EFW" has more characters than "AutoCalc GA" so it renders wider. The fix is to replace `auto` with a fixed explicit width on both rows simultaneously.

**Chosen approach — use `9rem`:** Because the two grids are independent (not in the same grid context), CSS `max-content` still produces different widths per row. A fixed explicit width is the only reliable cross-row solution. `9rem` is wide enough to fit "AutoCalc EFW" at Carbon's default `md` button size (the text fits comfortably within ~8.5rem at a 14px base font; `9rem` adds a small buffer without excess whitespace).

**Root Cause Location:**
- Line 800: GA row — `gridTemplateColumns: 'auto 1fr 1fr'`
- Line 837: EFW row — `gridTemplateColumns: 'auto 1fr 1fr'`

**Expected Outcomes:**
- Both buttons render at exactly the same pixel width.
- The grid columns that contain them are identical.
- Adjacent `1fr` input columns are unaffected.

**Todo List:**
1. On line 800, change `gridTemplateColumns: 'auto 1fr 1fr'` → `gridTemplateColumns: '9rem 1fr 1fr'`.
2. On line 837, change `gridTemplateColumns: 'auto 1fr 1fr'` → `gridTemplateColumns: '9rem 1fr 1fr'`.
3. Verify no other visual elements in these two rows are shifted.

**Relevant Context:**
- `calcButtonWrap` style (line 505–509) controls the inner `div` wrapper — no change needed there.
- Carbon `Button` `size="md"` has a natural min-width; `9rem` must be ≥ the natural width of "AutoCalc EFW".

---

## Sub-Task 2 — Fix PI Field Column Span + Consolidate Doppler Rows

**Status:** [x] done

**Intent:**
Doppler Row A (line 911) uses `row4` (`2fr 1fr 1fr 1fr`), giving PI a double-width column. The fix changes Row A to `row6`, which frees two slots. Those two slots are filled by pulling the first two fields of old Row B (`utADexPI`, `utADexRI`) into Row A. The remaining four fields of old Row B (`utASinPI`, `utASinRI`, `cma`, `psv`) plus CPR from old Row C are then combined into a single new Row B. Result: three rows collapse into two, each fully within the `row6` grid.

**Current layout (3 rows):**

| Row | Col 1 | Col 2 | Col 3 | Col 4 | Col 5 | Col 6 |
|-----|-------|-------|-------|-------|-------|-------|
| A | PI _(2fr)_ | RI | Vessel | DucVen | — | — |
| B | utADexPI | utADexRI | utASinPI | utASinRI | cma | psv |
| C | cpr | _(empty×5)_ | | | | |

**New layout (2 rows):**

| Row | Col 1 | Col 2 | Col 3 | Col 4 | Col 5 | Col 6 |
|-----|-------|-------|-------|-------|-------|-------|
| A | PI | RI | Vessel | DucVen | utADexPI | utADexRI |
| B | utASinPI | utASinRI | cma | psv | cpr | _(empty)_ |

**Root Cause Location:**
- Lines 910–945: the three `<div>` rows inside `<FormGroup legendText="Doppler...">`.

**Expected Outcomes:**
- PI field is exactly 1/6 of the row width, identical to all other Doppler fields.
- Doppler section collapses from three grid rows to two.
- All 9 Doppler fields are present and in a logical order.

**Todo List:**
1. Replace the three existing `<div>` rows (lines 910–945) with two new `<div style={row6}>` blocks.
2. New Row A contains 6 inline `TextInput` elements: PI, RI, Vessel, DucVen, utADexPI, utADexRI (copy props from existing elements, preserving `autoComplete="off"` and `disabled={isSubmitting}`).
3. New Row B contains 5 `TextInput` elements: utASinPI, utASinRI, cma, psv, cpr — plus one trailing `<div />` to fill the 6th slot.
4. Remove the old Row B `.map()` block and old Row C entirely.
5. Update the JSX comment above the rows to reflect the new 2-row structure.

**Relevant Context:**
- `row4` at line 564 (Exam header: Examination Type | Exam Date | Status | Patient Age) must **not** be changed.
- `row6` is defined at line 501: `{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.75rem' }`.
- All field props (`id`, `labelText`, `placeholder`, `value`, `onChange`, `invalid`, `invalidText`, `disabled`, `autoComplete`) must be preserved exactly on every moved field.

---

## Sub-Task 3 — Fix Section Title Font Size (Doppler and Biometry vs Anatomy)

**Status:** [x] done

**Intent:**
"Anatomy" uses `<h4 style={{ marginBottom: '0.5rem', fontWeight: 600 }}>` directly (line 754). "Biometry" and "Doppler" use Carbon `<FormGroup legendText="...">` which renders a `<legend>` element styled with Carbon's smaller default legend typography. Since accessibility is not a concern, the fix is to set `legendText=""` on each `<FormGroup>` (suppressing the legend) and add an identical `<h4>` above each one.

**Root Cause Location:**
- Line 754: Anatomy — `<h4 style={{ marginBottom: '0.5rem', fontWeight: 600 }}>Anatomy</h4>`
- Line 776: Biometry — `<FormGroup legendText="Biometry (integers only, in mm/grams)">`
- Line 908: Doppler — `<FormGroup legendText="Doppler (floats allowed)">` *(line shifts slightly after Sub-Task 2)*

**Expected Outcomes:**
- "Biometry" and "Doppler" section titles render at the same font size and weight as "Anatomy".
- The `<FormGroup>` wrapper is retained for its `<fieldset>` grouping; only the visible title source changes.

**Todo List:**
1. On line 776, add `<h4 style={{ marginBottom: '0.5rem', fontWeight: 600 }}>Biometry (integers only, in mm/grams)</h4>` immediately before the `<FormGroup>` opening tag, and change `legendText` to `""`.
2. On the Doppler `<FormGroup>` (line 908, adjusted for Sub-Task 2 changes), add `<h4 style={{ marginBottom: '0.5rem', fontWeight: 600 }}>Doppler (floats allowed)</h4>` immediately before it, and change `legendText` to `""`.
3. No other section titles need changing.

**Relevant Context:**
- "Pregnancy Data" h4 (line 636) and "Ultrasound Findings" h4 (line 721) are already `<h4>` — leave them untouched.
- Carbon `<FormGroup legendText="">` renders cleanly with no errors or warnings.

---

## Files Changed

| File | Change |
|------|--------|
| [`frontend/src/components/ExaminationForm.tsx`](../frontend/src/components/ExaminationForm.tsx) | Sub-Task 1: lines 800, 837 — button column width. Sub-Task 2: lines 910–945 — Doppler rows restructured (3→2). Sub-Task 3: lines 776, 908 — section titles. |

---

## Validation

After all three sub-tasks are applied:
- Visually confirm both Calc buttons are the same width.
- Visually confirm PI is the same width as all other Doppler fields.
- Visually confirm "Biometry" and "Doppler" headings match "Anatomy" in size and weight.
- Confirm Doppler section shows exactly 2 rows of 6 equal columns (last slot of row 2 empty).
- Run `cd frontend && npm run build` to confirm no TypeScript or JSX errors.
