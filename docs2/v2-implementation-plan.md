# V2 Implementation Plan — Prenatal Ultrasound Application

**Based on:** `docs2/refactoring-findings.md` (all sections including §12, §13, §14, §15)  
**Scope:** Full-stack refactoring sprint — data model, architecture, UI, PDF, migration  
**Structure:** Phase 1 (Greenfield Development) → Phase 2 (Migration Procedures)

> **Layout ruling:** §13.3 is authoritative for the N > 2 fetus screen layout (horizontal-scroll flex). The tabs pattern shown in §15.5.3 is disregarded.
>
> **Label indicator ruling:** `AutoCalcDot` and `autoCalcLabel` are **fully replaced** across both the form and the detail page by the `autoSuffix` text-suffix pattern. The replacement applies in two contexts:
> - **Form inputs (`ObservableRow`):** suffix appended to the field *label* — `"BPD GA (Hadlock)"`, `"BPD GA (manual)"`, etc.
> - **Detail page value cells (`ExaminationSections`, `ExaminationDetailPage`):** suffix appended to the rendered *value* — `"28w 2d (Hadlock)"`, `"28w 2d (manual)"`, etc.
>
> In both contexts: `(manual)` is rendered in yellow `#f1c21b` via a `<span>` wrapper; `(Hadlock)` / `(auto)` / `(Robinson)` are rendered in normal text colour. Footnote rows that previously displayed *"● Value manually entered"* are removed — the suffix in the cell/label is self-explanatory. `autoSuffix` is extracted as a shared utility in `AutoCalcHelpers.tsx`, replacing `autoCalcLabel`. `AutoCalcDot` remains in the codebase but is no longer called anywhere in the form or detail page.
>
> **PDF dagger ruling:** `withManualMarker()` and the ` †` dagger character on manual values in `viewModelBuilders.ts` are **fully preserved**. The dagger footnote legend (`\n† Value manually entered`) is **always statically appended** to the PDF notes string alongside the biometric citations, without conditionally scanning `isManual` flags across fetuses.

---

## Top-Level Overview

The application currently stores fetus data in flat, positionally-named columns (`biometry`, `biometry2`, `doppler`, `doppler2`, etc.) and a parallel `data` blob with `ft_` and `twin2_` prefixed keys. This creates ~250 flat `formData` keys, per-type branching throughout the codebase, and a 4-value exam type enum that encodes both type and fetus count.

This sprint replaces that with:
1. A **fetus array** (`data.fetuses[]`) where fetus count is structural, not an enum variant
2. An **Observable measurement model** where each measurement, its percentile, and its per-measurement GA are co-located
3. A **2-value `examinationType`** enum (`prenatal`, `first_trimester`); fetus count becomes runtime state
4. **`EXAM_TYPE_CONFIG`** as the single config-driven registry replacing `SECTION_VISIBILITY` and all `isFt/isTwins` branches
5. A **declarative calculation registry** (`OBSERVABLE_CALC_REGISTRY`) driving reactive auto-calculations
6. A **PDF pair-loop layout** supporting N fetuses with 2 columns per printed page

---

## Existing Functionality Inventory (Must Not Regress)

The following exist in the codebase and are **not mentioned** in `refactoring-findings.md` as changed. They must be fully preserved:

| Feature | Location | Preservation requirement |
|---------|----------|--------------------------|
| User management (CRUD, roles, active/inactive) | `UsersPage`, `CreateUserPage`, `EditUserPage`, API `users/` | Zero changes; all user flows must continue working |
| Audit log viewing (admin-only, paginated) | `AuditLogPage`, `GetAuditLogs.ts` | Zero changes to the audit log UI or API |
| Dashboard (patient count, exam count tiles) | `DashboardPage`, counter table integration | Counts continue to work; no counter logic change |
| Patient management (create, edit, delete, search, list) | All `Patient*` pages, API `patients/` | Zero changes beyond KI-006 audit fix in ST-01 |
| Authentication (login, logout, change password, session) | `LoginPage`, `ChangePasswordPage`, auth API | Zero changes |
| Examination list, filter, pagination | `ExaminationsPage` | Filter dropdown changes from 4 to 2 types in ST-06; all other list behaviour preserved |
| Soft delete (examinations and patients) | All delete handlers | Preserved; no hard delete introduced |
| MRN generation and lookup | `mrnGenerator.ts`, `GetExaminationByMRN.ts` | No change to MRN format or generation logic |
| Optimistic concurrency (ETag) | `UpdateExamination.ts`, frontend services | Preserved; ETag still required for updates |
| Percentile colour-coding in `PercentileInput` | `PercentileInput.tsx` | Preserved; `ObservableRow` must use `PercentileInput` for percentile inputs |
| Auto-calc dot visual indicator | `AutoCalcDot.tsx`, `AutoCalcHelpers.tsx` | **Fully superseded** across form inputs and the detail page. `AutoCalcDot` is no longer called from `ObservableRow`, `ExaminationSections`, or `ExaminationDetailPage`. `autoCalcLabel` is replaced by a new shared `autoSuffix` utility in `AutoCalcHelpers.tsx`. The `(manual)` suffix renders in yellow `#f1c21b`; `(Hadlock)` / `(auto)` in normal colour. All footnote legend rows (*"● Value manually entered"*) are removed. |
| Biometric citations in PDF notes | `viewModelBuilders.ts` `PRENATAL_BIOMETRY_CITATIONS` / `FT_BIOMETRY_CITATIONS` | Preserved in new view model; dagger legend (`\n† Value manually entered`) is always statically appended (unconditional) |
| EDD (Expected Delivery Date) calculation and display | `calcEDD`, PDF, detail page | Preserved |
| Status tag rendering | `getStatusTag`, `statusHelpers.tsx` | Preserved |
| Carbon Design System component usage | All pages | Preserved; no component library changes |
| `protect-route`, role-based UI guards | `ProtectedRoute.tsx`, `AuthContext` | Preserved |
| `useAutoNotification` hook | All notification flows | Preserved |
| Email report button and service | `EmailReportButton.tsx`, `EmailExaminationReport.ts` | Preserved; email PDF generation chain updated in ST-08 |
| Patient age at exam (`patientAgeAtExam`) | Server-computed on create; display in forms and PDF | Preserved |
| Examination status lifecycle (`draft`, `completed`, `reviewed`) | All examination flows | Preserved |
| `gestationalAgeIsManual` flag at entity level | `Examination.gestationalAgeIsManual` | Preserved; this field stays at the top-level entity |
| `notes` and `findings` free-text fields | Form, detail page, PDF | Preserved |
| Breadcrumb navigation | All pages with breadcrumbs | Updated labels in ST-07 for exam type + fetus count |

---

## Risks, Dependencies, and Open Questions

### Critical (Blocks Implementation)

| ID | Item | Category | Notes |
|----|------|----------|-------|
| R-01 | Migration is single-pass, no rollback | Critical | The adopted single-atomic-deployment strategy (§8.1) means a failed migration leaves the database in a partially migrated state. A rollback runbook (restoring from backup or running a reverse migration script) must be prepared before Phase 2 begins. This is a deployment ops requirement, not a code requirement, but it is a blocker for production deployment. |
| R-02 | `ObservableRow` must use `PercentileInput` | Critical | The existing `PercentileInput` colour-coding component must be used for the percentile input in `ObservableRow`. If ST-07 or ST-05 creates a plain `TextInput` for the percentile column, the colour-coding feature regresses. This must be an explicit acceptance criterion. |
| R-03 | `ExaminationSections.tsx` display path not covered by ST tasks | Critical | `ExaminationSections.tsx` (the detail-page renderer) currently reads `examination.biometry`, `examination.biometry2`, FT-specific `data.ft_biometry`, etc. After the data model migration (ST-04), it must read from `examination.data.fetuses[i].biometry` etc. This component is not explicitly called out in any ST task in §11. Must be added as a sub-task of ST-07 or explicitly folded into the detail-page update in ST-08. |

### Major (Blocks Specific Sub-Tasks)

| ID | Item | Category | Notes |
|----|------|----------|-------|
| R-04 | `vp` and `la` are free-text strings, not floats | Major | The `BiometryData` type stores `vp` and `la` as `string`. The Observable model specifies `value: number \| string`. The Observable type table in §14.3 lists `la` and `vp` as "free-text string". Migration (ST-09 Pass 1) must not attempt `parseFloat` on these; they must be written as string Observables. `buildSubmitPayload` must also handle the `isNaN(Number(...))` guard for these two types. Flagged for ST-05 and ST-09. |
| R-05 | `gestationalAgeFromBiometry` field becomes fetus-level | Major | The top-level entity field `gestationalAgeFromBiometry` (and `gestationalAgeFromBiometry2`) moves to `data.fetuses[i].gaFromBiometry`. The `Examination` interface update in ST-04 must ensure `gestationalAgeFromBiometry` is removed from the top-level entity AND all consuming code (detail page, PDF, `ExaminationSections`, list row) updated simultaneously to avoid a silent undefined. This is a cross-cutting change that must be verified across all 5+ consuming sites. |
| R-06 | Migration test dataset must cover all 4 legacy exam types | Major | The migration script must be validated against records from all four legacy `examinationType` values. If the test dataset only contains `ultrasound_prenatal` records, Pass 2 of the migration is untested for FT and twins cases. The sample data specification in Phase 2 must explicitly require all four original exam types. |
| R-07 | `gaFromBioIsManual` field on FT biometry | Major | `FtBiometry` contains `gaFromBio` and `gaFromBioIsManual`. In the new model this maps to `fetuses[i].gaFromBiometry.value` and `fetuses[i].gaFromBiometry.isManual`. The migration Pass 1 must handle this FT-specific field mapping. |

### Advisory Only

| ID | Item | Category | Notes |
|----|------|----------|-------|
| R-08 | `patientNameLower` shadow field on examination entities | Advisory | Both `CreateExamination.ts` and `UpdateExamination.ts` write a `patientNameLower` shadow field. This is not in `api/src/types/index.ts` and is not mentioned in `refactoring-findings.md`. It must remain after the refactoring (it is used for case-insensitive search). ST-03's serializer must preserve it. |
| R-09 | `updatedBy` field on examination entities | Advisory | `CreateExamination.ts` writes an `updatedBy: user.userId` field that is also not in the typed `Examination` interface. Like `patientNameLower`, it must be preserved by the new serializer. |
| R-10 | `primaryRowKey` new field on lookup entity | Advisory | ST-02 stores `primaryRowKey` on the EXAM lookup entity to enable O(1) update (§4.3). This is a new field not currently in the `Examination` interface. It must be added to `api/src/types/index.ts` as optional: `primaryRowKey?: string`. |
| R-11 | Biometric citation footnote in new view model | Advisory | **Simplified:** `viewModelBuilders.ts` will **always statically append** `\n† Value manually entered` to the notes citation string unconditionally (no dynamic scanning of `isManual` flags across `fetuses[i]`). Individual measurement fields still use `withManualMarker(val, isManual)` to place the ` †` symbol when manually entered. |
| R-12 | ST-10 (directory restructuring) is a large git operation | Advisory | Moving 28+ files with `git mv` and updating all import paths has a high risk of introducing merge conflicts if any other branch is active. ST-10 should be committed atomically with an automated import-path rewrite (e.g. `ts-morph` or `sed`). This is advisory — it does not block planning but should be noted in the deployment runbook. |

---

# Phase 1 — Greenfield Development

Phase 2 must not begin until Phase 1 is fully accepted by the user.

---

## Sub-Task ST-01 — Quick Fixes

**Intent:** Address the two P1 known issues approved for this sprint, and unify the exam type label strings between frontend and backend. These are independent, low-risk changes.

**Expected Outcomes:**
- KI-006: `SearchPatients.ts` writes a `PATIENT_SEARCH` audit event to the `AuditLogs` table on every successful search
- KI-007: `emailField` in `api/src/utils/validation.ts` uses `.email({ tlds: { allow: false } })`
- Backend and frontend exam type labels are identical strings

**Todo List:**
1. In `api/src/functions/SearchPatients.ts`, add `logAuditEvent('PATIENT_SEARCH', userId, { searchTerm: normalizedSearch, resultCount: patients.length })` after the patients array is assembled
2. In `api/src/utils/validation.ts`, change `Joi.string().email()` to `Joi.string().email({ tlds: { allow: false } })` on the `emailField` shared definition
3. In `api/src/constants/examinationTypes.ts`, align labels with the frontend: `'Ultrasound Prenatal'`, `'Ultrasound Prenatal for Twins'`, `'Ultrasound First Trimester'`, `'Ultrasound First Trimester for Twins'`

**Acceptance Criteria:**
- AC-ST01-1: `GET /v1/audit-logs` returns a `PATIENT_SEARCH` event after any `/v1/patients-search` call
- AC-ST01-2: `POST /v1/users` with email `admin@hospital.internal` returns HTTP 201 (not 400)
- AC-ST01-3: Backend exam type labels match frontend exam type labels character-for-character
- AC-ST01-4: Existing `validation.test.ts` passes with no regressions

**Tests:**
- Unit: update `api/src/tests/utils/validation.test.ts` — add a test for TLD-less email acceptance; confirm existing valid-email tests still pass
- Integration: `api/src/tests/integration/examinations.test.ts` or `audit` test — verify `PATIENT_SEARCH` audit record appears after a search call

**Relevant Context:** `api/src/functions/SearchPatients.ts`, `api/src/utils/auditService.ts`, `api/src/utils/validation.ts`, `api/src/constants/examinationTypes.ts`, `frontend/src/constants/examinationTypes.ts`

**Status:** [ ] pending

---

## Sub-Task ST-02 — Storage Layer Improvements

**Intent:** Cache `TableClient` instances, cache `ensureTableExists` results, and store `primaryRowKey` on lookup entities to eliminate O(N) partition scans during updates.

**Expected Outcomes:**
- `getTableClient(tableName)` returns a cached instance on the second call; no new `TableClient` is instantiated per operation
- `ensureTableExists(tableName)` issues at most one storage call per table name per Function host lifetime
- New examination lookup entities (`EXAM` partition) carry a `primaryRowKey` field equal to the primary entity's row key
- `UpdateExamination.ts` uses `getEntity(EXAMINATIONS_TABLE, existingExam.primaryRowKey)` instead of the `for await` partition scan

**Todo List:**
1. In `api/src/utils/tableClient.ts`, add a module-level `Map<string, TableClient>` cache; modify `getTableClient` to return cached instance or create-and-cache
2. In `api/src/utils/tableClient.ts`, add a module-level `Set<string>` of verified table names; modify `ensureTableExists` to skip the storage call if the table name is already in the set
3. In `api/src/functions/CreateExamination.ts`, add `primaryRowKey: \`${reverseTicks}_${examinationId}\`` to the lookup entity object
4. In `api/src/functions/UpdateExamination.ts`, replace the `for await` scan loop with a direct `getEntity(EXAMINATIONS_TABLE, \`PATIENT_${patientId}\`, existingExam.primaryRowKey)` lookup
5. Add `primaryRowKey?: string` to the `Examination` interface in `api/src/types/index.ts`

**Acceptance Criteria:**
- AC-ST02-1: Creating two examinations back-to-back calls `TableClient.fromConnectionString` at most once per table (verified via mock or log inspection in tests)
- AC-ST02-2: The lookup entity in the `EXAM` partition has a `primaryRowKey` property after creation
- AC-ST02-3: Updating an examination succeeds without the `for await` loop (remove the loop entirely; test verifies no scan call is made)
- AC-ST02-4: All existing integration tests for examination create/update pass

**Tests:**
- Unit: `api/src/tests/utils/` — test that `getTableClient` returns the same instance on second call (mock `TableClient.fromConnectionString`)
- Unit: test that `ensureTableExists` calls `createTable` only once for a given name
- Integration: examination create → update flow; assert update succeeds and response is 200

**Relevant Context:** `api/src/utils/tableClient.ts`, `api/src/functions/CreateExamination.ts`, `api/src/functions/UpdateExamination.ts`, `api/src/types/index.ts`

**Status:** [ ] pending

---

## Sub-Task ST-03 — Shared Serializer Utilities

**Intent:** Extract the repeated `JSON.stringify`/`JSON.parse` blocks across 5 backend files into a single shared `examinationSerializer.ts` utility, and promote the locally-scoped request body interfaces to shared types.

**Expected Outcomes:**
- A new file `api/src/utils/examinationSerializer.ts` containing `serializeExaminationData(data)` and `deserializeExaminationData(raw)` functions
- `ExaminationCreateRequest` and `ExaminationUpdateRequest` interfaces moved to `api/src/types/index.ts`
- `CreateExamination.ts`, `UpdateExamination.ts`, `GetExamination.ts`, `GetExaminations.ts`, `GetExaminationByMRN.ts` all use the shared serializer; no per-file `JSON.stringify`/`JSON.parse` blocks for examination data
- `patientNameLower` and `updatedBy` shadow fields are preserved through serialization

**Todo List:**
1. Create `api/src/utils/examinationSerializer.ts` with `serializeExaminationData(data: ExaminationData | undefined): string | undefined` and `deserializeExaminationData(raw: string | object | undefined): ExaminationData | undefined`
2. Move `ExaminationCreateBody` → `ExaminationCreateRequest` and `ExaminationBody` → `ExaminationUpdateRequest` to `api/src/types/index.ts`; add `etag` to `ExaminationUpdateRequest`
3. Update `CreateExamination.ts` to use `serializeExaminationData(data)` and `ExaminationCreateRequest`
4. Update `UpdateExamination.ts` to use `serializeExaminationData` and `ExaminationUpdateRequest`
5. Update `GetExamination.ts`, `GetExaminations.ts`, `GetExaminationByMRN.ts` to use `deserializeExaminationData`
6. Also fix `responseHelpers.ts`: change `` `req_${Date.now()}_${randomUUID()}` `` to `` `req_${randomUUID()}` `` (§4.6)

**Acceptance Criteria:**
- AC-ST03-1: No `JSON.stringify` or `JSON.parse` call exists in any `functions/*.ts` file for the `data`, `biometry`, `doppler`, `biometry2`, `doppler2` fields
- AC-ST03-2: `ExaminationCreateRequest` and `ExaminationUpdateRequest` are importable from `api/src/types/index.ts`
- AC-ST03-3: All examination integration tests pass
- AC-ST03-4: `meta.request_id` in API responses is a plain UUID string (no timestamp prefix)

**Tests:**
- Unit: `examinationSerializer.test.ts` — round-trip: `deserializeExaminationData(serializeExaminationData(data))` equals `data` for a sample payload with nested objects
- Integration: GET → POST → GET examination flow; verify `data` field is correctly serialized and deserialized

**Relevant Context:** `api/src/functions/CreateExamination.ts`, `api/src/functions/UpdateExamination.ts`, `api/src/functions/GetExamination.ts`, `api/src/functions/GetExaminations.ts`, `api/src/functions/GetExaminationByMRN.ts`, `api/src/utils/responseHelpers.ts`

**Status:** [ ] pending

---

## Sub-Task ST-04 — Type Model Update

**Intent:** Replace the flat-field type model (biometry/doppler at top level + `ft_*`/`twin2_*` keys in `data`) with the Observable-based fetus array model (§14.2) in both `api/src/types/index.ts` and `frontend/src/types/index.ts`.

**Expected Outcomes:**
- `Observable`, `GaFromBiometry`, `FetusSectionData`, and the new `ExaminationData` interfaces added to both type files
- Legacy types (`BiometryData`, `DopplerData`, `FtBiometry`, `FtDoppler`, `FtMarkers`, `FtUltrasoundFindings`) removed from `api/src/types/index.ts`
- Top-level `biometry`, `doppler`, `biometry2`, `doppler2`, `gestationalAgeFromBiometry`, `gestationalAgeFromBiometry2` removed from `Examination` interface in both type files
- `Examination.data` type updated from the legacy `ExaminationData` to the new `ExaminationData` (fetus array model)
- `CreateExaminationRequest` and `UpdateExaminationRequest` in `frontend/src/types/index.ts` updated to match
- `api/src/utils/validation.ts`: `EXAM_TYPE_KEYS` updated to `['prenatal', 'first_trimester']`; `GetExaminations.ts` filter allowlist updated

**Todo List:**
1. Add `Observable`, `GaFromBiometry`, `FetusSectionData`, new `ExaminationData` interfaces to `api/src/types/index.ts` per §14.2
2. Remove `BiometryData`, `DopplerData`, `FtBiometry`, `FtDoppler`, `FtMarkers`, `FtUltrasoundFindings` from `api/src/types/index.ts`
3. Update `Examination` in `api/src/types/index.ts`: remove the 6 promoted top-level fields; `data` uses the new `ExaminationData`
4. Mirror changes in `frontend/src/types/index.ts`: same additions, same removals, same `Examination` update; update `CreateExaminationRequest` and `UpdateExaminationRequest`
5. Update `EXAM_TYPE_KEYS` in `api/src/utils/validation.ts` to `['prenatal', 'first_trimester']`
6. Update the `examination_type` filter allowlist in `api/src/functions/GetExaminations.ts` to the 2-value set
7. Update `api/src/constants/examinationTypes.ts` to 2 keys: `prenatal` and `first_trimester`

**Acceptance Criteria:**
- AC-ST04-1: `tsc --noEmit` passes with no type errors in `api/src/`
- AC-ST04-2: `tsc --noEmit` passes with no type errors in `frontend/src/`
- AC-ST04-3: `POST /v1/examinations` with `examinationType: 'ultrasound_prenatal'` returns HTTP 400 (old key no longer valid)
- AC-ST04-4: `POST /v1/examinations` with `examinationType: 'prenatal'` passes validation
- AC-ST04-5: All existing backend unit tests pass (no type-related test failures)

**Tests:**
- Unit: update `validation.test.ts` — add test for `examinationType: 'prenatal'` (pass) and `'ultrasound_prenatal'` (fail)
- TypeScript compilation: `tsc --noEmit` is the acceptance gate

**Relevant Context:** `api/src/types/index.ts`, `frontend/src/types/index.ts`, `api/src/utils/validation.ts`, `api/src/functions/GetExaminations.ts`, `api/src/constants/examinationTypes.ts`

**Status:** [ ] pending

---

## Sub-Task ST-05 — Frontend Form State Refactor

**Intent:** Replace the ~250 flat `formData` keys in `useExaminationForm.ts` with the `fetuses: FetusSectionFormData[]` array model using `ObservableFormMap`, `AutoCalcValue<string>`, and `ObservableFormFieldState` (§15.2). Implement `buildFetusSectionFormData`, `buildSubmitPayload`, `handleFetusChange`, `handleFetusCountChange`, and the `computeObservableDerivedFields` reactive calculation hook (§15.3.2) including the EFW cascade rule (§14.5). Replace `useBiometryAutoCalc.ts` and `useFirstTrimesterAutoCalc.ts` with the new single hook.

**Expected Outcomes:**
- `frontend/src/types/formData.ts` (new file) contains `AutoCalcValue<T>`, `ObservableFormFieldState`, `ObservableFormMap`, `FetusSectionFormData`, `ExaminationFormData`
- `frontend/src/utils/observableRegistry.ts` (new file) contains `OBSERVABLE_CALC_REGISTRY`, `ObservableCalculationDescriptor`, `computeObservableDerivedFields`, `enrichTypeConfig`
- `useExaminationForm.ts` initializes from `buildFetusSectionFormData` for each fetus; exposes `handleFetusChange(index, section, type, field, value)` and `handleFetusCountChange(newCount)` alongside the existing `handleChange` for entity-level fields
- `fetusCount` is runtime state; on the create form, changing `fetusCount` resizes `formData.fetuses` (increase: append empty; decrease: slice — no warning on decrease)
- On the edit form, `fetusCount` is read-only, derived from `examination.data.fetuses.length`
- `buildSubmitPayload` correctly serializes `ObservableFormMap` to `Observable[]`, omitting entries with empty `value.value`, omitting `isManual: false` from storage, handling free-text `vp` and `la` types correctly
- EFW cascade rule implemented: manual EFW entry forces `percentile.isManual` and `ga.isManual` to `true` in the auto-calc guard; auto-recalculation clears all three flags
- `useBiometryAutoCalc.ts` and `useFirstTrimesterAutoCalc.ts` are replaced by `computeObservableDerivedFields` (the old files can be deleted or kept as dead code if TypeScript allows, but they must not be called)
- All existing `useBiometryAutoCalc.test.ts` conformance tests must pass rewritten against the new model; `calculations.conformance.test.ts` must pass unchanged

**Todo List:**
1. Create `frontend/src/types/formData.ts` with all interfaces from §15.2
2. Create `frontend/src/utils/observableRegistry.ts` with `OBSERVABLE_CALC_REGISTRY` (§15.3.1) importing existing calculation functions from `calculations.ts`; add `enrichTypeConfig`
3. Implement `computeObservableDerivedFields` in `observableRegistry.ts` per §15.3.2, including the EFW cascade rule
4. Implement `buildFetusSectionFormData` in `observableRegistry.ts` or a new `formDataMappers.ts` per §15.4.1; handle free-text types (`vp`, `la`) without numeric conversion
5. Implement `buildSubmitPayload` per §15.4.2; handle free-text types; omit `isManual: false` from storage
6. Rewrite `useExaminationForm.ts`: replace all flat keys with `fetuses: FetusSectionFormData[]`; add `fetusCount` state; add `handleFetusChange` and `handleFetusCountChange`; call `computeObservableDerivedFields` reactively per fetus
7. Remove calls to `useBiometryAutoCalc` and `useFirstTrimesterAutoCalc` from the form hook
8. Update `frontend/src/hooks/useBiometryAutoCalc.test.ts` to test the new `computeObservableDerivedFields` function (rewrite against new model)

**Acceptance Criteria:**
- AC-ST05-1: `tsc --noEmit` passes in `frontend/src/`
- AC-ST05-2: `fetusCount` decreasing from 2 to 1 on the create form removes the second fetus column immediately, with no warning shown
- AC-ST05-3: EFW auto-calculated from BPD/HC/AC/FL is not recomputed when `efw.value.isManual = true`
- AC-ST05-4: Manual entry into the EFW percentile field does not affect `efw.value.isManual`
- AC-ST05-5: `buildSubmitPayload` omits observables with empty `value.value`; `vp` and `la` observables are stored as string values
- AC-ST05-6: `buildFetusSectionFormData` produces `isManual: false` (not `undefined`) for all `AutoCalcValue` fields where the stored value has no `isManual` flag
- AC-ST05-7: `calculations.conformance.test.ts` passes unchanged
- AC-ST05-8: Rewritten `useBiometryAutoCalc.test.ts` passes

**Tests:**
- Unit: `computeObservableDerivedFields` — BPD input → BPD GA and percentile auto-calculated; manual BPD GA not overridden; EFW cascade rule for all 3 rules from §14.5
- Unit: `buildSubmitPayload` — round-trip with a sample `FetusSectionFormData`; free-text `vp`; `isManual: false` omitted from output
- Unit: `buildFetusSectionFormData` — seeding from a stored `FetusSectionData` with mixed present/absent observables
- Unit: `handleFetusCountChange(3)` → `formData.fetuses.length === 3`; `handleFetusCountChange(1)` → `formData.fetuses.length === 1`

**Relevant Context:** `frontend/src/hooks/useExaminationForm.ts`, `frontend/src/hooks/useBiometryAutoCalc.ts`, `frontend/src/hooks/useFirstTrimesterAutoCalc.ts`, `frontend/src/utils/calculations.ts`, `docs2/refactoring-findings.md §14.5`, `docs2/refactoring-findings.md §15.3`, `docs2/refactoring-findings.md §15.4`

**Status:** [ ] pending

---

## Sub-Task ST-06 — `EXAM_TYPE_CONFIG` Implementation

**Intent:** Replace `SECTION_VISIBILITY` (4-entry boolean map) and the standalone `isFirstTrimester`/`isFtTwins` helpers with a 2-entry `EXAM_TYPE_CONFIG` (§12.3.3) carrying `label`, `trimester`, `biometryTypes: readonly ObservableTypeConfig[]`, and `dopplerTypes: readonly ObservableTypeConfig[]`. All observable type metadata (label, unit, `hasPercentile`, `hasGa`, `validRange`, `sourceTag`) is defined here.

**Expected Outcomes:**
- `EXAM_TYPE_CONFIG` in `frontend/src/constants/examinationTypes.ts` has exactly 2 entries: `prenatal` and `first_trimester`
- `SECTION_VISIBILITY`, `getSectionVisibility`, `isFirstTrimester`, `isFtTwins`, `isFt*` helpers removed from `examinationTypes.ts`
- `ObservableTypeConfig` and `ExamTypeConfig` interfaces defined in `examinationTypes.ts`
- `enrichTypeConfig` from `observableRegistry.ts` is called for each entry during config construction to populate `validRange` and `sourceTag`
- Full observable type lists for both exam types defined per §14.3 (prenatal biometry: `bpd`, `ofd`, `hc`, `ac`, `fl`, `efw`, `tcd`, `tad`, `apad`, `cm`, `nuchalFold`, `nb`, `lc`, `la`, `vp`; prenatal doppler: `pi`, `ri`, `utADexPI`, `utADexRI`, `utASinPI`, `utASinRI`, `cma`, `psv`, `cpr`, `ducVen`; FT biometry: `crl`, `nt`, `nb`, `puls`; FT doppler: `utADexPI`, `utADexRI`, `utASinPI`, `utASinRI`)
- `getExamTypeLabel(key)` updated to work on the 2-value key set
- All import sites in the frontend that imported `getSectionVisibility`, `isFirstTrimester`, `isFtTwins` from `examinationTypes.ts` are updated

**Todo List:**
1. Add `ObservableTypeConfig` and `ExamTypeConfig` interfaces to `frontend/src/constants/examinationTypes.ts`
2. Build the `prenatal` config entry with all biometry and doppler `ObservableTypeConfig` entries per §14.3; use `enrichTypeConfig` to add `validRange` and `sourceTag`
3. Build the `first_trimester` config entry with FT biometry and doppler entries per §14.3
4. Export `EXAM_TYPE_CONFIG: Record<'prenatal' | 'first_trimester', ExamTypeConfig>`
5. Remove `SECTION_VISIBILITY`, `getSectionVisibility`, `isFirstTrimester`, `isFtTwins` from the file
6. Update `getExamTypeLabel` to use `EXAM_TYPE_CONFIG` lookup
7. Find and update all import sites that used the removed helpers: `ExaminationForm.tsx`, `ExaminationSections.tsx`, `ExaminationDetailPage.tsx`, `pdfDocument.ts`, `pdfSections.ts`, `viewModelBuilders.ts`

**Acceptance Criteria:**
- AC-ST06-1: `tsc --noEmit` passes; no references to `getSectionVisibility`, `isFirstTrimester`, `isFtTwins` remain
- AC-ST06-2: `EXAM_TYPE_CONFIG['prenatal'].biometryTypes` has 15 entries (BPD through VP)
- AC-ST06-3: `EXAM_TYPE_CONFIG['first_trimester'].trimester === 'first'`
- AC-ST06-4: `EXAM_TYPE_CONFIG['prenatal'].biometryTypes.find(t => t.type === 'bpd')?.validRange` equals `{ min: 20, max: 110 }`

**Tests:**
- Unit: validate `EXAM_TYPE_CONFIG` structure — entry counts, required fields present, `enrichTypeConfig` applied (spot-check `bpd.validRange` and `crl.sourceTag`)

**Relevant Context:** `frontend/src/constants/examinationTypes.ts`, `frontend/src/utils/observableRegistry.ts`, `docs2/refactoring-findings.md §12.3.3`, `docs2/refactoring-findings.md §14.3`

**Status:** [ ] pending

---

## Sub-Task ST-07 — Config-Driven Form Rendering and Screen Layout

**Intent:** Refactor `ExaminationForm.tsx` to drive all section rendering from `EXAM_TYPE_CONFIG` and `formData.fetuses[]` via new `ObservableSection`/`ObservableRow` components. Replace the twin CSS grid with the horizontal-scroll flex layout (§13.3). Add the fetus count selector to the create form. Update `ExaminationDetailPage.tsx` and `ExaminationSections.tsx` to read from `examination.data.fetuses[i]`. Update exam type filter dropdowns to 2 values.

**Expected Outcomes:**
- New files: `frontend/src/components/sections/ObservableRow.tsx`, `frontend/src/components/sections/ObservableSection.tsx` per §15.5.1 and §15.5.2
- `ObservableRow` uses `PercentileInput` for the percentile column (preserves colour-coding)
- `ExaminationForm.tsx` has no `isFt`, `isTwins`, `isFtTwinsMode`, `SECTION_VISIBILITY` references; section rendering is driven by `config.biometryTypes` and `formData.fetuses.map(...)`
- Create form has: (1) Exam Type selector with 2 options; (2) Number of Fetuses numeric input (default 1); both are locked to read-only on the edit form
- Fetus section container uses `display: flex; flex-direction: row; flex-wrap: nowrap; gap: 1.5rem; overflow-x: auto` — NOT CSS grid; each fetus column has `min-width: 480px; flex: 0 0 auto`
- Single-fetus layout keeps `maxWidth: 1200px`; multi-fetus layout removes the max-width cap on the inner section wrapper only (outer page container keeps its max-width)
- Column headers show "Fetus 1", "Fetus 2", etc. (not "Twin 1", "Twin 2"); rendered only when `fetusCount > 1`
- `markers` section rendered when `config.trimester === 'first'`; no `isFt` check
- `ExaminationSections.tsx` reads from `examination.data.fetuses[i].biometry/doppler/anatomy/ultrasoundFindings/markers`; no references to legacy `examination.biometry`, `examination.biometry2`, `data.ft_*`, `data.twin2_*`
- `ExaminationDetailPage.tsx`: summary tile shows `"Type: Prenatal — N fetuses"` composite label; `isTwins` / `isFt` derivations removed; `examination.data.fetuses.length` used for fetus count
- `ExaminationsPage` and `PatientDetailPage` filter dropdowns updated to show 2 exam type options; `examination_type` query param uses new 2-value keys
- List view "Type" column shows `"Prenatal"` or `"First Trimester"` optionally with `" (×N)"` suffix for N > 1 fetuses
- `BiometrySection.tsx` and `FirstTrimesterSection.tsx` are no longer rendered from any code path (they can remain but are not used)
- `AutoCalcDot` is not used anywhere in the form or detail page; `autoCalcLabel` is removed from `AutoCalcHelpers.tsx` and replaced with a shared `autoSuffix(isManual, sourceTag)` utility
- **Detail page** (`ExaminationDetailPage.tsx` and `ExaminationSections.tsx`): all `AutoCalcDot` usages (5 sites) replaced by the same `autoSuffix` text-suffix pattern applied to **rendered value cells** — `"28w 2d (Hadlock)"`, `"28w 2d (manual)"`, etc.; all footnote legend rows (*"● Value manually entered"*) removed

**Todo List:**
1. Extract `autoSuffix(isManual: boolean | undefined, sourceTag?: string): ReactNode` as a shared helper in `AutoCalcHelpers.tsx`; remove `autoCalcLabel`; `autoSuffix` returns a `<span style={{ color: '#f1c21b' }}> (manual)</span>` when `isManual = true`, a plain text string `" (Hadlock)"` / `" (auto)"` when `isManual = false` and a value is present, or `null` when the field is empty
2. Create `ObservableRow.tsx` per §15.5.1 using `PercentileInput` for the percentile column; compose labels using `autoSuffix` — `\`${label} (${unit})\`` + `autoSuffix(isManual, sourceTag)` when a value is present; do **not** import `AutoCalcDot` or the old `autoCalcLabel`
3. Create `ObservableSection.tsx` per §15.5.2
4. Refactor `ExaminationForm.tsx`: replace all `t2_`, `ft_`, `twin2_` branching with `formData.fetuses.map(...)` driven by `EXAM_TYPE_CONFIG`; update exam type selector to 2 options + fetus count selector; implement `handleFetusCountChange` integration
5. Update fetus section container CSS from grid to flex per §13.3
6. Update `ExaminationSections.tsx` to read from `examination.data.fetuses[i]`; replace the 5 `AutoCalcDot` usages with `autoSuffix` applied to value cells; remove all footnote legend rows
7. Update `ExaminationDetailPage.tsx`: type label composite, `isTwins`/`isFt` removal, fetus count from `data.fetuses.length`; replace remaining `AutoCalcDot` usages with `autoSuffix` on the GA-from-LMP and GA-from-Bio value cells
8. Update exam type filter dropdowns in `ExaminationsPage.tsx` and `PatientDetailPage.tsx`
9. Update list view "Type" column display logic in `ExaminationsPage.tsx`

**Acceptance Criteria:**
- AC-ST07-1: Selecting "First Trimester" exam type on create form renders CRL, NT, NB, Puls observables (not BPD, HC, etc.)
- AC-ST07-2: Selecting "Prenatal" renders BPD, OFD, HC, AC, FL, EFW, TCD, etc.
- AC-ST07-3: Setting fetus count to 3 on the create form shows 3 side-by-side fetus columns; the form is horizontally scrollable; no column collapses below 480px wide
- AC-ST07-4: Fetus count selector is read-only on the edit form
- AC-ST07-5: Fetus count = 1: no column header "Fetus 1" shown; fetus count ≥ 2: column headers "Fetus 1", "Fetus 2", ... shown
- AC-ST07-6: Percentile inputs in `ObservableRow` show colour-coding (green/yellow/red background) based on value
- AC-ST07-7: Detail page for a 2-fetus prenatal exam shows 2 fetus sections; for a 1-fetus FT exam shows 1 fetus section with markers
- AC-ST07-8: Exam type filter dropdown shows exactly 2 options on `ExaminationsPage`
- AC-ST07-9: `tsc --noEmit` passes
- AC-ST07-10: No `AutoCalcDot` import exists in `ObservableRow.tsx`, `ExaminationSections.tsx`, or `ExaminationDetailPage.tsx`
- AC-ST07-11: Detail page biometry grid shows `"28w 2d (Hadlock)"` for an auto-calculated BPD GA value; shows `"28w 2d (manual)"` in yellow for a manually overridden value; shows `"—"` for an absent value with no suffix
- AC-ST07-12: No footnote legend rows (*"● Value manually entered"*) exist anywhere in the detail page or `ExaminationSections`

**Tests:**
- Unit: `ObservableRow` renders with and without percentile/GA columns based on `config.hasPercentile`/`hasGa`
- Unit: Fetus count change from 1 to 3 → `formData.fetuses.length === 3`; from 3 to 2 → `formData.fetuses.length === 2`
- End-to-end: Create prenatal exam with 2 fetuses → save → load detail → both fetus sections visible; edit → fetus count read-only

**Relevant Context:** `frontend/src/components/ExaminationForm.tsx`, `frontend/src/components/ExaminationSections.tsx`, `frontend/src/pages/ExaminationDetailPage.tsx`, `frontend/src/pages/ExaminationsPage.tsx`, `frontend/src/pages/PatientDetailPage.tsx`, `frontend/src/components/sections/BiometrySection.tsx`, `docs2/refactoring-findings.md §13.3`, §15.5

**Status:** [ ] pending

---

## Sub-Task ST-08 — View Model and PDF Refactor

**Intent:** Replace `ExamPdfViewModel` (flat twin/FT optional fields) with a `fetuses: FetusPdfViewModel[]` array; refactor `viewModelBuilders.ts` to map from `exam.data.fetuses[]` to `FetusPdfViewModel[]`; refactor `pdfDocument.ts` and `pdfSections.ts` to use the pair-loop layout (§13.4) supporting N fetuses.

**Expected Outcomes:**
- `print.service.ts`: `ExamPdfViewModel` has `fetuses: FetusPdfViewModel[]`; all legacy optional twin/FT fields removed; `ObservablePdfEntry` interface added
- `viewModelBuilders.ts`: `buildViewModel` iterates `exam.data.fetuses`; builds `FetusPdfViewModel[]`; header title uses type + fetus count composite (§13.5); dagger footnote legend (`\n† Value manually entered`) is always statically appended to notes alongside `PRENATAL_BIOMETRY_CITATIONS` / `FT_BIOMETRY_CITATIONS` without conditional flag scanning; per-field daggers continue via `withManualMarker`
- `pdfDocument.ts`: `buildExaminationPDF` uses the pair-loop (§13.4.4); `drawCommonSections`, `drawClinicalInformation`, `drawSignatureLine`, `drawFooter` extracted as named functions; common sections repeated on every page for N > 2 fetuses; footer shows `"Page N of M"`
- `pdfSections.ts`: `renderClinicalSections` (renamed `renderClinicalSectionsPair`) accepts `pair: FetusPdfViewModel[]` and `layout: PairLayout` instead of `isTwins` + hard-coded X constants; `PdfDrawHelpers` loses `TWIN_COL_W`, `T1_X`, `T2_X`; iterates `pair.length`; `chunkFetuses` and `computePairLayout` implemented per §13.4.1–13.4.2; biometry rows rendered by iterating `fetus.biometry` observables, with label/unit looked up from a static `OBSERVABLE_PDF_META` map keyed by `type`
- All existing PDF content fields continue to appear (parity requirement: medical content unchanged)
- `OBSERVABLE_PDF_META` map covers all observable types from §14.3 for both exam types

**Todo List:**
1. Update `ExamPdfViewModel` in `print.service.ts`: add `FetusPdfViewModel`, `ObservablePdfEntry` interfaces; remove all legacy optional twin/FT fields; `fetuses: FetusPdfViewModel[]` required
2. Rewrite `buildViewModel` in `viewModelBuilders.ts` to iterate `exam.data.fetuses`; compute header title per §13.5; statically append `\n† Value manually entered` to the notes citations string unconditionally (simplifies R-11, no flag scanning required)
3. Add `chunkFetuses` and `computePairLayout` to `pdfSections.ts` per §13.4.1–13.4.2
4. Add `OBSERVABLE_PDF_META` map to `pdfSections.ts` covering all types from §14.3
5. Refactor `renderClinicalSections` → `renderClinicalSectionsPair(doc, vm, pair, layout, y, helpers, pageIdx, totalPages)` per §13.4.5; remove `isTwins`/`isFt` branches; iterate `pair.length`
6. Extract `drawCommonSections`, `drawClinicalInformation`, `drawSignatureLine`, `drawFooter` from `buildExaminationPDF` body
7. Replace `buildExaminationPDF` linear body with the pair-loop per §13.4.4
8. Update `PdfDrawHelpers` interface: remove `TWIN_COL_W`, `T1_X`, `T2_X`; `layout` passed directly to `renderClinicalSectionsPair`

**Acceptance Criteria:**
- AC-ST08-1: PDF generated for a 1-fetus prenatal exam is visually identical to the previous output (single-column, no second page)
- AC-ST08-2: PDF for a 2-fetus prenatal exam is visually identical to the previous twins output (two columns, same A4 layout)
- AC-ST08-3: PDF for a 3-fetus exam has fetus 1+2 on page 1 and fetus 3 (left column only, right half blank) on page 2; common header/patient block repeated on page 2
- AC-ST08-4: PDF footer reads `"Page 1 of 2"` on page 1 and `"Page 2 of 2"` on page 2 for a 3-fetus exam
- AC-ST08-5: PDF header title reads `"Prenatal Ultrasound Report (2 fetuses)"` for a 2-fetus prenatal exam
- AC-ST08-6: All biometric citation constants appear in PDF notes followed unconditionally by the dagger footnote legend (`\n† Value manually entered`); individual values with `isManual = true` display the ` †` marker
- AC-ST08-7: `tsc --noEmit` passes

**Tests:**
- Unit: `chunkFetuses([F1, F2, F3])` returns `[[F1, F2], [F3]]`; `chunkFetuses([F1])` returns `[[F1]]`
- Unit: `computePairLayout(1)` returns `{ colW: 88, xStart: [14], xEnd: [102] }`; `computePairLayout(2)` returns `{ colW: 88, xStart: [14, 108], xEnd: [102, 196] }`
- Unit: `buildViewModel` for a 2-fetus prenatal exam produces `vm.fetuses.length === 2`
- Integration/Visual: PDF snapshot test (or manual verification checklist in UAT) for 1, 2, and 3 fetus cases

**Relevant Context:** `frontend/src/services/print.service.ts`, `frontend/src/services/viewModelBuilders.ts`, `frontend/src/components/reports/pdfDocument.ts`, `frontend/src/components/reports/pdfSections.ts`, `docs2/refactoring-findings.md §13.4`, §13.5

**Status:** [ ] pending

---

## Sub-Task ST-09 — Migration Script

**Intent:** Write and validate the one-time data migration script that transforms existing Azure Table Storage records from the legacy flat-field model to the new Observable fetus array model. This runs against sample data only in Phase 1; production execution is Phase 2.

**Expected Outcomes:**
- Migration script located at `scripts/migrate-v2.ts` (or `.js`)
- **Pass 1 — Fetus array migration:** For each entity in the `EXAM` and `PATIENT_*` partitions (excluding `MRN` partition), reads legacy `biometry`, `doppler`, `biometry2`, `doppler2`, `gestationalAgeFromBiometry`, `gestationalAgeFromBiometry2`, and all `data.*` fields; constructs `data.fetuses[]` per the new model; removes the legacy top-level fields; rewrites the entity. Handles free-text types (`vp`, `la`) correctly. Handles FT-specific mapping (`data.ft_biometry` → `fetuses[0].biometry` with CRL/NT/NB/Puls types; `data.ft_markers` → `fetuses[0].markers`; `gaFromCrl`/`gaFromBio`/`gaFromCrlIsManual`/`gaFromBioIsManual` → `fetuses[0].gaFromBiometry`). Handles twins (`biometry2` → `fetuses[1].biometry`, etc.). Handles all four legacy exam types.
- **Pass 2 — Exam type rewrite:** For each entity in `EXAM` and `PATIENT_*` partitions, rewrites `examinationType` per the mapping in §12.5: `ultrasound_prenatal` → `prenatal`, `ultrasound_prenatal_twins` → `prenatal`, `ultrasound_first_trimester` → `first_trimester`, `ultrasound_first_trimester_twins` → `first_trimester`
- Script is idempotent: running it twice on the same data produces the same result
- Script has dry-run mode (`--dry-run`) that prints what would be changed without writing

**Todo List:**
1. Create `scripts/migrate-v2.ts` with CLI flags `--dry-run`, `--connection-string`, `--pass 1|2|all`
2. Implement Pass 1 flat-to-fetus migration logic; handle all 4 legacy exam types, free-text fields, and both entity partitions
3. Implement Pass 2 exam type rewrite logic; run on both `EXAM` and `PATIENT_*` partitions
4. Add migration validation function: after Pass 1, spot-check 5 random records to verify `data.fetuses[0].biometry` is an array with correct `type` entries
5. Test Pass 1 on sample data (see Phase 2 sample data spec); verify record counts and spot-check results
6. Test Pass 2 on sample data; verify all `examinationType` values are in `['prenatal', 'first_trimester']`

**Acceptance Criteria:**
- AC-ST09-1: After Pass 1 on sample data, every examination record has `data.fetuses` as a non-empty array
- AC-ST09-2: After Pass 1, no entity has top-level `biometry`, `doppler`, `biometry2`, `doppler2`, `gestationalAgeFromBiometry`, `gestationalAgeFromBiometry2` properties
- AC-ST09-3: After Pass 2, no entity has `examinationType` outside `['prenatal', 'first_trimester']`
- AC-ST09-4: Dry-run mode prints a summary without modifying any entity
- AC-ST09-5: Running the script twice produces identical output (idempotency)
- AC-ST09-6: A FT twins exam record from the sample data produces `fetuses` array of length 2 with correct CRL/NT/NB/Puls observables and markers in each fetus

**Tests:**
- Unit: `migratePrenataleEntity(legacyEntity)` → validates output shape for each legacy exam type variant (4 cases)
- Unit: `migrateExamType(entity)` → correct type mapping for all 4 input values
- Integration: run script against Azurite with seeded sample data; verify counts and spot-checks

**Relevant Context:** `api/src/utils/tableClient.ts`, `api/src/types/index.ts`, `docs2/refactoring-findings.md §8.1`, §12.5, §14.3

**Status:** [ ] pending

---

## Sub-Task ST-10 — Directory Restructuring

**Intent:** Move all files to the proposed target directory structure (§5) using `git mv` and an automated import-path update pass. This is the last sub-task — all functional work is complete; this is purely organizational.

**Expected Outcomes:**
- Backend: `api/src/functions/` sub-divided into `auth/`, `patients/`, `examinations/`, `users/`, `audit/`, `system/` per §5.1
- Backend: `api/src/utils/` reorganized into `api/src/shared/` with sub-directories per §5.1; `examinationSerializer.ts` in `shared/storage/`
- Frontend: `frontend/src/pages/` reorganized into `frontend/src/features/` per §5.2; page files moved into feature directories
- Frontend: `frontend/src/components/reports/` content moved to `frontend/src/reports/`
- `frontend/src/services/print.service.ts` renamed to `printService.ts`
- `frontend/src/services/viewModelBuilders.ts` moved to `frontend/src/reports/`
- All import paths updated; no functional code changes
- `tsc --noEmit` passes after restructuring

**Todo List:**
1. Move backend function files into domain sub-directories using `git mv`
2. Move backend utility files into `shared/` sub-directories
3. Move frontend page files into feature directories
4. Move and rename `print.service.ts` → `printService.ts`
5. Move `viewModelBuilders.ts` → `reports/`
6. Run automated import-path update (e.g., `ts-morph` script or global search-and-replace)
7. Verify `tsc --noEmit` passes for both `api/` and `frontend/`
8. Verify all integration tests still pass (imports resolved)

**Acceptance Criteria:**
- AC-ST10-1: `api/src/functions/auth/Login.ts` exists; `api/src/functions/Login.ts` does not
- AC-ST10-2: `frontend/src/features/examinations/` directory exists with examination page files
- AC-ST10-3: `frontend/src/reports/printService.ts` exists; `frontend/src/services/print.service.ts` does not
- AC-ST10-4: `tsc --noEmit` passes for both projects
- AC-ST10-5: All backend integration tests pass

**Tests:**
- TypeScript compilation is the acceptance gate
- Run all integration tests post-restructuring

**Status:** [ ] pending

---

## Phase 1 UAT Checklist

The following checklist must be completed by the user before Phase 2 begins. Each item maps to one or more acceptance criteria above.

### Authentication and Users
- [ ] Login with valid credentials succeeds; invalid credentials are rejected
- [ ] Change password flow works
- [ ] Admin can create a user with email `admin@hospital.internal` (KI-007 fix, AC-ST01-2)
- [ ] User management (list, create, edit, delete) functions correctly
- [ ] Role-based access: viewer cannot create examinations; doctor can

### Patients
- [ ] Patient search writes an audit event visible in the audit log (KI-006 fix, AC-ST01-1)
- [ ] Patient create, edit, delete, and list work correctly

### Examinations — Create
- [ ] Create a prenatal exam with 1 fetus: all biometry/doppler/anatomy/ultrasound fields render
- [ ] Create a prenatal exam with 2 fetuses: 2 side-by-side columns; headers "Fetus 1" / "Fetus 2"
- [ ] Create a prenatal exam with 3 fetuses: 3 columns with horizontal scroll; no column below 480px wide
- [ ] Fetus count decreasing from 2 to 1 silently removes the second column (no warning)
- [ ] Create a first trimester exam with 1 fetus: CRL, NT, NB, Puls observables; markers section visible; no BPD/HC etc.
- [ ] Create a first trimester exam with 2 fetuses: 2 fetus columns with FT observables and markers each
- [ ] `examinationType` field value stored is `prenatal` or `first_trimester` (not old 4-value keys)
- [ ] Fetus count selector is absent on the edit form (read-only label only)

### Examinations — Auto-Calculation
- [ ] BPD entry auto-populates BPD GA and BPD percentile reactively
- [ ] BPD/HC/AC/FL entry auto-calculates EFW value
- [ ] Manual EFW entry: EFW auto-calc stops; EFW percentile and GA are not recalculated
- [ ] Manual EFW percentile entry does not affect EFW value's `isManual` flag
- [ ] Percentile colour-coding (green/yellow/red) appears on percentile input fields

### Examinations — Detail Page
- [ ] Detail page for a 2-fetus prenatal exam shows 2 fetus data sections
- [ ] Detail page type label shows `"Prenatal — 2 fetuses"` for a 2-fetus prenatal exam
- [ ] Detail page type label shows `"First Trimester"` for a 1-fetus FT exam
- [ ] `gestationalAgeFromBiometry` displays correctly from `data.fetuses[0].gaFromBiometry.value`

### PDF
- [ ] PDF for 1-fetus prenatal exam is visually identical to previous output
- [ ] PDF for 2-fetus prenatal exam is visually identical to previous twins output
- [ ] PDF for 3-fetus exam has page 1 (fetuses 1+2) and page 2 (fetus 3, left column only); footer "Page 1 of 2" / "Page 2 of 2"
- [ ] PDF header title includes fetus count suffix for N > 1
- [ ] PDF biometric citations appear in notes with the dagger footnote legend (`\n† Value manually entered`) statically included; individual overridden fields display the ` †` marker
- [ ] EDD, GA from LMP, GA from Bio all appear correctly

### Audit Log
- [ ] Audit log page loads and shows events
- [ ] Patient search event appears after a patient search

### Dashboard
- [ ] Dashboard patient and exam count tiles show correct values

---

# Phase 2 — Migration Procedures and Scripts

**Phase 2 begins only after the user has explicitly confirmed acceptance of Phase 1.**

---

## 2.1 Sample Dataset Specification

The sample dataset used for migration validation must include at least the following records, seeded into a local Azurite instance before running the migration script:

| # | Exam Type (Legacy) | Fetuses | Special conditions |
|---|--------------------|---------|--------------------|
| 1 | `ultrasound_prenatal` | 1 | All biometry/doppler fields populated; all percentile and GA fields populated; some `isManual = true` flags set |
| 2 | `ultrasound_prenatal` | 1 | Minimal data: only BPD entered; no doppler; no anatomy |
| 3 | `ultrasound_prenatal_twins` | 2 | Both fetus columns fully populated including `biometry2`, `doppler2`, `gestationalAgeFromBiometry2` |
| 4 | `ultrasound_prenatal_twins` | 2 | Twin 2 column empty (only fetus 1 data) |
| 5 | `ultrasound_first_trimester` | 1 | All FT fields: `ft_biometry` (CRL, NT, NB, Puls), `ft_markers`, `ft_ultrasound`, `ft_anatomy`, `ft_doppler`; `gaFromCrl` and `gaFromBio` present; `gaFromCrlIsManual = true` |
| 6 | `ultrasound_first_trimester` | 1 | Minimal: only CRL entered |
| 7 | `ultrasound_first_trimester_twins` | 2 | Both `ft_*` and `twin2_ft_*` sections populated |
| 8 | `ultrasound_first_trimester_twins` | 2 | Only fetus 1 FT sections; `twin2_ft_*` absent |
| 9 | Any | any | Record with `vp` and `la` as string values (not floats) |
| 10 | Any | any | Record where `data` JSON blob is absent (NULL); no biometry columns either (edge: empty exam) |

All 10 records must exist in **both** the `EXAM` partition and the corresponding `PATIENT_{patientId}` partition (since the migration must run on both).

---

## 2.2 Step-by-Step Migration Procedure

1. **Pre-migration backup:** Export all entities from `Examinations` table to a JSON file using `scripts/export-examinations.ts` (to be created). Store with timestamp. This is the rollback source.

2. **Environment validation:** Run `node scripts/migrate-v2.ts --dry-run --connection-string <conn>`. Verify that the printed summary lists all 10+ sample records with their proposed transformations.

3. **Pass 1 — Fetus array migration:** Run `node scripts/migrate-v2.ts --pass 1 --connection-string <conn>`. Verify exit code 0.

4. **Pass 1 validation (see §2.3 below):** Run the validation checklist. All checks must pass before proceeding to Pass 2.

5. **Pass 2 — Exam type rewrite:** Run `node scripts/migrate-v2.ts --pass 2 --connection-string <conn>`. Verify exit code 0.

6. **Pass 2 validation (see §2.3 below).**

7. **Application smoke test:** Start the application pointing at the migrated data. Run the Phase 1 UAT checklist against the migrated records.

8. **Rollback validation:** Use the pre-migration backup to restore the original state. Verify the old application code reads correctly from the restored data (confirms rollback procedure is viable).

---

## 2.3 Validation Procedures

### Record-Count Verification

Before and after the migration, count entities in each partition:

```
| Partition       | Before | After | Expected |
|-----------------|--------|-------|----------|
| EXAM            | N      | N     | Equal (no records added or deleted) |
| PATIENT_{id}    | M      | M     | Equal per patient |
| MRN             | K      | K     | Equal (MRN entities not touched) |
```

Count equality is a hard requirement. Any discrepancy is a migration failure.

### Pass 1 Field-Level Spot Checks

For each of the 10 sample records, verify:
- [ ] Entity has no `biometry`, `doppler`, `biometry2`, `doppler2`, `gestationalAgeFromBiometry`, `gestationalAgeFromBiometry2` top-level properties
- [ ] `data.fetuses` is a non-empty array
- [ ] `data.fetuses[0].biometry` is an array; first entry has `type` and `value` properties
- [ ] For prenatal records: `data.fetuses[0].biometry` contains an entry with `type === 'bpd'` if BPD was populated
- [ ] For FT records: `data.fetuses[0].biometry` contains an entry with `type === 'crl'` if CRL was populated; no entry with `type === 'bpd'`
- [ ] For twins records: `data.fetuses.length === 2`; `data.fetuses[1].biometry` is an array
- [ ] `vp` and `la` observables have `typeof value === 'string'`
- [ ] Any `isManual = true` flags from the legacy record are preserved in the corresponding Observable `isManual` flags
- [ ] `gaFromBiometry` on each fetus carries the correct `value` and `isManual`
- [ ] Empty exam record (sample #10) has `data.fetuses` either absent or an empty array; no error

### Pass 2 Field-Level Spot Checks

For each sample record:
- [ ] `examinationType` is exactly `'prenatal'` or `'first_trimester'` (no legacy values remain)
- [ ] `ultrasound_prenatal` → `prenatal` mapping correct
- [ ] `ultrasound_prenatal_twins` → `prenatal` mapping correct
- [ ] `ultrasound_first_trimester` → `first_trimester` mapping correct
- [ ] `ultrasound_first_trimester_twins` → `first_trimester` mapping correct

### Post-Migration Application Smoke Test

After both passes, start the application against the migrated data and verify:
- [ ] Examination list page loads; type column shows "Prenatal" or "First Trimester" for all records
- [ ] Detail page for each sample exam shows correct fetus data
- [ ] Edit form for each sample exam loads with correct data in `ObservableSection` fields
- [ ] PDF generates correctly for one record from each original exam type
- [ ] Creating a new examination with the new UI works and stores correctly

---

## 2.4 Rollback Procedure

If any migration validation step fails:

1. Stop the new application immediately
2. Restore the pre-migration backup: `node scripts/restore-examinations.ts --backup <path> --connection-string <conn>`
3. Deploy the previous application version (pre-v2 build)
4. Verify the application reads correctly from restored data using the old exam type keys
5. Root-cause the migration failure before attempting again

**The rollback script (`scripts/restore-examinations.ts`) must be written and tested as part of ST-09 deliverables, not after the fact.**

---

## 2.5 Phase 2 Sign-Off Checklist

- [ ] Pre-migration backup created and verified
- [ ] Dry-run output reviewed and approved
- [ ] Pass 1 completed with exit code 0
- [ ] All Pass 1 record-count and field-level spot checks passed
- [ ] Pass 2 completed with exit code 0
- [ ] All Pass 2 field-level spot checks passed
- [ ] Post-migration application smoke test passed on all 10 sample records
- [ ] Rollback procedure verified (backup restored and old code reads correctly)
- [ ] User explicitly confirms sign-off on Phase 2

**Production deployment occurs only after both Phase 1 UAT and this Phase 2 sign-off checklist are fully checked off.**
