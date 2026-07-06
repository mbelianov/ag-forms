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
- **Status:** Deferred

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
