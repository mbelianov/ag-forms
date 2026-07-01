declare const describe: any;
declare const test: any;
declare const expect: any;
declare const beforeEach: any;
declare const afterEach: any;

import { generateMRN, parseMRN, isValidMRN, normalizeNameSegment, getCurrentCounterValue, resetCounter } from '../../utils/mrnGenerator';
import { cleanupTestData, seedCounter } from '../testUtils';

describe('MRN Generator', () => {
    const currentYear = new Date().getFullYear();

    beforeEach(async () => {
        await cleanupTestData();
    });

    afterEach(async () => {
        await cleanupTestData();
    });

    // ──────────────────────────────────────────────────────────────────────────
    // normalizeNameSegment
    // ──────────────────────────────────────────────────────────────────────────

    test('normalizeNameSegment: Latin name', () => {
        expect(normalizeNameSegment('Maria Ivanova')).toBe('maria-ivanova');
    });

    test('normalizeNameSegment: Bulgarian Cyrillic — Мария Иванова', () => {
        // Transliterate: "Mariya Ivanova" → normalize → "mariya-ivanova"
        expect(normalizeNameSegment('Мария Иванова')).toBe('mariya-ivanova');
    });

    test('normalizeNameSegment: Bulgarian Cyrillic — Александър Петров (long, truncated at word boundary)', () => {
        // "Aleksandar Petrov" (17 chars as "aleksandar-petrov" fits ≤ 20)
        expect(normalizeNameSegment('Александър Петров')).toBe('aleksandar-petrov');
    });

    test('normalizeNameSegment: very long name truncated at hyphen boundary', () => {
        // 21 chars: "abcdefghij-klmnopqrst" → truncate at hyphen at index 10 → "abcdefghij"
        const result = normalizeNameSegment('abcdefghij klmnopqrst');
        expect(result.length).toBeLessThanOrEqual(20);
        expect(result).toBe('abcdefghij');
    });

    test('normalizeNameSegment: Щ (sht) transliteration edge case', () => {
        expect(normalizeNameSegment('Щ')).toBe('sht');
    });

    test('normalizeNameSegment: empty / whitespace falls back to "patient"', () => {
        expect(normalizeNameSegment('')).toBe('patient');
        expect(normalizeNameSegment('   ')).toBe('patient');
    });

    test('normalizeNameSegment: strips non-alphanumeric characters', () => {
        expect(normalizeNameSegment('O\'Brien-Smith')).toBe('obrien-smith');
    });

    // ──────────────────────────────────────────────────────────────────────────
    // generateMRN
    // ──────────────────────────────────────────────────────────────────────────

    test('generateMRN: produces correct format with Latin name', async () => {
        await resetCounter(currentYear, 0);
        const mrn = await generateMRN('Test Patient');
        expect(mrn).toMatch(/^MRN-[a-z0-9-]{1,20}-\d{4}-\d{6}$/);
        expect(mrn).toBe(`MRN-test-patient-${currentYear}-000001`);
    });

    test('generateMRN: produces correct format with Bulgarian Cyrillic name', async () => {
        await resetCounter(currentYear, 0);
        const mrn = await generateMRN('Мария Иванова');
        expect(mrn).toBe(`MRN-mariya-ivanova-${currentYear}-000001`);
    });

    test('generateMRN: counter increments per call', async () => {
        await resetCounter(currentYear, 0);
        const mrn1 = await generateMRN('Test Patient');
        const mrn2 = await generateMRN('Test Patient');
        expect(mrn1).toContain('-000001');
        expect(mrn2).toContain('-000002');
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Counter helpers
    // ──────────────────────────────────────────────────────────────────────────

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

    // ──────────────────────────────────────────────────────────────────────────
    // isValidMRN
    // ──────────────────────────────────────────────────────────────────────────

    test('should validate correct MRN format (new format)', () => {
        expect(isValidMRN(`MRN-test-patient-${currentYear}-000001`)).toBe(true);
        expect(isValidMRN(`MRN-mariya-ivanova-${currentYear}-000001`)).toBe(true);
        expect(isValidMRN(`MRN-patient-${currentYear}-000001`)).toBe(true);
    });

    test('should reject old MRN format (no name segment)', () => {
        // Old format: MRN-2026-000001 — the year would parse as nameSegment but fails because
        // a 4-digit number without letters fails the [a-z0-9-]{1,20} match only for the
        // subsequent YYYY portion.  Actually the old format MRN-2026-000001 would match
        // as nameSegment=2026, year part would need another -\d{4}. Verify it does NOT match.
        expect(isValidMRN(`MRN-${currentYear}-000001`)).toBe(false);
    });

    test('should reject invalid MRN format', () => {
        expect(isValidMRN('MRN-24-1')).toBe(false);
        expect(isValidMRN('INVALID')).toBe(false);
        expect(isValidMRN(`MRN-test-ABCDEF-000001`)).toBe(false);
    });

    // ──────────────────────────────────────────────────────────────────────────
    // parseMRN
    // ──────────────────────────────────────────────────────────────────────────

    test('should parse valid MRN (new format)', () => {
        const parsed = parseMRN(`MRN-maria-ivanova-${currentYear}-000123`);

        expect(parsed).toEqual({
            nameSegment: 'maria-ivanova',
            year: currentYear,
            number: 123
        });
    });

    test('should return null for invalid MRN parsing', () => {
        expect(parseMRN('bad-mrn')).toBeNull();
        expect(parseMRN(`MRN-${currentYear}-000001`)).toBeNull(); // old format
    });

});

// Made with Bob
