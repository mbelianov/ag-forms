# Percentiles Persistence Plan

Resolves **KI-009** — biometry percentile fields are ephemeral, not persisted, and not editable.

## Overview

Biometry percentiles (BPD, HC, AC, FL, EFW) for prenatal ultrasound examinations must be:
1. Editable by the user (manual entry from an external tool, or auto-calculated).
2. Saved to the backend and restored when the form is reopened.
3. Displayed on the detail view and included in the PDF from the stored value, not recomputed on every load.

The change spans three layers: API storage + validation, frontend types + form state, and the detail/PDF rendering pipeline. First Trimester exam types are not in scope — they have no biometry percentile concept.

**Storage approach:** two new JSON-string columns — `biometryPercentiles` and `biometryPercentiles2` — on the `Examinations` Azure Table Storage row, following the same serialization/deserialization pattern already used for `biometry` / `biometry2`.

---

## GA from Biometry — Relationship and Scope

Before implementation begins: **`gestationalAgeFromBiometry` is already fully handled and requires no changes.**

A full trace was performed to confirm this:

| Concern | Status |
|---------|--------|
| Stored as top-level column on the Examination row | ✅ Already — separate from the `biometry` JSON blob |
| Seeded in `formData` on edit load (initial `useState`) | ✅ Already — `useExaminationForm.ts` line 73 |
| Seeded in `formData` on edit load (`useEffect` re-seed) | ✅ Already — `useExaminationForm.ts` line 247 |
| Editable `TextInput` in `BiometrySection` | ✅ Already — full `onChange` wiring, no `readOnly` |
| Auto-populated by "Biometry / EFW" button via `onChange` | ✅ Already — `BiometrySection.tsx` line 68 |
| Included in submit payload | ✅ Already — `useExaminationForm.ts` line 813 |
| Displayed on detail page from stored field | ✅ Already — `ExaminationDetailPage.tsx` lines 347–348 |
| Used in PDF from stored field | ✅ Already — `viewModelBuilders.ts` line 213 |

The only connection to this plan is **ST-7**: when the 10 new percentile fields are added to the `useEffect` re-seed block in `useExaminationForm.ts`, they slot in alongside `gestationalAgeFromBiometry` which is already there. No separate work is needed for GA from Bio.

Twin 2 GA from Biometry (`t2_gestationalAgeFromBiometry` / `gestationalAgeFromBiometry2`) is equally complete and unaffected.

---

## Sub-Tasks

---

### ST-1 · API types — add `BiometryPercentileData` and extend `Examination`

**Intent:** Define the storage-side type and add it as two optional fields on the `Examination` entity so downstream API functions can reference it with full type safety.

**Expected Outcomes:**
- `BiometryPercentileData` interface exists in `api/src/types/index.ts`.
- `Examination` in `api/src/types/index.ts` has `biometryPercentiles?: BiometryPercentileData` and `biometryPercentiles2?: BiometryPercentileData`.
- TypeScript compilation of the API project passes without errors.

**Todo List:**
1. Add `BiometryPercentileData` interface to `api/src/types/index.ts` with five optional integer fields: `bpd`, `hc`, `ac`, `fl`, `efw` (all `number`, representing 1–99 percentile values).
2. Add `biometryPercentiles?: BiometryPercentileData` and `biometryPercentiles2?: BiometryPercentileData` to the `Examination` interface in the same file, adjacent to the existing `biometry` / `biometry2` fields.

**Relevant Context:**
- `api/src/types/index.ts` — `BiometryData` (line 165) and `Examination` (line 207) are the reference shapes.
- `biometry2` and `doppler2` are the established pattern for Twin-2 sibling fields.

**Status:** [ ] pending

---

### ST-2 · API validation — add `biometryPercentilesSchema`

**Intent:** Validate that client-supplied percentile values are integers in the range 1–99. Invalid values (e.g. 0, 100, floats, strings) must be rejected at the boundary.

**Expected Outcomes:**
- A new `biometryPercentilesSchema` Joi object exists in `api/src/utils/validation.ts`.
- `examinationSchema` references `biometryPercentiles` and `biometryPercentiles2` using this schema.
- Submitting a value outside 1–99 for any percentile field returns HTTP 400 with an informative message.

**Todo List:**
1. In `api/src/utils/validation.ts`, define `biometryPercentilesSchema` as a Joi object with five keys (`bpd`, `hc`, `ac`, `fl`, `efw`), each `Joi.number().integer().min(1).max(99).optional()`.
2. Add `biometryPercentiles: biometryPercentilesSchema` and `biometryPercentiles2: biometryPercentilesSchema` to `examinationSchema`, adjacent to the existing `biometry` / `biometry2` entries (around line 367).

**Relevant Context:**
- `api/src/utils/validation.ts` — `biometrySchema` (line 151) is the reference pattern; `examinationSchema` is around line 340.

**Status:** [ ] pending

---

### ST-3 · `CreateExamination` — accept, serialize, and store percentiles

**Intent:** Allow percentile data to be included in the examination create payload and persisted to both entity rows in Azure Table Storage.

**Expected Outcomes:**
- `POST /v1/examinations` accepts `biometryPercentiles` and `biometryPercentiles2` in the request body.
- Both values are serialized to JSON strings and written to `primaryExamEntity` and `lookupExamEntity`.
- A create request without percentiles is unaffected (fields remain absent on the row).

**Todo List:**
1. Add `biometryPercentiles?: any` and `biometryPercentiles2?: any` to the `ExaminationCreateBody` interface inside `createExamination`.
2. Destructure `biometryPercentiles` and `biometryPercentiles2` from the parsed body.
3. Serialize: `const biometryPercentilesStr = biometryPercentiles ? JSON.stringify(biometryPercentiles) : undefined;` (and same for `biometryPercentiles2`).
4. Set `biometryPercentiles: biometryPercentilesStr as any` and `biometryPercentiles2: biometryPercentiles2Str as any` on both `primaryExamEntity` and `lookupExamEntity`, adjacent to the existing `biometry2` field assignment.

**Relevant Context:**
- `api/src/functions/CreateExamination.ts` — lines 101–107 show the existing serialization block; lines 110–171 show the two entity construction blocks.
- Follow the exact same `JSON.stringify` guard pattern used for `biometry`, `biometry2`, `doppler`, `data`.

**Status:** [ ] pending

---

### ST-4 · `UpdateExamination` — accept, serialize, sync, and track percentiles

**Intent:** Allow percentile data to be updated on an existing examination and kept in sync across both entity rows (lookup and primary).

**Expected Outcomes:**
- `PUT /v1/examinations/{id}` accepts `biometryPercentiles` and `biometryPercentiles2` in the request body.
- Both values are serialized and written to `updatedLookupEntity` and synced to `updatedPrimaryEntity`.
- Changed percentile fields appear in `changedFields` for audit logging.
- Validation is applied using the merged (existing + incoming) value, consistent with other fields.

**Todo List:**
1. Add `biometryPercentiles?: any` and `biometryPercentiles2?: any` to the `ExaminationBody` interface inside `updateExamination`.
2. Destructure both from the parsed body.
3. Add to `updateData` when defined: `if (biometryPercentiles !== undefined) updateData.biometryPercentiles = biometryPercentiles;` (and same for `biometryPercentiles2`).
4. Add to `validationData` using the merge pattern: `biometryPercentiles: biometryPercentiles !== undefined ? biometryPercentiles : existingExam.biometryPercentiles`.
5. In the `updatedLookupEntity` field-assignment block, serialize and assign both fields with `changedFields.push(...)` — follow the same pattern as `biometry2` (lines 173–176).
6. In the `updatedPrimaryEntity` construction block, include `biometryPercentiles: updatedLookupEntity.biometryPercentiles` and `biometryPercentiles2: updatedLookupEntity.biometryPercentiles2`.

**Relevant Context:**
- `api/src/functions/UpdateExamination.ts` — `biometry2` handling spans lines 173–176 (serialize+assign) and line 239 (primary entity sync). Follow this pattern exactly.

**Status:** [ ] pending

---

### ST-5 · `GetExamination` — deserialize percentiles on read

**Intent:** Ensure that when an examination is fetched, the `biometryPercentiles` and `biometryPercentiles2` JSON strings stored in Azure Table Storage are parsed back into objects before being returned to the client.

**Expected Outcomes:**
- `GET /v1/examinations/{id}` returns `biometryPercentiles` and `biometryPercentiles2` as plain objects (not JSON strings) when they are present.
- When the fields are absent on the stored row, they are absent in the response (no null injection).

**Todo List:**
1. In `api/src/functions/GetExamination.ts`, inside the `deserializedExamination` block (lines 43–61), add two new entries following the identical `JSON.parse` guard pattern used for `biometry` / `biometry2`:
   ```
   biometryPercentiles:  parse if string, else pass through
   biometryPercentiles2: parse if string, else pass through
   ```

**Relevant Context:**
- `api/src/functions/GetExamination.ts` — lines 43–61 contain the full deserialization block.
- `biometry2` deserialization (lines 55–57) is the direct reference pattern.
- `GetExaminations.ts` (list endpoint) does **not** need this change — list view is explicitly out of scope.

**Status:** [ ] pending

---

### ST-6 · Frontend types — add `BiometryPercentileData` and extend request/response types

**Intent:** Mirror the API type additions on the frontend so that `examination.biometryPercentiles` is typesafe throughout the frontend codebase, and the create/update request types can carry percentile payloads.

**Expected Outcomes:**
- `BiometryPercentileData` interface exists in `frontend/src/types/index.ts`.
- `Examination`, `CreateExaminationRequest`, and `UpdateExaminationRequest` all have `biometryPercentiles?` and `biometryPercentiles2?` fields typed as `BiometryPercentileData`.
- No TypeScript errors in the frontend project.

**Todo List:**
1. Add `export interface BiometryPercentileData { bpd?: number; hc?: number; ac?: number; fl?: number; efw?: number; }` to `frontend/src/types/index.ts`, adjacent to the `Biometry` interface (around line 55).
2. Add `biometryPercentiles?: BiometryPercentileData` and `biometryPercentiles2?: BiometryPercentileData` to the `Examination` interface (around line 185).
3. Add the same two fields to `CreateExaminationRequest` (around line 215) and `UpdateExaminationRequest` (around line 230).

**Relevant Context:**
- `frontend/src/types/index.ts` — `Biometry` is at line 55, `Examination` at line 175, requests at lines 203 and 222.
- The existing `BiometryPercentiles` type in `frontend/src/utils/calculations.ts` (`bpd/hc/ac/fl` only) is the **computation result type** and is not changed. `BiometryPercentileData` in `types/index.ts` is the **storage type** (adds `efw`, all fields optional).

**Status:** [ ] pending

---

### ST-7 · `useExaminationForm` — add percentile fields to `formData` and submit payload

**Intent:** Lift percentile state from the component into the shared form state so values persist across re-renders, are seeded from the stored examination on edit load, and are included in the create/update payload on submit.

**Expected Outcomes:**
- `formData` has 10 new string fields: `bpdPct`, `hcPct`, `acPct`, `flPct`, `efwPct` (fetus 1) and `t2_bpdPct`, `t2_hcPct`, `t2_acPct`, `t2_flPct`, `t2_efwPct` (twin 2).
- On edit load, these fields are seeded from `examination.biometryPercentiles` and `examination.biometryPercentiles2`.
- On submit, `biometryPercentiles` and `biometryPercentiles2` objects are built from these fields (parse to integer, omit fields that are empty or NaN) and included in the request payload.

**Todo List:**
1. In the `formData` `useState` initializer, add the 10 percentile string fields, each seeded from `examination?.biometryPercentiles?.{field}?.toString() ?? ''`.
2. In the `useEffect` that re-seeds `formData` when `examination` changes (edit-mode re-load), add the same 10 fields with the same seed expressions.
3. In the submit handler's payload construction, build `biometryPercentiles` as `{ bpd: parseInt(formData.bpdPct), ... }` filtering out `NaN` / empty values. Do the same for `biometryPercentiles2` (only include when `isTwins`). Add both to the outgoing `CreateExaminationRequest` / `UpdateExaminationRequest`.

**Relevant Context:**
- `frontend/src/hooks/useExaminationForm.ts` — `formData` initializer starts at line 49; the edit-mode re-seed `useEffect` is further down; the submit handler assembles the request payload.
- Follow the same `examination?.biometry?.bpd != null ? examination.biometry.bpd.toFixed(2) : ''` seeding pattern used for biometry fields (lines 56–70), but using `.toString()` since percentiles are integers.

**Status:** [ ] pending

---

### ST-8 · `BiometrySection` — make percentile inputs controlled and editable

**Intent:** Remove the local ephemeral percentile state and replace it with controlled inputs bound to the parent `formData`. The auto-calculate button must write through `onChange` rather than `setPercentiles`. All five percentile fields become read/write.

**Expected Outcomes:**
- `BiometrySection` has no `useState` for percentiles — they are props via `data`.
- `BiometrySectionFormData` includes `bpdPct`, `hcPct`, `acPct`, `flPct`, `efwPct` string fields.
- All five percentile `TextInput` elements are fully editable (no `readOnly`), fire `onChange(p('bpdPct'), value)` etc.
- Clicking **"Biometry / EFW"** still auto-computes percentiles, but now calls `onChange` for each percentile field rather than `setPercentiles` — the same mechanism already used for `gestationalAgeFromBiometry` and `efw`.
- The EFW `onChange` handler that previously called `setEfwPercentile(undefined)` is removed (the field is now a plain controlled input).

**Todo List:**
1. Add `bpdPct: string; hcPct: string; acPct: string; flPct: string; efwPct: string;` to the `BiometrySectionFormData` interface.
2. Remove `const [percentiles, setPercentiles] = useState(...)` and `const [efwPercentile, setEfwPercentile] = useState(...)`.
3. In `handleCalcBiometryEFW`, replace `setPercentiles(pct)` with individual `onChange(p('bpdPct'), pct?.bpd?.toString() ?? '')` calls for each of the four biometry percentiles; replace `setEfwPercentile(ep)` with `onChange(p('efwPct'), ep?.toString() ?? '')`.
4. Update each percentile `TextInput`: remove `readOnly` / `tabIndex={-1}`, bind `value` to `data.bpdPct` (etc.), add `onChange` handler firing `onChange(p('bpdPct'), e.target.value)` (etc.).
5. Remove the `setEfwPercentile(undefined)` call from the EFW measurement input's `onChange` handler.
6. Remove the `pctText` helper (no longer needed).

**Relevant Context:**
- `frontend/src/components/sections/BiometrySection.tsx` — full file reviewed; all changes are within this single file.
- The pattern to follow for how auto-calc writes through `onChange` is already established for `gestationalAgeFromBiometry` (line 68) and `efw` (lines 72–76).

**Status:** [ ] pending

---

### ST-9 · `ExaminationForm` — pass percentile fields to `BiometrySection`

**Intent:** Connect the new `formData` percentile fields to the `BiometrySection` `data` prop so both the single-fetus and twins `BiometrySection` instances receive and emit percentile values.

**Expected Outcomes:**
- Single-fetus `BiometrySection` (prefix `"t1"`) receives `bpdPct: formData.bpdPct` etc. in its `data` prop.
- Twin-2 `BiometrySection` (prefix `"t2"`) receives `bpdPct: formData.t2_bpdPct` etc. in its `data` prop.
- No changes to the component's `onChange` wiring — `handleChangeT1` already maps `t1_*` prefixed fields; `handleChange` already handles `t2_*` fields.

**Todo List:**
1. In the single-fetus `BiometrySection` call (around line 316), add `bpdPct: formData.bpdPct, hcPct: formData.hcPct, acPct: formData.acPct, flPct: formData.flPct, efwPct: formData.efwPct` to the `data` prop object.
2. In the twin-2 `BiometrySection` call (around line 484), add `bpdPct: formData.t2_bpdPct, hcPct: formData.t2_hcPct, acPct: formData.t2_acPct, flPct: formData.t2_flPct, efwPct: formData.t2_efwPct` to the `data` prop object.

**Relevant Context:**
- `frontend/src/components/ExaminationForm.tsx` — single-fetus `BiometrySection` at line 316; twins `BiometrySection` instances at lines 467 and 484.
- The `handleChangeT1` and `handleChange` delegation in `useExaminationForm` already strips the `t1_` / `t2_` prefix when updating `formData` — no changes needed there.

**Status:** [ ] pending

---

### ST-10 · `ExaminationDetailPage` — read stored percentiles instead of recomputing

**Intent:** Remove the four client-side percentile computation calls and replace them with direct reads from the stored `examination.biometryPercentiles` / `examination.biometryPercentiles2` fields. No backward compatibility shim is needed.

**Expected Outcomes:**
- `calcBiometryPercentiles` and `calcEFWPercentile` are no longer called in `ExaminationDetailPage.tsx`.
- `biometryPercentiles`, `efwPercentile`, `biometryPercentiles2`, `efwPercentile2` are read directly from the examination object.
- The `ExaminationSections` prop call is unchanged — it still receives the same four props.
- Unused imports (`calcBiometryPercentiles`, `calcEFWPercentile`) are removed from the file.

**Todo List:**
1. Replace the `calcBiometryPercentiles(...)` call (lines 157–163) with `const biometryPercentiles = examination.biometryPercentiles;`.
2. Replace the `calcEFWPercentile(...)` call (lines 164–166) with `const efwPercentile = examination.biometryPercentiles?.efw;`.
3. Replace the twins `calcBiometryPercentiles(...)` call (lines 177–183) with `const biometryPercentiles2 = examination.biometryPercentiles2;`.
4. Replace the twins `calcEFWPercentile(...)` call (lines 184–186) with `const efwPercentile2 = examination.biometryPercentiles2?.efw;`.
5. Remove `calcBiometryPercentiles` and `calcEFWPercentile` from the import on line 18 if no longer used elsewhere in the file.

**Relevant Context:**
- `frontend/src/pages/ExaminationDetailPage.tsx` — computed percentile block is lines 157–186.
- `ExaminationSections` accepts `biometryPercentiles: BiometryPercentiles | undefined` — the stored `BiometryPercentileData` is structurally compatible (same `bpd/hc/ac/fl` shape; `efw` is handled separately via the `efwPercentile` prop).

**Status:** [ ] pending

---

### ST-11 · `viewModelBuilders` — read stored percentiles instead of recomputing (PDF)

**Intent:** The PDF view model currently recomputes percentiles from raw measurements. Replace those computations with reads from the stored fields so the PDF reflects the clinician-entered (or auto-calculated and saved) values rather than a fresh computation that ignores any manual overrides.

**Expected Outcomes:**
- `calcBiometryPercentiles` and `calcEFWPercentile` are no longer called in `viewModelBuilders.ts`.
- `bpdPct`, `hcPct`, `acPct`, `flPct`, `efwPct` in the PDF view model are sourced from `exam.biometryPercentiles` / `exam.biometryPercentiles2`.
- Unused imports are removed.
- PDF output is unchanged in appearance; only the data source changes.

**Todo List:**
1. Remove the `percentiles = calcBiometryPercentiles(...)` block (lines 46–52) and `efwPct = calcEFWPercentile(...)` block (lines 54–57).
2. Replace `pctStr(percentiles?.bpd)` etc. in the `biometry` view model object (lines 237–241) with `pctStr(exam.biometryPercentiles?.bpd)` etc.; replace `pctStr(efwPct)` with `pctStr(exam.biometryPercentiles?.efw)`.
3. Remove the twin-2 `percentiles2 = calcBiometryPercentiles(...)` block (lines 122–125) and `efwPct2` block (lines 126–128). Replace the corresponding `pctStr(percentiles2?.*)` calls (lines 136–140) with `pctStr(exam.biometryPercentiles2?.*)`.
4. Remove `calcBiometryPercentiles` and `calcEFWPercentile` from the import on line 8 if unused.

**Relevant Context:**
- `frontend/src/services/viewModelBuilders.ts` — full file reviewed; twin-2 block is lines 121–151, fetus-1 biometry block is lines 231–252.
- `pctStr()` helper (line 36) is unchanged — it still formats `number | undefined` to `"N %-ile" | undefined`.

**Status:** [ ] pending

---

## Implementation Order

ST-1 → ST-2 → ST-3 → ST-4 → ST-5 (backend complete)
ST-6 → ST-7 → ST-8 → ST-9 (frontend form complete)
ST-10 → ST-11 (frontend read path complete)

Backend sub-tasks (ST-1 through ST-5) must be completed before frontend sub-tasks that depend on the stored field (ST-10, ST-11). Frontend form sub-tasks (ST-6 through ST-9) are independent of the backend and can be worked in parallel.
