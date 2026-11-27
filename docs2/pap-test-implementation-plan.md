# PAP Test — Implementation Plan

**Source:** [`PAP-TEST-USER-STORIES.md`](PAP-TEST-USER-STORIES.md) (product-owner decisions win over [`PAP-TEST-ImplementationGuideLines.txt`](PAP-TEST-ImplementationGuideLines.txt)); technical spike: [`O-4-TECHNICAL-SPIKE-REPORT.md`](O-4-TECHNICAL-SPIKE-REPORT.md); storage assets: [`infra/pap-pdf-storage/`](../infra/pap-pdf-storage/README.md).
**Deferred items from this plan:** logged in [`KNOWN-ISSUES.md`](KNOWN-ISSUES.md) as KI-015 … KI-021.

Sizing uses t-shirt sizes (XS / S / M / L / XL). Priorities: **P0 critical**, **P1 high**, **P2 medium**, **P3 low**.

---

## 1. Top-Level Overview

Add `pap_test` as one more examination type that follows every existing convention (routes under `v1/examinations`, the three-row `Examinations` storage pattern, soft delete, ETag in the request body, `successResponse()` / `errorResponse()`, `requireAuth` + `requireRole(['doctor','admin'])`). No new role.

Lifecycle: `draft` → `completed` → (bulk **Sign completed**, tracked by server-set `isSigned`, not a status) → `reviewed`.

New capabilities on top of the existing exam flows:

| Capability | Summary |
|---|---|
| Cytology data | Bethesda fields stored in the standard `data` JSON on Table Storage (living source of truth). |
| Bulk signing | `POST /v1/examinations/{id}/sign`, orchestrated by the client with small concurrency; **mock** QES behind the final provider interface. |
| Server-side PDF | `pdfmake` + bundled Roboto (Cyrillic), stored unprotected in Blob Storage (`pap-pdfs`, `pap/{examinationId}/{guid}.pdf`). |
| Retention | Azure Storage **lifecycle rules** only (no scheduler); app treats a missing blob as a normal state (HTTP 410, self-healing, "Recreate PDF"). |
| Email | New `POST /v1/examinations/{id}/email-report-zip` sends the unchanged PDF inside a ZIP (`@zip.js/zip.js`, AES-256 default, plain optional). Existing `email-report` untouched. |
| Mobile | PWA on the existing frontend; online-only, app shell offline. |
| Audit | New PAP / signing / PDF / ZIP events in the existing audit log. |

### Context facts that the plan relies on (verified in code)

| Fact | Evidence |
|---|---|
| Backend shared code lives in `api/src/shared/{auth,http,storage,validation,audit,email,mrn}`, **not** `api/src/utils` as the stories say. | `list_files api/src/shared` |
| Frontend registry is `EXAM_TYPE_CONFIG` + `EXAM_TYPES` in [`frontend/src/constants/examinationTypes.ts`](../frontend/src/constants/examinationTypes.ts); `SECTION_VISIBILITY` no longer exists there (header comment: replaced in ST-06). `AGENTS.md` still mentions it. Form/detail pages are under `frontend/src/features/examinations/`, not `components/`. | file header lines 1-9; `list_files frontend/src` |
| Existing type keys are `prenatal` and `first_trimester` (backend [`examinationTypes.ts`](../api/src/constants/examinationTypes.ts)). | file lines 10-13 |
| `examinationDataSchema` requires `fetuses` (min 1) and `ExaminationData` is fetus-oriented. Decision D3: `pap_test` is stored with exactly one fetus and its cytology fields in `fetuses[0].pap`; the fetus schema (`fetusSectionSchema`) needs an optional `pap` key. | [`validation.ts`](../api/src/shared/validation/validation.ts:184), [`types/index.ts`](../api/src/types/index.ts:113) |
| `DeleteExamination` is **admin only** (`isAdmin`). Decision D1: stays admin-only for all types; Story 1 AC7 amended accordingly. | [`DeleteExamination.ts`](../api/src/functions/examinations/DeleteExamination.ts:20) |
| Create/Update destructure explicit body fields, so unknown client fields (e.g. `isSigned`) are already ignored; Update's primary-row sync copies only a fixed field list. | [`CreateExamination.ts`](../api/src/functions/examinations/CreateExamination.ts:30), [`UpdateExamination.ts`](../api/src/functions/examinations/UpdateExamination.ts:164) |
| `GetExaminations` already supports `status`, `from_date`, `to_date`, `patient_name`, `pageSize` (max 100) and continuation token; `EXAM_TYPE_KEYS` allowlist gates `examination_type`. | [`GetExaminations.ts`](../api/src/functions/examinations/GetExaminations.ts:23) |
| `@azure/storage-blob` is already in `api/package.json` but unused in `src`. | grep |
| Email building blocks (`sendEmail`, provider decrypt, `EMAIL_FAILURE_MESSAGES`, audit helpers) are in `api/src/shared/email`; `defaultFileName` / `getExamTypeLabel` are private to [`EmailExaminationReport.ts`](../api/src/functions/system/EmailExaminationReport.ts:34). | file |
| CSP is `script-src 'self'`, `connect-src 'self'` (service worker compatible). | [`staticwebapp.config.json`](../frontend/staticwebapp.config.json) |

---

## 2. Requirements & Story Summary

| ID | Story | Persona | Layer | Priority | Size |
|---|---|---|---|---|---|
| S8 | Registry, types, validation, filters, access for `pap_test` | Developer | BE + FE | P0 | L |
| S10 | QES provider interface + mock | Developer | BE | P0 | S |
| S12 | PDF blob lifecycle, deletion, missing-blob handling | System owner | BE + infra | P0 | L |
| S9 | Server-side PDF, sign/get/recreate/email-zip endpoints | Developer | BE | P0 | XL |
| S1 | Create draft PAP test | Doctor | FE (+BE) | P1 | M |
| S3 | Cytology entry and intermediate save | Specialist | FE (+BE) | P1 | M |
| S4 | Mark completed (completion validation) | Specialist | FE + BE | P1 | S |
| S5 | Bulk "Sign completed" | Specialist | FE + BE | P1 | L |
| S2 | Draft list, name lookup, older-drafts hint | Specialist | FE | P1 | L |
| S6 | Review, print, ZIP email, mark reviewed | Doctor | FE + BE | P1 | L |
| S7 | Recreate PDF | Doctor/Specialist | FE + BE | P1 | M |
| S13 | Audit logging | Security officer | BE | P1 | M |
| S11 | PWA / mobile + performance targets | Specialist | FE | P2 | L |
| S14, S15 | Real QES; signature verification | — | — | **Deferred** | — |
| KI-014 | Fix `npm audit` findings of the current code base (`api/` and `frontend/`) — security-policy prerequisite for adding new dependencies | Developer | BE + FE | P0 | L |

---

## 3. Dependency Overview

```
T0A audit remediation ─► T0 prerequisites ──► T3 blob/PDF libs ──► T5 PDF renderer ──┐
T1 registry/types ─► T2 create/update rules  ─┐                                      ├─► T6 sign/pdf/recreate ─► T7 email-zip ─► T13 FE review/print/email
T4 QES mock ──────────────────────────────────┘──────────────────────────────────────┘          │
                                                                                                └─► T8 delete cascade
T9 audit events (consumed by T2, T6, T7, T8)
T10 FE registry+form ─► T11 FE draft list ─► T12 FE bulk sign ─► T13
T14 PWA (after T11/T12)        T15 verification/docs (last)
```

Critical path: **T0A → T0 → T1 → T2 → T3 → T4/T5 → T6 → T7 → T12/T13 → T15**.

T0A is independent of PAP business logic and may run in parallel with T1 (no shared files except `package.json` / lock files), but it **must be finished before T0 adds `pdfmake` and `@zip.js/zip.js`**, so that the new packages are added to an already clean lock file.

---

## 4. Decisions / Clarifications Needed Before Coding

| # | Question | Why it matters | Default if not answered |
|---|---|---|---|
| D1 | **DECIDED:** delete stays **admin-only** for all types; Story 1 AC7 amended (doctor edits, admin deletes). | Story 12 AC8 blob delete is attached to the unchanged admin endpoint. | — |
| D2 | **DECIDED:** Patient name lookup supports **both** mechanisms. **Option A is the default**: `/v1/patients-search` → resolve patient → `patient_id` filter (distinguishes unknown patient from no PAP draft). **Option B is also available** as an alternative mode: `GET /v1/examinations?examination_type=pap_test&status=draft&patient_name=...` (single call, prefix match). In addition the lab specialist gets a **shortcut to all draft PAP tests** (see T11). | Empty-result UX differs per option. | — |
| D3 | **DECIDED:** `pap_test` is formally implemented as an exam with **exactly one fetus** (`data.fetuses.length === 1`). The existing fetus-based `ExaminationData` shape, `examinationDataSchema` (`fetuses` min 1) and serializer stay valid; PAP cytology fields live in a new optional `pap` object on `fetuses[0]` (`FetusSectionData.pap?: PapTestData`). | Avoids a second `data` shape and a discriminated schema. | — |
| D4 | Registry key naming: stories say `pap_test`; existing keys are `prenatal` / `first_trimester`. | Consistency only. | Keep `pap_test` (story decision). |
| D5 | **DECIDED:** keep the existing `patientAgeAtExam` rule `2–99`. | — | — |

---

## 5. Sub-Tasks

Each sub-task is independent enough to be implemented and reviewed on its own. Complete in the order listed unless a dependency says otherwise.

---

### T0A — Fix `npm audit` findings of the current code base (KI-014)
**Priority:** P0 · **Size:** L · **Source:** [`KNOWN-ISSUES.md`](KNOWN-ISSUES.md) KI-014 · **Blocks:** T0 (and so every task that adds dependencies)

- **Intent:** Bring `api/` and `frontend/` to a clean, auditable dependency baseline, as required by the security policy (critical within 24 h, high within 30 days; no ignored security warnings), **before** any new PAP dependency is added. This is a maintenance task: **no functional change**, existing behaviour must not break.
- **Expected Outcomes:**
  - `npm audit --omit=dev` (production/runtime) reports **0 high and 0 critical** findings in **both** `api/` and `frontend/`; the aim is 0 findings overall.
  - The runtime findings listed in KI-014 are fixed: `joi` (<= 17.13.8), `@azure/identity` / `@azure/msal-node`, `fast-xml-parser` (<= 5.11.2).
  - Dev/test tooling findings (`jest` / `ts-jest` chain: `handlebars`, `brace-expansion`, `browserslist`, `js-yaml`, `minimatch` / `glob` / `rimraf`, `deepmerge`, `baseline-browser-mapping`; and the 26 `frontend/` findings) are fixed by upgrading, or — only where upstream has no fix — explicitly documented as accepted with a reason (dev-only, not shipped).
  - Both lock files are updated and committed; `npm audit` before/after counts are recorded in `KNOWN-ISSUES.md` (KI-014 updated to **Resolved** or reduced to the remaining accepted items).
- **Todo List:**
  1. **Baseline (read-only).** In `api/` and `frontend/` run `npm audit --json` and `npm audit --omit=dev --json`; record counts per severity and the dependency path for each finding (`npm ls <package>`) in the sub-task notes. Identify which findings are direct dependencies and which are transitive.
  2. **Non-breaking pass.** Run `npm audit fix` (**without `--force`**) in each project; review the lock-file diff; run the project test suites.
  3. **Runtime packages, backend (do first, one package at a time, one commit-sized change each).**
     - `joi` → latest stable. Check the changelog for breaking changes affecting [`validation.ts`](../api/src/shared/validation/validation.ts) schemas; run the full validation tests.
     - `@azure/identity` / `@azure/msal-node` → patched versions (find out which direct dependency pulls them in, probably `@azure/data-tables` / `@azure/storage-blob`; upgrade that parent first). Run all storage-related tests.
     - `fast-xml-parser` → patched version (probably a transitive dependency of the Azure SDK; upgrade the parent, or use an `overrides` entry in `api/package.json` only if the parent has no release yet, and document it).
  4. **Dev tooling, backend.** Upgrade `jest`, `ts-jest`, `@types/jest` (and `typescript` if needed) to the latest compatible stable versions so that `handlebars`, `brace-expansion`, `minimatch` / `glob` / `rimraf`, `js-yaml`, `deepmerge` and `browserslist` resolve to patched versions. Check the Jest config (`roots`, coverage exclusion of `api/src/tests/**`) still behaves identically.
  5. **Frontend.** Triage the 26 findings: separate runtime (`react`, `axios`, `@carbon/*`, `jspdf` etc.) from dev tooling (`vite`, `vitest`, `eslint`, `typescript-eslint` chain). Upgrade runtime packages first, then tooling. Re-run `npm run build` and compare bundle output to detect unexpected changes.
  6. **No blind forcing.** `npm audit fix --force` is not used. A major-version upgrade is accepted only after reading its changelog and passing all tests; if a major upgrade is too risky, split it into a separate, documented follow-up item instead of skipping silently.
  7. **Remaining findings.** For each finding that cannot be fixed (no patched release): note package, severity, why it is not reachable/shipped, and when to re-check. Record them in KI-014; do not suppress them.
  8. **Update documentation.** Update KI-014 (status, before/after counts, remaining accepted items, date). Mention the audit results in [`05-deployment-guide.md`](05-deployment-guide.md) only if a Node/runtime requirement changed.
- **Relevant Context:** [`api/package.json`](../api/package.json), [`frontend/package.json`](../frontend/package.json) and their lock files; [`KNOWN-ISSUES.md`](KNOWN-ISSUES.md) KI-014 (including the PAP spike update of 22 Nov 2026: 4 runtime findings, 3 high, in `api/`); `AGENTS.md` (backend `strict: false`, CommonJS, Jest roots; frontend single quotes + semicolons, `import type`); the security rule: latest stable version, actively maintained, no EOL packages.
- **Acceptance Criteria:**
  - `cd api && npm audit --omit=dev` and `cd frontend && npm audit --omit=dev` report 0 high / 0 critical (target: 0 total).
  - Remaining dev-tooling findings, if any, are listed individually in KI-014 with reason; none is critical or high unless explicitly accepted with a justification and a re-check date.
  - `cd api && npm test` passes with the **same** number of tests as before (no test removed or skipped to get green) and no new warnings; `cd api && npm run build` succeeds.
  - Frontend `npm test`, `npm run lint` and `npm run build` pass with no new warnings.
  - Smoke check with `swa start` (port 4280): login, patient search, create/open an existing-type examination (`prenatal`) and PDF download still work (no regression of existing functionality).
  - Lock files are consistent (`npm ci` succeeds in both projects).
- **Risks:**
  - Major upgrade of `joi` or the Azure SDK may change validation messages or error shapes → covered by existing tests; add a targeted test if an untested path is touched.
  - Upgrading Jest/ts-jest may change TypeScript diagnostics with `strict: false` → fix config, do not weaken the tests.
  - Frontend tooling majors (Vite/Vitest/ESLint) may require config migration → keep each upgrade a separate step and re-run lint/build.
  - Transitive findings without an upstream fix → use `overrides` sparingly, document each one, remove when the parent is updated.
  - SWA managed-function size/limits are not affected by this task (no new packages), but the lock-file diff must be reviewed for unexpected new transitive dependencies.
- **Status:** `[x] done` — 27 Nov 2026. `npm audit` is 0 / 0 (all findings and `--omit=dev`) in `api/` and `frontend/`; api tests 455/455 and `tsc` build OK; frontend lint, build and tests (125/125) OK; `npm ci` OK in both; manual `swa start` smoke check confirmed OK by the product owner. Details in KI-014.

---

### T0 — Prerequisites and environment checks
**Priority:** P0 · **Size:** M · **Depends on:** T0A · **Stories:** S9, S12 (O-12, O-13, O-14)

- **Intent:** Start the PAP work from a clean dependency baseline and prove the platform supports the chosen architecture before building on it.
- **Expected Outcomes:**
  - Runtime audit findings (KI-014) already fixed by **T0A** (precondition, verified here by a fresh `npm audit --omit=dev`).
  - `pdfmake` and `@zip.js/zip.js` added to `api/` with lock file updated; `npm audit --omit=dev` shows no new findings.
  - SWA API size limit confirmed on a preview deployment (fallback `pdfkit` decided if not).
  - Real storage account verified/applied via `verify-storage-account.ps1`; the retention period (`-RetentionDays`, default 90) lives only in the lifecycle policy — there is no application setting for it.
- **Todo List:**
  1. Confirm T0A is done: `cd api && npm audit --omit=dev` shows 0 high/critical findings and `npm test` is green.
  2. Add `pdfmake` and `@zip.js/zip.js` (latest stable, licence check) and re-run audit.
  3. Deploy a preview (`deploy-preview.yml`) containing both libs; record the API size result.
  4. Run the verify script read-only, then `-Apply` if the account has no other lifecycle rules; record in [`05-deployment-guide.md`](05-deployment-guide.md).
  5. Add env settings docs: `QES_PROVIDER`, blob container config.
- **Relevant Context:** [`KNOWN-ISSUES.md`](KNOWN-ISSUES.md) KI-014, [`api/package.json`](../api/package.json), [`infra/pap-pdf-storage/`](../infra/pap-pdf-storage/README.md).
- **Acceptance Criteria:** audit clean for new packages; preview deploy succeeds; storage check passes (StorageV2, no HNS, no soft delete/versioning); runbook updated.
- **Risks:** SWA size limit unknown (+~30 MB); `npm audit fix --force` must not be used blindly; one lifecycle policy per account (merge with existing rules).
- **Status:** `[ ] pending`

---

### T1 — Registry, types and list filter for `pap_test` (Story 8, part 1)
**Priority:** P0 · **Size:** M · **Depends on:** D3, D4

- **Intent:** Make the system recognise `pap_test` everywhere a type allowlist or type config exists, without adding special infrastructure.
- **Expected Outcomes:**
  - `GET /v1/examinations?examination_type=pap_test` is accepted (no 400).
  - `Examination` carries server-controlled fields outside `data`; `PapTestData` type exists.
  - `GET /v1/examinations` supports `is_signed=true|false`, valid only with `examination_type=pap_test`.
  - Frontend `EXAM_TYPES` and `EXAM_TYPE_CONFIG` contain `pap_test` (label, config) so that no silent fallback to prenatal occurs.
- **Todo List:**
  1. Add `pap_test` to backend `EXAM_TYPES` and frontend `EXAM_TYPES`; add an `EXAM_TYPE_CONFIG.pap_test` entry (there is no `SECTION_VISIBILITY` any more — verify the config drives form, detail page and PDF, and that no component falls back to the first type).
  2. Extend `api/src/types/index.ts` and `frontend/src/types/index.ts`: `PapTestData` (`materialSource`, `clinicalDiagnosis`, `specimenAdequacy`, `generalCategorization`, `bethesdaInterpretation`, `recommendation`, `microscopicDescription`), and `isSigned`, `signedBy`, `signedByName`, `signedAt`, `signatureProvider`, `signatureEnvelope`, `pdfBlobName`, `pdfSha256` on `Examination`; update the `examinationType` comment.
  3. Add central option lists (specimen adequacy, general categorization, Bethesda interpretation, material source allowlist) in one constants location shared in spirit by FE and BE (mirrored files, as for exam types).
  4. `GetExaminations`: parse `is_signed`, allowlist-validate, reject without `examination_type=pap_test`, add `isSigned eq` OData clause; apply the same on `GetExaminationsCount` (pending count N).
  5. Make `isSigned` present on both the `EXAM` row and the `PATIENT_` row (the `patient_id` query path reads the latter).
- **Relevant Context:** [`api/src/constants/examinationTypes.ts`](../api/src/constants/examinationTypes.ts), [`frontend/src/constants/examinationTypes.ts`](../frontend/src/constants/examinationTypes.ts), [`GetExaminations.ts`](../api/src/functions/examinations/GetExaminations.ts), [`GetExaminationsCount.ts`](../api/src/functions/examinations/GetExaminationsCount.ts), [`types/index.ts`](../api/src/types/index.ts:209).
- **Acceptance Criteria:** list/count accept `pap_test` and `is_signed`; invalid `is_signed` → 400; `is_signed` without `pap_test` → 400; prenatal-only columns hidden for `pap_test` in lists (see T10).
- **Risks:** `Examination.status` union unchanged; `examinationSchema` `valid(...EXAM_TYPE_KEYS)` auto-picks up the new key; tests asserting exact key lists need updating.
- **Status:** `[ ] pending`

---

### T2 — Create/Update rules for `pap_test` (Stories 1, 3, 4 backend; Story 8 AC 6–8)
**Priority:** P0 · **Size:** L · **Depends on:** T1, T9 (audit names)

- **Intent:** Accept partial PAP data on drafts, enforce completion rules on `completed`, and keep signature/PDF fields server-controlled.
- **Expected Outcomes:**
  - `pap_test` create works without `gestationalAge`, with exactly one fetus carrying the PAP fields (D3); `isSigned=false` set by server; `patientAgeAtExam` derived from `birthDate`.
  - Draft saves: type/length/allowlist checks only. `completed`: `specimenAdequacy` required; *Satisfactory* → `generalCategorization` + `bethesdaInterpretation` required; *Unsatisfactory* → `notes` non-empty.
  - Completing an already `completed` test is not an error and leaves signature fields untouched.
  - Client-supplied signature/PDF fields are ignored or rejected on create and update.
- **Todo List:**
  1. Add an optional `pap` sub-schema (allowlists, length limits, all fields optional so drafts can be partial) to `fetusSectionSchema` in `validation.ts`; for `pap_test` additionally require `data.fetuses.length === 1`, and reject `pap` on other types; keep prenatal/first-trimester behaviour byte-identical.
  2. Add merged-data validation for update: current `UpdateExamination` validates `data` only when supplied (`data !== undefined ? data : undefined`), so the completion rules must use stored data merged with the request (needs `deserializeExaminationData` of the existing row).
  3. `CreateExamination`: set `isSigned=false` for `pap_test`; verify `serializeExaminationData` round-trips `fetuses[0].pap` unchanged.
  4. `UpdateExamination`: keep sign fields out of the body destructuring (already true) and add a test proving it; do not reset sign/PDF fields on edit or revert to `draft` (accepted gap — KI-017).
  5. No change to delete permissions (D1: admin-only); frontend must not offer Delete to non-admins.
  6. Tests: validation unit tests (partial draft, each completion rule, allowlists, length limits), integration tests (create → partial update → complete → re-complete, stale etag → 409).
- **Relevant Context:** [`validation.ts`](../api/src/shared/validation/validation.ts:214), [`examinationSerializer.ts`](../api/src/shared/storage/examinationSerializer.ts), [`CreateExamination.ts`](../api/src/functions/examinations/CreateExamination.ts), [`UpdateExamination.ts`](../api/src/functions/examinations/UpdateExamination.ts), [`api/src/tests/utils/validation.test.ts`](../api/src/tests/utils/validation.test.ts), [`api/src/tests/integration/examinations.test.ts`](../api/src/tests/integration/examinations.test.ts).
- **Acceptance Criteria:** all rules of Story 4 AC2/AC5 and Story 8 AC6–8 covered by tests; no regression in the existing 2 types.
- **Risks:** Highest regression risk in the plan (shared validator). Update's primary-row sync copies a fixed field list — any new field written by T6 must update both rows. 409 mapping relies on matching the error message string `Concurrency conflict`.
- **Status:** `[ ] pending`

---

### T3 — Blob storage service and lifecycle conventions (Story 12 core)
**Priority:** P0 · **Size:** M · **Depends on:** T0

- **Intent:** One backend module owns all PDF blob access so every flow shares the same missing-blob semantics.
- **Expected Outcomes:** a service in `api/src/shared/storage/` with: upload (tag `state=pending`), commit (tag `state=committed`), read (stream), exists, delete-if-exists (idempotent); blob name built as `pap/{examinationId}/{guid}.pdf` in container `pap-pdfs`; no retention logic or setting in the app (retention is the lifecycle policy's job).
- **Todo List:**
  1. Implement the service with `@azure/storage-blob`, using the same connection-string convention as `tableClient.ts` (`AZURE_STORAGE_CONNECTION_STRING`, Azurite locally).
  2. Map `BlobNotFound`/404 to a typed "blob missing" result consumed by T6/T7.
  3. Never expose blob names or URLs to clients.
  4. Unit tests against Azurite (or mocks following the existing test style): upload/commit/read/exists/missing/delete-twice.
- **Relevant Context:** [`tableClient.ts`](../api/src/shared/storage/tableClient.ts), [`infra/pap-pdf-storage/lifecycle-policy.template.json`](../infra/pap-pdf-storage/lifecycle-policy.template.json), O-4 report section on Azurite checks.
- **Acceptance Criteria:** Story 12 AC3, 4 (app side), 11; AC1 (no app-side retention setting).
- **Risks:** Azurite does not run lifecycle policies; app/policy prefix coupling (`pap-pdfs/pap/`).
- **Status:** `[ ] pending`

---

### T4 — QES provider abstraction with mock (Story 10)
**Priority:** P0 · **Size:** S · **Depends on:** none

- **Intent:** Callers depend only on the interface so a real provider can be swapped in later (KI-015).
- **Expected Outcomes:** `sign(documentHash, signerInfo) → { signatureEnvelope, signerName, signedAt, provider }`; `QES_PROVIDER` selects the provider (default `mock`, unknown → server log + generic client error); mock is deterministic, needs no PIN/OTP, supports injectable "offline", "rejected" and configurable latency.
- **Todo List:** interface + factory; mock with failure injection via config (test-only switches); unit tests for each failure mode; make sure secrets/placeholders are never logged.
- **Relevant Context:** new folder under `api/src/shared/` (e.g. `qes/`).
- **Acceptance Criteria:** Story 10 AC1–5.
- **Risks:** Failure-injection switches must not be reachable from client input.
- **Status:** `[ ] pending`

---

### T5 — Server-side PAP PDF renderer (Story 9 AC1–3, Story 5 mock marker, Story 7 AC4)
**Priority:** P0 · **Size:** L · **Depends on:** T0

- **Intent:** Produce the signed report PDF from the Table record without the browser.
- **Expected Outcomes:** `pdfmake` renderer with bundled Roboto; content per Story 9 AC2 (patient, birth date/age, MRN, collection date, material source, clinical info, cytology findings, notes, signer name + time, signature block, "TEST SIGNATURE – NOT LEGALLY VALID" when `QES_PROVIDER=mock`, "recreated" notice with date/user); Cyrillic labels render correctly.
- **Todo List:**
  1. Configure `setUrlAccessPolicy` / `setLocalAccessPolicy` to deny everything (hardening).
  2. Implement layout, Bulgarian/English labels, pagination.
  3. Return `{ buffer, sha256 }`.
  4. Tests: text round-trip incl. Cyrillic, marker present for mock, recreated notice, no network/file access.
- **Relevant Context:** O-4 report (render ≈100 ms cold), existing frontend report content in `frontend/src/reports/` for wording only (the `jspdf` code is not reused).
- **Acceptance Criteria:** Story 9 AC1–3 and AC7 hardening.
- **Risks:** Bundle size (fallback `pdfkit`); PDF text assertions need a parsing helper.
- **Status:** `[ ] pending`

---

### T6 — Sign, get-PDF and recreate endpoints (Stories 5, 7, 9, 12)
**Priority:** P0 · **Size:** XL · **Depends on:** T1–T5, T9

- **Intent:** The core signing flow with correct idempotency and failure compensation.
- **Expected Outcomes:**
  - `POST /v1/examinations/{id}/sign`: loads current row, requires `status=completed` and not deleted; `isSigned=true` → returns the existing result without signing; otherwise render → SHA-256 → QES mock → upload (`pending`) → Table update with ETag (`isSigned`, `signedBy` = caller, `signedByName`, `signedAt`, `signatureProvider`, `signatureEnvelope`, `pdfBlobName`, `pdfSha256`) → tag `committed`. ETag conflict ⇒ "already signed". Failure after upload ⇒ immediate blob delete.
  - `GET /v1/examinations/{id}/pdf`: streams the stored PDF; 404 (missing/deleted/never signed); **410** when reference cleared or blob missing, plus self-healing dereference (clear `pdfBlobName`/`pdfSha256`, keep `isSigned`/signer fields, ignore ETag conflicts).
  - `POST /v1/examinations/{id}/pdf`: checks real blob existence; if present returns it unchanged; else renders, signs as the recreating user, stores a new blob, updates signer fields, adds "recreated" notice, leaves data/status unchanged.
  - Duration of provider call and overall request logged without PHI (Story 10 AC7).
- **Todo List:**
  1. Shared helper `signAndStore(exam, patient, user)` used by sign and recreate.
  2. Write sign fields to **both** the `EXAM` row and the `PATIENT_` row (see T2 risk) and keep `isSigned` filterable.
  3. Routes with explicit `v1/...` names; register via `app.http`.
  4. Integration tests: happy path, idempotent re-sign, two concurrent signs, draft rejected, deleted exam, provider offline/rejected leaves exam pending, Table failure deletes blob, 410 + dereference, recreate paths, signer = caller.
- **Relevant Context:** [`authMiddleware.ts`](../api/src/shared/auth/authMiddleware.ts), [`tableClient.ts`](../api/src/shared/storage/tableClient.ts) (`updateEntity` requires `etag`), [`responseHelpers.ts`](../api/src/shared/http/responseHelpers.ts) (binary streaming and CORS headers need checking).
- **Acceptance Criteria:** Story 5 AC4, Story 7 AC1–6, Story 9 AC4 (first three endpoints), Story 12 AC5–6.
- **Risks:** Non-transactional multi-row writes (orphan blobs/inconsistent rows); `successResponse()` is JSON-only so PDF streaming needs a dedicated response path; per-sign target < 3 s is only verifiable with the real provider (KI-015, O-16).
- **Status:** `[ ] pending`

---

### T7 — ZIP email endpoint (Story 6 backend, Story 9 AC4–6)
**Priority:** P1 · **Size:** L · **Depends on:** T3, T6

- **Intent:** Email the unchanged signed PDF inside a ZIP using the caller's SMTP provider.
- **Expected Outcomes:** `POST /v1/examinations/{id}/email-report-zip` with `recipient_email`, `subject`, `message`, `encrypt_zip` (default `true`), `zip_password` (≥ 8 chars when encrypted). Validates everything before opening SMTP (exam exists, not deleted, `pap_test`, `isSigned=true`, blob readable else 410, recipient format/length, password length, attachment size). ZIP built in memory with `@zip.js/zip.js` (`useWebWorkers:false`, AES-256 `encryptionStrength:3`, `zipCrypto:false`; plain without password); file `{mrn}_{examDate}.pdf`; body states ZIP/password-sent-separately/AES tool hint; on `202` sets status `reviewed`. Existing `email-report` unchanged.
- **Todo List:**
  1. Extract (export) the reusable helpers (`defaultFileName`, `getExamTypeLabel`, provider load/decrypt) from `EmailExaminationReport.ts` **without changing its contract**, or duplicate minimally if extraction would touch its behaviour.
  2. Add a validator for the new request (allowlists, lengths) next to `validateEmailReport`.
  3. Audit event with `zipEncrypted` and `recipientOverridden`; never log password or treatment text.
  4. Tests: both ZIP modes (round-trip bytes identical), wrong password fails, 410, size limit, SMTP mocked as in existing `emailReport.test.ts`.
- **Relevant Context:** [`EmailExaminationReport.ts`](../api/src/functions/system/EmailExaminationReport.ts), [`api/src/shared/email/`](../api/src/shared/email), [`api/src/tests/integration/emailReport.test.ts`](../api/src/tests/integration/emailReport.test.ts), [`send-by-email-req-spec.md`](send-by-email-req-spec.md).
- **Acceptance Criteria:** Story 6 AC4–8, Story 9 AC5–6, Story 12 AC6 (410 before SMTP).
- **Risks:** `@zip.js/zip.js` CommonJS import under `tsconfig` (spike says works); Explorer/WinRAR client compatibility is unverified (O-15); `status → reviewed` write must use ETag and not fail the already-accepted send.
- **Status:** `[ ] pending`

---

### T8 — Delete cascades for PDF blobs (Story 12 AC8–10)
**Priority:** P1 · **Size:** M · **Depends on:** T3

- **Intent:** Exam and patient deletion permanently remove PDF blobs without breaking soft delete.
- **Expected Outcomes:** `DeleteExamination` deletes the exam's blob (404 ignored); `DeletePatient` deletes all blobs of the patient's `pap_test` exams across its three-pass cascade; blob delete failures never roll back the soft delete and are logged + audited.
- **Todo List:** hook blob deletion into both flows after the soft-delete writes; tests for happy path, missing blob, storage failure (delete still succeeds).
- **Relevant Context:** [`DeleteExamination.ts`](../api/src/functions/examinations/DeleteExamination.ts), [`DeletePatient.ts`](../api/src/functions/patients/DeletePatient.ts).
- **Acceptance Criteria:** Story 12 AC8–10.
- **Risks:** Leftover blob if the failure path is hit — covered by retention rule only (KI-021).
- **Status:** `[ ] pending`

---

### T9 — Audit events (Story 13)
**Priority:** P1 · **Size:** M · **Depends on:** none (consumed by T2, T6–T8)

- **Intent:** Traceability of signing, PDF and ZIP email events in the existing audit log.
- **Expected Outcomes:** helpers in [`auditService.ts`](../api/src/shared/audit/auditService.ts) for sign attempt/success/failure (reason code only; no "bulk sign started" event — bulk signing is audited only through the individual sign events), recreate (previous + new signer), PDF download/print, ZIP email sent, status→reviewed (manual/automatic), missing blob detected/dereferenced, PDF deleted with exam/patient, blob delete failure. No PHI beyond identifiers; no treatment text, password or secrets.
- **Todo List:** define action names; add helpers; add tests that audit details contain no forbidden fields; verify entries render in the existing audit screen.
- **Relevant Context:** [`auditService.ts`](../api/src/shared/audit/auditService.ts), KI-013 note: sanitiser's blocked-field list is unreliable → avoid sensitive key names.
- **Acceptance Criteria:** Story 13 AC1–5.
- **Risks:** None specific. Decision: the "bulk sign started" event is dropped; only individual sign events are audited (Story 13 AC2 amended).
- **Status:** `[ ] pending`

---

### T10 — Frontend: registry, form, detail and list display (Stories 1, 3, 4, 8 AC10)
**Priority:** P1 · **Size:** L · **Depends on:** T1, T2

- **Intent:** Doctors create/edit PAP drafts; specialists enter cytology and mark completed.
- **Expected Outcomes:** `pap_test` selectable in the form; only PAP sections shown (no biometry/doppler/gestational age); fields: Material Source (controlled list), Collection Date (`examDate`, default today), Clinical Diagnosis & Symptoms, Notes, cytology dropdowns/textareas; MRN shown prominently after save; "Save" (draft, partial) and "Mark as completed"; conflict message + reload on stale etag; detail page read-only collection data; lists show label, status tag and **Signed / Awaiting signature** indicator and hide prenatal-only columns.
- **Todo List:**
  1. Adapt `ExaminationForm`, `useExaminationForm`, `ExaminationSections`, `ExaminationDetailPage`, `ExaminationsPage`, `PatientDetailPage` to a PAP branch driven by `EXAM_TYPE_CONFIG` (check every place the fetus/biometry model is assumed, e.g. `useExaminationForm.ts`, `formData.ts`). Per D3 the form always submits exactly one fetus with the PAP fields in `fetuses[0].pap`; fetus-count controls and biometry/doppler/anatomy sections are hidden for `pap_test`.
  2. Add `getStatusTag`-style signed indicator (Carbon `<Tag>`; reuse [`statusHelpers.tsx`](../frontend/src/utils/statusHelpers.tsx)).
  3. Keep ETag-in-body and `isConcurrencyConflict` pattern in [`examinationService.ts`](../frontend/src/services/examinationService.ts).
  4. Use `useAutoNotification` for notifications; follow Carbon patterns (consider `carbon-design-system` skill during implementation).
  5. Component tests for form visibility and completion button.
- **Relevant Context:** `frontend/src/features/examinations/*`, `frontend/src/hooks/useExaminationForm.ts`, `frontend/src/types/formData.ts`.
- **Acceptance Criteria:** Story 1 AC1–7, Story 3 AC1–6, Story 4 AC1/AC4, Story 8 AC10.
- **Risks:** The form hook is built around fetuses; with D3 the fetus model is reused (fetus count fixed at 1), but a separate lightweight PAP hook may still be cleaner than adding branches.
- **Status:** `[ ] pending`

---

### T11 — Frontend: draft list, name lookup, older-drafts hint (Story 2)
**Priority:** P1 · **Size:** L · **Depends on:** T10

- **Intent:** Specialist works through drafts in any order, on desktop and phone.
- **Expected Outcomes:** list filtered `examination_type=pap_test&status=draft` + date range (default last 7 days); client follows continuation tokens (page size 100, empty pages with token followed) with loading indicator, then sorts by patient name (case-insensitive, Bulgarian-aware, ties `examDate`, MRN); 1,000-row safety cap message; retry on page failure, never show partial list as complete; manual Refresh; Enter/button-only name search; older-drafts banner with "Extend range" (90-day look-back, `pageSize=1`, max 10 pages, silent on failure, boundary dates identical to stored `examDate` format); hosts the "Sign completed (N)" control.
- **Todo List:** new page/route + service method; state machine for loading/capped/error; implement the hint check; no onChange/debounced search (project rule); unit tests for the paging loop, cap, sort comparator, hint.
  - **Name lookup (D2):** the search box offers two modes, submitted only by Enter/button. **Default mode (A):** `/v1/patients-search` → pick/resolve the patient → draft list by `patient_id` (clear messages for unknown patient / deleted patient / no PAP draft). **Alternative mode (B):** one call to `GET /v1/examinations` with `patient_name`, `examination_type=pap_test`, `status=draft`. Persist the user's mode choice for the session only (no PHI in storage). Clearing the search returns to the full draft list.
  - Add the menu/dashboard shortcut route for the list (visible to roles `doctor` and `admin`).
- **Relevant Context:** [`examinationService.ts`](../frontend/src/services/examinationService.ts), [`patientService.ts`](../frontend/src/services/patientService.ts), `/v1/patients-search`, `Layout.tsx` (navigation), `DashboardPage.tsx`, D2.
- **Acceptance Criteria:** Story 2 AC1–7 and all edge cases.
- **Risks:** Table Storage may return empty pages with tokens; 1,000-row cap vs 90-day extension.
- **Status:** `[ ] pending`

---

### T12 — Frontend: bulk "Sign completed" (Story 5)
**Priority:** P1 · **Size:** L · **Depends on:** T6, T11

- **Intent:** Non-blocking bulk signing with progress, cancel, retry, resume.
- **Expected Outcomes:** button "Sign completed (N)" (disabled at 0) → confirmation naming the current user → client works through pending list with concurrency 2–3 calling `POST /v1/examinations/{id}/sign`; application-level state (survives navigation) with done/failed/remaining progress; cancel keeps signed tests signed; summary lists MRN + generic reason per failure; "Retry failed"; resume after app close via re-click (idempotent); handles connectivity loss gracefully.
- **Todo List:** app-level context/store (alongside `AuthContext`), worker loop with concurrency limiter and cancel token, UI progress component, tests with mocked service (success, partial failure, cancel, 401 handling).
- **Relevant Context:** [`AuthContext.tsx`](../frontend/src/contexts/AuthContext.tsx) (session cleared on logout → clear sign state), [`api.ts`](../frontend/src/services/api.ts) 401 handling.
- **Acceptance Criteria:** Story 5 AC1–6.
- **Risks:** 401 mid-run triggers redirect (state must be cleared); concurrent users double-signing is covered by server idempotency.
- **Status:** `[ ] pending`

---

### T13 — Frontend: review, print, ZIP email, recreate (Stories 6, 7)
**Priority:** P1 · **Size:** L · **Depends on:** T6, T7, T10

- **Intent:** Doctor prints/emails the signed PDF and marks reviewed; handles missing PDFs.
- **Expected Outcomes:** list shows Signed / Awaiting signature; detail offers Print (fetch `GET .../pdf`, print that file; `jspdf` not used for `pap_test`), Email modal (recipient prefilled from `Patient.email` with warning if missing, subject default, treatment text, "Protect ZIP with password" on by default with `DDMMYYYY` birth-date password visible/editable ≥ 8 chars; off ⇒ explicit unprotected-warning confirmation), "Mark as reviewed"; disabled with "Awaiting signature" when unsigned; on 410 actions swap to "Recreate PDF" with an informational message.
- **Todo List:** new `examinationService` methods; modal component (new, not the existing email dialog contract); print flow via blob URL revoked after use; tests for toggle/password rules and 410 handling.
- **Relevant Context:** [`EmailReportButton.tsx`](../frontend/src/reports/EmailReportButton.tsx), [`PrintButton.tsx`](../frontend/src/reports/PrintButton.tsx) (existing flows stay for other types), [`emailErrors.ts`](../frontend/src/utils/emailErrors.ts).
- **Acceptance Criteria:** Story 6 AC1–9, Story 7 AC1, 6.
- **Risks:** The treatment text must not be stored; the password is shown to the user by design.
- **Status:** `[ ] pending`

---

### T14 — PWA support (Story 11)
**Priority:** P2 · **Size:** L · **Depends on:** T11, T12

- **Intent:** Installable web app for bench use.
- **Expected Outcomes:** manifest, icons, service worker (app shell offline, offline indicator, friendly API failure message; **no caching of API responses or PHI**); phone-width layouts and touch targets for draft list, search, cytology form, mark completed, Sign completed progress; session expiry/logout clears client state; keeps cookie-first auth.
- **Todo List:** add PWA tooling to `frontend` (evaluate `vite-plugin-pwa` against Vite 8, latest stable and maintained); verify CSP and `navigationFallback` do not break the service worker; responsive pass at phone widths; Lighthouse PWA/accessibility audit; measure draft list of 50 rows < 3 s on 4G.
- **Relevant Context:** [`vite.config.ts`](../frontend/vite.config.ts), [`staticwebapp.config.json`](../frontend/staticwebapp.config.json).
- **Acceptance Criteria:** Story 11 AC1–7.
- **Risks:** Service worker caching rules and PHI; tooling compatibility with Vite 8; no camera/barcode.
- **Status:** `[ ] pending`

---

### T15 — Verification, documentation and test-case updates
**Priority:** P2 · **Size:** M · **Depends on:** all

- **Todo List:**
  1. Manual client checks (O-15): plain ZIP in Windows Explorer 10/11; AES-256 ZIP in WinRAR.
  2. Measure end-to-end sign time on a deployed instance (O-16) — baseline with mock.
  3. Update [`04-api-spec`](04-api-specification.md), [`02-database-design`](02-database-design.md), [`03-security-architecture`](03-security-architecture.md), [`05-deployment-guide`](05-deployment-guide.md), [`TEST-CASES.md`](TEST-CASES.md), [`AGENTS.md`](../AGENTS.md) (remove stale `SECTION_VISIBILITY` wording; add PAP conventions).
  4. Run `cd api && npm test` and frontend `npm test` / `npm run lint` / `npm run build`.
- **Acceptance Criteria:** all suites green with no new warnings; docs reflect new endpoints and settings.
- **Status:** `[ ] pending`

---

## 6. Risk & Blocker Register

| ID | Risk / blocker | Impact | Mitigation | Owner task |
|---|---|---|---|---|
| R1 | Pre-existing high/critical runtime audit findings (KI-014) in `api/` and `frontend/` | Blocks adopting new deps under the security policy | Fix first (O-12) as dedicated sub-task; never `--force` blindly | T0A |
| R13 | Dependency upgrades in T0A cause regressions in existing features (validation messages, Azure SDK behaviour, test tooling) | Breaks existing functionality | One package per step, full test suites + `swa start` smoke check; split risky majors into documented follow-ups | T0A |
| R2 | SWA managed-function size limit with +30 MB deps unknown | Deploy failure | Preview deploy early; fallback `pdfkit` | T0 |
| R3 | Storage account unverified (HNS, soft delete, versioning, one lifecycle policy) | Retention rules silently ineffective or overwrite existing rules | Run verify script; merge rules | T0 |
| R4 | Shared Joi schema is fetus-based | Regression of existing exam types | D3: reuse it (one fetus + optional `pap` key); full regression run | T2 |
| R5 | Non-transactional multi-row writes (EXAM + PATIENT_ rows, blob + Table) | Orphan blobs, inconsistent `isSigned` | Write both rows, delete blob on failure, tag `pending`/`committed`, lifecycle backstop | T6 |
| R6 | Doctor delete vs admin-only `DeleteExamination` | Resolved by D1 | Story 1 AC7 amended; no code change | T2 |
| R7 | PDF streaming through `successResponse()` (JSON only) | Binary response not supported | Dedicated response helper with CORS headers | T6 |
| R8 | 3 s per-sign target only verifiable with real QES | Unverified performance | Baseline with mock; verify in KI-015 | T15 / KI-015 |
| R9 | AES-ZIP/Explorer/WinRAR compatibility unverified | Patient cannot open ZIP | O-15 manual checks; unencrypted option exists | T15 |
| R10 | Accepted: edits after `completed`/signed not locked; stale PDF | Content/PDF divergence | Documented; KI-017 | — |
| R11 | Bulk-sign-started audit event has no server entry point | Resolved: event dropped, individual sign events only | Story 13 AC2 amended; no code | T9 |
| R12 | Lifecycle deletion lags up to ~1 day; policy changes take ≤ 24 h | Expiry not exact | Documented, accepted | — |

---

## 7. Definition of Done (per sub-task)

- Code follows project conventions (single quotes, semicolons in frontend; `import type`; backend `strict:false` CommonJS).
- Tests added and relevant suites pass: `cd api && npm test`, frontend `npm test`, `npm run lint`, `npm run build`.
- No PHI, secrets, ZIP passwords or treatment text in logs or audit details.
- Plan file status updated to `[x] done`, context for the next sub-task noted under that sub-task.
