/**
 * Query the Patients Azure Table via Azurite and dump all entities as JSON.
 * Run: node scripts/query-patients-table.js
 */

const { TableClient } = require('@azure/data-tables');

const CONNECTION_STRING = 'UseDevelopmentStorage=true';
const TABLE_NAME = 'Patients';

async function main() {
    const client = TableClient.fromConnectionString(CONNECTION_STRING, TABLE_NAME);

    const results = {};

    for await (const entity of client.listEntities()) {
        const pk = entity.partitionKey;
        if (!results[pk]) results[pk] = [];
        results[pk].push(entity);
    }

    // Print each partition separately for clarity
    for (const [pk, entities] of Object.entries(results)) {
        console.log(`\n=== Partition: ${pk} (${entities.length} rows) ===`);
        for (const e of entities) {
            // Mask nothing — this is local dev data
            console.log(JSON.stringify(e, null, 2));
        }
    }

    const totalRows = Object.values(results).flat().length;
    const partitions = Object.keys(results);
    console.log(`\n=== SUMMARY ===`);
    console.log(`Total rows: ${totalRows}`);
    console.log(`Partitions found: ${JSON.stringify(partitions)}`);
}

main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
