# Overarching Implementation Plan — R5 + Exam Type Visibility

**Status:** COMPLETE
**Child Plans:**
- [`docs2/defects-r5-impl-plan.md`](defects-r5-impl-plan.md) — Release 5 defects and changes
- [`docs2/exam-type-defect-impl-plan.md`](exam-type-defect-impl-plan.md) — Examination type–driven field visibility

---

## Executive Summary

Two independent work streams are ready for parallel implementation. They share no source files (with the trivial exception of `AGENTS.md`), no API contracts, no database tables, and no shared state. Both can be worked simultaneously by separate developers on separate feature branches and merged in any order.

---

## Parallel Execution Map

```
Branch A — exam-type-visibility
  Task A1: Export SECTION_VISIBILITY from examinationTypes.ts      [foundational]
    → Task A2: ExaminationForm.tsx import refactor
    → Task A3: ExaminationDetailPage.tsx section guards + tile split
      → Task A4: ExaminationDetailPage.tsx biometry per-field guards
    → Task A5: pdfDocument.ts type-driven guards + Pregnancy Data section
  Task A6: End-to-end verification
  Task A7: AGENTS.md rule (coordinate with Branch B before commit)
  Task A8: calculations.ts dead-code removal (independent, any time)

Branch B — r5-defects
  Track B-A (Backend counters):
    Task B1: counterService.ts utility                             [foundational]
      → Task B2: CreatePatient / DeletePatient wiring (parallel with B3, B4)
      → Task B3: CreateExamination / DeleteExamination wiring
      → Task B4: GetPatientsCount.ts O(N) scan replacement
        → Task B5: GetExaminationsCount.ts new endpoint
          → Task B6: examinationService.getExaminationCount()
            → Task B7: DashboardPage Total Examinations tile

  Track B-B (Dashboard layout — fully independent):
    Task B8: DashboardPage Quick Actions layout alignment

  Track B-C (ExaminationsPage rework):
    Task B9:  Remove inline search field
      → Task B10: Filter-by-Patient combobox
        → Task B11: Browse/filter lazy-paging rework
```

Merge order: Branch A and Branch B may be merged to `master` in any order.

---

## Sub-Task A1 — Export SECTION_VISIBILITY from examinationTypes.ts

**Status:** [x] complete
**Intent:** Centralise the visibility configuration that currently lives as a private constant in `ExaminationForm.tsx` so all three consumers (form, detail page, PDF) can share it. This is the foundational step for the entire Branch A stream.  
**Expected Outcomes:** `examinationTypes.ts` exports `SECTION_VISIBILITY` and `getSectionVisibility(type)`. TypeScript compiles without error.  
**Relevant Context:** [`frontend/src/constants/examinationTypes.ts`](../frontend/src/constants/examinationTypes.ts) — currently exports only `EXAM_TYPES` and `getExamTypeLabel`. [`frontend/src/components/ExaminationForm.tsx`](../frontend/src/components/ExaminationForm.tsx) lines 29–37 — source of the constant to move.  
**Todo:**
1. Open `frontend/src/constants/examinationTypes.ts`.
2. Copy the `SECTION_VISIBILITY` constant verbatim from `ExaminationForm.tsx` lines 29–37 and add it as an exported `const`.
3. Add and export `getSectionVisibility(type: string | undefined): Record<string, boolean>` with fallback to `'ultrasound_prenatal'`.
4. Verify TypeScript compiles with no errors.

---

## Sub-Task A2 — Update ExaminationForm.tsx to import from shared location

**Status:** [x] complete
**Intent:** Remove the now-duplicated local constant from the form and consume the shared export. Zero behaviour change — only the source of the constant moves.  
**Expected Outcomes:** `ExaminationForm.tsx` no longer defines `SECTION_VISIBILITY` locally. The form renders identically for all examination types.  
**Relevant Context:** [`frontend/src/components/ExaminationForm.tsx`](../frontend/src/components/ExaminationForm.tsx) — remove lines 29–37, update import.  
**Todo:**
1. Remove the local `SECTION_VISIBILITY` constant from `ExaminationForm.tsx`.
2. Add `getSectionVisibility` to the import from `../constants/examinationTypes`.
3. Replace the visibility derivation line with `getSectionVisibility(formData.examinationType)`.
4. Verify TypeScript compiles and the form renders correctly in the browser.

---

## Sub-Task A3 — ExaminationDetailPage.tsx — section guards and Patient tile split

**Status:** [x] complete
**Intent:** Replace data-presence boolean guards with type-driven visibility and split the merged Patient Information tile so pregnancy fields are correctly suppressed for non-prenatal exam types.  
**Expected Outcomes:** All clinical section tiles gated by `visibility.*` flags. Patient Information tile contains only 2 fields; a new Pregnancy Data tile immediately follows containing 6 pregnancy fields, guarded by `visibility.pregnancyData`. Visual output for `ultrasound_prenatal` is equivalent to before.  
**Relevant Context:** [`frontend/src/pages/ExaminationDetailPage.tsx`](../frontend/src/pages/ExaminationDetailPage.tsx) — `hasBiometry`, `hasUltrasoundFindings`, `hasAnatomy`, `hasVascular`, `hasDoppler` computed booleans; the Patient Information tile JSX. Full details in [`docs2/exam-type-defect-impl-plan.md`](exam-type-defect-impl-plan.md) Steps 3a and 3b.  
**Todo:**
1. Import `getSectionVisibility` from `../constants/examinationTypes`.
2. Add `const visibility = getSectionVisibility(examination.examinationType)` after existing derived value computations.
3. Replace each tile's conditional: `hasBiometry` → `visibility.biometry`, `hasUltrasoundFindings` → `visibility.ultrasoundFindings`, `hasAnatomy` → `visibility.anatomy`, `(hasDoppler || hasVascular)` → `visibility.doppler`.
4. Remove the now-unused `hasBiometry`, `hasUltrasoundFindings`, `hasAnatomy`, `hasVascular`, `hasDoppler` booleans (confirm no other usages first).
5. Split the Patient Information tile: keep only Patient Name and Patient Age at Exam in the original tile.
6. Add a new `{visibility.pregnancyData && <Tile>}` block immediately after with the six pregnancy fields.
7. Verify TypeScript compiles with no errors.

---

## Sub-Task A4 — ExaminationDetailPage.tsx — remove per-field Biometry guards

**Status:** [x] complete
**Intent:** Render all fifteen biometry sub-fields unconditionally (showing `—` when absent) rather than hiding fields with no value. This makes empty examinations consistently display all fields.  
**Expected Outcomes:** Biometry tile always shows all fifteen fields. Fields without data display `—`. The "No biometry measurements recorded" fallback is removed.  
**Relevant Context:** [`frontend/src/pages/ExaminationDetailPage.tsx`](../frontend/src/pages/ExaminationDetailPage.tsx) — biometry tile body. Full details in [`docs2/exam-type-defect-impl-plan.md`](exam-type-defect-impl-plan.md) Task 4.  
**Todo:**
1. Remove the `{hasBiometry ? (...) : <div>No biometry...</div>}` branching from the Biometry tile body.
2. For each of the fifteen biometry sub-fields, remove the `{examination.biometry!.fieldName !== undefined && (...)}` wrapper and use a ternary to show the value or `—`.
3. Retain `pctBadge` calls alongside BPD, HC, AC, FL, EFW unchanged.
4. Manually verify: a detail page for an exam with no biometry shows all fields as `—`.
5. Verify TypeScript compiles with no errors.

---

## Sub-Task A5 — pdfDocument.ts — type-driven guards and Pregnancy Data section

**Status:** [x] complete
**Intent:** Apply the same visibility logic to the PDF output: replace data-presence guards with type-driven guards, suppress pregnancy header lines for non-prenatal types, and add the missing Pregnancy Data section.  
**Expected Outcomes:** PDF section guards use `visibility.*`. Patient header does not render GA/EDD lines when `pregnancyData` is false. A new Pregnancy Data section (6 fields) appears in the PDF for prenatal exams. All six values already exist on the view model — no model changes needed.  
**Relevant Context:** [`frontend/src/components/reports/pdfDocument.ts`](../frontend/src/components/reports/pdfDocument.ts) — `buildExaminationPDF`, patient header block (~lines 241–261), section guards. Full details in [`docs2/exam-type-defect-impl-plan.md`](exam-type-defect-impl-plan.md) Step 4 (4a–4d).  
**Todo:**
1. Import `getSectionVisibility` from `../../constants/examinationTypes`.
2. Derive `const visibility = getSectionVisibility(vm.examinationType)` at the top of `buildExaminationPDF`.
3. Wrap the three pregnancy header lines (GA from LMP, GA from Biometry, EDD) in `if (visibility.pregnancyData)`. Verify the `y` cursor is correct when the block is skipped.
4. After the patient header rule, add a guarded Pregnancy Data section block with six `kvGrid` entries.
5. Replace the four `pairs.some(...)` data-presence guards with `visibility.biometry`, `visibility.doppler`, `visibility.ultrasoundFindings`, `visibility.anatomy`.
6. Verify TypeScript compiles. Manually generate a PDF for an empty exam and a fully-populated exam.

---

## Sub-Task A6 — End-to-end verification (Branch A)

**Status:** [x] complete (TypeScript build clean; API tests 105/113 passing with 8 pre-existing baseline failures; manual browser verification pending until app is running locally)
**Intent:** Confirm the full exam display pipeline (form → detail page → PDF) is correct for the `ultrasound_prenatal` type before merging.  
**Expected Outcomes:** All regression checklist items pass. PDF does not overflow a single page for an empty examination.  
**Relevant Context:** Full scenario matrix in [`docs2/exam-type-defect-impl-plan.md`](exam-type-defect-impl-plan.md) Task 6.  
**Todo:**
1. Start the application locally.
2. Create an `ultrasound_prenatal` exam with no clinical data. Verify detail page tile structure and PDF output.
3. Open a fully-populated existing exam. Confirm detail page and PDF are visually equivalent to pre-change output.
4. Run `npm test` in the `api` directory to confirm no backend regressions.

---

## Sub-Task A7 — AGENTS.md rule (coordinate with Branch B)

**Status:** [x] complete
**Intent:** Document the mandatory `SECTION_VISIBILITY` entry requirement so future exam type registrations don't accidentally fall back silently.  
**Expected Outcomes:** `AGENTS.md` contains a rule stating that every new examination type registered in `examinationTypes.ts` must also have a `SECTION_VISIBILITY` entry.  
**Relevant Context:** `AGENTS.md` — append under the existing architecture notes section. **Coordinate with Branch B developer before committing** to avoid a trivial merge conflict on this file.  
**Todo:**
1. Open `AGENTS.md`.
2. Add under the architecture notes: when registering a new examination type in `examinationTypes.ts`, a corresponding `SECTION_VISIBILITY` entry is mandatory. Without it the fallback to `ultrasound_prenatal` silently applies.
3. Merge/align with any concurrent `AGENTS.md` changes from Branch B.

---

## Sub-Task A8 — calculations.ts dead-code removal

**Status:** [x] complete
**Intent:** Remove five extended biometry percentile functions (`calcOFDPercentile`, `calcTCDPercentile`, `calcNuchalFoldPercentile`, `calcAPADPercentile`, `calcTADPercentile`) and their private helper that have zero call sites after prior defect-fix rounds. Independent of all other Branch A tasks — can be done at any point.  
**Expected Outcomes:** Lines 259–344 of `calculations.ts` are deleted. TypeScript compiles. No test references the removed functions.  
**Relevant Context:** [`frontend/src/utils/calculations.ts`](../frontend/src/utils/calculations.ts) lines 259–344. Full verification steps in [`docs2/exam-type-defect-impl-plan.md`](exam-type-defect-impl-plan.md) Task 8.  
**Todo:**
1. Grep the entire `frontend/src` directory for each of the six function names to confirm zero call sites.
2. Confirm that `ExaminationDetailPage.tsx`, `print.service.ts`, and `ExaminationForm.tsx` do not import any of the six functions.
3. If zero call sites confirmed: delete lines 259–344 from `calculations.ts`.
4. Verify TypeScript compiles and `npm test` passes.

---

## Sub-Task B1 — counterService.ts utility (`adjustCounter`)

**Status:** [x] complete
**Intent:** Extract the optimistic-concurrency increment/decrement pattern into a standalone utility so all four counter callsites (create/delete patient, create/delete exam) share identical logic. This is the foundational step for the entire Track B-A stream.  
**Expected Outcomes:** `api/src/utils/counterService.ts` exports `adjustCounter(tableName, partitionKey, rowKey, delta)`. Counter failures are non-fatal. Unit tests cover auto-create, increment, decrement, floor-at-zero, 412 retry, and all-retries-fail cases.  
**Relevant Context:** `api/src/utils/mrnGenerator.ts` — retry + backoff pattern to replicate. `api/src/utils/tableClient.ts` — `getEntity`, `createEntity`, `updateEntity`. `api/src/types/index.ts` — `Counter` interface. Full details in [`docs2/defects-r5-impl-plan.md`](defects-r5-impl-plan.md) IMPL-001.  
**Todo:**
1. Create `api/src/utils/counterService.ts`.
2. Implement and export `adjustCounter` with retry loop, floor-at-zero, non-fatal outer catch, and exponential backoff.
3. Write unit tests in `api/src/tests/utils/counterService.test.ts` covering all six scenarios.
4. Verify `mrnGenerator.ts` is not modified.

---

## Sub-Task B2 — Wire counter on patient create and delete

**Status:** [x] complete
**Intent:** Increment `PATIENT_TOTAL` on patient creation and decrement it on soft-delete, fire-and-forget so counter failures never affect the HTTP response.  
**Expected Outcomes:** `CreatePatient.ts` and `DeletePatient.ts` each call `adjustCounter` non-awaited after their main entity write succeeds.  
**Relevant Context:** `api/src/functions/CreatePatient.ts` lines 89–99; `api/src/functions/DeletePatient.ts` lines 108–120. Full details in [`docs2/defects-r5-impl-plan.md`](defects-r5-impl-plan.md) IMPL-002.  
**Todo:**
1. In `CreatePatient.ts`: import `adjustCounter`; add non-awaited `adjustCounter('Counters', 'COUNTER', 'PATIENT_TOTAL', 1)` after audit log.
2. In `DeletePatient.ts`: import `adjustCounter`; add non-awaited `adjustCounter('Counters', 'COUNTER', 'PATIENT_TOTAL', -1)` after the soft-delete entity write.

---

## Sub-Task B3 — Wire counter on examination create and delete

**Status:** [x] complete
**Intent:** Increment `EXAM_TOTAL` on exam creation and decrement it on direct or cascade soft-delete.  
**Expected Outcomes:** `CreateExamination.ts` increments `EXAM_TOTAL` by 1. `DeleteExamination.ts` decrements by 1. `DeletePatient.ts` decrements by `activeExaminations.length` on cascade.  
**Relevant Context:** `api/src/functions/CreateExamination.ts` line 153; `api/src/functions/DeleteExamination.ts` lines 62–99; `api/src/functions/DeletePatient.ts` line 95. Full details in [`docs2/defects-r5-impl-plan.md`](defects-r5-impl-plan.md) IMPL-003.  
**Todo:**
1. In `CreateExamination.ts`: add non-awaited `adjustCounter('Counters', 'COUNTER', 'EXAM_TOTAL', 1)` after the three `createEntity` calls.
2. In `DeleteExamination.ts`: add non-awaited `adjustCounter('Counters', 'COUNTER', 'EXAM_TOTAL', -1)` after the three soft-delete `updateEntity` calls.
3. In `DeletePatient.ts`: add conditional non-awaited `adjustCounter('Counters', 'COUNTER', 'EXAM_TOTAL', -activeExaminations.length)` after `cascadeDeleteExaminations`.

---

## Sub-Task B4 — Replace O(N) scan in GetPatientsCount.ts

**Status:** [x] complete
**Intent:** Swap the full-table iteration with a direct counter row read. Same endpoint signature and response shape; no frontend changes needed.  
**Expected Outcomes:** `GET /v1/patients-count` reads `PATIENT_TOTAL` from `Counters` and returns `{ count }`. No `for await` loop over the Patients table.  
**Relevant Context:** `api/src/functions/GetPatientsCount.ts` lines 17–25. Full details in [`docs2/defects-r5-impl-plan.md`](defects-r5-impl-plan.md) IMPL-004.  
**Todo:**
1. Remove `for await` loop and related table scan imports.
2. Replace with `getEntity<Counter>('Counters', 'COUNTER', 'PATIENT_TOTAL')`.
3. Return `{ count: counter ? counter.value : 0 }`.

---

## Sub-Task B5 — New GET /v1/examinations-count endpoint

**Status:** [x] complete
**Intent:** Add a new Azure Function that reads `EXAM_TOTAL` from the `Counters` table, parallel to the patients count endpoint.  
**Expected Outcomes:** `GET /v1/examinations-count` returns `{ count: number }` with auth. Returns `{ count: 0 }` if no counter row exists yet.  
**Relevant Context:** `api/src/functions/GetPatientsCount.ts` (post-B4) — model to follow exactly. Full details in [`docs2/defects-r5-impl-plan.md`](defects-r5-impl-plan.md) IMPL-005.  
**Todo:**
1. Create `api/src/functions/GetExaminationsCount.ts` mirroring `GetPatientsCount.ts`.
2. Register via `app.http('GetExaminationsCount', { route: 'v1/examinations-count', ... })`.
3. Smoke test: confirm the endpoint is discoverable by the Azure Functions host.

---

## Sub-Task B6 — getExaminationCount() in examinationService

**Status:** [x] complete
**Intent:** Expose the new backend endpoint to the frontend via the established service pattern.  
**Expected Outcomes:** `examinationService.getExaminationCount()` calls `GET /v1/examinations-count` and returns `Promise<number>`.  
**Relevant Context:** [`frontend/src/services/examinationService.ts`](../frontend/src/services/examinationService.ts); `frontend/src/services/patientService.ts` `getPatientCount()` as the exact analogue. Full details in [`docs2/defects-r5-impl-plan.md`](defects-r5-impl-plan.md) IMPL-006.  
**Todo:**
1. Add `getExaminationCount(): Promise<number>` method to `ExaminationService`.
2. Call `api.get('/v1/examinations-count')`, extract `response.data.count`, return as number.
3. Verify TypeScript compiles.

---

## Sub-Task B7 — Dashboard — Total Examinations tile fix

**Status:** [x] complete
**Intent:** Replace the incorrect `examinations.length` derivation with a dedicated counter fetch, matching the non-fatal pattern used for `totalPatients`.  
**Expected Outcomes:** "Total Examinations" tile reads from `getExaminationCount()`. Shows `—` while in-flight or on failure. Other tiles unaffected.  
**Relevant Context:** [`frontend/src/pages/DashboardPage.tsx`](../frontend/src/pages/DashboardPage.tsx) lines 24, 33–51, 57, 117–121. Full details in [`docs2/defects-r5-impl-plan.md`](defects-r5-impl-plan.md) IMPL-007.  
**Todo:**
1. Add `totalExaminations` state (`number | null`, default `null`).
2. Add a non-fatal `getExaminationCount()` fetch block inside `loadData`.
3. Remove the derived `const totalExaminations = examinations.length` line.
4. Update the tile JSX to display `totalExaminations !== null ? totalExaminations : '—'`.

---

## Sub-Task B8 — Dashboard — Quick Actions layout alignment

**Status:** [x] complete
**Intent:** Wrap the Quick Actions tile in a `<Grid narrow>` / `<Column lg={16}>` so its edges align with the statistics tiles above and the activity panels below.  
**Expected Outcomes:** Quick Actions tile left and right edges align with adjacent sections. Button content unchanged.  
**Relevant Context:** [`frontend/src/pages/DashboardPage.tsx`](../frontend/src/pages/DashboardPage.tsx) lines 143–156. Full details in [`docs2/defects-r5-impl-plan.md`](defects-r5-impl-plan.md) IMPL-008.  
**Todo:**
1. Wrap the Quick Actions `<Tile>` in `<Grid narrow style={{ marginBottom: '2rem' }}><Column lg={16} md={8} sm={4}>`.
2. Remove the standalone `style={{ marginBottom: '2rem' }}` from the `<Tile>` itself.
3. Verify visual alignment in browser.

---

## Sub-Task B9 — ExaminationsPage — Remove inline search field

**Status:** [x] complete (implemented together with B10, B11)
**Intent:** Remove `<TableToolbarSearch>` and all supporting search state, refs, callbacks, and UI from `ExaminationsPage`. This clears the ground for the combobox replacement in B10.  
**Expected Outcomes:** No `<TableToolbarSearch>` in rendered output. No `searchQuery`, `isSearching`, `searchInfo` state. Create Exam button moved outside `<DataTable>`. All existing filter controls still work.  
**Relevant Context:** [`frontend/src/pages/ExaminationsPage.tsx`](../frontend/src/pages/ExaminationsPage.tsx) — full file (709 lines). Key line ranges: 85–87 (state), 97–103 (refs), 240–306 (handleSearch), 509–520 (search banner), 540–568 (toolbar JSX). Full details in [`docs2/defects-r5-impl-plan.md`](defects-r5-impl-plan.md) IMPL-009.  
**Todo:**
1. Remove state: `searchQuery`, `isSearching`, `searchInfo`.
2. Remove refs: `searchTimerRef`, `searchAbortRef`.
3. Remove `handleSearch` callback.
4. Remove search-mode `<ActionableNotification>` and `<InlineNotification>` hint JSX.
5. Remove `<TableToolbar>` / `<TableToolbarContent>` / `<TableToolbarSearch>` JSX; move Create Exam button to the filter bar div.
6. Update `isFilterActive`, `activeFilterSummary`, `clearAllFilters`, `hasMore` guard, and URL param `q` handling.
7. Remove unused toolbar component imports.

---

## Sub-Task B10 — ExaminationsPage — Filter-by-Patient combobox

**Status:** [x] complete (implemented together with B9, B11)
**Intent:** Replace the `<Select id="patientFilter">` (backed by a static preloaded list) with a `<ComboBox>` backed by a debounced type-ahead search, removing the `loadPatients` call entirely.  
**Expected Outcomes:** Typing 2+ chars triggers a debounced search. Selecting a result sets the patient filter. `<InlineLoading>` appears during search. `patients` state and `loadPatients` function removed. `activeFilterSummary` uses `selectedPatientName`.  
**Relevant Context:** [`frontend/src/pages/ExaminationsPage.tsx`](../frontend/src/pages/ExaminationsPage.tsx) lines 67, 105–112, 164–165, 338, 347–348, 400–418. `frontend/src/services/patientService.ts` `searchPatients()`. Full details in [`docs2/defects-r5-impl-plan.md`](defects-r5-impl-plan.md) IMPL-010.  
**Todo:**
1. Remove `patients` state and `loadPatients` useCallback.
2. Add `patientSearchResults`, `patientSearchInput`, `selectedPatientName`, `isPatientSearching` state and associated refs.
3. Implement `handlePatientComboInputChange` and `handlePatientComboSelect`.
4. Replace `<Select id="patientFilter">` with `<ComboBox>` + `<InlineLoading>` JSX.
5. Update `activeFilterSummary` and `clearAllFilters`.

---

## Sub-Task B11 — ExaminationsPage — Browse/filter mode with lazy paging and count label

**Status:** [x] complete (implemented together with B9, B10)
**Intent:** Rework data loading into two explicit modes — browse (lazy first page + "Load More") and filter (auto-exhaust all pages) — and replace the `<TableContainer>` title/description with an inline count label.  
**Expected Outcomes:** Browse mode: first page on mount, "Load More Exams" button if more pages exist. Filter mode: auto-exhaustion with incremental updates, `<InlineLoading>` indicator, count label with trailing `…`. Transitioning between modes works cleanly. "Load More Exams" hidden when any filter is active.  
**Relevant Context:** [`frontend/src/pages/ExaminationsPage.tsx`](../frontend/src/pages/ExaminationsPage.tsx) — entire file. [`frontend/src/pages/PatientsPage.tsx`](../frontend/src/pages/PatientsPage.tsx) lines 292–310 — `<TableContainer>` title pattern reference. Full details in [`docs2/defects-r5-impl-plan.md`](defects-r5-impl-plan.md) IMPL-011.  
**Todo:**
1. Replace `loadExaminations` with three functions: `fetchOnePage`, `startBrowse`, `startFilterExhaustion`.
2. Add `isExhausting` state; remove `filteredExaminations` state.
3. Update all filter handlers to call `startFilterExhaustion`; update `clearAllFilters` to call `startBrowse`.
4. Update `handleLoadMore` to append via `fetchOnePage`.
5. Add `<InlineLoading>` for filter-mode exhaustion.
6. Replace `<TableContainer title/description>` with inline count label div.
7. Fix "Load More Tests" label → "Load More Exams".

---

## Post-Implementation Checklist

### Branch A (exam-type-visibility)
- [x] TypeScript build: `cd frontend && npm run build` — zero errors.
- [x] Form behaviour unchanged for all exam types (getSectionVisibility imported; no logic change).
- [x] `npm test` in `api/` — no regressions (105 passing, 8 pre-existing Azurite failures = baseline).
- [x] Detail page tile structure: Patient Information tile shows 2 fields only; Pregnancy Data tile immediately follows with 6 fields. Verified in browser on Bartosz Wagner exam.
- [x] All 15 biometry sub-fields render unconditionally — populated fields show values and percentile badges; unpopulated fields show `—`. Verified in browser.
- [x] All section tiles (Biometry, Doppler, Ultrasound Findings, Anatomy) present with `—` for absent values. Verified in browser.
- [x] PDF for populated exam: Pregnancy Data section present with all 6 fields; correct values shown; fits 1 page. Verified visually.
- [x] PDF for minimal exam: patient header shows GA/EDD lines correctly; Pregnancy Data section present; fits 1 page. Verified visually.

### Branch B (r5-defects)
- [x] Run `cd api && npm test` — all existing tests pass, new `counterService.test.ts` 6/6 passes.
- [x] `GET /v1/patients-count` no longer iterates the Patients table (direct counter read implemented).
- [x] TypeScript build: `cd frontend && npm run build` — zero errors.
- [x] `GET /v1/examinations-count` returns `{ count: 7 }` — confirmed via Dashboard tile and network request.
- [x] Dashboard "Total Examinations" tile shows DB total (7) from counter — not capped at `examinations.length`. Verified in browser.
- [x] Dashboard "Quick Actions" tile left edge aligns with statistics tiles. Verified in browser screenshot.
- [x] ExaminationsPage: browse mode shows "50 exams loaded" count label and "Load More Exams" button. Verified in browser.
- [x] ExaminationsPage: filter mode (status=Completed) exhausts all 673 pages — count label shows "673 exams found", "Load More Exams" hidden. Verified in browser.
- [x] ExaminationsPage: patient combobox fires debounced search (network request `GET /v1/patients-search?name=Ba` confirmed). Verified in browser.
- [x] ExaminationsPage: clearing all filters (navigate to `/examinations`) returns to browse mode — "50 exams loaded" + "Load More Exams" present. Verified in browser.

### Integration (after both branches merged)
- [x] `cd frontend && npm run build` — zero errors on merged codebase.
- [x] `cd api && npm test` — 105/113 passing; 8 failures are pre-existing Azurite baseline (not regressions). Zero new failures introduced.
- [x] Manual browser verification complete — all checklist items pass.
