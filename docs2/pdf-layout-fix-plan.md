# Fix Plan — PDF Layout: Biometry & Doppler to Match Detail View

## Overview

The detail view was updated to:
1. **Biometry** — vertical order, one row per measurement, label | value | percentile
2. **Doppler** — vessel-table layout (PI/RI header + 3 vessel rows, then 4 single-field rows)

The PDF must match and **must still fit on one page**. Space budget analysis:

- Usable page height after header + patient + pregnancy data: ~240mm
- Ultrasound Findings: ~27mm, Anatomy: ~33mm, Doppler (new): ~38.5mm, Clinical Info + sig: ~65mm
- **Budget remaining for biometry: ~77mm**
- 15 rows at 4.5mm pitch = **67.5mm** ✅ fits with margin

Therefore biometry uses a **dedicated row-by-row renderer** (not `kvGrid`) with a
tight **4.5mm row pitch**. Each row: label | value | percentile, with GA from Bio
appended inline on the BPD row. Percentile is shown concisely (e.g. `15th`) with no
brackets or `%ile` suffix.

**Doppler budget:** Current = 10 pairs ÷ 3 cols = 4 rows × 5.5mm = **22mm**.
Vessel-table = 7 rows × 5.5mm = **38.5mm** — 16.5mm more. This fits.
For twins (88mm column), label column proportional to `88 * 0.35 ≈ 31mm` — adequate.

---

## Sub-Tasks

### Sub-Task 1 — Biometry: vertical row-by-row renderer with separate percentile column

**Status:** [x] done

**Intent:**
Replace `mkBiometryPairs` + `kvGrid` with a dedicated `renderBiometryBlock` function
that draws one row per measurement in vertical order: label | value | percentile,
with GA from Bio shown inline on the BPD row. Row pitch is **4.5mm** to fit 15 rows
in ~67.5mm. Percentile is shown as `"15th"` (no brackets, no `%ile`).

The `withPct` helper in `viewModelBuilders.ts` must be split: value and percentile
are returned separately so `renderBiometryBlock` can place them in distinct columns.
`BiometryViewModel` gets new `bpdPct`, `hcPct`, `acPct`, `flPct`, `efwPct` fields.

**Expected Outcomes:**
- PDF biometry renders vertically: BPD, OFD, HC, TAD, APAD, AC, FL, TCD, Vp, CM, NF, NB, EFW, LA, LC — one row each
- Each row: label in col1, value (mm/g) in col2, percentile in col3 (blank when none)
- BPD row: GA from Bio value appended after percentile in col3 (or as 4th text element on the same y)
- Row pitch 4.5mm — total ~67.5mm, fits within budget
- Applies to single-fetus and both twin columns

**Todo List:**
1. In [`print.service.ts`](frontend/src/services/print.service.ts): add `bpdPct`, `hcPct`, `acPct`, `flPct`, `efwPct` (all `string | undefined`) to `BiometryViewModel`
2. In [`viewModelBuilders.ts`](frontend/src/services/viewModelBuilders.ts):
   - Change `withPct` to return just the value: `` `${fmtBiometry(value)} mm` ``
   - Add a helper `pctStr(pct) => pct !== undefined ? ordinal(pct) : undefined`
   - Populate new percentile fields on `biometry` and `biometry2` using `pctStr`
   - Change EFW value to just `` `${fmtBiometry(efw)} g` `` (no inline percentile); populate `efwPct` field
3. In [`pdfSections.ts`](frontend/src/components/reports/pdfSections.ts): add `renderBiometryBlock(doc, b, gaFromBio, y, xStart, colW, helpers): number`:
   - Column widths: label = `colW * 0.30`, value = `colW * 0.35`, percentile = `colW * 0.20`, GA col = `colW * 0.15`
   - Rows in order: BPD (+ GA from Bio in col4), OFD, HC, TAD, APAD, AC, FL, TCD, Vp, CM, NF, NB, EFW, LA, LC
   - Label: normal font, 7.5pt, `C_MID`; value: bold font, 8pt, `C_DARK`; percentile: normal, 7.5pt, `C_MID`; GA: normal, 7.5pt, `C_MID`
   - Row pitch: `4.5mm`; return y after all rows
4. In `renderClinicalSections`: replace `kvGrid(doc, mkBiometryPairs(...), y, 3)` calls with `renderBiometryBlock(...)` for both single-fetus and twins paths

**Relevant Context:**
- [`frontend/src/services/print.service.ts`](frontend/src/services/print.service.ts) — `BiometryViewModel` type to extend
- [`frontend/src/services/viewModelBuilders.ts`](frontend/src/services/viewModelBuilders.ts) lines 35–37 — `withPct` to change
- [`frontend/src/services/viewModelBuilders.ts`](frontend/src/services/viewModelBuilders.ts) lines 129–146 — `biometry2` construction
- [`frontend/src/services/viewModelBuilders.ts`](frontend/src/services/viewModelBuilders.ts) lines 227–244 — `biometry` construction
- [`frontend/src/components/reports/pdfSections.ts`](frontend/src/components/reports/pdfSections.ts) lines 25–33 — `mkBiometryPairs` to replace
- [`frontend/src/components/reports/pdfDocument.ts`](frontend/src/components/reports/pdfDocument.ts) lines 128–178 — `kvGridAt` as rendering pattern reference

---

### Sub-Task 2 — Doppler: vessel-table layout in PDF

**Status:** [x] done

**Intent:**
Replace the flat 3-column `kvGrid` doppler with a vessel-table renderer matching
the detail view structure:
- Sub-section A: header row (blank | PI | RI) + 3 vessel rows (A.ut.Dex / A.ut.Sin / A.Umb)
- Sub-section B: 4 single-field rows (CMA PI / PSV / CPR / Duc.Ven)

The renderer must accept `xStart` and `colW` so it works in both the full-width
single-fetus path and the 88mm twin half-column.

**Space check:** 7 rows × 5.5mm = 38.5mm vs current 4 rows × 5.5mm = 22mm.
Extra 16.5mm. The existing page-overflow safety net (Sub-Task 3 from the prior plan,
already implemented) handles any edge case. For typical reports this fits on one page.

**Expected Outcomes:**
- PDF doppler renders as vessel-table: PI/RI header + A.ut.Dex / A.ut.Sin / A.Umb rows,
  then CMA PI / PSV / CPR / Duc.Ven single-field rows
- Applies to single-fetus and both twin columns
- Page still fits for typical reports (overflow safety net exists as fallback)

**Todo List:**
1. In [`pdfSections.ts`](frontend/src/components/reports/pdfSections.ts), add a `renderDopplerBlock` function:
   - Signature: `(doc, d, y, xStart, colW, fontSize, fontId, helpers) => number`
   - **Sub-section A** (`8rem`-equivalent label col, then two equal value cols):
     - Label col width: `colW * 0.35` (~35% for the vessel label)
     - PI col and RI col: each `colW * 0.30`
     - Header row: draw "PI" and "RI" at their column x positions (muted color, normal font)
     - Then 3 rows: A.ut.Dex., A.ut.Sin., A.Umb. with their PI and RI values
     - Each row advances y by 5.5mm
   - **Sub-section B** (label col + value col):
     - Label col width: `colW * 0.35`
     - Value col width: `colW * 0.65`
     - 4 rows: CMA PI, PSV, CPR, Duc.Ven
     - Each row advances y by 5.5mm
   - Return y after all rows
2. Remove `mkDopplerPairs` function (no longer needed) or keep it but stop using it
3. In `renderClinicalSections`, replace:
   - Single-fetus: `kvGrid(doc, mkDopplerPairs(vm.doppler), y, 3)` → call `renderDopplerBlock` with `xStart=MARGIN_L, colW=COL_W`
   - Twins: `renderTwinSection('Doppler', mkDopplerPairs(...), mkDopplerPairs(...))` → call `renderDopplerBlock` twice (once for T1 at `T1_X`, once for T2 at `T2_X`), taking max Y; pass `colW=TWIN_COL_W`
4. Pass the necessary constants (`MARGIN_L`, `COL_W`, `FONT_ID`, font/color setters) through `PdfDrawHelpers` or as parameters — check what `renderDopplerBlock` needs that isn't already in `PdfDrawHelpers`

**Relevant Context:**
- [`frontend/src/components/reports/pdfSections.ts`](frontend/src/components/reports/pdfSections.ts) lines 35–42 — `mkDopplerPairs` to replace
- [`frontend/src/components/reports/pdfSections.ts`](frontend/src/components/reports/pdfSections.ts) lines 224–249 — `renderTwinSection` usage for doppler in twins path
- [`frontend/src/components/reports/pdfDocument.ts`](frontend/src/components/reports/pdfDocument.ts) lines 128–178 — `kvGridAt` as reference for direct `doc.text` rendering pattern and color helpers
- [`frontend/src/components/reports/pdfSections.ts`](frontend/src/components/reports/pdfSections.ts:10) — `PdfDrawHelpers` interface: check what needs to be added (color setters `C_MID`, `C_DARK` and font setter helpers are currently inside `pdfDocument.ts` closures — they may need to be added to `PdfDrawHelpers` or `renderDopplerBlock` can be placed in `pdfDocument.ts` instead)
