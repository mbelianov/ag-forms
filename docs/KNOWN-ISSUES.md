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
