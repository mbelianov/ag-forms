# Refactoring Findings — Prenatal Ultrasound Application

> **Addendum added after initial draft:** Section 12 documents the impact analysis of the two-type / N-fetus UI redesign requirement.

**Date:** 2026-07  
**Scope:** Full-stack review — `api/src/`, `frontend/src/`, Azure Table Storage schema  
**Prepared as:** Pre-implementation planning document for the upcoming refactoring sprint  
**Status:** Draft — pending design confirmation

---

## 1. Purpose

This document captures the concrete findings from the post-build codebase review as preparation for writing the implementation plan. It covers architecture, data model, naming, file structure, and the newly proposed generalized fetus-array data model. All findings are evidence-based from reading the actual source files.

---

## 2. Summary of Technical Debt

The application was built incrementally — one examination type at a time — and the accumulated debt falls into five categories:

| Category | Severity | Description |
|----------|----------|-------------|
| Data model — promoted twin fields | Critical | `biometry`, `doppler`, `biometry2`, `doppler2`, `gestationalAgeFromBiometry`, `gestationalAgeFromBiometry2` are top-level Azure Table Storage columns instead of living inside the `data` JSON blob alongside all other section data |
| Form state — flat `t2_` key explosion | Critical | `useExaminationForm.ts` has ~250 flat `formData` keys: every single biometry/doppler/anatomy field duplicated as `t2_{field}` for twin 2. Each new exam type or fetus adds another full set of duplicate keys |
| Config-driven rendering — half-implemented | High | `SECTION_VISIBILITY` exists but form, detail page, and PDF all still branch on hard-coded `isTwins` / `isFt` / `isFtTwinsMode` flags. The section-registry model documented in `architecture-forward-note.md` is not yet implemented |
| Backend serialization — copy-paste | High | `CreateExamination.ts`, `UpdateExamination.ts`, and all three GET functions each repeat the same JSON stringify / parse block for the same 4–6 fields. No shared serializer utility exists |
| Update path — O(N) partition scan | Medium | `UpdateExamination.ts` must scan the `PATIENT_{patientId}` partition to find the primary entity's row key because that row key is not stored anywhere accessible in the lookup entity |

---

## 3. Data Model Findings

### 3.1 Current state: mixed storage strategy

The `Examination` entity in Azure Table Storage currently stores data in two structurally inconsistent ways:

**Top-level columns** (individually named, explicitly serialized in every CRUD function):
- `biometry` — JSON string of `BiometryData`
- `doppler` — JSON string of `DopplerData`
- `biometry2` — JSON string of `BiometryData` (twins only)
- `doppler2` — JSON string of `DopplerData` (twins only)
- `gestationalAgeFromBiometry` — string "Xw Yd" (T1)
- `gestationalAgeFromBiometry2` — string "Xw Yd" (T2 twins)

**`data` blob** (all other section data, serialized as a single JSON string):
- `data.pregnancy_data`
- `data.ultrasound_findings`
- `data.anatomy`
- `data.twin2_ultrasound_findings`
- `data.twin2_anatomy`
- `data.ft_biometry`, `data.ft_markers`, `data.ft_ultrasound`, `data.ft_anatomy`, `data.ft_doppler`
- `data.twin2_ft_biometry`, `data.twin2_ft_markers`, `data.twin2_ft_ultrasound`, `data.twin2_ft_anatomy`, `data.twin2_ft_doppler`
- `data.comments`

The asymmetry is not architecturally justified. First-trimester biometry (`ft_biometry`) already lives inside `data`; second-trimester biometry (`biometry`) lives at the top level. The two approaches must stay in sync across five backend files and three GET deserializers.

### 3.2 Proposed evolution: generalized fetus array

The user has proposed generalizing the per-fetus measurement data so that instead of named positions (`biometry` for fetus 1, `biometry2` for fetus 2), all fetus-specific data is stored as an **array of fetus objects** inside the `data` blob.

#### Proposed `ExaminationData` shape

```json
{
  "pregnancy_data": { "last_menstrual_period": "...", "obstetric_history": "...", "family_history": "..." },
  "ga_from_biometry": "28w 3d",
  "comments": "...",

  "fetuses": [
    {
      "index": 0,
      "biometry":            { "bpd": 85.5, "hc": 310.5, "ac": 280.5, "fl": 55.5, ... },
      "doppler":             { "pi": 1.25, "ri": 0.65, ... },
      "ultrasound_findings": { "presentation": "cephalic", "gender": "female", "heart_rate": 145, ... },
      "anatomy":             { "head": "normal", "brain": "normal", ... },
      "ga_from_biometry":    "28w 3d",
      "ft_biometry":         null,
      "ft_markers":          null,
      "ft_ultrasound":       null,
      "ft_anatomy":          null,
      "ft_doppler":          null
    },
    {
      "index": 1,
      "biometry":            { ... },
      "doppler":             { ... },
      "ultrasound_findings": { ... },
      "anatomy":             { ... },
      "ga_from_biometry":    "27w 5d",
      "ft_biometry":         null,
      "ft_markers":          null,
      "ft_ultrasound":       null,
      "ft_anatomy":          null,
      "ft_doppler":          null
    }
  ]
}
```

#### Why this is better than the current named-position model

| Dimension | Current named-position model | Proposed fetus array |
|-----------|------------------------------|----------------------|
| Adding exam type with 3 fetuses | Add `biometry3`, `doppler3`, ... (7 new top-level columns) | Array grows to length 3 — zero schema change |
| Backend CRUD | 5 files each list 6+ named fields explicitly | Serialize/deserialize `data.fetuses` as one JSON blob — zero per-field code |
| Frontend `formData` | ~250 flat keys (`bpd`, `t2_bpd`, potential `t3_bpd`, ...) | `formData.fetuses[0].biometry.bpd`, `formData.fetuses[1].biometry.bpd` |
| `BiometrySection` props | 27 individually named props | Single `data: BiometryData` prop |
| `useExaminationForm.ts` size | ~600 lines of state initialization | Dramatically smaller: initialize as `fetuses: exam.data.fetuses ?? [defaultFetus()]` |
| Type safety | `biometry2` is `BiometryData | undefined` on `Examination` — required twin-2 fields indistinguishable from absent ones | `fetuses: FetusSectionData[]` — length encodes fetus count cleanly |

#### What the `FetusSectionData` interface looks like

```typescript
export interface FetusSectionData {
  index: number;
  // Second-trimester sections (null when not applicable to exam type)
  biometry?:            BiometryData;
  doppler?:             DopplerData;
  ultrasound_findings?: UltrasoundFindings;
  anatomy?:             AnatomyFindings;
  ga_from_biometry?:    string;
  // First-trimester sections (null when not applicable to exam type)
  ft_biometry?:         FtBiometry;
  ft_markers?:          FtMarkers;
  ft_ultrasound?:       FtUltrasoundFindings;
  ft_anatomy?:          AnatomyFindings;
  ft_doppler?:          FtDoppler;
}

export interface ExaminationData {
  pregnancy_data?:  PregnancyData;
  ga_from_biometry?: string;  // composite GA (all fetuses summarized, e.g. "28w 3d / 27w 5d")
  comments?:        string;
  fetuses:          FetusSectionData[];  // length = fetus count; index 0 = T1, index 1 = T2, etc.
}
```

#### Impact on top-level `Examination` interface

The following top-level fields are **removed** from `Examination`:

| Removed field | Moves to |
|---------------|----------|
| `biometry` | `data.fetuses[0].biometry` |
| `doppler` | `data.fetuses[0].doppler` |
| `gestationalAgeFromBiometry` | `data.fetuses[0].ga_from_biometry` |
| `biometry2` | `data.fetuses[1].biometry` |
| `doppler2` | `data.fetuses[1].doppler` |
| `gestationalAgeFromBiometry2` | `data.fetuses[1].ga_from_biometry` |

The `data` field on `Examination` becomes the single container for all clinical measurement data. The top-level fields that **remain** on `Examination` are only true entity-level metadata:

```
examinationId, mrn, patientId, patientName, patientNameLower,
examDate, gestationalAge, gestationalAgeIsManual,
status, examinationType, findings, patientAgeAtExam,
primaryRowKey (new — see §4.4),
createdAt, updatedAt, createdBy, createdByName, updatedBy,
isDeleted, deletedAt
```

Note: `gestationalAge` (from LMP) stays at top level because it is a first-class examination field used for filtering and display, not per-fetus measurement data.

### 3.3 Impact on backend CRUD functions

#### `CreateExamination.ts` and `UpdateExamination.ts`

Currently these functions list every named field individually:

```typescript
const biometryStr = biometry ? JSON.stringify(biometry) : undefined;
const dopplerStr  = doppler  ? JSON.stringify(doppler)  : undefined;
const biometry2Str = biometry2 ? JSON.stringify(biometry2) : undefined;
const doppler2Str  = doppler2  ? JSON.stringify(doppler2)  : undefined;
// ... then assign each to entity...
biometry: biometryStr as any,
doppler:  dopplerStr  as any,
biometry2: biometry2Str as any,
doppler2:  doppler2Str  as any,
gestationalAgeFromBiometry: ...,
gestationalAgeFromBiometry2: ...,
```

With the fetus array model, the entire section data is one serialization:

```typescript
const dataStr = data ? JSON.stringify(data) : undefined;
// entity.data = dataStr
```

No per-field listing. No per-type branching. Adding a third fetus requires zero backend changes.

#### `GetExamination.ts`, `GetExaminations.ts`, `GetExaminationByMRN.ts`

Currently all three repeat the same deserialization block. With the fetus array, only `data` needs parsing:

```typescript
const deserializedExamination = {
  ...examination,
  data: examination.data && typeof examination.data === 'string'
    ? JSON.parse(examination.data)
    : examination.data,
};
```

### 3.4 Impact on frontend form state

The `formData` object in `useExaminationForm.ts` currently has approximately 250 flat keys. The twin-2 fields are a full duplication of twin-1 fields with a `t2_` prefix. Each biometry field appears three times: bare (T1), `t2_` (T2 prenatal), `t1_ft_` / `t2_ft_` (FT variants).

With the fetus array model, `formData` becomes:

```typescript
interface FormData {
  // Entity-level fields (unchanged)
  patientId: string;
  examDate: string;
  status: string;
  examinationType: string;
  gestationalAge: string;
  gestationalAgeIsManual: boolean;
  findings: string;
  last_menstrual_period: string;
  obstetric_history: string;
  family_history: string;
  comments: string;

  // Per-fetus data — array replaces all t2_ flat keys
  fetuses: FetusSectionFormData[];  // length determined by exam type config
}

interface FetusSectionFormData {
  // All measurement fields as strings for input binding
  biometry: { bpd: string; hc: string; ac: string; fl: string; efw: string; ... };
  doppler:  { pi: string; ri: string; utADexPI: string; ... };
  ultrasoundFindings: { presentation: string; gender: string; heartRate: string; ... };
  anatomy:  { head: string; brain: string; ... };
  gaFromBiometry: string;
  gaFromBiometryIsManual: boolean;
  // FT fields (populated for FT exam types, empty for prenatal)
  ftBiometry: { crl: string; gaFromCrl: string; nt: string; nb: string; puls: string; gaFromBio: string; ... };
  ftMarkers:  { arrhythmia: string; ... };
  ftUltrasound: { placenta: string; heartRate: string; umbilicalCord: string };
  ftAnatomy:  { head: string; brain: string; ... };
  ftDoppler:  { utADexPI: string; ... };
}
```

`useExaminationForm.ts` initialization becomes:

```typescript
const fetusSectionCount = getExamTypeConfig(examinationType).fetusSectionCount;  // 1 or 2
const fetuses = Array.from({ length: fetusSectionCount }, (_, i) =>
  buildFetusSectionFormData(examination?.data?.fetuses?.[i])
);
```

This completely eliminates the `t2_` flat-key duplication. Adding a third fetus requires only that `fetusSectionCount` returns 3 in the type config.

### 3.5 UI rendering impact

The section components (`BiometrySection`, `DopplerSection`, `UltrasoundFindingsSection`, `AnatomySection`, `FirstTrimesterSection`) already accept a `prefix` prop and are already generic. They do not need to change structurally.

The twin side-by-side layout in `ExaminationForm.tsx` currently iterates:

```tsx
visibility.biometry && (
  <div style={twinsGrid}>
    <BiometrySection prefix="t1" data={...27 individual props from formData...} ... />
    <BiometrySection prefix="t2" data={...27 individual props from formData with t2_ prefix...} ... />
  </div>
)
```

With the fetus array it becomes:

```tsx
visibility.biometry && (
  <div style={isTwins ? twinsGrid : singleGrid}>
    {formData.fetuses.map((fetus, i) => (
      <BiometrySection
        key={i}
        prefix={`t${i + 1}`}
        data={fetus.biometry}
        onChange={(field, value) => handleFetusChange(i, 'biometry', field, value)}
        isSubmitting={isSubmitting}
      />
    ))}
  </div>
)
```

This is the config-driven rendering described in `architecture-forward-note.md` — extended to handle N fetuses naturally.

### 3.6 PDF and view-model impact

`ExamPdfViewModel` in `print.service.ts` currently has optional `biometry2`, `doppler2`, `ultrasound2`, `anatomy2` fields and a parallel set of `twin2Ft*` fields. With the fetus array:

```typescript
export interface ExamPdfViewModel {
  // ... entity-level fields ...
  fetuses: FetusPdfViewModel[];  // replaces biometry2, doppler2, ultrasound2, anatomy2, and all twin2Ft* fields
}

export interface FetusPdfViewModel {
  index: number;
  biometry?:         BiometryViewModel;
  doppler?:          DopplerViewModel;
  ultrasound?:       UltrasoundViewModel;
  anatomy?:          AnatomyViewModel;
  gaFromBiometry?:   string;
  ftBiometry?:       FtBiometryViewModel;
  ftMarkers?:        FtMarkersViewModel;
  ftUltrasound?:     FtUltrasoundViewModel;
  ftAnatomy?:        AnatomyViewModel;
  ftDoppler?:        FtDopplerViewModel;
}
```

`viewModelBuilders.ts` iterates `exam.data.fetuses` instead of conditionally reading `biometry` vs `biometry2`. `pdfDocument.ts` iterates `vm.fetuses` instead of branching on `isTwins`.

---

## 4. Architecture Findings

### 4.1 `ensureTableExists` called on every request

**Location:** Every Azure Function handler — first statement in the handler body.

**Problem:** `ensureTableExists` issues a `createTable` HTTP call to Azure Storage on every request, even after the table has existed for months. This adds ~20–50 ms latency and one billable storage transaction per API call.

**Fix:** Cache a `Set<string>` of already-verified table names at module scope in `tableClient.ts`. After the first successful creation or 409 (already exists), skip the call on all subsequent requests in the same Function host lifetime.

### 4.2 `getTableClient` creates a new client instance per call

**Location:** `api/src/utils/tableClient.ts` — `getTableClient(tableName)`.

**Problem:** Every entity operation calls `getTableClient(tableName)`, which calls `TableClient.fromConnectionString(...)` creating a new SDK client object. The Azure SDK may or may not reuse HTTP connection pools internally, but allocating a new client wrapper object on every database operation is unnecessary overhead.

**Fix:** Cache `TableClient` instances in a `Map<string, TableClient>` keyed by table name at module scope. `getTableServiceClient` already does this (singleton pattern) — apply the same pattern to `getTableClient`.

### 4.3 `UpdateExamination.ts` O(N) partition scan

**Location:** `api/src/functions/UpdateExamination.ts` — the `for await` loop that finds the primary entity.

**Problem:** The lookup entity (`EXAM` partition, row key = `examinationId`) does not store the primary entity's row key (`${reverseTicks}_${examinationId}`). To sync the primary entity after updating the lookup, the code scans the entire `PATIENT_{patientId}` partition filtering by `examinationId` property. Azure Table Storage executes property filters client-side — the SDK downloads every entity in the partition. For a patient with 200 examinations this reads 200 entities to find one.

**Fix:** When creating an examination, store `primaryRowKey: \`${reverseTicks}_${examinationId}\`` on the lookup entity. In `UpdateExamination.ts`, replace the scan with `getEntity(EXAMINATIONS_TABLE, \`PATIENT_${patientId}\`, existingExam.primaryRowKey)`.

### 4.4 Request body interfaces scoped inside handler functions

**Location:** `api/src/functions/CreateExamination.ts` (local `interface ExaminationCreateBody`), `api/src/functions/UpdateExamination.ts` (local `interface ExaminationBody`).

**Problem:** These interfaces are invisible outside the function closure, cannot be reused by tests or other utilities, and partially duplicate the shape of `Examination` in `types/index.ts`.

**Fix:** Move to `api/src/types/index.ts` as `ExaminationCreateRequest` and `ExaminationUpdateRequest`.

### 4.5 Label mismatch between frontend and backend exam type registries

**Location:**
- `api/src/constants/examinationTypes.ts` — label `'Ultrasound Prenatal Exam'`
- `frontend/src/constants/examinationTypes.ts` — label `'Ultrasound Prenatal'`

**Problem:** Labels displayed in the UI differ from labels recorded in audit logs. Any cross-referencing of UI labels with audit records fails silently.

**Fix:** Align both registries to use identical label strings. The authoritative source should be the frontend constants file (user-facing); the backend registry should match.

### 4.6 `responseHelpers.ts` — redundant `Date.now()` in `request_id`

**Location:** `api/src/utils/responseHelpers.ts` — `meta.request_id` construction.

**Problem:** `request_id` is built as `` `req_${Date.now()}_${randomUUID()}` ``. A UUID is already globally unique; the timestamp prefix adds no uniqueness and embeds a sortable timestamp that is not needed when `meta.timestamp` already carries it.

**Fix:** Use `randomUUID()` alone: `` `req_${randomUUID()}` ``.

---

## 5. File Structure Findings

### 5.1 Backend — flat `functions/` directory

All 28 Azure Function handlers live in a single flat directory with no domain grouping. Login, patient management, examination management, user management, audit, and system endpoints are all siblings.

**Target structure:**

```
api/src/
├── constants/
├── functions/
│   ├── auth/           (Login, Logout, GetCurrentUser, ChangePassword, Register)
│   ├── patients/       (CreatePatient, UpdatePatient, DeletePatient, GetPatient, GetPatients, GetPatientsCount, SearchPatients)
│   ├── examinations/   (CreateExamination, UpdateExamination, DeleteExamination, GetExamination, GetExaminations, GetExaminationsCount, GetExaminationByMRN)
│   ├── users/          (CreateUser, UpdateUser, DeleteUser, GetUsers, ResetUserPassword)
│   ├── audit/          (GetAuditLogs)
│   └── system/         (HealthCheck, InitializeTables, EmailExaminationReport)
├── shared/
│   ├── storage/        (tableClient.ts, examinationSerializer.ts)
│   ├── auth/           (tokenService.ts, passwordService.ts, authMiddleware.ts)
│   ├── patients/       (patientUtils.ts)
│   ├── mrn/            (mrnGenerator.ts, counterService.ts)
│   ├── audit/          (auditService.ts)
│   ├── validation/     (validation.ts)
│   └── http/           (responseHelpers.ts, errorHandler.ts)
├── types/
└── tests/
```

### 5.2 Frontend — flat `pages/` and mixed `components/`

15 page files live in a single flat `pages/` directory. `components/` mixes layout components, form utilities, page-level forms, and generic helpers.

**Target structure:**

```
frontend/src/
├── constants/
├── contexts/
├── hooks/
├── features/               (replaces flat pages/ and domain-specific page components)
│   ├── auth/
│   ├── patients/
│   ├── examinations/
│   ├── users/
│   ├── audit/
│   └── dashboard/
├── components/             (truly shared/generic only)
│   ├── sections/           (BiometrySection, DopplerSection, etc.)
│   └── (AppVersion, AutoCalcDot, EmptyState, ErrorBoundary, Layout, etc.)
├── reports/                (pdfDocument.ts, pdfSections.ts, viewModelBuilders.ts, PrintButton.tsx, EmailReportButton.tsx)
├── services/
├── types/
└── utils/
```

### 5.3 `print.service.ts` naming

`print.service.ts` uses kebab-case while all other service files use camelCase (`authService.ts`, `examinationService.ts`). Should be renamed to `printService.ts`.

### 5.4 `viewModelBuilders.ts` location

`viewModelBuilders.ts` lives in `services/` but is not a service — it produces view models for the PDF pipeline. Should move to the proposed `reports/` directory.

---

## 6. Naming Convention Findings

| Location | Current | Problem | Proposed |
|----------|---------|---------|----------|
| `api/src/utils/` | `utils/` directory | Catch-all mixing 8 unrelated concerns | `shared/` with sub-directories |
| `print.service.ts` | kebab-case | Inconsistent with camelCase neighbours | `printService.ts` |
| `viewModelBuilders.ts` in `services/` | Not a service | Mislocated | Move to `reports/` |
| `interface ExaminationCreateBody` | Scoped inside handler | Invisible externally | `ExaminationCreateRequest` in `types/` |
| `interface ExaminationBody` | Scoped inside handler | Invisible externally | `ExaminationUpdateRequest` in `types/` |
| `biometry2`, `doppler2`, `gestationalAgeFromBiometry2` | Numeric suffix | Does not generalize | Replaced by `fetuses[1].biometry`, etc. |
| `isTwins`, `isFt`, `isFtTwinsMode` | Boolean flags derived from type | Redundant derivation, implicit coupling | Replaced by `examConfig.fetusSectionCount` and `examConfig.trimester` |
| `SECTION_VISIBILITY` | Boolean map only | Described in `architecture-forward-note.md` as insufficient | `EXAM_TYPE_CONFIG` per `architecture-forward-note.md` |
| Frontend exam type labels | Shorter than backend | Labels diverge between UI and audit | Unify to identical strings in both registries |

---

## 7. Known Deferred Issues to Address in This Sprint

The following items from `KNOWN-ISSUES.md` are approved for the upcoming sprint and should be included in the implementation plan:

| KI | Priority | Fix |
|----|----------|-----|
| KI-006 | P1 | Add `logAuditEvent('PATIENT_SEARCH', ...)` in `SearchPatients.ts` |
| KI-007 | P1 | Change `Joi.string().email()` to `.email({ tlds: { allow: false } })` in `validation.ts` |

---

## 8. Migration Strategy

### 8.1 Data migration requirement

Moving `biometry`, `doppler`, `biometry2`, `doppler2`, `gestationalAgeFromBiometry`, `gestationalAgeFromBiometry2` out of top-level Azure Table Storage columns and into `data.fetuses` requires a one-time migration of existing records.

**Migration approach — dual-write period:**

1. **Phase 1 — Dual-write:** `CreateExamination` and `UpdateExamination` write data to both the old top-level columns AND the new `data.fetuses` array. Reads prefer `data.fetuses` with fallback to legacy top-level columns. Existing records continue to work without migration.

2. **Phase 2 — Migration script:** A one-time script iterates every entity in the `EXAM` partition, reads the legacy top-level fields, migrates them into `data.fetuses`, and rewrites the entity. Old top-level columns are cleared.

3. **Phase 3 — Remove dual-write:** After all records are migrated, remove the legacy column read/write paths.

### 8.2 No table schema changes required

Azure Table Storage is schemaless — removing properties from entities does not require a table alteration. Entities can have different property sets without error. The migration only changes the content of existing rows.

### 8.3 Backward compatibility for frontend

During Phase 1, the API returns examination data with both old top-level fields and new `data.fetuses`. The frontend can be updated to read from `data.fetuses` exclusively before the backend migration script runs (backward-compatible read path: `exam.data?.fetuses?.[0]?.biometry ?? exam.biometry`).

---

## 9. What Does NOT Change

The following are explicitly out of scope for this refactoring sprint:

- Business logic for medical calculations (`calculations.ts`) — no formula changes
- API route structure — all existing routes remain unchanged
- Authentication and authorization flow — no changes to JWT, cookies, RBAC
- Patient management functions — no changes beyond the KI fixes above
- Audit log schema
- The four existing examination types — no new types added in this sprint
- UI layout and visual design — pixel-for-pixel identical user experience
- PDF content — all fields continue to appear on the PDF

---

## 10. Open Questions for Design Confirmation

Before writing the implementation plan, the following questions must be answered:

**Q1 — RESOLVED:** Single atomic deployment. The migration script runs as part of the deploy; no dual-write period. ST-09 contains the script and the removal of all legacy column paths in a single coordinated change.

**Q2 — RESOLVED:** Only per-fetus values at `fetuses[i].ga_from_biometry`. There is no `data.ga_from_biometry` top-level field. Consumers (detail page, PDF, form) compute the composite string `"28w 3d / 27w 5d"` on read by joining `fetuses.map(f => f.ga_from_biometry).join(' / ')`.

**Q3 — RESOLVED:** Add a new `handleFetusChange(index, section, field, value)` handler alongside the existing `handleChange`. Section components receive whichever handler is appropriate based on whether they are fetus-specific (indexed) or entity-level (flat). The existing `handleChange` signature is preserved for entity-level fields (examDate, status, LMP, comments, etc.).

**Q4 — RESOLVED:** Plain `number`. `fetusSectionCount: 1 | 2` in `EXAM_TYPE_CONFIG`. Rendering code uses `.map((_, i) => ...)` over `Array.from({ length: config.fetusSectionCount })` — no pattern matching needed.

**Q5 — RESOLVED:** The directory restructuring (§5) runs **last** as ST-10, not before. New files created during ST-03 onwards are placed directly in the target directory structure. Existing files remain in their current locations and are moved in ST-10 via `git mv` with an automated import-path update pass. This keeps every functional sub-task reviewable against familiar paths and avoids a merge-conflict landmine from a mass rename mid-sprint.

---

## 11. Proposed Sub-Task Breakdown (Draft)

The following is a draft sequencing for the implementation plan. Each sub-task is independently deployable with no broken intermediate state.

| # | Sub-task | Scope | Depends on |
|---|----------|-------|------------|
| ST-01 | Quick fixes — KI-006 audit logging, KI-007 Joi TLD, label unification | Backend only | — |
| ST-02 | Storage layer improvements — `TableClient` cache, `ensureTableExists` cache, `primaryRowKey` stored on lookup entity | Backend only | — |
| ST-03 | Extract shared serializer utilities — `deserializeExamination`, `serializeExaminationFields`, `ExaminationCreateRequest` / `ExaminationUpdateRequest` types | Backend only | ST-02 |
| ST-04 | Type model update — introduce `FetusSectionData`, `ExaminationData.fetuses`, remove top-level promoted fields (dual-write phase begins) | Backend + shared types | ST-03 |
| ST-05 | Frontend form state refactor — replace flat `t2_` keys with `formData.fetuses[i]` array; update `useExaminationForm.ts`, `BiometrySection`, `DopplerSection`, section prop signatures | Frontend only | ST-04 |
| ST-06 | Implement `EXAM_TYPE_CONFIG` in `examinationTypes.ts` — replaces `SECTION_VISIBILITY`; drives form and detail page rendering | Frontend only | ST-05 |
| ST-07 | Config-driven rendering — refactor `ExaminationForm.tsx`, `ExaminationDetailPage.tsx`, `pdfDocument.ts` to iterate `EXAM_TYPE_CONFIG[type].sections` | Frontend only | ST-06 |
| ST-08 | View model refactor — update `ExamPdfViewModel`, `viewModelBuilders.ts`, `pdfSections.ts` to use `fetuses[]` | Frontend only | ST-07 |
| ST-09 | Migration script + Phase 3 cleanup — run migration, remove dual-write paths and legacy column reads | Backend only | ST-08 |
| ST-10 | Directory restructuring — `git mv` files to proposed layout; update all import paths | Both | ST-09 |

---

*This document is the input to the implementation plan. No code is written here — only findings and design proposals.*

---

## 12. Impact Analysis — Two-Type / N-Fetus UI Redesign

### 12.1 The Proposed Change

Instead of four discrete examination types (`ultrasound_prenatal`, `ultrasound_prenatal_twins`, `ultrasound_first_trimester`, `ultrasound_first_trimester_twins`), the user selects:

1. **Exam type** — one of two: *Prenatal* or *First Trimester*
2. **Number of fetuses** — a numeric selector (1, 2, … N) that dynamically controls how many fetus columns appear in each input section

This is a direct consequence of adopting the fetus array data model and eliminates the `_twins` type variants as first-class concepts.

---

### 12.2 Alignment with the Fetus Array Model

This requirement is a **natural fit** for the fetus array already proposed in §3. The array model was designed precisely to make fetus count a runtime parameter rather than a type discriminant. The redesign validates the architectural direction — it is not an additional complexity burden but a confirmation that the proposed model is correct.

The mapping is exact:

| Old model | New model |
|-----------|-----------|
| `ultrasound_prenatal` | type = `prenatal`, fetusSectionCount = 1 |
| `ultrasound_prenatal_twins` | type = `prenatal`, fetusSectionCount = 2 |
| `ultrasound_first_trimester` | type = `first_trimester`, fetusSectionCount = 1 |
| `ultrasound_first_trimester_twins` | type = `first_trimester`, fetusSectionCount = 2 |
| (future) triplets | type = `prenatal`, fetusSectionCount = 3 |

The stored `examinationType` field becomes one of two values: `prenatal` or `first_trimester`. The fetus count is encoded implicitly as `data.fetuses.length` — no separate field needed.

---

### 12.3 Impact by Layer

#### 12.3.1 Data model — MINOR

The `Examination` entity gains no new columns. The fetus count is derived from `data.fetuses.length` on read. The `examinationType` field changes from a 4-value enum to a 2-value enum.

**Changes required:**
- `api/src/constants/examinationTypes.ts` — reduce from 4 keys to 2 keys: `prenatal` and `first_trimester`
- `api/src/utils/validation.ts` — update `EXAM_TYPE_KEYS` allowlist accordingly
- `api/src/types/index.ts` — no structural change; `examinationType` remains `string`
- **Data migration:** existing records that currently have `examinationType = 'ultrasound_prenatal'` must be rewritten to `'prenatal'`, and `'ultrasound_prenatal_twins'` → `'prenatal'`, `'ultrasound_first_trimester'` → `'first_trimester'`, `'ultrasound_first_trimester_twins'` → `'first_trimester'`. This is a one-pass string substitution on the `examinationType` column for all entities in both `EXAM` and `PATIENT_*` partitions. It can be folded into the same migration script as the fetus array migration (ST-04/ST-09).

#### 12.3.2 Backend filter parameter — MINOR

`GET /v1/examinations` accepts `examination_type` as a query parameter. Its allowlist validation currently checks against `EXAM_TYPE_KEYS`. After the change, the allowlist shrinks to `['prenatal', 'first_trimester']`. The filter still works — only the valid values change. No route or response shape change needed.

The `ExaminationsPage` filter dropdown currently shows all four types. After the change it shows two. The `examination_type` URL parameter must use the new keys.

#### 12.3.3 `EXAM_TYPE_CONFIG` — SIMPLIFIES

The `EXAM_TYPE_CONFIG` proposed in §3 (ST-06) currently has four entries. After the redesign it has two:

```typescript
export const EXAM_TYPE_CONFIG: Record<string, ExamTypeConfig> = {
  prenatal: {
    label: 'Prenatal',
    trimester: 'second',
    sections: ['biometry', 'doppler', 'ultrasoundFindings', 'anatomy'],
    // fetusSectionCount is NO LONGER in the config — it is a runtime value chosen by the user
  },
  first_trimester: {
    label: 'First Trimester',
    trimester: 'first',
    sections: ['firstTrimester'],
  },
};
```

The critical difference from the §3 design: **`fetusSectionCount` is removed from `EXAM_TYPE_CONFIG`**. It becomes a separate piece of runtime state set by the user on the create form and stored as `data.fetuses.length`. The config no longer determines how many columns appear — the user does.

#### 12.3.4 Create Examination form — MODERATE change

The form currently shows an "Examination Type" dropdown with four options. The redesign replaces this with:

1. An **Exam Type** selector with two options: *Prenatal* / *First Trimester*
2. A **Number of Fetuses** numeric input or segmented control (1 / 2 / 3 …) — initially defaulting to 1

On the **edit** form, both fields are read-only (as `examinationType` is locked on edit today). The number of fetuses is derived from `examination.data.fetuses.length` and displayed as a read-only label.

**`formData` changes:**
- Remove `examinationType` as a string that encodes both type and fetus count
- Add `fetusSectionCount: number` as a separate controlled field (default 1)
- `formData.examinationType` becomes one of `'prenatal' | 'first_trimester'`
- On submit, `data.fetuses` array length equals `fetusSectionCount`; `examinationType` is the two-value key

`useExaminationForm.ts` initialization changes:
- For **create**: `fetusSectionCount` is initially `1`; user changes it live
- For **edit**: `fetusSectionCount = examination.data.fetuses.length` — read-only

The `formData.fetuses` array must be **reactively resized** when `fetusSectionCount` changes:
- If the user increases: append new empty `FetusSectionFormData` entries up to the new count
- If the user decreases: slice the array to the new length — trailing entries are silently discarded (Option A, confirmed)

This requires a `handleFetusCountChange(newCount: number)` handler in `useExaminationForm.ts`.

#### 12.3.5 `ExaminationForm.tsx` rendering loop — NO ADDITIONAL CHANGE

The section rendering loop proposed in ST-07 already iterates `formData.fetuses.map(...)`. When `fetusSectionCount` changes and `formData.fetuses` is resized, the loop naturally adds or removes columns. No change to the loop itself.

The twin column headers currently read "Twin 1" / "Twin 2". These generalize to "Fetus 1" / "Fetus 2" / "Fetus 3" etc. The header is conditionally rendered only when `fetusSectionCount > 1`.

#### 12.3.6 `ExaminationDetailPage.tsx` — MINOR

Currently derives `isTwins` from `examinationType`. After the change, it reads `examination.data.fetuses.length > 1`. The rendering loop already iterates fetuses — no structural change needed beyond the two-value type check for trimester detection (`examination.examinationType === 'first_trimester'`).

The summary tile currently shows `"Type: Ultrasound Prenatal Exam for Twins"`. After the change it shows `"Type: Prenatal — 2 fetuses"` or similar composite label derived from type + fetus count.

#### 12.3.7 `ExaminationsPage` and `PatientDetailPage` filter dropdowns — MINOR

The "Filter by Type" dropdown currently shows four options from `EXAM_TYPES`. After the change it shows two. The `examination_type` query parameter uses the new keys. No other filter logic changes.

#### 12.3.8 List view "Type" column display — MINOR

Examination list rows currently show `getExamTypeLabel(exam.examinationType)` which maps a 4-value key to a label. After the change:
- `exam.examinationType` is `'prenatal'` or `'first_trimester'`
- The display should show `"Prenatal"` or `"First Trimester"`, optionally with fetus count: `"Prenatal (×2)"` derived from `exam.data?.fetuses?.length ?? 1`
- `getExamTypeLabel` continues to work on the 2-value keys; the fetus count suffix is computed separately by the list component

#### 12.3.9 PDF report — MINOR label change

The PDF currently prints the exam type label in the header. After the change it prints `"Prenatal — 2 Fetuses"` or `"First Trimester"` etc. The section rendering is already fetus-array-driven after ST-08. No structural change — only the header label assembly changes in `buildViewModel`.

#### 12.3.10 MRN — NO CHANGE

MRN is generated at examination creation time from the patient name, year, and a counter. It does not encode exam type or fetus count. No change.

#### 12.3.11 Breadcrumbs and page titles — MINOR

`ExaminationDetailPage` breadcrumb currently reads `"{patientName} — {examTypeLabel} — {examDate}"`. The label must come from the new 2-value type + fetus count composite. Breadcrumb logic is ~2 lines.

---

### 12.4 Interaction Constraint: Fetus Count Decrease — RESOLVED

**On create (Option A — confirmed):** Decreasing fetus count silently discards the unsaved `formData.fetuses[n-1]` entry. No warning is shown. Since no data has been submitted yet, nothing is lost from storage. `handleFetusCountChange` slices the array to the new length.

**On edit:** Fetus count is **locked** — displayed as a read-only label derived from `examination.data.fetuses.length`. This mirrors the existing lock on `examinationType`. Allowing fetus count changes on edit is a future feature out of scope for this sprint.

---

### 12.5 Backward Compatibility and Migration

Existing records in the database have `examinationType` values from the 4-value set. The migration script (ST-09) must include a second pass that rewrites:

| Old value | New value |
|-----------|-----------|
| `ultrasound_prenatal` | `prenatal` |
| `ultrasound_prenatal_twins` | `prenatal` |
| `ultrasound_first_trimester` | `first_trimester` |
| `ultrasound_first_trimester_twins` | `first_trimester` |

This pass runs on both `EXAM` partition and `PATIENT_*` partition entities. It is a simple string substitution — no structural change. The `data.fetuses` array length already encodes the fetus count correctly after the fetus array migration, so no fetus-count information is lost.

The `EXAM_TYPE_KEYS` allowlist in `validation.ts` and `GetExaminations.ts` must be updated to `['prenatal', 'first_trimester']` before the migration runs — otherwise any attempt to create a new examination during the migration window would be validated against stale keys.

---

### 12.6 Summary of Changes Relative to the Existing Plan

| Sub-task | Impact of redesign requirement | Addendum |
|----------|-------------------------------|----------|
| ST-01 | No change | — |
| ST-02 | No change | — |
| ST-03 | No change | — |
| ST-04 | **Extend migration script** to also rewrite `examinationType` values from 4-value → 2-value set on all entities | Add migration pass |
| ST-05 | **Add `fetusSectionCount`** as a separate `formData` field; add `handleFetusCountChange`; make `formData.fetuses` reactively resize | Moderate addition |
| ST-06 | **Remove `fetusSectionCount` from `EXAM_TYPE_CONFIG`**; reduce config to 2 entries; `fetusSectionCount` is runtime state | Config simplifies |
| ST-07 | Column headers generalize from "Twin 1/2" to "Fetus 1/2/…"; fetus count selector replaces `_twins` type in create form; both fields read-only on edit | Moderate addition |
| ST-08 | PDF header label assembly: type + fetus count composite string | Minor |
| ST-09 | **Add `examinationType` rewrite pass** to migration script | Minor addition |
| ST-10 | No change | — |

**Net assessment:** The two-type / N-fetus redesign is **additive and compatible** with the fetus array model. It does not invalidate any sub-task. The largest incremental effort is in ST-05 (form state: fetus count as live resizable state) and ST-07 (fetus count selector in create form, read-only on edit). All other impacts are minor label or allowlist changes.

---

## 13. Impact Analysis — Screen and PDF Layout for N > 2 Fetuses

### 13.1 Current state — what the code actually does

#### Screen layout
The twin grid in [`ExaminationForm.tsx`](frontend/src/components/ExaminationForm.tsx) uses:
```css
display: grid;
grid-template-columns: repeat(2, 1fr);
gap: 1.5rem;
```
inside a `maxWidth: 1200px` container (set in [`CreateExaminationPage.tsx`](frontend/src/pages/CreateExaminationPage.tsx) and [`EditExaminationPage.tsx`](frontend/src/pages/EditExaminationPage.tsx)). There is no `minWidth` per column and no `overflowX` anywhere. With a third column, each column would collapse to ~380px — too narrow to render biometry inputs usably.

#### PDF layout
[`pdfDocument.ts`](frontend/src/components/reports/pdfDocument.ts) hard-codes two positional X anchors:
```typescript
const TWIN_COL_W = 88;          // mm — half of 182 mm usable width
const T1_X = 14;                // mm — left margin
const T2_X = 14 + 88 + 6 = 108; // mm — second column start
```
[`pdfSections.ts`](frontend/src/components/reports/pdfSections.ts) uses `T1_X` and `T2_X` directly in every twin rendering call. There is no concept of "fetus pair N and N+1 on a page" — the layout is fixed for exactly two positions. The existing page-2 overflow (`sigYIdeal > SIG_MAX`) is a generic content-overflow fallback that adds one extra page; it does not repeat common sections or print structured page numbering per fetus pair.

### 13.2 Required behaviour

| Context | Requirement |
|---------|-------------|
| Screen — 1 fetus | Single-column layout, unchanged |
| Screen — 2 fetuses | Two-column side-by-side, unchanged |
| Screen — 3+ fetuses | Each fetus column has a fixed minimum width; the section container scrolls horizontally when columns exceed viewport width — columns do not squeeze |
| PDF — 1 fetus | Single-column A4 layout, unchanged |
| PDF — 2 fetuses | Two-column A4 layout, unchanged |
| PDF — 3+ fetuses | At most 2 fetus columns per printed page; pairs grouped as fetus 1+2 on page 1, fetus 3+4 on page 2, etc.; common sections (header bar, patient block, pregnancy data, clinical information, signature) repeated on every page; page footer reads "Page N of M" |
| PDF — all | Exam title in header reads `"Prenatal Ultrasound Report (3 fetuses)"` — fetus count embedded |

### 13.3 Screen layout gap and fix

**Gap:** `gridTemplateColumns: 'repeat(N, 1fr)'` inside a fixed-width container squeezes all columns equally as N grows.

**Fix (ST-07):** Replace the fetus grid container style with:
```css
display: flex;
flex-direction: row;
flex-wrap: nowrap;  /* critical — prevents columns wrapping to the next line */
gap: 1.5rem;
overflow-x: auto;   /* horizontal scroll when content exceeds viewport */
```
`flex-wrap: nowrap` is mandatory. Without it, the default flex behaviour wraps overflowing items to the next line, so fetus 3 drops below fetuses 1 and 2 and the scrollbar never appears. With `nowrap`, all columns stay on a single line and the container overflows horizontally, which triggers the scrollbar.

Each fetus column is a `<div>` with:
```css
min-width: 480px;   /* minimum usable column width for biometry inputs */
flex: 0 0 auto;     /* do not shrink below min-width */
```
When `fetusSectionCount === 1`, the outer container uses `maxWidth: 1200px` (existing page cap) — no behaviour change; a single column cannot overflow so `overflow-x` has no effect. When `fetusSectionCount > 1`, the container removes the `maxWidth` cap so columns can extend past the viewport and trigger the scrollbar naturally.

The outer page container in `CreateExaminationPage.tsx` / `EditExaminationPage.tsx` retains `maxWidth: 1200px; margin: 0 auto` — only the inner fetus section wrapper changes.

### 13.4 PDF layout gap and fix

**Gap:** `T1_X` and `T2_X` are hard-coded scalar values. `renderClinicalSections` has two explicit branches (`isTwins` / `!isTwins`). Adding a third fetus requires a third positional X and a third branch. Common sections are not re-drawn for overflow pages. No structured `Page N of M` pagination exists for multi-fetus reports.

**Fix (ST-08):**

#### 13.4.1 Fetus pair chunking

Introduce `chunkFetuses(fetuses: FetusPdfViewModel[], pageSize = 2): FetusPdfViewModel[][]` that splits the fetus array into pairs:
```
[F1, F2, F3, F4] → [[F1, F2], [F3, F4]]
[F1, F2, F3]     → [[F1, F2], [F3]]
[F1]             → [[F1]]
[F2]             → [[F2]]  ← single fetus on its own page pair
```

#### 13.4.2 Per-page layout computation

Define `computePairLayout(pairLength: 1 | 2): PairLayout`:
```typescript
interface PairLayout {
  colW:   number;   // mm per fetus column
  xStart: number[]; // mm X anchor for each fetus (length = pairLength)
  xEnd:   number[]; // mm right edge for each fetus column
}
```
- `pairLength = 1`: `colW = 182`, `xStart = [14]`, `xEnd = [196]` — full-width, same as current single-fetus
- `pairLength = 2`: `colW = 88`, `xStart = [14, 108]`, `xEnd = [102, 196]` — same as current twin layout

This replaces the hard-coded `TWIN_COL_W`, `T1_X`, `T2_X` constants with a computed layout object.

#### 13.4.3 Common section builder extracted

Extract `drawCommonSections(doc, vm, pageIndex, totalPages): number` from the current `buildExaminationPDF` body:
- Draws the header bar, patient block, pregnancy data, and returns the Y position where clinical content starts
- `pageIndex` and `totalPages` are used to print `"Page N of M"` in the footer
- The exam title includes fetus count: `"Prenatal Ultrasound Report (N fetuses)"` when N > 1; singular `"Prenatal Ultrasound Report"` when N = 1

#### 13.4.4 Main builder loop

Replace the current linear `buildExaminationPDF` body (which writes all sections once) with a loop over fetus pair chunks:

```typescript
const pairs = chunkFetuses(vm.fetuses);
const totalPages = pairs.length;

for (let pageIdx = 0; pageIdx < pairs.length; pageIdx++) {
  if (pageIdx > 0) doc.addPage();

  const pair = pairs[pageIdx];
  const layout = computePairLayout(pair.length as 1 | 2);

  // Common header + patient block + pregnancy data on every page
  let y = drawCommonSections(doc, vm, pageIdx + 1, totalPages);

  // Per-fetus clinical sections for this pair
  y = renderClinicalSectionsPair(doc, vm, pair, layout, y, helpers, pageIdx + 1, totalPages);

  // Clinical information (findings, comments, notes) — last page only
  if (pageIdx === totalPages - 1) {
    y = drawClinicalInformation(doc, vm, y);
  }

  // Signature line — last page only
  if (pageIdx === totalPages - 1) {
    drawSignatureLine(doc, y);
  }

  // Footer with page numbering on every page
  drawFooter(doc, pageIdx + 1, totalPages);
}
```

#### 13.4.5 `renderClinicalSections` signature change

`renderClinicalSections` in `pdfSections.ts` receives `pair: FetusPdfViewModel[]` and `layout: PairLayout` instead of the current `isTwins: boolean` and fixed `T1_X / T2_X / TWIN_COL_W` from `PdfDrawHelpers`. The function iterates `pair.length` instead of branching on `isTwins`. The `PdfDrawHelpers` interface loses `TWIN_COL_W`, `T1_X`, `T2_X` — replaced by `layout`.

### 13.5 Exam title with fetus count

In `buildViewModel` (`viewModelBuilders.ts`), the header title is currently:
```typescript
const headerTitle = isFtTwinsExam ? 'First Trimester Ultrasound (Twins)' : isFt ? 'First Trimester Ultrasound' : 'Prenatal Ultrasound Report';
```

After the redesign:
```typescript
const n = vm.fetuses.length;
const fetusLabel = n === 1 ? '' : ` (${n} fetuses)`;
const typeLabel = vm.examinationType === 'first_trimester' ? 'First Trimester Ultrasound' : 'Prenatal Ultrasound Report';
const headerTitle = `${typeLabel}${fetusLabel}`;
```
Examples: `"Prenatal Ultrasound Report"`, `"Prenatal Ultrasound Report (2 fetuses)"`, `"First Trimester Ultrasound (3 fetuses)"`.

### 13.6 Summary of changes relative to the existing plan

| Sub-task | Addendum |
|----------|----------|
| ST-07 | Screen fetus grid: replace `repeat(N, 1fr)` grid with flex row + `min-width: 480px` + `overflow-x: auto` per column; single-fetus path unchanged |
| ST-08 | PDF: extract `drawCommonSections`, `drawClinicalInformation`, `drawSignatureLine`, `drawFooter` from the linear builder body; add `chunkFetuses` and `computePairLayout`; replace linear flow with pair-loop; `renderClinicalSections` takes `pair[]` + `PairLayout` instead of `isTwins` + hard-coded X constants; exam title includes fetus count |
| ST-08 | `PdfDrawHelpers` interface: remove `TWIN_COL_W`, `T1_X`, `T2_X`; add `layout: PairLayout` |
| ST-08 | `viewModelBuilders.ts`: exam title computed from type + fetus count; no `isTwins` / `isFtTwins` branches |
