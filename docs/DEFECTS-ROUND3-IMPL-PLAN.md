# Implementation Plan – Defects Round 3

**Source spec:** `docs/DEFECTS-ROUND3-REQ-SPEC.md`  
**Scope:** Search and filter correctness across `PatientsPage`, `ExaminationsPage`, and `PatientDetailPage`.  
**Status key:** `[ ] pending` · `[x] done`

---

## Top-Level Overview

Round 3 targets five search/filter defects and two UX consolidation requirements. The work spans:

- **One backend function** (`GetExaminations.ts`) that must grow a `patient_name` OData range filter and fix two pre-existing parameter-reading gaps (`patient_id` vs `patientId`, and missing `status` / date filters).
- **One frontend service** (`examinationService.ts`) that must carry a new `patientName` param.
- **Two frontend pages** (`ExaminationsPage.tsx`, `PatientsPage.tsx`) that receive the bulk of the changes: URL-state sync, AbortController request cancellation, server-side search wiring, search-vs-browse mode UI, and improved empty states.
- **One trivial hotfix** in `PatientDetailPage.tsx` (P0 crash fix, KI-001) that must ship first.

Tasks are ordered so that each one is independently reviewable and testable.

---

## Pre-existing Backend Gap (not in the req spec, but blocks correct behaviour)

> **IMPORTANT:** A code audit during planning revealed that `GetExaminations.ts` currently:
> 1. Reads the patient filter as `patientId` (line 20) but the frontend service sends it as `patient_id`. The patient dropdown filter on `ExaminationsPage` is silently broken in production.
> 2. Does **not** read `status`, `from_date`, or `to_date` query parameters at all. Status and date filters on `ExaminationsPage` are also silently broken.
>
> These gaps must be fixed as part of Task 2 (the backend change for REQ-3-02), since all three are in the same backend function and fixing them alongside the new `patient_name` param is the smallest-footprint approach.

---

## Sub-Tasks

---

### Task 1 · KI-001 Hotfix — Fix crash on `PatientDetailPage`

**Status:** `[x] done`

#### Intent
`InlineLoading` is used on line 331 of `PatientDetailPage.tsx` but is absent from the `@carbon/react` import block. This causes an intermittent P0 crash (React renders `undefined`). This must be fixed before any other work because it is a production blocker and has zero coupling to the other tasks.

#### Expected Outcomes
- Navigating to any patient detail page no longer triggers the "Something went wrong" error boundary, regardless of API response timing.
- The loading spinner appears correctly while examinations are being fetched.

#### Todo List
1. Open `frontend/src/pages/PatientDetailPage.tsx`.
2. In the existing `@carbon/react` import block (line 2–22), add `InlineLoading` to the list of named imports.
3. No other changes to this file.

#### Relevant Context
- `frontend/src/pages/PatientDetailPage.tsx`, lines 1–22 (import block) and line 331 (`isLoadingExaminations ? <InlineLoading ... />`).
- `docs/KNOWN-ISSUES.md` KI-001 documents the root cause in full.

---

### Task 2 · Backend — Fix `GetExaminations` query parameter reading and add `patient_name` filter

**Status:** `[x] done`

#### Intent
`GetExaminations.ts` has two pre-existing silent bugs (wrong `patientId` param name; `status` and date params not read) that must be fixed now. REQ-3-02 also requires a new `patient_name` OData range-scan filter scoped only to the `EXAM` partition. Because Azure Table Storage OData comparisons are **case-sensitive by design** and `patientName` is stored in mixed case (verbatim from `patient.name` — see `CreateExamination.ts` line 91/118), a true case-insensitive OData filter is not possible. The approved approach is to **normalise the incoming `patient_name` query value to lower-case on the backend** and **store a parallel `patientNameLower` property** on each `EXAM` partition row so the range scan operates on a predictable lower-case field. This requires a one-time data migration for existing rows and a write-path change in `CreateExamination.ts` and `UpdateExamination.ts`.

#### Expected Outcomes
- `GET /v1/examinations?patient_id=<id>` correctly scopes to that patient's `PATIENT_<id>` partition.
- `GET /v1/examinations?status=completed` correctly filters by `status eq 'completed'`.
- `GET /v1/examinations?from_date=2024-01-01&to_date=2024-12-31` correctly filters by `examDate ge '2024-01-01' and examDate le '2024-12-31'`.
- `GET /v1/examinations?patient_name=Smith` (only when no `patient_id`) lower-cases the query to `"smith"` and appends: `and patientNameLower ge 'smith' and patientNameLower lt 'smith\uFFFF'`.
- All four parameters compose correctly (e.g. `?patient_name=smith&status=draft&from_date=2024-01-01&to_date=2024-06-30`).
- No `patient_name` filter is appended when `patient_id` is present (redundant, per spec).
- `CreateExamination.ts` writes `patientNameLower: patient.name.toLowerCase()` alongside `patientName` on both the `EXAM` and `PATIENT_<id>` partition rows.
- `UpdateExamination.ts` — `patientName` is not an updatable field (the patient is fixed at creation time); no change needed there.
- Existing `EXAM` rows that pre-date this change lack `patientNameLower`; a one-time backfill script must be run after deploy (see Technical Notes).

#### Todo List
1. Open `api/src/functions/CreateExamination.ts`.
   - Add `patientNameLower: patient.name.toLowerCase()` to **both** `primaryExamEntity` (line 85) and `lookupExamEntity` (line 112). This is the write-path change that makes new records searchable case-insensitively.
2. Open `api/src/functions/GetExaminations.ts`.
3. **Fix `patient_id` param name** (line 20): change `request.query.get('patientId')` → `request.query.get('patient_id')`.
4. **Add `status` param reading** after line 23: `const status = request.query.get('status') || undefined;`
5. **Add date params reading**: `const fromDate = request.query.get('from_date') || undefined;` and `const toDate = request.query.get('to_date') || undefined;`
6. **Add `patient_name` param reading and normalisation**: `const patientNameRaw = request.query.get('patient_name') || undefined;` then `const patientName = patientNameRaw ? patientNameRaw.toLowerCase() : undefined;`
7. **Wire `status` filter**: after the existing `if (examinationType)` block, add: `if (status) { filter += \` and status eq '${status}'\`; }`
8. **Wire date filters**: `if (fromDate) { filter += \` and examDate ge '${fromDate}'\`; }` and `if (toDate) { filter += \` and examDate le '${toDate}'\`; }`
9. **Wire `patient_name` range filter on `patientNameLower`**: only inside the `else` branch (EXAM partition, no `patient_id`): `if (patientName) { filter += \` and patientNameLower ge '${patientName}' and patientNameLower lt '${patientName}\uFFFF'\`; }`
10. Update the `context.log` call to include the new params in its log object.
11. **Write backfill script** `api/scripts/backfill-patient-name-lower.ts`: iterate all `EXAM` partition rows via `tableClient.listEntities`, and for any row where `patientNameLower` is absent or empty, call `tableClient.updateEntity` (with `etag: "*"`) to set `patientNameLower = patientName.toLowerCase()`. This script is a one-shot operational tool — run once after deploying the new `CreateExamination.ts`.

#### Relevant Context
- `api/src/functions/CreateExamination.ts` lines 85–136 (entity construction) — `patientName` is written as `patient.name` verbatim with no normalisation.
- `api/src/functions/GetExaminations.ts` — full file, particularly lines 19–48 (param reading and filter construction).
- `api/src/utils/tableClient.ts` — `queryEntities` helper already uses `\uFFFF` as upper-bound sentinel for range scans; this is the established project pattern.
- `api/src/functions/SearchPatients.ts` — reference implementation for OData prefix range scans.
- `AGENTS.md` note: "Row key prefix queries use `\uFFFF` (not ASCII `~`) as the upper-bound sentinel."
- Azure Table Storage does **not** support OData `tolower()` or any case-folding function — the only correct approach is a pre-normalised lower-case shadow property.

---

### Task 3 · Frontend Service — Add `patientName` to `GetExaminationsOptions`

**Status:** `[x] done`

#### Intent
The frontend service must be able to pass the new `patient_name` query parameter to the backend introduced in Task 2.

#### Expected Outcomes
- `examinationService.getExaminations({ patientName: 'smith' })` sends `?patient_name=smith` in the request.
- Existing callers with no `patientName` are unaffected.

#### Todo List
1. Open `frontend/src/services/examinationService.ts`.
2. Add `patientName?: string;` to the `GetExaminationsOptions` interface (after `examinationType`, before `continuationToken`).
3. In the `getExaminations` method params-building block, add: `if (opts.patientName) params.patient_name = opts.patientName;` (after the `examinationType` mapping on line 43).

#### Relevant Context
- `frontend/src/services/examinationService.ts`, lines 9–16 (`GetExaminationsOptions` interface) and lines 36–45 (params building).

---

### Task 4 · REQ-3-05 — URL-synchronised state on `ExaminationsPage`

**Status:** `[x] done`

#### Intent
All filter and search state on `ExaminationsPage` must be stored in the URL so that the browser back button restores the exact view the user left. This is listed as a prerequisite for REQ-3-02 and REQ-3-03 in the spec, since URL state becomes the source of truth for filter restoration.

**Deep-link clarification (resolved):** `PatientDetailPage` line 142 navigates to `/examinations/new?patientId=${id}` which routes to `CreateExaminationPage`, **not** `ExaminationsPage`. There is no legacy `?patient_id=` deep-link into `ExaminationsPage`; no translation shim is needed.

**Client-side pagination note (resolved):** `pageSize` is excluded from URL sync per spec AC6. The `page` URL param is restored by setting `page` state on mount; no additional server fetch is needed for page restoration alone since pagination is client-side over `filteredExaminations`.

#### Expected Outcomes
- Navigating to `/examinations?status=completed&type=ultrasound_prenatal&from=2024-01-01&to=2024-12-31&q=smith&page=2` restores all filter controls and loads the correct data without user interaction.
- Changing a dropdown writes `?param=value` to the URL (browser history push — back button restores prior filter).
- Typing in the search box updates `?q=…` with `{ replace: true }` (no extra history entries per keystroke).
- `pageSize` is NOT URL-synchronised (per spec AC6).
- No legacy `?patient_id=` translation shim needed for `ExaminationsPage`.

#### Todo List
1. Open `frontend/src/pages/ExaminationsPage.tsx`.
2. Add `useSearchParams` to the `react-router-dom` import.
3. Add `const [searchParams, setSearchParams] = useSearchParams();` inside the component, before state declarations.
4. **Replace `useState` initialisers** for `selectedPatientId`, `selectedStatus`, `selectedExamType`, `fromDate`, `toDate`, `searchQuery`, `page` with values read from `searchParams.get(...)` using the correct param keys (`patient`, `status`, `type`, `from`, `to`, `q`, `page`). Use appropriate defaults (`''` for strings, `1` for page via `Math.max(1, parseInt(..., 10) || 1)`).
5. For `fromDate` and `toDate`: the URL stores ISO format (`2024-01-01`); the `DatePicker` `value` prop expects `dd/mm/yyyy` — use the existing `toDisplayDate()` helper (line 40) when populating the `DatePicker` value prop on initial render.
6. **Write URL on filter change**: in each filter handler (`handlePatientFilter`, `handleStatusFilter`, `handleExamTypeFilter`, `handleDateFilter`), call `setSearchParams(newParams)` (no `{ replace: true }` — this is a push, enabling back-button restoration). Build `newParams` by copying all current params and updating only the changed key.
7. **Write URL on search**: inside `handleSearch`, call `setSearchParams(newParams, { replace: true })` with the updated `q` value. This write fires inside the existing debounce — the URL write and API call are co-located in the same debounce callback.
8. **Write URL on page change**: in the `Pagination` `onChange` handler, call `setSearchParams(newParams)` with the updated `page` value.
9. On mount, after reading URL state, trigger `loadExaminations()` with the URL-derived filter values so the correct filtered data is fetched immediately.

#### Relevant Context
- `frontend/src/pages/ExaminationsPage.tsx`, lines 56–75 (state declarations), lines 129–132 (mount effect), lines 154–202 (filter handlers).
- `PatientDetailPage.tsx` line 142: navigates to `/examinations/new?patientId=…` (targets `CreateExaminationPage`, not `ExaminationsPage`) — no conflict.
- React Router v6 `useSearchParams` — already available in the project's router setup.
- `toDisplayDate()` is defined at line 40 of `ExaminationsPage.tsx`.

---

### Task 5 · REQ-3-05 — URL-synchronised state on `PatientsPage`

**Status:** `[x] done`

#### Intent
Mirror the URL-sync approach from Task 4 for `PatientsPage`. Only `q` (search query) and `page` need to be synchronised per spec AC7–10. `pageSize` is excluded from URL sync (client-side preference, per the confirmed answer to open question 4).

#### Expected Outcomes
- Navigating to `/patients?q=smith&page=2` restores the search results for "smith" and shows page 2.
- Typing updates `?q=…` with `{ replace: true }`.
- Page changes write `?page=N` (push).
- On mount, if `q` is 2+ chars, `handleSearch(q)` fires automatically to restore the search result set.
- `pageSize` is NOT URL-synchronised — it remains pure local state.

#### Todo List
1. Open `frontend/src/pages/PatientsPage.tsx`.
2. Add `useSearchParams` to the `react-router-dom` import (currently only `useNavigate` is imported).
3. Add `const [searchParams, setSearchParams] = useSearchParams();` inside the component.
4. Initialise `searchQuery` from `searchParams.get('q') || ''` and `page` from `Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)`. Do not read or write `pageSize` to the URL.
5. In `handleSearch`, call `setSearchParams(newParams, { replace: true })` with the updated `q` value. This write fires inside the debounce callback (300 ms) — co-located with the API call.
6. In the `Pagination` `onChange` handler, call `setSearchParams(newParams)` with the updated `page` (push — back button can restore page).
7. In the mount `useEffect`, if `searchParams.get('q')` is 2+ chars, call `handleSearch(q)` to restore the search result set. This must run after `loadPatients()` to avoid a race where `handleSearch` calls `setFilteredPatients` before the initial load has populated `patients`.

#### Relevant Context
- `frontend/src/pages/PatientsPage.tsx`, lines 1–5 (imports), lines 33–46 (state declarations), lines 66–119 (search handler and mount effect).
- Note: the mount effect ordering matters — `loadPatients()` and `handleSearch(q)` should not fire concurrently if `q` is set; `handleSearch` uses the dedicated `searchPatients` service and does not depend on `patients` state being populated first. They can fire in parallel safely.

---

### Task 6 · REQ-3-03 — Synchronous continuation-token reset on filter change

**Status:** `[x] done`

#### Intent
Three filter handlers in `ExaminationsPage` do not reset `continuationToken` synchronously before loading. This creates a narrow window where "Load More" could fire with a stale token from the previous filter set, producing incorrect Azure Table Storage results.

#### Expected Outcomes
- `handlePatientFilter`, `handleStatusFilter`, and `handleDateFilter` each call `setContinuationToken(undefined)` as their first statement.
- `handleExamTypeFilter` already has this call (line 169) — it must be preserved unchanged.
- After Task 8 is complete, `handleSearch` also calls `setContinuationToken(undefined)` before the debounced API call.
- The "Load More" button remains disabled while `isLoading` is `true` (existing behaviour preserved).

#### Todo List
1. Open `frontend/src/pages/ExaminationsPage.tsx`.
2. In `handlePatientFilter` (line 154): add `setContinuationToken(undefined);` as the first line of the function body (before `setSelectedPatientId`).
3. In `handleStatusFilter` (line 160): add `setContinuationToken(undefined);` as the first line of the function body.
4. In `handleDateFilter` (line 173): add `setContinuationToken(undefined);` as the first line of the function body.
5. Verify `handleExamTypeFilter` (line 169) already has `setContinuationToken(undefined)` — make no change.

#### Relevant Context
- `frontend/src/pages/ExaminationsPage.tsx`, lines 154–176 (the four filter handlers).
- `DEFECTS-ROUND3-REQ-SPEC.md` REQ-3-03 Technical Notes: "The fix is three one-line insertions."

---

### Task 7 · REQ-3-06 — Disable filter selects during loading; add `dateTimerRef` debounce

**Status:** `[x] done`

#### Intent
Filter inputs must be disabled while a fetch is in-flight so the user cannot dispatch a second conflicting request. The `DatePicker` also needs a debounce to avoid firing an API call when only one date of a range has been picked.

#### Expected Outcomes
- All three `<Select>` dropdowns in `ExaminationsPage` (`patientFilter`, `statusFilter`, `examTypeFilter`) have `disabled={isLoading}`.
- The `DatePicker` `onChange` wraps the `handleDateFilter` call in a 300 ms debounce via a new `dateTimerRef` ref.
- `isLoading` is `true` during any fetch (already set in `loadExaminations`; no new state needed).

#### Todo List
1. Open `frontend/src/pages/ExaminationsPage.tsx`.
2. Add `const dateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);` alongside the existing `searchTimerRef` (line 77).
3. Add a cleanup for `dateTimerRef` to the existing unmount `useEffect` (line 135–141).
4. In the `DatePicker` `onChange` handler (line 312–322): wrap the `handleDateFilter(from, to)` and `handleDateFilter('', '')` calls inside a `dateTimerRef`-based 300 ms debounce (clear previous timer, set new one). The `setFromDate` / `setToDate` calls (lines 313–315) remain outside the debounce so the UI reflects the selected dates immediately.
5. Add `disabled={isLoading}` to the `patientFilter` `<Select>` (line 258).
6. Add `disabled={isLoading}` to the `statusFilter` `<Select>` (line 276).
7. Add `disabled={isLoading}` to the `examTypeFilter` `<Select>` (line 289).

#### Relevant Context
- `frontend/src/pages/ExaminationsPage.tsx`, lines 77 (`searchTimerRef`), 135–141 (unmount cleanup), 256–335 (filter bar rendering).
- REQ-3-06 Technical Notes: "The `isLoading` state in `ExaminationsPage` is already set to `true` at the start of `loadExaminations` (line 97) and to `false` in the `finally` block (line 125)."

---

### Task 8 · REQ-3-02 — Wire server-side examination name search in `ExaminationsPage`

**Status:** `[x] done`
**Prerequisite:** Tasks 2, 3, 4, 6 must be complete before this task.

#### Intent
`handleSearch` currently filters the in-memory `examinations` array (`applyFilters`). It must be replaced with an API call that passes `patientName` to the backend (Task 2), composable with all current dropdown filters.

#### Expected Outcomes
- Typing 2+ characters in the `TableToolbarSearch` box triggers `examinationService.getExaminations({ ..., patientName: query })` after a 200 ms debounce.
- The search is composable: active dropdown filter values (`selectedPatientId`, `selectedStatus`, `selectedExamType`, `fromDate`, `toDate`) are included in the search request.
- While the debounce is pending or the request is in-flight, an `InlineLoading` spinner appears in the toolbar (new `isSearching` state variable).
- Fewer than 2 characters: show an `InlineNotification kind="info"` hint "Type at least 2 characters to search" and restore the full list (call `loadExaminations()` with current filters).
- Empty query: clear the hint and call `loadExaminations()` with current filters to restore browse mode.
- `setContinuationToken(undefined)` is called before the debounced API call fires (REQ-3-03 AC3).
- Search results update both `examinations` and `filteredExaminations` state; `continuationToken` is updated from the response.
- The `applyFilters` function and its `useCallback` can be removed (it is no longer used once server search replaces client filtering).

#### Todo List
1. Open `frontend/src/pages/ExaminationsPage.tsx`.
2. Add `InlineLoading` to the `@carbon/react` import block.
3. Add `const [isSearching, setIsSearching] = useState(false);` alongside the other state variables.
4. Add `const [searchInfo, setSearchInfo] = useState<string | null>(null);` for the 2-char hint.
5. Rewrite `handleSearch` to:
   a. Call `setSearchQuery(query)` and `setPage(1)`.
   b. Clear `searchTimerRef`.
   c. If empty query: call `setSearchInfo(null)`, call `setFilteredExaminations(examinations)`, call `loadExaminations(current filters)`, and return.
   d. If `query.trim().length < 2`: call `setSearchInfo('Type at least 2 characters to search.')`, restore `filteredExaminations` from `examinations`, and return.
   e. If 2+ chars: call `setSearchInfo(null)`, call `setContinuationToken(undefined)`, then debounce (200 ms) an async block that sets `isSearching = true`, calls `examinationService.getExaminations({ patientId, status, from_date, to_date, examinationType, patientName: query })`, updates `examinations` and `filteredExaminations` with results, updates `continuationToken`, and sets `isSearching = false` in a `finally` block.
6. Remove the `applyFilters` `useCallback` (lines 143–152) — it is no longer referenced.
7. Remove `examinations` from `handleSearch`'s `useCallback` dependency array (no longer needed).
8. In the `loadExaminations` function (line 118): remove the `setSearchQuery('')` call. This side-effect currently clears the search field on every load, which must no longer happen now that search is a controlled, composable mode.
9. Render the `searchInfo` `<InlineNotification>` above the `DataTable` (mirroring the `PatientsPage` `searchInfo` pattern).
10. In the `TableToolbarContent`, render `{isSearching && <InlineLoading description="Searching..." style={{ width: 'auto' }} />}` after the `<TableToolbarSearch>` (before the Create button).

#### Relevant Context
- `frontend/src/pages/ExaminationsPage.tsx`, lines 143–189 (`applyFilters` and `handleSearch`).
- `frontend/src/pages/PatientsPage.tsx`, lines 70–119 — reference implementation for the same search pattern.
- `frontend/src/services/examinationService.ts` — `getExaminations` now accepts `patientName` (Task 3).

---

### Task 9 · REQ-3-04 + REQ-3-07 — Search-mode vs browse-mode UX on `PatientsPage`

**Status:** `[x] done`
**Prerequisite:** Task 5 must be complete.

#### Intent
When a name search is active on `PatientsPage`, the "Load More Patients" button must be hidden and the user must see a clear banner indicating they are viewing search results. Browse mode must restore when search is cleared.

#### Expected Outcomes
- The "Load More Patients" button is **not rendered** when `searchQuery.trim().length >= 2`.
- When search is cleared (empty or <2 chars), `loadPatients()` is called with no token to restore browse mode from page 1.
- A persistent `InlineNotification kind="info"` banner appears above the table during search mode: *"Showing search results for «query». [Clear search]"* — the "Clear search" action calls `handleSearch('')`.
- `TableContainer` description shows `"N patient(s) found matching «query»"` in search mode; `"N patient(s) found"` in browse mode.
- Pressing `Escape` while focused in the `<Search>` input clears the query and returns to browse mode.
- The existing `searchInfo` hint ("Type at least 2 characters") is preserved for the 1-char case.
- The existing `continuationToken` reset in `handleSearch` (when 2+ chars fires) is added (currently missing): `setContinuationToken(undefined)` before the API call.

#### Todo List
1. Open `frontend/src/pages/PatientsPage.tsx`.
2. In `handleSearch`: when `query.trim().length >= 2`, add `setContinuationToken(undefined)` before the debounced call. When `query` is empty, call `loadPatients()` (no token) to restore the full browse list.
3. **Hide "Load More"**: change the render condition on line 286 from `{continuationToken && (` to `{!searchQuery || searchQuery.trim().length < 2 ? continuationToken && (` with a matching closing bracket. Simpler: `{continuationToken && searchQuery.trim().length < 2 && (`.
4. **Search mode banner**: above the `<DataTable>`, add:
   ```
   {searchQuery.trim().length >= 2 && (
     <InlineNotification kind="info" lowContrast hideCloseButton
       title=""
       subtitle={`Showing search results for "${searchQuery}".`}
       actions={<Button kind="ghost" size="sm" onClick={() => handleSearch('')}>Clear search</Button>}
       style={{ marginBottom: '1rem' }}
     />
   )}
   ```
5. **Dynamic `TableContainer` description**: change line 224 to:
   ```
   description={searchQuery.trim().length >= 2
     ? `${totalItems} patient${totalItems !== 1 ? 's' : ''} found matching "${searchQuery}"`
     : `${totalItems} patient${totalItems !== 1 ? 's' : ''} found`}
   ```
6. **Escape key handler**: add `onKeyDown` to the `<Search>` wrapper `<div>` (or to the `<Search>` component's `onKeyDown` prop — check Carbon API): `onKeyDown={(e) => { if (e.key === 'Escape') handleSearch(''); }}`.

#### Relevant Context
- `frontend/src/pages/PatientsPage.tsx`, lines 161–211 (search + toolbar), lines 222–226 (`TableContainer`), lines 286–296 ("Load More" button).
- REQ-3-04 Technical Notes: "The condition for hiding the button is `!searchQuery.trim() || searchQuery.trim().length < 2`."

---

### Task 10 · REQ-3-07 — Search-mode vs browse-mode UX on `ExaminationsPage`

**Status:** `[x] done`
**Prerequisite:** Task 8 must be complete.

#### Intent
`ExaminationsPage` must have the same search-vs-browse mode visual distinction as `PatientsPage` (Task 9). The "Load More Tests" button must be hidden in search mode, a search-mode banner must appear, and Escape/clear must return to browse mode.

#### Expected Outcomes
- While `searchQuery.trim().length >= 2`: the "Load More Tests" button is not rendered; a search-mode `InlineNotification` banner is shown above the `DataTable`; `TableContainer` description reads `"N result(s) found matching «query»"`.
- While in browse mode: the banner is hidden; "Load More Tests" is visible if `hasMore` is true; description reads `"N exam(s) found"`.
- Pressing `Escape` on the `<TableToolbarSearch>` input clears the query and calls `loadExaminations()` with current filter state to reload browse mode.
- The `×` (clear) button on `<TableToolbarSearch>` fires `onChange` with `""`, which `handleSearch('')` already handles (existing normalisation `e.target?.value ?? e` is preserved).

#### Todo List
1. Open `frontend/src/pages/ExaminationsPage.tsx`.
2. **Hide "Load More" in search mode**: change the `{hasMore && (` guard (line 483) to `{hasMore && searchQuery.trim().length < 2 && (`.
3. **Search mode banner**: add above the `<DataTable>`:
   ```
   {searchQuery.trim().length >= 2 && (
     <InlineNotification kind="info" lowContrast hideCloseButton
       title=""
       subtitle={`Showing search results for "${searchQuery}".`}
       actions={<Button kind="ghost" size="sm"
         onClick={() => handleSearch('')}>Clear search</Button>}
       style={{ marginBottom: '1rem' }}
     />
   )}
   ```
4. **Dynamic `TableContainer` description**: update line 349:
   ```
   description={searchQuery.trim().length >= 2
     ? `${totalItems} result${totalItems !== 1 ? 's' : ''} found matching "${searchQuery}"`
     : `${totalItems} exam${totalItems !== 1 ? 's' : ''} found`}
   ```
5. **Escape key on `<TableToolbarSearch>`**: add `onKeyDown` to the `<div>` wrapping the toolbar search (or pass `inputProps={{ onKeyDown: ... }}` if the Carbon component supports it): when `e.key === 'Escape'`, call `handleSearch('')`.

#### Relevant Context
- `frontend/src/pages/ExaminationsPage.tsx`, lines 338–371 (`DataTable`/`TableToolbar` block), lines 482–493 ("Load More" button).

---

### Task 11 · REQ-3-06 — AbortController for request cancellation

**Status:** `[x] done`
**Prerequisite:** Tasks 8 and 9 must be complete (search API calls must exist before they can be cancelled).

#### Intent
Rapid filter changes or searches dispatch multiple concurrent requests. The last one to resolve wins, potentially displaying stale results. An `AbortController` cancels the in-flight request whenever a new one is dispatched. Cancelled requests must not surface errors or update UI state.

#### Expected Outcomes
- Each call to `loadExaminations` aborts any previous in-flight `loadExaminations` request.
- Each call to `loadPatients` (including from `handleSearch`) aborts any previous in-flight request for that page.
- Aborted requests are caught silently (no error state, no state mutation).
- The service layer (`examinationService.ts`, `patientService.ts`) must accept and forward a `signal` option to axios.

#### Todo List

**`examinationService.ts`:**
1. Add `signal?: AbortSignal;` to `GetExaminationsOptions` interface.
2. Pass `signal` to the axios call: `api.get(url, { params, signal: opts.signal })`.
3. In the `catch` block of `getExaminations`, check `if (axios.isCancel(error) || error.name === 'AbortError') throw error;` (re-throw so the caller can detect cancellation).

**`patientService.ts`:**
4. Add `signal?: AbortSignal` to `getPatients` and `searchPatients` parameters.
5. Pass `signal` to the axios calls in both methods.
6. Re-throw cancellation errors in the `catch` blocks.

**`ExaminationsPage.tsx`:**
7. Add `const loadAbortRef = useRef<AbortController | null>(null);` near the other refs.
8. At the start of `loadExaminations`: abort previous controller, create new one, store in ref.
9. Pass `signal: loadAbortRef.current.signal` to `examinationService.getExaminations(...)`.
10. In the `catch` block: `if (axios.isCancel(err) || err.name === 'AbortError') return;` (early exit, no error state set).
11. Add cleanup to the unmount `useEffect`: `loadAbortRef.current?.abort()`.
12. For the search debounce in `handleSearch`: create a separate `searchAbortRef` following the same pattern — abort previous search on each new invocation.

**`PatientsPage.tsx`:**
13. Add `const loadAbortRef = useRef<AbortController | null>(null);` and `const searchAbortRef = useRef<AbortController | null>(null);`.
14. Apply abort logic to `loadPatients` (same pattern as step 8–11).
15. Apply abort logic to the search call inside `handleSearch` (same pattern using `searchAbortRef`).

#### Relevant Context
- `frontend/src/services/examinationService.ts`, lines 28–62 (`getExaminations` method).
- `frontend/src/services/patientService.ts` — check current structure before editing.
- Axios supports `{ signal }` option natively for `AbortController` cancellation.
- REQ-3-06 Technical Notes for the exact pattern.

---

### Task 12 · REQ-3-08 — Improved empty-state messaging

**Status:** `[x] done`
**Prerequisite:** Tasks 8, 9, 10 must be complete (search mode is defined before empty states can reference it).

#### Intent
Replace the bare `<div>` text placeholders in both pages' empty-table rows with purposeful `InlineNotification`-based empty states that name the active filters and offer actionable reset buttons.

#### Expected Outcomes

**`ExaminationsPage`:**
- When `!isLoading && filteredExaminations.length === 0` and at least one filter/search is active: the table body shows a `<TableCell colSpan={...}>` containing an `InlineNotification kind="info"` with text `"No examinations match the current filters."` and a summary of active filters (e.g., *"Status: Completed, Type: Ultrasound Prenatal, From: 01/01/2024"*), plus a "Clear all filters" ghost button that resets all filter state to defaults, clears `continuationToken`, and calls `loadExaminations()`.
- When `!isLoading && filteredExaminations.length === 0` and no filter/search is active: render the existing neutral empty message ("No exams yet. Click 'Create Exam'…").
- The empty state check only runs when `!isLoading` (guard must precede the empty-state render).

**`PatientsPage`:**
- When `!isLoading && filteredPatients.length === 0` and `searchQuery.trim().length >= 2`: show `"No patients found matching «query»."` with a "Clear search" button.
- When `!isLoading && filteredPatients.length === 0` and search is not active: show `"No patients have been added yet."` with a "Add Patient" button (visible to `canCreate` users only).

#### Todo List
1. Open `frontend/src/pages/ExaminationsPage.tsx`.
2. Define a `isFilterActive` derived boolean: `const isFilterActive = !!(selectedPatientId || selectedStatus || selectedExamType || fromDate || toDate || searchQuery.trim().length >= 2);`
3. Define a `activeFilterSummary` derived string that concatenates named active filters for the error message.
4. Define a `clearAllFilters` function that resets all filter state, calls `setContinuationToken(undefined)`, and calls `loadExaminations()`.
5. Replace the existing empty-state `<div>` inside `<TableCell>` (lines 384–394) with conditional logic:
   - `!isLoading && rows.length === 0 && isFilterActive` → render `InlineNotification` with "No examinations match the current filters." + `activeFilterSummary` + "Clear all filters" button.
   - `!isLoading && rows.length === 0 && !isFilterActive` → render the neutral "No exams yet." message.
6. Open `frontend/src/pages/PatientsPage.tsx`.
7. Replace the existing empty-state `<div>` inside `<TableCell>` (lines 241–244) with:
   - `searchQuery.trim().length >= 2` → `"No patients found matching "${searchQuery}"."` + "Clear search" button.
   - Otherwise → `"No patients have been added yet."` + (if `canCreate`) "Add Patient" button.

#### Relevant Context
- `frontend/src/pages/ExaminationsPage.tsx`, lines 382–394 (current empty-state row).
- `frontend/src/pages/PatientsPage.tsx`, lines 238–246 (current empty-state row).
- REQ-3-08 Technical Notes: "The empty-state content can be rendered as a single `<TableRow>` with a `<TableCell colSpan={headers.length}`."

---

## Summary

### Decisions Recorded (resolved open questions)

| # | Question | Decision |
|---|----------|----------|
| 1 | OData `patientName` case sensitivity | **Case-insensitive required.** Solution: store `patientNameLower` shadow property; normalise query value to lower-case in backend. Backfill script required for existing rows. |
| 2 | Legacy `?patient_id=` deep-link in `ExaminationsPage` | **No shim needed.** `PatientDetailPage` navigates to `/examinations/new?patientId=…` which targets `CreateExaminationPage`, not `ExaminationsPage`. No conflict exists. |
| 3 | Examination search scope | **Patient name only** — MRN search deferred beyond Round 3. |
| 4 | `pageSize` URL exclusion | **Confirmed excluded** — client-side preference only, not URL-synchronised. |

---

### Overall Scope

| Task | REQ / Defect | File(s) | Complexity | Status |
|------|-------------|---------|------------|--------|
| 1 · KI-001 Hotfix | KI-001 | `PatientDetailPage.tsx` | Low | `[x]` |
| 2 · Backend param fixes + `patient_name` + `patientNameLower` | REQ-3-02 (+ pre-existing gaps) | `GetExaminations.ts`, `CreateExamination.ts`, `api/scripts/backfill-patient-name-lower.ts` (new) | **High** | `[x]` |
| 3 · Service `patientName` param | REQ-3-02 | `examinationService.ts` | Low | `[x]` |
| 4 · URL sync — ExaminationsPage | REQ-3-05 | `ExaminationsPage.tsx` | High | `[x]` |
| 5 · URL sync — PatientsPage | REQ-3-05 | `PatientsPage.tsx` | Medium | `[x]` |
| 6 · Token reset on filter change | REQ-3-03 | `ExaminationsPage.tsx` | Low | `[x]` |
| 7 · Disabled selects + DatePicker debounce | REQ-3-06 | `ExaminationsPage.tsx` | Low | `[x]` |
| 8 · Server-side exam name search | REQ-3-02 | `ExaminationsPage.tsx` | High | `[x]` |
| 9 · Search/browse mode — PatientsPage | REQ-3-04, REQ-3-07 | `PatientsPage.tsx` | Medium | `[x]` |
| 10 · Search/browse mode — ExaminationsPage | REQ-3-07 | `ExaminationsPage.tsx` | Medium | `[x]` |
| 11 · AbortController cancellation | REQ-3-06 | `ExaminationsPage.tsx`, `PatientsPage.tsx`, service files | Medium | `[x]` |
| 12 · Empty-state messaging | REQ-3-08 | `ExaminationsPage.tsx`, `PatientsPage.tsx` | Medium | `[x]` |

### Recommended Execution Order

```
Task 1 (hotfix — ship independently, no dependencies)
  → Task 2 (backend: param fixes + patientNameLower write path + backfill script)
    → Task 3 (service: patientName param)
      → Task 4 (URL sync — exams) + Task 5 (URL sync — patients)  [parallel]
        → Tasks 6 + 7 (token reset + disabled inputs — both in ExaminationsPage, non-overlapping)  [parallel]
          → Task 8 (server-side search)
            → Tasks 9 + 10 (browse/search mode UX — patients and exams)  [parallel]
              → Task 11 (AbortController)
                → Task 12 (empty states)
```

### Key Risks and Blockers

1. **`patientNameLower` schema change requires data migration (Task 2) — BLOCKER**
   The case-insensitive search requirement cannot be satisfied with Azure Table Storage's OData engine without a parallel lower-case field. `patientName` is written verbatim from `patient.name` (mixed case, no normalisation) in `CreateExamination.ts`. Until the backfill script runs on the production Azurite/Storage instance, `patient_name` searches will return zero results for any existing records. This is a deploy-order dependency: Task 2 code ships first, then the backfill script runs, then the feature is testable end-to-end. Plan for a maintenance window or accept that search returns only newly created records until the backfill completes.

2. **Pre-existing backend filter bugs (Task 2) — BLOCKER for end-to-end testing**
   The patient-dropdown filter (`patientId` vs `patient_id`) and the status/date filters are silently broken in production today. Every integration test for Tasks 6–12 that involves those filters will produce wrong results until Task 2 is deployed. Developers must not validate filter-related tasks against production until Task 2 is live.

3. **`loadExaminations` clears `searchQuery` as a side-effect (Task 8) — REGRESSION RISK**
   `loadExaminations` at line 118 calls `setSearchQuery('')` every time it runs. After Task 8 wires search as an API call (not a client filter), every filter dropdown change will silently clear the active search query because dropdowns call `loadExaminations`. This side-effect must be removed in Task 8. Risk: if any other component or test relies on `loadExaminations` clearing the search field, removing the side-effect will break it. Audit all `loadExaminations` call sites before removing the line.

4. **URL state initialisation race with `useEffect` mount (Tasks 4–5) — CORRECTNESS RISK**
   `useSearchParams` returns values synchronously on render, but the `useEffect([loadExaminations])` that fires the initial data fetch is scheduled after the render. This is safe: URL-derived state is available when the effect runs. However, if the mount effect reads state variables directly (via closure) rather than deriving fresh values from `searchParams.get(...)` at call time, it may capture stale defaults. The safest implementation passes filter values explicitly to `loadExaminations(opts)` on mount, reading directly from `searchParams` at that point rather than relying on React state having been set.

5. **`useSearchParams` writes trigger re-renders that call `useEffect` dependencies (Tasks 4–5) — LOOP RISK**
   If `setSearchParams` is called inside a `useEffect` whose dependency array includes any of the URL-synced state variables, a render loop can occur: state changes → effect fires → `setSearchParams` called → URL changes → component re-renders → state re-read → effect fires again. Mitigation: URL writes must only happen inside event handlers (filter changes, search keystrokes, pagination changes) — never inside `useEffect`. The mount read (URL → state) and the event-driven write (state → URL) must be strictly separated.

6. **Axios `AbortController` `signal` support confirmed (Task 11) — NO BLOCKER**
   `frontend/package.json` declares `axios: ^1.18.0`. Axios ≥ 0.22.0 natively supports `{ signal: AbortSignal }` via the standard `AbortController` API. No `CancelToken` shim is needed. Abort errors thrown by axios are instances with `code === 'ERR_CANCELED'`; additionally `axios.isCancel(err)` returns `true`. Both checks should be used in `catch` blocks.

7. **`InlineNotification` has no action button in Carbon v11 — use `ActionableNotification` instead — RESOLVED**
   The installed `@carbon/react ^1.109.0` (Carbon v11) splits the old v10 `InlineNotification` (which had an actions prop) into two separate components. `InlineNotification` has no action button whatsoever — the type definition has no `actions`, `actionButtonLabel`, or render slot. The correct component for all banners that need a "Clear search" or "Clear all filters" button is **`ActionableNotification`**, which is exported from the same `@carbon/react` package and has `actionButtonLabel: string` and `onActionButtonClick: function` props, plus an `inline` boolean prop that renders it flush (not floating) inside the page layout. All tasks that require an action button (Tasks 9, 10, 12) must import and use `ActionableNotification` instead of `InlineNotification`. The `inline` prop must be set to `true` to prevent toast-style floating behaviour. No risk remains — the API is confirmed from the installed type definitions.

8. **`TableToolbarSearch` Escape key — safe implementation confirmed from source — RESOLVED**

   **Findings from reading `Search.js` and `TableToolbarSearch.js` directly:**

   The `Search` component's internal `handleKeyDown` (line 86–91 of `Search.js`) runs on `Escape` and calls `event.stopPropagation()` unconditionally. It then calls `clearInput()` if the input has content, or shifts focus to the expand button if content is empty. **The event never bubbles past the `<input>` element.** Any `onKeyDown` placed on a wrapper `<div>` or the `<TableContainer>` will never fire for `Escape`.

   However, the `Search` component renders `onKeyDown: composeEventHandlers([onKeyDown, handleKeyDown])` on the `<input>` (line 137 of `Search.js`). This means the **consumer's `onKeyDown` is called first**, before Carbon's own `handleKeyDown`. Since `TableToolbarSearch` passes all unrecognised props via `...rest` directly to `Search_default` (line 85 of `TableToolbarSearch.js`), a `onKeyDown` prop placed on `<TableToolbarSearch>` flows all the way through to the `<input>` element and is composed with — not replaced by — Carbon's handler.

   **The safe implementation:**

   ```tsx
   <TableToolbarSearch
     placeholder="Search by patient name..."
     onChange={(e: any) => handleSearch(e.target?.value ?? e)}
     value={searchQuery}
     persistent
     onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
       if (e.key === 'Escape') {
         handleSearch('');
       }
     }}
   />
   ```

   **What happens on Escape:**
   1. `composeEventHandlers` calls our `onKeyDown` first → `handleSearch('')` clears the query and reloads browse mode.
   2. Carbon's `handleKeyDown` runs next → calls `clearInput()` if input has content (which it no longer does, since `handleSearch('')` already cleared the controlled `value`) → calls `event.stopPropagation()`.
   3. No further bubbling occurs, which is correct — we have already handled the action in step 1.

   **Important constraint — `persistent` prop is required:** `TableToolbarSearch` manages an internal expand/collapse state. When the input is not `persistent`, pressing Escape while the field is empty triggers `expandButtonRef.current?.focus()` (line 90 of `Search.js`), collapsing the toolbar search visually. Since `ExaminationsPage` must always show the search field, add `persistent` to the component props. This prop is already defined in `TableToolbarSearchProps` and prevents the collapse behaviour.

   **`onClear` for the ×  button:** Carbon's `clearInput()` function fires `onChange` with a synthetic event carrying `target.value = ""` (lines 60–78 of `Search.js`), then calls `onClear()`. The existing `onChange` handler already normalises both event types via `e.target?.value ?? e`. When the user clicks ×, `onChange` fires with `""` → `handleSearch('')` is called naturally. No separate `onClear` wiring is needed.

   No risk remains. The implementation is fully determined from source.
