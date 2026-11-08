import api, { getApiErrorCode } from './api';
import type {
  EmailProviderSettings,
  SaveEmailProviderRequest,
  EmailProviderTestResult,
} from '../types';

/** Error thrown by emailProviderService: message is the backend text, code the REQ-EML-05 code if any. */
export type EmailProviderServiceError = Error & {
  /** Backend error.code, e.g. EMAIL_AUTH_FAILED, EMAIL_PROVIDER_NOT_CONFIGURED (undefined for generic errors). */
  code?: string;
  /** True on 409 responses to a save (stale ETag). */
  isConcurrencyConflict?: boolean;
};

function extractMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const r = (err as {
      response?: {
        data?: {
          error?: { message?: string; details?: { errors?: string[] } } | string;
        };
      };
    }).response;
    const e = r?.data?.error;
    if (typeof e === 'object' && e?.message) {
      const details = e.details?.errors;
      if (details && details.length > 0) {
        return e.message + '\n• ' + details.join('\n• ');
      }
      return e.message;
    }
    if (typeof e === 'string') return e;
  }
  return fallback;
}

function getResponseStatus(err: unknown): number | undefined {
  if (err && typeof err === 'object' && 'response' in err) {
    return (err as { response?: { status?: number } }).response?.status;
  }
  return undefined;
}

function toServiceError(err: unknown, fallback: string): EmailProviderServiceError {
  const error = new Error(extractMessage(err, fallback), { cause: err }) as EmailProviderServiceError;
  error.code = getApiErrorCode(err);
  return error;
}

/**
 * Email provider service: the doctor's own SMTP settings (REQ-EML-02).
 * The axios interceptor has already unwrapped the { success, data, meta } envelope.
 * The password is write-only: it is sent on save and never returned by any endpoint.
 */
class EmailProviderService {
  private readonly BASE_URL = '/v1/profile/email-provider';

  /** Get own settings; `{ configured: false }` when nothing is saved. */
  async getProvider(): Promise<EmailProviderSettings> {
    try {
      const response = await api.get<EmailProviderSettings>(this.BASE_URL);
      return response.data;
    } catch (err) {
      throw toServiceError(err, 'Failed to load email settings');
    }
  }

  /**
   * Create or update own settings. For an update pass the ETag from the last GET/PUT;
   * it travels in the request body. An empty/undefined password keeps the stored one.
   */
  async saveProvider(data: SaveEmailProviderRequest, etag?: string): Promise<EmailProviderSettings> {
    try {
      const response = await api.put<EmailProviderSettings>(this.BASE_URL, etag ? { ...data, etag } : data);
      return response.data;
    } catch (err) {
      if (getResponseStatus(err) === 409) {
        const conflictError = new Error(
          'Your email settings were modified elsewhere. Please reload the page and try again.',
          { cause: err }
        ) as EmailProviderServiceError;
        conflictError.isConcurrencyConflict = true;
        conflictError.code = getApiErrorCode(err);
        throw conflictError;
      }
      throw toServiceError(err, 'Failed to save email settings');
    }
  }

  /** Remove own settings (idempotent). */
  async deleteProvider(): Promise<void> {
    try {
      await api.delete(this.BASE_URL);
    } catch (err) {
      throw toServiceError(err, 'Failed to remove email settings');
    }
  }

  /**
   * Send a test email to the doctor's own account address using the saved settings.
   * On failure the thrown error carries `.code` (EMAIL_AUTH_FAILED, EMAIL_CONNECTION_FAILED,
   * EMAIL_REJECTED, EMAIL_PROVIDER_NOT_CONFIGURED).
   */
  async sendTestEmail(): Promise<EmailProviderTestResult> {
    try {
      const response = await api.post<EmailProviderTestResult>(`${this.BASE_URL}/test`);
      return response.data;
    } catch (err) {
      throw toServiceError(err, 'Failed to send test email');
    }
  }
}

// Export singleton instance
export const emailProviderService = new EmailProviderService();

// Made with Bob
