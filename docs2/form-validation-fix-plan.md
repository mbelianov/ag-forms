# Form Validation Fix Plan

## Overview

Four defects affect the examination form across all exam types. This plan fixes them with
consistent behaviour for every exam type:

- **String fields** — any input accepted, no validation.
- **Integer fields** — accept integers and floats; silently truncate the fractional part;
  always present the stored value as an integer (no decimal).
- **Float fields** — reject any input that is not a valid decimal number (no silent
  truncation of trailing non-numeric characters); present stored values with 2 decimal
  places.
- **Front-end catches all errors** — every invalid field shows an inline error indicator
  directly below the offending input before the form is ever submitted to the server.
- **Backend validation detail is surfaced** — if the server returns a 400 with field-level
  error messages, those messages are displayed on screen (not silently discarded).

### Defects being fixed

| # | Defect | Scope |
|---|--------|-------|
| D-1 | Error key mismatch — prenatal T1 biometry, doppler, and UF heart_rate errors are written under bare keys (`bpd`, `pi`, `heart_rate`) but components read prefixed keys (`t1_bpd`, `t1_pi`, `t1_heart_rate`); no error is ever displayed | Prenatal single-fetus only |
| D-2 | `parseFloat` truncation — `parseFloat("1abc")` returns `1`, passes the positive-number guard; corrupted data silently submitted | All float fields, all exam types |
| D-3 | Integer fields use weak `parseInt` guard — FT `ft_puls` and `ft_heartRate` lack the cross-check that the prenatal `heart_rate` field has; `"145abc"` passes silently | FT integer fields |
| D-4 | Backend validation detail discarded — `extractMessage()` in both `examinationService` and `patientService` reads only `error.message` ("Validation failed"), drops the `details.errors` array; user sees a generic banner | All exam types, all forms |

### Out of scope

- No change to existing exam-type routing or section visibility logic.
- No new fields or UI components beyond what is needed for the fixes above.

### In-scope backend schema change

The `la` field in `biometrySchema` must change from `Joi.number()` to `Joi.string()`
as part of the LA-to-string migration described in the Additional Change section
below. This is the only backend Joi schema change in this plan.

### PCT compatibility

Sub-Task 2 (validation rules table) and Sub-Task 3 (submit assembly table) are
deliberately written as declarative tables. When the Percentiles Persistence plan
(PCT) adds 10 new `bpdPct`/`hcPct`/… fields, PCT's implementer adds rows to these
tables rather than editing conditional code blocks. That is the correct extension
point — adding fields must never require understanding the full conditional tree.

The **VAL deferred step** at the end of this document must be executed after
PCT ST-8 makes percentile inputs editable.

---

## Sub-Task 1 — Centralise numeric field validation helpers

**Status:** [x] completed

### Intent

Provide three well-specified, reusable validation helpers in
`frontend/src/utils/validators.ts` that all form validation code calls instead of
writing inline `parseFloat`/`parseInt` guards. The helpers enforce strict input
rules — no silent truncation of trailing non-numeric characters.

- `validatePositiveFloat(raw, label)` — biometry fields; rejects `"1abc"`, `"1,5"`;
  returns `undefined` when empty or valid (value > 0); error string otherwise.
- `validateNonNegativeFloat(raw, label)` — doppler fields; same rules, value >= 0.
- `validateIntegerField(raw, label)` — heart-rate / pulse fields; accepts `"145"` or
  `"145.7"` (fraction will be truncated at submit); rejects `"145abc"`; value > 0.

All three gate on the regex `/^\d+(\.\d+)?$/` before calling `parseFloat`, which is
what eliminates the `"1abc"` bug.

Update the existing but currently-unused `validateBiometryField` and
`validateDopplerField` helpers to delegate to `validatePositiveFloat` and
`validateNonNegativeFloat` respectively so they become useful entry points for future
callers.

### Expected Outcomes

- `validators.ts` exports the three new helpers.
- `validateBiometryField` and `validateDopplerField` delegate to them.
- Unit tests cover: valid float, valid integer, `"1abc"` rejected, `"1,5"` rejected,
  empty string accepted, zero rejected for positive variant, zero accepted for
  non-negative variant.

### Todo List

1. In `frontend/src/utils/validators.ts`, add `validatePositiveFloat(raw, label)`:
   regex `/^\d+(\.\d+)?$/` guard + `parseFloat(raw) > 0` check.
2. Add `validateNonNegativeFloat(raw, label)`: same regex, `parseFloat(raw) >= 0`.
3. Add `validateIntegerField(raw, label)`: same regex, `parseFloat(raw) > 0`.
4. Rewrite `validateBiometryField` and `validateDopplerField` to call
   `validatePositiveFloat` and `validateNonNegativeFloat` respectively.
5. Add frontend unit tests for the three helpers.

### Relevant Context

- `frontend/src/utils/validators.ts` lines 89–115 — current `validateBiometryField`
  and `validateDopplerField` (defined but never called).
- `frontend/src/hooks/useExaminationForm.ts` lines 458–568 — inline guards to be
  replaced in Sub-Task 2.

---

## Sub-Task 2 — Validation rules table (replaces `validateForm`, fixes D-1/D-2/D-3)

**Status:** [x] completed

### Intent

Replace the ~145-line imperative `validateForm()` body with a **declarative rules
table** plus a small generic runner. This simultaneously fixes D-1, D-2, and D-3,
and shrinks the function body by ~80%. The table is the correct extension point:
adding a new field requires one new table row, not a new conditional block.

**Structure of each table entry:**

```typescript
interface ValidationRule {
  errorKey: string;           // key written into newErrors — always prefixed, e.g. 't1_bpd'
  formKey: string;            // key read from formData — bare for T1, prefixed for T2/FT
  validate: (raw: string) => string | undefined; // helper from ST-1, or GA regex inline
  onlyWhen?: () => boolean;   // runtime guard — closes over isTwins / isFt / isFtTwinsMode
}
```

The runner iterates the table, reads `formData[rule.formKey]`, calls `rule.validate`,
and writes any error to `newErrors[rule.errorKey]`. Non-table rules (date comparisons,
patientId required-on-create, LMP future-check) remain as the small imperative
preamble they already are — they have no repetitive structure worth collapsing.

**Why `errorKey` ≠ `formKey` for T1 prenatal fields (D-1 fix):**
`handleChangeT1` strips the `t1_` prefix on write, so `formData` stores T1 biometry
under bare keys (`bpd`, `pi`). But `BiometrySection prefix="t1"` reads errors under
prefixed keys (`t1_bpd`, `t1_pi`). The table makes this split explicit:
`errorKey: 't1_bpd'`, `formKey: 'bpd'`. The T2 path already has matching keys and
is correct — its table entries have identical `errorKey` and `formKey`.

**Fields covered by the table:**

| Group | errorKey pattern | formKey pattern | Validator | onlyWhen |
|-------|-----------------|-----------------|-----------|----------|
| Prenatal T1 biometry (14, excl. la) | `t1_bpd` … `t1_lc` (not `t1_la`) | `bpd` … `lc` (not `la`) | `validatePositiveFloat` | — |
| Prenatal T1 GA from biometry | `t1_gestationalAgeFromBiometry` | `gestationalAgeFromBiometry` | GA regex | — |
| Prenatal T1 doppler (9) | `t1_pi` … `t1_cpr` | `pi` … `cpr` | `validateNonNegativeFloat` | — |
| Prenatal T1 heart rate | `t1_heart_rate` | `heart_rate` | `validateIntegerField` | — |
| Prenatal T2 biometry (14, excl. t2_la) | `t2_bpd` … `t2_lc` (not `t2_la`) | same | `validatePositiveFloat` | `isTwins` |
| Prenatal T2 GA from biometry | `t2_gestationalAgeFromBiometry` | same | GA regex | `isTwins` |
| Prenatal T2 doppler (9) | `t2_pi` … `t2_cpr` | same | `validateNonNegativeFloat` | `isTwins` |
| Prenatal T2 heart rate | `t2_heart_rate` | same | `validateIntegerField` | `isTwins` |
| FT T1 biometry (`crl`, `nt`, `nb`) | `t1_ft_crl`, `t1_ft_nt`, `t1_ft_nb` | same | `validatePositiveFloat` | `isFt` |
| FT T1 GA from CRL | `t1_ft_gaFromCrl` | same | GA regex | `isFt` |
| FT T1 integer (`puls`, `heartRate`) | `t1_ft_puls`, `t1_ft_heartRate` | same | `validateIntegerField` | `isFt` |
| FT T1 doppler (4) | `t1_ft_utADexPI` … `t1_ft_utASinRI` | same | `validateNonNegativeFloat` | `isFt` |
| FT T2 biometry (3) | `t2_ft_crl`, `t2_ft_nt`, `t2_ft_nb` | same | `validatePositiveFloat` | `isFtTwins` |
| FT T2 GA from CRL | `t2_ft_gaFromCrl` | same | GA regex | `isFtTwins` |
| FT T2 integer (2) | `t2_ft_puls`, `t2_ft_heartRate` | same | `validateIntegerField` | `isFtTwins` |
| FT T2 doppler (4) | `t2_ft_utADexPI` … `t2_ft_utASinRI` | same | `validateNonNegativeFloat` | `isFtTwins` |

Note: `la` and `t2_la` are **not** in this table — they are string fields with no
validation rule. See the Additional Change section.

**PCT deferred rows** (added by VAL deferred step after PCT ST-8 lands):

| Group | errorKey | formKey | Validator | onlyWhen |
|-------|----------|---------|-----------|----------|
| T1 percentiles (5) | `t1_bpdPct` … `t1_efwPct` | `bpdPct` … `efwPct` | `validatePercentileField` | — |
| T2 percentiles (5) | `t2_bpdPct` … `t2_efwPct` | same | `validatePercentileField` | `isTwins` |

### Expected Outcomes

- `validateForm()` body is a short imperative preamble plus a single table runner
  loop (~30 lines total, down from ~145).
- `VALIDATION_RULES` is a module-level constant in `useExaminationForm.ts`.
- D-1 is fixed: T1 prenatal biometry/doppler/UF errors appear on the correct fields.
- D-2 is fixed: `"1abc"` in any float field produces an inline error.
- D-3 is fixed: `"145abc"` in any integer field produces an inline error.
- PCT extends validation by appending rows to `VALIDATION_RULES` only.

### Todo List

1. Define `ValidationRule` interface above the hook in `useExaminationForm.ts`.
2. Define `VALIDATION_RULES: ValidationRule[]` as a module-level constant,
   populated with all rows from the table above. `onlyWhen` lambdas close over the
   `isTwins` / `isFt` / `isFtTwinsMode` derived values already in the hook.
3. Replace the `validateForm()` body (lines 429–572) with the imperative preamble
   (patientId, examDate, gestationalAge string, LMP checks — unchanged) followed by
   a single runner loop over `VALIDATION_RULES`.
4. Delete all the old per-field `if` blocks and field-name arrays replaced by the
   loop.
5. Confirm `setErrors(newErrors)` and `return Object.keys(newErrors).length === 0`
   remain as the final two lines.

### Relevant Context

- `frontend/src/hooks/useExaminationForm.ts` lines 426–572 — full `validateForm`.
- `isTwins`, `isFt`, `isFtTwinsMode` derived constants at lines ~391–393.
- T2 prenatal path is the reference for correct behaviour (errorKey = formKey);
  T1 prenatal biometry/doppler/UF are the broken cases.

---

## Sub-Task 3 — Submit assembly table + presentation fixes

**Status:** [x] completed

### Intent

Replace the ~250-line conditional `handleSubmit` assembly block with a **field
registry table** plus a generic assembler, and simultaneously apply the three
presentation fixes. All four changes target the same function and the same
principle: data flows through a consistent data-driven pipeline rather than
hand-coded conditionals. Writing them together means `handleSubmit` is written once
in its final form rather than patched and then restructured.

**Structure of each registry entry:**

```typescript
interface FieldDef {
  formKey: string;           // key in formData
  payloadPath: string;       // dot-path into the output object, e.g. 'biometry.bpd'
  outType: 'float' | 'integer' | 'string' | 'trim';
  onlyWhen?: () => boolean;  // runtime guard — same pattern as ST-2
}
```

The generic assembler walks the registry, reads `formData[entry.formKey]`, applies
the `outType` transform, and writes the result to the nested payload path. Empty /
non-numeric values produce `undefined` (field omitted). The four conditional payload
shapes become `onlyWhen` guards on table rows.

**Rule A — Integer truncation** is encoded as `outType: 'integer'`, executed by the
assembler as `Math.trunc(parseFloat(raw))`. Applied to `heart_rate`, `t2_heart_rate`,
`t1_ft_heartRate`, `t1_ft_puls`, `t2_ft_heartRate`, `t2_ft_puls`.

**Rule B — Edit-load `.toFixed(2)`** — the `useEffect` edit-load block (lines
~231–245) currently uses `.toString()` for biometry fields, inconsistent with the
`useState` initialiser which already uses `.toFixed(2)`. Fix: change the `useEffect`
block to match. Applied to all 15 T1 biometry fields and 15 T2 biometry equivalents.

**Rule C — View model formatting** — two groups in `viewModelBuilders.ts` are
missing `.toFixed(2)`:
1. All numeric doppler fields use `String(value)` — change to `value.toFixed(2)`.
   Applies to T1 doppler block (~lines 255–263) and twin2 doppler block (~lines
   154–162).
2. FT biometry float fields (`crl`, `nt`, `nb`) in `buildFtBiometry` use plain
   template literals — change to `.toFixed(2)`. Integer fields `puls` and
   `heartRate` are already correct.

**PCT compatibility:** PCT ST-7 adds 10 percentile fields and a
`biometryPercentiles` grouped sub-object to the payload. In the registry these
become rows with `outType: 'integer'` and `payloadPath: 'biometryPercentiles.bpd'`
etc., `onlyWhen: () => isTwins` for the T2 set. Zero changes to the assembler.

### Expected Outcomes

- `handleSubmit` assembly is a generic assembler loop (~20 lines) plus the registry
  table, replacing ~250 lines of conditional code.
- Integer fields are truncated at submit via `Math.trunc(parseFloat(...))`.
- Loading an existing exam in the edit form: biometry fields show `"85.50"`
  consistently (not `"85.5"`).
- Detail page and PDF: doppler values show `"0.50"`, `"1.20"` (2 decimals).
- Detail page and PDF: FT biometry floats (`CRL`, `NT`, `NB`) show `"45.00 mm"`.
- No change to form behaviour while typing.
- PCT extends the payload by adding registry rows only; no assembler changes.

### Todo List

1. **Registry** — Define `FieldDef` interface and `FIELD_REGISTRY: FieldDef[]` as
   module-level constants in `useExaminationForm.ts`. Populate with all current
   biometry, doppler, FT biometry, FT doppler, string, trim, and integer fields.
2. **Assembler** — Replace the `handleSubmit` assembly block with a loop that builds
   the nested output object from the registry. Preserve the existing
   `await onSubmit(submitData)` call and `catch`/`finally` error handling unchanged.
3. **Rule B** — In the `useEffect` edit-load block (lines ~231–245), change all
   biometry float field assignments from `.toString()` to `.toFixed(2)`. Apply the
   same to T2 biometry (lines ~282–296).
4. **Rule C, doppler** — In `viewModelBuilders.ts` (~lines 154–162 and 255–263),
   change all `String(exam.doppler.X)` / `String(exam.doppler2.X)` to
   `exam.doppler.X.toFixed(2)` / `exam.doppler2.X.toFixed(2)`.
5. **Rule C, FT biometry** — In `viewModelBuilders.ts` `buildFtBiometry` (~lines
   68–71), change `b.crl`, `b.nt`, `b.nb` template literals to use `.toFixed(2)`.

### Relevant Context

- `frontend/src/hooks/useExaminationForm.ts` lines 576–836 — full `handleSubmit`.
- `frontend/src/hooks/useExaminationForm.ts` lines 56–70 — `useState` uses
  `.toFixed(2)` for biometry (correct reference); lines 231–245 — `useEffect`
  uses `.toString()` (to be fixed).
- `frontend/src/hooks/useExaminationForm.ts` lines 623, 716, 724 — current
  `parseInt` calls to replace with `Math.trunc(parseFloat(...))`.
- `frontend/src/services/viewModelBuilders.ts` lines 65–73 — `buildFtBiometry`.
- `frontend/src/services/viewModelBuilders.ts` lines 154–162, 255–263 — doppler
  `String()` blocks.
- `frontend/src/utils/calculations.ts` line 295 — `fmtBiometry(value)` =
  `value.toFixed(2)` — same pattern to apply for doppler.

---

## Sub-Task 4 — Propagate backend validation detail to the user

**Status:** [x] completed

### Intent

Fix D-4. When the backend returns a 400 with the `details.errors` string array,
surface those messages to the user rather than showing the generic "Validation
failed" string.

Two changes:
1. `extractMessage` (duplicated in `examinationService.ts` and `patientService.ts`)
   must also collect `details.errors` and append them to the returned string,
   separated by `\n• `.
2. `ExaminationForm.tsx` must render the full error detail in the `submitError`
   `InlineNotification` as a bullet list when more than one line is present.

### Expected Outcomes

- A 400 response from the server shows each Joi error message as a bulleted list in
  the red notification banner on the form.
- A 400 response with no `details.errors` (or empty array) continues to show the
  top-level message only — no regression.
- `patientService.ts` extraction is updated consistently so `PatientForm` benefits.

### Todo List

1. In `frontend/src/services/examinationService.ts`, update `extractMessage` (lines
   20–28) to also read `r?.data?.error?.details?.errors` (`string[] | undefined`)
   and append each item as `\n• ${item}` after the top-level message.
2. Apply the identical change to `frontend/src/services/patientService.ts` (lines
   4–12).
3. In `frontend/src/components/ExaminationForm.tsx`, update the `submitError`
   `InlineNotification` (lines 82–90): when `submitError` contains `\n`, split on
   `\n` and render as a `<ul>` with `<li>` items in the `subtitle` prop.

### Relevant Context

- `api/src/utils/responseHelpers.ts` lines 122–126 — `validationErrorResponse`
  returns `{ error: { message: "Validation failed", details: { errors: string[] } } }`.
- `frontend/src/components/ExaminationForm.tsx` lines 82–90 — `submitError`
  notification.

---

## VAL Deferred Step — Percentile field validation (execute after PCT ST-8)

**Status:** [ ] blocked on PCT ST-8

### Intent

PCT ST-8 makes the five percentile `TextInput` fields (`bpdPct`, `hcPct`, `acPct`,
`flPct`, `efwPct` and T2 equivalents) fully editable. Without this step a user who
types `"abc"` into `bpdPct` gets no inline field error — only the backend banner
from ST-4. This step closes that gap by adding a fourth validation helper and
appending percentile rows to both tables defined in ST-2 and ST-3.

### Todo List

1. In `frontend/src/utils/validators.ts`, add `validatePercentileField(raw, label)`:
   same `/^\d+(\.\d+)?$/` regex guard; `Math.trunc(parseFloat(raw))` must be in the
   range 1–99 inclusive. Returns an error string if invalid, `undefined` if empty
   or valid.
2. Append the 10 percentile rows to `VALIDATION_RULES` in `useExaminationForm.ts`:
   T1 rows use `errorKey: 't1_bpdPct'`, `formKey: 'bpdPct'`, `validate:
   validatePercentileField`; T2 rows add `onlyWhen: () => isTwins`.
3. Append the 10 percentile rows to `FIELD_REGISTRY` in `useExaminationForm.ts`:
   `outType: 'integer'`, `payloadPath: 'biometryPercentiles.bpd'` etc.; T2 rows
   add `onlyWhen: () => isTwins`.

---

---

## Additional Change — LA field migration to string type

**Status:** [x] completed

### Intent

The `la` biometry field changes from a numeric (float) type to a free-text string
across every layer of the application. This affects the backend schema, both type
definitions, the form input, the detail view, and the PDF. `lc` is **not** changing
and remains a float.

The change is minimal at each layer because `la` already flows through the same
pipeline as all other biometry fields — only the type annotation, format call, unit
suffix, and validation rule differ.

### Expected Outcomes

- The LA input in the form accepts any text, shows no inline error for non-numeric
  input, and has label `"LA"` with no placeholder (or a free-text placeholder).
- The detail view shows the LA label as `"LA"` (no `(mm)`) and displays the stored
  string value as-is, with no unit suffix.
- The PDF shows label `"LA"` and the stored string value as-is.
- The backend accepts any string value (or no value) for `la`; numeric strings remain
  valid.
- T2 `la` (`t2_la` / `biometry2.la`) follows the same change — it is treated
  identically to T1 `la` in all layers.

### Todo List

1. **Backend type** — In `api/src/types/index.ts`, change `la?: number` to
   `la?: string` in the `BiometryData` interface.
2. **Backend Joi schema** — In `api/src/utils/validation.ts` `biometrySchema`, change
   `la: Joi.number().min(0).max(100).optional()` to
   `la: Joi.string().max(500).optional().allow('')`. Remove the error message
   override (no longer meaningful).
3. **Frontend type** — In `frontend/src/types/index.ts`, change `la?: number` to
   `la?: string` in the `Biometry` interface (line 72).
4. **Form input** — In `frontend/src/components/sections/BiometrySection.tsx`
   line 186, change `labelText="LA (mm)"` to `labelText="LA"` and remove or update
   the `placeholder`. The field already stores and submits as a string via
   `formData.la`; no change to onChange/value wiring needed.
5. **Submit assembly** — In `FIELD_REGISTRY` (ST-3), the `la` and `t2_la` rows must
   use `outType: 'trim'` (not `'float'`). The assembler will `.trim()` the value and
   emit it as a string rather than calling `parseFloat`.
6. **View model — detail** — In `frontend/src/services/viewModelBuilders.ts` line 250,
   change `la: exam.biometry?.la != null ? \`${fmtBiometry(exam.biometry.la)} mm\` : undefined`
   to `la: exam.biometry?.la?.trim() || undefined` (plain string, no formatting).
   Apply the same change to line 149 for `biometry2.la`.
7. **Detail section label** — In `frontend/src/components/ExaminationSections.tsx`
   line 303, change `"LA (mm)"` to `"LA"`. On line 304, change
   `{fmtVal(bio?.la, 'mm')}` to `{bio?.la ?? '—'}` (display raw string or dash).
8. **PDF label** — In `frontend/src/components/reports/pdfSections.ts` line 273,
   change `{ label: 'LA (mm)', value: b.la }` to `{ label: 'LA', value: b.la }`.
   The value is already used as a plain string by the PDF renderer — no other change
   needed.

### Relevant Context

- `api/src/types/index.ts` — `BiometryData.la` at line 72 equivalent.
- `api/src/utils/validation.ts` lines 187–188 — `la` and `lc` Joi rules; only `la`
  changes.
- `frontend/src/types/index.ts` line 72 — `la?: number`.
- `frontend/src/components/sections/BiometrySection.tsx` line 186 — LA input.
- `frontend/src/services/viewModelBuilders.ts` lines 149, 250 — LA view model.
- `frontend/src/components/ExaminationSections.tsx` lines 303–304 — LA detail row.
- `frontend/src/components/reports/pdfSections.ts` line 273 — LA PDF row.
- `lc` is unchanged throughout — it remains a float with `validatePositiveFloat`,
  `outType: 'float'`, `fmtBiometry` formatting, and `(mm)` label everywhere.

---

## Dependency Order

```
ST-1  (validator helpers)
  ↓
ST-2  (validation rules table — uses helpers from ST-1)
ST-3  (submit assembly table — uses helpers from ST-1 for integer truncation)
ST-4  (backend error detail — fully independent, can run at any time)
Additional Change — LA migration (independent of all above, can run at any time)

PCT ST-8 must land before:
  VAL deferred step  (adds percentile rows to ST-2 and ST-3 tables)
```

ST-3 and ST-4 are independent of each other and can run in parallel after ST-1.
The LA migration (Additional Change) is fully independent — it touches no files
shared with ST-1 through ST-4 except `useExaminationForm.ts` (where it changes the
`la` / `t2_la` registry entries from `outType: 'float'` to `outType: 'trim'`). It
should therefore be applied **after ST-3** so the registry entries already exist.
The deferred step should run after ST-4 is live so backend percentile errors are
already surfaced during the window before frontend percentile validation is added.
