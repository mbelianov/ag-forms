# Requirements Specification — Defects Round 4

| Field        | Value                                      |
|--------------|--------------------------------------------|
| **Document** | Defects Round 4 — Requirements Specification |
| **Date**     | 2025-07-11                                 |
| **Source**   | `docs/defects-round4.txt`                  |
| **Status**   | Draft                                      |

## Scope

This document formalises the functional requirements derived from four defects identified in the
patient management frontend. The defects relate to:

1. Incorrect total-patient count displayed on the Dashboard.
2. Misleading patient-count label on the Patients list page.
3. Search field triggering API calls prematurely (on every keystroke) and capping input at two characters.
4. "Load More" functionality replacing rather than appending patient records.

Each defect is analysed, a precise expected behaviour is stated, and one or more testable requirement
statements are derived together with verifiable acceptance criteria.

---

## Defect D4-01 — Dashboard "Total Patients" Tile Shows a Stale / Incorrect Count

### Defect ID
`D4-01`

### Defect Title
Dashboard "Total Patients" tile does not reflect the true total count stored in the database.

### Reported (Actual) Behaviour
The **Total Patients** tile on the dashboard displays `50`, which equals the size of the most recently
loaded page of patients, while the database actually contains `1,000` patient records. The tile value
is therefore driven by the local data set rather than the authoritative database count.

### Expected (Correct) Behaviour
The **Total Patients** tile must display the actual total number of patient records persisted in the
database, regardless of how many patient records have been fetched and held in memory by the client.

### Derived Functional Requirements

| Req ID   | Requirement Statement |
|----------|-----------------------|
| R-D4-01-1 | The system **SHALL** retrieve the authoritative total patient count from a dedicated backend endpoint (or equivalent aggregate query) when rendering the Dashboard page. |
| R-D4-01-2 | The system **SHALL** display the value returned by the backend total-count source in the "Total Patients" dashboard tile, independently of the number of patient records loaded into any client-side list or table. |

### Acceptance Criteria

- **AC-D4-01-1:** Given a database containing 1,000 patient records, when the Dashboard page is loaded,
  the "Total Patients" tile displays `1000` (or the exact current count), not the page size (e.g. `50`).
- **AC-D4-01-2:** Given that a new patient is created after the Dashboard was last rendered, when the
  Dashboard page is refreshed, the "Total Patients" tile increments by one to reflect the new record.
- **AC-D4-01-3:** The tile value does not change solely because additional patient pages are loaded into
  a list or table elsewhere in the application.

---

## Defect D4-02 — Patients List Displays "X Patients Found" Instead of "X Patients Loaded" When No Search Is Active

### Defect ID
`D4-02`

### Defect Title
Patient-count label on the Patients page uses the incorrect phrasing and semantic when the search
field is empty.

### Reported (Actual) Behaviour
When the search field is empty (no active search), the Patients list page displays the message
**"50 patients found"**, which implies a search was executed and 50 records matched. The label does
not distinguish between the default (non-search) state and an active search state.

### Expected (Correct) Behaviour
- **Default state (search field empty):** The label must read **"X patients loaded"**, where `X` is
  the number of patient records currently held in the client-side table, reflecting how many have
  been fetched so far (e.g. via pagination / load-more).
- **Active search state (user has submitted a search query):** The label must read
  **"X patients found"**, where `X` is the total number of records returned by the backend search,
  and **all** matching records must be loaded into the table.

### Derived Functional Requirements

| Req ID    | Requirement Statement |
|-----------|-----------------------|
| R-D4-02-1 | The system **SHALL** display the label `"<N> patients loaded"` on the Patients page whenever no active search query is in effect, where `<N>` equals the number of patient records currently rendered in the table. |
| R-D4-02-2 | The system **SHALL** display the label `"<N> patients found"` on the Patients page only when an active search query has been submitted, where `<N>` equals the total count of matching records returned by the backend. |
| R-D4-02-3 | When an active search query returns results, the system **SHALL** load **all** matching patient records into the Patients table, not a limited page subset. |

### Acceptance Criteria

- **AC-D4-02-1:** Given the search field is empty and 50 patients have been loaded, the Patients page
  shows the label `"50 patients loaded"`.
- **AC-D4-02-2:** Given the search field is empty and the user triggers a "Load More" action that
  fetches 50 additional patients (total 100), the label updates to `"100 patients loaded"`.
- **AC-D4-02-3:** Given the user submits a search query that matches 120 patients, the label reads
  `"120 patients found"` and all 120 records are present in the table.
- **AC-D4-02-4:** Given the user clears the search field (returning to the default state), the label
  reverts to `"X patients loaded"` reflecting only the patients currently in the table.

---

## Defect D4-03 — Patients Page Search Field Triggers API Calls on Every Keystroke and Caps Input at Two Characters

### Defect ID
`D4-03`

### Defect Title
Search field submits search prematurely (on each character typed) and prevents the user from typing
more than two characters.

### Reported (Actual) Behaviour
The search field on the Patients page initiates a backend API call after each individual character is
entered. Furthermore, the user is unable to type more than two characters into the field; further
input is blocked or ignored after the second character.

### Expected (Correct) Behaviour
The search field must accept a full search string of arbitrary length. The backend API call must
be initiated only when the user explicitly submits the query by pressing the **Enter** key, not on
every keystroke. This avoids unnecessary intermediate API calls and allows the user to compose a
complete search term before committing.

### Derived Functional Requirements

| Req ID    | Requirement Statement |
|-----------|-----------------------|
| R-D4-03-1 | The system **SHALL** permit the user to type a search string of any length into the Patients page search field without imposing an artificial character limit during input composition. |
| R-D4-03-2 | The system **SHALL NOT** initiate a backend search API call on individual keystroke events in the Patients page search field. |
| R-D4-03-3 | The system **SHALL** initiate the backend search API call only when the user presses the **Enter** key while the search field is focused, treating the full current field value as the search query. |

### Acceptance Criteria

- **AC-D4-03-1:** Given the search field is focused, the user can type a string of 10 characters and
  all 10 characters are visible in the field; no character is dropped or rejected.
- **AC-D4-03-2:** Given the user types 5 characters without pressing Enter, no backend API request is
  dispatched to the search endpoint.
- **AC-D4-03-3:** Given the user has typed a 5-character search string and presses Enter, exactly one
  backend API request is dispatched containing the complete 5-character query string.
- **AC-D4-03-4:** Given the user types 2 characters and then types a 3rd character without pressing
  Enter, no API call is triggered at the 2-character boundary.

---

## Defect D4-04 — "Load More Patients" Button Replaces Existing Table Records Instead of Appending

### Defect ID
`D4-04`

### Defect Title
"Load More Patients" button overwrites the current patient list rather than appending the next batch
of records to it.

### Reported (Actual) Behaviour
When the user clicks the **Load More Patients** button on the Patients page, the table content is
**replaced** by the newly fetched batch of patients. Records that were previously visible are
discarded and no longer shown, giving the impression that only the latest page exists.

### Expected (Correct) Behaviour
Each click of the **Load More Patients** button must **append** the newly retrieved batch of patient
records to the existing table, so that all previously loaded records remain visible alongside the
new ones. Additionally, after each load-more action, the "patients loaded" label (see D4-02) must
be updated to reflect the cumulative count of all records currently in the table.

### Derived Functional Requirements

| Req ID    | Requirement Statement |
|-----------|-----------------------|
| R-D4-04-1 | The system **SHALL** append the patient records returned by a "Load More" request to the existing patient list, preserving all previously loaded records in the table. |
| R-D4-04-2 | The system **SHALL NOT** replace or reset the current patient list when a "Load More" request completes. |
| R-D4-04-3 | After each successful "Load More" action, the system **SHALL** update the patient-count label to reflect the cumulative number of patient records now present in the table (see R-D4-02-1). |

### Acceptance Criteria

- **AC-D4-04-1:** Given 50 patients are currently displayed and the user clicks "Load More Patients",
  after the request completes the table contains the original 50 records **plus** the newly fetched
  records (e.g. 100 total if 50 are returned).
- **AC-D4-04-2:** Given 50 patients are currently displayed and the user clicks "Load More Patients"
  which returns 50 additional records, the patients loaded count label updates to `"100 patients loaded"`.
- **AC-D4-04-3:** Given the user clicks "Load More Patients" twice successively, the table contains
  the records from all three batches (initial load + two additional loads) without duplicates or
  replacements.
- **AC-D4-04-4:** Given no additional records exist in the database beyond those already loaded, the
  "Load More Patients" button is disabled or hidden so that the user cannot trigger a redundant request.

---

## Summary Requirements Table

| Req ID     | One-Line Description                                                                 | Source Defect |
|------------|--------------------------------------------------------------------------------------|---------------|
| R-D4-01-1  | Retrieve authoritative total patient count from the backend for the Dashboard tile.  | D4-01         |
| R-D4-01-2  | Display backend-sourced total count in the "Total Patients" tile, independent of loaded data. | D4-01 |
| R-D4-02-1  | Show `"<N> patients loaded"` label when no active search query is in effect.         | D4-02         |
| R-D4-02-2  | Show `"<N> patients found"` label only when an active search query has been submitted. | D4-02       |
| R-D4-02-3  | Load all matching records into the table when a search query is active.              | D4-02         |
| R-D4-03-1  | Allow search field input of arbitrary length without imposing a character cap.       | D4-03         |
| R-D4-03-2  | Do not trigger a backend search API call on individual keystrokes.                   | D4-03         |
| R-D4-03-3  | Trigger the backend search API call only upon the user pressing the Enter key.       | D4-03         |
| R-D4-04-1  | Append newly loaded patient records to the existing list on "Load More" action.      | D4-04         |
| R-D4-04-2  | Do not replace or reset the existing patient list on "Load More" action.             | D4-04         |
| R-D4-04-3  | Update the patient-count label to reflect the cumulative record count after each "Load More" action. | D4-04 |
