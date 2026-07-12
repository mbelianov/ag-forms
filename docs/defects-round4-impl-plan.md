# Implementation Plan — Defects Round 4

| Field            | Value                                                       |
|------------------|-------------------------------------------------------------|
| **Document**     | Defects Round 4 — Implementation Plan                      |
| **Date**         | 2025-07-11                                                  |
| **Requirements** | `docs/defects-round4-req-spec.md`                          |
| **Source Defects** | `docs/defects-round4.txt`                               |
| **Status**       | Complete                                                    |

---

## Overview

This plan translates the four confirmed defect requirements (D4-01 through D4-04) into concrete,
ordered implementation tasks. All changes are confined to the frontend unless explicitly stated
otherwise. No new backend endpoints are required except for D4-01, which requires a new
`GET /v1/patients/count` Azure Function.

**Affected files at a glance:**

| Layer    | File(s)                                                           | Defects |
|----------|-------------------------------------------------------------------|---------|
| Backend  | `api/src/functions/GetPatients.ts` *(new function alongside)*     | D4-01   |
| Frontend | `frontend/src/pages/DashboardPage.tsx`                            | D4-01   |
| Frontend | `frontend/src/services/patientService.ts`                         | D4-01   |
| Frontend | `frontend/src/types/index.ts`                                     | D4-01   |
| Frontend | `frontend/src/pages/PatientsPage.tsx`                             | D4-02, D4-03, D4-04 |
| Docs     | `AGENTS.md`                                                       | D4-03   |

---

## Task T4-01 — New Backend Endpoint: `GET /v1/patients/count` — **Status: DONE**

**Addresses:** R-D4-01-1, R-D4-01-2  
**Defect:** D4-01

### Context

The [`DashboardPage.tsx`](../frontend/src/pages/DashboardPage.tsx) currently derives
`totalPatients` from `patients.length` after calling `patientService.getPatients()`, which returns
only a single page of records (default page size = 50, defined in
[`GetPatients.ts:9`](../api/src/functions/GetPatients.ts)). The dashboard tile therefore always
displays the page size rather than the true database count.

Azure Table Storage provides no native `COUNT(*)` aggregate. The authoritative count must be
obtained by iterating all entities under `PartitionKey eq 'PATIENT' and isDeleted eq false`
server-side, counting them, and returning only the integer — never returning all entity payloads
to the client.

### Todo List

1. ✅ **Create `api/src/functions/GetPatientsCount.ts`**
   - Register an Azure Function named `GetPatientsCount` on route `v1/patients/count`,
     method `GET`.
   - Require authentication via `requireAuth()`; return `unauthorizedResponse` if not
     authenticated.
   - Use `getTableClient('Patients')` to iterate all entities with filter
     `PartitionKey eq 'PATIENT' and isDeleted eq false`.
   - Count entities in a `for await` loop — **do not** collect full entity objects into
     memory; only increment a counter.
   - Return `successResponse({ count: <number> })`.

2. ✅ **Add `getPatientCount()` method to `frontend/src/services/patientService.ts`**
   - Issue `GET /v1/patients/count`.
   - Return the `count` field from the unwrapped response.
   - Follow the existing error-handling pattern (extract message from `error.response?.data`).

3. ✅ **Extend `frontend/src/types/index.ts`**
   - Add `export interface PatientCountResponse { count: number; }`.

4. ✅ **Update `frontend/src/pages/DashboardPage.tsx`**
   - Add a separate `totalPatients` state (`useState<number>(0)`), distinct from the patients
     array used for the recent-patients list.
   - In `loadData`, call `patientService.getPatientCount()` in parallel with the existing
     `Promise.all` (or add it to the array) and assign the result to `totalPatients` state.
   - Replace the derived `const totalPatients = patients.length` with the new state variable.
   - The existing `patients` state for the recent-patients list remains unchanged.

### Expected Outcomes

- `GET /v1/patients/count` returns `{ count: 1000 }` when the table holds 1,000 non-deleted
  PATIENT entities.
- The Dashboard "Total Patients" tile displays `1000`, not `50`.
- The tile value is independent of the length of any client-side patient array.

### Relevant Files

- [`api/src/functions/GetPatients.ts`](../api/src/functions/GetPatients.ts) — reference for
  filter string, table name constant, and auth pattern.
- [`api/src/utils/tableClient.ts`](../api/src/utils/tableClient.ts) — `getTableClient()` helper.
- [`api/src/utils/responseHelpers.ts`](../api/src/utils/responseHelpers.ts) — `successResponse()`.
- [`frontend/src/pages/DashboardPage.tsx`](../frontend/src/pages/DashboardPage.tsx) — lines 49,
  104: current derived `totalPatients`.
- [`frontend/src/services/patientService.ts`](../frontend/src/services/patientService.ts) —
  `getPatients()` method as the implementation pattern to follow.
- [`frontend/src/types/index.ts`](../frontend/src/types/index.ts) — `PatientsListResponse` as
  the shape pattern to follow.

---

## Task T4-02 — Fix Patient-Count Label Logic in `PatientsPage` — **Status: DONE**

**Addresses:** R-D4-02-1, R-D4-02-2, R-D4-02-3  
**Defect:** D4-02

### Context

In [`PatientsPage.tsx`](../frontend/src/pages/PatientsPage.tsx), the `TableContainer`
`description` prop (line 282–285) currently renders one of two strings:

```tsx
// Current (incorrect)
searchQuery.trim().length >= 2
  ? `${totalItems} patient${totalItems !== 1 ? 's' : ''} found matching "${searchQuery}"`
  : `${totalItems} patient${totalItems !== 1 ? 's' : ''} found`   // ← "found" is wrong in default state
```

The default branch always says `"found"`, which is semantically incorrect when no search has been
submitted. The correct label in the default state is `"loaded"`.

Additionally, `totalItems` is derived from `rows.length` (line 188), which is the count of
`filteredPatients` after client-side mapping. In the default (non-search) state this reflects
the number of loaded records correctly. In the active search state it reflects the search results
count, which is already all matching records per R-D4-02-3 (the search API returns all matches
up to its internal MAX_RESULTS; no frontend truncation is applied).

An important nuance: the `searchQuery` string alone is not a reliable signal for whether a search
has been *submitted* vs. merely *typed* (post D4-03 fix, the field can be populated without a
search being executed). A dedicated boolean state variable `isSearchActive` is required.

### Todo List

1. ✅ **Add `isSearchActive` boolean state** to `PatientsPage` (`useState<boolean>(false)`).
   - Set to `true` only when the backend search API call is successfully initiated.
   - Set to `false` when the search field is cleared (the empty-query branch of `handleSearch`).
   - Do **not** set it on every `searchQuery` change (this supports the D4-03 Enter-key model).

2. ✅ **Update the `TableContainer` description prop** to use `isSearchActive`:
   ```tsx
   // New (correct)
   isSearchActive
     ? `${totalItems} patient${totalItems !== 1 ? 's' : ''} found`
     : `${totalItems} patient${totalItems !== 1 ? 's' : ''} loaded`
   ```
   Remove the matching `"${searchQuery}"` substring from the description string (this context is
   already communicated by the `ActionableNotification` search-mode banner at line 213–224).

3. ✅ **Verify the D4-02-3 requirement** (all matching records loaded): the current
   `patientService.searchPatients()` returns whatever the backend returns in a single call.
   The backend [`SearchPatients.ts`](../api/src/functions/SearchPatients.ts) caps results at
   `MAX_RESULTS = 50`. This cap must be raised or removed:
   - In `api/src/functions/SearchPatients.ts`, increase `MAX_RESULTS` to a value that covers
     all realistic datasets (e.g. `1000`), **or** remove the hard cap entirely, as the search
     index is already scoped to a single partition-key bucket (by first character), which
     naturally bounds the result set.

4. ✅ **Update the `ActionableNotification` condition** at line 213 to use `isSearchActive` instead
   of `searchQuery.trim().length >= 2`, for consistency.

5. ✅ **Verify the clear-search path**: when `handleSearch('')` is called (via the "Clear search"
   button or onClear), ensure `isSearchActive` is set to `false` and the label reverts to
   `"loaded"` phrasing.

### Expected Outcomes

- Default state (no search submitted): label reads `"50 patients loaded"`.
- After a search is submitted and results are returned: label reads `"120 patients found"`.
- After clearing the search: label reverts to `"X patients loaded"`.
- Search results contain all matching records, not a capped subset.

### Relevant Files

- [`frontend/src/pages/PatientsPage.tsx`](../frontend/src/pages/PatientsPage.tsx) — lines
  45–159 (state and handlers), 282–285 (description prop).
- [`api/src/functions/SearchPatients.ts`](../api/src/functions/SearchPatients.ts) — line 9:
  `MAX_RESULTS = 50`.

---

## Task T4-03 — Change Patient Search Trigger from Debounced Keystroke to Enter Key — **Status: DONE**

**Addresses:** R-D4-03-1, R-D4-03-2, R-D4-03-3  
**Defect:** D4-03

### Context

In [`PatientsPage.tsx`](../frontend/src/pages/PatientsPage.tsx):

- The `Search` component's `onChange` handler (line 246) calls `handleSearch(e.target.value)`
  on **every keystroke**.
- `handleSearch` (line 104) debounces the API call by 300 ms (lines 140–157), but the
  backend call is still triggered automatically after each 300 ms idle period. This does **not**
  satisfy R-D4-03-2 (no keystroke-triggered API calls).
- The `handleSearch` function also enforces a guard at line 128 (`query.trim().length < 2`) that
  effectively prevents searches from being initiated for single-character input, but does **not**
  prevent the input field itself from receiving characters. The reported 2-char cap is likely a
  UI-level side-effect of the current debounce/auto-search behaviour — the field does not block
  typing, but the immediate API call at 2 chars resets `filteredPatients`, giving the appearance
  that input is blocked. After this fix the perceived cap disappears naturally.
- The `onKeyDown` handler at line 248 currently only handles `Escape`.

The required model is: the `Search` field is a **controlled unsubmitted input**. Typing updates
only the local `searchQuery` state; no API call is made. Pressing **Enter** submits the search.

### Todo List

1. ✅ **Decouple the search-field value state from the search-execution logic.**
   - Introduce a separate local state `inputValue` (`useState<string>`) that tracks what is
     currently typed in the field.
   - The `Search` component's `value` prop and `onChange` handler should manage `inputValue` only
     — no side-effects, no API calls, no debounce.

2. ✅ **Move all search-execution logic to an `onKeyDown` Enter handler.**
   - In the `Search` component's `onKeyDown` prop, when `e.key === 'Enter'`:
     - Call the existing `handleSearch(inputValue)` function (which sets `searchQuery`,
       updates the URL, and dispatches the API call).
   - Keep the `Escape` handler to clear the input and cancel any active search.

3. ✅ **Remove the 300 ms debounce timer** (`searchTimerRef`) from `handleSearch` entirely, since
   the Enter-key model makes debouncing unnecessary. The API call is dispatched synchronously
   (within the async callback) upon Enter.

4. ✅ **Remove the `searchTimerRef` ref** and the `clearTimeout` calls associated with it, as they
   are no longer needed.

5. ✅ **Keep the `searchAbortRef` and abort-on-new-search logic** — this remains valid to cancel
   any in-flight search when the user submits a new query before the previous one completes.

6. ✅ **Keep the `onClear` handler** (`handleSearch('')`) so that clicking the Carbon `Search`
   clear (×) button resets the field and search state correctly.

7. ✅ **Update the `handleSearch` function signature** — it should no longer be called on every
   character change. Ensure it: (a) still handles the empty-string case to reset search state,
   (b) still enforces the 2-char backend minimum (show the `searchInfo` hint if `inputValue`
   length is 1), (c) fires the API call immediately (no setTimeout wrapper).

8. ✅ **Sync `inputValue` with `searchQuery`** on initial mount if the URL contains a `?q=` param
   (to restore search state on browser reload), reusing the existing `searchParams.get('q')`
   initialisation pattern.

### Expected Outcomes

- Typing any number of characters in the search field does not trigger any API request.
- Pressing Enter with 5 characters typed dispatches exactly one `GET /v1/patients-search?name=…`
  request.
- Typing a 3rd character after 2 characters does not trigger an API call.
- Typing 1 character and pressing Enter shows the "Type at least 2 characters" hint without
  making an API call.
- The Carbon Search clear (×) button resets the field and restores the full patient list.

### Relevant Files

- [`frontend/src/pages/PatientsPage.tsx`](../frontend/src/pages/PatientsPage.tsx) — lines
  56–58 (refs), 104–159 (handleSearch), 241–253 (Search JSX).
- [`frontend/src/services/patientService.ts`](../frontend/src/services/patientService.ts) —
  `searchPatients()` (no changes needed here).

---

## Task T4-04 — Fix "Load More Patients" to Append Rather Than Replace — **Status: DONE**

**Addresses:** R-D4-04-1, R-D4-04-2, R-D4-04-3  
**Defect:** D4-04

### Context

In [`PatientsPage.tsx`](../frontend/src/pages/PatientsPage.tsx), the `loadPatients` callback
(lines 61–80) unconditionally **replaces** the patient list on each invocation:

```ts
// Current (incorrect)
setPatients(response.patients);       // replaces
setFilteredPatients(response.patients); // replaces
```

The `loadPatients` function is called both on initial page load (no token) and on
"Load More" clicks (with a `continuationToken`). There is no differentiation between the two
cases. The fix requires detecting whether a continuation token was provided and, if so,
**appending** rather than replacing.

### Todo List

1. ✅ **Add an `append` parameter to `loadPatients`**:
   ```ts
   const loadPatients = useCallback(async (token?: string, append = false) => { … }, []);
   ```
   When `append` is `true`, merge the new page into the existing state:
   ```ts
   if (append) {
     setPatients(prev => [...prev, ...response.patients]);
     setFilteredPatients(prev => [...prev, ...response.patients]);
   } else {
     setPatients(response.patients);
     setFilteredPatients(response.patients);
   }
   ```

2. ✅ **Update the "Load More" button's `onClick` handler** (line 381) to pass `append = true`:
   ```tsx
   onClick={() => loadPatients(continuationToken, true)}
   ```

3. ✅ **Leave the initial `loadPatients()` call** (line 85, no token, no append flag) unchanged —
   it must continue to replace the list on first load and on search-clear reload.

4. ✅ **Verify the patient-count label updates correctly** after each append. Because `totalItems`
   is derived from `filteredPatients.length` (line 188 → `rows.length`), and `filteredPatients`
   is appended in step 1, the `"X patients loaded"` label automatically reflects the cumulative
   count. No additional changes are required for label update (R-D4-04-3 is satisfied
   transitively by T4-02).

5. ✅ **Verify the "Load More" button visibility condition** (line 377):
   `continuationToken && searchQuery.trim().length < 2` — this correctly hides the button when
   there is no next page, satisfying AC-D4-04-4. After the D4-03 fix, the condition should be
   updated to use `!isSearchActive` instead of `searchQuery.trim().length < 2`, for consistency
   with the new search-state model introduced in T4-02.

### Expected Outcomes

- Clicking "Load More Patients" with 50 records visible results in 100 records in the table.
- Clicking it a second time results in 150 records (or all remaining, if fewer than 50 remain).
- Previously loaded records are not removed or replaced.
- The `"X patients loaded"` label reflects the cumulative count after each load.
- The "Load More" button disappears when no continuation token is returned.

### Relevant Files

- [`frontend/src/pages/PatientsPage.tsx`](../frontend/src/pages/PatientsPage.tsx) — lines
  61–80 (`loadPatients`), 377–387 (Load More button JSX).

---

## Task T4-05 — Update `AGENTS.md` to Reflect Enter-Key Search Behaviour — **Status: DONE**

**Addresses:** Documentation consistency for R-D4-03-2 and R-D4-03-3  
**Defect:** D4-03

### Context

[`AGENTS.md`](../AGENTS.md) line 24 currently states:

> Patient search uses the dedicated route `/v1/patients-search` (avoids collision with
> `/v1/patients/{id}`) and **requires query param `name` (min 2 chars)**.

The phrase "min 2 chars" describes the backend enforcement. However, it no longer documents the
frontend interaction model accurately after the D4-03 fix, where search is triggered by
Enter-key submission rather than automatic debounced firing. Agents working on the codebase could
misinterpret this line as an instruction to fire API calls at the 2-character threshold.

### Todo List

1. ✅ **Update the patient search bullet in `AGENTS.md`** to also describe the frontend trigger
   model. Replace the existing bullet with:

   > Patient search uses the dedicated route `/v1/patients-search` (avoids collision with
   > `/v1/patients/{id}`); backend requires query param `name` (minimum 2 characters, enforced
   > server-side). On the frontend, search is **only triggered by an explicit Enter-key
   > submission** — never on keystroke or debounce. Do not introduce `onChange`-driven or
   > debounced calls to the search endpoint in `PatientsPage`.

### Expected Outcomes

- `AGENTS.md` accurately describes both the backend constraint (min 2 chars) and the frontend
  interaction model (Enter-key only).
- Future agents will not re-introduce the keystroke-driven search pattern.

### Relevant Files

- [`AGENTS.md`](../AGENTS.md) — line 24.

---

## Implementation Order and Dependencies

The tasks are designed to be implemented sequentially. Dependencies are as follows:

```
T4-01  (independent — new backend endpoint + dashboard fix)
  │
T4-02  (independent of T4-01; must precede T4-03 and T4-04 because it introduces isSearchActive)
  │
T4-03  (depends on T4-02: uses isSearchActive state; replaces the onChange-driven search model)
  │
T4-04  (depends on T4-02 and T4-03: uses isSearchActive in the Load More visibility condition)
  │
T4-05  (independent — documentation only; can be done at any time, preferably alongside T4-03)
```

| Order | Task  | Layer    | Files Changed                                          | Can Parallelize With |
|-------|-------|----------|--------------------------------------------------------|----------------------|
| 1     | T4-01 | BE + FE  | `GetPatientsCount.ts` (new), `DashboardPage.tsx`, `patientService.ts`, `types/index.ts` | T4-05 |
| 2     | T4-02 | FE       | `PatientsPage.tsx`, `SearchPatients.ts`                | T4-05                |
| 3     | T4-03 | FE       | `PatientsPage.tsx`                                     | —                    |
| 4     | T4-04 | FE       | `PatientsPage.tsx`                                     | —                    |
| 5     | T4-05 | Docs     | `AGENTS.md`                                            | T4-01, T4-02         |

---

## Key Design Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | New `GET /v1/patients/count` endpoint rather than extending `GET /v1/patients` to include a `totalCount` field | Keeps the pagination response contract unchanged; the Dashboard does not need patient records, only the count. Avoids a full-table scan on every paginated list request. |
| 2 | `isSearchActive` boolean state rather than deriving search state from `searchQuery.trim().length >= 2` | After the D4-03 fix, `searchQuery` can hold a typed value that has not been submitted. A dedicated flag makes the search-submitted state explicit and unambiguous. |
| 3 | `append` parameter on `loadPatients` rather than a separate `loadMorePatients` function | Minimal change — the existing logic, abort handling, and loading state are reused. A separate function would duplicate all of that. |
| 4 | Remove debounce timer entirely (T4-03) rather than keeping it with an Enter guard | The timer serves no purpose in the Enter-key model and its presence would mislead future maintainers. Clean removal reduces complexity. |
| 5 | Raise `MAX_RESULTS` in `SearchPatients.ts` rather than implementing pagination for search results | The requirements specify that **all** matching records are loaded on search. A simple cap increase is the minimal change; adding search pagination would be a larger scope change not requested. |
