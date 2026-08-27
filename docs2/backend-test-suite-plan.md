# Backend Test Suite Plan — Refactoring Safety Net

## Top-Level Overview

**Goal:** Produce a comprehensive, execution-ready test suite for the backend application that provides a reliable regression safety net for future refactoring. Every observable behaviour — API contracts, business rules, auth enforcement, data model invariants, edge cases, and error handling — must be verified before any refactoring begins.

**Scope:** Backend only (`api/src/`). No frontend changes.

**Approach:** Extend the existing Jest/ts-jest test infrastructure (Azurite for integration, mocked Table Storage for unit tests). Follow every established convention in `TESTING.md` and `testUtils.ts`. New test files slot into the existing directory layout.

> **⚠️ Naming note:** This plan uses the prefix **`TST-`** for its sub-task IDs to avoid collision with the refactoring plan (`refactoring-findings.md` §11), which uses plain `ST-01`–`ST-10`. Any reference to a refactoring sub-task in this document uses the notation **`REF-ST-{n}`** (e.g. `REF-ST-04`).

**Coverage Gap Analysis (Current vs Target):**

| Area | Current | Gap |
|---|---|---|
| Auth integration (register, login, lockout, password, logout) | 10 tests | Moderate — missing: rate limit detail, concurrent lockout, `me` endpoint edge cases |
| Patients integration (CRUD, search, pagination) | 7 tests | Significant — missing: search short query guard, update search-index sync, cascade delete, viewer role blocks, viewer read pass, concurrent update 409, count endpoint |
| Examinations integration (CRUD, MRN, email) | 10 tests | Significant — missing: status filter, date range, patient-name search, page size cap, concurrent 409, viewer read pass, count endpoint, `GetExaminationByMRN` dedicated coverage. Type filter, twin round-trip, and four-type registry tests deferred to post-refactoring. `CalculateExamination` deleted (KI-002). |
| User Management integration | 0 tests | **Total gap** — create user, update user, delete user, reset password, list users, role enforcement |
| Audit Logs integration | 0 tests | **Total gap** — list, filter by user/action/month, pagination, role enforcement |
| Counters endpoint (GetPatientsCount, GetExaminationsCount) | 0 tests | **Total gap** |
| Validation unit tests | 9 tests | Small — missing: `validateRegister` fully, `validateUser` fullName required, `gestationalAgeIsManual`, RI boundaries. Twin-2 fields, FT schema, and type allowlist deferred to post-refactoring. |
| Auth middleware unit tests | 9 tests | Good — minimal gaps |
| Token service unit tests | 9 tests | Complete |
| MRN generator unit tests | 13 tests | Good — minimal gaps |
| Password service unit tests | Exists | Assumed reasonable |
| Counter service unit tests | 6 tests | Good |
| patientUtils unit tests | 0 tests | Gap — `normalizePatientName`, `getSearchPartitionKey` |
| auditService unit tests | 0 tests | Gap — `sanitizeAuditDetails`, event dispatch functions |
| errorHandler unit tests | 0 tests | Gap — 10 conditional branches |
| examinationTypes constants unit tests | 0 tests | Deferred — four-value key assertions would break after refactoring REF-ST-04 collapses to two keys. Written post-refactoring against `prenatal` / `first_trimester`. |

---

## Sub-Tasks

---

### TST-00 — Prerequisite: Extend `cleanupTestData` in `testUtils.ts`

**Status:** [ ] pending

**Intent:** `cleanupTestData` is the shared isolation contract that every integration test depends on. It currently does not wipe `AuditLogs` rows or the `PATIENT_TOTAL`/`EXAM_TOTAL` counter rows. Without these sweeps, TST-06/TST-07/TST-08 count-endpoint tests see accumulated counter values from prior tests, and TST-09 audit filter tests see log entries written by prior tests. This must be fixed in `testUtils.ts` before any integration sub-tasks are implemented.

**Expected Outcomes:**
- `cleanupTestData()` wipes `AuditLogs` (all `AUDIT_*` partitions), and explicitly deletes `PATIENT_TOTAL` and `EXAM_TOTAL` counter rows.
- `TESTING.md` isolation table is updated to reflect the two new rows.

**Todo List:**
1. In `api/src/tests/testUtils.ts`, add a full `AuditLogs` sweep at the end of `cleanupTestData`, after line 315 (the existing MRN counter delete), before the closing brace:
   ```ts
   // Full sweep of AuditLogs table (all AUDIT_* partitions)
   try {
       const auditTable = getTableClient(AUDIT_TABLE);
       const auditEntities: Array<{ partitionKey: string; rowKey: string }> = [];
       for await (const entity of auditTable.listEntities()) {
           auditEntities.push({ partitionKey: entity.partitionKey as string, rowKey: entity.rowKey as string });
       }
       for (const e of auditEntities) {
           try { await auditTable.deleteEntity(e.partitionKey, e.rowKey, { etag: '*' }); } catch {}
       }
   } catch {}
   ```
2. In `api/src/tests/testUtils.ts`, add explicit deletion of `PATIENT_TOTAL` and `EXAM_TOTAL` counter rows immediately before the existing `trackedCounters` loop (before line 309):
   ```ts
   // Wipe PATIENT_TOTAL and EXAM_TOTAL counter rows unconditionally
   try { await countersTable.deleteEntity('COUNTER', 'PATIENT_TOTAL', { etag: '*' }); } catch {}
   try { await countersTable.deleteEntity('COUNTER', 'EXAM_TOTAL', { etag: '*' }); } catch {}
   ```
3. After this change, `cleanupTestData()` is a complete slate reset for all tables. Update the `TESTING.md` isolation table to add the two new rows:

   | Table | Partitions wiped |
   |---|---|
   | `AuditLogs` | all `AUDIT_*` partitions (full sweep) |
   | `Counters` | `MRN_{year}`, `PATIENT_TOTAL`, `EXAM_TOTAL` |

**Relevant Context:**
- [`api/src/tests/testUtils.ts`](api/src/tests/testUtils.ts) lines 309–315 — existing counter cleanup.
- `AUDIT_TABLE` constant is already declared at line 14 and `ensureTableExists` is already called at line 215 — no new imports needed.

> **Note for REF-ST-02 coordination:** After refactoring REF-ST-02 lands (`primaryRowKey` stored on lookup entity), `createTestExamination` in `testUtils.ts` must also write `primaryRowKey` onto the `EXAM` entity so that `UpdateExamination` can find the primary row without an O(N) scan. Update `createTestExamination` at that time — it is a coordinated change to this file.

---

### TST-01 — Unit Tests: `patientUtils`

**Status:** [ ] pending

**Intent:** Cover the `patientUtils` pure-utility module that has zero tests. It is imported across multiple files and is a prime candidate for silent breakage during refactoring. The `examinationTypes` constants are intentionally excluded: the refactoring plan (REF-ST-04) collapses the four legacy type keys to two new ones (`prenatal`, `first_trimester`), so any assertions written against the old keys would break immediately after that sub-task completes. `examinationTypes` tests will be written post-refactoring against the new two-value registry.

**Expected Outcomes:**
- `normalizePatientName` and `getSearchPartitionKey` fully covered (whitespace, Cyrillic, empty string, first-char edge cases).
- `getSearchPartitionKey` verified to produce correct hex-padded bucket keys for Latin and Cyrillic first characters.

**Todo List:**
1. Create `api/src/tests/utils/patientUtils.test.ts`.
   - `normalizePatientName`: test Latin, Cyrillic, leading/trailing spaces, multiple internal spaces, already-lowercase, mixed case.
   - `getSearchPartitionKey`: test Latin 'a', Cyrillic 'и', numeric '1', empty fallback.
   - Verify the output partition key matches the format written by `createTestPatient` and `createTestExamination` in `testUtils.ts`.

**Relevant Context:**
- [`api/src/utils/patientUtils.ts`](api/src/utils/patientUtils.ts)
- Pattern: no mocks needed; pure functions.

---

### TST-02 — Unit Tests: `auditService` (sanitization and dispatch)

**Status:** [ ] pending

**Intent:** Verify that `sanitizeAuditDetails` correctly redacts sensitive field names and that every domain-event helper dispatches the correct action string. This protects against accidental PII leakage and ensures the audit trail action vocabulary stays consistent.

**Expected Outcomes:**
- `sanitizeAuditDetails` redacts `password`, `passwordHash`, `token`, `accessToken`, `refreshToken`, `secret`, `apiKey`, `creditCard`, `ssn`, **and `socialSecurityNumber`** (both are present in the `sensitiveFields` array — assert both are replaced with `'[REDACTED]'`); passes through innocent fields; recurses into nested objects.
- Each exported event helper (`logUserLogin`, `logUserLogout`, `logPatientCreated`, `logPatientUpdated`, `logPatientDeleted`, `logExaminationCreated`, `logExaminationUpdated`, `logExaminationDeleted`, `logExaminationEmailSent`, `logUserCreated`, `logPasswordChanged`, `logUserDeleted`, `logExaminationsReassigned`, `logPasswordResetByAdmin`) calls `createEntity` with the correct `action` string.
- Audit failures do not throw (non-fatal path verified).

**Todo List:**
1. Create `api/src/tests/utils/auditService.test.ts`.
2. Mock `tableClient` at top level (pattern from `counterService.test.ts`).
3. For each exported event helper: call it, spy on `createEntity`, assert the `action` field in the created entity.
4. **`sanitizeAuditDetails` is not exported** — it is a private `const` in `auditService.ts` and cannot be imported directly. Test it indirectly: call `logAuditEvent(...)` with a `details` object containing both sensitive keys (e.g. `{ password: 'secret', socialSecurityNumber: '123', username: 'alice' }`) and innocent keys, spy on `createEntity`, parse the stored `details` JSON string from the captured call argument, and assert sensitive keys are `'[REDACTED]'` while innocent keys are preserved unchanged. If direct unit testing is preferred, add `export` to the `sanitizeAuditDetails` declaration as part of this sub-task.
5. Test the non-fatal path: mock `createEntity` to throw, verify the helper resolves without rethrowing.

**Relevant Context:**
- [`api/src/utils/auditService.ts`](api/src/utils/auditService.ts)
- Pattern: `jest.mock('../../utils/tableClient', ...)` as in [`counterService.test.ts`](api/src/tests/utils/counterService.test.ts).

---

### TST-03 — (Done) Delete `CalculateExamination.ts` and clean up references

**Status:** [x] done

**Intent:** The endpoint was unreachable, contained three confirmed formula bugs (KI-002), and had no refactoring value. Deleted pre-test-suite. All references removed from `examinations.test.ts`.

**Outcomes achieved:**
- `api/src/functions/CalculateExamination.ts` no longer exists.
- `api/src/tests/integration/examinations.test.ts` no longer imports or calls `calculateExamination`.
- `KI-002` status in `KNOWN-ISSUES.md` updated to ✅ Resolved.

---

### TST-04 — Unit Tests: Extended `validation.ts` coverage

**Status:** [ ] pending

**Intent:** The current validation tests cover the main paths but miss: `validateRegister` fully, `fullName` required-on-register vs. optional-on-create, `gestationalAgeIsManual` field, and RI boundary values. The following blocks are intentionally excluded and deferred to post-refactoring:
1. `biometry2`/`doppler2` twin-field validation — refactoring REF-ST-04 removes these top-level fields from the schema entirely.
2. `examinationType` allowlist enforcement against the four legacy keys — refactoring REF-ST-04 replaces the allowlist with `['prenatal', 'first_trimester']`.
3. First-trimester `data.ft_biometry` schema — the `ft_*` keys move inside `data.fetuses[i]` in REF-ST-04.

All three blocks will be re-added after REF-ST-04 is complete, written against the new schema.

**Expected Outcomes:**
- `validateRegister`: accepts valid payload; rejects missing username, password, email; rejects short password; rejects invalid role.
- `validateExamination` with `gestationalAgeIsManual: true` and `gestationalAge` set: accepted.
- `validateExamination` with RI exactly 0 and exactly 1: both accepted (boundary values).
- `validateUser` with `fullName` missing: rejected (fullName required for user creation).

**Todo List:**
1. Add `describe('validateRegister')` block to `validation.test.ts`.
2. Add `describe('validateExamination — gestationalAgeIsManual')` block.
3. Add boundary tests for RI=0 and RI=1 in existing `validateExamination` block.
4. Add `describe('validateUser — fullName required')` block.

**Relevant Context:**
- [`api/src/utils/validation.ts`](api/src/utils/validation.ts) — `validateRegister`, `examinationSchema`, `biometrySchema`, `dopplerSchema`.
- [`api/src/tests/utils/validation.test.ts`](api/src/tests/utils/validation.test.ts) — extend this file.

---

### TST-05 — Integration Tests: Extended Auth flows

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

### TST-06 — Integration Tests: Extended Patients flows

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
3. TST-00 ensures `cleanupTestData()` now wipes `PATIENT_TOTAL` — no additional counter teardown needed here.

**Relevant Context:**
- [`api/src/functions/SearchPatients.ts`](api/src/functions/SearchPatients.ts)
- [`api/src/functions/GetPatientsCount.ts`](api/src/functions/GetPatientsCount.ts)
- [`api/src/functions/UpdatePatient.ts`](api/src/functions/UpdatePatient.ts) — search-index sync logic.

---

### TST-07 — Integration Tests: Extended Examinations flows

**Status:** [ ] pending

**Intent:** The current `examinations.test.ts` covers basic CRUD. Missing: status filter, date range filter, patient-name search filter, page size cap at 100, concurrent update 409, viewer read, missing ETag on update → 400, and a dedicated `GetExaminationByMRN` assertion.

The following are intentionally excluded and deferred to post-refactoring:
- Examination type filter using old keys (`ultrasound_prenatal`, etc.) — refactoring REF-ST-04 replaces these with `prenatal` / `first_trimester`; filter tests must be written against the new keys after REF-ST-04 completes (this is the migration-script + cleanup step, which is atomic per the resolved design in `refactoring-findings.md §10 Q1`).
- Twin biometry/doppler round-trip (`biometry2`, `doppler2`, `ultrasound_prenatal_twins`) — refactoring REF-ST-04 removes these top-level columns; any round-trip test written now would break after that sub-task.
- Four-type round-trip coverage (all four `EXAM_TYPE_KEYS`) — same reason; replaced by two-type coverage post-REF-ST-04.
- `examinationType` allowlist enforcement test using old keys — same reason.
- `data.twin2_ft_*` round-trip — refactoring REF-ST-04 moves these into `data.fetuses[1]`; any assertion against `twin2_ft_*` keys would fail after migration.

**Expected Outcomes:**
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
- `GET /v1/examinations/:id` for non-existent ID → 404.
- `GET /v1/examinations-count` with valid token → 200 with `{ count: N }`.
- `GET /v1/examinations/by-mrn/:mrn` for a known MRN → 200, returned examination matches the one created.
- `GET /v1/examinations/by-mrn/:mrn` for unknown MRN → 404.

**Todo List:**
1. Extend `api/src/tests/integration/examinations.test.ts` with new `test(...)` entries.
2. For the page size cap: no Azurite data required — just assert `pageSize` in the response body equals 100 when 200 was requested.
3. For `GetExaminationByMRN`: create an examination via `createTestExamination`, capture its `mrn` field, call `getExaminationByMRN` with that MRN as a route param, assert 200 and matching `examinationId`. Then call with a fictitious MRN and assert 404.
4. TST-00 ensures `cleanupTestData()` now wipes `EXAM_TOTAL` — no additional counter teardown needed here.

**Relevant Context:**
- [`api/src/functions/GetExaminations.ts`](api/src/functions/GetExaminations.ts) — allowlist validation, filter OData construction.
- [`api/src/functions/CreateExamination.ts`](api/src/functions/CreateExamination.ts) — `examinationType` validation.
- [`api/src/functions/GetExaminationsCount.ts`](api/src/functions/GetExaminationsCount.ts)
- [`api/src/functions/GetExaminationByMRN.ts`](api/src/functions/GetExaminationByMRN.ts)

---

### TST-08 — Integration Tests: User Management (New Suite)

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
- Delete user with examinations and valid `reassignTo` → 200, examinations reassigned (`createdBy` updated on EXAM entity); `EXAM_TOTAL` counter is **NOT** decremented (reassignment ≠ deletion — assert counter value is unchanged).
- Non-admin tries to delete user → 403.
- Admin resets another user's password → 200.
- Admin cannot reset own password via reset-password endpoint → 400 with message `'Use change-password to update your own password'` (guard confirmed at [`ResetUserPassword.ts:33`](api/src/functions/ResetUserPassword.ts:33)).
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
5. For the "examinations reassigned" test: create a test examination owned by the doctor being deleted (via `createTestExamination`). After `deleteUser` returns 200: (a) verify storage state directly — `getTableClient('Examinations').getEntity<any>('EXAM', examinationId)` and assert `entity.createdBy === reassignTargetUserId`; (b) verify the `EXAM_TOTAL` counter was NOT decremented — read `getTableClient('Counters').getEntity<any>('COUNTER', 'EXAM_TOTAL')` before and after the call and assert `valueAfter === valueBefore`. Trusting the response alone is not sufficient for storage invariants.
6. TST-00 ensures `cleanupTestData()` now wipes `PATIENT_TOTAL` and `EXAM_TOTAL` — no additional counter teardown needed per test.

**Relevant Context:**
- [`api/src/functions/CreateUser.ts`](api/src/functions/CreateUser.ts)
- [`api/src/functions/GetUsers.ts`](api/src/functions/GetUsers.ts)
- [`api/src/functions/UpdateUser.ts`](api/src/functions/UpdateUser.ts)
- [`api/src/functions/DeleteUser.ts`](api/src/functions/DeleteUser.ts)
- [`api/src/functions/ResetUserPassword.ts`](api/src/functions/ResetUserPassword.ts)
- [`docs2/user-management-req-spec.md`](docs2/user-management-req-spec.md) — invariants INV-01 through INV-06.

---

### TST-09 — Integration Tests: Audit Logs (New Suite)

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
5. TST-00 sweeps all `AuditLogs` rows in `cleanupTestData()` — no additional `afterEach` audit sweep is needed in this suite.

**Relevant Context:**
- [`api/src/functions/GetAuditLogs.ts`](api/src/functions/GetAuditLogs.ts)
- `getPartitionKeys()` helper — month format `YYYYMM`.
- `VALID_ACTIONS` allowlist in `GetAuditLogs.ts` — all actions must be in the test.

---

### TST-10 — Integration Tests: `patientAgeAtExam` Server-Side Fallback (FLAG-08)

**Status:** [ ] pending

**Intent:** FLAG-08 added server-side fallback to compute `patientAgeAtExam` when not supplied by the client. This logic exists in both `CreateExamination` and `UpdateExamination` and is untested.

**Expected Outcomes:**
- Create examination for a patient with `birthDate` set, without `patientAgeAtExam` in the request body → response includes computed `patientAgeAtExam`.
- Create examination for a patient without `birthDate`, without `patientAgeAtExam` → response `patientAgeAtExam` is `undefined`.
- Create examination with explicit `patientAgeAtExam: 32` → stored value is exactly 32 (client value wins).
- Update examination for patient with `birthDate`, new `examDate` but no `patientAgeAtExam` → `patientAgeAtExam` recomputed.
- Create examination for patient with `birthDate`, but `examDate` is before `birthDate` → verify the returned `patientAgeAtExam` is either `undefined` or `0` (not a negative integer). Assert whichever the actual implementation produces and document the behavior.

**Todo List:**
1. Add these tests to `examinations.test.ts` in their own `describe('patientAgeAtExam fallback')` block.
2. Use `createTestPatient` but directly write a `birthDate` field onto the entity in Azurite after creation.
3. Alternatively: create a new `createTestPatientWithBirthDate` helper inline in the test.
4. For the negative-age edge case: set `examDate` to one year before `birthDate` and assert the result is not a negative number.

**Relevant Context:**
- [`api/src/functions/CreateExamination.ts`](api/src/functions/CreateExamination.ts) lines 88–92 (fallback compute).
- [`api/src/functions/UpdateExamination.ts`](api/src/functions/UpdateExamination.ts) lines 98–114 (fallback compute).

---

### TST-11 — Integration Tests: `SearchPatients` — minimum length, Cyrillic, and pagination guards

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

### TST-12 — Unit Tests: `errorHandler` branch coverage

**Status:** [ ] pending

**Intent:** `errorHandler.ts` is imported by every Azure Function and has 10 conditional branches mapping error message strings and `statusCode` properties to HTTP response status codes. It is currently untested. If any branch is modified during refactoring, the wrong HTTP status is silently returned — no integration test would catch this because integration tests don't exercise the error paths in isolation.

**Expected Outcomes:**
- Error with message containing `"Entity not found"` → 404 response.
- Error with message containing `"Entity already exists"` → 409 response.
- Error with message containing `"Concurrency conflict"` → 409 response.
- Error with message containing `"Validation failed"` → 400 response.
- Error with `statusCode: 400` → 400 response.
- Error with `statusCode: 404` → 404 response.
- Error with `statusCode: 412` → 412 response.
- Error with `statusCode: 429` → 429 response.
- Error with `statusCode: 500` → 500 response (maps to `internalServerErrorResponse`).
- Error with `statusCode: 503` → 500 response (same branch as 500 — assert `response.status === 500`).
- Error with no known pattern → 500 response.
- Response body never contains internal error details (stack trace, connection string).

**Todo List:**
1. Create `api/src/tests/utils/errorHandler.test.ts`.
2. No mocks needed — `handleError` is a pure synchronous function (takes an error object and a mock context).
3. Use `mockInvocationContext()` from `testUtils.ts` as the context argument.
4. For each branch: construct an error with the appropriate `message` or `statusCode`, call `handleError`, parse `JSON.parse(response.body)`, assert `response.status` and `body.success === false`.
5. Add test: `{ statusCode: 429 }` → assert `response.status === 429` (rate-limit branch in the `statusCode` switch at [`errorHandler.ts:73`](api/src/utils/errorHandler.ts:73)).
6. Add separate tests for `statusCode: 500` and `statusCode: 503` — both map to status 500 via the combined `case 500: case 503:` fall-through; assert both produce `response.status === 500`.

**Relevant Context:**
- [`api/src/utils/errorHandler.ts`](api/src/utils/errorHandler.ts)
- [`api/src/utils/responseHelpers.ts`](api/src/utils/responseHelpers.ts) — `internalServerErrorResponse`, `errorResponse`.
- Pattern: no Azure mocks needed; pure function test.

---

### TST-13 — Integration Tests: `DeletePatient` cascade and access-control edge cases

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

### TST-14 — Update `TESTING.md` to reflect the completed test suite

**Status:** [ ] pending

**Intent:** `TESTING.md` becomes stale the moment any sub-task from this plan lands. Rather than patching it piecemeal, this final sub-task performs a single comprehensive update after all other sub-tasks are complete.

**Expected Outcomes:**
- Directory listing in `TESTING.md` reflects `users.test.ts` and `auditLogs.test.ts`.
- Line 38: the word `calculate` is removed from the `examinations.test.ts` description (stale since TST-03 deleted `CalculateExamination`).
- Isolation table updated to include `AuditLogs` (all `AUDIT_*` partitions) and the `PATIENT_TOTAL`/`EXAM_TOTAL` counter rows (per TST-00).
- Unit test table updated to include `patientUtils.test.ts`, `auditService.test.ts`, and `errorHandler.test.ts`.

**Todo List:**
1. Update directory listing block in `TESTING.md` under "Directory layout" to add `users.test.ts` and `auditLogs.test.ts`.
2. Update line 38 description for `examinations.test.ts`: remove the word `calculate`.
3. Update the isolation table to add two rows for `AuditLogs` and updated `Counters`.
4. Update the unit test description table to add three new rows.

**Relevant Context:**
- [`api/src/tests/TESTING.md`](api/src/tests/TESTING.md)

---

## Implementation Order

The sub-tasks are designed to be independent. Recommended order for progressive coverage gain:

```
TST-03                              (done — dead code deleted)
TST-00                              (extend cleanupTestData — must run before any integration sub-tasks)
TST-01 → TST-04 → TST-02 → TST-12  (unit tests — no Azurite needed)
TST-05 → TST-06 → TST-07           (extend existing integration suites)
TST-08 → TST-09                    (new integration suites)
TST-10 → TST-11 → TST-13           (specialised integration scenarios)
TST-14                              (documentation update — run last)
```

**Post-refactoring additions (implement after refactoring REF-ST-04 through REF-ST-09 complete):**
```
examinationTypes unit tests         (assert two keys: prenatal, first_trimester; shape and no-duplicates)
examinationSerializer unit tests    (round-trip: serialize→deserialize produces identity for all fetus-array variants)
TST-04 additions                    (validateExamination — examinationType allowlist for new two-value set;
                                     validateExamination — data.fetuses[] schema; RI boundaries already done)
TST-07 additions                    (type filter with new keys; fetuses[] round-trip for prenatal and first_trimester;
                                     unknown examinationType → 400 against new allowlist)
testUtils.ts update                 (createTestExamination must write primaryRowKey onto EXAM entity
                                     once refactoring REF-ST-02 lands)
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
| `cleanupTestData()` is a **complete slate reset** — after TST-00 it sweeps Users, Patients, Examinations, AuditLogs, and all counter rows including `PATIENT_TOTAL` and `EXAM_TOTAL`. Calling it in `beforeEach`/`afterEach` is sufficient; no additional per-suite counter or audit cleanup is needed | `testUtils.ts` (after TST-00) |
| All user fixtures use `@example.com` email addresses (KI-007: Joi rejects non-public TLDs like `@hospital.internal`) | TST-05, TST-08, any inline user body |
| Cross-references to the refactoring plan use the notation **`REF-ST-{n}`** | This plan throughout |

---

## Notes for Agent Mode Implementation

### Email address constraint (KI-007)
`KNOWN-ISSUES.md §KI-007` documents that Joi's email validator rejects non-public TLDs (e.g. `admin@hospital.internal`). All test fixtures that create users via the `register` or `createUser` endpoints **must** use `@example.com` email addresses. This applies especially to TST-05, TST-08, and any helper that constructs a user body inline.

- Each sub-task maps to one file creation or one file extension.
- Start each subtask by re-reading this plan file for full context.
- After completing each subtask, update the Status line from `[ ] pending` to `[x] done`.
- **Do not run tests during planning** — implementation happens in Agent mode after user approval.
