# Implementation Plan — Release 5 Defects and Changes

**Source Spec:** `docs2/defects-r5-req-spec.md`  
**Status:** Ready for implementation

---

## Summary Table

| Task ID  | Title                                          | Complexity | Dependencies        | Status      |
|----------|------------------------------------------------|------------|---------------------|-------------|
| IMPL-001 | Counter helper utility (`adjustCounter`)       | Medium     | —                   | [x] complete |
| IMPL-002 | Increment/decrement counter on patient ops     | Low        | IMPL-001            | [x] complete |
| IMPL-003 | Increment/decrement counter on exam ops        | Low        | IMPL-001            | [x] complete |
| IMPL-004 | Replace O(N) scan in `GetPatientsCount.ts`     | Low        | IMPL-001            | [x] complete |
| IMPL-005 | New `GET /v1/examinations-count` endpoint      | Low        | IMPL-001            | [x] complete |
| IMPL-006 | `getExaminationCount()` in examinationService  | Low        | IMPL-005            | [x] complete |
| IMPL-007 | Dashboard — Total Examinations tile fix        | Low        | IMPL-006            | [x] complete |
| IMPL-008 | Dashboard — Quick Actions layout alignment     | Low        | —                   | [x] complete |
| IMPL-009 | All Exams — Remove inline search field         | Medium     | —                   | [x] complete |
| IMPL-010 | All Exams — Filter-by-Patient combobox         | Medium     | IMPL-009            | [x] complete |
| IMPL-011 | All Exams — Browse mode lazy paging rework     | High       | IMPL-009, IMPL-010  | [x] complete |

---

## Parallel Execution Tracks

```
Track A (Backend — Counters):
  IMPL-001 → IMPL-002, IMPL-003, IMPL-004 (parallel) → IMPL-005 → IMPL-006 → IMPL-007

Track B (Dashboard Layout — fully independent):
  IMPL-008

Track C (All Exams page rework):
  IMPL-009 → IMPL-010 → IMPL-011
```

Tracks A, B, and C are independent of each other and can be worked in parallel by different developers.  
Within Track A: IMPL-002, IMPL-003, and IMPL-004 may be worked in parallel once IMPL-001 is done.

---

## IMPL-001 · Counter helper utility (`adjustCounter`)

**Requirement:** REQ-R5-03-E  
**Complexity:** Medium  
**Dependencies:** none

### Intent
Extract the optimistic-concurrency increment/decrement pattern from `mrnGenerator.ts` into a dedicated `counterService.ts` utility so that all four counter callsites (create patient, delete patient, create exam, delete exam) use identical logic, and counter concerns are cleanly separated from MRN generation concerns.

### Expected Outcomes
- A new file `api/src/utils/counterService.ts` exists and exports `adjustCounter(tableName, partitionKey, rowKey, delta)`.
- The function correctly handles: auto-create when the row does not exist (value = `Math.max(0, delta)`), increment/decrement with ETag optimistic concurrency, exponential-backoff retry up to 5 attempts on 412 conflicts, and the floor-at-zero rule for decrements.
- Counter failures are **non-fatal**: the function catches all errors after exhausting retries, logs them, and resolves normally — callers do not need try/catch.
- `mrnGenerator.ts` is unchanged (it already owns its own MRN counter logic; `adjustCounter` is a new, parallel utility that shares the same table name and partition key constants).

### Todo List
1. Create `api/src/utils/counterService.ts`.
2. Define module-level constants mirroring `mrnGenerator.ts`:
   ```ts
   const COUNTER_TABLE = 'Counters';
   const COUNTER_PARTITION_KEY = 'COUNTER';
   const MAX_RETRIES = 5;
   const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
   ```
3. Implement and export `adjustCounter(tableName: string, partitionKey: string, rowKey: string, delta: number): Promise<void>` with the following logic:
   - Wrap the entire function body in `try/catch` so failures after all retries are swallowed and logged, not thrown.
   - Retry loop up to `MAX_RETRIES` (5).
   - Attempt: `getEntity<Counter>(tableName, partitionKey, rowKey)`.
   - If the entity does not exist: call `createEntity` with `{ partitionKey, rowKey, counterType: rowKey, value: Math.max(0, delta), lastUpdated: now }`. If `createEntity` throws "already exists" (race), fall through to the next iteration.
   - If the entity exists: compute `newValue = Math.max(0, entity.value + delta)`, update `entity.value = newValue` and `entity.lastUpdated = now`, call `updateEntity(tableName, entity)` with the existing ETag.
   - On 412 / "Concurrency conflict" from `updateEntity`: `await sleep(Math.pow(2, attempt) * 100)` then continue.
   - On success (create or update completes without throwing): `return` immediately.
   - Outer catch: `console.error('[counterService] adjustCounter failed after retries:', err)` — do not rethrow.
4. Import `getEntity`, `createEntity`, `updateEntity` from `./tableClient`.
5. Import `Counter` type from `../types`.

### Relevant Context
- `api/src/utils/mrnGenerator.ts` — the retry + exponential-backoff + `initializeCounter` pattern is the exact model to replicate. Copy the structure, not the MRN-specific logic.
- `api/src/utils/tableClient.ts` — `getEntity`, `createEntity`, `updateEntity`.
- `api/src/types/index.ts` — `Counter` interface (`partitionKey`, `rowKey`, `counterType`, `value`, `lastUpdated`).

### Acceptance Criteria
- `api/src/utils/counterService.ts` exists and exports `adjustCounter`.
- Unit test `api/src/tests/utils/counterService.test.ts` covers: first call auto-creates with value 1, subsequent increment increments value, decrement decrements value, decrement at 0 stays at 0, 412 on first attempt retries and succeeds on second, all-retries-fail resolves without throwing.
- `mrnGenerator.ts` is not modified.

---

## IMPL-002 · Increment/decrement counter on patient create and delete

**Requirement:** REQ-R5-03-A, REQ-R5-03-B  
**Complexity:** Low  
**Dependencies:** IMPL-001

### Intent
Wire `adjustCounter` into the patient creation and soft-delete functions so `PATIENT_TOTAL` stays accurate.

### Expected Outcomes
- After a successful `createPatient`, `PATIENT_TOTAL` is incremented by 1.
- After a successful `deletePatient` (soft-delete of the patient row), `PATIENT_TOTAL` is decremented by 1.
- Both calls are fire-and-forget in that a counter failure does not affect the HTTP response.

### Todo List

**`api/src/functions/CreatePatient.ts`:**
1. Import `adjustCounter` from `../utils/counterService`.
2. After the `createEntity` calls (lines 89–90) and the audit log call succeed, add:
   ```
   adjustCounter('Counters', 'COUNTER', 'PATIENT_TOTAL', 1).catch(err =>
     context.error('Failed to increment PATIENT_TOTAL counter:', err)
   );
   ```
3. Do not `await` the counter call so it does not block the response.

**`api/src/functions/DeletePatient.ts`:**
1. Import `adjustCounter` from `../utils/counterService`.
2. After `updateEntity(PATIENTS_TABLE, deletedPatient)` (line 108) succeeds, add a non-awaited decrement call for `PATIENT_TOTAL` with delta `-1`.

### Relevant Context
- `api/src/functions/CreatePatient.ts` — lines 89–99: entity writes, audit log, then `successResponse`.
- `api/src/functions/DeletePatient.ts` — lines 108–120: patient soft-delete entity write, audit log, `successResponse`.

### Acceptance Criteria
- Creating a patient increments `PATIENT_TOTAL` in the `Counters` table.
- Deleting a patient decrements `PATIENT_TOTAL`.
- If the counter call fails, the create/delete response is still `200`/`201`.

---

## IMPL-003 · Increment/decrement counter on examination create and delete

**Requirement:** REQ-R5-03-C, REQ-R5-03-D  
**Complexity:** Low  
**Dependencies:** IMPL-001

### Intent
Wire `adjustCounter` into exam creation and soft-delete functions so `EXAM_TOTAL` stays accurate.

### Expected Outcomes
- After all three `createEntity` calls for an examination succeed, `EXAM_TOTAL` is incremented by 1.
- After a direct examination soft-delete succeeds, `EXAM_TOTAL` is decremented by 1.
- After a cascade-delete in `DeletePatient` completes, `EXAM_TOTAL` is decremented by the count of cascade-deleted examinations.

### Todo List

**`api/src/functions/CreateExamination.ts`:**
1. Import `adjustCounter` from `../utils/counterService`.
2. After line 153 (`createEntity(EXAMINATIONS_TABLE, mrnLookupEntity)`), before the audit log call, add a non-awaited increment:
   ```
   adjustCounter('Counters', 'COUNTER', 'EXAM_TOTAL', 1).catch(err =>
     context.error('Failed to increment EXAM_TOTAL counter:', err)
   );
   ```

**`api/src/functions/DeleteExamination.ts`:**
1. Import `adjustCounter` from `../utils/counterService`.
2. After `updateEntity(EXAMINATIONS_TABLE, deletedPrimaryEntity)` and `updateEntity(EXAMINATIONS_TABLE, deletedMrnLookup)` (i.e., after the three soft-delete updates succeed), add a non-awaited decrement with delta `-1`.

**`api/src/functions/DeletePatient.ts`:**
1. After `cascadeDeleteExaminations(activeExaminations, ...)` returns (line 95), add a non-awaited decrement with `delta = -activeExaminations.length` (if `activeExaminations.length > 0`):
   ```
   if (activeExaminations.length > 0) {
     adjustCounter('Counters', 'COUNTER', 'EXAM_TOTAL', -activeExaminations.length).catch(...);
   }
   ```

### Relevant Context
- `api/src/functions/CreateExamination.ts` — lines 151–155: three `createEntity` calls then audit log.
- `api/src/functions/DeleteExamination.ts` — lines 62–99: three soft-delete `updateEntity` calls.
- `api/src/functions/DeletePatient.ts` — lines 94–96: `cascadeDeleteExaminations` call.
- `api/src/utils/counterService.ts` — the new shared utility (from IMPL-001).

### Acceptance Criteria
- Creating an exam increments `EXAM_TOTAL`.
- Deleting a single exam decrements `EXAM_TOTAL` by 1.
- Cascade-deleting a patient with N active exams decrements `EXAM_TOTAL` by N.
- Counter failures do not affect the HTTP response status.

---

## IMPL-004 · Replace O(N) scan in `GetPatientsCount.ts`

**Requirement:** REQ-R5-03-F  
**Complexity:** Low  
**Dependencies:** IMPL-001 (the counter must exist before reads are meaningful; counter rows are auto-created on first patient creation)

### Intent
Swap the full-table scan with a direct counter row read. The endpoint signature and return shape remain unchanged.

### Expected Outcomes
- `GET /v1/patients-count` reads the `PATIENT_TOTAL` row from `Counters` and returns `{ count: value }`.
- If the row does not exist, returns `{ count: 0 }`.
- No loop over the Patients table.

### Todo List
1. In `api/src/functions/GetPatientsCount.ts`, replace all imports that are no longer needed (`getTableClient`) with imports of `getEntity` from `tableClient` and `Counter` from `../types`.
2. Remove the `for await` loop.
3. Add: `const counter = await getEntity<Counter>('Counters', 'COUNTER', 'PATIENT_TOTAL')`.
4. Return `successResponse({ count: counter ? counter.value : 0 })`.
5. The route, auth, and response shape remain unchanged.

### Relevant Context
- `api/src/functions/GetPatientsCount.ts` — full file; lines 17–25 contain the table scan.
- `api/src/utils/tableClient.ts` — `getEntity(table, partitionKey, rowKey)`.
- Note: `GetPatientsCount.ts` does **not** need to import `counterService` — it just reads the counter row directly. `adjustCounter` is only needed by write operations (create/delete).

### Acceptance Criteria
- The endpoint returns the same shape `{ count: number }`.
- No full-table iteration over the Patients table.
- `patientService.getPatientCount()` and `DashboardPage` require no changes.

---

## IMPL-005 · New `GET /v1/examinations-count` endpoint

**Requirement:** REQ-R5-01-A  
**Complexity:** Low  
**Dependencies:** IMPL-001 (counter row must exist; returns 0 if not)

### Intent
Add a new Azure Function that reads `EXAM_TOTAL` from the `Counters` table and returns `{ count }`.

### Expected Outcomes
- `GET /v1/examinations-count` is a new authenticated endpoint.
- Returns `{ count: <number> }` in the standard success envelope.
- Returns `{ count: 0 }` if the counter row does not yet exist.

### Todo List
1. Create `api/src/functions/GetExaminationsCount.ts`.
2. Follow the exact same structure as `GetPatientsCount.ts` (post-IMPL-004): import `getEntity` from `tableClient`, read `getEntity<Counter>('Counters', 'COUNTER', 'EXAM_TOTAL')`, return `{ count: counter?.value ?? 0 }`. Replace the route with `v1/examinations-count`.
3. Register the function with `app.http('GetExaminationsCount', { methods: ['GET'], authLevel: 'function', route: 'v1/examinations-count', handler: getExaminationsCount })`.
4. Auth: require a valid session via `requireAuth` (same pattern as all other endpoints).

### Relevant Context
- `api/src/functions/GetPatientsCount.ts` — model file (post-IMPL-004).
- `api/src/utils/responseHelpers.ts` — `successResponse`, `unauthorizedResponse`.

### Acceptance Criteria
- `GET /v1/examinations-count` with a valid session returns `200 { success: true, data: { count: number } }`.
- Returns 401 without auth.
- Curl smoke test: endpoint is discoverable by Azure Functions host (function registered via `app.http`).

---

## IMPL-006 · `getExaminationCount()` in `examinationService`

**Requirement:** REQ-R5-01-B  
**Complexity:** Low  
**Dependencies:** IMPL-005

### Intent
Expose the new backend count endpoint to the frontend via the existing service pattern.

### Expected Outcomes
- `examinationService.getExaminationCount()` calls `GET /v1/examinations-count` and returns `Promise<number>`.

### Todo List
1. In `frontend/src/services/examinationService.ts`, add a new method `getExaminationCount(): Promise<number>` to the `ExaminationService` class.
2. The method calls `api.get('/v1/examinations-count')`, extracts `response.data.count` (after envelope unwrap), and returns it as a number.
3. On error, throw a descriptive `Error` consistent with the existing service error-handling pattern.

### Relevant Context
- `frontend/src/services/examinationService.ts` — existing pattern: `api.get(...)`, extract from `response.data`.
- `frontend/src/services/patientService.ts` — `getPatientCount()` is the exact analog to copy.

### Acceptance Criteria
- `examinationService.getExaminationCount()` returns a number.
- TypeScript compiles without error.

---

## IMPL-007 · Dashboard — Total Examinations tile fix

**Requirement:** REQ-R5-01-C, REQ-R5-01-D  
**Complexity:** Low  
**Dependencies:** IMPL-006

### Intent
Replace the incorrect `examinations.length` derivation with a dedicated counter fetch, matching the existing non-fatal pattern used for `totalPatients`.

### Expected Outcomes
- The "Total Examinations" tile reads its value from `getExaminationCount()`, not from `examinations.length`.
- The tile shows `—` while the request is in-flight and on failure.
- Failure to fetch the count does not block the rest of the dashboard.

### Todo List
1. In `frontend/src/pages/DashboardPage.tsx`:
   a. Add `totalExaminations` state: `const [totalExaminations, setTotalExaminations] = useState<number | null>(null)`.
   b. In `loadData`, after the existing non-fatal `getPatientCount` block (lines 46–51), add an analogous block:
      ```
      try {
        const exCount = await examinationService.getExaminationCount();
        setTotalExaminations(exCount);
      } catch (err) {
        console.error('[Dashboard] Failed to load examination count:', err);
      }
      ```
   c. Remove the existing `const totalExaminations = examinations.length;` derived line (line 57).
   d. In the "Total Examinations" tile JSX (line 119): change the display value to `totalExaminations !== null ? totalExaminations : '—'`.
2. The "Exams This Week" and "Pending Reviews" tiles derive from `examinations` (the first page response) — leave those unchanged. They are approximate counts and are not in scope.

### Relevant Context
- `frontend/src/pages/DashboardPage.tsx` — lines 24, 33–51, 57, 117–121 are the primary touch points.
- `frontend/src/services/examinationService.ts` — `examinationService` is already imported.

### Acceptance Criteria
- "Total Examinations" tile shows the counter value from the new endpoint.
- Tile shows `—` (em dash) if the `getExaminationCount` call fails.
- Other tiles and recent-activity panels are unaffected.

---

## IMPL-008 · Dashboard — Quick Actions layout alignment

**Requirement:** REQ-R5-02-A, REQ-R5-02-B, REQ-R5-02-C  
**Complexity:** Low  
**Dependencies:** none

### Intent
Move the Quick Actions `<Tile>` inside a `<Grid narrow>` / `<Column>` wrapper so its edges align with the statistics tiles above and the recent-activity panels below.

### Expected Outcomes
- Quick Actions `<Tile>` left and right edges align with adjacent sections.
- Tile spans all 16 Carbon grid columns.
- Button content inside the tile is unchanged.

### Todo List
1. In `frontend/src/pages/DashboardPage.tsx`, wrap the Quick Actions `<Tile>` (lines 143–156) in:
   ```jsx
   <Grid narrow style={{ marginBottom: '2rem' }}>
     <Column lg={16} md={8} sm={4}>
       <Tile ...>
         ...
       </Tile>
     </Column>
   </Grid>
   ```
2. Remove the standalone `style={{ marginBottom: '2rem' }}` from the `<Tile>` itself (the Grid wrapper takes that margin).
3. Verify `Column` is already imported; if not, add it to the `@carbon/react` import list (it is already imported on line 6).

### Relevant Context
- `frontend/src/pages/DashboardPage.tsx` — lines 143–156: the Quick Actions tile.
- The statistics tiles (lines 106–139) use `<Grid narrow>` + `<Column lg={4}>` as the reference.

### Acceptance Criteria
- Quick Actions tile visually aligns with statistics tiles when rendered in the browser.
- No change to button labels, handlers, or icons.
- TypeScript compiles without error.

---

## IMPL-009 · All Exams — Remove inline search field

**Requirement:** REQ-R5-08-A, REQ-R5-08-B, REQ-R5-08-C  
**Complexity:** Medium  
**Dependencies:** none

### Intent
Remove the `<TableToolbarSearch>` and all its supporting state/logic from `ExaminationsPage`. The Create Exam button should remain accessible but moved outside the `<DataTable>` render-prop or re-situated within the toolbar if another toolbar element remains — mirroring the `PatientsPage` pattern.

### Expected Outcomes
- No `<TableToolbarSearch>` in the rendered output.
- No `searchQuery` state, `handleSearch` callback, `searchTimerRef`, `searchAbortRef`, `isSearching`, or `searchInfo` state.
- The `<TableToolbar>` / `<TableToolbarContent>` wrapper is removed if it only contained the search field and the Create Exam button. The Create Exam button is moved outside `<DataTable>`.
- `isFilterActive` no longer references `searchQuery`.
- `activeFilterSummary` no longer includes a search clause.
- `clearAllFilters` no longer resets `searchQuery` or `searchInfo`.
- `hasMore` condition no longer gates on `searchQuery.trim().length < 2`.
- `TableToolbar`, `TableToolbarContent`, `TableToolbarSearch` imports removed from `@carbon/react` import (unless still used elsewhere in the file).
- The search-mode `<ActionableNotification>` banner (lines 509–520) is removed.
- The `<InlineNotification>` 2-char hint (lines 497–506) is removed.
- The `searchAbortRef` cleanup in the unmount effect (line 183) is removed.
- URL param `q` is no longer read or written.

### Todo List
1. Remove state declarations: `searchQuery`, `isSearching`, `searchInfo`.
2. Remove ref declarations: `searchTimerRef`, `searchAbortRef`.
3. Remove `handleSearch` callback function.
4. Remove the `loadPatients` call from the initial URL-derived state (keep `q` removal) — the URL `searchParams.get('q')` initializer is removed.
5. Remove the search-mode `<ActionableNotification>` banner JSX.
6. Remove the `<InlineNotification>` info hint JSX.
7. Remove the `<TableToolbar>`, `<TableToolbarContent>`, `<TableToolbarSearch>` JSX and move the Create Exam `<Button>` out of `<DataTable>` entirely (place it in the filter bar `<div>`, aligned to the right, matching `PatientsPage` layout).
8. Update `isFilterActive` (line 335): remove `|| searchQuery.trim().length >= 2`.
9. Update `activeFilterSummary` (lines 338–344): remove the `searchQuery` clause.
10. Update `clearAllFilters`: remove `setSearchQuery('')` and `setSearchInfo(null)`.
11. Update `hasMore` guard (line 696): remove `&& searchQuery.trim().length < 2` — becomes simply `{hasMore && (...)`.
12. Remove `TableToolbar`, `TableToolbarContent`, `TableToolbarSearch` from the `@carbon/react` import block (line 12–14).
13. Remove `searchAbortRef.current?.abort()` from the unmount cleanup effect.
14. Remove `q` read/write from `setSearchParams` calls.

### Relevant Context
- `frontend/src/pages/ExaminationsPage.tsx` — full file (709 lines). Key lines: 85–87 (state), 97–103 (refs), 240–306 (handleSearch), 335, 338–344, 347–358 (clearAllFilters), 509–520 (search banner), 540–568 (toolbar JSX), 696 (hasMore condition).
- `frontend/src/pages/PatientsPage.tsx` — lines 280–290: Create Patient button placement outside DataTable as reference.

### Acceptance Criteria
- No `<TableToolbarSearch>` in the rendered JSX.
- TypeScript compiles without error.
- All references to `searchQuery` are gone.
- The Create Exam button still appears and navigates to `/examinations/new`.
- All existing filter controls (patient, status, type, date) still function.

---

## IMPL-010 · All Exams — Filter by Patient combobox

**Requirement:** REQ-R5-09-A through REQ-R5-09-G  
**Complexity:** Medium  
**Dependencies:** IMPL-009 (the `loadPatients` function and `patients` state it populates must already be removed; this task replaces the `<Select>` with a `<ComboBox>`)

### Intent
Replace the `<Select id="patientFilter">` with a Carbon `<ComboBox>` backed by a debounced `patientService.searchPatients()` call. Selected patient name is tracked in a separate state variable for the filter summary.

### Expected Outcomes
- `<Select id="patientFilter">` is replaced by `<ComboBox>` with type-ahead search.
- The `patients` state array and `loadPatients` function are removed.
- A new `selectedPatientName` state variable tracks the display name for the filter summary.
- Patient search is debounced 350 ms and fires only on 2+ characters.
- An `<InlineLoading>` indicator appears during patient search.
- Selecting a patient sets `selectedPatientId` and reloads exams.
- Clearing the input clears `selectedPatientId` and returns to browse mode (if no other filter active).
- Editing the combobox text after a patient is selected does not clear the active exam filter until a new explicit action (new selection or full clear).
- `activeFilterSummary` uses `selectedPatientName` instead of `patients.find(...)`.

### Todo List
1. Remove `patients` state (`useState<Patient[]>([])`) and its `Patient` type import (if `Patient` is only used there).
2. Remove the `loadPatients` `useCallback` function and its call in the mount `useEffect`.
3. Add new state:
   - `patientSearchResults: Patient[]` (empty array default) — dropdown options.
   - `patientSearchInput: string` (empty string) — the text currently typed in the combobox.
   - `selectedPatientName: string` (empty string) — name of the currently selected patient (committed).
   - `isPatientSearching: boolean` (false) — shows the inline loading indicator.
4. Add a `patientSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)` for debounce.
5. Add a `patientSearchAbortRef = useRef<AbortController | null>(null)` for abort on new keystroke.
6. Add cleanup of `patientSearchTimerRef` and `patientSearchAbortRef` in the unmount effect.
7. Implement `handlePatientComboInputChange(value: string)`:
   - Update `patientSearchInput` state.
   - If `value` is empty: clear `selectedPatientId`, clear `selectedPatientName`, clear `patientSearchResults`, reset exam filter (call `loadExaminations` with no patient filter), update URL.
   - If fewer than 2 chars: clear `patientSearchResults` (no API call), do NOT clear `selectedPatientId` (preserves the active filter while typing).
   - If 2+ chars: debounce 350 ms, abort previous search, call `patientService.searchPatients(value, signal)`, set `patientSearchResults`, set `isPatientSearching` during call.
8. Implement `handlePatientComboSelect(selectedItem: Patient | null)`:
   - If `selectedItem` is null (Escape / clear): clear `selectedPatientId`, clear `selectedPatientName`, reload exams without patient filter, update URL.
   - If `selectedItem` is a patient: set `selectedPatientId = selectedItem.patientId`, set `selectedPatientName = selectedItem.name`, set `patientSearchInput = selectedItem.name`, call `handlePatientFilter(selectedItem.patientId)`.
9. Replace the `<Select id="patientFilter">` JSX with:
   ```jsx
   <ComboBox
     id="patientFilter"
     titleText="Filter by Patient"
     placeholder="Type to search patients..."
     items={patientSearchResults}
     itemToString={(item) => item?.name ?? ''}
     inputValue={patientSearchInput}
     onInputChange={handlePatientComboInputChange}
     onChange={({ selectedItem }) => handlePatientComboSelect(selectedItem)}
     disabled={isLoading}
   />
   {isPatientSearching && <InlineLoading description="Searching..." style={{ width: 'auto' }} />}
   ```
10. Import `ComboBox` from `@carbon/react`.
11. Update `activeFilterSummary` (was `patients.find(...)?.name`): use `selectedPatientName` directly.
12. Update `clearAllFilters`: add `setSelectedPatientName('')`, `setPatientSearchInput('')`, `setPatientSearchResults([])`.
13. Remove the `Select`, `SelectItem` imports from `@carbon/react` only if they are no longer used anywhere else in the file (Status filter and Type filter still use `<Select>`).

### Relevant Context
- `frontend/src/pages/ExaminationsPage.tsx` — lines 67 (`patients` state), 105–112 (`loadPatients`), 164–165 (mount call), 400–418 (`<Select id="patientFilter">` JSX), 338 (`patients.find(...)` in `activeFilterSummary`), 347–348 (`clearAllFilters`).
- `frontend/src/services/patientService.ts` — `searchPatients(query, signal?)` returns `Promise<Patient[]>`.
- Carbon `<ComboBox>` API: `items`, `itemToString`, `inputValue`, `onInputChange`, `onChange({ selectedItem })`.

### Acceptance Criteria
- Typing 2+ chars in the combobox triggers a debounced search and shows results in the dropdown.
- Selecting a result sets the patient filter and reloads exams.
- Pressing Escape or clearing the input removes the patient filter.
- Editing the input after selection does not re-trigger exam reload until a new selection or full clear.
- `<InlineLoading>` shows during the search API call.
- `activeFilterSummary` correctly shows the patient name when a patient is selected.

---

## IMPL-011 · All Exams — Browse/filter mode with lazy paging and count label

**Requirement:** REQ-R5-04, REQ-R5-05, REQ-R5-06, REQ-R5-07  
**Complexity:** High  
**Dependencies:** IMPL-009, IMPL-010

### Intent
Rework `ExaminationsPage` to implement two distinct data-loading modes:

- **Browse mode** (no active filter): lazy paging via continuation tokens with a "Load More Exams" button.
- **Filter mode** (any filter active): automatic sequential page exhaustion with progressive display and a count label with trailing ellipsis during loading.

Replace the `<TableContainer title/description>` with the inline title+count pattern from `PatientsPage`.

### Expected Outcomes
- `<TableContainer title="...">` and `description` props removed; replaced with an inline title `<div>` inside `<TableContainer>`.
- Count label text follows the spec rules: `N exam loaded` (browse) / `N exams found` (filter), with trailing `…` during filter-mode exhaustion.
- In browse mode: only the first server page is loaded on mount; "Load More Exams" button appears if `continuationToken` exists.
- In filter mode: sequential page exhaustion runs automatically; `<InlineLoading>` displayed during exhaustion; table updates incrementally; "Load More Exams" hidden.
- Transitioning from filter → browse (clear all filters) resets to first page + lazy mode.
- Abort controller cancels in-flight exhaustion if filter changes.

### Recommended Function Structure

Split the single `loadExaminations` function into three clearly named, single-responsibility functions. This avoids a tangle of `mode`, `append`, and `token` flags in one function body, and makes the two modes self-documenting:

| Function | Responsibility |
|----------|----------------|
| `fetchOnePage(opts, signal)` | Pure data fetcher — calls `examinationService.getExaminations`, returns `{ examinations, continuationToken }`, sets no state. Used by the other two functions. |
| `startBrowse(opts?)` | Browse-mode entry point — calls `fetchOnePage` once, sets `examinations`, `continuationToken`, `hasMore`, `isLoading`. Called on mount (no filters) and by `clearAllFilters`. |
| `startFilterExhaustion(opts)` | Filter-mode entry point — loops `fetchOnePage` until no token remains, appending each page to `examinations` state after each page arrives. Sets `isExhausting` to true on entry, false on completion or abort. Called by every filter handler. |

`useCallback` wrapping: `fetchOnePage` needs no `useCallback` (it is called only from the other two). `startBrowse` and `startFilterExhaustion` should be `useCallback`-wrapped so filter handlers can list them as dependencies without stale-closure issues.

### Todo List

**1. State changes:**
- Remove `filteredExaminations` state (no longer needed — `examinations` is the single loaded set).
- Add `isExhausting: boolean` state — true while filter-mode auto-pagination is in progress.
- All references to `filteredExaminations` → change to `examinations`.

**2. Rework `loadExaminations`:**
- Remove the `append` parameter from the function signature and internal split (the function always replaces the set on a fresh filter call).
- Rename the existing function to `fetchOnePage(opts)` — it fetches exactly one page and returns the result (does not set state directly).
- Add a new async function `startBrowse(opts?)`: calls `fetchOnePage` with no continuation token, sets `examinations`, sets `continuationToken`, sets `hasMore`.
- Add a new async function `startFilterExhaustion(opts)`: 
  - Clears `examinations`, sets `isExhausting = true`.
  - Loop: `fetchOnePage(opts + currentToken)` → append to running list → update `examinations` state (incremental) → if response has `continuationToken`, continue; else break.
  - On abort (AbortError): silently return.
  - On completion: set `isExhausting = false`, `hasMore = false`.
  - Uses `loadAbortRef` (abort if filter changes mid-exhaustion).

**3. Filter handlers:**
- All existing filter handlers (`handlePatientFilter`, `handleStatusFilter`, `handleExamTypeFilter`, `handleDateFilter`) must call `startFilterExhaustion(activeFilters)` instead of `loadExaminations(...)`.
- `clearAllFilters` must call `startBrowse()` (resets to browse mode).
- Mount `useEffect`: call `startBrowse(urlFilters)` if no active filter, else call `startFilterExhaustion(urlFilters)`.

**4. `handleLoadMore`:**
- Only valid in browse mode; calls `fetchOnePage({ ...activeBrowseFilters, token: continuationToken, append: true })` and appends results to `examinations`.

**5. "Load More Exams" button:**
- Render condition: `hasMore && !isFilterActive` (hidden in filter mode).
- Label: "Load More Exams" (was "Load More Tests" — fix the label).

**6. `<InlineLoading>` for filter exhaustion:**
- Render `<InlineLoading description="Loading all results..." />` when `isExhausting` is true (place below the filter bar, above the table).

**7. Count label — replace `<TableContainer title/description>`:**
- Remove `title="All Exams"` and `description={...}` from `<TableContainer>`.
- Inside `<TableContainer>`, before `<Table>`, add:
  ```jsx
  <div style={{ padding: '1rem 1rem 0.5rem' }}>
    <span style={{ fontWeight: 700, fontSize: '1rem' }}>Exam List</span>
    <span style={{ fontWeight: 400, fontSize: '0.75rem', marginLeft: '0.5rem', color: '#525252' }}>
      {countLabel}
    </span>
  </div>
  ```
- Derive `countLabel`:
  ```
  const N = examinations.length;
  const examWord = N === 1 ? 'exam' : 'exams';
  if (isFilterActive) {
    countLabel = isExhausting ? `${N} ${examWord} found…` : `${N} ${examWord} found`;
  } else {
    countLabel = `${N} ${examWord} loaded`;
  }
  ```

**8. `totalItems` / `allRows`:**
- `allRows` and `paginatedRows` should reference `examinations` (not `filteredExaminations`).
- `totalItems = examinations.length` (no change in concept, just the source).

**9. Pagination:**
- `<Pagination totalItems={totalItems}>` already works off `examinations.length` after step 8. No structural change needed; the Pagination reflects the full loaded set.

**10. `isFilterActive`:**
- After IMPL-009: `!(selectedPatientId || selectedStatus || selectedExamType || fromDate || toDate)` — no `searchQuery`.

### Relevant Context
- `frontend/src/pages/ExaminationsPage.tsx` — the full file is the subject of this task.
- `frontend/src/pages/PatientsPage.tsx` — lines 292–310: reference for `<TableContainer>` title pattern.
- `frontend/src/services/examinationService.ts` — `getExaminations(opts)` returns `{ examinations, continuationToken? }`.

### Acceptance Criteria
- In browse mode, opening the page loads only the first server page. "Load More Exams" button appears if there are more pages.
- Clicking "Load More Exams" appends the next page and increments the count label.
- In filter mode, applying a filter triggers automatic page exhaustion. The count label shows `N exams found…` during exhaustion, then `N exams found` when done.
- `<InlineLoading>` is visible during filter-mode exhaustion.
- Changing a filter while exhaustion is in progress aborts the in-flight request and starts a new exhaustion for the new filter.
- Clearing all filters returns to browse mode (first page only, "Load More Exams" visible if applicable).
- Count label reads `N exam loaded` (singular) / `N exams loaded` (plural) in browse mode.
- "Load More Exams" button is hidden when any filter is active.
- TypeScript compiles without error.

---

## Post-Implementation Checklist

- [x] Run `cd api && npm test` — 105/113 passing; 8 pre-existing Azurite failures = baseline. New `counterService.test.ts` 6/6 pass.
- [x] `GET /v1/patients-count` no longer scans the table — direct `getEntity<Counter>` read implemented.
- [x] TypeScript build: `cd frontend && npm run build` — zero type errors.
- [x] `GET /v1/examinations-count` returns `{ count: 7 }` — confirmed via Dashboard tile and intercepted network response.
- [x] Dashboard: "Total Examinations" tile shows 7 (counter value, not array length). Verified in browser.
- [x] Dashboard: "Quick Actions" tile left/right edges align with statistics tiles and panels. Verified in browser screenshot.
- [x] ExaminationsPage: browse mode shows "50 exams loaded" + "Load More Exams" button on mount. Verified in browser.
- [x] ExaminationsPage: filter mode (status=Completed) auto-exhausts all pages, shows "673 exams found". Verified in browser.
- [x] ExaminationsPage: patient combobox triggers debounced `GET /v1/patients-search?name=Ba` after 350ms. Verified via network inspector.
- [x] ExaminationsPage: removing all filters (navigate to `/examinations`) returns to browse mode — "50 exams loaded" + "Load More Exams". Verified in browser.
