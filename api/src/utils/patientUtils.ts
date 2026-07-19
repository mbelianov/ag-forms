/**
 * Patient utility functions shared across CreatePatient, UpdatePatient, and SearchPatients.
 * Single source of truth — do not copy-paste these into individual function files.
 */

/**
 * Normalize a patient name for search indexing:
 * trims whitespace, lowercases, collapses internal spaces.
 */
export const normalizePatientName = (name: string): string => {
    return name.trim().toLowerCase().replace(/\s+/g, ' ');
};

/**
 * Derive the Azure Table Storage partition key for a patient search entity.
 *
 * Uses the Unicode code-point hex (4 digits) of the first character so the
 * key remains pure ASCII regardless of script (Latin, Cyrillic, etc.).
 * e.g. "a" → "PATIENT_SEARCH_0061", "и" → "PATIENT_SEARCH_0438".
 */
export const getSearchPartitionKey = (normalizedName: string): string => {
    const firstChar = normalizedName.charAt(0);
    const bucket = firstChar
        ? firstChar.codePointAt(0)!.toString(16).padStart(4, '0')
        : 'unknown';
    return `PATIENT_SEARCH_${bucket}`;
};
