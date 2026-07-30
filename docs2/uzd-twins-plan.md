# Plan: Ultrasound Prenatal Exam for Twins (uzd-twins)

## Top-Level Overview

**Goal:** Introduce a new examination type `ultrasound_prenatal_twins` that mirrors
`ultrasound_prenatal` but presents the four per-fetus sections — Biometry, Doppler,
Ultrasound Findings, and Anatomy — twice (once for Twin 1 and once for Twin 2),
side-by-side in the form UI, and on a single A4 page in the PDF output.

**Scope:**
- New exam type registration (frontend + backend constants)
- Extended data model to hold twin-indexed per-fetus data
- Backend validation schema extension
- All GET/update deserialization sites updated for twin fields
- Form UI: side-by-side twin sections, reusing existing field/validation logic
- Detail page: side-by-side twin section rendering
- PDF: compact twin layout that fits one A4 page (minimum 8 pt font)

**Out of scope (not stated in requirements):**
- Supporting more than two fetuses
- Changing the existing `ultrasound_prenatal` single-fetus form in any way
- Migrating existing `ultrasound_prenatal` records

---

## Requirements (from docs2/uzd-twins-requirements.txt)

| # | Requirement |
|---|-------------|
| R1 | New form type: Ultrasound Prenatal Exam for Twins |
| R2 | Same content as Ultrasound Prenatal Exam |
| R3 | Sections Biometry, Doppler, Ultrasound Findings, Anatomy appear **twice** (once per twin) |
| R4 | All validation and input rules per section are identical to the single-fetus form |
| R5 | Same-type sections are **side by side** in the form (Twin 1 left, Twin 2 right) |
| R6 | Printed/PDF content must fit a **single A4 page** |

---

## Confirmed Design Decisions

| Topic | Decision |
|---|---|
| GA from Biometry | Calculated, stored, and displayed **separately per twin** |
| GA from LMP | **One shared value** — belongs to the mother, lives in Pregnancy Data |
| Biometry percentiles | **Separate per twin**, same Hadlock formulas, UI disclaimer noting singleton reference values |
| Storage model | Option (a/c): `biometry`/`doppler`/`data.ultrasound_findings`/`data.anatomy` = T1 (unchanged); `biometry2`/`doppler2`/`data.twin2_ultrasound_findings`/`data.twin2_anatomy` = T2 |
| GA from Biometry storage | Top-level `gestationalAgeFromBiometry` = T1 (unchanged); new top-level `gestationalAgeFromBiometry2` = T2 |
| Vessel / Duc.Ven | Per twin (they are Doppler fields — both twins have independent Doppler objects) |
| Narrow screen layout | Side-by-side at width TBD by experiment; stacks vertically on narrow screens |
| PDF font size minimum | **8 pt** — layout must be designed to fit within this constraint |
| Existing records | No migration; old `ultrasound_prenatal` records render correctly as before |

---

## Storage Model Detail

```
Azure Table Storage — Examinations entity (twins exam)
─────────────────────────────────────────────────────
biometry                 JSON string  → Twin 1 BiometryData
doppler                  JSON string  → Twin 1 DopplerData
gestationalAgeFromBiometry  string   → Twin 1 GA from biometry
biometry2                JSON string  → Twin 2 BiometryData   (NEW)
doppler2                 JSON string  → Twin 2 DopplerData    (NEW)
gestationalAgeFromBiometry2 string   → Twin 2 GA from biometry (NEW)
data                     JSON string  → {
                                          pregnancy_data,           (shared)
                                          ultrasound_findings,      (Twin 1)
                                          anatomy,                  (Twin 1)
                                          twin2_ultrasound_findings,(Twin 2 NEW)
                                          twin2_anatomy,            (Twin 2 NEW)
                                          comments
                                        }
```

All new fields are optional. Single-fetus records simply have `undefined` for T2 fields.

---

## Architecture Overview

```
Frontend (React + Carbon)
  examinationTypes.ts                       → register 'ultrasound_prenatal_twins' + SECTION_VISIBILITY
  types/index.ts                            → add biometry2, doppler2, gestationalAgeFromBiometry2, twin2 data fields
  ExaminationForm.tsx                       → twin side-by-side layout using section components
  sections/BiometrySection.tsx              → NEW generic per-fetus biometry section component
  sections/DopplerSection.tsx               → NEW generic per-fetus doppler section component
  sections/UltrasoundFindingsSection.tsx    → NEW generic per-fetus ultrasound findings section component
  sections/AnatomySection.tsx               → NEW generic per-fetus anatomy section component
  ExaminationDetailPage.tsx                 → twin two-column read-only rendering
  EditExaminationPage.tsx                   → no changes needed; passes examination to ExaminationForm unchanged
  print.service.ts                          → extend ViewModel with T2 blocks
  pdfDocument.ts                            → compact two-column twin PDF layout (8 pt min)

Backend (Azure Functions)
  api/constants/examinationTypes.ts  → register new key
  api/types/index.ts                 → twin fields on Examination/BiometryData/DopplerData
  api/utils/validation.ts            → extend Joi schema for biometry2/doppler2/twin2 data
  CreateExamination.ts               → serialize biometry2, doppler2, gestationalAgeFromBiometry2
  UpdateExamination.ts               → serialize + sync biometry2, doppler2, gestationalAgeFromBiometry2
  GetExamination.ts                  → deserialize biometry2, doppler2 JSON strings
  GetExaminations.ts                 → deserialize biometry2, doppler2 JSON strings
  GetExaminationByMRN.ts             → deserialize biometry2, doppler2 JSON strings
```

---

## Development Phases & Sub-Tasks

### Phase 1 — Type Registry & Data Model

---

#### Sub-Task 1.1: Register the new examination type
**Intent:** Make `ultrasound_prenatal_twins` a valid exam type key in both frontend and backend registries. Without this entry the type is rejected by backend validation and the `SECTION_VISIBILITY` fallback silently applies.

**Expected Outcomes:**
- `EXAM_TYPES` in `frontend/src/constants/examinationTypes.ts` contains `{ key: 'ultrasound_prenatal_twins', label: 'Ultrasound Prenatal Exam for Twins' }`.
- `SECTION_VISIBILITY['ultrasound_prenatal_twins']` is present with the same boolean flags as `ultrasound_prenatal`.
- Both changes are mirrored in `api/src/constants/examinationTypes.ts`.

**Todo:**
1. Edit [`frontend/src/constants/examinationTypes.ts`](frontend/src/constants/examinationTypes.ts):
   - Append `{ key: 'ultrasound_prenatal_twins', label: 'Ultrasound Prenatal Exam for Twins' }` to `EXAM_TYPES`.
   - Add `ultrasound_prenatal_twins: { pregnancyData: true, ultrasoundFindings: true, anatomy: true, biometry: true, doppler: true }` to `SECTION_VISIBILITY`.
2. Edit [`api/src/constants/examinationTypes.ts`](api/src/constants/examinationTypes.ts):
   - Append the same entry to `EXAM_TYPES`.

**Relevant Context:**
- [`frontend/src/constants/examinationTypes.ts`](frontend/src/constants/examinationTypes.ts)
- [`api/src/constants/examinationTypes.ts`](api/src/constants/examinationTypes.ts)
- Project rule: *"A corresponding SECTION_VISIBILITY entry is mandatory when registering a new examination type."*

**Status:** `[x] done`

---

#### Sub-Task 1.2: Extend the TypeScript data model (frontend + backend)
**Intent:** Add twin-2 fields to the type interfaces so the rest of the implementation is fully type-safe.

**Expected Outcomes:**
- `frontend/src/types/index.ts`:
  - `ExaminationData` gains `twin2_ultrasound_findings?: UltrasoundFindings` and `twin2_anatomy?: AnatomyFindings`.
  - `Examination` gains `biometry2?: Biometry`, `doppler2?: Doppler`, `gestationalAgeFromBiometry2?: string`.
  - `CreateExaminationRequest` and `UpdateExaminationRequest` gain the same three optional fields.
- `api/src/types/index.ts`:
  - `ExaminationData` gains `twin2_ultrasound_findings?: UltrasoundFindings` and `twin2_anatomy?: AnatomyFindings`.
  - `Examination` gains `biometry2?: BiometryData`, `doppler2?: DopplerData`, `gestationalAgeFromBiometry2?: string`.

**Todo:**
1. Edit [`frontend/src/types/index.ts`](frontend/src/types/index.ts):
   - Add `twin2_ultrasound_findings?: UltrasoundFindings` and `twin2_anatomy?: AnatomyFindings` to `ExaminationData`.
   - Add `biometry2?: Biometry`, `doppler2?: Doppler`, `gestationalAgeFromBiometry2?: string` to `Examination`.
   - Add the same three optional fields to `CreateExaminationRequest` and `UpdateExaminationRequest`.
2. Edit [`api/src/types/index.ts`](api/src/types/index.ts):
   - Add `twin2_ultrasound_findings?: UltrasoundFindings` and `twin2_anatomy?: AnatomyFindings` to `ExaminationData`.
   - Add `biometry2?: BiometryData`, `doppler2?: DopplerData`, `gestationalAgeFromBiometry2?: string` to `Examination`.

**Relevant Context:**
- [`frontend/src/types/index.ts:55`](frontend/src/types/index.ts:55)
- [`api/src/types/index.ts:107`](api/src/types/index.ts:107)

**Status:** `[x] done`

---

### Phase 2 — Backend

---

#### Sub-Task 2.1: Extend Joi validation schema for twin fields
**Intent:** Accept the new twin fields on create and update without breaking validation for existing single-fetus exams.

**Expected Outcomes:**
- `examinationSchema` accepts `biometry2` (reuses `biometrySchema`), `doppler2` (reuses `dopplerSchema`), and `gestationalAgeFromBiometry2` (same pattern/regex as `gestationalAgeFromBiometry`).
- `examinationDataSchema` accepts `twin2_ultrasound_findings` (reuses `ultrasoundFindingsSchema`) and `twin2_anatomy` (reuses `anatomySchema`).
- All new fields are optional. Existing validation for `ultrasound_prenatal` is unaffected.

**Todo:**
1. Edit [`api/src/utils/validation.ts`](api/src/utils/validation.ts):
   - Add to `examinationSchema`: `biometry2: biometrySchema`, `doppler2: dopplerSchema`, `gestationalAgeFromBiometry2: Joi.string().pattern(/^\d{1,2}w\s?\d{1}d$/).optional().allow('')`.
   - Add to `examinationDataSchema`: `twin2_ultrasound_findings: ultrasoundFindingsSchema`, `twin2_anatomy: anatomySchema`.

**Relevant Context:**
- [`api/src/utils/validation.ts:268`](api/src/utils/validation.ts:268) — `examinationDataSchema`
- [`api/src/utils/validation.ts:280`](api/src/utils/validation.ts:280) — `examinationSchema`

**Status:** `[x] done`

---

#### Sub-Task 2.2: Serialize twin fields in CreateExamination and UpdateExamination
**Intent:** The backend must write `biometry2`, `doppler2`, and `gestationalAgeFromBiometry2` to the entity, following the exact same serialize-to-JSON-string pattern used for `biometry` and `doppler`.

**Expected Outcomes:**
- `CreateExamination.ts` extracts `biometry2`, `doppler2`, `gestationalAgeFromBiometry2` from the request body and writes them to all three entity writes (primary, lookup, MRN).
- `UpdateExamination.ts` does the same: extracts from body, serializes, adds to the changed-fields sync block for both the lookup entity and the primary entity.
- A missing `biometry2`/`doppler2` on a single-fetus create/update is harmless (field is simply absent).
- **Note — create response:** `CreateExamination.ts` currently returns `lookupExamEntity` directly in the success response (line 180) without deserializing the JSON string fields. This means `biometry` and `doppler` arrive as raw strings on the create response — a pre-existing quirk. After adding `biometry2`/`doppler2`, the same applies to those fields. The frontend `ExaminationForm` does not consume the create response body directly (it navigates away on success), so this does not cause a functional bug in this feature. Do not introduce a deserialization step here unless it is addressed as a separate task.

**Todo:**
1. Edit [`api/src/functions/CreateExamination.ts`](api/src/functions/CreateExamination.ts):
   - Add `biometry2`, `doppler2`, `gestationalAgeFromBiometry2` to `ExaminationCreateBody` interface and destructuring.
   - Serialize: `const biometry2Str = biometry2 ? JSON.stringify(biometry2) : undefined;` and same for `doppler2`.
   - Add `biometry2: biometry2Str`, `doppler2: doppler2Str`, `gestationalAgeFromBiometry2` to all three entity objects.
2. Edit [`api/src/functions/UpdateExamination.ts`](api/src/functions/UpdateExamination.ts):
   - Add to `ExaminationBody` interface and destructuring.
   - Add conditional update blocks (lines 138–184 pattern) for `biometry2`, `doppler2`, `gestationalAgeFromBiometry2`.
   - Add the same three fields to the primary entity sync block (lines 206–221 pattern).

**Relevant Context:**
- [`api/src/functions/CreateExamination.ts:28`](api/src/functions/CreateExamination.ts:28) — `ExaminationCreateBody`
- [`api/src/functions/CreateExamination.ts:95`](api/src/functions/CreateExamination.ts:95) — serialization pattern
- [`api/src/functions/UpdateExamination.ts:34`](api/src/functions/UpdateExamination.ts:34) — `ExaminationBody` + deserialization sync

**Status:** `[x] done`

---

#### Sub-Task 2.3: Deserialize twin fields in all GET functions
**Intent:** When an examination is read from Table Storage, `biometry2` and `doppler2` are stored as JSON strings and must be parsed back to objects before the response is sent — exactly as `biometry` and `doppler` are handled today. Missing this step breaks T2 data on the frontend silently (fields arrive as raw strings).

**Expected Outcomes:**
- `GetExamination.ts` deserializes `biometry2` and `doppler2` alongside `biometry`, `doppler`, `data`.
- `GetExaminations.ts` deserializes `biometry2` and `doppler2` alongside `biometry`, `doppler`.
- `GetExaminationByMRN.ts` does the same.
- Old single-fetus records (where `biometry2` is `undefined`) pass through unchanged.

**Todo:**
1. Edit [`api/src/functions/GetExamination.ts:43`](api/src/functions/GetExamination.ts:43):
   - Add `biometry2: examination.biometry2 && typeof examination.biometry2 === 'string' ? JSON.parse(examination.biometry2 as any) : examination.biometry2` to `deserializedExamination`.
   - Same for `doppler2`.
2. Edit [`api/src/functions/GetExaminations.ts:98`](api/src/functions/GetExaminations.ts:98):
   - Add the same `biometry2` and `doppler2` deserialization to the `examinations.push(...)` block.
3. Edit `api/src/functions/GetExaminationByMRN.ts`:
   - Add the same `biometry2` and `doppler2` deserialization to its `deserializedExamination` block.

**Relevant Context:**
- [`api/src/functions/GetExamination.ts:43`](api/src/functions/GetExamination.ts:43)
- [`api/src/functions/GetExaminations.ts:98`](api/src/functions/GetExaminations.ts:98)
- [`api/src/functions/GetExaminationByMRN.ts`](api/src/functions/GetExaminationByMRN.ts)

**Status:** `[x] done`

---

#### Sub-Task 2.4: Update test utility for twin fields
**Intent:** The test utility `createTestExamination()` in `testUtils.ts` explicitly deserializes `biometry` and `doppler` when building test fixtures. Without also deserializing `biometry2` and `doppler2`, any integration test that creates a twins examination fixture will silently receive raw JSON strings for T2 fields, causing assertion failures or incorrect behaviour in tests.

**Expected Outcomes:**
- `createTestExamination()` in `api/src/tests/testUtils.ts` deserializes `biometry2` and `doppler2` alongside `biometry` and `doppler` in its return value.
- Single-fetus test fixtures (where `biometry2` is absent) are unaffected.

**Todo:**
1. Edit [`api/src/tests/testUtils.ts:199`](api/src/tests/testUtils.ts:199):
   - Add `biometry2: lookupEntity.biometry2 && typeof lookupEntity.biometry2 === 'string' ? JSON.parse(lookupEntity.biometry2 as any) : lookupEntity.biometry2` to the returned object.
   - Same for `doppler2`.

**Relevant Context:**
- [`api/src/tests/testUtils.ts:199`](api/src/tests/testUtils.ts:199) — current deserialization pattern to mirror

**Status:** `[x] done`

---

### Phase 3 — Frontend Form

---

#### Sub-Task 3.1: Create the per-fetus section components
**Intent:** Extract the four per-fetus sections (Biometry, Doppler, Ultrasound Findings, Anatomy) into individual standalone components that can be instantiated once for single-fetus exams and twice for twins, each with independent form state, independent field IDs, and its own AutoCalc buttons.

> **⚠️ Forward-compatibility note:** These components must be implemented as **four separate, generically-named files** — `BiometrySection.tsx`, `DopplerSection.tsx`, `UltrasoundFindingsSection.tsx`, `AnatomySection.tsx` — rather than a single `TwinSection.tsx`. Each component is parameterized by `prefix` and `data` only; it has no knowledge of twin logic or the twins exam type. This is the same implementation effort but positions every component as a reusable building block for a future section-registry architecture when exam types 3–5 are introduced. The twins exam type assembles two instances of each; future types assemble whatever combination they require. Coupling these components to the twins concept now would force a rename/refactor before every subsequent type can use them.

**Expected Outcomes:**
- Four new files exist:
  - [`frontend/src/components/sections/BiometrySection.tsx`](frontend/src/components/sections/BiometrySection.tsx)
  - [`frontend/src/components/sections/DopplerSection.tsx`](frontend/src/components/sections/DopplerSection.tsx)
  - [`frontend/src/components/sections/UltrasoundFindingsSection.tsx`](frontend/src/components/sections/UltrasoundFindingsSection.tsx)
  - [`frontend/src/components/sections/AnatomySection.tsx`](frontend/src/components/sections/AnatomySection.tsx)
- Each component accepts: `prefix: string`, `data: <SectionFormData>`, `errors: Record<string, string>`, `onChange: (field: string, value: string) => void`, `isSubmitting: boolean`. No `twinLabel` prop — the caller renders the heading.
- All Carbon `TextInput`/`Select` ids are prefixed (e.g. `t1_bpd`, `t2_bpd`) to keep DOM ids unique.
- `BiometrySection` includes AutoCalc GA and AutoCalc EFW buttons operating on its own prefixed BPD/HC/AC/FL values, and percentile read-only fields with helper text: "Percentiles based on singleton Hadlock reference values".
- Layout inside each component: same `row6` CSS grid as `ExaminationForm.tsx` today.

**Todo:**
1. Create `frontend/src/components/sections/` directory.
2. Create [`frontend/src/components/sections/BiometrySection.tsx`](frontend/src/components/sections/BiometrySection.tsx) — all biometry fields, AutoCalc GA, AutoCalc EFW, percentile display.
3. Create [`frontend/src/components/sections/DopplerSection.tsx`](frontend/src/components/sections/DopplerSection.tsx) — all doppler fields.
4. Create [`frontend/src/components/sections/UltrasoundFindingsSection.tsx`](frontend/src/components/sections/UltrasoundFindingsSection.tsx) — presentation, gender, heart rate, fetal movement, placenta, umbilical cord.
5. Create [`frontend/src/components/sections/AnatomySection.tsx`](frontend/src/components/sections/AnatomySection.tsx) — all anatomy fields.
6. Each section defines its own `<Name>SectionFormData` interface exported alongside the component.

**Relevant Context:**
- [`frontend/src/components/ExaminationForm.tsx:700`](frontend/src/components/ExaminationForm.tsx:700) — Anatomy/Ultrasound/Biometry/Doppler blocks to extract
- [`frontend/src/utils/calculations.ts`](frontend/src/utils/calculations.ts) — `calcGAFromBiometry`, `calcEFW`, `calcBiometryPercentiles`, `calcEFWPercentile`

**Status:** `[x] done`

---

#### Sub-Task 3.2: Extend ExaminationForm for twins layout
**Intent:** When `examinationType === 'ultrasound_prenatal_twins'`, the form renders two instances of each section component side-by-side. The single-fetus path is unchanged and is also updated to use the new section components in place of its inline JSX blocks.

**Expected Outcomes:**
- `formData` state in `ExaminationForm.tsx` is extended with T2 fields (all prefixed `t2_`), initialized from `examination.biometry2` / `examination.doppler2` etc. on edit.
- `errors` and `handleChange` cover T2 fields transparently (same mechanism).
- A derived boolean `isTwins = formData.examinationType === 'ultrasound_prenatal_twins'` gates the layout branch.
- When `isTwins`: Pregnancy Data renders once (shared), then a `display: grid; grid-template-columns: 1fr 1fr` container holds the T1 section components (`<BiometrySection prefix="t1" .../>`, etc.) left and the T2 section components (`<BiometrySection prefix="t2" .../>`, etc.) right. Below a minimum width (determined by experiment) the grid collapses to single column via a CSS class or inline media query.
- When `!isTwins`: existing single-fetus layout is completely unchanged.
- On submit, T2 data is assembled into `biometry2`, `doppler2`, `gestationalAgeFromBiometry2`, `data.twin2_ultrasound_findings`, `data.twin2_anatomy` and included in the payload.
- Validation runs over T2 fields using the same `validateBiometryField` / `validateDopplerField` / `heart_rate` helpers.

**Todo:**
1. Edit [`frontend/src/components/ExaminationForm.tsx`](frontend/src/components/ExaminationForm.tsx):
   - Extend `useState` initializer with T2 fields (`t2_bpd`, `t2_hc`, … all biometry, all doppler, all ultrasound findings, all anatomy, `t2_gestationalAgeFromBiometry`).
   - Initialize T2 fields from `examination.biometry2`, `examination.doppler2`, `examination.data?.twin2_ultrasound_findings`, `examination.data?.twin2_anatomy` on edit.
   - Add `isTwins` computed boolean.
   - Extend `validateForm` to run T2 field validation when `isTwins`.
   - Add twin layout JSX (conditional on `isTwins`), wrapping two instances of each section component (`<BiometrySection prefix="t1" .../>` beside `<BiometrySection prefix="t2" .../>`, etc.).
   - Update the single-fetus layout path to use the new section components with `prefix="t1"` (this replaces the inline JSX blocks — no behaviour change, just uses the extracted components).
   - Extend `handleSubmit` to assemble and include T2 fields in payload.
2. Add a CSS module or inline style that collapses `1fr 1fr` to `1fr` below a breakpoint (`@media (max-width: Xpx)` — exact value to be determined during implementation by testing at common widths).

**Relevant Context:**
- Sub-Task 3.1 must be complete first
- [`frontend/src/components/ExaminationForm.tsx`](frontend/src/components/ExaminationForm.tsx)
- [`frontend/src/pages/EditExaminationPage.tsx`](frontend/src/pages/EditExaminationPage.tsx) — passes `examination` prop to `ExaminationForm` with `isEdit={true}`; no changes needed here, but read it to understand the full edit flow before implementing T2 field initialization
- [`frontend/src/types/index.ts`](frontend/src/types/index.ts) — `CreateExaminationRequest` / `UpdateExaminationRequest`

**Status:** `[x] done`

---

### Phase 4 — Frontend Detail Page

---

#### Sub-Task 4.1: Extend ExaminationDetailPage for twin rendering
**Intent:** When viewing a twins exam in read-only mode, the detail page renders the four per-fetus sections in a two-column layout matching the form, sourcing T2 data from the new fields.

**Expected Outcomes:**
- `ExaminationDetailPage.tsx` detects `examination.examinationType === 'ultrasound_prenatal_twins'`.
- In that case, Biometry, Doppler, Ultrasound Findings, and Anatomy render in a two-column grid labelled "Twin 1" / "Twin 2".
- T1 data sourced from `examination.biometry`, `examination.doppler`, `examination.data?.ultrasound_findings`, `examination.data?.anatomy` (unchanged).
- T2 data sourced from `examination.biometry2`, `examination.doppler2`, `examination.data?.twin2_ultrasound_findings`, `examination.data?.twin2_anatomy`.
- `gestationalAgeFromBiometry` (T1) and `gestationalAgeFromBiometry2` (T2) displayed in their respective twin columns.
- Biometry percentile badges shown per-twin column using the same `calcBiometryPercentiles` helper.
- Pregnancy Data, Clinical Information, and Metadata sections remain full-width (unchanged).
- Single-fetus exams render identically to today.

**Todo:**
1. Edit [`frontend/src/pages/ExaminationDetailPage.tsx`](frontend/src/pages/ExaminationDetailPage.tsx):
   - Add `isTwins` computed variable.
   - Wrap the four per-fetus section blocks in a conditional:
     - `isTwins === false`: existing single-column layout unchanged.
     - `isTwins === true`: CSS grid `1fr 1fr` container, each column labelled and populated from T1 / T2 sources.

**Relevant Context:**
- [`frontend/src/pages/ExaminationDetailPage.tsx`](frontend/src/pages/ExaminationDetailPage.tsx)
- Sub-Task 1.2 (type fields) must be complete

**Status:** `[x] done`

---

### Phase 5 — PDF Generation

---

#### Sub-Task 5.1: Extend print.service.ts ViewModel for twins
**Intent:** The PDF ViewModel must carry T2 biometry, doppler, ultrasound, and anatomy blocks so the PDF builder has structured data to render.

**Expected Outcomes:**
- `ExamPdfViewModel` in `print.service.ts` gains optional `biometry2`, `doppler2`, `ultrasound2`, `anatomy2` blocks of the same shape as their T1 counterparts, plus `gestationalAgeFromBiometry2?: string`.
- `buildViewModel()` populates T2 blocks when `exam.examinationType === 'ultrasound_prenatal_twins'`, using the same `fmtBiometry`/percentile helpers as T1.
- When exam is single-fetus, T2 blocks are `undefined` — the PDF builder guards with `vm.biometry2 &&`.

**Todo:**
1. Edit [`frontend/src/services/print.service.ts`](frontend/src/services/print.service.ts):
   - Add `biometry2?`, `doppler2?`, `ultrasound2?`, `anatomy2?`, `gestationalAgeFromBiometry2?` to `ExamPdfViewModel`.
   - In `buildViewModel()`, after building T1 blocks, conditionally build T2 blocks from `exam.biometry2`, `exam.doppler2`, `exam.data?.twin2_ultrasound_findings`, `exam.data?.twin2_anatomy`.

**Relevant Context:**
- [`frontend/src/services/print.service.ts`](frontend/src/services/print.service.ts)

**Status:** `[x] done`

---

#### Sub-Task 5.2: Compact twin PDF layout in pdfDocument.ts
**Intent:** When `vm.examinationType === 'ultrasound_prenatal_twins'`, render all content on one A4 page using a side-by-side two-column layout for the four twin sections. Font size must stay ≥ 8 pt throughout.

**Key layout constraints:**
- A4 usable width: 182 mm (margins 14 mm each side)
- Twin column width: 88 mm each with 6 mm gutter → `88 + 6 + 88 = 182 mm`
- Header, patient block, Pregnancy Data: full-width (unchanged)
- Biometry, Doppler, Ultrasound Findings, Anatomy: two-column (T1 left at x=14, T2 right at x=108)
- Clinical Information + signature block: full-width, at bottom
- Data rows: 8 pt (minimum) with tighter line spacing than the single-fetus layout
- Section headings within twin columns: 8 pt bold

**Expected Outcomes:**
- A new helper `kvGridAt(doc, pairs, y, cols, xStart, colW, fontSize?)` renders a key-value grid at a specific x position and column width — reuses the logic of the existing `kvGrid` but is positional.
- `buildExaminationPDF` adds `const isTwins = vm.examinationType === 'ultrasound_prenatal_twins'`.
- For `isTwins === false`: existing layout is completely unchanged.
- For `isTwins === true`:
  - Header + patient block + Pregnancy Data render full-width (same as today).
  - A twin-columns loop renders Biometry → Doppler → Ultrasound Findings → Anatomy for T1 (left column) and T2 (right column) side-by-side, advancing `y` by the max height of each section pair.
  - Clinical Information and signature follow at the bottom.
- All content fits on one page at 8 pt minimum font. If a test render overflows, the number of `kvGrid` columns per twin column must be increased (e.g. 2 cols → 3 cols) to reduce row count — this is a layout tuning step during implementation.

**Todo:**
1. Edit [`frontend/src/components/reports/pdfDocument.ts`](frontend/src/components/reports/pdfDocument.ts):
   - Implement `kvGridAt(doc, pairs, y, cols, xStart, colW, fontSize)` helper. This mirrors `kvGrid` but takes explicit `xStart` and `colW` rather than using global `MARGIN_L` and `COL_W`.
   - Add `isTwins` flag.
   - Add the twin two-column rendering branch (guarded by `isTwins`).
2. Manually generate a PDF from a test twins exam (all fields populated) and verify everything fits on one page at 8 pt.
3. Tune column count within each twin column if any section overflows.

**Relevant Context:**
- [`frontend/src/components/reports/pdfDocument.ts`](frontend/src/components/reports/pdfDocument.ts) — `kvGrid` helper and `buildExaminationPDF`
- Sub-Task 5.1 must be complete first
- Layout constants: `PAGE_W=210`, `MARGIN_L=14`, usable width = 182 mm; twin col = 88 mm, gutter = 6 mm

**Status:** `[x] done` — Note: kvGrid y-argument bug (missing `y` in single-fetus calls) was found and fixed during validation. Frontend build `✓` (zero TS errors). Backend tests 119/119 pass.

---

## Dependency Graph

```
1.1 ──► (type registry complete)
1.2 ──► (data model complete)
         │
2.1 ◄────┤
2.2 ◄────┤
2.3 ◄────┤   ← All backend sub-tasks depend on 1.2
2.4 ◄────┤   ← Test utility (independent, can run alongside 2.1–2.3)
         │
3.1 ◄────┤   ← Section components (no backend dependency)
3.2 ◄────3.1
         │
4.1 ◄────┤   ← Detail page (no backend dependency beyond types)
         │
5.1 ◄────┤
5.2 ◄────5.1
```

Sub-tasks 3.x, 4.x, 5.x can all begin once 1.2 is done. Sub-tasks 2.x can all proceed in parallel with each other.

---

## Risk Register

| Risk | Tied To | Mitigation |
|------|---------|-----------|
| PDF does not fit one A4 page at 8 pt minimum | R6, Sub-Task 5.2 | Prototype PDF layout early; increase `cols` parameter in `kvGridAt` to pack more pairs per row if needed. Shared sections (Pregnancy Data, Clinical Info) can be rendered more compactly for twins variant. |
| A GET function deserialization site is missed | Sub-Task 2.3 | There are exactly 3 GET functions that parse biometry/doppler — `GetExamination`, `GetExaminations`, `GetExaminationByMRN`. All three are listed explicitly in 2.3. |
| UpdateExamination primary-entity sync block misses twin fields | Sub-Task 2.2 | The sync block at lines 206–221 explicitly lists every field — twin fields must be added alongside `biometry`/`doppler`. Review after implementation. |
| Narrow-screen stacking breakpoint unknown | Sub-Task 3.2 | Experiment at 1024 px, 1280 px, 1440 px during implementation. Document the chosen breakpoint in a comment. |
| Percentile Hadlock tables not validated for twins | Sub-Task 3.1 | Add a helper text label under each percentile field: "Based on singleton reference values". Clinical team should confirm acceptability post-launch. |

---

## Forward-Compatibility Note (Types 3–5)

The current architecture has two layers with very different scalability profiles:

- **Type registry** (`EXAM_TYPES`, `SECTION_VISIBILITY`, `EXAM_TYPE_KEYS`) — scales for free. Adding any new type costs two file edits and zero code changes elsewhere.
- **Data shape and rendering** (`Examination` interface, `ExaminationForm`, `ExaminationDetailPage`, `pdfDocument.ts`) — does not scale beyond approximately two structurally-distinct types. Each type with a unique data shape adds more optional fields to the shared `Examination` interface and more branching to the form, detail page, and PDF.

The section components introduced in Sub-Task 3.1 are the first step toward a section-registry model that fixes this. Before implementing type 3, a deliberate architecture decision should be made:

**Recommended pre-type-3 refactor (not in scope of this plan):**
- Move all section data into the `data` JSON blob, keyed by section name (e.g. `data.biometry`, `data.doppler` alongside the existing `data.ultrasound_findings`, `data.anatomy`). This eliminates the promoted top-level `biometry`/`doppler` properties and unifies the extensibility model.
- Extend `SECTION_VISIBILITY` into a full `SECTION_CONFIG` map that declares, per type, which section components to render and in what layout (single column, two-column, etc.).
- The form, detail page, and PDF builder iterate over the type's declared section config rather than branching on the type key — adding a new type requires zero changes to those files.

This refactor should be scoped and planned once type 3's section requirements are known, so the abstraction is designed against at least three concrete data points rather than two.
