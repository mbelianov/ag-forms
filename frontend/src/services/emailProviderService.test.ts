import { describe, it, expect, vi, beforeEach } from 'vitest';

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  post: vi.fn(),
}));

vi.mock('./api', async () => {
  const actual = await vi.importActual<typeof import('./api')>('./api');
  return { ...actual, default: apiMock };
});

import { emailProviderService } from './emailProviderService';
import type { EmailProviderServiceError } from './emailProviderService';
import type { SaveEmailProviderRequest } from '../types';

/** Shape of an axios error after the response interceptor (error.response.data is the raw envelope). */
function apiError(status: number, message: string, code = 'ERROR', details?: { errors: string[] }) {
  return {
    response: { status, data: { success: false, error: { code, message, ...(details && { details }) } } },
  };
}

const request: SaveEmailProviderRequest = {
  provider: 'google',
  username: 'dr@gmail.com',
  from_email: 'dr@gmail.com',
  password: 'abcd efgh ijkl mnop',
};

describe('emailProviderService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getProvider returns the unwrapped settings from GET /v1/profile/email-provider', async () => {
    apiMock.get.mockResolvedValue({ data: { configured: true, secret_set: true, etag: 'W/"1"' } });
    const result = await emailProviderService.getProvider();
    expect(apiMock.get).toHaveBeenCalledWith('/v1/profile/email-provider');
    expect(result).toEqual({ configured: true, secret_set: true, etag: 'W/"1"' });
  });

  it('saveProvider sends the ETag in the request body, not as a header', async () => {
    apiMock.put.mockResolvedValue({ data: { configured: true, etag: 'W/"2"' } });
    await emailProviderService.saveProvider(request, 'W/"1"');
    expect(apiMock.put).toHaveBeenCalledTimes(1);
    const [url, body, config] = apiMock.put.mock.calls[0];
    expect(url).toBe('/v1/profile/email-provider');
    expect(body).toEqual({ ...request, etag: 'W/"1"' });
    expect(config).toBeUndefined();
  });

  it('saveProvider omits the etag on first save', async () => {
    apiMock.put.mockResolvedValue({ data: { configured: true } });
    await emailProviderService.saveProvider(request);
    expect(apiMock.put.mock.calls[0][1]).not.toHaveProperty('etag');
  });

  it('saveProvider sets isConcurrencyConflict on a 409', async () => {
    apiMock.put.mockRejectedValue(apiError(409, 'Email settings were modified by another process'));
    const err = (await emailProviderService.saveProvider(request, 'old').catch((e) => e)) as EmailProviderServiceError;
    expect(err).toBeInstanceOf(Error);
    expect(err.isConcurrencyConflict).toBe(true);
  });

  it('saveProvider keeps the server message and details on validation errors', async () => {
    apiMock.put.mockRejectedValue(apiError(400, 'Validation failed', 'ERROR', { errors: ['Host is not allowed'] }));
    const err = (await emailProviderService.saveProvider(request).catch((e) => e)) as EmailProviderServiceError;
    expect(err.message).toBe('Validation failed\n• Host is not allowed');
    expect(err.isConcurrencyConflict).toBeUndefined();
    expect(err.code).toBeUndefined();
  });

  it('deleteProvider calls DELETE', async () => {
    apiMock.delete.mockResolvedValue({ data: { message: 'ok' } });
    await emailProviderService.deleteProvider();
    expect(apiMock.delete).toHaveBeenCalledWith('/v1/profile/email-provider');
  });

  it('sendTestEmail posts to the /test route and returns the payload', async () => {
    apiMock.post.mockResolvedValue({
      data: { message: 'Test email sent', recipient_email: 'me@example.com', result: 'success' },
    });
    const result = await emailProviderService.sendTestEmail();
    expect(apiMock.post).toHaveBeenCalledWith('/v1/profile/email-provider/test');
    expect(result.recipient_email).toBe('me@example.com');
  });

  it.each([
    [409, 'EMAIL_PROVIDER_NOT_CONFIGURED'],
    [502, 'EMAIL_AUTH_FAILED'],
    [502, 'EMAIL_CONNECTION_FAILED'],
    [502, 'EMAIL_REJECTED'],
  ])('sendTestEmail exposes error.code for %i %s while keeping error.message', async (status, code) => {
    apiMock.post.mockRejectedValue(apiError(status, `server text for ${code}`, code));
    const err = (await emailProviderService.sendTestEmail().catch((e) => e)) as EmailProviderServiceError;
    expect(err.code).toBe(code);
    expect(err.message).toBe(`server text for ${code}`);
  });

  it('uses the fallback message when there is no response body', async () => {
    apiMock.get.mockRejectedValue(new Error('Network Error'));
    const err = (await emailProviderService.getProvider().catch((e) => e)) as EmailProviderServiceError;
    expect(err.message).toBe('Failed to load email settings');
    expect(err.code).toBeUndefined();
  });
});
