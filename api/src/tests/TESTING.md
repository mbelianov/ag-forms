# Test Infrastructure

This document covers how the test suite is structured, what each part does, and the
decisions made to keep the suite reliable and noise-free.

---

## Quick start

```powershell
# 1. Start Azurite in a separate terminal (keep it running)
../start-azurite.ps1          # Windows PowerShell
# or
../start-azurite.sh           # Linux / macOS

# 2. Run all tests from the api/ directory
npm test
```

That is the only supported way to run the full suite. See the sections below for
detail on what can go wrong if you deviate.

---

## Running the tests

```bash
# From the api/ directory

npm test                    # run all 14 suites (238 tests) — the only reliable full-suite command
npm test -- --verbose       # same, with individual test names printed
npm run test:coverage       # run with coverage report (output → api/coverage/)

# Run a single suite by path
npm test -- src/tests/integration/auth.test.ts
npm test -- src/tests/utils/validation.test.ts
```

> **Prerequisite for integration tests:** Azurite must be running before executing
> any integration suite. Unit tests (`utils/`) do not require Azurite and can be
> run any time.

### Installing Azurite

Azurite ships as an npm package. Install it globally once:

```bash
npm install -g azurite
```

Verify it is on the PATH:

```bash
azurite --version
```

---

## ⚠️ Critical: do not run integration suites separately in parallel

**Never do this:**

```bash
# WRONG — runs three independent Jest processes simultaneously;
# each process runs its own beforeEach/afterEach which deletes shared Azurite data
npm test -- src/tests/integration/auth.test.ts &
npm test -- src/tests/integration/patients.test.ts &
npm test -- src/tests/integration/examinations.test.ts &
```

**Also wrong:**

```bash
# WRONG — passes all suites to Jest but bypasses the maxWorkers:1 configuration
# by spawning them as separate npm calls
```

The test suites share a single Azurite instance. Running them in separate processes
(or with `--runInBand` overriding `maxWorkers`) causes `cleanupTestData()` in one
suite to delete live rows that another suite just created, producing transient
`ResourceNotFound` or `EntityAlreadyExists` errors that are unrelated to the code
under test.

**Always run the full suite with a single `npm test` call from the `api/` directory.**
The `maxWorkers: 1` setting in `jest.config.js` serialises all suites in one process.

If you need to run only one suite while another developer is simultaneously running
their own suite against the same Azurite, each should use a different Azurite
instance or the full `npm test` should be run sequentially.

---

## Directory layout

```
src/tests/
├── TESTING.md                   ← this file
├── testUtils.ts                 ← shared helpers: seed data, cleanup, mocks
├── integration/
│   ├── auth.test.ts             ← register, login, password, lockout
│   ├── patients.test.ts         ← CRUD, search, soft-delete, cascade
│   ├── examinations.test.ts     ← CRUD, MRN, email-report, filters, counts
│   ├── users.test.ts            ← create, update, delete, reset-password (admin lifecycle)
│   └── auditLogs.test.ts        ← list, filter by action, pagination, role enforcement
└── utils/
    ├── authMiddleware.test.ts   ← requireAuth, requireRole, canAccessResource
    ├── counterService.test.ts   ← optimistic-concurrency counter logic
    ├── errorHandler.test.ts     ← all 10 error-mapping branches
    ├── mrnGenerator.test.ts     ← MRN format, Cyrillic transliteration
    ├── passwordService.test.ts  ← hash, verify, strength rules
    ├── patientUtils.test.ts     ← normalizePatientName, getSearchPartitionKey
    ├── auditService.test.ts     ← sanitizeAuditDetails, event dispatch helpers
    ├── tokenService.test.ts     ← generate, verify, refresh, extract
    └── validation.test.ts       ← Joi schemas for all domain types
```

---

## Unit tests (`utils/`)

These tests are fully isolated from Azure — all Table Storage calls are mocked with
`jest.mock(...)`. They run fast and do not need Azurite.

| Suite | What is exercised |
|---|---|
| `validation.test.ts` | Every Joi validation path: patient age bounds, gestational age format, biometry floats, doppler floats, RI ≤ 1, status allowlist, `validateRegister`, `validateUser` fullName, `gestationalAgeIsManual` |
| `tokenService.test.ts` | JWT generation, verification, expiry, cookie extraction, `session_token` cookie, rejection of legacy `token` cookie |
| `authMiddleware.test.ts` | `requireAuth`, `requireRole`, `canAccessResource`, `isAdmin`, `isDoctor`, `isViewer` |
| `passwordService.test.ts` | bcrypt hash/verify, strength rules (upper, lower, digit, special, length), `generateSecurePassword` |
| `mrnGenerator.test.ts` | Latin and Cyrillic (Bulgarian) name normalisation, MRN format `MRN-{name}-{YYYY}-{NNNNNN}`, truncation, counter increment, validate/parse helpers |
| `counterService.test.ts` | Auto-create on first call, increment, decrement, floor-at-zero, 412 retry, exhausted-retry non-fatal path |
| `patientUtils.test.ts` | `normalizePatientName` (whitespace, Cyrillic, case), `getSearchPartitionKey` (Latin, Cyrillic, numeric, empty fallback) |
| `auditService.test.ts` | `sanitizeAuditDetails` redaction (sensitive keys, nested recursion), all 15 event-dispatch helpers action strings, non-fatal path |
| `errorHandler.test.ts` | All 10 conditional branches: message-pattern → status, `statusCode` switch (400/404/412/429/500/503), unknown error → 500, no internal details leaked |

---

## Integration tests (`integration/`)

These tests call the real Azure Function handler functions directly (not via HTTP).
They write to and read from a live Azurite instance and exercise the full
request → Table Storage → response path.

### How they work

Each test file imports handler functions by name:

```ts
import { createExamination } from '../../functions/CreateExamination';
// ...
const response = await createExamination(request, context);
expect(response.status).toBe(201);
```

`mockHttpRequest()` and `mockInvocationContext()` in `testUtils.ts` construct
lightweight stand-ins for the Azure Functions host objects so the handlers can be
called in-process.

### Isolation between tests

Each `describe` block has symmetrical `beforeEach` / `afterEach` hooks that call
`cleanupTestData()`. That function performs a full wipe of every partition written
by the test helpers or the function endpoints:

| Table | Partitions wiped |
|---|---|
| `Users` | `USER`, `USERNAME` |
| `Patients` | `PATIENT`, all `PATIENT_SEARCH_*` buckets |
| `Examinations` | `EXAM`, `MRN`, all `PATIENT_*` timeline rows |
| `Counters` | `MRN_{year}`, `PATIENT_TOTAL`, `EXAM_TOTAL` counter rows |
| `AuditLogs` | all `AUDIT_*` partitions (full sweep) |

> **Why `PATIENT_SEARCH_*` needs a full scan:** Search rows live in separate
> per-character-bucket partitions (e.g. `PATIENT_SEARCH_0074` for `t`). There is no
> single partition key to filter on, so cleanup does a full table scan and deletes
> every row whose `PartitionKey` starts with `PATIENT_SEARCH_`.

> **Why `EXAM` and `PATIENT_*` need a full scan:** Function endpoints that create
> examinations are called in some tests (e.g. `should create examination`). Those
> rows are not tracked by `trackedExaminations`, so they are not removed by the
> tracked-entity loop. The full scan catches them.

### Serial execution (`maxWorkers: 1`)

All suites share the same Azurite instance. If Jest runs two integration suites in
parallel (its default), `cleanupTestData()` in one suite can delete rows that the
other suite just created, causing `ResourceNotFound` or `EntityAlreadyExists` errors
that are unrelated to the code under test.

`maxWorkers: 1` in `jest.config.js` forces suites to run one at a time. This makes
the full run slower (~55 s vs ~15 s) but eliminates all cross-suite data races.
Unit tests are unaffected because they do not touch Azurite.

---

## Test helpers (`testUtils.ts`)

| Export | Purpose |
|---|---|
| `createTestUser(role)` | Writes `USER` + `USERNAME` entities; returns `{ user, token, password }` |
| `createTestPatient()` | Writes `PATIENT` + `PATIENT_SEARCH_*` entities; returns the patient entity |
| `createTestExamination(patientId)` | Writes `PATIENT_*` + `EXAM` + `MRN` entities; returns the examination entity |
| `cleanupTestData()` | Full wipe of all test data — see [Isolation between tests](#isolation-between-tests) |
| `seedCounter(value, year?)` | Upserts the `MRN_{year}` counter row to a known value; used in `beforeEach` to make MRN generation deterministic |
| `mockHttpRequest(method, body?, headers?)` | Returns an `HttpRequest`-shaped object; set `.params` / `.query` on the result for route/query parameters |
| `mockInvocationContext()` | Returns an `InvocationContext`-shaped object with all log methods as `jest.fn()` |
| `mockTableClient()` | Returns a mock Table Storage client (used only in unit tests that wire up their own mocks) |

---

## Jest configuration

### `jest.config.js`

```
preset:           ts-jest          compile TypeScript on the fly via ts-jest
testEnvironment:  node
roots:            src/             only look for tests inside src/
moduleNameMapper  @azure/functions → src/__mocks__/@azure/functions.js
setupFiles:       jest.setup.js    inject env vars before any module loads
maxWorkers:       1                serialise suites to prevent Azurite data races
```

### `jest.setup.js`

Sets the required environment variable before any test module is loaded:

- **`JWT_SECRET`** — required by `tokenService.ts` at module load time; the module
  throws if it is absent. The value used in tests is a fixed test-only string.

### Environment variables used by the integration tests

Integration tests use `UseDevelopmentStorage=true` as the Azure Storage connection
string. This is the default in `tableClient.ts` when
`AZURE_STORAGE_CONNECTION_STRING` is not set in the environment, so no `.env` file
is needed for tests. The Azurite endpoints used are the standard defaults:

| Service | Address |
|---|---|
| Tables | `http://127.0.0.1:10002` |
| Blobs | `http://127.0.0.1:10000` |
| Queues | `http://127.0.0.1:10001` |

---

## Why `@azure/functions` is mocked

When an integration test imports a function file, that file's top-level
`app.http(...)` call executes immediately. The `@azure/functions` SDK's `app.http()`
calls `setProgrammingModel()`, which probes for the Azure Functions host IPC channel.
There is no host during Jest, so the SDK logs:

```
WARNING: Failed to detect the Azure Functions runtime. Switching "@azure/functions"
package to test mode — not all features are supported.
WARNING: Skipping call to register function "CreateExamination" …
```

This repeats once per `app.http()` call — around 30 lines of noise per suite.

Setting `FUNCTIONS_WORKER_RUNTIME` has no effect because the SDK does not check that
variable; it exclusively probes the IPC channel.

**The fix** is `src/__mocks__/@azure/functions.js`, mapped in `jest.config.js` via
`moduleNameMapper`. It re-exports every real symbol from the package (`HttpRequest`,
`InvocationContext`, `HttpResponse`, …) but replaces `app` with a `Proxy` whose every
property returns a no-op function. The handler functions under test (`createExamination`,
`login`, etc.) are plain `async` functions and are completely unaffected — the routing
registration and the handler implementation are separate concerns.

---

## Known non-fatal console output

**`auditService.test.ts`** — the non-fatal path test calls `logUserLogout` after
mocking `createEntity` to throw. The `logAuditEvent` catch block calls
`console.error('Failed to log audit event: boom')` because no context object is
provided. This line appears in the Jest output under `● Console` but is expected
and harmless — it confirms the non-fatal behaviour is working correctly.

**`counterService.test.ts`** — the `all retries fail — resolves without throwing`
test passes a `{ error: jest.fn() }` context, so the expected error log is captured
by the mock and never reaches `console.error`. If a production caller invokes
`adjustCounter` in a fire-and-forget `.catch()` without a context, the exhausted-retry
error falls through to `console.error` — intentional production behaviour, not a
test defect.

---

## Diagnosing failures

### `ResourceNotFound` or `EntityAlreadyExists` in integration tests

**Cause:** Two Jest processes sharing the same Azurite instance ran simultaneously.
The `cleanupTestData()` call in one process deleted rows that the other process had
just written.

**Fix:** Run `npm test` (not separate per-suite invocations). Confirm that
`maxWorkers: 1` is present in `jest.config.js` and has not been overridden with
`--maxWorkers` or `--runInBand` on the CLI.

### `ECONNREFUSED 127.0.0.1:10002`

**Cause:** Azurite is not running.

**Fix:** Start Azurite in a separate terminal and keep it running for the duration
of the test session:

```powershell
../start-azurite.ps1     # Windows
../start-azurite.sh      # Linux / macOS
```

### `Error: JWT_SECRET environment variable is not set`

**Cause:** `jest.setup.js` was not loaded (e.g. Jest was invoked directly with
`npx jest` bypassing the project config, or `jest.config.js` was modified).

**Fix:** Always invoke tests via `npm test` from the `api/` directory so that
`jest.config.js` and its `setupFiles` entry are respected.

### Tests pass individually but fail when run together

**Cause:** Same as `ResourceNotFound` above — parallel suite execution.

**Fix:** `npm test` with `maxWorkers: 1`. Never invoke multiple `npm test --` calls
in separate terminals against the same Azurite instance.

---

## Adding a new test

### Unit test

1. Create `src/tests/utils/<utility>.test.ts`.
2. Declare globals at the top: `declare const jest: any; declare const describe: any;` etc.
3. Mock Table Storage before imports: `jest.mock('../../utils/tableClient', () => ({ ... }))`.
4. Import the function under test after the mock declaration.
5. No Azurite required.

### Integration test

1. Create `src/tests/integration/<domain>.test.ts`.
2. Declare globals at the top: `declare const describe: any;` etc.
3. Import handler functions directly from `../../functions/<FunctionName>`.
4. Use `createTestUser`, `createTestPatient`, `createTestExamination` to seed data.
5. Call handlers with `mockHttpRequest` + `mockInvocationContext`.
6. Add symmetrical `beforeEach` / `afterEach` hooks both calling `cleanupTestData()`.
7. Use `@example.com` email addresses in all user fixtures (KI-007: Joi rejects
   non-public TLDs such as `@hospital.internal`).

> Do **not** assert on `app.http` registration — it is a no-op in tests and not
> part of any observable behaviour under Jest.
