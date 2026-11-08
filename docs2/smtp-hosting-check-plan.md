# SMTP Hosting Check — Minimum Plan (verifies NFR-03)

**Related spec:** [`send-by-email-req-spec.md`](send-by-email-req-spec.md) — NFR-03, R-01, A-01
**Scope:** only answer one question: *can the deployed API reach the Google and Yahoo SMTP servers, on the ports the spec uses, and complete a TLS-protected SMTP handshake?* No part of the send-by-email feature is built here.

---

## Top-Level Overview

**Why a hosted test is needed.** Both deploy workflows (`.github/workflows/deploy-production.yml`, `deploy-preview.yml`) publish the API with `api_location: api`, i.e. as Azure Static Web Apps (SWA) managed functions on the free tier. `docs2/05-deployment-guide.md` describes a separate Function App, but that is not what the pipelines deploy. Outbound network rules of the SWA managed environment cannot be read from the repository, so the only reliable evidence is a test that runs there. A test from a developer machine only shows what the local network allows.

**Approach.** Add one temporary, admin-only diagnostic function that opens connections to a fixed list of well-known SMTP servers and reports how far each one got (DNS, TCP, TLS, SMTP greeting, STARTTLS). It sends no credentials and no email. Deploy it to a PR preview environment, call it, record the result in the spec, then delete the function. The probe code is never merged to `master`.

**What is tested** (all fixed in code, none taken from the request):

| Target | Why |
|---|---|
| `smtp.gmail.com:587` (STARTTLS) | Google preset in A-01 |
| `smtp.mail.yahoo.com:587` (STARTTLS) | Yahoo preset in A-01 |
| `smtp.gmail.com:465` (implicit TLS) | Fallback if 587 is blocked |
| `smtp.mail.yahoo.com:465` (implicit TLS) | Fallback if 587 is blocked |
| `smtp.gmail.com:25` | Informational only; commonly blocked, not used by the spec |

**Pass criteria for each target:** the TCP connection opens, the server sends a `220` greeting, and the TLS upgrade (STARTTLS on 587, direct TLS on 465) completes with TLS 1.2 or higher. This also gives early evidence for NFR-01.

**Decision after the result:**

| Result | Consequence |
|---|---|
| 587 passes for Google and Yahoo | Spec stays as written. NFR-03 closed. Proceed to the full implementation plan. |
| 587 blocked, 465 passes | Presets in A-01 and requirement 1.3/1.4 change to implicit TLS on 465. Needs stakeholder confirmation before implementation. |
| Only some targets pass (for example Google works, Yahoo does not) | Report which presets are viable. Stakeholder decides whether to ship with fewer presets. |
| Nothing passes | The SMTP design cannot run on this hosting. Stop and return to the stakeholder; options (different hosting for the API, or a different delivery approach) are a new decision, not part of this plan. |

**Non-goals.** No `nodemailer` dependency, no authentication to the mail servers, no real email, no encryption or profile work, and no request-size check (NFR-04 / R-02 are separate and are not covered here).

---

## Sub-Tasks

### 1. Add the temporary probe function

- **Intent:** a minimal diagnostic that runs inside the hosted API and reports connectivity to the fixed target list.
- **Expected Outcomes:**
  - A new HTTP function exists on a throwaway branch, protected by the existing authentication and restricted to the `admin` role.
  - It uses only Node built-ins (`dns`, `net`, `tls`); `api/package.json` is unchanged.
  - Calling it returns, per target: the furthest stage reached (`dns`, `tcp`, `greeting`, `starttls`, `tls`), success or failure, elapsed milliseconds, the negotiated TLS protocol version, and an error code such as `ETIMEDOUT`, `ECONNREFUSED` or `ENOTFOUND`.
  - Per-target timeout (about 10 s) so one blocked port cannot hang the call; targets are tried in parallel or sequence but the total response stays within the function limit.
  - The probe never sends credentials, `MAIL FROM`, or any message; it ends each session with `QUIT`.
  - The response contains no server banner text beyond the reply code, and the target list cannot be influenced by the caller (no SSRF surface).
- **Todo List:**
  1. Create a throwaway branch from `feature/email` (for example `chore/smtp-probe`). Do not reuse `feature/email` for this code.
  2. Add the probe function following the existing function pattern (registration with `app.http`, `requireAuth` then `requireRole(user, ['admin'])`, `successResponse` / `handleError`).
  3. Implement the staged connection check for the five targets above (STARTTLS flow for 587/25: read `220`, send `EHLO`, confirm `STARTTLS` is advertised, send `STARTTLS`, upgrade; direct TLS flow for 465: handshake, then read `220`).
  4. Build the API (`cd api && npm run build`) and confirm it compiles.
  5. Run the probe locally with `swa start` (see `README-SWA.md`) as a **baseline only** — if it fails locally, the cause may be the local network and the hosted result is the one that counts.
- **Relevant Context:**
  - Function pattern: `api/src/functions/system/EmailExaminationReport.ts`
  - Auth helpers: `api/src/shared/auth/authMiddleware.ts`
  - Response helpers: `api/src/shared/http/responseHelpers.ts`
  - Routes are explicit `v1/...` and `host.json` uses `routePrefix: "api"` (see `AGENTS.md`).
  - Security policy: no hard-coded secrets, TLS ≥ 1.2, certificate validation stays on (do not set `rejectUnauthorized: false`).
- **Status:** `[x] done` — probe added in `api/src/functions/system/SmtpProbe.ts` on branch `chore/smtp-probe` (commit `061cc94`), builds cleanly, 253 existing tests still pass.
- **Local baseline (developer machine, Node 22):** all five targets reached the TLS upgrade; TLS 1.3 negotiated. This only shows the local network allows SMTP; it is **not** evidence for the hosting.
- **Notes for sub-task 2:** the endpoint is `GET /api/v1/diagnostics/smtp-probe`. Authentication is by the `session_token` cookie only (the `Authorization` header is ignored by design), so call it from the logged-in browser session, not with a Bearer token.

### 2. Deploy to a PR preview and run the probe

- **Intent:** obtain the real answer from the SWA hosting environment without touching production code.
- **Expected Outcomes:**
  - The probe runs in a PR preview environment (`pr-<number>`) on the same SWA resource.
  - The raw per-target results are captured.
- **Todo List:**
  1. Push the throwaway branch and open a pull request to `master`. This triggers `deploy-preview.yml`; mark the PR as a draft and title it clearly as a connectivity test that must not be merged.
  2. Wait for the preview deployment, then log in to the preview URL as an admin.
  3. Call the probe endpoint from the browser session (or with the session cookie) and save the JSON response.
  4. Repeat the call once more later to rule out a one-off timeout.
  5. Optionally, if you want to see whether the production environment differs from the preview, repeat on production — only after you decide that adding an admin-only diagnostic to `master` is acceptable. By default this plan does **not** do that.
- **Relevant Context:**
  - `.github/workflows/deploy-preview.yml` — preview environments share the production storage account and app settings (see the warning in that file). The probe is read-only and writes no data, but logging in does update the admin user's login record, so use a normal admin account and perform no other write actions in the preview.
  - Preview and production run on the same SWA resource, so the outbound network behaviour is expected to be the same; this is an assumption and is stated as such in the result.
- **Status:** `[x] done` — PR #10 (draft) deployed to preview `pr-10`; the admin called `GET /api/v1/diagnostics/smtp-probe` in a logged-in browser session on 2026-11-07 and supplied the JSON. One run captured; the optional second run was not done.

### 3. Record the result and remove the probe

- **Intent:** close NFR-03 with evidence and leave no diagnostic code behind.
- **Expected Outcomes:**
  - The spec contains the recorded result and the resulting decision.
  - The probe function and branch are gone; the preview environment is torn down.
- **Todo List:**
  1. Add a short "NFR-03 verification result" entry to `docs2/send-by-email-req-spec.md`: date, environment (preview of SWA free tier), table of targets with stage reached and TLS version, and the decision from the table above.
  2. If the result changes the presets (587 blocked, only 465 works, or a provider is unreachable), update A-01, requirements 1.3/1.4, and the seed values in REQ-EML-02 as agreed with the stakeholder before moving on.
  3. Close the pull request without merging. `deploy-preview.yml` tears the preview environment down on close.
  4. Delete the throwaway branch (local and remote).
  5. Confirm that `master` and `feature/email` contain no probe code.
- **Relevant Context:**
  - Spec sections to update: NFR-03, R-01, A-01, status line at the top.
  - `.github/workflows/deploy-preview.yml` — `close-preview` job.
- **Status:** `[x] done` — result recorded in `send-by-email-req-spec.md` (NFR-03, R-01, section 14). Presets unchanged. Probe removed by closing PR #10 without merging and deleting branch `chore/smtp-probe`.

---

## Confirmed Decisions

- **Hosting model (confirmed by stakeholder):** production runs the API as SWA managed functions on the free tier, as the deploy workflows show. The probe therefore runs in a PR preview environment. The separate Function App described in `docs2/05-deployment-guide.md` is not what is deployed; that guide should be corrected separately, outside this plan.

## Open Points Before Starting

- Confirm that an admin account may be used to log in on a PR preview (it shares production data, and logging in updates that admin user's login record).
