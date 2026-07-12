# Documentation Consolidation Plan

## Top-Level Overview

**Goal:** Consolidate 25 scattered documents in `docs/` into a lean, well-structured `docs2/` folder.  
The original `docs/` folder will be archived (not deleted). Known Issues is kept as a standalone, living file — updated to reflect current status. All feature-request raw text, defect raw text, intermediate req specs, and implementation plans are distilled into one current-state document each.

**Output files in `docs2/`:**
1. `README.md` — index / navigation guide (updated from old README)
2. `01-architecture-overview.md` — carried over unchanged
3. `02-database-design.md` — carried over unchanged
4. `03-security-architecture.md` — carried over unchanged
5. `04-api-specification.md` — carried over unchanged
6. `05-deployment-guide.md` — carried over unchanged
7. `06-local-dev-setup.md` — carried over unchanged (if it exists)
8. `REQUIREMENTS.md` — single unified requirements document (all REQ/FLAG/DR1/DR2/DR3/DR4 requirements, with current status)
9. `KNOWN-ISSUES.md` — updated known-issues file (status review applied)
10. `TEST-CASES.md` — carried over unchanged

**Documents NOT carried forward** (superseded by `REQUIREMENTS.md`):
- `FEATURE-REQEUSTS.txt`, `feature-request.md`
- `REQUIREMENTS-SPEC.md`, `REQUIREMENTS-SPEC-DEFECTS-ROUND1.md`
- `DEFECTS-ROUND1.txt`, `DEFECTS-ROUND2.md`, `DEFECTS-ROUND3.md`, `defects-round4.txt`
- `DEFECTS-ROUND2-REQ-SPEC.md`, `DEFECTS-ROUND3-REQ-SPEC.md`, `defects-round4-req-spec.md`
- All `*-PLAN.md` / `*-impl-plan.md` files (historical implementation artefacts)
- `IMPLEMENTATION-PLAN.md` (completed, no live status)
- Old `README.md` (replaced by new one)

---

## Sub-Tasks

---

### ST-01 — Copy unchanged architecture docs to `docs2/`

**Status:** `[ ] pending`

**Intent**  
The six original architecture/design documents (`01-` through `06-`) are stable reference material and do not need modification. Copy them as-is.

**Expected Outcomes**  
- `docs2/` contains `01-architecture-overview.md`, `02-database-design.md`, `03-security-architecture.md`, `04-api-specification.md`, `05-deployment-guide.md`, `06-local-dev-setup.md`.
- Content is byte-for-byte identical to the originals in `docs/`.

**Todo List**
1. Read each of the six files to confirm they exist and are intact.
2. Write them to `docs2/` with the same filenames.

**Relevant Context**
- Source files: `docs/01-architecture-overview.md` through `docs/06-local-dev-setup.md`

---

### ST-02 — Copy `TEST-CASES.md` to `docs2/`

**Status:** `[ ] pending`

**Intent**  
`TEST-CASES.md` is a standalone test-case document created against the original architecture spec. Copy it unchanged.

**Expected Outcomes**  
- `docs2/TEST-CASES.md` exists and is identical to `docs/TEST-CASES.md`.

**Todo List**
1. Read `docs/TEST-CASES.md`.
2. Write it to `docs2/TEST-CASES.md`.

---

### ST-03 — Analyse and update `KNOWN-ISSUES.md` status

**Status:** `[ ] pending`

**Intent**  
Verify the current code state against each of the four known issues (KI-001 through KI-004) and update their status in the file accordingly. Write the updated file to `docs2/KNOWN-ISSUES.md`.

**Expected Outcomes**  
- Each issue has an updated `Status` that accurately reflects the current codebase.
- No issue is left with stale "Deferred" status if it has been resolved.

**Todo List**
1. **KI-001** (Missing `InlineLoading` import in `PatientDetailPage`): grep `PatientDetailPage.tsx` for `InlineLoading` in the import block.
   - If found in imports: mark **Resolved**.
   - If still absent: mark **Open / Deferred**.
   - _Finding (already done during research):_ `InlineLoading` IS imported at line 9 of `PatientDetailPage.tsx`. → Mark **Resolved**.

2. **KI-002** (`CalculateExamination` backend endpoint unreachable with formula bugs): check if `api/src/functions/CalculateExamination.ts` still exists and is still not called by any frontend service.
   - If file still exists and no `examinationService` method calls the `/calculate` route: keep **Deferred** (Option A — delete — still recommended).
   - _Finding:_ File still exists. No frontend call exists. → Keep **Deferred**, status unchanged.

3. **KI-003** (superseded by KI-004): confirm `Status: Superseded by KI-004` is still accurate — no changes needed.

4. **KI-004** (PatientDetailPage exam sub-table only shows first 50 on filter): check `PatientDetailPage.tsx` for any `continuationToken` or load-more logic in the exam sub-section.
   - _Finding:_ No load-more / continuationToken in `PatientDetailPage` exam section. Status remains **Deferred / Won't fix unless usage patterns change**.

5. Write the updated file to `docs2/KNOWN-ISSUES.md` with KI-001 status changed to **Resolved**.

**Relevant Context**
- `frontend/src/pages/PatientDetailPage.tsx` line 9 — InlineLoading import confirmed present
- `api/src/functions/CalculateExamination.ts` — still exists
- No load-more in PatientDetailPage exam section confirmed by grep

---

### ST-04 — Write consolidated `REQUIREMENTS.md`

**Status:** `[ ] pending`

**Intent**  
Merge all 8 source requirement/defect documents into one living requirements document that captures every requirement with its current implementation status. Group by domain. Dead rounds (fully completed) are shown collapsed; active/deferred items are highlighted.

**Expected Outcomes**  
- `docs2/REQUIREMENTS.md` exists and contains every named requirement (REQ-01–11, FLAG-01–08, DR1-01–18, DR2-01–05, DR3-02–08, D4-01–04) with its current status.
- No requirement from any source document is omitted.
- No intermediate planning text (impl plans, todo lists) is included — only requirement statements, acceptance criteria, and status.
- Source documents that feed into it are listed in a "Source Documents" header section.

**Todo List**
1. Create `docs2/REQUIREMENTS.md` with the following structure:
   - **Header section**: title, purpose, source documents list, status legend
   - **Section 1 — Feature Requests (Original)**: REQ-01 through REQ-11 with current status (`✅ Done` for all — see IMPLEMENTATION-PLAN.md completion matrix)
   - **Section 2 — Bugs & Flags (bundled with feature requests)**: FLAG-01 through FLAG-08 with current status (all Done per IMPLEMENTATION-PLAN.md)
   - **Section 3 — Defects Round 1** (DR1-01 through DR1-18) — all implemented per DEFECTS-ROUND1-PLAN.md
   - **Section 4 — Defects Round 2** (DR2-01 through DR2-05) — all implemented per DEFECTS-ROUND2-IMPL-PLAN.md  
   - **Section 5 — Defects Round 3** (REQ-3-02 through REQ-3-08) — all implemented per DEFECTS-ROUND3-IMPL-PLAN.md
   - **Section 6 — Defects Round 4** (D4-01 through D4-04) — all implemented per defects-round4-impl-plan.md
   - **Section 7 — FR-01 through FR-03** (feature-request.md) — all Done
2. For each requirement entry include: ID, title, one-sentence description, acceptance criteria summary, status.
3. Do NOT include implementation notes, file paths, or todo steps — those are in the archived `docs/` folder.

**Relevant Context**
- Source: `docs/REQUIREMENTS-SPEC.md` (REQ/FLAG), `docs/REQUIREMENTS-SPEC-DEFECTS-ROUND1.md` (DR1), `docs/DEFECTS-ROUND2-REQ-SPEC.md` (DR2), `docs/DEFECTS-ROUND3-REQ-SPEC.md` (REQ-3), `docs/defects-round4-req-spec.md` (D4), `docs/feature-request.md` (FR)
- Status source: `docs/IMPLEMENTATION-PLAN.md`, `docs/DEFECTS-ROUND2-IMPL-PLAN.md`, `docs/DEFECTS-ROUND3-IMPL-PLAN.md`, `docs/defects-round4-impl-plan.md`, `docs/DEFECTS-ROUND1-PLAN.md`

---

### ST-05 — Write updated `README.md` for `docs2/`

**Status:** `[ ] pending`

**Intent**  
Replace the old `docs/README.md` (which referenced the initial architecture phase) with a new `docs2/README.md` that reflects the current project state: implementation complete, reflects the actual doc set in `docs2/`.

**Expected Outcomes**  
- `docs2/README.md` lists all files in `docs2/` with a one-line description each.
- States current project phase (implemented, in production/dev use).
- References that `docs/` is the archive for historical planning artefacts.
- Does not repeat the "implementation timeline" phased schedule (that has passed).

**Todo List**
1. Write `docs2/README.md` with:
   - Project title and current status
   - Documentation Index table (one row per file in docs2/)
   - A note that `docs/` is archived and contains historical planning documents
   - Brief project overview (drawn from old README, updated for current state)

---

## Summary of Output

| File in `docs2/` | Source | Change |
|---|---|---|
| `README.md` | `docs/README.md` | Rewritten (updated state) |
| `01-architecture-overview.md` | `docs/01-architecture-overview.md` | Copied unchanged |
| `02-database-design.md` | `docs/02-database-design.md` | Copied unchanged |
| `03-security-architecture.md` | `docs/03-security-architecture.md` | Copied unchanged |
| `04-api-specification.md` | `docs/04-api-specification.md` | Copied unchanged |
| `05-deployment-guide.md` | `docs/05-deployment-guide.md` | Copied unchanged |
| `06-local-dev-setup.md` | `docs/06-local-dev-setup.md` | Copied unchanged |
| `REQUIREMENTS.md` | All req specs + impl plans | New consolidated file |
| `KNOWN-ISSUES.md` | `docs/KNOWN-ISSUES.md` | Updated (KI-001 → Resolved) |
| `TEST-CASES.md` | `docs/TEST-CASES.md` | Copied unchanged |

**Not carried to `docs2/`** (remain in `docs/` archive only):
- All `DEFECTS-ROUND*.md`, `*-REQ-SPEC.md`, `*-IMPL-PLAN.md`, `*-PLAN.md` files
- `FEATURE-REQEUSTS.txt`, `feature-request.md`
- `REQUIREMENTS-SPEC.md`, `REQUIREMENTS-SPEC-DEFECTS-ROUND1.md`
- `IMPLEMENTATION-PLAN.md`
