# Local SWA Development Guide

This guide covers running the full stack locally using the Azure Static Web Apps CLI,
which replicates the SWA Free Tier architecture (frontend + managed functions, same origin).

## Prerequisites

- Node.js 20.x LTS
- Azurite (Azure Storage emulator) — for local Table Storage
- SWA CLI: `npm install -g @azure/static-web-apps-cli`
- Azure Functions Core Tools v4: `npm install -g azure-functions-core-tools@4`

## How SWA Local Dev Works

```
Browser → http://localhost:4280
              │
              ├── GET /          → SWA CLI serves frontend/dist/
              ├── GET /patients  → SWA CLI serves frontend/dist/index.html (SPA fallback)
              └── POST /api/*    → SWA CLI forwards to Functions runtime on port 7071
                                       (/api prefix is KEPT — Functions runtime receives /api/v1/...)
```

The SWA CLI (`swa start`) replaces both:
- The old `vite dev` proxy block
- The separate `start-functions.ps1` / `start-frontend.ps1` workflow

## Step-by-Step Local Setup

### 1. Start Azurite (Terminal 1)

```powershell
.\start-azurite.ps1
```

Azurite must be running before the functions start — `AZURE_STORAGE_CONNECTION_STRING`
in `local.settings.json` is set to `UseDevelopmentStorage=true`, which points here.

### 2. Build frontend and API

```powershell
# Build the API (TypeScript → dist/)
cd api
npm run build
cd ..

# Build the frontend (Vite → frontend/dist/)
cd frontend
npm run build
cd ..
```

### 3. Start SWA CLI (Terminal 2)

```powershell
swa start --config swa-cli.config.json
```

**SWA CLI starts:**
- The Functions runtime on port **7071** (reads `api/local.settings.json` for env vars)
- A unified gateway on port **4280** that serves both frontend and proxies `/api/*`

> **Do not use `--api-devserver-url`** — it behaves identically to the built-in launcher
> in SWA CLI 2.x (both forward with the `/api` prefix intact) and adds unnecessary
> complexity. Use `--config swa-cli.config.json` only.

### 4. Initialize the database (first time only)

```powershell
.\init-database.ps1
```

Or via curl:

```bash
curl -X POST http://localhost:4280/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin123!@#$","email":"admin@example.com","role":"admin"}'
```

### 5. Access the app

Open: **http://localhost:4280**

Login with `admin` / `Admin123!@#$`

---

## Environment Variables

All env vars are read from `api/local.settings.json` by the Functions runtime.
This file is git-ignored — do not commit it with real secrets.

| Variable | Local value | Production value |
|----------|-------------|-----------------|
| `JWT_SECRET` | 64-byte hex string (pre-set in local.settings.json) | Set in SWA Application Settings in Azure Portal |
| `EMAIL_CREDENTIALS_ENCRYPTION_KEY` | 64 hex characters (32 random bytes); generate your own, see below | Set in SWA Application Settings in Azure Portal **before** the email feature is released |
| `EMAIL_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS` | Not needed | Optional; only during a key rotation, see below |
| `AZURE_STORAGE_CONNECTION_STRING` | `UseDevelopmentStorage=true` | Real Azure Storage connection string |
| `ALLOWED_ORIGIN` | `http://localhost:4280` | `https://<name>.azurestaticapps.net` |
| `NODE_ENV` | `development` | `production` |

### Email encryption key (`EMAIL_CREDENTIALS_ENCRYPTION_KEY`)

The "send examination by email" feature stores each doctor's mailbox app password encrypted
(AES-256-GCM, per-doctor key derived with HKDF-SHA256 from this master key). The variable is
**required**: there is no fallback and no default. If it is missing or not exactly 64 hex
characters, saving email settings (`PUT`), the test email and sending a report fail closed with a
generic `500 Email settings are temporarily unavailable` and write a server log line (without key
material). Reading and removing settings, and the rest of the application, are not affected.

Generate a key (one per environment; never reuse the JWT secret, never commit a real value):

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

- **Local:** put the value in `api/local.settings.json` (git-ignored). `api/local.settings.json.example`
  only contains a placeholder.
- **Azure:** add `EMAIL_CREDENTIALS_ENCRYPTION_KEY` in the Azure portal under the Static Web App →
  *Settings* → *Environment variables* (application settings) **before** the release that contains
  the feature is deployed. Keep a backup of the value in your organisation's secret store: if the key
  is lost, every stored mailbox password becomes unusable and each doctor must re-enter it.
- **PR previews share production application settings and storage** (SWA free tier has no
  per-environment override). A preview therefore uses the production key and the production `Users`
  table. Use only dedicated test accounts and test mailboxes there; never real doctors' secrets.

#### Key rotation (`EMAIL_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS`)

Each stored secret carries a `keyVersion` (currently `1`). It is part of the key-derivation context
and is **not** a selector between master keys; the app has exactly two key slots: the current key and
one optional previous key. To rotate:

1. Generate a new key with the command above.
2. Set `EMAIL_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS` to the **old** current value and
   `EMAIL_CREDENTIALS_ENCRYPTION_KEY` to the **new** value; restart/redeploy so both are active.
3. Stored secrets written with the old key are still decrypted (current key is tried first, then the
   previous one). They are re-encrypted with the new key the next time the doctor saves the settings
   or after a **successful** send or test email.
4. When all doctors have saved, tested or sent once, remove `EMAIL_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS`.
   A row that was never touched cannot be decrypted after the previous key is removed; that doctor
   re-enters the app password in *Email Settings*.

Only one previous key is supported at a time; do not start a second rotation before the first one is finished.

---

## Route Mapping: How the URL paths work

| Browser URL | SWA CLI action | Received by Functions runtime |
|-------------|---------------|-------------------------------|
| `http://localhost:4280/` | Serves `frontend/dist/index.html` | — |
| `http://localhost:4280/patients` | SPA fallback → `index.html` | — |
| `http://localhost:4280/api/v1/patients` | Forward to Functions (prefix kept) | `/api/v1/patients` |
| `http://localhost:4280/api/v1/auth/login` | Forward to Functions (prefix kept) | `/api/v1/auth/login` |

**Note:** `host.json` sets `routePrefix: "api"`. SWA CLI 2.x forwards the full path
including the `/api` segment to the Functions runtime on port 7071 — it does **not** strip
it. The `routePrefix: "api"` setting tells the runtime to match that prefix, so
`/api/v1/patients` correctly resolves to the function registered with `route: 'v1/patients'`.

---

## Key Differences from the Old Dev Workflow

| Old (`start-functions.ps1` + `start-frontend.ps1`) | New (`swa start`) |
|----------------------------------------------------|-------------------|
| Frontend on port 3000, API on port 7071 | Everything on port **4280** |
| Vite dev proxy forwards `/api/*` to 7071 (strips prefix) | SWA CLI proxy forwards `/api/*` to 7071 (keeps prefix) |
| `ALLOWED_ORIGIN=http://127.0.0.1:3000` | `ALLOWED_ORIGIN=http://localhost:4280` |
| `host.json` routePrefix `"api"` | `host.json` routePrefix `"api"` (unchanged) |
| `authLevel: 'function'` (26 functions) | `authLevel: 'anonymous'` (all functions) |

---

## Troubleshooting

### "Cannot find module" on swa start
Run `npm run build` inside `api/` first — SWA CLI needs compiled JS in `api/dist/`.

### API returns 404 on all routes
Check `api/host.json` — `routePrefix` must be `"api"`. SWA CLI 2.x forwards requests
to the Functions runtime with the `/api` prefix intact; the runtime needs `routePrefix: "api"`
to match it. Setting it to `""` causes 404 on every route.

### 401 on all protected endpoints
Confirm `authLevel: 'anonymous'` in all function registrations (26 files were patched).

### Cookie not sent after login
`ALLOWED_ORIGIN` in `local.settings.json` must match the SWA CLI port (`http://localhost:4280`).

### Azurite connection errors
Ensure Azurite is running (`.\start-azurite.ps1`) before starting SWA CLI.
