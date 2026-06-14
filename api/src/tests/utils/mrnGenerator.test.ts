declare const describe: any;
declare const test: any;
declare const expect: any;
declare const beforeEach: any;
declare const afterEach: any;

import { parseMRN, isValidMRN, getCurrentCounterValue, resetCounter } from '../../utils/mrnGenerator';
import { cleanupTestData, seedCounter } from '../testUtils';

describe('MRN Generator', () => {
    const currentYear = new Date().getFullYear();

    beforeEach(async () => {
        await cleanupTestData();
    });

    afterEach(async () => {
        await cleanupTestData();
    });

    test('should expose current counter value', async () => {
        await resetCounter(currentYear, 10);

        const value = await getCurrentCounterValue(currentYear);

        expect(value).toBe(10);
    });

    test('should reset counter to a specific value', async () => {
        await seedCounter(5, currentYear);
        await resetCounter(currentYear, 41);

        const value = await getCurrentCounterValue(currentYear);

        expect(value).toBe(41);
    });

    test('should validate correct MRN format', () => {
        expect(isValidMRN(`MRN-${currentYear}-000001`)).toBe(true);
    });

    test('should reject invalid MRN format', () => {
        expect(isValidMRN('MRN-24-1')).toBe(false);
        expect(isValidMRN('INVALID')).toBe(false);
        expect(isValidMRN(`MRN-${currentYear}-ABCDEF`)).toBe(false);
    });

    test('should parse valid MRN', () => {
        const parsed = parseMRN(`MRN-${currentYear}-000123`);

        expect(parsed).toEqual({
            year: currentYear,
            number: 123
        });
    });

    test('should return null for invalid MRN parsing', () => {
        expect(parseMRN('bad-mrn')).toBeNull();
    });

});

// Made with Bob
