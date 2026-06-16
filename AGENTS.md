# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Critical Non-Obvious Patterns

### Architecture Decisions (Non-Standard)
- **Azure Table Storage instead of SQL** - All data uses partition/row keys, not relational joins
- **Client-side PDF generation** - Browser generates PDFs, not server (cost optimization)
- **Application-managed auth** - Custom user table, NOT Microsoft Entra ID
- **Reverse ticks for sorting** - Examination RowKeys use reverse ticks for descending chronological order
- **Triple entity creation** - Patient creation writes 3 entities: main patient, MRN lookup, and search entity (partitioned by first letter)

### Data Model (Critical Partition Keys)
- Users: `PartitionKey = USER`, lookup by `PartitionKey = USERNAME` (normalized lowercase)
- Patients: `PartitionKey = PATIENT`, lookup by `PartitionKey = MRN`
- Patient Search: `PartitionKey = PATIENT_SEARCH_{firstLetter}` (enables efficient name search)
- Examinations: `PartitionKey = PATIENT_{patientId}` (enables efficient patient queries)
- Audit: `PartitionKey = AUDIT_{yyyyMM}` (time-based retention)
- Counters: `PartitionKey = COUNTER`, `RowKey = MRN_{YYYY}`

### Validation Rules (Non-Standard Ranges)
- Patient age: **2-99 years** (NOT 0-120)
- Biometry (BPD, HC, AC, FL, EFW): **MUST be integers** (use `parseInt`, NOT `parseFloat`)
- Doppler PI/RI: floats allowed
- Gestational age format: `"28w 3d"` (regex: `^\d{1,2}w\s?\d{1}d$`)

### MRN Generation (Optimistic Concurrency)
- Format: `MRN-{YYYY}-{NNNNNN}`
- Uses counter entity with ETag-based optimistic concurrency
- Retries up to 5 times with exponential backoff on conflict
- Counter resets yearly (separate counter per year)

### Authentication Implementation
- Token extraction: checks `Authorization: Bearer` header THEN cookies
- Account lockout: 5 failed attempts = 30 min lockout
- Username normalization: ALWAYS lowercase before lookup
- Password min length: **12 characters** (not 8)

### Response Helpers (Mandatory)
- ALWAYS use `successResponse()` and `errorResponse()` from `utils/responseHelpers.ts`
- NEVER expose error details to client (log server-side only)

### Testing (Jest)
- Tests in `src/tests/` directory (NOT `__tests__`)
- Run single test: `npm test -- src/tests/utils/validation.test.ts`

### Build/Run (PowerShell Scripts)
- **3 terminals required**: `start-azurite.ps1`, `start-functions.ps1`, `start-frontend.ps1`
- Azurite MUST bind to `127.0.0.1` (NOT `0.0.0.0`)
- `npm start` automatically runs `prestart` (clean + build)

### TypeScript Configuration (Non-Standard)
- **`strict: false`** - Intentionally disabled (do NOT enable)
- **`rootDir: "."`** - Root is project root, not `src/`
- CommonJS modules (NOT ES modules) - no top-level await

### Azure Functions v4 Registration (CRITICAL)
- MUST call `app.http()` to register function or it won't be discovered
- Function name in `app.http()` becomes URL path
- Most endpoints should use `authLevel: 'function'` (NOT `anonymous`)

### Frontend (Vite + React)
- Server binds to `127.0.0.1:3000` (NOT `0.0.0.0`)
- Uses React 19 (NOT 18) - check for breaking changes
- TypeScript 6.0 (NOT 5.x)

### Security (Non-Negotiable)
- NEVER log passwords, tokens, or full medical payloads
- ALWAYS use ETag for updates (optimistic concurrency)
- Soft delete only: set `isDeleted = true`, never hard delete
- Generic error messages to clients (detailed logs server-side)

### Bulgarian Context
- УЗД = Ultrasound examination
- Medical terminology may be in Bulgarian