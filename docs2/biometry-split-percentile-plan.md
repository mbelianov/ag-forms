# Biometry — Split Value/Percentile Columns (Prenatal Only)

## Top-Level Overview

**Goal:** In the Prenatal biometry grid (TILE A2), split the current composite
"Value" column (which contains both measurement and percentile as one string,
e.g. `"10.00 mm - 1 %-ile"`) into two separate columns:

- **Col 2 — Value:** measurement only, right-aligned (e.g. `"10.00 mm"`)
- **Col 3 — Percentile:** percentile only (e.g. `"1 %-ile"`), or `"—"` when none
- **Col 4 — GA from Bio:** unchanged, shifts from col 3 to col 4

**Scope:** `ExaminationSections.tsx` (prenatal path only) and the template spec
`docs2/exam-details-view-template.txt`. The First Trimester biometry grid is
explicitly out of scope and stays at its current 3-column layout.

**Primary files affected:**
- `frontend/src/components/ExaminationSections.tsx`
- `docs2/exam-details-view-template.txt`

---

## Sub-Tasks

---

### Sub-Task A — Split `fmtVal` into two separate formatters

**Status:** `[x] completed`

**Intent:** The current `fmtVal(val, unit, pct?)` returns a composite string.
Two dedicated helpers are needed so each column cell can be rendered independently.

**Expected Outcomes:**
- `fmtVal(val, unit)` returns `"${fmtBiometry(val)} ${unit}"` or `"—"` — no percentile.
- New `fmtPct(pct?)` returns `"${pct} %-ile"` when `pct` is defined, `"—"` otherwise.

**Todo List:**
1. In `ExaminationSections.tsx`, remove the `pct` parameter from `fmtVal` — it returns
   only the base measurement string.
2. Add a new `fmtPct` helper directly below `fmtVal`:
   ```
   const fmtPct = (pct?: number | string): string =>
     pct !== undefined ? `${pct} %-ile` : '—';
   ```

**Relevant Context:**
- `ExaminationSections.tsx` lines 53–58 (current `fmtVal`).

---

### Sub-Task B — Change `bioGridStyle3col` to a 4-column grid

**Status:** `[x] completed`

**Intent:** The prenatal biometry grid template must accommodate 4 columns:
label | value (right-aligned) | percentile | GA from Bio.

**Expected Outcomes:**
- `gridTemplateColumns` becomes `'max-content minmax(6rem, auto) max-content max-content'`.
- A new `bioValueRightStyle` cell style is added: same as `bioValueStyle` but
  `textAlign: 'right'` — used for col 2 (measurement values).
- Col 3 (percentile) uses the existing `bioValueStyle` (left-aligned).

**Todo List:**
1. Update `bioGridStyle3col` `gridTemplateColumns` to
   `'max-content minmax(6rem, auto) max-content max-content'`.
2. Rename `bioGridStyle3col` to `bioGridStyle4col` for clarity (update all references).
3. Add `bioValueRightStyle`:
   ```
   const bioValueRightStyle: React.CSSProperties = {
     ...bioValueStyle, textAlign: 'right'
   };
   ```

**Relevant Context:**
- `ExaminationSections.tsx` lines 60–66 (current `bioGridStyle3col`).
- `bioGridStyle3col` is currently referenced only inside `renderPrenatalColumn`.

---

### Sub-Task C — Update `renderPrenatalColumn` biometry grid

**Status:** `[x] completed`

**Intent:** Every row in the biometry grid gains a 4th cell. The header row gets a
`"Percentile"` header in col 3 and `"GA from Bio"` shifts to col 4. Data rows
render the percentile in col 3 (`fmtPct(...)`) and an empty `<div />` in col 4
for all rows except the first (BPD), which shows the GA from Bio value.

**Expected Outcomes:**
- Header row: `Measurement | Value | Percentile | GA from Bio`
- BPD row: `BPD (mm) | 10.00 mm | 1 %-ile | 28w 3d`
- OFD row: `OFD (mm) | 12.00 mm | — | <empty>`
- All rows with a percentile (BPD, HC, AC, FL, EFW) render `fmtPct(bpct?.field)`
  in col 3; all other rows render `fmtPct(undefined)` → `"—"`.
- Col 2 value cells use `bioValueRightStyle` (right-aligned).
- Col 3 percentile cells use `bioValueStyle` (left-aligned).
- Col 4 is `<div style={bioValueStyle}>{gaFromBio || '—'}</div>` on the BPD row
  and `<div />` on all other rows — unchanged from current col 3 behaviour.

**Biometry rows and their percentile source:**

| Row | Percentile source |
|---|---|
| BPD (mm) | `bpct?.bpd` |
| OFD (mm) | none |
| HC (mm) | `bpct?.hc` |
| TAD (mm) | none |
| APAD (mm) | none |
| AC (mm) | `bpct?.ac` |
| FL (mm) | `bpct?.fl` |
| TCD (mm) | none |
| Vp (mm) | none |
| CM (mm) | none |
| NF (mm) | none |
| NB (mm) | none |
| EFW (grams) | `efwPct` |
| LA (mm) | none |
| LC (mm) | none |

**Todo List:**
1. Replace `<div style={bioGridStyle3col}>` with `<div style={bioGridStyle4col}>`.
2. Update header row: add `<div style={bioLabelStyle}>Percentile</div>` between
   `Value` and `GA from Bio` header cells.
3. For each data row, replace the single value cell with two cells:
   - Col 2: `<div style={bioValueRightStyle}>{fmtVal(bio?.field, 'unit')}</div>`
   - Col 3: `<div style={bioValueStyle}>{fmtPct(percentileArg)}</div>`
4. Col 4 (GA from Bio): unchanged — first row has value, rest are `<div />`.

**Relevant Context:**
- `ExaminationSections.tsx` lines 225–281 (current biometry block in `renderPrenatalColumn`).

---

### Sub-Task D — Update `docs2/exam-details-view-template.txt` TILE A2

**Status:** `[x] completed`

**Intent:** Keep the spec document in sync with the new 4-column table layout.

**Expected Outcomes:**
- Layout description line reads: `4-column grid (Measurement | Value | Percentile | GA from Bio)`.
- ASCII table updated to show four columns with the `"Percentile"` column.
- Field notes updated: percentile has its own column; `"—"` is shown when no percentile.

**Todo List:**
1. Update layout description at line 153.
2. Replace the ASCII table (lines 157–175) with a 4-column version.
3. Update field notes (lines 177–181) to reflect the split.

**Relevant Context:**
- `docs2/exam-details-view-template.txt` lines 150–181.

---

## Implementation Order

```
Sub-Task A → Sub-Task B → Sub-Task C → Sub-Task D
```

A and B are preparatory (helpers + grid style). C depends on both. D is doc-only and
can be done last.
