# Implementation Plan — Version & Status Badge

**Branch:** `feature/add-version-badge`  
**Status:** ✅ Complete

---

## Goal

Display a version badge fixed to the **bottom-right corner of the login page**
showing:

- The deployed Git commit SHA (linked to GitHub)
- The deploy environment (production / preview / local)
- Three status indicators: Frontend, API, Storage

---

## Scope — Login Page Only

The badge is **only rendered on the login page** (`LoginPage.tsx`).
It must **not** appear on any authenticated page, modal, or inside `Layout.tsx`.
Once the user logs in and is redirected away from `/login`, the badge disappears
automatically because `AppVersion` is only mounted by `LoginPage`.

---

## Visual Design

```
┌──────────────────────────────┐
│  a1b2c3d · production        │  ← SHA links to github.com/.../commit/<sha>
│  ● Frontend   reachable      │  ← always green (page loaded = JS ran)
│  ● API        reachable      │  ← from GET /api/v1/health
│  ● Storage    reachable      │  ← from body.storage in health response
└──────────────────────────────┘
```

**Position:** fixed to the **bottom-right corner of the browser viewport** —
`position: fixed; bottom: 1rem; right: 1rem`.

- "Fixed to the browser window" means the badge stays anchored to the corner
  of the viewport even if the page content scrolls (no content on the login
  page scrolls, but the fixed rule is intentional and must not be changed to
  `absolute` or `sticky`).
- The badge must not be placed inside the login card, the `<form>`, or any
  scrollable container.
- It does not overlap the login form (the form is centred and at most 400 px wide).

Dot colours (Carbon design tokens):
- `#24a148` — healthy / reachable
- `#da1e28` — degraded / unreachable
- `#8d8d8d` — checking (initial state)

Font: `0.75rem`, color `#525252`, background `#ffffff`, subtle border and
box-shadow matching the existing user dropdown in `Layout.tsx`.

---

## Files to Change

### 1. `api/src/functions/HealthCheck.ts` — extend storage probe

Current response: `{ status: 'healthy', timestamp }` (static, no storage touch).

New response: `{ status: 'healthy', storage: 'healthy' | 'degraded', timestamp }`

The probe calls `getTableServiceClient().listTables({ queryOptions: { top: 1 } })`
inside a try/catch. If it throws for any reason (connection refused, wrong
connection string, Azure Storage down), `storage` is set to `'degraded'`.

Import required: `getTableServiceClient` from `../utils/tableClient`.

The endpoint stays anonymous, GET only, route `v1/health` — no other changes.

### 2. `frontend/src/components/AppVersion.tsx` — new component

Props: none.

State:
- `apiStatus: 'checking' | 'reachable' | 'unreachable'` — init `'checking'`
- `storageStatus: 'checking' | 'reachable' | 'unreachable'` — init `'checking'`

Behaviour:
- On mount, fires one `fetch('/api/v1/health')` using raw `fetch()` — **not**
  the axios `api` instance — to avoid the 401 redirect interceptor and envelope
  unwrapping in `api.ts`.
- On 200 response: sets `apiStatus = 'reachable'`; reads `body.storage` to set
  `storageStatus`.
- On any error (network failure, non-200): sets `apiStatus = 'unreachable'`,
  `storageStatus = 'unreachable'` (cannot know storage state if API is down).
- Frontend indicator is always `'reachable'` — hardcoded (the component rendered
  = the JS bundle loaded and ran).
- The fetch fires once on mount. No polling, no retry, no interval.

Version display:
- `import.meta.env.VITE_APP_VERSION` — full SHA injected at build time.
- Short SHA = first 7 characters.
- If undefined (local dev), displays `'local'` with no link.
- If defined, wraps the short SHA in an `<a>` linking to
  `https://github.com/MartinBelyanov/ag-forms/commit/<full-sha>`.
- `import.meta.env.VITE_DEPLOY_ENV` — `'production'` / `'preview'` / undefined
  (local). Displayed after the SHA separated by ` · `.

### 3. `frontend/src/pages/LoginPage.tsx` — render the badge

Import `AppVersion` and render it **only here**. The badge must not be added
to any other page, route, or shared layout component.

The existing login form layout (`maxWidth: 400px, margin: auto`) is not changed.

```tsx
// Added just before the closing </div> of LoginPage's return
<AppVersion />
```

`AppVersion` owns `position: fixed; bottom: 1rem; right: 1rem` in its own
inline style or CSS — `LoginPage` renders it without wrapping it in any
positioned container. This guarantees the badge is fixed to the **browser
viewport corner**, not to a parent element.

### 4. `.github/workflows/deploy-production.yml` — inject SHA

Change `app_build_command` to:
```
VITE_APP_VERSION=${{ github.sha }} VITE_DEPLOY_ENV=production npm ci && npm run build
```

`api_build_command` is unchanged.

### 5. `.github/workflows/deploy-preview.yml` — inject SHA

Change `app_build_command` to:
```
VITE_APP_VERSION=${{ github.sha }} VITE_DEPLOY_ENV=preview npm ci && npm run build
```

---

## What Does NOT Change

- `frontend/src/components/Layout.tsx` — the badge is **login-page-only**;
  it must never be added to `Layout.tsx` or any authenticated route.
- `frontend/src/services/api.ts` — raw `fetch()` is used, not the axios instance.
- No new npm packages.
- No new Azure Functions routes beyond the extended `/v1/health` response body.
- No auth required on `GET /api/v1/health` — already anonymous.

---

## Local Behaviour

When running `swa start` locally:
- `VITE_APP_VERSION` is undefined → displays `local`
- `VITE_DEPLOY_ENV` is undefined → no environment label
- The health fetch hits `http://localhost:4280/api/v1/health` via SWA CLI proxy
- Storage check probes the local Azurite instance via `UseDevelopmentStorage=true`

If Azurite is not running, the storage indicator will show red — which is the
correct and expected behaviour.

---

## Acceptance Criteria

- [ ] Login page shows the badge fixed to bottom-right, does not overlap the form
- [ ] Frontend indicator is always green
- [ ] API indicator is green when the Functions runtime is reachable
- [ ] Storage indicator is green when Azurite (local) or Azure Storage (prod) is reachable
- [ ] Storage indicator is red when Azurite is stopped locally
- [ ] SHA links to the correct GitHub commit on production/preview builds
- [ ] Displays `local` with no link in local dev
- [ ] No console errors in any state
