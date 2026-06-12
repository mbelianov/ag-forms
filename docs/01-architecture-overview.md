# Architecture and Design Documentation
## Ultrasound Form Cloud Application

**Document Version:** 2.0  
**Date:** June 12, 2026  
**Project:** Prenatal Ultrasound Documentation System  
**Status:** Draft for Review

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Overview](#system-overview)
3. [Architecture Design](#architecture-design)
4. [Technology Stack](#technology-stack)

---

## Executive Summary

### Purpose
This document defines the target architecture for transforming the existing Word template (УЗДv2.dotm) for prenatal ultrasound documentation into a modern, secure, Azure-based serverless web application.

### Scope
The system will provide:
- Secure user authentication and authorization
- Patient management (create, read, update, delete)
- Digital ultrasound examination forms
- Automatic medical calculations
- A4 PDF report generation
- Centralized cloud data persistence and retrieval
- Audit logging for security and compliance

### Stakeholders
- **Primary Users:** Obstetricians, Sonographers
- **Secondary Users:** Medical Administrators
- **Technical Team:** Development, Cloud Engineering, QA
- **Business Owners:** Healthcare Facility Management

### Key Design Principles
- **Security First:** Medical data protection with encryption, least privilege, and auditability
- **Serverless Simplicity:** Minimize infrastructure management and operational overhead
- **Reliability:** 99.5% uptime target with managed Azure services
- **Performance:** Sub-2-second page loads for common workflows
- **Maintainability:** Clear service boundaries and comprehensive documentation
- **Scalability:** Elastic scaling for 100+ concurrent users without container orchestration

---

## System Overview

### Business Context

The current process uses a Microsoft Word template (УЗДv2.dotm) for documenting prenatal ultrasound examinations. This manual process has several limitations:
- No centralized data storage
- Difficult to search historical records
- Manual calculations prone to errors
- No audit trail
- Paper-based archiving

The new system addresses these limitations by providing a cloud-based, secure, and efficient digital solution built on Azure serverless services.

### System Context Diagram

```text
┌────────────────────────────────────────────────────────────────────┐
│                         External Context                           │
│                                                                    │
│  ┌──────────┐                                                      │
│  │  Doctor  │────────┐                                             │
│  └──────────┘        │                                             │
│                      │                                             │
│  ┌──────────┐        │      ┌──────────────────────────────────┐   │
│  │  Admin   │────────┼────▶ │ Ultrasound Form Application      │   │
│  └──────────┘        │      │ Azure Static Web Apps + API      │   │
│                      │      └──────────────────────────────────┘   │
│  ┌──────────┐        │                       │                     │
│  │ Viewer   │────────┘                       │                     │
│  └──────────┘                                │                     │
│                                              ▼                     │
│                                   ┌──────────────────────────┐     │
│                                   │ Azure Serverless Platform│     │
│                                   │ Functions + Storage      │     │
│                                   └──────────────────────────┘     │
└────────────────────────────────────────────────────────────────────┘
```

### High-Level Features

| Feature | Description | Priority |
|---------|-------------|----------|
| User Authentication | Secure login/logout with application-managed identities | P0 |
| Patient Management | CRUD operations for patient records | P0 |
| Examination Forms | Digital ultrasound documentation | P0 |
| Auto-Calculations | Gestational age, dates, percentiles | P0 |
| PDF Generation & Delivery | A4 printable reports with optional secure email delivery to the patient | P0 |
| Search & Filter | Find patients and examinations | P1 |
| Audit Logging | Track all user actions | P1 |
| User Management | Admin can manage user accounts | P2 |

---

## Architecture Design

### Architecture Style
**Serverless Web Application Architecture** with managed Azure services:
- **Presentation Layer:** React-based web application hosted on Azure Static Web Apps
- **Application Layer:** Azure Functions using HTTP triggers for API endpoints, business logic, and calculations
- **Data Layer:** Azure Table Storage for operational entities

### System Architecture Diagram

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                           PRESENTATION LAYER                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ Web Browser (Client)                                                │  │
│  │  ┌──────────┐  ┌──────────────┐  ┌───────────────────────────────┐ │  │
│  │  │ React    │  │ Carbon Design│  │ Auth Session / Secure Cookie │ │  │
│  │  │ App      │  │ System       │  │ or Bearer Token              │ │  │
│  │  └──────────┘  └──────────────┘  └───────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────┬───────────────────────────────────────────┘
                                 │ HTTPS/TLS 1.2+
                                 │
┌────────────────────────────────▼───────────────────────────────────────────┐
│                         EDGE AND ACCESS LAYER                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ Azure Static Web Apps                                               │  │
│  │ - Static frontend hosting                                           │  │
│  │ - Managed TLS                                                       │  │
│  │ - Routing and environment integration                               │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────┬───────────────────────────────────────────┘
                                 │
┌────────────────────────────────▼───────────────────────────────────────────┐
│                        APPLICATION / COMPUTE LAYER                         │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ Azure Functions                                                     │  │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────────────┐ │  │
│  │  │ Auth       │ │ Patient    │ │ Exam       │ │ User Management  │ │  │
│  │  │ Functions  │ │ Functions  │ │ Functions  │ │ Functions        │ │  │
│  │  └────────────┘ └────────────┘ └────────────┘ └──────────────────┘ │  │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────────────┐ │  │
│  │  │ Validation │ │ Audit Log  │ │ Calculation│ │ User Management  │ │  │
│  │  │ Layer      │ │ Writer     │ │ Functions  │ │ Support Services │ │  │
│  │  └────────────┘ └────────────┘ └────────────┘ └──────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────┬───────────────────────────────────────────┘
                                 │ SDK / Storage APIs
                                 │
┌────────────────────────────────▼───────────────────────────────────────────┐
│                              DATA LAYER                                    │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ Azure Storage Account                                               │  │
│  │  ┌──────────────────────────────────────────────────────────────┐    │  │
│  │  │ Azure Table Storage                                          │    │  │
│  │  │ - Users                                                      │    │  │
│  │  │ - Patients                                                   │    │  │
│  │  │ - Examinations                                               │    │  │
│  │  │ - Audit Logs                                                 │    │  │
│  │  └──────────────────────────────────────────────────────────────┘    │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

### Core Azure Services

| Service | Purpose |
|---------|---------|
| Azure Static Web Apps | Host the React frontend and provide managed web delivery |
| Azure Functions | Implement REST-style APIs, validation, authentication, and calculations |
| Azure Table Storage | Store operational entities using partitioned NoSQL tables |
| Azure Function App Environment Settings | Store protected backend secrets, signing keys, and encryption configuration |
| Application Insights | Centralized telemetry, tracing, and alerting |

### Processing Model

#### Synchronous Workflows
Used for low-latency operations:
- Login and logout
- Get current user
- Create, read, update, delete patient records
- Create, read, update, delete examination records
- Search and filter operations
- Retrieve audit log summaries

#### Client-Side Rendering Workflows
Used for browser-driven output and immediate user actions:
- Client-side PDF generation for preview, download, or print
- Secure email delivery initiation for sending the generated report to the patient
- Lightweight calculations returned directly to the client

A typical client-side PDF flow is:
1. Client loads the examination data through authenticated Azure Function API calls.
2. Azure Functions validate input, authorization, and return the canonical examination payload.
3. The React application maps the validated examination data into a print-ready view model.
4. The browser generates the PDF locally using approved frontend PDF libraries.
5. The user previews, downloads, or prints the PDF directly from the client.
6. The user may optionally submit the generated PDF to an authenticated Azure Function email endpoint for delivery to the patient's recorded email address.
7. No PDF artifact is persisted by the platform unless a future compliance requirement introduces server-side archival.

### Component Architecture

#### Frontend Components Structure

```text
src/
├── components/
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   ├── ProtectedRoute.tsx
│   │   └── AuthContext.tsx
│   ├── patients/
│   │   ├── PatientList.tsx
│   │   ├── PatientForm.tsx
│   │   ├── PatientDetail.tsx
│   │   └── PatientSearch.tsx
│   ├── examinations/
│   │   ├── ExaminationForm.tsx
│   │   ├── ExaminationList.tsx
│   │   ├── ExaminationDetail.tsx
│   │   ├── ExaminationFormLayout.tsx
│   │   ├── ExaminationFieldGroup.tsx
│   │   └── ExaminationSummaryPanel.tsx
│   ├── common/
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx
│   │   ├── Footer.tsx
│   │   ├── Loading.tsx
│   │   └── ErrorBoundary.tsx
│   └── reports/
│       ├── PDFPreview.tsx
│       ├── PrintButton.tsx
│       ├── EmailReportButton.tsx
│       └── pdfDocument.tsx
├── services/
│   ├── api.ts
│   ├── auth.service.ts
│   ├── patient.service.ts
│   ├── examination.service.ts
│   ├── print.service.ts
│   └── report-delivery.service.ts
├── utils/
│   ├── calculations.ts
│   ├── validators.ts
│   └── formatters.ts
├── types/
│   ├── patient.types.ts
│   ├── examination.types.ts
│   ├── user.types.ts
│   └── report.types.ts
└── App.tsx
```

#### Backend Functions Structure

```text
api/
├── shared/
│   ├── auth/
│   │   ├── token.service.ts
│   │   ├── password.service.ts
│   │   └── authorization.service.ts
│   ├── storage/
│   │   ├── table-client.ts
│   ├── validation/
│   │   ├── patient.schema.ts
│   │   ├── examination.schema.ts
│   │   └── user.schema.ts
│   ├── logging/
│   │   └── audit.service.ts
│   └── utils/
│       ├── response.ts
│       ├── errors.ts
│       └── partitioning.ts
├── auth-login/
├── auth-logout/
├── auth-me/
├── auth-change-password/
├── patients-get/
├── patients-create/
├── patients-update/
├── patients-delete/
├── examinations-get/
├── examinations-create/
├── examinations-update/
├── examinations-delete/
├── examinations-calculate/
├── users-get/
├── users-create/
└── audit-logs-get/
```

### Data Access Strategy

Because Azure Table Storage is not relational:
- Data is modeled around **access patterns**, not joins
- Related data may be duplicated in controlled ways
- Partition keys are selected to optimize common queries
- Referential integrity is enforced in application logic
- Validation is performed in Azure Functions before persistence
- Concurrency is handled using **ETags**

### Architectural Decisions

| Decision | Rationale |
|---------|-----------|
| Use Azure Functions instead of containerized Express API | Reduces infrastructure management and supports elastic scaling |
| Use Azure Table Storage instead of PostgreSQL | Aligns with the approved serverless storage model and lowers operational complexity |
| Generate PDFs on the client without persistence | Matches the approved workflow where PDFs are printed or downloaded and then discarded |
| Keep application-managed users | Simpler initial implementation for the approved scope |
| Keep PDF generation in the browser | Reduces backend complexity, latency, and Azure execution cost for immediate print/download |
| Keep React frontend | Preserves UI investment while modernizing backend and infrastructure |
| Document Microsoft Entra ID as future enhancement | Allows future enterprise SSO without blocking current delivery |

---

## Technology Stack

### Frontend
- **Framework:** React 18.x with TypeScript
- **UI Library:** IBM Carbon Design System
- **State Management:** React Context API + Hooks
- **Routing:** React Router v6
- **HTTP Client:** Axios or fetch wrapper
- **Form Handling:** React Hook Form
- **Date Handling:** date-fns
- **PDF Preview / Generation:** react-pdf plus a maintained client-side PDF library such as pdf-lib or jsPDF
- **Email Delivery:** Azure Functions endpoint integrated with a maintained SMTP or transactional email provider

### Backend
- **Runtime:** Node.js 20.x LTS
- **Compute Platform:** Azure Functions v4
- **Language:** TypeScript
- **Authentication:** Application-managed identity with signed tokens
- **Password Hashing:** bcrypt or Argon2id-compatible implementation
- **Validation:** Joi, Zod, or equivalent schema validation
- **Logging:** Application Insights + structured JSON logs
- **Testing:** Jest + Azure Functions test tooling

### Storage
- **Operational Data:** Azure Table Storage

### Platform Services
- **Secrets Management:** Azure Function App environment settings for backend secrets and frontend public environment configuration
- **Monitoring:** Azure Monitor + Application Insights
- **Alerting:** Azure Monitor Alerts
- **Identity (Future Enhancement):** Microsoft Entra ID

### DevOps
- **Frontend Hosting:** Azure Static Web Apps
- **API Hosting:** Azure Functions
- **CI/CD:** GitHub Actions with Azure deployment actions
- **Infrastructure as Code:** Bicep or Terraform
- **Monitoring:** Azure-native observability stack

---

**Next Documents:**
- 02-database-design.md - Azure Table Storage entity design and access patterns
- 03-security-architecture.md - Azure-native security implementation details
- 04-api-specification.md - Azure Functions API documentation
- 05-deployment-guide.md - Azure serverless deployment and operations