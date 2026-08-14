# Biometry Auto-Calculation Behaviour Specification
Version: 1.0  
Scope: All exam types — `ultrasound_prenatal`, `ultrasound_prenatal_twins`,
`ultrasound_first_trimester`, `ultrasound_first_trimester_twins`

---

## 1. Field Dependency Table

Every derived field has a fixed set of source measurements. This table is the
authoritative reference for which measurements trigger recalculation.

| Derived field | Type | Source measurements | Formula ref |
|---|---|---|---|
| `efw` | integer g | BPD, HC, AC, FL | FORM-11a |
| `gestationalAgeFromBiometry` | "Xw Yd" | BPD, HC, AC, FL | FORM-3 |
| `bpdPercentile` | integer 1–99 | BPD + GA from LMP | FORM-4b |
| `hcPercentile` | integer 1–99 | HC + GA from LMP | FORM-5b |
| `acPercentile` | integer 1–99 | AC + GA from LMP | FORM-6b |
| `flPercentile` | integer 1–99 | FL + GA from LMP | FORM-7b |
| `ofdPercentile` | integer 1–99 | OFD + GA from LMP | FORM-8b |
| `efwPercentile` | integer 1–99 | BPD, HC, AC, FL + GA from LMP | FORM-11c |
| `tadPercentile` | integer 1–99 | — (no formula) | manual only |
| `apadPercentile` | integer 1–99 | — (no formula) | manual only |
| `bpdGa` | "Xw Yd" | BPD | FORM-4a |
| `hcGa` | "Xw Yd" | HC | FORM-5a |
| `acGa` | "Xw Yd" | AC | FORM-6a |
| `flGa` | "Xw Yd" | FL | FORM-7a |
| `ofdGa` | "Xw Yd" | OFD | FORM-8a |
| `efwGa` | "Xw Yd" | BPD, HC, AC, FL | FORM-11b |
| `tadGa` | "Xw Yd" | — (no formula) | manual only |
| `apadGa` | "Xw Yd" | — (no formula) | manual only |
| `gestationalAge` | "Xw Yd" | LMP date + Exam date | FORM-1 |
| `ft_gaFromCrl` | "Xw Yd" | CRL | FORM-12a |
| `ft_gaFromBio` | "Xw Yd" | CRL (current formula v1) | FORM-12a alias |

**Notes:**
- `gestationalAge` lives at the examination root level, not inside the biometry
  object. Its `gestationalAgeIsManual` flag lives at the same root level.
- `ft_gaFromCrl` and `ft_gaFromBio` are first-trimester fields. `ft_gaFromBio` is
  currently computed identically to `ft_gaFromCrl`; they are architecturally
  independent fields so a distinct formula can be substituted later without
  data-model changes. One `gaFromCrlIsManual` flag guards both simultaneously.

---

## 2. Auto-Calculation Scope by Exam Type

| Derived field | Prenatal single | Prenatal twins | FT single | FT twins |
|---|---|---|---|---|
| `efw` | ✅ auto | ✅ auto (T1 & T2) | — | — |
| `gestationalAgeFromBiometry` | ✅ auto | ✅ auto (T1 & T2) | — | — |
| `bpdPercentile` | ✅ auto | ✅ auto (T1 & T2) | — | — |
| `hcPercentile` | ✅ auto | ✅ auto (T1 & T2) | — | — |
| `acPercentile` | ✅ auto | ✅ auto (T1 & T2) | — | — |
| `flPercentile` | ✅ auto | ✅ auto (T1 & T2) | — | — |
| `ofdPercentile` | ✅ auto | ✅ auto (T1 & T2) | — | — |
| `efwPercentile` | ✅ auto | ✅ auto (T1 & T2) | — | — |
| `tadPercentile` | manual only | manual only | — | — |
| `apadPercentile` | manual only | manual only | — | — |
| `bpdGa` | ✅ auto | ✅ auto (T1 & T2) | — | — |
| `hcGa` | ✅ auto | ✅ auto (T1 & T2) | — | — |
| `acGa` | ✅ auto | ✅ auto (T1 & T2) | — | — |
| `flGa` | ✅ auto | ✅ auto (T1 & T2) | — | — |
| `ofdGa` | ✅ auto | ✅ auto (T1 & T2) | — | — |
| `efwGa` | ✅ auto | ✅ auto (T1 & T2) | — | — |
| `tadGa` | manual only | manual only | — | — |
| `apadGa` | manual only | manual only | — | — |
| `gestationalAge` | ✅ auto | ✅ auto (shared) | ✅ auto | ✅ auto (shared) |
| `ft_gaFromCrl` | — | — | ✅ auto | ✅ auto (T1 & T2) |
| `ft_gaFromBio` | — | — | ✅ auto | ✅ auto (T1 & T2) |

**Legend:** ✅ auto = auto-calculated reactively from source measurements.
`—` = field does not exist for this exam type.  
`T1 & T2` = applies independently per fetus using that fetus's measurements;
`gestationalAge` is shared between twins (one LMP, one exam date).

---

## 3. Trigger Rules

Auto-calculation fires reactively (no button) on every change to a source field,
subject to the conditions below. "Reactively" means on every keystroke that
produces a valid state change — not debounced, not on blur.

### 3.1 Conditions to fire auto-calculation

All three conditions must hold for auto-calculation to run for a given output field:

| # | Condition |
|---|---|
| A | The source measurement(s) required by the formula are all non-empty and pass field validation. |
| B | Any additional formula inputs (e.g. GA from LMP for percentile fields) are non-empty and valid. |
| C | The `{field}IsManual` flag for the output field is `false`. |

If any condition is not met, the output field is **left unchanged** (not cleared).
No error is shown when inputs are incomplete.

### 3.2 What triggers the reactive effect

| Source field changed | Derived fields recalculated |
|---|---|
| BPD | `efw`, `gestationalAgeFromBiometry`, `bpdPercentile`, `bpdGa`, `efwPercentile`, `efwGa` |
| HC | `efw`, `gestationalAgeFromBiometry`, `hcPercentile`, `hcGa`, `efwPercentile`, `efwGa` |
| AC | `efw`, `gestationalAgeFromBiometry`, `acPercentile`, `acGa`, `efwPercentile`, `efwGa` |
| FL | `efw`, `gestationalAgeFromBiometry`, `flPercentile`, `flGa`, `efwPercentile`, `efwGa` |
| OFD | `ofdPercentile`, `ofdGa` |
| GA from LMP | `bpdPercentile`, `hcPercentile`, `acPercentile`, `flPercentile`, `ofdPercentile`, `efwPercentile` |
| LMP date or Exam date | `gestationalAge` |
| CRL | `ft_gaFromCrl`, `ft_gaFromBio` |

---

## 4. Manual Override Behaviour

All auto-calculable derived fields support manual entry. The `{field}IsManual`
flag records whether the currently stored value was user-entered or formula-derived.

### 4.1 State transitions for the `{field}IsManual` flag

| User action | Effect on `{field}IsManual` | Effect on derived field value |
|---|---|---|
| User types a non-empty value into a derived field | Set to `true` | Value is whatever the user typed |
| User clears a derived field (value → empty string) | Set to `false` | Field is empty; auto-calc repopulates on next source change |
| Source measurement changes while flag is `false` | Stays `false` | Auto-calc overwrites with formula result |
| Source measurement changes while flag is `true` | Reset to `false` | Auto-calc overwrites with formula result (REQ-9 MEASUREMENT CHANGE) |
| Form loaded from stored exam; flag is `true` in DB | Stays `true` on load | Stored value is preserved; auto-calc does not overwrite |
| Form loaded from stored exam; flag is `false` in DB | Stays `false` on load | Auto-calc runs once on mount and may overwrite if inputs are valid |

### 4.2 The measurement-change reset rule (REQ-9)

When a **source measurement** changes, all derived fields that depend on it have
their `*IsManual` flag reset to `false` and are recalculated — regardless of
whether those derived fields were previously marked manual. Rationale: a manually
entered derived value (e.g. a manually typed percentile) becomes clinically
inconsistent with a freshly changed source measurement, so the formula-derived
value takes precedence.

This rule applies uniformly to **all** auto-calculable derived fields without
exception, including `efw` and `gestationalAgeFromBiometry`. No field is exempt.

### 4.3 Fields with no auto-calculation formula (TAD, APAD)

`tadPercentile`, `apadPercentile`, `tadGa`, `apadGa` have no formula. Their
`*IsManual` flags are always irrelevant and must never be read or written by
the auto-calc engine. These fields are user-entry only.

---

## 5. New Exam vs. Edit Existing Exam

### 5.1 New exam

| Scenario | Behaviour |
|---|---|
| Form opened for a new exam | All derived fields are empty; all `*IsManual` flags are `false`. |
| User enters source measurements | Auto-calc fires reactively and populates derived fields; flags remain `false`. |
| User manually types a derived field | That field's `*IsManual` flag is set to `true`; auto-calc is suppressed for that field only. |
| User then changes a source measurement | Flag for that field is reset to `false`; formula overwrites the manual value (REQ-9). |
| User submits | All current values and all `*IsManual` flags are persisted to the database. |

### 5.2 Edit existing exam

| Scenario | Behaviour |
|---|---|
| Form opened for an existing exam | All derived fields and `*IsManual` flags are seeded from the stored database values. |
| Stored flag is `true` for a field | Auto-calc does NOT overwrite that field on initial mount. The stored manual value is preserved. |
| Stored flag is `false` for a field | Auto-calc runs on mount (because source measurements are present); formula value is written. This is correct — it re-derives from the current inputs, which may reflect any date correction or measurement edit. |
| User changes a source measurement | Same as new-exam: dependent flags reset to `false`, formula overwrites. |
| User manually types a derived field | Same as new-exam: flag set to `true`, auto-calc suppressed for that field. |
| User submits | Updated values and updated `*IsManual` flags replace the stored values. |

---

## 6. Per-Field Behaviour Summary

The following table combines dependency, auto-calc capability, and `*IsManual`
guard in one view. "Guarded" means auto-calc checks the `*IsManual` flag before
writing; "Never auto" means no formula exists.

| Field | Depends on | Has formula | `*IsManual` guarded | Overwritten when source changes |
|---|---|---|---|---|
| `gestationalAge` | LMP + ExamDate | ✅ | ✅ `gestationalAgeIsManual` | ✅ always reset |
| `efw` | BPD, HC, AC, FL | ✅ | ✅ `efwIsManual` | ✅ always reset |
| `gestationalAgeFromBiometry` | BPD, HC, AC, FL | ✅ | ✅ `gestationalAgeFromBiometryIsManual`* | ✅ always reset |
| `bpdPercentile` | BPD + GA from LMP | ✅ | ✅ `bpdPercentileIsManual` | ✅ when BPD or GA changes |
| `hcPercentile` | HC + GA from LMP | ✅ | ✅ `hcPercentileIsManual` | ✅ when HC or GA changes |
| `acPercentile` | AC + GA from LMP | ✅ | ✅ `acPercentileIsManual` | ✅ when AC or GA changes |
| `flPercentile` | FL + GA from LMP | ✅ | ✅ `flPercentileIsManual` | ✅ when FL or GA changes |
| `ofdPercentile` | OFD + GA from LMP | ✅ | ✅ `ofdPercentileIsManual` | ✅ when OFD or GA changes |
| `efwPercentile` | BPD, HC, AC, FL + GA from LMP | ✅ | ✅ `efwPercentileIsManual` | ✅ when BPD, HC, AC, FL or GA changes |
| `tadPercentile` | — | ❌ | N/A | N/A |
| `apadPercentile` | — | ❌ | N/A | N/A |
| `bpdGa` | BPD | ✅ | ✅ `bpdGaIsManual` | ✅ when BPD changes |
| `hcGa` | HC | ✅ | ✅ `hcGaIsManual` | ✅ when HC changes |
| `acGa` | AC | ✅ | ✅ `acGaIsManual` | ✅ when AC changes |
| `flGa` | FL | ✅ | ✅ `flGaIsManual` | ✅ when FL changes |
| `ofdGa` | OFD | ✅ | ✅ `ofdGaIsManual` | ✅ when OFD changes |
| `efwGa` | BPD, HC, AC, FL | ✅ | ✅ `efwGaIsManual` | ✅ when BPD, HC, AC, or FL changes |
| `tadGa` | — | ❌ | N/A | N/A |
| `apadGa` | — | ❌ | N/A | N/A |
| `ft_gaFromCrl` | CRL | ✅ | ✅ `gaFromCrlIsManual` | ✅ when CRL changes |
| `ft_gaFromBio` | CRL (v1 alias) | ✅ | ✅ `gaFromCrlIsManual` (shared) | ✅ when CRL changes |

\* `gestationalAgeFromBiometryIsManual` — this flag is not yet implemented in the
codebase (the field is currently always overwritten). It must be added to bring
`gestationalAgeFromBiometry` into conformance with the same rules as all other
derived fields. Until it is added, `gestationalAgeFromBiometry` behaves as if
`*IsManual` is permanently `false`.

---

## 7. Twin Exams

Twins exams have two independent fetus data sets (T1 and T2). The auto-calc
rules in Sections 3–6 apply **independently per fetus**:

- T1 fields use the unprefixed biometry object (`biometry`, `efw`, `bpdGa`, etc.).
- T2 fields use the `biometry2` object and are stored/loaded independently.
- `gestationalAge` (GA from LMP) is **shared** — it is a single examination-level
  field derived from a single LMP and exam date. Both T1 and T2 percentile
  calculations use the same `gestationalAge` value.
- When GA from LMP changes, percentile auto-calc fires for **both** T1 and T2
  derived fields.
- `gestationalAgeFromBiometry` for T1 and `t2_gestationalAgeFromBiometry` for T2
  are independent — each is derived from its own fetus's BPD, HC, AC, FL.

---

## 8. Identified Bug: `computeBiometryDerivedFields` ignores `*IsManual` flags

The current implementation of `computeBiometryDerivedFields` in
`frontend/src/hooks/useBiometryAutoCalc.ts` receives all `*IsManual` flags in its
`input` argument but never reads them. Every field is unconditionally overwritten
and every flag is unconditionally reset to `false` on every call.

This violates the rules in Sections 4 and 5 in two observable ways:

1. **Edit existing exam:** Stored manual values are immediately overwritten on form
   mount because the effect fires once with the seeded measurements and ignores the
   `true` flags loaded from the database.

2. **PDF / detail view footnote never appears:** Because flags are always reset to
   `false` before submit, `exam.biometry?.bpdPercentileIsManual` etc. are never
   `true` in the stored data, so `viewModelBuilders.ts` never appends
   `\n† Value manually entered` to the notes field and the amber dot indicators
   in `ExaminationSections.tsx` never render.

**Required fix:** In `computeBiometryDerivedFields`, each auto-calculable output
field must be gated on its corresponding `*IsManual` input flag following the rule
in Section 4.1: only write to `diff` when the flag is `false`. When the flag is
`true`, omit the field from `diff` entirely so the existing `formData` value is
preserved unchanged.

The measurement-change reset (Section 4.2) must be handled by the caller
(`useExaminationForm.ts` `handleChange`) before the effect re-fires when a
source measurement changes.
