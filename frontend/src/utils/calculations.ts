/**
 * Clinical calculation helpers for prenatal ultrasound examinations.
 * All functions are pure and side-effect-free.
 */

/**
 * Format a fractional gestational-age value (in weeks) into the canonical
 * "Xw Yd" string used throughout the application.
 *
 * @param totalWeeks - Gestational age as a decimal number of weeks
 */
export function formatGestationalAge(totalWeeks: number): string {
  const weeks = Math.floor(totalWeeks);
  const days = Math.round((totalWeeks - weeks) * 7);
  // Guard against rounding 6.5 days up to 7 (would give "Xw 7d")
  if (days === 7) {
    return `${weeks + 1}w 0d`;
  }
  return `${weeks}w ${days}d`;
}

/**
 * Calculate Gestational Age from Last Menstrual Period date.
 * GA = (examDate − LMP) expressed as completed weeks + remaining days.
 *
 * @param lmp      - LMP date as YYYY-MM-DD string
 * @param examDate - Examination date as YYYY-MM-DD string
 * @returns Gestational age string in "Xw Yd" format, or undefined if inputs are invalid
 */
export function calcGAFromLMP(lmp: string, examDate: string): string | undefined {
  if (!lmp || !examDate) return undefined;

  const [ly, lm, ld] = lmp.split('-').map(Number);
  const [ey, em, ed] = examDate.split('-').map(Number);

  // Use UTC midnight to avoid DST-induced day-off errors
  const lmpMs = Date.UTC(ly, lm - 1, ld);
  const examMs = Date.UTC(ey, em - 1, ed);

  const diffDays = Math.round((examMs - lmpMs) / 86_400_000);
  if (diffDays < 0) return undefined;

  const weeks = Math.floor(diffDays / 7);
  const days = diffDays % 7;
  return `${weeks}w ${days}d`;
}

/**
 * Calculate Expected Delivery Date (EDD) from LMP using Naegele's rule.
 * EDD = LMP + 280 days.
 *
 * @param lmp - LMP date as YYYY-MM-DD string
 * @returns EDD as a localised display string (e.g. "25 Dec 2026"), or undefined if input invalid
 */
export function calcEDD(lmp: string): string | undefined {
  if (!lmp) return undefined;
  const [ly, lm, ld] = lmp.split('-').map(Number);
  const eddMs = Date.UTC(ly, lm - 1, ld) + 280 * 86_400_000;
  return new Date(eddMs).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Calculate Gestational Age from biometry measurements.
 * Formula: GA (weeks) = 10.85 + 0.06(HC + FL) + 0.67(BPD) + 0.168(AC)
 * All four parameters are required; returns undefined if any is missing or ≤ 0.
 *
 * @param bpd - Biparietal Diameter (mm)
 * @param hc  - Head Circumference (mm)
 * @param ac  - Abdominal Circumference (mm)
 * @param fl  - Femur Length (mm)
 * @returns Gestational age string in "Xw Yd" format, or undefined if any param is absent
 */
export function calcGAFromBiometry(
  bpd: number | undefined,
  hc: number | undefined,
  ac: number | undefined,
  fl: number | undefined,
): string | undefined {
  if (!bpd || !hc || !ac || !fl) return undefined;

  const totalWeeks = 10.85 + 0.06 * (hc + fl) + 0.67 * bpd + 0.168 * ac;
  return formatGestationalAge(totalWeeks);
}

/**
 * Calculate Estimated Fetal Weight using the Hadlock four-parameter formula.
 * log₁₀(EFW) = 1.335 − 0.0034(AC)(FL) + 0.0316(BPD) + 0.0457(AC) + 0.1623(FL)
 * All four parameters are required; returns undefined if any is missing or ≤ 0.
 *
 * @returns EFW rounded to the nearest gram, or undefined if any param is absent
 */
export function calcEFW(
  bpd: number | undefined,
  hc: number | undefined,
  ac: number | undefined,
  fl: number | undefined,
): number | undefined {
  if (!bpd || !hc || !ac || !fl) return undefined;

  const logEFW =
    1.335 -
    0.0034 * ac * fl +
    0.0316 * bpd +
    0.0457 * ac +
    0.1623 * fl;

  return Math.round(Math.pow(10, logEFW));
}
