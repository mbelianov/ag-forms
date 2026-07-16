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
 * Formula: GA (weeks) = 10.85 + 0.06(HC_cm × FL_cm) + 0.67(BPD_cm) + 0.168(AC_cm)
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

  // Formula coefficients expect cm; inputs are in mm — convert before applying.
  const totalWeeks = 10.85 + 0.06 * ((hc / 10) * (fl / 10)) + 0.67 * (bpd / 10) + 0.168 * (ac / 10);
  return formatGestationalAge(totalWeeks);
}

/**
 * Calculate Estimated Fetal Weight using the Hadlock four-parameter formula.
 * log₁₀(EFW) = 1.335 − 0.0034(AC_cm×FL_cm) + 0.0316(BPD_cm) + 0.0457(AC_cm) + 0.1623(FL_cm)
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

  // Hadlock formula expects cm; inputs are in mm — convert before applying.
  const logEFW =
    1.335 -
    0.0034 * (ac / 10) * (fl / 10) +
    0.0316 * (bpd / 10) +
    0.0457 * (ac / 10) +
    0.1623 * (fl / 10);

  return Math.round(Math.pow(10, logEFW));
}

// ─────────────────────────────────────────────────────────────────────────────
// Biometry percentiles
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Standard normal CDF via the Abramowitz & Stegun §7.1.26 polynomial
 * approximation (max error < 1.5 × 10⁻⁷). No external dependency needed.
 */
function normalCDF(z: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(z));
  const poly =
    t * (0.254829592 +
    t * (-0.284496736 +
    t * (1.421413741 +
    t * (-1.453152027 +
    t *  1.061405429))));
  const cdf = 1 - poly * Math.exp(-z * z);
  return z >= 0 ? cdf : 1 - cdf;
}

/**
 * Parse a gestational-age string ("28w 3d" or "28w3d") and return the
 * whole-weeks integer, or undefined if the string is blank / unparseable.
 */
function parseGAWeeks(ga: string): number | undefined {
  if (!ga) return undefined;
  const match = ga.match(/^(\d{1,2})w/);
  return match ? parseInt(match[1], 10) : undefined;
}

export interface BiometryPercentiles {
  bpd: number;
  hc: number;
  ac: number;
  fl: number;
}

/**
 * Calculate biometry percentiles from four measurements and GA from LMP.
 *
 * Formulas (all means are in cm; inputs supplied in mm and converted):
 *   BPD  mean = -3.08    + (0.41   × ga) - (0.000061  × ga³)   SD = 0.30
 *   HC   mean = -11.48   + (1.56   × ga) - (0.0002548  × ga³)   SD = 1.00
 *   AC   mean = -13.3    + (1.61   × ga) - (0.00998    × ga²)   SD = 1.34
 *   FL   mean = -3.91    + (0.427  × ga) - (0.0034     × ga²)   SD = 0.30
 *
 *   z          = (observed_cm - mean) / SD
 *   percentile = round(Φ(z) × 100), clamped to [1, 99]
 *
 * @param bpd_mm  - Biparietal Diameter in mm
 * @param hc_mm   - Head Circumference in mm
 * @param ac_mm   - Abdominal Circumference in mm
 * @param fl_mm   - Femur Length in mm
 * @param gaFromLMP - Gestational age string from LMP e.g. "28w 3d"
 * @returns Percentile object, or undefined if any input is missing / invalid
 */
export function calcBiometryPercentiles(
  bpd_mm: number | undefined,
  hc_mm: number | undefined,
  ac_mm: number | undefined,
  fl_mm: number | undefined,
  gaFromLMP: string,
): BiometryPercentiles | undefined {
  if (!bpd_mm || !hc_mm || !ac_mm || !fl_mm) return undefined;

  const ga = parseGAWeeks(gaFromLMP);
  if (ga === undefined) return undefined;

  const ga2 = ga * ga;
  const ga3 = ga * ga * ga;

  // Convert mm → cm
  const bpd = bpd_mm / 10;
  const hc  = hc_mm  / 10;
  const ac  = ac_mm  / 10;
  const fl  = fl_mm  / 10;

  const meanBPD = -3.08    + (0.41    * ga) - (0.000061  * ga3);
  const meanHC  = -11.48   + (1.56    * ga) - (0.0002548 * ga3);
  const meanAC  = -13.3    + (1.61    * ga) - (0.00998   * ga2);
  const meanFL  = -3.91    + (0.427   * ga) - (0.0034    * ga2);

  const clamp = (p: number) => Math.max(1, Math.min(99, Math.round(p)));

  return {
    bpd: clamp(normalCDF((bpd - meanBPD) / 0.30) * 100),
    hc:  clamp(normalCDF((hc  - meanHC)  / 1.00) * 100),
    ac:  clamp(normalCDF((ac  - meanAC)  / 1.34) * 100),
    fl:  clamp(normalCDF((fl  - meanFL)  / 0.30) * 100),
  };
}

/**
 * Calculate EFW percentile using the Combs 1993 log-normal reference.
 *
 *   ln(mean_efw) = 0.578 + 0.332·ga − 0.00354·ga²
 *   σ_ln         = 0.127  (constant)
 *   z            = (ln(efw_grams) − μ_ln) / 0.127
 *   percentile   = round(Φ(z) × 100), clamped to [1, 99]
 *
 * @param efw_grams - Estimated fetal weight in grams (must be > 0)
 * @param gaFromLMP - Gestational age string from LMP e.g. "28w 3d"
 * @returns Percentile [1–99], or undefined if inputs are missing / invalid
 */
export function calcEFWPercentile(
  efw_grams: number,
  gaFromLMP: string,
): number | undefined {
  if (efw_grams <= 0) return undefined;
  const ga = parseGAWeeks(gaFromLMP);
  if (ga === undefined) return undefined;

  const muLn = 0.578 + 0.332 * ga - 0.00354 * ga * ga;
  const z = (Math.log(efw_grams) - muLn) / 0.127;
  return Math.max(1, Math.min(99, Math.round(normalCDF(z) * 100)));
}


// ─────────────────────────────────────────────────────────────────────────────
// TASK-037: Patient age at reference date
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate whole-years age of a patient on a given reference date.
 *
 * @param birthDate     - Patient birth date as YYYY-MM-DD string
 * @param referenceDate - Reference date as YYYY-MM-DD string (e.g. exam date)
 * @returns Whole years of age, or undefined if inputs are invalid / missing
 */
export function calculateAgeAtDate(birthDate: string, referenceDate: string): number | undefined {
  if (!birthDate || !referenceDate) return undefined;
  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [ry, rm, rd] = referenceDate.split('-').map(Number);
  if (!by || !bm || !bd || !ry || !rm || !rd) return undefined;

  let age = ry - by;
  // Subtract 1 if birthday hasn't occurred yet in the reference year
  if (rm < bm || (rm === bm && rd < bd)) {
    age -= 1;
  }
  return age >= 0 ? age : undefined;
}

