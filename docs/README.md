# Ultrasound Form Cloud Application - Documentation

**Project:** Prenatal Ultrasound Documentation System  
**Version:** 2.0  
**Date:** June 12, 2026  
**Status:** Architecture & Design Phase

---

## 📚 Documentation Index

This documentation suite defines the Azure serverless target architecture for transforming the Word template (УЗДv2.dotm) into a modern, secure, cloud-based web application.

### Core Documentation

1. **[Architecture Overview](01-architecture-overview.md)**
   - Executive summary and system overview
   - Azure serverless architecture design
   - Frontend, Functions, and storage architecture
   - Technology stack
   - **Start here** for understanding the overall system

2. **[Data Storage Design](02-database-design.md)**
   - Azure Table Storage entity model
   - Partitioning and access patterns
   - Denormalization strategy
   - Validation and consistency rules
   - Backup and recovery guidance

3. **[Security Architecture](03-security-architecture.md)**
   - Security layers and threat model
   - Application-managed authentication
   - Role-based access control
   - Data protection and secrets management
   - Compliance and incident response

4. **[API Specification](04-api-specification.md)**
   - Azure Functions-based API design
   - Authentication endpoints
   - Patient management endpoints
   - Examination endpoints
   - Client-side PDF generation approach
   - Error handling and status codes

5. **[Deployment Guide](05-deployment-guide.md)**
   - Azure resource architecture
   - Storage and data setup
   - Environment configuration
   - CI/CD pipeline
   - Monitoring, backup, and operations

---

## 🎯 Project Overview

### Purpose

Transform the existing Microsoft Word template (УЗДv2.dotm) for prenatal ultrasound documentation into a modern, secure, Azure-based serverless web application that provides:

- **Secure user authentication** with role-based access control
- **Patient management** with full CRUD operations
- **Digital examination forms** replacing paper-based workflow
- **Automatic medical calculations** (gestational age, percentiles, etc.)
- **A4 PDF report generation** for printing
- **Audit logging** for compliance and security
- **Cloud-based storage** for centralized data access

### Key Features

| Feature | Description | Priority |
|---------|-------------|----------|
| User Authentication | Secure login with application-managed identities and lockout protection | P0 |
| Patient Management | Create, read, update, delete patient records | P0 |
| Examination Forms | Single comprehensive digital form for ultrasound data entry | P0 |
| Auto-Calculations | Gestational age, delivery dates, biometry percentiles | P0 |
| PDF Generation & Delivery | Professional A4 reports matching original template, with optional patient email delivery | P0 |
| Search & Filter | Find patients and examinations quickly | P1 |
| Audit Logging | Track all user actions for security | P1 |
| User Management | Admin can manage user accounts | P2 |

---

## 🏗️ Architecture Summary

### Azure Serverless Architecture

```text
┌──────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                        │
│             React + TypeScript + Carbon Design               │
│               Hosted on Azure Static Web Apps                │
└──────────────────────────┬───────────────────────────────────┘
                           │ HTTPS/TLS 1.2+
┌──────────────────────────▼───────────────────────────────────┐
│                 APPLICATION / COMPUTE LAYER                  │
│                  Azure Functions (Node.js)                   │
│      HTTP triggers + calculations + secure data access       │
└──────────────────────────┬───────────────────────────────────┘
                           │ Azure SDK / Managed Identity
┌──────────────────────────▼───────────────────────────────────┐
│                        DATA LAYER                            │
│                    Azure Table Storage                       │
└──────────────────────────────────────────────────────────────┘
```

### Technology Stack

**Frontend:**
- React 18.x with TypeScript
- IBM Carbon Design System
- React Router
- Axios or fetch wrapper

**Backend:**
- Azure Functions v4
- Node.js 20.x LTS
- TypeScript
- Application-managed authentication
- Client-side PDF generation from canonical examination data

**Storage:**
- Azure Table Storage for operational data

**Platform Services:**
- Azure Static Web Apps
- Protected Azure Function App environment settings
- Application Insights
- Azure Monitor
- Optional Azure Front Door + WAF

---

## 🔒 Security Highlights

### Multi-Layer Security

1. **Edge and Network Security**
   - HTTPS/TLS 1.2+
   - Managed TLS
   - Optional WAF and edge protection

2. **Application Security**
   - Application-managed authentication
   - Role-based access control (Admin, Doctor, Viewer)
   - Input validation and sanitization
   - Rate limiting
   - Secure session or token handling

3. **Data Security**
   - Password hashing with secure modern algorithms
   - Encryption at rest
   - Managed identities
   - Secrets in protected Azure Function App environment settings
   - Audit logging
   - Sensitive data excluded from logs

### Compliance

- **GDPR:** Data subject rights, data portability, retention controls
- **Medical Data Protection:** Privacy-focused handling of patient data
- **Audit Trail:** Complete logging of security-sensitive actions

---

## 📊 Data Model Summary

### Core Operational Entities

1. **Users** - User accounts and authentication metadata
2. **Patients** - Patient demographic information
3. **Examinations** - Ultrasound examination records
4. **AuditLogs** - Security and compliance logging

### Key Storage Characteristics

- Azure Table Storage is used instead of a relational database
- Data is modeled around access patterns rather than joins
- Partition keys are used for performance and scalability
- ETags are used for optimistic concurrency
- Lookup and search entities are used where needed for efficient reads

---

## 🚀 Deployment Strategy

### Environments

- **Development:** Local frontend + Azure Functions Core Tools + local or dev Azure resources
- **Staging:** Azure serverless pre-production environment
- **Production:** Azure serverless production environment

### Deployment Process

1. Code commit triggers CI/CD pipeline
2. Automated tests and security checks run
3. Infrastructure is deployed or updated through IaC
4. Azure Functions are deployed
5. Frontend is deployed to Azure Static Web Apps
6. Smoke tests validate critical workflows
7. Monitoring and alerts verify runtime health

### Operational Model

- **Frontend:** Managed static hosting
- **API:** Auto-scaling Azure Functions
- **Storage:** Managed Azure Storage services
- **Secrets:** Protected Azure Function App environment settings
- **Monitoring:** Application Insights + Azure Monitor

---

## 📈 Implementation Timeline

### Phase 1: Foundation (Weeks 1-2)
- Azure resource provisioning
- Storage design and API foundation

### Phase 2: Authentication & Security (Weeks 3-4)
- User authentication implementation
- Security hardening
- Protected Function App settings and managed identity setup

### Phase 3: Backend API (Weeks 5-6)
- Patient management API
- Examination management API
- Audit logging

### Phase 4: Frontend (Weeks 7-10)
- UI foundation and authentication
- Patient management UI
- Examination form UI

### Phase 5: Reports (Weeks 11-12)
- Client-side PDF generation workflow
- Secure email delivery workflow for sending reports to patients
- Immediate print and download functionality
- Print functionality UI

### Phase 6: Testing (Weeks 13-14)
- Functional testing
- Security testing
- Performance and workflow validation

### Phase 7: Documentation & Training (Week 15)
- User documentation
- Training materials

### Phase 8: Deployment (Week 16)
- Production deployment
- Go-live and support

**Total Duration:** 16 weeks (4 months)

---

## 💰 Cost Considerations

### Development Costs
Development effort remains similar to the previous architecture because the application scope is unchanged, but operational effort is reduced through managed services.

### Infrastructure Cost Drivers

Primary Azure cost components:
- Azure Static Web Apps
- Azure Functions executions
- Azure Storage transactions and capacity
- Application Insights ingestion
- Optional Front Door and WAF

### Cost Characteristics

Compared with container orchestration, the Azure serverless model is expected to:
- Reduce infrastructure management overhead
- Reduce always-on compute costs for low-to-medium workloads
- Shift cost toward usage-based execution and storage operations
- Simplify scaling and operational support

---

## 📋 Success Criteria

### Technical Metrics
- ✓ 99.5% uptime
- ✓ Page load < 2 seconds
- ✓ Common API response < 300ms
- ✓ Error rate < 0.1%

### User Metrics
- ✓ 90% user adoption within 2 months
- ✓ User satisfaction > 4/5
- ✓ Form completion < 10 minutes
- ✓ < 5 support tickets/week after month 1

### Business Metrics
- ✓ 50% reduction in paper usage
- ✓ 40% reduction in data entry time
- ✓ 95% reduction in data entry errors
- ✓ ROI positive within 12 months

---

## 🔄 Next Steps

### For Development Team

1. **Review all documentation** in this folder
2. **Provision Azure environments** using IaC
3. **Create project repository structure** for frontend and Azure Functions
4. **Implement storage access layer** for Azure Tables
5. **Begin Phase 1 tasks** with serverless-first architecture decisions

### For Stakeholders

1. **Review architecture overview** (01-architecture-overview.md)
2. **Approve budget and timeline**
3. **Identify pilot users** for UAT
4. **Schedule kick-off meeting**
5. **Prepare for training** in Week 15

### For Security Team

1. **Review security architecture** (03-security-architecture.md)
2. **Approve secrets and identity model**
3. **Validate logging and retention controls**
4. **Schedule security testing** before production release

---

## 📞 Support and Contact

### Documentation Feedback

If you find any issues or have suggestions for improving this documentation:
- Create an issue in the project repository
- Contact the technical lead
- Submit a pull request with improvements

### Questions

For questions about:
- **Architecture**: Review 01-architecture-overview.md
- **Storage Design**: Review 02-database-design.md
- **Security**: Review 03-security-architecture.md
- **API**: Review 04-api-specification.md
- **Deployment**: Review 05-deployment-guide.md

---

## 📝 Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-12 | Architecture Team | Initial container-based documentation suite |
| 2.0 | 2026-06-12 | Architecture Team | Rewritten for Azure serverless architecture using Azure Functions and Azure Storage |

---

## ⚖️ License

This documentation is proprietary and confidential. Unauthorized distribution is prohibited.

---

**Ready to build a modern, secure, and efficient Azure serverless ultrasound documentation system.**