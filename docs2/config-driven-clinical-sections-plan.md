# Implementation Plan — 100% Config-Driven Clinical Sections

This plan details the end-to-end architecture and implementation steps to make all clinical sections (Ultrasound Findings, Biometry, Doppler, Anatomy, and Markers) across the **Form**, **Detail View**, and **PDF Report** 100% configuration-driven via `EXAM_TYPE_CONFIG`.

---

## Top-Level Overview

Currently, Biometry and Doppler are config-driven via `EXAM_TYPE_CONFIG`, whereas Ultrasound Findings and Anatomy are hardcoded in multiple locations (`ExaminationForm.tsx`, `ExaminationSections.tsx`, `pdfSections.ts`, and `viewModelBuilders.ts`). In addition, markers have lingering hardcoded lists in the PDF builders (KI-011).

This initiative introduces the `DescriptorTypeConfig` model and extends `ExamTypeConfig` to include `ultrasoundFindingTypes` and `anatomyTypes`, eliminating all duplicate field lists across the codebase, fixing the detail-view viewport layout (50% per fetus + horizontal scroll), and resolving KI-011.

---

## Architecture Design: `DescriptorTypeConfig`

`DescriptorTypeConfig` models qualitative, non-observable clinical fields (Ultrasound Findings, Anatomy) that do not require calculation polynomials, percentiles, or derived GA formulas:

```typescript
export interface DescriptorOption {
  value: string; // Stored value, e.g. "cephalic"
  label: string; // User-facing label, e.g. "Cephalic"
}

export interface DescriptorTypeConfig {
  key: string;                           // Storage key: "presentation", "gender", "head", "heart_rate"
  label: string;                         // Display title: "Presentation", "FHR (bpm)", "Head"
  inputType?: 'select' | 'text';         // UI control type (default: 'text')
  options?: readonly DescriptorOption[]; // Allowed dropdown options (when inputType === 'select')
  unit?: string;                         // Optional unit suffix: "bpm", etc.
  placeholder?: string;                  // Optional placeholder text: "e.g. 145"
}
```

---

## Sub-Tasks

### ST-01: Extend Type Definitions & `EXAM_TYPE_CONFIG` Registry
- **Intent**: Define `DescriptorOption` and `DescriptorTypeConfig` interfaces and register declarative configurations for Ultrasound Findings and Anatomy directly inside `EXAM_TYPE_CONFIG` for both `prenatal` and `first_trimester`.
- **Expected Outcomes**:
  - `DescriptorOption` and `DescriptorTypeConfig` interfaces exported in `frontend/src/types/index.ts`.
  - `ExamTypeConfig` updated with `ultrasoundFindingTypes: readonly DescriptorTypeConfig[]` and `anatomyTypes: readonly DescriptorTypeConfig[]`.
  - Declarative configurations (`PRENATAL_UF_CONFIG`, `FT_UF_CONFIG`, `COMMON_ANATOMY_CONFIG`) defined in `frontend/src/constants/examinationTypes.ts`.
  - `EXAM_TYPE_CONFIG['prenatal']` and `EXAM_TYPE_CONFIG['first_trimester']` populated with their respective findings and anatomy arrays.
- **Todo List**:
  - [x] Add `DescriptorOption` and `DescriptorTypeConfig` interfaces in `frontend/src/types/index.ts`.
  - [x] Add `ultrasoundFindingTypes` and `anatomyTypes` to `ExamTypeConfig` in `frontend/src/types/index.ts`.
  - [x] Create `PRENATAL_UF_CONFIG` in `frontend/src/constants/examinationTypes.ts` with Select options for Presentation, Gender, Fetal Movement, and Text inputs for FHR, Placenta, Umbilical Cord.
  - [x] Create `FT_UF_CONFIG` in `frontend/src/constants/examinationTypes.ts` (Placenta, FHR, Umbilical Cord).
  - [x] Create `COMMON_ANATOMY_CONFIG` in `frontend/src/constants/examinationTypes.ts` covering all 11 anatomy evaluation keys.
  - [x] Wire `ultrasoundFindingTypes` and `anatomyTypes` into `EXAM_TYPE_CONFIG['prenatal']` and `EXAM_TYPE_CONFIG['first_trimester']`.
- **Relevant Context**: `frontend/src/types/index.ts:68-95`, `frontend/src/constants/examinationTypes.ts:33-100`.
- **Status**: `[x] done`

---

### ST-02: Config-Driven Detail View & Layout Fixes (`ExaminationSections.tsx`)
- **Intent**: Refactor the Examination Detail View clinical sections to dynamically iterate `config.ultrasoundFindingTypes`, `config.anatomyTypes`, `config.biometryTypes`, `config.dopplerVessels`, `config.dopplerSingle`, and `config.markerTypes`. Apply 50% width per fetus with horizontal scrolling and proper section/subsection headings.
- **Expected Outcomes**:
  - Outer container displays `CLINICAL MEASUREMENTS` tile header (with fetus count when > 1).
  - Fetus columns use `flex: 0 0 calc(50% - 0.75rem)` inside an `overflow-x: auto` container (1 fetus = 50% viewport, 2 = 100%, 3+ = 150%+ with horizontal scroll).
  - All sections (Ultrasound Findings, Biometry, Doppler, Anatomy, Markers) render unconditionally with uppercase subtitles and `" — "` fallbacks for missing values.
  - Ultrasound Findings rendered by mapping over `config.ultrasoundFindingTypes`.
  - Anatomy rendered by mapping over `config.anatomyTypes`.
  - Doppler renders dynamic Sub-grid A (Vessels: `Vessel | PI | RI`) and Sub-grid B (Single: `Measurement | Value`).
  - Biometry table maintains single-grid column alignment with attribution tags (`sourceTag`).
- **Todo List**:
  - [x] Replace hardcoded findings and anatomy rendering in `frontend/src/components/ExaminationSections.tsx` with dynamic loops over `config.ultrasoundFindingTypes` and `config.anatomyTypes`.
  - [x] Wrap fetus columns in `styleFetusSectionContainer` and `styleFetusColumn` flex styles.
  - [x] Add uppercase subtitles (`ULTRASOUND FINDINGS`, `BIOMETRY`, `DOPPLER`, `ANATOMY`, `FIRST TRIMESTER MARKERS`).
  - [x] Ensure empty/unrecorded values display `" — "` gracefully across all descriptors.
- **Relevant Context**: `frontend/src/components/ExaminationSections.tsx`, `frontend/src/pages/ExaminationDetailPage.tsx`.
- **Status**: `[x] done`

---

### ST-03: Config-Driven Input Form (`ExaminationForm.tsx`)
- **Intent**: Replace hardcoded Ultrasound Findings select/input elements and Anatomy inputs in `ExaminationForm.tsx` with dynamic loops over `examConfig.ultrasoundFindingTypes` and `examConfig.anatomyTypes`.
- **Expected Outcomes**:
  - `FetusSection` in `ExaminationForm.tsx` dynamically renders form controls: Carbon `<Select>` when `inputType === 'select'` (with `options`) and `<TextInput>` when `inputType === 'text'` (with `unit`, `placeholder`, and error bindings).
  - Anatomy inputs dynamically rendered by mapping over `examConfig.anatomyTypes`.
  - Zero hardcoded field arrays in `ExaminationForm.tsx`.
- **Todo List**:
  - [x] Refactor Ultrasound Findings in `frontend/src/components/ExaminationForm.tsx` to map over `examConfig.ultrasoundFindingTypes` using dynamic control selection.
  - [x] Refactor Anatomy in `frontend/src/components/ExaminationForm.tsx` to map over `examConfig.anatomyTypes`.
- **Relevant Context**: `frontend/src/components/ExaminationForm.tsx:131-264`.
- **Status**: `[x] done`

---

### ST-04: Config-Driven PDF Generation (`viewModelBuilders.ts` & `pdfSections.ts`)
- **Intent**: Make PDF clinical section data mapping and rendering 100% config-driven. Resolve KI-011 by dynamically building and rendering Markers, Ultrasound Findings, Anatomy, Biometry, and Doppler from `EXAM_TYPE_CONFIG`.
- **Expected Outcomes**:
  - `buildFetusPdfViewModel` in `viewModelBuilders.ts` dynamically maps `ultrasound`, `anatomy`, `markers`, `biometry`, and `doppler` from `EXAM_TYPE_CONFIG`.
  - `pdfSections.ts` dynamically renders label/value pairs from `examConfig.ultrasoundFindingTypes`, `examConfig.anatomyTypes`, and `examConfig.markerTypes`.
  - KI-011 closed and resolved.
- **Todo List**:
  - [x] In `frontend/src/services/viewModelBuilders.ts`, iterate `examConfig.markerTypes`, `examConfig.ultrasoundFindingTypes`, and `examConfig.anatomyTypes` instead of manual field assignments.
  - [x] In `frontend/src/components/reports/pdfSections.ts`, replace hardcoded arrays in `mkAnatomyPairs`, `mkUltrasoundPairs`, `renderMarkersBlock`, and Doppler vessel grouping with config-driven mapping.
  - [x] Update `docs2/KNOWN-ISSUES.md` to mark KI-011 as resolved.
- **Relevant Context**: `frontend/src/services/viewModelBuilders.ts:130-180`, `frontend/src/components/reports/pdfSections.ts:95-295`, `docs2/KNOWN-ISSUES.md:339`.
- **Status**: `[x] done`

---

### ST-05: Verification & Conformance Testing
- **Intent**: Validate that create/edit forms, detail view, and PDF reports function seamlessly and all automated test suites pass.
- **Expected Outcomes**:
  - `npm test --prefix frontend` passes 100%.
  - `npm run build --prefix frontend` builds cleanly with no TypeScript errors.
- **Todo List**:
  - [x] Run Vitest unit & conformance tests.
  - [x] Run frontend TypeScript typecheck and production build.
- **Status**: `[x] done`
