# Refined Requirements Specification

> Generated from `docs/FEATURE-REQEUSTS.txt` cross-referenced against the existing codebase.
> Status labels: **✅ Fully Implemented** | **⚠️ Partially Implemented** | **❌ Not Implemented**

---

## 1. Multi-Examination-Type Architecture

### REQ-01 — Formal Examination Type Registry
**Status:** ⚠️ Partially Implemented  
**Relevant Files:**
- [`api/src/types/index.ts`](../api/src/types/index.ts) — `Examination.examinationType?: string`
- [`api/src/utils/validation.ts`](../api/src/utils/validation.ts) — `Joi.string().max(100).optional().allow('')`
- [`frontend/src/types/index.ts`](../frontend/src/types/index.ts) — `examinationType?: string`
- [`frontend/src/components/ExaminationForm.tsx`](../frontend/src/components/ExaminationForm.tsx) — dropdown hardcoded to one option

**Refined Requirement:**  
The system must support a defined set of named examination types. Each type must be identified by a stable machine-readable key (e.g., `ultrasound_prenatal`) and a human-readable display label (e.g., `"Ultrasound Prenatal Exam"`). The type registry must be maintained in a single canonical location (frontend `constants` module and/or a backend configuration source) so that adding a new type does not require edits scattered across multiple files.

The initial registry must contain exactly one type: key `"ultrasound_prenatal"`, label `"Ultrasound Prenatal Exam"` (see REQ-03 for the rename).

**What is done:**  
`examinationType` is stored as a free-text `string` on `Examination` in both API and frontend types. The form dropdown (`ExaminationForm`) contains a single hardcoded `<SelectItem value="ultrasound_prenatal" text="Ultrasound Prenatal Test">`.

**What is missing:**  
- No shared registry/constants module — type keys and labels are scattered as string literals across `ExaminationForm.tsx` (line 563), `ExaminationsPage.tsx` (line 33), and `Layout.tsx` (line 63).
- Backend validation (`examinationSchema`) accepts any string up to 100 chars; it does not validate against an allowed-values list.

---

### REQ-02 — Examination Type Selection at Creation
**Status:** ⚠️ Partially Implemented  
**Relevant Files:**
- [`frontend/src/components/ExaminationForm.tsx`](../frontend/src/components/ExaminationForm.tsx) lines 554–565
- [`frontend/src/pages/CreateExaminationPage.tsx`](../frontend/src/pages/CreateExaminationPage.tsx)

**Refined Requirement:**  
When creating a new examination, the user must select an examination type from a dropdown list before any type-specific fields are rendered. The dropdown must be populated from the centralised type registry (see REQ-01). The selected type must:
1. Be stored on the `Examination` entity as `examinationType`.
2. Drive which input sections and validation rules are shown in the form (see REQ-05).
3. Not be editable after creation (display the type as a read-only label on the edit form, consistent with how `patientName` is shown as read-only).

**What is done:**  
A `Select` for examination type is rendered in the form with `examinationType` defaulting to `"ultrasound_prenatal"`. The field is stored on the entity.

**What is missing:**  
- Dropdown contains only one static option; it does not disable itself once a type is chosen on the edit path.
- No conditional section rendering tied to the selected type yet (all sections are always shown).
- The type field is editable on the edit form (the `disabled` prop is only set to `isSubmitting`, not to `isEdit`).

---

### REQ-03 — Rename Existing Type to "Ultrasound Prenatal Exam"
**Status:** ⚠️ Partially Implemented  
**Relevant Files:**
- [`frontend/src/pages/ExaminationsPage.tsx`](../frontend/src/pages/ExaminationsPage.tsx) lines 33, 237, 329, 350, 372
- [`frontend/src/components/Layout.tsx`](../frontend/src/components/Layout.tsx) line 63
- [`frontend/src/pages/ExaminationDetailPage.tsx`](../frontend/src/pages/ExaminationDetailPage.tsx) lines 110, 127
- [`frontend/src/components/ExaminationForm.tsx`](../frontend/src/components/ExaminationForm.tsx) line 563
- [`frontend/src/pages/CreateExaminationPage.tsx`](../frontend/src/pages/CreateExaminationPage.tsx) line 67

**Refined Requirement:**  
Every user-visible label that currently reads `"Ultrasound Prenatal Test"` or `"Ultrasound Prenatal Tests"` must be changed to `"Ultrasound Prenatal Exam"` / `"Ultrasound Prenatal Exams"` respectively. This applies to:
- Navigation menu item in [`Layout.tsx`](../frontend/src/components/Layout.tsx)
- Page title in [`ExaminationsPage.tsx`](../frontend/src/pages/ExaminationsPage.tsx) and `TableContainer title`
- Dropdown label in [`ExaminationForm.tsx`](../frontend/src/components/ExaminationForm.tsx)
- Breadcrumb and page heading in [`CreateExaminationPage.tsx`](../frontend/src/pages/CreateExaminationPage.tsx) and [`EditExaminationPage.tsx`](../frontend/src/pages/EditExaminationPage.tsx)
- Loading descriptions and "Back to…" button labels in [`ExaminationDetailPage.tsx`](../frontend/src/pages/ExaminationDetailPage.tsx)
- The `EXAM_TYPE_LABEL` constant in [`ExaminationsPage.tsx`](../frontend/src/pages/ExaminationsPage.tsx)

The machine-readable key `"ultrasound_prenatal"` must remain unchanged (stored data migration is not required).

**What is done:**  
Several locations already say "Ultrasound Prenatal Test" (the prior wording from TASK-032); the form dropdown still uses the old label.

**What is missing:**  
Consistent application of the new label across all files listed above. The `EXAM_TYPE_LABEL` constant on line 33 of `ExaminationsPage.tsx` is the right place to centralise the display string.

---

### REQ-04 — Examination Type Filter on List Page
**Status:** ⚠️ Partially Implemented  
**Relevant Files:**
- [`frontend/src/pages/ExaminationsPage.tsx`](../frontend/src/pages/ExaminationsPage.tsx)
- [`api/src/functions/GetExaminations.ts`](../api/src/functions/GetExaminations.ts)

**Refined Requirement:**  
The Examinations list page must include a "Filter by Examination Type" dropdown alongside the existing Patient, Status, and Date-range filters. The dropdown must be populated from the centralised type registry (see REQ-01) plus an "All Types" option. When a type is selected, the filter must be passed as `examination_type` query parameter to `GET /v1/examinations`, and the backend must apply it as an additional `and examinationType eq '...'` OData filter clause (only when the parameter is present). The "Type" column that is already displayed in the table must reflect the human-readable label from the registry.

**What is done:**  
The `GET /v1/examinations` endpoint accepts `patientId`, `status`, `from_date`, `to_date`, and `continuationToken` query params. The Examinations page already has Patient, Status, and Date filters, and a "Type" column.

**What is missing:**  
- Backend `GetExaminations` does not accept or apply an `examination_type` query parameter.
- Frontend filter bar has no examination-type dropdown.

---

### REQ-05 — Type-Driven Form Field Rendering
**Status:** ❌ Not Implemented  
**Relevant Files:**
- [`frontend/src/components/ExaminationForm.tsx`](../frontend/src/components/ExaminationForm.tsx)

**Refined Requirement:**  
The examination input form must render sections and fields conditionally based on the selected `examinationType`. For the current type `"ultrasound_prenatal"`, all existing sections (Pregnancy Data, Ultrasound Findings, Anatomy, Biometry, Doppler) must be shown. When future types are added, their own section sets will be registered alongside the type in the registry; `ExaminationForm` must read the registry to determine which sections to render rather than rendering all sections unconditionally.

**What is done:**  
The form always renders all sections regardless of `examinationType` value.

**What is missing:**  
A section-to-type mapping abstraction. This does not require any UI change for the current single type, but the wiring must exist so future types can be added without touching `ExaminationForm`'s render logic.

---

## 2. Ultrasound Prenatal Exam — Specific Changes

### REQ-06 — Patient Age at Exam Displayed in Main Section
**Status:** ⚠️ Partially Implemented  
**Relevant Files:**
- [`frontend/src/types/index.ts`](../frontend/src/types/index.ts) — `patientAgeAtExam?: number`
- [`api/src/types/index.ts`](../api/src/types/index.ts) — `patientAgeAtExam?: number`
- [`api/src/functions/CreateExamination.ts`](../api/src/functions/CreateExamination.ts) — passes `patientAgeAtExam` from request body
- [`frontend/src/utils/calculations.ts`](../frontend/src/utils/calculations.ts) — `calculateAgeAtDate()`
- [`frontend/src/components/ExaminationForm.tsx`](../frontend/src/components/ExaminationForm.tsx)

**Refined Requirement:**  
The main (always-visible) section of the Ultrasound Prenatal Exam form — defined as the block containing Patient, Examination Type, Examination Date, and Status — must also display a read-only computed field labelled **"Patient Age at Exam"**. The value must be computed client-side as `calculateAgeAtDate(patient.birthDate, formData.examDate)` and displayed in whole years (e.g., `"32 yrs"`). If `birthDate` is not available on the selected patient record, the field must display `"—"`. The computed value must be submitted to the API as `patientAgeAtExam` (integer, whole years) and stored on the `Examination` entity.

**What is done:**  
The `patientAgeAtExam` field exists on both type definitions and is accepted and stored by the API. `calculateAgeAtDate()` exists in `calculations.ts`. The `Patient` type carries `birthDate`.

**What is missing:**  
`ExaminationForm` does not compute or display `patientAgeAtExam` in the main section, and does not include it in the `submitData` payload.

---

### REQ-07 — Remove Accordion (Folding Sections) from Input Form
**Status:** ❌ Not Implemented  
**Relevant Files:**
- [`frontend/src/components/ExaminationForm.tsx`](../frontend/src/components/ExaminationForm.tsx) lines 604–808

**Refined Requirement:**  
The `<Accordion>` and `<AccordionItem>` wrappers around the "Pregnancy Data", "Ultrasound Findings", and "Anatomy" sections in [`ExaminationForm`](../frontend/src/components/ExaminationForm.tsx) must be removed. Each section's content must be rendered directly, with its section title displayed as a visible non-collapsible heading (e.g., using Carbon `<Heading>` or an `<h3>` with appropriate margin). The Biometry and Doppler `<FormGroup>` sections are not wrapped in accordions and must remain unchanged.

**What is done:**  
Currently all three clinical sections are wrapped with `<AccordionItem open>`.

**What is missing:**  
Removal of accordion wrappers and replacement with static section headings.

---

### REQ-08 — Aggressive Form Layout Compaction (Reduce Vertical Scroll)
**Status:** ❌ Not Implemented
**Relevant Files:**
- [`frontend/src/components/ExaminationForm.tsx`](../frontend/src/components/ExaminationForm.tsx)
- [`frontend/src/pages/CreateExaminationPage.tsx`](../frontend/src/pages/CreateExaminationPage.tsx)
- [`frontend/src/pages/EditExaminationPage.tsx`](../frontend/src/pages/EditExaminationPage.tsx)

**Refined Requirement:**
The form layout must be aggressively compacted to minimise vertical scroll. The following rules are non-negotiable and must all be applied together:

#### 1. Container width
- Change `maxWidth: '800px'` to `maxWidth: '1200px'` in both `CreateExaminationPage` (line 60) and `EditExaminationPage` (line 109). This is the prerequisite for all wider grids below.

#### 2. Spacing
- Top-level `<Stack gap={6}>` → `<Stack gap={4}>`.
- All intra-section `<Stack gap={4}>` → `<Stack gap={3}>`.

#### 3. Add a `row6` layout helper alongside the existing `row2`/`row3`/`rowAuto`
```css
row6: { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.75rem' }
```
Use `0.75rem` gap (instead of `1rem`) for all numeric-only rows to reclaim more horizontal space.

#### 4. Biometry — all numeric fields in two dense rows
The existing `rowAuto` with `minmax(130px, 1fr)` must be replaced with explicit 6-column grids:

| Row | Fields (6 columns) |
|-----|--------------------|
| Row A | BPD, HC, AC, FL, OFD, Vp |
| Row B | TCD, CM, Nuchal Fold, NB, APAD, TAD |
| Row C | LA, LC — span the first 2 columns of a `row6`, remaining 4 columns empty |

LA and LC (currently in a `row2`) must move into Row C as the first two cells of a `row6` so they visually align with the grid above. The 4 unused cells in Row C are left empty (no filler elements needed).

The `<div style={row2}>` for LA/LC (lines 989–992) must be replaced with a `<div style={row6}>` containing LA, LC, and four empty `<div />` spacers — or alternatively use `grid-column: span 2` on LA and span 2 on LC inside a 6-column parent so they occupy the left third of the row and the right two-thirds is blank.

#### 5. Extended Doppler — all numeric fields in one `row6`
The 7 numeric extended-vascular fields (`utADexPI`, `utADexRI`, `utASinPI`, `utASinRI`, `cma`, `psv`, `cpr`) plus the free-text `Duc.Ven` field currently render via `rowAuto`. Replace with a single `row6` for the 7 numeric fields (first 6 in row, 7th wraps), then place `Duc.Ven` alongside `Vessel` in a `row3` together with the existing `PI` and `RI` fields — making the Doppler top row `{ PI | RI | Vessel | Duc.Ven }` as a `row4` (`repeat(4, 1fr)`), and the bottom row the 7 numeric vascular fields in a `row6` (first row of 6, then `cpr` alone at the start of the second row, or pad with empty cells).

Specifically:
- **Doppler row A** (`row4`): PI, RI, Vessel, Duc.Ven
- **Doppler row B** (`row6`): utADexPI, utADexRI, utASinPI, utASinRI, CMA, PSV
- **Doppler row C** (partial `row6`): CPR in column 1, remaining 5 columns empty

#### 6. Anatomy — single dense row
All 11 anatomy text fields (Head, Brain, Heart, Abdomen, Kidneys, Limbs, Skeleton, Face, Neck Skin, Spine, Thorax) currently occupy three separate rows (`row3` + `row3` + `row2`). Replace all three rows with a single `row6` (6 + 5 = two rows rendered automatically by CSS grid auto-placement):

- **Auto row 1**: Head, Brain, Heart, Abdomen, Kidneys, Limbs
- **Auto row 2**: Skeleton, Face, Neck Skin, Spine, Thorax *(5 items; 6th cell empty)*

This eliminates two `<div>` wrappers and two row gaps.

#### 7. Ultrasound Findings — compact to a single row
The six Ultrasound Findings fields (Presentation, Gender, Fetal Heart Rate, Fetal Movement, Placenta, Umbilical Cord) currently occupy two `row2` blocks. Replace with a single `row6` using CSS auto-placement — all 6 fields in one visual row, eliminating one `<div>` wrapper and one gap.

#### 8. Pregnancy Data — consolidate to two rows
The three Pregnancy Data fields (LMP + Calc button, Obstetric History, Family History) plus the EDD read-only display must be arranged as:
- **Row A**: LMP date picker, Calc button (inline, flex-end aligned), GA from LMP text input — unchanged from current layout (already compact).
- **Row B**: EDD (read-only), Obstetric History, Family History — rendered in a `row3` immediately below row A, removing the conditional `row2` wrapper that currently renders EDD in isolation.

This eliminates one wrapping `<div>` when EDD is visible.

#### 9. GA / EFW calc rows — tighten column sizing
The two calc rows (GA from Biometry, EFW) use `gridTemplateColumns: 'auto 1fr 1fr'` with a `1rem` gap. Change gap to `0.75rem` to match the numeric rows.

#### Summary of net change
By combining rules 1–9, the form goes from approximately 12–14 vertical scroll lengths to approximately 7–8 on a 1280px-wide screen, eliminating all unnecessary row breaks within sections that contain numeric inputs.

**What is done:**
- `row2`, `row3`, `rowAuto` helpers exist.
- `rowAuto` already used for the 8-field extended biometry row and 7-field extended Doppler row.
- Container max-width is currently `800px`.

**What is missing:**
- `row6` helper not defined.
- `row4` helper not defined.
- Container width not updated to `1200px`.
- Extended biometry row (8 fields) still uses `rowAuto minmax(130px,1fr)` instead of an explicit `row6`.
- LA/LC still rendered in `row2` instead of being merged into the 6-column biometry grid.
- Anatomy still split across three separate row divs.
- Ultrasound Findings still split across two `row2` divs.
- Doppler still uses `row3` for the first row (PI, RI, Vessel) with Duc.Ven in a separate `rowAuto`.
- EDD still conditionally rendered in its own `row2`.
- Stack gap values not reduced.

---

### REQ-09 — Consistent Left/Right Alignment of All Form Elements
**Status:** ❌ Not Implemented  
**Relevant Files:**
- [`frontend/src/components/ExaminationForm.tsx`](../frontend/src/components/ExaminationForm.tsx)
- [`frontend/src/pages/CreateExaminationPage.tsx`](../frontend/src/pages/CreateExaminationPage.tsx)
- [`frontend/src/pages/EditExaminationPage.tsx`](../frontend/src/pages/EditExaminationPage.tsx)

**Refined Requirement:**  
All input fields and action buttons in the examination form must be visually aligned along a single left edge and a single right edge within their grid column. Concretely:
1. The "Calc" button beside the LMP field and the "Auto Calc GA" / "Calc EFW" buttons beside biometry fields must be placed inside the same CSS grid row as their adjacent inputs, using the `calcButtonWrap` flex-column pattern that is already defined; the buttons must align to the bottom of the input so label + input bottoms are level.
2. The form's Submit and Cancel action buttons must be in a `<ButtonSet>` at the bottom with right-alignment (`justify-content: flex-end`).
3. All section headings (after accordion removal per REQ-07) must align left with the first column of the input grid below them.

**What is done:**  
`calcButtonWrap` is defined and partially applied. Some rows use inline flex already.

**What is missing:**  
Several layout inconsistencies remain: the examination-type dropdown is in its own `row2` with one column used; some calc buttons have no visual alignment with inputs in different grid tracks. A systematic review of all rows is required.

---

## 3. List Loading — Efficient Pagination

### REQ-10 — Server-Side Pagination for Examinations List
**Status:** ✅ Fully Implemented  
**Relevant Files:**
- [`api/src/functions/GetExaminations.ts`](../api/src/functions/GetExaminations.ts)
- [`frontend/src/pages/ExaminationsPage.tsx`](../frontend/src/pages/ExaminationsPage.tsx)
- [`frontend/src/services/examinationService.ts`](../frontend/src/services/examinationService.ts)

**Notes:**  
`GET /v1/examinations` accepts `pageSize` (default 50, max 100) and `continuationToken`. The frontend uses Azure Table Storage continuation tokens and exposes a "Load More" button. Client-side `<Pagination>` paginates the already-loaded batch. This satisfies the feature request.

---

### REQ-11 — Server-Side Pagination for Patients List
**Status:** ✅ Fully Implemented  
**Relevant Files:**
- [`api/src/functions/GetPatients.ts`](../api/src/functions/GetPatients.ts)
- [`frontend/src/pages/PatientsPage.tsx`](../frontend/src/pages/PatientsPage.tsx)
- [`frontend/src/services/patientService.ts`](../frontend/src/services/patientService.ts)

**Notes:**  
`GET /v1/patients` accepts `pageSize` (default 50, max 100) and `continuationToken`. The frontend loads a first page and exposes a "Load More Patients" button, plus a client-side `<Pagination>` component for the loaded page. This satisfies the feature request.

---

## 4. Flagged Issues

### FLAG-01 — `examinationType` Field Is Editable on Edit Path
**Severity:** Medium  
**Affected files:** [`frontend/src/components/ExaminationForm.tsx`](../frontend/src/components/ExaminationForm.tsx) line 561  
**Issue:** The examination-type dropdown is rendered with `disabled={isSubmitting}` on both create and edit flows. On the edit path the type should be immutable (an exam cannot change type after creation — the stored biometry/doppler data was entered for the original type).  
**Recommended resolution:** Add `disabled={isEdit || isSubmitting}` to the `Select` for `examinationType`. On the edit form, render it as a read-only `TextInput` with the human-readable label from the registry, mirroring how `patientName` is shown.

---

### FLAG-02 — `GetExaminations` Does Not Filter by `examinationType` on the Backend
**Severity:** Medium  
**Affected files:** [`api/src/functions/GetExaminations.ts`](../api/src/functions/GetExaminations.ts)  
**Issue:** The backend currently filters by `patientId`, `status`, `from_date`, and `to_date`, but not by `examinationType`. As soon as a second type is introduced, the Examinations list will mix types unless this filter is implemented.  
**Recommended resolution:** Add an optional `examination_type` query parameter and include `and examinationType eq '${examination_type}'` in the OData filter when present (see REQ-04).

---

### FLAG-03 — `examinationType` Backend Validation Accepts Any String
**Severity:** Low  
**Affected files:** [`api/src/utils/validation.ts`](../api/src/utils/validation.ts) line 279  
**Issue:** `Joi.string().max(100).optional().allow('')` permits any string as the examination type. Without a allowlist, invalid types can be persisted.  
**Recommended resolution:** Once the type registry (REQ-01) is established, change the Joi rule to `Joi.string().valid(...EXAM_TYPE_KEYS).optional().allow('')`. Until a second type exists, enforce `Joi.string().valid('ultrasound_prenatal').optional()`.

---

### FLAG-04 — `GetUsers` and `GetAuditLogs` Use `authLevel: 'anonymous'`
**Severity:** High (Security)  
**Affected files:** [`api/src/functions/GetUsers.ts`](../api/src/functions/GetUsers.ts) line 44, [`api/src/functions/GetAuditLogs.ts`](../api/src/functions/GetAuditLogs.ts) line 92, [`api/src/functions/CreateUser.ts`](../api/src/functions/CreateUser.ts) line 92, [`api/src/functions/UpdateUser.ts`](../api/src/functions/UpdateUser.ts) line 68  
**Issue:** These endpoints set `authLevel: 'anonymous'` on the Azure Function registration while relying solely on the application-level `requireAuth` / `requireRole` checks inside the handler. This is technically correct for local dev (Azurite ignores function keys), but the inconsistency with other endpoints (`authLevel: 'function'`) is a latent risk if the function key enforcement is ever evaluated differently in production.  
**Recommended resolution:** Change all four to `authLevel: 'function'` to be consistent with all other protected endpoints. This is orthogonal to the feature requests but should be addressed.

---

### FLAG-05 — `isDeleted` Not Filtered in `GetPatients` OData Query
**Severity:** Medium  
**Affected files:** [`api/src/functions/GetPatients.ts`](../api/src/functions/GetPatients.ts) line 29  
**Issue:** The OData filter is `PartitionKey eq 'PATIENT'` with no `isDeleted eq false` clause. Deleted records are filtered out in the loop on the Node.js side (`if (!patient.isDeleted)`). This means each page pulled from Azure Table Storage may return fewer records than `pageSize` because deleted rows are excluded after the fact, making continuation-token pagination less accurate.  
**Recommended resolution:** Change the filter to `PartitionKey eq 'PATIENT' and isDeleted eq false` to push the predicate to Table Storage, consistent with how `GetExaminations` (line 39) and `GetUsers` (line 23) filter deleted records in OData.

---

### FLAG-06 — `requireAuth` Called Inconsistently (sync vs async)
**Severity:** Low (Code correctness)  
**Affected files:**  
- Async call (correct): [`api/src/functions/CreateExamination.ts`](../api/src/functions/CreateExamination.ts) line 17 — `await requireAuth(...)`  
- Sync call (also works but inconsistent): [`api/src/functions/GetUsers.ts`](../api/src/functions/GetUsers.ts) line 12, [`api/src/functions/GetAuditLogs.ts`](../api/src/functions/GetAuditLogs.ts) line 31 — `requireAuth(...)` without `await`  
**Issue:** `requireAuth` may be async (returns a `Promise`) in some contexts. Calling it without `await` means the truthiness check `if (!user)` evaluates a `Promise` object (always truthy), silently bypassing auth.  
**Recommended resolution:** Verify the return type of `requireAuth` in [`api/src/utils/authMiddleware.ts`](../api/src/utils/authMiddleware.ts). If it is `Promise<TokenPayload | null>`, add `await` on every call site that is missing it — at minimum `GetUsers.ts`, `GetAuditLogs.ts`, `CreateUser.ts`, and `UpdateUser.ts`.

---

### FLAG-07 — `patientAgeAtExam` Is Not Computed or Sent by ExaminationForm
**Severity:** Medium  
**Affected files:** [`frontend/src/components/ExaminationForm.tsx`](../frontend/src/components/ExaminationForm.tsx) lines 463–475  
**Issue:** Although `patientAgeAtExam` is defined in `CreateExaminationRequest` and `UpdateExaminationRequest` types, `ExaminationForm` never populates it in `submitData`. The backend stores `undefined` for this field even when `patient.birthDate` is available.  
**Recommended resolution:** Implement REQ-06. The form must look up the selected patient's `birthDate`, call `calculateAgeAtDate(birthDate, formData.examDate)`, and include the result as `patientAgeAtExam` in the submitted payload.

---

### FLAG-08 — Examination Creation Does Not Auto-Compute `patientAgeAtExam`
**Severity:** Low  
**Affected files:** [`api/src/functions/CreateExamination.ts`](../api/src/functions/CreateExamination.ts)  
**Issue:** The API already reads `patientAgeAtExam` from the request body and stores it verbatim. It has access to both `patient.birthDate` and `examDate`. If the frontend omits the field (see FLAG-07), the backend could compute it server-side as a fallback.  
**Recommended resolution:** After the primary client-side fix (REQ-06 / FLAG-07), optionally add server-side computation: if `patientAgeAtExam` is absent in the request but `patient.birthDate` and `examDate` are available, compute it using the same whole-years formula before storing. This provides a data-quality backstop but is lower priority than the frontend fix.

---

## 5. Summary Table

| Req ID | Feature Area | Title | Status |
|--------|--------------|-------|--------|
| REQ-01 | Multi-Type Architecture | Formal Examination Type Registry | ⚠️ Partial |
| REQ-02 | Multi-Type Architecture | Examination Type Selection at Creation | ⚠️ Partial |
| REQ-03 | Multi-Type Architecture | Rename to "Ultrasound Prenatal Exam" | ⚠️ Partial |
| REQ-04 | Multi-Type Architecture | Examination Type Filter on List Page | ⚠️ Partial |
| REQ-05 | Multi-Type Architecture | Type-Driven Form Field Rendering | ❌ Not Impl |
| REQ-06 | UPE Specific | Patient Age at Exam in Main Section | ⚠️ Partial |
| REQ-07 | UPE Specific | Remove Accordion from Input Form | ❌ Not Impl |
| REQ-08 | UPE Specific | Tighter Form Layout | ❌ Not Impl |
| REQ-09 | UPE Specific | Consistent Left/Right Alignment | ❌ Not Impl |
| REQ-10 | Pagination | Examinations List Server-Side Pagination | ✅ Done |
| REQ-11 | Pagination | Patients List Server-Side Pagination | ✅ Done |

| Flag ID | Severity | Title |
|---------|----------|-------|
| FLAG-01 | Medium | `examinationType` Editable on Edit Path |
| FLAG-02 | Medium | Backend Missing `examinationType` Filter |
| FLAG-03 | Low | Backend Accepts Any String for Type |
| FLAG-04 | High | User/Audit Endpoints Use Wrong `authLevel` |
| FLAG-05 | Medium | `GetPatients` OData Filter Missing `isDeleted` |
| FLAG-06 | Low | `requireAuth` Called Without `await` |
| FLAG-07 | Medium | `patientAgeAtExam` Not Submitted by Form |
| FLAG-08 | Low | No Server-Side `patientAgeAtExam` Fallback |
