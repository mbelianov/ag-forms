# Backend Test Suite Plan — Refactoring Safety Net

## Top-Level Overview

**Goal:** Produce a comprehensive, execution-ready test suite for the backend application that provides a reliable regression safety net for future refactoring. Every observable behaviour — API contracts, business rules, auth enforcement, data model invariants, edge cases, and error handling — must be verified before any refactoring begins.

**Scope:** Backend only (`api/src/`). No frontend changes.

**Approach:** Extend the existing Jest/ts-jest test infrastructure (Azurite for integration, mocked Table Storage for unit tests). Follow every established convention in `TESTING.md` and `testUtils.ts`. New test files slot into the existing directory layout.

**Coverage Gap Analysis (Current vs Target):**

| Area | Current | Gap |
|---|---|---|
| Auth integration (register, login, lockout, password, logout) | 10 tests | Moderate — missing: rate limit detail, concurrent lockout, `me` endpoint edge cases |
| Patients integration (CRUD, search, pagination) | 7 tests | Significant — missing: search short query guard, update search-index sync, cascade delete, viewer role blocks, viewer read pass, concurrent update 409, count endpoint |
| Examinations integration (CRUD, MRN, email) | 10 tests | Significant — missing: type filter, status filter, date range, patient-name search, page size cap, twin fields, exam type registry, concurrent 409, viewer read pass. `CalculateExamination` deleted (KI-002). |
| User Management integration | 0 tests | **Total gap** — create user, update user, delete user, reset password, list users, role enforcement |
| Audit Logs integration | 0 tests | **Total gap** — list, filter by user/action/month, pagination, role enforcement |
| Counters endpoint (GetPatientsCount, GetExaminationsCount) | 0 tests | **Total gap** |
| Validation unit tests | 9 tests | Small — missing: twin-2 fields, first-trimester schema, `validateRegister` fully, `validateUser` fullName required |
| Auth middleware unit tests | 9 tests | Good — minimal gaps |
| Token service unit tests | 9 tests | Complete |
| MRN generator unit tests | 13 tests | Good — minimal gaps |
| Password service unit tests | Exists | Assumed reasonable |
| Counter service unit tests | 6 tests | Good |
| patientUtils unit tests | 0 tests | Gap — `normalizePatientName`, `getSearchPartitionKey` |
| auditService unit tests | 0 tests | Gap — `sanitizeAuditDetails`, event dispatch functions |
| examinationTypes constants unit tests | 0 tests | Small gap |

---

## Sub-Tasks

---

### ST-01 — Unit Tests: `patientUtils` and `examinationTypes`

**Status:** [ ] pending

**Intent:** Cover the two pure-utility modules that have zero tests. Both are imported across multiple files and are prime candidates for silent breakage during refactoring.

**Expected Outcomes:**
- `normalizePatientName` and `getSearchPartitionKey` fully covered (whitespace, Cyrillic, empty string, first-char edge cases).
- `EXAM_TYPES`, `EXAM_TYPE_KEYS`, and `SECTION_VISIBILITY` (if present after planned frontend migration) covered for shape and completeness.
- `getSearchPartitionKey` verified to produce correct hex-padded bucket keys for Latin and Cyrillic first characters.

**Todo List:**
1. Create `api/src/tests/utils/patientUtils.test.ts`.
   - `normalizePatientName`: test Latin, Cyrillic, leading/trailing spaces, multiple internal spaces, already-lowercase, mixed case.
   - `getSearchPartitionKey`: test Latin 'a', Cyrillic 'и', numeric '1', empty fallback.
   - Verify the output partition key matches the format written by `createTestPatient` and `createTestExamination` in `testUtils.ts`.
2. Create `api/src/tests/utils/examinationTypes.test.ts`.
   - Assert `EXAM_TYPE_KEYS` is a non-empty string array.
   - Assert all known keys (`ultrasound_prenatal`, `ultrasound_prenatal_twins`, `ultrasound_first_trimester`, `ultrasound_first_trimester_twins`) are present.
   - Assert each entry in `EXAM_TYPES` has both `key` and `label` properties.
   - Assert no duplicate keys exist.

**Relevant Context:**
- [`api/src/utils/patientUtils.ts`](api/src/utils/patientUtils.ts)
- [`api/src/constants/examinationTypes.ts`](api/src/constants/examinationTypes.ts)
- Pattern: no mocks needed; pure functions.

---

### ST-02 — Unit Tests: `auditService` (sanitization and dispatch)

**Status:** [ ] pending

**Intent:** Verify that `sanitizeAuditDetails` correctly redacts sensitive field names and that every domain-event helper dispatches the correct action string. This protects against accidental PII leakage and ensures the audit trail action vocabulary stays consistent.

**Expected Outcomes:**
- `sanitizeAuditDetails` redacts `password`, `passwordHash`, `token`, `accessToken`, `refreshToken`, `secret`, `apiKey`, `creditCard`, `ssn`; passes through innocent fields; recurses into nested objects.
- Each exported event helper (`logUserLogin`, `logUserLogout`, `logPatientCreated`, `logPatientUpdated`, `logPatientDeleted`, `logExaminationCreated`, `logExaminationUpdated`, `logExaminationDeleted`, `logExaminationEmailSent`, `logUserCreated`, `logPasswordChanged`, `logUserDeleted`, `logExaminationsReassigned`, `logPasswordResetByAdmin`) calls `createEntity` with the correct `action` string.
- Audit failures do not throw (non-fatal path verified).

**Todo List:**
1. Create `api/src/tests/utils/auditService.test.ts`.
2. Mock `tableClient` at top level (pattern from `counterService.test.ts`).
3. For each exported event helper: call it, spy on `createEntity`, assert the `action` field in the created entity.
4. Test `sanitizeAuditDetails` by passing objects with sensitive and non-sensitive keys and checking the result.
5. Test the non-fatal path: mock `createEntity` to throw, verify the helper resolves without rethrowing.

**Relevant Context:**
- [`api/src/utils/auditService.ts`](api/src/utils/auditService.ts)
- Pattern: `jest.mock('../../utils/tableClient', ...)` as in [`counterService.test.ts`](api/src/tests/utils/counterService.test.ts).

---

### ST-03 — Delete `CalculateExamination.ts` and clean up its references

**Status:** [ ] pending

**Intent:** The endpoint is unreachable (never called by any frontend code), contains three confirmed formula bugs (KI-002), and has no refactoring value to preserve. Deleting it is cleaner than maintaining a permanently broken dead function. This sub-task must be executed **before** the test suite is implemented so subsequent sub-tasks do not reference a deleted file.

**Expected Outcomes:**
- `api/src/functions/CalculateExamination.ts` no longer exists.
- `api/src/tests/integration/examinations.test.ts` no longer imports or calls `calculateExamination`.
- `npm test` passes with no compilation errors or broken imports.
- `KI-002` status in `KNOWN-ISSUES.md` updated to ✅ Resolved.

**Todo List:**
1. Delete `api/src/functions/CalculateExamination.ts`.
2. In `api/src/tests/integration/examinations.test.ts`: remove line 13 (`import { calculateExamination }`) and the full `test('should calculate examination EFW and GA', ...)` block (lines 157–179).
3. `docs2/04-api-specification.md`: already updated — endpoint section replaced with a "Removed" tombstone note.
4. `docs2/TEST-CASES.md`: already updated — TC-CALC-004 removed, section header updated to 4 cases, totals decremented to 179.
5. `docs2/KNOWN-ISSUES.md`: already updated — status set to "Resolved (pending)". After deletion, update to `✅ Resolved — deleted per Option A`.
6. Verify `npm test` (unit tests only, no Azurite required) still compiles and passes.

**Relevant Context:**
- [`api/src/functions/CalculateExamination.ts`](api/src/functions/CalculateExamination.ts) — file to delete.
- [`api/src/tests/integration/examinations.test.ts`](api/src/tests/integration/examinations.test.ts) lines 13, 157–179 — references to remove.
- No other source file references `CalculateExamination` (verified by grep across entire `api/src/` and `frontend/src/`).

---

### ST-04 — Unit Tests: Extended `validation.ts` coverage

**Status:** [ ] pending

**Intent:** The current validation tests cover the main paths but miss: `validateRegister` fully, `fullName` required-on-register vs. optional-on-create, twin-2 biometry/doppler fields in the examination schema, first-trimester `data.ft_biometry` schema, `examinationType` allowlist enforcement, and `gestationalAgeIsManual` field.

**Expected Outcomes:**
- `validateRegister`: accepts valid payload; rejects missing username, password, email; rejects short password; rejects invalid role.
- `validateExamination` with `examinationType`: accepts every key in `EXAM_TYPE_KEYS`; rejects unknown type key.
- `validateExamination` with `biometry2`/`doppler2`: accepted when examination type is twins.
- `validateExamination` with `data.ft_biometry`: accepted; CRL, NT, NB fields accepted as floats.
- `validateExamination` with `gestationalAgeIsManual: true` and `gestationalAge` set: accepted.
- `validateExamination` with RI exactly 0 and exactly 1: both accepted (boundary values).
- `validateUser` with `fullName` missing: rejected (fullName required for user creation).

**Todo List:**
1. Add `describe('validateRegister')` block to `validation.test.ts`.
2. Add `describe('validateExamination — examinationType')` block.
3. Add `describe('validateExamination — twin fields')` block.
4. Add `describe('validateExamination — first trimester data')` block.
5. Add boundary tests for RI=0 and RI=1 in existing `validateExamination` block.

**Relevant Context:**
- [`api/src/utils/validation.ts`](api/src/utils/validation.ts) — `validateRegister`, `examinationSchema`, `biometrySchema`, `dopplerSchema`, `examinationDataSchema`.
- [`api/src/tests/utils/validation.test.ts`](api/src/tests/utils/validation.test.ts) — extend this file.

---

### ST-05 — Integration Tests: Extended Auth flows

**Status:** [ ] pending

**Intent:** Fill gaps in `auth.test.ts`: the `/auth/me` endpoint with invalid/expired token, concurrent lockout race (verifying `failedLoginAttempts` ≥ 1 after rapid sequential bad logins), and password mismatch on `change-password` confirm field.

**Expected Outcomes:**
- `GET /auth/me` with no token → 401.
- `GET /auth/me` with valid token → 200, `user.id` present, `passwordHash` absent.
- `POST /auth/change-password` with `newPassword !== confirmPassword` → 400.
- `POST /auth/logout` with no token → 401.
- `POST /auth/change-password` weak new password → 400 with strength error.
- Login with username that does not exist → 401.

**Todo List:**
1. Extend `api/src/tests/integration/auth.test.ts` with new `test(...)` entries.
2. No new files needed; follow existing patterns exactly.

**Relevant Context:**
- [`api/src/tests/integration/auth.test.ts`](api/src/tests/integration/auth.test.ts)
- [`api/src/functions/GetCurrentUser.ts`](api/src/functions/GetCurrentUser.ts)
- [`api/src/functions/ChangePassword.ts`](api/src/functions/ChangePassword.ts)

---

### ST-06 — Integration Tests: Extended Patients flows

**Status:** [ ] pending

**Intent:** The current `patients.test.ts` covers basic CRUD. Missing: viewer role can read patients but cannot create/update/delete; doctor cannot delete a patient they did not create; search with fewer than 2 characters is rejected; update with stale ETag returns 409; update renames patient and verifies search index is updated; count endpoint returns integer.

**Expected Outcomes:**
- `GET /v1/patients` with viewer token → 200.
- `POST /v1/patients` with viewer token → 403.
- `PUT /v1/patients/:id` with viewer token → 403.
- `DELETE /v1/patients/:id` with viewer token → 403.
- `GET /v1/patients-search?name=x` (1 char) → 400.
- `GET /v1/patients-search?name=ab` (2 chars) → 200.
- `PUT /v1/patients/:id` with stale ETag → 409.
- `PUT /v1/patients/:id` rename → search index updated (subsequent search finds patient under new name, not old).
- `DELETE /v1/patients/:id` by doctor who did NOT create the patient → 403.
- `GET /v1/patients-count` with valid token → 200 with `{ count: N }`.
- `GET /v1/patients-count` with no token → 401.

**Todo List:**
1. Extend `api/src/tests/integration/patients.test.ts` with new `test(...)` entries.
2. For the search-index rename test: create patient, rename via `updatePatient`, then call `searchPatients` with new name prefix and verify hit; then with old name prefix and verify no hit.

**Relevant Context:**
- [`api/src/functions/SearchPatients.ts`](api/src/functions/SearchPatients.ts)
- [`api/src/functions/GetPatientsCount.ts`](api/src/functions/GetPatientsCount.ts)
- [`api/src/functions/UpdatePatient.ts`](api/src/functions/UpdatePatient.ts) — search-index sync logic.

---

### ST-07 — Integration Tests: Extended Examinations flows

**Status:** [ ] pending

**Intent:** The current `examinations.test.ts` covers basic CRUD. Missing: examination type filter, status filter, date range filter, patient-name search filter, page size cap at 100, concurrent update 409, viewer read, twin fields round-trip, examination type registry enforcement, and missing ETag on update → 400.

**Expected Outcomes:**
- `GET /v1/examinations?examination_type=ultrasound_prenatal` → 200, results only contain that type.
- `GET /v1/examinations?examination_type=invalid_type` → 400.
- `GET /v1/examinations?status=draft` → 200, results only contain draft status.
- `GET /v1/examinations?status=invalid` → 400.
- `GET /v1/examinations?from_date=...&to_date=...` → 200, results within range.
- `GET /v1/examinations?patient_name=...` → 200, results contain that patient.
- `GET /v1/examinations?pageSize=200` → 200 with at most 100 results (capped).
- `PUT /v1/examinations/:id` without ETag → 400.
- `PUT /v1/examinations/:id` with stale ETag → 409.
- `GET /v1/examinations` with viewer token → 200.
- `POST /v1/examinations` with viewer token → 403.
- Create examination with `examinationType: 'ultrasound_prenatal_twins'` and twin biometry/doppler fields → 201, both round-tripped in response.
- Create examination with unknown `examinationType` → 400.
- `GET /v1/examinations/:id` for non-existent ID → 404.
- `GET /v1/examinations-count` with valid token → 200 with `{ count: N }`.

**Todo List:**
1. Extend `api/src/tests/integration/examinations.test.ts` with new `test(...)` entries.
2. For the twin fields test: POST examination with `biometry2` and `doppler2` set, then GET by ID, assert both fields deserialized correctly.
3. For the page size cap: no Azurite data required — just assert `pageSize` in the response body equals 100 when 200 was requested.

**Relevant Context:**
- [`api/src/functions/GetExaminations.ts`](api/src/functions/GetExaminations.ts) — allowlist validation, filter OData construction.
- [`api/src/functions/CreateExamination.ts`](api/src/functions/CreateExamination.ts) — twin fields, `examinationType` validation.
- [`api/src/functions/GetExaminationsCount.ts`](api/src/functions/GetExaminationsCount.ts).

---

### ST-08 — Integration Tests: User Management (New Suite)

**Status:** [ ] pending

**Intent:** The `DeleteUser` and `ResetUserPassword` functions have zero test coverage. `CreateUser`, `UpdateUser`, and `GetUsers` are also untested in integration. This suite covers the complete admin user-lifecycle with all invariants from `user-management-req-spec.md`.

**Expected Outcomes (tests to pass):**
- Admin creates user → 201 with safe user object (no `passwordHash`).
- Duplicate username → 409.
- Non-admin tries to create user → 403.
- Admin lists users → 200, sensitive fields absent.
- Admin updates user role → 200, role changed.
- Invalid role on update → 400.
- Admin deletes doctor user with no examinations → 200.
- Admin cannot delete own account → 400.
- Admin cannot delete last admin → 400.
- Delete user with examinations but no `reassignTo` → 400.
- Delete user with examinations and valid `reassignTo` → 200, examinations reassigned.
- Non-admin tries to delete user → 403.
- Admin resets another user's password → 200.
- Admin cannot reset own password via reset-password endpoint → 400.
- Reset password for non-existent user → 404.
- Weak new password on reset → 400.
- Non-admin tries to reset password → 403.
- After password reset, old password rejected, new password accepted.
- `passwordHash`, `failedLoginAttempts`, `lockedUntil`, `normalizedUsername` never present in any user response.

**Todo List:**
1. Create `api/src/tests/integration/users.test.ts`.
2. Import `createUser`, `getUsers`, `updateUser`, `deleteUser`, `resetUserPassword` from their respective function files.
3. Use `createTestUser`, `cleanupTestData`, `seedCounter`, `mockHttpRequest`, `mockInvocationContext`.
4. Each `test(...)` is independent; `beforeEach`/`afterEach` call `cleanupTestData()`.
5. For the "examinations reassigned" test: create a test examination owned by the doctor being deleted (via `createTestExamination`). After `deleteUser` returns 200, verify storage state directly: `getTableClient('Examinations').getEntity<any>('EXAM', examinationId)` and assert `entity.createdBy === reassignTargetUserId`. This is the same pattern used in `examinations.test.ts` lines 112–113 (ETag fetch) and `auth.test.ts` line 237 (`failedLoginAttempts` check) — trusting the response is not sufficient for storage invariants.

**Relevant Context:**
- [`api/src/functions/CreateUser.ts`](api/src/functions/CreateUser.ts)
- [`api/src/functions/GetUsers.ts`](api/src/functions/GetUsers.ts)
- [`api/src/functions/UpdateUser.ts`](api/src/functions/UpdateUser.ts)
- [`api/src/functions/DeleteUser.ts`](api/src/functions/DeleteUser.ts)
- [`api/src/functions/ResetUserPassword.ts`](api/src/functions/ResetUserPassword.ts)
- [`docs2/user-management-req-spec.md`](docs2/user-management-req-spec.md) — invariants INV-01 through INV-06.

---

### ST-09 — Integration Tests: Audit Logs (New Suite)

**Status:** [ ] pending

**Intent:** `GetAuditLogs` has zero test coverage. The function has complex filter/partition logic (current + previous month partitions, `action` allowlist, user/action filter combinatorics) that must be locked down before refactoring.

**Expected Outcomes:**
- Non-admin → 403.
- Unauthenticated → 401.
- Valid admin token → 200 with `{ logs: [...], continuationToken }` shape.
- After a login event, audit logs contain at least one `USER_LOGIN_SUCCESS` entry.
- `?action=USER_LOGIN_SUCCESS` filter → 200, all entries have that action.
- `?action=INVALID_ACTION` → 400.
- `?pageSize=5` → at most 5 records returned.
- `?month=YYYYMM` → only queried that month's partition (no error even if empty).

**Todo List:**
1. Create `api/src/tests/integration/auditLogs.test.ts`.
2. Import `getAuditLogs` from `../../functions/GetAuditLogs`.
3. Seed at least one audit event by calling the `login` function (which fires `logUserLogin`), then query audit logs and assert at least one entry.
4. Test filter combinations using `request.query = new URLSearchParams(...)` pattern.
5. `cleanupTestData()` already wipes `AuditLogs` table? Check — if not, add an explicit audit sweep in this suite's `afterEach`.

**Relevant Context:**
- [`api/src/functions/GetAuditLogs.ts`](api/src/functions/GetAuditLogs.ts)
- `getPartitionKeys()` helper — month format `YYYYMM`.
- `VALID_ACTIONS` allowlist in `GetAuditLogs.ts` — all actions must be in the test.

---

### ST-10 — Integration Tests: `patientAgeAtExam` Server-Side Fallback (FLAG-08)

**Status:** [ ] pending

**Intent:** FLAG-08 added server-side fallback to compute `patientAgeAtExam` when not supplied by the client. This logic exists in both `CreateExamination` and `UpdateExamination` and is untested.

**Expected Outcomes:**
- Create examination for a patient with `birthDate` set, without `patientAgeAtExam` in the request body → response includes computed `patientAgeAtExam`.
- Create examination for a patient without `birthDate`, without `patientAgeAtExam` → response `patientAgeAtExam` is `undefined`.
- Create examination with explicit `patientAgeAtExam: 32` → stored value is exactly 32 (client value wins).
- Update examination for patient with `birthDate`, new `examDate` but no `patientAgeAtExam` → `patientAgeAtExam` recomputed.

**Todo List:**
1. Add these tests to `examinations.test.ts` in their own `describe('patientAgeAtExam fallback')` block.
2. Use `createTestPatient` but directly write a `birthDate` field onto the entity in Azurite after creation.
3. Alternatively: create a new `createTestPatientWithBirthDate` helper inline in the test.

**Relevant Context:**
- [`api/src/functions/CreateExamination.ts`](api/src/functions/CreateExamination.ts) lines 88–92 (fallback compute).
- [`api/src/functions/UpdateExamination.ts`](api/src/functions/UpdateExamination.ts) lines 98–114 (fallback compute).

---

### ST-11 — Integration Tests: `SearchPatients` — minimum length, Cyrillic, and pagination guards

**Status:** [ ] pending

**Intent:** The `SearchPatients` function has thin coverage. The minimum query length guard (< 2 characters), Cyrillic first-character bucket routing, and the `MAX_RESULTS` behaviour need dedicated tests.

**Expected Outcomes:**
- `?name=a` (1 char) → 400 with message about minimum length.
- `?name=` (empty) → 400.
- `?name=Ma` → 200, returns patients whose name starts with "Ma".
- Create Cyrillic patient (e.g. "Мария"), search `?name=Ма` → found.
- Search `?name=zzz` matching no patients → 200 with empty `patients` array.

**Todo List:**
1. Add a dedicated `describe('SearchPatients')` block to `patients.test.ts`.
2. Create a Cyrillic-named patient directly via `createPatient` function (to exercise the partition key derivation end-to-end).

**Relevant Context:**
- [`api/src/functions/SearchPatients.ts`](api/src/functions/SearchPatients.ts)
- Bucket derivation via `getSearchPartitionKey` in `patientUtils.ts`.

---

### ST-12 — Unit Tests: `errorHandler` branch coverage

**Status:** [ ] pending

**Intent:** `errorHandler.ts` is imported by every Azure Function and has 10 conditional branches mapping error message strings and `statusCode` properties to HTTP response status codes. It is currently untested. If any branch is modified during refactoring, the wrong HTTP status is silently returned — no integration test would catch this because integration tests don't exercise the error paths in isolation.

**Expected Outcomes:**
- Error with message containing `"Entity not found"` → 404 response.
- Error with message containing `"Entity already exists"` → 409 response.
- Error with message containing `"Concurrency conflict"` → 409 response.
- Error with message containing `"Validation failed"` → 400 response.
- Error with `statusCode: 404` → 404 response.
- Error with `statusCode: 412` → 412 response.
- Error with `statusCode: 503` → 500 response.
- Error with no known pattern → 500 response.
- Response body never contains internal error details (stack trace, connection string).

**Todo List:**
1. Create `api/src/tests/utils/errorHandler.test.ts`.
2. No mocks needed — `handleError` is a pure synchronous function (takes an error object and a mock context).
3. Use `mockInvocationContext()` from `testUtils.ts` as the context argument.
4. For each branch: construct an error with the appropriate `message` or `statusCode`, call `handleError`, parse `JSON.parse(response.body)`, assert `response.status` and `body.success === false`.

**Relevant Context:**
- [`api/src/utils/errorHandler.ts`](api/src/utils/errorHandler.ts)
- [`api/src/utils/responseHelpers.ts`](api/src/utils/responseHelpers.ts) — `internalServerErrorResponse`, `errorResponse`.
- Pattern: no Azure mocks needed; pure function test.

---

### ST-13 — Integration Tests: `DeletePatient` cascade and access-control edge cases

**Status:** [ ] pending

**Intent:** The cascade delete behaviour and the access-control guard (doctor may only delete their own patients) deserve explicit integration tests beyond the happy-path already present.

**Expected Outcomes:**
- Doctor deletes their own patient with 2 examinations → 200; both examinations are soft-deleted (fetching them by ID returns `isDeleted: true`).
- Doctor tries to delete a patient created by another doctor → 403.
- Admin deletes any patient (even one created by a doctor) → 200.
- Viewer tries to delete any patient → 403.
- Double-delete: delete patient, then try to delete again → 404.

**Todo List:**
1. Add a dedicated `describe('DeletePatient — cascade & access control')` block to `patients.test.ts`.
2. For the cascade test: create 2 examinations for the patient, call `deletePatient`, then call `getExamination` for each and verify `isDeleted`.
3. For the cross-doctor ownership test: create a patient with `createTestUser('doctor')` A, then attempt deletion with doctor B's token.

**Relevant Context:**
- [`api/src/functions/DeletePatient.ts`](api/src/functions/DeletePatient.ts) — `cascadeDeleteExaminations`, `canAccessResource`.
- `createTestPatient` seeds with a `createdBy` field tied to an internal user. May need a custom helper or to create via the endpoint to set the right `createdBy`.

---

## Implementation Order

The sub-tasks are designed to be independent. Recommended order for progressive coverage gain:

```
ST-03                             (delete dead code first — unblocks everything else)
ST-01 → ST-04 → ST-02 → ST-12   (unit tests — no Azurite needed)
ST-05 → ST-06 → ST-07            (extend existing integration suites)
ST-08 → ST-09                    (new integration suites)
ST-10 → ST-11 → ST-13            (specialised integration scenarios)
```

---

## Key Conventions to Follow in All New Tests

| Convention | Source |
|---|---|
| Declare `jest`, `describe`, `test`, `expect`, `beforeEach`, `afterEach` with `declare const` at top | All existing test files |
| `beforeEach` / `afterEach` both call `cleanupTestData()` | All integration tests |
| `parseBody = (response: any) => JSON.parse(response.body)` helper | All integration tests |
| `mockHttpRequest` + `mockInvocationContext` for all handler calls | `testUtils.ts` |
| `.query = new URLSearchParams('...')` for query params | `patients.test.ts`, `examinations.test.ts` |
| `.params = { id: '...' }` for route params | `patients.test.ts`, `examinations.test.ts` |
| `jest.mock('../../utils/tableClient', ...)` at top for unit tests | `mrnGenerator.test.ts`, `counterService.test.ts` |
| `// Made with Bob` comment at end of each file | All existing files |

---

## Notes for Agent Mode Implementation

### Email address constraint (KI-007)
`KNOWN-ISSUES.md §KI-007` documents that Joi's email validator rejects non-public TLDs (e.g. `admin@hospital.internal`). All test fixtures that create users via the `register` or `createUser` endpoints **must** use `@example.com` email addresses. This applies especially to ST-05, ST-08, and any helper that constructs a user body inline.

- Each sub-task maps to one file creation or one file extension.
- Start each subtask by re-reading this plan file for full context.
- After completing each subtask, update the Status line from `[ ] pending` to `[x] done`.
- **Do not run tests during planning** — implementation happens in Agent mode after user approval.
- The `api/src/tests/TESTING.md` file should be updated after all sub-tasks complete to reflect the new test layout.
