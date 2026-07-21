# Developer Workflow

This document describes the branch strategy, CI/CD pipeline, and step-by-step
process for contributing changes to this project.

---

## Branch Strategy

```
master ──────────────────────────────── production (auto-deploy on every push)
  │
  ├── feature/<ticket>-<slug>          feature development
  └── hotfix/<slug>                    urgent fixes (merge directly to master)
```

| Branch | Naming convention | Base | Target | Auto-deploy |
|---|---|---|---|---|
| `master` | — | — | — | ✅ Production |
| `feature/*` | `feature/<ticket>-<slug>` | `master` | `master` via PR | ✅ Ephemeral PR preview |
| `hotfix/*` | `hotfix/<slug>` | `master` | `master` via PR | ✅ Ephemeral PR preview |

---

## Branch Protection Rules (master)

Configured in **GitHub → Settings → Branches → master**:

- ✅ Require a pull request before merging
- ✅ Require status checks to pass before merging
  - Required check: `API — unit tests`
  - Required check: `Frontend — lint & build`
- ✅ Require branches to be up to date before merging

These rules ensure `master` is always deployable — a broken build cannot be merged.

---

## CI/CD Pipelines

Three GitHub Actions workflows run automatically:

| Workflow | Trigger | What it does |
|---|---|---|
| [`ci.yml`](.github/workflows/ci.yml) | Push to `feature/**` / `hotfix/**`; PR to `master` | API unit tests + frontend lint & build |
| [`deploy-production.yml`](.github/workflows/deploy-production.yml) | Push to `master` | Builds and deploys to Azure SWA production |
| [`deploy-preview.yml`](.github/workflows/deploy-preview.yml) | PR opened / updated / closed | Creates / tears down an ephemeral SWA preview environment |

> **PR preview warning:** Preview environments share the production Azure Storage
> account (SWA Free Tier limitation). Use previews for UI/layout review only —
> do not perform write operations (create/update/delete patients, examinations,
> or users) in a preview as they will affect production data.

---

## Step-by-Step Feature Development

### 1. Start from an up-to-date master

```bash
git checkout master
git pull origin master
```

### 2. Create a feature branch

```bash
git checkout -b feature/uzd-42-my-feature
```

Use the ticket number and a short slug, e.g.:
- `feature/uzd-42-add-version-badge`
- `feature/fix-ki-007-email-tld`
- `hotfix/auth-token-expiry`

### 3. Develop locally

Start the local stack (three terminals):

```powershell
# Terminal 1 — Azure Storage emulator
.\start-azurite.ps1

# Terminal 2 — Full stack via SWA CLI (frontend + API on port 4280)
swa start --config swa-cli.config.json
```

Open **http://localhost:4280** in the browser.

### 4. Run tests before pushing

```powershell
# Unit tests (fast, no Azurite needed)
cd api
npm test -- --testPathPattern="src/tests/utils" --forceExit

# Integration tests (requires Azurite running)
npm test -- --testPathPattern="src/tests/integration" --forceExit
```

Integration tests are excluded from CI — run them locally before pushing.

### 5. Push the feature branch

```bash
git add .
git commit -m "feat: describe what this commit does"
git push origin feature/uzd-42-my-feature
```

This triggers `ci.yml` — unit tests and frontend build run automatically.

### 6. Open a Pull Request

Go to **GitHub → your repo → Pull requests → New pull request**
- Base: `master`
- Compare: `feature/uzd-42-my-feature`

Opening the PR triggers:
- `ci.yml` — runs the full quality gate
- `deploy-preview.yml` — deploys an ephemeral preview

GitHub posts a comment on the PR with the preview URL:
```
https://proud-tree-xxx-pr-42.azurestaticapps.net
```

Use the preview URL for **UI and layout review only** (see warning above).

### 7. Wait for CI to go green

Both status checks must pass before the merge button becomes active:
- ✅ `API — unit tests`
- ✅ `Frontend — lint & build`

If either check fails, fix the issue, push again — CI re-runs automatically.

### 8. Merge the PR

Use **Squash and merge** to keep `master` history clean. GitHub will suggest
a commit message based on the PR title — edit it to follow the convention:

```
feat: add version badge to user menu (#42)
fix: correct email TLD validation (#43)
chore: upgrade checkout action to v5 (#44)
```

### 9. Production deploys automatically

Merging to `master` triggers `deploy-production.yml`. The build and deploy
takes approximately 3–4 minutes. Monitor progress at:

**GitHub → Actions → Deploy — Production**

### 10. Clean up

```bash
git checkout master
git pull origin master
git branch -d feature/uzd-42-my-feature
```

The PR preview environment is torn down automatically when the PR is closed.

---

## Deployed Version

Every production and preview build injects the Git commit SHA into the frontend
bundle at build time via `VITE_APP_VERSION`. The deployed version is visible
in the app UI (user menu, bottom of dropdown) as a linked short SHA:

```
a1b2c3d · production
```

Clicking the SHA opens the corresponding GitHub commit page.

---

## Hotfix Workflow

For urgent production fixes that cannot wait for a full feature-branch cycle:

```bash
git checkout master
git pull origin master
git checkout -b hotfix/describe-the-fix

# ... make the fix ...

git push origin hotfix/describe-the-fix
# Open PR → master, same CI gate applies
# Merge immediately after green
```

---

## Environment Variables

| Variable | Local (`api/local.settings.json`) | Production (Azure Portal → SWA → Configuration) |
|---|---|---|
| `JWT_SECRET` | 64-byte hex string | Different 64-byte hex string |
| `AZURE_STORAGE_CONNECTION_STRING` | `UseDevelopmentStorage=true` | Real Azure Storage connection string |
| `ALLOWED_ORIGIN` | `http://localhost:4280` | `https://<name>.azurestaticapps.net` |
| `NODE_ENV` | `development` | `production` |

`api/local.settings.json` is git-ignored — never commit it.
Copy `api/local.settings.json.example` to get started locally.
