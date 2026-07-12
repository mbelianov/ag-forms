# Defects Round 2

| ID | Title | Priority | Affected File(s) |
|----|-------|----------|-----------------|
| DR2-01 | Examination Detail page title is hardcoded and does not reflect the exam type | P1 | `frontend/src/pages/ExaminationDetailPage.tsx` |
| DR2-02 | Breadcrumb second item hardcoded to "Ultrasound Prenatal Exams" instead of "Exams" | P1 | `frontend/src/pages/ExaminationDetailPage.tsx` |
| DR2-03 | Breadcrumb current-page item missing exam type in composite string | P1 | `frontend/src/pages/ExaminationDetailPage.tsx` |
| DR2-04 | MRN must move from Patient Information section to the summary tile as a third column | P1 | `frontend/src/pages/ExaminationDetailPage.tsx` |
| DR2-05 | PDF shows percentiles for extended biometry fields — must be restricted to BPD, HC, AC, FL, EFW only | P1 | `frontend/src/services/print.service.ts` |

---

## DR2-01 — Examination Detail Page Title Hardcoded

**Priority:** P1

**Affected file:** `frontend/src/pages/ExaminationDetailPage.tsx`

### Description

The `<h1>` heading on the Examination Detail page is hardcoded to the string
`"Ultrasound Prenatal Exam Details"` regardless of the actual type of the examination
being viewed. As the system supports multiple examination types, this heading is
misleading for any exam that is not an ultrasound prenatal exam.

### Expected Behaviour

The page title (`<h1>`) must be derived from the examination's `examinationType` field
and formatted as a human-readable label followed by `" Details"`.
The existing `getExamTypeLabel()` helper in
`frontend/src/constants/examinationTypes.ts` must be used to resolve the type key to
its display label. When `examinationType` is absent or unrecognised, fall back to
`"Examination Details"`.

### Example

| `examinationType` value | Expected `<h1>` text |
|-------------------------|----------------------|
| `ultrasound_prenatal` | `Ultrasound Prenatal Exam Details` |
| `(absent / unknown)` | `Examination Details` |

---

## DR2-02 — Breadcrumb Second Item Hardcoded to "Ultrasound Prenatal Exams"

**Priority:** P1

**Affected file:** `frontend/src/pages/ExaminationDetailPage.tsx`

### Description

The second breadcrumb item on the Examination Detail page is hardcoded to
`"Ultrasound Prenatal Exams"` (line 192). It must be changed to the fixed label
`"Exams"`, consistent with the navigation menu item label established in DR1-16.

### Expected Behaviour

The breadcrumb trail must read: **Home / Exams / {exam identifier}**

The text `"Ultrasound Prenatal Exams"` must be replaced with `"Exams"`. The href
`/examinations` remains unchanged.

---

## DR2-03 — Breadcrumb Current-Page Item Missing Exam Type

**Priority:** P1

**Affected file:** `frontend/src/pages/ExaminationDetailPage.tsx`

### Description

The third (current-page) breadcrumb item currently renders only
`{patientName} — {examDate}` (line 194). The exam type is absent, making the
crumb ambiguous when a patient has multiple examinations on the same date.

### Expected Behaviour

The current-page breadcrumb must be a composite of three pieces of data in this
order:

**{patientName} — {examTypeLabel} — {examDate}**

- `patientName` — `examination.patientName`
- `examTypeLabel` — resolved via `getExamTypeLabel(examination.examinationType)`;
  fall back to `"Examination"` when `examinationType` is absent
- `examDate` — formatted with the existing `formatPlainDate()` helper

### Example

> `Ivanova Maria — Ultrasound Prenatal Exam — 15 Jan 2025`

---

## DR2-04 — MRN Must Move from Patient Information Section to the Summary Tile

**Priority:** P1

**Affected file:** `frontend/src/pages/ExaminationDetailPage.tsx`

### Description

The MRN field currently occupies a grid cell inside the **Patient Information** tile
(line 304). The summary tile at the top of the page (lines 267–288) currently holds
two columns: **Examination Date** (left) and **Status** (right). The MRN value should
be surfaced at a glance alongside those two key identifiers.

### Expected Behaviour

- The `{fieldBlock('MRN', examination.mrn || '—')}` entry must be **removed** from
  the Patient Information grid.
- The summary tile's flex container must be updated from a two-column layout
  (Date | Status) to a **three-column layout** (Date | MRN | Status), inserting the
  MRN as the centre column.
- The MRN column must use the same visual style as the Examination Date column
  (label in small grey text above, value in large bold text below).
- When `examination.mrn` is absent, display `—`.

---

## DR2-05 — PDF Percentiles Must Be Restricted to BPD, HC, AC, FL and EFW

**Priority:** P1

**Affected file:** `frontend/src/services/print.service.ts`

### Description

`print.service.ts` currently appends percentile annotations to five extended
biometry fields in addition to the core five:

| Field | Current behaviour |
|-------|-------------------|
| OFD | `withPct(value, ofdPct)` — includes percentile (line 170) |
| TCD | `withPct(value, tcdPct)` — includes percentile (line 172) |
| Nuchal Fold | `withPct(value, nfPct)` — includes percentile (line 174) |
| APAD | `withPct(value, apadPct)` — includes percentile (line 176) |
| TAD | `withPct(value, tadPct)` — includes percentile (line 177) |

Percentile display must be limited to **BPD, HC, AC, FL, EFW** only. All other
biometry measurements must show the raw value and unit only.

### Expected Behaviour

- **Keep** percentile annotations on: BPD, HC, AC, FL, EFW (lines 162–168 — no
  change).
- **Remove** percentile annotations from: OFD, TCD, Nuchal Fold, APAD, TAD —
  replace each `withPct(value, pct)` call with a plain `${value} mm` string, matching
  the style already used for VP, CM, NB, LA, LC.
- The calculated percentile variables (`ofdPct`, `tcdPct`, `nfPct`, `apadPct`,
  `tadPct`) and their corresponding import calls (`calcOFDPercentile`,
  `calcTCDPercentile`, `calcNuchalFoldPercentile`, `calcAPADPercentile`,
  `calcTADPercentile`) must be removed as they become unused.
- The raw measurement values for all extended biometry fields must still appear in
  the PDF — only the `(Nth %ile)` suffix is removed.
