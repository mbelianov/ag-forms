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
                                       (strips /api prefix before forwarding)
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

Or without the config file (explicit flags):

```powershell
swa start frontend/dist `
  --api-location api `
  --api-devserver-url http://localhost:7071
```

**SWA CLI starts:**
- The Functions runtime on port **7071** (reads `api/local.settings.json` for env vars)
- A unified gateway on port **4280** that serves both frontend and proxies `/api/*`

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
| `AZURE_STORAGE_CONNECTION_STRING` | `UseDevelopmentStorage=true` | Real Azure Storage connection string |
| `ALLOWED_ORIGIN` | `http://localhost:4280` | `https://<name>.azurestaticapps.net` |
| `NODE_ENV` | `development` | `production` |

---

## Route Mapping: How the URL paths work

| Browser URL | SWA CLI action | Function route |
|-------------|---------------|----------------|
| `http://localhost:4280/` | Serves `frontend/dist/index.html` | — |
| `http://localhost:4280/patients` | SPA fallback → `index.html` | — |
| `http://localhost:4280/api/v1/patients` | Strip `/api` → forward to Functions | `v1/patients` |
| `http://localhost:4280/api/v1/auth/login` | Strip `/api` → forward to Functions | `v1/auth/login` |

**Note:** `host.json` sets `routePrefix: ""` (empty). This is required because SWA
already owns the `/api` segment — adding it again in `routePrefix` would cause double
prefixing and 404 errors on all routes.

---

## Key Differences from the Old Dev Workflow

| Old (`start-functions.ps1` + `start-frontend.ps1`) | New (`swa start`) |
|----------------------------------------------------|-------------------|
| Frontend on port 3000, API on port 7071 | Everything on port **4280** |
| Vite dev proxy forwards `/api/*` to 7071 | SWA CLI proxy forwards `/api/*` to 7071 |
| `ALLOWED_ORIGIN=http://127.0.0.1:3000` | `ALLOWED_ORIGIN=http://localhost:4280` |
| `host.json` routePrefix `"api"` | `host.json` routePrefix `""` |
| `authLevel: 'function'` (26 functions) | `authLevel: 'anonymous'` (all functions) |

---

## Troubleshooting

### "Cannot find module" on swa start
Run `npm run build` inside `api/` first — SWA CLI needs compiled JS in `api/dist/`.

### API returns 404 on all routes
Check `api/host.json` — `routePrefix` must be `""` not `"api"`.

### 401 on all protected endpoints
Confirm `authLevel: 'anonymous'` in all function registrations (26 files were patched).

### Cookie not sent after login
`ALLOWED_ORIGIN` in `local.settings.json` must match the SWA CLI port (`http://localhost:4280`).

### Azurite connection errors
Ensure Azurite is running (`.\start-azurite.ps1`) before starting SWA CLI.
