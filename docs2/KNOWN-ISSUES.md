# Known Issues

Bugs confirmed but deferred for later resolution.

---

## KI-001 · Missing `InlineLoading` import in `PatientDetailPage`

- **File:** `frontend/src/pages/PatientDetailPage.tsx` (line 331)
- **Symptom:** Intermittent "Something went wrong" screen with a "Reload Page" button when navigating to a patient's detail page. Clicking reload usually shows the page normally.
- **Root cause:** `InlineLoading` is used on line 331 inside the examinations section (`isLoadingExaminations ? <InlineLoading ... />`) but is not included in the `@carbon/react` import block. When the component first mounts, `isLoadingExaminations` is `true` and React tries to render `<InlineLoading />`, which is `undefined`. This throws a render-time `ReferenceError` that is caught by the top-level `ErrorBoundary` in `App.tsx`, which replaces the entire page with the "Something went wrong" tile.
- **Why reload sometimes works:** `window.location.reload()` tears down and re-mounts the full React tree. On the fresh mount, if the examinations API response arrives fast enough (warm cache, small payload), `isLoadingExaminations` flips to `false` before React reaches that branch, bypassing the crash. The outcome is therefore timing-dependent — not a real fix.
- **Same class as:** TASK-001 (identical root cause in `PatientsPage.tsx`, already fixed).
- **Fix:** Add `InlineLoading` to the existing `@carbon/react` import statement in `PatientDetailPage.tsx`.
- **Priority:** P0 · Blocker (intermittent crash)
- **Status:** ✅ Resolved — `InlineLoading` is now imported at line 9 of `PatientDetailPage.tsx`.

---

## KI-002 · `CalculateExamination` backend endpoint is unreachable and contains formula bugs

- **Files:**
  - `api/src/functions/CalculateExamination.ts` (backend endpoint)
  - `frontend/src/utils/calculations.ts` (actual calculation engine)
  - `frontend/src/components/ExaminationForm.tsx` (calls calculations.ts directly)
- **Symptom:** The endpoint `POST /v1/examinations/{id}/calculate` is registered but produces no user-visible effect because no frontend code calls it.
- **Root cause — three distinct problems:**

  1. **Not wired up.** `examinationService.ts` has no method for the `/calculate` route. `ExaminationForm.tsx` calls `calculations.ts` functions directly on button click (pure client-side); results are included in the normal create/update payload. The backend endpoint is never invoked.

  2. **EFW formula: wrong unit scale.** The backend `calculateEFW()` comments say "Hadlock formula" and the coefficients match, but the inputs are in **mm** and are never converted to **cm** before being applied. The frontend `calcEFW()` correctly divides each input by 10 before using the same coefficients. For a typical BPD=70mm, the backend would compute `log₁₀(EFW) = 1.335 − 0.0034×(220×50) + ...` (AC and FL as mm), yielding a wildly incorrect weight. Additionally, the backend `hc` parameter is accepted but **silently ignored** in the computation; only AC, FL, and optionally BPD are used.

  3. **GA from biometry: wrong target field.** The backend `calculateGestationalAge()` writes its result to `examination.gestationalAge` — the field that holds the clinician-entered **LMP-based** GA — instead of `gestationalAgeFromBiometry`. If the endpoint were ever called it would overwrite the LMP-derived value with a biometry-derived estimate, losing the clinical distinction between the two. The frontend correctly targets `gestationalAgeFromBiometry`.

- **Formula divergence (GA from biometry):** Beyond the field mismatch, the algorithms differ entirely. The backend averages four independent per-measurement polynomials (each operating on raw mm values). The frontend uses a single 4-parameter combined regression `GA = 10.85 + 0.06(HC_cm × FL_cm) + 0.67(BPD_cm) + 0.168(AC_cm)` that requires all four inputs in cm. The two approaches will not produce the same result.

- **Fix options:**
  - **Option A (recommended):** Delete `CalculateExamination.ts`. All calculation logic already lives in the frontend; a server-side recalculation endpoint adds no value with the current architecture.
  - **Option B:** If a server-side endpoint is wanted (e.g., for batch jobs or non-UI clients), rewrite it to mirror `calculations.ts` exactly: convert mm → cm, use the identical Hadlock and combined-regression formulas, and write GA results to `gestationalAgeFromBiometry`. Then wire up `examinationService.ts` to call it.
- **Priority:** P2 · Non-blocking (endpoint is unreachable; existing UI behaviour is unaffected)
- **Status:** Deferred

---

## KI-003 · DR1-03 patient detail exam filter lacks load-more support in current UI

- **Related requirement:** `DR1-03`
- **File:** `frontend/src/pages/PatientDetailPage.tsx`
- **Symptom:** The patient detail page now supports filtering exams by type, but the requirement to keep filtered pagination working with a "Load More" flow could not be fully implemented.
- **Root cause:** [`PatientDetailPage`](../frontend/src/pages/PatientDetailPage.tsx) did not have an existing load-more control, continuation-token flow, or pagination UI for the examinations table. The plan for DR1-03 assumed there was an existing "Load More" handler to extend, but only a single fetch-and-render flow existed. As a result, the type filter and server refetch were implemented, but there is no current UI affordance to request subsequent filtered pages.
- **Impact:** Filtering by exam type works for the initially returned page of results, but users cannot load additional filtered pages from the patient detail exam table.
- **Fix:** Add a dedicated filtered pagination/load-more UX to [`PatientDetailPage`](../frontend/src/pages/PatientDetailPage.tsx) that stores and reuses the continuation token for the active `selectedExamType`.
- **Priority:** P2 · Non-blocking
- **Status:** Superseded by KI-004

---

## KI-004 · `PatientDetailPage` exam sub-table shows only the first server page when filtered by type

- **Related requirement:** DR3-01 (supersedes KI-003)
- **File:** `frontend/src/pages/PatientDetailPage.tsx`
- **Symptom:** When a type filter is selected in the exam sub-table on the Patient Detail page, at most 50 examinations are shown (the default backend page size). There is no "Load More" control, and the `continuationToken` returned by `GET /v1/examinations` is discarded.
- **Decision:** A patient accumulating more than 50 examinations of a single type is considered an **edge case** in the current clinical usage profile. Implementing server-side load-more pagination inside a detail-page sub-table adds meaningful complexity (continuation-token state, append-vs-replace logic, a conditionally visible button) for a scenario that is unlikely to occur in practice.
- **Accepted behaviour:** The exam sub-table on `PatientDetailPage` fetches a single page of results per filter selection. Client-side filtering over that page is sufficient for the expected data volumes.
- **If the edge case materialises:** Revisit this issue. The implementation path is documented in the original DR3-01 defect report (`docs/DEFECTS-ROUND3.md`) and in the removed REQ-3-01 section of the Round 3 requirements spec (removed in the UX improvement pass — see git history). The backend `GET /v1/examinations` endpoint already supports `continuationToken` and `examination_type` query parameters; no backend changes would be needed.
- **Priority:** P3 · Low — accepted edge case
- **Status:** Deferred / Won't fix unless usage patterns change

---

## KI-005 · O(N) full-table scan for total-count metrics is unbounded at scale

- **Affects:**
  - `api/src/functions/GetPatientsCount.ts` — `GET /v1/patients-count` (used by [`DashboardPage`](../frontend/src/pages/DashboardPage.tsx:47))
  - `api/src/functions/GetExaminations.ts` — no examinations-count endpoint exists yet; a `GET /v1/examinations-count` endpoint is required to fix Defect 1 from `defects-r5.txt` (Dashboard "Total Examinations" tile) and to surface filtered totals on the All Exams page (Change 3, same doc)
- **Symptom:** No user-visible symptom at current data volumes. As the patient and examination record counts grow, the count queries will take progressively longer, eventually causing dashboard load latency or Azure Function timeout (default 5 min, but the 30 s HTTP timeout is hit first).
- **Root cause:** Azure Table Storage has no `COUNT(*)` aggregate. The only way to count rows is to iterate over every matching entity. [`GetPatientsCount.ts:22`](../api/src/functions/GetPatientsCount.ts:22) does exactly this — a full scan of the `PATIENT` partition selecting only `PartitionKey` to minimise payload, but still one round-trip unit per entity page (~1 000 entities per page). The same pattern would be replicated for examinations. Both are unbounded O(N) operations.
- **Scale at which this becomes a problem:** Azure Table Storage pages entities in batches of up to 1 000. At 10 000 patients, the count scan issues ~10 sequential HTTP calls to the storage emulator/service. At 100 000 patients it issues ~100. With a conservative 20 ms per page-turn, 100 000 records ≈ 2 s just in storage round-trips, not counting deserialization.
- **Why the current `select: ['PartitionKey']` mitigates but does not solve it:** Projecting only `PartitionKey` reduces per-entity payload size but Azure Table Storage still returns full pages of OData entities; it does not support server-side aggregation. The network and iteration cost scales linearly regardless.

### Candidate solutions (ranked by implementation cost vs. benefit)

| Option | Approach | Cost | Benefit |
|--------|----------|------|---------|
| **A — Denormalized counter row (recommended)** | Maintain a dedicated `COUNTERS/PATIENT_COUNT` and `COUNTERS/EXAM_COUNT` entity in the respective tables. Increment on create, decrement on soft-delete (set `isDeleted = true`). The count endpoint reads a single entity instead of scanning. | Medium — requires coordinated writes in [`CreatePatient.ts`](../api/src/functions/CreatePatient.ts), [`DeletePatient.ts`](../api/src/functions/DeletePatient.ts), [`CreateExamination.ts`](../api/src/functions/CreateExamination.ts), [`DeleteExamination.ts`](../api/src/functions/DeleteExamination.ts). Optimistic concurrency on the counter row (same retry pattern as [`mrnGenerator.ts`](../api/src/utils/mrnGenerator.ts)) handles concurrent writes. | O(1) read. Accurate for total counts. No scan. |
| **B — Cached scan with TTL** | Keep the current scan but cache the result in memory (Azure Function host is long-lived between invocations in consumption plan during warm periods) or in a dedicated `Cache` table row with a `cachedAt` timestamp. Re-run the scan only when the cached value is stale (e.g., TTL = 5 min). | Low — add a cache read/write around the existing loop. | Reduces scan frequency dramatically under normal dashboard usage. Count may lag by up to TTL. |
| **C — Separate Counts table (like MRN `Counters`)** | A dedicated `Counters` Azure Table already exists for MRN generation ([`mrnGenerator.ts`](../api/src/utils/mrnGenerator.ts)). Add `PATIENT_TOTAL` and `EXAM_TOTAL` rows there. Same increments/decrements as Option A but reuses the existing table and the existing optimistic-concurrency retry helper. | Low-Medium — same coordinated writes as A, but no new table needed. | O(1) read. Consistent with existing counter pattern in the codebase. **This is the preferred variant of Option A.** |
| **D — Accept the scan (current state)** | Do nothing until a performance problem is observed in production. | Zero | Risk of dashboard timeout at scale; acceptable only if the dataset is expected to remain small (< 5 000 records). |

- **Recommended path:** Option C — extend the existing `Counters` table (already used by `mrnGenerator.ts`) with `PATIENT_TOTAL` and `EXAM_TOTAL` partition rows. Update create/delete functions to increment/decrement with optimistic-concurrency retries. Count endpoints become single-entity reads. This is consistent with the established pattern, adds no new infrastructure, and scales to any data volume.
- **Priority:** P3 · Low — no current impact; becomes P1 if data volume exceeds ~20 000 combined records
- **Status:** Deferred — document and track; implement Option C before dashboard count endpoints are added for examinations

---

## KI-006 · `SearchPatients` endpoint allows silent bulk patient enumeration

- **File:** `api/src/functions/SearchPatients.ts` (lines 9, 53–71, 73–77)
- **Severity:** 🟡 Medium — insider / stolen-credential threat; no unauthenticated exposure
- **Priority:** P2 · Non-blocking at current data volumes; elevate to P1 for GDPR compliance review
- **Status:** Deferred — document and track; implement mitigations before production deployment with real patient data

### Symptom

Any authenticated user (including `viewer` role) can retrieve the full patient list — names, phone numbers, email addresses, birth dates, and addresses — by issuing a small number of sequential search requests. There is no audit trail for search queries.

### Root Cause Analysis

#### Storage layout

Patient creation writes two rows to the `Patients` table (see [`CreatePatient.ts:81-88`](../api/src/functions/CreatePatient.ts:81)):

```
PartitionKey              | RowKey
--------------------------|---------------------------------
PATIENT                   | {patientId}            ← primary record
PATIENT_SEARCH_{bucket}   | {normalizedName}_{patientId}   ← search index
```

`bucket` is the 4-hex Unicode code-point of the first character of the normalised name (e.g. `0061` for Latin "a", `0438` for Cyrillic "и"). The search index row key starts with the full normalised name, so a prefix query for `"ив"` hits only rows whose name starts with "ив" within the `PATIENT_SEARCH_0438` partition.

#### How the endpoint works

[`SearchPatients.ts:53-58`](../api/src/functions/SearchPatients.ts:53) calls `queryEntities()` with:

- `partitionKey = PATIENT_SEARCH_{bucket}` (derived from the first character of the search term)
- `rowKeyPrefix = normalizedSearch` (the full 2+ character search string)

[`tableClient.ts:80`](../api/src/utils/tableClient.ts:80) turns this into an OData range query:

```
RowKey ge '{prefix}' and RowKey lt '{prefix}\uFFFF'
```

The function then fetches the full `PATIENT` entity for each matching search row (one `getEntity` call per result), assembles all matching patients, and returns them with no pagination and no audit event. The `MAX_RESULTS = 1000` cap is a deliberate product requirement (D4-02 in [`REQUIREMENTS.md:219`](../docs2/REQUIREMENTS.md:219)): the endpoint must return **all** matches for a given prefix so the frontend can display a complete result set.

#### Enumeration attack

The minimum search length is 2 characters ([`SearchPatients.ts:47-49`](../api/src/functions/SearchPatients.ts:47)). Because the row key prefix is the full normalised name, a 2-character query like `"ив"` returns only patients whose names start with "ив", not the entire "и" bucket. This makes single-character enumeration impossible — but systematic 2-character enumeration remains feasible:

- For a Bulgarian clinical deployment the practical character space is ~30 Cyrillic + ~26 Latin starting characters, each with ~10–30 common second characters ≈ roughly 200–400 prefix pairs to cover the entire patient population.
- Each request returns **all** matching patients for a given prefix — required by D4-02. In practice results per prefix pair will be small (name distribution across prefixes is sparse), but an attacker systematically submitting every common 2-character combination will collect the full dataset.
- The total number of requests needed to enumerate the full patient list is proportional to the number of distinct 2-character name prefixes in the dataset — at worst a few hundred requests, taking seconds with a simple script.

#### Why this is silent

[`SearchPatients.ts:73-77`](../api/src/functions/SearchPatients.ts:73) logs to the Azure Functions invocation trace:

```ts
context.log('Patient search completed:', {
    searchTerm: normalizedSearch,
    resultCount: patients.length,
    requestedBy: user.userId
});
```

This goes to the Functions host trace — it is **not** written to the `AuditLogs` table. The `GET /v1/audit-logs` endpoint (admin-only) therefore shows no record of search queries. An admin reviewing the audit log for suspicious activity would see no signal from a bulk enumeration run.

#### Comparison with `GetPatients`

`GET /v1/patients` (paginated, max 100 per page) is the other patient listing endpoint. It uses cursor-based continuation tokens, so bulk extraction via that route requires many sequential pages each requiring the previous page's token — the access pattern is visible as a long chain of requests. `SearchPatients` has no pagination and no continuation tokens, making repeated queries structurally indistinguishable from normal typeahead usage.

### Impact

- **Data exposed per request:** Full `Patient` entity — `name`, `phone`, `email`, `address`, `birthDate`, `patientId`, `createdAt`, `updatedAt`, `createdBy` — all fields that constitute personal data under GDPR and healthcare data protection regulations.
- **Who can exploit it:** Any holder of a valid session cookie or Bearer token, including `viewer`-role accounts (read-only, lowest privilege level).
- **Precondition:** Valid authenticated session. Unauthenticated requests are rejected with 401.
- **Detection difficulty:** High — search queries are functionally identical to legitimate typeahead usage; only the volume and breadth of prefixes queried distinguishes an enumeration from normal use, and that signal is only visible in Functions host traces, not in the application audit log.

### Candidate Mitigations (ranked by implementation cost)

| Option | Change | Cost | Effect |
|--------|--------|------|--------|
| **A — Audit search queries** | Call `logAuditEvent('PATIENT_SEARCH', ...)` inside `SearchPatients.ts` with `userId`, `searchTerm`, and `resultCount`. | Low — one function call | Enumeration attempts become visible to admins in `GET /v1/audit-logs`. Does not prevent extraction but enables detection and forensic response. |
| **B — Reduce `MAX_RESULTS`** | **Not viable.** Requirement D4-02 mandates that all prefix matches are returned. Any cap below the full match count would break the patients search UI. Changing this requires a product decision to revise D4-02. | — | Blocked by D4-02. |
| **C — Request-level rate limiting** | Apply per-user rate limiting on the search endpoint (e.g. max 30 requests/minute). | Medium — requires Azure API Management or a counter-based in-process rate limiter | Makes systematic enumeration take hours instead of seconds; practical deterrent against scripted extraction. |

**Recommended path:** Implement **A** (audit logging) immediately — one function call, no product impact, closes the compliance gap of untracked PII access. Option C (rate limiting) is the stronger preventive control but belongs at the infrastructure layer (Azure API Management), consistent with the approach taken for Finding #9 in the security plan.

### Notes

- `MAX_RESULTS = 1000` is set by requirement D4-02 ([`REQUIREMENTS.md:219`](../docs2/REQUIREMENTS.md:219)), which mandates that all matches for a given prefix are returned. Reducing this cap would require a product decision to revise D4-02, not just a security change.
- Audit logging for search is also needed for compliance independently of the enumeration risk — any access to PII in a clinical system should be traceable.
- Finding #9 in `security-fixes-impl-plan.md` addresses rate limiting for the `Register` endpoint via an infrastructure note; the same infrastructure recommendation applies here.
