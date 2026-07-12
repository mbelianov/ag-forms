# Implementation Plan — Feature Requests (FEATURE-REQEUSTS.txt)

> Requirements source: [`docs/REQUIREMENTS-SPEC.md`](./REQUIREMENTS-SPEC.md)  
> Each sub-task is self-contained and must be completed and reviewed before the next begins.  
> Status: `[ ] pending` → `[~] in-progress` → `[x] done`

---

## Overview

Nine requirements need work (REQ-01 through REQ-09). Two are already fully implemented (REQ-10, REQ-11). Eight flagged bugs are bundled into the sub-tasks they naturally belong to. Work is split into five focused sub-tasks ordered by dependency:

1. **ST-01** — Backend foundation: type registry constants, validation allowlist, `GetExaminations` type filter, `GetPatients` OData fix, `authLevel` fix, `requireAuth` await fix
2. **ST-02** — Rename + type registry on the frontend: single constants file, all label replacements
3. **ST-03** — Form structural changes: remove accordion, lock type on edit, patient-age field, type-driven section rendering scaffold
4. **ST-04** — Aggressive layout compaction (REQ-08 + REQ-09): `row6`/`row4`, container width, all section rewires
5. **ST-05** — Examinations list type filter (REQ-04): frontend filter dropdown wired to backend

```
ST-01 ──► ST-02 ──► ST-03 ──► ST-04
                 └──────────────────► ST-05
```
ST-05 can begin after ST-02 (it needs the frontend constants) and ST-01 (it needs the backend filter).

---

## ST-01 — Backend Fixes and Foundation

**Status:** `[x] done`

### Intent
Fix all flagged backend issues and lay the groundwork the frontend needs: a canonical list of valid examination type keys, `GetExaminations` filtering by type, corrected OData filter in `GetPatients`, correct `authLevel` on admin endpoints, and verified `await` on `requireAuth` calls.

### Expected Outcomes
- `GET /v1/examinations?examination_type=ultrasound_prenatal` returns only exams of that type.
- `GET /v1/patients` OData filter includes `isDeleted eq false`, so page sizes are accurate.
- `POST/GET /v1/users`, `GET /v1/audit-logs` all use `authLevel: 'function'`.
- `requireAuth` is awaited everywhere.
- Backend validation rejects any `examinationType` value that is not in the allowed list.
- No behaviour change visible to the user for the single existing type.

### Todo List
1. Read [`api/src/utils/authMiddleware.ts`](../api/src/utils/authMiddleware.ts) to confirm whether `requireAuth` is sync or async.
2. If async: add `await` to `requireAuth(request)` in [`GetUsers.ts`](../api/src/functions/GetUsers.ts) line 12, [`GetAuditLogs.ts`](../api/src/functions/GetAuditLogs.ts) line 31, [`CreateUser.ts`](../api/src/functions/CreateUser.ts) line 17, [`UpdateUser.ts`](../api/src/functions/UpdateUser.ts) line 10. (FLAG-06)
3. Change `authLevel: 'anonymous'` → `authLevel: 'function'` in [`GetUsers.ts`](../api/src/functions/GetUsers.ts), [`GetAuditLogs.ts`](../api/src/functions/GetAuditLogs.ts), [`CreateUser.ts`](../api/src/functions/CreateUser.ts), [`UpdateUser.ts`](../api/src/functions/UpdateUser.ts). (FLAG-04)
4. In [`GetPatients.ts`](../api/src/functions/GetPatients.ts): change OData filter from `PartitionKey eq 'PATIENT'` to `PartitionKey eq 'PATIENT' and isDeleted eq false` and remove the in-loop `if (!patient.isDeleted)` guard. (FLAG-05)
5. Create `api/src/constants/examinationTypes.ts` exporting `EXAM_TYPES` as a readonly array of `{ key: string; label: string }` objects, initially containing `{ key: 'ultrasound_prenatal', label: 'Ultrasound Prenatal Exam' }`. Export a `EXAM_TYPE_KEYS` string array derived from it for use in Joi.
6. In [`api/src/utils/validation.ts`](../api/src/utils/validation.ts) line 279: replace `Joi.string().max(100).optional().allow('')` with `Joi.string().valid(...EXAM_TYPE_KEYS).optional().allow('')`, importing from the new constants file. (FLAG-03, REQ-01)
7. In [`api/src/functions/GetExaminations.ts`](../api/src/functions/GetExaminations.ts): read optional `examination_type` query param; when present append `and examinationType eq '${examination_type}'` to the OData filter. (FLAG-02, REQ-04)
8. In [`api/src/functions/CreateExamination.ts`](../api/src/functions/CreateExamination.ts): after the patient is fetched and `examDate` is confirmed, if `patientAgeAtExam` is absent from the request body but `patient.birthDate` is present, compute it server-side as `Math.floor((new Date(examDate).getTime() - new Date(patient.birthDate).getTime()) / (365.25 * 24 * 3600 * 1000))` (whole years) before storing. Apply the same fallback in [`UpdateExamination.ts`](../api/src/functions/UpdateExamination.ts). (FLAG-08)
9. Run `cd api && npm test` and confirm no regressions.

### Relevant Context
- [`api/src/utils/authMiddleware.ts`](../api/src/utils/authMiddleware.ts) — `requireAuth` signature
- [`api/src/functions/GetExaminations.ts`](../api/src/functions/GetExaminations.ts) lines 34–43 — current filter construction
- [`api/src/utils/validation.ts`](../api/src/utils/validation.ts) line 241–298 — examination schema
- Existing pattern: `status` and `from_date`/`to_date` are already appended conditionally to the same filter string in `GetExaminations`

---

## ST-02 — Frontend Constants and Label Rename

**Status:** `[x] done`

### Intent
Create a single frontend constants file that is the sole source of truth for examination type keys and labels, then replace every hardcoded "Test"/"Tests" string across the frontend with either the constant or the new "Exam"/"Exams" label. This sub-task has no UI-visible structural changes — it is purely a rename and a refactor to remove scattered literals.

### Expected Outcomes
- A single file `frontend/src/constants/examinationTypes.ts` exports `EXAM_TYPES`, `EXAM_TYPE_KEYS`, and a `getExamTypeLabel(key)` helper.
- Every user-visible occurrence of "Ultrasound Prenatal Test" / "Ultrasound Prenatal Tests" reads "Ultrasound Prenatal Exam" / "Ultrasound Prenatal Exams".
- No hardcoded type-key strings remain outside the constants file.
- All existing routes, API calls, and stored data keys (`"ultrasound_prenatal"`) are unchanged.

### Todo List
1. Create `frontend/src/constants/examinationTypes.ts`:
   - Export `EXAM_TYPES: readonly { key: string; label: string }[]` with one entry `{ key: 'ultrasound_prenatal', label: 'Ultrasound Prenatal Exam' }`.
   - Export `getExamTypeLabel(key: string): string` — returns the label for a key, falls back to the key itself if not found.
2. In [`frontend/src/pages/ExaminationsPage.tsx`](../frontend/src/pages/ExaminationsPage.tsx):
   - Replace `const EXAM_TYPE_LABEL = 'Ultrasound Prenatal Test'` (line 33) with an import of `getExamTypeLabel` from the new constants.
   - Update the `examinationType` cell rendering (line 216–218) to use `getExamTypeLabel(exam.examinationType ?? 'ultrasound_prenatal')`.
   - Update page title (line 237), `TableContainer title` (line 329), button label (line 350), empty-state text (line 372), and `PageLoader` description (line 231) to use "Exams" / "Exam".
3. In [`frontend/src/components/Layout.tsx`](../frontend/src/components/Layout.tsx) line 63: change `"Ultrasound Prenatal Tests"` → `"Ultrasound Prenatal Exams"`.
4. In [`frontend/src/pages/ExaminationDetailPage.tsx`](../frontend/src/pages/ExaminationDetailPage.tsx): update `PageLoader` description (line 110) and "Back to…" button text (line 127) to say "Exam" / "Exams".
5. In [`frontend/src/components/ExaminationForm.tsx`](../frontend/src/components/ExaminationForm.tsx):
   - Import `EXAM_TYPES` from the constants file.
   - Replace the hardcoded `<SelectItem value="ultrasound_prenatal" text="Ultrasound Prenatal Test" />` with a `.map()` over `EXAM_TYPES`.
   - Replace the Submit button label strings (line 1098) from "…Ultrasound Prenatal Test" to "…Ultrasound Prenatal Exam".
6. In [`frontend/src/pages/CreateExaminationPage.tsx`](../frontend/src/pages/CreateExaminationPage.tsx): update breadcrumb text (line 64) and page heading (line 67) to "Create Examination" (already correct, confirm no "Test" wording).
7. In [`frontend/src/pages/EditExaminationPage.tsx`](../frontend/src/pages/EditExaminationPage.tsx): confirm no "Test" wording in headings or breadcrumbs.
8. Grep the entire `frontend/src` directory for remaining occurrences of `"Prenatal Test"` and `"Prenatal Tests"` and fix any missed locations.

### Relevant Context
- [`frontend/src/pages/ExaminationsPage.tsx`](../frontend/src/pages/ExaminationsPage.tsx) lines 33, 216, 231, 237, 329, 350, 372
- [`frontend/src/components/Layout.tsx`](../frontend/src/components/Layout.tsx) line 63
- [`frontend/src/pages/ExaminationDetailPage.tsx`](../frontend/src/pages/ExaminationDetailPage.tsx) lines 110, 127
- [`frontend/src/components/ExaminationForm.tsx`](../frontend/src/components/ExaminationForm.tsx) lines 563, 1098

---

## ST-03 — Form Structural Changes

**Status:** `[x] done`

### Intent
Make three structural changes to `ExaminationForm` that are logically independent of layout: (1) remove the accordion wrappers, (2) lock `examinationType` as read-only on the edit path, (3) compute and display patient age at exam in the main section and submit it. Also add the type-driven section-rendering scaffold (REQ-05) — a section-visibility map keyed by type — so future types can turn sections on/off without touching the render logic.

### Expected Outcomes
- All three clinical sections (Pregnancy Data, Ultrasound Findings, Anatomy) are rendered with static `<h4>` headings, not inside `<Accordion>`.
- On the edit form, the examination type field is a read-only `TextInput` showing the human-readable label; on the create form it remains a `<Select>`.
- A read-only "Patient Age at Exam" field appears in the main section next to Status. It shows `"N yrs"` when `birthDate` is available or `"—"` when not. The value is included as `patientAgeAtExam` in every form submission.
- A `SECTION_VISIBILITY` map exists in `ExaminationForm.tsx` (or a co-located file) keyed by `examinationType`, with `"ultrasound_prenatal"` mapping to `{ pregnancyData: true, ultrasoundFindings: true, anatomy: true, biometry: true, doppler: true }`. All sections check their visibility flag before rendering.
- `<Accordion>` and `<AccordionItem>` are no longer imported in the file.

### Todo List
1. Remove the `Accordion` and `AccordionItem` imports from `ExaminationForm.tsx`.
2. Replace the `<Accordion>` wrapper (around lines 604–808) with a plain `<div>` (or `<Stack>`). Replace each `<AccordionItem title="...">` with an `<h4 style={{ marginBottom: '0.5rem', fontWeight: 600 }}>...</h4>` heading followed directly by its content. (REQ-07)
3. Add a `SECTION_VISIBILITY` constant:
   ```ts
   const SECTION_VISIBILITY: Record<string, Record<string, boolean>> = {
     ultrasound_prenatal: {
       pregnancyData: true,
       ultrasoundFindings: true,
       anatomy: true,
       biometry: true,
       doppler: true,
     },
   };
   ```
   Derive a `visibility` object: `const visibility = SECTION_VISIBILITY[formData.examinationType] ?? SECTION_VISIBILITY['ultrasound_prenatal'];`. Wrap each section's JSX block with `{visibility.pregnancyData && ( ... )}` etc. (REQ-05)
4. Change the examination-type `Select` to render as a read-only `TextInput` when `isEdit === true`, mirroring the existing `patientName` read-only pattern (lines 544–552). Use `getExamTypeLabel(formData.examinationType)` as the value. (FLAG-01, REQ-02)
5. In the main section (around the Exam Date / Status row):
   - Look up `patients.find(p => p.patientId === formData.patientId)` to get the selected patient.
   - Compute `patientAge = calculateAgeAtDate(patient?.birthDate ?? '', formData.examDate)`.
   - Add a read-only `TextInput` labelled `"Patient Age at Exam"` with value `patientAge !== undefined ? \`${patientAge} yrs\` : '—'`. Place it in the same `row2`/`row3` as Exam Date and Status so it occupies the third slot (making that row a `row3`). (REQ-06)
6. In `handleSubmit` (around line 463), add `patientAgeAtExam: patientAge` to `submitData` when `patientAge !== undefined`. (FLAG-07, REQ-06)
7. In `UpdateExaminationRequest` in [`frontend/src/types/index.ts`](../frontend/src/types/index.ts) — confirm `patientAgeAtExam` is present (it is defined on `CreateExaminationRequest`; add it to `UpdateExaminationRequest` if missing).
8. Run a visual smoke test: open create form, confirm age appears, accordion is gone, submit, confirm `patientAgeAtExam` in network payload.

### Relevant Context
- [`frontend/src/components/ExaminationForm.tsx`](../frontend/src/components/ExaminationForm.tsx) lines 544–552 (read-only patientName pattern), 604–808 (accordion), 463–475 (submitData)
- [`frontend/src/utils/calculations.ts`](../frontend/src/utils/calculations.ts) — `calculateAgeAtDate(birthDate, referenceDate)`
- [`frontend/src/types/index.ts`](../frontend/src/types/index.ts) — `UpdateExaminationRequest` (line 163)
- ST-02 must be complete first so `getExamTypeLabel` and `EXAM_TYPES` are importable.

---

## ST-04 — Aggressive Layout Compaction

**Status:** `[x] done`

### Intent
Apply all nine layout rules from REQ-08 and the alignment rules from REQ-09 in one focused pass. Every change is inside `ExaminationForm.tsx`, `CreateExaminationPage.tsx`, and `EditExaminationPage.tsx`. No logic changes — only CSS grid definitions and JSX structure.

### Expected Outcomes
- Container max-width is `1200px` on both Create and Edit pages.
- `row4` and `row6` helpers exist in `ExaminationForm.tsx`.
- Top-level `Stack gap={6}` → `gap={4}`; all intra-section `Stack gap={4}` → `gap={3}`.
- Biometry: three `row6` rows (BPD-Vp / TCD-TAD / LA-LC+spacers). `rowAuto` is gone from biometry.
- Doppler: `row4` top row (PI, RI, Vessel, Duc.Ven) + `row6` for 6 extended numeric fields + CPR alone in a partial row.
- Anatomy: single `row6` div (auto-places 11 fields across two visual rows). Three old div wrappers replaced by one.
- Ultrasound Findings: single `row6` div (auto-places 6 fields in one visual row). Two old div wrappers replaced by one.
- Pregnancy Data: EDD merged into `row3` with Obstetric History and Family History, removing the conditional `row2` wrapper.
- Calc rows: gap tightened from `1rem` to `0.75rem`.
- Submit/Cancel buttons in `<ButtonSet>` with `justify-content: flex-end`.
- Examination-type `Select` (on create form) no longer sits alone in a `row2` — it shares a row with Status (making the main section header row: `[ExamType | ExamDate | Status | PatientAge]` as a `row4`, or two separate `row2` pairs if the date-picker width requires it).

### Todo List
1. In [`frontend/src/pages/CreateExaminationPage.tsx`](../frontend/src/pages/CreateExaminationPage.tsx) line 60: change `maxWidth: '800px'` → `maxWidth: '1200px'`.
2. In [`frontend/src/pages/EditExaminationPage.tsx`](../frontend/src/pages/EditExaminationPage.tsx) line 109: same change.
3. In [`frontend/src/components/ExaminationForm.tsx`](../frontend/src/components/ExaminationForm.tsx) layout-helper block (lines 497–499):
   - Add `row4: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }`.
   - Add `row6: { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.75rem' }`.
4. Change top-level `<Stack gap={6}>` → `<Stack gap={4}>` (line 511).
5. Change all intra-section `<Stack gap={4}>` → `<Stack gap={3}>` (Pregnancy Data, Ultrasound Findings, Anatomy, Biometry, Doppler sections).
6. **Examination type / date / status / age row**: merge the current standalone `row2` for exam type (lines 555–565) with the exam date + status `row2` (lines 568–601) into a single `row4` containing: ExamType (read-only on edit) | ExamDate | Status | PatientAge (read-only). This requires adjusting the JSX wrapping added in ST-03.
7. **Pregnancy Data** (post-accordion-removal from ST-03):
   - Keep Row A (LMP + Calc + GA from LMP flex row) unchanged except tighten gap to `0.75rem`.
   - Replace the conditional `{edd && <div style={row2}><TextInput.../>}` + separate `<div style={row2}>` for obstetric/family history with a single always-rendered `<div style={row3}>`: `[EDD (readOnly, value={edd ?? '—'}) | Obstetric History | Family History]`. Remove the conditional wrapper — EDD shows `"—"` when no LMP.
8. **Ultrasound Findings**: Replace the two `<div style={row2}>` blocks (Presentation+Gender, HeartRate+FetalMovement) and the second `<div style={row2}>` (Placenta+Cord) with a single `<div style={row6}>` containing all six fields in DOM order: Presentation, Gender, HeartRate, FetalMovement, Placenta, UmbilicalCord.
9. **Anatomy**: Replace the three `<div>` row wrappers (`row3`+`row3`+`row2`) with a single `<div style={row6}>` containing all 11 fields in order: Head, Brain, Heart, Abdomen, Kidneys, Limbs, Skeleton, Face, NeckSkin, Spine, Thorax. CSS grid auto-placement will distribute them 6+5.
10. **Biometry**:
    - Replace the `<div style={rowAuto}>` for BPD/HC/AC/FL (lines 815–859) with `<div style={row6}>` containing BPD, HC, AC, FL, OFD, Vp.
    - Replace the `<div style={rowAuto}>` for the 8 extended fields (lines 966–987) with `<div style={row6}>` containing TCD, CM, NuchalFold, NB, APAD, TAD.
    - Replace the `<div style={row2}>` for LA/LC (lines 989–992) with `<div style={row6}>` containing LA, LC, and four empty `<div />` spacers so the grid aligns with the rows above.
11. **Doppler**:
    - Replace `<div style={row3}>` containing PI, RI, Vessel (lines 999–1033) with `<div style={row4}>` containing PI, RI, Vessel, DucVen (move `ducVen` from the extended row up to here).
    - Replace the `<div style={rowAuto}>` for the 7 extended numeric fields (lines 1035–1057) with `<div style={row6}>` containing: utADexPI, utADexRI, utASinPI, utASinRI, CMA, PSV. Place CPR in its own partial `<div style={row6}>` with CPR plus five empty `<div />` spacers.
    - Remove the standalone `ducVen` `TextInput` from the old `rowAuto` (it moved to the `row4`).
12. **Calc rows**: Change `gap: '1rem'` → `gap: '0.75rem'` on the two `gridTemplateColumns: 'auto 1fr 1fr'` inline style objects (lines 888 and 925).
13. **Action buttons**: Wrap the Submit and Cancel buttons (lines 1096–1101) in `<ButtonSet style={{ justifyContent: 'flex-end' }}>` and import `ButtonSet` from `@carbon/react`.
14. Visual smoke test: open Create Examination at 1280px viewport, verify all sections fit comfortably without excessive scrolling.

### Relevant Context
- REQ-08 rules 1–9 in [`docs/REQUIREMENTS-SPEC.md`](./REQUIREMENTS-SPEC.md)
- REQ-09 alignment rules
- ST-03 must be complete first (accordion is gone, age field is in the main section, type field is conditional)
- The `row4` and `row6` added here also inform the Doppler and Biometry sections already partially structured in ST-03

---

## ST-05 — Examinations List Type Filter

**Status:** `[x] done`

### Intent
Wire the frontend Examinations list page to filter by examination type. Depends on ST-01 (backend filter param) and ST-02 (frontend constants).

### Expected Outcomes
- A "Filter by Type" dropdown appears in the filter bar on the Examinations page, populated from the `EXAM_TYPES` constants.
- Selecting a type calls `GET /v1/examinations?examination_type=...` and the backend returns only matching records.
- "All Types" is the default (no filter parameter sent).
- The `GetExaminationsOptions` interface in `examinationService.ts` gains an `examinationType` field.
- Changing the type filter resets the page to 1 and clears the continuation token, consistent with how the existing status and patient filters behave.

### Todo List
1. Add `examinationType?: string` to the `GetExaminationsOptions` interface in [`frontend/src/services/examinationService.ts`](../frontend/src/services/examinationService.ts).
2. In `getExaminations()`: when `opts.examinationType` is set, add `params.examination_type = opts.examinationType` (matching the backend query param name from ST-01).
3. In [`frontend/src/pages/ExaminationsPage.tsx`](../frontend/src/pages/ExaminationsPage.tsx):
   - Add `selectedExamType` state: `const [selectedExamType, setSelectedExamType] = useState<string>('')`.
   - Import `EXAM_TYPES` from `frontend/src/constants/examinationTypes.ts`.
   - Add a `handleExamTypeFilter(type: string)` handler that sets state and calls `loadExaminations({ ..., examinationType: type || undefined })`, consistent with the existing `handleStatusFilter` pattern.
   - Add a `<Select>` for "Filter by Type" in the filter bar div (between the Status filter and the Date picker). Populate with `<SelectItem value="" text="All Types" />` and `.map()` over `EXAM_TYPES`.
4. Pass `examinationType` through `loadExaminations` opts into `getExaminations` call (line 100).
5. Confirm the type filter is included in the `handleLoadMore` call (line 184) alongside the existing filters.
6. Visual smoke test: with two examination records of different types (if available), confirm the filter correctly isolates each.

### Relevant Context
- [`frontend/src/pages/ExaminationsPage.tsx`](../frontend/src/pages/ExaminationsPage.tsx) lines 68–75 (state), 89–126 (`loadExaminations`), 153–168 (filter handlers), 251–316 (filter bar JSX)
- [`frontend/src/services/examinationService.ts`](../frontend/src/services/examinationService.ts) lines 9–15 (`GetExaminationsOptions`), 30–43 (param building)
- ST-01 must be complete (backend accepts `examination_type` param)
- ST-02 must be complete (`EXAM_TYPES` constant is available)

---

## Coverage Matrix

| REQ / FLAG | Description | Sub-task(s) |
|---|---|---|
| REQ-01 | Formal examination type registry | ST-01 step 5, ST-02 step 1 |
| REQ-02 | Type selection at creation; locked on edit | ST-03 step 4 |
| REQ-03 | Rename "Test" → "Exam" everywhere | ST-02 steps 2–8 |
| REQ-04 | Type filter on examinations list | ST-01 step 7, ST-05 steps 1–5 |
| REQ-05 | Type-driven section rendering scaffold | ST-03 step 3 |
| REQ-06 | Patient age at exam in main section | ST-03 steps 5–7 |
| REQ-07 | Remove accordion from input form | ST-03 steps 1–2 |
| REQ-08 | Aggressive layout compaction | ST-04 steps 1–14 |
| REQ-09 | Consistent left/right alignment | ST-04 steps 6, 13 |
| FLAG-01 | `examinationType` editable on edit path | ST-03 step 4 |
| FLAG-02 | Backend missing `examinationType` filter | ST-01 step 7 |
| FLAG-03 | Backend accepts any string for type | ST-01 step 6 |
| FLAG-04 | Wrong `authLevel` on 4 admin endpoints | ST-01 step 3 |
| FLAG-05 | `GetPatients` OData missing `isDeleted` | ST-01 step 4 |
| FLAG-06 | `requireAuth` called without `await` | ST-01 steps 1–2 |
| FLAG-07 | `patientAgeAtExam` not submitted by form | ST-03 steps 5–6 |
| FLAG-08 | No server-side `patientAgeAtExam` fallback | ST-01 step 8 |

---

## Completion Checklist

- [x] ST-01 — Backend fixes and foundation
- [x] ST-02 — Frontend constants and label rename
- [x] ST-03 — Form structural changes
- [x] ST-04 — Aggressive layout compaction
- [x] ST-05 — Examinations list type filter
