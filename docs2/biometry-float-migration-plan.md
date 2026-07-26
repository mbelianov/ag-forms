# Biometry Float Migration Plan

## Overview

Biometry fields (BPD, HC, AC, FL, EFW, OFD, Vp, TCD, CM, NuchalFold, NB, APAD, TAD, LA, LC)
are currently enforced as **integers** throughout the stack. This was a requirement-specification
error. The fields must accept **floating-point values** (e.g., `85.3 mm`).

The fix spans 7 layers: input/parsing, frontend validation, backend Joi schema, calculation
pass-through (no change needed), Azure Table Storage (no schema migration needed), display
rendering, and string messages/placeholders. The sub-tasks below must be executed in order
because each layer depends on the one above it being correct first.

**Storage note:** Azure Table Storage is schema-less; biometry is stored as a JSON-serialised
string. Changing `85` to `85.3` in the JSON payload is transparent — no migration script is
needed. Existing integer rows remain valid and will deserialise as `number` without issue.

---

## Sub-Task 1 — Parsing: replace `parseInt` with `parseFloat` in ExaminationForm

- **Status:** [DONE]

### Intent
The `biometryInts` object (used for calculations on the fly) and the `intOrUndef` helper (used
at form submission) both call `parseInt`, which silently truncates decimal portions. Replacing
them with `parseFloat` makes the numeric values propagate correctly to all downstream consumers.

### Expected Outcomes
- `formData.bpd = "85.3"` → `biometryInts.bpd = 85.3` (not `85`)
- Submitted payload carries `bpd: 85.3` (not `85`)
- `floatOrUndef` helper already exists for doppler; rename or reuse pattern for biometry

### Todo List
1. In `frontend/src/components/ExaminationForm.tsx` **lines 214–219**, rename `biometryInts`
   to `biometryFloats` and replace all four `parseInt(formData.X)` calls with `parseFloat(formData.X)`.
2. In the same file **line 368**, replace `parseInt(v)` inside `intOrUndef` with `parseFloat(v)`,
   and rename the helper to `floatOrUndefBiometry` (or simply reuse the existing `floatOrUndef`
   helper already defined at **line 369** for doppler fields) — apply it to all 15 biometry fields
   in the submit block (**lines 376–390**).
3. Update every downstream reference to `biometryInts` (lines 222, 238–241, 248–251, 259–262)
   to use the new name `biometryFloats`.

### Relevant Context
- `frontend/src/components/ExaminationForm.tsx` lines 214–219 (biometryInts declaration)
- `frontend/src/components/ExaminationForm.tsx` lines 368–390 (intOrUndef + submit biometry block)
- `floatOrUndef` is already defined at line 369 — it calls `parseFloat` and can be reused directly

---

## Sub-Task 2 — Frontend Validation: remove integer constraint, allow positive floats

- **Status:** [DONE]

### Intent
Two places enforce the integer constraint on the frontend:
1. An inline validation loop inside `ExaminationForm.tsx`
2. The shared `validateBiometryField` function in `validators.ts`

Both must be changed to accept any positive finite float.

### Expected Outcomes
- Typing `85.3` into a biometry field shows no validation error
- Empty fields are still allowed (optional)
- Zero and negative values are still rejected
- Non-numeric strings (e.g., `"abc"`) are still rejected

### Todo List
1. In `frontend/src/utils/validators.ts` **lines 89–99**:
   - Replace `parseInt(value)` with `parseFloat(value)`.
   - Remove the string-equality check `parsed.toString() !== value.trim()` (this is the
     integer gate).
   - Keep the `parsed <= 0` guard; add `!isFinite(parsed)` guard.
   - Update the error message from `"must be a whole number (integer)"` to
     `"must be a positive number"`.
2. In `frontend/src/components/ExaminationForm.tsx` **lines 314–325** (inline biometry
   validation loop):
   - Replace `parseInt(value)` with `parseFloat(value)`.
   - Remove the `parsed.toString() !== value.trim()` string-equality check.
   - Keep the `parsed <= 0` and `isNaN(parsed)` guards; add `!isFinite(parsed)`.
   - Update the inline error message from `'Must be a whole number (integer)'` to
     `'Must be a positive number'`.

### Relevant Context
- `frontend/src/utils/validators.ts` lines 89–99 (`validateBiometryField`)
- `frontend/src/components/ExaminationForm.tsx` lines 314–325 (inline validation loop)
- Doppler validation at lines 327–339 already uses `parseFloat` + `isNaN` — mirror that pattern

---

## Sub-Task 3 — Backend Validation: remove `.integer()` from Joi biometry schema

- **Status:** [DONE]

### Intent
The Joi `biometrySchema` in `api/src/utils/validation.ts` applies `.integer()` to all 15
biometry fields and uses `'number.base'` error messages that say "must be an integer". This
must be changed to accept any positive float within the existing min/max bounds.

### Expected Outcomes
- `POST /v1/examinations` with `biometry.bpd: 85.3` passes validation (was rejected with 400)
- `PUT /v1/examinations/:id` same
- All existing max bounds (e.g. BPD max 200, HC max 500) are preserved
- Zero values remain allowed by min(0) — these are valid "not measured" indicators

### Todo List
1. In `api/src/utils/validation.ts` **lines 150–188** (`biometrySchema`):
   - Remove `.integer()` from every field (BPD, HC, AC, FL, EFW, OFD, Vp, TCD, CM,
     NuchalFold, NB, APAD, TAD, LA, LC — all 15 fields).
   - Update all `'number.base'` message strings from `"X must be an integer"` to
     `"X must be a valid number"`.
   - Keep all `.min(0)`, `.max(N)`, and `.optional()` modifiers unchanged.
2. Update the schema comment at line 146–149 from "Biometry data validation schema" to note
   that fields accept floats.

### Relevant Context
- `api/src/utils/validation.ts` lines 150–188
- Doppler schema at lines 194+ has no `.integer()` — mirror that pattern
- This schema is used by `CreateExamination.ts` and `UpdateExamination.ts`

---

## Sub-Task 4 — Calculations: confirm no changes needed (audit/documentation only)

- **Status:** [DONE]

### Intent
All calculation functions in `calculations.ts` already accept `number` parameters and apply
floating-point arithmetic (mm→cm division). This sub-task confirms each function is float-safe
and documents the finding in a code comment — no code changes required.

### Expected Outcomes
- No code changes to `frontend/src/utils/calculations.ts`
- Each function confirmed float-safe by reading its body

### Todo List
1. Read and confirm `calcGAFromBiometry` — uses `/10` division, float-safe. ✓
2. Read and confirm `calcEFW` — uses Hadlock formula with `/10` division, float-safe. ✓
3. Read and confirm `calcBiometryPercentiles` — divides inputs by 10, feeds normalCDF with
   floats, output is `Math.round`-ed percentile integer. Float inputs propagate correctly. ✓
4. Read and confirm `calcEFWPercentile` — uses `Math.log`, float-safe. ✓
5. No code change needed. Mark status done.

### Relevant Context
- `frontend/src/utils/calculations.ts` lines 77–228
- `parseGAWeeks` at line 142 converts GA string to decimal weeks (already float output)

---

## Sub-Task 5 — Storage: confirm no migration needed (audit/documentation only)

- **Status:** [DONE]

### Intent
Azure Table Storage is schema-less. Biometry is serialised as a JSON string. TypeScript
interfaces use `number` (not `integer`) types. No migration is needed, but inline comments
in the type files claim "integer" and must be corrected.

### Expected Outcomes
- No database migration or storage changes
- Type definition comments updated to say "float, mm" instead of "integer, mm"
- Existing stored integer values (`85`) remain valid and deserialise correctly as `number`

### Todo List
1. In `api/src/types/index.ts` **lines 118–134** (`BiometryData` interface):
   - Update all inline comments from `"(integer, mm)"` / `"(integer, grams)"` to
     `"(float, mm)"` / `"(float, grams)"`.
2. In `frontend/src/types/index.ts` **lines 57–61** (`Biometry` interface):
   - Update inline comments on `bpd`, `hc`, `ac`, `fl`, `efw` from `"integer, mm"` /
     `"integer, grams"` to `"float, mm"` / `"float, grams"`.

### Relevant Context
- `api/src/types/index.ts` lines 117–135
- `frontend/src/types/index.ts` lines 55–74
- `CreateExamination.ts` and `UpdateExamination.ts` call `JSON.stringify(biometry)` — this
  serialises JavaScript `number` primitives as-is (float or int) without any rounding

---

## Sub-Task 6 — Display: format biometry values to two decimal places everywhere

- **Status:** [DONE]

### Intent
Every place that renders a biometry numeric value to the screen currently uses template
literals like `` `${value} mm` `` which will produce `85.3 mm` for a float but `85 mm` for
an integer. Per the requirement, all values must be formatted to **exactly two decimal places**
(e.g., `85.30 mm`). This applies to the detail page, the print service (PDF), and the form's
read-back hydration.

### Expected Outcomes
- `ExaminationDetailPage` shows `85.30 mm` for a stored value of `85.3`
- PDF export (via `print.service.ts` and `pdfDocument.ts`) shows `85.30 mm`
- Form inputs pre-filled from an existing examination show `85.30` in the field
- Integer values already stored (e.g., `85`) display as `85.00 mm`

### Todo List
1. Add a shared formatter function. The best place is `frontend/src/utils/calculations.ts`
   (already imported everywhere calculations are used) or a new `formatters.ts`. Define:
   ```ts
   export function fmtBiometry(value: number): string {
     return value.toFixed(2);
   }
   ```
2. In `frontend/src/pages/ExaminationDetailPage.tsx` **lines 332–370**: replace every
   `` `${examination.biometry?.X} mm` `` template with
   `` `${fmtBiometry(examination.biometry.X)} mm` `` (15 fields: BPD, HC, AC, FL, EFW, OFD,
   Vp, TCD, CM, NuchalFold, NB, APAD, TAD, LA, LC). Note EFW uses `g` not `mm`.
3. In `frontend/src/services/print.service.ts` **lines 113–167** (`withPct` and
   `buildViewModel`):
   - Update `withPct` to call `value.toFixed(2)` instead of bare string interpolation.
   - Update all bare `` `${exam.biometry.X} mm` `` literals for the extended fields
     (OFD, Vp, TCD, CM, NuchalFold, NB, APAD, TAD, LA, LC) to use `.toFixed(2)`.
   - Update the EFW line similarly (use `.toFixed(2)` for the weight value).
4. In `frontend/src/components/ExaminationForm.tsx` **lines 76–92** (form state
   initialisation from an existing examination), replace `.toString()` calls on biometry
   fields with `.toFixed(2)` so that a stored `85` pre-fills the field as `"85.00"`.

### Relevant Context
- `frontend/src/pages/ExaminationDetailPage.tsx` lines 330–371
- `frontend/src/services/print.service.ts` lines 113–167 (withPct + buildViewModel biometry block)
- `frontend/src/components/ExaminationForm.tsx` lines 76–92 (form hydration)
- Do NOT change the `formData` → display in the live form inputs — those remain as-is strings
  (the user is actively editing them)

---

## Sub-Task 7 — Messages: update section heading, comments, and placeholders

- **Status:** [DONE]

### Intent
Several user-visible strings and code comments still assert that biometry fields must be
integers. These must be updated to reflect the float requirement. This is purely cosmetic but
important for user clarity and code correctness.

### Expected Outcomes
- No user-visible text claims biometry fields must be whole numbers or integers
- Placeholder examples show a decimal value (e.g., `"e.g., 85.5"`)
- Code comments no longer say "integers only"

### Todo List
1. In `frontend/src/components/ExaminationForm.tsx` **line 778**:
   - Change `"Biometry (integers only, in mm/grams)"` →
     `"Biometry (decimal values accepted, in mm/grams)"`.
2. In `frontend/src/components/ExaminationForm.tsx` **line 75** (inline comment):
   - Change `// TASK-034/035 — integers` or similar comment to `// biometry floats, mm`.
3. In `frontend/src/components/ExaminationForm.tsx`, update the `placeholder` on the four
   primary biometry inputs to show a decimal example:
   - BPD line 785: `placeholder="e.g., 85"` → `placeholder="e.g., 85.5"`
   - HC line 789: `placeholder="e.g., 310"` → `placeholder="e.g., 310.5"`
   - AC line 793: `placeholder="e.g., 280"` → `placeholder="e.g., 280.5"`
   - FL line 797: `placeholder="e.g., 55"` → `placeholder="e.g., 55.5"`
   - Extended fields (OFD, Vp, TCD, etc.) currently show `"e.g., 0"` — change to
     `"e.g., 0.0"` for consistency.
4. In `frontend/src/utils/validators.ts` **line 93** (already addressed in Sub-Task 2),
   confirm the error message no longer says "integer".

### Relevant Context
- `frontend/src/components/ExaminationForm.tsx` line 778 (section heading)
- `frontend/src/components/ExaminationForm.tsx` lines 785, 789, 793, 797 (placeholders)
- `frontend/src/components/ExaminationForm.tsx` lines 882–903 (extended field map + LA/LC)
- `frontend/src/utils/validators.ts` line 93

---

## Edge Cases and Regression Risks

| Risk | Description | Mitigation |
|------|-------------|------------|
| **Existing integer rows** | Records already stored as `85` (integer JSON) will deserialise as `number = 85`. `(85).toFixed(2)` → `"85.00"`. No data loss; display changes from `"85 mm"` to `"85.00 mm"`. | Acceptable — display format change only. |
| **Form hydration** | Pre-filling form from a stored `85` via `.toFixed(2)` shows `"85.00"` in the input. `parseFloat("85.00")` → `85`. Calculations unchanged. | Acceptable. User may be mildly surprised to see `85.00` where they entered `85`. |
| **Zero values** | Some fields allow `0` as a valid "not measured" marker. `(0).toFixed(2)` → `"0.00"`. `parseFloat("0.00")` → `0`. Both validation (allows zero, rejects negatives) and storage remain correct. | No issue. |
| **Percentile calculations** | `calcBiometryPercentiles` already uses float arithmetic. Passing `85.3` instead of `85` will produce a slightly different but more accurate percentile. This is correct behaviour. | No regression. |
| **Boundary values** | Existing Joi max bounds (e.g., BPD max 200) now apply to floats. `200.1` will be rejected with a range error. Clinically appropriate. | No issue. |
| **Backend receives float in JSON** | `JSON.stringify({ bpd: 85.3 })` → `'{"bpd":85.3}'`. Azure Table Storage stores this string. `JSON.parse` on read → `{ bpd: 85.3 }`. Round-trip is lossless for values with ≤15 significant digits. | No issue. |
| **EFW as float** | EFW is currently `"integer, grams"`. Allowing `1250.5 g` is clinically reasonable. Max remains 10000. | Acceptable change. |
| **Snapshot / unit tests** | Any existing test that asserts a biometry value equals an integer (e.g., `expect(result.bpd).toBe(85)`) will fail if the test now passes `85.3`. | Review tests in `api/src/tests/` after implementation. No known snapshot tests for this path. |
