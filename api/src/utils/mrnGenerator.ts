/**
 * MRN Generator
 * Generates Medical Record Numbers in format: MRN-{YYYY}-{NNNNNN}
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
 * Initialize counter table (should be called on application startup)
 */
export const initializeCounterTable = async (): Promise<void> => {
    await ensureTableExists(COUNTER_TABLE);
};

/**
 * Generate a new Medical Record Number (MRN)
 * Format: MRN-{YYYY}-{NNNNNN}
 * 
 * Uses optimistic concurrency with ETag to handle concurrent requests
 * Retries up to MAX_RETRIES times if concurrency conflict occurs
 * 
 * @returns Promise<string> - Generated MRN
 * @throws Error if unable to generate MRN after max retries
 */
export const generateMRN = async (): Promise<string> => {
    const currentYear = new Date().getFullYear();
    const counterRowKey = `MRN_${currentYear}`;

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

            // Format MRN with zero-padded 6-digit number
            const mrn = formatMRN(currentYear, nextNumber);
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
        return counter;
    } catch (error: any) {
        // If entity already exists (race condition), fetch it
        if (error.message.includes('already exists')) {
            const existingCounter = await getEntity<Counter>(
                COUNTER_TABLE,
                COUNTER_PARTITION_KEY,
                counterRowKey
            );
            if (existingCounter) {
                return existingCounter;
            }
        }
        throw error;
    }
};

/**
 * Format MRN with year and zero-padded number
 * @param year - Year
 * @param number - Counter number
 * @returns Formatted MRN string
 */
const formatMRN = (year: number, number: number): string => {
    const paddedNumber = String(number).padStart(6, '0');
    return `MRN-${year}-${paddedNumber}`;
};

/**
 * Parse MRN to extract year and number
 * @param mrn - MRN string to parse
 * @returns Object with year and number, or null if invalid format
 */
export const parseMRN = (mrn: string): { year: number; number: number } | null => {
    const pattern = /^MRN-(\d{4})-(\d{6})$/;
    const match = mrn.match(pattern);

    if (!match) {
        return null;
    }

    return {
        year: parseInt(match[1], 10),
        number: parseInt(match[2], 10)
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
