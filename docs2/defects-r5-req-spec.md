# Requirements Specification — Release 5 Defects and Changes

**Source:** `docs2/defects-r5.txt`  
**Related:** `docs2/KNOWN-ISSUES.md` (KI-005)  
**Status:** Draft

---

## Overview

This document translates the informal defect and change descriptions in `defects-r5.txt` into
precise, unambiguous requirements. Each requirement is self-contained and traceable to a source
item. Requirements are grouped into three areas:

1. **Dashboard fixes** (REQ-R5-01, REQ-R5-02)
2. **Counters infrastructure** (REQ-R5-03) — prerequisite for REQ-R5-01 only
3. **All Exams page rework** (REQ-R5-04 through REQ-R5-09)

---

## Terminology

| Term | Definition |
|------|-----------|
| **active filter** | Any of the following filter controls on the All Exams page is set to a non-default value: Filter by Patient, Filter by Status, Filter by Type, From Date, To Date. |
| **browse mode** | The state of the All Exams table when no active filter is applied. |
| **filter mode** | The state of the All Exams table when one or more active filters are applied. |
| **loaded set** | The set of examination records currently held in frontend memory, accumulated page by page from the server. In browse mode this grows on user demand (lazy paging). In filter mode this is built by automatic page exhaustion and, once complete, equals the full database result for the active filters. |
| **loaded set size** | `loadedSet.length` — the count of records in the loaded set at any given moment. This single value drives the count label in both browse mode and filter mode. In browse mode it reflects how many records have been fetched so far. In filter mode it is the final total once page exhaustion is complete. The `Counters` table is not used on the All Exams page; it is used only by the Dashboard (REQ-R5-01). |
| **server page** | One response from `GET /v1/examinations`, containing up to 50 records and an optional `continuationToken` for the next page. |
| **continuation token** | An opaque string returned by `GET /v1/examinations` when more records remain. Passing it back as the `continuationToken` query parameter retrieves the next server page of the same query. |

---

## REQ-R5-01 · Dashboard — Total Examinations tile must display database total

**Source:** defect 1 in `defects-r5.txt`  
**Prerequisite:** REQ-R5-03 (Counters infrastructure) must be implemented first.

### Description

The "Total Examinations" tile on the Dashboard page currently derives its value from
`examinations.length`, which reflects only the first server page returned by
`GET /v1/examinations` (at most 50 records). This value is incorrect when the total number
of examinations in the database exceeds the page size.

### Requirements

**REQ-R5-01-A.** A new backend endpoint `GET /v1/examinations-count` must be created. It must:
  - Require a valid authenticated session (same auth middleware as all other endpoints).
  - Read the `EXAM_TOTAL` counter row from the `Counters` table (partition key `COUNTER`,
    row key `EXAM_TOTAL`) as specified in REQ-R5-03.
  - Return `{ count: <number> }` in the standard success envelope.
  - Return `{ count: 0 }` if the counter row does not exist (i.e., no examinations have
    ever been created).

**REQ-R5-01-B.** A new method `getExaminationCount(): Promise<number>` must be added to
`examinationService.ts`. It must call `GET /v1/examinations-count` and return the `count`
value from the response.

**REQ-R5-01-C.** `DashboardPage` must fetch the examination count using `getExaminationCount()`
independently of the existing `getExaminations()` call. The fetch must be non-fatal: if it
fails, the tile must display `—` (em dash) rather than crashing or blocking the rest of the
dashboard from rendering. This mirrors the existing non-fatal pattern used for the patient
count (see `DashboardPage` lines 46–51).

**REQ-R5-01-D.** The "Total Examinations" tile must display the value returned by
`getExaminationCount()`. The tile must display `—` while the count request is in flight and
whenever the request fails.

---

## REQ-R5-02 · Dashboard — Quick Actions section must align with adjacent sections

**Source:** defect 2 in `defects-r5.txt`

### Description

The "Quick Actions" `<Tile>` is currently rendered outside of any Carbon `<Grid>`/`<Column>`
layout container, while the statistics tiles above and the recent-activity section below are
both wrapped in `<Grid narrow>`. This causes the left and right edges of the Quick Actions
tile to be misaligned relative to the other sections.

### Requirements

**REQ-R5-02-A.** The "Quick Actions" tile must be placed inside the same `<Grid narrow>`
layout structure as the statistics tiles and the recent-activity panels, such that its left
edge aligns with the left edge of those sections and its right edge aligns with the right
edge of those sections.

**REQ-R5-02-B.** The Quick Actions tile must span the full available width within the grid
(equivalent to all 16 Carbon grid columns).

**REQ-R5-02-C.** The visual content of the Quick Actions tile (heading, buttons) must remain
unchanged.

---

## REQ-R5-03 · Counters infrastructure — Extend `Counters` table to track total patient and examination counts

**Source:** KI-005 (Option C), prerequisite for REQ-R5-01 only
**Related:** `api/src/utils/mrnGenerator.ts`, `api/src/types/index.ts` (`Counter` interface)

### Description

Azure Table Storage does not support aggregate `COUNT(*)` queries. The existing
`GET /v1/patients-count` endpoint performs a full-table scan to count patients, which is an
O(N) operation that becomes a performance risk as data volumes grow (see KI-005).

The `Counters` table already exists and is used by `mrnGenerator.ts` for MRN sequence
generation. It uses partition key `COUNTER` and stores counter rows with optimistic
concurrency (ETag-based) and exponential-backoff retry logic (max 5 retries). This same
table and pattern must be extended to maintain total counts for patients and examinations.

### Counter rows

Two new counter rows must be maintained in the existing `Counters` table:

| Partition Key | Row Key        | Purpose |
|---------------|----------------|---------|
| `COUNTER`     | `PATIENT_TOTAL` | Total number of non-deleted patients |
| `COUNTER`     | `EXAM_TOTAL`    | Total number of non-deleted examinations |

Both rows use the existing `Counter` interface (`counterType`, `value`, `lastUpdated`).

### Requirements

**REQ-R5-03-A — Increment on patient creation.**  
`CreatePatient.ts` must increment the `PATIENT_TOTAL` counter by 1 after successfully
persisting the patient entity. The increment must use the same optimistic-concurrency retry
pattern as `generateMRN()` in `mrnGenerator.ts` (read → increment → update with ETag; retry
up to 5 times with exponential backoff on 412 conflict; auto-create the counter row with
value `1` if it does not yet exist).

**REQ-R5-03-B — Decrement on patient soft-delete.**  
`DeletePatient.ts` must decrement the `PATIENT_TOTAL` counter by 1 after successfully
soft-deleting the patient entity. The same optimistic-concurrency retry pattern applies.
The counter value must never be decremented below `0`.

**REQ-R5-03-C — Increment on examination creation.**  
`CreateExamination.ts` must increment the `EXAM_TOTAL` counter by 1 after successfully
persisting all three examination entities (primary, lookup, and MRN rows). The same
optimistic-concurrency retry pattern applies.

**REQ-R5-03-D — Decrement on examination soft-delete.**  
`DeleteExamination.ts` must decrement the `EXAM_TOTAL` counter by 1 after successfully
soft-deleting the examination. When `DeletePatient.ts` cascade-deletes examinations via
`cascadeDeleteExaminations()`, the `EXAM_TOTAL` counter must be decremented by the number
of active examinations that were cascade-deleted (one decrement per deleted examination, or
a single decrement by the total count — either is acceptable as long as the final value is
accurate).

**REQ-R5-03-E — Counter helper utility.**  
The increment/decrement logic must be extracted into a shared utility function (e.g.,
`adjustCounter(table, partitionKey, rowKey, delta)` in a suitable location such as
`mrnGenerator.ts` or a new `counterService.ts`) so that all four callsites (REQ-R5-03-A
through REQ-R5-03-D) use the same implementation. The function must handle auto-creation
of the counter row if it does not exist, using the same initialization pattern as
`initializeCounter()` in `mrnGenerator.ts`.

**REQ-R5-03-F — Replace the O(N) scan in `GetPatientsCount.ts`.**  
`GetPatientsCount.ts` must be updated to read the `PATIENT_TOTAL` counter row from the
`Counters` table instead of performing a full entity scan. The endpoint signature
(`GET /v1/patients-count` returning `{ count: number }`) must remain unchanged so that
`patientService.getPatientCount()` and `DashboardPage` require no modification.

**REQ-R5-03-G — Counter failures must be non-fatal.**  
A failure to increment or decrement a counter (e.g., after exhausting all retries) must be
logged as an error but must not cause the parent operation (patient creation, examination
creation, or deletion) to fail or return an error response to the client. Count accuracy is
best-effort; the primary data write takes precedence.

---

## REQ-R5-04 · All Exams page — Table title count label must match Patient List style

**Source:** change item 1 in `defects-r5.txt`

### Description

The All Exams table currently uses the `description` prop of Carbon's `<TableContainer>` to
show the count information (e.g., "50 exams found"). This renders below the title in a
smaller, secondary style. The requirement is to move the count to an inline suffix on the
table title, matching the exact pattern used in `PatientsPage`.

### Requirements

**REQ-R5-04-A.** The `title` and `description` props must be removed from the `<TableContainer>`
component on the All Exams page.

**REQ-R5-04-B.** A custom title header must be rendered inside the `<TableContainer>` using
the same markup pattern as `PatientsPage` (lines 305–310):

```
<span style={{ fontWeight: 700, fontSize: '1rem' }}>Exam List</span>
<span style={{ fontWeight: 400, fontSize: '0.75rem', marginLeft: '0.5rem', color: '#525252' }}>
  {count label}
</span>
```

**REQ-R5-04-C.** The count label text must follow the rules defined in REQ-R5-05. The label
must be left-aligned.

---

## REQ-R5-05 · All Exams page — Count label text rules

**Source:** change items 2 and 3 in `defects-r5.txt`

### Description

The count label rendered in the table title (per REQ-R5-04) must reflect different
information depending on whether the table is in browse mode or filter mode.

### Requirements

**REQ-R5-05-A — Browse mode (no active filter).**  
The count label must read: `<N> exam loaded` (singular) or `<N> exams loaded` (plural),
where `<N>` is the number of examination records currently in the loaded set (i.e.,
accumulated in frontend memory across all server pages fetched so far). This number grows
as the user pages through the table and additional server pages are fetched on demand (see
REQ-R5-07).

**REQ-R5-05-B — Filter mode (one or more active filters).**
The count label must read: `<N> exam found` (singular) or `<N> exams found` (plural), where
`<N>` is the loaded set size (see Terminology). Because filter mode exhausts all server pages
automatically (per REQ-R5-06), the loaded set size equals the total number of matching records
in the database once exhaustion is complete.

While page exhaustion is still in progress, the count label must display the current loaded set
size with a trailing ellipsis to indicate the value is not yet final (e.g., `47 exams found…`).
When the last server page is received and no further `continuationToken` exists, the ellipsis
must be removed and the final count displayed (e.g., `112 exams found`). No separate count API
call is made; the Counters table is not consulted on the All Exams page.

---

## REQ-R5-06 · All Exams page — Filter mode must exhaust all server pages automatically

**Source:** change items 3 and 5 in `defects-r5.txt`

### Description

When a filter is active, the frontend must automatically follow all continuation tokens
returned by `GET /v1/examinations` until no further token is present, building the complete
in-memory result set. Each server page (up to 50 records) is appended to the loaded set as
it arrives, so the table is interactive and displays records incrementally throughout the
process.

This sequential exhaustion serves dual purpose: it populates the table with the complete
result set and its final length (the loaded set size) becomes the count shown in the label
(per REQ-R5-05-B). No separate count API call is needed in filter mode; the Counters table
is not consulted.

### Requirements

**REQ-R5-06-A.** When any filter is applied (i.e., the page transitions to filter mode),
the frontend must issue `GET /v1/examinations` with the active filter parameters and fetch
all server pages sequentially by following continuation tokens until the response contains
no `continuationToken`.

**REQ-R5-06-B.** Each server page response must be appended to the loaded set immediately
upon receipt. The table must display the updated loaded set after each append, so the user
sees records being added progressively as pages arrive. The count label must also update
after each append to reflect the current loaded set size with a trailing ellipsis
(per REQ-R5-05-B), so the user can observe the count growing as data arrives.

**REQ-R5-06-C.** During sequential page fetching, an `<InlineLoading>` indicator must be
displayed to signal that more data is being loaded.

**REQ-R5-06-D.** If the user changes or clears a filter while sequential page fetching is
in progress, the in-flight request must be aborted (using the existing `AbortController`
pattern), the loaded set must be cleared, and a new fetch sequence must begin with the
updated filter parameters.

**REQ-R5-06-E.** When all pages have been fetched and no `continuationToken` remains, the
`<InlineLoading>` indicator must be hidden. The count label must display the final loaded set
size without a trailing ellipsis (e.g., `112 exams found`). This value is `loadedSet.length`
and represents the exact total of matching records in the database for the active filters.

**REQ-R5-06-F.** The frontend pagination component (`<Pagination>`) must reflect the total
number of records in the loaded set after all pages are fetched. The user can page through
all loaded records using the pagination controls without triggering additional API calls.

---

## REQ-R5-07 · All Exams page — Browse mode must use lazy server-side paging

**Source:** change item 5 in `defects-r5.txt`

### Description

In browse mode (no active filter), the full examination set may be very large. Loading all
records eagerly is not required. Instead, browse mode must use the existing lazy
continuation-token mechanism: the first server page is loaded on mount, and additional
server pages are loaded on demand as the user pages forward through the table. This is the
same pattern already implemented in `PatientsPage` (see `loadPatients()` with `append = true`
and the "Load More Patients" button).

### Requirements

**REQ-R5-07-A.** In browse mode, the initial page load must fetch only the first server page
(up to 50 records) from `GET /v1/examinations` with no filter parameters.

**REQ-R5-07-B.** If the response contains a `continuationToken`, a "Load More Exams" button
must be displayed below the table. Clicking this button must fetch the next server page and
append its records to the loaded set. This matches the existing pattern in `PatientsPage`
(lines 403–413).

**REQ-R5-07-C.** The "Load More Exams" button must be hidden when all server pages have been
fetched (i.e., no `continuationToken` is present in the latest response).

**REQ-R5-07-D.** The "Load More Exams" button must be hidden when any filter is active
(filter mode is governed by REQ-R5-06, which fetches all pages automatically).

**REQ-R5-07-E.** Transitioning from filter mode back to browse mode (by clearing all filters)
must reset the loaded set to the first server page result only, restoring the lazy-paging
behaviour and showing the "Load More Exams" button if a `continuationToken` is present.

---

## REQ-R5-08 · All Exams page — Remove the inline table search field

**Source:** change item 4 in `defects-r5.txt`

### Description

The All Exams table currently includes a `<TableToolbarSearch>` component rendered inside
`<TableToolbarContent>`, which provides a "Search by patient name" field integrated into the
table toolbar. This field is redundant given the "Filter by Patient" control (which is being
upgraded per REQ-R5-09) and must be removed.

### Requirements

**REQ-R5-08-A.** The `<TableToolbarSearch>` component and its enclosing `<TableToolbar>` /
`<TableToolbarContent>` wrapper must be removed from the `ExaminationsPage` JSX. If the
`<TableToolbar>` wrapper serves no other purpose after removing the search field (i.e., the
Create Exam button is the only remaining child), it may be relocated outside the `<DataTable>`
render-prop, consistent with the pattern in `PatientsPage` where the search field and Create
button live outside the `<DataTable>` entirely.

**REQ-R5-08-B.** All state and logic that exists solely to support the inline search field
must be removed: the `searchQuery` state variable, the `handleSearch` callback, the
`searchTimerRef` debounce ref, the `searchAbortRef` abort controller, the `isSearching`
state variable, the `searchInfo` state variable, and the search-mode `<ActionableNotification>`
banner. Any remaining references to `searchQuery` (e.g., in `isFilterActive`, `activeFilterSummary`,
`hasMore` conditions) must be updated or removed accordingly.

**REQ-R5-08-C.** The `TableToolbar`, `TableToolbarContent`, and `TableToolbarSearch` imports
from `@carbon/react` must be removed if no longer used after this change.

---

## REQ-R5-09 · All Exams page — Filter by Patient must support name search via combobox

**Source:** change item 6 in `defects-r5.txt`

### Description

The "Filter by Patient" control is currently a `<Select>` dropdown populated from a single
server page of patients (up to 50 records). If the database contains more patients than the
page size, patients beyond the first page are not selectable. Additionally, a fixed dropdown
is not user-friendly when the patient list is large.

The control must be replaced with a type-ahead combobox that allows the user to type a
patient name and receive matching suggestions from the database via the existing
`GET /v1/patients-search` endpoint (minimum 2 characters, already enforced server-side).
Selecting a suggestion sets the patient filter and triggers a new examination query.

### Requirements

**REQ-R5-09-A.** The `<Select id="patientFilter">` control and its `<SelectItem>` children
must be replaced with a Carbon `<ComboBox>` component.

**REQ-R5-09-B.** The combobox must accept free-text input. When the input value reaches 2
or more characters, the frontend must call `patientService.searchPatients(query)` (which
calls `GET /v1/patients-search?name=<query>`) and populate the combobox dropdown with the
returned patient names. Calls must be debounced by 350 ms to avoid excessive API requests
on rapid keystrokes.

**REQ-R5-09-C.** Each combobox item must display the patient's full name. The underlying
value associated with the item must be the patient's `patientId`.

**REQ-R5-09-D.** When the user selects a patient from the dropdown, the `selectedPatientId`
filter state must be set to the selected patient's `patientId`, and the examination table
must reload with that patient filter applied (transitioning to filter mode per REQ-R5-06). Pressing Enter in the combobox without selecting an item from the dropdown must have no effect on the patient filter.

**REQ-R5-09-E.** When the user clears the combobox input (types nothing or presses Escape),
the patient filter must be cleared (`selectedPatientId = ''`) and the table must return to
browse mode, provided no other filters remain active. If the user edits the combobox input
after a patient has been selected — without selecting a new patient from the dropdown — the
patient filter must remain active and the examination table must not reload. The table only
changes when the user makes a new committed choice: either selecting a new patient
(REQ-R5-09-D) or fully clearing the input (this clause).

**REQ-R5-09-F.** The combobox must display an `<InlineLoading>` indicator while a patient search API call is in progress, to prevent the user from
selecting a stale list.

**REQ-R5-09-G.** The `loadPatients()` function in `ExaminationsPage` (which currently calls
`patientService.getPatients()` on mount to populate the old `<Select>`) must be removed.
The `patients` state array is no longer needed and must be removed along with any derived
references to it (e.g., `patients.find(...)` in `activeFilterSummary`). The patient name
for the active filter summary must be tracked separately in state (e.g., `selectedPatientName`)
and set when the user selects a combobox item.

---

## Implementation Order

The requirements have the following dependencies and must be implemented in this order:

```
REQ-R5-03  (Counters infrastructure)
    │
    └──▶  REQ-R5-01  (Dashboard Total Examinations tile — only consumer of examinations-count endpoint)

REQ-R5-02  (Dashboard alignment — independent of all other requirements)

REQ-R5-04 ─┐
REQ-R5-05  │
REQ-R5-06  ├──  All Exams page rework — independent of REQ-R5-03
REQ-R5-07  │   (count label uses loadedSet.length only; no Counters table access)
REQ-R5-08 ─┤
REQ-R5-09 ─┘
```

Within the All Exams group:
- REQ-R5-04, REQ-R5-05, REQ-R5-06, and REQ-R5-07 are tightly coupled and must be
  implemented together in a single coherent change to `ExaminationsPage`.
- REQ-R5-08 (remove inline search) and REQ-R5-09 (patient combobox) are independent of
  each other and of REQ-R5-04 through REQ-R5-07, and may be implemented in any order.
