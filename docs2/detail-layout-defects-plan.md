# Fix Plan — Detail Page Layout Defects (Biometry & Doppler)

## Overview

Two layout defects exist in `ExaminationSections.tsx` (the detail/read-only view rendered from `ExaminationDetailPage`):

1. **Biometry section** — the detail view uses a wide `1fr 1fr 1fr` grid spreading full page width,
   with long verbose labels (e.g. "BPD (Biparietal Diameter)") rather than compact per-row entries
   matching the form's layout (short label | value | percentile, left-aligned, narrow).

2. **Doppler section** — the detail view uses `repeat(auto-fit, minmax(200px, 1fr))` which produces
   a flowing multi-column grid instead of the vessel-table layout used in the input form:
   - Sub-grid A (`8rem 1fr 1fr`): PI/RI header row, then A. ut. Dex. / A. ut. Sin. / A. Umb. rows
   - Sub-grid B (`8rem 1fr`): single-field rows for CMA PI, PSV, CPR, Duc. Ven.

Both defects apply to the single-fetus path AND the twins path inside `ExaminationSections.tsx`.

---

## Sub-Tasks

### Sub-Task 1 — Fix Biometry Layout in ExaminationSections.tsx

**Status:** [x] done

**Intent:**  
Make the biometry detail block visually match the form's `BiometrySection.tsx` layout: compact rows,
short labels, value, percentile — left-aligned without spreading across the full page width.

**Expected Outcomes:**
- Each biometry measurement renders on its own row as: `short label` | `value` | `percentile`
- Labels are short (BPD, OFD, HC, TAD, APAD, AC, FL, TCD, Vp, CM, NF, NB, EFW, LA, LC)
- The 3-column grid is constrained in width (max ~600px or left-aligned with `fit-content` columns)
  so it does not spread full-width across the tile
- GA from Biometry appears in col3 of the BPD row (same as the form)
- Applies to both the single-fetus block (lines ~139–196) and both twins blocks (Twin 1 ~257–300, Twin 2 ~354–396)

**Todo List:**
1. Change `gridTemplateColumns` in the biometry grid from `'1fr 1fr 1fr'` to `'auto auto auto'`
   (or use `minmax(0, auto)` so columns shrink to content width and remain left-aligned)
2. Add `width: 'fit-content'` (or `justifyContent: 'start'`) to the grid container so the 3-column
   block does not stretch full page width
3. Replace long verbose labels with short labels matching the form:
   - "BPD (Biparietal Diameter)" → "BPD"
   - "OFD (Occipito-frontal Diameter)" → "OFD"
   - "HC (Head Circumference)" → "HC"
   - "AC (Abdominal Circumference)" → "AC"
   - "FL (Femur Length)" → "FL"
   - "TCD (Transcerebellar Diameter)" → "TCD"
   - "EFW (Estimated Fetal Weight)" → "EFW" (keep unit `g`)
   - "GA from Biometry" → "GA from Bio"
4. Percentile column — **no label**, just the plain value (e.g. `15th`). Replace all `fieldBlock('BPD Percentile', ...)`,
   `fieldBlock('BPD Pct', ...)` etc. with a simple `<div>` showing the value directly (e.g. `${biometryPercentiles.bpd}th`)
   or `<div />` when no percentile. This applies to the single-fetus block and both twins blocks.
5. Apply identical changes to the single-fetus block, the Twin 1 block, and the Twin 2 block

**Relevant Context:**
- [`frontend/src/components/ExaminationSections.tsx`](frontend/src/components/ExaminationSections.tsx) — single-fetus biometry ~lines 139–196, Twin 1 biometry ~lines 257–300, Twin 2 biometry ~lines 354–396
- [`frontend/src/components/sections/BiometrySection.tsx`](frontend/src/components/sections/BiometrySection.tsx) — form's layout (reference for how it should look)

---

### Sub-Task 2 — Fix Doppler Layout in ExaminationSections.tsx

**Status:** [x] done

**Intent:**  
Replace the detail view's flowing grid with the same vessel-table structure used in `DopplerSection.tsx`:
- Sub-grid A: `8rem 1fr 1fr` for A. ut. Dex. / A. ut. Sin. / A. Umb. PI+RI pairs
- Sub-grid B: `8rem 1fr` for CMA PI, PSV, CPR, Duc. Ven.
Applies to both the single-fetus path and the twins path.

**Expected Outcomes:**
- Doppler detail section shows:
  - Header row: blank | PI | RI
  - A. ut. Dex. | value | value
  - A. ut. Sin. | value | value
  - A. Umb.     | value | value
  - Then below: CMA PI | value / PSV | value / CPR | value / Duc. Ven. | value
- Matches the structural layout of `DopplerSection.tsx` exactly
- Applies to single-fetus block (lines ~217–233) and the Twin 1 (~319–335) and Twin 2 (~416–432) blocks

**Todo List:**
1. In the single-fetus doppler block, replace the single `div` with `gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))'`
   with two sub-divs:
   - Sub-grid A (`8rem 1fr 1fr`, `alignItems: 'end'`): header row (blank|PI|RI), then 3 vessel rows
   - Sub-grid B (`8rem 1fr`, `alignItems: 'end'`): CMA PI, PSV, CPR, Duc. Ven.
2. Use a `labelStyle` (e.g. `fontSize: '0.875rem', color: '#525252'`) for row labels and column headers,
   matching the form's visual
3. For value display cells, use the same `fieldBlock` helper (or inline equivalent) showing just the value
4. Apply identical changes to the Twin 1 doppler block and the Twin 2 doppler block

**Relevant Context:**
- [`frontend/src/components/ExaminationSections.tsx`](frontend/src/components/ExaminationSections.tsx) — single-fetus doppler ~lines 217–233, Twin 1 ~lines 319–335, Twin 2 ~lines 416–432
- [`frontend/src/components/sections/DopplerSection.tsx`](frontend/src/components/sections/DopplerSection.tsx) — sub-grid A/B structure to replicate (lines 32–117)
