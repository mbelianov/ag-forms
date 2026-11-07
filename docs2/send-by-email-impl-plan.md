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

**Status**: `[ ] pending`

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

**Status**: `[ ] pending`

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

**Status**: `[ ] pending`

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

**Status**: `[ ] pending`

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

**Status**: `[ ] pending`

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
