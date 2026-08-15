import { describe, it, expect } from 'vitest';
import { computeBiometryDerivedFields } from './useBiometryAutoCalc';
import type { BiometryAutoCalcInput } from './useBiometryAutoCalc';

/** Minimal valid input with all flags false and all measurements populated */
const BASE_INPUT: BiometryAutoCalcInput = {
  bpd: '70', hc: '260', ac: '220', fl: '45', ofd: '90',
  tad: '', apad: '', efw: '',
  gestationalAge: '28w 0d',
  gestationalAgeFromBiometry: '',
  bpdPercentile: '', hcPercentile: '', acPercentile: '', flPercentile: '',
  ofdPercentile: '', tadPercentile: '', apadPercentile: '', efwPercentile: '',
  bpdGa: '', hcGa: '', acGa: '', flGa: '',
  ofdGa: '', tadGa: '', apadGa: '', efwGa: '',
  bpdPercentileIsManual: false, hcPercentileIsManual: false,
  acPercentileIsManual: false, flPercentileIsManual: false,
  ofdPercentileIsManual: false, tadPercentileIsManual: false,
  apadPercentileIsManual: false, efwPercentileIsManual: false,
  bpdGaIsManual: false, hcGaIsManual: false,
  acGaIsManual: false, flGaIsManual: false,
  ofdGaIsManual: false, tadGaIsManual: false,
  apadGaIsManual: false, efwGaIsManual: false,
  efwIsManual: false,
  gestationalAgeFromBiometryIsManual: false,
};

describe('computeBiometryDerivedFields', () => {
  it('calculates all derived fields when all IsManual flags are false', () => {
    const diff = computeBiometryDerivedFields(BASE_INPUT);
    // All auto-calculable fields should be present in the diff
    expect('bpdPercentile' in diff).toBe(true);
    expect('bpdPercentileIsManual' in diff).toBe(true);
    expect(diff.bpdPercentileIsManual).toBe(false);
    expect('hcPercentile' in diff).toBe(true);
    expect('acPercentile' in diff).toBe(true);
    expect('flPercentile' in diff).toBe(true);
    expect('ofdPercentile' in diff).toBe(true);
    expect('efwPercentile' in diff).toBe(true);
    expect('efw' in diff).toBe(true);
    expect('gestationalAgeFromBiometry' in diff).toBe(true);
    expect('gestationalAgeFromBiometryIsManual' in diff).toBe(true);
    expect(diff.gestationalAgeFromBiometryIsManual).toBe(false);
    expect('bpdGa' in diff).toBe(true);
    expect('hcGa' in diff).toBe(true);
    expect('acGa' in diff).toBe(true);
    expect('flGa' in diff).toBe(true);
    expect('ofdGa' in diff).toBe(true);
    expect(diff.ofdGa).toBe('27w 4d');
    expect('efwGa' in diff).toBe(true);
    expect(diff.ofdPercentile).toBe('37');
  });

  it('omits bpdPercentile and bpdPercentileIsManual when bpdPercentileIsManual is true (DISC-1 fix)', () => {
    const diff = computeBiometryDerivedFields({
      ...BASE_INPUT,
      bpdPercentileIsManual: true,
    });
    expect('bpdPercentile' in diff).toBe(false);
    expect('bpdPercentileIsManual' in diff).toBe(false);
    // Other fields are not affected
    expect('hcPercentile' in diff).toBe(true);
  });

  it('omits gestationalAgeFromBiometry and gestationalAgeFromBiometryIsManual when gestationalAgeFromBiometryIsManual is true (DISC-2 fix)', () => {
    const diff = computeBiometryDerivedFields({
      ...BASE_INPUT,
      gestationalAgeFromBiometryIsManual: true,
    });
    expect('gestationalAgeFromBiometry' in diff).toBe(false);
    expect('gestationalAgeFromBiometryIsManual' in diff).toBe(false);
    // Other fields are still calculated
    expect('bpdPercentile' in diff).toBe(true);
    expect('efw' in diff).toBe(true);
  });

  it('omits efwIsManual reset when efwIsManual is true', () => {
    const diff = computeBiometryDerivedFields({
      ...BASE_INPUT,
      efwIsManual: true,
    });
    expect('efw' in diff).toBe(false);
    expect('efwIsManual' in diff).toBe(false);
  });

  it('omits bpdGa and bpdGaIsManual when bpdGaIsManual is true', () => {
    const diff = computeBiometryDerivedFields({
      ...BASE_INPUT,
      bpdGaIsManual: true,
    });
    expect('bpdGa' in diff).toBe(false);
    expect('bpdGaIsManual' in diff).toBe(false);
    // Other GA fields still calculated
    expect('hcGa' in diff).toBe(true);
    expect('acGa' in diff).toBe(true);
    expect('flGa' in diff).toBe(true);
  });

  it('does not include tad/apad fields in the diff (no formula — R-9)', () => {
    const diff = computeBiometryDerivedFields(BASE_INPUT);
    // TAD and APAD fields with formulas are absent — only manual-only fields
    expect('tadPercentile' in diff).toBe(false);
    expect('apadPercentile' in diff).toBe(false);
    expect('tadGa' in diff).toBe(false);
    expect('apadGa' in diff).toBe(false);
  });
});
