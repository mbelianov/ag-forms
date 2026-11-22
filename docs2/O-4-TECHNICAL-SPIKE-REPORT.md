# O-4 Technical Spike Report: Libraries and Platform Checks for PAP Test

| | |
|---|---|
| **Spike** | O-4 from [`PAP-TEST-USER-STORIES.md`](PAP-TEST-USER-STORIES.md) (supports Stories 9 and 12) |
| **Branch** | `spike/O-4-technical-spike` (branched from `feature/pap_test`) |
| **Code and evidence** | `spikes/O-4/` on branch `spike/O-4-technical-spike` (isolated, not wired into `api/` or `frontend/`; not merged into `feature/pap_test`) |
| **Date / environment** | 22 Nov 2026, Windows 11, Node 22.23.1 (the version used in the CI workflows), npm 10.9.8 |
| **Re-run everything** | `git checkout spike/O-4-technical-spike`, then `cd spikes/O-4 && npm ci && npm run verify` |

## 1. Outcome

| # | Question from O-4 | Result | Confidence |
|---|---|---|---|
| 1 | Package size and cold start within SWA managed-function limits | **Pass with a caveat.** Added about 30 MB to the API's production `node_modules` (51.8 MB to 82 MB). Cold-start overhead is about 0.1 s per library. SWA's published request limit is 45 s. The SWA **API size limit could not be confirmed from documentation**. | Medium |
| 2 | Cyrillic rendering with an embedded font | **Pass** for both PDF candidates. | High |
| 3 | AES ZIP opens in 7-Zip/WinRAR; plain ZIP opens in Windows Explorer | **Pass for 7-Zip and for Windows' built-in extraction stack.** WinRAR and the Explorer shell UI were **not tested** (not installed). | Medium |
| 4 | `npm audit` clean | **Pass for the new dependencies** (0 findings with `--omit=dev`). The **existing API already has 4 findings (3 high)** unrelated to this spike. See section 5. | High |
| 5 | Storage supports lifecycle rules with blob-index-tag filters and has no outliving soft delete/versioning | **Partially verified.** The blob-tag flow works (against Azurite). Platform support is confirmed from Microsoft documentation. The **real storage account was not inspected** because no Azure login was available. A script that verifies it is provided. | Low to medium |

### Selected libraries

| Purpose | Choice | Version | Licence | Last release |
|---|---|---|---|---|
| Server-side PDF | **`pdfmake`** (pulls in `pdfkit` as a dependency) | 0.3.15 | MIT | 2026-11-20 |
| ZIP (AES-256 and plain) | **`@zip.js/zip.js`** | 2.25.0 | BSD-3-Clause | 2026-11-12 |
| Font | **Roboto**, bundled inside `pdfmake`; no extra package | n/a | Apache-2.0 | n/a |

Excluded, as already decided in O-4: `pdf-lib` (last release 2022), `archiver-zip-encrypted` (last release March 2024), ZipCrypto.

## 2. Method

The harness in `spikes/O-4/src/` uses one realistic Bulgarian PAP report fixture (`spikes/O-4/src/sample.js` on the spike branch). It contains no real patient data. It includes the full Cyrillic alphabet, "ѝ", the mock-signature marker, and a long free-text field. Every check is a script that exits non-zero on failure.

| Script | Question |
|---|---|
| `check-cyrillic.js` | 2 |
| `check-zip.js` | 3 |
| `check-footprint.js` | 1 |
| `check-blob-tags.js` | 5 (application side) |
| `check-docs.js`, `check-swa-limits.js` | Documentation evidence for 1 and 5 |
| `infra/verify-storage-account.ps1`, `infra/lifecycle-policy.template.json` | 5 (real account) |

## 3. Findings

### 3.1 Cyrillic rendering (question 2)

Both `pdfmake` and `pdfkit` were rendered with the same embedded Roboto TTF.

- **Embedding:** both PDFs contain an embedded font program (`/FontFile2`).
- **Text round-trip:** text extracted from each PDF with `pdf.js` matched all seven Bulgarian source strings. These were the patient name, material source, microscopic description, recommendation, the full-alphabet notes line, the signer name, and the marker.
- **Visual check:** the `pdfmake` PDF was opened in Chromium. All glyphs render correctly, including mixed Cyrillic and Latin, tables and wrapping. Evidence: `spikes/O-4/out/pap-pdfmake.png` on the spike branch. The `pdfkit` PDF was verified by embedding and text round-trip only, not by eye.
- **Font:** Roboto covers the whole basic Cyrillic block (U+0410 to U+044F) and "ѝ". It needs no extra download and no `@fontsource` package. Output is about 30 KB per page, which is far below SMTP attachment limits.

### 3.2 ZIP interoperability (question 3)

Both ZIP types were generated with `@zip.js/zip.js` in memory, using the default password format from Story 6 (`DDMMYYYY`).

| Scenario | Tool | Result |
|---|---|---|
| AES-256 ZIP, correct password | 7-Zip (`7za`) | Method reported as `AES-256 Deflate`. The extracted PDF has a **byte-identical SHA-256** to the input. |
| AES-256 ZIP, wrong password | 7-Zip | Fails (exit 2), nothing extracted. |
| AES-256 ZIP structure | Header parse | Compression method 99 (WinZip AES), encrypted flag set. **No ZipCrypto.** |
| Plain ZIP | .NET `Expand-Archive` (Windows' managed zip stack) | OK, identical SHA-256. |
| Plain ZIP | Windows `tar.exe` (bsdtar) | OK, identical SHA-256. |
| Plain ZIP | 7-Zip | OK, identical SHA-256. |
| AES-256 ZIP | Windows built-in (.NET) | **Rejected**: "unsupported compression method". |

The last row confirms the requirement in Story 6 to state in the email that an AES-capable tool is needed. Because the PDF bytes round-trip identically, the embedded signature is not affected by the wrapping.

**Not verified:** WinRAR, and the Windows Explorer shell itself (a GUI check). The .NET and bsdtar results are strong proxies for the plain ZIP, but a manual double-click on Windows 10 and 11 should be done once before release. WinRAR was not tested here and its AES support was not checked in its documentation.

### 3.3 Package size and cold start (question 1)

The sizes below are on-disk sizes, measured including each package's production dependency closure.

| | Packages | Files | Size |
|---|---|---|---|
| `pdfmake` (includes `pdfkit`, `fontkit`, Roboto) | 17 | 429 | 21.8 MB |
| `pdfkit` alone | 13 | 299 | 10.1 MB |
| `@zip.js/zip.js` | 1 | 114 | 8.3 MB |

Effect on the real API, measured with `npm ci --omit=dev` from the existing `api/package-lock.json` and then adding `pdfmake` and `@zip.js/zip.js`:

| | Files | Size |
|---|---|---|
| Existing production `node_modules` | 9,311 | **51.8 MB** |
| With `pdfmake` + `@zip.js/zip.js` | 9,854 | **82.0 MB** (about +30 MB, +543 files) |

Cold-start cost was measured as the median of 5 fresh Node processes. It is a developer-workstation figure, so SWA's shared infrastructure will be slower:

| | `require()` | First call | Second call | Process RSS |
|---|---|---|---|---|
| `pdfmake` | about 115 ms | about 100 ms | about 60 ms | about 97 MB |
| `pdfkit` | about 85 ms | about 85 ms | about 51 ms | about 88 MB |
| `zip.js` AES-256 | about 15 ms | about 55 ms | about 4 ms | about 63 MB |
| Node baseline | n/a | n/a | n/a | 48 MB |

SWA's actual speed was not measured. Even if it were 5 to 10 times slower than this workstation (an assumption), the PDF and ZIP parts would add well under 3 s. That leaves room in the Story 11 sign target (render, QES, upload, table update). The QES and storage legs still need to be measured.

**Platform limits found in the documentation:**

- Maximum duration of an API request is **45 seconds** (SWA API overview).
- Storage quota per environment on the Free plan is **250 MB**, and the request size limit is 30 MB.
- **A specific "API app size" limit for managed functions was not found** in the pages retrieved. The 250 MB per-environment figure is the closest documented bound, and the frontend build is about 4 MB. The +30 MB sits inside that bound, but this is **not confirmed**.
- The managed-functions documentation still lists Node 20 as the newest runtime. It was last updated in 2024. The project already deploys with Node 22 (see the deployment guide), so this is a documentation lag, but it is a small risk to keep in mind.

### 3.4 Storage account and lifecycle (question 5)

Application side, verified against Azurite 3.38 with `@azure/storage-blob` 12.34:

- Upload with tag `state=pending` works.
- Switching to `state=committed` with `setTags` works.
- `findBlobsByTags("state"='committed' …)` finds the blob.
- Download is byte-identical.
- Reading a missing blob throws an error with HTTP **404**, which maps to the planned 410 handling.
- `deleteIfExists()` on a missing blob returns `succeeded: false` without throwing, which makes the idempotent deletes in Story 12 trivial.

Platform side, from Microsoft Learn (not verified on an actual account):

- Lifecycle policies support block blobs in **general-purpose v2** accounts.
- `blobIndexMatch` is a supported lifecycle filter, so the `state=pending` orphan rule is feasible.
- Index tags are **not integrated with lifecycle management on hierarchical-namespace (HNS) accounts**, so HNS must be off.
- A new or edited policy can take **up to 24 hours** to take effect, and the policy runs periodically. This matches the "about once a day" known limit in Story 12.
- Blob soft delete and versioning are separate features that keep deleted data for their own retention period. They must be off, or set to a period shorter than the retention you are willing to exceed.

Lifecycle execution itself cannot be tested locally because Azurite does not run lifecycle policies. The delivered artefacts are:

- [`infra/pap-pdf-storage/lifecycle-policy.template.json`](../infra/pap-pdf-storage/lifecycle-policy.template.json), which has two rules: retention (`daysAfterCreationGreaterThan: __RETENTION_DAYS__`) and orphan cleanup (`state=pending`, 1 day). The retention number is a single placeholder, so it can be fed from the same parameter as `PAP_PDF_RETENTION_DAYS`.
- [`infra/pap-pdf-storage/verify-storage-account.ps1`](../infra/pap-pdf-storage/verify-storage-account.ps1), a read-only check (unless `-Apply` is passed) of account kind, HNS, blob and container soft delete, versioning, public access and TLS. It parses without errors but **has not been run against a real account**.

## 4. Technical decisions

1. **`pdfmake` over `pdfkit`.** Both pass the Cyrillic check, and `pdfmake` is built on `pdfkit`. The PAP report is a table-heavy document with long wrapped free text and possible page breaks. `pdfmake` gives that declaratively. With `pdfkit` the project would have to write its own layout and pagination. The cost is about 12 MB more than `pdfkit` and about 15 ms more per cold start. `pdfkit` stays a valid fallback if the SWA size limit turns out to be tight, since it renders the same fonts.
2. **`@zip.js/zip.js` for both ZIP modes.** It is the only candidate that creates real WinZip AES-256 without ZipCrypto. A single library covers both the encrypted and the plain case. It works from CommonJS, which matches the backend's `tsconfig` (`"module": "commonjs"`). Workers must be disabled with `zip.configure({ useWebWorkers: false })`, and AES-256 is `encryptionStrength: 3`.
3. **Bundled Roboto, no additional font package.** It avoids another dependency. It is also guaranteed to match what was tested.
4. **No production code changed.** The spike is in an isolated `spikes/O-4` folder with its own lock file. `api/package.json` is untouched. Adoption (adding the two dependencies to the API) is left to Story 9, as the stories require a lock-file update and a scan at that time.

## 5. Challenges and how they were resolved

- **First install landed in the repo root.** `spikes/O-4` did not exist yet when `npm install` ran, so `package.json`, a lock file and `node_modules` appeared at the root. They were removed and the install repeated in the correct folder. `git status` confirms nothing is left at the root.
- **No 7-Zip or WinRAR installed.** The `7zip-bin` dev dependency provides a genuine `7za` binary, so the AES check used real 7-Zip. WinRAR remains untested.
- **No Azure login.** Check 5 could not be done on the real account. The verification script and the documentation evidence are the substitute.
- **`npm audit` is not clean for the existing API.** The audit of the production dependencies in `api/package-lock.json` reports 4 findings (3 high):
  - `joi <= 17.13.8` (prototype pollution, ReDoS, and others)
  - `@azure/msal-node` / `@azure/identity` (authorization-code parameter disclosure)
  - `fast-xml-parser <= 5.11.2` (CPU consumption)

  I confirmed these **exist without the new packages**. The new packages add **0**. They are outside the O-4 scope, but they violate the project's security rule for dependencies, and `npm audit fix` is offered for all of them.
- **Dev-only noise in the spike folder.** `azurite` (a dev dependency used only to test blob tags locally) has 7 moderate findings in its own tree. `npm audit --omit=dev` is clean. Azurite is not shipped.
- **pdfmake warns about URL and local file access policies** when it runs. In production, set `setUrlAccessPolicy` and `setLocalAccessPolicy` to deny everything. The report renders only local fonts.

## 6. Recommendations and next steps

1. **Adopt** `pdfmake@^0.3.15` and `@zip.js/zip.js@^2.25.0` in `api/` as part of Story 9. Update the lock file, re-run `npm audit` and call `pdfmake.setUrlAccessPolicy(() => false)` before use.
2. **Fix the existing API audit findings first** (`npm audit fix` for `joi`, `@azure/identity` and `fast-xml-parser`), so the new feature starts from a clean baseline.
3. **Confirm the SWA API size limit** with a real preview deployment (the repository already has a `deploy-preview.yml` workflow) that includes the two new dependencies. If it is too tight, check whether `@zip.js/zip.js` (about 8 MB on disk) can be trimmed, or switch to `pdfkit` (about 12 MB smaller).
4. **Run `verify-storage-account.ps1`** against the real account (read-only), then with `-Apply`. Record the result in the deployment runbook. Wire `-RetentionDays` and `PAP_PDF_RETENTION_DAYS` to one pipeline variable.
5. **Manually confirm** the plain ZIP opens in Windows Explorer (Windows 10 and 11), and that the AES ZIP opens in WinRAR. Both take a minute and close the two remaining gaps in check 3.
6. **Measure the end-to-end sign time** (render + mock QES + blob upload + table write) on a deployed SWA instance. This spike measured only the render and ZIP parts. The < 3 s target still has to be proven with the real QES provider (Story 14).
7. **Keep the spike folder** as a regression harness until Story 9 has its own tests. It can then be removed.

## 7. Deliverables

- `spikes/O-4/` on branch `spike/O-4-technical-spike`: the harness, `package-lock.json`, and the evidence in `out/` (PDFs, JSON results, screenshot). The generated ZIP files are git-ignored and regenerated by `npm run verify`.
- [`infra/pap-pdf-storage/`](../infra/pap-pdf-storage/): the deployment copy of the lifecycle policy and the verification script (see section 8).
- This report.

## 8. Integration into `feature/pap_test`

| Finding / recommendation | Where it was recorded |
|---|---|
| Library decisions, settings and hardening | [`PAP-TEST-USER-STORIES.md`](PAP-TEST-USER-STORIES.md), Story 9, criterion 7 |
| Blob naming convention, platform facts, 24 h policy delay, one policy per account | Story 12, criterion 11 and the known limits |
| Measured render and ZIP times | Story 11 |
| ZIP interoperability results | Story 6 |
| Recommendations 2 to 6 | Open items O-12 to O-16 in the user stories, section 6 |
| Lifecycle policy and account verification | [`infra/pap-pdf-storage/`](../infra/pap-pdf-storage/) |
| Storage runbook step, settings, checklist | [`05-deployment-guide.md`](05-deployment-guide.md) |
| Existing audit findings | [`KNOWN-ISSUES.md`](KNOWN-ISSUES.md), KI-014 |

The infra script in `infra/pap-pdf-storage/` was changed after the spike. It now refuses to apply when a prerequisite fails, refuses to replace other lifecycle rules unless `-Force` is given, and no longer contains a stray non-ASCII character. These changes were not tested against a real account either.

