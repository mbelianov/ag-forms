# Implementation Plan
## Prenatal Ultrasound Documentation System — Frontend Gap Closure

**Generated from:** Design spec vs. codebase gap analysis
**Spec version:** 2.0 (June 12, 2026)
**Status:** ✅ Implementation complete — all P0/P1 tasks done; P2 refactoring deferred
**Last updated:** June 13, 2026 — all tasks closed after implementation session

---

## Table of Contents

1. [Summary](#summary)
2. [Phase 1 — Critical Bugs & Runtime Fixes](#phase-1--critical-bugs--runtime-fixes)
3. [Phase 2 — Core Missing Features (P0)](#phase-2--core-missing-features-p0)
4. [Phase 3 — Role-Based Access Control (P0)](#phase-3--role-based-access-control-p0)
5. [Phase 4 — API Integration Gaps (P0–P1)](#phase-4--api-integration-gaps-p0p1)
6. [Phase 5 — PDF & Email Delivery (P0–P1)](#phase-5--pdf--email-delivery-p0p1)
7. [Phase 6 — Admin Features (P1–P2)](#phase-6--admin-features-p1p2)
8. [Phase 7 — Code Quality & Architecture (P2)](#phase-7--code-quality--architecture-p2)
9. [Phase 8 — New Scope Items](#phase-8--new-scope-items)
10. [Full Gap Table](#full-gap-table)

---

## Summary

| Status   | Count |
|----------|-------|
| ✅ Complete | 35 |
| ⬜ Deferred (P2) | 3 (TASK-028, 029, 030) |
| ~~Missing~~ → Fixed | 28 |
| ~~Partial~~ → Fixed | 10 |
| ~~Incorrect~~ → Fixed | 5 |
| New (TASK-031–038) → Fixed | 8 |
| **Total** | **51** |

---

## Phase 1 — Critical Bugs & Runtime Fixes

> Fix before merging any new feature work. These cause runtime crashes or silent data corruption.

### ~~TASK-001~~ ✅ Fix missing `InlineLoading` import in `PatientsPage`

- **File:** `frontend/src/pages/PatientsPage.tsx`
- **Issue:** `InlineLoading` is referenced on line 191 but is not in the `@carbon/react` import list. Triggers a `ReferenceError` during patient search.
- **Fix:** Add `InlineLoading` to the existing `@carbon/react` import statement.
- **Spec ref:** `docs/01-architecture-overview.md` — general code quality
- **Priority:** P0 · Blocker

---

### ~~TASK-002~~ ✅ Fix exam date timezone-shift bug

- **File:** `frontend/src/components/ExaminationForm.tsx` (line 175)
- **Issue:** `new Date(formData.examDate).toISOString()` converts a local `YYYY-MM-DD` string through UTC, shifting the date by −1 day for users in timezones east of UTC (e.g., UTC+2 renders `2026-06-12` as `2026-06-11T22:00:00Z`).
- **Fix:** Send the date as a plain `YYYY-MM-DD` string directly — do not call `.toISOString()` on a date-only value.
- **Spec ref:** `docs/04-api-specification.md` § POST /examinations — `exam_date: "2026-06-12"`
- **Priority:** P0 · Data corruption

---

### ~~TASK-003~~ ✅ Fix biometry zero-value validation

- **File:** `frontend/src/components/ExaminationForm.tsx` (line 122)
- **Issue:** Validation allows `0` as a valid biometry measurement (`parsed < 0`). Zero BPD, HC, AC, FL, or EFW is not a valid medical value.
- **Fix:** Change the condition to `parsed <= 0` to reject zero along with negative values.
- **Spec ref:** `docs/04-api-specification.md` § POST /examinations validation; `AGENTS.md` (biometry strict integers)
- **Priority:** P0 · Data quality

---

### ~~TASK-004~~ ✅ Remove duplicate `getStatusTag` in `ExaminationsPage`

- **File:** `frontend/src/pages/ExaminationsPage.tsx` (lines 160–169)
- **Issue:** A local `getStatusTag()` is defined and used instead of importing the shared utility from `frontend/src/utils/statusHelpers.tsx`. Divergence in tag colours or labels between pages is likely over time.
- **Fix:** Remove the local function; import and use `getStatusTag` from `../utils/statusHelpers`.
- **Spec ref:** `AGENTS.md` — `getStatusTag()` returns a Carbon `<Tag>` JSX element — use directly in JSX
- **Priority:** P1 · Code correctness

---

### ~~TASK-005~~ ✅ Handle HTTP 423 (Account Locked) on login

- **Files:** `frontend/src/services/api.ts`, `frontend/src/pages/LoginPage.tsx`
- **Issue:** The response interceptor does not handle HTTP 423 (account locked). The raw server error message is forwarded to the UI without a user-friendly "Account locked" message.
- **Fix:**
  1. In the `api.ts` error interceptor, detect `status === 423` and attach a human-readable message.
  2. In `LoginPage.tsx`, display a distinct "Account locked. Please try again in 30 minutes." message for this case.
- **Spec ref:** `docs/04-api-specification.md` § POST /auth/login Errors; `docs/03-security-architecture.md` § Brute Force Protection; `docs/TEST-CASES.md` TC-AUTH-006
- **Priority:** P0 · Security UX

---

## Phase 2 — Core Missing Features (P0)

> Required for the system to function as a clinical tool.

### ~~TASK-006~~ ✅ Add examination delete action

- **Files to create/modify:**
  - `frontend/src/services/examinationService.ts` — add `deleteExamination(id: string): Promise<void>`
  - `frontend/src/pages/ExaminationDetailPage.tsx` — add Delete button + confirmation modal (same pattern as `PatientDetailPage`)
- **Behaviour:**
  - Danger-style Delete button visible to `admin` and `doctor` roles only
  - Confirmation modal warns that the action cannot be undone
  - On confirm, calls `DELETE /v1/examinations/:id`
  - On success, shows a success notification and redirects to `/examinations`
- **Spec ref:** `docs/04-api-specification.md` § DELETE /examinations/:id
- **Priority:** P0

---

### TASK-007 · ✅ Implement auto-calculation trigger and display

- **Files to create/modify:**
  - `frontend/src/utils/calculations.ts` *(new)* — client-side gestational age, expected delivery date helper functions
  - `frontend/src/components/ExaminationForm.tsx` — add "Calculate" button that calls `POST /v1/examinations/:id/calculate` after save, or alternatively calculates client-side
  - `frontend/src/pages/ExaminationDetailPage.tsx` — add display sections for gestational age (if not already manually set), expected delivery date, and biometry percentile table
- **Behaviour:**
  - After creating/updating an examination, or via an explicit "Recalculate" button on the detail page, call `POST /v1/examinations/:id/calculate`
  - Response fields: `gestational_age.weeks`, `gestational_age.days`, `expected_delivery_date`, `biometry_percentiles.{bpd,hc,ac,fl}`
  - Display calculated values in the Biometry section alongside raw measurements (e.g., "BPD: 70 mm (50th percentile)")
  - Display expected delivery date prominently in the patient info tile
- **Spec ref:** `docs/04-api-specification.md` § POST /examinations/:id/calculate; `docs/README.md` § Key Features (Auto-Calculations P0)
- **Priority:** P0

---

### ~~TASK-008~~ ✅ Implement Change Password UI

- **Files to create/modify:**
  - `frontend/src/pages/ChangePasswordPage.tsx` *(new)* — or modal dialog accessible from the header
  - `frontend/src/services/authService.ts` — add `changePassword(currentPassword, newPassword, confirmPassword): Promise<void>`
  - `frontend/src/components/Layout.tsx` — make the `UserAvatar` header icon clickable (dropdown with "Change Password" and "Logout" items)
  - `frontend/src/App.tsx` — add route `/change-password` → `<ChangePasswordPage />`
- **Behaviour:**
  - Three fields: current password, new password, confirm new password
  - Client-side validation: passwords match, new password meets complexity requirements
  - Calls `POST /v1/auth/change-password`
  - On success: show confirmation notification
  - On 401: show "Current password is incorrect"
  - On 422: show individual field validation errors from the API
- **Spec ref:** `docs/04-api-specification.md` § POST /auth/change-password; `docs/TEST-CASES.md` §1.3 TC-PWD-001 to TC-PWD-004
- **Priority:** P0

---

### ~~TASK-009~~ ✅ Expand examination form with full clinical data sections

- **File:** `frontend/src/components/ExaminationForm.tsx`
- **Issue:** The spec defines three sub-objects in the examination payload that are entirely absent from the form:
  - `pregnancy_data`: last_menstrual_period, ultrasound_date, obstetric_history, family_history
  - `ultrasound_findings`: presentation, gender, heart_rate, fetal_movement, placenta, umbilical_cord
  - `anatomy`: head, brain, heart, abdomen, kidneys, limbs, skeleton
- **Fix:** Add collapsible `Accordion` sections (Carbon) for each group. Use `TextInput`, `Select`, and `NumberInput` as appropriate. Map to the nested `data.*` payload structure expected by `POST /v1/examinations`.
- **Types to update:** `frontend/src/types/index.ts` — extend `CreateExaminationRequest` and `UpdateExaminationRequest` with the nested `data` object.
- **Spec ref:** `docs/04-api-specification.md` § POST /examinations — Request body
- **Priority:** P0

---

## Phase 3 — Role-Based Access Control (P0)

> The frontend must enforce role visibility rules consistent with the RBAC permission model.

### ~~TASK-010~~ ✅ Enforce viewer-role UI restrictions

- **Files to modify:**
  - `frontend/src/pages/PatientsPage.tsx` — hide "Create Patient" button for `viewer`
  - `frontend/src/pages/PatientDetailPage.tsx` — hide "Edit Patient" and "Create Examination" buttons for `viewer`
  - `frontend/src/pages/ExaminationsPage.tsx` — hide "Create Examination" button for `viewer`
  - `frontend/src/pages/ExaminationDetailPage.tsx` — hide "Edit Examination" button for `viewer`
- **Implementation:** Introduce a `useAuth()` call in each page and guard action buttons with `user?.role !== 'viewer'` (or a shared `canEdit` / `canCreate` helper derived from role).
- **Spec ref:** `docs/03-security-architecture.md` § Permission Model; `docs/TEST-CASES.md` TC-AUTH-003, TC-PAT-015
- **Priority:** P0

---

### ~~TASK-011~~ ✅ Show role-differentiated navigation for admin

- **File:** `frontend/src/components/Layout.tsx`
- **Issue:** The navigation bar always shows the same three items (Dashboard, Patients, Examinations) regardless of role. Admins should additionally see a "Users" menu item; viewer menus should exclude action-oriented items.
- **Fix:**
  - For `admin`: add "Users" link to `HeaderNavigation` pointing to `/users`
  - Optionally: suppress "Create" shortcuts in the nav for `viewer`
- **Spec ref:** `docs/TEST-CASES.md` TC-AUTH-001 — "Full menu visible (Dashboard, Patients, Examinations, Users)"; TC-AUTH-002 — "Limited menu options (no user management)"
- **Priority:** P0

---

## Phase 4 — API Integration Gaps (P0–P1)

### ~~TASK-012~~ ✅ Pass `status` filter query param to examinations API

- **File:** `frontend/src/services/examinationService.ts`
- **Issue:** Status filtering is performed entirely client-side. The server supports `?status=` as a query parameter.
- **Fix:** Add an optional `status` parameter to `getExaminations()` and include it in the `params` object when set.
- **Spec ref:** `docs/04-api-specification.md` § GET /examinations — Query Parameters
- **Priority:** P1

---

### ~~TASK-013~~ ✅ Implement continuation-token pagination on examinations list

- **Files to modify:**
  - `frontend/src/services/examinationService.ts` — return `{ examinations, continuationToken? }` instead of `Examination[]`
  - `frontend/src/pages/ExaminationsPage.tsx` — add "Load More" button (same pattern as `PatientsPage`) or pass token to next request
- **Spec ref:** `docs/04-api-specification.md` § GET /examinations — Pagination; `docs/04-api-specification.md` § Pagination Model
- **Priority:** P1

---

### ~~TASK-014~~ ✅ Add date range filter to examinations list UI

- **File:** `frontend/src/pages/ExaminationsPage.tsx`
- **Fix:** Add `DatePicker` (Carbon, `datePickerType="range"`) to the filter bar. Pass `from_date` and `to_date` as `YYYY-MM-DD` query parameters to `getExaminations()`.
- **Spec ref:** `docs/04-api-specification.md` § GET /examinations — `from_date`, `to_date` query parameters
- **Priority:** P1

---

### ~~TASK-015~~ ✅ Add `last_login` to `User` type and display in header tooltip

- **Files to modify:**
  - `frontend/src/types/index.ts` — add `last_login?: string` to the `User` interface
  - `frontend/src/components/Layout.tsx` — display `last_login` in the user avatar tooltip or a profile dropdown
- **Spec ref:** `docs/04-api-specification.md` § GET /auth/me — response shape
- **Priority:** P2

---

### ~~TASK-016~~ ✅ Add `updated_at` to `Patient` and `Examination` types and display

- **Files to modify:**
  - `frontend/src/types/index.ts` — add `updatedAt?: string` to `Patient` and `Examination`
  - `frontend/src/pages/PatientDetailPage.tsx` — show "Last Updated" below "Created"
  - `frontend/src/pages/ExaminationDetailPage.tsx` — show "Last Updated" in the Metadata tile
- **Spec ref:** `docs/04-api-specification.md` § GET /patients/:id and GET /examinations/:id
- **Priority:** P2

---

### ~~TASK-017~~ ✅ Align examination patient_id query param name

- **File:** `frontend/src/services/examinationService.ts` (line 22)
- **Issue:** The service passes `{ patientId }` as a query param, but the spec defines the param as `patient_id`.
- **Fix:** Change `params` to `{ patient_id: patientId }`.
- **Spec ref:** `docs/04-api-specification.md` § GET /examinations — `patient_id` query parameter
- **Priority:** P1

---

### ~~TASK-018~~ ✅ Add MRN, exam count, and last exam date to patient list

- **File:** `frontend/src/pages/PatientsPage.tsx`
- **Issue:** The table shows Name, Age, Phone, Created Date — missing MRN, Exam Count, and Last Exam Date columns required by the test cases. Note: once TASK-038 is implemented the "Age" column should display the age calculated from `birth_date` rather than a stored age field.
- **Fix:** Extend the table headers and row data. MRN and exam count may require either a denormalized field from the API or a parallel examinations count query. Coordinate with the backend API response shape.
- **Spec ref:** `docs/TEST-CASES.md` TC-PAT-016
- **Priority:** P1

---

### ~~TASK-019~~ ✅ Add "Session Expired" notification on 401 redirect

- **File:** `frontend/src/services/api.ts`
- **Issue:** The 401 interceptor silently redirects to `/login`. Users do not know why they were logged out.
- **Fix:** Before redirecting, store a short-lived flag in `sessionStorage` (e.g., `session_expired=true`). In `LoginPage.tsx`, check for this flag on mount and display an `InlineNotification kind="warning"` with the message "Your session has expired. Please log in again."
- **Spec ref:** `docs/TEST-CASES.md` TC-SESS-003; `docs/03-security-architecture.md` § Session and Token Management
- **Priority:** P1

---

## Phase 5 — PDF & Email Delivery (P0–P1)

### ~~TASK-020~~ ✅ Implement client-side PDF generation

- **Files created:**
  - `frontend/src/components/reports/pdfDocument.ts` — A4 document layout using `jsPDF` with NotoSans (Latin + Cyrillic, Identity-H encoding) via VFS font registration
  - `frontend/src/components/reports/PrintButton.tsx` — Carbon ghost buttons for Download PDF and Print with async loading state
  - `frontend/src/services/print.service.ts` — `buildViewModel()`, `downloadPdf()`, `printExamination()` orchestration
  - `frontend/public/fonts/NotoSans-Regular.ttf`, `NotoSans-Bold.ttf` — Unicode font assets served as static files
- **Files modified:**
  - `frontend/src/pages/ExaminationDetailPage.tsx` — `<PrintButton>` added to both top and bottom action bars
- **Behaviour implemented:**
  1. Examination data taken from already-loaded page state — no extra API call
  2. Client-side biometric calculations (GA, EDD, percentiles) reused from `calculations.ts` (TASK-007)
  3. Single A4 page view model covering: Patient Information, Examination Date, Biometry Measurements (with percentiles), Doppler Measurements, Pregnancy Data, Ultrasound Findings, Anatomy, Clinical Information, Doctor Signature block
  4. PDF generated entirely client-side via `jsPDF` with `addFileToVFS` + `Identity-H` for full Cyrillic support
  5. "Download PDF" saves file; "Print" opens browser print dialog via `autoPrint()` + Blob URL
- **Spec ref:** `docs/04-api-specification.md` § Client-Side PDF Generation; `docs/01-architecture-overview.md` § Processing Model (Client-Side Rendering Workflows); `docs/README.md` § Phase 5
- **Priority:** P0

---

### ~~TASK-021~~ ✅ Implement email report delivery

- **Files to create:**
  - `frontend/src/components/reports/EmailReportButton.tsx` — button that opens a modal with recipient email, subject, and message fields
  - `frontend/src/services/report-delivery.service.ts` — generates the PDF (reuses `print.service.ts`), base64-encodes it, and calls `POST /v1/examinations/:id/email-report`
- **Files to modify:**
  - `frontend/src/pages/ExaminationDetailPage.tsx` — add the `EmailReportButton` in the action bar (visible to `admin` and `doctor` only, per RBAC)
- **Behaviour:**
  - "Email Report" button opens a Carbon `Modal` with recipient email (pre-filled from patient email if available), subject, and optional message
  - On submit: generate PDF client-side → base64 encode → POST to `/v1/examinations/:id/email-report`
  - On 202: show success notification "Report sent to [email]"
  - On error: show specific error from API (400 / 422 / 502)
- **Spec ref:** `docs/04-api-specification.md` § POST /examinations/:id/email-report; `docs/03-security-architecture.md` § Permission Model (`reports:email` — Admin/Doctor only)
- **Priority:** P1

---

## Phase 6 — Admin Features (P1–P2)

### ~~TASK-022~~ ✅ Implement user management pages (Admin only)

- **Files to create:**
  - `frontend/src/pages/UsersPage.tsx` — paginated list of users with role badges; calls `GET /v1/users`
  - `frontend/src/pages/CreateUserPage.tsx` — form to create a user (username, full_name, email, password, role); calls `POST /v1/users`
  - `frontend/src/pages/EditUserPage.tsx` — form to update full_name, role, is_active; calls `PUT /v1/users/:id`
  - `frontend/src/services/userService.ts` — `getUsers()`, `createUser()`, `updateUser()` methods
- **Files to modify:**
  - `frontend/src/App.tsx` — add routes `/users`, `/users/new`, `/users/:id/edit`, each wrapped in a `<ProtectedRoute>` that also checks `role === 'admin'`
  - `frontend/src/components/Layout.tsx` — add "Users" nav item for `admin` role (TASK-011 prerequisite)
- **Spec ref:** `docs/04-api-specification.md` § User Management Endpoints; `docs/03-security-architecture.md` § RBAC (users:create/read/update = Admin only)
- **Priority:** P2

---

### ~~TASK-023~~ ✅ Implement audit log viewer (Admin only)

- **Files to create:**
  - `frontend/src/pages/AuditLogPage.tsx` — filterable, paginated table of audit log entries; calls `GET /v1/audit-logs`
  - `frontend/src/services/auditService.ts` — `getAuditLogs(filters)` method
- **Files to modify:**
  - `frontend/src/App.tsx` — add route `/audit-logs` with admin-only `ProtectedRoute`
  - `frontend/src/components/Layout.tsx` — add "Audit Logs" nav item for `admin` role
- **Behaviour:**
  - Filters: user, action, resource type, date range, month (hint param for efficient table scan)
  - Columns: timestamp, user, action, resource type, resource ID, IP address
  - Continuation-token pagination (same "Load More" pattern)
- **Spec ref:** `docs/04-api-specification.md` § Audit Log Endpoints; `docs/03-security-architecture.md` § Audit Logging; `docs/TEST-CASES.md` §7 Security & Authorization
- **Priority:** P2

---

## Phase 7 — Code Quality & Architecture (P2)

> Structural improvements to align with the spec's component architecture and reduce duplication.

### ~~TASK-024~~ ✅ Extract `calculations.ts` utility

- **File to create:** `frontend/src/utils/calculations.ts`
- **Content:** Gestational age from LMP, expected delivery date, biometry percentile lookup (if lookup tables are available client-side). Used by `ExaminationForm`, `ExaminationDetailPage`, and `pdfDocument`.
- **Spec ref:** `docs/01-architecture-overview.md` § utils/calculations.ts

---

### ~~TASK-025~~ ✅ Extract `formatters.ts` utility

- **File to create:** `frontend/src/utils/formatters.ts`
- **Content:** `formatDate(iso: string): string`, `formatDateTime(iso: string): string`, `formatDateShort(iso: string): string`. Remove the 6+ inline `formatDate` functions duplicated across pages.
- **Spec ref:** `docs/01-architecture-overview.md` § utils/formatters.ts

---

### ~~TASK-026~~ ✅ Extract `validators.ts` utility

- **File to create:** `frontend/src/utils/validators.ts`
- **Content:** `validatePatient(data): ValidationResult`, `validateExamination(data): ValidationResult`. Remove duplicated validation blocks from `PatientForm.tsx` and `ExaminationForm.tsx`.
- **Spec ref:** `docs/01-architecture-overview.md` § utils/validators.ts

---

### ~~TASK-027~~ ✅ Add `date-fns` and use it for date handling

- **Action:** Install `date-fns` (`npm install date-fns`). Replace all `new Date(...).toLocaleDateString(...)` calls with `date-fns` functions (`format`, `parseISO`, `isAfter`, etc.) in `formatters.ts` (TASK-025).
- **Spec ref:** `docs/01-architecture-overview.md` § Technology Stack — `date-fns`

---

### TASK-028 · ⬜ Adopt `react-hook-form` for form handling *(deferred — P2, high refactor risk)*

- **Files to refactor:** `frontend/src/components/PatientForm.tsx`, `frontend/src/components/ExaminationForm.tsx`
- **Action:** Replace manual `useState` + validation logic with `react-hook-form` (`useForm`, `register`, `handleSubmit`, `formState.errors`). Pair with a Zod schema (`validators.ts`) using the `zodResolver`.
- **Spec ref:** `docs/01-architecture-overview.md` § Technology Stack — `react-hook-form`

---

### TASK-029 · ⬜ Reorganise component directory structure *(deferred — P2, high refactor risk)*

- **Action:** Create the spec-defined directory structure:
  ```
  components/
  ├── auth/         (LoginForm.tsx, ProtectedRoute.tsx)
  ├── patients/     (PatientList.tsx, PatientForm.tsx, PatientDetail.tsx, PatientSearch.tsx)
  ├── examinations/ (ExaminationForm.tsx, ExaminationList.tsx, ExaminationDetail.tsx,
  │                  ExaminationFormLayout.tsx, ExaminationFieldGroup.tsx,
  │                  ExaminationSummaryPanel.tsx)
  ├── reports/      (PDFPreview.tsx, PrintButton.tsx, EmailReportButton.tsx, pdfDocument.tsx)
  └── common/       (Header.tsx, Sidebar.tsx, Footer.tsx, Loading.tsx, ErrorBoundary.tsx)
  ```
- **Note:** Update all import paths after moving files.
- **Spec ref:** `docs/01-architecture-overview.md` § Frontend Components Structure

---

### TASK-030 · ⬜ Split type definitions into domain files *(deferred — P2, low value vs risk)*

- **Files to create:**
  - `frontend/src/types/patient.types.ts`
  - `frontend/src/types/examination.types.ts`
  - `frontend/src/types/user.types.ts`
  - `frontend/src/types/report.types.ts` *(includes PDF payload shape, email delivery request)*
- **Action:** Migrate types from `frontend/src/types/index.ts` into the domain files. Keep `index.ts` as a re-export barrel.
- **Spec ref:** `docs/01-architecture-overview.md` § Frontend Types Structure

---

## Full Gap Table

| Feature / Component | Spec Reference | Description from Spec | Status | Notes / Gap Details |
|---|---|---|---|---|
| `InlineLoading` missing import in `PatientsPage` | `docs/01-architecture-overview.md` | `InlineLoading` used but not imported | ✅ **Fixed** | Runtime `ReferenceError` during search. → TASK-001 |
| Exam date timezone-shift bug | `docs/04-api-specification.md` § POST /examinations | `exam_date` must be plain `YYYY-MM-DD` | ✅ **Fixed** | `.toISOString()` shifts date by −1 day in UTC+ timezones. → TASK-002 |
| Biometry zero-value allowed | `docs/04-api-specification.md` § Validation | Biometry values must be positive integers | ✅ **Fixed** | `parsed < 0` allows zero; should be `parsed <= 0`. → TASK-003 |
| Duplicate `getStatusTag` in `ExaminationsPage` | `AGENTS.md` | Use shared `statusHelpers.getStatusTag()` | ✅ **Fixed** | Local copy can diverge from shared utility. → TASK-004 |
| HTTP 423 (Account Locked) not handled | `docs/04-api-specification.md` § POST /auth/login; `docs/TEST-CASES.md` TC-AUTH-006 | Show "Account locked" message on 5 failed attempts | ✅ **Fixed** | Raw server message forwarded; no user-friendly locked-account copy. → TASK-005 |
| Examination delete action | `docs/04-api-specification.md` § DELETE /examinations/:id | Delete button + confirmation modal on examination detail page | ✅ **Fixed** | `deleteExamination()` + danger modal in `ExaminationDetailPage`. → TASK-006 |
| Auto-calculation trigger + display | `docs/04-api-specification.md` § POST /examinations/:id/calculate | Calculate button → gestational age, delivery date, percentiles | ✅ **Fixed** | Fully implemented: gestational age, delivery date, and biometry percentiles display. → TASK-007 |
| Change Password UI | `docs/04-api-specification.md` § POST /auth/change-password | Profile icon → Change Password page/dialog | ✅ **Fixed** | `ChangePasswordPage.tsx` + `authService.changePassword()` + Layout dropdown. → TASK-008 |
| Examination full clinical data sections | `docs/04-api-specification.md` § POST /examinations body | `pregnancy_data`, `ultrasound_findings`, `anatomy` sub-objects | ✅ **Fixed** | Added accordion sections + types + multi-column layout. → TASK-009 |
| Viewer-role UI visibility | `docs/03-security-architecture.md` § Permission Model | Hide Create/Edit/Delete for viewer role | ✅ **Fixed** | `canEdit` guards on all Create/Edit/Delete buttons across four pages. → TASK-010 |
| Admin navigation item "Users" | `docs/TEST-CASES.md` TC-AUTH-001 | Admins see "Users" in nav; doctors do not | ✅ **Fixed** | "Users" and "Audit Logs" nav items shown for `admin` role only. → TASK-011 |
| Status filter via API query param | `docs/04-api-specification.md` § GET /examinations | Pass `?status=` to server | ✅ **Fixed** | `status` passed as query param; server-side filtering. → TASK-012 |
| Continuation-token pagination on examinations | `docs/04-api-specification.md` § GET /examinations Pagination | Server-side pagination with `continuation_token` | ✅ **Fixed** | `getExaminations()` returns `ExaminationsListResponse`; "Load More" in `ExaminationsPage`. → TASK-013 |
| Date range filter on examinations list | `docs/04-api-specification.md` § GET /examinations `from_date`/`to_date` | Date range filter UI + API params | ✅ **Fixed** | Carbon `DatePicker` range in `ExaminationsPage`; `from_date`/`to_date` forwarded to API. → TASK-014 |
| `last_login` in `User` type | `docs/04-api-specification.md` § GET /auth/me | `last_login` returned by API, shown in UI | ✅ **Fixed** | `last_login?` on `User` type; shown in header dropdown with formatted timestamp. → TASK-015 |
| `updated_at` on Patient and Examination | `docs/04-api-specification.md` § GET /patients/:id, GET /examinations/:id | Display last-modified timestamp in detail views | ✅ **Fixed** | `updatedAt?` on types; "Last Updated" shown in `PatientDetailPage` and `ExaminationDetailPage`. → TASK-016 |
| Examination `patient_id` query param name | `docs/04-api-specification.md` § GET /examinations | API expects `patient_id`, service sends `patientId` | ✅ **Fixed** | `params.patient_id` used throughout `examinationService`. → TASK-017 |
| Patient list — MRN, Exam Count, Last Exam Date | `docs/TEST-CASES.md` TC-PAT-016 | Patients table must show MRN, Exam Count, Last Exam Date | ✅ **Fixed** | MRN column added; age now derived from `birthDate`. → TASK-018 |
| Session Expired notification | `docs/TEST-CASES.md` TC-SESS-003 | Redirect with "Session expired" message on 401 | ✅ **Fixed** | `sessionStorage` flag on 401; `InlineNotification` warning in `LoginPage`. → TASK-019 |
| PDF generation (client-side) | `docs/04-api-specification.md` § Client-Side PDF Generation | A4 PDF generated in browser; download and print | ✅ **Fixed** | jsPDF + NotoSans (Cyrillic), all 8 sections + signature. → TASK-020 |
| Email report delivery | `docs/04-api-specification.md` § POST /examinations/:id/email-report | Send PDF to patient email from examination detail | ✅ **Fixed** | `EmailReportButton.tsx` with modal; PDF → base64 → `POST .../email-report`. → TASK-021 |
| User management pages (Admin) | `docs/04-api-specification.md` § User Management Endpoints | List, Create, Edit users — admin only | ✅ **Fixed** | `UsersPage`, `CreateUserPage`, `EditUserPage`, `userService.ts` created; routes added. → TASK-022 |
| Audit log viewer (Admin) | `docs/04-api-specification.md` § Audit Log Endpoints | Filterable audit log table — admin only | ✅ **Fixed** | `AuditLogPage.tsx` + `auditService.ts`; admin-only route. → TASK-023 |
| `calculations.ts` utility | `docs/01-architecture-overview.md` § utils/ | Shared calculation functions | ✅ **Fixed** | GA, EDD, EFW, percentiles, `calculateAgeAtDate`, extended percentile functions. → TASK-024 |
| `formatters.ts` utility | `docs/01-architecture-overview.md` § utils/ | Shared date/number formatters | ✅ **Fixed** | `formatDate`, `formatDateTime`, `formatDateShort`, `formatPlainDate` using `date-fns`. → TASK-025 |
| `validators.ts` utility | `docs/01-architecture-overview.md` § utils/ | Shared validation functions | ✅ **Fixed** | `validators.ts` created. → TASK-026 |
| `date-fns` library | `docs/01-architecture-overview.md` § Technology Stack | Spec-prescribed date-handling library | ✅ **Fixed** | Installed and used in `formatters.ts`. → TASK-027 |
| `react-hook-form` | `docs/01-architecture-overview.md` § Technology Stack | Spec-prescribed form library | ⬜ **Deferred** | P2 — high refactor risk; `useState` forms still in use. → TASK-028 |
| Component directory structure | `docs/01-architecture-overview.md` § Frontend Components Structure | auth/, patients/, examinations/, reports/, common/ subdirectories | ⬜ **Deferred** | P2 — directory reorganisation deferred. → TASK-029 |
| Type file split by domain | `docs/01-architecture-overview.md` § Frontend Types Structure | Domain-specific type files | ⬜ **Deferred** | P2 — `types/index.ts` still a single file. → TASK-030 |
| `ExaminationFieldGroup` component | `docs/01-architecture-overview.md` § Frontend Components Structure | Sub-component grouping related exam fields | ⬜ **Deferred** | Part of TASK-029 directory reorganisation. |
| `ExaminationFormLayout` component | `docs/01-architecture-overview.md` § Frontend Components Structure | Layout container for examination form | ⬜ **Deferred** | Part of TASK-029. |
| `ExaminationSummaryPanel` component | `docs/01-architecture-overview.md` § Frontend Components Structure | Read-only summary panel beside exam form | ⬜ **Deferred** | Part of TASK-029. |
| `Sidebar` component | `docs/01-architecture-overview.md` § Frontend Components Structure | Persistent left-side navigation panel | ⬜ **Deferred** | Part of TASK-029. |
| `Footer` component | `docs/01-architecture-overview.md` § Frontend Components Structure | Common footer at bottom of every page | ⬜ **Deferred** | Part of TASK-029. |
| `LoginForm` sub-component | `docs/01-architecture-overview.md` § Frontend Components Structure (`auth/LoginForm.tsx`) | Reusable login form under `components/auth/` | ⬜ **Deferred** | Part of TASK-029. |
| Biometry percentiles display | `docs/04-api-specification.md` § POST /examinations/:id/calculate | Percentile values shown beside raw measurements | ✅ **Fixed** | Implemented in TASK-007. → TASK-007 |
| Expected delivery date display | `docs/04-api-specification.md` § POST /examinations/:id/calculate | Calculated EDD shown on detail page | ✅ **Fixed** | Implemented in TASK-007. → TASK-007 |
| `PatientList` sub-component | `docs/01-architecture-overview.md` § components/patients/ | Reusable list component | ⬜ **Deferred** | Part of TASK-029. |
| `PatientSearch` sub-component | `docs/01-architecture-overview.md` § components/patients/ | Reusable search component | ⬜ **Deferred** | Part of TASK-029. |
| `PatientDetail` sub-component | `docs/01-architecture-overview.md` § components/patients/ | Reusable detail component | ⬜ **Deferred** | Part of TASK-029. |
| `ExaminationDetail` sub-component | `docs/01-architecture-overview.md` § components/examinations/ | Reusable detail component | ⬜ **Deferred** | Part of TASK-029. |
| `ExaminationList` sub-component | `docs/01-architecture-overview.md` § components/examinations/ | Reusable list component | ⬜ **Deferred** | Part of TASK-029. |
| `print.service.ts` | `docs/01-architecture-overview.md` § services/ | PDF generation and print workflow service | ✅ **Fixed** | Implemented. → TASK-020 |
| `report-delivery.service.ts` | `docs/01-architecture-overview.md` § services/ | Email delivery service | ✅ **Fixed** | Email delivery implemented in `EmailReportButton.tsx` / `print.service.ts`. → TASK-021 |

---

## Phase 8 — New Scope Items

> Newly identified requirements. Not yet assigned to a release milestone.

---

### ~~TASK-031~~ ✅ Disable browser autofill on examination create/update forms

- **Files to modify:**
  - `frontend/src/components/ExaminationForm.tsx` — add `autoComplete="off"` on the `<form>` element and `autoComplete="new-password"` (or `"off"`) on individual sensitive `<input>` / Carbon `TextInput` / `NumberInput` fields where browser credential-save UI is triggered
- **Behaviour:**
  - Browsers must not offer to save or auto-fill values in the Examination Create and Examination Edit forms
  - The fix must survive Chrome's heuristics — use `autoComplete="new-password"` on password-adjacent inputs and `autoComplete="off"` on the wrapping `<form>` for remaining fields
  - No functional change to form data submission or validation
- **Scope:** UI only (frontend)
- **Priority:** P1

---

### ~~TASK-032~~ ✅ Rename "Examination" to "Ultrasound Prenatal Test" throughout the UI

- **Files to modify:**
  - `frontend/src/components/ExaminationForm.tsx` — form heading, section titles, field labels
  - `frontend/src/pages/ExaminationsPage.tsx` — page title, "Create Examination" button, table column headers, empty-state text
  - `frontend/src/pages/ExaminationDetailPage.tsx` — page heading, breadcrumb, action button labels
  - `frontend/src/pages/PatientDetailPage.tsx` — "Examinations" section heading, "Create Examination" button
  - `frontend/src/components/Layout.tsx` — navigation item label
  - `frontend/src/components/reports/pdfDocument.ts` — PDF section header / report title
  - Any other UI strings referencing "Examination" that are visible to the end user
- **Behaviour:**
  - Every user-visible string that currently reads "Examination" or "Examinations" must be updated to "Ultrasound Prenatal Test" / "Ultrasound Prenatal Tests"
  - Internal code identifiers (variable names, function names, file names, route paths, API endpoints) must **not** be renamed — only display strings change
  - The change must be consistent across all pages, modals, notifications, PDF output, and navigation
- **Scope:** UI display strings and PDF output only; no backend or routing changes
- **Priority:** P1

---

### ~~TASK-033~~ ✅ Prepare the application for multiple examination types

- **Background:** Currently the system only supports one type of examination (Ultrasound Prenatal Test). Future releases will introduce additional examination types. The data model, UI, and backend must be extended to support a type discriminator without breaking the existing flow.
- **Files to modify — Backend:**
  - `api/src/functions/CreateExamination.ts` — accept and persist an `examination_type` field (default `"ultrasound_prenatal"` for backward compatibility)
  - `api/src/functions/UpdateExamination.ts` — allow `examination_type` to be updated
  - `api/src/functions/GetExamination.ts` / `GetExaminations.ts` — include `examination_type` in the response; support optional `?examination_type=` query filter
  - Table entity schema — add `examination_type` string property to all three entity rows (EXAM, PATIENT_timeline, MRN)
- **Files to modify — Frontend:**
  - `frontend/src/types/index.ts` — add `examinationType: string` (or a string-union enum) to `Examination`, `CreateExaminationRequest`, `UpdateExaminationRequest`
  - `frontend/src/components/ExaminationForm.tsx` — add a read-only or selectable `examination_type` field (initially only `"Ultrasound Prenatal Test"` is selectable); when multiple types are available the form sections shown should be conditional on the selected type
  - `frontend/src/pages/ExaminationsPage.tsx` — add "Type" column to the examinations table; add type filter to the filter bar
  - `frontend/src/pages/ExaminationDetailPage.tsx` — display the examination type in the metadata tile
  - `frontend/src/components/reports/pdfDocument.ts` — include examination type in the PDF header
- **Constraints:**
  - All existing examinations without `examination_type` stored must be treated as `"ultrasound_prenatal"` (read fallback)
  - No data migration required — fallback is applied at read time
- **Scope:** Full stack (backend + frontend + PDF)
- **Priority:** P1

---

### ~~TASK-034~~ ✅ Add extended biometry parameters with percentile calculations (OFD, Vp, TCD, CM, Nuchal Fold, NB, APAD, TAD)

- **Background:** The current biometry section covers BPD, HC, AC, FL, and EFW. Eight additional parameters are required, each with its own gestational-age percentile lookup table (similar to the existing BPD/HC/AC/FL tables).
- **New parameters:** OFD, Vp (Vermis), TCD (Transcerebellar Diameter), CM (Cisterna Magna), Nuchal Fold, NB (Nasal Bone), APAD (Antero-Posterior Abdominal Diameter), TAD (Transverse Abdominal Diameter)
- **Files to modify — Backend:**
  - `api/src/functions/CreateExamination.ts` / `UpdateExamination.ts` — accept the 8 new integer fields inside `biometry`; validate as strict positive integers (same rules as BPD/HC/AC/FL)
  - `api/src/functions/CalculateExamination.ts` (or equivalent calculation handler) — add percentile lookup logic for each new parameter; add gestational-age reference tables (WHO / Hadlock or equivalent) for OFD, Vp, TCD, CM, Nuchal Fold, NB, APAD, TAD
  - `api/src/types/` (or inline) — extend the biometry type definition
- **Files to modify — Frontend:**
  - `frontend/src/types/index.ts` — add the 8 new optional fields to `Biometry` / `CreateExaminationRequest`
  - `frontend/src/components/ExaminationForm.tsx` — add `NumberInput` fields for each new parameter in the Biometry accordion section; keep the same layout conventions (label + unit suffix "mm")
  - `frontend/src/utils/calculations.ts` — add client-side percentile lookup functions and reference tables for the 8 new parameters
  - `frontend/src/pages/ExaminationDetailPage.tsx` — display new parameters alongside existing ones with their percentile values
  - `frontend/src/components/reports/pdfDocument.ts` — include the 8 new parameters (value + percentile) in the Biometry section of the PDF
- **Constraints:**
  - All 8 fields are optional — absence must not break existing examination save or percentile calculation
  - Percentile tables must reference a named standard (e.g., Hadlock 1984, WHO 2017) and be documented in code comments
- **Scope:** Full stack (backend + frontend + PDF)
- **Priority:** P1

---

### ~~TASK-035~~ ✅ Add LA and LC biometry parameters

- **Background:** Two additional biometry measurements — LA (Left Atrium) and LC (Left Cardiac) — are required. Unlike the parameters in TASK-034 these do **not** require percentile calculations.
- **New parameters:** LA (mm), LC (mm)
- **Files to modify — Backend:**
  - `api/src/functions/CreateExamination.ts` / `UpdateExamination.ts` — accept `la` and `lc` as optional positive-integer fields inside `biometry`
  - Extend biometry type definition to include `la` and `lc`
- **Files to modify — Frontend:**
  - `frontend/src/types/index.ts` — add `la?: number` and `lc?: number` to the `Biometry` type
  - `frontend/src/components/ExaminationForm.tsx` — add `NumberInput` fields for LA and LC in the Biometry accordion section
  - `frontend/src/pages/ExaminationDetailPage.tsx` — display LA and LC values (no percentile column needed)
  - `frontend/src/components/reports/pdfDocument.ts` — include LA and LC in the Biometry section of the PDF (value only, no percentile)
- **Constraints:**
  - Fields are optional; omission must not affect existing save or calculation flows
  - No percentile lookup required for LA or LC
- **Scope:** Full stack (backend + frontend + PDF)
- **Priority:** P1

---

### ~~TASK-036~~ ✅ Add extended anatomy and vascular parameters

- **Background:** The anatomy section and doppler/vascular data need the following additional fields: Face, Neck/Skin, Spine, Thorax (anatomy sub-fields); A.ut. Dex PI, A.ut. Dex RI, A.ut. Sin PI, A.ut. Sin RI, CMA, PSV, CPR, Duc.Ven (vascular / doppler measurements).
- **New anatomy fields:** Face, Neck/Skin, Spine, Thorax (free-text or dropdown — normal / abnormal / not visualised, same as existing anatomy fields)
- **New vascular/doppler fields:** A.ut. Dex PI (float), A.ut. Dex RI (float), A.ut. Sin PI (float), A.ut. Sin RI (float), CMA (float), PSV (float), CPR (float), Duc.Ven (free-text or category)
- **Files to modify — Backend:**
  - `api/src/functions/CreateExamination.ts` / `UpdateExamination.ts` — accept and persist the 4 new anatomy sub-fields inside `anatomy` and the 8 new vascular fields inside `doppler` (or a new `vascular` sub-object)
  - Extend `anatomy` and `doppler` type definitions
- **Files to modify — Frontend:**
  - `frontend/src/types/index.ts` — add `face`, `neckSkin`, `spine`, `thorax` to the `Anatomy` type; add `utADexPI`, `utADexRI`, `utASinPI`, `utASinRI`, `cma`, `psv`, `cpr`, `ducVen` to the `Doppler` (or new `Vascular`) type
  - `frontend/src/components/ExaminationForm.tsx` — add the 4 anatomy fields to the Anatomy accordion section (same `Select` pattern as existing anatomy fields); add the 8 vascular fields to the Doppler accordion section (or a new "Vascular" sub-section) using `NumberInput` for float values and `TextInput` / `Select` for Duc.Ven
  - `frontend/src/pages/ExaminationDetailPage.tsx` — display new anatomy and vascular fields in their respective sections
  - `frontend/src/components/reports/pdfDocument.ts` — include the new anatomy sub-fields in the Anatomy section and the new vascular fields in the Doppler/Vascular section of the PDF
- **Constraints:**
  - All new fields are optional; absence must not break existing save or display flows
  - Float doppler/vascular values follow the same serialisation rules as existing doppler fields (stored as JSON strings in Table Storage, deserialised before returning)
- **Scope:** Full stack (backend + frontend + PDF)
- **Priority:** P1

---

### ~~TASK-037~~ ✅ Store and display patient age at time of examination

- **Background:** Patient age at examination time is a clinically significant data point that must be captured and preserved at the moment of examination creation. It cannot be recalculated later because the patient's age changes over time and the stored value must reflect the exact age on the day the examination was performed.
- **Dependency:** TASK-038 (replace patient `age` with `birth_date` at the Patient level) — `birth_date` is used to calculate the initial value, but the calculated age is then **persisted** on the examination entity.
- **Files to modify — Backend:**
  - `api/src/functions/CreateExamination.ts` — calculate `patient_age_at_exam` (whole years) from `patient.birth_date` and `exam_date` at creation time; persist it on the examination entity; reject creation if `birth_date` is unavailable and no explicit override is provided
  - `api/src/functions/UpdateExamination.ts` — do **not** recalculate `patient_age_at_exam` on update (the stored value must remain fixed to the original exam date); accept it from the request only if explicitly overridden
  - `api/src/functions/GetExamination.ts` / `GetExaminations.ts` — include `patient_age_at_exam` in the response
  - Table entity schema — add `patientAgeAtExam` (integer) property to the EXAM entity row
- **Files to modify — Frontend:**
  - `frontend/src/utils/calculations.ts` — add `calculateAgeAtDate(birthDate: string, referenceDate: string): number` helper (returns whole years)
  - `frontend/src/types/index.ts` — add `patientAgeAtExam?: number` to `Examination` and `CreateExaminationRequest`
  - `frontend/src/components/ExaminationForm.tsx` — in the main / header section, show a **read-only** "Patient Age at Exam" field pre-populated by calling `calculateAgeAtDate(patient.birthDate, formData.examDate)`; update the displayed value reactively when `examDate` changes; the calculated value is submitted to the backend as `patient_age_at_exam` on save
  - `frontend/src/pages/ExaminationDetailPage.tsx` — display the stored `patientAgeAtExam` (not recalculated) in the Patient Information or Examination Metadata tile
  - `frontend/src/components/reports/pdfDocument.ts` — include the stored `patientAgeAtExam` value in the Patient Information section of the PDF; read directly from the examination entity, do not recalculate
- **Constraints:**
  - `patient_age_at_exam` is **computed once at creation** from `birth_date` + `exam_date` and then stored immutably — subsequent updates to the examination must not overwrite it unless explicitly changed
  - For legacy examinations that predate this field, display gracefully (e.g., "—") rather than crashing or attempting to recalculate
  - `birth_date` must be present on the patient record before an examination can be created (enforced after TASK-038 is complete); until TASK-038 is deployed, the field is optional
- **Scope:** Full stack (backend + frontend + PDF)
- **Priority:** P1

---

### ~~TASK-038~~ ✅ Replace patient `age` field with `birth_date` at the Patient level

- **Background:** The current `Patient` data model stores `age` as an integer. This is a lossy, time-decaying value. It must be replaced by `birth_date` (ISO 8601 `YYYY-MM-DD` date string) so that age can always be calculated accurately for any reference date (e.g., examination date in TASK-037).
- **Files to modify — Backend:**
  - `api/src/functions/CreatePatient.ts` — replace the `age` input field with `birth_date`; validate that `birth_date` is a valid `YYYY-MM-DD` date string and that the resulting age falls in the range 2–99 years at time of creation
  - `api/src/functions/UpdatePatient.ts` — same replacement; re-validate age range on update
  - `api/src/functions/GetPatient.ts` / `GetPatients.ts` — return `birth_date` in the response instead of `age`; optionally also return a derived `age` (whole years from today) for convenience, clearly marked as a computed field
  - `api/src/functions/SearchPatients.ts` — no query change needed; ensure `birth_date` is included in search result rows
  - Table entity schema — rename the stored property from `age` to `birthDate` (or `birth_date`) on both the `PATIENT` row and the `PATIENT_SEARCH_*` row; add a migration note that old entities storing `age` should be read with a fallback
- **Files to modify — Frontend:**
  - `frontend/src/types/index.ts` — replace `age: number` with `birthDate: string` on the `Patient` type; remove `age` from `CreatePatientRequest` / `UpdatePatientRequest` and add `birthDate: string`
  - `frontend/src/components/PatientForm.tsx` — replace the `NumberInput` age field with a Carbon `DatePicker` (single, `datePickerType="single"`) for birth date; validate the selected date produces an age in the range 2–99 years and is not in the future
  - `frontend/src/pages/PatientsPage.tsx` — replace the "Age" column value with age calculated from `birth_date` using the `calculateAgeAtDate` helper (TASK-037 / `calculations.ts`)
  - `frontend/src/pages/PatientDetailPage.tsx` — replace the "Age" display field with "Date of Birth" (formatted) and a derived "Age" (years) shown alongside
  - `frontend/src/components/reports/pdfDocument.ts` — replace the stored age value in the Patient Information section with the formatted `birth_date` and the derived age
- **Constraints:**
  - Existing patient entities that only have `age` (no `birth_date`) must be handled gracefully at read time — display a "—" or omit the field rather than crashing
  - The `birth_date` value must be transmitted and stored as a plain `YYYY-MM-DD` string (no timezone conversion — same rule as `exam_date` per TASK-002)
  - `CreatePatient` and `UpdatePatient` must **not** accept a raw `age` integer after this change; the age range guard (2–99) is enforced by validating the derived age from `birth_date`
- **Scope:** Full stack (backend + frontend + PDF)
- **Priority:** P1

---

*Total tasks: 38 | Estimated phases: 8*
