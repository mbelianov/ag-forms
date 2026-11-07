// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { EmailProviderSettings } from '../../types';

const authMock = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));
const serviceMock = vi.hoisted(() => ({
  getProvider: vi.fn(),
  saveProvider: vi.fn(),
  deleteProvider: vi.fn(),
  sendTestEmail: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => authMock);
vi.mock('../../services/emailProviderService', () => ({ emailProviderService: serviceMock }));

import EmailSettingsPage from './EmailSettingsPage';

// jsdom has no ResizeObserver, which Carbon's TextArea (character counter) uses.
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
);

const SECRET = 'super-secret-app-password';

const configured: EmailProviderSettings = {
  configured: true,
  provider: 'google',
  host: 'smtp.gmail.com',
  port: 587,
  security: 'starttls',
  username: 'dr.ivanova@gmail.com',
  from_email: 'dr.ivanova@gmail.com',
  from_name: 'Dr. Maria Ivanova',
  footer: 'Clinic footer',
  secret_set: true,
  last_tested_at: '2026-11-07T10:00:00Z',
  last_test_status: 'success',
  etag: 'W/"etag-1"',
};

async function renderPage(initial: EmailProviderSettings = { configured: false }) {
  serviceMock.getProvider.mockResolvedValue(initial);
  render(
    <MemoryRouter>
      <EmailSettingsPage />
    </MemoryRouter>
  );
  await screen.findByRole('heading', { name: 'Email Settings' });
}

const input = (label: string) => screen.getByLabelText(label) as HTMLInputElement;

function codeError(code: string, message = 'server message') {
  return Object.assign(new Error(message), { code });
}

describe('EmailSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.useAuth.mockReturnValue({
      user: { id: 'u1', username: 'maria', full_name: 'Dr. Maria Ivanova', email: 'm@example.com', role: 'doctor' },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('shows "Not configured" and defaults on first visit', async () => {
    await renderPage();
    expect(screen.getByText('Not configured')).toBeTruthy();
    expect(input('SMTP host').value).toBe('smtp.gmail.com');
    expect(input('From name (optional)').value).toBe('Dr. Maria Ivanova');
    // Default footer is pre-filled (REQ-EML-01 1.6a)
    expect((screen.getByLabelText('Email footer (optional)') as HTMLTextAreaElement).value).toContain(
      'The examination report is attached as a PDF.'
    );
    expect((screen.getByRole('button', { name: 'Send test email' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Remove settings' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows the configured status with last-tested info and never puts a password in the form', async () => {
    await renderPage(configured);
    expect(screen.getByText('Configured')).toBeTruthy();
    expect(screen.getByText(/Last tested:.*success/)).toBeTruthy();
    const password = input('Password / API key');
    expect(password.value).toBe('');
    expect(password.placeholder).toBe('Saved — leave empty to keep');
    expect(document.body.innerHTML).not.toContain(SECRET);
  });

  it('locks host, port and security for presets and unlocks them for Generic', async () => {
    await renderPage();
    expect(input('SMTP host').readOnly).toBe(true);
    expect(input('Port').readOnly).toBe(true);
    expect((screen.getByLabelText('Security') as HTMLSelectElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Provider'), { target: { value: 'yahoo' } });
    expect(input('SMTP host').value).toBe('smtp.mail.yahoo.com');
    expect(input('SMTP host').readOnly).toBe(true);

    fireEvent.change(screen.getByLabelText('Provider'), { target: { value: 'generic' } });
    expect(input('SMTP host').readOnly).toBe(false);
    expect(input('Port').readOnly).toBe(false);
    expect((screen.getByLabelText('Security') as HTMLSelectElement).disabled).toBe(false);
  });

  it('shows the app-password helper text for presets', async () => {
    await renderPage();
    expect(screen.getByText(/Use an app password, not your normal account password/)).toBeTruthy();
    expect(screen.getByText(/never asks for a verification code/)).toBeTruthy();
  });

  it('requires a password on first save and does not call the API', async () => {
    await renderPage();
    fireEvent.change(input('Username'), { target: { value: 'dr@gmail.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Password / API key is required')).toBeTruthy();
    expect(serviceMock.saveProvider).not.toHaveBeenCalled();
  });

  it('defaults From address to the username and saves a new configuration, then clears the password field', async () => {
    serviceMock.saveProvider.mockResolvedValue({ ...configured, etag: 'W/"etag-2"' });
    await renderPage();
    fireEvent.change(input('Username'), { target: { value: 'dr.ivanova@gmail.com' } });
    expect(input('From address').value).toBe('dr.ivanova@gmail.com');
    fireEvent.change(input('Password / API key'), { target: { value: SECRET } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(serviceMock.saveProvider).toHaveBeenCalledTimes(1));
    const [payload, etag] = serviceMock.saveProvider.mock.calls[0];
    expect(payload).toMatchObject({
      provider: 'google',
      username: 'dr.ivanova@gmail.com',
      from_email: 'dr.ivanova@gmail.com',
      password: SECRET,
    });
    // Presets: connection fields are left to the server
    expect(payload).not.toHaveProperty('host');
    expect(etag).toBeUndefined();

    expect(await screen.findByText('Email settings saved.')).toBeTruthy();
    expect(screen.getByText('Configured')).toBeTruthy();
    expect(input('Password / API key').value).toBe('');
    expect(document.body.innerHTML).not.toContain(SECRET);
  });

  it('updates without a password (keeps the stored one) and passes the ETag', async () => {
    serviceMock.saveProvider.mockResolvedValue({ ...configured, footer: 'New footer', etag: 'W/"etag-2"' });
    await renderPage(configured);
    fireEvent.change(screen.getByLabelText('Email footer (optional)'), { target: { value: 'New footer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(serviceMock.saveProvider).toHaveBeenCalledTimes(1));
    const [payload, etag] = serviceMock.saveProvider.mock.calls[0];
    expect(payload).not.toHaveProperty('password');
    expect(payload.footer).toBe('New footer');
    expect(etag).toBe('W/"etag-1"');
  });

  it('sends host, port and security for Generic and validates them', async () => {
    serviceMock.saveProvider.mockResolvedValue({ ...configured, provider: 'generic', host: 'smtp.example.com' });
    await renderPage();
    fireEvent.change(screen.getByLabelText('Provider'), { target: { value: 'generic' } });
    fireEvent.change(input('Username'), { target: { value: 'apikey' } });
    fireEvent.change(input('From address'), { target: { value: 'dr@example.com' } });
    fireEvent.change(input('Password / API key'), { target: { value: SECRET } });

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Host is required')).toBeTruthy();
    expect(serviceMock.saveProvider).not.toHaveBeenCalled();

    fireEvent.change(input('SMTP host'), { target: { value: 'smtp.example.com' } });
    fireEvent.change(input('Port'), { target: { value: '465' } });
    fireEvent.change(screen.getByLabelText('Security'), { target: { value: 'ssl' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(serviceMock.saveProvider).toHaveBeenCalledTimes(1));
    expect(serviceMock.saveProvider.mock.calls[0][0]).toMatchObject({
      provider: 'generic',
      host: 'smtp.example.com',
      port: 465,
      security: 'ssl',
    });
  });

  it('requires the From address to match the username for Google/Yahoo', async () => {
    await renderPage();
    fireEvent.change(input('Username'), { target: { value: 'dr@gmail.com' } });
    fireEvent.change(input('From address'), { target: { value: 'other@gmail.com' } });
    fireEvent.change(input('Password / API key'), { target: { value: SECRET } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(/From address must match the username/)).toBeTruthy();
    expect(serviceMock.saveProvider).not.toHaveBeenCalled();
  });

  it('shows a character counter for the footer and rejects more than 500 characters', async () => {
    await renderPage(configured);
    expect(screen.getByText(`${'Clinic footer'.length}/500`)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Email footer (optional)'), { target: { value: 'x'.repeat(501) } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Footer must not exceed 500 characters')).toBeTruthy();
    expect(serviceMock.saveProvider).not.toHaveBeenCalled();
  });

  it('handles a concurrency conflict on save and offers a reload', async () => {
    serviceMock.saveProvider.mockRejectedValue(
      Object.assign(new Error('Your email settings were modified elsewhere. Please reload the page and try again.'), {
        isConcurrencyConflict: true,
      })
    );
    await renderPage(configured);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(/modified elsewhere/)).toBeTruthy();

    serviceMock.getProvider.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Reload settings' }));
    await waitFor(() => expect(serviceMock.getProvider).toHaveBeenCalledTimes(1));
  });

  it('sends a test email and reports the recipient', async () => {
    serviceMock.sendTestEmail.mockResolvedValue({ message: 'Test email sent', recipient_email: 'm@example.com', result: 'success' });
    await renderPage(configured);
    fireEvent.click(screen.getByRole('button', { name: 'Send test email' }));
    expect(await screen.findByText('Test email sent to m@example.com.')).toBeTruthy();
  });

  it.each([
    ['EMAIL_AUTH_FAILED', 'Your mail provider rejected the login. For Google/Yahoo use an app password'],
    ['EMAIL_CONNECTION_FAILED', 'Could not reach your mail server'],
    ['EMAIL_REJECTED', 'Your mail provider rejected the message'],
    ['EMAIL_PROVIDER_NOT_CONFIGURED', 'Configure your email provider in Email Settings'],
  ])('maps test email error %s to a clear message', async (code, text) => {
    serviceMock.sendTestEmail.mockRejectedValue(codeError(code, 'raw server text'));
    await renderPage(configured);
    fireEvent.click(screen.getByRole('button', { name: 'Send test email' }));
    expect(await screen.findByText(text)).toBeTruthy();
    expect(screen.queryByText('raw server text')).toBeNull();
  });

  it('falls back to the server message for unknown errors', async () => {
    serviceMock.sendTestEmail.mockRejectedValue(new Error('Email settings are temporarily unavailable'));
    await renderPage(configured);
    fireEvent.click(screen.getByRole('button', { name: 'Send test email' }));
    expect(await screen.findByText('Email settings are temporarily unavailable')).toBeTruthy();
  });

  it('asks for confirmation before removing settings', async () => {
    serviceMock.deleteProvider.mockResolvedValue(undefined);
    await renderPage(configured);

    fireEvent.click(screen.getByRole('button', { name: 'Remove settings' }));
    expect(await screen.findByText('Remove email settings')).toBeTruthy();
    expect(serviceMock.deleteProvider).not.toHaveBeenCalled();

    // Cancel does nothing
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(serviceMock.deleteProvider).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Remove settings' }));
    const confirmButtons = await screen.findAllByRole('button', { name: 'Remove settings' });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => expect(serviceMock.deleteProvider).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Email settings removed.')).toBeTruthy();
    expect(screen.getByText('Not configured')).toBeTruthy();
  });

  it('shows an error when loading the settings fails', async () => {
    serviceMock.getProvider.mockRejectedValue(new Error('Failed to load email settings'));
    render(
      <MemoryRouter>
        <EmailSettingsPage />
      </MemoryRouter>
    );
    expect(await screen.findByText('Failed to load email settings')).toBeTruthy();
  });
});
