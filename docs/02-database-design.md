# Data Storage Design Documentation
## Ultrasound Form Cloud Application

**Document Version:** 2.0  
**Date:** June 12, 2026  
**Related:** 01-architecture-overview.md

---

## Table of Contents

1. [Storage Model Overview](#storage-model-overview)
2. [Logical Entity Model](#logical-entity-model)
3. [Azure Table Design](#azure-table-design)
4. [Entity Schemas](#entity-schemas)
5. [Access Patterns and Performance](#access-patterns-and-performance)
6. [Validation and Consistency Rules](#validation-and-consistency-rules)
7. [Backup and Recovery Strategy](#backup-and-recovery-strategy)

---

## Storage Model Overview

### Purpose

This document defines the operational data design for the Azure serverless version of the Ultrasound Form Cloud Application.

The approved target architecture replaces:
- PostgreSQL relational tables
- SQL joins
- SQL indexes and triggers
- Database-managed constraints
- Container-hosted persistence services

with:
- Azure Table Storage for operational entities
- Application-enforced validation and referential integrity
- Partition-key-driven query optimization
- ETag-based optimistic concurrency

### Design Principles

The storage design follows these principles:
- **Access-pattern first:** Model data for the queries the application actually performs
- **Partition-aware:** Use partition keys to support efficient reads and writes
- **Denormalized where needed:** Duplicate small amounts of data to avoid joins
- **Application-enforced integrity:** Validate relationships and business rules in Azure Functions
- **Append-only auditing:** Preserve immutable audit history
- **Soft delete by default:** Avoid destructive deletes for medical and compliance-sensitive data

### Storage Services

| Service | Purpose |
|---------|---------|
| Azure Table Storage | Operational entities such as users, patients, examinations, and audit logs |

---

## Logical Entity Model

### Domain Entities

```text
┌─────────────────────┐
│   UserProfile       │
├─────────────────────┤
│ user_id             │
│ username            │
│ password_hash       │
│ full_name           │
│ email               │
│ role                │
│ is_active           │
│ failed_attempts     │
│ locked_until        │
│ last_login          │
│ created_at          │
│ updated_at          │
└──────────┬──────────┘
           │ creates
           │
┌──────────▼──────────┐
│   PatientProfile    │
├─────────────────────┤
│ patient_id          │
│ medical_record_no   │
│ name                │
│ age                 │
│ address             │
│ phone               │
│ email               │
│ created_by          │
│ created_at          │
│ updated_at          │
│ is_deleted          │
└──────────┬──────────┘
           │ has many
           │
┌──────────▼──────────┐
│ ExaminationRecord   │
├─────────────────────┤
│ examination_id      │
│ patient_id          │
│ exam_date           │
│ exam_type           │
│ status              │
│ data_json           │
│ created_by          │
│ updated_by          │
│ created_at          │
│ updated_at          │
│ is_deleted          │
└─────────────────────┘

┌─────────────────────┐
│ AuditLogEntry       │
├─────────────────────┤
│ audit_id            │
│ user_id             │
│ action              │
│ resource_type       │
│ resource_id         │
│ old_value_json      │
│ new_value_json      │
│ ip_address          │
│ user_agent          │
│ created_at          │
└─────────────────────┘

```

### Relationship Strategy

Azure Table Storage does not support foreign keys or joins. Relationships are handled as follows:

- `PatientProfile.created_by` stores the creating user ID
- `ExaminationRecord.patient_id` stores the owning patient ID
- `ExaminationRecord.created_by` and `updated_by` store user IDs
- `AuditLogEntry.resource_id` stores the affected entity ID
- Frequently displayed fields such as patient name or creator name may be duplicated in read-optimized entities when justified

### Denormalization Rules

The design allows controlled duplication for performance:
- Examination list entities may include `patient_name` and `medical_record_number`
- Audit entries may include `user_name` for easier reporting

All duplicated fields are treated as **read optimization fields**, not authoritative sources.

---

## Azure Table Design

### Table Inventory

| Azure Table | Purpose |
|-------------|---------|
| `Users` | Application-managed user accounts and authentication metadata |
| `Patients` | Patient demographic and lifecycle records |
| `Examinations` | Ultrasound examination records |
| `AuditLogs` | Immutable audit trail |
| `SearchIndex` | Optional read-optimized entities for search and listing |

### Partitioning Strategy

Partitioning is critical in Azure Table Storage. The following strategy balances query efficiency and write distribution.

#### Users Table
- **PartitionKey:** `USER`
- **RowKey:** `{userId}`

Secondary lookup by username is handled using one of these patterns:
1. A duplicate lookup entity in the same table:
   - `PartitionKey = USERNAME`
   - `RowKey = normalized_username`
2. Or a dedicated lookup table if needed later

This supports:
- Direct lookup by user ID
- Direct lookup by username during login

#### Patients Table
Primary patient entity:
- **PartitionKey:** `PATIENT`
- **RowKey:** `{patientId}`

Optional MRN lookup entity:
- **PartitionKey:** `MRN`
- **RowKey:** `{medicalRecordNumber}`

Optional search/list entity:
- **PartitionKey:** `PATIENT_SEARCH_{firstLetter}`
- **RowKey:** `{normalized_name}_{patientId}`

This supports:
- Direct patient retrieval by ID
- Direct lookup by MRN
- Prefix-oriented search support through read-optimized entities

#### Examinations Table
Primary examination entity:
- **PartitionKey:** `PATIENT_{patientId}`
- **RowKey:** `{reverseTicks}_{examinationId}`

Optional direct lookup entity:
- **PartitionKey:** `EXAM`
- **RowKey:** `{examinationId}`

This supports:
- Efficient retrieval of all examinations for a patient
- Natural descending sort by exam date using reverse ticks
- Direct examination lookup when only examination ID is known

#### AuditLogs Table
- **PartitionKey:** `AUDIT_{yyyyMM}`
- **RowKey:** `{timestamp}_{auditId}`

This supports:
- Time-based retention and export
- Efficient monthly scans
- Append-only write pattern


### Why This Design

This design replaces SQL indexes and joins with:
- Direct point reads
- Partition-scoped queries
- Read-optimized duplicate entities
- Application-managed consistency

This is the correct optimization model for Azure Table Storage.

---

## Entity Schemas

### Users Table

#### Primary User Entity

| Property | Type | Required | Notes |
|----------|------|----------|-------|
| PartitionKey | string | Yes | `USER` |
| RowKey | string | Yes | User ID (UUID) |
| username | string | Yes | Unique normalized username |
| password_hash | string | Yes | Secure password hash |
| full_name | string | Yes | Display name |
| email | string | No | Contact email |
| role | string | Yes | `admin`, `doctor`, `viewer` |
| is_active | boolean | Yes | Account status |
| failed_login_attempts | int | Yes | Brute-force protection |
| locked_until | datetime | No | Lock expiration |
| last_login | datetime | No | Last successful login |
| created_at | datetime | Yes | Creation timestamp |
| updated_at | datetime | Yes | Last update timestamp |
| deleted_at | datetime | No | Soft delete marker |

#### Username Lookup Entity

| Property | Type | Required | Notes |
|----------|------|----------|-------|
| PartitionKey | string | Yes | `USERNAME` |
| RowKey | string | Yes | Normalized username |
| user_id | string | Yes | Target user ID |
| is_active | boolean | Yes | Fast login eligibility check |

### Patients Table

#### Primary Patient Entity

| Property | Type | Required | Notes |
|----------|------|----------|-------|
| PartitionKey | string | Yes | `PATIENT` |
| RowKey | string | Yes | Patient ID (UUID) |
| medical_record_number | string | Yes | Unique MRN |
| name | string | Yes | Patient full name |
| normalized_name | string | Yes | Search normalization |
| age | int | Yes | Validated in application |
| address | string | No | Residential address |
| phone | string | No | Contact phone |
| email | string | No | Contact email |
| created_by | string | Yes | User ID |
| created_by_name | string | No | Optional denormalized display field |
| created_at | datetime | Yes | Creation timestamp |
| updated_at | datetime | Yes | Last update timestamp |
| is_deleted | boolean | Yes | Soft delete flag |
| deleted_at | datetime | No | Soft delete timestamp |

#### MRN Lookup Entity

| Property | Type | Required | Notes |
|----------|------|----------|-------|
| PartitionKey | string | Yes | `MRN` |
| RowKey | string | Yes | Medical record number |
| patient_id | string | Yes | Target patient ID |
| patient_name | string | No | Optional display field |

#### Search Entity

| Property | Type | Required | Notes |
|----------|------|----------|-------|
| PartitionKey | string | Yes | `PATIENT_SEARCH_{bucket}` |
| RowKey | string | Yes | `{normalized_name}_{patientId}` |
| patient_id | string | Yes | Target patient ID |
| name | string | Yes | Display name |
| medical_record_number | string | Yes | MRN |
| created_at | datetime | Yes | Sorting support |

### Examinations Table

#### Primary Examination Entity

| Property | Type | Required | Notes |
|----------|------|----------|-------|
| PartitionKey | string | Yes | `PATIENT_{patientId}` |
| RowKey | string | Yes | `{reverseTicks}_{examinationId}` |
| examination_id | string | Yes | Stable examination ID |
| patient_id | string | Yes | Owning patient |
| patient_name | string | No | Denormalized for list views |
| medical_record_number | string | No | Denormalized for list views |
| exam_date | string | Yes | ISO date |
| exam_type | string | Yes | Usually `prenatal_ultrasound` |
| status | string | Yes | `draft`, `completed`, `reviewed` |
| data_json | string | Yes | Serialized examination payload |
| created_by | string | Yes | User ID |
| created_by_name | string | No | Optional display field |
| updated_by | string | No | User ID |
| created_at | datetime | Yes | Creation timestamp |
| updated_at | datetime | Yes | Last update timestamp |
| is_deleted | boolean | Yes | Soft delete flag |
| deleted_at | datetime | No | Soft delete timestamp |

#### Direct Examination Lookup Entity

| Property | Type | Required | Notes |
|----------|------|----------|-------|
| PartitionKey | string | Yes | `EXAM` |
| RowKey | string | Yes | Examination ID |
| patient_partition_key | string | Yes | Pointer to primary entity partition |
| patient_row_key | string | Yes | Pointer to primary entity row |
| patient_id | string | Yes | Owning patient |
| exam_date | string | Yes | ISO date |
| status | string | Yes | Current status |

### AuditLogs Table

#### Audit Entry Entity

| Property | Type | Required | Notes |
|----------|------|----------|-------|
| PartitionKey | string | Yes | `AUDIT_{yyyyMM}` |
| RowKey | string | Yes | `{timestamp}_{auditId}` |
| audit_id | string | Yes | Unique audit ID |
| user_id | string | No | Acting user |
| user_name | string | No | Optional denormalized display field |
| action | string | Yes | `login`, `create`, `update`, `delete`, etc. |
| resource_type | string | No | `patient`, `examination`, `user`, `report` |
| resource_id | string | No | Affected entity ID |
| old_value_json | string | No | Previous state snapshot |
| new_value_json | string | No | New state snapshot |
| ip_address | string | No | Client IP |
| user_agent | string | No | Client user agent |
| status_code | int | No | HTTP result |
| created_at | datetime | Yes | Event timestamp |

### Jobs Table

## Access Patterns and Performance

### Primary Access Patterns

| Use Case | Storage Pattern |
|----------|-----------------|
| Login by username | Username lookup entity → primary user entity |
| Get user by ID | Point read on `Users` |
| Get patient by ID | Point read on `Patients` |
| Get patient by MRN | MRN lookup entity → primary patient entity |
| List examinations for patient | Query `Examinations` by `PartitionKey = PATIENT_{patientId}` |
| Get examination by ID | Direct lookup entity → primary examination entity |
| List audit logs by month | Query `AuditLogs` by monthly partition |

### Search Strategy

Azure Table Storage is not a full-text search engine. Therefore:

- **Exact lookups** use point reads or lookup entities
- **Prefix or bucketed search** uses optional search entities
- **Advanced fuzzy search** should be treated as a future enhancement using Azure AI Search if required

For the current approved scope:
- Patient search should support exact or prefix-oriented matching
- Search entities should be maintained by application logic during create and update operations

### Sorting Strategy

Azure Table Storage sorts within a partition by `RowKey`. To support descending chronological order:
- Examination row keys use reverse ticks
- Audit row keys use timestamp-first ordering
- Search row keys can embed normalized names for alphabetical scans

### Performance Guidance

1. Prefer point reads whenever possible
2. Keep partitions aligned with dominant query patterns
3. Avoid cross-partition scans in interactive workflows
4. Store large structured examination payloads as compact JSON strings
5. Keep entity size within Azure Table Storage limits
6. Keep large derived artifacts out of Azure Table Storage; generate client-side documents when persistence is not required

### Concurrency Control

All updates must use **ETag-based optimistic concurrency**:
- Read entity with ETag
- Submit update with `If-Match`
- Reject conflicting updates with a concurrency error
- Return a generic conflict response to the client

This replaces SQL row locking and transaction semantics for single-entity updates.

---

## Validation and Consistency Rules

### Application-Level Validation

Because Azure Table Storage does not provide relational constraints, all validation is enforced in Azure Functions.

### Patient Validation Rules

| Field | Validation Rule | Error Message |
|-------|----------------|---------------|
| name | Required, 2-255 characters | "Patient name is required and must be 2-255 characters" |
| age | Required, 2-99 years | "Age must be between 2 and 99 years" |
| phone | Required, valid phone format | "Invalid phone number format" |
| email | Optional, valid email format | "Invalid email address" |
| medical_record_number | Required, unique | "Medical record number already exists" |

### Examination Validation Rules

| Field | Validation Rule | Error Message |
|-------|----------------|---------------|
| exam_date | Required, not future date | "Exam date cannot be in the future" |
| patient_id | Required, must exist and not be deleted | "Patient not found" |
| status | Must be `draft`, `completed`, or `reviewed` | "Invalid examination status" |
| heart_rate | integer | "Heart rate must ineteger" |
| bpd | integer | "BPD must be ineteger" |
| hc | integer | "HC must be ineteger" |
| ac | integer | "AC must be ineteger" |
| fl | integer | "FL must be ineteger" |
| efw | integer | "EFW must be ineteger" |
| doppler_pi | number | "PI must be ineteger" |
| doppler_ri | number | "RI must be ineteger" |

### Referential Integrity Rules

The application must enforce:
- A patient must exist before an examination is created
- A deleted patient cannot receive new examinations
- A user must exist and be active before creating protected resources
- Lookup entities must be created or updated together with primary entities
- Soft-deleted entities must be excluded from normal reads and lists

### Multi-Entity Consistency

Azure Table Storage supports transactional batches only within the same partition. Because some lookup entities may live in different partitions:
- The system uses **best-effort write sequencing**
- Primary entity writes are authoritative
- Secondary lookup entities can be repaired by scheduled maintenance processes if needed
- Audit logs are append-only and should not block the primary business transaction unless required by policy

### Medical Record Number Generation

MRN generation is handled in application logic, not by database sequences.

Recommended format:
- `MRN-{YYYY}-{NNNNNN}`

Recommended generation approach:
1. Use a dedicated counter entity per year, or
2. Use a time-based unique identifier with collision checks

For simplicity and reliability, document a counter entity pattern:
- **PartitionKey:** `COUNTER`
- **RowKey:** `MRN_{YYYY}`

Updates to the counter must use optimistic concurrency to avoid duplicate MRNs.

### Soft Delete Rules

Soft delete is required for:
- Patients
- Examinations
- Users where policy requires deactivation instead of removal

Soft delete behavior:
- Set `is_deleted = true`
- Set `deleted_at`
- Exclude from standard queries
- Preserve audit history

---

## Backup and Recovery Strategy

### Backup Principles

Azure Table Storage is a managed service, so backup strategy focuses on:
- Geo-redundant storage configuration where appropriate
- Periodic export of critical tables
- Recovery procedures for accidental deletion or corruption
- Retention-aligned archival

### Recommended Storage Configuration

| Component | Recommendation |
|----------|----------------|
| Storage Account Redundancy | GRS or RA-GRS for production if regional resilience is required |
| Table Export | Scheduled periodic export to protected storage |
| Retention | Align with medical and compliance requirements |

### Backup Schedule

- **Table export:** Daily snapshot export to protected backup storage
- **Audit export:** Monthly archival export

### Recovery Scenarios

#### Recover Table Entity
1. Restore from exported snapshot or replay from audit trail where possible
2. Rebuild lookup entities if needed
3. Validate referential consistency

#### Rebuild Search or Lookup Entities
1. Scan authoritative primary entities
2. Regenerate MRN, username, or search lookup entities
3. Validate counts and spot-check records

### Operational Recovery Notes

- Primary entities are the source of truth
- Lookup and search entities are rebuildable
- Audit logs should be exported regularly for long-term retention
- Disaster recovery procedures should be tested periodically in staging

---

**Related Documents:**
- 01-architecture-overview.md - System architecture
- 03-security-architecture.md - Security implementation
- 04-api-specification.md - API documentation