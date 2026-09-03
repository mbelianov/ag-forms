/**
 * Examination Serializer Utilities (ST-03)
 *
 * Extracts the repeated JSON.stringify / JSON.parse blocks that were duplicated
 * across CreateExamination, UpdateExamination, GetExamination, GetExaminations,
 * and GetExaminationByMRN into a single shared utility.
 *
 * The new data model (ST-04) stores ALL clinical measurement data inside a
 * single `data` blob (containing `fetuses[]`). There are no longer separate
 * top-level `biometry`, `doppler`, `biometry2`, `doppler2` columns to serialize.
 *
 * Advisory R-08/R-09: `patientNameLower` and `updatedBy` shadow fields on entity
 * objects are passed through transparently — they are not part of the typed
 * `ExaminationData` interface but are written to Table Storage by the CRUD
 * functions and must be preserved.
 */

import { ExaminationData } from '../types';

/**
 * Serialize `ExaminationData` to a JSON string for Azure Table Storage.
 * Returns `undefined` if `data` is falsy.
 */
export function serializeExaminationData(data: ExaminationData | undefined): string | undefined {
    if (!data) return undefined;
    return JSON.stringify(data);
}

/**
 * Deserialize the `data` field from Azure Table Storage back to `ExaminationData`.
 * Handles the cases where the value is already an object (SDK may return a parsed
 * object on some environments) or a JSON string.
 * Returns `undefined` if `raw` is falsy.
 */
export function deserializeExaminationData(raw: string | object | undefined): ExaminationData | undefined {
    if (!raw) return undefined;
    if (typeof raw === 'string') {
        try {
            return JSON.parse(raw) as ExaminationData;
        } catch {
            return undefined;
        }
    }
    // Already an object — return as-is (Azure SDK may have auto-parsed it)
    return raw as ExaminationData;
}

// Made with Bob
