/**
 * One-time backfill script: add `patientNameLower` to all EXAM partition rows
 * that pre-date the CreateExamination.ts change that introduced the field.
 *
 * Run once after deploying the updated CreateExamination.ts:
 *   npx ts-node -e "require('./api/scripts/backfill-patient-name-lower')"
 *
 * Or compile and run:
 *   npx tsc api/scripts/backfill-patient-name-lower.ts --outDir dist/scripts --esModuleInterop
 *   node dist/scripts/backfill-patient-name-lower.js
 *
 * Prerequisites: Azurite or Azure Storage must be reachable via the same
 * connection string used by the functions (AZURE_STORAGE_CONNECTION_STRING env var).
 */

import { TableClient } from '@azure/data-tables';

const CONNECTION_STRING =
  process.env.AZURE_STORAGE_CONNECTION_STRING ||
  'UseDevelopmentStorage=true';

const EXAMINATIONS_TABLE = 'Examinations';

async function backfill() {
  const tableClient = TableClient.fromConnectionString(
    CONNECTION_STRING,
    EXAMINATIONS_TABLE
  );

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  // Iterate all EXAM partition rows
  const iter = tableClient.listEntities<any>({
    queryOptions: { filter: `PartitionKey eq 'EXAM'` },
  });

  for await (const entity of iter) {
    const patientName: string | undefined = entity.patientName;

    // Skip rows that already have a non-empty patientNameLower
    if (entity.patientNameLower && entity.patientNameLower.trim() !== '') {
      skipped++;
      continue;
    }

    if (!patientName) {
      console.warn(
        `Row ${entity.partitionKey}/${entity.rowKey} has no patientName — skipping.`
      );
      skipped++;
      continue;
    }

    try {
      await tableClient.updateEntity(
        {
          partitionKey: entity.partitionKey,
          rowKey: entity.rowKey,
          patientNameLower: patientName.toLowerCase(),
        },
        'Merge',
        { etag: '*' }
      );
      updated++;

      if (updated % 100 === 0) {
        console.log(`Progress: ${updated} rows updated…`);
      }
    } catch (err) {
      console.error(
        `Failed to update ${entity.partitionKey}/${entity.rowKey}:`,
        err
      );
      errors++;
    }
  }

  console.log(
    `Backfill complete. Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`
  );
}

backfill().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
