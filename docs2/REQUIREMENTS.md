# Consolidated Requirements

> **Status legend:** ✅ Done · ⚠️ Partial · ❌ Not Implemented · 🔒 Deferred  
> **Source documents** (archived in `docs/`):  
> - `FEATURE-REQEUSTS.txt` — original feature request text  
> - `REQUIREMENTS-SPEC.md` — refined spec for feature requests (REQ / FLAG IDs)  
> - `REQUIREMENTS-SPEC-DEFECTS-ROUND1.md` — Round 1 defect requirements (DR1 IDs)  
> - `DEFECTS-ROUND2-REQ-SPEC.md` — Round 2 defect requirements (DR2 IDs)  
> - `DEFECTS-ROUND3-REQ-SPEC.md` — Round 3 defect requirements (REQ-3 IDs)  
> - `defects-round4-req-spec.md` — Round 4 defect requirements (D4 IDs)  
> - `feature-request.md` — ad-hoc UX feature requests (FR IDs)  
> - `IMPLEMENTATION-PLAN.md`, `DEFECTS-ROUND1-PLAN.md`, `DEFECTS-ROUND2-IMPL-PLAN.md`, `DEFECTS-ROUND3-IMPL-PLAN.md`, `defects-round4-impl-plan.md` — implementation plans

---

## Section 1 — Multi-Type Examination Architecture (Feature Requests)

| ID | Title | Status |
|----|-------|--------|
| REQ-01 | Formal Examination Type Registry | ✅ Done |
| REQ-02 | Examination Type Selection at Creation; Locked on Edit | ✅ Done |
| REQ-03 | Rename Existing Type to "Ultrasound Prenatal Exam" | ✅ Done |
| REQ-04 | Examination Type Filter on List Page | ✅ Done |
| REQ-05 | Type-Driven Form Field Rendering Scaffold | ✅ Done |

### REQ-01 — Formal Examination Type Registry
A single canonical constants module (`frontend/src/constants/examinationTypes.ts`, `api/src/constants/examinationTypes.ts`) defines each type by stable machine-readable key (e.g. `ultrasound_prenatal`) and human-readable label. Backend validation rejects any type key not in the registry.  
**Source:** `REQUIREMENTS-SPEC.md §REQ-01`

### REQ-02 — Examination Type Selection at Creation; Locked on Edit
On the create form the user selects a type from a dropdown populated from the registry. On the edit form the type is shown as a read-only label and cannot be changed.  
**Source:** `REQUIREMENTS-SPEC.md §REQ-02`

### REQ-03 — Rename to "Ultrasound Prenatal Exam"
All user-visible labels (nav menu, page titles, form labels, breadcrumbs, PDF descriptions) changed from "Ultrasound Prenatal Test" to "Ultrasound Prenatal Exam". Machine-readable key `ultrasound_prenatal` unchanged; no data migration required.  
**Source:** `REQUIREMENTS-SPEC.md §REQ-03`

### REQ-04 — Examination Type Filter on List Page
"Filter by Type" dropdown added to the All Exams page filter bar. Passes `examination_type` query param to `GET /v1/examinations`; backend applies it as an OData `and examinationType eq '...'` clause.  
**Source:** `REQUIREMENTS-SPEC.md §REQ-04`

### REQ-05 — Type-Driven Form Field Rendering Scaffold
`SECTION_VISIBILITY` map in `ExaminationForm.tsx` keyed by `examinationType` controls which sections are rendered. For `ultrasound_prenatal` all sections are visible. Enables future types to toggle sections without modifying render logic.  
**Source:** `REQUIREMENTS-SPEC.md §REQ-05`

---

## Section 2 — Ultrasound Prenatal Exam — Specific Changes

| ID | Title | Status |
|----|-------|--------|
| REQ-06 | Patient Age at Exam in Main Section | ✅ Done |
| REQ-07 | Remove Accordion (Folding Sections) from Input Form | ✅ Done |
| REQ-08 | Aggressive Form Layout Compaction | ✅ Done |
| REQ-09 | Consistent Left/Right Alignment of All Form Elements | ✅ Done |

### REQ-06 — Patient Age at Exam in Main Section
Read-only "Patient Age at Exam" field in the main form section, computed from `calculateAgeAtDate(patient.birthDate, formData.examDate)`, displayed as `"N yrs"` or `"—"`. Value submitted as `patientAgeAtExam` integer. Server computes it as a fallback if absent in the request.  
**Source:** `REQUIREMENTS-SPEC.md §REQ-06`

### REQ-07 — Remove Accordion from Input Form
`<Accordion>` and `<AccordionItem>` wrappers removed from the Pregnancy Data, Ultrasound Findings, and Anatomy sections. Sections rendered directly under static `<h4>` headings.  
**Source:** `REQUIREMENTS-SPEC.md §REQ-07`

### REQ-08 — Aggressive Form Layout Compaction
Container `maxWidth` widened to `1200px`. Stack gaps tightened. `row4` and `row6` grid helpers introduced. Biometry, Doppler, Anatomy, Ultrasound Findings, and Pregnancy Data sections each consolidated into dense multi-column grids. Reduces vertical scroll from ~12 lengths to ~7–8 at 1280px width.  
**Source:** `REQUIREMENTS-SPEC.md §REQ-08`

### REQ-09 — Consistent Left/Right Alignment
Submit/Cancel buttons in a right-aligned `<ButtonSet>`. Section headings aligned left with the first grid column. Calc buttons aligned to the bottom of their adjacent inputs.  
**Source:** `REQUIREMENTS-SPEC.md §REQ-09`

---

## Section 3 — List Loading / Pagination

| ID | Title | Status |
|----|-------|--------|
| REQ-10 | Server-Side Pagination for Examinations List | ✅ Done |
| REQ-11 | Server-Side Pagination for Patients List | ✅ Done |

### REQ-10 — Examinations List Server-Side Pagination
`GET /v1/examinations` accepts `pageSize` (default 50, max 100) and `continuationToken`. Frontend exposes a "Load More" button; client-side `<Pagination>` navigates the loaded batch.  
**Source:** `REQUIREMENTS-SPEC.md §REQ-10`

### REQ-11 — Patients List Server-Side Pagination
`GET /v1/patients` accepts `pageSize` and `continuationToken`. Frontend exposes a "Load More Patients" button that appends to the existing list.  
**Source:** `REQUIREMENTS-SPEC.md §REQ-11`

---

## Section 4 — Bugs / Flags Resolved with Feature Requests

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| FLAG-01 | Medium | `examinationType` Editable on Edit Path | ✅ Done |
| FLAG-02 | Medium | Backend Missing `examinationType` Filter | ✅ Done |
| FLAG-03 | Low | Backend Accepts Any String for Exam Type | ✅ Done |
| FLAG-04 | High (Security) | User/Audit Endpoints Use Wrong `authLevel` | ✅ Done |
| FLAG-05 | Medium | `GetPatients` OData Filter Missing `isDeleted` | ✅ Done |
| FLAG-06 | Low | `requireAuth` Called Without `await` | ✅ Done |
| FLAG-07 | Medium | `patientAgeAtExam` Not Submitted by Form | ✅ Done |
| FLAG-08 | Low | No Server-Side `patientAgeAtExam` Fallback | ✅ Done |

All FLAG items were addressed as part of the ST-01–ST-05 implementation plan.  
**Source:** `REQUIREMENTS-SPEC.md §4`

---

## Section 5 — Defects Round 1

| ID | Priority | Title | Status |
|----|----------|-------|--------|
| DR1-01 | P1 | Rename exam section title on Patient Detail Page to "Available Exams" | ✅ Done |
| DR1-02 | P1 | Add Exam Type and Date columns to Patient Detail exam list | ✅ Done |
| DR1-03 | P2 | Add "Filter by Exam Type" to Patient Detail exam list | ✅ Done (pagination deferred → KI-004) |
| DR1-04 | P1 | Rename "Add Test" button to "Add Exam" on Patient Detail Page | ✅ Done |
| DR1-05 | P1 | Rename "Create Test" button to "Create Exam" on Patient Detail Page | ✅ Done |
| DR1-06 | P1 | Remove MRN column from Patients list table | ✅ Done |
| DR1-07 | P2 | Compact Patient Information section on Patient Detail Page | ✅ Done |
| DR1-08 | P2 | Widen Examination Type field and narrow Examination Date field | ✅ Done |
| DR1-09 | P2 | Align percentile fields directly below their parent biometry fields | ✅ Done |
| DR1-10 | P2 | Regroup OFD, Vp, TCD, CM into 6-column 2-row layout | ✅ Done |
| DR1-11 | P2 | Compact Patient Information on Examination Detail view to two columns | ✅ Done |
| DR1-12 | P2 | Merge Pregnancy Data into Patient Information on Examination Detail view | ✅ Done |
| DR1-13 | P1 | Restrict percentile display to BPD, HC, AC, FL, EFW in Biometry section | ✅ Done |
| DR1-14 | P1 | Ensure all form fields and calculated values appear on Detail view and PDF | ✅ Done |
| DR1-15 | P2 | Move Clinical Information section before Notes on Examination Detail view | ✅ Done |
| DR1-16 | P1 | Rename navigation menu item to "Exams" | ✅ Done |
| DR1-17 | P1 | Rename Examinations page title and table section title to "All Exams" | ✅ Done |
| DR1-18 | P1 | No conditional rendering of fields on Examination Detail Page and PDF | ✅ Done |

**Source:** `REQUIREMENTS-SPEC-DEFECTS-ROUND1.md`, `DEFECTS-ROUND1-PLAN.md`

---

## Section 6 — Defects Round 2

| ID | Priority | Title | Status |
|----|----------|-------|--------|
| DR2-01 | P1 | Examination Detail page `<h1>` must reflect the examination type | ✅ Done |
| DR2-02 | P1 | Breadcrumb second item must be the fixed label "Exams" | ✅ Done |
| DR2-03 | P1 | Breadcrumb current-page item must include exam type label | ✅ Done |
| DR2-04 | P1 | MRN must move from Patient Information section to summary tile | ✅ Done |
| DR2-05 | P1 | PDF percentile annotations restricted to BPD, HC, AC, FL, EFW only | ✅ Done |

### DR2-01
`<h1>` on Examination Detail page dynamically derived: `"{examTypeLabel} Details"` using `getExamTypeLabel()`. Falls back to `"Examination Details"` for absent/unrecognised type.

### DR2-02
Second breadcrumb item always reads `"Exams"` (href `/examinations`), regardless of exam type.

### DR2-03
Third (current-page) breadcrumb item composite: `{patientName} — {examTypeLabel} — {examDate}`.

### DR2-04
MRN removed from Patient Information grid; added as centre column in the summary tile: `[Exam Date | MRN | Status]`.

### DR2-05
`withPct()` percentile annotations removed from OFD, TCD, Nuchal Fold, APAD, TAD in `print.service.ts`. Five dead import names and five `xxxPct` variables also removed.

**Source:** `DEFECTS-ROUND2-REQ-SPEC.md`, `DEFECTS-ROUND2-IMPL-PLAN.md`

---

## Section 7 — Defects Round 3

| ID | Priority | Title | Status |
|----|----------|-------|--------|
| REQ-3-02 | P2 | All Exams free-text search queries the server, not in-memory batch | ✅ Done |
| REQ-3-03 | P3 | Synchronous continuation-token reset on every filter change | ✅ Done |
| REQ-3-04 | P3 | "Load More Patients" hidden while name search is active | ✅ Done |
| REQ-3-05 | P3 | URL-synchronised filter and pagination state on list pages | ✅ Done |
| REQ-3-06 | P2 | Debounced, loading-aware filter inputs across all list views | ✅ Done |
| REQ-3-07 | P2 | Search mode vs browse mode — distinct UX states on list pages | ✅ Done |
| REQ-3-08 | P2 | Empty-state messaging for zero-result search and filter scenarios | ✅ Done |

> **Note on DR3-01 / REQ-3-01:** The exam-type filter pagination on `PatientDetailPage` was deferred. Recorded as KI-004 in `KNOWN-ISSUES.md`.

### REQ-3-02
`handleSearch` on `ExaminationsPage` dispatches `getExaminations({ patientName })` to the backend. Backend `GET /v1/examinations` accepts optional `patient_name` query param, applying a range-scan OData filter.

### REQ-3-03
`handlePatientFilter`, `handleStatusFilter`, `handleDateFilter` each call `setContinuationToken(undefined)` synchronously before dispatching a new load.

### REQ-3-04
"Load More Patients" button is not rendered while an active search query (`isSearchActive`) is in effect.

### REQ-3-05
`useSearchParams` (React Router) synchronises filter values and page number to the browser URL on both `ExaminationsPage` and `PatientsPage`. Filter changes push a history entry; text input changes use `{ replace: true }`.

### REQ-3-06
All `<Select>` filter dropdowns in `ExaminationsPage` set `disabled={isLoading}`. `DatePicker` debounced with `dateTimerRef`. `AbortController` cancels in-flight requests on new dispatches.

### REQ-3-07
An `InlineNotification kind="info"` banner appears above results tables while search mode is active: "Showing search results for «query». [Clear search]". "Load More" is hidden in search mode. `TableContainer` description shows contextual record-count label.

### REQ-3-08
`ExaminationsPage` shows "No examinations match the current filters" empty state with a "Clear all filters" button when the result set is empty and at least one filter is active. `PatientsPage` shows "No patients found matching «query»" when search returns nothing.

**Source:** `DEFECTS-ROUND3-REQ-SPEC.md`, `DEFECTS-ROUND3-IMPL-PLAN.md`

---

## Section 8 — Defects Round 4

| ID | Priority | Title | Status |
|----|----------|-------|--------|
| D4-01 | P0 | Dashboard "Total Patients" tile shows true database count | ✅ Done |
| D4-02 | P1 | Patients list label "loaded" vs "found" correct per state | ✅ Done |
| D4-03 | P1 | Patient search triggers only on Enter key, not per keystroke | ✅ Done |
| D4-04 | P1 | "Load More Patients" appends to list, not replaces | ✅ Done |

### D4-01
New `GET /v1/patients/count` Azure Function iterates the `PATIENT` partition server-side and returns `{ count: N }`. `DashboardPage` calls `patientService.getPatientCount()` in its data-load `Promise.all` and displays the result independently of the patients list array length.  
**Acceptance:** Database with 1,000 patients → tile shows `1000`, not `50`.

### D4-02
`isSearchActive` boolean state tracks whether a search has been submitted (vs. typed but not submitted). Label reads `"N patients loaded"` when `isSearchActive` is false; `"N patients found"` when true. `SearchPatients.ts` `MAX_RESULTS` raised so all matches are returned.  
**Acceptance:** Default state shows "loaded"; post-submit shows "found".

### D4-03
`Search` component on `PatientsPage` uses a separate `inputValue` state. `onChange` updates only `inputValue` — no API call. `onKeyDown Enter` fires `handleSearch(inputValue)`. Debounce timer removed entirely.  
**Acceptance:** Typing 5 chars fires zero API calls; pressing Enter fires exactly one.

### D4-04
`loadPatients(token, append = false)` — when `append` is `true`, new records are spread into existing `patients` and `filteredPatients` state rather than replacing them. "Load More" button passes `append = true`. Initial load and search-clear calls pass no flag (replace behaviour preserved).  
**Acceptance:** 50 displayed + "Load More" → 100 displayed; original 50 remain.

**Source:** `defects-round4-req-spec.md`, `defects-round4-impl-plan.md`

---

## Section 9 — UX Feature Requests (FR series)

| ID | Page | Title | Status |
|----|------|-------|--------|
| FR-01 | PatientsPage | Left-align the Patient table title | ✅ Done |
| FR-02 | PatientsPage | Merge record count into table title as a lighter suffix | ✅ Done |
| FR-03 | PatientsPage | Prevent layout shift when "Showing search results" banner appears | ✅ Done |

### FR-01
`style={{ textAlign: 'left' }}` added to the `<TableContainer>` component in `PatientsPage.tsx`.

### FR-02
`title` and `description` props removed from `<TableContainer>`. A custom JSX header child renders the title in bold and the count suffix (`N patients loaded` / `N patients found`) in small muted text.

### FR-03
`ActionableNotification` banner wrapped in a fixed-height `<div style={{ height: '40px' }}>` that is always present, preventing the table from shifting when the banner appears or disappears.

**Source:** `feature-request.md`
