# Prenatal Ultrasound Documentation System — Documentation

**Project:** Prenatal Ultrasound Documentation System  
**Current Status:** Implemented and in active development use  
**Archive:** The original `docs/` folder is preserved as a read-only archive containing all historical planning artefacts (feature request text, defect reports, requirements specifications, and implementation plans).

---

## Documentation Index

| File | Description |
|------|-------------|
| **[01-architecture-overview.md](01-architecture-overview.md)** | Azure serverless architecture, component structure, technology stack, and architectural decisions |
| **[02-database-design.md](02-database-design.md)** | Azure Table Storage entity design, partitioning strategy, access patterns, validation rules, and backup strategy |
| **[03-security-architecture.md](03-security-architecture.md)** | Security layers, authentication model, RBAC, data protection, compliance, and pre-deployment security checklist |
| **[04-api-specification.md](04-api-specification.md)** | All REST-style API endpoints (auth, patients, examinations, users, audit logs) with request/response examples and error codes |
| **[05-deployment-guide.md](05-deployment-guide.md)** | Azure resource architecture, environment configuration, CI/CD pipeline, monitoring, backup, and deployment checklist |
| **[06-local-dev-setup.md](06-local-dev-setup.md)** | Step-by-step local development environment setup (Node.js, Azure Functions Core Tools, Azurite) |
| **[REQUIREMENTS.md](REQUIREMENTS.md)** | Consolidated requirements: all REQ, FLAG, DR1–DR4, and FR items with current implementation status and one-paragraph summaries |
| **[KNOWN-ISSUES.md](KNOWN-ISSUES.md)** | Confirmed bugs deferred for later resolution, with current status (updated from code review) |
| **[TEST-CASES.md](TEST-CASES.md)** | 180 manual test cases covering authentication, patient management, examination management, search, PDF generation, email delivery, security, and edge cases |

---

## Project Overview

The system replaces a Microsoft Word template (УЗДv2.dotm) used for prenatal ultrasound documentation with a cloud-based Azure serverless web application. Core capabilities:

- **Secure user authentication** — application-managed accounts, role-based access (admin / doctor / viewer), account lockout, signed session tokens
- **Patient management** — full CRUD, Cyrillic name support, MRN generation, soft delete
- **Digital examination forms** — multi-section input form for Ultrasound Prenatal Exams, type-driven field rendering scaffold for future types
- **Automatic medical calculations** — gestational age, EDD, biometry percentiles, EFW (Hadlock formula)
- **A4 PDF report generation** — client-side, with email delivery to patient address
- **Server-side paginated lists** — patients and examinations with continuation-token pagination and "Load More"
- **Search and filter** — server-side patient name search (Enter-key triggered), examination type / status / date-range filters, URL-synchronised state
- **Audit logging** — all security-sensitive actions logged to Azure Table Storage

### Architecture Summary

```
React + TypeScript (Carbon Design)     ← Azure Static Web Apps
          │ HTTPS / TLS 1.2+
Azure Functions v4 (Node.js 20)        ← REST-style HTTP API
          │ SDK / Managed Identity
Azure Table Storage                    ← Operational data (Users, Patients, Examinations, AuditLogs)
```

---

## Key Coding Conventions

See `AGENTS.md` (project root) for the full set. Highlights:

- All HTTP responses use `successResponse()` / `errorResponse()` from `api/src/utils/responseHelpers.ts`
- Patient writes = 2 entities; Examination writes = 3 entities (timeline + EXAM + MRN)
- ETag travels in the request **body** (`{ ...data, etag }`), not as a header
- Biometry and Doppler are stored as JSON strings in Table Storage — deserialise before returning
- Soft delete only: set `isDeleted: true`, filter `isDeleted eq false` in all queries
- Patient search is triggered only by **Enter key** — never on keystroke or debounce

---

## Archive Reference

All historical planning documents remain in `docs/` (not deleted, not modified):

| Category | Files |
|----------|-------|
| Original feature requests | `FEATURE-REQEUSTS.txt`, `feature-request.md` |
| Requirements specifications | `REQUIREMENTS-SPEC.md`, `REQUIREMENTS-SPEC-DEFECTS-ROUND1.md`, `DEFECTS-ROUND2-REQ-SPEC.md`, `DEFECTS-ROUND3-REQ-SPEC.md`, `defects-round4-req-spec.md` |
| Defect reports | `DEFECTS-ROUND1.txt`, `DEFECTS-ROUND2.md`, `DEFECTS-ROUND3.md`, `defects-round4.txt` |
| Implementation plans | `IMPLEMENTATION-PLAN.md`, `DEFECTS-ROUND1-PLAN.md`, `DEFECTS-ROUND2-IMPL-PLAN.md`, `DEFECTS-ROUND3-IMPL-PLAN.md`, `defects-round4-impl-plan.md` |
