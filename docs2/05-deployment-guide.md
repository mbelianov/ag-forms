# Deployment Guide
## Ultrasound Form Cloud Application

**Document Version:** 2.0  
**Date:** June 12, 2026  
**Related:** 01-architecture-overview.md, 03-security-architecture.md

---

## Table of Contents

1. [Deployment Overview](#deployment-overview)
2. [Infrastructure Requirements](#infrastructure-requirements)
3. [Azure Resource Architecture](#azure-resource-architecture)
4. [Storage and Data Setup](#storage-and-data-setup)
5. [Environment Configuration](#environment-configuration)
6. [CI/CD Pipeline](#cicd-pipeline)
7. [Monitoring and Logging](#monitoring-and-logging)
8. [Backup, Recovery, and Operations](#backup-recovery-and-operations)
9. [Deployment Checklist](#deployment-checklist)

---

## Deployment Overview

### Deployment Architecture

```text
┌────────────────────────────────────────────────────────────────────┐
│                           Microsoft Azure                          │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Azure Static Web Apps                                        │  │
│  │ - React frontend hosting                                     │  │
│  │ - Managed TLS                                                │  │
│  │ - Static asset delivery                                      │  │
│  └───────────────────────┬──────────────────────────────────────┘  │
│                          │ HTTPS/TLS 1.2+                          │
│  ┌───────────────────────▼──────────────────────────────────────┐  │
│  │ SWA managed functions (api_location: api)                    │  │
│  │ - HTTP-triggered API endpoints                               │  │
│  │ - On-demand PDF rendering                                    │  │
│  │ - Scheduled maintenance functions                            │  │
│  └───────────────────────┬──────────────────────────────────────┘  │
│                          │ Managed Identity / SDK                  │
│  ┌───────────────────────▼──────────────────────────────────────┐  │
│  │ Azure Storage Account                                        │  │
│  │ - Table Storage for operational data                         │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Supporting Services                                          │  │
│  │ - SWA application settings (secrets)                         │  │
│  │ - Application Insights                                       │  │
│  │ - Azure Monitor Alerts                                       │  │
│  │ - Optional Azure Front Door + WAF                            │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

### Deployment Environments

| Environment | Purpose | URL |
|-------------|---------|-----|
| Development | Local development and integration testing | http://localhost:3000 |
| Staging | Pre-production validation | https://staging.ultrasound-app.example.com |
| Production | Live system | https://ultrasound-app.example.com |

### Deployment Principles

- Use managed Azure services instead of containers and Kubernetes
- Separate environments by resource group and configuration
- Use infrastructure as code for repeatable provisioning
- Use managed identities instead of embedded credentials
- Keep backend secrets in Azure Static Web Apps application settings (the API runs as SWA managed functions)
- Keep document rendering in the client when server-side persistence or compliance controls are not required

---

## Infrastructure Requirements

### Compute Resources

#### Frontend
- **Platform:** Azure Static Web Apps
- **Workload Type:** Static React application
- **Scaling:** Managed by platform
- **Storage:** Managed static asset hosting

#### Backend API
- **Platform:** Azure Static Web Apps managed functions (`api_location: api`); no separate Function App is provisioned
- **Runtime:** Node.js 22 (as set in the GitHub Actions workflows)
- **Plan:** Included in the Static Web Apps plan (the free tier is in use)
- **Scaling:** Automatic platform scaling
- **Execution Model:** HTTP triggers for CRUD and calculations, plus scheduled maintenance functions

#### Storage
- **Platform:** Azure Storage Account
- **Services Used:** Tables
- **Redundancy:** LRS for lower cost environments, GRS or RA-GRS for production if resilience requirements justify it

### Recommended Azure Resources

| Resource | Purpose |
|----------|---------|
| Azure Static Web App | Frontend hosting |
| SWA managed functions (part of the Static Web App) | API, authentication, validation, and calculations |
| Azure Storage Account | Tables |
| SWA application settings | Protected backend secrets, signing keys and the email credential master key |
| Application Insights | Telemetry and tracing |
| Log Analytics Workspace | Centralized operational analysis |
| Azure Monitor Alerts | Alerting |
| Azure Front Door + WAF (optional) | Edge routing, WAF, rate limiting |

### Network Requirements

- Public HTTPS access to frontend and API
- No direct public administrative access to storage data plane beyond authorized identities
- TLS 1.2 or higher for all communications
- Optional private endpoints for storage in higher-security environments
- Restrictive CORS configuration for frontend-to-API communication

---

## Azure Resource Architecture

### Resource Group Layout

Recommended structure:

```text
rg-ultrasound-dev
rg-ultrasound-staging
rg-ultrasound-prod
```

### Naming Convention

Example naming pattern:

```text
swa-ultrasound-prod
(no separate Function App: the API is deployed with the Static Web App)
stultrasoundprod
kv-ultrasound-prod
appi-ultrasound-prod
law-ultrasound-prod
afd-ultrasound-prod
```

### API (Managed Functions) Structure

The SWA managed functions host:
- Authentication endpoints
- Patient endpoints
- Examination endpoints
- User management endpoints
- Audit log endpoints
- Email provider settings and examination email delivery endpoints (`/v1/profile/email-provider*`, `/v1/examinations/{id}/email-report`)
- Scheduled maintenance functions for cleanup and retention

### Managed Identity Configuration

Managed functions in Static Web Apps do not offer a managed identity for the storage connection; the API uses `AZURE_STORAGE_CONNECTION_STRING` from the SWA application settings (treat it as a secret). The guidance below applies only if the API is ever moved to a standalone Function App.

Required permissions:
- Storage Table Data Contributor
- Application Insights telemetry write access through platform integration

### Optional Edge Architecture

For production, consider Azure Front Door with WAF for:
- Centralized HTTPS termination
- Web application firewall rules
- Rate limiting
- Custom domain routing
- Improved global performance

---

## Storage and Data Setup

### Storage Account Configuration

The storage account hosts:
- Azure Table Storage for operational entities

Recommended tables:

| Table | Purpose |
|-------|---------|
| `Users` | User accounts |
| `Patients` | Patient records |
| `Examinations` | Examination records |
| `AuditLogs` | Audit trail |
| `SearchIndex` | Optional search entities |

### Storage Security

Required controls:
- Use RBAC and a protected connection string (managed identity applies only to a standalone Function App; the current deployment reads the connection string from SWA application settings)
- Restrict access using RBAC
- Enable encryption at rest

### Initial Data Setup

Initial setup tasks:
1. Provision storage account
2. Create required tables
3. Seed initial admin user through a controlled bootstrap process
4. Store signing keys and secrets in SWA application settings

### Bootstrap Admin User

The initial admin user must be created securely:
- Generate a strong temporary password
- Hash the password before storage
- Store only the hash in Azure Table Storage
- Deliver the temporary credential through a secure out-of-band process
- Force password change on first login if implemented

No plaintext password should be committed to source control or documentation.

---

## Environment Configuration

### Environment Variables

#### API application settings (SWA managed functions)

```text
NODE_ENV=production
API_VERSION=v1
APP_BASE_URL=https://api.ultrasound-app.example.com
FRONTEND_BASE_URL=https://ultrasound-app.example.com

STORAGE_ACCOUNT_NAME=stultrasoundprod
TABLES_USERS=Users
TABLES_PATIENTS=Patients
TABLES_EXAMINATIONS=Examinations
TABLES_AUDIT_LOGS=AuditLogs

JWT_SECRET=<generate-with-node-crypto-randomBytes-64>
AZURE_STORAGE_CONNECTION_STRING=<storage-connection-string>
ALLOWED_ORIGIN=https://<your-swa-hostname>

# Send-by-email (see README-SWA.md). Must be set before release; no fallback, fails closed.
EMAIL_CREDENTIALS_ENCRYPTION_KEY=<64-hex-chars-generate-with-node-crypto-randomBytes-32>
# Optional, only during key rotation:
# EMAIL_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS=<old-64-hex-key>

TOKEN_EXPIRATION_HOURS=8
PASSWORD_HASH_ALGORITHM=argon2id

APPLICATIONINSIGHTS_CONNECTION_STRING=<provided-by-platform-or-secure-config>
```

#### Frontend

```text
VITE_API_BASE_URL=https://api.ultrasound-app.example.com/api/v1
VITE_APP_NAME=Ultrasound Form App
VITE_APP_VERSION=2.0.0
VITE_ENABLE_ANALYTICS=false
VITE_ENABLE_DEBUG=false
```

### Secret Management

Secrets must not be stored in source control.

Store in the Azure portal under Static Web App > Settings > Environment variables (application settings):
- Token signing key (`JWT_SECRET`)
- Storage connection string (`AZURE_STORAGE_CONNECTION_STRING`)
- **Email credential master key** (`EMAIL_CREDENTIALS_ENCRYPTION_KEY`, optional `EMAIL_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS` during rotation)
- Any third-party integration secrets

Per-doctor SMTP credentials (Gmail/Yahoo app passwords) are **not** application settings: each doctor enters them on the Email Settings page and they are stored encrypted with the master key above (see `03-security-architecture.md`).

Email key rules:
- Generate it once: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` (64 hex characters). Never commit it and never reuse the example/test keys.
- There is no fallback: if it is missing or malformed, saving or testing provider settings and sending reports fail closed with a generic 500.
- **Set it in the Azure portal before the release that contains the email feature.** PR preview environments share the production application settings and storage.
- Back the key up in your secret store; losing it makes every stored app password unreadable (doctors must re-enter them). Rotation procedure: `README-SWA.md`.

Outbound network: the API must reach the doctors' SMTP servers on port 587 (STARTTLS) or 465 (TLS). This was checked for Gmail and Yahoo (spec section 14); real authentication and delivery is verified in the hosted end-to-end pass.

Preferred pattern:
- The API reads secrets from SWA application settings
- Frontend receives only non-sensitive public configuration

### Local Development Configuration

For local development:
- Use Azure Functions Core Tools
- Use Azurite for local storage emulation where practical
- Use local environment files excluded from source control
- Never commit local secrets or `.env` files containing credentials

---

## CI/CD Pipeline

### Deployment Strategy

Use GitHub Actions to:
1. Validate code and dependencies
2. Run tests and security checks
3. Build frontend
4. Deploy frontend to Azure Static Web Apps
5. Deploy the API as SWA managed functions (same `Azure/static-web-apps-deploy` step as the frontend)
6. Apply infrastructure changes through Bicep or Terraform
7. Run smoke tests after deployment

### Recommended Workflow Stages

| Stage | Purpose |
|-------|---------|
| Lint | Code quality checks |
| Test | Unit and integration tests |
| Security Scan | Dependency and static analysis |
| Build | Frontend and function packaging |
| Deploy Infra | Provision or update Azure resources |
| Deploy App | Deploy frontend and functions |
| Smoke Test | Validate critical paths |

### Actual GitHub Actions Workflows

The repository does **not** deploy a separate Function App. The API is deployed as Azure Static Web Apps (SWA) **managed functions** by the same action that deploys the frontend. The authoritative files are in `.github/workflows/`:

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| `ci.yml` | pull requests / pushes | Unit tests only (`api` `src/tests/utils`) with a test-only `JWT_SECRET_TEST`. It has **no** email key; email unit tests set their own test key. Integration tests (Azurite) are run locally. |
| `deploy-production.yml` | push to `master` | Builds and deploys frontend + API to the production SWA |
| `deploy-preview.yml` | pull requests | Same build, deployed to a `pr-{number}` preview environment; closing the PR removes it |

Essential part of `deploy-production.yml`:

```yaml
- uses: actions/setup-node@v5.0.0
  with:
    node-version: '22'

- name: Deploy to Azure Static Web Apps
  uses: Azure/static-web-apps-deploy@v1
  with:
    azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
    repo_token: ${{ secrets.GITHUB_TOKEN }}
    action: upload
    app_location: frontend
    output_location: dist
    api_location: api
    app_build_command: "npm ci && VITE_APP_VERSION=${{ github.sha }} VITE_DEPLOY_ENV=production npm run build"
    api_build_command: "npm ci && npm run build"
```

Notes:
- `api_location: api` makes SWA host the compiled Azure Functions (Node 22) behind `/api/*`. `host.json` must keep `routePrefix: "api"`.
- Application settings (`JWT_SECRET`, `AZURE_STORAGE_CONNECTION_STRING`, `ALLOWED_ORIGIN`, `EMAIL_CREDENTIALS_ENCRYPTION_KEY`, ...) are **not** set by the workflow. They live in the Azure portal: Static Web App > Settings > Environment variables / Application settings.
- **Preview environments share the production application settings and the production storage account.** A PR preview therefore uses the same email key and can read and write the same stored provider rows. Test accordingly.
- A dependency audit (`npm audit`) is not part of the workflow; see `KNOWN-ISSUES.md` KI-014.

### Infrastructure as Code

Preferred options:
- **Bicep** for Azure-native deployments
- **Terraform** if multi-cloud tooling standardization is required

Provision through IaC:
- Resource groups
- Static Web App
- (Function App: not used)
- Storage account
- Application Insights
- Alerts
- Optional Front Door and WAF

---

## Monitoring and Logging

### Application Insights

Use Application Insights for:
- Request telemetry
- Dependency telemetry
- Exception tracking
- Distributed tracing
- Performance monitoring

Key metrics:
- Request rate
- Response time (p50, p95, p99)
- Error rate
- Function execution count
- Function failures
- Calculation execution duration
- Examination read latency
- Authentication failures

### Azure Monitor Alerts

Recommended alerts:
- High error rate
- Repeated authentication failures
- Function execution failures
- Storage throttling
- Elevated client-side print/render error reports
- Storage throttling
- Availability test failures

### Structured Logging

All application logs should be structured JSON and must not contain:
- Passwords
- Tokens
- Secrets
- Full medical payloads
- Sensitive headers

### Availability Monitoring

Configure synthetic checks for:
- Frontend availability
- API health endpoint
- Login flow
- Examination print workflow

### Operational Dashboards

Recommended dashboards:
- API performance dashboard
- Authentication and security dashboard
- Client print experience dashboard
- Storage operations dashboard
- Business activity dashboard

---

## Backup, Recovery, and Operations

### Backup Strategy

Because the platform uses managed storage services, backup strategy focuses on:
- Periodic table exports to protected backup storage
- Retention policies
- Geo-redundancy where required

### Recovery Strategy

#### Recover Table Data
1. Restore from exported snapshot
2. Rebuild lookup entities if necessary
3. Validate consistency using maintenance scripts or functions

#### Rebuild Search Entities
1. Scan authoritative entities from primary tables
2. Recreate search and lookup entities
3. Validate counts and sample records

### Scheduled Operations

Recommended scheduled maintenance functions:
- Archive old audit logs
- Export tables for backup
- Rebuild search entities if drift is detected

### Disaster Recovery

Production recommendations:
- Use geo-redundant storage if business continuity requires it
- Keep infrastructure definitions in source control
- Document environment recreation steps
- Test recovery procedures periodically in staging

### Operational Runbook Topics

The operations team should maintain procedures for:
- Rotating signing keys and the email credential master key in SWA application settings (see `README-SWA.md`, 'Key rotation')
- Resetting user passwords securely
- Investigating authentication spikes
- Rebuilding lookup entities
- Handling storage throttling incidents

---

## Deployment Checklist

### Pre-Deployment

- [ ] All tests passing
- [ ] Dependency and security scans completed
- [ ] Infrastructure templates validated
- [ ] Azure resources provisioned or updated
- [ ] Environment variables configured
- [ ] SWA application settings configured, including `JWT_SECRET`, `AZURE_STORAGE_CONNECTION_STRING`, `ALLOWED_ORIGIN` and `EMAIL_CREDENTIALS_ENCRYPTION_KEY` (64 hex chars, set **before** release)
- [ ] Managed identity permissions assigned
- [ ] Storage tables created
- [ ] Backup and retention strategy configured
- [ ] DNS and custom domains configured
- [ ] TLS certificates validated
- [ ] Rollback or recovery plan documented

### Deployment

- [ ] Deploy infrastructure changes
- [ ] Deploy frontend and API together to Azure Static Web Apps (`deploy-production.yml`)
- [ ] Verify SWA application settings (email key present; no value copied into source control)
- [ ] Verify storage access
- [ ] Run smoke tests
- [ ] Test authentication flow
- [ ] Test patient and examination workflows
- [ ] Test client-side PDF generation and print workflow
- [ ] Test email delivery: save a Gmail/Yahoo app password on Email Settings, press 'Send test email', then send a report to a test mailbox (hosted end-to-end check, sub-task 8)
- [ ] Monitor logs and alerts for errors

### Post-Deployment

- [ ] Monitor system metrics
- [ ] Check error rates
- [ ] Verify backups and exports running
- [ ] Confirm audit logging
- [ ] Update documentation if needed
- [ ] Notify stakeholders
- [ ] Schedule post-deployment review

---

**Related Documents:**
- 01-architecture-overview.md - System architecture
- 03-security-architecture.md - Security implementation
- 04-api-specification.md - API specification
