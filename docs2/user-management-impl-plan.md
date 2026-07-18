# User Management — Implementation Plan

**Specification:** `user-management-req-spec.md`  
**Branch base:** `master`

---

## Overview

Two new backend functions and two frontend UI additions are required. The already-implemented Create User, Update User, and self-service Change Password are excluded. All new backend work follows the pattern established by [`DeleteExamination.ts`](api/src/functions/DeleteExamination.ts) and [`UpdateUser.ts`](api/src/functions/UpdateUser.ts). All new frontend work follows the Carbon React patterns in [`EditUserPage.tsx`](frontend/src/pages/EditUserPage.tsx) and [`UsersPage.tsx`](frontend/src/pages/UsersPage.tsx).

---

## Sub-Task 1 — Backend: Delete User with Examination Reassignment

**Status:** `[x] completed`

### Intent
Implement `DELETE /v1/users/{id}` with guards (self-delete, last-admin) and examination reassignment before soft-deleting the user entity.

### Expected Outcomes
- `DELETE /v1/users/{id}` with no body and 0 examinations → HTTP 200, user soft-deleted, `USERNAME` lookup removed, `USER_DELETED` audit event.
- `DELETE /v1/users/{id}` with body `{ reassignTo: "<activeUserId>" }` and N examinations → HTTP 200, all three examination partition copies updated, `EXAMINATIONS_REASSIGNED` audit event, user soft-deleted.
- Self-delete attempt → HTTP 400 `"Cannot delete your own account"`.
- Last admin delete attempt → HTTP 400 `"Cannot delete the last admin account"`.
- Missing `reassignTo` when examinations exist → HTTP 400 `"User has examinations; provide reassignTo"`.
- Invalid/inactive/deleted `reassignTo` → HTTP 400.
- Examination patch failure → user entity unchanged, HTTP 500 surfaced.

### Todo List
1. Create `api/src/functions/DeleteUser.ts`.
2. Add auth + admin-role guard using `requireAuth` / `requireRole` from [`authMiddleware.ts`](api/src/utils/authMiddleware.ts).
3. Add self-delete guard: compare `request.params.id` with `user.userId` from token.
4. Fetch target user entity from `Users` table (`PartitionKey = 'USER'`); return 404 if missing or already deleted.
5. Add last-admin guard: query `Users` table with filter `PartitionKey eq 'USER' and isDeleted eq false and isActive eq true and role eq 'admin'`; reject if count ≤ 1 and target is admin.
6. Parse request body for `reassignTo`; if present, fetch and validate the reassign target user (active, not deleted).
7. Query `Examinations` table with filter `PartitionKey eq 'EXAM' and createdBy eq '<targetUserId>' and isDeleted eq false` to collect all matching examination entities.
8. If examination count > 0 and `reassignTo` is absent → return HTTP 400.
9. For each examination entity: update all three partition copies (`EXAM`, `PATIENT_<patientId>`, `MRN/<mrn>`) setting `createdBy` and `createdByName`. Use wildcard etag. Abort the whole operation on any single failure before touching the user entity.
10. Soft-delete the `USER` entity: set `isDeleted = true`, `isActive = false`, `deletedAt = now()` using `updateEntity` with `Merge`.
11. Delete the `USERNAME` lookup row using `deleteEntity` with wildcard etag.
12. Add two audit helper functions to [`auditService.ts`](api/src/utils/auditService.ts): `logUserDeleted(performedByUserId, deletedUserId, deletedUsername)` and `logExaminationsReassigned(performedByUserId, fromUserId, toUserId, count)`. Event names: `USER_DELETED` and `EXAMINATIONS_REASSIGNED`.
13. Call both audit helpers at the end of the function.
14. Register the function with `app.http('DeleteUser', { methods: ['DELETE'], route: 'v1/users/{id}', ... })`.

### Relevant Context
- Pattern file: [`api/src/functions/DeleteExamination.ts`](api/src/functions/DeleteExamination.ts) — shows the three-partition soft-delete loop.
- Pattern file: [`api/src/functions/UpdateUser.ts`](api/src/functions/UpdateUser.ts) — shows user entity fetch + merge.
- `getEntity`, `updateEntity`, `getTableClient`, `ensureTableExists` from [`api/src/utils/tableClient.ts`](api/src/utils/tableClient.ts).
- Examination entity shape: [`api/src/types/index.ts`](api/src/types/index.ts) lines 160–182 — `createdBy` (userId) and `createdByName` (username) are both stored.
- `deleteEntity` is available on the raw `TableClient` (`getTableClient('Users').deleteEntity(pk, rk, { etag: '*' })`).
- The EXAM partition query is the correct way to list all examinations for a user across all patients — see [`GetExaminations.ts`](api/src/functions/GetExaminations.ts) line 48.
- Row key for the primary partition entry is stored on the entity as `rowKey` (e.g. `${reverseTicks}_${examinationId}`). The MRN row key is the MRN string itself.

---

## Sub-Task 2 — Backend: Admin-Forced Password Reset

**Status:** `[x] completed`

### Intent
Implement `POST /v1/users/{id}/reset-password` so an admin can set a new password for another user without the current password, and automatically unlock locked accounts.

### Expected Outcomes
- `POST /v1/users/{id}/reset-password` with valid `{ newPassword }` → HTTP 200 `{ success: true }`, password updated, `failedLoginAttempts` cleared, `lockedUntil` removed, `PASSWORD_RESET_BY_ADMIN` audit event.
- Self-reset attempt → HTTP 400 `"Use change-password to update your own password"`.
- Weak password → HTTP 400 with validation message.
- Target user not found or deleted → HTTP 404.

### Todo List
1. Create `api/src/functions/ResetUserPassword.ts`.
2. Add auth + admin-role guard.
3. Add self-reset guard: compare `request.params.id` with `user.userId` from token.
4. Fetch target user entity from `Users` table; return 404 if missing or `isDeleted`.
5. Parse and validate `newPassword` using the existing `validatePasswordStrength` from [`api/src/utils/passwordService.ts`](api/src/utils/passwordService.ts).
6. Hash the new password using `hashPassword`.
7. Build the merge payload: `{ passwordHash: newHash, failedLoginAttempts: 0, lockedUntil: null, updatedAt: now() }`. Use `updateEntity` with `Merge` and wildcard etag.
8. Add audit helper `logPasswordResetByAdmin(performedByUserId, targetUserId, targetUsername)` to [`auditService.ts`](api/src/utils/auditService.ts). Event name: `PASSWORD_RESET_BY_ADMIN`.
9. Call the audit helper.
10. Register: `app.http('ResetUserPassword', { methods: ['POST'], route: 'v1/users/{id}/reset-password', ... })`.

### Relevant Context
- Pattern file: [`api/src/functions/ChangePassword.ts`](api/src/functions/ChangePassword.ts) — nearly identical flow minus the current-password check.
- `hashPassword` and `validatePasswordStrength` from [`api/src/utils/passwordService.ts`](api/src/utils/passwordService.ts).
- Setting `lockedUntil` to `null` (or omitting it via Merge) effectively clears account lockout.

---

## Sub-Task 3 — Frontend: Delete User UI

**Status:** `[x] completed`

### Intent
Add a Delete button to the Users list and a confirmation modal with optional reassignment dropdown, wired to the new `DELETE /v1/users/{id}` endpoint.

### Expected Outcomes
- Users list shows a Delete button per row; button is disabled for the current user and for the last admin.
- Clicking Delete opens a danger Modal with: target username/fullName, examination count note, optional reassignment Select (hidden if 0 exams), Confirm and Cancel buttons.
- Confirm is disabled until a reassignment target is selected when exam count > 0.
- Successful delete: modal closes, row removed from list without page reload.
- API error: inline notification inside modal.

### Todo List
1. Add `deleteUser(id: string, reassignTo?: string): Promise<void>` to [`frontend/src/services/userService.ts`](frontend/src/services/userService.ts). Call `api.delete(`/v1/users/${id}`, { data: { reassignTo } })`.
2. In [`frontend/src/pages/UsersPage.tsx`](frontend/src/pages/UsersPage.tsx):
   a. Import `Modal`, `Select`, `SelectItem`, `InlineNotification` from `@carbon/react` and `TrashCan` from `@carbon/icons-react`.
   b. Add state: `deleteTarget: UserRecord | null`, `reassignToId: string`, `deleteModalOpen: boolean`, `deleteError: string | null`, `isDeleting: boolean`.
   c. Import `useContext(AuthContext)` to get the current user's id.
   d. Determine `isLastAdmin`: a user is the last admin when they are the only entry in `users` with `role === 'admin'` and `isActive === true`.
   e. Add a **Delete** `Button` (kind `danger--ghost`, size `sm`, icon `TrashCan`) in the actions cell, disabled when `row.id === currentUser.id || isLastAdmin(row)`.
   f. On click, set `deleteTarget` and open the modal; derive examination count from the `UserRecord` if available, or use 0 (the backend enforces the real check).
   g. Render a Carbon `Modal` (danger, `open={deleteModalOpen}`) with: heading `"Delete User"`, danger message with the user's name, the reassignment `Select` (hidden if exam count is 0), and a `modalFooter` with Cancel / Delete buttons.
   h. On Confirm: call `userService.deleteUser(deleteTarget.userId, reassignToId || undefined)`, on success remove the user from `users` state and close modal, on error set `deleteError`.
3. The examination count available to the frontend is the count of examinations the user has. Because there is no per-user exam count endpoint, display a static note: *"All examinations created by this user will be reassigned."* The backend enforces the reassign requirement.

### Relevant Context
- Existing action cell pattern: [`frontend/src/pages/UsersPage.tsx`](frontend/src/pages/UsersPage.tsx) lines 125–133.
- `AuthContext` for current user id: [`frontend/src/contexts/AuthContext.tsx`](frontend/src/contexts/AuthContext.tsx).
- Carbon `Modal` danger variant usage: see `DeletePatient` or equivalent modal in the codebase.
- `useAutoNotification` for timed notifications: [`frontend/src/utils/useAutoNotification.ts`](frontend/src/utils/useAutoNotification.ts).

---

## Sub-Task 4 — Frontend: Admin-Forced Password Reset UI

**Status:** `[x] completed`

### Intent
Add a Reset Password button to the Edit User page that opens a modal, collected the new password twice, validates client-side, and calls the new endpoint.

### Expected Outcomes
- Edit User page shows a Reset Password button; button is absent when editing own account.
- Modal has New Password + Confirm New Password fields with client-side match and length validation.
- On success: modal closes, timed success notification shown.
- On API error: inline notification inside modal.

### Todo List
1. Add `resetUserPassword(id: string, newPassword: string): Promise<void>` to [`frontend/src/services/userService.ts`](frontend/src/services/userService.ts). Call `api.post(`/v1/users/${id}/reset-password`, { newPassword })`.
2. In [`frontend/src/pages/EditUserPage.tsx`](frontend/src/pages/EditUserPage.tsx):
   a. Import `Modal`, `PasswordInput` from `@carbon/react`.
   b. Import `useContext(AuthContext)` to get the current user's id.
   c. Add state: `resetModalOpen: boolean`, `newPassword: string`, `confirmPassword: string`, `resetErrors: Record<string, string>`, `isResetting: boolean`, `resetApiError: string | null`.
   d. Add `useAutoNotification` for success feedback.
   e. Conditionally render the **Reset Password** button only when `id !== currentUser.id`.
   f. Render a Carbon `Modal` with two `PasswordInput` fields. On submit: validate length ≥ 12 and both fields match; call `userService.resetUserPassword(id, newPassword)`; on success close modal and trigger `useAutoNotification`; on error set `resetApiError`.
3. Place the Reset Password button in the action row alongside Save Changes and Cancel, clearly separated (e.g. with a `Section` or spacing).

### Relevant Context
- Existing form structure: [`frontend/src/pages/EditUserPage.tsx`](frontend/src/pages/EditUserPage.tsx) lines 92–106.
- `useAutoNotification`: [`frontend/src/utils/useAutoNotification.ts`](frontend/src/utils/useAutoNotification.ts).
- Carbon `PasswordInput` is the correct component for masked password fields.
- The current user id is exposed via `AuthContext` — check how it is consumed in other pages (e.g. `ProfilePage` or similar).

---

## Sub-Task 5 — Defect Fix: Profile Menu Does Not Close on Outside Click

**Status:** `[x] completed`

### Intent
Fix the profile dropdown in [`frontend/src/components/Layout.tsx`](frontend/src/components/Layout.tsx) so it closes when the user clicks anywhere outside it. The menu is currently impossible to dismiss without clicking the avatar button again.

### Root Cause
The dropdown `<div>` relies on `onBlur` to close itself (line 101 of `Layout.tsx`). This does not work for two reasons:
1. A plain `<div>` without `tabIndex` is not focusable, so it never receives a `blur` event — the handler never fires.
2. Even if the `<div>` were focusable, `blur` fires when focus moves between children (e.g. clicking "Change Password" inside the menu), closing the menu before the button's `onClick` can execute.

A `userMenuRef` is already declared and attached to the wrapper `<div>` (lines 37 and 78) but is never read — it was intended for an outside-click handler that was never implemented.

### Expected Outcomes
- Clicking anywhere outside the profile dropdown closes it.
- Clicking "Change Password" inside the dropdown still navigates correctly (menu does not close prematurely before the click registers).
- Clicking the avatar button while the menu is open still toggles it closed.
- No change to menu appearance or any other behaviour.

### Todo List
1. Add `useEffect` to the existing `react` import in [`frontend/src/components/Layout.tsx`](frontend/src/components/Layout.tsx) (line 2 already imports `useState` and `useRef`).
2. Add the following `useEffect` after the existing state declarations:
   ```ts
   useEffect(() => {
     if (!userMenuOpen) return;
     const handler = (e: MouseEvent) => {
       if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
         setUserMenuOpen(false);
       }
     };
     document.addEventListener('mousedown', handler);
     return () => document.removeEventListener('mousedown', handler);
   }, [userMenuOpen]);
   ```
3. Remove the `onBlur={() => setUserMenuOpen(false)}` prop from the inner dropdown `<div>` (line 101).

### Relevant Context
- File to change: [`frontend/src/components/Layout.tsx`](frontend/src/components/Layout.tsx) — only this file is affected.
- `userMenuRef` (line 37) and `<div ref={userMenuRef}>` (line 78) are already correct — no structural change needed.
- The `onBlur` to remove is on the **inner** dropdown `<div>` at line 101, not the outer wrapper.
- Self-contained fix: no backend changes, no new dependencies, no new files.

---

## Implementation Order

Sub-tasks 1 and 2 are independent and can be built in parallel. Sub-tasks 3 and 4 depend on their respective backends. Sub-task 5 is fully independent and can be done at any time.

```
1 ──► 3
2 ──► 4
5 (independent)
```

## Validation Checklist (per sub-task)

- [ ] `cd api && npm run build` passes with no TypeScript errors
- [ ] `cd api && npm test` — no regressions in existing tests
- [ ] Manual smoke test against local Azurite via `start-azurite.ps1` + `start-functions.ps1`
- [ ] `cd frontend && npm run build` passes with no TypeScript errors
- [ ] Frontend dev server (`start-frontend.ps1`) shows no console errors on the affected pages
