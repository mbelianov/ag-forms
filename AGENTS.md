# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Critical Non-Obvious Patterns

### Architecture Decisions (Non-Standard)
- **Azure Table Storage instead of SQL** - All data uses partition/row keys, not relational joins
- **Client-side PDF generation** - Browser generates PDFs, not server (cost optimization)
- **Application-managed auth** - Custom user table, NOT Microsoft Entra ID
- **Reverse ticks for sorting** - Examination RowKeys use reverse ticks for descending chronological order
- **Lookup entity duplication** - Username and MRN require duplicate entities in different partitions

### Data Model (Critical Partition Keys)
- Users: `PartitionKey = USER`, lookup by `PartitionKey = USERNAME` (normalized lowercase)
- Patients: `PartitionKey = PATIENT`, lookup by `PartitionKey = MRN`
- Examinations: `PartitionKey = PATIENT_{patientId}` (enables efficient patient queries)
- Audit: `PartitionKey = AUDIT_{yyyyMM}` (time-based retention)
- Counters: `PartitionKey = COUNTER`, `RowKey = MRN_{YYYY}`

### Validation Rules (Non-Standard Ranges)
- Patient age: **2-99 years** (NOT 0-120)
- Biometry (BPD, HC, AC, FL, EFW): **MUST be integers** (use `parseInt`, NOT `parseFloat`)
- Doppler PI/RI: floats allowed
- Exam date: cannot be future
- Gestational age format: `"28w 3d"` (regex: `^\d{1,2}w\s?\d{1}d$`)

### MRN Generation (Optimistic Concurrency)
- Format: `MRN-{YYYY}-{NNNNNN}`
- Uses counter entity with ETag-based optimistic concurrency
- Retries up to 5 times with exponential backoff on conflict
- Counter resets yearly (separate counter per year)

### Authentication Implementation
- JWT tokens with 24h expiration
- Token extraction: checks `Authorization: Bearer` header THEN cookies
- Account lockout: 5 failed attempts = 30 min lockout
- Username normalization: ALWAYS lowercase before lookup
- Password min length: **12 characters** (not 8)

### Response Helpers (Standardized)
- ALWAYS use `successResponse()` and `errorResponse()` from `utils/responseHelpers.ts`
- NEVER expose error details to client (log server-side only)
- Generic error messages for security (e.g., "Invalid credentials" not "User not found")

### Testing (Jest Configuration)
- Tests in `src/tests/` directory (NOT `__tests__`)
- Run single test: `npm test -- path/to/test.test.ts`
- Coverage excludes `src/tests/**` directory

### Build/Run Commands (PowerShell Scripts)
- **3 terminals required** for local dev:
  1. `powershell -ExecutionPolicy Bypass -File ./start-azurite.ps1`
  2. `powershell -ExecutionPolicy Bypass -File ./start-functions.ps1`
  3. Frontend (when implemented)
- Azurite MUST bind to `127.0.0.1` (NOT `0.0.0.0`)
- Connection string: `UseDevelopmentStorage=true`

### TypeScript Quirks
- **`strict: false`** - Intentionally disabled (do NOT enable)
- **`rootDir: "."`** - Root is project root, not `src/`
- CommonJS modules (NOT ES modules)
- No top-level await support

### Azure Functions v4 Registration
- MUST call `app.http()` to register function
- Function name in `app.http()` becomes URL path
- Route parameter: `route: 'v1/auth/login'` creates `/api/v1/auth/login`
- Most endpoints should use `authLevel: 'function'` (NOT `anonymous`)

### Frontend (Vite + React)
- Vite proxy: `/api` → `http://localhost:7071`
- Server binds to `127.0.0.1:3000` (NOT `0.0.0.0`)
- API client auto-adds Bearer token from localStorage
- 401 responses auto-redirect to `/login`

### Security (Non-Negotiable)
- NEVER log passwords, tokens, or full medical payloads
- ALWAYS use ETag for updates (optimistic concurrency)
- Soft delete only: set `is_deleted = true`, never hard delete
- Generic error messages to clients (detailed logs server-side)

### Bulgarian Context
- УЗД = Ultrasound examination
- Medical terminology may be in Bulgarian