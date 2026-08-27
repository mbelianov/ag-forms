declare const describe: any;
declare const test: any;
declare const expect: any;

import { normalizePatientName, getSearchPartitionKey } from '../../utils/patientUtils';

describe('patientUtils', () => {
    describe('normalizePatientName', () => {
        test('normalizes Latin names with trimming and lowercase', () => {
            expect(normalizePatientName('  Maria Petrova  ')).toBe('maria petrova');
        });

        test('collapses multiple internal spaces', () => {
            expect(normalizePatientName('Maria    Petrova')).toBe('maria petrova');
        });

        test('preserves already-lowercase names', () => {
            expect(normalizePatientName('maria petrova')).toBe('maria petrova');
        });

        test('normalizes mixed-case Cyrillic names', () => {
            expect(normalizePatientName('  МаРиЯ   ПЕТРОВА ')).toBe('мария петрова');
        });
    });

    describe('getSearchPartitionKey', () => {
        test('returns Latin bucket for a', () => {
            expect(getSearchPartitionKey('alice')).toBe('PATIENT_SEARCH_0061');
        });

        test('returns Cyrillic bucket for и', () => {
            expect(getSearchPartitionKey('иван')).toBe('PATIENT_SEARCH_0438');
        });

        test('returns numeric bucket for 1', () => {
            expect(getSearchPartitionKey('1patient')).toBe('PATIENT_SEARCH_0031');
        });

        test('returns unknown bucket for empty string', () => {
            expect(getSearchPartitionKey('')).toBe('PATIENT_SEARCH_unknown');
        });

        test('matches the partition-key format used by test data helpers', () => {
            const normalizedLatin = normalizePatientName(' Test Patient 123 ');
            const normalizedCyrillic = normalizePatientName(' Иван Петров ');

            expect(getSearchPartitionKey(normalizedLatin)).toMatch(/^PATIENT_SEARCH_[0-9a-f]{4}$/);
            expect(getSearchPartitionKey(normalizedLatin)).toBe('PATIENT_SEARCH_0074');
            expect(getSearchPartitionKey(normalizedCyrillic)).toBe('PATIENT_SEARCH_0438');
        });
    });
});

// Made with Bob
