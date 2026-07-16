/**
 * Counter Service
 * Provides a shared, non-fatal optimistic-concurrency counter utility
 * for incrementing/decrementing named counters in the Counters table.
 *
 * Used by patient and examination create/delete operations to maintain
 * PATIENT_TOTAL and EXAM_TOTAL counter rows.
 */

import { Counter } from '../types';
import { getEntity, createEntity, updateEntity } from './tableClient';

const MAX_RETRIES = 5;

const sleep = (ms: number): Promise<void> => new Promise<void>(resolve => setTimeout(resolve, ms));

/**
 * Adjust a named counter by `delta` (positive or negative integer).
 *
 * Behaviour:
 * - If the counter row does not exist, creates it with value = Math.max(0, delta).
 * - Decrements are floored at zero (value never goes negative).
 * - Uses optimistic concurrency (ETag) with exponential-backoff retry up to 5 times.
 * - Counter failures are **non-fatal**: after all retries are exhausted the error is
 *   logged and the promise resolves normally — callers do not need try/catch.
 *
 * @param tableName    - Azure Storage table name (e.g. 'Counters')
 * @param partitionKey - Partition key (e.g. 'COUNTER')
 * @param rowKey       - Row key / counter name (e.g. 'PATIENT_TOTAL')
 * @param delta        - Amount to add (use negative value for decrement)
 */
export async function adjustCounter(
  tableName: string,
  partitionKey: string,
  rowKey: string,
  delta: number,
): Promise<void> {
  try {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const entity = await getEntity<Counter>(tableName, partitionKey, rowKey);

        if (!entity) {
          // Counter row does not exist — create it
          const newCounter: Counter = {
            partitionKey,
            rowKey,
            counterType: rowKey,
            value: Math.max(0, delta),
            lastUpdated: new Date().toISOString(),
          };
          try {
            await createEntity(tableName, newCounter);
          } catch (createErr: any) {
            // Race condition: another request created it first — retry to increment
            if (createErr.message && createErr.message.includes('already exists')) {
              continue;
            }
            throw createErr;
          }
          return;
        }

        // Counter exists — compute new value with floor-at-zero
        const newValue = Math.max(0, entity.value + delta);
        const updated: Counter = {
          ...entity,
          value: newValue,
          lastUpdated: new Date().toISOString(),
        };

        await updateEntity(tableName, updated);
        return;

      } catch (err: any) {
        const isConcurrencyConflict =
          (err.message && err.message.includes('Concurrency conflict')) ||
          (err.statusCode === 412);

        if (isConcurrencyConflict && attempt < MAX_RETRIES - 1) {
          await sleep(Math.pow(2, attempt) * 100);
          continue;
        }
        throw err;
      }
    }
  } catch (err) {
    console.error('[counterService] adjustCounter failed after retries:', err);
    // Non-fatal — resolve normally so caller HTTP responses are unaffected
  }
}
