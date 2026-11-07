import { describe, it, expect } from 'vitest';
import { getEmailErrorCode, getEmailErrorMessage, EMAIL_ERROR_MESSAGES } from './emailErrors';

describe('emailErrors', () => {
  it('reads the code from err.code, err.apiErrorCode (raw axios error) and err.cause.apiErrorCode', () => {
    expect(getEmailErrorCode(Object.assign(new Error('x'), { code: 'EMAIL_AUTH_FAILED' }))).toBe('EMAIL_AUTH_FAILED');
    expect(getEmailErrorCode(Object.assign(new Error('x'), { apiErrorCode: 'EMAIL_REJECTED' }))).toBe('EMAIL_REJECTED');
    expect(
      getEmailErrorCode(new Error('x', { cause: { apiErrorCode: 'EMAIL_CONNECTION_FAILED' } }))
    ).toBe('EMAIL_CONNECTION_FAILED');
  });

  it('ignores unknown codes such as axios ERR_NETWORK', () => {
    expect(getEmailErrorCode(Object.assign(new Error('x'), { code: 'ERR_NETWORK' }))).toBeUndefined();
    expect(getEmailErrorCode('nope')).toBeUndefined();
  });

  it('maps known codes to the REQ-EML-05 text and otherwise uses the error message or the fallback', () => {
    const coded = Object.assign(new Error('raw'), { code: 'EMAIL_PROVIDER_NOT_CONFIGURED' });
    expect(getEmailErrorMessage(coded, 'fb')).toBe(EMAIL_ERROR_MESSAGES.EMAIL_PROVIDER_NOT_CONFIGURED);
    expect(getEmailErrorMessage(new Error('Server text'), 'fb')).toBe('Server text');
    expect(getEmailErrorMessage('weird', 'fb')).toBe('fb');
  });
});
