# Refactoring Implementation Plan

**Source document:** `docs2/refactoring-findings.md`
**Scope:** Full-stack refactoring — backend Azure Functions, shared types, frontend React app
**Goal:** Eliminate the technical debt identified in the findings document and implement the two-type / N-fetus UI redesign, without changing any API routes, medical calculation logic, or user-visible data.

---

## Overview

The refactoring is divided into ten sequential sub-tasks. Each sub-task is independently deployable and leaves the application in a working state. Sub-tasks ST-01 and ST-02 are backend-only and can be applied immediately. ST-03 through ST-09 implement the fetus array data model and the two-type redesign. ST-10 is the final directory restructuring.

**Key design decisions (from findings document §10 and §12):**
- Migration: single atomic deployment — migration script + code change ship together; no dual-write period
- Composite GA: computed on read by joining `fetuses.map(f => f.ga_from_biometry).join(' / ')` — no stored composite field
- Form handler: `handleFetusChange(index, section, field, value)` added alongside existing `handleChange` for entity-level fields
- `fetusSectionCount`: runtime form state — **not** in `EXAM_TYPE_CONFIG`; user selects it on the create form; locked on edit
- `examinationType`: two values only — `'prenatal'` and `'first_trimester'`; four legacy values migrated in ST-09
- Fetus count decrease on create: Option A — silent slice, no confirmation prompt
- Directory restructuring: last (ST-10); new files created during ST-03 onwards go directly into target paths

---

## ST-01 — Quick Fixes: KI-006, KI-007

- **Status:** [ ] pending

### Intent
Apply two high-value, low-risk fixes that are approved and independent of all other refactoring work. Label unification is deferred — the two-type redesign changes the label set entirely, so aligning old four-value labels now would require a second alignment pass in ST-06. Labels are addressed once, in ST-06, when the new two-value registry is written.

### Expected Outcomes
- Patient search operations are recorded in the audit log
- User creation succeeds for email addresses with non-public TLDs (e.g. `admin@hospital.internal`)

### Todo List
1. In `api/src/utils/validation.ts` — change `Joi.string().email()` to `Joi.string().email({ tlds: { allow: false } })` on the shared `emailField` definition (one line; fixes both `registerSchema` and `userSchema`)
2. In `api/src/functions/SearchPatients.ts` — add `await logAuditEvent(user.userId, 'PATIENT_SEARCH', { searchTerm: normalizedSearch, resultCount: patients.length })` (or equivalent `auditService` call) before the `return successResponse(...)` statement
3. Run `api` tests: `cd api && npm test` — all must pass

### Relevant Context
- `api/src/utils/validation.ts` — `emailField` at approximately line 43
- `api/src/functions/SearchPatients.ts` — audit call pattern mirrors `logExaminationCreated` in `api/src/utils/auditService.ts`
- `docs2/KNOWN-ISSUES.md` — KI-006, KI-007 for full context

---

## ST-02 — Storage Layer Improvements

- **Status:** [ ] pending

### Intent
Eliminate per-request `TableClient` allocation overhead, the `ensureTableExists` HTTP call on every request, and the O(N) partition scan in `UpdateExamination.ts`. These are independent of the data model change and improve performance immediately.

### Expected Outcomes
- `getTableClient(name)` returns a cached instance on repeat calls — no new SDK client allocated per entity operation
- `ensureTableExists(name)` issues at most one HTTP call per table name per Function host lifetime
- `UpdateExamination.ts` updates the primary entity with a direct point read (O(1)) instead of a partition scan
- `CreateExamination.ts` stores `primaryRowKey` on the lookup entity

### Todo List
1. In `api/src/utils/tableClient.ts`:
   - Add `const clientCache = new Map<string, TableClient>()` at module scope
   - In `getTableClient(tableName)`: check `clientCache` before creating; store and return cached instance
   - Add `const initializedTables = new Set<string>()` at module scope
   - In `ensureTableExists(tableName)`: return immediately if `initializedTables.has(tableName)`; after successful create or 409, add to set
2. In `api/src/functions/CreateExamination.ts`:
   - Add `primaryRowKey: \`${reverseTicks}_${examinationId}\`` to `lookupExamEntity` (the `EXAM` partition entity)
3. In `api/src/functions/UpdateExamination.ts`:
   - Replace the `for await (const ent of tableClient.listEntities(...))` loop with `await getEntity(EXAMINATIONS_TABLE, \`PATIENT_${existingExam.patientId}\`, existingExam.primaryRowKey)`
   - Handle the case where `existingExam.primaryRowKey` is absent (legacy records without the field) — fall back to the existing scan only in that case
4. In `api/src/types/index.ts` — add `primaryRowKey?: string` to the `Examination` interface
5. Run `api` tests — all must pass

### Relevant Context
- `api/src/utils/tableClient.ts` — `getTableServiceClient` already uses the singleton pattern; replicate it for `getTableClient`
- `api/src/functions/CreateExamination.ts` — `reverseTicks` and `examinationId` are already computed before entity construction
- `api/src/functions/UpdateExamination.ts` — the `for await` scan starts at approximately line 110; `existingExam` already holds `patientId`

---

## ST-03 — Backend Serializer Utilities and Request Type Definitions

- **Status:** [ ] pending

### Intent
Eliminate the copy-paste JSON serialization/deserialization blocks that appear across five backend files, and move the inline request-body interface definitions into the shared types module. This is preparatory work that ST-04 will build on.

### Expected Outcomes
- A single `deserializeExamination(raw)` utility parses all JSON string fields — used by all three GET functions
- A single `serializeExaminationFields(body)` utility stringifies all JSON fields — used by Create and Update
- `ExaminationCreateRequest` and `ExaminationUpdateRequest` interfaces exist in `api/src/types/index.ts` and are used by Create and Update functions
- No functional change — identical API behaviour before and after

### Todo List
1. Create `api/src/utils/examinationSerializer.ts` (new file — goes into `utils/` now; will move to `shared/storage/` in ST-10):
   - Export `deserializeExamination(raw: any): Examination` — parses `biometry`, `doppler`, `biometry2`, `doppler2`, and `data` from JSON strings if they are strings; returns an object with all fields deserialized
   - **Legacy read shim (pre-migration compatibility):** Inside `deserializeExamination`, after parsing `data`, call `normalizeFetusArray(data)` (imported from `api/src/utils/legacyExamAdapter.ts`) to populate `data.fetuses` when the entity was not yet migrated. `normalizeFetusArray` mirrors the frontend shim logic: if `data.fetuses` is already a non-empty array, return it as-is; otherwise synthesize `fetuses[0]` from top-level `biometry`/`doppler`/`gestationalAgeFromBiometry` and `fetuses[1]` (if `biometry2` exists) from `biometry2`/`doppler2`. Write `api/src/utils/legacyExamAdapter.ts` as a new file alongside the serializer. Both this file and its import are deleted in ST-09.
   - Export `serializeExaminationFields(fields: Partial<ExaminationCreateRequest>): Record<string, any>` — stringifies `biometry`, `doppler`, `biometry2`, `doppler2`, and `data` to JSON strings for storage; returns a flat record
2. In `api/src/types/index.ts`:
   - Add `ExaminationCreateRequest` interface (extracts fields from the current local `interface ExaminationCreateBody` in `CreateExamination.ts`)
   - Add `ExaminationUpdateRequest` interface (extracts fields from the current local `interface ExaminationBody` in `UpdateExamination.ts`)
3. In `api/src/functions/GetExamination.ts` — replace the inline JSON.parse block with `deserializeExamination(examination)`
4. In `api/src/functions/GetExaminations.ts` — replace the inline JSON.parse block inside the `for await` loop with `deserializeExamination(exam)`
5. In `api/src/functions/GetExaminationByMRN.ts` — replace the inline JSON.parse block with `deserializeExamination(examination)`
6. In `api/src/functions/CreateExamination.ts` — replace the inline `JSON.stringify` calls with `serializeExaminationFields(body)`; replace the local `interface ExaminationCreateBody` with an import of `ExaminationCreateRequest`
7. In `api/src/functions/UpdateExamination.ts` — same as step 6 for the Update path; replace local `interface ExaminationBody` with `ExaminationUpdateRequest`
8. Run `api` tests — all must pass

### Relevant Context
- The inline JSON.parse pattern appears in `GetExamination.ts`, `GetExaminations.ts`, `GetExaminationByMRN.ts` — each 6–8 lines with identical structure
- The `biometry2`/`doppler2` fields are conditionally serialized in Create/Update — `serializeExaminationFields` must preserve this conditionality
- `api/src/types/index.ts` is the single source of truth for backend types
- `api/src/utils/legacyExamAdapter.ts` — created in this sub-task; deleted in ST-09

---

## ST-04 — Data Model: Introduce Fetus Array in Types and Backend

- **Status:** [ ] pending

### Intent
Replace the promoted top-level `biometry`, `doppler`, `biometry2`, `doppler2`, `gestationalAgeFromBiometry`, `gestationalAgeFromBiometry2` fields on the `Examination` entity and interface with a generalized `fetuses: FetusSectionData[]` array inside the `ExaminationData` blob. Ship a migration script that converts all existing records atomically.

This is the largest single sub-task and the foundation for all frontend refactoring that follows.

### Expected Outcomes
- `Examination` interface no longer has `biometry`, `doppler`, `biometry2`, `doppler2`, `gestationalAgeFromBiometry`, `gestationalAgeFromBiometry2` at the top level
- `ExaminationData` has `fetuses: FetusSectionData[]` where index 0 = fetus 1, index 1 = fetus 2
- `FetusSectionData` holds `biometry`, `doppler`, `ultrasound_findings`, `anatomy`, `ga_from_biometry` and all first-trimester equivalents
- The `data.twin2_ultrasound_findings` and `data.twin2_anatomy` keys (currently separate top-level `data` properties) are moved into `data.fetuses[1].ultrasound_findings` and `data.fetuses[1].anatomy` respectively
- All first-trimester `data.ft_*` and `data.twin2_ft_*` keys are moved into `data.fetuses[0].ft_*` and `data.fetuses[1].ft_*`
- `CreateExamination.ts` and `UpdateExamination.ts` write only `data` (one JSON column); all other per-fetus serialization is removed
- All GET functions return the new structure
- A migration script reads every entity in the `EXAM` partition and rewrites it to the new shape; it is idempotent (re-runnable safely)
- All `api` tests pass against the new structure

### Todo List
1. In `api/src/types/index.ts`:
   - Add `FetusSectionData` interface with fields: `index: number`, `biometry?: BiometryData`, `doppler?: DopplerData`, `ultrasound_findings?: UltrasoundFindings`, `anatomy?: AnatomyFindings`, `ga_from_biometry?: string`, `ft_biometry?: FtBiometry`, `ft_markers?: FtMarkers`, `ft_ultrasound?: FtUltrasoundFindings`, `ft_anatomy?: AnatomyFindings`, `ft_doppler?: FtDoppler`
   - Update `ExaminationData`: add `fetuses: FetusSectionData[]`; remove `twin2_ultrasound_findings`, `twin2_anatomy`, `twin2_ft_biometry`, `twin2_ft_markers`, `twin2_ft_ultrasound`, `twin2_ft_anatomy`, `twin2_ft_doppler`
   - Update `Examination`: remove `biometry`, `doppler`, `biometry2`, `doppler2`, `gestationalAgeFromBiometry`, `gestationalAgeFromBiometry2`
   - Update `ExaminationCreateRequest` and `ExaminationUpdateRequest` to remove the same top-level fields; the `data` field now carries all fetus data
2. Update `api/src/utils/examinationSerializer.ts`:
   - `deserializeExamination`: remove `biometry`/`doppler`/`biometry2`/`doppler2` parsing; parse only `data` as JSON — the fetuses array is already inside
   - `serializeExaminationFields`: remove per-field JSON.stringify calls; the full `data` blob (which now includes fetuses) is stringified as one unit
3. Update `api/src/functions/CreateExamination.ts`:
   - Remove extraction and serialization of `biometry`, `doppler`, `biometry2`, `doppler2`, `gestationalAgeFromBiometry`, `gestationalAgeFromBiometry2` from request body
   - Entity construction writes only `data: JSON.stringify(body.data)` for all section data — the caller is responsible for placing fetus data inside `data.fetuses`
4. Update `api/src/functions/UpdateExamination.ts` — same removals as step 3
5. Update `api/src/utils/validation.ts`:
   - Remove `biometry2`/`doppler2`/`gestationalAgeFromBiometry2` from the top-level examination schema
   - Validate `data.fetuses` as an array of `FetusSectionData` objects (basic structure validation; Joi `.array().items(...)`)
6. Write `scripts/migrate-examination-data.ts` (new file):
   - Connects to Azure Table Storage using `AZURE_STORAGE_CONNECTION_STRING`
   - Iterates all entities in the `EXAM` partition of the `Examinations` table
   - **Pass 1 — fetus array migration:** for each entity where `biometry` top-level column exists and `data.fetuses` does not:
     - Parse `data` JSON string
     - Parse `biometry`, `doppler` JSON strings
     - Construct `fetuses[0]` from `biometry`, `doppler`, `gestationalAgeFromBiometry`, `data.ultrasound_findings`, `data.anatomy`, `data.ft_*`
     - Construct `fetuses[1]` (if `biometry2` exists) from `biometry2`, `doppler2`, `gestationalAgeFromBiometry2`, `data.twin2_ultrasound_findings`, `data.twin2_anatomy`, `data.twin2_ft_*`
     - Write updated `data` JSON back; clear legacy top-level columns
   - **Pass 2 — `examinationType` key migration:** for each entity, rewrite the `examinationType` column:
     - `'ultrasound_prenatal'` → `'prenatal'`
     - `'ultrasound_prenatal_twins'` → `'prenatal'`
     - `'ultrasound_first_trimester'` → `'first_trimester'`
     - `'ultrasound_first_trimester_twins'` → `'first_trimester'`
   - Both passes are idempotent (re-runnable safely)
   - Runs on both `EXAM` and `PATIENT_*` partition entities
   - Logs progress and errors; exits with non-zero code on any failure
7. Run the migration script against the local Azurite emulator with seeded test data; verify output
8. Run `api` tests — update test fixtures in `api/src/tests/` to use the new `data.fetuses` structure and new `examinationType` keys; all must pass

### Relevant Context
- `api/src/types/index.ts` — `ExaminationData` currently has `twin2_ultrasound_findings`, `twin2_anatomy`, and all `twin2_ft_*` as separate named properties; these all move into `fetuses[1]`
- `api/src/tests/integration/examinations.test.ts` — test fixtures use `biometry`, `biometry2` top-level fields; must be updated to `data.fetuses[0].biometry`, `data.fetuses[1].biometry`
- `api/src/utils/validation.ts` — the `examinationSchema` currently validates `biometry2`, `doppler2` at the top level
- `scripts/` directory already exists for project utility scripts

---

## ST-05 — Frontend Form State: Replace Flat t2_ Keys with Fetus Array

- **Status:** [ ] pending

### Intent
Replace the ~250 flat `t2_`-prefixed keys in `useExaminationForm.ts` `formData` with a structured `fetuses: FetusSectionFormData[]` array. Add `handleFetusChange(index, section, field, value)` for per-fetus updates and `handleFetusCountChange(n)` for live resizing of the fetus array. Update all section component prop signatures to accept a single data object.

`fetusSectionCount` is a separate `formData` field — not derived from the exam type config. On create it starts at 1; the user changes it via `handleFetusCountChange`. On edit it is initialized to `examination.data.fetuses.length` and treated as read-only by the form.

### Expected Outcomes
- `formData` has `fetusSectionCount: number` and `fetuses: FetusSectionFormData[]` instead of ~100 `t2_*` flat keys
- `handleFetusChange(index, section, field, value)` updates `formData.fetuses[index][section][field]`
- `handleFetusCountChange(n)` resizes `formData.fetuses` to length `n`; if `n` decreases, trailing entries are silently discarded (Option A)
- The existing `handleChange` remains for entity-level fields
- `useExaminationForm.ts` seeds `fetuses` from `exam.data?.fetuses` on edit load
- All reactive auto-calc `useEffect` hooks read from `formData.fetuses[i]` instead of flat keys
- The submit payload sets `data.fetuses` from `formData.fetuses`
- Section components accept a single typed `data` object prop — no change to rendered output

### Todo List
1. In `frontend/src/types/index.ts`:
   - Add `FetusSectionData` interface (mirrors backend ST-04 type)
   - Update `ExaminationData` to have `fetuses: FetusSectionData[]` and remove `twin2_*` named keys
   - Update `Examination` to remove `biometry`, `doppler`, `biometry2`, `doppler2`, `gestationalAgeFromBiometry`, `gestationalAgeFromBiometry2`
2. Define `FetusSectionFormData` interface — nested objects with `string` values for input binding
3. Write `buildFetusSectionFormData(data?: FetusSectionData): FetusSectionFormData` — maps stored number values to `.toFixed(2)` strings; returns empty-string defaults for absent fields
4. **Legacy read shim (pre-migration compatibility):** Write `normalizeFetusArray(examData: any): FetusSectionData[]` in a new file `frontend/src/utils/legacyExamAdapter.ts`:
   - If `examData.fetuses` is a non-empty array, return it as-is — post-migration path, no work needed
   - Otherwise, synthesize a `fetuses` array from the legacy top-level fields: construct `fetuses[0]` from `examData.biometry`, `examData.doppler`, `examData.gestationalAgeFromBiometry`, `examData.ultrasound_findings`, `examData.anatomy`, and all `examData.ft_*` keys; construct `fetuses[1]` (if `examData.biometry2` exists) from the corresponding `biometry2`, `doppler2`, `twin2_*` keys
   - This shim is used during the window between ST-05 code deploy and ST-09 migration script execution
   - The file is deleted in ST-09 once all records are confirmed migrated
5. In `useExaminationForm.ts`:
   - Seed `fetuses` via `normalizeFetusArray(examination?.data ?? {})` on edit load (uses shim from step 4)
   - Add `fetusSectionCount` to initial `formData` state: for create = `1`; for edit = `normalizeFetusArray(examination.data).length ?? 1`
   - Replace all `t2_*` flat keys with `fetuses: Array.from({ length: fetusSectionCount }, (_, i) => buildFetusSectionFormData(normalizedFetuses[i]))`
   - Add `handleFetusChange(index, section, field, value)`: immutably updates `formData.fetuses[index][section][field]`
   - Add `handleFetusCountChange(n)`: calls `setFormData(prev => ({ ...prev, fetusSectionCount: n, fetuses: Array.from({ length: n }, (_, i) => prev.fetuses[i] ?? buildFetusSectionFormData()) }))`; when `n` is less than current count, the array is sliced — no warning
   - Update biometry and FT auto-calc `useEffect` hooks to iterate `formData.fetuses` by index
   - In the submit handler: build `data.fetuses` by mapping `FetusSectionFormData` → `FetusSectionData` (parse float strings to numbers)
6. Update `BiometrySection`, `DopplerSection`, `UltrasoundFindingsSection`, `AnatomySection`, `FirstTrimesterSection` props — pass `fetus.biometry`, `fetus.doppler` etc. as the single `data` prop
7. Run `frontend` tests and `tsc -b` — all must pass

### Relevant Context
- `frontend/src/hooks/useExaminationForm.ts` — the `formData` `useState` initializer currently spans ~200 lines
- `frontend/src/components/sections/BiometrySection.tsx` — `BiometrySectionFormData` interface already exists; the issue is only in callers passing 27 individual props
- `frontend/src/hooks/useBiometryAutoCalc.ts` — `computeBiometryDerivedFields` takes a flat object; callers just need to pass `fetus.biometry` instead of extracting flat keys
- `frontend/src/utils/legacyExamAdapter.ts` — created in this sub-task; deleted in ST-09

---

## ST-06 — Frontend: Implement EXAM_TYPE_CONFIG and Two-Value Type Registry

- **Status:** [ ] pending

### Intent
Replace `SECTION_VISIBILITY` with `EXAM_TYPE_CONFIG` and simultaneously collapse the exam type registry from four keys to two: `'prenatal'` and `'first_trimester'`. `fetusSectionCount` is **not** in the config — it is runtime form state managed in ST-05. The config drives only which sections are shown and which trimester branch to use.

### Expected Outcomes
- `frontend/src/constants/examinationTypes.ts` exports exactly two exam types: `prenatal` and `first_trimester`
- `EXAM_TYPE_CONFIG` has two entries with `label`, `trimester: 'second' | 'first'`, and `sections: SectionKey[]` — no `fetusSectionCount`
- `getExamTypeConfig(type)` returns the config for a type key; falls back to `prenatal`
- `getExamTypeLabel(type)` returns `'Prenatal'` or `'First Trimester'`
- `SECTION_VISIBILITY`, `getSectionVisibility`, `isFirstTrimester`, `isFtTwins` are removed
- `api/src/constants/examinationTypes.ts` is updated to two keys: `prenatal` and `first_trimester` (with matching labels)
- `api/src/utils/validation.ts` allowlist updated to `['prenatal', 'first_trimester']`
- `api/src/functions/GetExaminations.ts` allowlist updated to match

### Todo List
1. Define `SectionKey` as: `'biometry' | 'doppler' | 'ultrasoundFindings' | 'anatomy' | 'firstTrimester'`
2. Define `ExamTypeConfig` interface: `{ label: string; trimester: 'second' | 'first'; sections: SectionKey[] }`
3. Write `EXAM_TYPE_CONFIG` with exactly two entries:
   - `prenatal`: `trimester: 'second'`, sections: `['biometry', 'doppler', 'ultrasoundFindings', 'anatomy']`, label: `'Prenatal'`
   - `first_trimester`: `trimester: 'first'`, sections: `['firstTrimester']`, label: `'First Trimester'`
4. Export `getExamTypeConfig(type: string | undefined): ExamTypeConfig` with fallback to `prenatal`
5. Export `getExamTypeLabel` derived from `EXAM_TYPE_CONFIG[type]?.label`
6. Remove `EXAM_TYPES` four-value array, `SECTION_VISIBILITY`, `getSectionVisibility`, `isFirstTrimester`, `isFtTwins`
7. Update `api/src/constants/examinationTypes.ts` to two entries with identical keys and labels
8. Update `api/src/utils/validation.ts` — change `EXAM_TYPE_KEYS` to `['prenatal', 'first_trimester']`
9. Update `api/src/functions/GetExaminations.ts` — same allowlist change
10. Update all frontend callers of removed exports: `useExaminationForm.ts`, `ExaminationForm.tsx`, `ExaminationDetailPage.tsx`, `ExaminationSections.tsx`, `ExaminationsPage.tsx`, `PatientDetailPage.tsx` — replace `isFirstTrimester` / `isFtTwins` / `getSectionVisibility` with `getExamTypeConfig` calls
11. Run `tsc -b`, `api` build, and all tests — all must pass

### Relevant Context
- `frontend/src/constants/examinationTypes.ts` — current source with four-value set
- `api/src/constants/examinationTypes.ts` — backend mirror; must match frontend keys exactly
- `api/src/functions/GetExaminations.ts` — `EXAM_TYPE_KEYS` used for allowlist validation on the filter parameter
- `docs2/refactoring-findings.md §12.3.3` — `EXAM_TYPE_CONFIG` design with `fetusSectionCount` removed

---

## ST-07 — Frontend: Config-Driven Form and Detail Page Rendering

- **Status:** [ ] pending

### Intent
Replace the `isTwins` / `isFt` / `isFtTwinsMode` conditional branch trees in `ExaminationForm.tsx` and `ExaminationDetailPage.tsx` with loops over `EXAM_TYPE_CONFIG[type].sections` and `formData.fetuses`. Implement the two-type UI: the create form shows an Exam Type selector (two options) and a Number of Fetuses input; both are locked read-only on edit. Fetus column headers generalize from "Twin 1/2" to "Fetus 1/2/…".

### Expected Outcomes
- `ExaminationForm.tsx` has no references to `isTwins`, `isFt`, `isFtTwinsMode`
- Create form: Exam Type dropdown (2 options) + Number of Fetuses input (Carbon `NumberInput`, min 1, default 1); both are displayed as locked `TextInput` on edit showing `getExamTypeLabel(type)` and `N fetus / fetuses`
- Section loop: `config.sections.map(sectionKey => formData.fetuses.map((fetus, i) => <SectionComponent ... />))` — one column when `fetusSectionCount === 1`; side-by-side grid when > 1
- Column headers read "Fetus 1", "Fetus 2", … (not "Twin 1/2"); shown only when `fetusSectionCount > 1`
- `ExaminationDetailPage.tsx` summary tile shows `"{examTypeLabel} — N fetus / fetuses"` (type + count composite)
- `ExaminationDetailPage.tsx` renders fetus sections by iterating `examination.data.fetuses`; no `isTwins` branches
- `ExaminationsPage.tsx` and `PatientDetailPage.tsx` filter dropdowns show two exam type options
- List type column shows `"Prenatal"` or `"First Trimester"` with optional fetus count suffix `"(×2)"` when `data.fetuses.length > 1`
- Breadcrumb and page title use the composite `examTypeLabel` + fetus count
- Two exam types render correctly; all existing records display correctly via backward-compatible fetus array read path

### Todo List
1. In `ExaminationForm.tsx` — replace the Exam Type + fetus count header row:
   - On create: `<Select>` with two options (`prenatal` / `first_trimester`) + Carbon `<NumberInput id="fetusSectionCount" min={1} max={9} value={formData.fetusSectionCount} onChange={handleFetusCountChange} />`
   - On edit: two locked `<TextInput>` fields showing type label and fetus count
2. Replace all `isTwins`, `isFt`, `isFtTwinsMode` references with `getExamTypeConfig(formData.examinationType)`
3. Replace the `{isTwins && (...)}` and `{!isTwins && !isFt && (...)}` blocks with a single config-driven loop:
   ```tsx
   {config.sections.map(sectionKey => (
     <div key={sectionKey} style={formData.fetusSectionCount > 1 ? twinsGridStyle : singleStyle}>
       {formData.fetuses.map((fetus, i) => renderFetusSection(sectionKey, i, fetus))}
     </div>
   ))}
   ```
4. Extract `renderFetusSection(sectionKey, i, fetus)` — dispatches to the appropriate section component; shows "Fetus {i+1}" header when `fetusSectionCount > 1`
5. In `ExaminationDetailPage.tsx`:
   - Remove `isTwins`, `isFt`, `isFtTwinsExam`; derive `config` from `getExamTypeConfig(examination.examinationType)`
   - Summary tile: show `"{examTypeLabel} — {N} fetus"` or `"{examTypeLabel} — {N} fetuses"` where `N = examination.data.fetuses.length`
   - Replace per-fetus section rendering with `examination.data?.fetuses?.map((fetus, i) => renderFetusDetail(fetus, i, config))`
6. In `ExaminationsPage.tsx` — update the "Filter by Type" dropdown to show two options from `Object.entries(EXAM_TYPE_CONFIG)`
7. In `PatientDetailPage.tsx` — same dropdown update
8. In `ExaminationsPage.tsx` list rows — update the type column to display `getExamTypeLabel(exam.examinationType)` with fetus count suffix computed from `exam.data?.fetuses?.length`
9. **Screen layout fix for N > 2 fetuses (§13.3):** Replace the fetus section wrapper style with:
   ```
   display: flex;
   flex-direction: row;
   flex-wrap: nowrap;      /* critical — prevents columns wrapping to the next line */
   gap: 1.5rem;
   overflow-x: auto;       /* horizontal scrollbar appears when columns exceed viewport */
   ```
   - `flex-wrap: nowrap` is mandatory — without it flex wraps to the next line and the scrollbar never appears
   - When `fetusSectionCount === 1`: container keeps existing `maxWidth: 1200px` — no behaviour change; `overflow-x` is effectively `visible` since no overflow can occur with one column
   - When `fetusSectionCount > 1`: container removes `maxWidth` cap so columns can extend past the viewport and trigger the scrollbar naturally
   - Each fetus column `<div>` uses `min-width: 480px; flex: 0 0 auto` — columns never shrink below minimum usable width; `flex: 0 0 auto` prevents flex from resizing columns
   - The outer page container in `CreateExaminationPage.tsx` / `EditExaminationPage.tsx` retains `maxWidth: 1200px; margin: 0 auto` — only the inner fetus section wrapper changes
10. Run `tsc -b` and frontend tests; manually verify both exam types and 1-, 2-, 3-fetus configurations render correctly

### Relevant Context
- `ExaminationForm.tsx` — `{isTwins && (...)}` block currently ~150 lines; single-fetus blocks ~100 lines
- `ExaminationDetailPage.tsx` — `isTwins` and `isFt` branches span the GA-from-Bio, Biometry, Doppler, Anatomy sections
- Section components already accept `prefix` and a single `data` object — no changes needed inside them
- Carbon `NumberInput` is available in `@carbon/react`

---

## ST-08 — Frontend: View Model and PDF Refactor

- **Status:** [ ] pending

### Intent
Update `ExamPdfViewModel`, `viewModelBuilders.ts`, `pdfDocument.ts`, and `pdfSections.ts` to use the `fetuses[]` array, replacing the current optional `biometry2`, `doppler2`, `ultrasound2`, `anatomy2`, and `twin2Ft*` fields.

### Expected Outcomes
- `ExamPdfViewModel` has `fetuses: FetusPdfViewModel[]` instead of optional `biometry2`, `doppler2`, `ultrasound2`, `anatomy2`, `twin2FtBiometry`, `twin2FtMarkers`, etc.
- `buildViewModel` in `viewModelBuilders.ts` maps `exam.data.fetuses` → `vm.fetuses`
- `pdfDocument.ts` iterates `vm.fetuses` to render fetus sections; no `isTwins` branches
- PDF output is functionally identical to current for all four exam types

### Todo List
1. Define `FetusPdfViewModel` interface in `frontend/src/services/print.service.ts` (or a co-located types file):
   - `index: number`, `biometry?: BiometryViewModel`, `doppler?: DopplerViewModel`, `ultrasound?: UltrasoundViewModel`, `anatomy?: AnatomyViewModel`, `gaFromBiometry?: string`, `ftBiometry?: FtBiometryViewModel`, `ftMarkers?: FtMarkersViewModel`, `ftUltrasound?: FtUltrasoundViewModel`, `ftAnatomy?: AnatomyViewModel`, `ftDoppler?: FtDopplerViewModel`
2. Update `ExamPdfViewModel` in `print.service.ts`:
   - Remove `biometry2`, `doppler2`, `ultrasound2`, `anatomy2`, `twin2FtBiometry`, `twin2FtMarkers`, `twin2FtUltrasound`, `twin2FtAnatomy`, `twin2FtDoppler`
   - Add `fetuses: FetusPdfViewModel[]`
3. Update `buildViewModel` in `frontend/src/services/viewModelBuilders.ts`:
   - **Legacy read shim:** Resolve the fetus array via `normalizeFetusArray(exam.data ?? {})` (same `legacyExamAdapter.ts` shim used in ST-05); map the result to `FetusPdfViewModel[]` — one entry per fetus. When `exam.data.fetuses` is already populated (post-migration), the shim is a no-op pass-through.
   - Remove the `isTwins` / `isFtTwins` conditional block that currently adds `biometry2`, `doppler2`, etc.
   - Compute `headerTitle` from type + fetus count (§13.5): `const n = vm.fetuses.length; const fetusLabel = n === 1 ? '' : \` (${n} fetuses)\``; combine with type label — no `isTwins` / `isFtTwins` branches
4. **PDF pair-loop refactor (§13.4):** Introduce `PairLayout` interface and helper functions in `pdfDocument.ts`:
   - `chunkFetuses(fetuses: FetusPdfViewModel[], pageSize = 2): FetusPdfViewModel[][]` — splits fetus array into pairs: `[F1,F2,F3]` → `[[F1,F2],[F3]]`
   - `computePairLayout(pairLength: 1 | 2): PairLayout` — returns `{ colW, xStart[], xEnd[] }`:
     - `pairLength = 1`: `colW = 182`, `xStart = [14]`
     - `pairLength = 2`: `colW = 88`, `xStart = [14, 108]` — identical geometry to current twin layout
   - Extract `drawCommonSections(doc, vm, pageIndex, totalPages): number` — draws header bar, patient block, pregnancy data; returns Y where clinical content starts
   - Extract `drawClinicalInformation(doc, vm, y): number` — draws findings, comments, notes block
   - Extract `drawSignatureLine(doc, y): void`
   - Extract `drawFooter(doc, pageIndex, totalPages): void` — prints `"Page N of M"` in the footer
   - Replace the current linear `buildExaminationPDF` body with a `for` loop over `pairs`: `if (pageIdx > 0) doc.addPage()`; call `drawCommonSections` on every page; call `renderClinicalSectionsPair` on every page; call `drawClinicalInformation` and `drawSignatureLine` on last page only; call `drawFooter` on every page
   - Remove hard-coded `TWIN_COL_W`, `T1_X`, `T2_X` constants — replaced by `computePairLayout` output
5. **`renderClinicalSections` signature change (§13.4.5):** In `pdfSections.ts`:
   - Rename to `renderClinicalSectionsPair(doc, vm, pair: FetusPdfViewModel[], layout: PairLayout, y, helpers, pageIndex, totalPages): number`
   - Remove `isTwins: boolean` parameter; remove internal `if (isTwins)` branch
   - Iterate `pair.length` — naturally handles 1-fetus and 2-fetus pairs
   - Remove `TWIN_COL_W`, `T1_X`, `T2_X` from the `PdfDrawHelpers` interface; add `layout: PairLayout`
6. Run `tsc -b`; generate PDFs for 1-, 2-, and 3-fetus prenatal cases and a 1-fetus first-trimester case; verify content and pagination are correct

### Relevant Context
- `frontend/src/services/print.service.ts` — `ExamPdfViewModel` currently has optional `biometry2`, `doppler2`, `ultrasound2`, `anatomy2` and `twin2Ft*` fields
- `frontend/src/services/viewModelBuilders.ts` — builds the view model from `Examination`; the twin branch is the primary target
- `frontend/src/components/reports/pdfDocument.ts` — currently branches on `isTwins`

---

## ST-09 — Migration Script Execution and Legacy Path Cleanup

- **Status:** [ ] pending

### Intent
Run the migration script (written in ST-04) against production data and verify all records are migrated. The script performs two passes: (1) move top-level biometry/doppler columns into `data.fetuses`; (2) rewrite `examinationType` from the four legacy values to the two new values. After the script completes, remove all remaining legacy column read/write paths.

### Expected Outcomes
- All examination entities have `data.fetuses` populated; no legacy top-level `biometry`/`doppler`/`biometry2`/`doppler2` columns remain
- All entities have `examinationType` of `'prenatal'` or `'first_trimester'`; no four-value legacy keys remain in storage
- No code reads or writes the legacy top-level fields or the legacy type keys
- `responseHelpers.ts` `request_id` uses `randomUUID()` alone
- All tests pass

### Todo List
1. Run `scripts/migrate-examination-data.ts` against a copy of production Table Storage; verify row counts, spot-check 5–10 records of each type, confirm `examinationType` values are rewritten
2. Run the script against production (or execute during deployment pipeline before the new code goes live)
3. **Delete legacy shim files:**
   - Delete `api/src/utils/legacyExamAdapter.ts`
   - Delete `frontend/src/utils/legacyExamAdapter.ts`
   - Remove the `normalizeFetusArray` import and call from `api/src/utils/examinationSerializer.ts` — replace with direct `data.fetuses` access (migration guarantees the field is always present)
   - Remove the `normalizeFetusArray` import and call from `frontend/src/services/viewModelBuilders.ts` — same direct access
   - Remove the `normalizeFetusArray` import and call from `frontend/src/hooks/useExaminationForm.ts` — same direct access
4. In `api/src/utils/examinationSerializer.ts` — remove any remaining fallback reads from legacy top-level columns (`biometry`, `doppler`, `biometry2`, `doppler2` at entity top level)
5. In `api/src/functions/CreateExamination.ts` and `UpdateExamination.ts` — remove any remaining legacy field handling
6. In `api/src/utils/validation.ts` — remove legacy top-level `biometry`/`doppler` field validation if still present
7. In `api/src/utils/responseHelpers.ts` — change `` `req_${Date.now()}_${randomUUID()}` `` to `` `req_${randomUUID()}` ``
8. Run full `api` test suite; run `tsc -b` on frontend — all must pass
9. Deploy

### Relevant Context
- `scripts/migrate-examination-data.ts` — created in ST-04; contains both migration passes
- `api/src/utils/legacyExamAdapter.ts` — backend shim created in ST-03; deleted here
- `frontend/src/utils/legacyExamAdapter.ts` — frontend shim created in ST-05; deleted here
- `api/src/utils/responseHelpers.ts` — `meta.request_id` construction, minor cleanup
- `docs2/refactoring-findings.md §12.5` — full migration mapping table for `examinationType` values

---

## ST-10 — Directory Restructuring

- **Status:** [ ] pending

### Intent
Move files to the target directory layout described in `docs2/refactoring-findings.md` §5. This is a pure rename — zero behaviour change. New files created during ST-03 to ST-09 that were already placed in target paths are excluded from the moves.

### Expected Outcomes
- `api/src/utils/` renamed to `api/src/shared/` with sub-directories `storage/`, `auth/`, `patients/`, `mrn/`, `audit/`, `validation/`, `http/`
- `api/src/functions/` reorganized into `auth/`, `patients/`, `examinations/`, `users/`, `audit/`, `system/` sub-directories
- `frontend/src/pages/` and domain-specific `frontend/src/components/` files moved into `frontend/src/features/{domain}/`
- `frontend/src/services/viewModelBuilders.ts` moved to `frontend/src/reports/viewModelBuilders.ts`
- `frontend/src/services/print.service.ts` renamed to `frontend/src/services/printService.ts`
- `frontend/src/components/reports/` contents moved to `frontend/src/reports/`
- All import paths updated throughout; `tsc -b` and all tests pass
- No functional change

### Todo List
1. Use `git mv` for all file moves to preserve git history
2. Backend moves (update all import paths after each batch):
   - Move `api/src/utils/*.ts` to appropriate `api/src/shared/{domain}/` sub-directories
   - Move `api/src/functions/*.ts` files into domain sub-directories
3. Frontend moves:
   - Move `frontend/src/pages/*.tsx` to `frontend/src/features/{domain}/`
   - Move `frontend/src/components/ExaminationForm.tsx`, `PatientForm.tsx` to their feature directories
   - Move `frontend/src/components/reports/` to `frontend/src/reports/`
   - Move `frontend/src/services/viewModelBuilders.ts` to `frontend/src/reports/`
   - Rename `print.service.ts` → `printService.ts`
4. Update all import paths — use a project-wide search-and-replace tool or TypeScript path alias update
5. Run `cd api && npm test` — all must pass
6. Run `tsc -b` in `frontend/` — all must pass
7. Run the full application locally via `swa start` and smoke-test all four exam types

### Relevant Context
- `docs2/refactoring-findings.md` §5 — full proposed target structure
- All files must compile cleanly — no path aliases exist currently; imports are relative
- `api/tsconfig.json` uses `rootDir: "."` — restructuring must not move files outside the TypeScript root

---

## Validation Gates

After each sub-task, before marking it done:

| Check | Command |
|-------|---------|
| Backend TypeScript compilation | `cd api && npm run build` |
| Backend unit + integration tests | `cd api && npm test` |
| Frontend TypeScript compilation | `cd frontend && npx tsc -b` |
| Frontend unit tests | `cd frontend && npm test` |
| Local SWA smoke test | `swa start` — navigate all four exam type create/edit/view/PDF flows |
