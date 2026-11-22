# PAP signed-PDF storage: lifecycle policy and account verification

Deployment assets for Stories 9 and 12 in [`docs2/PAP-TEST-USER-STORIES.md`](../../docs2/PAP-TEST-USER-STORIES.md).
Findings behind them: [`docs2/O-4-TECHNICAL-SPIKE-REPORT.md`](../../docs2/O-4-TECHNICAL-SPIKE-REPORT.md).

| File | Purpose |
|---|---|
| `lifecycle-policy.template.json` | Two lifecycle rules for blobs under `pap-pdfs/pap/`: delete N days after creation (retention), and delete blobs still tagged `state=pending` after 1 day (orphans). `__RETENTION_DAYS__` is the only parameter. |
| `verify-storage-account.ps1` | Checks the account is suitable (StorageV2, no hierarchical namespace, no blob/container soft delete, no versioning, no public access, TLS 1.2+) and optionally applies the policy. |

## Use

```powershell
az login
# 1. Read-only check (always run first)
./verify-storage-account.ps1 -ResourceGroup <rg> -AccountName <storage-account> -RetentionDays 90
# 2. Apply the policy (only if the check passed)
./verify-storage-account.ps1 -ResourceGroup <rg> -AccountName <storage-account> -RetentionDays 90 -Apply
```

Then set `PAP_PDF_RETENTION_DAYS` in the Static Web App application settings to the **same** number.

## Rules to keep in mind

- **Container `pap-pdfs`, blob names `pap/{examinationId}/{guid}.pdf`.** The template filters on the prefix `pap-pdfs/pap/`. If the application uses another container or prefix, change the template with it.
- **One lifecycle policy per storage account.** `-Apply` replaces the whole policy. The script stops if other rules exist; merge them into the template, or pass `-Force` only when replacing them is intended.
- **Lifecycle runs about once a day.** A new or edited policy can take up to 24 hours to take effect, and deletion can lag the nominal retention end by about a day.
- **Do not enable blob soft delete or versioning** on this account. They would keep deleted PDFs past the retention period. The script fails the check if either is on.
- **The storage account is shared** with Table Storage, so run the check before changing any account-level setting.
- **Not yet run against the real account** at the time of writing (no Azure login was available during the spike).
