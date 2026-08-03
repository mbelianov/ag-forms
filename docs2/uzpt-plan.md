# Implementation Plan — UZPT Examination Types (Type 3 & 4)

> **Implementation Status:** ✅ ALL TASKS COMPLETED
> **Date completed:** All sub-tasks HF through 8 are fully implemented, tested (119/119 API tests pass), and TypeScript compiles with zero errors.
> **Frontend build:** `npx tsc --noEmit` in `frontend/` — zero errors.
> **API tests:** 119 passed, 0 failed.

---

## File-Size Mitigation Strategy

Four files are projected to grow into or past concern thresholds during this development round. This section records the agreed mitigation for each one, and adds the extractions as explicit sub-tasks that run **before** the UZPT content is added.

| File | Now | Projected after UZPT (no mitigation) | Mitigation | After mitigation |
|------|-----|--------------------------------------|------------|-----------------|
| `ExaminationForm.tsx` | 1,366 | ~1,720 | Extract `useExaminationForm` hook (state + validation + submission) | ~400 (page shell) + ~430 (hook) |
| `ExaminationDetailPage.tsx` | 707 | ~880 | Extract `ExaminationSections` component | ~280 (page shell) + ~450 (sections component) |
| `pdfDocument.ts` | 479 | ~610 | Split into `pdfDocument.ts` (orchestrator) + `pdfSections.ts` (section renderers) | ~180 + ~300 |
| `print.service.ts` | 375 | ~530 | Split `buildViewModel` into `buildPrenatalViewModel` + `buildFtViewModel` helpers in a new `viewModelBuilders.ts` | ~120 (service shell) + ~260 (builders) |

### Extraction rules applied to all mitigations

1. **No logic moves between files** — extractions are pure relocations of code that already exists.
2. **Extracted files live next to their consumer** — hooks in `hooks/`, components in `components/`, PDF helpers in `components/reports/`.
3. **Extractions happen as their own sub-tasks (Sub-Tasks 0a–0d), completed and reviewed before UZPT content is added.** This keeps each diff reviewable and prevents mixing extraction changes with feature additions.
4. **After each extraction the original file must compile and all existing tests must pass** before the next sub-task begins.

---

**Goal:** Add two new examination types to the system:
- **Type 3:** `ultrasound_first_trimester` — "Ultrasound Exam First Trimester" (single fetus)
- **Type 4:** `ultrasound_first_trimester_twins` — "Ultrasound Exam First Trimester for Twins"

These types mirror the UZPT paper form documented in `uzpt.docx`.

---

## Architectural Assessment: Refactor Now or Later?

`docs2/architecture-forward-note.md` proposes three refactor steps before implementing type 3:

| Refactor Step | What it does | Cost to do now |
|---|---|---|
| **A** — Move `biometry`/`doppler` into `data` blob | Eliminates promoted top-level fields; backends no longer list every field | Migration script for existing records required; risky mid-feature |
| **B** — Promote `SECTION_VISIBILITY` to `SECTION_CONFIG` | Declarative section registry with components + data keys; form/detail/PDF become config-driven loops | Requires Step A as precondition; medium complexity |
| **C** — Make form/detail/PDF config-driven | Deletes `isTwins` branch; adding a type costs one entry in `SECTION_CONFIG` | Requires Step B; large refactor of three large files |

### Verdict: Do a targeted partial refactor — only Step B on the frontend

After reading the actual code, here is the honest analysis:

**Steps A (backend data migration) is risky and NOT justified now.**
- `CreateExamination.ts` and `UpdateExamination.ts` already serialize `biometry`/`doppler` as JSON strings alongside the `data` blob. UZPT data **does not touch these top-level fields at all** — it lives entirely inside `data`. So the migration risk (moving existing production records) is not required to unblock this feature.
- The architecture note itself says: *"know type 3's section requirements first"*. We now know them. But the migration is still a separate operational concern.

**Step C (config-driven loops in form/detail/PDF) is not justified now.**
- `ExaminationForm.tsx` is already 1,310 lines. The UZPT types have a structurally different field set (CRL/NT/NB/Puls vs BPD/HC/AC/FL, plus 8 boolean markers with no equivalent in prenatal). A config-driven loop that genuinely handles both would need the section components to be polymorphic on their data shapes — that is Step B work which itself needs Step A. Doing it without Step A means running two code paths in parallel.
- The simplest correct implementation for UZPT is: add one `isFirstTrimester` branch, identical in structure to the existing `isTwins` branch.

**Step B (SECTION_CONFIG registry) is worth doing — but only the registry and type-helper part.**
- Right now `SECTION_VISIBILITY` is a flat `Record<string, Record<string, boolean>>` and type detection is a hardcoded string compare (`=== 'ultrasound_prenatal_twins'`). With four types this becomes unworkable.
- The targeted partial refactor: export `isFirstTrimester(type)` and `isFtTwins(type)` helpers from `examinationTypes.ts` and add `firstTrimester: true` to `SECTION_VISIBILITY`. This is zero risk and stops string literals spreading across six files.
- Full `SECTION_CONFIG` with component references (the architecture note's full vision) is deferred — it requires Section A and is disproportionate for adding two exam types.

### Summary decision

| Step | Decision | Reason |
|---|---|---|
| A — move biometry/doppler into data | ❌ Deferred | Needs production migration; UZPT data never uses those top-level fields anyway |
| B full — SECTION_CONFIG with component refs | ❌ Deferred | Requires Step A; disproportionate for two types |
| B partial — type-detection helpers + SECTION_VISIBILITY entries | ✅ Do it | Zero risk; prevents string-literal sprawl across six files |
| C — config-driven form/detail/PDF | ❌ Deferred | Requires A + B full; UZPT section shapes are not compatible with existing section components |

---

## New Data Keys (inside `ExaminationData`)

All first-trimester section data is stored **inside `exam.data`** (the existing JSON blob), not as top-level fields on `Examination`. This is already the pattern for `ultrasound_findings`, `anatomy`, and twin variants.

| Key | Content |
|-----|---------|
| `ft_biometry` | `FtBiometry` — CRL, NT, NB, Puls, GA from CRL |
| `ft_markers` | `FtMarkers` — 8 Yes/No flags + placenta text + cord insertion text |
| `ft_ultrasound` | `FtUltrasoundFindings` — Placenta, СЧП (heart rate), Cord |
| `ft_anatomy` | `AnatomyFindings` (reuses existing type, 11 fields) |
| `ft_doppler` | `FtDoppler` — A.ut.Dex PI/RI + A.ut.Sin PI/RI |
| `twin2_ft_biometry` | Same `FtBiometry` shape — T2 only |
| `twin2_ft_markers` | Same `FtMarkers` — T2 only |
| `twin2_ft_ultrasound` | Same `FtUltrasoundFindings` — T2 only |
| `twin2_ft_anatomy` | Same `AnatomyFindings` — T2 only |
| `twin2_ft_doppler` | Same `FtDoppler` — T2 only |

No new top-level fields are added to the `Examination` interface, `CreateExaminationRequest`, or `UpdateExaminationRequest`. No backend serialization sites need to change (`biometry2Str` / `doppler2Str` paths in `CreateExamination.ts` are not touched).

---

## Sub-Tasks

---

### Sub-Task HF — Hotfix: UZD section order, biometry layout, doppler rename

**Status:** [x] completed ✅ (all sub-items verified and tested — 119/119 API tests pass; biometry detail page 3-column layout fully implemented)

**Implementation notes:**
- HF-1: Section order reordered in `ExaminationForm.tsx`, `ExaminationDetailPage.tsx`, `pdfDocument.ts`
- HF-2: `BiometrySection.tsx` fully rewritten with 3-column layout + single "Biometry / EFW" button; single-fetus inline biometry block in `ExaminationForm.tsx` replaced with `<BiometrySection prefix="t1" .../>` call; dead state/handlers/imports removed. **`ExaminationSections.tsx` biometry blocks (single-fetus + twins T1 + twins T2) rewritten to matching 3-column table layout** (`gridTemplateColumns: '1fr 1fr 1fr'`, `alignItems: 'end'`, `gap: '0.75rem'`): col1=field value, col2=percentile (BPD/HC/AC/FL/EFW rows) or `<div/>`, col3=GA from Bio (BPD row only) or `<div/>`. Field order matches form exactly: BPD→OFD→HC→TAD→APAD→AC→FL→TCD→Vp→CM→NF→NB→EFW→LA→LC.
- HF-3: `DopplerSection.tsx` fully rewritten with vessel-table layout; `vessel` removed from entire stack (types, state, submit, detail page, PDF, validation, test fixtures); all 3 doppler display blocks in `ExaminationDetailPage.tsx` updated to new labels/order (A. ut. Dex. PI/RI → A. ut. Sin. PI/RI → A. Umb. PI/RI → CMA PI → PSV → CPR → Duc. Ven.)
- HF-4: Twins layout confirmed — `BiometrySection` and `DopplerSection` shared components propagate changes automatically; `ExaminationSections.tsx` twins T1 and T2 biometry blocks also rewritten to 3-column layout
- Test fixtures fixed: `vessel` removed from `testUtils.ts` and `examinations.test.ts`

**Applies to:** `ultrasound_prenatal` and `ultrasound_prenatal_twins` exam types only. Must ship to production before the UZPT types are added. All subsequent sub-tasks (0a–8) operate on the already-hotfixed files.

**Source:** `docs2/hotfix-changes-for-uzd.txt`

**No data migration required.** The hotfix renames UI labels and reorders DOM elements. No stored field keys change. Existing records that contain the old `vessel` field value will simply have that column ignored after the fix (the hotfix doc states existing records will be deleted).

---

#### HF-1: Section order in form and detail page

**Current order** (form JSX, lines 848–1315): Pregnancy Data → Ultrasound Findings → Anatomy → *(outside inner div)* Biometry → Doppler → Findings/Comments/Notes.

**Required order:** Pregnancy Data → Ultrasound Findings → Biometry → Anatomy → Doppler → Findings → Comments → Notes.

**Changes:**

In **`ExaminationForm.tsx`** JSX:
- The single-fetus section block (currently inside `<div>` at line 846) renders sections in this order: Pregnancy Data, Ultrasound Findings, Anatomy. Biometry and Doppler are rendered *after* that `</div>` closes (lines 1154–1316).
- Move the Biometry block (`visibility.biometry && !isTwins`, lines 1155–1287) and Doppler block (`visibility.doppler && !isTwins`, lines 1290–1316) **inside** the `<div>` at line 846, positioned between Ultrasound Findings and Anatomy.
- The resulting JSX order inside the section `<div>`: Pregnancy Data → Ultrasound Findings → Biometry → Anatomy → Doppler.
- In the `isTwins` twin grid block (lines 989–1152): reorder the four side-by-side sub-sections to: Ultrasound Findings → Biometry → Anatomy → Doppler.

In **`ExaminationDetailPage.tsx`** (`!isTwins` block, lines 339–442):
- Reorder the four `{visibility.X && (...)}` Tile blocks to: Ultrasound Findings → Biometry → Anatomy → Doppler.
- In the `isTwins` block (lines 444–615): reorder the four `renderTwinSection` / `visibility.X` calls to the same order.

In **`pdfDocument.ts`** (lines 346–412):
- Reorder `if (visibility.*)` calls in both the single-fetus path and the twin path to: Ultrasound Findings → Biometry → Anatomy → Doppler.

---

#### HF-2: Biometry section — new vertical 3-column layout with single AutoCalc button

**Current state:** `BiometrySection.tsx` renders a flat responsive grid of 4 core fields with stacked percentile sub-inputs, then two separate calc-button rows (AutoCalc GA, AutoCalc EFW), then a second grid of 8 extended fields + LA + LC.

**Required layout** (from hotfix doc — each row is one measurement):

```
Row:  [input field]   [percentile read-only]   [third column: GA Bio / button / EFW pct]
BPD   [input]         [pct]                    [GA from Bio  ← text input, editable]
OFD   [input]
HC    [input]         [pct]
TAD   [input]
APAD  [input]
AC    [input]         [pct]
FL    [input]         [pct]                    [Biometry/EFW button ← single AutoCalc]
TCD   [input]
Vp    [input]
CM    [input]
NF    [input]
NB    [input]
EFW   [input]         [pct]
LA    [input]
LC    [input]
```

**Behaviour of the new single "Biometry / EFW" button** (replaces both AutoCalcGA and AutoCalcEFW):
- Enabled when BPD, HC, AC, FL are all present (same `canCalcGA` guard as today).
- On click: runs **both** `calcGAFromBiometry` and `calcEFW` in one handler, writing `gestationalAgeFromBiometry` and `efw` simultaneously, and updating both `percentiles` and `efwPercentile` state.
- Label: `"Biometry / EFW"`.
- Tooltip enabled: `"Calculate GA from biometry and EFW (BPD, HC, AC, FL required)"`.
- Tooltip disabled: `"All four measurements (BPD, HC, AC, FL) required"`.
- Button sits in the third column of the FL row only.

**New grid structure in `BiometrySection.tsx`:**
- Replace the current three-block layout (core grid + GA row + EFW row + extended grid) with a **single `display: grid` with `gridTemplateColumns: '1fr 1fr 1fr'`**.
- Each measurement occupies one row across its columns. Rows that have no percentile or button leave the second/third cell empty (`<div />`).
- `gestationalAgeFromBiometry` text input sits in the third column of the BPD row (not a separate row below).
- Percentile display switches from a stacked `TextInput` to a lightweight inline `<span>` or read-only `TextInput` in the second column cell — same visual as today.
- The `columns` prop (currently `4 | 6`) is **removed** — the new layout is fixed 3-column and has no use for that prop. Callers in `ExaminationForm.tsx` that pass `columns={4}` must remove that prop.

**Detail page** (`ExaminationDetailPage.tsx` biometry Tile, lines 342–388):
- Reorder `fieldBlock` calls to match the new vertical order: BPD → OFD → HC → TAD → APAD → AC → FL → TCD → Vp → CM → NF → NB → EFW → LA → LC.
- GA from Biometry display stays at the top of the Biometry tile as it is today.

**PDF** (`pdfDocument.ts` `mkBiometryPairs`, line 323):
- Reorder pairs array to: GA Bio, BPD, OFD, HC, TAD, APAD, AC, FL, TCD, Vp, CM, Nuchal, NB, EFW, LA, LC.

---

#### HF-3: Doppler section — rename fields, remove `vessel`, reorder to 3-column vessel-table layout

**Renamed labels** (UI display and `labelText` only — stored field keys `pi`, `ri`, `cma` are unchanged):

| Old label | New label | Field key |
|-----------|-----------|-----------|
| PI | A.Umb. PI | `pi` (unchanged) |
| RI | A.Umb. RI | `ri` (unchanged) |
| A.ut. Dex PI | A. ut. Dex. PI | `utADexPI` (unchanged) |
| A.ut. Dex RI | A. ut. Dex. RI | `utADexRI` (unchanged) |
| A.ut. Sin PI | A. ut. Sin. PI | `utASinPI` (unchanged) |
| A.ut. Sin RI | A. ut. Sin. RI | `utASinRI` (unchanged) |
| CMA | CMA PI | `cma` (unchanged) |

**`vessel` field — removed entirely from UI and codebase.** Stored values in existing records are ignored. No migration needed.

**New layout in `DopplerSection.tsx`** — a vessel-table: `gridTemplateColumns: '8rem 1fr 1fr'` (vessel label | PI input | RI input), then single-field row below:

```
                    PI              RI
A. ut. Dex.     [utADexPI]      [utADexRI]
A. ut. Sin.     [utASinPI]      [utASinRI]
A. Umb.         [pi]            [ri]
CMA PI          [cma]
PSV             [psv]
CPR             [cpr]
Duc. Ven.       [ducVen]
```

Implementation: a `Stack` with two sub-grids:
- **Sub-grid A** — `gridTemplateColumns: '8rem 1fr 1fr'`, 9 cells (3 rows × 3 cols): row labels as `<div>` text, then the six PI/RI inputs.
- **Sub-grid B** — `gridTemplateColumns: '8rem 1fr'`, 8 cells (4 rows × 2 cols): row labels + single inputs for CMA PI, PSV, CPR, Duc.Ven.

The `columns` prop is **removed** from `DopplerSection` — the layout is now fixed. Callers that pass `columns={4}` must remove that prop.

**`DopplerSectionFormData`** — remove `vessel: string`. All other fields unchanged.

**Downstream `vessel` removal checklist** (every place that currently reads/writes `vessel`):
- `frontend/src/components/sections/DopplerSection.tsx` — remove `vessel` from interface + JSX
- `frontend/src/components/ExaminationForm.tsx` — remove `vessel` from `formData` initial state, `useEffect` edit-load, submit assembly (`doppler` object), T2 doppler assembly, validation is not affected (vessel had no numeric validation)
- `frontend/src/pages/ExaminationDetailPage.tsx` — remove `fieldBlock('Vessel', ...)` from doppler tile (single-fetus and twins paths)
- `frontend/src/services/print.service.ts` — remove `vessel?: string` from `DopplerViewModel`; remove vessel mapping in `buildViewModel`
- `frontend/src/components/reports/pdfDocument.ts` — remove `['Vessel', d.vessel]` from `mkDopplerPairs`; update `mkDopplerPairs` to new field order: A.ut.Dex PI/RI, A.ut.Sin PI/RI, A.Umb. PI/RI, CMA PI, PSV, CPR, Duc.Ven
- `frontend/src/types/index.ts` — remove `vessel?: string` from `Doppler` interface
- `api/src/types/index.ts` — same
- `api/src/utils/validation.ts` — remove `vessel` from `dopplerSchema`

**Relevant Context:**
- `frontend/src/components/sections/DopplerSection.tsx` — current interface and JSX, full file shown above
- `frontend/src/services/print.service.ts` lines 29–41 — `DopplerViewModel`
- `api/src/utils/validation.ts` lines 195–216 — `dopplerSchema`
- `frontend/src/types/index.ts` lines 76–89 — `Doppler` interface

---

#### HF-4: Twins layout — confirm half-page applies to all section changes

The existing `isTwins` two-column grid structure (half-page left = Twin 1, right = Twin 2) already handles the layout requirement. The hotfix section changes (HF-1 order, HF-2 biometry layout, HF-3 doppler layout) automatically propagate to the twins view because both paths call the **same** `BiometrySection` and `DopplerSection` components. No separate twins-specific changes are needed beyond the section-order reordering in HF-1.

Common sections that are full-page-width (Pregnancy Data, Findings, Comments, Notes) are already rendered outside the twin grid — no change needed.

---

### Sub-Task 0a — Extract `useExaminationForm` hook from `ExaminationForm.tsx`

**Status:** [x] completed

**Intent:** Reduce `ExaminationForm.tsx` from 1,366 lines to ~400 by moving all non-JSX logic — state initialisation, the `useEffect` edit-load block, derived values, calc handlers, `validateForm`, and `handleSubmit` — into a custom hook. The component file becomes a thin JSX shell that calls the hook and renders. This extraction is a pure relocation with zero behaviour change.

**Expected Outcomes:**
- New file `frontend/src/hooks/useExaminationForm.ts` exists and exports `useExaminationForm(props)`.
- `ExaminationForm.tsx` imports the hook, calls it, and uses its returned values in JSX. No logic remains in the component outside JSX.
- `ExaminationForm.tsx` shrinks to ~400 lines (imports + JSX only).
- `useExaminationForm.ts` is ~430 lines (all relocated logic).
- The app compiles, all existing form behaviour is identical, and no test regressions occur.

**What moves into the hook (exact regions from current `ExaminationForm.tsx`):**
- Lines 73–189: `useState` initialiser — the full `formData` object
- Lines 191–195: `errors`, `isSubmitting`, `submitError`, `percentiles`, `efwPercentile` state declarations
- Lines 197–306: `useEffect` edit-load block
- Lines 308–372: derived values (`isTwins`, `canCalcGAFromLMP`, `edd`, `biometryFloats`, `canCalcGAFromBiometry`, `canCalcEFW`) and calc handlers (`handleCalcGAFromLMP`, `handleCalcGAFromBiometry`, `handleCalcEFW`)
- Lines 374–495: `validateForm` function
- Lines 497–691: `handleSubmit` function
- Lines 693–710: `handleChange` and `handleChangeT1` helpers
- Lines 726–731: `visibility` and `patientAge` derived values

**Hook signature:**
```ts
export function useExaminationForm(props: ExaminationFormProps) {
  // ... all relocated logic ...
  return {
    formData, errors, isSubmitting, submitError, setSubmitError,
    percentiles, efwPercentile,
    isTwins,
    canCalcGAFromLMP, canCalcGAFromBiometry, canCalcEFW,
    edd, biometryFloats,
    handleCalcGAFromLMP, handleCalcGAFromBiometry, handleCalcEFW,
    handleChange, handleChangeT1, handleSubmit,
    visibility, patientAge,
  };
}
```

**What stays in `ExaminationForm.tsx`:**
- Imports
- `ExaminationFormProps` interface definition
- Date helper functions (`toDisplayDate`, `toISODate`, `todayDisplayDate`, `examDateToYMD`) — pure utility, only used in JSX date pickers
- Layout style constants (`row2`, `row3`, `row4`, `row6`, `calcButtonWrap`) — only used in JSX
- The component function `ExaminationForm` — calls `useExaminationForm`, destructures return, renders JSX

**Relevant Context:**
- `frontend/src/components/ExaminationForm.tsx` lines 73–731 — all logic to relocate
- Hook file location: `frontend/src/hooks/useExaminationForm.ts` (create `hooks/` directory if it does not exist)

---

### Sub-Task 0b — Extract `ExaminationSections` component from `ExaminationDetailPage.tsx`

**Status:** [x] completed

**Intent:** Reduce `ExaminationDetailPage.tsx` from 707 lines to ~280 by extracting the entire clinical-data rendering block (all the Tile sections between the Patient Information tile and the Clinical Information tile) into a dedicated `ExaminationSections` component. The page file keeps only page-level concerns: routing, data loading, delete logic, header, breadcrumb, action buttons, modal, and the fixed tiles (Patient Info, Clinical Info, Comments, Notes, Metadata).

**Expected Outcomes:**
- New file `frontend/src/components/ExaminationSections.tsx` exists.
- `ExaminationDetailPage.tsx` imports `ExaminationSections` and renders it as a single JSX element, passing `examination` and pre-computed `biometryPercentiles` / `efwPercentile` values as props.
- `ExaminationDetailPage.tsx` shrinks to ~280 lines.
- `ExaminationSections.tsx` is ~450 lines (all current clinical section content).
- No behaviour change. The `fieldBlock` and `pctBadge` helpers move into `ExaminationSections.tsx` since they are only used there.

**What moves into `ExaminationSections.tsx` (exact regions):**
- Lines 177–189: `fieldBlock` and `pctBadge` helper functions
- Lines 339–615: The entire `{!isTwins && (...)}` and `{isTwins && (...)}` clinical section blocks — Biometry, Doppler, Ultrasound Findings, Anatomy (single and twin paths)

**Props interface for `ExaminationSections`:**
```ts
interface ExaminationSectionsProps {
  examination: Examination;
  biometryPercentiles: BiometryPercentiles | undefined;
  efwPercentile: number | undefined;
  biometryPercentiles2: BiometryPercentiles | undefined;  // twins T2
  efwPercentile2: number | undefined;                     // twins T2
}
```

**What stays in `ExaminationDetailPage.tsx`:**
- All imports
- State declarations and all handlers (`handleEdit`, `handleDeleteClick`, `handleDeleteConfirm`, `handleBackToExaminations`, `handleBackToPatient`)
- Loading/error guards (lines 113–134)
- Derived values (`examTypeLabel`, `lmp`, `edd`, `gaForPercentiles`, `biometryPercentiles`, `efwPercentile`, `isTwins`, `biometryPercentiles2`, `efwPercentile2`, `visibility`)
- The full JSX tree — but with `{!isTwins && (...)}` and `{isTwins && (...)}` replaced by `<ExaminationSections examination={examination} ... />`
- Patient Information tile, Pregnancy Data tile, Clinical Information tile, Comments tile, Notes tile, Metadata tile, action bar, delete modal

**Relevant Context:**
- `frontend/src/pages/ExaminationDetailPage.tsx` lines 177–615 — all content to extract
- `frontend/src/components/ExaminationSections.tsx` — new file, lives alongside other components

---

### Sub-Task 0c — Split `pdfDocument.ts` into orchestrator + section renderers

**Status:** [x] completed

**Intent:** Reduce `pdfDocument.ts` from 479 lines to ~180 by extracting the section pair-builder helpers (`mkBiometryPairs`, `mkDopplerPairs`, `mkUltraPairs`, `mkAnatomyPairs`) and the per-fetus rendering blocks (single-fetus and twin paths, lines 346–412) into a co-located `pdfSections.ts` file. `pdfDocument.ts` becomes a thin orchestrator: header, patient block, pregnancy data, clinical info, signature, footer, and a single call to a `renderClinicalSections` function imported from `pdfSections.ts`.

**Expected Outcomes:**
- New file `frontend/src/components/reports/pdfSections.ts` exists and exports `renderClinicalSections(doc, vm, y, helpers): number`.
- `pdfDocument.ts` imports `renderClinicalSections` and calls it in place of the current `if (!isTwins) { ... } else { ... }` block.
- `pdfDocument.ts` shrinks to ~180 lines.
- `pdfSections.ts` is ~300 lines (pair builders + single-fetus path + twins path).
- Shared drawing primitives (`sectionHeading`, `sectionHeadingAt`, `kvGrid`, `kvGridAt`, `textBlock`, `rule`, colour constants, layout constants) remain in `pdfDocument.ts` and are imported by `pdfSections.ts` — they cannot be duplicated.

**What moves into `pdfSections.ts` (exact regions):**
- Lines 322–344: `mkBiometryPairs`, `mkDopplerPairs`, `mkUltraPairs`, `mkAnatomyPairs` helper functions
- Lines 346–412: The `if (!isTwins) { ... } else { ... }` block including `renderTwinSection` inner function

**Exported function signature:**
```ts
// pdfSections.ts
export function renderClinicalSections(
  doc: jsPDF,
  vm: ExamPdfViewModel,
  y: number,
  helpers: PdfDrawHelpers,   // sectionHeading, kvGrid, renderTwinSection, etc.
): number                    // returns updated Y position
```

**`PdfDrawHelpers` interface** (defined in `pdfDocument.ts`, passed in to avoid circular imports):
```ts
export interface PdfDrawHelpers {
  rule: (doc: jsPDF, y: number) => void;
  sectionHeading: (doc: jsPDF, label: string, y: number) => number;
  sectionHeadingAt: (doc: jsPDF, label: string, y: number, xStart: number, xEnd: number) => number;
  kvGrid: (doc: jsPDF, pairs: Array<[string, string | undefined]>, y: number, cols?: number) => number;
  kvGridAt: (doc: jsPDF, pairs: Array<[string, string | undefined]>, y: number, cols: number, xStart: number, colW: number, fontSize?: number) => number;
  TWIN_COL_W: number;
  TWIN_GUTTER: number;
  T1_X: number;
  T2_X: number;
  FONT_ID: string;
}
```

**Relevant Context:**
- `frontend/src/components/reports/pdfDocument.ts` lines 321–412 — content to extract
- `frontend/src/components/reports/pdfSections.ts` — new file, co-located with `pdfDocument.ts`

---

### Sub-Task 0d — Extract view model builders from `print.service.ts`

**Status:** [x] completed

**Intent:** Reduce `print.service.ts` from 375 lines to ~120 by extracting the `buildViewModel` function body — specifically the T2 block assembly (lines 166–240) and all the T1 field mappings (lines 242–334) — into a co-located `viewModelBuilders.ts` file. `print.service.ts` becomes a thin service shell that imports `buildViewModel` and re-exports the PDF printing functions.

**Expected Outcomes:**
- New file `frontend/src/services/viewModelBuilders.ts` exists and exports `buildViewModel(exam: Examination): ExamPdfViewModel`.
- `print.service.ts` imports `buildViewModel` from `viewModelBuilders.ts` and the rest of the service is unchanged.
- `print.service.ts` shrinks to ~120 lines (interfaces + service functions).
- `viewModelBuilders.ts` is ~260 lines (the full `buildViewModel` implementation).
- All view model interfaces (`BiometryViewModel`, `DopplerViewModel`, `UltrasoundViewModel`, `AnatomyViewModel`, `ExamPdfViewModel`) remain in `print.service.ts` as they are the public API consumed by `pdfDocument.ts`.

**What moves into `viewModelBuilders.ts` (exact regions):**
- Lines 149–335: The entire `buildViewModel` function implementation

**What stays in `print.service.ts`:**
- Lines 1–6: Imports
- Lines 11–123: All view model interface definitions (`BiometryViewModel`, `DopplerViewModel`, `UltrasoundViewModel`, `AnatomyViewModel`, `ExamPdfViewModel`)
- Lines 125–147: Helper functions `fmtDate`, `ordinal`, `withPct` — used only by `buildViewModel`, so these move too
- Lines 337–375: The `printExamination` and `emailExamination` service functions

Note: `fmtDate`, `ordinal`, `withPct` helpers (lines 125–147) should move with `buildViewModel` into `viewModelBuilders.ts` since they are only used there.

**Relevant Context:**
- `frontend/src/services/print.service.ts` lines 125–335 — all content to extract
- `frontend/src/services/viewModelBuilders.ts` — new file, co-located with `print.service.ts`

---

### Sub-Task 1 — Type Registry + Detection Helpers

**Status:** [x] completed

**Intent:** Register both new type keys and export helpers that consolidate type-detection so no other file ever compares a raw string against `'ultrasound_first_trimester'`.

**Expected Outcomes:**
- `EXAM_TYPES` in both frontend and API registries has two new entries.
- `SECTION_VISIBILITY` has entries for `ultrasound_first_trimester` and `ultrasound_first_trimester_twins` with a `firstTrimester: true` key.
- `isFirstTrimester(type)` and `isFtTwins(type)` helpers are exported from `frontend/src/constants/examinationTypes.ts`.
- API validation automatically accepts the new keys (it derives the allowlist from `EXAM_TYPE_KEYS` at line 321 of `api/src/utils/validation.ts` — zero change needed there).

**Todo:**
1. In `frontend/src/constants/examinationTypes.ts`:
   - Append `{ key: 'ultrasound_first_trimester', label: 'Ultrasound Exam First Trimester' }` to `EXAM_TYPES`.
   - Append `{ key: 'ultrasound_first_trimester_twins', label: 'Ultrasound Exam First Trimester for Twins' }` to `EXAM_TYPES`.
   - Add entries to `SECTION_VISIBILITY`:
     ```ts
     ultrasound_first_trimester: {
       pregnancyData:      true,
       ultrasoundFindings: false,  // replaced by ft_ultrasound inside FirstTrimesterSection
       anatomy:            false,  // rendered inside FirstTrimesterSection
       biometry:           false,  // replaced by ft_biometry inside FirstTrimesterSection
       doppler:            false,  // replaced by ft_doppler inside FirstTrimesterSection
       firstTrimester:     true,   // new key — triggers FT rendering path
     },
     ultrasound_first_trimester_twins: {
       pregnancyData:      true,
       ultrasoundFindings: false,
       anatomy:            false,
       biometry:           false,
       doppler:            false,
       firstTrimester:     true,
     },
     ```
   - Export two helpers:
     ```ts
     export function isFirstTrimester(type: string | undefined): boolean {
       return (type ?? '').startsWith('ultrasound_first_trimester');
     }
     export function isFtTwins(type: string | undefined): boolean {
       return type === 'ultrasound_first_trimester_twins';
     }
     ```
2. In `api/src/constants/examinationTypes.ts`:
   - Append the same two entries to `EXAM_TYPES` (API file mirrors the frontend).

**Relevant Context:**
- `frontend/src/constants/examinationTypes.ts` — full file, lines 1–43
- `api/src/constants/examinationTypes.ts` — mirror file
- `api/src/utils/validation.ts` line 321 — picks up new keys automatically, no change needed

---

### Sub-Task 2 — Type Definitions (Frontend & API)

**Status:** [x] completed ✅

**Intent:** Add the four new first-trimester data interfaces and extend `ExaminationData` with the ten new optional `ft_*` / `twin2_ft_*` keys. No changes to the top-level `Examination` interface.

**Expected Outcomes:**
- `frontend/src/types/index.ts` defines `FtBiometry`, `FtMarkers`, `FtUltrasoundFindings`, `FtDoppler`.
- `ExaminationData` has ten new optional keys (five `ft_*` and five `twin2_ft_*`).
- `api/src/types/index.ts` carries identical interface definitions.
- `Examination`, `CreateExaminationRequest`, `UpdateExaminationRequest` are **unchanged**.

**Todo:**
1. In `frontend/src/types/index.ts` — add after the `AnatomyFindings` interface (before `ExaminationData`):
   ```ts
   // UZPT — First Trimester examination interfaces
   export interface FtBiometry {
     crl?: number;        // Crown-Rump Length, mm
     gaFromCrl?: string;  // "Xw Yd" — GA calculated from CRL
     nt?: number;         // Nuchal Translucency, mm
     nb?: number;         // Nasal Bone, mm
     puls?: number;       // Fetal heart rate (Puls), bpm
   }

   export interface FtMarkers {
     arrhythmia?: string;              // "yes" | "no" | ""
     tricuspidRegurgitation?: string;
     abnormalDvFlow?: string;
     echogenicCardiacFocus?: string;
     singleUmbilicalArtery?: string;
     choroidPlexusCysts?: string;
     exomphalos?: string;
     megacystis?: string;
     placenta?: string;                // free-text placenta description
     cordInsertion?: string;           // free-text cord insertion
   }

   export interface FtUltrasoundFindings {
     placenta?: string;
     heartRate?: number;    // СЧП, bpm
     umbilicalCord?: string;
   }

   export interface FtDoppler {
     utADexPI?: number;
     utADexRI?: number;
     utASinPI?: number;
     utASinRI?: number;
   }
   ```
2. In `ExaminationData` — add after `twin2_anatomy`:
   ```ts
   ft_biometry?: FtBiometry;
   ft_markers?: FtMarkers;
   ft_ultrasound?: FtUltrasoundFindings;
   ft_anatomy?: AnatomyFindings;      // reuses existing type
   ft_doppler?: FtDoppler;
   twin2_ft_biometry?: FtBiometry;
   twin2_ft_markers?: FtMarkers;
   twin2_ft_ultrasound?: FtUltrasoundFindings;
   twin2_ft_anatomy?: AnatomyFindings;
   twin2_ft_doppler?: FtDoppler;
   ```
3. Mirror all additions in `api/src/types/index.ts`.

**Relevant Context:**
- `frontend/src/types/index.ts` lines 106–128 — `AnatomyFindings` and `ExaminationData`
- `api/src/types/index.ts` — mirror

---

### Sub-Task 3 — `calcGAFromCRL` Utility

**Status:** [x] completed ✅

**Intent:** Add a CRL → gestational age calculation helper following the same documentation and code pattern as `calcGAFromBiometry`, including full academic source citation in the JSDoc.

**Expected Outcomes:**
- `calcGAFromCRL(crl: number | undefined): string | undefined` exported from `frontend/src/utils/calculations.ts`.
- Returns `"Xw Yd"` format via the existing `formatGestationalAge()` helper — no duplicate floor/mod logic.
- Returns `undefined` if CRL is `undefined`, `0`, or negative.
- JSDoc cites the source paper, states the equation, explains units.

**Formula source — Robinson (1975):**

> Robinson HP. "Sonar measurement of fetal crown-rump length as means of assessing maturity in first trimester of pregnancy."
> *Br Med J.* 1975 Oct 4; 4(5986): 28–31. PMID 1182090.
> DOI: 10.1136/bmj.4.5986.28

The published equation (equation 1 in the paper) gives gestational age in **days** from CRL in **mm**:

```
GA_days = 8.052 × √( CRL_mm × 1.037 ) + 23.73
```

CRL range of validity per the paper: 10–65 mm (approximately 7+0 to 13+6 weeks).
Result is rounded to the nearest whole day before formatting.

**Todo:**
1. In `frontend/src/utils/calculations.ts`, add after `calcGAFromBiometry` (line 88), before `calcEFW`:
   ```ts
   /**
    * Calculate Gestational Age from Crown-Rump Length (CRL).
    *
    * Formula:
    *   GA_days = 8.052 × √( CRL_mm × 1.037 ) + 23.73
    *
    * Source:
    *   Robinson HP. "Sonar measurement of fetal crown-rump length as means of
    *   assessing maturity in first trimester of pregnancy."
    *   Br Med J. 1975 Oct 4;4(5986):28–31. PMID 1182090.
    *   DOI: 10.1136/bmj.4.5986.28
    *
    * Valid CRL range: 10–65 mm (approx. 7+0 to 13+6 weeks).
    * Input must be in mm. Result is rounded to the nearest whole day.
    *
    * @param crl - Crown-Rump Length in mm
    * @returns Gestational age string in "Xw Yd" format, or undefined if input is absent or ≤ 0
    */
   export function calcGAFromCRL(crl: number | undefined): string | undefined {
     if (!crl || crl <= 0) return undefined;
     const totalDays = 8.052 * Math.sqrt(crl * 1.037) + 23.73;
     // Convert total days to fractional weeks for formatGestationalAge
     return formatGestationalAge(totalDays / 7);
   }
   ```
   Note: `formatGestationalAge(totalWeeks)` (line 12 of `calculations.ts`) already handles the
   floor/mod and the rounding-to-7-days edge case — do not duplicate that logic inline.

**Relevant Context:**
- `frontend/src/utils/calculations.ts` lines 12–20 — `formatGestationalAge` helper to reuse
- `frontend/src/utils/calculations.ts` lines 77–88 — `calcGAFromBiometry` JSDoc pattern to mirror

---

### Sub-Task 4 — New Section Component: `FirstTrimesterSection`

**Status:** [x] completed ✅

**Intent:** Create a single reusable section component encapsulating all UZPT-specific clinical sub-sections. It must accept `prefix` so it can be rendered twice (T1 / T2) with unique DOM ids, matching the pattern of `BiometrySection`, `DopplerSection`, etc.

**Expected Outcomes:**
- New file `frontend/src/components/sections/FirstTrimesterSection.tsx` exists.
- Exports `FirstTrimesterSectionFormData` interface.
- Renders five ordered sub-sections matching the paper form: FT Ultrasound → FT Biometry → Markers → Anatomy → FT Doppler.
- Anatomy sub-section renders `<AnatomySection>` directly (no duplication).
- AutoCalc GA from CRL button is present in the FT Biometry sub-section, wired to `calcGAFromCRL`, with a disabled state and tooltip exactly matching the `BiometrySection` AutoCalc GA pattern.
- Yes/No marker fields use Carbon `Select` with options `""` / `"yes"` / `"no"`.

**FormData interface (all string fields, prefixed by the component's `p()` helper):**
```ts
export interface FirstTrimesterSectionFormData {
  // FT Ultrasound sub-section
  ft_placenta: string;
  ft_heartRate: string;
  ft_umbilicalCord: string;
  // FT Biometry sub-section
  ft_crl: string;
  ft_gaFromCrl: string;
  ft_nt: string;
  ft_nb: string;
  ft_puls: string;
  // Markers
  ft_arrhythmia: string;
  ft_tricuspidRegurgitation: string;
  ft_abnormalDvFlow: string;
  ft_echogenicCardiacFocus: string;
  ft_singleUmbilicalArtery: string;
  ft_choroidPlexusCysts: string;
  ft_exomphalos: string;
  ft_megacystis: string;
  ft_markerPlacenta: string;
  ft_cordInsertion: string;
  // Anatomy (delegated to AnatomySection — anat_* keys)
  anat_head: string; anat_brain: string; anat_face: string;
  anat_neckSkin: string; anat_spine: string; anat_thorax: string;
  anat_heart: string; anat_abdomen: string; anat_kidneys: string;
  anat_limbs: string; anat_skeleton: string;
  // FT Doppler sub-section
  ft_utADexPI: string;
  ft_utADexRI: string;
  ft_utASinPI: string;
  ft_utASinRI: string;
}
```

**Sub-section layout:**
- **FT Ultrasound:** `gridTemplateColumns: 'repeat(3, 1fr)'` — Placenta (TextInput), Heart Rate СЧП (TextInput, bpm), Cord (TextInput)
- **FT Biometry:** vertical table — one field per row — see full specification below
- **Markers:** vertical list — one field per row — see full specification below
- **Anatomy:** delegates to `<AnatomySection prefix={prefix} columns={6} />`
- **FT Doppler:** vessel-table layout matching HF-3 — `gridTemplateColumns: '8rem 1fr 1fr'`, 2 rows (label | PI | RI):
  ```
                  PI              RI
  A. ut. Dex.   [utADexPI]      [utADexRI]
  A. ut. Sin.   [utASinPI]      [utASinRI]
  ```
  Uses the same `Stack + sub-grid` structure as the redesigned `DopplerSection` from HF-3, but contains only the 4 uterine artery fields — no A.Umb, CMA, PSV, CPR, DucVen (those are prenatal-only). This keeps UZPT doppler visually consistent with the prenatal doppler vessel-table pattern.

---

**FT Biometry sub-section — vertical 3-column table, one field per row:**

Mirrors the HF-2 biometry table structure. Single grid: `gridTemplateColumns: '1fr 1fr 9rem'` (input | secondary | button/empty). Each measurement is one row. The AutoCalc button sits on the CRL row — CRL is the single input that drives the calculation, so the button is inline with it.

```
gridTemplateColumns: '1fr 1fr 9rem'

Row 1  [CRL (mm) TextInput]      [GA from CRL TextInput]   [AutoCalc btn]
Row 2  [NT (mm) TextInput]       [ ]                        [ ]
Row 3  [NB (mm) TextInput]       [ ]                        [ ]
Row 4  [Puls (уд/мин) TextInput] [ ]                        [ ]
```

- **CRL row, col 2:** `<TextInput id={p('ft_gaFromCrl')} labelText="GA from CRL" placeholder="e.g., 12w 3d" .../>` — editable.
- **CRL row, col 3:** `calcButtonWrap` div containing `<Button kind="tertiary" size="md">AutoCalc GA from CRL</Button>`.
- **All other rows, cols 2–3:** `<div />` spacers (CSS grid requires cells to be present).
- Empty cells use `<div />` — identical to HF-2 biometry table pattern.

**Button enable/disable logic (exact mirror of `BiometrySection` pattern):**
```ts
// Inside the component — derived before return
const crlFloat = data[p('ft_crl')] ? parseFloat(data[p('ft_crl')]) : undefined;
// Robinson formula valid range: 10–65 mm (approx. 7+0 to 13+6 weeks)
const canCalcGA = !!(crlFloat && crlFloat >= 10 && crlFloat <= 65);

const handleCalcGA = () => {
  const result = calcGAFromCRL(crlFloat);
  if (result) onChange(p('ft_gaFromCrl'), result);
};
```

**Button disabled title tooltip (match `BiometrySection` wording style):**
- Enabled: `"Calculate GA from CRL (Robinson 1975, valid range 10–65 mm)"`
- Disabled: `"Enter CRL in the valid range 10–65 mm to enable calculation"`

**Comment to include in the component source (reference the formula source):**
```ts
// AutoCalc GA uses calcGAFromCRL — Robinson (1975), Br Med J 4(5986):28–31,
// DOI 10.1136/bmj.4.5986.28. Valid CRL range: 10–65 mm (7+0 to 13+6 weeks).
// calcGAFromCRL is defined in frontend/src/utils/calculations.ts.
```

---

**Markers sub-section — vertical 2-column list, one field per row:**

10 marker fields rendered as a vertical list. Each row is one field: a plain text label on the left, the input on the right.

Grid: `gridTemplateColumns: 'auto 1fr'` — label column sized to content, input column takes remaining space.

```
gridTemplateColumns: 'auto 1fr'     gap: '0.5rem 1rem'

Row 1   Аритмия                          [Select: —/Да/Не]
Row 2   Трикуспидална регуритация        [Select: —/Да/Не]
Row 3   Абнормен кръвоток D.Venosus      [Select: —/Да/Не]
Row 4   Ехогенен сърдечен фикус          [Select: —/Да/Не]
Row 5   Една пъпна артерия               [Select: —/Да/Не]
Row 6   Кисти на PL Chorioideus          [Select: —/Да/Не]
Row 7   Exomphalos                        [Select: —/Да/Не]
Row 8   Мегацистис                       [Select: —/Да/Не]
Row 9   Плацента                         [TextInput]
Row 10  Пъпна връв инсерция              [TextInput]
```

- Row labels are `<div>` elements styled as `labelText`-equivalent (`fontSize: '0.875rem', color: '#525252'`) — not Carbon `FormLabel` (no associated input id needed since the adjacent cell holds the input).
- Yes/No fields: Carbon `Select` with `<SelectItem value="" text="—" />`, `<SelectItem value="yes" text="Да" />`, `<SelectItem value="no" text="Не" />`. Labels match the paper form Bulgarian text.
- Text fields (Placenta, Cord insertion): Carbon `TextInput`.
- The `labelText` prop on each `Select`/`TextInput` is set to `""` (empty) to avoid double labelling — the row label `<div>` provides the visible label.
- In the **twins layout** (half-page column), `auto 1fr` still works — the label column shrinks to content width and the input takes whatever remains.

**Relevant Context:**
- `frontend/src/components/sections/AnatomySection.tsx` — to be rendered inside
- `frontend/src/components/sections/BiometrySection.tsx` — AutoCalc button and `calcButtonWrap` pattern
- `frontend/src/utils/calculations.ts` — `calcGAFromCRL` added in Sub-Task 3

---

### Sub-Task 5 — ExaminationForm Integration

**Status:** [x] completed ✅

**Intent:** Add the `isFirstTrimester` / `isFtTwins` branch to `ExaminationForm.tsx` so that selecting either new type renders `FirstTrimesterSection` instead of the prenatal section stack.

**Expected Outcomes:**
- When exam type is `ultrasound_first_trimester`: a single `<FirstTrimesterSection prefix="t1" .../>` renders below Pregnancy Data. Prenatal biometry/doppler/anatomy/ultrasound blocks are hidden.
- When exam type is `ultrasound_first_trimester_twins`: two `<FirstTrimesterSection>` columns render side-by-side (prefix `t1` / `t2`), identical in structure to the existing `isTwins` two-column layout.
- Form initial state and `useEffect` edit-load both include all `ft_*` fields, reading from `exam.data.ft_*` and `exam.data.twin2_ft_*`.
- Submission serialises FT data entirely into the `data` key — no `biometry`/`doppler`/`gestationalAgeFromBiometry` emitted for FT types.
- Client-side validation covers FT numeric fields (CRL/NT/NB/Puls ≥ 0, GA from CRL format, FT doppler PI/RI ≥ 0).

**Todo:**
1. Import `isFirstTrimester`, `isFtTwins` from `examinationTypes.ts` and `FirstTrimesterSection` from `./sections/FirstTrimesterSection`.
2. Add `const isFt = isFirstTrimester(formData.examinationType)` and `const isFtTwinsMode = isFtTwins(formData.examinationType)` after the existing `isTwins` derivation on line 310.
3. Extend `useState` initial state block (lines 73–189) with all FT fields initialised from `exam.data.ft_*`:
   - `ft_placenta`, `ft_heartRate`, `ft_umbilicalCord`
   - `ft_crl`, `ft_gaFromCrl`, `ft_nt`, `ft_nb`, `ft_puls`
   - `ft_arrhythmia`, `ft_tricuspidRegurgitation`, `ft_abnormalDvFlow`, `ft_echogenicCardiacFocus`, `ft_singleUmbilicalArtery`, `ft_choroidPlexusCysts`, `ft_exomphalos`, `ft_megacystis`, `ft_markerPlacenta`, `ft_cordInsertion`
   - `ft_utADexPI`, `ft_utADexRI`, `ft_utASinPI`, `ft_utASinRI`
   - `t2_ft_*` variants for all of the above (used when `isFtTwins`)
4. Mirror all fields in the `useEffect` edit-load block (lines 197–306).
5. In `validateForm` — add an `if (isFt)` block that validates:
   - CRL, NT, NB: positive float if provided
   - Puls, FT heart rate: positive integer if provided
   - `ft_gaFromCrl`: matches `gaRegex` if provided
   - FT doppler PI: `>= 0` if provided
6. In `handleSubmit` — add an `if (isFt)` branch in place of the biometry/doppler/gestationalAgeFromBiometry assembly:
   - Build `ft_biometry`, `ft_markers`, `ft_ultrasound`, `ft_anatomy`, `ft_doppler` objects from `formData.ft_*`.
   - Build `twin2_ft_*` objects if `isFtTwinsMode`.
   - Spread into `data: { ...(existing), ft_biometry, ft_markers, ft_ultrasound, ft_anatomy, ft_doppler, ...(twin variants if isFtTwinsMode) }`.
   - Do NOT include `biometry`, `doppler`, or `gestationalAgeFromBiometry` in `submitData`.
7. In the JSX render — add FT rendering blocks after the existing `isTwins` block (around line 1152):
   - `isFt && !isFtTwinsMode`: render `<FirstTrimesterSection prefix="t1" data={...} .../>`
   - `isFtTwinsMode`: render the same two-column twin grid using `handleChangeT1` for T1 and `handleChange` for T2, matching exactly the `isTwins` column structure at lines 989–1152.
8. Guard all existing section render conditions with `&& !isFt` so they are hidden when a FT type is selected. Specifically: `ultrasoundFindings && !isTwins && !isFt`, `anatomy && !isTwins && !isFt`, `biometry && !isTwins && !isFt`, `doppler && !isTwins && !isFt`.

**Relevant Context:**
- `frontend/src/components/ExaminationForm.tsx` lines 310, 454–491, 498–691, 933–1152
- `frontend/src/components/sections/FirstTrimesterSection.tsx` (from Sub-Task 4)

---

### Sub-Task 6 — ExaminationDetailPage Integration

**Status:** [x] completed ✅

**Intent:** Render UZPT data in the read-only detail page. This follows the same conditional pattern as the existing `isTwins` blocks.

**Expected Outcomes:**
- When `isFirstTrimester(exam.examinationType)` is true, the detail page renders FT sub-sections (FT Ultrasound, FT Biometry, Markers, Anatomy, FT Doppler) from `exam.data.ft_*`.
- When `isFtTwins(exam.examinationType)` is true, renders T1 and T2 blocks in a two-column layout from `exam.data.ft_*` and `exam.data.twin2_ft_*`.
- Standard prenatal biometry/doppler/ultrasound/anatomy sections are hidden for FT types.

**Todo:**
1. Import `isFirstTrimester`, `isFtTwins`, and the new FT types in `ExaminationDetailPage.tsx`.
2. Derive `const isFt = isFirstTrimester(examination.examinationType)` and `const isFtTwins = isFtTwins(examination.examinationType)` alongside the existing `isTwins` derivation.
3. Add a conditional FT section block after the existing `isTwins` detail block. The block must render each FT sub-section as a heading + `kvGrid`-style definition list (following the existing pattern for Biometry, Anatomy, etc. in the page):
   - **FT Ultrasound** — Placenta, Heart Rate, Cord
   - **FT Biometry** — CRL, GA from CRL, NT, NB, Puls
   - **Markers** — all 10 fields (8 Yes/No + 2 text)
   - **Anatomy** — 11 fields (same labels as `AnatomySection`)
   - **FT Doppler** — 4 uterine artery fields
4. For `isFtTwins`: render the T1 column from `exam.data.ft_*` and T2 column from `exam.data.twin2_ft_*` using the same two-column `display: grid` layout as the prenatal twins detail.
5. Guard all existing prenatal sections with `&& !isFt`.

**Relevant Context:**
- `frontend/src/pages/ExaminationDetailPage.tsx` — existing `isTwins` detail pattern
- New FT types from Sub-Task 2

---

### Sub-Task 7 — PDF Generation

**Status:** [x] completed ✅

**Intent:** Add a first-trimester PDF layout to `pdfDocument.ts` and extend `print.service.ts` to build an FT view model from `exam.data.ft_*`.

**Expected Outcomes:**
- Calling `buildExaminationPDF(vm)` with an FT exam type produces a correctly structured PDF.
- Single-fetus FT PDF: header title "УЛТРАЗВУК ПЪРВИ ТРИМЕСТЪР", sections in paper-form order — Pregnancy Data → FT Ultrasound (УЗД) → FT Biometry (БИОМЕТРИЯ) → Markers → Anatomy → FT Doppler → Comments → Signature.
- Twins FT PDF: two-column layout for each FT section using the existing `renderTwinSection` helper. Header says "УЛТРАЗВУК ПЪРВИ ТРИМЕСТЪР (БЛИЗНАЦИ)".
- Standard prenatal biometry/doppler/ultrasound sections are not rendered.

**Todo:**
1. In `frontend/src/services/print.service.ts`:
   - Add four new view model interfaces: `FtBiometryViewModel`, `FtMarkersViewModel`, `FtUltrasoundViewModel`, `FtDopplerViewModel`.
   - Add these as optional properties to `ExamPdfViewModel`:
     ```ts
     ftBiometry?: FtBiometryViewModel;
     ftMarkers?: FtMarkersViewModel;
     ftUltrasound?: FtUltrasoundViewModel;
     ftAnatomy?: AnatomyViewModel;      // reuses existing type
     ftDoppler?: FtDopplerViewModel;
     twin2FtBiometry?: FtBiometryViewModel;
     twin2FtMarkers?: FtMarkersViewModel;
     twin2FtUltrasound?: FtUltrasoundViewModel;
     twin2FtAnatomy?: AnatomyViewModel;
     twin2FtDoppler?: FtDopplerViewModel;
     ```
   - In `buildViewModel`, add `const isFt = isFirstTrimester(exam.examinationType)` detection and populate the FT view model blocks from `exam.data.ft_*`. For twins FT, also populate the `twin2Ft*` blocks from `exam.data.twin2_ft_*`.
2. In `frontend/src/components/reports/pdfDocument.ts`:
   - After the existing `isTwins` block, add `const isFt = isFirstTrimester(vm.examinationType)`.
   - Add helper functions mirroring the existing `mkBiometryPairs` pattern:
     - `mkFtBiometryPairs(b)` — CRL, GA from CRL, NT, NB, Puls
     - `mkFtMarkerPairs(m)` — 10 marker fields formatted as "Yes" / "No" / "—"
     - `mkFtUltrasoundPairs(u)` — Placenta, Heart Rate, Cord
     - `mkFtDopplerPairs(d)` — 4 uterine artery fields
   - In the header block, conditionally use "УЛТРАЗВУК ПЪРВИ ТРИМЕСТЪР" or "УЛТРАЗВУК ПЪРВИ ТРИМЕСТЪР (БЛИЗНАЦИ)" instead of "Prenatal Ultrasound Report" when `isFt`.
   - Replace the `if (!isTwins) { ... } else { ... }` block with a three-way branch:
     - `if (isFt && !isFtTwins)` — single-fetus FT layout using `kvGrid` for each section
     - `else if (isFt && isFtTwins)` — two-column FT layout using `renderTwinSection` with FT pairs
     - `else if (!isTwins)` — existing single-fetus prenatal layout (unchanged)
     - `else` — existing twins prenatal layout (unchanged)

**Relevant Context:**
- `frontend/src/components/reports/pdfDocument.ts` lines 322–412 — existing section helpers and twin layout
- `frontend/src/services/print.service.ts` lines 149–335 — `buildViewModel`
- `uzpt.docx` — canonical paper layout order

---

### Sub-Task 8 — Backend Validation

**Status:** [x] completed ✅

**Intent:** Extend `examinationDataSchema` in `api/src/utils/validation.ts` to accept and validate the new FT data keys inside the `data` blob.

**Expected Outcomes:**
- `data.ft_biometry`, `data.ft_markers`, `data.ft_ultrasound`, `data.ft_anatomy`, `data.ft_doppler` and their `twin2_*` variants are accepted and validated.
- `examinationType` allowlist already includes new keys (no change needed — derived from `EXAM_TYPE_KEYS` at line 321).
- No changes needed to `CreateExamination.ts`, `UpdateExamination.ts`, or GET functions — FT data travels in the existing `data` JSON blob and is serialized/deserialized at line 104 of `CreateExamination.ts`.

**Todo:**
1. In `api/src/utils/validation.ts` — add four new Joi schemas after `anatomySchema`:
   ```ts
   const ftBiometrySchema = Joi.object({
     crl:       Joi.number().min(0).max(200).optional(),
     gaFromCrl: Joi.string().pattern(/^\d{1,2}w\s?\d{1}d$/).optional().allow(''),
     nt:        Joi.number().min(0).max(30).optional(),
     nb:        Joi.number().min(0).max(30).optional(),
     puls:      Joi.number().integer().min(0).max(300).optional(),
   }).optional();

   const ftMarkersSchema = Joi.object({
     arrhythmia:              Joi.string().valid('yes', 'no', '').optional().allow(''),
     tricuspidRegurgitation:  Joi.string().valid('yes', 'no', '').optional().allow(''),
     abnormalDvFlow:          Joi.string().valid('yes', 'no', '').optional().allow(''),
     echogenicCardiacFocus:   Joi.string().valid('yes', 'no', '').optional().allow(''),
     singleUmbilicalArtery:   Joi.string().valid('yes', 'no', '').optional().allow(''),
     choroidPlexusCysts:      Joi.string().valid('yes', 'no', '').optional().allow(''),
     exomphalos:              Joi.string().valid('yes', 'no', '').optional().allow(''),
     megacystis:              Joi.string().valid('yes', 'no', '').optional().allow(''),
     placenta:                Joi.string().max(500).optional().allow(''),
     cordInsertion:           Joi.string().max(500).optional().allow(''),
   }).optional();

   const ftUltrasoundSchema = Joi.object({
     placenta:      Joi.string().max(500).optional().allow(''),
     heartRate:     Joi.number().integer().min(1).max(300).optional(),
     umbilicalCord: Joi.string().max(500).optional().allow(''),
   }).optional();

   const ftDopplerSchema = Joi.object({
     utADexPI: Joi.number().min(0).max(10).optional(),
     utADexRI: Joi.number().min(0).max(1).optional(),
     utASinPI: Joi.number().min(0).max(10).optional(),
     utASinRI: Joi.number().min(0).max(1).optional(),
   }).optional();
   ```
2. In `examinationDataSchema` (lines 268–276) — add:
   ```ts
   ft_biometry:           ftBiometrySchema,
   ft_markers:            ftMarkersSchema,
   ft_ultrasound:         ftUltrasoundSchema,
   ft_anatomy:            anatomySchema,     // reuse existing
   ft_doppler:            ftDopplerSchema,
   twin2_ft_biometry:     ftBiometrySchema,
   twin2_ft_markers:      ftMarkersSchema,
   twin2_ft_ultrasound:   ftUltrasoundSchema,
   twin2_ft_anatomy:      anatomySchema,
   twin2_ft_doppler:      ftDopplerSchema,
   ```

**Relevant Context:**
- `api/src/utils/validation.ts` lines 268–350 — `examinationDataSchema` and `examinationSchema`
- `api/src/functions/CreateExamination.ts` line 104 — `data` is serialized as a single JSON blob; no change needed

---

## Files Changed Summary

| File | Change |
|------|--------|
| `frontend/src/constants/examinationTypes.ts` | +2 `EXAM_TYPES` entries, +2 `SECTION_VISIBILITY` entries, +`isFirstTrimester`, +`isFtTwins` helpers |
| `api/src/constants/examinationTypes.ts` | +2 `EXAM_TYPES` entries |
| `frontend/src/types/index.ts` | +`FtBiometry`, `FtMarkers`, `FtUltrasoundFindings`, `FtDoppler` interfaces; extend `ExaminationData` |
| `api/src/types/index.ts` | Same additions |
| `frontend/src/utils/calculations.ts` | +`calcGAFromCRL` |
| `frontend/src/components/sections/FirstTrimesterSection.tsx` | **New file** |
| `frontend/src/components/ExaminationForm.tsx` | +`isFt`/`isFtTwins` detection, +FT form state, +FT validation, +FT submission, +FT JSX blocks, guard existing sections |
| `frontend/src/pages/ExaminationDetailPage.tsx` | +FT read-only rendering, guard existing sections |
| `frontend/src/services/print.service.ts` | +FT view model types, +FT `buildViewModel` branch |
| `frontend/src/components/reports/pdfDocument.ts` | +FT section helpers, +FT PDF branch, conditional header title |
| `api/src/utils/validation.ts` | +4 FT Joi schemas in `examinationDataSchema` |

**Files NOT changed (confirming no serialization-site cascade):**
- `api/src/functions/CreateExamination.ts` — `data` blob pass-through unchanged
- `api/src/functions/UpdateExamination.ts` — same
- `api/src/functions/GetExamination.ts` — same
- `api/src/functions/GetExaminations.ts` — same
- `api/src/functions/GetExaminationByMRN.ts` — same

---

## Dependency Order

```
Sub-Task HF  (Hotfix: section order, biometry layout, doppler rename) ← ships to prod first; no other dependencies
  │
  │  HF verified in prod before continuing
  ▼
Sub-Task 0a (Extract useExaminationForm hook)      ← operates on HF-fixed files; no other dependencies
Sub-Task 0b (Extract ExaminationSections)          ← operates on HF-fixed files; parallel with 0a
Sub-Task 0c (Split pdfDocument / pdfSections)      ← operates on HF-fixed files; parallel with 0a, 0b
Sub-Task 0d (Extract viewModelBuilders)            ← operates on HF-fixed files; parallel with 0a–0c
  │
  │  All four extractions must compile before continuing
  ▼
Sub-Task 1 (Registry + Helpers)
  └─► Sub-Task 2 (Type Definitions)
        └─► Sub-Task 3 (calcGAFromCRL)
              └─► Sub-Task 4 (FirstTrimesterSection component)
                    ├─► Sub-Task 5 (Form integration)       ← adds FT to useExaminationForm hook
                    ├─► Sub-Task 6 (Detail page)             ← adds FT to ExaminationSections
                    └─► Sub-Task 7 (PDF)                     ← adds FT to pdfSections + viewModelBuilders
        └─► Sub-Task 8 (Backend validation) [parallel with 3–7]
```
