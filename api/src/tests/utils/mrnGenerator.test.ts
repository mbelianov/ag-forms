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
    ensureTableExists: jest.fn().mockResolvedValue(undefined),
    getTableClient: jest.fn(),
}));

import {
    generateMRN,
    parseMRN,
    isValidMRN,
    normalizeNameSegment,
    getCurrentCounterValue,
    resetCounter,
} from '../../utils/mrnGenerator';
import { getEntity, createEntity, updateEntity } from '../../utils/tableClient';

const currentYear = new Date().getFullYear();

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeCounter(value: number, etag = '"test-etag"') {
    return {
        partitionKey: 'COUNTER',
        rowKey: `MRN_${currentYear}`,
        counterType: `MRN_${currentYear}`,
        value,
        lastUpdated: new Date().toISOString(),
        etag,
    };
}

// ─── normalizeNameSegment ─────────────────────────────────────────────────────

describe('MRN Generator › normalizeNameSegment', () => {
    test('Latin name', () => {
        expect(normalizeNameSegment('Maria Ivanova')).toBe('maria-ivanova');
    });

    test('Bulgarian Cyrillic — Мария Иванова', () => {
        expect(normalizeNameSegment('Мария Иванова')).toBe('mariya-ivanova');
    });

    test('Bulgarian Cyrillic — Александър Петров (long, truncated at word boundary)', () => {
        expect(normalizeNameSegment('Александър Петров')).toBe('aleksandar-petrov');
    });

    test('very long name truncated at hyphen boundary', () => {
        // "abcdefghij klmnopqrst" → "abcdefghij-klmnopqrst" (21 chars) → cut at hyphen[10] → "abcdefghij"
        const result = normalizeNameSegment('abcdefghij klmnopqrst');
        expect(result.length).toBeLessThanOrEqual(20);
        expect(result).toBe('abcdefghij');
    });

    test('Щ (sht) transliteration edge case', () => {
        expect(normalizeNameSegment('Щ')).toBe('sht');
    });

    test('empty / whitespace falls back to "patient"', () => {
        expect(normalizeNameSegment('')).toBe('patient');
        expect(normalizeNameSegment('   ')).toBe('patient');
    });

    test('strips non-alphanumeric characters', () => {
        expect(normalizeNameSegment("O'Brien-Smith")).toBe('obrien-smith');
    });
});

// ─── generateMRN ─────────────────────────────────────────────────────────────

describe('MRN Generator › generateMRN', () => {
    beforeEach(() => {
        (getEntity as any).mockReset();
        (createEntity as any).mockReset();
        (updateEntity as any).mockReset();
    });

    test('produces correct format with Latin name', async () => {
        (getEntity as any).mockResolvedValue(makeCounter(0));
        (updateEntity as any).mockResolvedValue(undefined);

        const mrn = await generateMRN('Test Patient');

        expect(mrn).toMatch(/^MRN-[a-z0-9-]{1,20}-\d{4}-\d{6}$/);
        expect(mrn).toBe(`MRN-test-patient-${currentYear}-000001`);
    });

    test('produces correct format with Bulgarian Cyrillic name', async () => {
        (getEntity as any).mockResolvedValue(makeCounter(0));
        (updateEntity as any).mockResolvedValue(undefined);

        const mrn = await generateMRN('Мария Иванова');

        expect(mrn).toBe(`MRN-mariya-ivanova-${currentYear}-000001`);
    });

    test('counter increments per call', async () => {
        (getEntity as any)
            .mockResolvedValueOnce(makeCounter(0))
            .mockResolvedValueOnce(makeCounter(1));
        (updateEntity as any).mockResolvedValue(undefined);

        const mrn1 = await generateMRN('Test Patient');
        const mrn2 = await generateMRN('Test Patient');

        expect(mrn1).toContain('-000001');
        expect(mrn2).toContain('-000002');
    });

    test('auto-creates counter when not found, then generates MRN', async () => {
        // First getEntity (in generateMRN) returns null → triggers initializeCounter
        // createEntity called, then getEntity (in initializeCounter) returns the new counter
        (getEntity as any)
            .mockResolvedValueOnce(null)             // generateMRN: counter not found
            .mockResolvedValueOnce(makeCounter(0));  // initializeCounter: fetch after create
        (createEntity as any).mockResolvedValue(undefined);
        (updateEntity as any).mockResolvedValue(undefined);

        const mrn = await generateMRN('New Patient');

        expect(mrn).toMatch(/^MRN-new-patient-\d{4}-000001$/);
        expect(createEntity).toHaveBeenCalledTimes(1);
    });

    test('retries on concurrency conflict and succeeds', async () => {
        const conflictErr = new Error('Concurrency conflict');
        (getEntity as any)
            .mockResolvedValueOnce(makeCounter(0))  // first attempt
            .mockResolvedValueOnce(makeCounter(0)); // retry
        (updateEntity as any)
            .mockRejectedValueOnce(conflictErr)
            .mockResolvedValueOnce(undefined);

        const mrn = await generateMRN('Test Patient');

        expect(mrn).toContain('-000001');
        expect(updateEntity).toHaveBeenCalledTimes(2);
    });
});

// ─── getCurrentCounterValue ───────────────────────────────────────────────────

describe('MRN Generator › getCurrentCounterValue', () => {
    beforeEach(() => {
        (getEntity as any).mockReset();
    });

    test('returns counter value when counter exists', async () => {
        (getEntity as any).mockResolvedValue(makeCounter(10));

        const value = await getCurrentCounterValue(currentYear);

        expect(value).toBe(10);
    });

    test('returns 0 when counter does not exist', async () => {
        (getEntity as any).mockResolvedValue(null);

        const value = await getCurrentCounterValue(currentYear);

        expect(value).toBe(0);
    });
});

// ─── resetCounter ─────────────────────────────────────────────────────────────

describe('MRN Generator › resetCounter', () => {
    beforeEach(() => {
        (getEntity as any).mockReset();
        (createEntity as any).mockReset();
        (updateEntity as any).mockReset();
    });

    test('updates existing counter to specified value', async () => {
        (getEntity as any).mockResolvedValue(makeCounter(5));
        (updateEntity as any).mockResolvedValue(undefined);

        await resetCounter(currentYear, 41);

        expect(updateEntity).toHaveBeenCalledWith(
            'Counters',
            expect.objectContaining({ value: 41 })
        );
    });

    test('creates new counter when none exists', async () => {
        (getEntity as any).mockResolvedValue(null);
        (createEntity as any).mockResolvedValue(undefined);

        await resetCounter(currentYear, 0);

        expect(createEntity).toHaveBeenCalledWith(
            'Counters',
            expect.objectContaining({ value: 0 })
        );
    });
});

// ─── isValidMRN ───────────────────────────────────────────────────────────────

describe('MRN Generator › isValidMRN', () => {
    test('validates correct MRN format (new format)', () => {
        expect(isValidMRN(`MRN-test-patient-${currentYear}-000001`)).toBe(true);
        expect(isValidMRN(`MRN-mariya-ivanova-${currentYear}-000001`)).toBe(true);
        expect(isValidMRN(`MRN-patient-${currentYear}-000001`)).toBe(true);
    });

    test('rejects old MRN format (no name segment)', () => {
        expect(isValidMRN(`MRN-${currentYear}-000001`)).toBe(false);
    });

    test('rejects invalid MRN format', () => {
        expect(isValidMRN('MRN-24-1')).toBe(false);
        expect(isValidMRN('INVALID')).toBe(false);
        expect(isValidMRN('MRN-test-ABCDEF-000001')).toBe(false);
    });
});

// ─── parseMRN ─────────────────────────────────────────────────────────────────

describe('MRN Generator › parseMRN', () => {
    test('parses valid MRN (new format)', () => {
        const parsed = parseMRN(`MRN-maria-ivanova-${currentYear}-000123`);

        expect(parsed).toEqual({
            nameSegment: 'maria-ivanova',
            year: currentYear,
            number: 123,
        });
    });

    test('returns null for invalid MRN', () => {
        expect(parseMRN('bad-mrn')).toBeNull();
        expect(parseMRN(`MRN-${currentYear}-000001`)).toBeNull(); // old format
    });
});

// Made with Bob
