/**
 * useBiometryAutoCalc — reactive biometry auto-calculation hook (KI-009).
 *
 * Accepts biometry formData fields (as strings) and gestationalAge (GA from LMP),
 * and returns a diff object of auto-calculated percentile and GA fields.
 *
 * Rules (per REQ-4, REQ-5, REQ-9):
 *  - If IsManual flag is true for a field → pass through the existing value, do not recalculate.
 *  - If the source measurement changes → reset the IsManual flag and recalculate.
 *  - If a percentile or GA field is cleared by the user → reset the IsManual flag.
 *
 * Usage: call inside useExaminationForm and merge the returned diff into formData on each render.
 */
import { useEffect, useRef } from 'react';
import {
  calcBPDPercentile,
  calcHCPercentile,
  calcACPercentile,
  calcFLPercentile,
  calcEFW,
  calcEFWPercentile,
  calcOFDPercentile,
  calcGAFromBiometry,
  calcGAFromBPD,
  calcGAFromHC,
  calcGAFromAC,
  calcGAFromFL,
  calcGAFromOFD,
  calcGAFromEFW,
} from '../utils/calculations';

/** The subset of formData fields consumed/produced by this hook (T1 only). */
export interface BiometryAutoCalcInput {
  // Measurements (string floats)
  bpd: string; hc: string; ac: string; fl: string; ofd: string;
  tad: string; apad: string; efw: string;
  gestationalAge: string; // GA from LMP — drives percentile calcs
  gestationalAgeFromBiometry: string;
  // Existing computed values (kept if IsManual is true)
  bpdPercentile: string; hcPercentile: string; acPercentile: string; flPercentile: string;
  ofdPercentile: string; tadPercentile: string; apadPercentile: string; efwPercentile: string;
  bpdGa: string; hcGa: string; acGa: string; flGa: string;
  ofdGa: string; tadGa: string; apadGa: string; efwGa: string;
  // IsManual flags (booleans stored in formData)
  bpdPercentileIsManual: boolean; hcPercentileIsManual: boolean;
  acPercentileIsManual: boolean; flPercentileIsManual: boolean;
  ofdPercentileIsManual: boolean; tadPercentileIsManual: boolean;
  apadPercentileIsManual: boolean; efwPercentileIsManual: boolean;
  bpdGaIsManual: boolean; hcGaIsManual: boolean;
  acGaIsManual: boolean; flGaIsManual: boolean;
  ofdGaIsManual: boolean; tadGaIsManual: boolean;
  apadGaIsManual: boolean; efwGaIsManual: boolean;
  efwIsManual: boolean;
  gestationalAgeFromBiometryIsManual: boolean;
}

export type BiometryAutoCalcDiff = Partial<{
  bpdPercentile: string; hcPercentile: string; acPercentile: string; flPercentile: string;
  ofdPercentile: string; efwPercentile: string;
  bpdGa: string; hcGa: string; acGa: string; flGa: string;
  ofdGa: string; efwGa: string;
  efw: string;
  gestationalAgeFromBiometry: string;
  // IsManual resets
  bpdPercentileIsManual: boolean; hcPercentileIsManual: boolean;
  acPercentileIsManual: boolean; flPercentileIsManual: boolean;
  ofdPercentileIsManual: boolean; efwPercentileIsManual: boolean;
  bpdGaIsManual: boolean; hcGaIsManual: boolean;
  acGaIsManual: boolean; flGaIsManual: boolean;
  ofdGaIsManual: boolean; efwGaIsManual: boolean;
  efwIsManual: boolean;
  gestationalAgeFromBiometryIsManual: boolean;
}>;

/**
 * Pure computation: given biometry formData, return a diff of auto-calculated fields.
 * Only fields whose IsManual flag is false are recalculated.
 * TAD and APAD have no auto-calc formula — always pass through unchanged.
 */
export function computeBiometryDerivedFields(input: BiometryAutoCalcInput): BiometryAutoCalcDiff {
  const diff: BiometryAutoCalcDiff = {};

  const bpd = parseFloat(input.bpd) || undefined;
  const hc  = parseFloat(input.hc)  || undefined;
  const ac  = parseFloat(input.ac)  || undefined;
  const fl  = parseFloat(input.fl)  || undefined;
  const ofd = parseFloat(input.ofd) || undefined;
  const gaStr = input.gestationalAge;
  const autoEfw = calcEFW(bpd, hc, ac, fl);

  // BPD, HC, AC, FL percentiles — each calculated independently from its own measurement + GA.
  // A missing sibling measurement does not suppress another measurement's percentile.
  if (!input.bpdPercentileIsManual) {
    const p = gaStr ? calcBPDPercentile(bpd, gaStr) : undefined;
    diff.bpdPercentile = p != null ? String(p) : '';
    diff.bpdPercentileIsManual = false;
  }
  if (!input.hcPercentileIsManual) {
    const p = gaStr ? calcHCPercentile(hc, gaStr) : undefined;
    diff.hcPercentile = p != null ? String(p) : '';
    diff.hcPercentileIsManual = false;
  }
  if (!input.acPercentileIsManual) {
    const p = gaStr ? calcACPercentile(ac, gaStr) : undefined;
    diff.acPercentile = p != null ? String(p) : '';
    diff.acPercentileIsManual = false;
  }
  if (!input.flPercentileIsManual) {
    const p = gaStr ? calcFLPercentile(fl, gaStr) : undefined;
    diff.flPercentile = p != null ? String(p) : '';
    diff.flPercentileIsManual = false;
  }

  // OFD percentile
  if (!input.ofdPercentileIsManual) {
    const ofdPct = gaStr ? calcOFDPercentile(ofd, gaStr) : undefined;
    diff.ofdPercentile = ofdPct != null ? String(ofdPct) : '';
    diff.ofdPercentileIsManual = false;
  }

  // EFW
  if (!input.efwIsManual) {
    diff.efw = autoEfw != null ? String(autoEfw) : '';
    diff.efwIsManual = false;
  }

  // GA from Biometry (composite)
  if (!input.gestationalAgeFromBiometryIsManual) {
    diff.gestationalAgeFromBiometry = calcGAFromBiometry(bpd, hc, ac, fl) ?? '';
    diff.gestationalAgeFromBiometryIsManual = false;
  }

  // EFW percentile - use autoEfw (from BPD,HC,AC,FL), not effectiveEfw
  if (!input.efwPercentileIsManual) {
    const efwPct = (autoEfw && gaStr) ? calcEFWPercentile(autoEfw, gaStr) : undefined;
    diff.efwPercentile = efwPct != null ? String(efwPct) : '';
    diff.efwPercentileIsManual = false;
  }

  // GA from BPD
  if (!input.bpdGaIsManual) {
    diff.bpdGa = calcGAFromBPD(bpd) ?? '';
    diff.bpdGaIsManual = false;
  }
  // GA from HC
  if (!input.hcGaIsManual) {
    diff.hcGa = calcGAFromHC(hc) ?? '';
    diff.hcGaIsManual = false;
  }
  // GA from AC
  if (!input.acGaIsManual) {
    diff.acGa = calcGAFromAC(ac) ?? '';
    diff.acGaIsManual = false;
  }
  // GA from FL
  if (!input.flGaIsManual) {
    diff.flGa = calcGAFromFL(fl) ?? '';
    diff.flGaIsManual = false;
  }
  // GA from OFD
  if (!input.ofdGaIsManual) {
    diff.ofdGa = calcGAFromOFD(ofd) ?? '';
    diff.ofdGaIsManual = false;
  }
  // GA from EFW
  if (!input.efwGaIsManual) {
    diff.efwGa = calcGAFromEFW(autoEfw) ?? '';
    diff.efwGaIsManual = false;
  }

  return diff;
}

/**
 * React hook wrapper around computeBiometryDerivedFields.
 * Returns the latest diff on every render (useMemo semantics).
 * Consumers should apply the diff via setFormData.
 */
export function useBiometryAutoCalc(
  input: BiometryAutoCalcInput,
  setFormData: (updater: (prev: Record<string, unknown>) => Record<string, unknown>) => void,
): void {
  const prevMeasurementsRef = useRef<string>('');

  useEffect(() => {
    const measurements = [input.bpd, input.hc, input.ac, input.fl, input.ofd, input.efw, input.gestationalAge].join('|');

    // If measurements changed, auto-calculate and merge diff
    const diff = computeBiometryDerivedFields(input);
    const hasDiff = Object.keys(diff).length > 0;
    if (hasDiff) {
      prevMeasurementsRef.current = measurements;
      setFormData((prev) => ({ ...prev, ...diff }));
    }
  // Run on every measurement or GA change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input.bpd, input.hc, input.ac, input.fl, input.ofd, input.efw, input.gestationalAge]);
}

// Made with Bob
