# Requirements Specification — Defects Round 2

> **Source:** `docs/DEFECTS-ROUND2.md`
> **Naming convention:** Requirement IDs use the prefix `DR2-` (Defects Round 2), consistent with the `DR1-` identifiers in [`docs/REQUIREMENTS-SPEC-DEFECTS-ROUND1.md`](REQUIREMENTS-SPEC-DEFECTS-ROUND1.md).
> **Priority scale:** **P1** = Must fix before next release | **P2** = Should fix soon | **P3** = Low urgency

---

## Summary Table

| ID | Title | Priority | Affected File(s) |
|----|-------|----------|-----------------|
| [DR2-01](#dr2-01) | Examination Detail page `<h1>` must reflect the examination type | P1 | `frontend/src/pages/ExaminationDetailPage.tsx` |
| [DR2-02](#dr2-02) | Breadcrumb second item must be the fixed label "Exams" | P1 | `frontend/src/pages/ExaminationDetailPage.tsx` |
| [DR2-03](#dr2-03) | Breadcrumb current-page item must include exam type label | P1 | `frontend/src/pages/ExaminationDetailPage.tsx` |
| [DR2-04](#dr2-04) | MRN must be moved from Patient Information section to summary tile as a centre column | P1 | `frontend/src/pages/ExaminationDetailPage.tsx` |
| [DR2-05](#dr2-05) | PDF percentile annotations must be restricted to BPD, HC, AC, FL, and EFW | P1 | `frontend/src/services/print.service.ts` |

---

## Assumptions

1. `getExamTypeLabel()` is an existing helper exported from `frontend/src/constants/examinationTypes.ts`. It accepts an `examinationType` key string and returns a human-readable display label. Its interface and behaviour are not changed by any requirement in this specification.
2. `formatPlainDate()` is an existing date-formatting utility already used in `ExaminationDetailPage.tsx`. Its interface and behaviour are not changed by any requirement in this specification.
3. The `examination` object available in `ExaminationDetailPage.tsx` exposes the fields `examinationType`, `patientName`, `mrn`, and the date field consumed by `formatPlainDate()`.
4. `print.service.ts` refers to the service file that builds PDF output. "Extended biometry fields" means OFD, TCD, Nuchal Fold, APAD, and TAD. "Core biometry fields" means BPD, HC, AC, FL, and EFW.
5. The `withPct(value, pct)` helper is used exclusively in `print.service.ts` to produce a formatted string combining a measurement value with its percentile annotation.

---

## Requirements

---

### DR2-01

**Title:** Examination Detail page `<h1>` must reflect the examination type
**Priority:** P1
**Affected file:** [`frontend/src/pages/ExaminationDetailPage.tsx`](../frontend/src/pages/ExaminationDetailPage.tsx)

#### Functional Requirement

The `<h1>` heading on the Examination Detail page must be dynamically derived from the examination record rather than hardcoded.

The heading text must be constructed as:

```
{examTypeLabel} Details
```

where `{examTypeLabel}` is the value returned by `getExamTypeLabel(examination.examinationType)`.

#### Constraints

- The `getExamTypeLabel()` helper from `frontend/src/constants/examinationTypes.ts` must be used to resolve the examination type key to its display label. No inline mapping or duplicate resolution logic is permitted.
- The word `"Details"` is appended after a single space, forming the complete heading string.

#### Edge Cases

| Condition | Required heading text |
|-----------|----------------------|
| `examinationType` is a recognised key (e.g. `"ultrasound_prenatal"`) | `"{examTypeLabel} Details"` (e.g. `"Ultrasound Prenatal Exam Details"`) |
| `examinationType` is absent (`undefined` or `null`) | `"Examination Details"` |
| `examinationType` is an unrecognised string not in the type registry | `"Examination Details"` |

#### Acceptance Criteria

1. When `examination.examinationType` is a recognised key, the rendered `<h1>` text equals `"{examTypeLabel} Details"`, where `{examTypeLabel}` is the string returned by `getExamTypeLabel()` for that key.
2. When `examination.examinationType` is absent or unrecognised, the rendered `<h1>` text equals exactly `"Examination Details"`.
3. The hardcoded string `"Ultrasound Prenatal Exam Details"` no longer appears as a static literal in `ExaminationDetailPage.tsx`.
4. No other headings or text on the Examination Detail page are altered by this change.

---

### DR2-02

**Title:** Breadcrumb second item must be the fixed label "Exams"
**Priority:** P1
**Affected file:** [`frontend/src/pages/ExaminationDetailPage.tsx`](../frontend/src/pages/ExaminationDetailPage.tsx)

#### Functional Requirement

The second item in the breadcrumb trail on the Examination Detail page must display the fixed label `"Exams"`. The complete breadcrumb trail must read:

```
Home  /  Exams  /  {current-page item}
```

#### Constraints

- The `href` of the second breadcrumb item must remain `/examinations` and must not be changed.
- The label text must be the exact string `"Exams"` — not `"Ultrasound Prenatal Exams"`, not `"All Exams"`, and not any other variant.
- This label is fixed (non-dynamic) regardless of the examination type being viewed.

#### Acceptance Criteria

1. The second breadcrumb item renders the visible text `"Exams"` on the Examination Detail page for every examination type.
2. The second breadcrumb item's `href` attribute resolves to `/examinations`.
3. The string `"Ultrasound Prenatal Exams"` no longer appears as a static literal in the breadcrumb section of `ExaminationDetailPage.tsx`.

---

### DR2-03

**Title:** Breadcrumb current-page item must include exam type label
**Priority:** P1
**Affected file:** [`frontend/src/pages/ExaminationDetailPage.tsx`](../frontend/src/pages/ExaminationDetailPage.tsx)

#### Functional Requirement

The third (current-page) breadcrumb item on the Examination Detail page must be a composite string composed of three data segments, separated by the delimiter ` — ` (space-en-dash-space or space-hyphen-space, consistent with the existing delimiter already used in that component):

```
{patientName} — {examTypeLabel} — {examDate}
```

Where:

- `{patientName}` is the value of `examination.patientName`.
- `{examTypeLabel}` is the value returned by `getExamTypeLabel(examination.examinationType)`.
- `{examDate}` is the examination date formatted using the existing `formatPlainDate()` helper.

#### Constraints

- `getExamTypeLabel()` from `frontend/src/constants/examinationTypes.ts` must be used to resolve the exam type label. No inline type-to-label mapping is permitted.
- `formatPlainDate()` must be used for date formatting — no alternative date formatting is introduced.
- The current-page breadcrumb item must not be a hyperlink (it represents the active page).

#### Edge Cases

| Condition | Required segment value |
|-----------|----------------------|
| `examinationType` is recognised | Label returned by `getExamTypeLabel()` |
| `examinationType` is absent or unrecognised | The string `"Examination"` |

#### Acceptance Criteria

1. The current-page breadcrumb item displays the composite string `"{patientName} — {examTypeLabel} — {examDate}"` when all three values are present and `examinationType` is recognised.
2. When `examinationType` is absent or unrecognised, the composite string reads `"{patientName} — Examination — {examDate}"`.
3. The breadcrumb item that previously rendered only `"{patientName} — {examDate}"` no longer does so.
4. The delimiter character and spacing between segments is consistent with the delimiter already used elsewhere in the same breadcrumb component.

---

### DR2-04

**Title:** MRN must be moved from Patient Information section to summary tile as a centre column
**Priority:** P1
**Affected file:** [`frontend/src/pages/ExaminationDetailPage.tsx`](../frontend/src/pages/ExaminationDetailPage.tsx)

#### Functional Requirement

The MRN field must be relocated from the Patient Information grid to the summary tile at the top of the Examination Detail page.

**Removal from Patient Information section:**
The `fieldBlock('MRN', examination.mrn || '—')` entry (or equivalent) must be removed from the Patient Information grid. No MRN label or value must remain in the Patient Information section after this change.

**Addition to summary tile:**
The summary tile must be updated from a two-column layout to a three-column layout. The MRN column must be inserted as the centre column between the existing Examination Date (left) column and Status (right) column:

```
[ Examination Date ]  [ MRN ]  [ Status ]
```

#### Constraints

- The MRN column in the summary tile must use the same visual style as the Examination Date column: a label rendered in small grey text above the value, and the value rendered in large bold text below.
- The label text for the MRN column must be `"MRN"`.
- The Examination Date column and Status column must retain their existing visual style and content — only the layout changes from two to three columns.
- MRN must not appear in two places simultaneously; after this change it exists only in the summary tile.

#### Edge Cases

| Condition | Required display value |
|-----------|----------------------|
| `examination.mrn` contains a value | Display the MRN value |
| `examination.mrn` is absent (`undefined`, `null`, or empty string) | Display `—` |

#### Acceptance Criteria

1. The MRN label and value no longer appear inside the Patient Information section grid.
2. The summary tile renders three columns in the order: Examination Date (left), MRN (centre), Status (right).
3. The MRN column in the summary tile shows the label `"MRN"` above the value.
4. The MRN column value displays `—` when `examination.mrn` is absent or empty.
5. The visual style (label/value typography) of the MRN column matches the Examination Date column.
6. The content and styling of the Examination Date and Status columns are unchanged.

---

### DR2-05

**Title:** PDF percentile annotations must be restricted to BPD, HC, AC, FL, and EFW
**Priority:** P1
**Affected file:** [`frontend/src/services/print.service.ts`](../frontend/src/services/print.service.ts)

#### Functional Requirement

In the PDF generated by `print.service.ts`, percentile annotations (the `(Nth %ile)` suffix) must appear only for the five core biometry fields: **BPD, HC, AC, FL, EFW**. All other biometry fields must display the raw measurement value and its unit only — no percentile suffix.

#### Specific Changes Required

**Fields that must retain percentile annotations (no change to these fields):**

| Field | Required format |
|-------|----------------|
| BPD | `withPct(value, bpdPct)` — unchanged |
| HC | `withPct(value, hcPct)` — unchanged |
| AC | `withPct(value, acPct)` — unchanged |
| FL | `withPct(value, flPct)` — unchanged |
| EFW | `withPct(value, efwPct)` — unchanged |

**Fields that must have percentile annotations removed:**

| Field | Old format | Required format |
|-------|-----------|----------------|
| OFD | `withPct(value, ofdPct)` | `${value} mm` |
| TCD | `withPct(value, tcdPct)` | `${value} mm` |
| Nuchal Fold | `withPct(value, nfPct)` | `${value} mm` |
| APAD | `withPct(value, apadPct)` | `${value} mm` |
| TAD | `withPct(value, tadPct)` | `${value} mm` |

The plain value format must match the style already used for fields VP, CM, NB, LA, and LC in the same file.

#### Dead Code Removal

The following items become unused after the percentile annotations are removed and must be deleted from `print.service.ts`:

1. The calculated percentile variables: `ofdPct`, `tcdPct`, `nfPct`, `apadPct`, `tadPct`.
2. The corresponding percentile calculation function calls: `calcOFDPercentile(...)`, `calcTCDPercentile(...)`, `calcNuchalFoldPercentile(...)`, `calcAPADPercentile(...)`, `calcTADPercentile(...)`.
3. Any import statements that become unused as a direct result of the above deletions.

#### Constraints

- The raw measurement values for OFD, TCD, Nuchal Fold, APAD, and TAD must still be present in the PDF output after this change — only the `(Nth %ile)` annotation is removed.
- No changes are made to the percentile logic or display for BPD, HC, AC, FL, and EFW.
- No new percentile calculation functions are introduced for the five fields that retain percentile display.

#### Acceptance Criteria

1. The PDF output for an examination that contains values for all biometry fields shows percentile annotations (`(Nth %ile)` suffix) only for BPD, HC, AC, FL, and EFW.
2. The PDF output for OFD, TCD, Nuchal Fold, APAD, and TAD shows only the raw numeric value followed by the unit `mm`, with no percentile suffix.
3. The variables `ofdPct`, `tcdPct`, `nfPct`, `apadPct`, and `tadPct` do not appear in `print.service.ts`.
4. The function calls `calcOFDPercentile`, `calcTCDPercentile`, `calcNuchalFoldPercentile`, `calcAPADPercentile`, and `calcTADPercentile` do not appear in `print.service.ts`.
5. Any import statements made unused by the above removals are also removed.
6. All biometry field values (including OFD, TCD, Nuchal Fold, APAD, TAD) remain present in the PDF output.
