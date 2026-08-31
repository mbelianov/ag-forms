# Refactoring Implementation Plan

**Source document:** `docs2/refactoring-findings.md`
**Scope:** Full-stack refactoring — backend Azure Functions, shared types, frontend React app
**Goal:** Eliminate the technical debt identified in the findings document and implement the two-type / N-fetus UI redesign, without changing any API routes, medical calculation logic, or user-visible data.

---

## Overview

The refactoring is divided into ten sequential sub-tasks. Each sub-task is independently deployable and leaves the application in a working state. Sub-tasks ST-01 and ST-02 are backend-only and can be applied immediately. ST-03 through ST-09 implement the Observable fetus array data model and the two-type redesign. ST-10 is the final directory restructuring.

**Key design decisions (from findings document §10, §12, and §14):**
- **Observable data model (§14):** biometry and doppler measurements are stored as `Observable[]` arrays — `{ type, value, percentile?, ga? }` — not flat named objects. `IsManual` flags live on the sub-object they guard. `BiometryData`, `DopplerData`, `FtBiometry`, `FtDoppler` types are removed.
- **Unified sections (§14.3):** `ft_` prefix abolished. Both exam types use the same `biometry`, `doppler`, `anatomy`, `ultrasoundFindings` section keys. The `type` field in each observable distinguishes `crl` (FT) from `bpd` (prenatal). `markers` is a plain object used only for FT soft markers.
- **`EXAM_TYPE_CONFIG` carries `biometryTypes` list (§12.3.3):** the config declares which observable `type` values appear in the `biometry` array for each exam type — not a `sections` array of section keys.
- Migration: single atomic deployment — migration script + code change ship together; no dual-write period
- Composite GA per fetus: `fetuses[i].gaFromBiometry` — `{ value, isManual? }` object; no stored composite across fetuses
- Form handler: `handleFetusChange(index, section, type, field, value)` added alongside existing `handleChange` for entity-level fields
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
   - **Legacy read shim (pre-migration compatibility):** Inside `deserializeExamination`, after parsing `data`, call `normalizeFetusArray(data)` (imported from `api/src/utils/legacyExamAdapter.ts`) to populate `data.fetuses` when the entity was not yet migrated. `normalizeFetusArray`: if `data.fetuses` is already a non-empty array with Observable entries, return as-is; otherwise synthesize `fetuses[0]` from legacy top-level `biometry`/`doppler` flat objects (converting each named field to an `Observable` entry), `ultrasound_findings`, `anatomy`, and `ft_*` keys; synthesize `fetuses[1]` similarly from `biometry2`/`doppler2`/`twin2_*` if present. Write `api/src/utils/legacyExamAdapter.ts` as a new file alongside the serializer. Both this file and its import are deleted in ST-09.
   - Export `serializeExaminationFields(fields: Partial<ExaminationCreateRequest>): Record<string, any>` — stringifies `data` to a JSON string for storage (the `data` blob now contains the full `fetuses` Observable array); returns a flat record with only `data` key
2. In `api/src/types/index.ts`:
   - Add `Observable`, `GaFromBiometry`, `FetusSectionData`, `ExaminationData` interfaces (per §14.2)
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
- After the Observable model, only `data` is serialized — `biometry`/`doppler`/`biometry2`/`doppler2` top-level columns are legacy; `serializeExaminationFields` no longer handles them
- `api/src/types/index.ts` is the single source of truth for backend types
- `api/src/utils/legacyExamAdapter.ts` — created in this sub-task; deleted in ST-09
- `docs2/refactoring-findings.md §14` — Observable type definitions and encoding rules

---

## ST-04 — Data Model: Introduce Fetus Array in Types and Backend

- **Status:** [ ] pending

### Intent
Replace the promoted top-level `biometry`, `doppler`, `biometry2`, `doppler2`, `gestationalAgeFromBiometry`, `gestationalAgeFromBiometry2` fields on the `Examination` entity and interface with a `fetuses: FetusSectionData[]` array inside the `ExaminationData` blob, where each fetus's measurements are stored as `Observable[]` arrays. All `ft_*` and `twin2_*` data keys are absorbed into the fetus array. Ship a migration script that converts all existing records atomically.

This is the largest single sub-task and the foundation for all frontend refactoring that follows.

### Expected Outcomes
- `Examination` interface no longer has `biometry`, `doppler`, `biometry2`, `doppler2`, `gestationalAgeFromBiometry`, `gestationalAgeFromBiometry2` at the top level
- `ExaminationData` has `fetuses: FetusSectionData[]` where index 0 = fetus 1, index 1 = fetus 2
- `FetusSectionData` holds `gaFromBiometry?: GaFromBiometry`, `biometry?: Observable[]`, `doppler?: Observable[]`, `ultrasoundFindings?`, `anatomy?`, `markers?` — no `ft_` prefix anywhere
- All `data.twin2_*` and `data.ft_*` keys (currently top-level `data` properties) are absorbed into `fetuses[i]`
- `BiometryData`, `DopplerData`, `FtBiometry`, `FtDoppler`, `FtMarkers`, `FtUltrasoundFindings` types are **removed** from `api/src/types/index.ts`
- `CreateExamination.ts` and `UpdateExamination.ts` write only `data` (one JSON column); all other per-fetus serialization is removed
- All GET functions return the new structure
- A migration script reads every entity in the `EXAM` partition and rewrites it to the Observable shape; it is idempotent (re-runnable safely)
- All `api` tests pass against the new structure

### Todo List
1. In `api/src/types/index.ts`:
   - Add `Observable`, `GaFromBiometry`, `FetusSectionData`, updated `ExaminationData` interfaces (per `docs2/refactoring-findings.md §14.2`)
   - Remove `BiometryData`, `DopplerData`, `FtBiometry`, `FtDoppler`, `FtMarkers`, `FtUltrasoundFindings` — replaced by `Observable`
   - Remove all remaining `twin2_*` and `ft_*` keys from `ExaminationData`
   - Update `Examination`: remove `biometry`, `doppler`, `biometry2`, `doppler2`, `gestationalAgeFromBiometry`, `gestationalAgeFromBiometry2`
   - Update `ExaminationCreateRequest` and `ExaminationUpdateRequest` to remove the same top-level fields; the `data` field now carries all fetus Observable data
2. Update `api/src/utils/examinationSerializer.ts`:
   - `deserializeExamination`: remove `biometry`/`doppler`/`biometry2`/`doppler2` parsing; parse only `data` as JSON
   - `serializeExaminationFields`: remove per-field JSON.stringify; stringify only `data` as one unit
3. Update `api/src/functions/CreateExamination.ts`:
   - Remove extraction and serialization of all legacy named biometry/doppler fields from request body
   - Entity construction writes only `data: JSON.stringify(body.data)`
4. Update `api/src/functions/UpdateExamination.ts` — same removals as step 3
5. Update `api/src/utils/validation.ts`:
   - Remove `biometry2`/`doppler2`/`gestationalAgeFromBiometry2` from the top-level examination schema
   - Validate `data.fetuses` as an array (basic structure validation; Joi `.array().items(Joi.object())`)
6. Write `scripts/migrate-examination-data.ts` (new file):
   - Connects to Azure Table Storage using `AZURE_STORAGE_CONNECTION_STRING`
   - Iterates all entities in the `EXAM` partition of the `Examinations` table
   - **Pass 1 — Observable migration:** for each entity where `biometry` top-level column exists and `data.fetuses[0].biometry` is not already an Observable array:
     - Parse `biometry`, `doppler` JSON strings (flat named objects)
     - Convert each named field to an `Observable` entry using the type-set table in `docs2/refactoring-findings.md §14.3`
     - Construct `fetuses[0].biometry` as `Observable[]` from prenatal or FT measurements; `fetuses[0].doppler` as `Observable[]`; move `data.ultrasound_findings` → `fetuses[0].ultrasoundFindings`; `data.anatomy` → `fetuses[0].anatomy`; `data.ft_markers` → `fetuses[0].markers`
     - Construct `fetuses[0].gaFromBiometry` from legacy `gestationalAgeFromBiometry` if present
     - If `biometry2` exists: construct `fetuses[1]` symmetrically from `biometry2`/`doppler2`/`twin2_*`
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
8. Run `api` tests — update test fixtures in `api/src/tests/` to use Observable `data.fetuses` structure and new `examinationType` keys; all must pass

### Relevant Context
- `api/src/types/index.ts` — `ExaminationData` currently has `twin2_*` and `ft_*` as separate named properties; all move into `fetuses[i]`
- `api/src/tests/integration/examinations.test.ts` — test fixtures use `biometry`/`biometry2` flat objects; must be updated to `data.fetuses[0].biometry` Observable arrays
- `api/src/utils/validation.ts` — the `examinationSchema` currently validates `biometry2`/`doppler2` at the top level
- `scripts/` directory already exists for project utility scripts
- `docs2/refactoring-findings.md §14.3` — definitive type-set tables for prenatal and FT observables

---

## ST-05 — Frontend Form State: Replace Flat t2_ Keys with Fetus Array

- **Status:** [ ] pending

### Intent
Replace the ~250 flat `t2_`/`ft_`/`twin2_`-prefixed keys in `useExaminationForm.ts` `formData` with a structured `fetuses: FetusSectionFormData[]` array where biometry and doppler are `ObservableFormData[]` arrays. Add `handleFetusChange(index, section, type, field, value)` for per-observable updates and `handleFetusCountChange(n)` for live resizing of the fetus array. Replace `BiometrySection` and `FirstTrimesterSection` with a generic `ObservableSection` component driven by `EXAM_TYPE_CONFIG.biometryTypes`.

`fetusSectionCount` is a separate `formData` field — not derived from the exam type config. On create it starts at 1; the user changes it via `handleFetusCountChange`. On edit it is initialized to `examination.data.fetuses.length` and treated as read-only by the form.

### Expected Outcomes
- `formData` has `fetusSectionCount: number` and `fetuses: FetusSectionFormData[]` instead of ~250 flat keys
- `FetusSectionFormData` contains `biometry: ObservableFormData[]`, `doppler: ObservableFormData[]`, `ultrasoundFindings`, `anatomy`, `markers` — no `ft_` prefix; identical shape for both exam types
- `ObservableFormData` has `{ type, value: string, isManual?, percentile: string, percentileIsManual: boolean, ga: string, gaIsManual: boolean }`
- `handleFetusChange(index, section, type, field, value)` immutably updates the matching observable in `formData.fetuses[index][section]`
- `handleFetusCountChange(n)` resizes `formData.fetuses` to length `n`; if `n` decreases, trailing entries are silently discarded (Option A)
- The existing `handleChange` remains for entity-level fields
- Auto-calc `useEffect` loops over `formData.fetuses[i].biometry` observables; reads `type` to select the correct calc function; writes derived `percentile`, `ga` back via `handleFetusChange`
- `BiometrySection` component is replaced by `ObservableSection` — renders rows from `ObservableFormData[]`; `FirstTrimesterSection` is removed
- The submit payload maps `ObservableFormData[]` → `Observable[]` via `buildSubmitPayload`, omitting empty entries

### Todo List
1. In `frontend/src/types/index.ts`:
   - Add `Observable`, `GaFromBiometry`, `FetusSectionData`, `ObservableFormData`, `FetusSectionFormData`, updated `ExaminationData` interfaces (mirrors backend ST-04 types; per `docs2/refactoring-findings.md §14.2` and §14.6)
   - Remove `Biometry`, `Doppler`, `FtBiometry`, `FtDoppler`, `FtMarkers`, `FtUltrasoundFindings` types
   - Update `Examination` to remove `biometry`, `doppler`, `biometry2`, `doppler2`, `gestationalAgeFromBiometry`, `gestationalAgeFromBiometry2`
2. Write `buildFetusSectionFormData(storedFetus: FetusSectionData | undefined, examinationType: string): FetusSectionFormData`:
   - Looks up `EXAM_TYPE_CONFIG[examinationType].biometryTypes` for the ordered type list
   - For each type: finds the matching `Observable` in `storedFetus.biometry` (if any) and converts to `ObservableFormData`; empty-string defaults for absent fields
3. Write `buildSubmitPayload(formFetus: FetusSectionFormData): FetusSectionData`:
   - Converts `ObservableFormData[]` → `Observable[]`, parsing floats, omitting entries where `value === ''`, writing `isManual: true` only when the boolean flag is `true`
4. **Legacy read shim (pre-migration compatibility):** Write `normalizeFetusArray(examData: any, examinationType: string): FetusSectionData[]` in a new file `frontend/src/utils/legacyExamAdapter.ts`:
   - If `examData.fetuses` is a non-empty array whose `fetuses[0].biometry` contains `Observable` objects (i.e. has `{ type, value }` shape), return as-is
   - Otherwise, synthesize from legacy flat `examData.biometry`, `examData.doppler`, `gestationalAgeFromBiometry`, `ultrasound_findings`, `anatomy`, `ft_biometry`, `ft_markers`, etc. — converting each named field to the appropriate `Observable` entry; repeat for fetus 1 using `biometry2`/`twin2_*` keys
   - Deleted in ST-09 once all records are confirmed migrated
5. In `useExaminationForm.ts`:
   - Seed `fetuses` via `normalizeFetusArray(examination?.data ?? {}, examinationType)` on edit load
   - Add `fetusSectionCount` to initial `formData` state: for create = `1`; for edit = `normalizedFetuses.length ?? 1`
   - Replace all `t2_*`/`ft_*/`biometry`/`doppler` flat keys with `fetuses` array of `FetusSectionFormData`
   - Add `handleFetusChange(index, section, type, field, value)`: finds the observable with matching `type` in `formData.fetuses[index][section]`, updates the specified `field` (`'value'`, `'percentile'`, `'ga'`, etc.)
   - Add `handleFetusCountChange(n)`: resizes `formData.fetuses`; slices silently if `n` decreases
   - Replace the biometry auto-calc `useEffect` hooks with a single loop over `formData.fetuses[i].biometry` observables — reads `type` to dispatch to the correct calc function; writes results back via `setFormData`
   - Replace the FT CRL auto-calc `useEffect` with the same loop — when `type === 'crl'` and `gaIsManual` is false, call `calcGAFromCRL` and write `ga.value`
   - In the submit handler: call `buildSubmitPayload(formFetus)` per fetus to assemble `data.fetuses`
6. Write `ObservableSection` component in `frontend/src/components/sections/ObservableSection.tsx`:
   - Props: `{ observables: ObservableFormData[], config: ObservableSectionConfig, errors, onChange, isSubmitting }`
   - `ObservableSectionConfig` from `EXAM_TYPE_CONFIG`: ordered `type` list + per-type label, unit, and capability flags (`hasPercentile`, `hasGa`, `hasAutoCalc`)
   - Renders one 3-column row per observable: measurement input | percentile input (if `hasPercentile`) | GA input (if `hasGa`)
   - Replaces `BiometrySection`, `DopplerSection` (for observable types), and `FirstTrimesterSection`
7. Remove `frontend/src/components/sections/BiometrySection.tsx` and `FirstTrimesterSection.tsx`; update `ExaminationForm.tsx` and `ExaminationDetailPage.tsx` to use `ObservableSection`
8. Run `frontend` tests and `tsc -b` — all must pass

### Relevant Context
- `frontend/src/hooks/useExaminationForm.ts` — the `formData` `useState` initializer currently spans ~200 lines; the `useBiometryAutoCalc.ts` hook processes flat keys
- `frontend/src/hooks/useBiometryAutoCalc.ts` — `computeBiometryDerivedFields` takes a flat `BiometryAutoCalcInput` object; this is replaced by a type-dispatched loop over observables in ST-05
- `frontend/src/utils/legacyExamAdapter.ts` — created in this sub-task; deleted in ST-09
- `docs2/refactoring-findings.md §14.3` — Observable type sets and formula capability table
- `docs2/refactoring-findings.md §14.6` — `ObservableFormData` ↔ `Observable` mapping rules

---

## ST-06 — Frontend: Implement EXAM_TYPE_CONFIG and Two-Value Type Registry

- **Status:** [ ] pending

### Intent
Replace `SECTION_VISIBILITY` with `EXAM_TYPE_CONFIG` and simultaneously collapse the exam type registry from four keys to two: `'prenatal'` and `'first_trimester'`. `EXAM_TYPE_CONFIG` carries `biometryTypes` and `dopplerTypes` lists (the Observable `type` strings active for each exam type) and a `trimester` flag. The `sections` array and `SectionKey` union are not needed — both exam types render the same four section blocks; only the observable `type` values differ. `fetusSectionCount` is **not** in the config — it is runtime form state managed in ST-05.

### Expected Outcomes
- `frontend/src/constants/examinationTypes.ts` exports exactly two exam types: `prenatal` and `first_trimester`
- `EXAM_TYPE_CONFIG` has two entries with `label`, `trimester: 'second' | 'first'`, `biometryTypes: string[]`, `dopplerTypes: string[]` — no `fetusSectionCount`, no `sections` array
- `getExamTypeConfig(type)` returns the config for a type key; falls back to `prenatal`
- `getExamTypeLabel(type)` returns `'Prenatal'` or `'First Trimester'`
- `SECTION_VISIBILITY`, `getSectionVisibility`, `isFirstTrimester`, `isFtTwins`, `SectionKey` are removed
- `api/src/constants/examinationTypes.ts` is updated to two keys: `prenatal` and `first_trimester` (with matching labels)
- `api/src/utils/validation.ts` allowlist updated to `['prenatal', 'first_trimester']`
- `api/src/functions/GetExaminations.ts` allowlist updated to match

### Todo List
1. Define `ExamTypeConfig` interface: `{ label: string; trimester: 'second' | 'first'; biometryTypes: string[]; dopplerTypes: string[] }`
2. Write `EXAM_TYPE_CONFIG` with exactly two entries (per `docs2/refactoring-findings.md §12.3.3` and §14.3):
   - `prenatal`: `trimester: 'second'`, `biometryTypes: ['bpd','ofd','hc','ac','fl','efw','tcd','tad','apad','cm','nuchalFold','nb','la','lc','vp']`, `dopplerTypes: ['pi','ri','utADexPI','utADexRI','utASinPI','utASinRI','cma','psv','cpr','ducVen']`, label: `'Prenatal'`
   - `first_trimester`: `trimester: 'first'`, `biometryTypes: ['crl','nt','nb','puls']`, `dopplerTypes: ['utADexPI','utADexRI','utASinPI','utASinRI']`, label: `'First Trimester'`
3. Export `getExamTypeConfig(type: string | undefined): ExamTypeConfig` with fallback to `prenatal`
4. Export `getExamTypeLabel` derived from `EXAM_TYPE_CONFIG[type]?.label`
5. Export `OBSERVABLE_META: Record<string, { label: string; unit: string; hasPercentile: boolean; hasGa: boolean; hasAutoCalc: boolean }>` — per-type display metadata used by `ObservableSection` (ST-05) and the PDF renderer (ST-08)
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
- `docs2/refactoring-findings.md §12.3.3` — updated `EXAM_TYPE_CONFIG` design with `biometryTypes` list
- `docs2/refactoring-findings.md §14.3` — Observable type sets and formula capability table (source for `biometryTypes` values)

---

## ST-07 — Frontend: Config-Driven Form and Detail Page Rendering

- **Status:** [ ] pending

### Intent
Replace the `isTwins` / `isFt` / `isFtTwinsMode` conditional branch trees in `ExaminationForm.tsx` and `ExaminationDetailPage.tsx` with loops over `formData.fetuses` and `ObservableSection`. Implement the two-type UI: the create form shows an Exam Type selector (two options) and a Number of Fetuses input; both are locked read-only on edit. Fetus column headers generalize from "Twin 1/2" to "Fetus 1/2/…". The only remaining conditional is `config.trimester === 'first'` to decide whether to render the `markers` block.

### Expected Outcomes
- `ExaminationForm.tsx` has no references to `isTwins`, `isFt`, `isFtTwinsMode`, `firstTrimester` section key
- Create form: Exam Type dropdown (2 options) + Carbon `NumberInput` for fetus count (min 1, default 1); both locked read-only on edit
- Each fetus column renders: `ObservableSection` for biometry, `ObservableSection` for doppler, `UltrasoundFindingsSection`, `AnatomySection`, and (if `config.trimester === 'first'`) a `MarkersSection`
- Column headers read "Fetus 1", "Fetus 2", … (not "Twin 1/2"); shown only when `fetusSectionCount > 1`
- `ExaminationDetailPage.tsx` summary tile shows `"{examTypeLabel} — N fetus / fetuses"` (type + count composite)
- `ExaminationDetailPage.tsx` renders fetus sections by iterating `examination.data.fetuses` observables; no `isTwins` or `isFt` branches
- `ExaminationsPage.tsx` and `PatientDetailPage.tsx` filter dropdowns show two exam type options
- List type column shows `"Prenatal"` or `"First Trimester"` with optional fetus count suffix `"(×2)"` when `data.fetuses.length > 1`
- Breadcrumb and page title use the composite `examTypeLabel` + fetus count
- Two exam types render correctly; all existing records display correctly via the Observable legacy shim

### Todo List
1. In `ExaminationForm.tsx` — replace the Exam Type + fetus count header row:
   - On create: `<Select>` with two options (`prenatal` / `first_trimester`) + Carbon `<NumberInput id="fetusSectionCount" min={1} max={9} value={formData.fetusSectionCount} onChange={handleFetusCountChange} />`
   - On edit: two locked `<TextInput>` fields showing type label and fetus count
2. Replace all `isTwins`, `isFt`, `isFtTwinsMode` references with `config = getExamTypeConfig(formData.examinationType)`
3. Replace the `{isTwins && (...)}` and `{!isTwins && !isFt && (...)}` blocks with a single fetus loop:
   ```tsx
   {formData.fetuses.map((fetus, i) => (
     <div key={i} style={formData.fetusSectionCount > 1 ? fetusColumnStyle : singleStyle}>
       {fetusSectionCount > 1 && <h4>Fetus {i + 1}</h4>}
       <ObservableSection observables={fetus.biometry} config={config} section="biometry" ... />
       <ObservableSection observables={fetus.doppler} config={config} section="doppler" ... />
       <UltrasoundFindingsSection data={fetus.ultrasoundFindings} ... />
       <AnatomySection data={fetus.anatomy} ... />
       {config.trimester === 'first' && <MarkersSection data={fetus.markers} ... />}
     </div>
   ))}
   ```
4. In `ExaminationDetailPage.tsx`:
   - Remove `isTwins`, `isFt`, `isFtTwinsExam`; derive `config` from `getExamTypeConfig(examination.examinationType)`
   - Summary tile: show `"{examTypeLabel} — {N} fetus"` or `"{examTypeLabel} — {N} fetuses"` where `N = examination.data.fetuses.length`
   - Replace per-fetus section rendering with `examination.data?.fetuses?.map((fetus, i) => renderFetusDetail(fetus, i, config))`; `renderFetusDetail` iterates `fetus.biometry` observables using `OBSERVABLE_META` for labels/units
5. In `ExaminationsPage.tsx` — update the "Filter by Type" dropdown to show two options from `Object.entries(EXAM_TYPE_CONFIG)`
6. In `PatientDetailPage.tsx` — same dropdown update
7. In `ExaminationsPage.tsx` list rows — update the type column to display `getExamTypeLabel(exam.examinationType)` with fetus count suffix computed from `exam.data?.fetuses?.length`
8. **Screen layout fix for N > 2 fetuses (§13.3):** Replace the fetus section wrapper style with flex + `overflow-x: auto` + `min-width: 480px` per column (full spec in `docs2/refactoring-findings.md §13.3`)
9. Run `tsc -b` and frontend tests; manually verify both exam types and 1-, 2-, 3-fetus configurations render correctly

### Relevant Context
- `ExaminationForm.tsx` — `{isTwins && (...)}` block currently ~150 lines; single-fetus blocks ~100 lines
- `ExaminationDetailPage.tsx` — `isTwins` and `isFt` branches span the GA-from-Bio, Biometry, Doppler, Anatomy sections
- `ObservableSection` — created in ST-05; `OBSERVABLE_META` — exported in ST-06
- Carbon `NumberInput` is available in `@carbon/react`

---

## ST-08 — Frontend: View Model and PDF Refactor

- **Status:** [ ] pending

### Intent
Update `ExamPdfViewModel`, `viewModelBuilders.ts`, `pdfDocument.ts`, and `pdfSections.ts` to use the Observable fetus array, replacing the current optional `biometry2`, `doppler2`, `ultrasound2`, `anatomy2`, and `twin2Ft*` / `ftBiometry` etc. fields. The PDF renders measurement rows by iterating `fetus.biometry` observables and looking up labels/units from `OBSERVABLE_META` — no `isTwins` or `isFt` branches.

### Expected Outcomes
- `ExamPdfViewModel` has `fetuses: FetusPdfViewModel[]` — no `ft*` or `twin2*` optional fields
- `FetusPdfViewModel` has `biometry?: ObservablePdfEntry[]`, `doppler?: ObservablePdfEntry[]`, `ultrasound?`, `anatomy?`, `markers?`, `gaFromBiometry?` — identical shape for both exam types
- `buildViewModel` in `viewModelBuilders.ts` maps `exam.data.fetuses` → `vm.fetuses` by converting each `Observable` to `ObservablePdfEntry` (stripping `isManual` flags)
- `pdfDocument.ts` iterates `vm.fetuses` with no `isTwins` or `isFt` branches; renders `markers` block only when `vm.examinationType === 'first_trimester'`
- PDF output is functionally identical to current for all four exam types
- Multi-fetus pair pagination implemented per `docs2/refactoring-findings.md §13.4`

### Todo List
1. Define `ObservablePdfEntry` and `FetusPdfViewModel` interfaces (per `docs2/refactoring-findings.md §3.6`):
   - `ObservablePdfEntry`: `{ type: string; value: number | string; percentile?: number; ga?: string }`
   - `FetusPdfViewModel`: `{ index: number; gaFromBiometry?: string; biometry?: ObservablePdfEntry[]; doppler?: ObservablePdfEntry[]; ultrasound?: Record<string, string | number>; anatomy?: Record<string, string>; markers?: Record<string, string> }`
2. Update `ExamPdfViewModel` in `print.service.ts`:
   - Remove all `biometry2`, `doppler2`, `ultrasound2`, `anatomy2`, `twin2Ft*`, `ftBiometry`, `ftMarkers`, etc. optional fields
   - Add `fetuses: FetusPdfViewModel[]`
3. Update `buildViewModel` in `frontend/src/services/viewModelBuilders.ts`:
   - **Legacy read shim:** Resolve via `normalizeFetusArray(exam.data ?? {}, exam.examinationType)` (same shim from ST-05); map the result to `FetusPdfViewModel[]` by converting each `Observable` to `ObservablePdfEntry`. When `exam.data.fetuses` is already the Observable shape (post-migration), the shim is a no-op.
   - Remove the `isTwins` / `isFtTwins` conditional block
   - Compute `headerTitle` from type + fetus count (§13.5): `const n = vm.fetuses.length; const fetusLabel = n === 1 ? '' : \` (${n} fetuses)\``; combine with type label
4. **PDF pair-loop refactor (§13.4):** Introduce `PairLayout` and helper functions in `pdfDocument.ts` (full spec in `docs2/refactoring-findings.md §13.4`):
   - `chunkFetuses`, `computePairLayout`, `drawCommonSections`, `drawClinicalInformation`, `drawSignatureLine`, `drawFooter`
   - Replace linear `buildExaminationPDF` body with pair-loop
   - Remove hard-coded `TWIN_COL_W`, `T1_X`, `T2_X` constants
5. **`renderClinicalSections` refactor (§13.4.5 + Observable):** In `pdfSections.ts`:
   - Rename to `renderClinicalSectionsPair(doc, vm, pair: FetusPdfViewModel[], layout: PairLayout, y, helpers): number`
   - Remove `isTwins: boolean`; remove `if (isTwins)` branch
   - Render biometry rows by iterating `fetus.biometry` observables; look up label and unit from `OBSERVABLE_META[obs.type]` (imported from `examinationTypes.ts`)
   - Render `markers` block only when `vm.examinationType === 'first_trimester'`
   - Remove `TWIN_COL_W`, `T1_X`, `T2_X` from `PdfDrawHelpers`; add `layout: PairLayout`
6. Run `tsc -b`; generate PDFs for 1-, 2-, and 3-fetus prenatal cases and a 1-fetus first-trimester case; verify content and pagination are correct

### Relevant Context
- `frontend/src/services/print.service.ts` — `ExamPdfViewModel` currently has optional `biometry2`, `doppler2`, `ultrasound2`, `anatomy2` and `twin2Ft*` / `ft*` fields
- `frontend/src/services/viewModelBuilders.ts` — builds the view model from `Examination`; twin and FT branches are the primary targets
- `frontend/src/components/reports/pdfDocument.ts` — currently branches on `isTwins`
- `OBSERVABLE_META` — exported from `examinationTypes.ts` in ST-06; provides label, unit, and capability flags per type
- `docs2/refactoring-findings.md §13.4` — full PDF pair-loop spec
- `docs2/refactoring-findings.md §3.6` — `ObservablePdfEntry` / `FetusPdfViewModel` type definitions

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
