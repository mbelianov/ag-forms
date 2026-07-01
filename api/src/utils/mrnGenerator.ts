/**
 * MRN Generator
 * Generates Medical Record Numbers in format: MRN-{nameSegment}-{YYYY}-{NNNNNN}
 * Uses optimistic concurrency with counter entity in Azure Table Storage
 */

import { Counter } from '../types';
import { getEntity, updateEntity, createEntity, ensureTableExists } from './tableClient';

// Table name for counters
const COUNTER_TABLE = 'Counters';

// Partition key for all counters
const COUNTER_PARTITION_KEY = 'COUNTER';

// Maximum retry attempts for optimistic concurrency
const MAX_RETRIES = 5;

/**
 * Bulgarian Cyrillic → Latin transliteration map (BGN/PCGN 2013 simplified).
 * Ordered longest-match first (multi-char Cyrillic like Щ before single chars).
 */
const CYRILLIC_MAP: [string, string][] = [
    // Multi-char outputs — must appear first so longest match wins
    ['Щ', 'sht'], ['щ', 'sht'],
    ['Ж', 'zh'],  ['ж', 'zh'],
    ['Ц', 'ts'],  ['ц', 'ts'],
    ['Ч', 'ch'],  ['ч', 'ch'],
    ['Ш', 'sh'],  ['ш', 'sh'],
    ['Ю', 'yu'],  ['ю', 'yu'],
    ['Я', 'ya'],  ['я', 'ya'],
    // Single-char outputs
    ['А', 'a'], ['а', 'a'],
    ['Б', 'b'], ['б', 'b'],
    ['В', 'v'], ['в', 'v'],
    ['Г', 'g'], ['г', 'g'],
    ['Д', 'd'], ['д', 'd'],
    ['Е', 'e'], ['е', 'e'],
    ['З', 'z'], ['з', 'z'],
    ['И', 'i'], ['и', 'i'],
    ['Й', 'y'], ['й', 'y'],
    ['К', 'k'], ['к', 'k'],
    ['Л', 'l'], ['л', 'l'],
    ['М', 'm'], ['м', 'm'],
    ['Н', 'n'], ['н', 'n'],
    ['О', 'o'], ['о', 'o'],
    ['П', 'p'], ['п', 'p'],
    ['Р', 'r'], ['р', 'r'],
    ['С', 's'], ['с', 's'],
    ['Т', 't'], ['т', 't'],
    ['У', 'u'], ['у', 'u'],
    ['Ф', 'f'], ['ф', 'f'],
    ['Х', 'h'], ['х', 'h'],
    ['Ъ', 'a'], ['ъ', 'a'],
    ['Ь', ''],  ['ь', ''],  // dropped
];

/**
 * Transliterate Cyrillic characters in a string to their Latin equivalents
 * using the Bulgarian standard mapping. Longest-match rule is applied.
 */
const transliterateCyrillic = (text: string): string => {
    let result = '';
    let i = 0;
    while (i < text.length) {
        let matched = false;
        for (const [cyrillic, latin] of CYRILLIC_MAP) {
            if (text.startsWith(cyrillic, i)) {
                result += latin;
                i += cyrillic.length;
                matched = true;
                break;
            }
        }
        if (!matched) {
            result += text[i];
            i++;
        }
    }
    return result;
};

/**
 * Normalize a patient name to a URL-safe, lowercase, hyphenated segment
 * suitable for embedding in an MRN. Maximum 20 characters.
 *
 * Steps (per section 3.3 of the migration plan):
 * 1. Trim
 * 2. Transliterate Cyrillic → Latin
 * 3. Lowercase
 * 4. Replace whitespace sequences with a single hyphen
 * 5. Strip characters that are not alphanumeric ASCII or hyphens
 * 6. Collapse multiple consecutive hyphens
 * 7. Truncate to 20 chars at a hyphen boundary where possible
 * 8. Fallback to 'patient' if result is empty
 */
export const normalizeNameSegment = (name: string): string => {
    // 1. Trim
    let s = name.trim();

    // 2. Transliterate Cyrillic → Latin
    s = transliterateCyrillic(s);

    // 3. Lowercase
    s = s.toLowerCase();

    // 4. Replace whitespace sequences with a single hyphen
    s = s.replace(/\s+/g, '-');

    // 5. Strip characters that are not a-z, 0-9, or hyphens
    s = s.replace(/[^a-z0-9-]/g, '');

    // 6. Collapse multiple consecutive hyphens
    s = s.replace(/-{2,}/g, '-');

    // 7. Truncate to 20 chars, preferring a hyphen boundary
    if (s.length > 20) {
        // Try to find the last hyphen at or before position 20
        const cutAt = s.lastIndexOf('-', 19);
        if (cutAt > 0) {
            s = s.substring(0, cutAt);
        } else {
            s = s.substring(0, 20);
        }
    }

    // Strip any trailing hyphens left by truncation
    s = s.replace(/-+$/, '');

    // 8. Fallback
    if (!s) {
        s = 'patient';
    }

    return s;
};

/**
 * Initialize counter table (should be called on application startup)
 */
export const initializeCounterTable = async (): Promise<void> => {
    await ensureTableExists(COUNTER_TABLE);
};

/**
 * Generate a new Medical Record Number (MRN)
 * Format: MRN-{nameSegment}-{YYYY}-{NNNNNN}
 *
 * Uses optimistic concurrency with ETag to handle concurrent requests.
 * Retries up to MAX_RETRIES times if concurrency conflict occurs.
 *
 * @param patientName - Patient name used to derive the name segment
 * @returns Promise<string> - Generated MRN
 * @throws Error if unable to generate MRN after max retries
 */
export const generateMRN = async (patientName: string): Promise<string> => {
    const currentYear = new Date().getFullYear();
    const counterRowKey = `MRN_${currentYear}`;
    const nameSegment = normalizeNameSegment(patientName);

    // Ensure table exists
    await ensureTableExists(COUNTER_TABLE);

    // Retry loop for optimistic concurrency
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            // Get or create counter entity
            let counter = await getEntity<Counter>(
                COUNTER_TABLE,
                COUNTER_PARTITION_KEY,
                counterRowKey
            );

            if (!counter) {
                // Counter doesn't exist for this year, create it
                counter = await initializeCounter(currentYear);
            }

            // Increment counter value
            const nextNumber = counter.value + 1;
            const updatedCounter: Counter = {
                ...counter,
                value: nextNumber,
                lastUpdated: new Date().toISOString()
            };

            // Update with optimistic concurrency (ETag check)
            await updateEntity(COUNTER_TABLE, updatedCounter);

            // Format MRN with name segment and zero-padded 6-digit number
            const mrn = formatMRN(currentYear, nextNumber, nameSegment);
            return mrn;

        } catch (error: any) {
            // Check if it's a concurrency conflict
            if (error.message.includes('Concurrency conflict')) {
                // Retry on concurrency conflict
                if (attempt < MAX_RETRIES - 1) {
                    // Wait a bit before retrying (exponential backoff)
                    await sleep(Math.pow(2, attempt) * 100);
                    continue;
                }
            }

            // Re-throw other errors or if max retries exceeded
            throw new Error(`Failed to generate MRN after ${MAX_RETRIES} attempts: ${error.message}`);
        }
    }

    throw new Error(`Failed to generate MRN: Maximum retry attempts (${MAX_RETRIES}) exceeded`);
};

/**
 * Initialize a new counter for the current year
 * @param year - Year for the counter
 * @returns Promise<Counter> - Created counter entity
 */
const initializeCounter = async (year: number): Promise<Counter> => {
    const counterRowKey = `MRN_${year}`;
    
    const counter: Counter = {
        partitionKey: COUNTER_PARTITION_KEY,
        rowKey: counterRowKey,
        counterType: counterRowKey,
        value: 0,
        lastUpdated: new Date().toISOString()
    };

    try {
        await createEntity(COUNTER_TABLE, counter);
    } catch (error: any) {
        // Ignore "already exists" — fall through to the fetch below
        if (!error.message.includes('already exists')) {
            throw error;
        }
    }

    // Always fetch after create so the returned entity has an ETag for updateEntity
    const fetched = await getEntity<Counter>(COUNTER_TABLE, COUNTER_PARTITION_KEY, counterRowKey);
    if (fetched) {
        return fetched;
    }
    throw new Error(`Failed to initialize MRN counter for year ${year}`);
};

/**
 * Format MRN with year, counter number, and name segment
 * @param year - Year
 * @param number - Counter number
 * @param nameSegment - Normalized patient name segment
 * @returns Formatted MRN string: MRN-{nameSegment}-{YYYY}-{NNNNNN}
 */
const formatMRN = (year: number, number: number, nameSegment: string): string => {
    const paddedNumber = String(number).padStart(6, '0');
    return `MRN-${nameSegment}-${year}-${paddedNumber}`;
};

/**
 * Parse MRN to extract name segment, year, and number
 * @param mrn - MRN string to parse
 * @returns Object with nameSegment, year, and number, or null if invalid format
 */
export const parseMRN = (mrn: string): { nameSegment: string; year: number; number: number } | null => {
    const pattern = /^MRN-([a-z0-9-]{1,20})-(\d{4})-(\d{6})$/;
    const match = mrn.match(pattern);

    if (!match) {
        return null;
    }

    return {
        nameSegment: match[1],
        year: parseInt(match[2], 10),
        number: parseInt(match[3], 10)
    };
};

/**
 * Validate MRN format
 * @param mrn - MRN string to validate
 * @returns boolean - True if valid format, false otherwise
 */
export const isValidMRN = (mrn: string): boolean => {
    return parseMRN(mrn) !== null;
};

/**
 * Get current counter value for a specific year (for debugging/admin purposes)
 * @param year - Year to get counter for (defaults to current year)
 * @returns Promise<number> - Current counter value, or 0 if not initialized
 */
export const getCurrentCounterValue = async (year?: number): Promise<number> => {
    const targetYear = year || new Date().getFullYear();
    const counterRowKey = `MRN_${targetYear}`;

    const counter = await getEntity<Counter>(
        COUNTER_TABLE,
        COUNTER_PARTITION_KEY,
        counterRowKey
    );

    return counter ? counter.value : 0;
};

/**
 * Reset counter for a specific year (ADMIN ONLY - use with caution)
 * This should only be used in development or for data migration
 *
 * @param year - Year to reset counter for
 * @param value - Value to reset to (default: 0)
 * @returns Promise<void>
 */
export const resetCounter = async (year: number, value: number = 0): Promise<void> => {
    const counterRowKey = `MRN_${year}`;

    const counter = await getEntity<Counter>(
        COUNTER_TABLE,
        COUNTER_PARTITION_KEY,
        counterRowKey
    );

    if (counter) {
        const updatedCounter: Counter = {
            ...counter,
            value,
            lastUpdated: new Date().toISOString()
        };
        await updateEntity(COUNTER_TABLE, updatedCounter);
    } else {
        // Create new counter with specified value
        const newCounter: Counter = {
            partitionKey: COUNTER_PARTITION_KEY,
            rowKey: counterRowKey,
            counterType: counterRowKey,
            value,
            lastUpdated: new Date().toISOString()
        };
        await createEntity(COUNTER_TABLE, newCounter);
    }
};

/**
 * Sleep utility for retry backoff
 * @param ms - Milliseconds to sleep
 */
const sleep = (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

// Made with Bob
