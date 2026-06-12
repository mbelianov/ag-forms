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
│  │ Azure Functions                                              │  │
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
│  │ - Protected Function App environment settings                │  │
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
- Keep backend secrets in protected Azure Function App environment settings
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
- **Platform:** Azure Functions
- **Runtime:** Node.js 20.x LTS
- **Plan:** Consumption Plan or Premium Plan depending on latency and scaling requirements
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
| Azure Function App | API, authentication, validation, and calculations |
| Azure Storage Account | Tables |
| Azure Function App environment settings | Protected backend secrets and signing keys |
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
func-ultrasound-prod
stultrasoundprod
kv-ultrasound-prod
appi-ultrasound-prod
law-ultrasound-prod
afd-ultrasound-prod
```

### Function App Structure

The Function App hosts:
- Authentication endpoints
- Patient endpoints
- Examination endpoints
- User management endpoints
- Audit log endpoints
- Scheduled maintenance functions for cleanup and retention

### Managed Identity Configuration

The Function App must use a system-assigned or user-assigned managed identity.

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
- Use managed identity for Function App access
- Restrict access using RBAC
- Enable encryption at rest

### Initial Data Setup

Initial setup tasks:
1. Provision storage account
2. Create required tables
3. Seed initial admin user through a controlled bootstrap process
4. Store signing keys and secrets in protected Azure Function App environment settings

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

#### Azure Functions

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


TOKEN_EXPIRATION_HOURS=8
PASSWORD_HASH_ALGORITHM=argon2id
RATE_LIMIT_WINDOW_SECONDS=900
RATE_LIMIT_MAX=100

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

Store in protected Azure Function App environment settings:
- Token signing key
- SMTP or transactional email provider credentials for report delivery
- Any third-party integration secrets
- Any fallback storage connection secrets if managed identity is unavailable

Preferred pattern:
- Function App reads secrets from protected application settings
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
5. Deploy Azure Functions to Function App
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

### Example GitHub Actions Workflow

```yaml
name: Azure Serverless CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install frontend dependencies
        run: cd frontend && npm ci

      - name: Install api dependencies
        run: cd api && npm ci

      - name: Run frontend tests
        run: cd frontend && npm test

      - name: Run api tests
        run: cd api && npm test

      - name: Run linting
        run: |
          cd frontend && npm run lint
          cd ../api && npm run lint

      - name: Run dependency audit
        run: |
          cd frontend && npm audit --audit-level=high
          cd ../api && npm audit --audit-level=high

  deploy-infra:
    needs: validate
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4

      - name: Azure login
        uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - name: Deploy Bicep
        run: |
          az deployment group create \
            --resource-group rg-ultrasound-prod \
            --template-file infra/main.bicep \
            --parameters @infra/prod.parameters.json

  deploy-functions:
    needs: deploy-infra
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4

      - name: Azure login
        uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install api dependencies
        run: cd api && npm ci

      - name: Deploy Azure Functions
        uses: Azure/functions-action@v1
        with:
          app-name: func-ultrasound-prod
          package: api

  deploy-frontend:
    needs: deploy-infra
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4

      - name: Deploy Static Web App
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: upload
          app_location: frontend
          output_location: dist
```

### Infrastructure as Code

Preferred options:
- **Bicep** for Azure-native deployments
- **Terraform** if multi-cloud tooling standardization is required

Provision through IaC:
- Resource groups
- Static Web App
- Function App
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
- Rotating signing keys in protected Function App settings
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
- [ ] Protected Function App environment settings configured
- [ ] Managed identity permissions assigned
- [ ] Storage tables created
- [ ] Backup and retention strategy configured
- [ ] DNS and custom domains configured
- [ ] TLS certificates validated
- [ ] Rollback or recovery plan documented

### Deployment

- [ ] Deploy infrastructure changes
- [ ] Deploy Azure Functions
- [ ] Deploy frontend to Azure Static Web Apps
- [ ] Verify Function App configuration
- [ ] Verify protected Function App environment settings
- [ ] Verify storage access
- [ ] Run smoke tests
- [ ] Test authentication flow
- [ ] Test patient and examination workflows
- [ ] Test client-side PDF generation and print workflow
- [ ] Test secure email delivery of PDF reports to patient email addresses
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