# Security Architecture Documentation
## Ultrasound Form Cloud Application

**Document Version:** 2.0  
**Date:** June 12, 2026  
**Related:** 01-architecture-overview.md, 02-database-design.md

---

## Table of Contents

1. [Security Overview](#security-overview)
2. [Security Layers](#security-layers)
3. [Authentication](#authentication)
4. [Authorization](#authorization)
5. [Data Protection](#data-protection)
6. [Security Best Practices](#security-best-practices)
7. [Compliance](#compliance)

---

## Security Overview

### Security Principles

The application follows these core security principles:
- **Defense in Depth:** Multiple layers of security controls across edge, application, storage, and operations
- **Least Privilege:** Users, functions, and services receive only the permissions they require
- **Secure by Default:** Security controls are enabled by default in all environments
- **Zero Trust:** Every request is authenticated, authorized, validated, and logged
- **Privacy by Design:** Medical data protection is built into the architecture from the start

### Threat Model

| Threat | Risk Level | Mitigation |
|--------|-----------|------------|
| Unauthorized Access | High | Strong authentication, RBAC, account lockout |
| Data Breach | High | Encryption at rest and in transit, protected Function App settings, managed identities |
| Injection Attacks | High | Strict input validation, output encoding, no dynamic query execution |
| XSS Attacks | Medium | Input sanitization, CSP headers, output encoding |
| CSRF Attacks | Medium | SameSite cookies, anti-CSRF strategy for cookie-based flows |
| Brute Force | Medium | Account lockout, rate limiting, monitoring |
| Session Hijacking | Medium | Secure cookies, token expiration, server-side validation |
| Man-in-the-Middle | High | TLS 1.2+, managed certificates, HTTPS-only |
| Storage Misconfiguration | High | Private storage endpoints, RBAC, managed identities |
| Excessive Data Exposure | High | Minimal response payloads, role checks, audit logging |

### Security Scope

This document covers the Azure serverless target architecture:
- React frontend hosted on Azure Static Web Apps
- Azure Functions for API, calculations, secure access to canonical examination data, and controlled email delivery
- Azure Table Storage for operational data
- Azure Function App environment settings for protected backend secrets and signing material
- Azure Monitor and Application Insights for telemetry

### Security Compliance Notes

This design complies with the mandatory security constraints for this task because:
- Secrets are not hardcoded and are stored in protected Azure Function App environment settings
- TLS 1.2+ is required for all external communication
- No service binding to `0.0.0.0` is recommended
- Sensitive data is not logged
- Input validation is enforced server-side
- Authorization is checked on every protected request
- Azure managed services are used to reduce infrastructure attack surface

---

## Security Layers

```text
┌──────────────────────────────────────────────────────────────┐
│ Layer 1: Edge and Network Security                          │
│ - HTTPS/TLS 1.2+                                            │
│ - Azure Static Web Apps managed TLS                         │
│ - Optional Azure Front Door + WAF                           │
│ - DDoS protections from Azure platform                      │
└──────────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────▼────────────────────────────────────┐
│ Layer 2: Application Security                               │
│ - Application-managed authentication                        │
│ - Role-based access control (RBAC)                          │
│ - Input validation and sanitization                         │
│ - Rate limiting and abuse monitoring                        │
│ - Secure session/token handling                             │
└──────────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────▼────────────────────────────────────┐
│ Layer 3: Data and Storage Security                          │
│ - Azure Storage encryption at rest                          │
│ - Protected Function App settings for secrets and signing keys │
│ - Managed identities for service-to-service access          │
│ - Private storage access patterns                           │
│ - Audit logging and retention controls                      │
└──────────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────▼────────────────────────────────────┐
│ Layer 4: Operations and Monitoring                          │
│ - Application Insights telemetry                            │
│ - Azure Monitor alerts                                      │
│ - Security event monitoring                                 │
│ - Deployment controls and environment separation            │
└──────────────────────────────────────────────────────────────┘
```

---

## Authentication

### Authentication Model

The approved implementation uses **application-managed users** stored in Azure Table Storage.

This means:
- User accounts are created and managed by the application
- Password hashes are stored in the `Users` table
- Login is handled by Azure Functions
- Session or token issuance is handled by the application
- Microsoft Entra ID is documented as a future enhancement, not the current primary identity provider

### Authentication Flow

```text
┌─────────┐                                      ┌────────────────────┐
│ Client  │                                      │ Azure Functions    │
└────┬────┘                                      └─────────┬──────────┘
     │                                                     │
     │ 1. POST /api/v1/auth/login                          │
     │    { username, password }                           │
     ├────────────────────────────────────────────────────▶│
     │                                                     │
     │                                  2. Lookup username │
     │                                     in Azure Tables │
     │                                                     │
     │                                  3. Verify password │
     │                                     hash securely   │
     │                                                     │
     │                                  4. Check account   │
     │                                     status/lockout  │
     │                                                     │
     │                                  5. Issue signed    │
     │                                     token/session   │
     │                                                     │
     │ 6. Return secure cookie or token                    │
     │◀────────────────────────────────────────────────────┤
     │                                                     │
     │ 7. Subsequent protected requests                    │
     ├────────────────────────────────────────────────────▶│
     │                                                     │
     │                                  8. Validate token  │
     │                                     and role        │
     │                                                     │
     │ 9. Return protected data                            │
     │◀────────────────────────────────────────────────────┤
```

### Password Security

#### Password Requirements
- Minimum 12 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- At least 1 special character
- Cannot contain username
- Cannot be a common password
- Must be validated server-side

#### Password Hashing

Passwords must never be stored in plaintext or reversible encryption.

Recommended implementation:
- **Preferred:** Argon2id
- **Acceptable fallback:** bcrypt with strong cost factor

Because package recommendations must be actively maintained and current, the implementation should use the latest stable maintained package at build time and verify maintenance status during dependency selection.

Example conceptual flow:

```typescript
async function hashPassword(plainPassword: string): Promise<string> {
  // Use Argon2id or bcrypt with current secure settings
  return secureHashLibrary.hash(plainPassword);
}

async function verifyPassword(
  plainPassword: string,
  storedHash: string
): Promise<boolean> {
  return secureHashLibrary.verify(storedHash, plainPassword);
}
```

### Brute Force Protection

The application must implement:
- Failed login attempt counting
- Temporary account lockout after repeated failures
- Monitoring and alerting for repeated abuse
- Generic error messages that do not reveal whether username or password was incorrect

Recommended policy:
- Lock account after 5 failed attempts
- Lock duration: 30 minutes
- Reset failed attempts after successful login

### Session and Token Management

Two acceptable patterns exist:
1. **Secure httpOnly cookie**
2. **Bearer token returned to the frontend and stored securely in memory**

Preferred for browser-based application:
- Secure httpOnly cookie
- `Secure=true`
- `HttpOnly=true`
- `SameSite=Strict` or `Lax` depending on UX requirements
- Short expiration with re-authentication or refresh strategy

Token requirements:
- Signed with key material stored in protected Azure Function App environment settings
- Expiration enforced
- Include only minimal claims:
  - `sub`
  - `username`
  - `role`
  - `iat`
  - `exp`

### Future Enhancement: Microsoft Entra ID

A future version may replace application-managed authentication with Microsoft Entra ID for:
- Enterprise SSO
- Conditional access
- MFA integration
- Centralized identity lifecycle management

This is not part of the current implementation baseline.

---

## Authorization

### Role-Based Access Control (RBAC)

#### Role Definitions

| Role | Description |
|------|-------------|
| `admin` | Full administrative access including user management and audit review |
| `doctor` | Full patient and examination management |
| `viewer` | Read-only access to patients, examinations, and reports |

### Permission Model

| Permission | Admin | Doctor | Viewer |
|-----------|-------|--------|--------|
| users:create | Yes | No | No |
| users:read | Yes | Own only | No |
| users:update | Yes | Own only | No |
| users:deactivate | Yes | No | No |
| patients:create | Yes | Yes | No |
| patients:read | Yes | Yes | Yes |
| patients:update | Yes | Yes | No |
| patients:delete | Yes | Yes | No |
| examinations:create | Yes | Yes | No |
| examinations:read | Yes | Yes | Yes |
| examinations:update | Yes | Yes | No |
| examinations:delete | Yes | Yes | No |
| reports:generate | Yes | Yes | Yes |
| reports:email | Yes | Yes | No |
| audit:read | Yes | No | No |

### Authorization Enforcement

Authorization must be enforced:
- In every protected Azure Function
- On every request, not only in the frontend
- Before reading or mutating protected resources
- Before allowing access to data used for client-side PDF generation
- Before sending report emails to patient addresses

Authorization checks must use:
- Authenticated user identity
- User role
- Resource ownership rules where applicable
- Soft-delete state of the target resource

### Authorization Rules

1. Frontend route protection is convenience only and not authoritative
2. Azure Functions must validate role and resource access on every request
3. Audit log access is restricted to admins
4. User management is restricted to admins
5. Doctors and admins may create and update patient and examination records
6. Viewers may only read permitted resources

### Example Authorization Logic

```typescript
function authorize(userRole: string, allowedRoles: string[]): void {
  if (!allowedRoles.includes(userRole)) {
    throw new ForbiddenError("Insufficient permissions");
  }
}
```

Error responses must remain generic and must not disclose internal authorization logic beyond what is necessary.

---

## Data Protection

### Encryption at Rest

Azure Storage provides encryption at rest by default. The design requires:
- Azure Storage encryption enabled
- Key material protected in Azure Function App environment settings
- Customer-managed keys considered if compliance requires them
- Tables and any supporting storage resources restricted to authorized identities only

Sensitive data handling rules:
- Do not store secrets in Azure Tables
- Do not store plaintext passwords
- Do not store unnecessary PII in logs
- Store only required medical and operational data

### Encryption in Transit

All network communication must use TLS 1.2 or higher.

Compliant requirements:
- Production frontend served only over HTTPS
- API endpoints exposed only over HTTPS
- Storage access performed through Azure SDKs over TLS
- Certificate validation must remain enabled

Non-compliant patterns:
- Disabling certificate validation
- Using HTTP for production traffic
- Passing secrets in query strings

### Secrets Management

All secrets must be stored in protected Azure Function App environment settings or equivalent secure Azure-managed application configuration.

Examples of secrets:
- Token signing keys
- Storage connection settings if managed identity is unavailable
- SMTP credentials or transactional email provider credentials for report delivery
- Encryption configuration

Preferred access pattern:
- Azure Functions use **managed identity**
- Managed identity is granted access to Storage
- Secrets are injected securely through platform-managed application settings

### Managed Identity

Managed identity is required wherever supported because it:
- Eliminates embedded credentials
- Reduces secret sprawl
- Supports least-privilege access
- Improves auditability

Recommended assignments:
- Azure Functions managed identity → Storage Table Data Contributor

### Data Minimization

The application must:
- Return only fields required by the client
- Avoid exposing password metadata or internal storage pointers
- Avoid returning audit internals to non-admin users
- Avoid embedding sensitive data in URLs

### Audit Logging

Audit logging is mandatory for:
- Login attempts
- User creation and deactivation
- Patient create/update/delete
- Examination create/update/delete
- Client-side PDF generation requests
- Report email delivery requests
- Administrative access to audit data

Audit logs must:
- Be append-only
- Exclude plaintext secrets and passwords
- Avoid storing full sensitive payloads unless required
- Mask or omit sensitive fields where possible
- Be retained according to policy

Example structured audit event:

```json
{
  "action": "patients:update",
  "resource_type": "patient",
  "resource_id": "patient-uuid",
  "user_id": "user-uuid",
  "status_code": 200,
  "created_at": "2026-06-12T09:00:00Z"
}
```

### Logging Restrictions

The system must never log:
- Passwords
- Token values
- Secret values from protected application settings
- Full authentication headers
- Full medical payloads unless explicitly required and approved
- Raw exception stacks to end users

Detailed errors may be logged server-side in protected telemetry only.

---

## Security Best Practices

### Input Validation

All user input must be validated server-side.

Validation requirements:
- Type validation
- Length validation
- Format validation
- Range validation
- Allowlist-based validation where possible
- Reject invalid input with generic client-safe messages

Example conceptual schema:

```typescript
const patientSchema = {
  name: "string|min:2|max:255|required",
  age: "integer|min:15|max:50|required",
  address: "string|max:500|optional",
  phone: "phone|optional",
  email: "email|optional"
};
```

### Output Encoding

Outputs must be encoded according to context:
- HTML output encoded in frontend rendering contexts
- URL parameters encoded before use
- JSON responses serialized safely
- No direct rendering of untrusted HTML

### Injection Prevention

Although Azure Table Storage is not SQL-based, injection risks still exist in:
- Dynamic filter construction
- Log injection
- HTML rendering
- Command execution in background jobs

Required controls:
- Never build unsafe dynamic expressions from raw user input
- Validate and normalize filter parameters
- Avoid `eval`, `exec`, or equivalent unsafe execution
- Encode output in the frontend

### Rate Limiting and Abuse Protection

The application must implement:
- Login rate limiting
- General API throttling
- Monitoring for repeated failures
- Alerting for suspicious patterns

Implementation options:
- Azure Front Door or WAF rate limiting
- Function-level throttling logic
- Storage-backed counters for abuse detection

### Security Headers

The frontend should enforce:
- Content-Security-Policy
- Strict-Transport-Security
- X-Content-Type-Options
- X-Frame-Options
- Referrer-Policy

These headers should be configured through Azure Static Web Apps or edge configuration.

### CORS Configuration

CORS must be restrictive:
- Allow only approved frontend origins
- Allow credentials only when required
- Restrict methods and headers to the minimum necessary set

### Error Handling

The application must:
- Return generic error messages to clients
- Avoid exposing stack traces
- Avoid exposing storage account names, internal IDs, or secret references
- Log detailed errors only in protected telemetry

Compliant client response:
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred"
  }
}
```

### Dependency and Security Testing

Before deployment:
- Run dependency vulnerability scanning
- Run static analysis
- Run unit and integration tests
- Review package freshness and maintenance status
- Validate no critical or high vulnerabilities remain unaddressed

---

## Compliance

### GDPR and Medical Data Protection

#### Data Subject Rights
- **Right to Access:** Users can request their data
- **Right to Rectification:** Users can correct their data
- **Right to Erasure:** Users can request deletion where legally permitted
- **Right to Portability:** Users can export their data
- **Right to Object:** Users can object to processing where applicable

### Retention Policy

| Data Type | Retention Period | Action After Retention |
|-----------|------------------|------------------------|
| User Accounts | Active + 1 year | Deactivate or anonymize |
| Patient Records | 7 years | Archive, then delete per policy |
| Examinations | 7 years | Archive, then delete per policy |
| Audit Logs | 3 years | Archive, then delete |
| Generated PDFs | Not persisted by platform in current design | User-controlled local handling only |
| Backups/Exports | 30 days or policy-defined | Delete |

### Incident Response

#### Incident Response Plan
1. **Detection:** Monitor alerts, logs, and user reports
2. **Containment:** Disable affected accounts or functions, restrict access
3. **Eradication:** Remove root cause, rotate secrets, patch vulnerabilities
4. **Recovery:** Restore services and validate integrity
5. **Lessons Learned:** Document findings and improve controls

#### Incident Response Team
- **Incident Commander:** CTO or Security Lead
- **Technical Lead:** Senior Developer or Cloud Engineer
- **Communications Lead:** Product Manager
- **Legal Advisor:** Legal Counsel

---

## Security Checklist

### Pre-Deployment Security Checklist

- [ ] Passwords hashed with a secure modern algorithm
- [ ] Token signing keys stored in protected Azure Function App environment settings
- [ ] HTTPS/TLS 1.2+ enabled everywhere
- [ ] Managed identities configured for Azure Functions
- [ ] Storage access restricted by RBAC
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] Input validation on all endpoints
- [ ] Output encoding implemented in frontend
- [ ] Sensitive data excluded from logs
- [ ] Audit logging implemented
- [ ] Backup/export strategy automated
- [ ] No hardcoded credentials in code or docs
- [ ] Security testing completed
- [ ] Vulnerability scanning completed
- [ ] Alerting configured for critical failures and abuse patterns

---

**Related Documents:**
- 01-architecture-overview.md - System architecture
- 02-database-design.md - Storage design
- 04-api-specification.md - API documentation