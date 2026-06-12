# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Project Context

This is a **documentation-only repository** for an Azure serverless prenatal ultrasound documentation system. The repository contains architectural specifications and design documents but **no actual code implementation yet**.

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

## When Implementation Starts

### Expected Tech Stack (from docs)
- **Frontend**: React 18+ with TypeScript, IBM Carbon Design System, Vite
- **Backend**: Azure Functions v4, Node.js 20.x LTS, TypeScript
- **Storage**: Azure Table Storage (not SQL)
- **Deployment**: Azure Static Web Apps + Azure Functions

### Expected Commands (when code exists)
```bash
# Frontend (expected)
cd frontend && npm ci
npm run dev          # Local development
npm run build        # Production build
npm test             # Run tests
npm run lint         # Linting

# API (expected)
cd api && npm ci
npm test             # Run tests
npm run lint         # Linting
func start           # Local Azure Functions runtime
```

### Infrastructure as Code
- Bicep preferred for Azure resources
- Terraform acceptable if multi-cloud standardization needed
- All infrastructure definitions should be in `infra/` directory

## Current State
**This repository contains only documentation. No code has been implemented yet.**