# AGENTS.md

This file provides guidance to agents when working with code in this repository.

- Backend/frontend are separate npm projects; the root PowerShell scripts are the intended local-dev entrypoints: [`start-azurite.ps1`](start-azurite.ps1), [`start-functions.ps1`](start-functions.ps1), [`start-frontend.ps1`](start-frontend.ps1).
- Backend single-test command is `cd api && npm test -- src/tests/utils/validation.test.ts`; Jest roots are [`api/src`](api/src), but coverage explicitly excludes [`api/src/tests/**`](api/src/tests).
- [`api/package.json`](api/package.json) `start` is not a plain runtime start: it runs `prestart` (`clean && build`) before `func start`.
- Azure Functions are only discovered when a file calls [`app.http(...)`](api/src/functions/Login.ts:185); the registration name becomes the function name and routes are usually explicit `v1/...`.
- API responses should go through [`successResponse()`](api/src/utils/responseHelpers.ts:25) / [`errorResponse()`](api/src/utils/responseHelpers.ts:55); they enforce the wrapped payload shape and localhost CORS for `http://127.0.0.1:3000`.
- Auth is cookie-first on the frontend: [`frontend/src/services/api.ts`](frontend/src/services/api.ts) sends `withCredentials`, while backend auth accepts either `Authorization: Bearer` or the `session_token` cookie via [`extractTokenFromRequest()`](api/src/utils/tokenService.ts:73).
- Login lowercases usernames and uses a two-entity lookup in `Users`: `USERNAME/{normalizedUsername}` -> `USER/{userId}`; tests seed both records in [`createTestUser()`](api/src/tests/testUtils.ts:32).
- Patient creation writes two rows into `Patients`: main `PATIENT` and a search row `PATIENT_SEARCH_{firstLetter}` keyed as `${normalizedName}_${patientId}` in [`createPatient()`](api/src/functions/CreatePatient.ts:29).
- Patient rename must keep the search row in sync; [`updatePatient()`](api/src/functions/UpdatePatient.ts:29) deletes the old search entity and creates a new one when normalized name changes.
- Examinations are stored three times in `Examinations`: timeline rows under `PATIENT_{patientId}` with row key `${reverseTicks}_${examinationId}` for descending sort (reverseTicks = `9999999999999 - Date.now()`), direct lookup rows under `EXAM/{examinationId}`, and MRN lookup rows under `MRN/{mrn}` in [`createExamination()`](api/src/functions/CreateExamination.ts:15).
- Table updates rely on optimistic concurrency; [`updateEntity()`](api/src/utils/tableClient.ts:166) requires `entity.etag` and surfaces 412 conflicts.
- Soft delete is the project convention; delete flows set `isDeleted` and timestamps instead of removing rows, even though hard-delete helpers exist in [`api/src/utils/tableClient.ts`](api/src/utils/tableClient.ts).
- Validation is domain-specific: patient age `2-99`, gestational age format `28w 3d`, biometry values are integers, doppler values may be floats.
- Backend TS is intentionally loose: [`api/tsconfig.json`](api/tsconfig.json) uses `strict: false`, `rootDir: "."`, and CommonJS output.
- Frontend dev server must stay on `127.0.0.1:3000`; [`frontend/vite.config.ts`](frontend/vite.config.ts) proxies `/api` to `http://localhost:7071`.
- Frontend service types use `import type` and the codebase prefers single quotes + semicolons; the axios interceptor in [`api.ts`](frontend/src/services/api.ts) unwraps the envelope once so `/v1/auth/login` yields `response.data.user` and `/v1/auth/me` yields `response.data` directly — preserve these endpoint-specific shapes when changing [`authService.ts`](frontend/src/services/authService.ts).
- MRN generation ([`mrnGenerator.ts`](api/src/utils/mrnGenerator.ts)) transliterates Cyrillic patient names (full Bulgarian map) and uses optimistic-concurrency retries (max 5) against a `Counters` table; the format is `MRN-{nameSegment}-{YYYY}-{NNNNNN}`.
- Login brute-force protection: account locks after 5 failed attempts for 30 minutes; the lock state is stored on the `USER` entity, not a separate table.
- Medical terminology may appear in Bulgarian; `УЗД` means ultrasound examination.
