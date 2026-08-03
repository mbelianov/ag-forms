/**
 * Unit tests for the numeric validation helpers added in ST-1.
 * Run with: npx vitest run src/utils/validators.test.ts
 * (Requires vitest to be installed: npm install -D vitest)
 */
import { describe, it, expect } from 'vitest';
import { validatePositiveFloat, validateNonNegativeFloat, validateIntegerField } from './validators';

describe('validatePositiveFloat', () => {
  it('accepts empty string (optional field)', () => {
    expect(validatePositiveFloat('', 'Field')).toBeUndefined();
    expect(validatePositiveFloat('   ', 'Field')).toBeUndefined();
  });

  it('accepts valid positive float', () => {
    expect(validatePositiveFloat('1.5', 'Field')).toBeUndefined();
    expect(validatePositiveFloat('100', 'Field')).toBeUndefined();
    expect(validatePositiveFloat('0.1', 'Field')).toBeUndefined();
  });

  it('rejects "1abc" (D-2 fix)', () => {
    expect(validatePositiveFloat('1abc', 'Field')).toBeDefined();
  });

  it('rejects "1,5" (comma-separated decimal)', () => {
    expect(validatePositiveFloat('1,5', 'Field')).toBeDefined();
  });

  it('rejects zero (not positive)', () => {
    expect(validatePositiveFloat('0', 'Field')).toBeDefined();
  });

  it('rejects negative values', () => {
    expect(validatePositiveFloat('-1', 'Field')).toBeDefined();
  });
});

describe('validateNonNegativeFloat', () => {
  it('accepts empty string', () => {
    expect(validateNonNegativeFloat('', 'Field')).toBeUndefined();
  });

  it('accepts zero (non-negative)', () => {
    expect(validateNonNegativeFloat('0', 'Field')).toBeUndefined();
  });

  it('accepts valid float', () => {
    expect(validateNonNegativeFloat('0.75', 'Field')).toBeUndefined();
  });

  it('rejects "1abc" (D-2 fix)', () => {
    expect(validateNonNegativeFloat('1abc', 'Field')).toBeDefined();
  });

  it('rejects "1,5"', () => {
    expect(validateNonNegativeFloat('1,5', 'Field')).toBeDefined();
  });

  it('rejects negative values', () => {
    expect(validateNonNegativeFloat('-0.5', 'Field')).toBeDefined();
  });
});

describe('validateIntegerField', () => {
  it('accepts empty string', () => {
    expect(validateIntegerField('', 'HR')).toBeUndefined();
  });

  it('accepts whole integer string', () => {
    expect(validateIntegerField('145', 'HR')).toBeUndefined();
  });

  it('accepts float (fraction truncated at submit)', () => {
    expect(validateIntegerField('145.7', 'HR')).toBeUndefined();
  });

  it('rejects "145abc" (D-3 fix)', () => {
    expect(validateIntegerField('145abc', 'HR')).toBeDefined();
  });

  it('rejects zero (not positive)', () => {
    expect(validateIntegerField('0', 'HR')).toBeDefined();
  });

  it('rejects "1,5"', () => {
    expect(validateIntegerField('1,5', 'HR')).toBeDefined();
  });
});
