# Test Infrastructure

This document covers how the test suite is structured, what each part does, and the
decisions made to keep the suite reliable and noise-free.

---

## Running the tests

```bash
# From the api/ directory

npm test                  # run all suites once
npm test -- --verbose     # show individual test names
npm run test:coverage     # run with coverage report (output → api/coverage/)

# Run a single suite
npm test -- src/tests/integration/auth.test.ts
npm test -- src/tests/utils/validation.test.ts
```

> **Prerequisite for integration tests:** Azurite must be running before executing
> the integration suites. Start it with `../start-azurite.ps1` (Windows) or
> `../start-azurite.sh` (Linux/macOS). Unit tests (`utils/`) do not require Azurite.

---

## Directory layout

```
src/tests/
├── TESTING.md                   ← this file
├── testUtils.ts                 ← shared helpers: seed data, cleanup, mocks
├── integration/
│   ├── auth.test.ts             ← register, login, password, lockout
│   ├── patients.test.ts         ← CRUD, search, soft-delete, cascade
│   └── examinations.test.ts    ← CRUD, MRN, calculate, email-report
└── utils/
    ├── authMiddleware.test.ts   ← requireAuth, requireRole, canAccessResource
    ├── counterService.test.ts   ← optimistic-concurrency counter logic
    ├── mrnGenerator.test.ts     ← MRN format, Cyrillic transliteration
    ├── passwordService.test.ts  ← hash, verify, strength rules
    ├── tokenService.test.ts     ← generate, verify, refresh, extract
    └── validation.test.ts       ← Joi schemas for all domain types
```

---

## Unit tests (`utils/`)

These tests are fully isolated from Azure — all Table Storage calls are mocked with
`jest.mock(...)`. They run fast and do not need Azurite.

| Suite | What is exercised |
|---|---|
| `validation.test.ts` | Every Joi validation path: patient age bounds, gestational age format, biometry integer-only, doppler floats, RI ≤ 1, status allowlist |
| `tokenService.test.ts` | JWT generation, verification, expiry, cookie extraction, `session_token` cookie, rejection of legacy `token` cookie |
| `authMiddleware.test.ts` | `requireAuth`, `requireRole`, `canAccessResource`, `isAdmin`, `isDoctor`, `isViewer` |
| `passwordService.test.ts` | bcrypt hash/verify, strength rules (upper, lower, digit, special, length), `generateSecurePassword` |
| `mrnGenerator.test.ts` | Latin and Cyrillic (Bulgarian) name normalisation, MRN format `MRN-{name}-{YYYY}-{NNNNNN}`, truncation, counter increment, validate/parse helpers |
| `counterService.test.ts` | Auto-create on first call, increment, decrement, floor-at-zero, 412 retry, exhausted-retry non-fatal path |

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
| `Counters` | `MRN_{year}` counter row |

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
the full run slower (~24 s vs ~11 s) but eliminates all cross-suite data races.
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

Sets two environment variables before any test module is loaded:

- **`JWT_SECRET`** — required by `tokenService.ts` at module load time; the module
  throws if it is absent. The value used in tests is a fixed string (not a secret).
- **`FUNCTIONS_WORKER_RUNTIME`** — present for completeness; does not suppress the
  Azure Functions SDK warnings on its own (see below).

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

The `counterService` test `all retries fail — resolves without throwing` passes a
`{ error: jest.fn() }` context object, so the expected error log is captured by the
mock and never reaches `console.error`. If a test calls `adjustCounter` without a
context (as production callers do in some fire-and-forget `.catch()` paths), any
exhausted-retry error will fall through to `console.error` — this is intentional
production behaviour, not a test defect.

---

## Adding a new test

### Unit test

1. Create `src/tests/utils/<utility>.test.ts`.
2. Mock Table Storage at the top: `jest.mock('../../utils/tableClient', () => ({ ... }))`.
3. Import the function under test after the mock declaration.
4. No Azurite required.

### Integration test

1. Create `src/tests/integration/<domain>.test.ts`.
2. Import handler functions directly from `../../functions/<FunctionName>`.
3. Use `createTestUser`, `createTestPatient`, `createTestExamination` to seed data.
4. Call handlers with `mockHttpRequest` + `mockInvocationContext`.
5. Add `beforeEach` / `afterEach` with `cleanupTestData()`.
6. Ensure Azurite is running before the test run.

> Do **not** assert on `app.http` registration — it is a no-op in tests and not
> part of any observable behaviour under Jest.
