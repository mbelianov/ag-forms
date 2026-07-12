# API Specification Documentation
## Ultrasound Form Cloud Application

**Document Version:** 2.0  
**Date:** June 12, 2026  
**Base URL:** `https://api.ultrasound-app.example.com/api/v1`  
**Related:** 01-architecture-overview.md, 03-security-architecture.md

---

## Table of Contents

1. [API Overview](#api-overview)
2. [Authentication Endpoints](#authentication-endpoints)
3. [Patient Endpoints](#patient-endpoints)
4. [Examination Endpoints](#examination-endpoints)
5. [User Management Endpoints](#user-management-endpoints)
6. [Audit Log Endpoints](#audit-log-endpoints)
7. [Error Handling](#error-handling)

---

## API Overview

### API Design Principles

- **Function-backed HTTP API:** Each endpoint is implemented by an Azure Function
- **REST-like resource model:** Resource-oriented URLs and standard HTTP methods
- **JSON:** All requests and responses use JSON except binary PDF responses
- **Versioned:** API version in URL path (`/api/v1/`)
- **Secure:** HTTPS only, authenticated access required for protected endpoints
- **Consistent:** Standard response envelope across all endpoints
- **Serverless-aware:** PDF output is rendered on demand and returned directly to the client

### Base URL

```text
Production:  https://api.ultrasound-app.example.com/api/v1
Staging:     https://staging-api.ultrasound-app.example.com/api/v1
Development: http://localhost:7071/api/v1
```

### Authentication

All endpoints except `/auth/login` require authentication.

Supported patterns:
- Secure httpOnly cookie
- Or bearer token if the frontend integration chooses token-based transport

Example:

```http
Cookie: session_token=<signed-token>
```

or

```http
Authorization: Bearer <signed-token>
```

### Standard Response Format

#### Success Response

```json
{
  "success": true,
  "data": {},
  "meta": {
    "timestamp": "2026-06-12T10:30:00Z",
    "request_id": "req_abc123"
  }
}
```

#### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": []
  },
  "meta": {
    "timestamp": "2026-06-12T10:30:00Z",
    "request_id": "req_abc123"
  }
}
```

### Concurrency and ETags

Azure Table Storage uses optimistic concurrency. For update operations:
- The API may return an `etag` field in resource responses
- Clients should send the current ETag when updating mutable resources
- Conflicting updates return `409 Conflict`

### Pagination Model

Because Azure Table Storage does not support SQL-style offset pagination efficiently, list endpoints use:
- `limit`
- `continuation_token`

This replaces page-number-based pagination for scalable serverless access patterns.

### HTTP Status Codes

| Code | Meaning | Usage |
|------|---------|-------|
| 200 | OK | Successful GET, PUT, POST for synchronous operations |
| 201 | Created | Successful resource creation |
| 202 | Accepted | Reserved for future asynchronous operations if introduced |
| 204 | No Content | Successful delete with no body when used |
| 400 | Bad Request | Invalid request data |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Concurrency conflict or duplicate resource |
| 422 | Unprocessable Entity | Validation error |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |
| 503 | Service Unavailable | Temporary service issue |

---

## Authentication Endpoints

### POST /auth/login

Authenticate user and establish a session.

**Request:**

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "username": "dr.arabadzhikova",
  "password": "SecureP@ss123"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "username": "dr.arabadzhikova",
      "full_name": "Dr. Arabadzhikova",
      "email": "arabadzhikova@hospital.bg",
      "role": "doctor"
    }
  },
  "meta": {
    "timestamp": "2026-06-12T10:30:00Z",
    "request_id": "req_login_001"
  }
}
```

**Set-Cookie Header Example:**

```text
Set-Cookie: session_token=<signed-token>; HttpOnly; Secure; SameSite=Strict; Max-Age=28800; Path=/
```

**Errors:**
- `401 Unauthorized`: Invalid credentials
- `423 Locked`: Account locked due to failed attempts
- `429 Too Many Requests`: Too many login attempts

---

### POST /auth/logout

Logout user and invalidate the current session.

**Request:**

```http
POST /api/v1/auth/logout
Cookie: session_token=<signed-token>
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  },
  "meta": {
    "timestamp": "2026-06-12T10:35:00Z",
    "request_id": "req_logout_001"
  }
}
```

---

### GET /auth/me

Get current authenticated user information.

**Request:**

```http
GET /api/v1/auth/me
Cookie: session_token=<signed-token>
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "username": "dr.arabadzhikova",
    "full_name": "Dr. Arabadzhikova",
    "email": "arabadzhikova@hospital.bg",
    "role": "doctor",
    "last_login": "2026-06-12T09:00:00Z"
  },
  "meta": {
    "timestamp": "2026-06-12T10:36:00Z",
    "request_id": "req_me_001"
  }
}
```

---

### POST /auth/change-password

Change the current user password.

**Request:**

```http
POST /api/v1/auth/change-password
Cookie: session_token=<signed-token>
Content-Type: application/json

{
  "current_password": "OldP@ss123",
  "new_password": "NewP@ss456",
  "confirm_password": "NewP@ss456"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "message": "Password changed successfully"
  },
  "meta": {
    "timestamp": "2026-06-12T10:40:00Z",
    "request_id": "req_pwd_001"
  }
}
```

**Errors:**
- `400 Bad Request`: Passwords do not match
- `401 Unauthorized`: Current password incorrect
- `422 Unprocessable Entity`: Password does not meet requirements

---

## Patient Endpoints

### GET /patients

List patients using continuation-token pagination.

**Request:**

```http
GET /api/v1/patients?limit=20&search=Maria
Cookie: session_token=<signed-token>
```

**Query Parameters:**
- `limit` (optional): Items per page, default `20`, max `100`
- `search` (optional): Exact or prefix-oriented patient search
- `continuation_token` (optional): Token returned by previous response
- `sort` (optional): Limited supported values such as `name` or `created_at`
- `order` (optional): `asc` or `desc` where supported by the backing query pattern

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "patients": [
      {
        "id": "660e8400-e29b-41d4-a716-446655440001",
        "name": "Мария Иванова",
        "age": 28,
        "created_at": "2026-06-10T10:30:00Z",
        "etag": "W/\"datetime'2026-06-10T10%3A30%3A00.0000000Z'\""
      }
    ],
    "pagination": {
      "limit": 20,
      "continuation_token": "next-token-value",
      "has_more": true
    }
  },
  "meta": {
    "timestamp": "2026-06-12T10:45:00Z",
    "request_id": "req_patients_list_001"
  }
}
```

---

### POST /patients

Create a new patient.

**Request:**

```http
POST /api/v1/patients
Cookie: session_token=<signed-token>
Content-Type: application/json

{
  "name": "Мария Иванова",
  "age": 28,
  "address": "София, ул. Витоша 15",
  "phone": "+359888123456",
  "email": "maria.ivanova@email.bg"
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "name": "Мария Иванова",
    "age": 28,
    "address": "София, ул. Витоша 15",
    "phone": "+359888123456",
    "email": "maria.ivanova@email.bg",
    "created_by": "550e8400-e29b-41d4-a716-446655440000",
    "created_at": "2026-06-12T10:46:00Z",
    "etag": "W/\"datetime'2026-06-12T10%3A46%3A00.0000000Z'\""
  },
  "meta": {
    "timestamp": "2026-06-12T10:46:00Z",
    "request_id": "req_patients_create_001"
  }
}
```

**Errors:**
- `400 Bad Request`: Invalid input data
- `422 Unprocessable Entity`: Validation errors

---

### GET /patients/:id

Get a specific patient by ID.

**Request:**

```http
GET /api/v1/patients/660e8400-e29b-41d4-a716-446655440001
Cookie: session_token=<signed-token>
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "name": "Мария Иванова",
    "age": 28,
    "address": "София, ул. Витоша 15",
    "phone": "+359888123456",
    "email": "maria.ivanova@email.bg",
    "created_by": "550e8400-e29b-41d4-a716-446655440000",
    "created_at": "2026-06-12T10:30:00Z",
    "updated_at": "2026-06-12T10:30:00Z",
    "etag": "W/\"datetime'2026-06-12T10%3A30%3A00.0000000Z'\""
  },
  "meta": {
    "timestamp": "2026-06-12T10:47:00Z",
    "request_id": "req_patients_get_001"
  }
}
```

**Errors:**
- `404 Not Found`: Patient not found

---

### PUT /patients/:id

Update a patient using optimistic concurrency.

**Request:**

```http
PUT /api/v1/patients/660e8400-e29b-41d4-a716-446655440001
Cookie: session_token=<signed-token>
Content-Type: application/json
If-Match: W/"datetime'2026-06-12T10%3A30%3A00.0000000Z'"

{
  "name": "Мария Иванова-Петрова",
  "age": 29,
  "phone": "+359888999888"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "name": "Мария Иванова-Петрова",
    "age": 29,
    "address": "София, ул. Витоша 15",
    "phone": "+359888999888",
    "email": "maria.ivanova@email.bg",
    "updated_at": "2026-06-12T11:00:00Z",
    "etag": "W/\"datetime'2026-06-12T11%3A00%3A00.0000000Z'\""
  },
  "meta": {
    "timestamp": "2026-06-12T11:00:00Z",
    "request_id": "req_patients_update_001"
  }
}
```

**Errors:**
- `404 Not Found`: Patient not found
- `409 Conflict`: ETag mismatch or concurrent update
- `422 Unprocessable Entity`: Validation errors

---

### DELETE /patients/:id

Soft delete a patient.

**Request:**

```http
DELETE /api/v1/patients/660e8400-e29b-41d4-a716-446655440001
Cookie: session_token=<signed-token>
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "message": "Patient deleted successfully"
  },
  "meta": {
    "timestamp": "2026-06-12T11:05:00Z",
    "request_id": "req_patients_delete_001"
  }
}
```

---

## Examination Endpoints

### GET /examinations

List examinations with filters and continuation-token pagination.

**Request:**

```http
GET /api/v1/examinations?patient_id=660e8400-e29b-41d4-a716-446655440001&limit=10
Cookie: session_token=<signed-token>
```

**Query Parameters:**
- `patient_id` (optional): Filter by patient
- `status` (optional): Filter by status
- `from_date` (optional): Filter from date (`YYYY-MM-DD`)
- `to_date` (optional): Filter to date (`YYYY-MM-DD`)
- `limit` (optional): Items per page
- `continuation_token` (optional): Continuation token from previous response

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "examinations": [
      {
        "id": "770e8400-e29b-41d4-a716-446655440002",
        "mrn": "MRN-mariya-ivanova-2026-000001",
        "patient_id": "660e8400-e29b-41d4-a716-446655440001",
        "patient_name": "Мария Иванова",
        "exam_date": "2026-06-12",
        "status": "completed",
        "created_by_name": "Dr. Arabadzhikova",
        "created_at": "2026-06-12T10:35:00Z",
        "etag": "W/\"datetime'2026-06-12T10%3A35%3A00.0000000Z'\""
      }
    ],
    "pagination": {
      "limit": 10,
      "continuation_token": null,
      "has_more": false
    }
  },
  "meta": {
    "timestamp": "2026-06-12T11:10:00Z",
    "request_id": "req_exams_list_001"
  }
}
```

---

### POST /examinations

Create a new examination.

**Request:**

```http
POST /api/v1/examinations
Cookie: session_token=<signed-token>
Content-Type: application/json

{
  "patient_id": "660e8400-e29b-41d4-a716-446655440001",
  "exam_date": "2026-06-12",
  "status": "draft",
  "data": {
    "pregnancy_data": {
      "last_menstrual_period": "2026-01-15",
      "ultrasound_date": "2026-06-12",
      "obstetric_history": "G1P0",
      "family_history": "None"
    },
    "ultrasound_findings": {
      "presentation": "cephalic",
      "gender": "female",
      "heart_rate": 145,
      "fetal_movement": "active",
      "placenta": "anterior, grade 1",
      "umbilical_cord": "3 vessels"
    },
    "biometry": {
      "bpd": { "value": 52.3, "unit": "mm" },
      "hc": { "value": 185.4, "unit": "mm" },
      "ac": { "value": 162.8, "unit": "mm" },
      "fl": { "value": 35.2, "unit": "mm" },
      "efw": { "value": 425, "unit": "g" }
    },
    "anatomy": {
      "head": "normal",
      "brain": "normal",
      "heart": "4-chamber view normal",
      "abdomen": "normal",
      "kidneys": "bilateral, normal",
      "limbs": "normal",
      "skeleton": "normal"
    },
    "doppler": {
      "uterine_artery_right": { "pi": 0.85, "ri": 0.52 },
      "uterine_artery_left": { "pi": 0.88, "ri": 0.54 },
      "umbilical_artery": { "pi": 1.02, "ri": 0.65 }
    },
    "comments": "Normal examination"
  }
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "data": {
    "id": "770e8400-e29b-41d4-a716-446655440002",
    "mrn": "MRN-mariya-ivanova-2026-000001",
    "patient_id": "660e8400-e29b-41d4-a716-446655440001",
    "patient_name": "Мария Иванова",
    "exam_date": "2026-06-12",
    "status": "draft",
    "created_by": "550e8400-e29b-41d4-a716-446655440000",
    "created_at": "2026-06-12T10:35:00Z",
    "etag": "W/\"datetime'2026-06-12T10%3A35%3A00.0000000Z'\""
  },
  "meta": {
    "timestamp": "2026-06-12T10:35:00Z",
    "request_id": "req_exams_create_001"
  }
}
```

---

### GET /examinations/:id

Get a specific examination.

**Request:**

```http
GET /api/v1/examinations/770e8400-e29b-41d4-a716-446655440002
Cookie: session_token=<signed-token>
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": "770e8400-e29b-41d4-a716-446655440002",
    "mrn": "MRN-mariya-ivanova-2026-000001",
    "patient_id": "660e8400-e29b-41d4-a716-446655440001",
    "patient_name": "Мария Иванова",
    "exam_date": "2026-06-12",
    "gestational_age": "28w 3d",
    "status": "completed",
    "biometry": { "bpd": 70, "hc": 250, "ac": 220, "fl": 50 },
    "doppler": { "pi": 1.2, "ri": 0.7, "vessel": "Umbilical Artery" },
    "findings": "Normal examination",
    "notes": "",
    "created_by": "550e8400-e29b-41d4-a716-446655440000",
    "created_at": "2026-06-12T10:35:00Z",
    "updated_at": "2026-06-12T10:35:00Z",
    "etag": "W/\"datetime'2026-06-12T10%3A35%3A00.0000000Z'\""
  },
  "meta": {
    "timestamp": "2026-06-12T11:12:00Z",
    "request_id": "req_exams_get_001"
  }
}
```

---

### PUT /examinations/:id

Update an examination using optimistic concurrency.

**Request:**

```http
PUT /api/v1/examinations/770e8400-e29b-41d4-a716-446655440002
Cookie: session_token=<signed-token>
Content-Type: application/json
If-Match: W/"datetime'2026-06-12T10%3A35%3A00.0000000Z'"

{
  "status": "completed",
  "data": {
    "comments": "Updated examination data"
  }
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": "770e8400-e29b-41d4-a716-446655440002",
    "status": "completed",
    "updated_by": "550e8400-e29b-41d4-a716-446655440000",
    "updated_at": "2026-06-12T11:15:00Z",
    "etag": "W/\"datetime'2026-06-12T11%3A15%3A00.0000000Z'\""
  },
  "meta": {
    "timestamp": "2026-06-12T11:15:00Z",
    "request_id": "req_exams_update_001"
  }
}
```

**Errors:**
- `404 Not Found`: Examination not found
- `409 Conflict`: ETag mismatch or concurrent update
- `422 Unprocessable Entity`: Validation errors

---

### GET /examinations/mrn/{mrn}

Resolve a Medical Record Number to a full examination record.

**Request:**

```http
GET /api/v1/examinations/mrn/MRN-mariya-ivanova-2026-000001
Cookie: session_token=<signed-token>
```

**Route note:** The literal path segment `mrn` is matched before the `{id}` wildcard in `GET /examinations/{id}`, so there is no route collision.

**Response (200 OK):** Identical shape to `GET /examinations/:id`.

**Errors:**
- `400 Bad Request`: MRN format is invalid (does not match `MRN-{nameSegment}-YYYY-NNNNNN`)
- `404 Not Found`: No examination with this MRN exists, or it is soft-deleted

---

### ~~GET /patients/mrn/{mrn}~~ — **Retired**

`GET /v1/patients/mrn/{mrn}` is retired with no replacement at the patient level. MRN is now examination-level. Use `GET /v1/examinations/mrn/{mrn}` instead.

---

### DELETE /examinations/:id

Soft delete an examination.

**Request:**

```http
DELETE /api/v1/examinations/770e8400-e29b-41d4-a716-446655440002
Cookie: session_token=<signed-token>
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "message": "Examination deleted successfully"
  },
  "meta": {
    "timestamp": "2026-06-12T11:20:00Z",
    "request_id": "req_exams_delete_001"
  }
}
```

---

### POST /examinations/:id/calculate

Trigger or perform automatic calculations for examination data.

This endpoint executes synchronously for the current scope.

**Request:**

```http
POST /api/v1/examinations/770e8400-e29b-41d4-a716-446655440002/calculate
Cookie: session_token=<signed-token>
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "gestational_age": {
      "weeks": 21,
      "days": 3
    },
    "expected_delivery_date": "2026-10-22",
    "biometry_percentiles": {
      "bpd": 50,
      "hc": 52,
      "ac": 55,
      "fl": 50
    }
  },
  "meta": {
    "timestamp": "2026-06-12T11:25:00Z",
    "request_id": "req_exams_calc_001"
  }
}
```

---

### Client-Side PDF Generation

PDF generation is performed in the React client, not through a dedicated PDF rendering API endpoint.

Client-side flow:
1. The client retrieves the examination record through authenticated API endpoints.
2. The client uses the canonical examination payload to build a print-ready document model.
3. The browser generates the PDF locally for preview, download, or printing.
4. No PDF artifact is persisted by the platform in the current design.

There is therefore no `/examinations/:id/pdf` endpoint in the current API baseline.

**Security requirements:**
- The client must generate PDFs only from authenticated, authorized examination data returned by the API.
- Authorization remains enforced on the examination read endpoints.
- Any future server-side PDF rendering endpoint must be introduced only if compliance or formatting requirements justify it.

### POST /examinations/:id/email-report

Send the generated examination PDF report to the patient's email address.

This endpoint accepts a client-generated PDF payload and delivery metadata, validates authorization, verifies the patient email, and sends the report through the configured email provider.

**Request:**

```http
POST /api/v1/examinations/770e8400-e29b-41d4-a716-446655440002/email-report
Cookie: session_token=<signed-token>
Content-Type: application/json
```

```json
{
  "recipient_email": "maria.ivanova@email.bg",
  "subject": "Your ultrasound report",
  "message": "Please find your ultrasound report attached.",
  "file_name": "examination_770e8400_2026-06-12.pdf",
  "pdf_base64": "<base64-encoded-pdf>"
}
```

**Response (202 Accepted):**

```json
{
  "success": true,
  "data": {
    "message": "Report email accepted for delivery",
    "recipient_email": "maria.ivanova@email.bg",
    "delivery_status": "accepted"
  },
  "meta": {
    "timestamp": "2026-06-12T11:35:00Z",
    "request_id": "req_exam_email_001"
  }
}
```

**Errors:**
- `400 Bad Request`: Missing or invalid email payload
- `403 Forbidden`: User not allowed to send the report
- `404 Not Found`: Examination or patient not found
- `422 Unprocessable Entity`: Invalid recipient email
- `502 Bad Gateway`: Email provider delivery failure

---

## User Management Endpoints

### GET /users

List users. Admin only.

**Request:**

```http
GET /api/v1/users?limit=20
Cookie: session_token=<signed-token>
```

**Query Parameters:**
- `limit` (optional): Items per page
- `continuation_token` (optional): Continuation token from previous response

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "username": "dr.arabadzhikova",
        "full_name": "Dr. Arabadzhikova",
        "email": "arabadzhikova@hospital.bg",
        "role": "doctor",
        "is_active": true,
        "last_login": "2026-06-12T09:00:00Z",
        "created_at": "2026-01-01T00:00:00Z",
        "etag": "W/\"datetime'2026-01-01T00%3A00%3A00.0000000Z'\""
      }
    ],
    "pagination": {
      "limit": 20,
      "continuation_token": null,
      "has_more": false
    }
  },
  "meta": {
    "timestamp": "2026-06-12T11:35:00Z",
    "request_id": "req_users_list_001"
  }
}
```

---

### POST /users

Create a new user. Admin only.

**Request:**

```http
POST /api/v1/users
Cookie: session_token=<signed-token>
Content-Type: application/json

{
  "username": "dr.petrov",
  "password": "SecureP@ss123",
  "full_name": "Dr. Petrov",
  "email": "petrov@hospital.bg",
  "role": "doctor"
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "data": {
    "id": "880e8400-e29b-41d4-a716-446655440003",
    "username": "dr.petrov",
    "full_name": "Dr. Petrov",
    "email": "petrov@hospital.bg",
    "role": "doctor",
    "is_active": true,
    "created_at": "2026-06-12T11:36:00Z",
    "etag": "W/\"datetime'2026-06-12T11%3A36%3A00.0000000Z'\""
  },
  "meta": {
    "timestamp": "2026-06-12T11:36:00Z",
    "request_id": "req_users_create_001"
  }
}
```

**Errors:**
- `409 Conflict`: Username already exists
- `422 Unprocessable Entity`: Validation errors

---

### PUT /users/:id

Update a user profile or role. Admin only, except self-service profile updates if enabled later.

**Request:**

```http
PUT /api/v1/users/880e8400-e29b-41d4-a716-446655440003
Cookie: session_token=<signed-token>
Content-Type: application/json
If-Match: W/"datetime'2026-06-12T11%3A36%3A00.0000000Z'"

{
  "full_name": "Dr. Ivan Petrov",
  "role": "doctor",
  "is_active": true
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": "880e8400-e29b-41d4-a716-446655440003",
    "username": "dr.petrov",
    "full_name": "Dr. Ivan Petrov",
    "email": "petrov@hospital.bg",
    "role": "doctor",
    "is_active": true,
    "updated_at": "2026-06-12T11:40:00Z",
    "etag": "W/\"datetime'2026-06-12T11%3A40%3A00.0000000Z'\""
  },
  "meta": {
    "timestamp": "2026-06-12T11:40:00Z",
    "request_id": "req_users_update_001"
  }
}
```

---

## Audit Log Endpoints

### GET /audit-logs

Get audit logs. Admin only.

**Request:**

```http
GET /api/v1/audit-logs?limit=50&action=login&month=2026-06
Cookie: session_token=<signed-token>
```

**Query Parameters:**
- `user_id` (optional): Filter by user
- `action` (optional): Filter by action
- `resource_type` (optional): Filter by resource type
- `from_date` (optional): Filter from date
- `to_date` (optional): Filter to date
- `month` (optional): Preferred partition hint for efficient retrieval
- `limit` (optional): Items per page
- `continuation_token` (optional): Continuation token from previous response

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "990e8400-e29b-41d4-a716-446655440004",
        "user_id": "550e8400-e29b-41d4-a716-446655440000",
        "user_name": "Dr. Arabadzhikova",
        "action": "login",
        "resource_type": null,
        "resource_id": null,
        "ip_address": "192.168.1.100",
        "created_at": "2026-06-12T09:00:00Z"
      }
    ],
    "pagination": {
      "limit": 50,
      "continuation_token": null,
      "has_more": false
    }
  },
  "meta": {
    "timestamp": "2026-06-12T11:45:00Z",
    "request_id": "req_audit_list_001"
  }
}
```

---

## Error Handling

### Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Input validation failed |
| `AUTHENTICATION_ERROR` | Authentication failed |
| `AUTHORIZATION_ERROR` | Insufficient permissions |
| `NOT_FOUND` | Resource not found |
| `CONFLICT` | Resource conflict or concurrency mismatch |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `INTERNAL_ERROR` | Server error |
| `ACCOUNT_LOCKED` | Account temporarily locked |

### Example Error Responses

**Validation Error (422):**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "age",
        "message": "Age must be between 15 and 50"
      },
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  },
  "meta": {
    "timestamp": "2026-06-12T11:50:00Z",
    "request_id": "req_error_001"
  }
}
```

**Authentication Error (401):**

```json
{
  "success": false,
  "error": {
    "code": "AUTHENTICATION_ERROR",
    "message": "Invalid credentials"
  },
  "meta": {
    "timestamp": "2026-06-12T11:50:10Z",
    "request_id": "req_error_002"
  }
}
```

**Authorization Error (403):**

```json
{
  "success": false,
  "error": {
    "code": "AUTHORIZATION_ERROR",
    "message": "Insufficient permissions to perform this action"
  },
  "meta": {
    "timestamp": "2026-06-12T11:50:20Z",
    "request_id": "req_error_003"
  }
}
```

**Conflict Error (409):**

```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "The resource was modified by another request"
  },
  "meta": {
    "timestamp": "2026-06-12T11:50:30Z",
    "request_id": "req_error_004"
  }
}
```

**Job Not Ready Error (409):**

```json
{
  "success": false,
  "error": {
    "code": "JOB_NOT_READY",
    "message": "The requested report is not ready yet"
  },
  "meta": {
    "timestamp": "2026-06-12T11:50:40Z",
    "request_id": "req_error_005"
  }
}
```

**Not Found Error (404):**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Patient not found"
  },
  "meta": {
    "timestamp": "2026-06-12T11:50:50Z",
    "request_id": "req_error_006"
  }
}
```

---

**Related Documents:**
- 01-architecture-overview.md - System architecture
- 03-security-architecture.md - Security implementation
- 05-deployment-guide.md - Deployment and operations