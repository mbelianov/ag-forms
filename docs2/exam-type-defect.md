# Defect Report: Examination Detail Page and PDF Do Not Obey Examination Type Field Visibility

| Field | Value |
|---|---|
| **ID** | DEF-EXAM-TYPE-001 |
| **Severity** | High |
| **Status** | Open |
| **Affected Area** | Examination Detail View, PDF Report Generation |
| **Related Component** | `ExaminationDetailPage.tsx`, `pdfDocument.ts`, `print.service.ts` |
| **Reporter** | Engineering Review |

---

## Summary

The examination input form (`ExaminationForm.tsx`) correctly controls which sections and fields are presented to the user based on the selected examination type, using a centralised `SECTION_VISIBILITY` configuration map. However, the examination detail page (`ExaminationDetailPage.tsx`) and the PDF report output (`pdfDocument.ts` / `print.service.ts`) do **not** use examination type to determine which sections and fields to render. Instead, both surfaces independently apply a data-presence heuristic — sections and fields are only shown if they contain a non-empty value. This violates the contract that the detail page and PDF must faithfully reflect the same field set as the input form for the given examination type, showing `—` for fields that are part of the type but currently have no recorded value.

---

## Background and Context

Examination records in this application carry an `examinationType` property (e.g. `ultrasound_prenatal`). The input form reads this value at render time and uses a `SECTION_VISIBILITY` map — keyed by examination type — to decide which groups of fields (Pregnancy Data, Ultrasound Findings, Anatomy, Biometry, Doppler) to offer for input. This means only fields relevant to the examination type can ever be filled in by the user.

The detail page and PDF should be the read-only counterpart to that same form: they should show every field that was available for input (or is a calculated output, such as EDD or GA from Biometry) for the recorded examination type, whether or not the user chose to fill it in. A clinician reviewing a record should be able to see all expected fields and identify at a glance which ones were not completed, rather than having the interface silently omit any unfilled field.

The `SECTION_VISIBILITY` map currently lives exclusively inside `ExaminationForm.tsx` and is not accessible to any other surface.

---

## Affected Components

| Component | File | Role |
|---|---|---|
| Examination detail view | `frontend/src/pages/ExaminationDetailPage.tsx` | Read-only display of a single examination record |
| PDF document builder | `frontend/src/components/reports/pdfDocument.ts` | Renders the printable A4 PDF report |
| Print / email service | `frontend/src/services/print.service.ts` | Builds the view model fed to the PDF builder |
| Examination type constants | `frontend/src/constants/examinationTypes.ts` | Registry of valid examination type keys and labels |
| Examination input form | `frontend/src/components/ExaminationForm.tsx` | Contains `SECTION_VISIBILITY` — the authoritative source of field visibility rules |

---

## Current Behaviour

### ExaminationDetailPage

- The **Biometry tile** is hidden entirely when `examination.biometry` contains no defined values (`hasBiometry` check). When it is shown, each individual biometry sub-field is additionally guarded by its own `!== undefined` check, so any field not filled in disappears from the UI.
- The **Ultrasound Findings tile** is hidden when none of its six fields have a value (`hasUltrasoundFindings` check).
- The **Anatomy tile** is hidden when no anatomy fields have a value (`hasAnatomy` check).
- The **Doppler tile** renders all its fields (with `—` for empty ones) once the tile is shown, but the tile itself is hidden when no doppler values are present — the same data-presence gate applies.
- The `examinationType` field on the examination record is used **only** to derive a display label shown in the breadcrumb and page heading. It does not drive any visibility decision.

### PDF Report (pdfDocument.ts)

- Each clinical section (Biometry, Doppler, Ultrasound Findings, Anatomy) is wrapped in a guard of the form `if (pairs.some(([, v]) => v))`. If every value in a section is absent, the entire section is omitted from the PDF.
- The `examinationType` on the view model is printed as a text label only. It is not used to determine which sections to render.

---

## Expected Behaviour

- Both the detail page and the PDF must use the **examination type** of the record to determine which sections are rendered, not the presence or absence of data in those sections.
- Every section that is visible in the input form for the given examination type must also appear in the detail page and PDF.
- Every field within a visible section must be rendered. If the field has no recorded value, it must display an empty-value placeholder (`—`).
- Calculated / read-only fields that are part of the examination type (EDD, GA from Biometry, biometry percentiles) must be shown using the same derivation logic already applied in the detail page and form.
- The exam type field visibility logic must originate from the same configuration used by the input form, ensuring perfect consistency across all three surfaces.

---

## Gap Description

The core gap is that **field visibility is type-driven in the form but data-driven in the detail page and PDF**. The two strategies produce divergent outputs:

- When a user creates an examination and leaves a section blank, the form showed those fields (because the type says they belong), but the detail page and PDF hide the entire section (because no data was entered).
- When a new examination type is registered in the future, adding it to `SECTION_VISIBILITY` will correctly update the form but will have no effect on the detail page or PDF — requiring those files to be updated separately with no compile-time or lint-level enforcement.

---

## Impact

- **Clinical usability**: Clinicians reviewing a record cannot distinguish between a field that was not filled in and a field that does not belong to the examination type. This is especially problematic for audit and completeness review workflows.
- **PDF reports**: Printed or emailed reports for partially completed examinations omit sections entirely, making it unclear to the recipient whether those sections were assessed and found normal or were simply not recorded.
- **Maintainability**: Adding new examination types requires updating three separate files with no shared contract, increasing the risk of inconsistency.

---

## Severity Rationale

**High** — The defect affects medical record completeness and clarity in a clinical application. A clinician interpreting a PDF that omits a section cannot determine whether the omission is intentional (field type mismatch) or an oversight (field not filled in). This directly undermines the reliability of the document as a clinical artifact.

---

## Reproducibility

This defect is **consistently reproducible** using the following steps:

1. Create a new examination with examination type `ultrasound_prenatal`.
2. Fill in only the core header fields (patient, date, status). Leave all of Biometry, Doppler, Anatomy, and Ultrasound Findings blank.
3. Save the examination and navigate to its detail page.
4. **Observe**: The Biometry, Doppler, Anatomy, and Ultrasound Findings tiles/sections are entirely absent from the detail page.
5. Generate a PDF for the same examination.
6. **Observe**: The Biometry, Doppler, Anatomy, and Ultrasound Findings sections are absent from the PDF.
7. **Expected**: All sections defined for `ultrasound_prenatal` in `SECTION_VISIBILITY` should appear, with `—` shown for each empty field.

---

## Acceptance Criteria

- [ ] The detail page renders all sections whose visibility flag is `true` for the examination's recorded `examinationType`, regardless of whether any fields in those sections have been filled in.
- [ ] Within each visible section on the detail page, every field belonging to that section is rendered; fields with no recorded value display `—`.
- [ ] The PDF renders all sections and their constituent fields for the recorded examination type, with `—` for empty values.
- [ ] The field visibility rules are defined in a single shared location and imported by the form, the detail page, and the PDF rendering pipeline — no duplication of visibility logic.
- [ ] Existing behaviour for fully-populated examinations is unchanged.
- [ ] Adding a new examination type to the registry and its `SECTION_VISIBILITY` entry is sufficient to update all three surfaces simultaneously with no additional per-surface changes.
