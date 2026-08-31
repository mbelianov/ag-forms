# Refactoring Findings — Prenatal Ultrasound Application

> **Addenda added after initial draft:** Section 12 documents the impact analysis of the two-type / N-fetus UI redesign requirement. Section 13 documents the screen and PDF layout requirements for N > 2 fetuses. Section 14 documents the adopted Observable data model for biometry and doppler, superseding the flat-field model described in §3.2. Section 12 also **supersedes** the "pixel-for-pixel identical user experience" bullet in §9: the exam type selector and fetus count selector on the Create Examination form are intentionally redesigned.

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

### 3.2 Proposed evolution: generalized fetus array with Observable measurements

The user has proposed following generalisations:

1. **Fetus array** — instead of named positions (`biometry` for fetus 1, `biometry2` for fetus 2), all fetus-specific data lives as an **array of fetus objects** inside the `data` blob. Array length encodes fetus count.
2. **Observable array for measurements** — instead of a flat object with `bpd`, `bpdPercentile`, `bpdPercentileIsManual`, `bpdGa`, `bpdGaIsManual` as sibling keys, each measurement is an **observable object** `{ type, value, percentile?, ga? }`. The full design is documented in §14.
3. **Unified section objects** — the `ft_` prefix is abolished. Both exam types share the same `biometry`, `doppler`, `anatomy`, and `ultrasoundFindings` keys inside each fetus. First-trimester measurements (`crl`, `nt`, `nb`, `puls`) and second-trimester measurements (`bpd`, `hc`, `ac`, `fl`, etc.) appear in the same `biometry` observable array, distinguished only by their `type` field. A separate `markers` key carries first-trimester soft markers.

#### Adopted `ExaminationData` shape

```json
{
  "pregnancyData": { "lastMenstrualPeriod": "...", "obstetricHistory": "...", "familyHistory": "..." },
  "comments": "...",

  "fetuses": [
    {
      "index": 0,
      "gaFromBiometry": { "value": "28w 3d" },
      "biometry": [
        { "type": "bpd", "value": 85.5, "percentile": { "value": 48 }, "ga": { "value": "28w 2d" } },
        { "type": "hc",  "value": 310.5, "percentile": { "value": 52 }, "ga": { "value": "28w 4d" } },
        { "type": "ac",  "value": 280.5, "percentile": { "value": 50 }, "ga": { "value": "28w 3d" } },
        { "type": "fl",  "value": 55.5,  "percentile": { "value": 49 }, "ga": { "value": "28w 1d" } },
        { "type": "efw", "value": 1450,  "percentile": { "value": 51 }, "ga": { "value": "28w 3d" } },
        { "type": "tcd", "value": 32.0,  "percentile": { "value": 50 }, "ga": { "value": "28w 2d" } },
        { "type": "cm",  "value": 11.2 },
        { "type": "nb",  "value": 5.8 }
      ],
      "doppler": [
        { "type": "pi",  "value": 1.25 },
        { "type": "ri",  "value": 0.65 },
        { "type": "cpr", "value": 1.6 }
      ],
      "ultrasoundFindings": { "presentation": "cephalic", "gender": "female", "heartRate": 145 },
      "anatomy": { "head": "normal", "brain": "normal", "heart": "normal" }
    },
    {
      "index": 1,
      "gaFromBiometry": { "value": "27w 5d" },
      "biometry": [
        { "type": "bpd", "value": 69.0, "percentile": { "value": 32 }, "ga": { "value": "27w 6d", "isManual": true } },
        { "type": "hc",  "value": 257.0, "percentile": { "value": 30 } }
      ],
      "doppler": [ { "type": "pi", "value": 1.08 } ],
      "ultrasoundFindings": { "presentation": "breech", "heartRate": 152 },
      "anatomy": { "head": "normal", "brain": "normal" }
    }
  ]
}
```

A first-trimester fetus uses the same shape — `crl`, `nt`, `nb`, `puls` appear as observables in `biometry`; soft markers go in a sibling `markers` object:

```json
{
  "index": 0,
  "gaFromBiometry": { "value": "12w 3d" },
  "biometry": [
    { "type": "crl",  "value": 55.5, "ga": { "value": "12w 3d" } },
    { "type": "nt",   "value": 1.8 },
    { "type": "nb",   "value": 2.1 },
    { "type": "puls", "value": 162 }
  ],
  "doppler": [
    { "type": "utADexPI", "value": 1.12 },
    { "type": "utASinPI", "value": 1.09 }
  ],
  "ultrasoundFindings": { "heartRate": 162, "umbilicalCord": "3 vessels" },
  "anatomy": { "head": "normal", "brain": "normal" },
  "markers": {
    "tricuspidRegurgitation": "absent",
    "abnormalDvFlow": "absent",
    "cordInsertion": "normal"
  }
}
```

#### Why this is better than the current named-position model

| Dimension | Current model | Adopted model |
|-----------|---------------|---------------|
| Adding a 3rd fetus | Add `biometry3`, `doppler3`, ... 7 new top-level columns | `fetuses[2]` — zero schema change |
| Adding a new measurement type | Add field to `BiometryData`, `bpdGa`, `bpdPercentile`, `bpdGaIsManual`, `bpdPercentileIsManual` — 4 keys per measurement | Add one observable entry `{ type, value }` — one key per measurement |
| `IsManual` flag co-location | `bpdPercentileIsManual` is a sibling key 20 positions away from `bpdPercentile` | `{ "type": "bpd", "percentile": { "value": 48, "isManual": true } }` — flag is on the sub-object it guards |
| `ft_` prefix distinction | `ft_biometry`, `ft_anatomy` separate from `biometry`, `anatomy` — exam type must be known to select the right key | All measurements in the same `biometry` array; `type` field distinguishes CRL from BPD |
| `twin2_*` prefix distinction | `twin2_ultrasound_findings`, `twin2_anatomy`, all `twin2_ft_*` | `fetuses[1].ultrasoundFindings`, `fetuses[1].anatomy` |
| Backend CRUD | 5 files each list 6+ named fields | Serialize/deserialize `data` as one JSON blob — zero per-field code |
| Frontend `formData` size | ~250 flat keys | `fetuses[i].biometry` observable array; `handleFetusChange(i, section, type, value)` |

#### Storage types — see §14.2 for authoritative definitions

> The `Observable`, `GaFromBiometry`, `FetusSectionData`, and `ExaminationData` interfaces are defined in full in **§14.2**. That section is the single authoritative source; do not duplicate or deviate from those definitions here.

#### Impact on top-level `Examination` interface

The following top-level fields are **removed** from `Examination`:

| Removed field | Moves to |
|---------------|----------|
| `biometry` | `data.fetuses[0].biometry` (Observable array) |
| `doppler` | `data.fetuses[0].doppler` (Observable array) |
| `gestationalAgeFromBiometry` | `data.fetuses[0].gaFromBiometry.value` |
| `biometry2` | `data.fetuses[1].biometry` (Observable array) |
| `doppler2` | `data.fetuses[1].doppler` (Observable array) |
| `gestationalAgeFromBiometry2` | `data.fetuses[1].gaFromBiometry.value` |

The following `data` blob keys are also **removed** entirely (absorbed into `fetuses[i]`):

| Removed `data` key | Moves to |
|--------------------|----------|
| `data.ultrasound_findings` | `fetuses[0].ultrasoundFindings` |
| `data.anatomy` | `fetuses[0].anatomy` |
| `data.twin2_ultrasound_findings` | `fetuses[1].ultrasoundFindings` |
| `data.twin2_anatomy` | `fetuses[1].anatomy` |
| `data.ft_biometry` | `fetuses[0].biometry` observables (`crl`, `nt`, `nb`, `puls`) |
| `data.ft_markers` | `fetuses[0].markers` |
| `data.ft_ultrasound` | `fetuses[0].ultrasoundFindings` |
| `data.ft_anatomy` | `fetuses[0].anatomy` |
| `data.ft_doppler` | `fetuses[0].doppler` observables |
| `data.twin2_ft_*` | `fetuses[1].*` equivalents |

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

With the fetus array + Observable model, `formData` becomes:

```typescript
// Defined in full in §15.2 — reproduced here for orientation
interface ExaminationFormData {
  // Entity-level fields (unchanged)
  patientId: string;
  examinationDate: string;
  examinationType: 'prenatal' | 'first_trimester';
  fetusCount: number;                    // runtime state; not in config
  last_menstrual_period: string;         // YYYY-MM-DD
  gestationalAge: AutoCalcValue<string>; // Clinical GA + override flag
  clinicalNotes: string;
  recommendations: string;
  fetuses: FetusSectionFormData[];
}

// One entry per fetus — identical shape for both exam types
// Defined in full in §15.2
interface FetusSectionFormData {
  gaFromBiometry: AutoCalcValue<string>; // composite GA + override flag

  // Observable maps — keyed by measurement type string
  // biometry holds both prenatal (bpd/hc/ac/fl/…) and FT (crl/nt/nb/puls) measurements
  // The active key set is determined by examinationType via EXAM_TYPE_CONFIG
  biometry: ObservableFormMap;   // Record<string, ObservableFormFieldState>
  doppler:  ObservableFormMap;

  // Descriptive sections — plain keyed objects, same for both exam types
  ultrasoundFindings: Record<string, string>;
  anatomy:  Record<string, string>;
  markers?: Record<string, string>;  // first_trimester only
}
```

`ObservableFormMap` is `Record<string, ObservableFormFieldState>` where each entry is:

```typescript
// Defined in full in §15.2
interface ObservableFormFieldState {
  value: AutoCalcValue<string>;      // value string + isManual flag (EFW only)
  percentile?: AutoCalcValue<string>;// auto-calculated or overridden percentile
  ga?: AutoCalcValue<string>;        // auto-calculated or overridden single GA
}
```

The type string (e.g. `"bpd"`, `"crl"`) is the map **key**, not a field inside the object. This gives O(1) access by type and eliminates the `type` duplication that the array form required.

`useExaminationForm.ts` initialization becomes:

```typescript
const fetuses = Array.from({ length: fetusCount }, (_, i) =>
  buildFetusSectionFormData(examination?.data?.fetuses?.[i], examinationType)
);
```

`buildFetusSectionFormData` converts each stored `Observable` back into `ObservableFormFieldState` entries in an `ObservableFormMap`, reading `.value`, `.percentile?.value`, `.ga?.value` and their `isManual` fields. The function knows which `type` keys to initialise for each `examinationType` by consulting `EXAM_TYPE_CONFIG[examinationType].biometryTypes`. See §15.4.1 for the full implementation.

This completely eliminates the `t2_`, `ft_`, and `twin2_` flat-key duplication. Adding a third fetus, adding a new measurement type, or changing from prenatal to first-trimester all require zero structural change — only the `type` values in the `biometry` array differ.

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

`ExamPdfViewModel` in `print.service.ts` currently has optional `biometry2`, `doppler2`, `ultrasound2`, `anatomy2` fields and a parallel set of `twin2Ft*` fields. With the fetus array + Observable model, the view model mirrors the storage shape directly:

```typescript
export interface ExamPdfViewModel {
  // ... entity-level fields ...
  fetuses: FetusPdfViewModel[];  // replaces all twin2* and ft* optional fields
}

// Identical structure for both prenatal and FT — section keys are the same;
// the biometry array contents differ by exam type
export interface FetusPdfViewModel {
  index: number;
  gaFromBiometry?: string;
  biometry?: ObservablePdfEntry[];   // prenatal: bpd/hc/…; FT: crl/nt/…
  doppler?: ObservablePdfEntry[];
  ultrasound?: Record<string, string | number>;
  anatomy?: Record<string, string>;
  markers?: Record<string, string>;  // FT only
}

interface ObservablePdfEntry {
  type: string;
  value: number | string;
  percentile?: number;
  ga?: string;
}
```

`viewModelBuilders.ts` iterates `exam.data.fetuses`, maps each `Observable` storage entry to `ObservablePdfEntry` (stripping `isManual` flags — not needed in the view model). `pdfDocument.ts` iterates `vm.fetuses` with no `isTwins` / `isFt` branches. The PDF renderer uses `type` to select the correct row label and unit string from a lookup table.

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
| `isTwins`, `isFt`, `isFtTwinsMode` | Boolean flags derived from type | Redundant derivation, implicit coupling | Replaced by `formData.fetusCount` (runtime state) and `examConfig.trimester` (from `EXAM_TYPE_CONFIG`) |
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

> **Superseded by Q1 (§10):** The three-phase dual-write approach originally proposed below was considered during drafting but rejected at design confirmation. The adopted strategy is a **single atomic deployment** — see §8.1 (Adopted) immediately below.

**~~Migration approach — dual-write period (REJECTED):~~**

1. ~~**Phase 1 — Dual-write:** `CreateExamination` and `UpdateExamination` write data to both the old top-level columns AND the new `data.fetuses` array. Reads prefer `data.fetuses` with fallback to legacy top-level columns. Existing records continue to work without migration.~~

2. ~~**Phase 2 — Migration script:** A one-time script iterates every entity in the `EXAM` partition, reads the legacy top-level fields, migrates them into `data.fetuses`, and rewrites the entity. Old top-level columns are cleared.~~

3. ~~**Phase 3 — Remove dual-write:** After all records are migrated, remove the legacy column read/write paths.~~

**Migration approach — single atomic deployment (ADOPTED — confirmed in Q1):**

The migration script runs as part of the deploy in a single coordinated step (ST-09). There is no dual-write period:

1. **Pre-deploy:** All frontend and backend changes are built and ready (ST-01 through ST-08 complete).
2. **Deploy step — ST-09:** The migration script runs immediately on deployment: Pass 1 migrates flat biometry fields → `data.fetuses` Observable arrays; Pass 2 rewrites `examinationType` values from the 4-value set to the 2-value set. All legacy column read/write paths are removed in the same change.
3. **Post-deploy:** The application reads exclusively from `data.fetuses`. No legacy fallback path exists.

This approach is safe because the migration script and the new code ship together atomically — there is no window where new code runs against unmigrated data. A rollback must also restore the previous data shape (covered by the deployment runbook, not this document).

### 8.2 No table schema changes required

Azure Table Storage is schemaless — removing properties from entities does not require a table alteration. Entities can have different property sets without error. The migration only changes the content of existing rows.

### 8.3 No dual-write compatibility layer

~~During Phase 1, the API returns examination data with both old top-level fields and new `data.fetuses`. The frontend can be updated to read from `data.fetuses` exclusively before the backend migration script runs (backward-compatible read path: `exam.data?.fetuses?.[0]?.biometry ?? exam.biometry`).~~

Because the adopted strategy is a single atomic deployment (§8.1), no dual-write compatibility layer is implemented. The frontend reads exclusively from `data.fetuses` from the moment the new code is live. The backward-compatible fallback path (`exam.data?.fetuses?.[0]?.biometry ?? exam.biometry`) is **not** introduced.

---

## 9. What Does NOT Change

The following are explicitly out of scope for this refactoring sprint:

- Business logic for medical calculations (`calculations.ts`) — no formula changes
- API route structure — all existing routes remain unchanged
- Authentication and authorization flow — no changes to JWT, cookies, RBAC
- Patient management functions — no changes beyond the KI fixes above
- Audit log schema
- ~~The four existing examination types~~ — **superseded by §12**: the four `examinationType` values are consolidated to two (`prenatal`, `first_trimester`); fetus count becomes a separate runtime parameter. No new measurement types are added.
- Examination form measurement sections — all medical measurement fields (biometry, doppler, anatomy, ultrasound findings, markers) retain their existing visual layout and section structure. The refactoring does not add, remove, or reorder measurement fields. **Exceptions (intentional changes):** the exam type selection control and fetus count selector on the Create Examination form are redesigned (§12.3.4); column headers generalize from "Twin 1/2" to "Fetus N" (§12.3.5); the layout container for fetus sections changes from CSS grid to flex-row with horizontal scroll for N > 2 fetuses (§13.3); the exam type summary label in the detail page and PDF header is reformatted as a type + fetus count composite string (§12.3.6, §12.3.9).

  > **Parity scope:** The parity guarantee applies to the medical content of the form — what a clinician enters and what appears on the printed report. It does not apply to the selection controls that configure an examination before measurements are entered, nor to the CSS layout mechanism used to render multiple fetus columns. These are intentionally changed as documented in §12 and §13.
- PDF content — all fields continue to appear on the PDF

---

## 10. Open Questions for Design Confirmation

Before writing the implementation plan, the following questions must be answered:

**Q1 — RESOLVED:** Single atomic deployment. The migration script runs as part of the deploy; no dual-write period. ST-09 contains the script and the removal of all legacy column paths in a single coordinated change.

**Q2 — RESOLVED:** Only per-fetus values at `fetuses[i].ga_from_biometry`. There is no `data.ga_from_biometry` top-level field. Consumers (detail page, PDF, form) compute the composite string `"28w 3d / 27w 5d"` on read by joining `fetuses.map(f => f.ga_from_biometry).join(' / ')`.

**Q3 — RESOLVED:** Add a new `handleFetusChange(index, section, field, value)` handler alongside the existing `handleChange`. Section components receive whichever handler is appropriate based on whether they are fetus-specific (indexed) or entity-level (flat). The existing `handleChange` signature is preserved for entity-level fields (examDate, status, LMP, comments, etc.).

**Q4 — SUPERSEDED by §12.3.3:** `fetusSectionCount` is **not** in `EXAM_TYPE_CONFIG`. It is a separate piece of runtime state (`fetusCount` in `ExaminationFormData`) chosen by the user on the create form and stored implicitly as `data.fetuses.length`. `EXAM_TYPE_CONFIG` contains only static type metadata (`label`, `trimester`, `biometryTypes`, `dopplerTypes`). See §12.3.3 for the authoritative definition.

**Q5 — RESOLVED:** The directory restructuring (§5) runs **last** as ST-10, not before. New files created during ST-03 onwards are placed directly in the target directory structure. Existing files remain in their current locations and are moved in ST-10 via `git mv` with an automated import-path update pass. This keeps every functional sub-task reviewable against familiar paths and avoids a merge-conflict landmine from a mass rename mid-sprint.

---

## 11. Proposed Sub-Task Breakdown (Draft)

The following is a draft sequencing for the implementation plan. Each sub-task is independently deployable with no broken intermediate state.

| # | Sub-task | Scope | Depends on |
|---|----------|-------|------------|
| ST-01 | Quick fixes — KI-006 audit logging, KI-007 Joi TLD, label unification | Backend only | — |
| ST-02 | Storage layer improvements — `TableClient` cache, `ensureTableExists` cache, `primaryRowKey` stored on lookup entity | Backend only | — |
| ST-03 | Extract shared serializer utilities — `deserializeExamination`, `serializeExaminationFields`, `ExaminationCreateRequest` / `ExaminationUpdateRequest` types | Backend only | ST-02 |
| ST-04 | Type model update — introduce `FetusSectionData` with `Observable[]` biometry/doppler, `ExaminationData.fetuses`, remove top-level promoted fields; remove legacy flat types (`BiometryData`, `DopplerData`, `FtBiometry`, etc.) | Backend + shared types | ST-03 |
| ST-05 | Frontend form state refactor — replace flat `t2_` keys with `formData.fetuses[i]` array using `ObservableFormMap` / `ObservableFormFieldState` / `AutoCalcValue<string>` shape (§15.2); replace `BiometrySection` + `FirstTrimesterSection` with `ObservableSection`; implement `computeObservableDerivedFields` with EFW cascade rule (§14.5/§15.3.2); add `fetusCount` runtime state and `handleFetusCountChange` | Frontend only | ST-04 |
| ST-06 | Implement `EXAM_TYPE_CONFIG` in `examinationTypes.ts` — replaces `SECTION_VISIBILITY`; each entry has `label`, `trimester`, `biometryTypes: readonly ObservableTypeConfig[]`, `dopplerTypes: readonly ObservableTypeConfig[]`; `fetusSectionCount` is **not** in config; reduces from 4 entries to 2 (`prenatal`, `first_trimester`) | Frontend only | ST-05 |
| ST-07 | Config-driven rendering — refactor `ExaminationForm.tsx` to iterate `config.biometryTypes` / `config.dopplerTypes` via `ObservableSection`; remove `isFt` / `isTwins` branches; generalize column headers to "Fetus N"; add fetus count selector to create form (read-only on edit); screen layout: flex row + `min-width: 480px` + `overflow-x: auto` (§13.3) | Frontend only | ST-06 |
| ST-08 | View model refactor — update `ExamPdfViewModel`, `viewModelBuilders.ts`, `pdfSections.ts` to use `fetuses[]`; extract `drawCommonSections`, `chunkFetuses`, `computePairLayout`; replace linear builder with pair-loop (§13.4); `renderClinicalSections` takes `pair[]` + `PairLayout`; exam title includes fetus count | Frontend only | ST-07 |
| ST-09 | Migration script + cleanup — Pass 1: flat biometry → Observable arrays; Pass 2: `examinationType` 4-value → 2-value rewrite; remove all legacy column paths | Backend only | ST-08 |
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

The `EXAM_TYPE_CONFIG` proposed in §3 (ST-06) has two entries. With the Observable model, there is no `sections` list — both exam types render the same four section keys (`biometry`, `doppler`, `ultrasoundFindings`, `anatomy`), because the `ft_` distinction no longer exists at the section level. The `examinationType` tells the form which `ObservableTypeConfig` entries to populate in the `biometry` observable map, not which section components to show.

`biometryTypes` and `dopplerTypes` are `readonly ObservableTypeConfig[]` — each element carries the full metadata needed to render and calculate a row (`type`, `label`, `unit`, `hasPercentile`, `hasGa`). The code sample below shows the shape; actual label/unit values are defined in full in `examinationTypes.ts` (ST-06):

```typescript
// Authoritative interface (defined in frontend/src/constants/examinationTypes.ts)
export interface ObservableTypeConfig {
  type: string;          // canonical key: "bpd", "crl", etc.
  label: string;         // display label: "BPD", "CRL", etc.
  unit: string;          // unit string: "mm", "g", "bpm", etc.
  hasPercentile: boolean;// whether a percentile column is rendered and calculated
  hasGa: boolean;        // whether a GA column is rendered and calculated
}

export interface ExamTypeConfig {
  label: string;                              // display label for the exam type
  trimester: 'first' | 'second';             // controls markers block visibility
  biometryTypes: readonly ObservableTypeConfig[];
  dopplerTypes: readonly ObservableTypeConfig[];
  // fetusSectionCount is NOT here — it is runtime state in ExaminationFormData.fetusCount
}

export const EXAM_TYPE_CONFIG: Record<string, ExamTypeConfig> = {
  prenatal: {
    label: 'Prenatal',
    trimester: 'second',
    biometryTypes: [
      { type: 'bpd', label: 'BPD', unit: 'mm', hasPercentile: true, hasGa: true },
      // ... full list in examinationTypes.ts (§14.3)
    ],
    dopplerTypes: [
      { type: 'pi', label: 'PI', unit: '', hasPercentile: false, hasGa: false },
      // ...
    ],
  },
  first_trimester: {
    label: 'First Trimester',
    trimester: 'first',
    biometryTypes: [
      { type: 'crl', label: 'CRL', unit: 'mm', hasPercentile: false, hasGa: true },
      // ...
    ],
    dopplerTypes: [
      { type: 'utADexPI', label: 'UtA Dex PI', unit: '', hasPercentile: false, hasGa: false },
      // ...
    ],
  },
};
```

**`fetusSectionCount` is not in `EXAM_TYPE_CONFIG`**. It is a separate piece of runtime state (`fetusCount` in `ExaminationFormData`) set by the user on the create form and stored implicitly as `data.fetuses.length`. The config no longer determines how many fetus columns appear — the user does. The `markers` block is rendered when `config.trimester === 'first'` — not via a separate section key.

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
| Screen — 1 fetus | Single-column layout — visual output unchanged; CSS implementation changes from grid to flex (§13.3) |
| Screen — 2 fetuses | Two-column side-by-side — visual output unchanged; CSS implementation changes from grid to flex (§13.3) |
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

`colW` is **always 88 mm** regardless of how many fetuses are on the page. Every page is treated as a two-column grid; a lone fetus always occupies the left column only. This keeps column width — and therefore all measurement table widths, font sizes, and padding — identical across every page of the report, which makes multi-page reports easy to read.

Define `computePairLayout(pairLength: 1 | 2): PairLayout`:
```typescript
interface PairLayout {
  colW:   number;   // mm per fetus column — always 88
  xStart: number[]; // mm X anchor for each fetus (length = pairLength)
  xEnd:   number[]; // mm right edge for each fetus column
}
```
- `pairLength = 1`: `colW = 88`, `xStart = [14]`, `xEnd = [102]` — left column only; right half of page is blank
- `pairLength = 2`: `colW = 88`, `xStart = [14, 108]`, `xEnd = [102, 196]` — same as current twin layout

Examples across fetus counts:
```
1 fetus  → page 1: [F1, —]
2 fetuses → page 1: [F1, F2]
3 fetuses → page 1: [F1, F2]  page 2: [F3, —]
4 fetuses → page 1: [F1, F2]  page 2: [F3, F4]
```

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
| ST-08 | PDF: extract `drawCommonSections`, `drawClinicalInformation`, `drawSignatureLine`, `drawFooter` from the linear builder body; add `chunkFetuses` and `computePairLayout`; replace linear flow with pair-loop; `renderClinicalSections` takes `pair[]` + `PairLayout` instead of `isTwins` + hard-coded X constants; `colW` is always 88 mm — a lone fetus occupies the left column only, right half blank; exam title includes fetus count |
| ST-08 | `PdfDrawHelpers` interface: remove `TWIN_COL_W`, `T1_X`, `T2_X`; add `layout: PairLayout` |
| ST-08 | `viewModelBuilders.ts`: exam title computed from type + fetus count; no `isTwins` / `isFtTwins` branches |

---

## 14. Observable Data Model — Design Reference

> **Status:** Adopted. This section is the authoritative definition of how measurement data is stored, typed, and processed. §3.2 provides the high-level rationale and JSON examples; §14 defines the TypeScript interfaces and all encoding, semantics, and calculation rules.

### 14.1 Motivation

The current codebase stores measurements as flat named fields at the top level of `Examination` (`biometry`, `biometry2`, `doppler`, `doppler2`) and inside the `data` blob with keys like `ft_biometry`, `ft_anatomy`, `twin2_ultrasound_findings`. Each measurement expands into four parallel flat keys (`bpdPercentile`, `bpdPercentileIsManual`, `bpdGa`, `bpdGaIsManual`). Three problems follow:

1. **`IsManual` flag co-location** — `bpdPercentileIsManual` and `bpdPercentile` are structurally unrelated siblings; the guarding relationship is encoded only in the naming convention.
2. **`ft_` prefix duplication** — first-trimester and prenatal sections remain separate keys; code must branch on exam type to select the correct key set.
3. **Adding a new measurement** — requires adding 4 flat keys per measurement (`value`, `*Percentile`, `*PercentileIsManual`, `*Ga`, `*GaIsManual`), touching the type definition, the form initializer, the serializer, the auto-calc hook, and the PDF section renderer.

The Observable model (introduced in §3.2 and fully specified here) resolves all three.

### 14.2 Core Types

```typescript
// A single measurement with all its derived quantities co-located
interface Observable {
  type: string;            // canonical measurement key: "bpd", "hc", "crl", "pi", etc.
  value: number | string;  // raw measurement value (number for mm/grams/bpm; string for free-text like "vp", "la")
  isManual?: boolean;      // ONLY set on EFW — value is auto-derived from BPD/HC/AC/FL
                           //   (Hadlock 4-param formula). true when user typed EFW directly,
                           //   bypassing the auto-calc; false (or absent) when auto-computed.
                           //   Never set on any other measurement type.
  percentile?: {
    value: number;         // integer [1–99]
    isManual?: boolean;    // true when user overrode; false or absent when auto-calculated
  };
  ga?: {
    value: string;         // "Xw Yd" — GA derived from this single measurement
    isManual?: boolean;    // true when user overrode; false or absent when auto-calculated
  };
}

// Fetus-level composite GA — summarises all biometry observables
interface GaFromBiometry {
  value: string;    // "Xw Yd" — composite (e.g. from BPD/HC/AC/FL for prenatal; from CRL for FT)
  isManual?: boolean; // true when user manually set; false or absent when auto-calculated
}

export interface FetusSectionData {
  index: number;
  gaFromBiometry?: GaFromBiometry;
  biometry?: Observable[];                               // see §14.3 for type sets per exam type
  doppler?: Observable[];                                // see §14.3
  ultrasoundFindings?: Record<string, string | number>; // purely descriptive — no auto-calc
  anatomy?: Record<string, string>;                     // purely descriptive free-text
  markers?: Record<string, string>;                     // first_trimester only: soft markers
}

export interface ExaminationData {
  pregnancyData?: {
    lastMenstrualPeriod?: string;  // YYYY-MM-DD
    obstetricHistory?: string;
    familyHistory?: string;
  };
  comments?: string;
  fetuses: FetusSectionData[];     // length = fetus count; index 0 = fetus 1, etc.
}
```

### 14.3 Observable Type Sets per Exam Type

`EXAM_TYPE_CONFIG` declares which `type` strings appear in the `biometry` and `doppler` arrays for each exam type. The arrays for both types share the same `Observable` structure — only the `type` values differ.

#### `prenatal` — biometry observables

| type | Has percentile formula? | Has GA formula? | value is derived? |
|---|---|---|---|
| `bpd` | ✓ Hadlock 1984 | ✓ Hadlock 1984 | ✗ |
| `ofd` | ✓ Hadlock 1984 | ✓ Newton-Raphson | ✗ |
| `hc` | ✓ Hadlock 1984 | ✓ Hadlock 1984 | ✗ |
| `ac` | ✓ Hadlock 1984 | ✓ Hadlock 1984 | ✗ |
| `fl` | ✓ Hadlock 1984 | ✓ Hadlock 1984 | ✗ |
| `efw` | ✓ Combs 1993 | ✓ inverse EFW | ✓ Hadlock 4-param — `isManual` when user typed directly |
| `tcd` | ✓ Chang 2000 | ✓ Chang 2000 | ✗ |
| `tad` | ✗ | ✗ | ✗ — manual entry only |
| `apad` | ✗ | ✗ | ✗ — manual entry only |
| `cm` | ✗ | ✗ | ✗ |
| `nuchalFold` | ✗ | ✗ | ✗ |
| `nb` | ✗ | ✗ | ✗ |
| `lc` | ✗ | ✗ | ✗ |
| `la` | ✗ | ✗ | ✗ — free-text string |
| `vp` | ✗ | ✗ | ✗ — free-text string |

#### `prenatal` — doppler observables (no formulas — all manual entry)

`pi`, `ri`, `utADexPI`, `utADexRI`, `utASinPI`, `utASinRI`, `cma`, `psv`, `cpr`, `ducVen`

#### `first_trimester` — biometry observables

| type | Has GA formula? | Notes |
|---|---|---|
| `crl` | ✓ Robinson 1975 | `isManual` on `crl` itself is not applicable; `isManual` on `crl.ga` when user overrides the auto-calculated GA from CRL |
| `nt` | ✗ | Nuchal Translucency — manual |
| `nb` | ✗ | Nasal Bone — manual |
| `puls` | ✗ | Fetal heart rate — manual |

#### `first_trimester` — doppler observables

`utADexPI`, `utADexRI`, `utASinPI`, `utASinRI`

#### `first_trimester` — markers (not observables — no numeric value)

Stored as `fetuses[i].markers: Record<string, string>` with keys: `arrhythmia`, `tricuspidRegurgitation`, `abnormalDvFlow`, `echogenicCardiacFocus`, `singleUmbilicalArtery`, `choroidPlexusCysts`, `exomphalos`, `megacystis`, `placenta`, `cordInsertion`.

### 14.4 Encoding Rules (Storage)

1. **Absent fields are omitted** — a measurement not entered produces no entry in the array. An observable with no `percentile` or `ga` just has `{ type, value }`.
2. **`isManual` is a boolean field** — `true` means the user manually entered or overrode the value; `false` (or the field's absence) means the value was auto-calculated or is not applicable. Both `true` and `false` are valid stored values. The field may be omitted when not applicable (e.g. non-EFW observables never store `isManual` on the root value).
3. **`gaFromBiometry` at fetus level** — the composite GA shown in the section header. Present for both exam types when entered or auto-calculated. Guards its own `isManual` independently of any single measurement's `ga.isManual`.
4. **No `ft_` prefix anywhere** — the `examinationType` on the `Examination` entity is the only indicator of which `type` values to expect in the `biometry` array.
5. **`ultrasoundFindings`, `anatomy`, `markers` remain plain objects** — they contain only user-entered descriptive strings/numbers, never auto-calculated values, so the Observable wrapper adds no value there.

### 14.5 `IsManual` Semantics Summary

| Field | What it guards | Who sets it |
|---|---|---|
| `Examination.gestationalAgeIsManual` | `gestationalAge` (from LMP) — entity top level | `handleChange('gestationalAge', ...)` — `true` when user typed directly; `false` when auto-calculated from LMP |
| `fetuses[i].gaFromBiometry.isManual` | Composite GA from all biometry of this fetus | `handleFetusChange(i, 'gaFromBiometry', value)` — `true` when user typed directly; `false` when auto |
| `fetuses[i].biometry[j].isManual` | The `value` of observable `j` (EFW only in prenatal) | `handleFetusChange(i, 'biometry', type, 'value', ...)` — `true` when user types EFW directly; `false` when Hadlock auto-calc runs |
| `fetuses[i].biometry[j].ga.isManual` | The per-measurement GA of observable `j` | `handleFetusChange(i, 'biometry', type, 'ga', ...)` — `true` when user typed directly; `false` when auto-calculated |
| `fetuses[i].biometry[j].percentile.isManual` | The percentile of observable `j` | `handleFetusChange(i, 'biometry', type, 'percentile', ...)` — `true` when user typed directly; `false` when auto-calculated |

When a source measurement (`value`) changes, all dependent `isManual` flags on the same observable are reset to `false`. This is the same dependency-reset logic as the current `measurementManualDependencies` map in `handleChange`, re-expressed per observable.

#### EFW cascade rule (NEW — not present in current codebase)

EFW is the only observable whose `value.isManual` flag cascades to its sibling flags. The auto-calc hook must enforce the following rules:

**Rule 1 — Manual EFW entry cascades to percentile and GA**

When the user types directly into the EFW field:
- `efw.isManual = true`
- `efw.percentile.isManual = true` ← forced, regardless of stored value
- `efw.ga.isManual = true` ← forced, regardless of stored value
- `efw.percentile.value` and `efw.ga.value` are **not recalculated** — they retain whatever value they currently hold

**Rule 2 — Auto-recalculation of EFW (source measurement changes) resets all three**

When BPD, HC, AC, or FL changes and `autoEfw` is recomputed:
- `efw.isManual` → absent (cleared)
- `efw.percentile.isManual` → absent (cleared)
- `efw.ga.isManual` → absent (cleared)
- All three values are recalculated fresh from `autoEfw` and GA-from-LMP

**Rule 3 — Manual edit of efwPercentile or efwGa is independent**

When the user types directly into the EFW percentile or EFW GA field:
- Only that field's `isManual` flag is set
- `efw.isManual` and the other sibling flag are **not affected**

**Implementation note for the auto-calc hook**

The cascade is enforced at **read time** in `computeObservableDerivedFields` (the new-model equivalent of `computeBiometryDerivedFields`). Using the `ObservableFormFieldState` / `AutoCalcValue<string>` form-state shape (§15.2), the guard for EFW percentile and EFW GA must be:

```typescript
// efwField: ObservableFormFieldState  (from ObservableFormMap['efw'])
// Suppress recalculation of efwPercentile if EITHER its own flag OR efwField.value.isManual is true
if (!efwField.percentile?.isManual && !efwField.value.isManual) { /* recalculate */ }

// Suppress recalculation of efwGa if EITHER its own flag OR efwField.value.isManual is true
if (!efwField.ga?.isManual && !efwField.value.isManual) { /* recalculate */ }
```

This virtual override means `efwField.value.isManual = true` acts as an implicit `true` for the other two fields without writing them to storage. The stored flags (`efwField.percentile.isManual`, `efwField.ga.isManual`) may independently be `true` even when `efwField.value.isManual` is `false` (Rule 3). See §15.3.2 for the full implementation.

> **Gap in current code:** The existing `useBiometryAutoCalc.ts` checks only `!input.efwPercentileIsManual` and `!input.efwGaIsManual` — it does not apply the `efwField.value.isManual` virtual override. The new hook must fix this.

### 14.6 Form State (`ObservableFormFieldState`) and Storage (`Observable`) Mapping

React form inputs require scalar string values. The `Observable` storage type and the `ObservableFormFieldState` form type map one-to-one but at different layers. The type string is the **map key** in form state, not a field inside the object.

```
Storage Observable              Form state: ObservableFormMap["bpd"]
────────────────────────────    ────────────────────────────────────────
{ type: "bpd" }                 key: "bpd"
  value: 85.5                     value:     { value: "85.50", isManual: false }  ← toFixed(2)
  percentile: {                   percentile: { value: "48",    isManual: true  }  ← toString()
    value: 48,
    isManual: true
  }
  ga: { value: "28w 2d",          ga:         { value: "28w 2d", isManual: false }
        isManual: false }
```

In form state, `isManual` is always an explicit boolean — never inferred from presence or absence. `false` and `true` are both present and meaningful in `ObservableFormFieldState`. Storage is different: `buildSubmitPayload` omits `isManual` when it is `false`; absence in storage is always read back as `false`.

`buildFetusSectionFormData(storedFetus, examinationType)` produces the full `ObservableFormMap` by:
1. Looking up `EXAM_TYPE_CONFIG[examinationType].biometryTypes` to get the ordered `ObservableTypeConfig[]` list.
2. For each type, finding the matching stored `Observable` (if any) and converting scalar values to strings wrapped in `AutoCalcValue<string>`.
3. For absent observables, producing an `ObservableFormFieldState` with empty-string `AutoCalcValue` defaults — so form rows always render for every configured type.
4. For any `isManual` flag absent in the stored `Observable` (storage omits `false`), materialising it as explicit `false` in the resulting `AutoCalcValue` — so form state never contains an undefined `isManual`.

See §15.4.1 for the full implementation of `buildFetusSectionFormData`.

`buildSubmitPayload(formFetus)` is the inverse: iterates the `ObservableFormMap`, filters entries whose `value.value` is empty, converts string values back to numbers where applicable, and writes `isManual` only when it is `true` (omitting `false` from storage to save bytes — the absence of `isManual` in storage is treated as `false` on read).

See §15.4.2 for the full implementation of `buildSubmitPayload`.

### 14.7 Impact on Sub-Tasks (Amendment to §11 and §12.6)

The Observable model is an evolution of the fetus array model originally proposed in §3.2. It does not change the sub-task sequence but deepens the scope of ST-04 and ST-05:

| Sub-task | Amendment |
|---|---|
| ST-04 | `FetusSectionData` uses `Observable[]` for `biometry` and `doppler` instead of flat `BiometryData` / `DopplerData` objects. `BiometryData`, `DopplerData`, `FtBiometry`, `FtDoppler`, `FtMarkers`, `FtUltrasoundFindings` types are **removed** from `api/src/types/index.ts`. Migration script (Pass 1) converts existing flat `biometry` JSON objects to Observable arrays using the type-set table in §14.3. |
| ST-05 | `FetusSectionFormData` uses `ObservableFormMap` (`Record<string, ObservableFormFieldState>`) for `biometry` and `doppler`; `gaFromBiometry` becomes `AutoCalcValue<string>`. `BiometrySection` component is replaced by a generic `ObservableSection` component that renders rows from an `ObservableTypeConfig[]` prop driven by `EXAM_TYPE_CONFIG`. `FirstTrimesterSection` component is removed — FT measurements render through the same `ObservableSection` with the FT type list. The new `computeObservableDerivedFields` hook must implement the **EFW cascade rule** (§14.5): the guard for `efwPercentile` and `efwGa` recalculation must check `!efwField.value.isManual` in addition to each field's own `isManual` flag. This is a new requirement not present in the current `useBiometryAutoCalc.ts`. |
| ST-06 | `EXAM_TYPE_CONFIG` gains `biometryTypes: readonly ObservableTypeConfig[]` and `dopplerTypes: readonly ObservableTypeConfig[]`; does **not** contain `fetusSectionCount` (runtime state) or a `sections` array. The `SectionKey` union type and `SECTION_VISIBILITY` are removed. Config reduces from 4 entries to 2 (`prenatal`, `first_trimester`). The authoritative `ExamTypeConfig` interface is: `{ label: string; trimester: 'first' | 'second'; biometryTypes: readonly ObservableTypeConfig[]; dopplerTypes: readonly ObservableTypeConfig[] }`. |
| ST-07 | `ExaminationForm.tsx` rendering loop iterates `config.biometryTypes` to build the `ObservableSection` for each fetus. The `isFt` / `isTwins` branches are removed; the only remaining conditional is `config.trimester === 'first'` to decide whether to render the `markers` block. |
| ST-08 | `pdfSections.ts` renders biometry rows by iterating `fetus.biometry` observables and looking up label/unit from a static `OBSERVABLE_PDF_META` map keyed by `type`. No separate FT rendering path. |
| ST-09 | Migration Pass 1 converts flat biometry → Observable arrays. Pass 2 rewrites `examinationType` values. Both passes are unchanged in intent; Pass 1 logic is deeper. |


## 15. Suggested Implementation

This section provides an end-to-end design and code blueprint for the UI `formData` state management, reactive calculation engine, and rendering architecture based on the Observable model.

### 15.1 Architectural Overview & Layer Specialization

The implementation strictly separates concerns by layer:
- **Storage Layer (`Observable[]`)**: Compact, normalized array of measurement objects with omitted `undefined`s.
- **Form State Layer (`Record<string, ObservableFormFieldState>`)**: A typed, dictionary-based model optimized for $O(1)$ property access, controlled string inputs, and clean separation of values from calculation overrides.
- **Calculation Layer (`OBSERVABLE_CALC_REGISTRY`)**: A declarative formula registry driving reactive calculations dynamically without hardcoded loops or trimester branches.
- **UI Component Layer (`<ObservableSection />`)**: A unified, reusable component driven by configuration that replaces individual biometry/doppler/FT section implementations.

### 15.2 Core Data Types & `AutoCalcValue<T>` Value Object (`frontend/src/types/formData.ts`)

To avoid repeating parallel `xyz: string` and `xyzIsManual?: boolean` pairs across measurements, derived values, composite GA, and clinical GA, the form layer abstracts any field subject to auto-calculation or manual override into a generic **`AutoCalcValue<T>`** Value Object.

```typescript
/**
 * Generic Value Object encapsulating a value and its manual-override state.
 * Default type parameter is string (for controlled React inputs).
 */
export interface AutoCalcValue<T = string> {
  value: T;
  isManual?: boolean;
}

/** Helper factory for concise initializations */
export const autoCalc = <T = string>(value: T, isManual?: boolean): AutoCalcValue<T> => ({
  value,
  ...(isManual ? { isManual: true } : {})
});

/** Form state for a single measurement row */
export interface ObservableFormFieldState {
  value: AutoCalcValue<string>;      // Value itself (isManual is set only on EFW when typed directly)
  percentile?: AutoCalcValue<string>;// Auto-calculated or overridden percentile [1-99]
  ga?: AutoCalcValue<string>;        // Auto-calculated or overridden single GA ("Xw Yd")
}

export type ObservableFormMap = Record<string, ObservableFormFieldState>;

export interface FetusSectionFormData {
  biometry: ObservableFormMap;
  doppler: ObservableFormMap;
  ultrasoundFindings: UltrasoundFindingsFormData;
  anatomy: AnatomyFormData;
  markers?: MarkersFormData;             // First Trimester only
  gaFromBiometry: AutoCalcValue<string>; // Composite GA ("Xw Yd") + override flag
}

export interface ExaminationFormData {
  patientId: string;
  examinationDate: string;
  examinationType: 'prenatal' | 'first_trimester';
  fetusCount: number;                    // 1 to N
  last_menstrual_period: string;         // YYYY-MM-DD (drives gestationalAge auto-calc)
  gestationalAge: AutoCalcValue<string>; // Clinical GA from LMP ("Xw Yd") + override flag
  clinicalNotes: string;
  recommendations: string;
  fetuses: FetusSectionFormData[];
}
```

### 15.3 Declarative Calculation Registry & Dynamic Calculation Hook

#### 15.3.1 Formula Registry (`frontend/src/utils/observableRegistry.ts`)

```typescript
export interface ObservableCalculationDescriptor {
  calcGa?: (value: number) => string | undefined;
  calcPercentile?: (value: number, ga: string | number) => number | undefined;
  isDerivedValue?: boolean;
}

export const OBSERVABLE_CALC_REGISTRY: Record<string, ObservableCalculationDescriptor> = {
  // Prenatal standard biometry
  bpd: { calcGa: calcGAFromBPD, calcPercentile: calcBPDPercentile },
  hc:  { calcGa: calcGAFromHC,  calcPercentile: calcHCPercentile },
  ac:  { calcGa: calcGAFromAC,  calcPercentile: calcACPercentile },
  fl:  { calcGa: calcGAFromFL,  calcPercentile: calcFLPercentile },
  
  // Prenatal extended biometry (§14.3)
  ofd: { calcGa: calcGAFromOFD, calcPercentile: calcOFDPercentile },
  tcd: { calcGa: calcGAFromTCD, calcPercentile: calcTCDPercentile },
  
  // First trimester biometry (§14.3)
  crl: { calcGa: calcGAFromCRL },

  // Auto-derived multi-input measurement
  efw: {
    calcGa: calcGAFromEFW,
    calcPercentile: (val, ga) => calcEFWPercentile(val, ga),
    isDerivedValue: true
  }
};
```

#### 15.3.2 Dynamic Calculation Function (`computeObservableDerivedFields`)

```typescript
export function computeObservableDerivedFields(
  biometry: ObservableFormMap,
  clinicalGa: string | number | undefined
): Partial<ObservableFormMap> {
  const updates: Partial<ObservableFormMap> = {};

  // 1. Dynamic Pass: Iterate any populated observable present in the form state
  for (const [type, field] of Object.entries(biometry)) {
    const descriptor = OBSERVABLE_CALC_REGISTRY[type];
    if (!descriptor || descriptor.isDerivedValue || !field?.value?.value) continue;

    const numVal = parseFloat(field.value.value);
    if (isNaN(numVal)) continue;

    let updatedField: ObservableFormFieldState | undefined;

    // GA Calculation
    if (descriptor.calcGa && !field.ga?.isManual) {
      const calcGa = descriptor.calcGa(numVal);
      if (calcGa && calcGa !== field.ga?.value) {
        updatedField = { ...(updatedField ?? field), ga: autoCalc(calcGa, false) };
      }
    }

    // Percentile Calculation
    if (descriptor.calcPercentile && !field.percentile?.isManual && clinicalGa) {
      const calcPctl = descriptor.calcPercentile(numVal, clinicalGa);
      const pctlStr = calcPctl != null ? String(calcPctl) : '';
      if (pctlStr !== field.percentile?.value) {
        updatedField = { ...(updatedField ?? field), percentile: autoCalc(pctlStr, false) };
      }
    }

    if (updatedField) {
      updates[type] = updatedField;
    }
  }

  // 2. Composite Derived Values & EFW Cascade Guard (§14.5)
  const efwField = biometry['efw'] || {
    value: autoCalc(''),
    percentile: autoCalc(''),
    ga: autoCalc('')
  };

  if (!efwField.value.isManual) {
    const hadlockEfw = computeHadlockEFW(biometry);
    if (hadlockEfw != null) {
      const efwValStr = hadlockEfw.toFixed(0);
      const efwNum = parseFloat(efwValStr);
      const efwDescriptor = OBSERVABLE_CALC_REGISTRY['efw'];

      const efwPercentile = (!efwField.percentile?.isManual && clinicalGa && efwDescriptor?.calcPercentile)
        ? autoCalc(String(efwDescriptor.calcPercentile(efwNum, clinicalGa) ?? ''), false)
        : efwField.percentile;

      const efwGa = (!efwField.ga?.isManual && efwDescriptor?.calcGa)
        ? autoCalc(efwDescriptor.calcGa(efwNum) ?? '', false)
        : efwField.ga;

      updates['efw'] = {
        value: autoCalc(efwValStr, false),
        percentile: efwPercentile,
        ga: efwGa
      };
    }
  }

  return updates;
}
```

### 15.4 Bi-Directional Mapping: Form State $\leftrightarrow$ Storage

#### 15.4.1 Storage $\to$ Form State (`buildFetusSectionFormData`)

```typescript
export function buildFetusSectionFormData(
  storedFetus?: FetusSectionData,
  examType: 'prenatal' | 'first_trimester' = 'prenatal'
): FetusSectionFormData {
  const config = EXAM_TYPE_CONFIG[examType];

  const initMap = (types: readonly string[], storedList?: Observable[]): ObservableFormMap => {
    const lookup = new Map(storedList?.map(o => [o.type, o]));
    const map: ObservableFormMap = {};

    for (const type of types) {
      const stored = lookup.get(type);
      map[type] = {
        value: autoCalc(stored?.value != null ? String(stored.value) : '', stored?.isManual),
        percentile: autoCalc(stored?.percentile?.value != null ? String(stored.percentile.value) : '', stored?.percentile?.isManual),
        ga: autoCalc(stored?.ga?.value ?? '', stored?.ga?.isManual)
      };
    }
    return map;
  };

  return {
    biometry: initMap(config.biometryTypes.map(t => t.type), storedFetus?.biometry),
    doppler: initMap(config.dopplerTypes.map(t => t.type), storedFetus?.doppler),
    ultrasoundFindings: storedFetus?.ultrasoundFindings ?? {},
    anatomy: storedFetus?.anatomy ?? {},
    markers: storedFetus?.markers ?? {},
    gaFromBiometry: autoCalc(storedFetus?.gaFromBiometry?.value ?? '', storedFetus?.gaFromBiometry?.isManual)
  };
}
```

#### 15.4.2 Form State $\to$ Storage (`buildSubmitPayload`)

```typescript
export function buildSubmitPayload(formData: ExaminationFormData): ExaminationData {
  return {
    fetuses: formData.fetuses.map((f) => {
      const serializeMap = (map: ObservableFormMap): Observable[] =>
        Object.entries(map)
          .filter(([_, field]) => field.value.value.trim() !== '')
          .map(([type, field]) => {
            const obs: Observable = {
              type,
              value: isNaN(Number(field.value.value)) ? field.value.value : parseFloat(field.value.value)
            };
            // Only EFW stores isManual on the root value (§14.2/§14.4)
            if (type === 'efw' && field.value.isManual) obs.isManual = true;
            
            if (field.percentile?.value.trim()) {
              obs.percentile = {
                value: parseInt(field.percentile.value, 10),
                ...(field.percentile.isManual ? { isManual: true } : {})
              };
            }
            if (field.ga?.value.trim()) {
              obs.ga = {
                value: field.ga.value,
                ...(field.ga.isManual ? { isManual: true } : {})
              };
            }
            return obs;
          });

      return {
        biometry: serializeMap(f.biometry),
        doppler: serializeMap(f.doppler),
        ultrasoundFindings: f.ultrasoundFindings,
        anatomy: f.anatomy,
        ...(formData.examinationType === 'first_trimester' ? { markers: f.markers } : {}),
        ...(f.gaFromBiometry.value ? {
          gaFromBiometry: {
            value: f.gaFromBiometry.value,
            ...(f.gaFromBiometry.isManual ? { isManual: true } : {})
          }
        } : {})
      };
    })
  };
}
```

### 15.5 UI Component Architecture

#### 15.5.1 `ObservableRow` Component

```tsx
// frontend/src/components/sections/ObservableRow.tsx
import React from 'react';
import { TextInput } from '@carbon/react';
import type { ObservableFormFieldState, AutoCalcValue } from '../../types/formData';
import type { ObservableTypeConfig } from '../../constants/examinationTypes';

interface ObservableRowProps {
  config: ObservableTypeConfig;
  fieldState: ObservableFormFieldState;
  idPrefix: string;
  disabled?: boolean;
  onChange: (field: keyof ObservableFormFieldState, next: AutoCalcValue<string>) => void;
}

export const ObservableRow: React.FC<ObservableRowProps> = React.memo(({
  config,
  fieldState,
  idPrefix,
  disabled = false,
  onChange
}) => {
  const { type, label, unit, hasPercentile, hasGa } = config;

  const valueLabel = `${label} (${unit})${
    type === 'efw' && fieldState.value.value ? (fieldState.value.isManual ? ' (manual)' : ' (auto)') : ''
  }`;
  const gaLabel = `${label} GA${
    fieldState.ga?.value ? (fieldState.ga.isManual ? ' (manual)' : ' (auto)') : ''
  }`;
  const pctlLabel = `${label} %${
    fieldState.percentile?.value ? (fieldState.percentile.isManual ? ' (manual)' : ' (auto)') : ''
  }`;

  return (
    <div className="observable-row-grid">
      <TextInput
        id={`${idPrefix}_value`}
        labelText={valueLabel}
        placeholder="0.0"
        value={fieldState.value.value}
        disabled={disabled}
        onChange={(e) => {
          const val = e.target.value;
          // Direct entry sets isManual = true on EFW
          onChange('value', {
            value: val,
            ...(type === 'efw' ? { isManual: val.trim() !== '' } : {})
          });
        }}
      />
      {hasPercentile ? (
        <TextInput
          id={`${idPrefix}_pctl`}
          labelText={pctlLabel}
          placeholder="1-99"
          value={fieldState.percentile?.value ?? ''}
          disabled={disabled}
          onChange={(e) => {
            const val = e.target.value;
            onChange('percentile', { value: val, isManual: val.trim() !== '' });
          }}
        />
      ) : <div className="observable-empty-cell" />}
      {hasGa ? (
        <TextInput
          id={`${idPrefix}_ga`}
          labelText={gaLabel}
          placeholder="e.g. 28w 2d"
          value={fieldState.ga?.value ?? ''}
          disabled={disabled}
          onChange={(e) => {
            const val = e.target.value;
            onChange('ga', { value: val, isManual: val.trim() !== '' });
          }}
        />
      ) : <div className="observable-empty-cell" />}
    </div>
  );
});
```

#### 15.5.2 `ObservableSection` Component

```tsx
// frontend/src/components/sections/ObservableSection.tsx
import React from 'react';
import { Section, Heading } from '@carbon/react';
import { ObservableRow } from './ObservableRow';
import type { ObservableFormMap, ObservableFormFieldState, AutoCalcValue } from '../../types/formData';
import type { ObservableTypeConfig } from '../../constants/examinationTypes';

interface ObservableSectionProps {
  title: string;
  fetusIndex: number;
  sectionKey: 'biometry' | 'doppler';
  typeConfigs: readonly ObservableTypeConfig[];
  data: ObservableFormMap;
  disabled?: boolean;
  onFieldChange: (
    fetusIndex: number,
    sectionKey: 'biometry' | 'doppler',
    type: string,
    field: keyof ObservableFormFieldState,
    next: AutoCalcValue<string>
  ) => void;
}

export const ObservableSection: React.FC<ObservableSectionProps> = React.memo(({
  title,
  fetusIndex,
  sectionKey,
  typeConfigs,
  data,
  disabled = false,
  onFieldChange
}) => {
  return (
    <Section className="observable-section">
      <Heading className="observable-section-heading">{title}</Heading>
      <div className="observable-section-list">
        {typeConfigs.map((config) => {
          const fieldState = data[config.type] || {
            value: { value: '' },
            percentile: { value: '' },
            ga: { value: '' }
          };
          return (
            <ObservableRow
              key={config.type}
              config={config}
              fieldState={fieldState}
              idPrefix={`f${fetusIndex}_${sectionKey}_${config.type}`}
              disabled={disabled}
              onChange={(field, next) =>
                onFieldChange(fetusIndex, sectionKey, config.type, field, next)
              }
            />
          );
        })}
      </div>
    </Section>
  );
});
```

#### 15.5.3 Layout Integration in `ExaminationForm.tsx`

```tsx
// Dynamic multi-fetus screen layout loop (§13.3)
{formData.fetuses.length === 1 && (
  <div className="single-fetus-layout">
    {renderFetusSections(0)}
  </div>
)}

{formData.fetuses.length === 2 && (
  <Grid className="twin-fetus-layout">
    <Column lg={8} md={4} sm={4}>
      <h3>Fetus A</h3>
      {renderFetusSections(0)}
    </Column>
    <Column lg={8} md={4} sm={4}>
      <h3>Fetus B</h3>
      {renderFetusSections(1)}
    </Column>
  </Grid>
)}

{formData.fetuses.length > 2 && (
  <Tabs>
    <TabList aria-label="Fetus Navigation">
      {formData.fetuses.map((_, idx) => (
        <Tab key={idx}>{`Fetus ${String.fromCharCode(65 + idx)}`}</Tab>
      ))}
    </TabList>
    <TabPanels>
      {formData.fetuses.map((_, idx) => (
        <TabPanel key={idx}>
          {renderFetusSections(idx)}
        </TabPanel>
      ))}
    </TabPanels>
  </Tabs>
)}
```
