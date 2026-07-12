# Defects – Round 3

Defects identified through code analysis of the patient and examination list views, focusing on search and filter interactions that do not correctly reflect the full database state.

---

## DR3-01 · `PatientDetailPage` exam filter has no load-more / pagination for filtered results

| Field | Detail |
|---|---|
| **Defect ID** | DR3-01 |
| **Title** | Exam-type filter on Patient Detail page cannot paginate beyond the first server page |
| **Severity** | P2 · Medium — data is missing but no crash |
| **Affected File(s)** | `frontend/src/pages/PatientDetailPage.tsx` (lines 85–108) |
| **Related Known Issue** | KI-003 |

### Detailed Description

`loadExaminations` (line 85) calls `examinationService.getExaminations({ patientId, examinationType })` and stores the returned `Examination[]`. The backend (`api/src/functions/GetExaminations.ts`, lines 56–77) pages results to a default of 50 records and returns an opaque `continuationToken`. The frontend discards this token entirely: neither the `loadExaminations` callback nor the component state has a slot for it. There is no "Load More" button or pagination control in the exams sub-table of this page. As a result, when a patient has more than 50 examinations of a given type, the user sees only the first 50 and has no means to retrieve the rest.

### Steps to Reproduce

1. Navigate to a patient record that has more than 50 examinations with the same `examinationType`.
2. Open the **Patient Detail** page.
3. Select the exam type in the **Filter by Type** `<Select>` dropdown (line 349–361).
4. Observe the examinations table.

### Observed Behaviour

The table renders at most 50 examinations. No "Load More" control appears. The `continuationToken` returned by `GET /v1/examinations?patient_id=…&examination_type=…` is silently discarded.

### Expected Behaviour

If the API response includes a `continuationToken`, a "Load More" button must appear beneath the exam table. Clicking it appends the next page of filtered results. The active filter values (`patientId` + `selectedExamType`) are preserved with the token so each subsequent page remains correctly filtered.

---

## DR3-02 · `ExaminationsPage` free-text search is client-side only and misses records on unpaged batches

| Field | Detail |
|---|---|
| **Defect ID** | DR3-02 |
| **Title** | Patient-name text search in All Exams page is purely client-side — only searches loaded records |
| **Severity** | P2 · Medium — returns silently incomplete results |
| **Affected File(s)** | `frontend/src/pages/ExaminationsPage.tsx` (lines 143–152, 178–189) |

### Detailed Description

`handleSearch` (line 178) debounces a call to `applyFilters(examinations, query)` (line 187), which is a client-side `Array.filter` over the `examinations` state variable (line 143–151). This in-memory list contains only the records fetched by the most recent `loadExaminations` call — at most 50 records (the backend default page size). The `GET /v1/examinations` endpoint at `api/src/functions/GetExaminations.ts` supports no `name` or free-text query parameter; no server-side name search exists for examinations. If the user has not clicked "Load More" to bring in additional pages, any matching examinations on subsequent pages are invisible to the search. The user receives a result set that looks complete but is silently truncated.

Additionally, `applyFilters` (line 143) only matches on `exam.patientName` (line 147). Fields such as `mrn`, `status`, `notes`, `findings`, and `gestationalAge` cannot be searched.

### Steps to Reproduce

1. Navigate to **All Exams**.
2. Ensure the database contains more than 50 examinations total and that a matching patient name appears only in the second batch (records 51+).
3. Type at least two characters of that patient's name in the **Search by patient name** toolbar search.
4. Observe the result set.

### Observed Behaviour

The search field filters the in-memory `examinations` array (at most 50 records). Matching exams that exist in the database but have not been loaded return no results. No API call is made; no indication is given that results may be incomplete.

### Expected Behaviour

The text search should query the server for examinations matching the name fragment across the full database, or at minimum display a notice that results are limited to the loaded batch and prompt the user to load more.

---

## DR3-03 · `ExaminationsPage` "Load More" does not preserve the active continuation token when filters change

| Field | Detail |
|---|---|
| **Defect ID** | DR3-03 |
| **Title** | Changing exam filters without resetting `continuationToken` can produce a stale token on "Load More" |
| **Severity** | P3 · Low — timing-dependent; unlikely in normal usage but architecturally incorrect |
| **Affected File(s)** | `frontend/src/pages/ExaminationsPage.tsx` (lines 154–176, 191–202) |

### Detailed Description

`handleExamTypeFilter` (line 166) calls `setContinuationToken(undefined)` before reloading (line 169). However, `handlePatientFilter` (line 154), `handleStatusFilter` (line 160), and `handleDateFilter` (line 173) do **not** reset `continuationToken` before calling `loadExaminations`. The token is only cleared once the new `loadExaminations` call completes and calls `setContinuationToken(result.continuationToken)` (line 120). In the brief window between the user changing a filter and the fetch completing, `continuationToken` still holds the value from the previous filter. If the user clicks "Load More" during this window, `handleLoadMore` (line 191) passes the stale token alongside the new filter parameters, which will either return an error or a wrong set of records from Azure Table Storage.

### Steps to Reproduce

1. Navigate to **All Exams**.
2. Load a page of results.
3. Click "Load More" once so a `continuationToken` is stored.
4. Immediately change the **Filter by Patient** dropdown before the previous request completes.
5. Click "Load More" again in the same render cycle.

### Observed Behaviour

`handleLoadMore` calls `loadExaminations` with the stale token belonging to the previous unfiltered (or differently-filtered) query alongside the new filter parameters. Azure Table Storage continuation tokens are partition/filter bound and will produce an error or incorrect results when reused across different query filters.

### Expected Behaviour

Any filter change must clear `continuationToken` to `undefined` synchronously before the new API call is dispatched, ensuring "Load More" is always disabled until a fresh token arrives for the current filter set.

---

## DR3-04 · `PatientsPage` "Load More" ignores the active name-search query

| Field | Detail |
|---|---|
| **Defect ID** | DR3-04 |
| **Title** | "Load More Patients" loads an unfiltered next page while a name search is active |
| **Severity** | P3 · Low — confusing UX; not a crash |
| **Affected File(s)** | `frontend/src/pages/PatientsPage.tsx` (lines 51–64, 286–296) |

### Detailed Description

`handleSearch` (line 70) calls `patientService.searchPatients(query)` (line 101) for queries of 2+ characters and replaces `filteredPatients` with the results. The `continuationToken` state (line 44) is exclusively updated by `loadPatients` (line 58). The search endpoint `GET /v1/patients-search` (implemented in `api/src/functions/SearchPatients.ts`) returns a flat `{ patients: Patient[] }` with no `continuationToken`. Therefore, when a search is active the "Load More Patients" button (line 286–296) — which calls `loadPatients(continuationToken)` (line 291) — loads the next **unfiltered** browse page of patients from the `PATIENT` partition. This overwrites `filteredPatients` with unfiltered results, and appends new unfiltered records to the `patients` array, breaking the user's active search context.

### Steps to Reproduce

1. Navigate to **Patients**.
2. Ensure the total patient count exceeds 50 (one backend page) so a `continuationToken` is present.
3. Type 2+ characters in the **Search by name** field to trigger a server search.
4. Click **Load More Patients**.

### Observed Behaviour

`loadPatients(continuationToken)` is called with the browse continuation token. An unfiltered next page of patients is fetched and replaces the search results, causing the search result set to silently change to an unrelated list.

### Expected Behaviour

While a name search query is active, the "Load More Patients" button must either be hidden (since the search endpoint does not paginate) or be replaced by a notice that all matching records have been returned. The button must not be reachable in a way that corrupts the active search state.

---

## DR3-05 · Filter and pagination state is not URL-synchronised — lost on navigation

| Field | Detail |
|---|---|
| **Defect ID** | DR3-05 |
| **Title** | Active filters and page number are not reflected in the browser URL |
| **Severity** | P3 · Low — usability issue |
| **Affected File(s)** | `frontend/src/pages/ExaminationsPage.tsx` (lines 62–75), `frontend/src/pages/PatientsPage.tsx` (lines 37–46) |

### Detailed Description

Both `ExaminationsPage` and `PatientsPage` store all filter state (`selectedPatientId`, `selectedStatus`, `selectedExamType`, `fromDate`, `toDate`, `searchQuery`, `page`, `pageSize`) exclusively in React component state. When the user navigates away (e.g., opens an examination detail, then returns via the browser back button), all filter and pagination state is reset to defaults. React Router re-mounts the component, `useEffect` runs the initial `loadExaminations()` / `loadPatients()` call with no filters, and the user starts over from page 1. There is no way to share or bookmark a filtered view.

### Steps to Reproduce

1. Navigate to **All Exams**.
2. Set a status filter to **Completed** and navigate to page 2.
3. Click any row to open an examination.
4. Press the browser **Back** button.

### Observed Behaviour

The Exams page reloads with all filters reset to defaults and page back to 1.

### Expected Behaviour

Active filter values and current page number must be reflected in the URL as query parameters (e.g., `?status=completed&page=2`). On returning to the page, the URL query string must be read to restore the previous filter and page state.

---
