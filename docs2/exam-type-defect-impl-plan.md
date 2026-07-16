# Implementation Plan: Examination Type–Driven Field Visibility

| Field | Value |
|---|---|
| **Plan ID** | IMPL-EXAM-TYPE-001 |
| **Related Defect** | DEF-EXAM-TYPE-001 |
| **Related Spec** | REQ-EXAM-TYPE-001 |
| **Status** | Ready for Implementation |

---

## Architecture Summary

The application uses a single `ExaminationForm` component for both creating and editing examinations. This component contains a `SECTION_VISIBILITY` map — keyed by examination type — that controls which sections of the form are rendered. The detail page and PDF report are the read-only counterparts to the form, but they independently apply a data-presence heuristic rather than using the same type-driven configuration. The fix centralises visibility configuration and threads it through all three surfaces.

```
Before:
  examinationTypes.ts  →  EXAM_TYPES (keys + labels only)
  ExaminationForm.tsx  →  SECTION_VISIBILITY (private, local)
  ExaminationDetailPage.tsx  →  hasBiometry / hasAnatomy / ... (data-presence)
  pdfDocument.ts  →  pairs.some(v => v) (data-presence)

After:
  examinationTypes.ts  →  EXAM_TYPES + SECTION_VISIBILITY (shared export)
        ↓                          ↓                    ↓
  ExaminationForm.tsx    ExaminationDetailPage.tsx    pdfDocument.ts
  (imports, unchanged)   (imports, replaces guards)   (imports, replaces guards)
```

---

## Current-State Diagnosis

### ExaminationForm.tsx

- Defines `SECTION_VISIBILITY` as a module-level `const` — not exported.
- Derives `const visibility = SECTION_VISIBILITY[formData.examinationType] ?? SECTION_VISIBILITY['ultrasound_prenatal']` at render time.
- Guards each JSX section with `{visibility.pregnancyData && (...)}`, `{visibility.biometry && (...)}`, etc.
- **This is the correct pattern. No changes needed to the form's behaviour.**

### ExaminationDetailPage.tsx

- Computes `const hasBiometry = examination.biometry && Object.values(examination.biometry).some(v => v !== undefined)`.
- Similarly computes `hasUltrasoundFindings`, `hasAnatomy`, `hasVascular`.
- Uses these booleans to conditionally render entire tiles.
- Within the Biometry tile, each sub-field is individually guarded by `{examination.biometry!.bpd !== undefined && (...)}` — fields with no value are silently omitted.
- The Doppler tile, once shown, renders all fields with `—` for absent values — this is the only section that already behaves correctly.
- `examinationType` is used only to derive a display label string.
- **Merged tile problem**: The Patient Information tile (always rendered, no guard) contains both universal fields (Patient Name, Patient Age at Exam) and six pregnancy-specific fields (GA from LMP, GA from Biometry, EDD, LMP, Obstetric History, Family History) all hardcoded into the same tile. There is no mechanism to suppress the pregnancy fields for a type where `pregnancyData: false`. This must be corrected by splitting the tile.
- **All data-presence guards on section tiles must be replaced with type-driven guards.**
- **All per-field `!== undefined` guards inside Biometry must be removed; all fields must be rendered unconditionally.**
- **Patient Information tile must be split: pregnancy fields move to a separate, type-gated Pregnancy Data tile.**

### pdfDocument.ts / print.service.ts

- `buildExaminationPDF` guards each section with `if (biometryPairs.some(([, v]) => v))` — identical data-presence pattern.
- `kvGrid` already renders `—` for undefined values; it does not need to change.
- `ExamPdfViewModel` already carries `examinationType`.
- **Merged patient header problem**: The patient header block in `buildExaminationPDF` unconditionally writes GA from LMP, GA from Biometry, and EDD as inline metadata lines (lines 241–261 of `pdfDocument.ts`). These are pregnancy-specific fields and must be suppressed when `visibility.pregnancyData === false`.
- **Missing Pregnancy Data section**: The `ExamPdfViewModel.pregnancy` object carries LMP, Obstetric History, and Family History but these fields are **never rendered** anywhere in the current PDF output. A dedicated guarded Pregnancy Data section is missing entirely and must be added.
- **Section guards in `buildExaminationPDF` must be replaced with type-driven guards.**
- **No changes to `kvGrid`, `textBlock`, or the view model shape. `buildViewModel` does not need changes.**

---

## Target-State Design

### Shared Visibility Resolution

`SECTION_VISIBILITY` is exported from `examinationTypes.ts`. A small helper function `getSectionVisibility(examinationType: string | undefined)` is also exported from the same file. It encapsulates the fallback logic:

```ts
// In examinationTypes.ts
export const SECTION_VISIBILITY: Record<string, Record<string, boolean>> = {
  ultrasound_prenatal: {
    pregnancyData:      true,
    ultrasoundFindings: true,
    anatomy:            true,
    biometry:           true,
    doppler:            true,
  },
};

export function getSectionVisibility(type: string | undefined): Record<string, boolean> {
  return SECTION_VISIBILITY[type ?? ''] ?? SECTION_VISIBILITY['ultrasound_prenatal'];
}
```

All three consumers call `getSectionVisibility(examination.examinationType)` to obtain their visibility object. The form continues to use the same pattern it already has, but importing from the shared location instead of using a local constant.

### ExaminationDetailPage — Tile Guards and Tile Split

Replace all data-presence booleans with a single visibility object:
```ts
const visibility = getSectionVisibility(examination.examinationType);
```

Use `{visibility.biometry && <Tile>...</Tile>}` etc. to gate each clinical section tile.

The Patient Information tile must be **split into two tiles**:

1. **Patient Information** (always rendered — no guard):
   - Patient Name
   - Patient Age at Exam

2. **Pregnancy Data** (rendered only when `visibility.pregnancyData === true`):
   - Gestational Age (from LMP)
   - Gestational Age (from Biometry)
   - Expected Delivery Date (EDD)
   - Last Menstrual Period (LMP)
   - Obstetric History
   - Family History

For `ultrasound_prenatal` the two tiles appear back-to-back and are visually equivalent to the existing single tile. No data or styling changes are needed — only the tile boundary and the guard move.

### ExaminationDetailPage — Per-Field Rendering in Biometry

Remove individual `{examination.biometry!.bpd !== undefined && (...)}` wrappers. Render every field unconditionally, falling back to `—`:

```tsx
{fieldBlock('BPD (Biparietal Diameter)', examination.biometry?.bpd !== undefined ? `${examination.biometry.bpd} mm` : '—')}
```

### pdfDocument — Section Guards

Replace all four data-presence guards with type-driven guards using the `visibility` object resolved at the top of `buildExaminationPDF`:

```ts
const visibility = getSectionVisibility(vm.examinationType);
```

| Current guard | Replacement |
|---|---|
| `if (biometryPairs.some(([, v]) => v))` | `if (visibility.biometry)` |
| `if (dopplerPairs.some(([, v]) => v))` | `if (visibility.doppler)` |
| `if (ultrasoundPairs.some(([, v]) => v))` | `if (visibility.ultrasoundFindings)` |
| `if (anatomyPairs.some(([, v]) => v))` | `if (visibility.anatomy)` |

### pdfDocument — Pregnancy Data Section and Patient Header Fix

Two changes are required in `buildExaminationPDF`:

**1. Wrap patient header pregnancy lines**

The patient header block (around lines 241–261) unconditionally renders GA from LMP, GA from Biometry, and EDD. These three lines must be wrapped:

```ts
if (visibility.pregnancyData) {
  // GA (LMP) line
  // GA (Bio) line
  // EDD (right-aligned, accent colour)
  y += 6;
}
```

When `pregnancyData` is `false`, these lines are skipped and `y` advances only for the lines above them.

**2. Add a dedicated Pregnancy Data section**

Insert a new guarded section block immediately after the patient header rule and before the Biometry section:

```ts
if (visibility.pregnancyData) {
  y = sectionHeading(doc, 'Pregnancy Data', y);
  const pregnancyPairs: Array<[string, string | undefined]> = [
    ['LMP',                 vm.pregnancy.lmp],
    ['EDD',                 vm.expectedDeliveryDate],
    ['GA from LMP',         vm.gestationalAge],
    ['GA from Biometry',    vm.gestationalAgeFromBiometry],
    ['Obstetric History',   vm.pregnancy.obstetricHistory],
    ['Family History',      vm.pregnancy.familyHistory],
  ];
  y = kvGrid(doc, pregnancyPairs, y, 2);
  y += 1;
}
```

All six fields are already available on `vm` — no view model changes are needed.

---

## Affected Files

| File | Change Type | Description |
|---|---|---|
| `frontend/src/constants/examinationTypes.ts` | **Modify** | Export `SECTION_VISIBILITY` and `getSectionVisibility()` |
| `frontend/src/components/ExaminationForm.tsx` | **Modify** | Remove local `SECTION_VISIBILITY`; import from `examinationTypes.ts` |
| `frontend/src/pages/ExaminationDetailPage.tsx` | **Modify** | Replace data-presence guards with type-driven guards; split Patient Information tile; remove per-field biometry `!== undefined` wrappers |
| `frontend/src/components/reports/pdfDocument.ts` | **Modify** | Replace `pairs.some(...)` section guards with type-driven guards; wrap patient header pregnancy lines; add Pregnancy Data section |
| `frontend/src/services/print.service.ts` | **No change** | `buildViewModel` does not need changes; `examinationType` and `pregnancy` fields are already passed through |

No new files need to be created. No backend changes are required.

---

## Required Refactoring

### Step 1 — Centralise SECTION_VISIBILITY in examinationTypes.ts

- Move the `SECTION_VISIBILITY` constant verbatim from `ExaminationForm.tsx` to `examinationTypes.ts`.
- Add the `getSectionVisibility` helper function to the same file.
- Export both.
- This is the foundational step that all subsequent steps depend on.

### Step 2 — Update ExaminationForm.tsx

- Remove the local `SECTION_VISIBILITY` constant declaration.
- Add an import for `SECTION_VISIBILITY` and/or `getSectionVisibility` from `../constants/examinationTypes`.
- Replace the existing local visibility derivation line with a call to `getSectionVisibility(formData.examinationType)`.
- All existing JSX section guards remain identical — only the source of the `visibility` object changes.
- **Risk: zero** — the logic is identical; only the constant's origin changes.

### Step 3 — Refactor ExaminationDetailPage.tsx

**3a. Replace section-level data-presence guards with type-driven guards**

- Remove `hasBiometry`, `hasUltrasoundFindings`, `hasAnatomy`, `hasVascular`, `hasDoppler` computed booleans that are used as tile gates.
- Add `const visibility = getSectionVisibility(examination.examinationType)` near the top of the component body, alongside the existing derived value computations.
- Replace each tile's conditional rendering expression:
  - `{hasBiometry && <Tile>...` → `{visibility.biometry && <Tile>...`
  - `{hasUltrasoundFindings && <Tile>...` → `{visibility.ultrasoundFindings && <Tile>...`
  - `{hasAnatomy && <Tile>...` → `{visibility.anatomy && <Tile>...`
  - `{(hasDoppler || hasVascular) && <Tile>...` → `{visibility.doppler && <Tile>...`

**3b. Split the Patient Information tile (merged tile fix)**

The current Patient Information tile renders eight fields in a single always-on tile. It must be split into two tiles:

- **Tile A — Patient Information** (always rendered, no guard): keep only Patient Name and Patient Age at Exam. Remove all six pregnancy-specific fields from this tile.
- **Tile B — Pregnancy Data** (`{visibility.pregnancyData && <Tile>...}`): move the six pregnancy fields here — Gestational Age (from LMP), Gestational Age (from Biometry), EDD, LMP, Obstetric History, Family History. The field blocks and styling are identical to their current form; only their container tile and guard change.
- Place Tile B immediately after Tile A in the JSX so the render order is preserved for `ultrasound_prenatal`.

**3b. Remove per-field `!== undefined` guards in the Biometry tile**

- The Biometry tile's body currently conditionally renders each of the fifteen biometry sub-fields only when the value is not `undefined`. Replace this pattern: render all fifteen fields unconditionally and use a ternary to display the value or `—`.
- Retain the percentile badge logic (`pctBadge`) as-is; it already returns `null` when no percentile is available.
- Remove the `{hasBiometry ? (...) : <div>No biometry measurements recorded.</div>}` branching — the tile is now always shown (for the relevant type) and empty fields display `—`, so the "no measurements" message is no longer needed.

### Step 4 — Refactor pdfDocument.ts

**4a. Resolve visibility at the top of buildExaminationPDF**

- Import `getSectionVisibility` from the shared constants.
- At the start of `buildExaminationPDF(vm)`, after font registration, derive: `const visibility = getSectionVisibility(vm.examinationType)`.

**4b. Wrap patient header pregnancy lines**

- Locate the three pregnancy-specific lines in the patient header block (GA from LMP, GA from Biometry, EDD — approximately lines 241–261 of `pdfDocument.ts`).
- Wrap these three lines in `if (visibility.pregnancyData) { ... }`.
- Ensure the `y` cursor advances correctly whether or not the block is rendered — the lines that follow (the horizontal rule) must not overlap the patient name / status lines above when pregnancy data is suppressed.

**4c. Add a Pregnancy Data section block**

- After the patient header rule and before the existing Biometry section, insert a new block:
  ```ts
  if (visibility.pregnancyData) {
    y = sectionHeading(doc, 'Pregnancy Data', y);
    const pregnancyPairs: Array<[string, string | undefined]> = [
      ['LMP',              vm.pregnancy.lmp],
      ['EDD',              vm.expectedDeliveryDate],
      ['GA from LMP',      vm.gestationalAge],
      ['GA from Biometry', vm.gestationalAgeFromBiometry],
      ['Obstetric History',vm.pregnancy.obstetricHistory],
      ['Family History',   vm.pregnancy.familyHistory],
    ];
    y = kvGrid(doc, pregnancyPairs, y, 2);
    y += 1;
  }
  ```
- All six values already exist on the view model — no changes to `buildViewModel` or `ExamPdfViewModel` are needed.

**4d. Replace data-presence section guards**

Replace each of the four remaining data-presence guards:

| Current guard | Replacement |
|---|---|
| `if (biometryPairs.some(([, v]) => v))` | `if (visibility.biometry)` |
| `if (dopplerPairs.some(([, v]) => v))` | `if (visibility.doppler)` |
| `if (ultrasoundPairs.some(([, v]) => v))` | `if (visibility.ultrasoundFindings)` |
| `if (anatomyPairs.some(([, v]) => v))` | `if (visibility.anatomy)` |

The `kvGrid` call inside each block remains unchanged — it already renders `—` for undefined values.

---

## Shared Visibility / Rules Strategy

The single rule is: **a section is visible if and only if `getSectionVisibility(examinationType)[sectionKey] === true`**.

This rule is applied identically at three sites:
1. Form — controls which input groups are offered.
2. Detail page — controls which read-only tiles are rendered.
3. PDF — controls which sections are written to the document.

The fallback to `ultrasound_prenatal` when the type is unrecognised must be consistent across all three sites, which is guaranteed by routing all three through `getSectionVisibility`.

---

## Testing Strategy

### Unit Tests

- Add a unit test for `getSectionVisibility`: verify that a known type returns the correct map, and that an unknown type falls back to `ultrasound_prenatal`.
- This test belongs alongside existing tests in `api/src/tests/` or in a new frontend test file, depending on project test conventions.

### Manual / Integration Verification

For each of the following scenarios, verify both the detail page UI and the generated PDF:

| Scenario | Expected result |
|---|---|
| `ultrasound_prenatal` exam with all sections empty | All five section tiles visible; all fields show `—` |
| `ultrasound_prenatal` exam with only Biometry filled | All five tiles visible; Biometry shows values; others show `—` |
| `ultrasound_prenatal` exam fully populated | Output identical to current behaviour |
| Exam record with no `examinationType` set (legacy) | Falls back to `ultrasound_prenatal`; all five tiles shown |

### Regression Checklist

- [ ] Create examination → save → navigate to detail page: all expected sections visible.
- [ ] Edit examination → save → re-navigate to detail page: no sections lost.
- [ ] Print PDF for empty examination: all sections present with `—`.
- [ ] Print PDF for fully populated examination: output visually equivalent to before.
- [ ] Email PDF: same content as printed PDF.
- [ ] `ExaminationForm` behaviour unchanged for all examination types.

---

## Regression Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Biometry tile always rendered even when type does not include it | Low — only `ultrasound_prenatal` exists currently; all of its sections are `true` | Type-driven guard correctly handles future types with `false` sections |
| PDF becomes longer for empty examinations due to always-shown sections | Low — sections with all `—` values have a predictable fixed height | Verify PDF does not overflow a single page for a fully empty examination |
| `hasBiometry` removal causes a ripple if referenced elsewhere | Low | Grep the codebase for all usages of `hasBiometry`, `hasUltrasoundFindings`, `hasAnatomy`, `hasVascular` before removal |
| Form behaviour changes due to import refactor | None — only the source location of the constant changes, not its value | Review the form's output in a browser before and after the change |
| Pregnancy tile split breaks layout for `ultrasound_prenatal` | Low — for this type `pregnancyData: true` so both tiles always render; field content is unchanged | Visually compare detail page before and after for a fully-populated record |
| PDF patient header `y` cursor misaligned after wrapping pregnancy lines | Medium — removing 3 lines from the header block changes the vertical offset of the rule that follows | Carefully trace `y` increments inside and outside the `if (visibility.pregnancyData)` block; test PDF output for both populated and empty records |
| Pregnancy Data PDF section missing separator rule before Biometry | Low | Add a `rule(doc, y); y += 4;` before the Pregnancy Data `sectionHeading` call, consistent with the pattern used by all other sections |

---

## Rollout Notes

- This is a purely frontend, display-layer change. No database migrations, API changes, or backend deployments are required.
- The change is safe to release independently of any other work.
- No feature flag is needed — the fix aligns the detail page and PDF with already-shipped form behaviour.
- When future examination types are added, the developer adding the type must add a `SECTION_VISIBILITY` entry. This should be documented in `AGENTS.md` as a mandatory step when registering a new examination type.

---

## Step-by-Step Task List

### Task 1 — Export SECTION_VISIBILITY from examinationTypes.ts

**Status: COMPLETE**

- [x] Open `frontend/src/constants/examinationTypes.ts`.
- [x] Add the `SECTION_VISIBILITY` constant (copy verbatim from `ExaminationForm.tsx` lines 29–37).
- [x] Add the `getSectionVisibility(type: string | undefined): Record<string, boolean>` helper function with fallback to `ultrasound_prenatal`.
- [x] Export both `SECTION_VISIBILITY` and `getSectionVisibility`.
- [x] Verify TypeScript compiles with no errors. (TypeScript verified as part of full build at end)

### Task 2 — Update ExaminationForm.tsx to import from shared location

**Status: COMPLETE**

- [x] Open `frontend/src/components/ExaminationForm.tsx`.
- [x] Remove the local `SECTION_VISIBILITY` constant (lines 29–37).
- [x] Add `getSectionVisibility` (or `SECTION_VISIBILITY`) to the import from `../constants/examinationTypes`.
- [x] Replace the visibility derivation line (`const visibility = SECTION_VISIBILITY[...] ?? ...`) with a call to `getSectionVisibility(formData.examinationType)`.
- [x] Verify TypeScript compiles with no errors. (Verified: frontend build passes with zero errors)

### Task 3 — Refactor ExaminationDetailPage.tsx — section tile guards

**Status: COMPLETE**

- [x] Open `frontend/src/pages/ExaminationDetailPage.tsx`.
- [x] Import `getSectionVisibility` from `../constants/examinationTypes`.
- [x] Add `const visibility = getSectionVisibility(examination.examinationType)` after the existing derived value computations.
- [x] Replace the Biometry tile's conditional: `{hasBiometry ? ... : ...}` → `{visibility.biometry && <Tile>...`.
- [x] Replace the Ultrasound Findings tile's conditional: `{hasUltrasoundFindings && ...}` → `{visibility.ultrasoundFindings && ...`.
- [x] Replace the Anatomy tile's conditional: `{hasAnatomy && ...}` → `{visibility.anatomy && ...`.
- [x] Replace the Doppler tile's conditional: `{(hasDoppler || hasVascular) && ...}` → `{visibility.doppler && ...`.
- [x] Remove the now-unused `hasBiometry`, `hasUltrasoundFindings`, `hasAnatomy`, `hasVascular`, `hasDoppler` computed booleans.
- [x] Verify TypeScript compiles with no errors.

### Task 3c — Split the Patient Information tile (merged tile fix)

**Status: COMPLETE**

- [x] In the Patient Information `<Tile>`, remove the six pregnancy-specific fields from the tile body.
- [x] Keep only Patient Name and Patient Age at Exam in the Patient Information tile.
- [x] Immediately after the closing `</Tile>` of the Patient Information tile, add a new `{visibility.pregnancyData && <Tile>}` block containing the six pregnancy fields.
- [x] Ensure the EDD display (with the accent blue colour `#0f62fe`) is preserved inside the new Pregnancy Data tile.
- [x] Verify TypeScript compiles with no errors.

### Task 4 — Refactor ExaminationDetailPage.tsx — remove per-field Biometry guards

**Status: COMPLETE**

- [x] Inside the Biometry tile body, remove the `{hasBiometry ? (...) : <div>No biometry...</div>}` branching.
- [x] For each of the fifteen biometry sub-fields, remove the surrounding `{examination.biometry!.fieldName !== undefined && (...)}` wrapper.
- [x] Render each field unconditionally, using a ternary to show the value or `—`.
- [x] Retain the `pctBadge` calls alongside BPD, HC, AC, FL, EFW.
- [x] Verify TypeScript compiles with no errors.

### Task 5 — Refactor pdfDocument.ts — type-driven section guards and pregnancy data

**Status: COMPLETE**

- [x] Open `frontend/src/components/reports/pdfDocument.ts`.
- [x] Add an import for `getSectionVisibility` from `../../constants/examinationTypes`.
- [x] At the start of `buildExaminationPDF(vm)`, after font registration, add: `const visibility = getSectionVisibility(vm.examinationType)`.
- [x] Wrap the GA from LMP, GA from Biometry, and EDD lines in the patient header block inside `if (visibility.pregnancyData) { ... }`.
- [x] After the patient header rule and before the existing Biometry section, add a new Pregnancy Data section block guarded by `if (visibility.pregnancyData)` with six `kvGrid` entries.
- [x] Replace `if (biometryPairs.some(([, v]) => v))` with `if (visibility.biometry)`.
- [x] Replace `if (dopplerPairs.some(([, v]) => v))` with `if (visibility.doppler)`.
- [x] Replace `if (ultrasoundPairs.some(([, v]) => v))` with `if (visibility.ultrasoundFindings)`.
- [x] Replace `if (anatomyPairs.some(([, v]) => v))` with `if (visibility.anatomy)`.
- [x] Verify TypeScript compiles with no errors.

### Task 6 — End-to-End Verification

**Status: COMPLETE** — All browser, PDF, and API checks passed.

- [x] Run `npm test` in the `api` directory to confirm no backend regressions. (105 passing, 8 pre-existing failures identical to baseline)
- [x] Verify TypeScript build: `cd frontend && npm run build` — zero errors.
- [x] Detail page for `ultrasound_prenatal` exam: Patient Information tile shows 2 fields (Patient Name, Patient Age at Exam). Pregnancy Data tile immediately follows with 6 fields. Verified in browser.
- [x] All 15 biometry sub-fields rendered unconditionally — values shown with percentile badges where present; absent fields show `—`. Verified in browser.
- [x] All section tiles (Biometry, Doppler, Ultrasound Findings, Anatomy) present and correctly guarded by `visibility.*`. Verified in browser.
- [x] PDF for populated exam: PREGNANCY DATA section present with 6 fields; patient header shows GA/EDD lines; all sections in single page. Verified visually.
- [x] PDF for minimally-populated exam: patient header correct (GA lines present, EDD shows `—` in blue); PREGNANCY DATA section present; fits 1 page. Verified visually.
- [x] EDD accent colour (`#0f62fe` blue underline) preserved in both Pregnancy Data tile and PDF header. Verified visually.

### Task 7 — Update AGENTS.md

**Status: COMPLETE**

- [x] Open `AGENTS.md`.
- [x] Add a rule under the existing architecture notes: when registering a new examination type in `examinationTypes.ts`, a corresponding `SECTION_VISIBILITY` entry is mandatory. Without it, the fallback to `ultrasound_prenatal` will silently apply.

### Task 8 — Verify and Remove Dead Extended Biometry Percentile Code

**Status: COMPLETE** — Zero call sites confirmed. All six function definitions deleted from `calculations.ts`. TypeScript build passes.

- [x] Search the entire `frontend/src` directory for each of the six function names — zero matches confirmed.
- [x] Confirmed that `ExaminationDetailPage.tsx`, `print.service.ts`, and `ExaminationForm.tsx` do not import any of the six functions.
- [x] Deleted the entire block (`calcExtendedPercentile`, `calcOFDPercentile`, `calcTCDPercentile`, `calcNuchalFoldPercentile`, `calcAPADPercentile`, `calcTADPercentile`) from `calculations.ts`.
- [x] Verified TypeScript compiles with no errors after deletion.

**Scope note**

This task does not affect any UI rendering, any stored data, or any API behaviour. Percentile values for OFD, TCD, Nuchal Fold, APAD, and TAD were never persisted to the database — they were always computed client-side only. Removing these functions has no observable effect on the running application.
