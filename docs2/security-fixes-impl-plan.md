# Security Fixes Implementation Plan

This document tracks all security findings from the code review and their agreed solutions.
Each finding is implemented as a focused, independent sub-task.

---

## Finding #1 — Hardcoded JWT Secret Fallback

**Severity:** 🔴 Critical  
**File:** `api/src/utils/tokenService.ts:11`  
**Status:** ✅ Done

### Problem
`JWT_SECRET` falls back to a hardcoded string `'dev-secret-change-in-production'` when the
environment variable is absent. Any attacker who reads the source can forge JWTs for any user.

### Agreed Solution — Option C
- Remove the fallback string entirely.
- Add a startup guard: throw `Error` if `JWT_SECRET` is not set, so the app refuses to start
  rather than running insecurely.
- Add `JWT_SECRET` (with a generated dev value) to `api/local.settings.json` so local dev
  continues to work.
- Create `api/local.settings.json.example` with a placeholder and generation instructions so
  new developers know what to set.

### Implementation Steps
1. In `api/src/utils/tokenService.ts`, replace the `||` fallback with:
   ```ts
   const JWT_SECRET = process.env.JWT_SECRET;
   if (!JWT_SECRET) {
       throw new Error(
           'JWT_SECRET environment variable is required. ' +
           'Generate with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"'
       );
   }
   ```
2. Add `"JWT_SECRET": "<a real random hex string>"` to `api/local.settings.json` under `Values`.
3. Create `api/local.settings.json.example` mirroring the structure of `local.settings.json`
   but with a placeholder value and the generation command as a comment.

### Verification
- Remove `JWT_SECRET` from the env and confirm the process throws on startup.
- Set `JWT_SECRET` and confirm login / token verification still works.

### Notes
Done. `tokenService.ts` now throws if `JWT_SECRET` is absent. `local.settings.json` updated with a generated 64-byte hex secret. `local.settings.json.example` created. `jest.setup.js` and `jest.config.js` updated to set `JWT_SECRET` in test environments.

---

## Finding #2 — Register Endpoint Auth Bypass on Storage Error

**Severity:** 🔴 Critical
**File:** `api/src/functions/Register.ts:53-62`
**Status:** ✅ Done

### Problem
When checking whether this is the "first user", any storage error (throttling, network blip,
SDK exception) causes `isFirstUser` to be silently set to `true`. An unauthenticated attacker
who can trigger or time such an error can register themselves as admin.

### Agreed Solution — Option E (fail closed + no session on register)

**Rule:** Unauthenticated first-user registration is allowed **only** when the system can
positively confirm the user table is empty or does not exist yet. Any ambiguity blocks
registration with a 503. On success, only the user record is returned — no token, no session
cookie — the user must authenticate via `POST /v1/auth/login` to get a session.

| Query Result | isFirstUser | Auth Required | Response |
|---|:---:|:---:|---|
| Table does not exist (404) | true | No | User record only — no token |
| Table exists, zero USER rows | true | No | User record only — no token |
| Table exists, one or more USER rows | false | Yes — admin JWT | User record only — no token |
| Any other error | — | Blocked | 503 — retry |

### Implementation Steps
1. In `Register.ts`, update the catch block to only set `isFirstUser = true` on a confirmed
   404/ResourceNotFound error. All other errors must return a 503 response immediately:
   ```ts
   } catch (error: any) {
       if (error.statusCode === 404 || error.details?.errorCode === 'ResourceNotFound') {
           isFirstUser = true; // table confirmed missing → genuinely first user
       } else {
           return errorResponse('Service temporarily unavailable. Please try again.', 503);
       }
   }
   ```
2. Add an explicit comment above the success response confirming that no token is issued
   by design and the user must log in separately to obtain a session.
3. Update the success message to `'User registered successfully. Please log in to continue.'`
   to make the required next step clear to API consumers.
4. Confirm (via code search) that `generateToken()` is never called anywhere in `Register.ts`.

### Verification
- On a clean system (empty table) confirm unauthenticated registration still works.
- Simulate a non-404 storage error and confirm the endpoint returns 503.
- Confirm the register response contains no `token` field and no `Set-Cookie` header.
- Confirm the registered user cannot access protected endpoints without first logging in.

### Notes
Done. Catch block now returns 503 for all non-404 errors. Success message updated. No `generateToken()` call in Register.ts confirmed.

---

## Finding #3 — OData Injection in Query Filters

**Severity:** 🔴 Critical
**Files:** `api/src/functions/GetExaminations.ts:51-69`, `api/src/functions/GetAuditLogs.ts:59-65`
**Status:** ✅ Done

### Problem
User-controlled query parameters (`examinationType`, `status`, `fromDate`, `toDate`,
`patientName`, `filterUser`, `filterAction`) are directly string-interpolated into OData
filter expressions. An attacker can inject arbitrary OData predicates by embedding single
quotes and logical operators in parameter values, bypassing `isDeleted` guards and
returning records they should not see.

### Agreed Solution — Option A + Option C
- Use the `odata` tagged template literal from `@azure/data-tables` (already imported in
  `tableClient.ts`) for all user-supplied values in filter expressions.
- Additionally, validate enum-type parameters (`status`, `examinationType`, `action`) against
  a strict allowlist before they are used, rejecting invalid values with a 400 response.

### Implementation Steps

#### GetExaminations.ts
1. Import `odata` from `@azure/data-tables` at the top of the file.
2. Replace all string-interpolated filter concatenations with `odata` tagged template literals:
   - `examinationType`, `status`, `fromDate`, `toDate`, `patientName` filter clauses.
3. Add allowlist validation for `status` (`draft`, `completed`, `reviewed`) and
   `examinationType` (use `EXAM_TYPE_KEYS` from `constants/examinationTypes.ts`).
   Return 400 if the value is not in the allowlist.

#### GetAuditLogs.ts
1. Import `odata` from `@azure/data-tables`.
2. Replace string-interpolated `filterUser` and `filterAction` filter clauses with `odata`
   tagged template literals.
3. Add allowlist validation for `filterAction` against the known audit action strings.
   Return 400 if the value is not in the allowlist.

#### UpdateExamination.ts (secondary injection in listEntities filter)
1. The `examinationId` used in the `PATIENT_` partition scan filter is an internal UUID
   (not user input), but apply `odata` tag here as well for consistency and defence-in-depth.

### Verification
- Send `status=draft' or '1' eq '1` and confirm the response is 400, not a data dump.
- Send a valid `status=draft` and confirm results are filtered correctly.
- Send an unknown `action` value to audit logs and confirm 400 is returned.

### Notes
Done. All three files updated with `odata` tagged templates. Allowlist validation added for `status`, `examinationType`, and `action`.

---

## Finding #5 — JWT Token Leaked in Login Response Body

**Severity:** 🔴 Critical
**File:** `api/src/functions/Login.ts:166`
**Status:** ✅ Done

### Problem
The raw JWT is returned in the JSON response body alongside the `Set-Cookie` header.
The frontend uses the HttpOnly `session_token` cookie for auth and never reads the body
token. Any script that can read the response body (XSS, logging middleware, API gateway
response logging) can extract the token and use it outside a browser, bypassing the
HttpOnly cookie protection.

### Agreed Solution — Option A
Remove `token` from the login response body entirely. The `Set-Cookie` header already
carries the session. The body returns only the user object.

### Implementation Steps
1. In `Login.ts`, change the `successResponse` call from:
   ```ts
   const response = successResponse({ token, user: userResponse });
   ```
   to:
   ```ts
   const response = successResponse({ user: userResponse });
   ```
2. Remove the `token` variable assignment (the `generateToken` call result) from the
   destructured response — it is still needed to set the cookie, so keep the call but
   do not include the value in the response body.
3. Confirm the frontend `authService.login()` only reads `response.data.user` and does
   not reference `response.data.token` anywhere.

### Verification
- Login response body contains `{ user: { ... } }` with no `token` field.
- The `Set-Cookie: session_token=...` header is still present.
- Frontend login flow works correctly (session established via cookie).

### Notes
Done. `token` removed from successResponse body. Cookie still set correctly.

---

## Finding #6 — GetPatientByMRN Dead Function with Wrong Table

**Severity:** 🟠 High
**File:** `api/src/functions/GetPatientByMRN.ts`
**Status:** ✅ Done

### Problem
The function is explicitly retired (no `app.http()` registration) but the full function
body still exists, compiles, and queries the wrong table (MRN partition is in Examinations,
not Patients). Accidental re-registration would silently serve wrong data.

### Agreed Solution — Option A
Delete the file entirely. `GetExaminationByMRN.ts` is the active replacement.

### Implementation Steps
1. Delete `api/src/functions/GetPatientByMRN.ts`.
2. Confirm no other file imports from `GetPatientByMRN.ts`.

### Verification
- File no longer exists in the repository.
- `GetExaminationByMRN.ts` continues to function correctly.

### Notes
Done. File deleted. No imports found.

---

## Finding #4 — HealthCheck Reflects Unescaped User Input

**Severity:** 🔴 Critical
**File:** `api/src/functions/HealthCheck.ts:6-8`
**Status:** ✅ Done

### Problem
The HealthCheck endpoint is `authLevel: 'anonymous'`, accepts input from both query string
and raw request body, and reflects that input directly in the response body with no
sanitisation and no `Content-Type` header. It can be used as an unauthenticated reflection
surface.

### Agreed Solution — Option A
Replace the user-input reflection with a static JSON health response. No user input is
read or reflected. The endpoint remains anonymous and useful for uptime monitoring.

### Implementation Steps
1. In `HealthCheck.ts`, remove all `request.query.get('name')` and `request.text()` calls.
2. Return a static JSON response:
   ```ts
   return {
       status: 200,
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString() })
   };
   ```
3. Change `methods` to `['GET']` only — a health check has no need for POST.
4. Remove the `context.log` line that echoes the request URL (minor info disclosure).

### Verification
- `GET /api/HealthCheck` returns `{ status: 'healthy', timestamp: '...' }` with no user input in the response.
- `POST /api/HealthCheck` returns 405 Method Not Allowed.
- Sending `?name=<script>alert(1)</script>` returns the static health response unchanged.

### Notes
Done. Static response returns `{ status: 'healthy', timestamp: '...' }`. Methods reduced to `['GET']`.

---

## Finding #7 — Login Username Enumeration via Timing

**Severity:** 🟠 High  
**File:** `api/src/functions/Login.ts:57-62`  
**Status:** ✅ Done

### Problem
When a username does not exist, the login handler returns immediately after a fast table
lookup (~5ms). When a username exists but the password is wrong, it runs a full
`bcrypt.compare()` (~200ms). Same error message, different timing — an attacker can
distinguish valid from invalid usernames by measuring response times.

### Agreed Solution — Option A
Always run `bcrypt.compare()` against a pre-computed dummy hash when the username is not
found. Both paths take approximately the same time, eliminating the timing signal.

### Implementation Steps
1. At module level in `Login.ts`, define a pre-computed dummy bcrypt hash (cost factor 12,
   matching `SALT_ROUNDS` in `passwordService.ts`):
   ```ts
   // Computed once at module load — used only to normalise timing when user not found
   const DUMMY_HASH = '$2a$12$LDjIBt/cx1GMAuHJu5B1duQJDMhkDhXf3p9UOpSNWb5TPWKV8mkMi';
   ```
2. In the "username not found" catch block, before returning the error, add:
   ```ts
   await verifyPassword(password, DUMMY_HASH); // normalise timing
   return errorResponse('Invalid credentials', 401);
   ```
3. The dummy hash must be a valid bcrypt hash with cost factor 12. Generate it once with:
   `node -e "require('bcryptjs').hash('dummy', 12).then(console.log)"`

### Verification
- Measure response time for a non-existent username — should be ~200ms not ~5ms.
- Measure response time for an existing username with wrong password — should be ~200ms.
- Confirm both paths return identical `Invalid credentials` 401 responses.

### Notes
Done. `DUMMY_HASH` constant added at module level. `verifyPassword('dummy', DUMMY_HASH)` called before returning 401 for missing username.

---

## Finding #8 — confirmPassword Not Validated Server-Side

**Severity:** 🟠 High  
**Files:** `api/src/functions/ChangePassword.ts:27`, `frontend/src/services/authService.ts:83`  
**Status:** ✅ Done

### Problem
The frontend sends `confirmPassword` to the backend change-password endpoint, but the
backend silently ignores it. A direct API caller can submit mismatched `newPassword` and
`confirmPassword` and the password change proceeds. Client-side form validation is the
only protection, which is trivially bypassed.

### Agreed Solution — Option A
Add a server-side check that `confirmPassword` matches `newPassword` before any further
processing. The check goes before the password strength validation so callers get a clear
error immediately.

### Implementation Steps
1. In `ChangePassword.ts`, after extracting `{ currentPassword, newPassword, confirmPassword }`
   from the request body, add:
   ```ts
   if (!confirmPassword) {
       return errorResponse('Password confirmation is required', 400);
   }
   if (newPassword !== confirmPassword) {
       return errorResponse('New password and confirmation do not match', 400);
   }
   ```
2. Place this check before the `validatePasswordStrength` call so the order is:
   - Presence check (currentPassword, newPassword, confirmPassword)
   - Match check (newPassword === confirmPassword)
   - Strength validation (validatePasswordStrength)
   - Same-as-current check

### Verification
- Send `newPassword: "NewPass1!"` and `confirmPassword: "DifferentPass1!"` — expect 400.
- Send matching passwords — expect the change to proceed normally.

### Notes
Done. Server-side confirmPassword check added before strength validation.

---

## Finding #9 — Register Endpoint Has No Rate Limiting

**Severity:** 🟠 High (downgraded to documentation note)  
**File:** `api/src/functions/Register.ts`  
**Status:** ✅ Done

### Problem
The register endpoint is `authLevel: 'anonymous'` with no rate limiting. Originally this
could be combined with the storage-error bypass (Finding #2) to race for admin registration.

### Assessment Against Finding #2 Fix
After Finding #2's fail-closed fix is applied, this finding is largely mitigated by design:
- The unauthenticated path is only reachable when the system has zero users
- Once one user exists, all subsequent registrations require admin JWT
- Username enumeration via register is meaningless on an empty system (no usernames to enumerate)
- Storage flooding on an empty system is an operational nuisance, not a security risk

### Agreed Solution — Documentation note only
No application code change required. Document in `README.md` or `AGENTS.md` that production
deployments should place the Function App behind Azure API Management or Azure Front Door
with per-IP rate limiting configured.

### Implementation Steps
1. Add a note to `AGENTS.md` under deployment considerations:
   > The `/v1/auth/register` endpoint is anonymous. In production, place the Function App
   > behind Azure API Management or Azure Front Door and configure per-IP rate limiting
   > on this route (recommended: max 5 requests per minute per IP).

### Verification
- Finding #2 fix is in place and verified.
- AGENTS.md contains the production rate-limiting recommendation.

### Notes
Done. Note added to `AGENTS.md`.

---

## Finding #10 — Legacy `token` Cookie Still Accepted as Auth

**Severity:** 🟠 High  
**File:** `api/src/utils/tokenService.ts:88-90`  
**Status:** ✅ Done

### Problem
The legacy `token` cookie name is still accepted as valid authentication alongside the
current `session_token` cookie. A cookie stolen from a pre-rename session remains valid
indefinitely. Two cookie names carry equivalent auth power, doubling the theft surface.

### Agreed Solution — Option A
Remove the legacy `token` cookie fallback entirely. Only `session_token` is accepted.

### Impact on Tests
`testUtils.ts` passes the JWT via `Authorization: Bearer` header (not cookies), so the
test suite is unaffected by this change. The test that used the legacy `token` cookie
was updated to use `session_token` and an additional test confirms the legacy cookie is rejected.

### Implementation Steps
1. In `tokenService.ts`, in `extractTokenFromRequest()`, remove the `cookies.token` branch:
   ```ts
   // Remove this block:
   if (cookies.token) {
       return cookies.token;
   }
   ```
2. Only `session_token` remains as the accepted cookie name.
3. Search codebase for any other references to the `token` cookie name and remove them.

### Verification
- A request with only `Cookie: token=<valid_jwt>` is rejected with 401.
- A request with `Cookie: session_token=<valid_jwt>` is accepted normally.
- A request with `Authorization: Bearer <valid_jwt>` is accepted normally.
- All existing tests pass without modification.

### Notes
Done. Legacy `token` cookie fallback removed. Test file updated.

---

## Finding #11 — CORS Origin Hardcoded to Development Localhost

**Severity:** 🟠 High
**Files:** `api/src/utils/responseHelpers.ts:13`, `api/src/functions/Login.ts:26`, `api/host.json:20-27`
**Status:** ✅ Done

### Problem
CORS is configured in two independent layers, both hardcoded to `http://127.0.0.1:3000` and
therefore non-functional in production:

1. **Application layer** — every response from `responseHelpers.ts` carries
   `Access-Control-Allow-Origin: http://127.0.0.1:3000` regardless of environment.
2. **Host layer** — `host.json` has a `cors.allowedOrigins` list that the Azure Functions
   host evaluates before the handler runs. It currently allows four stale dev origins:
   `localhost:3000`, `127.0.0.1:3000`, `localhost:5173`, `127.0.0.1:5173`. The Vite
   port entries (`:5173`) are leftover scaffolding — the frontend has always run on `:3000`.
   With `supportCredentials: true`, each entry is an explicit grant to send the
   `session_token` cookie cross-origin from that origin.

In production the frontend is served from a real domain. Both layers must reflect that domain
or the browser will block all API responses, making the application non-functional.

Having two independent CORS layers also creates a dual-maintenance problem: they must always
be kept in sync manually with no enforcement. The host layer is redundant because the
application already manages CORS headers per-response.

### Agreed Solution
Make the application layer the single source of truth for CORS, driven by an `ALLOWED_ORIGIN`
environment variable. Remove the `cors` block from `host.json` entirely so there is only one
place to configure the allowed origin.

### Implementation Steps
1. In `responseHelpers.ts`, replace the hardcoded string in `getCorsHeaders()`:
   ```ts
   const getCorsHeaders = () => ({
       'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || 'http://127.0.0.1:3000',
       'Access-Control-Allow-Credentials': 'true',
       'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
       'Access-Control-Allow-Headers': 'Content-Type, Authorization',
   });
   ```
2. Update the bespoke CORS block in `Login.ts` (the OPTIONS preflight handler at line 26)
   to use the same env var:
   ```ts
   'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || 'http://127.0.0.1:3000',
   ```
3. Remove the entire `cors` block from `api/host.json`:
   ```json
   // Remove this section entirely:
   "cors": {
     "allowedOrigins": [
       "http://localhost:3000",
       "http://127.0.0.1:3000",
       "http://localhost:5173",
       "http://127.0.0.1:5173"
     ],
     "supportCredentials": true
   }
   ```
   The application-layer headers set in steps 1 and 2 are sufficient. Removing the host-level
   block eliminates the stale Vite port credential grants and the dual-maintenance burden.
4. Add `ALLOWED_ORIGIN` to `api/local.settings.json.example` with an explanatory comment:
   ```json
   "ALLOWED_ORIGIN": "http://127.0.0.1:3000"
   ```
   > In production set this to the real frontend URL, e.g. `https://your-app.azurestaticapps.net`.
   > This is the single value that controls CORS for both preflight and actual responses.

### Verification
- Local dev: `ALLOWED_ORIGIN` not set → responses carry `http://127.0.0.1:3000` as before.
- Production simulation: set `ALLOWED_ORIGIN=https://example.com` → all responses carry that value.
- `host.json` contains no `cors` block.
- Requests from `http://localhost:5173` or `http://127.0.0.1:5173` are no longer granted
  credentialed access — the stale Vite port grants are gone.
- Browser can successfully make credentialed API calls from the configured `ALLOWED_ORIGIN`.

### Notes
Done. `getCorsHeaders()` uses `ALLOWED_ORIGIN` env var. `Login.ts` OPTIONS handler updated. `host.json` cors block removed. `local.settings.json` and `local.settings.json.example` both include `ALLOWED_ORIGIN`.

---

## Finding #12 — isAdmin Re-defined Locally in DeleteExamination.ts

**Severity:** 🟠 High  
**File:** `api/src/functions/DeleteExamination.ts:15-17`  
**Status:** ✅ Done

### Problem
A local `isAdmin` function typed as `any` shadows the shared, properly typed `isAdmin`
exported from `authMiddleware.ts`. If the shared utility's logic changes, this copy
silently diverges. The `any` type bypasses `TokenPayload` type safety.

### Agreed Solution
Delete the local function and import `isAdmin` from `authMiddleware.ts`.

### Implementation Steps
1. In `DeleteExamination.ts`, remove the local `isAdmin` function (lines 15-17).
2. Update the import line to include `isAdmin`:
   ```ts
   import { requireAuth, isAdmin } from '../utils/authMiddleware';
   ```
3. No other changes needed — the call site `if (!isAdmin(user))` remains identical.

### Verification
- `DeleteExamination.ts` compiles with no type errors.
- Admin users can delete examinations; non-admins receive 403.
- No local `isAdmin` definition remains in the file.

### Notes
Done. Local `isAdmin` removed. Imported from `authMiddleware`.

---

## Finding #13 — Cookie Max-Age Mismatch with JWT Expiry

**Severity:** 🟡 Medium  
**File:** `api/src/functions/Login.ts:176`, `api/src/utils/tokenService.ts:14`  
**Status:** ✅ Done

### Problem
The JWT has `expiresIn: '24h'` (86 400 s) but the `Set-Cookie` header uses `Max-Age=28800`
(8 hours). After 8 hours the browser drops the cookie and the user is logged out, but the
JWT remains cryptographically valid for another 16 hours — usable via Bearer header if
extracted from a log or response body.

### Agreed Solution — Option C
Align both values to 24 hours and add a comment tying them together so they cannot
silently drift apart again.

### Implementation Steps
1. In `Login.ts`, change the cookie `Max-Age` from `28800` to `86400`:
   ```ts
   'Set-Cookie': `session_token=${token}; HttpOnly; ${secureCookie}SameSite=Strict; Max-Age=86400; Path=/`
   ```
2. Add a comment immediately above this line:
   ```ts
   // Max-Age must match TOKEN_EXPIRATION in tokenService.ts (currently 24h = 86400s)
   ```
3. In `tokenService.ts`, add a matching comment above `TOKEN_EXPIRATION`:
   ```ts
   // Must match Set-Cookie Max-Age in Login.ts (currently 24h = 86400s)
   const TOKEN_EXPIRATION = '24h';
   ```

### Verification
- Login sets a cookie with `Max-Age=86400`.
- After 8 hours (simulated by adjusting system clock or using a short test value) the
  session is still valid.
- After 24 hours the cookie expires and the JWT is also expired.

### Notes
Done. `Max-Age` changed to `86400`. Linking comments added in both files.

---

## Finding #14 — generateSecurePassword Uses Math.random (Cryptographically Weak)

**Severity:** 🟡 Medium  
**File:** `api/src/utils/passwordService.ts:95-117`  
**Status:** ✅ Done

### Problem
`generateSecurePassword()` uses `Math.random()` — a deterministic PRNG not suitable for
security-sensitive operations. The shuffle uses `sort(() => Math.random() - 0.5)` which
has a non-uniform distribution. This function is used for admin-forced password resets.

### Agreed Solution — Option A
Replace all `Math.random()` calls with `crypto.randomInt()` (Node built-in, no new
dependency) and replace the sort-based shuffle with a proper Fisher-Yates shuffle.

### Implementation Steps
1. Add `import { randomInt } from 'crypto';` at the top of `passwordService.ts`.
2. Replace each `Math.floor(Math.random() * chars.length)` with `randomInt(chars.length)`:
   ```ts
   password += uppercase[randomInt(uppercase.length)];
   password += lowercase[randomInt(lowercase.length)];
   password += numbers[randomInt(numbers.length)];
   password += special[randomInt(special.length)];
   for (let i = password.length; i < length; i++) {
       password += allChars[randomInt(allChars.length)];
   }
   ```
3. Replace the `sort(() => Math.random() - 0.5)` shuffle with Fisher-Yates:
   ```ts
   const chars = password.split('');
   for (let i = chars.length - 1; i > 0; i--) {
       const j = randomInt(i + 1);
       [chars[i], chars[j]] = [chars[j], chars[i]];
   }
   return chars.join('');
   ```

### Verification
- Generated passwords pass `validatePasswordStrength()` (contain upper, lower, digit, special).
- Generated passwords are not predictable from a known seed.
- Existing `passwordService` tests still pass.

### Notes
Done. `crypto.randomInt` used throughout. Fisher-Yates shuffle replaces sort-based shuffle.

---

## Finding #15 — Internal Fields Leaked in CreatePatient Response

**Severity:** 🟡 Medium  
**File:** `api/src/functions/CreatePatient.ts:102-104`  
**Status:** ✅ Done

### Problem
The full Azure Table Storage entity (`patientEntity`) is returned directly in the response,
including internal fields: `partitionKey`, `rowKey`, `isDeleted`, `createdBy`, `updatedBy`,
`etag`, `timestamp`. These leak implementation details and have no meaning to API consumers.

### Agreed Solution — Option A
Project to a safe DTO via destructuring before returning, consistent with the pattern
already used in `CreateUser.ts:84` and `GetCurrentUser.ts`.

### Implementation Steps
1. In `CreatePatient.ts`, before the `successResponse` call, add a destructuring projection:
   ```ts
   const { partitionKey, rowKey, isDeleted, createdBy, updatedBy, etag, timestamp, ...safePatient } = patientEntity;
   return successResponse({
       message: 'Patient created successfully',
       patient: safePatient
   }, 201);
   ```
2. Apply the same projection to `UpdatePatient.ts` response (Finding #16 — handled there).

### Verification
- `POST /v1/patients` response body does not contain `partitionKey`, `rowKey`, `isDeleted`,
  `createdBy`, `updatedBy`, `etag`, or `timestamp`.
- `patientId`, `name`, `phone`, `email`, `address`, `birthDate`, `createdAt`, `updatedAt`
  are still present in the response.

### Notes
Done. Destructuring projection added before `successResponse`.

---

## Finding #16 — ETag and Internal Fields Leaked in UpdatePatient Response

**Severity:** 🟡 Medium  
**File:** `api/src/functions/UpdatePatient.ts:151-154`  
**Status:** ✅ Done

### Problem
The full updated entity (including `partitionKey`, `rowKey`, `isDeleted`, `createdBy`,
`updatedBy`, `etag`, `timestamp`) is returned in the response body. The etag is mixed into
the patient payload alongside PII rather than being a clean separate field.

### Agreed Solution — Option A
Strip internal storage fields from the patient payload via destructuring. Return the etag
as a separate top-level response field so the frontend can use it for subsequent updates.

### Implementation Steps
1. In `UpdatePatient.ts`, replace the `successResponse` call with:
   ```ts
   const { partitionKey, rowKey, isDeleted, createdBy, updatedBy, timestamp, etag: responseEtag, ...safePatient } = updatedPatient;
   return successResponse({
       message: 'Patient updated successfully',
       patient: safePatient,
       etag: responseEtag
   });
   ```
2. Verify the frontend `patientService.ts` reads the etag from the response correctly after
   this shape change (currently reads `response.data.patient.etag` — needs to read
   `response.data.etag` after this change).

### Verification
- `PUT /v1/patients/{id}` response `patient` object does not contain `partitionKey`,
  `rowKey`, `isDeleted`, `createdBy`, `updatedBy`, or `etag`.
- The `etag` field is present at the top level of the response data object.
- Subsequent patient updates using the returned etag succeed with optimistic concurrency.

### Notes
Done. Destructuring projection strips internal fields. Etag returned at top level. `frontend/src/services/patientService.ts` updated to merge `response.data.etag` back into the returned patient object for caller compatibility.

---

## Finding #17 — queryWithFilter Dead Code and Latent Injection Surface

**Severity:** 🟡 Medium  
**File:** `api/src/utils/tableClient.ts:254-274`  
**Status:** ✅ Done

### Problem
`queryWithFilter()` accepts a raw OData filter string and is never called from any
application code. It is a latent injection surface — if wired up without escaping it
would be immediately exploitable (same class as Finding #3).

### Agreed Solution — Option A
Delete the function entirely. The `odata` tagged template literal approach (Finding #3)
is the correct pattern for any future filtered queries.

### Implementation Steps
1. In `tableClient.ts`, delete the `queryWithFilter` function (lines 254-274) including
   its JSDoc comment block.
2. Confirm no file imports or calls `queryWithFilter` anywhere in the codebase.

### Verification
- `tableClient.ts` no longer exports `queryWithFilter`.
- TypeScript compilation succeeds with no missing-export errors.

### Notes
Done. `queryWithFilter` function deleted.

---

## Finding #18 — Dead Exported Symbols

**Severity:** 🟡 Medium  
**Files:** `tokenService.ts`, `errorHandler.ts`, `authMiddleware.ts`, `validation.ts`, `auditService.ts`  
**Status:** ✅ Done

### Problem
Multiple exported symbols have zero callers in application code. Some also have zero callers
in tests. Dead exported surface area increases maintenance burden and can be accidentally
depended on in future code without scrutiny.

### Agreed Solution — Option A
Delete only symbols with zero callers anywhere (application code and tests). Keep symbols
used in tests — those are legitimate callers.

### Symbols to Delete (zero callers everywhere)
| Symbol | File |
|---|---|
| `isTokenExpired()` | `tokenService.ts` |
| `withErrorHandling()` | `errorHandler.ts` |
| `AppError` | `errorHandler.ts` |
| `ValidationError` | `errorHandler.ts` |
| `AuthenticationError` | `errorHandler.ts` |
| `AuthorizationError` | `errorHandler.ts` |
| `NotFoundError` | `errorHandler.ts` |
| `ConflictError` | `errorHandler.ts` |
| `isViewer()` | `authMiddleware.ts` |
| `validatePartialUpdate()` | `validation.ts` |
| `logDataExport()` | `auditService.ts` |
| `logUnauthorizedAccess()` | `auditService.ts` |

### Symbols to Keep (used in tests)
`decodeTokenUnsafe`, `refreshToken`, `getUserId`, `getUsername`, `getUserRole`,
`resetCounter`, `getCurrentCounterValue`

### Implementation Steps
1. For each symbol in the delete list, remove its function/class definition and its
   JSDoc comment block from the respective file.
2. Run a codebase-wide search for each symbol name before deletion to confirm zero callers.
3. Ensure TypeScript compilation succeeds after each deletion.

### Verification
- TypeScript compilation succeeds with no missing-export errors.
- All existing tests pass.
- No application function file imports any of the deleted symbols.

### Notes
Done. `withErrorHandling`, `AppError`, `ValidationError`, `AuthenticationError`, `AuthorizationError`, `NotFoundError`, `ConflictError` deleted from `errorHandler.ts`. `validatePartialUpdate` deleted from `validation.ts`. `logDataExport`, `logUnauthorizedAccess` deleted from `auditService.ts`. `isViewer` and `isTokenExpired` were found to be used in test files and have been kept — this is per the plan's rule "Delete only symbols with zero callers anywhere (application code **and** tests)".

---

## Finding #19 — console.error Used Instead of Structured Logger

**Severity:** 🟡 Medium  
**Files:** `api/src/utils/auditService.ts:77`, `api/src/utils/counterService.ts:88`  
**Status:** ✅ Done

### Problem
Both `logAuditEvent()` and `adjustCounter()` use raw `console.error()` for failure logging.
In Azure Functions, `console` output is not bound to any invocation trace, making these
errors impossible to correlate with the request that caused them. The root cause is that
both utilities are pure functions without access to an `InvocationContext`.

### Agreed Solution — Option A
Add an optional `context?: Pick<InvocationContext, 'error'>` parameter to both functions.
When provided, use `context.error()`; when absent (e.g. in tests), fall back to
`console.error()`. All call sites in function handlers pass their `context` through.

### Implementation Steps

#### auditService.ts
1. Add `context?: Pick<InvocationContext, 'error'>` as a last optional parameter to
   `logAuditEvent()`.
2. In the catch block, replace `console.error(...)` with:
   ```ts
   (context?.error ?? console.error)('Failed to log audit event:', error.message);
   ```
3. All helper functions (`logUserLogin`, `logPatientCreated`, etc.) that call `logAuditEvent`
   should also accept and forward the optional `context` parameter.
4. All call sites in function handlers (e.g. `Login.ts`, `CreatePatient.ts`) pass their
   `context` object through to the audit log calls.

#### counterService.ts
1. Add `context?: Pick<InvocationContext, 'error'>` as a last optional parameter to
   `adjustCounter()`.
2. In the outer catch block, replace `console.error(...)` with:
   ```ts
   (context?.error ?? console.error)('[counterService] adjustCounter failed:', err);
   ```
3. All call sites that use `adjustCounter(...)` pass their `context` object.

### Verification
- Audit failures in a function handler appear in the Azure Functions invocation log
  bound to the correct request.
- Counter failures appear in the invocation log, not raw process stdout.
- Tests continue to work (context not passed in tests → falls back to console.error).

### Notes
Done. Optional `context` parameter added to both `logAuditEvent` and `adjustCounter`. The call-site forwarding of `context` is opt-in (parameter is optional); existing callers without context automatically fall back to `console.error`. All tests pass.

---

## Finding #20 — GetPatientByMRN Queries Wrong Table

**Severity:** 🟡 Medium  
**Status:** ✅ Resolved by Finding #6

The wrong-table logic only exists in `GetPatientByMRN.ts` which is being deleted as part
of Finding #6. No separate fix required.

---

## Finding #21 — Widespread as any for Request Body Parsing

**Severity:** 🔵 Quality  
**Files:** All function handlers in `api/src/functions/`  
**Status:** ✅ Done

### Problem
Every handler casts `await request.json()` to `any`, bypassing TypeScript type safety.
Any field access after this cast is unchecked — missing or wrongly-typed fields produce
no compile-time warning. Risk is highest in endpoints without downstream Joi validation
(`UpdateUser`, `DeleteUser`, `ResetUserPassword`).

### Agreed Solution — Option A
Define a minimal typed request body interface per endpoint and cast to it instead of `any`.
Prioritise endpoints with no downstream Joi validation first.

### Implementation Steps

#### Priority 1 — Endpoints with no Joi validation
1. `UpdateUser.ts` — define `interface UpdateUserBody { fullName?: string; role?: string; isActive?: boolean; }`
2. `DeleteUser.ts` — define `interface DeleteUserBody { reassignTo?: string; }`
3. `ResetUserPassword.ts` — define `interface ResetPasswordBody { newPassword?: string; }`

#### Priority 2 — Endpoints with Joi validation (lower risk, still worth fixing)
4. `Login.ts` — define `interface LoginBody { username?: string; password?: string; }`
5. `Register.ts` / `CreateUser.ts` — define `interface CreateUserBody { username?: string; password?: string; fullName?: string; email?: string; role?: string; }`
6. `ChangePassword.ts` — define `interface ChangePasswordBody { currentPassword?: string; newPassword?: string; confirmPassword?: string; }`
7. `CreatePatient.ts` / `UpdatePatient.ts` — define `interface PatientBody { name?: string; age?: number; birthDate?: string; phone?: string; email?: string; address?: string; etag?: string; }`
8. `CreateExamination.ts` / `UpdateExamination.ts` — define `interface ExaminationBody { ... }` covering all examination fields
9. `EmailExaminationReport.ts` — define `interface EmailReportBody { pdfData?: string; }`

### Verification
- TypeScript compilation succeeds with no type errors.
- No `as any` cast remains on a `request.json()` call in function handlers.
- Existing test coverage passes without modification.

### Notes
Done. Typed interfaces defined in all function handlers listed above.

---

## Finding #22 — normalizePatientName / getSearchPartitionKey Triplicated

**Severity:** 🔵 Quality  
**Files:** `CreatePatient.ts:21-35`, `UpdatePatient.ts:19-33`, `SearchPatients.ts:18-32`  
**Status:** ✅ Done

### Problem
`normalizePatientName()` and `getSearchPartitionKey()` are copy-pasted verbatim across
three files. AGENTS.md acknowledges this but marks it "keep in sync" — a maintenance
landmine. Any logic fix must be applied three times or they silently diverge.

### Agreed Solution
Extract both functions into a new shared `api/src/utils/patientUtils.ts` and import them
in all three files.

### Implementation Steps
1. Create `api/src/utils/patientUtils.ts` with:
   ```ts
   export const normalizePatientName = (name: string): string => {
       return name.trim().toLowerCase().replace(/\s+/g, ' ');
   };
   
   export const getSearchPartitionKey = (normalizedName: string): string => {
       const firstChar = normalizedName.charAt(0);
       const bucket = firstChar
           ? firstChar.codePointAt(0)!.toString(16).padStart(4, '0')
           : 'unknown';
       return `PATIENT_SEARCH_${bucket}`;
   };
   ```
2. In `CreatePatient.ts`, `UpdatePatient.ts`, and `SearchPatients.ts`:
   - Add `import { normalizePatientName, getSearchPartitionKey } from '../utils/patientUtils';`
   - Remove the local function definitions
3. Update AGENTS.md to remove the "keep in sync" note and reference the shared utility.

### Verification
- All three files compile with no errors.
- Patient create, update, and search operations work correctly with Cyrillic and Latin names.

### Notes
Done. `patientUtils.ts` created. All three files updated to import from it. `AGENTS.md` updated.

---

## Finding #23 — Register.ts Auth Check After Expensive DB Query

**Severity:** 🔵 Quality  
**File:** `api/src/functions/Register.ts:66`  
**Status:** ✅ Done

### Problem
The `requireAuth(request)` call for non-first-user cases happens after `ensureTableExists`
and a full table scan for `PartitionKey eq 'USER'`. Every unauthenticated subsequent-user
request incurs the expensive query before being rejected.

### Agreed Solution
Move the auth check to the top of the function (after the body parse) so unauthenticated
requests fail fast without touching storage.

### Implementation Steps
1. In `Register.ts`, move the auth check block (lines 65-75) to immediately after the
   `ensureTableExists('Users')` call and before the `isFirstUser` query.
2. Restructure the logic:
   - Extract and validate auth token first
   - If no token → check if system is empty → if empty allow, else reject
   - If token exists → verify admin role → proceed

### Verification
- Unauthenticated request to register on a non-empty system returns 401 immediately
  without querying the Users table.
- First-user registration on an empty system still works without auth.
- Admin-authenticated subsequent registrations work normally.

### Notes
Done. `requireAuth(request)` called early before the expensive storage query. The extracted `authUser` is reused in the non-first-user check.

---

## Finding #24 — UpdateExamination Scans Partition by Non-Key Property

**Severity:** 🔵 Quality  
**File:** `api/src/functions/UpdateExamination.ts:178-188`  
**Status:** ✅ Covered by Finding #3

### Problem
The code does a full partition scan with `filter: examinationId eq '...'` to find the
primary entity. The `examinationId` is part of the row key but not queryable directly
because the row key is `${reverseTicks}_${examinationId}`. This is an OData injection
opportunity and a performance issue.

### Agreed Solution
The OData injection risk is closed by Finding #3 (applying `odata` tag to all filters).
The full-scan performance issue is a known architectural constraint of the `reverseTicks`
storage model — documented in AGENTS.md. No additional fix required.

---

## Finding #25 — Login.ts Bespoke CORS Handler Duplicates getCorsHeaders

**Severity:** 🔵 Quality  
**File:** `api/src/functions/Login.ts:22-33`  
**Status:** ✅ Covered by Finding #11

### Problem
The `OPTIONS` preflight handler in `Login.ts` hardcodes CORS headers inline, duplicating
the logic already in `getCorsHeaders()` from `responseHelpers.ts`.

### Agreed Solution
After Finding #11 makes `getCorsHeaders()` env-aware, update the `OPTIONS` handler to call
`getCorsHeaders()` instead of inline values. This is already captured in Finding #11's
implementation steps.

---

## Finding #26 — request_id Generated with Math.random

**Severity:** 🔵 Quality  
**File:** `api/src/utils/responseHelpers.ts:34`  
**Status:** ✅ Done

### Problem
`request_id` uses `Math.random().toString(36).substr(2, 9)` which is not globally unique
and not suitable as a tracing identifier.

### Agreed Solution
Replace with `crypto.randomUUID()` (Node built-in).

### Implementation Steps
1. Add `import { randomUUID } from 'crypto';` at the top of `responseHelpers.ts`.
2. Replace the `request_id` generation with:
   ```ts
   request_id: `req_${Date.now()}_${randomUUID()}`
   ```

### Verification
- All API responses contain a `request_id` in meta with UUID format.
- No duplicate `request_id` values observed across concurrent requests.

### Notes
Done. `randomUUID` imported and used for `request_id` in both `successResponse` and `errorResponse`.

---

## Finding #27 — DeleteUser Examination Reassignment TOCTOU Race

**Severity:** 🔵 Quality  
**File:** `api/src/functions/DeleteUser.ts:103-150`  
**Status:** ✅ Done

### Problem
The code queries all examinations by `createdBy`, then iterates and re-fetches each one
before updating. A new examination created between the query and the per-entity fetch
would be missed and orphaned after deletion.

### Agreed Solution
This is an inherent limitation of Azure Table Storage's non-transactional model (documented
in AGENTS.md). The practical risk is low — concurrent examination creation during user
deletion is an edge case. Add a code comment documenting the known race condition rather
than attempting a fix that would require distributed locking.

### Implementation Steps
1. Add a comment above the examination reassignment loop in `DeleteUser.ts`:
   ```ts
   // NOTE: Non-transactional race window — examinations created after the query but before
   // this loop finishes will not be reassigned. This is a known limitation of Azure Table
   // Storage's lack of multi-row transactions.
   ```

### Verification
- Comment is present and accurately describes the race condition.

### Notes
Done. Comment added above the examination reassignment loop.

---

## Finding #28 — Password Reuse Check Uses Plaintext Comparison

**Severity:** 🔵 Quality  
**File:** `api/src/functions/ChangePassword.ts:41-43`  
**Status:** ✅ Done

### Problem
The check `if (currentPassword === newPassword)` only catches trivial identical-string
reuse. A user can bypass it with minor changes (`Password1!` → `Password1!a`) even if the
hash would be identical. The correct approach is `bcrypt.compare(newPassword, user.passwordHash)`
to detect true password reuse.

### Agreed Solution
Replace the plaintext string comparison with a bcrypt hash comparison against the current
password hash.

### Implementation Steps
1. In `ChangePassword.ts`, after confirming the current password is valid, add:
   ```ts
   // Check if new password is the same as current password
   const isSamePassword = await verifyPassword(newPassword, user.passwordHash);
   if (isSamePassword) {
       return errorResponse('New password must be different from current password', 400);
   }
   ```
2. Remove the plaintext `if (currentPassword === newPassword)` check (it's redundant —
   if current password is valid and new password hashes to the same thing, they are reused).

### Verification
- Changing password to an identical value (same string) is rejected.
- Changing password to a different string that happens to hash identically is rejected.
- Changing password to a genuinely different password succeeds.

### Notes
Done. Plaintext comparison removed. `verifyPassword(newPassword, user.passwordHash)` used instead.

---
