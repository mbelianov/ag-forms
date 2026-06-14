# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Project Context

This is an **Azure serverless prenatal ultrasound documentation system** with **partial implementation**. The repository contains architectural specifications, design documents, and initial Azure Functions backend code. Frontend is not yet implemented.

## Critical Non-Obvious Information

### Documentation Structure
- **УЗДv2.dotm** is the source Word template being replaced by this system
- **UZD.docx** is a related reference document
- All technical specs are in `docs/` directory with numbered prefixes (01-05)
- Documents are interdependent - read 01-architecture-overview.md first for context

### Architecture Decisions (Non-Standard)
- **Azure Table Storage instead of SQL** - All data modeling uses partition keys and row keys, not relational joins
- **Client-side PDF generation** - PDFs are generated in the browser, not server-side (reduces Azure costs)
- **Application-managed auth** - Custom user table in Azure Storage, not Microsoft Entra ID (Entra ID is future enhancement only)
- **Reverse ticks for sorting** - Examination RowKeys use reverse ticks for descending chronological order
- **Lookup entity duplication** - Username and MRN lookups require duplicate entities in different partitions

### Data Model Gotchas
- **Partition keys are critical** - Wrong partition key = slow queries
  - Users: `PartitionKey = USER`, lookup by `PartitionKey = USERNAME`
  - Patients: `PartitionKey = PATIENT`, lookup by `PartitionKey = MRN`
  - Examinations: `PartitionKey = PATIENT_{patientId}` for efficient patient queries
  - Audit: `PartitionKey = AUDIT_{yyyyMM}` for time-based retention
- **ETags required** - All updates must use optimistic concurrency with ETags
- **Soft delete mandatory** - Set `is_deleted = true`, never hard delete patients/exams
- **Denormalization allowed** - Patient name can be duplicated in examination entities for list views

### Security Requirements (Non-Negotiable)
- **No secrets in code** - All secrets in Azure Function App environment settings
- **TLS 1.2+ only** - No HTTP in production, no certificate validation bypass
- **Never bind to 0.0.0.0** - Use 127.0.0.1 or localhost for local services
- **Password hashing** - Argon2id preferred, bcrypt acceptable (never plaintext)
- **No sensitive data in logs** - Passwords, tokens, full medical payloads excluded
- **Input validation server-side** - Never trust client validation

### Medical Record Numbers (MRN)
- Format: `MRN-{YYYY}-{NNNNNN}`
- Generated using counter entity with optimistic concurrency
- Counter entity: `PartitionKey = COUNTER`, `RowKey = MRN_{YYYY}`

### Validation Rules (Non-Standard Ranges)
- Patient age: 2-99 years (not typical 0-120)
- Biometry fields (BPD, HC, AC, FL, EFW): must be integers, not floats
- Doppler PI/RI: numbers (floats allowed)
- Exam date: cannot be future date

### Email Delivery Pattern
- PDF generated client-side first
- User optionally submits PDF to Azure Function endpoint
- Function sends to patient's recorded email address
- No server-side PDF persistence unless compliance requires it

### Bulgarian Language Context
- УЗД = Ultrasound examination (Bulgarian abbreviation)
- Medical terminology may be in Bulgarian in source documents
- UI will likely need Bulgarian localization

## Current Implementation State

### What Exists
- ✅ Azure Functions v4 backend structure (`api/` directory)
- ✅ TypeScript configuration with **strict mode disabled** (`"strict": false`)
- ✅ HealthCheck function (sample HTTP trigger)
- ✅ PowerShell automation scripts for local development
- ✅ Azurite local storage emulator setup
- ❌ Frontend not implemented yet
- ❌ No actual business logic functions yet
- ❌ No tests yet

### Tech Stack (Actual)
- **Backend**: Azure Functions v4, Node.js (v24.13.1 in dev), TypeScript
- **Storage**: Azure Table Storage via `@azure/data-tables` v13.3.2
- **Local Dev**: Azurite emulator, Azure Functions Core Tools v4
- **Frontend**: Not yet implemented (planned: React 18+, IBM Carbon Design System, Vite)

### Critical Build/Run Commands

**IMPORTANT**: This project uses **PowerShell scripts** for local development, not standard npm scripts.

```bash
# Setup (one-time)
powershell -ExecutionPolicy Bypass -File ./setup-dev-environment.ps1

# Daily development (3 separate terminals required)
# Terminal 1: Start Azurite
powershell -ExecutionPolicy Bypass -File ./start-azurite.ps1

# Terminal 2: Start Azure Functions
powershell -ExecutionPolicy Bypass -File ./start-functions.ps1

# Terminal 3: Test
curl http://localhost:7071/api/HealthCheck

# Alternative: Manual commands
cd api
npm run build        # Compiles TypeScript (runs tsc)
npm run watch        # Watch mode (tsc -w)
npm run clean        # Remove dist/ directory (uses rimraf)
npm run prestart     # Clean + build (runs before start)
npm start            # Runs 'func start'
npm test             # Currently just echoes "No tests yet..."
```

### Non-Standard Patterns

#### TypeScript Configuration Gotchas
- **`strict: false`** - Strict mode is DISABLED in tsconfig.json
- **`rootDir: "."`** - Root is project root, not `src/`
- **`outDir: "dist"`** - Compiled output goes to `dist/`
- **CommonJS modules** - Uses `"module": "commonjs"`, not ES modules
- **ES6 target** - Compiles to ES6, not newer versions

#### Azure Functions v4 Model
- Uses **programming model v4** (not v3)
- Function registration pattern: `app.http('FunctionName', { ... })`
- Functions are in `src/functions/` directory
- Each function exports handler and registers with `app.http()`
- `authLevel: 'anonymous'` is used for HealthCheck (no auth required)

#### Local Development Quirks
- **Azurite must run on 127.0.0.1** (not 0.0.0.0) - security requirement
- **Azurite data persists** in `C:\azurite` directory (Windows-specific path)
- **Port 7071** is hardcoded for Azure Functions local runtime
- **Connection string**: `UseDevelopmentStorage=true` for local Azurite
- **local.settings.json** is gitignored and must be created locally

#### PowerShell Script Dependencies
- Scripts use `-ExecutionPolicy Bypass` to avoid policy restrictions
- `start-functions.ps1` checks if Azurite is running before starting
- `setup-dev-environment.ps1` installs global npm packages (azure-functions-core-tools@4, azurite)
- All scripts have "Made with Bob" comment at end

#### Package Management
- **No package-lock.json** - Explicitly gitignored (unusual choice)
- **rimraf** used for cross-platform directory deletion
- **dotenv** included but not yet used in code
- **@azure/identity** included for future managed identity support

### Infrastructure as Code
- Bicep preferred for Azure resources
- Terraform acceptable if multi-cloud standardization needed
- All infrastructure definitions should be in `infra/` directory (not yet created)

### Windows-Specific Considerations
- Development environment is **Windows 11** with PowerShell
- Azurite path uses Windows-style paths (`C:\azurite`)
- Scripts use PowerShell cmdlets (Test-Path, New-Item, Push-Location, etc.)
- Port checking uses `netstat -ano | findstr :7071` pattern