/**
 * AutoCalcHelpers.tsx — shared auto-calc rendering utilities (ST-07).
 *
 * autoSuffix: returns a ReactNode suffix for auto-calculated or manually-entered values.
 *   - isManual = true  → yellow "(manual)" span
 *   - isManual = false, sourceTag present → " (Hadlock)" or " (Robinson)" plain text
 *   - isManual = false, no sourceTag → " (auto)" plain text
 *   - empty value → null (no suffix)
 */
import type { ReactNode } from 'react';

/**
 * Returns a ReactNode suffix to append to a label when a value is present.
 *
 * @param isManual  true → manual override; false/undefined → auto-calculated
 * @param sourceTag attribution label e.g. "Hadlock"; falls back to "auto"
 * @param hasValue  whether the field currently has a non-empty value (default true)
 */
export function autoSuffix(
  isManual: boolean | undefined,
  sourceTag?: string,
  hasValue = true,
): ReactNode {
  if (!hasValue) return null;
  if (isManual) {
    return <span style={{ color: '#f1c21b' }}> (manual)</span>;
  }
  const tag = sourceTag ?? 'auto';
  return ` (${tag})`;
}

/**
 * @deprecated Use autoSuffix instead. Kept only for legacy BiometrySection / FirstTrimesterSection
 * which are no longer on any active code path.
 */
export function autoCalcLabel(label: string, isManual?: boolean): string {
  return isManual ? `${label} (manual)` : label;
}
