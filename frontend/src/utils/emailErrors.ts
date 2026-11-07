import type { EmailErrorCode } from '../types';

/** User-facing texts for the REQ-EML-05 error codes (shared by the settings page and the report dialog). */
export const EMAIL_ERROR_MESSAGES: Record<EmailErrorCode, string> = {
  EMAIL_PROVIDER_NOT_CONFIGURED: 'Configure your email provider in your profile',
  EMAIL_AUTH_FAILED: 'Your mail provider rejected the login. For Google/Yahoo use an app password',
  EMAIL_CONNECTION_FAILED: 'Could not reach your mail server',
  EMAIL_REJECTED: 'Your mail provider rejected the message',
};

export function isEmailErrorCode(value: unknown): value is EmailErrorCode {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(EMAIL_ERROR_MESSAGES, value);
}

/**
 * Find the REQ-EML-05 code on an error. Looks at `err.code` (set by emailProviderService),
 * at `err.apiErrorCode` (set by the axios interceptor in api.ts on a raw axios error) and at
 * `err.cause.apiErrorCode` (services keep the original axios error as `cause`).
 */
export function getEmailErrorCode(err: unknown): EmailErrorCode | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const direct = (err as { code?: unknown }).code;
  if (isEmailErrorCode(direct)) return direct;
  const raw = (err as { apiErrorCode?: unknown }).apiErrorCode;
  if (isEmailErrorCode(raw)) return raw;
  const cause = (err as { cause?: unknown }).cause;
  if (cause && typeof cause === 'object') {
    const fromCause = (cause as { apiErrorCode?: unknown }).apiErrorCode;
    if (isEmailErrorCode(fromCause)) return fromCause;
  }
  return undefined;
}

/** Mapped message for a known code, otherwise the error's own message, otherwise the fallback. */
export function getEmailErrorMessage(err: unknown, fallback: string): string {
  const code = getEmailErrorCode(err);
  if (code) return EMAIL_ERROR_MESSAGES[code];
  return err instanceof Error && err.message ? err.message : fallback;
}

// Made with Bob
