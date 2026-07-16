# Requirement Specification: Examination Type–Driven Field Visibility on Detail Page and PDF

| Field | Value |
|---|---|
| **Spec ID** | REQ-EXAM-TYPE-001 |
| **Related Defect** | DEF-EXAM-TYPE-001 |
| **Status** | Draft |
| **Applies To** | `ExaminationDetailPage`, PDF report generation |

---

## Objective

Ensure that the examination detail page and the PDF report render precisely the set of sections and fields that the input form makes available for the given examination type — including all calculated and read-only fields — irrespective of whether those fields contain recorded values. Fields belonging to the examination type that have no recorded value must display an empty-value placeholder rather than being omitted.

---

## Scope

### In Scope

- Field and section visibility on `ExaminationDetailPage`.
- Field and section rendering in the PDF report produced by `pdfDocument.ts` via `print.service.ts`.
- Centralisation of examination type field visibility configuration so it is shared across the input form, the detail page, and the PDF pipeline.
- Calculated / read-only fields that the form derives on screen for the given examination type (e.g. EDD, GA from Biometry, biometry percentiles, EFW percentile).

### Out of Scope

- Changes to the input form's existing type-driven visibility behaviour — this is already correct and serves as the reference implementation.
- Changes to examination type definitions, field schemas, or backend validation.
- Introduction of new examination types.
- Any changes to data storage, API contracts, or the `Examination` domain model.
- Modification of business logic for calculations (EDD, percentile derivations, etc.).

---

## Definitions

| Term | Meaning |
|---|---|
| **Examination type** | A string key (e.g. `ultrasound_prenatal`) that identifies the clinical category of an examination record. Stored on the `Examination` entity as `examinationType`. |
| **Section** | A logical grouping of related fields presented together (e.g. Biometry, Doppler, Anatomy, Ultrasound Findings, Pregnancy Data). |
| **SECTION_VISIBILITY** | A configuration map keyed by examination type; each entry is a flat boolean record mapping section identifiers to `true` or `false`. Currently defined inside `ExaminationForm.tsx`. |
| **Data-presence guard** | A conditional that hides a section or field when all its values are absent. This is the current (incorrect) strategy used by the detail page and PDF. |
| **Type-driven guard** | A conditional that shows or hides a section based solely on whether it is configured as visible for the recorded examination type. This is the correct target strategy. |
| **Empty-value placeholder** | The string `—` used to represent a field that belongs to the examination type but has no recorded value. |
| **Calculated field** | A value derived client-side from other stored fields (e.g. EDD from LMP, GA from Biometry from four biometry measurements, percentile ranks). |
| **Universal field** | A field that must always be shown regardless of examination type (e.g. Patient Name, Patient Age at Exam). These are never gated by `SECTION_VISIBILITY`. |
| **Merged tile problem** | The current condition where pregnancy-specific fields (LMP, EDD, GA fields, Obstetric History, Family History) are embedded unconditionally inside the always-rendered Patient Information tile, making them impossible to suppress for exam types where `pregnancyData` is `false`. |

---

## Functional Requirements

### FR-1: Shared Visibility Configuration

**FR-1.1** The `SECTION_VISIBILITY` map must be extracted from `ExaminationForm.tsx` and relocated to the shared constants module `frontend/src/constants/examinationTypes.ts`, exported alongside `EXAM_TYPES`.

**FR-1.2** The form (`ExaminationForm.tsx`), the detail page (`ExaminationDetailPage.tsx`), and the PDF rendering pipeline (`pdfDocument.ts` / `print.service.ts`) must all import and use the same `SECTION_VISIBILITY` export. No copy of this map may exist in more than one file.

**FR-1.3** When a new examination type is added to `EXAM_TYPES` and a corresponding entry is added to `SECTION_VISIBILITY`, no further changes to the detail page or PDF files must be required for that type's section visibility to take effect.

---

### FR-2: Detail Page — Section Visibility

**FR-2.1** Each clinical section tile on `ExaminationDetailPage` must be rendered if and only if the examination's `examinationType` maps to `true` for that section in `SECTION_VISIBILITY`. The sections and their identifiers are:

| Section identifier | Detail page tile |
|---|---|
| `pregnancyData` | **Separate** Pregnancy Data tile (see FR-2.5) |
| `ultrasoundFindings` | Ultrasound Findings tile |
| `anatomy` | Anatomy tile |
| `biometry` | Biometry Measurements tile |
| `doppler` | Doppler Measurements tile |

**FR-2.2** The following fields are **universal** and must always be rendered in their own tile regardless of examination type: Patient Name, Patient Age at Exam, MRN, Status, Exam Date, Exam Type label. The Clinical Information / Findings, Comments, Notes, and Metadata tiles must also always be rendered.

**FR-2.3** If a section's visibility flag for the examination type is `true` and no value has been recorded in the examination, the section tile must still be rendered with its heading and all its fields, each showing `—`.

**FR-2.4** If `SECTION_VISIBILITY` does not contain an entry for the examination's `examinationType` (i.e. the type is unrecognised), the detail page must fall back to the `ultrasound_prenatal` visibility configuration, consistent with the fallback already present in the input form.

**FR-2.5 — Pregnancy Data tile separation (merged tile fix)**: The current Patient Information tile merges universal patient identity fields with pregnancy-specific fields (LMP, EDD, GA from LMP, GA from Biometry, Obstetric History, Family History) into a single always-rendered tile. This must be corrected as follows:

- The Patient Information tile must be reduced to contain **only universal fields**: Patient Name and Patient Age at Exam. This tile is always rendered.
- A separate **Pregnancy Data tile** must be introduced containing: Gestational Age (from LMP), Gestational Age (from Biometry), Expected Delivery Date (EDD), Last Menstrual Period (LMP), Obstetric History, and Family History.
- The Pregnancy Data tile must be rendered if and only if `visibility.pregnancyData === true` for the recorded examination type.
- For examination type `ultrasound_prenatal` (where `pregnancyData: true`), the visual output of the two-tile layout must be functionally equivalent to the current single-tile layout.
- For any future examination type where `pregnancyData: false`, none of the six pregnancy fields must appear anywhere on the detail page.

---

### FR-3: Detail Page — Field Visibility Within Sections

**FR-3.1** Within a visible Biometry section, all biometry fields defined for `ultrasound_prenatal` (BPD, HC, AC, FL, EFW, OFD, Vp, TCD, CM, Nuchal Fold, NB, APAD, TAD, LA, LC) must be rendered. Each field must display its recorded value or `—` if no value is stored.

**FR-3.2** Calculated biometry display fields (biometry percentile labels for BPD, HC, AC, FL; EFW percentile) must be rendered alongside their input counterparts when the Biometry section is visible, showing the derived value or `—` if the inputs required for derivation are absent.

**FR-3.3** Within a visible Doppler section, all doppler fields (PI, RI, Vessel, A.ut. Dex PI, A.ut. Dex RI, A.ut. Sin PI, A.ut. Sin RI, CMA, PSV, CPR, Duc.Ven) must be rendered with their recorded values or `—`.

**FR-3.4** Within a visible Ultrasound Findings section, all six fields (Presentation, Gender, Fetal Heart Rate, Fetal Movement, Placenta, Umbilical Cord) must be rendered with their values or `—`.

**FR-3.5** Within a visible Anatomy section, all eleven fields (Head, Brain, Heart, Abdomen, Kidneys, Limbs, Skeleton, Face, Neck/Skin, Spine, Thorax) must be rendered with their values or `—`.

**FR-3.6** Within the Pregnancy Data tile (when visible), all six fields (LMP, EDD, GA from LMP, GA from Biometry, Obstetric History, Family History) must be rendered unconditionally using `—` for absent values. These fields must not appear in the Patient Information tile.

---

### FR-4: PDF Report — Section Visibility

**FR-4.1** In `pdfDocument.ts`, the guard conditions that currently read `if (pairs.some(([, v]) => v))` must be replaced with type-driven guards that check `SECTION_VISIBILITY[vm.examinationType]` for the relevant section identifier.

**FR-4.2** A section must be included in the PDF if and only if its visibility flag is `true` for the recorded examination type, regardless of whether any fields contain data.

**FR-4.3** `print.service.ts` must pass the `examinationType` to a form that allows `pdfDocument.ts` (or a helper it calls) to resolve section visibility. The `ExamPdfViewModel` already carries `examinationType`; this value must be used for visibility resolution.

**FR-4.4 — Pregnancy Data in PDF (merged patient header fix)**: The current PDF patient header block unconditionally renders GA from LMP, GA from Biometry, and EDD as inline metadata lines, and the `pregnancy` view model object carries LMP, Obstetric History, and Family History that are currently not rendered in the PDF at all. This must be corrected as follows:

- The GA from LMP, GA from Biometry, and EDD lines in the patient header block must be wrapped in `if (visibility.pregnancyData)` — they must only appear when `pregnancyData` is `true` for the examination type.
- A dedicated **Pregnancy Data section** must be added to the PDF body (after the patient header rule and before Biometry) containing LMP, EDD, Obstetric History, Family History, GA from LMP, and GA from Biometry as a `kvGrid` block.
- This Pregnancy Data section must be guarded by `if (visibility.pregnancyData)`.
- For `ultrasound_prenatal`, this section is always rendered; for future types with `pregnancyData: false`, neither the header lines nor the section block must appear.

---

### FR-5: PDF Report — Field Rendering

**FR-5.1** Within a visible PDF section, all fields belonging to that section must be included in the `kvGrid` pairs array. The `kvGrid` function already renders `—` for `undefined` values; no change to `kvGrid` itself is required.

**FR-5.2** The Biometry section in the PDF must list all fifteen biometry fields unconditionally (when the section is visible), in the same order they appear in the input form.

**FR-5.3** The Doppler, Ultrasound Findings, and Anatomy sections in the PDF must similarly render all their respective fields unconditionally when visible, as listed in FR-3.3 through FR-3.5.

**FR-5.4** The Pregnancy Data section in the PDF (when visible per FR-4.4) must render all six fields as a `kvGrid` block: LMP, EDD, GA from LMP, GA from Biometry, Obstetric History, Family History — each showing `—` if absent. The `ExamPdfViewModel.pregnancy` object already carries LMP, Obstetric History, and Family History; EDD and GA fields are already available on the view model at the top level.

---

## Non-Functional Requirements

**NFR-1: No regressions on populated records** — For examination records where all sections contain data, the rendered output on the detail page and PDF must be visually and functionally equivalent to the current output. No existing content must be removed or reordered.

**NFR-2: Single source of truth** — At no point may section visibility logic be duplicated. `SECTION_VISIBILITY` must exist in exactly one location (`examinationTypes.ts`) and be imported where needed.

**NFR-3: TypeScript type safety** — The exported `SECTION_VISIBILITY` must be typed as `Record<string, Record<string, boolean>>` consistent with its current definition in `ExaminationForm.tsx`. No `any` casts may be introduced.

**NFR-4: Fallback safety** — Any surface that reads `SECTION_VISIBILITY` must handle the case where the examination type key is absent by falling back to `ultrasound_prenatal`, or by treating all sections as visible.

**NFR-5: No new dependencies** — This change must be accomplished using existing utilities, constants, and component patterns. No new npm packages or external libraries are to be introduced.

---

## Rendering Rules

### Empty-Value Display Rules

- A field that belongs to the examination type but has no recorded value must display the string `—` (em dash).
- The string `—` must never be stored in the database; it is a display-layer concern only.
- Calculated fields (EDD, percentiles) that cannot be derived due to missing inputs must display `—`.

### Exam-Type Alignment Rules

- The set of sections rendered on the detail page for examination type `T` must be identical to the set of sections rendered in the input form for examination type `T`.
- The set of fields rendered within each section on the detail page must be identical to the set of fields available in the corresponding section of the input form.
- Calculated / read-only fields shown in the form (EDD, GA from Biometry, percentile labels) are part of the section for alignment purposes and must be included on the detail page.
- Universal fields (Patient Name, Patient Age at Exam) must never be gated by `SECTION_VISIBILITY` — they appear for all examination types.
- Pregnancy-specific fields (LMP, EDD, GA from LMP, GA from Biometry, Obstetric History, Family History) are part of the `pregnancyData` section and must only appear when `visibility.pregnancyData === true`.

### PDF Alignment Rules

- The set of sections included in the PDF for examination type `T` must match the `SECTION_VISIBILITY` entry for `T`.
- The fields listed in each PDF section must match the full field list for that section as defined by the form.
- The `kvGrid` utility already handles `—` substitution; section inclusion is the only change required in the PDF builder.
- Pregnancy-related metadata lines in the PDF patient header (GA from LMP, GA from Biometry, EDD) must be suppressed when `visibility.pregnancyData === false`, consistent with the detail page tile suppression rule.

---

## Edge Cases

| Scenario | Required Behaviour |
|---|---|
| Examination has no `examinationType` set (legacy records) | Fall back to `ultrasound_prenatal` visibility; render all sections for that type including Pregnancy Data tile |
| Examination type key exists in `EXAM_TYPES` but not in `SECTION_VISIBILITY` | Fall back to `ultrasound_prenatal`; log a console warning |
| All fields in a visible section are empty | Section tile / PDF section is still rendered; all fields show `—` |
| Biometry values present but GA from LMP absent | Biometry percentiles cannot be calculated; percentile fields show `—` |
| LMP absent | EDD field shows `—`; LMP field shows `—` in Pregnancy Data tile / PDF section |
| New type added with no `SECTION_VISIBILITY` entry | Falls back to `ultrasound_prenatal`; no crash |
| Future type with `pregnancyData: false` | Patient Information tile renders (Patient Name, Age only); Pregnancy Data tile absent; PDF patient header shows no GA/EDD lines; PDF Pregnancy Data section absent |
| `ultrasound_prenatal` with no pregnancy data entered | Pregnancy Data tile rendered; all six fields show `—` |

---

## Validation Considerations

- No new server-side validation is required. This specification concerns display-layer rendering only.
- Client-side validation in the input form is not affected.
- The backend `examinationType` field is already validated against `EXAM_TYPE_KEYS` via Joi; no changes are needed.

---

## Acceptance Criteria

- [ ] **AC-1**: Navigating to the detail page of an `ultrasound_prenatal` examination with no clinical data entered shows the Patient Information tile (Patient Name, Age), a Pregnancy Data tile with all six pregnancy fields showing `—`, and all five clinical section tiles (Ultrasound Findings, Anatomy, Biometry, Doppler, and the Pregnancy Data tile), each with all their fields displaying `—`.
- [ ] **AC-2**: Navigating to the detail page of a fully-populated `ultrasound_prenatal` examination produces output visually and functionally equivalent to current behaviour; the Pregnancy Data fields appear in their own tile immediately following Patient Information.
- [ ] **AC-3**: Generating a PDF for an `ultrasound_prenatal` examination with no clinical data includes the Pregnancy Data section and all five clinical sections, all fields showing `—`.
- [ ] **AC-4**: Generating a PDF for a fully-populated examination produces output visually equivalent to the current PDF; Pregnancy Data fields appear in a dedicated section.
- [ ] **AC-5**: `SECTION_VISIBILITY` is exported from `examinationTypes.ts` and is not defined in any other file.
- [ ] **AC-6**: `ExaminationForm.tsx`, `ExaminationDetailPage.tsx`, and `pdfDocument.ts` all import `SECTION_VISIBILITY` from `examinationTypes.ts`.
- [ ] **AC-7**: Adding a new examination type and its `SECTION_VISIBILITY` entry requires no changes to `ExaminationDetailPage.tsx` or `pdfDocument.ts` for the section visibility to apply correctly.
- [ ] **AC-8**: TypeScript compiles with no new errors or warnings introduced by this change.
- [ ] **AC-9**: For a hypothetical examination type with `pregnancyData: false`, the detail page Patient Information tile shows only Patient Name and Patient Age; no pregnancy fields appear anywhere on the page. The PDF patient header shows no GA/EDD lines; no Pregnancy Data section appears in the PDF.
- [ ] **AC-10**: The Patient Information tile never contains LMP, EDD, GA from LMP, GA from Biometry, Obstetric History, or Family History — these fields exist only in the Pregnancy Data tile.
