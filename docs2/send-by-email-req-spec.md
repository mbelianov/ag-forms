# Send Examination by Email — Requirements Specification

**Version:** 1.0
**Status:** Approved for implementation planning — all stakeholder questions and assumptions confirmed; outbound SMTP from the hosting verified (NFR-03, see section 14)
**Scope:** Doctor sends the PDF version of an examination to the patient by email, using the doctor's own personal mailbox as the delivery provider. Includes the doctor's profile section where the mailbox provider is configured.

---

## 1. Overview

### 1.1 User story

> As a doctor using this application, I want to be able to send to the patients an email with the PDF version of the exams I have made for them.

### 1.2 Decisions already taken (from stakeholder)

| # | Decision |
|---|---|
| D-01 | Emails are sent **through the doctor's personal mailbox**, not through a platform-wide provider (no SendGrid / Azure Communication Services). |
| D-02 | The doctor defines the provider details in a **new section of their profile**: SMTP host/port, username, password / API key. |
| D-03 | The profile offers **pre-defined presets for Google and Yahoo** and **one Generic** (fully manual) option. |
| D-04 | Authentication is **simple credential-based (app password / API key)**. **OAuth is explicitly out of scope.** |
| D-05 | The recipient defaults to the **patient's email in the patient's profile** (the `email` field of the patient record); the doctor **may override it per send**. Every override is recorded in the audit log. |
| D-06 | The doctor defines the provider **once** in the profile. **Exactly one provider per profile** (no multiple mailboxes). |
| D-07 | Sensitive provider details (app password / API key) are stored **encrypted** as part of the doctor's profile data (logically part of the profile; physically a dedicated row `EMAIL_PROVIDER/{userId}`, see DM-01, so existing user endpoints can never leak it). |
| D-08 | Pressing **Send by email** opens a **confirmation step**: the app shows the recipient (default = patient's email, editable for this send only). The PDF is sent **only after the doctor confirms**. The override is never saved to the patient record. |
| D-09 | Each doctor's secret is encrypted with its **own derived key** (HKDF from a master key held in an environment variable, bound to the doctor's `userId`). The master key stays in an environment variable; a vault is not used. |

### 1.3 Terminology note on "API key"

Gmail and Yahoo do not issue "API keys" for SMTP. Their credential-based mechanism is an **app password** (a generated 16-character secret). In this specification the single secret field is therefore called **Password / API key** and carries an app password for Google/Yahoo or an API key / password for a generic provider (for example an SMTP relay that uses an API key as its SMTP password). Technically all three cases are the same: SMTP `AUTH` with a username and a secret.

**Second factor is a one-time setup step only.** Google and Yahoo require 2-step verification to be enabled on the mailbox account **once**, so that the provider will let the doctor generate an app password. After the app password is generated and saved in the profile, **no second factor is requested at any later time**: the application authenticates with username + app password alone, and the doctor is never prompted for a code when sending. The application itself never handles, stores or asks for a 2-step verification code.

---

## 2. Existing Capabilities (Code Base Review)

Legend: ✅ implemented · ⚠️ partially implemented / defective · ❌ not implemented

| # | Capability | Status | Evidence |
|---|---|---|---|
| E-01 | Patient has optional `email`, validated server- and client-side, editable in the patient form | ✅ | `api/src/types/index.ts` (`Patient.email`), `api/src/shared/validation/validation.ts`, `frontend/src/features/patients/PatientForm.tsx` |
| E-02 | PDF of an examination is generated client-side with jsPDF, Noto Sans (Cyrillic-capable), multi-fetus, multi-page | ✅ | `frontend/src/reports/pdfDocument.ts`, `pdfSections.ts` |
| E-03 | `printService.getPdfBlob(exam)` returns the PDF as a `Blob` | ✅ | `frontend/src/reports/printService.ts:70` |
| E-04 | "Email Report" button + modal (recipient, subject, message), shown to `admin`/`doctor` only, on the examination detail page | ⚠️ | `frontend/src/reports/EmailReportButton.tsx`, `ExaminationDetailPage.tsx:55,229,383` |
| E-05 | Endpoint `POST /v1/examinations/{id}/email-report`, role-guarded (`doctor`, `admin`), loads exam + patient, rejects deleted exam, rejects patient without email | ⚠️ | `api/src/functions/system/EmailExaminationReport.ts` |
| E-06 | Audit event `EXAMINATION_EMAIL_SENT` (`examinationId`, `recipientEmail`) | ✅ | `api/src/shared/audit/auditService.ts:283` |
| E-07 | Audit sanitiser redacts keys containing `password`, `secret`, `token`, `apiKey` | ✅ | `auditService.ts:92` |
| E-08 | Role model `admin` / `doctor` / `viewer`, cookie JWT auth, `requireAuth` / `requireRole` | ✅ | `api/src/shared/auth/authMiddleware.ts` |
| E-09 | Profile dropdown in header with "Change Password" entry and a Carbon page pattern to copy | ✅ | `frontend/src/components/Layout.tsx:124-141`, `features/auth/ChangePasswordPage.tsx` |
| E-10 | Soft-delete convention, ETag-in-body update convention, partition-key-typed storage in `Users` table | ✅ | `AGENTS.md`, `api/src/functions/users/*` |
| E-11 | Documented API contract and 10 test cases for email delivery | ✅ (docs only) | `docs2/04-api-specification.md:800`, `docs2/TEST-CASES.md` (section 6) |

### 2.1 Gaps and defects found

| # | Gap | Impact |
|---|---|---|
| G-01 | **No real email is ever sent.** The endpoint only logs an "EMAIL SIMULATION" and returns `mode: simulation`. No SMTP library is in `api/package.json`. | Core of the feature is missing. |
| G-02 | **Frontend/backend contract mismatch.** Frontend sends `{ recipient_email, subject, message, pdf_base64 }`; backend reads only `pdfData` and returns 400 "PDF data is required". The existing unit test passes only because it sends `pdfData`. | The current button cannot work end to end. |
| G-03 | Backend ignores `recipient_email`, `subject`, `message`; subject is hard-coded. | Doctor input has no effect. |
| G-04 | No per-user mail provider configuration exists anywhere (no profile page, no storage, no API). | New work (this spec). |
| G-05 | Recipient is not pre-filled in the modal. `Examination` has `patientName` but no patient email; the modal starts empty. | Poor UX; contradicts D-05. |
| G-06 | Subject default is hard-coded to "Ultrasound Prenatal Exam Report" regardless of examination type. | Wrong for other exam types. |
| G-07 | No examination status rule is defined. A `draft` examination can be emailed today (TC-EMAIL-005 expects an error). | Stakeholder decision (A-04): all statuses stay allowed; the doctor decides, and a warning is shown for `draft` (see 3.5, 4.1). |
| G-08 | No PDF validation (not checked to be a PDF, no size limit). | Abuse / failure risk. |
| G-09 | No failure audit event. (Rate limiting was dropped by stakeholder decision, see A-08.) | Traceability. |
| G-10 | Audit event records only the final recipient, not whether it was overridden. | D-05 requires override traceability. |
| G-11 | `GetUsers`, `UpdateUser`, `CreateUser`, `GetCurrentUser` build responses by spreading the user entity minus a deny-list. Any secret stored **on the `USER` entity** would leak. | Drives data-model decision DM-01. |
| G-12 | Existing docs (`04-api-specification.md`, `TEST-CASES.md`) describe an endpoint contract that the code does not follow. | Docs must be reconciled. |

---

## 3. Roles and Permissions

| Operation | admin | doctor | viewer |
|---|:---:|:---:|:---:|
| View / edit / delete **own** email provider settings | ✓ | ✓ | ✗ |
| Send test email from **own** provider | ✓ | ✓ | ✗ |
| Send examination PDF to patient | ✓ | ✓ | ✗ |
| View or modify **another** user's email provider settings | ✗ | ✗ | ✗ |

Notes:
- Admin is included because the existing endpoint already allows `admin`; an admin who sends reports needs their own mailbox.
- An admin must **not** be able to read or use another user's provider settings (no impersonation).
- A doctor may send the report for any examination they can read (existing rule: doctors read all). It is not restricted to their own examinations. *(Assumption A-03.)*

---

## 4. System Invariants

- **INV-01 — Secret is write-only.** The provider password / API key is never returned by any API, never logged, never written to audit details, never included in error messages.
- **INV-02 — Secret encrypted at rest with a per-doctor derived key.** Stored with AES-256-GCM. The data-encryption key is derived per doctor and per save (HKDF-SHA256) from a master key held in an environment variable with no fallback (same policy as `JWT_SECRET`). The master key is never used to encrypt data directly (see 7.3).
- **INV-02a — Secret bound to its owner and its server.** The ciphertext only decrypts for the same `userId` and the same `provider`, `host`, `port`, `security` and `username` it was saved with, so the secret can never be sent to a different server than the one the doctor saved (see 7.3, 7.3a).
- **INV-03 — Credentials isolated from the user entity.** Stored in a separate row, never on `USER/{userId}` (see G-11).
- **INV-04 — Sender identity is the doctor's own mailbox.** The platform never sends on behalf of a doctor from any other account.
- **INV-05 — Server decides the default recipient.** The patient's email is resolved server-side from `Patient.email`; the client only supplies an optional override.
- **INV-06 — Every send attempt is audited** (success and failure), fire-and-forget as in `auditService.ts`.
- **INV-07 — Soft delete.** Deleting a user purges their provider settings (credentials are not kept for deleted users).
- **INV-08 — Certificate validation is never disabled.** TLS 1.2 or higher is always required.

---

## 5. Functional Requirements

### REQ-EML-01 — Email provider section in the doctor profile

| Field | Detail |
|---|---|
| **Status** | ❌ Not implemented |
| **Roles** | doctor, admin |

**User story:** As a doctor, I want a section in my profile where I define the mailbox the application uses to send my reports, so that patients receive emails from my own address.

**Requirements**

| # | Requirement |
|---|---|
| 1.1 | A new page `Profile` (route `/profile`, `ProtectedRoute`, any authenticated non-viewer) shall contain an **Email Provider** section. The header profile dropdown shall get a new entry **Email Settings** next to "Change Password" that navigates to it. The entry is hidden for `viewer`. |
| 1.2 | The section shall offer a **Provider** selector with three options: **Google (Gmail)**, **Yahoo Mail**, **Generic SMTP**. |
| 1.3 | Selecting **Google** pre-fills and locks the server fields: host `smtp.gmail.com`, port `587`, security `STARTTLS`. |
| 1.4 | Selecting **Yahoo** pre-fills and locks: host `smtp.mail.yahoo.com`, port `587`, security `STARTTLS`. |
| 1.5 | Selecting **Generic** leaves all server fields editable: host, port, security (`SSL/TLS` or `STARTTLS`). |
| 1.6 | Fields common to all providers: **Username** (required; for Google/Yahoo this is the full email address), **Password / API key** (required on first save; masked input), **From address** (required; defaults to username when it is a valid email), **From name** (optional; defaults to the user's `fullName`), **Email footer** (optional multi-line text, max 500 characters, e.g. clinic name and contact details; see 1.6a). |
| 1.6a | **Email footer:** the doctor defines the footer text **once** in the profile section. It is appended to every report email sent by that doctor. When left empty, a built-in default footer is used ("The examination report is attached as a PDF. This message is confidential and intended only for the addressee."). The footer is plain text, shown with a character counter, and is stored unencrypted (it is not sensitive). A **default footer is pre-filled** the first time the section is saved so the doctor can edit rather than start from blank. |
| 1.7 | For Google and Yahoo the form shall display helper text: an **app password** (not the normal account password) is required. The helper text explains that 2-step verification is needed **only once, on the provider's website, to generate the app password**, and is not asked again when sending. The form never asks for a verification code. |
| 1.8 | After saving, the secret field shall show a masked placeholder ("Saved — leave empty to keep") and shall never be populated with the real value. Leaving it empty on update keeps the stored secret; entering a value replaces it. |
| 1.9 | The section shall provide **Save**, **Send test email** and **Remove settings** actions. |
| 1.10 | **Send test email** sends a short test message from the saved settings to the doctor's own account email (`User.email`) and reports success or the provider's failure category (see REQ-EML-05). It requires saved settings. |
| 1.11 | **Remove settings** asks for confirmation, then deletes the stored provider row, including the encrypted secret. |
| 1.12 | The page shall show a status line: *Not configured* / *Configured (last tested: date, result)*. |
| 1.13 | Messages use Carbon `InlineNotification` and the `useAutoNotification` helper, consistent with existing pages. UI language is English. |

**Acceptance criteria**
1. Doctor opens Profile → Email Provider, picks Google, enters username + app password, saves; page reloads showing "Configured" and no secret value in the DOM or in any API response.
2. Picking Yahoo/Google shows locked host/port/security; picking Generic makes them editable.
3. Saving with an empty secret on first save is rejected; on update it keeps the old secret.
4. A viewer cannot see the menu entry and gets `403` from the API.
5. "Send test email" delivers a message to the doctor's `User.email`; wrong credentials show an authentication error without revealing the secret.

---

### REQ-EML-02 — Provider settings API

| Field | Detail |
|---|---|
| **Status** | ❌ Not implemented |

All endpoints act on the **authenticated user only**; there is no user id in the path.

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/v1/profile/email-provider` | Get own settings (secret omitted) |
| `PUT` | `/v1/profile/email-provider` | Create or update own settings |
| `DELETE` | `/v1/profile/email-provider` | Remove own settings |
| `POST` | `/v1/profile/email-provider/test` | Send test email to own account email |

**GET response (`200`)** — when not configured, `data` is `{ "configured": false }`.
```json
{
  "configured": true,
  "provider": "google",
  "host": "smtp.gmail.com",
  "port": 587,
  "security": "starttls",
  "username": "dr.ivanova@gmail.com",
  "from_email": "dr.ivanova@gmail.com",
  "from_name": "Dr. Maria Ivanova",
  "footer": "Dr. Maria Ivanova, Clinic Name, +359 ...",
  "secret_set": true,
  "last_tested_at": "2026-11-07T10:00:00Z",
  "last_test_status": "success",
  "etag": "W/\"datetime'...'\""
}
```

**PUT request**
```json
{
  "provider": "google | yahoo | generic",
  "host": "smtp.example.com",
  "port": 587,
  "security": "starttls | ssl",
  "username": "...",
  "password": "optional on update, required on create",
  "from_email": "...",
  "from_name": "...",
  "footer": "optional, max 500 chars",
  "etag": "required on update"
}
```

**Server-side validation (allow-list, fail closed)**

| Field | Rule |
|---|---|
| `provider` | one of `google`, `yahoo`, `generic` |
| `host`/`port`/`security` | for `google`/`yahoo` the server **overwrites** them with the preset values (client values ignored); for `generic`: host is a valid hostname (no scheme/path/port), port 1–65535, security in `starttls`, `ssl` |
| `host` (generic) | must not resolve to loopback, link-local, private (RFC 1918) or metadata addresses (SSRF protection); re-checked at send time |
| `username` | 1–254 chars, no control characters |
| `password` | 1–512 chars; trimmed of surrounding whitespace; internal spaces removed for `google` (app passwords are displayed with spaces) |
| `from_email` | valid single email address, max 254 chars; for `google`/`yahoo` must equal `username` (these providers reject other senders) |
| `from_name` | max 100 chars, no CR/LF |
| `footer` | optional, max 500 chars; plain text only (HTML is not interpreted); line breaks allowed; control characters other than line breaks rejected |
| `etag` | required on update, per project convention (ETag in the body) |

**Responses:** `200` (GET/PUT/DELETE/test), `400` validation error with the existing `details.errors` array, `401`, `403`, `404` (DELETE when nothing to delete is idempotent `200`), `409`/`412`-style concurrency conflict as handled by `updateEntity`, `502` (test: provider failure, see REQ-EML-05).

**Acceptance criteria**
1. No response from any of the four endpoints ever contains the secret or its ciphertext.
2. `PUT` with `provider: google` and a client-supplied `host: evil.example.com` stores `smtp.gmail.com`.
3. `PUT` with a generic host that is `localhost`, `127.0.0.1`, `10.x.x.x`, `169.254.169.254` is rejected with `400`.
4. User A cannot read or change user B's settings by any request.

---

### REQ-EML-03 — Send examination PDF to the patient

| Field | Detail |
|---|---|
| **Status** | ⚠️ Partially implemented (simulation only, contract mismatch) |
| **Roles** | doctor, admin |

**User story:** As a doctor, I want to email the PDF of an examination to the patient from the examination page, using my own mailbox.

**Requirements**

| # | Requirement |
|---|---|
| 3.1 | The existing route `POST /v1/examinations/{id}/email-report` is **kept** and reworked to perform a real SMTP send using the caller's provider settings. The simulation mode is removed. |
| 3.2 | **Request contract (single, shared by frontend, backend, tests and docs):** `recipient_email` (optional override), `subject` (optional), `message` (optional), `file_name` (optional), `pdf_base64` (required). The backend's `pdfData` field is replaced by `pdf_base64` (fixes G-02). |
| 3.3 | **Recipient resolution:** if `recipient_email` is absent, use `Patient.email`. If present, validate it and use it instead (override, D-05). If neither exists → `422` "No recipient email available". |
| 3.4 | **Exactly one recipient.** Comma/semicolon/whitespace-separated lists, CR/LF and display-name forms are rejected. No CC/BCC. |
| 3.5 | **Examination status:** examinations in **any status** (`draft`, `completed`, `reviewed`) may be emailed; the doctor decides. The server does not block by status. The audit record includes `examinationStatus`. Deleted examination → `404`/`400` as today. *(Assumption A-04, confirmed.)* |
| 3.6 | **PDF validation:** `pdf_base64` must be valid base64, decode to at most **10 MB**, and start with the bytes `%PDF-`. Violations → `400` (`413` for size). |
| 3.7 | **Provider required:** if the caller has no provider settings → `409` with code `EMAIL_PROVIDER_NOT_CONFIGURED`. The UI turns this into a message with a link to the profile section. |
| 3.8 | **Message composition:** `From` = provider `from_name <from_email>`; `Reply-To` = same; `To` = resolved recipient; subject = request subject or default `"Examination report — {examination type label} — {exam date}"` (the default contains no patient name or MRN and must not hard-code "Prenatal"); plain-text body = optional doctor message followed by the **doctor's profile footer** (REQ-EML-01 1.6a; built-in default footer if none is set). Attachment named `file_name` or default `{mrn}_{examDate}.pdf`, `application/pdf`. |
| 3.9 | Subject and name headers are sanitised against header injection (strip CR/LF); subject max 200 chars, message max 2000 chars. |
| 3.10 | The send is **synchronous**: the HTTP request returns after the provider SMTP server accepted or rejected the message, with an explicit timeout (connect 10 s, total 30 s). A provider acceptance is reported as `delivery_status: "accepted"`; the system cannot guarantee inbox delivery. |
| 3.11 | ~~Rate limit~~ **Dropped (A-08).** No rate limiting is implemented; the real-life workflow is at most about 10 emails per hour per doctor. Every send is still audited (REQ-EML-06). |
| 3.12 | Success response `202`: `{ message, recipient_email, delivery_status: "accepted", recipient_overridden: boolean }`. |
| 3.13 | No PDF or email content is persisted on the server. |

**Acceptance criteria**
1. Doctor with Google settings sends a completed exam; the patient mailbox receives an email from the doctor's address with a valid, openable PDF showing Cyrillic text correctly.
2. Doctor changes the recipient to another address; email goes to that address; audit shows override.
3. A draft exam is accepted and sent (audit shows status `draft`); viewer → `403`; unauthenticated → `401`.
4. A non-PDF payload, oversize payload, or invalid recipient is rejected before any SMTP connection is opened.
5. With no settings saved → `409 EMAIL_PROVIDER_NOT_CONFIGURED`.
6. *(Removed with the rate limit, A-08.)*

---

### REQ-EML-04 — "Email Report" dialog behaviour (frontend)

| Field | Detail |
|---|---|
| **Status** | ⚠️ Partially implemented |

| # | Requirement |
|---|---|
| 4.1 | The button remains on the examination detail page, visible to `admin`/`doctor`, and is **enabled for every examination status**. For a `draft` examination the dialog shows a warning notification: "This examination is a draft and may be incomplete." The doctor can still confirm and send. |
| 4.2 | When the dialog opens, the frontend loads the patient (existing `patientService`) and **pre-fills** *Recipient* with `Patient.email`. If the patient has no email in the profile, the field is empty and a warning "Patient has no email in the profile" is shown; the doctor may type an address (override). |
| 4.2a | **Confirmation step (D-08):** the dialog is the confirmation. Its primary button is labelled **Confirm and send** and is the only action that triggers PDF generation and the API call. Closing or cancelling sends nothing. The recipient shown at the moment of confirmation is the one sent to; an edited recipient applies to this send only and does not update `Patient.email`. |
| 4.2b | The recipient field in the confirmation dialog is always visible and editable before sending, so the doctor sees the exact address that will receive the PDF. The recipient is validated (single, well-formed address) before **Confirm and send** is enabled. |
| 4.3 | The dialog also loads the provider status. If not configured, the form is replaced by a notification with a **Go to Email Settings** link; Send is disabled. |
| 4.4 | The dialog shows the sender ("From: Dr. … <address>") read-only. |
| 4.5 | If the doctor edits the recipient away from the patient's email, an inline note "Different from the patient's email in the profile — this will be recorded in the audit log" is shown. |
| 4.6 | Default subject follows 3.8 (no hard-coded "Ultrasound Prenatal"); Message remains optional. |
| 4.7 | PDF generation and base64 encoding stay client-side (`printService.getPdfBlob`); request body uses the contract in 3.2. |
| 4.8 | The dialog shows distinct, non-technical messages for the error codes in REQ-EML-05. The close/Cancel behaviour while sending is unchanged (cannot close mid-send). |
| 4.9 | Success message reads "Report accepted for delivery to {address}" (not "sent"), reflecting 3.10. |

---

### REQ-EML-05 — Error handling and information disclosure

| Condition | HTTP | Code | Message shown to user |
|---|---|---|---|
| Provider settings missing | 409 | `EMAIL_PROVIDER_NOT_CONFIGURED` | Configure your email provider in your profile |
| Provider rejected credentials | 502 | `EMAIL_AUTH_FAILED` | Your mail provider rejected the login. For Google/Yahoo use an app password |
| Cannot connect / timeout / TLS failure | 502 | `EMAIL_CONNECTION_FAILED` | Could not reach your mail server |
| Provider rejected message (size, sender, recipient) | 502 | `EMAIL_REJECTED` | Your mail provider rejected the message |
| Invalid recipient / payload | 400 / 422 | `VALIDATION_ERROR` | Field-level messages |

- Raw SMTP responses, hostnames, stack traces and credentials are logged **server-side only** (without secrets) and never returned to the client.
- Failures are audited (REQ-EML-06).

---

### REQ-EML-06 — Audit logging

Existing mechanism: `auditService.logAuditEvent`; all `details` pass through `sanitizeAuditDetails`.

| Action | Details recorded |
|---|---|
| `EMAIL_PROVIDER_SAVED` | provider, host, port, security, username, fromEmail, `secretChanged: boolean` (never the secret) |
| `EMAIL_PROVIDER_DELETED` | provider |
| `EMAIL_PROVIDER_TEST` | result (`success` / failure code) |
| `EXAMINATION_EMAIL_SENT` *(extended)* | examinationId, patientId, `examinationStatus`, recipientEmail, `patientProfileEmail`, **`recipientOverridden`**, fromEmail, pdfSizeKB, deliveryStatus |
| `EXAMINATION_EMAIL_FAILED` *(new)* | examinationId, recipientEmail, failure code |

Audit writes must not block or fail the primary operation. Existing `GetAuditLogs` consumers must display the new action names.

---

### REQ-EML-07 — Secure storage of provider credentials

| # | Requirement |
|---|---|
| 7.1 | **DM-01 — Storage:** table `Users`, new row type: `PartitionKey = EMAIL_PROVIDER`, `RowKey = {userId}`. Not stored on `USER/{userId}`. |
| 7.2 | Row fields: `provider`, `host`, `port`, `security`, `username`, `fromEmail`, `fromName`, `footer`, `secretCiphertext`, `secretIv`, `secretAuthTag`, `secretSalt`, `keyVersion`, `lastTestedAt`, `lastTestStatus`, `createdAt`, `updatedAt`. Only the password / API key is encrypted; the other fields are stored as plain text. |
| 7.3 | **Per-doctor key derivation and encryption (D-09):** (a) The **master key** is the environment variable `EMAIL_CREDENTIALS_ENCRYPTION_KEY` (32 random bytes as 64 hex characters). It is never committed and has **no default / fallback**: if it is missing or malformed, provider endpoints and sending fail closed with `500` and a server log. (b) On every save of a secret, generate a random 16-byte **salt** and a random 12-byte **IV**. (c) Derive a 32-byte **data key** with HKDF-SHA256 from the master key, the salt, and the context string `email-provider-secret\|v{keyVersion}\|{userId}`. (d) Encrypt with **AES-256-GCM** using the data key, binding the **connection identity** as additional authenticated data (AAD): `userId`, `provider`, `host`, `port`, `security` and `username`, serialised in a fixed, unambiguous order and format (for example canonical JSON with a fixed key order). (e) Store `secretCiphertext`, `secretIv`, `secretAuthTag`, `secretSalt` and `keyVersion` in the doctor's row. Uses Node built-in `crypto` only; no custom cryptography. |
| 7.3a | **Binding to the owner and to the connection:** on decrypt, `userId` is taken from the row key (never from the request), and `provider`, `host`, `port`, `security` and `username` are read from the same row; all are used for key derivation (`userId`) and as AAD (all six). A row copied to another user, a modified `userId`, **a modified `provider`, `host`, `port`, `security` or `username`** (for example redirecting the login to a server the attacker controls), a wrong master key, a changed salt/IV or a tampered ciphertext must all fail authentication and be treated as a decryption failure (`500`, server log, no detail to the client, and **no SMTP connection is opened**). `userId` of an existing row is immutable. |
| 7.3d | **Changing connection fields:** because the connection identity is part of the AAD, a save that changes `provider`, `host`, `port`, `security` or `username` must **re-encrypt the secret**. If the doctor leaves the password empty ("keep existing"), the server first decrypts the stored secret with the **old** values, then re-encrypts it with the **new** values in the same write. If the old secret cannot be decrypted, the save is rejected and the doctor is asked to enter the password again. Changes to `fromEmail`, `fromName` and `footer` do not affect the AAD and do not require re-encryption. |
| 7.3b | **Key rotation:** `keyVersion` identifies the master key used for a row. The current key is `EMAIL_CREDENTIALS_ENCRYPTION_KEY`; during a rotation the old key is supplied in `EMAIL_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS`. Rows written with the previous version are still decrypted, and are **re-encrypted with the current key** the next time the settings are saved or after a successful send or test. Only one previous key is supported at a time. |
| 7.3c | **Master key compromise:** the master key and a copy of the table together allow all data keys to be re-derived; per-doctor derivation limits the impact of copied rows, key reuse and partial leaks, but not of a stolen master key. Moving the master key to a managed vault is a possible later enhancement and is out of scope. |
| 7.4 | Decryption happens only inside the send/test functions, in memory, per request. The derived data key and the plaintext secret are never logged, cached, returned or stored beyond the request. |
| 7.5 | On user soft-delete (`DeleteUser`), the `EMAIL_PROVIDER/{userId}` row is hard-deleted (INV-07). |
| 7.6 | On password change or admin password reset, provider settings are **not** affected. |
| 7.7 | Multi-row write note: a failed secret save must not leave a half-written row; the single-row design avoids the non-transactional multi-row issue described in `AGENTS.md`. |
| 7.8 | `.gitignore`, `local.settings.json` and deployment docs must document the new env vars (`EMAIL_CREDENTIALS_ENCRYPTION_KEY` and, during rotation only, `EMAIL_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS`) and give a generation command (for example `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`); no key committed. |

---

## 6. Non-Functional Requirements

| # | Requirement |
|---|---|
| NFR-01 | **Transport security:** SMTP connections use TLS ≥ 1.2 (`STARTTLS` mandatory upgrade or implicit SSL); plain unencrypted SMTP is not offered; certificate validation always on. |
| NFR-02 | **Dependencies:** add one actively maintained SMTP library (candidate: `nodemailer`) at its latest stable version; verify maintenance status, licence and absence of known CVEs at implementation time (security policy §1, §7). No other new runtime dependency is needed (crypto is built in). |
| NFR-03 | **Runtime constraint — verified 2026-11-07:** Azure SWA (free tier) managed functions allow outbound SMTP on ports 587 (STARTTLS) and 465 (implicit TLS) to Gmail and Yahoo; TLS 1.3 negotiated. Port 25 also worked but is not used. Evidence in section 14. The check covers connectivity and TLS only, not authentication or message acceptance. |
| NFR-04 | ~~Payload size check~~ **Dropped (A-08).** Generated examination PDFs are currently below 500 KB (about 0.7 MB as base64), so the hosting request-size limit is not expected to matter. The server-side 10 MB cap stays as an abuse guard only; the hosting limit is not measured. |
| NFR-05 | **Performance:** send completes within 30 s or fails with `EMAIL_CONNECTION_FAILED`. |
| NFR-06 | **Logging:** structured, no PII beyond what the audit trail needs, never secrets. |
| NFR-07 | **Testability:** the SMTP transport is injectable so integration tests never open real connections. |
| NFR-08 | **Accessibility/UI:** Carbon components, labels and `invalidText` on all fields, keyboard operable. |

---

## 7. Impact on Existing Code (what changes, not how)

| Area | Change |
|---|---|
| `api/src/functions/system/EmailExaminationReport.ts` | Replace simulation with real send; new contract; validations; status rule; extended audit. |
| `api/src/functions/profile/*` (new) | Four provider-settings functions. |
| `api/src/shared/email/*` (new) | Provider presets, validation, encryption, SMTP transport wrapper. |
| `api/src/shared/audit/auditService.ts` | New/extended audit helpers. |
| `api/src/functions/users/DeleteUser.ts` | Purge `EMAIL_PROVIDER/{userId}`. |
| `api/src/types/index.ts` | New `EmailProviderSettings` type. |
| `api/package.json`, `local.settings.json`, deployment docs | SMTP library; `EMAIL_CREDENTIALS_ENCRYPTION_KEY`; optional `EMAIL_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS`. |
| `frontend/src/reports/EmailReportButton.tsx` | Contract fix, pre-fill, override note, not-configured state, status gating, error mapping. |
| `frontend/src/features/profile/*` (new), `App.tsx`, `Layout.tsx` | Profile page, route, menu entry. |
| `frontend/src/services/*` (new `emailProviderService.ts`) | API client; ETag in body per convention. |
| `docs2/04-api-specification.md`, `docs2/TEST-CASES.md`, `docs2/03-security-architecture.md` | Reconcile with this spec (G-12). |
| `api/src/tests/**` | Update the existing simulation test; add provider-settings, sending, encryption, validation, SSRF tests. |

---

## 8. Test Scenarios (to be added to `TEST-CASES.md` section 6)

| ID | Scenario | Priority |
|---|---|---|
| TC-EMAIL-011 | Save Google settings; GET never returns secret | P0 |
| TC-EMAIL-012 | Server overwrites host/port for presets | P1 |
| TC-EMAIL-013 | Generic host to loopback/private/metadata address rejected | P0 |
| TC-EMAIL-014 | Secret stored encrypted (ciphertext ≠ plaintext, decrypts correctly, wrong master key fails) | P0 |
| TC-EMAIL-014a | Row copied to another user's `userId`, modified `userId`, changed salt/IV, or tampered ciphertext/tag all fail to decrypt | P0 |
| TC-EMAIL-014e | Changing `host`, `port`, `security`, `provider` or `username` directly in the stored row makes decryption fail, and no SMTP connection is attempted | P0 |
| TC-EMAIL-014f | Saving with a changed `host` and an empty password keeps the secret working (server re-encrypts with the new values); if the old secret is undecryptable the save is rejected | P1 |
| TC-EMAIL-014g | Changing only `fromName` or `footer` does not require re-encryption and does not break sending | P2 |
| TC-EMAIL-014b | Two saves of the same secret produce different ciphertext, IV and salt | P1 |
| TC-EMAIL-014c | Row written with the previous master key still decrypts when `EMAIL_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS` is set, and is re-encrypted with the current key afterwards | P1 |
| TC-EMAIL-014d | Missing or malformed master key makes provider endpoints and sending fail closed with no secret in the response | P0 |
| TC-EMAIL-015 | User A cannot read/modify/use user B's settings | P0 |
| TC-EMAIL-016 | Send with no provider → `EMAIL_PROVIDER_NOT_CONFIGURED` | P1 |
| TC-EMAIL-017 | Send with recipient override → audit has `recipientOverridden: true` | P1 |
| TC-EMAIL-018 | Recipient with multiple addresses / CRLF rejected | P0 |
| TC-EMAIL-019 | Non-PDF payload and >10 MB payload rejected | P1 |
| TC-EMAIL-020 | Draft examination can be sent; dialog shows a draft warning; audit records `examinationStatus: draft` (supersedes TC-EMAIL-005, which expected an error) | P1 |
| TC-EMAIL-021 | *(Removed — rate limit dropped, A-08)* | — |
| TC-EMAIL-022 | Provider auth failure → `EMAIL_AUTH_FAILED`, no secret in response or logs | P0 |
| TC-EMAIL-023 | Deleting a user removes their provider row | P1 |
| TC-EMAIL-024 | Cyrillic patient name and Cyrillic subject/message arrive intact (UTF-8) | P1 |
| TC-EMAIL-025 | Test-email button delivers to the doctor's own address | P2 |

The existing TC-EMAIL-001…010 stay valid; 001–004 are re-based on the new contract (202, `recipient_email`/`pdf_base64`).

---

## 9. Assumptions (all confirmed by stakeholder)

| # | Assumption |
|---|---|
| A-01 | Confirmed: Gmail and Yahoo presets use `smtp.gmail.com:587` and `smtp.mail.yahoo.com:587` with STARTTLS and an **app password** only (no verification code at send time; 2-step verification is a one-time setup step at the provider). Hostnames/ports to be re-verified against the providers' current documentation at implementation. |
| A-02 | Confirmed as D-06: one provider configuration per user (no multiple mailboxes, no admin-shared mailbox). |
| A-03 | Confirmed: any doctor/admin can email any examination they can read (sent from their own mailbox); not restricted to own examinations. |
| A-04 | Confirmed: all examination statuses (`draft`, `completed`, `reviewed`) may be emailed; a warning is shown for `draft`. |
| A-05 | Confirmed: PDF limit 10 MB decoded; subject max 200 chars; message max 2000 chars; plain-text body with a per-doctor editable footer (max 500 chars) defined once in the profile. The original 20 sends/hour rate limit was superseded by A-08. |
| A-06 | Confirmed: the PDF stays client-generated; the server cannot verify that its content matches the examination and performs validation only (valid PDF, size limit, authenticated doctor/admin). Documented as a known limitation (KL-06, R-03). |
| A-07 | Confirmed: the send endpoint returns `202` with `delivery_status: "accepted"`, and the UI text is "Report accepted for delivery to {address}". |
| A-08 | Confirmed (2026-11-07): **no rate limiting** (real-life workflow is at most about 10 emails per hour per doctor) and **no NFR-04 request-size check** (generated PDFs are below 500 KB). The 10 MB decoded cap on the server remains as an abuse guard. Every send and failure is still audited. |


---

## 10. Resolved Questions (stakeholder answers)

All open questions have been answered. No open questions remain at the time of writing.

| # | Question | Decision | Effect on this spec |
|---|---|---|---|
| Q-01 | Is recorded patient consent to receive reports by email required? | **No consent tracking in this feature.** Documented as a known gap for later. | No Patient field, no consent check. Added to Known Limitations (section 13). `docs2/KNOWN-ISSUES.md` GDPR entry should reference this feature when implemented. |
| Q-02 | Should the default subject include the patient's name? | **No patient name.** Default subject is `Examination report — {exam type} — {exam date}`; the doctor can edit it. | Already reflected in 3.8 and 4.6. The default must never contain patient name or MRN. |
| Q-03 | Should the PDF be password-protected? | **No.** The PDF is sent unprotected. | Out of scope (section 12); risk R-06 accepted. |
| Q-04 | Does the doctor need a sent-history view? | **No.** The admin audit log is enough. | No UI for history; REQ-EML-06 audit records are the only trace. |
| Q-05 | Should an admin be able to switch the feature off globally? | **No switch.** The feature is available to doctors/admins who configured a provider. | No feature flag or setting. |
| Q-06 | Is Outlook / Microsoft 365 needed? | **No.** Google, Yahoo and Generic are sufficient. | Outlook recorded as a known limitation (section 13). No Outlook preset. |

---

## 11. Risks

| # | Risk | Mitigation |
|---|---|---|
| R-01 | Azure hosting may block outbound SMTP or limit it on the free tier. | **Verified not blocked** for Gmail and Yahoo on 587 and 465 (section 14). Residual: the hosting provider could change its outbound rules later, and real authentication and delivery are not yet proven; both are covered by the end-to-end test TC-EMAIL-001 and the test-email button. |
| R-02 | Hosting request-size limit smaller than a base64 PDF payload. | Accepted without measurement (A-08): current PDFs are below 500 KB. Revisit only if PDFs grow substantially. |
| R-03 | Client-generated PDF is trusted by the server. | Accepted for now; only authenticated doctors/admins can send; payload is validated as PDF. |
| R-04 | Google may not offer app passwords on some accounts (Workspace policies, or accounts without 2-step verification enabled once at the provider). Providers can also revoke an app password (for example after an account password change). | Clear helper text; clear `EMAIL_AUTH_FAILED` message telling the doctor to generate a new app password and re-save it; "Generic" as fallback. |
| R-05 | Loss or accidental change of the master key makes all stored credentials unusable. | Document key backup; users can re-enter credentials; `keyVersion` and the previous-key variable support rotation. |
| R-07 | Theft of the master key together with a copy of the table exposes all doctors' stored secrets. | Master key only in application settings, never committed; per-doctor derivation limits other leak paths; vault storage is a possible later enhancement (7.3c). |
| R-06 | Doctor's personal mailbox is used to send patient data → unprotected PDF resides in a third-party mailbox (Sent folder) and in the patient's inbox. | **Accepted by stakeholder** (Q-01, Q-03): no consent tracking, no PDF password. Listed in Known Limitations. |

---

## 12. Out of Scope

- OAuth 2.0 / XOAUTH2 flows, "Sign in with Google/Microsoft".
- Platform-wide providers (SendGrid, Azure Communication Services).
- Multiple recipients, CC/BCC, mass mailing, scheduled sending.
- Server-side PDF generation or persistence of sent PDFs.
- Delivery tracking, bounce handling, read receipts.
- Patient-facing portal or download links.
- UI translation (the UI remains English-only).
- Patient consent tracking for email delivery (Q-01).
- Password-protected / encrypted PDF (Q-03).
- Sent-history view for doctors (Q-04).
- Global feature switch (Q-05).
- Outlook / Microsoft 365 preset (Q-06).

---

## 13. Known Limitations

| # | Limitation |
|---|---|
| KL-01 | No recorded patient consent for email delivery; GDPR consent handling remains a known gap (see `docs2/KNOWN-ISSUES.md`). |
| KL-02 | The PDF is sent unprotected and remains in the doctor's Sent folder and the patient's mailbox. |
| KL-03 | Outlook / Microsoft 365 accounts are not supported through a preset; the Generic option works only where the account still allows app-password SMTP authentication. OAuth is out of scope. |
| KL-04 | Doctors cannot see email history; only admins via the audit log. |
| KL-05 | Acceptance by the provider's SMTP server does not guarantee inbox delivery; no bounce or read tracking. |
| KL-06 | The PDF is generated in the browser and uploaded; the server validates format and size but cannot verify that the content matches the stored examination. |

---

## 14. NFR-03 Verification Result

**Date:** 2026-11-07
**Environment:** Azure Static Web Apps (free tier) PR preview environment `pr-10` of the production SWA resource, managed functions, Node `v22.23.4`. Preview and production share one SWA resource; the production environment itself was not probed (assumption: same outbound network behaviour).
**Method:** a temporary admin-only diagnostic function connected to fixed public SMTP servers and reported the furthest stage reached. No login, no message and no credentials were sent. Certificate validation was on. The function was removed afterwards and never merged.

| Target | Mode | Stages completed | Result | TLS | Time |
|---|---|---|---|---|---|
| `smtp.gmail.com:587` | STARTTLS | dns, tcp, greeting, starttls, tls | ok | TLS 1.3 | 106 ms |
| `smtp.mail.yahoo.com:587` | STARTTLS | dns, tcp, greeting, starttls, tls | ok | TLS 1.3 | 169 ms |
| `smtp.gmail.com:465` | implicit TLS | dns, tcp, tls, greeting | ok | TLS 1.3 | 68 ms |
| `smtp.mail.yahoo.com:465` | implicit TLS | dns, tcp, tls, greeting | ok | TLS 1.3 | 150 ms |
| `smtp.gmail.com:25` | STARTTLS (informational) | dns, tcp, greeting, starttls, tls | ok | TLS 1.3 | 100 ms |

**Decision:** presets in A-01 and requirements 1.3 / 1.4 stay unchanged (587 with STARTTLS). Port 465 is available as a fallback if a provider changes its policy.

**Not covered:** SMTP authentication with an app password, message acceptance by the providers, other generic SMTP servers (the Generic option is any host the doctor enters), and the request-size limit of NFR-04 / R-02. A single run was captured; a second run was not recorded.
