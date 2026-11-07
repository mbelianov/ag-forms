# Send by Email — Implementation Plan

Specification: [`send-by-email-req-spec.md`](send-by-email-req-spec.md) (approved). NFR-03 result: [`smtp-hosting-check-plan.md`](smtp-hosting-check-plan.md).

## Overview

A doctor emails the PDF of an examination to the patient through the doctor's own mailbox (Google, Yahoo or generic SMTP, app password). The work has two halves:

1. **Provider settings** — each doctor stores one SMTP connection in the `Users` table (`EMAIL_PROVIDER/{userId}`). Only the password is encrypted (AES-256-GCM, per-doctor key via HKDF-SHA256, connection fields bound as authenticated data, master key from `EMAIL_CREDENTIALS_ENCRYPTION_KEY`).
2. **Sending** — the existing simulated endpoint `POST /v1/examinations/{id}/email-report` is reworked to send for real with Nodemailer, with a confirmation dialog, recipient override, audit and structured error codes.

Out of scope by stakeholder decision (spec A-08): rate limiting (real use is at most about 10 emails per hour per doctor) and the hosting request-size check NFR-04 (PDFs are below 500 KB). The 10 MB decoded PDF cap stays as an abuse guard.

Sub-tasks are ordered so that each one is independently reviewable and leaves the build and tests green. The agent implementing a sub-task must read this file and the specification first, update the status here when done, and add notes for the next sub-task under "Notes for next sub-task".

Conventions to respect (from `AGENTS.md`): backend TS is loose (`strict: false`, CommonJS); frontend uses single quotes, semicolons and `import type`; responses go through `successResponse` / `errorResponse`; ETag travels in the request body; soft delete is the convention; no secrets in code, logs or audit; generic errors to clients; new dependencies must be the latest stable, maintained, licence-compatible and free of known CVEs.

---

## Sub-task 0 — Housekeeping and design decisions

**Intent**
Settle the small cross-cutting decisions that several later sub-tasks depend on, and put the docs under version control.

**Expected Outcomes**
- Decisions below are recorded in this file under "Decisions".
- Spec and plan documents are committed on `feature/email`.

**Todo List**
1. Commit `docs2/send-by-email-req-spec.md`, `docs2/smtp-hosting-check-plan.md` and this plan on `feature/email`.
2. Record the decisions:
   - **Error-code mechanism**: `errorResponse` always sets `error.code = 'ERROR'`. Add an optional code parameter (backward compatible) so spec codes (`EMAIL_PROVIDER_NOT_CONFIGURED`, `EMAIL_AUTH_FAILED`, `EMAIL_CONNECTION_FAILED`, `EMAIL_REJECTED`) reach the client; frontend keeps reading `error.message` and additionally reads `error.code`.
   - **Audit field naming**: the audit sanitizer redacts any key containing `password`, `secret` or `token`; the spec field `secretChanged` is therefore renamed `credentialsReplaced`. Note that spec item E-07 overstates the sanitizer (it compares lowercased keys against mixed-case entries); do not rely on it for new fields — never pass secrets to audit at all.
3. Confirm `local.settings.json` is git-ignored (verified: root `.gitignore` line 90 and `api/.gitignore` line 25). If it was ever committed, flag it to the user.

**Relevant Context**
- `api/src/shared/http/responseHelpers.ts`, `api/src/shared/http/errorHandler.ts`
- `api/src/shared/audit/auditService.ts`

**Status**: `[x] done`

---

## Sub-task 1 — Backend foundation: types, crypto, validation, SSRF guard

**Intent**
Build the pure, easily unit-tested building blocks without touching HTTP or storage.

**Expected Outcomes**
- Types for the provider entity, API payloads and presets.
- A crypto module that encrypts and decrypts the SMTP password per spec section 7.3 (HKDF-SHA256 per-save key, random salt and IV, AAD bound to `userId`, `provider`, `host`, `port`, `security`, `username`, key versioning with a previous-key fallback).
- Joi schemas for provider settings and for the send request, using allow-lists.
- A host guard that rejects loopback, private, link-local and metadata addresses (resolve the host, check every address, and connect to the resolved IP).
- Unit tests for all of the above, including tamper detection (changing any AAD field fails decryption) and key rotation.

**Todo List**
1. Add types to `api/src/types/index.ts`.
2. Create `api/src/shared/email/` with: presets (Google, Yahoo, Generic), crypto, host guard.
3. Add the master-key loader: `EMAIL_CREDENTIALS_ENCRYPTION_KEY` (64 hex chars) with **no fallback**, optional `EMAIL_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS`; fail with a generic error and a server-side log that contains no key material.
4. Add Joi schemas next to existing validation (`api/src/shared/validation/validation.ts`): host, port, security mode (STARTTLS or implicit TLS only), username, password, footer (max 500), recipient email, subject (200), message (2000), file name, base64 PDF.
5. Write unit tests under `api/src/tests/utils/`.

**Relevant Context**
- Spec sections 7.3, 7.3d, 10, 13
- Node built-in `crypto` only (no custom algorithms)
- `api/src/shared/validation/validation.ts`, `api/src/tests/utils/*.test.ts` for test style

**Status**: `[x] done`

---

## Sub-task 2 — Provider settings storage and API

**Intent**
Let a doctor save, read, delete and test their own mail provider settings.

**Expected Outcomes**
- `GET`, `PUT`, `DELETE /v1/profile/email-provider` act on the authenticated user only; GET never returns the password or any ciphertext field.
- PUT with an empty password keeps the stored secret; if a bound connection field changed, the secret is decrypted with the old values and re-encrypted with the new ones in one write (7.3d).
- Updates use the ETag from the request body (optimistic concurrency).
- Roles: doctor and admin allowed, viewer rejected with 403.
- Audit events `EMAIL_PROVIDER_SAVED` and `EMAIL_PROVIDER_DELETED` written without secrets.
- Deleting a user hard-deletes their `EMAIL_PROVIDER/{userId}` row.
- Integration tests pass and test cleanup sweeps the new partition.

**Todo List**
1. Add the optional error-code parameter to `errorResponse` (decision from sub-task 0) and cover it with tests.
2. Implement the three handlers under `api/src/functions/profile/` and register them with `app.http` using explicit `v1/...` routes.
3. Add audit helpers in `auditService.ts` and extend its tests for the new action strings.
4. Add the purge to `DeleteUser.ts` inside its existing try/catch pattern.
5. Extend `cleanupTestData()` in `api/src/tests/testUtils.ts` to sweep `EMAIL_PROVIDER`.
6. Write integration tests (needs Azurite; `maxWorkers: 1`): happy path, viewer 403, unauthenticated 401, partial update, connection-field change with empty password, wrong ETag, SSRF host rejection, response never contains secret fields.

**Relevant Context**
- `api/src/shared/storage/tableClient.ts` (`getEntity`, `createEntity`, `updateEntity` requires `etag`, `upsertEntity`)
- `api/src/shared/auth/authMiddleware.ts` (`requireAuth` is synchronous; `requireRole`)
- `api/src/functions/users/DeleteUser.ts`
- `api/src/tests/testUtils.ts`, `api/src/tests/TESTING.md`

**Status**: `[x] done`

---

## Sub-task 3 — Mail transport wrapper and test-email endpoint

**Intent**
Add Nodemailer behind a small injectable wrapper, and expose `POST /v1/profile/email-provider/test` so a doctor can verify settings before sending a report.

**Expected Outcomes**
- Nodemailer and `@types/nodemailer` added at the latest stable versions after the NFR-02 check (maintenance, licence, CVEs) — result noted in this file.
- Transport rules: STARTTLS uses `requireTLS`; implicit TLS uses `secure`; `minVersion` TLSv1.2; certificate validation always on; 10 s connect and 30 s total timeouts; host guard re-checked at send time.
- Provider failures are mapped to `EMAIL_AUTH_FAILED`, `EMAIL_CONNECTION_FAILED`, `EMAIL_REJECTED` with generic client messages; details only in server logs, with no credentials.
- Test endpoint sends a short message to the doctor's own address and writes an `EMAIL_PROVIDER_TEST` audit event.
- Tests use an injected fake transport (no network).

**Todo List**
1. Run the NFR-02 package check and install.
2. Implement the wrapper in `api/src/shared/email/` with an injectable factory.
3. Implement the test endpoint and its audit helper.
4. Unit tests for error mapping and option building; integration tests with the fake transport.

**Relevant Context**
- Spec sections on transport and error codes; NFR-02, NFR-03
- Hosting check: ports 587, 465 and 25 reachable from SWA managed functions with TLS 1.3; authentication and delivery to custom hosts were **not** verified
- `api/package.json`

**NFR-02 package check (2026-11-07)**

| Check | `nodemailer` 10.3.1 | `@types/nodemailer` 8.0.2 |
|---|---|---|
| Latest stable | `npm view` dist-tag `latest` = 10.3.1 (published 2026-10-29) | latest = 8.0.2 (2026-10-04), not deprecated |
| Maintenance | Repository `nodemailer/nodemailer`; releases every few days to weeks since 10.0.0 on 2026-09-04 (29 releases), latest 9 days ago | DefinitelyTyped, updated 2026-10-04 |
| Licence | MIT-0 (permissive, compatible) | MIT |
| Runtime | Node `>=20`; project runs Node 22; no runtime dependencies added | peer: `@types/node` only |
| Known CVEs | `npm audit`: nodemailer not flagged | not flagged |

Installed in `api/` as `"nodemailer": "^10.3.1"` and `"@types/nodemailer": "^8.0.2"` (lock file updated). No other new dependency.

**`npm audit` baseline:** 18 vulnerabilities (7 low, 4 moderate, 6 high, 1 critical) both **before** (lock file at `HEAD`) and **after** this sub-task, so none is introduced here. All are in existing packages (`joi` ≤17.13.8, `@azure/identity`/`@azure/msal-node`, `handlebars`, `brace-expansion`, `browserslist`, `js-yaml`, `minimatch`/`glob`/`rimraf`, `deepmerge` via `jest`/`ts-jest`, `baseline-browser-mapping`). `joi` and `@azure/identity` are runtime dependencies and should be upgraded in a separate dependency-maintenance task (`npm audit fix` is available for most; the `jest`/`rimraf` ones need `--force` breaking changes). They were not changed here to keep this sub-task minimal and reviewable.

**Status**: `[x] done`

---

## Sub-task 4 — Rework the email-report endpoint

**Intent**
Replace the simulation in `EmailExaminationReport.ts` with real sending using the new contract.

**Expected Outcomes**
- Body: `recipient_email` (optional), `subject`, `message`, `file_name`, `pdf_base64`. Recipient defaults to the patient's profile email; an override is used for that send only and never saved to the patient.
- Validation: decoded PDF at most 10 MB and starts with `%PDF-`; subject at most 200, message at most 2000; single recipient only.
- Doctor/admin only; examination must exist and not be soft-deleted; any examination status is allowed.
- Footer from the doctor's profile appended to the message.
- No provider configured returns `EMAIL_PROVIDER_NOT_CONFIGURED`.
- Success returns 202 with `delivery_status: "accepted"`.
- Audit: extended `EXAMINATION_EMAIL_SENT` (`patientProfileEmail`, `recipientOverridden`, `examinationStatus`) and new `EXAMINATION_EMAIL_FAILED`.
- Existing simulation test in `examinations.test.ts` updated; new tests added.

**Todo List**
1. Rewrite the handler: auth, role, load examination and patient, resolve recipient, validate, check provider, decrypt, send, audit, respond.
3. Extend audit helpers and tests (existing helper `logExaminationEmailSent` at `auditService.ts:283`).
3. Update and extend integration tests: success, override, no provider, invalid PDF, oversize, viewer 403, deleted examination 404, provider failure mapping.

**Relevant Context**
- `api/src/functions/system/EmailExaminationReport.ts` (current body `{pdfData, recipientEmail}` does not match what the frontend sends)
- `api/src/constants/examinationTypes.ts` (exam type label for the default subject)
- `api/src/tests/integration/examinations.test.ts`

**Status**: `[x] done`

---

## Sub-task 5 — Frontend: Email Settings page

**Intent**
Give doctors a page to manage their provider settings.

**Expected Outcomes**
- New service for the four profile endpoints, following the existing service pattern (envelope already unwrapped by the interceptor; ETag in body).
- Email Settings page (Carbon): provider preset selector, host/port/security, username, password (write-only, never displayed), footer, save, delete, "Send test email"; notifications through `useAutoNotification`.
- Route registered in `App.tsx`; entry added to the user menu in `Layout.tsx`.
- Access limited to doctor and admin (viewer cannot reach the page or see the menu entry).
- Frontend tests, lint and build pass.

**Todo List**
1. Add types and service.
2. Extend `ProtectedRoute` to accept a list of allowed roles (currently only a single `requiredRole`), or add an in-page guard — choose the smaller change.
3. Build the page, modelled on `ChangePasswordPage.tsx`.
4. Add route and menu entry; error mapping for the new error codes.
5. Add tests; run `npm test`, `npm run lint`, `npm run build` in `frontend/`.

**Relevant Context**
- `frontend/src/features/auth/ChangePasswordPage.tsx`, `frontend/src/components/Layout.tsx`, `frontend/src/components/ProtectedRoute.tsx`, `frontend/src/App.tsx`
- `frontend/src/services/api.ts`, `patientService.ts`
- Carbon design guidance in `.bob/skills/carbon-design-system`

**Decisions and results (2026-11-07)**
- Route guard: `ProtectedRoute` got an optional `allowedRoles` list (3 lines; `requiredRole` is unchanged). Chosen over an in-page guard because the route stays declarative and the redirect behaviour is the same as for admin pages. Route `/email-settings` uses `allowedRoles={['doctor', 'admin']}`.
- New frontend test dependencies (devDependencies only, latest stable, MIT, Node 22 compatible): `jsdom@31.0.0`, `@testing-library/react@16.3.3`, `@testing-library/dom@10.4.2`. No runtime dependency added. `npm audit` total in `frontend/` is 26 both before and after (none from the new packages). Component tests opt in to jsdom per file with `// @vitest-environment jsdom`; `vite.config.ts` is unchanged, so the existing node-environment tests are not affected.
- Route is `/email-settings` (not `/profile` from spec 1.1): the page is a single section, so no wider Profile page was built.

**Status**: `[x] done`

---

## Sub-task 6 — Frontend: rework `EmailReportButton`

**Intent**
Make the button usable end to end with the new contract and the confirmation requirement.

**Expected Outcomes**
- Recipient pre-filled from the patient's profile email and editable; a visible note when it differs from the profile ("used for this send only").
- Default subject `Examination report — {exam type} — {exam date}` without patient name or MRN.
- Confirmation dialog with a "Confirm and send" button; warning for draft examinations.
- Request body uses `recipient_email`, `subject`, `message`, `file_name`, `pdf_base64`.
- Provider-not-configured state links to Email Settings; error codes mapped to clear messages.
- Success text: "Report accepted for delivery to {address}".
- Hidden or disabled for viewers.
- Tests, lint and build pass.

**Todo List**
1. Update the examination service call and types.
2. Rework the component and its dialog flow.
3. Check how `ExaminationDetailPage.tsx` provides the patient and examination data and the PDF generation in `printService.ts`.
4. Add component tests; run frontend checks.

**Relevant Context**
- `frontend/src/reports/EmailReportButton.tsx` (hard-coded subject with patient name, empty recipient, "Send Report" / "Report sent" texts)
- `frontend/src/reports/printService.ts`
- `frontend/src/features/examinations/ExaminationDetailPage.tsx`

**Decisions and results (2026-11-07)**
- New service method `examinationService.emailReport(id, body)` (`frontend/src/services/examinationService.ts`) with types `EmailReportRequest` / `EmailReportResponse` in `frontend/src/types/index.ts`. The thrown error keeps the axios error as `cause`, so `getEmailErrorMessage()` maps the REQ-EML-05 codes. `EmailReportButton` no longer imports `api` directly.
- `ExaminationDetailPage.tsx` needed **no change**: the button still receives `examination` only and is already gated by `canEdit` (admin/doctor). The component also returns `null` for other roles (defence in depth) and loads the patient itself via `patientService.getPatient(examination.patientId)` when the dialog opens, in parallel with `emailProviderService.getProvider()`.
- `recipient_email` is sent **only when it differs from the patient's profile email** (case-insensitive) or the patient has none. This keeps the server-side `recipientOverridden` audit flag truthful: re-typing the profile address is not an override. `message` is omitted when empty.
- Subject default is built from `getExamTypeLabel()` and the first 10 chars of `examDate`, same format as the server. Attachment name `{mrn}_{examDate}.pdf` is sent explicitly as `file_name`.
- Recipient validation is client-side convenience only (single address, no whitespace, `,`, `;`, `<`, `>`); the server remains authoritative.
- Carbon `InlineNotification` throws on interactive children, so the "Go to Email Settings" link is rendered directly below the not-configured notification, not inside it. `EMAIL_PROVIDER_NOT_CONFIGURED` returned by the send call also switches the dialog to that state.
- After success the dialog auto-closes through `useAutoNotification` (5 s, stable `closeDialog`); the primary button stays disabled meanwhile so a second send is impossible. The Modal always sets `preventCloseOnClickOutside` (Carbon warns otherwise for transactional modals); closing via Cancel/X is blocked while sending.
- Tests: `frontend/src/reports/EmailReportButton.test.tsx` (30 tests, jsdom opt-in, services mocked). Validation from `frontend/`: `npm test` 11 files / 125 tests, `npm run lint` and `npm run build` green (the >500 kB chunk warning is pre-existing). No new dependency.
- Side effect to know: `npm test` rewrites `docs2/conformance-results.csv/.txt` (conformance test output); they were restored with `git checkout` and are not part of this change.

**Status**: `[x] done`

---

## Sub-task 7 — Configuration and documentation

**Intent**
Make the feature deployable and keep the documentation truthful.

**Expected Outcomes**
- `local.settings.json` example (without real secrets) and README/deployment docs list `EMAIL_CREDENTIALS_ENCRYPTION_KEY` (generation command, no fallback, rotation with `_PREVIOUS` and `keyVersion`).
- Instruction to set the variable in the Azure portal before release (preview and production share app settings).
- Docs reconciled with the implementation: `04-api-specification.md`, `TEST-CASES.md`, `03-security-architecture.md`, `KNOWN-ISSUES.md` (known limitations from spec section 13).
- `05-deployment-guide.md` corrected: production runs the API as SWA managed functions (`api_location: api`, Node 22), not a separate Function App.

**Todo List**
1. Update the files above.
2. Add a short user-facing description of setting up Gmail/Yahoo app passwords where the docs fit.
3. Run the full backend and frontend test suites once more.

**Relevant Context**
- `.github/workflows/deploy-production.yml`, `deploy-preview.yml`, `README-SWA.md`
- Spec sections 13 and 14

**Status**: `[x] done`

---

## Sub-task 8 — Hosted end-to-end verification

**Intent**
Verify what the NFR-03 check could not: authentication, real delivery and the full flow on hosting.

**Expected Outcomes**
- Real message delivered to a test mailbox through Google and Yahoo app passwords, with the PDF attached and the footer present.
- A typical real examination PDF (below 500 KB) passes through the SWA proxy.
- Confirmed that a custom Generic host works, or the limitation is documented.
- Results recorded in the spec section 14.

**Todo List**
1. Use dedicated test mailboxes and a test doctor account only. Previews share production storage and app settings, so no real doctors' secrets or real patient data may be used there.
2. Set the encryption key in the target environment first.
3. Run the scenarios: save settings, test email, send report, override recipient, wrong password.
4. Record findings; open issues for anything that fails.

**Relevant Context**
- `docs2/smtp-hosting-check-plan.md` (preview deployment approach); `gh` CLI for PRs

**Status**: `[ ] pending`

---

## Decisions

Recorded in sub-task 0. No code was changed for these; they are implemented in the sub-tasks named below.

| # | Decision | Implemented in |
|---|---|---|
| DEC-01 | **Error-code mechanism.** `errorResponse` currently always sets `error.code = 'ERROR'`. It gets an optional trailing code parameter (backward compatible: existing callers are unchanged). Spec codes `EMAIL_PROVIDER_NOT_CONFIGURED`, `EMAIL_AUTH_FAILED`, `EMAIL_CONNECTION_FAILED`, `EMAIL_REJECTED` reach the client through it. The frontend keeps reading `error.message` and additionally reads `error.code`. | Sub-task 2 (parameter), 3–4 (use), 5–6 (frontend) |
| DEC-02 | **Audit field naming.** `EMAIL_PROVIDER_SAVED` uses `credentialsReplaced: boolean` instead of `secretChanged` (the sanitiser redacts keys containing `password`, `secret`, `token`). The spec (REQ-EML-06) has been updated accordingly. Spec item E-07 overstates the sanitiser (lowercased keys are compared with mixed-case entries); do not rely on it for new fields — never pass secrets to audit at all. | Sub-task 2 |
| DEC-03 | **No rate-limit store.** No rate limiting and no persistence for it (spec A-08, TC-EMAIL-021 removed). | n/a |
| DEC-04 | **No NFR-04 request-size check.** Only the 10 MB decoded PDF cap stays, as an abuse guard (spec A-08). | n/a |

## Notes for next sub-task

**From sub-task 0 (for sub-task 1):**
- Docs commit `f82f80f` on `feature/email` (spec, plan, hosting-check plan). Not pushed. Git prints LF→CRLF warnings on stderr; harmless.
- `local.settings.json` was never committed: `git log --all -- api/local.settings.json` is empty and `git check-ignore -v` confirms `api/.gitignore:25`. Only `api/local.settings.json.example` is tracked (currently has no email variables; sub-task 7 adds `EMAIL_CREDENTIALS_ENCRYPTION_KEY`).
- Sub-task 1 needs no `errorResponse` change. When it is made (sub-task 2), the new code goes in as an optional **4th** parameter after `details` in `api/src/shared/http/responseHelpers.ts:56` (`message, statusCode = 400, details?, code = 'ERROR'`), so existing callers stay unchanged.
- Use the audit field name `credentialsReplaced` (not `secretChanged`) everywhere; never pass secret material to audit.
- Do not add any rate-limit or request-size-check code (DEC-03, DEC-04).
- Sub-task 1 must have its own env var handling for `EMAIL_CREDENTIALS_ENCRYPTION_KEY` in tests (set it in the test setup, not in a committed file with a real key).
- Plan and spec edits made in sub-task 0 (Decisions table, status, `credentialsReplaced`) are uncommitted at the time of writing; the user decides whether to commit them.

**From sub-task 1 (for sub-task 2):**
- Foundation completed and all 18 test suites passing.
- Building blocks available in `api/src/shared/email/`:
  - `encryptSecret(secret, aad, keyVersion?)` and `decryptSecret(encrypted, aad)` with HKDF-SHA256, AES-256-GCM, AAD binding (`userId`, `provider`, `host`, `port`, `security`, `username`), and previous key fallback.
  - `loadMasterKey()` enforces 64 hex chars with no fallback.
  - `EMAIL_PRESETS`, `getProviderPreset()`, `resolveProviderConnection()` and `DEFAULT_EMAIL_FOOTER`.
  - `validateHost(host, lookupFn?)` and `isPrivateOrBlockedIp(ip)` for SSRF protection against loopback, private (RFC 1918), link-local (169.254.x.x/metadata), CGNAT, multicast, and ULA IPv6.
- Validation available in `api/src/shared/validation/validation.ts`:
  - `validateEmailProvider(data)` and `validateEmailReport(data)`.
- Types exported from `api/src/types/index.ts`:
  - `EmailProviderSettings`, `EmailProviderDto`, `EmailProviderUpdateRequest`, `EmailReportRequest`, `EmailReportResponse`, `EmailProviderPreset`, `EmailProviderType`, `EmailSecurityMode`.
- Remember to implement DEC-01 in sub-task 2: add optional 4th `code = 'ERROR'` parameter to `errorResponse(message, statusCode = 400, details?, code = 'ERROR')` in `api/src/shared/http/responseHelpers.ts`.
- When updating with an empty password and changed connection fields (7.3d), decrypt using stored old connection fields as AAD and re-encrypt with the new connection fields.

**From sub-task 2 (for sub-task 3):**
- Sub-task 2 done: `npm run build` clean; `npm test` 20 suites / 363 tests green (Azurite running). `console.error` output in test logs comes from intentional decryption-failure tests only.
- DEC-01 implemented: `errorResponse(message, statusCode = 400, details?, code = 'ERROR')` in `api/src/shared/http/responseHelpers.ts`. Use e.g. `errorResponse('...', 502, undefined, 'EMAIL_AUTH_FAILED')`. Tests in `api/src/tests/utils/responseHelpers.test.ts`.
- New handlers in `api/src/functions/profile/`: `GetEmailProvider.ts` (`getEmailProvider`), `SaveEmailProvider.ts` (`saveEmailProvider`, PUT), `DeleteEmailProvider.ts` (`deleteEmailProvider`). All on route `v1/profile/email-provider`, registered with `app.http`. Add `TestEmailProvider.ts` here for `v1/profile/email-provider/test`.
- New shared module `api/src/shared/email/providerDto.ts` (re-exported from `index.ts`): `EMAIL_PROVIDER_PARTITION`, `USERS_TABLE`, and `toEmailProviderDto(entity)` (explicit allow-list; use it for any response that returns settings). `toEmailProviderDto` already maps `lastTestedAt` / `lastTestStatus` to `last_tested_at` / `last_test_status`.
- Role/auth pattern used: `requireAuth(request)` (synchronous) then `requireRole(user, ['doctor', 'admin'])`; 401 `Authentication required`, 403 `Doctor or admin role required`. PUT checks `loadMasterKey('current')` first and returns a generic 500 `Email settings are temporarily unavailable` (no key name in the message). The test endpoint should fail closed the same way.
- Row layout in `Users`: `PartitionKey = EMAIL_PROVIDER`, `RowKey = userId`; fields as in `EmailProviderSettings`. Read with `getEntity<EmailProviderSettings>(USERS_TABLE, EMAIL_PROVIDER_PARTITION, user.userId)`.
- To decrypt in the test endpoint, build the AAD from the **stored row** (never the request): `{ userId: user.userId, provider: row.provider, host: row.host, port: Number(row.port), security: row.security, username: row.username }` and call `decryptSecret(row, aad)`. It returns `{ plaintext, keyRotated }`; when `keyRotated` is true, re-encrypt with `encryptSecret` and write back (spec 7.3b: "after a successful send or test"). `SaveEmailProvider` already re-encrypts on save when `keyRotated` is true.
- Test endpoint must persist `lastTestedAt` and `lastTestStatus` on the row using `updateEntity` (needs the row's `etag`; handle `Concurrency conflict`). `SaveEmailProvider` clears both fields (sets `''`) when the connection fields or the password change, and `toEmailProviderDto` turns empty strings into `undefined`.
- SSRF: `SaveEmailProvider` runs `validateHost` for `provider === 'generic'` only and returns `validationErrorResponse(['Host is not allowed'])` (no resolved address in the message). The send/test path must call `validateHost` again and connect to the resolved IP (spec 7.3 / plan sub-task 3).
- Audit helpers added in `auditService.ts`: `logEmailProviderSaved(userId, username, { provider, host, port, security, username, fromEmail, credentialsReplaced })` and `logEmailProviderDeleted(userId, username, provider)`. Add `logEmailProviderTest(userId, username, result)` next to them; pass only the result string / failure code, never provider messages.
- `DeleteUser.ts` hard-deletes `EMAIL_PROVIDER/{userId}` (non-fatal try/catch). `cleanupTestData()` in `testUtils.ts` sweeps the `EMAIL_PROVIDER` partition. Integration tests: `api/src/tests/integration/emailProvider.test.ts` (sets `EMAIL_CREDENTIALS_ENCRYPTION_KEY` itself in `beforeEach` and restores it in `afterAll`; no key is committed). Use `genericBody()` with host `8.8.8.8` there to pass the SSRF guard without DNS.
- Behaviour to know: stale or bogus ETag on PUT returns 409 (via `conflictResponse`); unknown ETag format also maps to 409. DELETE is idempotent (200 when nothing stored) and writes the audit event only when a row existed. GET never returns 404.
- Nothing in sub-task 2 touches Nodemailer or `/test`; `api/package.json` is unchanged.

**From sub-task 3 (for sub-task 4):**
- Sub-task 3 done: `npm run build` clean; `npm test` 22 suites / 421 tests green (Azurite running). `npm audit` still reports the 18 pre-existing vulnerabilities (none from nodemailer); see the NFR-02 record under sub-task 3. Installed `nodemailer@^10.3.1` and `@types/nodemailer@^8.0.2`.
- New module `api/src/shared/email/mailTransport.ts` (re-exported from `index.ts`). Use it for the real send; do not call `nodemailer` directly:
  - `sendEmail(connection: SmtpConnectionConfig, mail: OutgoingMail, options?: { transportFactory, lookup, totalTimeoutMs, logger })` resolves when the provider accepted the message and throws `EmailSendError` (`.code` is `EMAIL_AUTH_FAILED` | `EMAIL_CONNECTION_FAILED` | `EMAIL_REJECTED`, `.message` is already the generic client text). Pass `{ logger: context }` so failures go to the invocation log (secret-free: password is redacted, provider response truncated to 200 chars).
  - `SmtpConnectionConfig = { host, port, security, username, password }`; `OutgoingMail = { fromEmail, fromName?, to, subject, text, attachments?: [{ filename, content: Buffer, contentType? }] }`. `From` and `Reply-To` are both set from `fromName <fromEmail>`; attachment content type defaults to `application/pdf`.
  - `EMAIL_FAILURE_MESSAGES[code]` holds the REQ-EML-05 client messages. Map a caught error with `errorResponse(EMAIL_FAILURE_MESSAGES[code], 502, undefined, code)`.
  - The wrapper already sanitises subject, name, file name (CR/LF/control characters, quotes and slashes) and rejects a recipient that is not exactly one bare address (`EMAIL_REJECTED`, before any DNS lookup or connection). Sub-task 4 must still run `validateEmailReport` and the PDF checks (size, `%PDF-`) **before** calling it, and must map the 400/413/422 cases itself.
  - SSRF: `sendEmail` re-runs `validateHost` at send time and connects to the resolved IP (preferring IPv4), with the original hostname as `tls.servername`. A blocked or unresolvable host throws `EMAIL_CONNECTION_FAILED` without opening a connection. IP-literal hosts connect to the literal.
  - Transport options: STARTTLS → `requireTLS`; `ssl` → `secure`; `minVersion TLSv1.2`; `rejectUnauthorized: true`; connect/greeting timeout 10 s; socket timeout 30 s; plus a 30 s hard total timeout around `sendMail` (maps to `EMAIL_CONNECTION_FAILED`). `disableFileAccess`/`disableUrlAccess` are on.
- Test seam (NFR-07): handlers cannot receive options, so tests call `setEmailTransportTestHooks({ transportFactory, lookup })` and must call `resetEmailTransportTestHooks()` in `afterEach`. Pattern in `api/src/tests/integration/emailProviderTest.test.ts` (`installFakeTransport`). A fake `lookup` returning a public IP is needed for any hostname (Google/Yahoo hosts); IP-literal hosts like `8.8.8.8` need none.
- Test endpoint `api/src/functions/profile/TestEmailProvider.ts` (`testEmailProvider`, POST `v1/profile/email-provider/test`) is the reference flow for sub-task 4: `requireAuth` → role → `loadMasterKey('current')` fail-closed 500 → load `EMAIL_PROVIDER/{userId}` (missing → 409 `EMAIL_PROVIDER_NOT_CONFIGURED`) → AAD from the **stored row** → `decryptSecret` (failure → generic 500, no connection) → `sendEmail` → persist result → audit → 200 / 502.
- Persisting the result uses `updateEntity` with a **partial** entity (`partitionKey`, `rowKey`, `lastTestedAt`, `lastTestStatus`, optional re-encrypted secret fields, `etag: row.etag`); the table client uses Merge mode, so other fields are kept. A failure to persist is logged and does not change the HTTP result. After a successful send with `keyRotated` the secret is re-encrypted (7.3b); sub-task 4 should do the same after a successful report send (spec: "after a successful send or test"), using the same merge-update pattern.
- Audit: `logEmailProviderTest(userId, username, result)` added (`result` = `success` or the failure code). Sub-task 4 still has to extend `logExaminationEmailSent` (`auditService.ts:283`) and add `EXAMINATION_EMAIL_FAILED`; record only the failure code, never provider text.
- Test recipient is `User.email` read from the `USER/{userId}` row (not from the token); a missing email returns 422. The test message has no attachment and no footer.
- Success body of the test endpoint: `{ message: 'Test email sent', recipient_email, result: 'success' }` (200). Failures: 502 with `error.code` set; provider text, host and password never appear in the body (asserted in tests).
- Note: `ESOCKET`/TLS/certificate/timeout errors all map to `EMAIL_CONNECTION_FAILED` by design (spec table); anything unrecognised also defaults to `EMAIL_CONNECTION_FAILED`.
- `console.error` lines in test output come from intentional decryption-failure tests (tampered host, missing key).

**From sub-task 4 (for sub-tasks 5 and 6):**
- Sub-task 4 done: `npm run build` clean; `npm test` 23 suites / 455 tests green (Azurite running). `console.error` output in test logs comes from intentional decryption-failure tests only.
- `api/src/functions/system/EmailExaminationReport.ts` is fully rewritten — simulation removed.
- **Exact request contract (POST `/v1/examinations/{id}/email-report`):**
  ```json
  {
    "recipient_email": "optional override address",
    "subject":         "optional, max 200 chars",
    "message":         "optional, max 2000 chars",
    "file_name":       "optional attachment name, max 255 chars",
    "pdf_base64":      "required, valid base64, ≤10 MB decoded, must start %PDF-"
  }
  ```
- **Exact response on success (202):**
  ```json
  {
    "success": true,
    "data": {
      "message":             "Report accepted for delivery",
      "recipient_email":     "<resolved address>",
      "delivery_status":     "accepted",
      "recipient_overridden": true | false
    },
    "meta": { "timestamp": "...", "request_id": "..." }
  }
  ```
- **Error codes the frontend must handle (all wrapped in `{ success: false, error: { code, message } }`):**
  - `400` `Validation failed` (invalid/missing `pdf_base64`, oversize, non-PDF, bad subject/message, invalid/multi/CRLF recipient)
  - `401` `Authentication required`
  - `403` `Doctor or admin role required`
  - `404` `Examination not found` (missing or soft-deleted)
  - `422` `No recipient email available` (no patient profile email and no override)
  - `409` `code: EMAIL_PROVIDER_NOT_CONFIGURED` — doctor has no saved provider; frontend shows "Go to Email Settings" link
  - `500` `Email settings are temporarily unavailable` — master key missing/malformed; generic; no retry
  - `502` `code: EMAIL_AUTH_FAILED` — wrong credentials / app password expired
  - `502` `code: EMAIL_CONNECTION_FAILED` — SMTP unreachable, TLS failure, timeout
  - `502` `code: EMAIL_REJECTED` — provider rejected the message (envelope, size, sender policy)
- **Defaults used server-side** (the frontend should match these visually):
  - Subject: `Examination report — {exam type label} — {YYYY-MM-DD}` (no patient name, no MRN; label from `EXAM_TYPES`)
  - Attachment name: `{mrn}_{examDate}.pdf`
  - Footer: doctor's saved profile footer, or `DEFAULT_EMAIL_FOOTER` ("The examination report is attached as a PDF. This message is confidential and intended only for the addressee.")
- `logExaminationEmailSent` signature changed to `(userId, username, details: { examinationId, patientId, examinationStatus, recipientEmail, patientProfileEmail, recipientOverridden, fromEmail, pdfSizeKB, deliveryStatus })`. If any other code called the old 3-arg form, update it.
- New `logExaminationEmailFailed(userId, examinationId, recipientEmail, failureCode)` added; the action string is `EXAMINATION_EMAIL_FAILED`.
- New integration test file: `api/src/tests/integration/emailReport.test.ts` (23 tests, fake transport, no network).
**From sub-task 5 (for sub-task 6):**
- Sub-task 5 done: from `frontend/` `npm test` 9 files / 92 tests, `npm run lint` and `npm run build` are green (the build's >500 kB chunk warning is pre-existing). Page route is `/email-settings`; menu entry "Email Settings" in `Layout.tsx` for doctor/admin only. Link target for the "Go to Email Settings" link in the report dialog: `/email-settings`.
- **Read the provider status** with `emailProviderService.getProvider()` (`frontend/src/services/emailProviderService.ts`, envelope already unwrapped). It returns `EmailProviderSettings` (`frontend/src/types/index.ts`): `{ configured: false }` when nothing is saved, otherwise `configured`, `provider`, `host`, `port`, `security`, `username`, `from_email`, `from_name`, `footer`, `secret_set`, `last_tested_at`, `last_test_status`, `etag`. Use `from_name` / `from_email` for the read-only "From: Dr. … <address>" line (4.4) and `configured` for the not-configured state (4.3). Viewers get 403 from this endpoint; the button is already hidden for them.
- **Read error codes** in two equivalent ways:
  1. From a service error: `emailProviderService` errors carry `error.code` (`EMAIL_PROVIDER_NOT_CONFIGURED`, `EMAIL_AUTH_FAILED`, `EMAIL_CONNECTION_FAILED`, `EMAIL_REJECTED`, or `undefined` for generic errors) and keep the server text in `error.message`.
  2. From any raw axios error (e.g. the examination service for `email-report`): the response interceptor in `api.ts` sets `error.apiErrorCode` (undefined for the generic `ERROR` code), and `getApiErrorCode(err)` is exported from `api.ts`. The code is deliberately **not** put on `error.code` because axios already uses that property (`ERR_CANCELED`, `ERR_NETWORK`, …); existing `error.message` handling is unchanged.
  - Helper `getEmailErrorCode(err)` / `getEmailErrorMessage(err, fallback)` / `EMAIL_ERROR_MESSAGES` in `frontend/src/utils/emailErrors.ts` read `err.code`, `err.apiErrorCode` (raw axios error) and `err.cause.apiErrorCode` (service-wrapped error) and map the four codes to the REQ-EML-05 texts. `EmailReportButton` currently calls `api.post` directly and catches the raw axios error, so `getEmailErrorMessage(err, 'Failed to send report')` works there as is, and `error.message` of a raw axios error is still the axios text, so use the helper rather than `e.message` for coded failures.
  - `EMAIL_PROVIDER_NOT_CONFIGURED` is HTTP 409 for both the test endpoint and `email-report`; for `PUT` a 409 means a stale ETag (`isConcurrencyConflict`), not a missing provider.
- Other statuses for `email-report` (400 validation with `details.errors`, 404, 422 `No recipient email available`, 500 `Email settings are temporarily unavailable`) carry no REQ-EML-05 code; show `error.message` for them.
- Shared constants: `DEFAULT_EMAIL_FOOTER` and the preset data are in `frontend/src/constants/emailProviders.ts` (not needed by the report button; the server applies the footer).
- Test setup for component tests: put `// @vitest-environment jsdom` on the first line of the test file; `jsdom`, `@testing-library/react` and `@testing-library/dom` are installed. Carbon `TextArea` with a counter needs a `ResizeObserver` stub (`vi.stubGlobal`, see `EmailSettingsPage.test.tsx`). Mock `../contexts/AuthContext` (`useAuth`) and the service module with `vi.hoisted` + `vi.mock`. Use `cleanup()` in `afterEach` (no global setup file exists).
- Not changed: `EmailReportButton.tsx` and the examination service still use the old contract. *(Superseded: reworked in sub-task 6.)*

**From sub-task 6 (for sub-task 7):**
- Sub-task 6 done: from `frontend/` `npm test` 11 files / 125 tests, `npm run lint`, `npm run build` green; no backend or dependency change. Commit is on `feature/email`, not pushed.
- User-facing behaviour to document (matches REQ-EML-04): "Email Report" button for admin/doctor on the examination page, enabled for all statuses; dialog loads patient + provider status; read-only "From: name <address>"; recipient pre-filled from the patient profile and editable (note "Different from the patient's email in the profile — this will be recorded in the audit log"); draft warning; button **Confirm and send** is the only action that generates the PDF and calls the API; success text "Report accepted for delivery to {address}"; not-configured state with a "Go to Email Settings" link (`/email-settings`).
- Request body actually sent by the frontend: `{ recipient_email?, subject, message?, file_name, pdf_base64 }`. `recipient_email` is **omitted** when the recipient equals the patient's profile email (case-insensitive), so `recipient_overridden` / `recipientOverridden` in the audit is `true` only for a real override. Worth stating in `04-api-specification.md` (the field is optional) and in the audit description.
- Error texts shown (from `frontend/src/utils/emailErrors.ts`): the four REQ-EML-05 messages for the codes; for 400/404/422/500 without a code the server `error.message` is shown (e.g. "No recipient email available", "Email settings are temporarily unavailable").
- For `TEST-CASES.md`: TC-EMAIL-020 (draft warning) and TC-EMAIL-016 (no provider) now have automated frontend coverage in `frontend/src/reports/EmailReportButton.test.tsx`; the backend side is in `api/src/tests/integration/emailReport.test.ts`.
- Housekeeping: `npm test` in `frontend/` rewrites `docs2/conformance-results.csv/.txt`. Restore them (`git checkout -- docs2/conformance-results.csv docs2/conformance-results.txt`) before committing in sub-task 7 unless the change is intended.
- Known limitations unchanged: no end-to-end verification against real providers yet (sub-task 8); the 5 s auto-close after success is a UI convenience only.

**From sub-task 7 (for sub-task 8):**
- Sub-task 7 done (docs/config only; no application code changed). From `api/`: `npm run build` clean, `npm test` 23 suites / 455 tests green (Azurite running). From `frontend/`: `npm test` 11 files / 125 tests, `npm run lint`, `npm run build` green. `docs2/conformance-results.csv/.txt` restored with `git checkout`. Commit is on `feature/email`, not pushed.
- Documentation delivered: `api/local.settings.json.example` (placeholder key entry), `README-SWA.md` (env table, key setup, "Key rotation"), `dev-workflow.md`, `docs2/04-api-specification.md` (email-report rewrite, Email Provider endpoints, `EMAIL_*` codes), `docs2/03-security-architecture.md` ("Email Provider Credentials": encryption, SSRF guard, audit actions, master-key compromise), `docs2/05-deployment-guide.md` (SWA managed functions, Node 22, real workflows, SWA application settings, email key rules), `docs2/TEST-CASES.md` (section 6 now 25 cases, total 194), `docs2/KNOWN-ISSUES.md` (KI-013 email limitations, KI-014 pre-existing `npm audit`), `docs2/EMAIL-SETUP-GUIDE.md` (new, Gmail/Yahoo app-password guide), `docs2/06-local-dev-setup.md`, `docs2/README.md`, and spec section 15 "Implementation Record and Deviations" (D-01..D-16; status line updated).
- **Setup required before sub-task 8:**
  1. Generate a key (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) and set `EMAIL_CREDENTIALS_ENCRYPTION_KEY` in the Azure portal (Static Web App > Environment variables) for the target environment. Keep a copy in a secret store. Without it `PUT`, `/test` and `email-report` return a generic 500 "Email settings are temporarily unavailable".
  2. Previews (`pr-N`) share production app settings and the production storage account. Create a **dedicated test doctor account** and use **test mailboxes only**; no real doctors' secrets and no real patient data. Remove the test provider row and test patient/examination afterwards (Email Settings > Remove, or delete the test user).
  3. Prepare two throw-away mailboxes (one Gmail, one Yahoo) with 2-step verification and an app password each (see `docs2/EMAIL-SETUP-GUIDE.md`), plus a recipient mailbox. For the Generic scenario, a public SMTP host that accepts app-password auth (private/loopback hosts are rejected by design).
  4. Deploy the branch as a preview (`deploy-preview.yml`, PR from `feature/email`) so frontend `/email-settings` and the API are both live; the app needs `JWT_SECRET`, `AZURE_STORAGE_CONNECTION_STRING` and `ALLOWED_ORIGIN` already set (they are shared with production).
- Scenarios to run and record in spec section 14: save settings (Google, Yahoo); Send test email (arrives in the doctor's `User.email` inbox; set a real test address on the test doctor first, otherwise 422 "No account email available"); send report with PDF attached and footer present; override recipient (response `recipient_overridden: true`, audit shows it); wrong app password (502 `EMAIL_AUTH_FAILED`, localized message, `EXAMINATION_EMAIL_FAILED` in audit); Generic host; draft examination send; a real PDF below 500 KB (and one larger, up to ~2-3 MB) through the SWA proxy to settle the NFR-04 / D-05 question (SWA may reject large bodies before the app sees them); Cyrillic patient name/message (TC-EMAIL-024); viewer gets 403 / no button.
- Wording nit found while documenting — **fixed afterwards**: the `EMAIL_PROVIDER_NOT_CONFIGURED` message said "Configure your email provider in your profile" while the page is "Email Settings" (`/email-settings`). It now reads "Configure your email provider in Email Settings" in the backend handlers, `emailErrors.ts`, the tests, `04-api-specification.md` and the spec.
- If sub-task 8 finds a failure, open an issue; do not change documented behaviour silently — update spec section 15 and the affected docs.