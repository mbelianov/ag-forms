import { describe, it, expect } from 'vitest';
import { getApiErrorCode } from './api';

describe('getApiErrorCode', () => {
  const withCode = (code: unknown) => ({ response: { data: { error: { code, message: 'x' } } } });

  it('returns the backend error code', () => {
    expect(getApiErrorCode(withCode('EMAIL_AUTH_FAILED'))).toBe('EMAIL_AUTH_FAILED');
  });

  it('ignores the generic ERROR code', () => {
    expect(getApiErrorCode(withCode('ERROR'))).toBeUndefined();
  });

  it('ignores non-string codes, string errors and missing responses', () => {
    expect(getApiErrorCode(withCode(42))).toBeUndefined();
    expect(getApiErrorCode({ response: { data: { error: 'plain' } } })).toBeUndefined();
    expect(getApiErrorCode(new Error('Network Error'))).toBeUndefined();
    expect(getApiErrorCode(null)).toBeUndefined();
  });
});
