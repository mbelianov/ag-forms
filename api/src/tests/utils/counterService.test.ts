declare const describe: any;
declare const test: any;
declare const expect: any;
declare const beforeEach: any;
declare const jest: any;

// Mock the tableClient module so these tests run without Azurite
jest.mock('../../utils/tableClient', () => ({
  getEntity: jest.fn(),
  createEntity: jest.fn(),
  updateEntity: jest.fn(),
}));

import { adjustCounter } from '../../utils/counterService';
import { getEntity, createEntity, updateEntity } from '../../utils/tableClient';

const TABLE = 'Counters';
const PK = 'COUNTER';
const RK = 'TEST_COUNTER';

function makeCounter(value: number, etag = '"test-etag"') {
  return { partitionKey: PK, rowKey: RK, counterType: RK, value, lastUpdated: '', etag };
}

describe('counterService.adjustCounter', () => {
  beforeEach(() => {
    (getEntity as any).mockReset();
    (createEntity as any).mockReset();
    (updateEntity as any).mockReset();
  });

  test('first call auto-creates counter with value 1 when delta=1', async () => {
    (getEntity as any).mockResolvedValue(null);
    (createEntity as any).mockResolvedValue(undefined);

    await adjustCounter(TABLE, PK, RK, 1);

    expect(createEntity).toHaveBeenCalledWith(TABLE, expect.objectContaining({
      partitionKey: PK,
      rowKey: RK,
      value: 1,
    }));
  });

  test('subsequent increment updates counter value', async () => {
    (getEntity as any).mockResolvedValue(makeCounter(5));
    (updateEntity as any).mockResolvedValue(undefined);

    await adjustCounter(TABLE, PK, RK, 1);

    expect(updateEntity).toHaveBeenCalledWith(TABLE, expect.objectContaining({ value: 6 }));
  });

  test('decrement decreases counter value', async () => {
    (getEntity as any).mockResolvedValue(makeCounter(10));
    (updateEntity as any).mockResolvedValue(undefined);

    await adjustCounter(TABLE, PK, RK, -1);

    expect(updateEntity).toHaveBeenCalledWith(TABLE, expect.objectContaining({ value: 9 }));
  });

  test('decrement at zero stays at zero (floor-at-zero)', async () => {
    (getEntity as any).mockResolvedValue(makeCounter(0));
    (updateEntity as any).mockResolvedValue(undefined);

    await adjustCounter(TABLE, PK, RK, -1);

    expect(updateEntity).toHaveBeenCalledWith(TABLE, expect.objectContaining({ value: 0 }));
  });

  test('412 conflict on first attempt retries and succeeds on second', async () => {
    const conflictErr = new Error('Concurrency conflict');
    (getEntity as any)
      .mockResolvedValueOnce(makeCounter(3))  // first attempt read
      .mockResolvedValueOnce(makeCounter(3)); // retry read
    (updateEntity as any)
      .mockRejectedValueOnce(conflictErr)     // first attempt — conflict
      .mockResolvedValueOnce(undefined);      // retry — success

    await adjustCounter(TABLE, PK, RK, 1);

    expect(updateEntity).toHaveBeenCalledTimes(2);
    expect(updateEntity).toHaveBeenLastCalledWith(TABLE, expect.objectContaining({ value: 4 }));
  });

  test('all retries fail — resolves without throwing (non-fatal)', async () => {
    const conflictErr = new Error('Concurrency conflict');
    (getEntity as any).mockResolvedValue(makeCounter(1));
    (updateEntity as any).mockRejectedValue(conflictErr);

    const mockContext = { error: jest.fn() };

    // Should resolve without throwing even after all retries fail
    await expect(adjustCounter(TABLE, PK, RK, 1, mockContext)).resolves.toBeUndefined();

    // The non-fatal error path must log via context.error, not console.error
    expect(mockContext.error).toHaveBeenCalledWith('[counterService] adjustCounter failed:', conflictErr);
  });
});
