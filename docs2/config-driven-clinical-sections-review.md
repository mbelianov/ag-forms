# Review Findings — Config-Driven Clinical Sections

## Review objective

Verify whether the implementation described in `config-driven-clinical-sections-plan.md` achieves a 100% configuration-driven approach for all clinical sections across:

- Examination input form
- Examination detail view
- PDF report

## Conclusion

The implementation is **not yet 100% config-driven**.

All five clinical section field collections now originate from `EXAM_TYPE_CONFIG`, and the detail view is largely config-driven. However, the PDF pipeline, Doppler grouping, validation, and several descriptor-specific behaviours still contain hardcoded clinical knowledge.

## Coverage summary

| Clinical section | Input form | Detail view | PDF | Assessment |
|---|---|---|---|---|
| Ultrasound Findings | Partial | Mostly config-driven | Defect/partial | Not 100% |
| Biometry | Partial | Config-driven | Partial | Not 100% |
| Doppler | Partial | Partial | Partial | Not 100% |
| Anatomy | Partial | Config-driven | Mostly config-driven | Not 100% |
| Markers | Config-driven | Config-driven | Mostly config-driven | Closest to complete |

---

## Finding 1 — PDF Biometry is not driven by the active examination config

**Severity:** High

**Status:** Resolved

`buildFetusPdfViewModel` maps the observables present in stored data directly instead of iterating over `config.biometryTypes` and `config.dopplerVessels`/`config.dopplerSingle`.

Relevant code:

- `frontend/src/services/viewModelBuilders.ts:123-132`

Consequences:

- PDF order comes from stored data rather than configuration.
- A stored observable removed from configuration can still appear.
- A newly configured observable has no guaranteed PDF row unless it exists in storage.
- Empty configured rows are not represented.
- The active configuration does not determine the complete PDF section shape.

Labels are also duplicated in the hardcoded `OBSERVABLE_PDF_META` map at `frontend/src/services/viewModelBuilders.ts:57-89`, despite labels and units already existing in `EXAM_TYPE_CONFIG`.

**Affected sections:** Biometry and Doppler PDF.

---

## Finding 2 — PDF observable value formatting is hardcoded by clinical type

**Severity:** High

**Status:** Resolved

`fmtObservableValue` contains explicit type checks and type lists for EFW, Doppler values, free-text measurements, heart rate, and default millimetre measurements.

Relevant code:

- `frontend/src/services/viewModelBuilders.ts:93-108`

Adding an observable to `EXAM_TYPE_CONFIG` is therefore insufficient to make it render correctly in the PDF. Formatting behaviour may also need to be added manually to `fmtObservableValue`.

The existing `unit` metadata in `ObservableTypeConfig` is not used as the general source for PDF formatting.

**Affected sections:** Biometry and Doppler PDF.

---

## Finding 3 — Populated first-trimester PDF Ultrasound Findings can use prenatal configuration

**Severity:** High — functional defect

**Status:** Resolved

In the populated-Ultrasound branch, `mkUltrasoundPairs` is called without the examination type and therefore uses its default value of `prenatal`.

Relevant code:

- Helper default: `frontend/src/components/reports/pdfSections.ts:104-111`
- Incorrect populated branch call: `frontend/src/components/reports/pdfSections.ts:378-384`
- Correct empty branch call: `frontend/src/components/reports/pdfSections.ts:385-395`

For a populated first-trimester examination, the PDF may attempt to render prenatal-only fields such as Presentation, Gender, and Fetal Movement. Behaviour changes depending on whether any Ultrasound Finding has a value.

**Affected section:** Ultrasound Findings PDF.

---

## Finding 4 — Doppler grouping is based on array position rather than explicit config metadata

**Severity:** Medium–High

**Status:** Resolved

All three presentation surfaces assume that every two consecutive `dopplerVessels` entries form a PI/RI pair:

- Form: `frontend/src/components/sections/DopplerSection.tsx:56-60`
- Detail view: `frontend/src/components/ExaminationSections.tsx:225-230`
- PDF: `frontend/src/components/reports/pdfSections.ts:201-205`

The detail and PDF renderers also infer a vessel name by removing `PI` from the first configured label:

- Detail view: `frontend/src/components/ExaminationSections.tsx:251-255`
- PDF: `frontend/src/components/reports/pdfSections.ts:217-225`

Configuration does not explicitly express:

- Vessel grouping
- Whether a measurement is PI or RI
- The vessel display label
- Unpaired measurements
- Other possible Doppler measurement kinds

Reordering the array or adding an unpaired entry can silently produce incorrect output.

**Affected section:** Doppler form, detail view, and PDF.

---

## Finding 5 — Ultrasound Finding validation is hardcoded to `heart_rate`

**Severity:** Medium

**Status:** Resolved

The form renderer and validation logic special-case the `heart_rate` key.

Relevant code:

- Error binding: `frontend/src/components/ExaminationForm.tsx:157-169`
- Validation: `frontend/src/hooks/useExaminationForm.ts:434-439`

`DescriptorTypeConfig` does not currently carry validation metadata such as value kind, range, required status, or validation label. Adding another numeric or integer Ultrasound Finding through configuration would render an input but would not provide equivalent validation without application code changes.

**Affected section:** Ultrasound Findings form.

---

## Finding 6 — Biometry validation contains hardcoded observable keys

**Severity:** Medium

**Status:** Resolved

The form validation iterates configured Biometry entries but then hardcodes semantic behaviour for `vp`, `la`, `ducVen`, and `puls`.

Relevant code:

- `frontend/src/hooks/useExaminationForm.ts:400-417`

Free-text versus numeric behaviour and integer validation are not represented by `ObservableTypeConfig`. Newly configured free-text or integer observables require source changes.

`ducVen` is also checked in the Biometry validation branch even though it is currently configured as a single Doppler observable.

**Affected section:** Biometry form validation.

---

## Finding 7 — Anatomy form does not honour generic descriptor control metadata

**Severity:** Medium

**Status:** Resolved

The Anatomy form iterates `examConfig.anatomyTypes`, but always renders a `TextInput` and only consumes `key` and `label`.

Relevant code:

- `frontend/src/components/ExaminationForm.tsx:218-236`

The renderer ignores the following `DescriptorTypeConfig` properties:

- `inputType`
- `options`
- `placeholder`
- `unit`

All current Anatomy descriptors are text inputs, so the existing output works. Nevertheless, the renderer is config-driven only for field presence, order, key, and label.

**Affected section:** Anatomy form.

---

## Finding 8 — PDF view-model types and builders retain duplicated field lists

**Severity:** Medium

**Status:** Resolved

`FetusPdfViewModel` explicitly lists Ultrasound, Anatomy, and Marker properties even though each object also has a dynamic record signature.

Relevant code:

- `frontend/src/services/print.service.ts:17-54`

`buildFetusPdfViewModel` then repeats named aliases after already populating values through configuration loops.

Relevant code:

- Ultrasound aliases: `frontend/src/services/viewModelBuilders.ts:153-160`
- Anatomy aliases: `frontend/src/services/viewModelBuilders.ts:171-182`

This creates a second schema source and inconsistent aliases such as `heart_rate`/`heartRate` and `fetal_movement`/`fetalMovement`.

**Affected sections:** Ultrasound Findings, Anatomy, and Markers PDF model.

---

## Finding 9 — PDF Marker section visibility is hardcoded to examination type

**Severity:** Medium

**Status:** Resolved

The PDF renders the Marker section when `vm.examinationType === 'first_trimester'`, rather than when the active configuration contains marker definitions.

Relevant code:

- Type check: `frontend/src/components/reports/pdfSections.ts:347-357`
- Marker section condition: `frontend/src/components/reports/pdfSections.ts:413-426`

A future non-first-trimester configuration with Marker definitions would not render those markers. Conversely, a first-trimester configuration with an empty marker list would still render the section.

The Marker rows themselves are correctly mapped from `config.markerTypes`.

**Affected section:** Markers PDF.

---

## Finding 10 — Ultrasound label construction contains a hardcoded `heart_rate` special case

**Severity:** Low–Medium

**Status:** Resolved

All three surfaces special-case `heart_rate` to construct `FHR (bpm)`:

- Form: `frontend/src/components/ExaminationForm.tsx:136-139`
- Detail view: `frontend/src/components/ExaminationSections.tsx:153-171`
- PDF: `frontend/src/components/reports/pdfSections.ts:104-110`

Other text descriptors with units do not automatically receive equivalent label formatting. The display-label policy is therefore not fully generic or solely controlled by configuration.

**Affected section:** Ultrasound Findings form, detail view, and PDF.

---

## Confirmed config-driven areas

The following portions are successfully configuration-driven:

- `ExamTypeConfig` defines all five clinical section collections.
- Prenatal and first-trimester entries populate all five collections in `EXAM_TYPE_CONFIG`.
- The form uses configuration to enumerate Ultrasound Findings, Biometry, Doppler entries, Anatomy, and Markers.
- The detail view uses configuration to enumerate all five clinical sections.
- PDF Marker rows are generated from `config.markerTypes`.
- PDF Anatomy pairs are generated from `config.anatomyTypes`.
- PDF Ultrasound pairs are generated from `config.ultrasoundFindingTypes` when the correct examination type is passed.

## Recommended discussion order

1. Fix the first-trimester Ultrasound PDF configuration defect.
2. Make the PDF Biometry and Doppler view models iterate the active config.
3. Replace hardcoded PDF labels and type-based formatting with config metadata.
4. Define explicit config metadata for Doppler grouping.
5. Define declarative validation/input semantics for observable and descriptor fields.
6. Make Anatomy consume the full descriptor control contract.
7. Remove duplicated PDF field schemas and aliases.
8. Drive PDF Marker visibility from `markerTypes`.
9. Remove the `heart_rate` display-label special case.

## Final assessment

The implementation has achieved **config-based field enumeration**, but not a fully config-driven clinical architecture. The detail view is closest to the intended target. The PDF pipeline contains the largest remaining gaps, followed by form validation and Doppler structural assumptions.
