# Architecture Forward Note — Exam Type Extensibility

**Origin:** Extracted from `docs2/uzd-twins-plan.md` at the conclusion of the `feature/uzd-twins` phase.  
**Applies to:** The next phase introducing exam type 3 (and beyond).  
**Status:** Deferred — not in scope for `feature/uzd-twins`. Must be resolved before type 3 implementation begins.

---

## Current State (after uzd-twins)

Two exam types exist: `ultrasound_prenatal` and `ultrasound_prenatal_twins`.

The codebase has two layers with very different scalability profiles:

| Layer | Scales? | Cost per new type |
|-------|---------|-------------------|
| **Type registry** — `EXAM_TYPES`, `SECTION_VISIBILITY`, `EXAM_TYPE_KEYS` in `examinationTypes.ts` | ✅ Free | Two file edits, zero code changes elsewhere |
| **Data shape & rendering** — `Examination` interface, `ExaminationForm`, `ExaminationDetailPage`, `pdfDocument.ts` | ❌ Does not scale | Each structurally-distinct type adds optional fields to the shared interface and a new `if/else` branch in the form, detail page, and PDF builder |

The section components introduced in `frontend/src/components/sections/` (`BiometrySection`, `DopplerSection`, `UltrasoundFindingsSection`, `AnatomySection`) are the first step toward a section-registry model that fixes the second layer.

---

## The Problem in Concrete Terms

### 1. Shared `Examination` interface bloat

Every new type with unique fields (e.g. T2 biometry for twins) adds optional top-level properties to the single `Examination` interface in `frontend/src/types/index.ts` and `api/src/types/index.ts`. With two types this is manageable; with five it becomes a wide, sparse object with ~80% of fields undefined on any given record.

**Current promoted top-level fields (twins added):**
```
biometry, doppler, gestationalAgeFromBiometry          ← T1 / single-fetus
biometry2, doppler2, gestationalAgeFromBiometry2        ← T2 twins only
```
Type 3 would add a third set. Type 4 a fourth.

### 2. Branching in rendering files

`ExaminationForm.tsx`, `ExaminationDetailPage.tsx`, and `pdfDocument.ts` all contain an `isTwins` branch today. Type 3 will require an `isType3` branch alongside it. These files already contain ~1 300, ~600, and ~475 lines respectively. Each new type adds another conditional block.

### 3. Backend serialization sites

`CreateExamination.ts` and `UpdateExamination.ts` explicitly list every serializable field. `GetExamination.ts`, `GetExaminations.ts`, and `GetExaminationByMRN.ts` explicitly deserialize them. Each new promoted field requires touching all five files.

---

## Recommended Pre-Type-3 Refactor

### Step A — Unify the data model: move biometry/doppler into the `data` blob

**Goal:** Eliminate promoted top-level `biometry`/`doppler` properties. All per-fetus, per-type section data lives inside the `data` JSON blob, keyed by a consistent scheme.

**Proposed `data` shape:**
```json
{
  "pregnancy_data":          { ... },       // shared, unchanged
  "ultrasound_findings":     { ... },       // T1, existing key — keep for compatibility
  "anatomy":                 { ... },       // T1, existing key — keep for compatibility
  "biometry":                { ... },       // T1 — move from top-level
  "doppler":                 { ... },       // T1 — move from top-level
  "ga_from_biometry":        "28w 3d",     // T1 — move from top-level
  "twin2_ultrasound_findings": { ... },     // T2 twins, existing key
  "twin2_anatomy":           { ... },       // T2 twins, existing key
  "twin2_biometry":          { ... },       // T2 twins — new in this refactor
  "twin2_doppler":           { ... },       // T2 twins — new in this refactor
  "twin2_ga_from_biometry":  "27w 5d",     // T2 twins — new in this refactor
  "comments":                "...",         // existing
  ...                                       // type-3 section data fits here naturally
}
```

**Impact:**
- `Examination` interface loses `biometry`, `doppler`, `gestationalAgeFromBiometry`, `biometry2`, `doppler2`, `gestationalAgeFromBiometry2` — replaced by richer typing on `data`.
- `CreateExamination.ts` / `UpdateExamination.ts` no longer need per-field serialization — `data` is already serialized as one JSON blob.
- All GET deserialization sites (`GetExamination`, `GetExaminations`, `GetExaminationByMRN`) only parse the single `data` string — no per-field guards needed.
- **Migration required** for existing records: a one-time script reads each entity, moves the promoted fields into `data`, and rewrites. Old `biometry`/`doppler` top-level columns can be left in Table Storage (they are ignored once the code no longer reads them) or cleaned up in a second pass.

### Step B — Promote `SECTION_VISIBILITY` to a full `SECTION_CONFIG`

**Goal:** Each exam type declares its section layout declaratively; no file other than `examinationTypes.ts` needs to change when a new type is added.

**Proposed shape** (in `frontend/src/constants/examinationTypes.ts`):

```ts
export type SectionLayout = 'single' | 'twin';

export interface SectionConfig {
  key: string;                  // matches the data key, e.g. 'biometry', 'doppler'
  component: React.ComponentType<SectionProps>;
  dataKey: string;              // key inside exam.data for T1
  dataKey2?: string;            // key inside exam.data for T2 (if layout === 'twin')
  layout: SectionLayout;
}

export interface ExamTypeConfig {
  label: string;
  sections: SectionConfig[];    // ordered list — form/detail/PDF iterate in this order
}

export const EXAM_TYPE_CONFIG: Record<string, ExamTypeConfig> = {
  ultrasound_prenatal: {
    label: 'Ultrasound Prenatal Exam',
    sections: [
      { key: 'biometry',          component: BiometrySection,          dataKey: 'biometry',          layout: 'single' },
      { key: 'doppler',           component: DopplerSection,           dataKey: 'doppler',           layout: 'single' },
      { key: 'ultrasound',        component: UltrasoundFindingsSection, dataKey: 'ultrasound_findings', layout: 'single' },
      { key: 'anatomy',           component: AnatomySection,           dataKey: 'anatomy',           layout: 'single' },
    ],
  },
  ultrasound_prenatal_twins: {
    label: 'Ultrasound Prenatal Exam for Twins',
    sections: [
      { key: 'biometry',  component: BiometrySection,          dataKey: 'biometry',            dataKey2: 'twin2_biometry',            layout: 'twin' },
      { key: 'doppler',   component: DopplerSection,           dataKey: 'doppler',             dataKey2: 'twin2_doppler',             layout: 'twin' },
      { key: 'ultrasound',component: UltrasoundFindingsSection, dataKey: 'ultrasound_findings', dataKey2: 'twin2_ultrasound_findings', layout: 'twin' },
      { key: 'anatomy',   component: AnatomySection,           dataKey: 'anatomy',             dataKey2: 'twin2_anatomy',             layout: 'twin' },
    ],
  },
  // type_3: { label: '...', sections: [ ... ] }   ← only this file changes
};
```

### Step C — Make form, detail page, and PDF builder config-driven

With Steps A and B in place:

- **`ExaminationForm.tsx`** iterates `EXAM_TYPE_CONFIG[type].sections` and renders each `SectionConfig.component` once (single) or twice side-by-side (twin) using the declared `dataKey`/`dataKey2`. The `isTwins` branch is deleted.
- **`ExaminationDetailPage.tsx`** does the same for read-only rendering.
- **`pdfDocument.ts`** iterates sections and dispatches to the appropriate pairs-builder by `SectionConfig.key`. The `isTwins` branch is replaced by a `layout === 'twin'` check inside the loop.

**Result:** Adding exam type 3 costs exactly:
1. One entry in `EXAM_TYPE_CONFIG` (in `examinationTypes.ts`)
2. A new section component file if the type introduces a novel section (otherwise reuses existing components)
3. Zero changes to `ExaminationForm`, `ExaminationDetailPage`, or `pdfDocument.ts`

---

## Sequencing Recommendation

1. **Know type 3's section requirements first.** The abstraction above is designed against two concrete data points (single-fetus, twins). Implementing it before type 3's shape is known risks over-engineering the wrong axis.
2. **Scope the data migration.** Moving `biometry`/`doppler` into `data` requires a migration script for existing production records. This must be planned, tested against a copy of the production Table Storage, and deployed atomically with the code change.
3. **Do Step A before Step B.** The data model is the foundation. Running the config-driven rendering on the old promoted-field model would require keeping both code paths in sync during transition.
4. **Backend can follow independently.** Once `data` carries all section content, `CreateExamination` / `UpdateExamination` simplify to a single `data` serialization. The backend refactor can be done as a follow-up PR after the frontend config model is proven.

---

## Files That Will Change in the Refactor

| File | Change |
|------|--------|
| `frontend/src/constants/examinationTypes.ts` | Replace `SECTION_VISIBILITY` with `SECTION_CONFIG` / `EXAM_TYPE_CONFIG` |
| `frontend/src/types/index.ts` | Remove promoted `biometry`, `doppler`, twin variants; enrich `ExaminationData` |
| `api/src/types/index.ts` | Same removals on backend interface |
| `api/src/functions/CreateExamination.ts` | Remove per-field serialization; single `data` write |
| `api/src/functions/UpdateExamination.ts` | Same |
| `api/src/functions/GetExamination.ts` | Remove per-field deserialization |
| `api/src/functions/GetExaminations.ts` | Same |
| `api/src/functions/GetExaminationByMRN.ts` | Same |
| `api/src/utils/validation.ts` | Collapse `biometry2`/`doppler2` top-level entries; validate inside `examinationDataSchema` |
| `frontend/src/components/ExaminationForm.tsx` | Replace `isTwins` branch with config-driven loop |
| `frontend/src/pages/ExaminationDetailPage.tsx` | Same |
| `frontend/src/components/reports/pdfDocument.ts` | Replace `isTwins` branch with config-driven loop |
| `frontend/src/services/print.service.ts` | Simplify `ExamPdfViewModel` — no more T2 optional variants; section data read from `data` |
| Migration script *(new file)* | One-time: move `biometry`/`doppler` top-level columns into `data` blob for all existing records |

---

*This document was extracted from `docs2/uzd-twins-plan.md § Forward-Compatibility Note` and expanded for use as a standalone planning artefact.*
