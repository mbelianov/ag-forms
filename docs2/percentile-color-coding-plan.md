# Percentile Colour-Coding Plan

## Overview

Add visual colour-coding to the 9 percentile input fields in `BiometrySection` so clinicians
can instantly see whether a measurement falls in a normal, borderline, or abnormal zone.
The colouring uses background tint on the Carbon `TextInput` element, applied via a new
`PercentileInput` wrapper component that encapsulates all threshold and colour logic.

**Colours chosen (Excel-style, familiar to medical staff):**
- 🟢 Green `#c6efce` — normal zone (5th–95th percentile, inclusive)
- 🟡 Yellow `#ffee99` — borderline zone (< 5th or > 95th, but not in red zone)
- 🔴 Red `#ffc7ce` — abnormal zone (< 2.27th [z < −2] or > 97.73th [z > +2])

**Empty / non-numeric fields:** no background colour (transparent / default Carbon style).

**Threshold summary:**

| Zone   | Condition                        | Colour    |
|--------|----------------------------------|-----------|
| Red    | value < 2.27 OR value > 97.73    | `#ffc7ce` |
| Yellow | value < 5 OR value > 95          | `#ffee99` |
| Green  | 5 ≤ value ≤ 95                   | `#c6efce` |
| None   | empty or non-numeric             | transparent |

---

## Sub-Task 1 — Create `PercentileInput` component

**Status:** [ ] pending

**Intent:**
Introduce a reusable `PercentileInput` component that wraps Carbon's `TextInput` and applies
the correct background tint based on the numeric percentile value. All threshold logic lives
here and nowhere else.

**Expected Outcomes:**
- A new file `frontend/src/components/PercentileInput.tsx` exists.
- The component accepts the same props as Carbon `TextInput` plus the current string `value`.
- Background colour is applied via an inline style on a wrapping `<div>` that targets the
  Carbon input element using the class `.cds--text-input` in a scoped `<style>` block or
  via a small companion CSS rule added to `frontend/src/index.css`.
- When `value` is empty or non-numeric the background is transparent (no tint).

**Todo List:**
1. Create `frontend/src/components/PercentileInput.tsx`.
2. Define a `getPercentileBg(value: string): string` helper inside the file that returns
   the hex colour string or `'transparent'` using the thresholds above.
3. The component renders a `<div>` wrapper with an inline CSS custom property
   `--p-bg: <colour>` and a `<TextInput>` from `@carbon/react` forwarding all props.
4. Add a single CSS rule to `frontend/src/index.css`:
   `.p-input-wrap .cds--text-input { background-color: var(--p-bg, transparent); }`
   and apply the class `p-input-wrap` to the wrapper `<div>`.

**Relevant Context:**
- `frontend/src/components/AutoCalcDot.tsx` — the pattern for a small focused component
  with inline styles; follow the same style.
- `frontend/src/index.css` — the only global CSS file; this is where the single new rule goes.
- Carbon v1.109.0 uses the internal class `cds--text-input` on the `<input>` element.

---

## Sub-Task 2 — Swap percentile `TextInput` fields in `BiometrySection`

**Status:** [ ] pending

**Intent:**
Replace all 9 percentile `TextInput` instances in `BiometrySection` with `PercentileInput`,
passing the same props. No other changes to `BiometrySection` are needed.

**Expected Outcomes:**
- All 9 percentile inputs in the form render with colour-coded backgrounds.
- Auto-calc and manual-entry percentile fields both colour correctly.
- No other fields (measurement inputs, GA inputs) are affected.
- The component signature of `BiometrySection` does not change.

**Todo List:**
1. Import `PercentileInput` at the top of `frontend/src/components/sections/BiometrySection.tsx`.
2. Replace the 9 `TextInput` components for fields `bpdPercentile`, `ofdPercentile`,
   `hcPercentile`, `tadPercentile`, `apadPercentile`, `acPercentile`, `flPercentile`,
   `efwPercentile`, `tcdPercentile` with `<PercentileInput>` using identical props.
3. Remove the `TextInput` import only if it is no longer used after the swap (it may still
   be used by other fields in the same file — verify before removing).

**Relevant Context:**
- `frontend/src/components/sections/BiometrySection.tsx` lines 99–214 — all 9 percentile
  TextInput locations identified; lines 103, 116, 129, 142, 155, 168, 181, 194, 207.
- `tadPercentile` (line 142) and `apadPercentile` (line 155) use plain `labelText` strings
  (no `autoCalcLabel`) — `PercentileInput` must accept both plain strings and `ReactNode`
  for `labelText`, matching the Carbon `TextInput` prop type.
