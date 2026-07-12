# Requirements Specification – Defects Round 3

**Scope:** Search and filter correctness across `PatientsPage`, `ExaminationsPage`, and `PatientDetailPage`.  
**Goal:** Users must be able to search and filter across the full database — not just the currently loaded in-memory batch — with consistent, intuitive UX across all list views.

> **Note on `PatientDetailPage` sub-table pagination (DR3-01 / KI-003):** A patient with more than 50 examinations of a single type is considered an edge case in the current usage profile. Server-side load-more pagination for the exam sub-table has been deferred and recorded as KI-004 in `KNOWN-ISSUES.md`. The exam sub-table retains client-side filtering over the single fetched page. All remaining requirements below address the five higher-priority search and filter correctness issues.

---

## REQ-3-02 · Server-side examination name search replacing client-side in-memory filter

| Field | Detail |
|---|---|
| **Requirement ID** | REQ-3-02 |
| **Title** | All Exams free-text search must query the server, not filter the loaded in-memory batch |
| **Linked Defect(s)** | DR3-02 |

### User Story

As a doctor using the All Exams page, when I type a patient name into the search box I want the system to search across all examinations in the database so I never miss a result because it wasn't loaded yet.

### Acceptance Criteria

1. The `handleSearch` function in `ExaminationsPage` is rewritten to dispatch `examinationService.getExaminations({ patientId: selectedPatientId || undefined, status: selectedStatus || undefined, examinationType: selectedExamType || undefined, from_date: fromDate || undefined, to_date: toDate || undefined })` with the search query passed as a new `patientName` parameter (see Technical Notes).
2. The debounce interval remains 200 ms (matching the current timer in `handleSearch`, line 186).
3. While the debounce is pending or the request is in-flight, an `InlineLoading` indicator is shown in the toolbar (consistent with `PatientsPage` which already renders an `isSearching` loader at line 197–199).
4. A minimum of 2 characters is required before any API call is dispatched. Below that threshold the search field shows an `InlineNotification` hint "Type at least 2 characters to search", and the full unfiltered list is restored. Empty query restores the full list.
5. Search results replace the `examinations` and `filteredExaminations` state; `continuationToken` is updated from the response. If the search result set itself spans multiple pages, the "Load More" button is hidden in active search mode (see REQ-3-07 for the search-mode vs browse-mode distinction).
6. Searching by patient name is **composable** with the existing dropdown filters: the `patientId`, `status`, `examinationType`, `from_date`, and `to_date` values from the current filter bar are always included in the search request.
7. When search query is cleared, the normal `loadExaminations()` call with current dropdowns is re-issued to restore the full filtered list and re-enter browse mode.

### Technical Notes

- **Backend change required.** `GET /v1/examinations` (`api/src/functions/GetExaminations.ts`) must accept a new optional query parameter `patient_name: string`. When present and the query is already scoped to the `EXAM` partition (`filter = "PartitionKey eq 'EXAM' and isDeleted eq false"`), append `and patientName ge '${q}' and patientName lt '${q}\uFFFF'` to the OData filter. This is the same sentinel-based range-scan pattern already used by `queryEntities` in the codebase (consistent with the `\uFFFF` upper-bound convention documented in `AGENTS.md`).
- `GetExaminationsOptions` (`frontend/src/services/examinationService.ts`, line 9) must gain a new optional field `patientName?: string`. The service method must map it to the `patient_name` query parameter (alongside the existing `examination_type` mapping on line 43).
- Note: the existing `TableToolbarSearch` component (line 354) emits both synthetic events and raw strings; the current `onChange` handler already normalises this with `e.target?.value ?? e` (line 356). This normalisation must be retained.
- Do **not** add a `patient_name` filter to the `PATIENT_{patientId}` partition path in `GetExaminations.ts` (line 39–40) — that partition is already scoped to one patient; a name filter there is redundant.

---

## REQ-3-03 · Synchronous continuation-token reset on every filter change in All Exams

| Field | Detail |
|---|---|
| **Requirement ID** | REQ-3-03 |
| **Title** | Every filter handler in `ExaminationsPage` must clear the continuation token before dispatching a new load |
| **Linked Defect(s)** | DR3-03 |

### User Story

As a user browsing exams with filters, when I change any filter I want "Load More" to always fetch the next page of the **current** filter set so I never see incorrect or mixed results.

### Acceptance Criteria

1. `handlePatientFilter` (line 154), `handleStatusFilter` (line 160), and `handleDateFilter` (line 173) each call `setContinuationToken(undefined)` as their first statement, before calling `loadExaminations(...)`.
2. `handleExamTypeFilter` (line 166) already calls `setContinuationToken(undefined)` at line 169 — this must be preserved.
3. After REQ-3-02 is implemented, `handleSearch` must also call `setContinuationToken(undefined)` before dispatching the search request.
4. `loadExaminations` — which calls `setContinuationToken(result.continuationToken)` (line 120) at completion — continues to be the sole writer of a non-`undefined` token value.
5. The "Load More" button (`hasMore && ...` block, lines 483–493) remains disabled (`disabled={isLoading}`) while any fetch is in-flight.
6. An integration test assertion confirms: after changing the patient filter, `continuationToken` state is `undefined` before the new `loadExaminations` response resolves.

### Technical Notes

- The fix is three one-line insertions — one `setContinuationToken(undefined)` at the top of each of the three un-guarded handlers. No logic changes are needed in `loadExaminations` itself.
- Azure Table Storage continuation tokens are opaque and partition/filter bound. Passing a token from one filter query to a different one will return a `400` or silently skip to an unrelated position. The synchronous reset eliminates this window.

---

## REQ-3-04 · Hide or disable "Load More Patients" while a name search is active

| Field | Detail |
|---|---|
| **Requirement ID** | REQ-3-04 |
| **Title** | The "Load More Patients" button must not be reachable when a name search is active |
| **Linked Defect(s)** | DR3-04 |

### User Story

As a user searching for a patient by name, I want the UI to clearly reflect that I am looking at search results — not a pageable browse list — so I am not confused by a "Load More" button that would overwrite my search results.

### Acceptance Criteria

1. When `searchQuery.trim().length >= 2` (i.e., a server search is active), the "Load More Patients" button (lines 286–296 of `PatientsPage.tsx`) is **not rendered**, regardless of whether `continuationToken` is defined.
2. When `searchQuery` is cleared (back to empty), the "Load More Patients" button becomes visible again if `continuationToken` is present.
3. Clearing the search query triggers a fresh `loadPatients()` call (no arguments — no token) to restore the full browse list from page 1.
4. The existing `continuationToken` state is reset to `undefined` whenever a server search is initiated (`handleSearch` with `query.trim().length >= 2`).
5. When search results are displayed, the `TableContainer` description text (currently `"N patient(s) found"`) is augmented to read `"N patient(s) found matching «query»"` to signal that the list is a search result set.

### Technical Notes

- The condition for hiding the button is `!searchQuery.trim() || searchQuery.trim().length < 2`. The existing `continuationToken &&` guard stays; the new guard is prepended: `!searchQuery.trim() && continuationToken && (...)`.
- `loadPatients` (line 51) already resets `continuationToken` via `setContinuationToken(response.continuationToken)` (line 58). Calling `loadPatients()` with no argument on search clear is sufficient; no extra token reset call is needed.
- The `SearchPatients` backend endpoint (`api/src/functions/SearchPatients.ts`, line 79) returns `{ patients: Patient[] }` with no `continuationToken`. This is by design given the partition-scan architecture — adding pagination to the search endpoint is outside scope.

---

## REQ-3-05 · URL-synchronised filter and pagination state on `ExaminationsPage` and `PatientsPage`

| Field | Detail |
|---|---|
| **Requirement ID** | REQ-3-05 |
| **Title** | Active filter values and page number must be reflected in and restored from the browser URL |
| **Linked Defect(s)** | DR3-05 |
| **Prerequisite** | Must be implemented before or alongside REQ-3-02 and REQ-3-03, as URL state is the source of truth for all filter restoration |

### User Story

As a user who has drilled into a specific exam from a filtered list, when I press the browser back button I want to return to the same filtered view I left — with the same filters and page position — so I do not have to re-apply my filters manually.

### Acceptance Criteria

**ExaminationsPage**

1. The following filter and pagination values are stored as URL search parameters using React Router's `useSearchParams` hook: `patient` (maps to `selectedPatientId`), `status` (maps to `selectedStatus`), `type` (maps to `selectedExamType`), `from` (maps to `fromDate`), `to` (maps to `toDate`), `q` (maps to `searchQuery`), `page` (maps to `page`).
2. On initial mount, `ExaminationsPage` reads all recognised URL params and initialises its state accordingly before the first `loadExaminations` call.
3. **Text inputs** (`q`) write to the URL with `{ replace: true }` so that each keystroke does not create a new browser history entry.
4. **Discrete filter selections** (dropdown changes for `patient`, `status`, `type`, date picker for `from`/`to`) write to the URL with `{ replace: false }` (the default — a `push`) so that the browser back button can restore the immediately previous filter state.
5. Navigating back to `/examinations` (via the browser back button or in-app link) restores the filter bar controls and table to the state encoded in the URL.
6. `pageSize` is intentionally **not** URL-synchronised (it is a per-session preference, not a shareable filter).

**PatientsPage**

7. The following values are stored as URL search params: `q` (maps to `searchQuery`), `page` (maps to `page`).
8. `q` writes with `{ replace: true }`; `page` writes with `{ replace: false }`.
9. On mount, if `q` is present and 2+ characters, `handleSearch(q)` is triggered automatically to restore the search result set.
10. `page` is read on mount and applied to the local pagination state.

**Shared constraints**

11. URL parameter writes for text inputs (`q`) are debounced at 300 ms to avoid writing on every keystroke — matching the existing `searchTimerRef` debounce pattern in both files.
12. Invalid or unrecognised URL parameter values (e.g., non-numeric `page`) are silently ignored and the default is used.
13. Existing deep-link navigation to `/examinations?patient_id=…` from `PatientDetailPage` (line 141, `handleCreateExamination`) must continue to work — the `patient_id` param should be mapped to the `patient` URL param during the `ExaminationsPage` mount read if both param names need to co-exist.

### Technical Notes

- Use `useSearchParams` from `react-router-dom` (already imported in the project's React Router v6 setup). Replace the `useState` initialisers for the listed fields with values read from `searchParams.get(...)`, falling back to the current defaults.
- `setSearchParams(params, { replace: true })` for keystrokes; `setSearchParams(params)` (no options — defaults to push) for dropdown selections.
- `page` from the URL should be parsed as `Math.max(1, parseInt(param, 10) || 1)`.
- `DatePicker` state (`fromDate`, `toDate`) requires converting the URL ISO strings back to the `value` prop format (`dd/mm/yyyy`) via the existing `toDisplayDate` helper (line 40 of `ExaminationsPage.tsx`) on mount.
- No backend changes are required for this requirement.

---

## REQ-3-06 · Unified, debounced, loading-aware filter inputs across all list views

| Field | Detail |
|---|---|
| **Requirement ID** | REQ-3-06 |
| **Title** | All filter inputs must be debounced where appropriate, visually indicate loading state, and be disabled during pending requests |
| **Linked Defect(s)** | DR3-02, DR3-03 (UX consolidation) |

### User Story

As a user applying filters, I want immediate visual feedback that my selection is being processed and I want the UI to prevent me from triggering conflicting concurrent requests.

### Acceptance Criteria

1. All `<Select>` filter dropdowns in `ExaminationsPage` (`patientFilter`, `statusFilter`, `examTypeFilter`) set `disabled={isLoading}` during any pending fetch, consistent with the `<Select disabled={isLoadingExaminations}>` pattern already used in `PatientDetailPage` (line 354).
2. The `<DatePicker>` in `ExaminationsPage` wraps its `onChange` in a 300 ms debounce before calling `handleDateFilter` so that setting the "From" date alone does not fire an incomplete API call. The current behaviour (line 316–321) already guards with `if (from && to)` — the debounce provides an additional layer for rapid sequential changes.
3. The patient-name `<TableToolbarSearch>` in `ExaminationsPage` shows the existing `InlineLoading` component inline when a search fetch is in-flight (after REQ-3-02 changes `handleSearch` to call the API). A boolean `isSearching` state variable is introduced in `ExaminationsPage`, mirroring `PatientsPage` line 43.
4. The `<Search>` component in `PatientsPage` already sets nothing on `isSearching`; no additional `disabled` prop is needed since the search is already visually indicated by the `isSearching && <InlineLoading>` block (line 197–199). This existing behaviour must be preserved.
5. The "Load More" button in both `ExaminationsPage` (line 488) and `PatientsPage` (line 291) must remain `disabled` while `isLoading` is `true`.
6. All `loadExaminations` and `loadPatients` calls use an `AbortController` to cancel the previous in-flight request whenever a new one is dispatched (filter change, search, page load). The controller's `signal` is passed to the service layer. If an in-flight request is aborted, the `isLoading` / `isSearching` flags are cleared without updating list state, and no error is surfaced to the user.

### Technical Notes

- The `isLoading` state in `ExaminationsPage` is already set to `true` at the start of `loadExaminations` (line 97) and to `false` in the `finally` block (line 125). Adding `disabled={isLoading}` to the three `<Select>` elements reuses this existing flag with no new state.
- The `isSearching` state for `ExaminationsPage` follows the same pattern as `PatientsPage`: set `true` before the debounced API call fires and set `false` in the `finally` block of the search fetch.
- Debouncing `DatePicker` changes: the existing `searchTimerRef` pattern (`useRef<ReturnType<typeof setTimeout>>`) used in `ExaminationsPage` (line 77) can be reused — add a `dateTimerRef` following the same ref-and-cleanup pattern.
- `AbortController` pattern: store the controller in a `useRef<AbortController | null>`. At the start of each `loadExaminations` / `loadPatients` call, abort the previous controller if present, create a new one, and pass `signal` to the axios call via the `signal` option. In the `catch` block, check `err.name === 'AbortError'` (or `axios.isCancel(err)`) and return early without setting error state.

---

## REQ-3-07 · Search mode vs browse mode — distinct UX states on list pages

| Field | Detail |
|---|---|
| **Requirement ID** | REQ-3-07 |
| **Title** | List pages must have visually distinct search-mode and browse-mode states with correct affordances in each |
| **Linked Defect(s)** | DR3-02, DR3-04 (UX consolidation) |

### User Story

As a user, I want to always know whether I am looking at search results or a paginated browse list, and I want the controls available to me to match that context, so I never perform an action that corrupts my current view.

### Acceptance Criteria

**Search mode** (active when `searchQuery.trim().length >= 2`)

1. A persistent `InlineNotification kind="info"` banner is rendered above the results table on both `ExaminationsPage` and `PatientsPage` while search mode is active. The banner reads: **"Showing search results for «query». [Clear search]"** where "Clear search" is a button that clears the query and returns to browse mode.
2. The "Load More" button is **never rendered** while search mode is active on either page — search results are a bounded, server-returned set and appending browse pages into them is incorrect (see DR3-04). This replaces the prior REQ-3-02 AC5 note about "Load More" working correctly during search.
3. The `TableContainer` description shows `"N result(s) found matching «query»"` in search mode (extending the PatientsPage AC5 pattern from REQ-3-04 to ExaminationsPage as well).

**Browse mode** (active when `searchQuery` is empty or fewer than 2 characters)

4. The search-mode banner is not rendered.
5. The "Load More" button is rendered and behaves as currently specified (visible if `continuationToken` is defined, disabled if `isLoading` is `true`).
6. The `TableContainer` description shows `"N record(s) found"`.

**Search field affordances (both pages)**

7. Pressing `Escape` while focus is inside the search input clears the query and returns to browse mode — equivalent to clicking "Clear search" in the banner.
8. The search input's built-in clear (×) button, when clicked, clears the query and returns to browse mode.
9. Both the `Escape` key and the clear button trigger `loadExaminations()` / `loadPatients()` with no arguments to reload the full browse list from page 1.

### Technical Notes

- The `InlineNotification` banner uses `kind="info"`, `lowContrast`, and a custom `action` prop (`<Button kind="ghost" size="sm">Clear search</Button>`) to keep the visual footprint small.
- The `Escape` key handler is attached via `onKeyDown` on the search `<input>` element (accessible via the `TableToolbarSearch`'s inner input ref, or via a `keydown` event on the wrapper `<div>` with `role="search"`).
- `PatientsPage` uses Carbon `<Search>` which has a built-in clear button that already fires `onChange` with an empty string — no extra wiring is needed for the clear button on that page. `ExaminationsPage` uses `<TableToolbarSearch>` which similarly fires `onChange` with `""` on clear.

---

## REQ-3-08 · Empty-state messaging for zero-result search and filter scenarios

| Field | Detail |
|---|---|
| **Requirement ID** | REQ-3-08 |
| **Title** | All list views must render a purposeful empty state when a search or filter returns no results |
| **Linked Defect(s)** | DR3-02, DR3-04 (UX gap) |

### User Story

As a user whose search or filter returns no results, I want a clear explanation of why the list is empty and an easy way to reset my filters, so I am never left staring at a blank table with no guidance.

### Acceptance Criteria

1. When `filteredExaminations.length === 0` and at least one filter or search query is active on `ExaminationsPage`, the table body is replaced by an `<InlineNotification kind="info">` (or equivalent empty-state tile) with the message: **"No examinations match the current filters."** followed by a **"Clear all filters"** button that resets all filter state to defaults and calls `loadExaminations()`.
2. When `filteredPatients.length === 0` and `searchQuery.trim().length >= 2` is active on `PatientsPage`, the table body is replaced by: **"No patients found matching «query»."** with a **"Clear search"** button.
3. When `filteredPatients.length === 0` and no search is active (true empty database state) on `PatientsPage`, render a neutral empty state: **"No patients have been added yet."** with a **"Add Patient"** button (visible to non-viewers only).
4. The empty state for zero filter results on `ExaminationsPage` names the active filter values to help the user diagnose the mismatch — e.g., *"No examinations match the current filters (Status: Completed, Type: OB, From: 01/01/2024)."*
5. No empty-state overrides the loading state — the empty-state check only runs when `isLoading` is `false`.

### Technical Notes

- The "active filter" check for `ExaminationsPage` is: `selectedPatientId || selectedStatus || selectedExamType || fromDate || toDate || searchQuery.trim().length >= 2`.
- The "Clear all filters" handler resets all filter state variables to their default empty strings, calls `setContinuationToken(undefined)`, and calls `loadExaminations()`.
- The empty-state content can be rendered as a single `<TableRow>` with a `<TableCell colSpan={headers.length}>` containing the `<InlineNotification>` — this keeps it inside the existing `<DataTable>` structure without layout changes.
- Condition guards: `!isLoading && rows.length === 0 && (isFilterActive || isSearchActive)` before rendering the empty-state row.

---
