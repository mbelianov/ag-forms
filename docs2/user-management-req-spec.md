# User Management — Requirements Specification

**Version:** 1.0  
**Status:** Draft  
**Scope:** Admin-managed user lifecycle (create, update, delete, password reset) and self-service password change.

---

## 1. Overview

The application uses Azure Table Storage with a three-role model (`admin`, `doctor`, `viewer`). User records live in the `Users` table under two partition keys: `USER/{userId}` for the user entity and `USERNAME/{normalizedUsername}` for the lookup index. Authentication is JWT-based with a 24-hour token lifetime and HttpOnly session cookies.

The following capabilities are **already implemented** and are included only for completeness:

- Create User (`POST /v1/users`)
- Update User (`PUT /v1/users/{id}`) — fullName, role, isActive
- Self-Service Change Password (`POST /v1/auth/change-password`)

The following capabilities are **not yet implemented** and are the subject of this specification:

- Delete User (`DELETE /v1/users/{id}`) with examination reassignment
- Admin-Forced Password Reset (`POST /v1/users/{id}/reset-password`)

---

## 2. Roles and Permissions

| Operation                    | admin | doctor | viewer |
|------------------------------|:-----:|:------:|:------:|
| List users                   | ✓     | ✗      | ✗      |
| Create user                  | ✓     | ✗      | ✗      |
| Update user                  | ✓     | ✗      | ✗      |
| Delete user                  | ✓     | ✗      | ✗      |
| Admin-forced password reset  | ✓     | ✗      | ✗      |
| Self-service change password | ✓     | ✓      | ✓      |

---

## 3. System Invariants

These invariants must be enforced by all write operations and must never be violated:

- **INV-01 — At least one admin:** The system must always contain at least one active, non-deleted user with the `admin` role. Any operation that would remove the last admin must be rejected.
- **INV-02 — No self-deletion:** An admin must not be able to delete their own account via the user management API.
- **INV-03 — Soft delete only:** User records are never physically removed. Deletion sets `isDeleted = true`, `isActive = false`, and `deletedAt` on the `USER` entity and removes the `USERNAME` lookup row.
- **INV-04 — Deleted users cannot authenticate:** The login flow already checks `isDeleted`; this must remain in place.
- **INV-05 — Response payload safety:** `passwordHash`, `failedLoginAttempts`, `lockedUntil`, and `normalizedUsername` must never be returned in any user API response.
- **INV-06 — All admin write operations produce an audit log entry:** Failures in audit logging must not prevent the primary operation from completing (fire-and-forget, already the pattern in `auditService.ts`).

---

## 4. Functional Requirements

### 4.1 REQ-USR-01 — Create User *(already implemented)*

| # | Requirement |
|---|---|
| 4.1.1 | The system shall allow an admin to create a new user by providing `username`, `fullName`, `email`, `password`, and `role`. |
| 4.1.2 | Usernames shall be stored and compared case-insensitively. |
| 4.1.3 | A duplicate username shall be rejected with HTTP 409. |
| 4.1.4 | Password must meet the minimum strength policy (minimum 12 characters). |
| 4.1.5 | Role must be one of `admin`, `doctor`, `viewer`. |
| 4.1.6 | A `USER_CREATED` audit event shall be logged with `newUserId`, `newUsername`, and `newUserRole`. |

### 4.2 REQ-USR-02 — Update User *(already implemented)*

| # | Requirement |
|---|---|
| 4.2.1 | The system shall allow an admin to update `fullName`, `role`, and `isActive` for any non-deleted user. |
| 4.2.2 | `username` and `email` shall not be modifiable after creation. |
| 4.2.3 | Changing a user's role from `admin` to a non-admin role shall be rejected if that user is the only remaining active admin (INV-01). |
| 4.2.4 | A `USER_UPDATED` audit event shall be logged listing which fields were changed (no sensitive values). |

### 4.3 REQ-USR-03 — Delete User *(not implemented)*

#### 4.3.1 Backend

| # | Requirement |
|---|---|
| 4.3.1.1 | The system shall expose `DELETE /v1/users/{id}` accessible only to users with the `admin` role. |
| 4.3.1.2 | An admin shall not be able to delete their own account. Attempting to do so shall return HTTP 400 with the message `"Cannot delete your own account"`. |
| 4.3.1.3 | Deleting the last remaining active, non-deleted admin shall be rejected with HTTP 400 and the message `"Cannot delete the last admin account"`. |
| 4.3.1.4 | The request body shall optionally include `reassignTo: string` (a `userId`). |
| 4.3.1.5 | Before deleting, the system shall count non-deleted examinations where `createdBy` equals the target user's `userId`, querying the `EXAM` partition of the `Examinations` table. |
| 4.3.1.6 | If examination count > 0 and `reassignTo` is absent, the request shall be rejected with HTTP 400 and the message `"User has examinations; provide reassignTo"`. |
| 4.3.1.7 | If `reassignTo` is provided, the referenced user must exist, be active (`isActive = true`), and not be deleted (`isDeleted = false`). An invalid `reassignTo` value shall return HTTP 400. |
| 4.3.1.8 | Examination reassignment (see 4.3.2) must complete successfully before the user entity is soft-deleted. If reassignment fails for any examination, the delete operation must be aborted and the user entity must not be modified. |
| 4.3.1.9 | Soft-delete the user: set `isDeleted = true`, `isActive = false`, `deletedAt = now()` on the `USER` entity. |
| 4.3.1.10 | Remove the `USERNAME` lookup row (partition `USERNAME`, row key = `normalizedUsername`) unconditionally (wildcard etag). |
| 4.3.1.11 | A `USER_DELETED` audit event shall be logged with `deletedUserId`, `deletedUsername`, and `reassignTo` (if applicable). |

#### 4.3.2 Examination Reassignment

| # | Requirement |
|---|---|
| 4.3.2.1 | Reassignment applies to all `Examination` entities where `createdBy === deletedUserId` and `isDeleted === false`. |
| 4.3.2.2 | Because each examination is stored in three partition locations (`EXAM/{examinationId}`, `PATIENT_{patientId}/{reverseTicks}_{examinationId}`, `MRN/{mrn}`), all three copies must be updated with `createdBy = reassignTo.userId` and `createdByName = reassignTo.username`. |
| 4.3.2.3 | The update must use the existing entity's `etag` for optimistic concurrency (wildcard etag `"*"` is acceptable for this administrative bulk operation). |
| 4.3.2.4 | Azure Table Storage does not support cross-partition transactions. The backend must iterate and patch each examination sequentially. Any individual patch failure must abort the overall delete operation (no partial state). |
| 4.3.2.5 | An `EXAMINATIONS_REASSIGNED` audit event shall be logged with `fromUserId`, `toUserId`, and `count` (number of examinations reassigned). |
| 4.3.2.6 | If the user has 0 examinations and `reassignTo` is omitted, deletion proceeds without the reassignment step. |

#### 4.3.3 Frontend

| # | Requirement |
|---|---|
| 4.3.3.1 | The Users list page (`/users`) shall display a **Delete** action button per row, alongside the existing Edit button. |
| 4.3.3.2 | The Delete button shall be disabled (or hidden) for the currently authenticated user and for any row that is the last active admin. |
| 4.3.3.3 | Clicking Delete shall open a Carbon `Modal` (danger variant) containing: the target user's full name and username; the count of examinations that will be reassigned; a **Reassign examinations to** `Select` or `ComboBox` pre-populated with all active, non-deleted users excluding the user being deleted; and Confirm / Cancel actions. |
| 4.3.3.4 | If the user has 0 examinations, the reassignment dropdown shall be hidden and a note shall read *"This user has no examinations. No reassignment needed."* |
| 4.3.3.5 | The Confirm button shall be disabled until a reassignment target is selected when the examination count is > 0. |
| 4.3.3.6 | On success, the modal shall close and the user row shall be removed from the list without a full page reload. |
| 4.3.3.7 | On API error, an inline notification shall be shown inside the modal with the server error message. |

### 4.4 REQ-USR-04 — Admin-Forced Password Reset *(not implemented)*

This is distinct from REQ-USR-05. It allows an admin to set a new password for another user without knowing the current password.

#### 4.4.1 Backend

| # | Requirement |
|---|---|
| 4.4.1.1 | The system shall expose `POST /v1/users/{id}/reset-password` accessible only to users with the `admin` role. |
| 4.4.1.2 | The request body shall contain `newPassword: string`. |
| 4.4.1.3 | An admin must not use this endpoint on their own account. Attempting to do so shall return HTTP 400 with the message `"Use change-password to update your own password"`. |
| 4.4.1.4 | The new password must satisfy the minimum strength policy (minimum 12 characters). |
| 4.4.1.5 | The new password shall be bcrypt-hashed using the same `hashPassword` utility used by Create User and Change Password. |
| 4.4.1.6 | The `passwordHash`, `failedLoginAttempts`, and `lockedUntil` fields on the `USER` entity shall be updated atomically in a single `Merge` operation. Clearing `failedLoginAttempts` to `0` and removing `lockedUntil` effectively unlocks a locked account. |
| 4.4.1.7 | The response shall be HTTP 200 `{ success: true }`. The password hash must never be returned. |
| 4.4.1.8 | A `PASSWORD_RESET_BY_ADMIN` audit event shall be logged with `targetUserId`, `targetUsername`, and `performedByUserId`. |

#### 4.4.2 Frontend

| # | Requirement |
|---|---|
| 4.4.2.1 | The Edit User page (`/users/:id/edit`) shall display a **Reset Password** button. |
| 4.4.2.2 | The Reset Password button shall be hidden when the admin is editing their own account. |
| 4.4.2.3 | Clicking Reset Password shall open a Carbon `Modal` containing a **New Password** field (type=password) and a **Confirm New Password** field. |
| 4.4.2.4 | Client-side validation shall verify that both fields match and that the password is at least 12 characters before submission. |
| 4.4.2.5 | On success, the modal shall close and a timed success notification shall appear using the existing `useAutoNotification` utility. |
| 4.4.2.6 | On API error, an inline notification shall be shown inside the modal. |

### 4.5 REQ-USR-05 — Self-Service Change Password *(already implemented)*

| # | Requirement |
|---|---|
| 4.5.1 | Any authenticated user shall be able to change their own password by providing `currentPassword` and `newPassword` at `POST /v1/auth/change-password`. |
| 4.5.2 | The current password must be verified before the update is applied. |
| 4.5.3 | The new password must differ from the current password and satisfy the minimum strength policy. |
| 4.5.4 | A `PASSWORD_CHANGED` audit event shall be logged. |

---

## 5. Non-Functional Requirements

| # | Requirement |
|---|---|
| NFR-01 | All user management API endpoints must respond within 3 seconds under normal load. |
| NFR-02 | Audit log failures must not cause any user management operation to fail (non-blocking, already enforced in `auditService.ts`). |
| NFR-03 | Sensitive fields (`passwordHash`, `failedLoginAttempts`, `lockedUntil`, `normalizedUsername`) must be stripped from all API responses. |
| NFR-04 | The examination reassignment step in REQ-USR-03 must be idempotent: re-running it for the same `(fromUserId, toUserId)` pair must not corrupt data. |

---

## 6. Out of Scope

- Bulk user import or export
- Self-service account deletion by non-admin users
- User invitation via email
- Multi-factor authentication
- Password expiry or rotation policy enforcement
- UI for viewing audit logs (already implemented separately)
