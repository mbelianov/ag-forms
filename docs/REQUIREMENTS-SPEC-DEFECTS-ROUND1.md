# Requirements Specification — Defects Round 1

> **Source:** `docs/DEFECTS-ROUND1.txt` (workspace root)  
> **Generated from:** Cross-reference of defect entries against the current codebase state.  
> **Naming convention:** Requirement IDs use the prefix `DR1-` (Defects Round 1) to distinguish them from the `REQ-` / `FLAG-` identifiers in [`docs/REQUIREMENTS-SPEC.md`](REQUIREMENTS-SPEC.md).  
> **Priority scale:** **P1** = Must fix before next release | **P2** = Should fix soon | **P3** = Low urgency

---

## Summary Table

| ID | Title | Priority | Source Defect |
|----|-------|----------|---------------|
| [DR1-01](#dr1-01) | Rename exam section title on Patient Detail Page | P1 | Defect 1 |
| [DR1-02](#dr1-02) | Add Exam Type and Date columns to Patient Detail exam list | P1 | Defect 1 |
| [DR1-03](#dr1-03) | Add "Filter by Exam Type" to Patient Detail exam list | P2 | Defect 1 |
| [DR1-04](#dr1-04) | Rename "Add Test" button to "Add Exam" on Patient Detail Page | P1 | Defect 2 |
| [DR1-05](#dr1-05) | Rename "Create Test" button to "Create Exam" on Patient Detail Page | P1 | Defect 3 |
| [DR1-06](#dr1-06) | Remove MRN column from Patients list table | P1 | Defect 4 |
| [DR1-07](#dr1-07) | Compact Patient Information section on Patient Detail Page | P2 | Defect 5 |
| [DR1-08](#dr1-08) | Widen Examination Type field and narrow Examination Date field in Create Examination form | P2 | Defect 6 |
| [DR1-09](#dr1-09) | Align percentile fields directly below their parent biometry fields in the Create Examination form | P2 | Defect 7a |
| [DR1-10](#dr1-10) | Regroup OFD, Vp, TCD, CM, and remaining biometry fields into a six-column two-row layout | P2 | Defect 7b |
| [DR1-11](#dr1-11) | Compact Patient Information section on Examination Detail view to two columns | P2 | Defect 8a |
| [DR1-12](#dr1-12) | Merge Pregnancy Data section into Patient Information section on Examination Detail view | P2 | Defect 8b |
| [DR1-13](#dr1-13) | Restrict percentile display to BPD, HC, AC, FL, and EFW in Biometry Measurements section | P1 | Defect 8c |
| [DR1-14](#dr1-14) | Ensure all form fields and calculated values are displayed on the Examination Detail view and PDF | P1 | Defect 8d |
| [DR1-15](#dr1-15) | Move Clinical Information section before Notes on Examination Detail view | P2 | Defect 8e |
| [DR1-16](#dr1-16) | Rename navigation menu item "Ultrasound Prenatal Exams" to "Exams" | P1 | Defect 9 |
| [DR1-17](#dr1-17) | Rename Examinations page title and table section title to "All Exams" | P1 | Defect 9 |
| [DR1-18](#dr1-18) | No conditional rendering of input fields on Examination Detail Page and PDF | P1 | — |

---

## Requirements

---

### DR1-01

**Title:** Rename exam section title on Patient Detail Page  
**Priority:** P1  
**Source:** Defect 1

**Description:**  
On the Patient Detail Page ([`PatientDetailPage.tsx`](../frontend/src/pages/PatientDetailPage.tsx)), the `<Tile>` section that displays the patient's examination list currently has the heading `"Ultrasound Prenatal Exams"` (line 330). This heading must be changed to **"Available Exams"**.

**Acceptance Criteria:**
1. The section heading rendered inside the exam list `<Tile>` on the Patient Detail Page reads exactly `"Available Exams"`.
2. No other text on the Patient Detail Page is unintentionally altered by this change.
3. The change is applied in the JSX string literal at line 330 of [`PatientDetailPage.tsx`](../frontend/src/pages/PatientDetailPage.tsx).

---

### DR1-02

**Title:** Add Exam Type and Date columns to Patient Detail exam list  
**Priority:** P1  
**Source:** Defect 1

**Description:**  
The examination table on the Patient Detail Page currently displays three columns: **Exam Date**, **Status**, and **Gestational Age** (defined in `examinationHeaders` at line 33 of [`PatientDetailPage.tsx`](../frontend/src/pages/PatientDetailPage.tsx)). The table must be extended to also display the examination **Type** (the human-readable label resolved from `examinationType`) so that users can distinguish between examination types at a glance. Gestational Age is not needed and can be removed.

**Acceptance Criteria:**
1. The exam table on the Patient Detail Page displays a **"Type"** column showing the human-readable examination type label (e.g., `"Ultrasound Prenatal Exam"`), resolved using the same `getExamTypeLabel` helper already used in [`ExaminationsPage.tsx`](../frontend/src/pages/ExaminationsPage.tsx) line 224.
2. The column ordering is: **Exam Date** | **Type** | **Status** 
3. Rows in which `examinationType` is absent or unrecognised display a fallback string (e.g., `"—"`).
4. The table remains sortable by Exam Date (newest first) as it currently is.

---

### DR1-03

**Title:** Add "Filter by Exam Type" to Patient Detail exam list  
**Priority:** P2  
**Source:** Defect 1

**Description:**
The Patient Detail Page does not currently support filtering the examination list by type. A filter control must be added above the examination table so that users can narrow the list to a specific examination type and scroll through **all matching records stored in the database** for that patient — not just those already loaded in memory. Because `GET /v1/examinations` uses server-side pagination (default page size 50), a client-side filter over the in-memory array would silently omit records beyond the first page. The filter must therefore pass the selected type as a query parameter to the API so that every matching record is retrievable via the existing "Load More" mechanism.

**Acceptance Criteria:**
1. A dropdown control labelled **"Filter by Type"** appears above the examination table on the Patient Detail Page.
2. The dropdown contains an **"All Types"** option (selected by default) plus one item per registered examination type, populated from the centralised type registry (`EXAM_TYPES` constant in [`frontend/src/constants/examinationTypes.ts`](../frontend/src/constants/examinationTypes.ts)).
3. Selecting a specific type triggers a new API call to `GET /v1/examinations?patientId={id}&examination_type={type}`. The `examinations` state array is **replaced** with the records returned by that call; any previously loaded records for other types are discarded.
4. Selecting **"All Types"** triggers an API call to `GET /v1/examinations?patientId={id}` with no `examination_type` parameter, replacing the state with the full unfiltered first page from the server.
5. After a filtered load, the existing **"Load More"** button (driven by the `continuationToken` returned in the API response) must remain functional so the user can page through all matching records of the selected type stored in the database.
6. While the API call is in-flight, an `<InlineLoading>` indicator is shown in place of the table, consistent with the existing loading pattern in the component.
7. When the API call completes with zero results, the existing empty-state message is shown.
8. The `examinationService.getExaminations()` call on the Patient Detail Page must forward the `examination_type` parameter using the same service interface already used by [`ExaminationsPage.tsx`](../frontend/src/pages/ExaminationsPage.tsx) (line 105), requiring no changes to the service layer or the backend.

---

### DR1-04

**Title:** Rename "Add Test" button to "Add Exam" on Patient Detail Page  
**Priority:** P1  
**Source:** Defect 2

**Description:**  
On the Patient Detail Page, the small button inside the exam section `<Tile>` that allows admin/doctor users to navigate to the exam creation form currently reads `"Add Test"` (line 338 of [`PatientDetailPage.tsx`](../frontend/src/pages/PatientDetailPage.tsx)). This label must be changed to **"Add Exam"**.

**Acceptance Criteria:**
1. The button inside the exam list tile on the Patient Detail Page is labelled exactly `"Add Exam"`.
2. The button's `onClick` handler, icon (`Add`), `kind`, and `size` props remain unchanged.
3. The role-based visibility rule (admin/doctor only) remains unchanged.

---

### DR1-05

**Title:** Rename "Create Test" button to "Create Exam" on Patient Detail Page  
**Priority:** P1  
**Source:** Defect 3

**Description:**  
On the Patient Detail Page, the prominent action button in the page header that navigates to the examination creation form currently reads `"Create Test"` (line 234 of [`PatientDetailPage.tsx`](../frontend/src/pages/PatientDetailPage.tsx)). This label must be changed to **"Create Exam"**.

**Acceptance Criteria:**
1. The primary action button in the Patient Detail Page header is labelled exactly `"Create Exam"`.
2. The button's `onClick` handler, icon (`Add`), `kind` prop, and role-based visibility (admin/doctor only) remain unchanged.

---

### DR1-06

**Title:** Remove MRN column from Patients list table  
**Priority:** P1  
**Source:** Defect 4

**Description:**  
The Patients list page ([`PatientsPage.tsx`](../frontend/src/pages/PatientsPage.tsx)) displays an **MRN** column in the patient table (defined in the `headers` array at line 26–32 and rendered via the `rows` mapping at line 145). MRN is an examination-level identifier and is not meaningful at the patient list level. The MRN column must be removed from this table.

**Acceptance Criteria:**
1. The `{ key: 'mrn', header: 'MRN' }` entry is removed from the `headers` array in [`PatientsPage.tsx`](../frontend/src/pages/PatientsPage.tsx).
2. The `mrn` field is removed from the row-mapping object in the `rows` `Array.map()` call in [`PatientsPage.tsx`](../frontend/src/pages/PatientsPage.tsx).
3. The patient table renders the remaining columns (Name, Age, Phone, Created Date) without a gap or misalignment.
4. The MRN field continues to exist on the `Patient` type and is still displayed on the Patient Detail Page; only the list table column is removed.

---

### DR1-07

**Title:** Compact Patient Information section on Patient Detail Page  
**Priority:** P2  
**Source:** Defect 5

**Description:**  
The Patient Information `<Tile>` on the Patient Detail Page ([`PatientDetailPage.tsx`](../frontend/src/pages/PatientDetailPage.tsx)) currently uses a single-column `<Stack gap={5}>` layout, causing it to occupy excessive vertical space. The section must be restructured to render its fields in a denser multi-column grid layout so that the Patient Information tile takes up significantly less vertical height.

**Acceptance Criteria:**
1. All Patient Information fields (Name, Date of Birth/Age, Phone, Email, Address, Created, Last Updated) are displayed in a CSS grid with at least two columns, eliminating the single-column vertical stacking.
2. The `<Stack gap={5}>` wrapper is replaced with an appropriate grid layout (e.g., `display: grid; grid-template-columns: repeat(3, 1fr)` or similar), consistent with patterns already used in the Examination Detail Page.
3. No patient data field that was previously visible is hidden or removed.
4. Conditional fields (Email, Address, Last Updated) continue to render only when the data is present.
5. The section heading `"Patient Information"` remains visible as a `<h3>`.

---

### DR1-08

**Title:** Widen Examination Type field and narrow Examination Date field in Create Examination form  
**Priority:** P2  
**Source:** Defect 6

**Description:**  
In the Create Examination form ([`ExaminationForm.tsx`](../frontend/src/components/ExaminationForm.tsx)), the Examination Type field and Examination Date field share a four-column grid row (`row4` at line 576). The Examination Type field must occupy approximately twice the width of a standard column, and the Examination Date field must occupy approximately half the width of a standard column, so that long type labels are not truncated and the date field (which contains a fixed-width date) does not waste space.

**Acceptance Criteria:**
1. The Examination Type field (`Select` or `TextInput` for the edit path) spans two grid columns within its row.
2. The Examination Date (`DatePicker`) spans one grid column that is approximately half the width of a standard column, or uses `width: auto` / `min-width` to be appropriately compact.
3. The remaining fields in the same row (Status, Patient Age at Exam) are unaffected in their proportional sizing.
4. The layout is achieved by adjusting the `gridTemplateColumns` value of the `row4` style object or by introducing column-span overrides on the affected fields.
5. The visual change is consistent across both the Create and Edit form paths.

---

### DR1-09

**Title:** Align percentile fields directly below their parent biometry fields in the Create Examination form  
**Priority:** P2  
**Source:** Defect 7a

**Description:**
In the Create Examination form, the BPD Percentile, HC Percentile, AC Percentile, and FL Percentile read-only fields are currently displayed in a separate summary block rendered after the "Auto Calc GA" action (lines 801–820 of [`ExaminationForm.tsx`](../frontend/src/components/ExaminationForm.tsx)). These percentile fields must instead be positioned directly below their corresponding biometry input fields (BPD directly below BPD, HC directly below HC, etc.) so that each biometry value and its percentile are visually co-located in the same grid column. The **"Auto Calc GA"** button that triggers percentile computation must be retained and must continue to function as the trigger for populating the inline percentile fields.

**Acceptance Criteria:**
1. The BPD Percentile read-only field appears directly below the BPD input field and occupies the same grid column as BPD.
2. The HC Percentile read-only field appears directly below the HC input field and occupies the same grid column as HC.
3. The AC Percentile read-only field appears directly below the AC input field and occupies the same grid column as AC.
4. The FL Percentile read-only field appears directly below the FL input field and occupies the same grid column as FL.
5. Percentile fields are rendered as read-only `TextInput` elements with a label such as `"BPD Percentile"` and value formatted as `"Nth"` (e.g., `"50th"`). When the percentile has not yet been calculated, the field value is empty.
6. The **"Auto Calc GA"** button is retained in its current position in the Biometry section. Clicking it continues to invoke `calcBiometryPercentiles()` and populate the `percentiles` state, which in turn populates the four inline percentile fields defined in ACs 1–4.
7. The EFW Percentile field, which is already adjacent to the EFW Calc button row, is not moved.
8. The existing separate percentile summary block (the `percentiles && (...)` block at approximately line 801) is removed once the per-field inline display is in place; the `percentiles` state variable itself is kept as it drives the inline fields.

---

### DR1-10

**Title:** Regroup OFD, Vp, TCD, CM, and remaining biometry fields into a six-column two-row layout  
**Priority:** P2  
**Source:** Defect 7b

**Description:**  
In the Create Examination form ([`ExaminationForm.tsx`](../frontend/src/components/ExaminationForm.tsx)), the extended biometry fields (OFD, Vp, TCD, CM, Nuchal Fold, NB, APAD, TAD, LA, LC) are currently rendered using a `rowAuto` (`auto-fit minmax`) layout. These fields must be reorganised into an explicit six-column two-row grid layout as follows:

- **Row 1 (6 columns):** TCD, CM, OFD, Vp, Nuchal Fold, NB  
- **Row 2 (6 columns):** APAD, TAD, LA, LC, *(2 empty cells)*

The OFD and Vp fields, which currently appear in a different row position, must be relocated to the first row alongside TCD and CM.

**Acceptance Criteria:**
1. TCD, CM, OFD, and Vp all appear in the same grid row within the Biometry section of the form.
2. The grouping follows a six-column layout defined by a `row6` CSS grid helper (`display: grid; grid-template-columns: repeat(6, 1fr); gap: 0.75rem`).
3. The two-row layout is achieved by CSS grid auto-placement (no manual `grid-row` overrides required); the implementer may choose the exact field order within rows so long as the stated constraint (TCD, CM, OFD, Vp together in Row 1) is met.
4. LA and LC appear in the second row alongside APAD and TAD; unused cells in that row are left empty (no placeholder elements needed).
5. The `rowAuto` layout helper is no longer used for this section; it may be retained if used elsewhere.
6. The field labels, input types, and validation remain unchanged.

---

### DR1-11

**Title:** Compact Patient Information section on Examination Detail view to two columns  
**Priority:** P2  
**Source:** Defect 8a

**Description:**  
On the Examination Detail Page ([`ExaminationDetailPage.tsx`](../frontend/src/pages/ExaminationDetailPage.tsx)), the **Patient Information** `<Tile>` (lines 297–330) renders its fields vertically in a `<Stack gap={4}>`. This section must be restructured to display its fields in a two-column grid so that the tile occupies less vertical space.

**Acceptance Criteria:**
1. The Patient Information tile fields (Patient Name, MRN, Patient Age at Exam, Gestational Age from LMP, Gestational Age from Biometry, EDD) are displayed in a CSS grid with exactly **two columns**.
2. The layout is implemented using `display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem` or equivalent.
3. Fields that span the full width (e.g., Patient Name as a link) may use `grid-column: span 2` if the implementer judges it appropriate for readability.
4. ~~Conditional fields (Patient Age at Exam, GA from Biometry, EDD) continue to render only when data is present.~~ **[OVERRIDDEN by DR1-18]** All fields — including Patient Age at Exam, GA from Biometry, and EDD — must be rendered unconditionally. Empty fields must appear as empty (e.g., an empty value display), not be hidden.
5. No data currently shown in the Patient Information tile is hidden.

---

### DR1-12

**Title:** Merge Pregnancy Data section into Patient Information section on Examination Detail view  
**Priority:** P2  
**Source:** Defect 8b

**Description:**  
On the Examination Detail Page ([`ExaminationDetailPage.tsx`](../frontend/src/pages/ExaminationDetailPage.tsx)), there is a separate `<Tile>` for **Pregnancy Data** (lines 468–478) that contains LMP, Obstetric History, and Family History. These fields must be moved into the **Patient Information** `<Tile>` (lines 297–330). After the merge, the standalone Pregnancy Data tile must be removed.

**Acceptance Criteria:**
1. LMP (Last Menstrual Period), Obstetric History, and Family History fields are rendered inside the Patient Information `<Tile>`.
2. The section heading of the merged tile remains **"Patient Information"** (the Pregnancy Data heading is discarded).
3. The standalone Pregnancy Data `<Tile>` and its conditional `hasPregnancyData` wrapper are removed from the page.
4. ~~Conditional rendering rules are preserved: LMP is only shown when present, Obstetric History only when present, Family History only when present.~~ **[OVERRIDDEN by DR1-18]** All fields — including LMP, Obstetric History, and Family History — must be rendered unconditionally on the Examination Detail Page. Empty fields must appear as empty (e.g., an empty value display), not be hidden.
5. The merged Patient Information tile continues to follow the two-column layout introduced by DR1-11.

---

### DR1-13

**Title:** Restrict percentile display to BPD, HC, AC, FL, and EFW in Biometry Measurements section  
**Priority:** P1  
**Source:** Defect 8c

**Description:**  
In the Biometry Measurements `<Tile>` on the Examination Detail Page ([`ExaminationDetailPage.tsx`](../frontend/src/pages/ExaminationDetailPage.tsx)), percentile values (rendered via the `pctBadge()` helper) are currently displayed for the following parameters: BPD, HC, AC, FL, EFW, OFD, TCD, Nuchal Fold, APAD, and TAD (lines 341, 349, 357, 365, 373, 381, 393, 405, 417, 423). Percentile badges must be **removed** from OFD, TCD, Nuchal Fold, APAD, and TAD. Percentile badges must be **retained** for BPD, HC, AC, FL, and EFW only.

**Acceptance Criteria:**
1. BPD, HC, AC, FL, and EFW values are still displayed with their percentile badge where available.
2. OFD, TCD, Nuchal Fold, APAD, and TAD values are displayed without a percentile badge.
3. The `pctBadge()` calls for `ofdPct`, `tcdPct`, `nfPct`, `apadPct`, and `tadPct` are removed from the JSX of the Biometry Measurements tile.
4. The corresponding percentile computation calls at the top of the component (`calcOFDPercentile`, `calcTCDPercentile`, `calcNuchalFoldPercentile`, `calcAPADPercentile`, `calcTADPercentile` at lines 152–156) may be removed if they are no longer referenced elsewhere in the page; if they are referenced elsewhere (e.g., in the PDF/print report), they must remain.
5. The layout of the Biometry tile is otherwise unchanged.

---

### DR1-14

**Title:** Ensure all form fields and calculated values are displayed on the Examination Detail view and PDF  
**Priority:** P1  
**Source:** Defect 8d

**Description:**  
Any field that can be entered in the Create/Edit Examination form ([`ExaminationForm.tsx`](../frontend/src/components/ExaminationForm.tsx)) must also be visible on the Examination Detail view ([`ExaminationDetailPage.tsx`](../frontend/src/pages/ExaminationDetailPage.tsx)) and in the generated PDF/print report. This includes all calculated fields (GA from Biometry, EFW, EDD, Patient Age at Exam, percentiles). An audit must be performed to identify any gaps, and any missing fields must be added to the detail view and PDF.

**Acceptance Criteria:**
1. A field-by-field audit of `ExaminationForm.tsx` is conducted and every named field in `formData` (including `findings`, `notes`, all pregnancy data sub-fields, all ultrasound findings sub-fields, all anatomy sub-fields, all biometry sub-fields, and all doppler sub-fields) is confirmed to have a corresponding display element on the Examination Detail Page.
2. Calculated fields specifically — GA from Biometry (`gestationalAgeFromBiometry`), EFW (`biometry.efw`), EDD (derived from LMP), Patient Age at Exam (`patientAgeAtExam`), and the five retained percentiles (BPD, HC, AC, FL, EFW) — are displayed on the Examination Detail Page.
3. Any field confirmed missing from the Examination Detail Page is added.
4. The PDF/print report (generated by the component in [`frontend/src/components/reports/`](../frontend/src/components/reports/)) is updated to include any field that was added to the Examination Detail Page in step 3.
5. The `Comments` field (`examination.data.comments`) is confirmed present in both the detail view and the PDF.

> **Note:** If the audit reveals no gaps, this requirement is satisfied by documentation of the completed audit. Any gaps found must be treated as P1 defects.

---

### DR1-15

**Title:** Move Clinical Information section before Notes on Examination Detail view  
**Priority:** P2  
**Source:** Defect 8e

**Description:**  
On the Examination Detail Page ([`ExaminationDetailPage.tsx`](../frontend/src/pages/ExaminationDetailPage.tsx)), the **Clinical Information** `<Tile>` (lines 527–547) currently appears after the **Comments** tile (lines 516–524). The Notes sub-section (`examination.notes`) is rendered inside the Clinical Information tile. The required section order from top to bottom is:

1. Status and Date banner  
2. Patient Information (merged with Pregnancy Data per DR1-12)  
3. Biometry Measurements  
4. Doppler Measurements  
5. Ultrasound Findings  
6. Anatomy  
7. **Clinical Information** (Findings)  
8. **Comments / Notes**  
9. Metadata  

**Acceptance Criteria:**
1. The Clinical Information tile (containing the Findings sub-section) appears immediately before the Comments/Notes tile in the rendered page output.
2. If Notes (`examination.notes`) is currently rendered inside the Clinical Information tile, it must be moved to a separate tile or section positioned after Clinical Information, labelled **"Notes"**.
3. The section order matches the list above.
4. No content currently displayed in the Clinical Information or Comments tiles is removed.

---

### DR1-16

**Title:** Rename navigation menu item "Ultrasound Prenatal Exams" to "Exams"  
**Priority:** P1  
**Source:** Defect 9

**Description:**  
In the application header ([`Layout.tsx`](../frontend/src/components/Layout.tsx)), the navigation menu item that links to `/examinations` currently reads `"Ultrasound Prenatal Exams"` (line 62). This label must be changed to **"Exams"** to reflect the intent that the page shows all examination types, not only ultrasound prenatal exams.

**Acceptance Criteria:**
1. The `<HeaderMenuItem href="/examinations">` in [`Layout.tsx`](../frontend/src/components/Layout.tsx) renders the text `"Exams"`.
2. The `href`, route, and all other props of the menu item remain unchanged.
3. No other navigation items are altered.

---

### DR1-17

**Title:** Rename Examinations page title and table section title to "All Exams"  
**Priority:** P1  
**Source:** Defect 9

**Description:**  
On the Examinations list page ([`ExaminationsPage.tsx`](../frontend/src/pages/ExaminationsPage.tsx)), the following labels currently read `"Ultrasound Prenatal Exams"` and must all be changed to **"All Exams"**:

| Location | Current Value | Required Value |
|----------|---------------|----------------|
| `<h1>` page heading (line 242) | `"Ultrasound Prenatal Exams"` | `"All Exams"` |
| `<TableContainer title>` (line 348) | `"Ultrasound Prenatal Exams"` | `"All Exams"` |
| `<PageLoader description>` (line 237) | `"Loading ultrasound prenatal exams..."` | `"Loading exams..."` |

**Acceptance Criteria:**
1. The `<h1>` page heading on the Examinations page renders `"All Exams"`.
2. The `title` prop on `<TableContainer>` renders `"All Exams"`.
3. The `PageLoader` description reads `"Loading exams..."`.
4. The `aria-label` on the `<Table>` element (line 372: `"Ultrasound Prenatal Exams table"`) is updated to `"All Exams table"`.
5. The `aria-label` on the "Create" `<Button>` (line 365: `"Create new ultrasound prenatal exam"`) is updated to `"Create new exam"`.
6. No functional behaviour, routing, or filter logic is changed by this rename.

---

### DR1-18

**Title:** No conditional rendering of input fields on Examination Detail Page and PDF
**Priority:** P1
**Source:** —

**Description:**
On the Examination Detail Page ([`ExaminationDetailPage.tsx`](../frontend/src/pages/ExaminationDetailPage.tsx)) and in the generated PDF/print report ([`frontend/src/components/reports/`](../frontend/src/components/reports/)), **every input field that exists in the Create/Edit Examination form must always be rendered and visible**, regardless of whether it contains data. If a field has no value, it must still appear as an explicitly empty field (e.g., with an empty or blank value display) so that the reader can clearly distinguish between "the user left this field blank" and "the application has chosen not to display this field".

**Justification:**
When a user reads an examination record, they must never be left in doubt about whether a field was intentionally left blank or whether the application simply chose not to display it. Hiding empty fields creates ambiguity and undermines the trustworthiness and readability of the examination record. All fields must be unconditionally present in the output.

**Scope:**
This requirement applies exclusively to the **Examination Detail Page** and the **PDF/print report**. It does not apply to patient list pages, the Patient Detail Page, or any other page outside the examination detail context.

**Override Notice:**
This requirement supersedes any acceptance criterion in any other DR in this document that permits or prescribes conditional rendering of individual input fields on the Examination Detail Page or the PDF. Specifically:

- **DR1-11 AC4** is overridden: Patient Age at Exam, GA from Biometry, and EDD must be rendered unconditionally.
- **DR1-12 AC4** is overridden: LMP, Obstetric History, and Family History must be rendered unconditionally.

**Acceptance Criteria:**
1. Every field that is present in the Create/Edit Examination form (`ExaminationForm.tsx`) — including all biometry, doppler, clinical, anatomy, ultrasound findings, pregnancy data, and notes sub-fields — is rendered on the Examination Detail Page regardless of whether its value is non-empty.
2. Empty fields are displayed with a visible label and an explicitly empty value (e.g., a dash `"—"`, a blank text node, or an empty input representation) so that the absence of data is explicit and unambiguous to the reader.
3. No field on the Examination Detail Page or in the PDF is hidden, conditionally removed, or conditionally omitted based on the field's value being `null`, `undefined`, `""`, `0`, or any other falsy value.
4. The PDF/print report applies the same unconditional rendering rule: every field appears in the PDF output with its label, even when its value is empty.
5. Conditional wrappers (e.g., `{value && <Field />}`, `{hasData && <Section />}`, ternary expressions that omit a field when empty) are removed from all field-level rendering logic on the Examination Detail Page and in the PDF component. Section-level wrappers that hide entire sections (as opposed to individual fields) may be evaluated on a case-by-case basis but must not be used to hide individual input fields.
6. This requirement is considered satisfied only after a field-by-field audit confirms that no individual input field is subject to conditional omission on the Examination Detail Page or in the PDF.

