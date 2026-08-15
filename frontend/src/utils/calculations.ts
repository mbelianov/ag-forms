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
 * Calculate Gestational Age from Crown-Rump Length (CRL).
 *
 * Formula:
 *   GA_days = 8.052 × √( CRL_mm × 1.037 ) + 23.73
 *
 * Source:
 *   Robinson HP. "Sonar measurement of fetal crown-rump length as means of
 *   assessing maturity in first trimester of pregnancy."
 *   Br Med J. 1975 Oct 4;4(5986):28–31. PMID 1182090.
 *   DOI: 10.1136/bmj.4.5986.28
 *
 * Valid CRL range: 10–65 mm (approx. 7+0 to 13+6 weeks).
 * Input must be in mm. Result is rounded to the nearest whole day.
 *
 * @param crl - Crown-Rump Length in mm
 * @returns Gestational age string in "Xw Yd" format, or undefined if input is absent or ≤ 0
 */
export function calcGAFromCRL(crl: number | undefined): string | undefined {
  if (!crl || crl <= 0) return undefined;
  const totalDays = 8.052 * Math.sqrt(crl * 1.037) + 23.73;
  // Convert total days to fractional weeks for formatGestationalAge
  return formatGestationalAge(totalDays / 7);
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
    1.35960 -
    0.00386 * (ac / 10) * (fl / 10) +
    0.00640 * (hc / 10) +
    0.00061 * (bpd / 10) * (ac / 10) +
    0.04240 * (ac / 10) +
    0.17400 * (fl / 10);

  return Math.round(Math.pow(10, logEFW));
}

// ─────────────────────────────────────────────────────────────────────────────
// Biometry percentiles
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Standard normal CDF via Abramowitz & Stegun §7.1.26.
 * The polynomial approximates erfc(x), which is converted to Φ(z) via x = |z| / √2.
 */
function normalCDF(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const poly =
    t * (0.254829592 +
    t * (-0.284496736 +
    t * (1.421413741 +
    t * (-1.453152027 +
    t * 1.061405429))));
  const erfc = poly * Math.exp(-x * x);
  return z >= 0 ? 1 - erfc / 2 : erfc / 2;
}

/**
 * Parse a gestational-age string ("28w 3d" or "28w3d") 
 * into continuous decimal weeks, or undefined if the string is blank/unparseable.
 */

function parseGAWeeks(gaStr: string): number | undefined {
  if (!gaStr) return undefined;
    const match = gaStr.match(/^(\d{1,2})\s*w(?:\s*(\d)\s*d)?/i);
    if (!match) return undefined;
    
    const weeks = parseInt(match[1], 10);
    const days = match[2] ? parseInt(match[2], 10) : 0;
    return weeks + (days / 7.0);
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
 *   BPD  mean = -3.08    + (0.41   × ga) - (0.000061  × ga³)
 *   HC   mean = -11.48   + (1.56   × ga) - (0.0002548  × ga³)
 *   AC   mean = -13.3    + (1.61   × ga) - (0.00998    × ga²)
 *   FL   mean = -3.91    + (0.427  × ga) - (0.0034     × ga²)
 * 
 *   percentile calculate using dynamic standard deviations
 *   const sdBPD = meanBPD * 0.043;
 *   const sdHC  = meanHC  * 0.041;
 *   const sdAC  = meanAC  * 0.057;
 *   const sdFL  = meanFL  * 0.050;
 * 
 *   alternatively you can use standard deviations but not recommended
 *   sdBPD = 0.3; sdHC = 1; sdAC = 1.34; sdFL = 0.3
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

  // Hadlock 1984 Expected Means (cm)
  const meanBPD = -3.08    + (0.41    * ga) - (0.000061  * ga3);
  const meanHC  = -11.48   + (1.56    * ga) - (0.0002548 * ga3);
  const meanAC  = -13.3    + (1.61    * ga) - (0.00998   * ga2);
  const meanFL  = -3.91    + (0.427   * ga) - (0.0034    * ga2);

  // Dynamic SDs based on proportional population variance (Coefficient of Variation)
  const sdBPD = meanBPD * 0.043;
  const sdHC  = meanHC  * 0.041;
  const sdAC  = meanAC  * 0.057;
  const sdFL  = meanFL  * 0.050;

  const clamp = (p: number) => Math.max(1, Math.min(99, Math.round(p)));

  return {
    bpd: clamp(normalCDF((bpd - meanBPD) / sdBPD) * 100),
    hc:  clamp(normalCDF((hc  - meanHC)  / sdHC) * 100),
    ac:  clamp(normalCDF((ac  - meanAC)  / sdAC) * 100),
    fl:  clamp(normalCDF((fl  - meanFL)  / sdFL) * 100),
  };
}

/**
 * Calculate BPD percentile independently from GA from LMP.
 * Same Hadlock 1984 formula as calcBiometryPercentiles but requires only BPD.
 */
export function calcBPDPercentile(bpd_mm: number | undefined, gaFromLMP: string): number | undefined {
  if (!bpd_mm) return undefined;
  const ga = parseGAWeeks(gaFromLMP);
  if (ga === undefined) return undefined;
  const mean = -3.08 + (0.41 * ga) - (0.000061 * ga * ga * ga);
  const sd   = mean * 0.043;
  const clamp = (p: number) => Math.max(1, Math.min(99, Math.round(p)));
  return clamp(normalCDF((bpd_mm / 10 - mean) / sd) * 100);
}

/**
 * Calculate HC percentile independently from GA from LMP.
 * Same Hadlock 1984 formula as calcBiometryPercentiles but requires only HC.
 */
export function calcHCPercentile(hc_mm: number | undefined, gaFromLMP: string): number | undefined {
  if (!hc_mm) return undefined;
  const ga = parseGAWeeks(gaFromLMP);
  if (ga === undefined) return undefined;
  const mean = -11.48 + (1.56 * ga) - (0.0002548 * ga * ga * ga);
  const sd   = mean * 0.041;
  const clamp = (p: number) => Math.max(1, Math.min(99, Math.round(p)));
  return clamp(normalCDF((hc_mm / 10 - mean) / sd) * 100);
}

/**
 * Calculate AC percentile independently from GA from LMP.
 * Same Hadlock 1984 formula as calcBiometryPercentiles but requires only AC.
 */
export function calcACPercentile(ac_mm: number | undefined, gaFromLMP: string): number | undefined {
  if (!ac_mm) return undefined;
  const ga = parseGAWeeks(gaFromLMP);
  if (ga === undefined) return undefined;
  const mean = -13.3 + (1.61 * ga) - (0.00998 * ga * ga);
  const sd   = mean * 0.057;
  const clamp = (p: number) => Math.max(1, Math.min(99, Math.round(p)));
  return clamp(normalCDF((ac_mm / 10 - mean) / sd) * 100);
}

/**
 * Calculate FL percentile independently from GA from LMP.
 * Same Hadlock 1984 formula as calcBiometryPercentiles but requires only FL.
 */
export function calcFLPercentile(fl_mm: number | undefined, gaFromLMP: string): number | undefined {
  if (!fl_mm) return undefined;
  const ga = parseGAWeeks(gaFromLMP);
  if (ga === undefined) return undefined;
  const mean = -3.91 + (0.427 * ga) - (0.0034 * ga * ga);
  const sd   = mean * 0.050;
  const clamp = (p: number) => Math.max(1, Math.min(99, Math.round(p)));
  return clamp(normalCDF((fl_mm / 10 - mean) / sd) * 100);
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

  // Combs 1993 log-mean expected weight
  const muLn = 0.578 + 0.332 * ga - 0.00354 * ga * ga;

  // Log-scale Z-score with constant sigma = 0.127
  const z = (Math.log(efw_grams) - muLn) / 0.127;

  // Convert to clamped percentile [1, 99]
  const clamp = (p: number) => Math.max(1, Math.min(99, Math.round(p)));
  return clamp(normalCDF(z) * 100);
}


// ─────────────────────────────────────────────────────────────────────────────
// KI-009: GA-from-measurement and OFD-percentile formula functions
// All functions return undefined when inputs are out of valid range.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate Gestational Age from BPD using the Hadlock 1984 regression.
 * Formula: GA (weeks) = 9.54 + 1.482 × BPD_cm + 0.1676 × BPD_cm²
 *
 * Source:
 *   Hadlock FP, Deter RL, Harrist RB, Park SK.
 *   "Estimating fetal age: computer-assisted analysis of multiple fetal growth parameters."
 *   Radiology. 1984;152(2):497–501. PMID 6739822.
 *   (FORM-4a)
 *
 * Valid output range: 14–40 weeks.
 *
 * @param bpd_mm - Biparietal Diameter in mm
 * @returns GA string "Xw Yd", or undefined if result is outside 14–40 wk
 */
export function calcGAFromBPD(bpd_mm: number | undefined): string | undefined {
  if (bpd_mm == null || bpd_mm <= 0) return undefined;
  const bpd_cm = bpd_mm / 10;
  const ga = 9.54 + 1.482 * bpd_cm + 0.1676 * bpd_cm * bpd_cm;
  if (ga < 14 || ga > 40) return undefined;
  return formatGestationalAge(ga);
}

/**
 * Calculate Gestational Age from HC using the Hadlock 1984 regression.
 * Formula: GA (weeks) = 8.96 + 0.540 × HC_cm + 0.0003 × HC_cm³
 *
 * Source:
 *   Hadlock FP, Deter RL, Harrist RB, Park SK.
 *   "Estimating fetal age: computer-assisted analysis of multiple fetal growth parameters."
 *   Radiology. 1984;152(2):497–501. PMID 6739822.
 *   (FORM-5a)
 *
 * Valid output range: 14–40 weeks.
 *
 * @param hc_mm - Head Circumference in mm
 * @returns GA string "Xw Yd", or undefined if result is outside 14–40 wk
 */
export function calcGAFromHC(hc_mm: number | undefined): string | undefined {
  if (hc_mm == null || hc_mm <= 0) return undefined;
  const hc_cm = hc_mm / 10;
  const ga = 8.96 + 0.540 * hc_cm + 0.0003 * hc_cm * hc_cm * hc_cm;
  if (ga < 14 || ga > 40) return undefined;
  return formatGestationalAge(ga);
}

/**
 * Calculate Gestational Age from AC using the Hadlock 1984 regression.
 * Formula: GA (weeks) = 8.14 + 0.753 × AC_cm + 0.0036 × AC_cm²
 *
 * Source:
 *   Hadlock FP, Deter RL, Harrist RB, Park SK.
 *   "Estimating fetal age: computer-assisted analysis of multiple fetal growth parameters."
 *   Radiology. 1984;152(2):497–501. PMID 6739822.
 *   (FORM-6a)
 *
 * Valid output range: 14–40 weeks.
 *
 * @param ac_mm - Abdominal Circumference in mm
 * @returns GA string "Xw Yd", or undefined if result is outside 14–40 wk
 */
export function calcGAFromAC(ac_mm: number | undefined): string | undefined {
  if (ac_mm == null || ac_mm <= 0) return undefined;
  const ac_cm = ac_mm / 10;
  const ga = 8.14 + 0.753 * ac_cm + 0.0036 * ac_cm * ac_cm;
  if (ga < 14 || ga > 40) return undefined;
  return formatGestationalAge(ga);
}

/**
 * Calculate Gestational Age from FL using the Hadlock 1984 regression.
 * Formula: GA (weeks) = 10.35 + 2.460 × FL_cm + 0.170 × FL_cm²
 *
 * Source:
 *   Hadlock FP, Deter RL, Harrist RB, Park SK.
 *   "Estimating fetal age: computer-assisted analysis of multiple fetal growth parameters."
 *   Radiology. 1984;152(2):497–501. PMID 6739822.
 *   (FORM-7a)
 *
 * Valid output range: 14–40 weeks.
 *
 * @param fl_mm - Femur Length in mm
 * @returns GA string "Xw Yd", or undefined if result is outside 14–40 wk
 */
export function calcGAFromFL(fl_mm: number | undefined): string | undefined {
  if (fl_mm == null || fl_mm <= 0) return undefined;
  const fl_cm = fl_mm / 10;
  const ga = 10.35 + 2.460 * fl_cm + 0.170 * fl_cm * fl_cm;
  if (ga < 14 || ga > 40) return undefined;
  return formatGestationalAge(ga);
}

/**
 * Calculate Gestational Age from OFD using Newton–Raphson inversion of the Hadlock
 * Obstet Gynecol 1984 OFD mean formula.
 *
 * Forward model: OFD_mean_cm = −3.08 + 0.484·ga − 0.000061·ga³
 * Newton–Raphson iterates on f(ga) = mean(ga) − observed_cm.
 * Derivative: f'(ga) = 0.484 − 3 × 0.000061 × ga²  = 0.484 − 0.000183·ga²
 *
 * COEFFICIENT CORRECTION: Prior versions used −2.546 + 0.372·ga − 0.0000323·ga³,
 * which produced OFD ≈ BPD at every gestational age (anatomically impossible — OFD is
 * consistently 15–25% larger than BPD). The corrected coefficients share the same cubic
 * term as the BPD formula from the same Hadlock OG 1984 paper and are validated against
 * the GE LOGIQ 500 Advanced Reference Manual Table 18-18 (OFD : Hansmann):
 *   OFD=66 mm → formula: 21w 2d  |  Hansmann: 21w 2d  (exact)
 *   OFD=78 mm → formula: 24w 2d  |  Hansmann: 24w 1d  (1 day)
 *
 * Source:
 *   Hadlock FP, Deter RL, Harrist RB, Park SK.
 *   "Fetal biparietal diameter: rational choice of plane of section for sonographic measurement."
 *   Obstet Gynecol. 1984;63(4):457–65.
 *   (FORM-8a)
 *
 * Valid output range: 14–40 weeks.
 *
 * @param ofd_mm - Occipito-frontal Diameter in mm
 * @returns GA string "Xw Yd", or undefined if result is outside 14–40 wk or fails to converge
 */
export function calcGAFromOFD(ofd_mm: number | undefined): string | undefined {
  if (ofd_mm == null || ofd_mm <= 0) return undefined;
  const obs_cm = ofd_mm / 10;
  // Initial guess via linear approximation
  let ga = (obs_cm + 3.08) / 0.484;
  for (let i = 0; i < 50; i++) {
    const mean = -3.08 + 0.484 * ga - 0.000061 * ga * ga * ga;
    const deriv = 0.484 - 3 * 0.000061 * ga * ga;
    const delta = (mean - obs_cm) / deriv;
    ga -= delta;
    if (Math.abs(delta) < 0.0001) break;
  }
  if (ga < 14 || ga > 40) return undefined;
  return formatGestationalAge(ga);
}

/**
 * Calculate OFD percentile using the Hadlock Obstet Gynecol 1984 reference.
 *
 * OFD_mean_cm = −3.08 + 0.484·ga − 0.000061·ga³
 * SD          = mean × 0.043  (proportional CV = 4.3%)
 * z           = (observed_cm − mean) / SD
 * percentile  = clamp(round(Φ(z) × 100), 1, 99)
 *
 * COEFFICIENT CORRECTION: Prior versions used −2.546 + 0.372·ga − 0.0000323·ga³,
 * which produced OFD ≈ BPD at every gestational age (anatomically impossible — OFD is
 * consistently 15–25% larger than BPD). See calcGAFromOFD JSDoc for full validation note.
 *
 * Source:
 *   Hadlock FP, Deter RL, Harrist RB, Park SK.
 *   "Fetal biparietal diameter: rational choice of plane of section for sonographic measurement."
 *   Obstet Gynecol. 1984;63(4):457–65.
 *   (FORM-8b)
 *
 * @param ofd_mm   - Occipito-frontal Diameter in mm
 * @param gaFromLMP - Gestational age string from LMP e.g. "28w 3d"
 * @returns Percentile [1–99], or undefined if inputs are missing / invalid
 */
export function calcOFDPercentile(ofd_mm: number | undefined, gaFromLMP: string): number | undefined {
  if (ofd_mm == null || ofd_mm <= 0) return undefined;
  const ga = parseGAWeeks(gaFromLMP);
  if (ga === undefined) return undefined;
  const obs_cm = ofd_mm / 10;
  const mean = -3.08 + 0.484 * ga - 0.000061 * ga * ga * ga;
  if (mean <= 0) return undefined;
  const sd = mean * 0.043;
  const z = (obs_cm - mean) / sd;
  const clamp = (p: number) => Math.max(1, Math.min(99, Math.round(p)));
  return clamp(normalCDF(z) * 100);
}

/**
 * Calculate Gestational Age from EFW using the Combs 1993 inverse quadratic.
 *
 * Combs 1993 log-mean: ln(mean_efw) = 0.578 + 0.332·ga − 0.00354·ga²
 * Rearranged as quadratic in ga: 0.00354·ga² − 0.332·ga + (ln(EFW) − 0.578) = 0
 * Take the smaller (earlier gestational age) root that falls in the valid range.
 *
 * Source:
 *   Combs CA, Jaekle RK, Rosenn B, et al.
 *   "Sonographic estimation of fetal weight based on a model of fetal volume."
 *   Am J Obstet Gynecol. 1993;169(4):775–83.
 *   (FORM-11b)
 *
 * Valid output range: 16–40 weeks.
 *
 * @param efw_g - Estimated Fetal Weight in grams (must be > 0)
 * @returns GA string "Xw Yd", or undefined if result is outside 16–40 wk or not real
 */
export function calcGAFromEFW(efw_g: number | undefined): string | undefined {
  if (efw_g == null || efw_g <= 0) return undefined;
  const lnEfw = Math.log(efw_g);
  // 0.00354·ga² − 0.332·ga + (lnEfw − 0.578) = 0
  const a = 0.00354;
  const b = -0.332;
  const c = lnEfw - 0.578;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return undefined;
  const sqrtD = Math.sqrt(discriminant);
  // Two roots — take the one in the valid 16–40 week range
  const ga1 = (-b - sqrtD) / (2 * a);
  const ga2 = (-b + sqrtD) / (2 * a);
  let ga: number | undefined;
  if (ga1 >= 16 && ga1 <= 40) ga = ga1;
  else if (ga2 >= 16 && ga2 <= 40) ga = ga2;
  if (ga === undefined) return undefined;
  return formatGestationalAge(ga);
}

// ─────────────────────────────────────────────────────────────────────────────
// Biometry display formatter
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format a biometry measurement to exactly two decimal places.
 * e.g. 85.3 → "85.30",  85 → "85.00"
 */
export function fmtBiometry(value: number): string {
  return value.toFixed(2);
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

