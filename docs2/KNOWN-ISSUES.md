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
