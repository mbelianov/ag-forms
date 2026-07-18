# Create User Form & Reset Password Modal — Validation Plan

**Spec:** Add live as-you-type validation and a Confirm Password field to both `CreateUserPage.tsx` and the Reset Password modal in `EditUserPage.tsx`.
**Branch base:** `master`

---

## Overview

Two forms share the same validation deficiency:

**[`frontend/src/pages/CreateUserPage.tsx`](frontend/src/pages/CreateUserPage.tsx)**
- Has no "Confirm Password" field, so a mistyped password creates a locked-out account.
- Only validates on submit; users get no inline feedback while typing.
- Communicates only `"Minimum 12 characters"` in the helper text, but the backend enforces 5 rules.

**Reset Password modal in [`frontend/src/pages/EditUserPage.tsx`](frontend/src/pages/EditUserPage.tsx)**
- Both `PasswordInput` fields only clear their error on change; new errors only appear on submit.
- The submit-time check only tests `length < 12` — the other 4 strength rules (uppercase, lowercase, number, special char) are not validated at all on the frontend.
- No live cross-field confirmation feedback while typing.

Both are fixed using the same pattern: a `touched` record + `validatePasswordField` helper replicated in each file. No service, API, or backend changes needed.

---

## Sub-Task 1 — Add Confirm Password Field and Live Validation to CreateUserPage

**Status:** `[x] completed`

### Intent
Add a `confirmPassword` field and switch all field validation from submit-only to per-field live feedback triggered after first touch, matching the standard UX pattern already used in the rest of the codebase.

### Expected Outcomes
- A **Confirm Password** `PasswordInput` appears immediately below the Password field.
- No errors are shown on a field the user has never touched (fresh form state is clean).
- Once a field has been touched, its error updates on every `onChange` keystroke.
- Password field shows all currently failing strength rules as a joined inline error string (e.g. `"Must be at least 12 characters, uppercase letter, number, special character"`).
- Confirm Password field shows `"Passwords do not match"` whenever the two values differ (after being touched).
- Submit-time `validate()` remains as the final gate (catches un-touched fields).
- `confirmPassword` is never sent to the API — it is local form state only.

### Todo List

1. Add a `touched` state — `Record<string, boolean>` — alongside the existing `errors` state, initialized to `{}`.

2. Add a `confirmPassword` string state field (separate from `formData`, since it is not part of `CreateUserRequest`).

3. Extract a `validateField(field, value, currentFormData, currentConfirm)` helper that returns a string error message or `""` for a given field. Implement the following rules:
   - `username`: non-empty → `"Username is required"`
   - `fullName`: non-empty → `"Full name is required"`
   - `email`: non-empty + email regex → `"Valid email is required"`
   - `password`: run all 5 backend strength rules inline (length ≥ 12, uppercase, lowercase, number, special char) and join failing messages → e.g. `"Must be at least 12 characters, must contain uppercase letter"`
   - `confirmPassword`: non-empty → `"Confirm password is required"`, else mismatch → `"Passwords do not match"`

4. Update `handleChange(field, value)` to:
   a. Update `formData` as before.
   b. Mark `touched[field] = true`.
   c. Call `validateField` and set or clear `errors[field]`.
   d. If `field === 'password'`, also re-validate `confirmPassword` (so the "do not match" error updates when the first field changes while the second is already touched).

5. Add a `handleConfirmChange(value)` handler that:
   a. Sets `confirmPassword`.
   b. Marks `touched.confirmPassword = true`.
   c. Calls `validateField('confirmPassword', value, formData, value)` and sets/clears `errors.confirmPassword`.

6. Update the submit-time `validate()` to also check `confirmPassword` against `password`. This ensures submit is blocked even if the user never touched the confirm field.

7. Add the `PasswordInput` for Confirm Password immediately after the existing Password `PasswordInput`:
   - `id="confirmPassword"`, `labelText="Confirm Password"`, `autoComplete="new-password"`
   - Bind `value`, `onChange`, `invalid`, `invalidText`, `disabled` as for the Password field.

8. Update the existing Password `PasswordInput` to remove the static `helperText` prop (`"Minimum 12 characters"`) — the live inline error now conveys the same information more accurately.

### Relevant Context
- File to change: [`frontend/src/pages/CreateUserPage.tsx`](frontend/src/pages/CreateUserPage.tsx) — only this file.
- The 5 password strength rules come from [`api/src/utils/passwordService.ts`](api/src/utils/passwordService.ts) `validatePasswordStrength` — replicate them client-side without importing the backend utility.
- Confirm password pattern (live match validation) is established in the Reset Password modal in [`frontend/src/pages/EditUserPage.tsx`](frontend/src/pages/EditUserPage.tsx) — see `resetErrors.confirmPassword` handling there.
- Carbon `PasswordInput` is already imported in `CreateUserPage.tsx`.
- `touched` pattern is the standard way to prevent eager errors on a fresh form; it is not currently used elsewhere in this codebase, but the pattern is well-understood and self-contained.

---

## Sub-Task 2 — Live Validation in the Reset Password Modal (EditUserPage)

**Status:** `[x] completed`

### Intent
Apply the same touch-first, per-keystroke validation approach to the Reset Password modal in `EditUserPage.tsx`. The modal currently only clears errors on change and only runs a partial password check (`length < 12`) on submit — it never validates the other 4 strength rules.

### Expected Outcomes
- Modal opens with both fields blank and no errors (fresh state is clean every time).
- Once a field is touched, its error updates on every keystroke.
- New Password field shows all failing strength rules as a joined inline error string.
- Confirm New Password field shows `"Passwords do not match"` as soon as values differ (after being touched).
- When New Password changes while Confirm is already touched, the confirm error updates immediately.
- Submit (`handleResetPasswordSubmit`) remains as the final gate for un-touched fields.
- Modal state is fully reset (`newPassword`, `confirmPassword`, `resetTouched`, `resetErrors`) when the modal opens via `handleResetPasswordOpen`.

### Todo List

1. Add a `resetTouched` state — `Record<string, boolean>` — alongside the existing `resetErrors` state, initialized to `{}`. Reset it to `{}` inside `handleResetPasswordOpen`.

2. Extract a `validatePasswordField(field: 'newPassword' | 'confirmPassword', value: string, currentNewPassword: string, currentConfirm: string)` helper (local to the component) that returns an error string or `""`:
   - `newPassword`: run all 5 strength rules, join failing messages.
   - `confirmPassword`: non-empty → `"Confirm password is required"`, else mismatch → `"Passwords do not match"`.

3. Replace the inline `onChange` handlers of both `PasswordInput`s in the modal with dedicated handlers:
   - `handleNewPasswordChange(value)`: set `newPassword`, mark `resetTouched.newPassword = true`, call `validatePasswordField('newPassword', ...)` → update `resetErrors.newPassword`. If `resetTouched.confirmPassword` is already true, also re-validate `confirmPassword` with the new value.
   - `handleConfirmPasswordChange(value)`: set `confirmPassword`, mark `resetTouched.confirmPassword = true`, call `validatePasswordField('confirmPassword', ...)` → update `resetErrors.confirmPassword`.

4. Update `handleResetPasswordSubmit` to replace the partial length-only check with the same `validatePasswordField` calls for both fields, so all 5 rules are enforced even if the fields were never touched.

### Relevant Context
- File to change: [`frontend/src/pages/EditUserPage.tsx`](frontend/src/pages/EditUserPage.tsx) — only the Reset Password modal state and its two `PasswordInput` handlers.
- The existing `resetErrors`, `newPassword`, `confirmPassword`, and `handleResetPasswordOpen` states/functions are already in place — this sub-task extends them, it does not replace them.
- The same 5 strength rules as Sub-Task 1 (`validatePasswordField` is a local copy in each file — do not share across files).
- Sub-Task 1 must be completed first so the shared `validatePasswordField` signature is established and can be replicated here.

---

## Validation Checklist

- [ ] `cd frontend && npm run build` passes with no TypeScript errors
- [ ] **CreateUserPage** — fresh page load: all fields blank, no errors
- [ ] **CreateUserPage** — type then clear Username: error appears after clear
- [ ] **CreateUserPage** — type a weak password: inline error lists all failing rules
- [ ] **CreateUserPage** — satisfy all rules: error clears; matching confirm clears confirm error
- [ ] **CreateUserPage** — submit with valid fields: navigates to `/users`
- [ ] **CreateUserPage** — submit with any invalid field: blocked, errors shown
- [ ] **EditUserPage Reset Modal** — opens with blank fields, no errors
- [ ] **EditUserPage Reset Modal** — type weak password: inline error with all rules
- [ ] **EditUserPage Reset Modal** — mismatching confirm: error appears; matching: clears
- [ ] **EditUserPage Reset Modal** — submit with all valid: success notification shown
- [ ] **EditUserPage Reset Modal** — submit with invalid fields: blocked, errors shown
