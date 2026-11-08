import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Form,
  Stack,
  Select,
  SelectItem,
  TextInput,
  PasswordInput,
  TextArea,
  Button,
  InlineNotification,
  Breadcrumb,
  BreadcrumbItem,
  Tile,
  Tag,
  Modal,
} from '@carbon/react';
import { ArrowLeft } from '@carbon/icons-react';
import { useAuth } from '../../contexts/AuthContext';
import { emailProviderService } from '../../services/emailProviderService';
import type { EmailProviderServiceError } from '../../services/emailProviderService';
import type {
  EmailProviderSettings,
  EmailProviderType,
  EmailSecurityMode,
  SaveEmailProviderRequest,
} from '../../types';
import {
  EMAIL_PROVIDER_PRESETS,
  SECURITY_LABELS,
  MAX_FOOTER_LENGTH,
  MAX_FROM_NAME_LENGTH,
  DEFAULT_EMAIL_FOOTER,
  getEmailProviderPreset,
} from '../../constants/emailProviders';
import { getEmailErrorMessage, isEmailErrorCode, EMAIL_ERROR_MESSAGES } from '../../utils/emailErrors';
import { useAutoNotification } from '../../utils/useAutoNotification';
import PageLoader from '../../components/PageLoader';

interface FormState {
  provider: EmailProviderType;
  host: string;
  port: string;
  security: EmailSecurityMode;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string;
  footer: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HOST_PATTERN = /^[a-zA-Z0-9.-]+$/;

function formatDateTime(iso?: string): string | undefined {
  if (!iso) return undefined;
  return new Date(iso).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function describeTestStatus(status?: string): string {
  if (!status) return 'unknown';
  if (status === 'success') return 'success';
  return isEmailErrorCode(status) ? EMAIL_ERROR_MESSAGES[status] : 'failed';
}

function formFromSettings(settings: EmailProviderSettings): FormState {
  const provider = settings.provider ?? 'google';
  const preset = getEmailProviderPreset(provider).connection;
  return {
    provider,
    host: preset?.host ?? settings.host ?? '',
    port: String(preset?.port ?? settings.port ?? 587),
    security: preset?.security ?? settings.security ?? 'starttls',
    username: settings.username ?? '',
    password: '',
    fromEmail: settings.from_email ?? '',
    fromName: settings.from_name ?? '',
    footer: settings.footer ?? '',
  };
}

function defaultForm(fullName: string): FormState {
  return {
    provider: 'google',
    host: 'smtp.gmail.com',
    port: '587',
    security: 'starttls',
    username: '',
    password: '',
    fromEmail: '',
    fromName: fullName,
    footer: DEFAULT_EMAIL_FOOTER,
  };
}

export default function EmailSettingsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const defaultFullName = user?.full_name || '';

  const [settings, setSettings] = useState<EmailProviderSettings | null>(null);
  const [form, setForm] = useState<FormState>(() => defaultForm(defaultFullName));
  const [fromEmailTouched, setFromEmailTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasConflict, setHasConflict] = useState(false);

  const clearSuccess = useCallback(() => setSuccessMessage(null), []);
  useAutoNotification(successMessage, clearSuccess);

  const applySettings = useCallback(
    (loaded: EmailProviderSettings) => {
      setSettings(loaded);
      if (loaded.configured) {
        setForm(formFromSettings(loaded));
        setFromEmailTouched(true);
      } else {
        setForm(defaultForm(defaultFullName));
        setFromEmailTouched(false);
      }
      setErrors({});
    },
    [defaultFullName]
  );

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      applySettings(await emailProviderService.getProvider());
      setErrorMessage(null);
      setHasConflict(false);
    } catch (err) {
      setErrorMessage(getEmailErrorMessage(err, 'Failed to load email settings'));
    } finally {
      setIsLoading(false);
    }
  }, [applySettings]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  /** Refresh status line and ETag only; unsaved form edits are kept. */
  const refreshStatus = async () => {
    try {
      setSettings(await emailProviderService.getProvider());
    } catch {
      // The status line is informational; the next explicit reload shows the error.
    }
  };

  const isPreset = form.provider !== 'generic';
  const isConfigured = !!settings?.configured;
  const secretSet = !!settings?.secret_set;
  const isBusy = isSaving || isTesting || isDeleting;

  const clearFieldError = (field: string) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleField = (field: keyof FormState, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      // From address follows the username until the doctor edits it (REQ-EML-01 1.6)
      if (field === 'username' && !fromEmailTouched) {
        next.fromEmail = EMAIL_PATTERN.test(value.trim()) ? value.trim() : '';
      }
      return next;
    });
    if (field === 'fromEmail') setFromEmailTouched(true);
    clearFieldError(field);
    if (field === 'username') clearFieldError('fromEmail');
  };

  const handleProviderChange = (value: EmailProviderType) => {
    const preset = getEmailProviderPreset(value).connection;
    setForm((prev) => ({
      ...prev,
      provider: value,
      host: preset ? preset.host : prev.provider === 'generic' ? prev.host : '',
      port: preset ? String(preset.port) : prev.provider === 'generic' ? prev.port : '587',
      security: preset ? preset.security : prev.provider === 'generic' ? prev.security : 'starttls',
    }));
    clearFieldError('host');
    clearFieldError('port');
    clearFieldError('fromEmail');
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    const username = form.username.trim();
    const fromEmail = form.fromEmail.trim();

    if (!username) {
      next.username = 'Username is required';
    } else if (username.length > 254) {
      next.username = 'Username must not exceed 254 characters';
    }

    if (!secretSet && !form.password.trim()) {
      next.password = 'Password / API key is required';
    } else if (form.password.length > 512) {
      next.password = 'Password must not exceed 512 characters';
    }

    if (!fromEmail) {
      next.fromEmail = 'From address is required';
    } else if (!EMAIL_PATTERN.test(fromEmail) || fromEmail.length > 254) {
      next.fromEmail = 'Enter a valid email address';
    } else if (isPreset && username && fromEmail.toLowerCase() !== username.toLowerCase()) {
      next.fromEmail = `For ${getEmailProviderPreset(form.provider).label} the From address must match the username`;
    }

    if (form.fromName.length > MAX_FROM_NAME_LENGTH) {
      next.fromName = `From name must not exceed ${MAX_FROM_NAME_LENGTH} characters`;
    }
    if (form.footer.length > MAX_FOOTER_LENGTH) {
      next.footer = `Footer must not exceed ${MAX_FOOTER_LENGTH} characters`;
    }

    if (!isPreset) {
      const host = form.host.trim();
      if (!host) {
        next.host = 'Host is required';
      } else if (host.length > 255 || !HOST_PATTERN.test(host)) {
        next.host = 'Enter a hostname without scheme, path or port';
      }
      const port = Number(form.port);
      if (!/^\d+$/.test(form.port.trim()) || port < 1 || port > 65535) {
        next.port = 'Port must be between 1 and 65535';
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setHasConflict(false);
    if (!validate()) return;

    const payload: SaveEmailProviderRequest = {
      provider: form.provider,
      username: form.username.trim(),
      from_email: form.fromEmail.trim(),
      from_name: form.fromName.trim(),
      footer: form.footer,
      ...(form.password.trim() ? { password: form.password } : {}),
      ...(isPreset
        ? {}
        : { host: form.host.trim(), port: Number(form.port), security: form.security }),
    };

    setIsSaving(true);
    try {
      const saved = await emailProviderService.saveProvider(payload, isConfigured ? settings?.etag : undefined);
      applySettings(saved);
      setSuccessMessage('Email settings saved.');
    } catch (err) {
      setErrorMessage(getEmailErrorMessage(err, 'Failed to save email settings'));
      if ((err as EmailProviderServiceError).isConcurrencyConflict) setHasConflict(true);
      // Never keep the typed secret around after a failed attempt either
      setForm((prev) => ({ ...prev, password: '' }));
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsTesting(true);
    try {
      const result = await emailProviderService.sendTestEmail();
      setSuccessMessage(`Test email sent to ${result.recipient_email}.`);
    } catch (err) {
      setErrorMessage(getEmailErrorMessage(err, 'Failed to send test email'));
    } finally {
      // The server stores the test result and changes the ETag; keep both up to date.
      await refreshStatus();
      setIsTesting(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setErrorMessage(null);
    try {
      await emailProviderService.deleteProvider();
      setDeleteOpen(false);
      applySettings({ configured: false });
      setSuccessMessage('Email settings removed.');
    } catch (err) {
      setDeleteOpen(false);
      setErrorMessage(getEmailErrorMessage(err, 'Failed to remove email settings'));
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) return <PageLoader description="Loading email settings..." />;

  const lastTested = formatDateTime(settings?.last_tested_at);
  const providerNote =
    form.provider === 'generic'
      ? 'Enter the SMTP server of your mail provider. Use the app password or API key it gives you as the password.'
      : 'Use an app password, not your normal account password. 2-step verification is needed only once, on the provider’s website, to generate the app password. It is not asked again when sending, and this form never asks for a verification code.';

  return (
    <div style={{ padding: '2rem', maxWidth: '700px', margin: '0 auto' }}>
      <Breadcrumb noTrailingSlash style={{ marginBottom: '1rem' }}>
        <BreadcrumbItem href="/dashboard">Home</BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>Email Settings</BreadcrumbItem>
      </Breadcrumb>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <Button
          kind="ghost"
          renderIcon={ArrowLeft}
          onClick={() => navigate('/dashboard')}
          hasIconOnly
          iconDescription="Back to Dashboard"
        />
        <h1>Email Settings</h1>
      </div>

      <Tile>
        <div style={{ marginBottom: '1.5rem' }} aria-live="polite">
          {isConfigured ? (
            <>
              <Tag type="green">Configured</Tag>
              <span style={{ marginLeft: '0.75rem', fontSize: '0.875rem' }}>
                {lastTested
                  ? `Last tested: ${lastTested} — ${describeTestStatus(settings?.last_test_status)}`
                  : 'Not tested yet'}
              </span>
            </>
          ) : (
            <Tag type="gray">Not configured</Tag>
          )}
        </div>

        {successMessage && (
          <InlineNotification
            kind="success"
            title="Success"
            subtitle={successMessage}
            onCloseButtonClick={clearSuccess}
            lowContrast
            style={{ marginBottom: '1.5rem' }}
          />
        )}

        {errorMessage && (
          <InlineNotification
            kind="error"
            title="Error"
            subtitle={errorMessage}
            onCloseButtonClick={() => setErrorMessage(null)}
            lowContrast
            style={{ marginBottom: '1.5rem' }}
          />
        )}

        {hasConflict && (
          <Button kind="tertiary" size="sm" onClick={load} style={{ marginBottom: '1.5rem' }}>
            Reload settings
          </Button>
        )}

        <Form onSubmit={handleSave}>
          <Stack gap={6}>
            <Select
              id="email-provider"
              labelText="Provider"
              helperText={providerNote}
              value={form.provider}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                handleProviderChange(e.target.value as EmailProviderType)
              }
              disabled={isBusy}
            >
              {EMAIL_PROVIDER_PRESETS.map((p) => (
                <SelectItem key={p.id} value={p.id} text={p.label} />
              ))}
            </Select>

            <TextInput
              id="email-host"
              labelText="SMTP host"
              value={form.host}
              onChange={(e) => handleField('host', e.target.value)}
              readOnly={isPreset}
              helperText={isPreset ? 'Set by the selected provider' : undefined}
              invalid={!!errors.host}
              invalidText={errors.host}
              disabled={isBusy}
              autoComplete="off"
            />

            <TextInput
              id="email-port"
              labelText="Port"
              inputMode="numeric"
              value={form.port}
              onChange={(e) => handleField('port', e.target.value)}
              readOnly={isPreset}
              invalid={!!errors.port}
              invalidText={errors.port}
              disabled={isBusy}
              autoComplete="off"
            />

            <Select
              id="email-security"
              labelText="Security"
              value={form.security}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                handleField('security', e.target.value)
              }
              disabled={isBusy || isPreset}
            >
              {(Object.keys(SECURITY_LABELS) as EmailSecurityMode[]).map((s) => (
                <SelectItem key={s} value={s} text={SECURITY_LABELS[s]} />
              ))}
            </Select>

            <TextInput
              id="email-username"
              labelText="Username"
              helperText={isPreset ? 'Your full email address' : undefined}
              value={form.username}
              onChange={(e) => handleField('username', e.target.value)}
              invalid={!!errors.username}
              invalidText={errors.username}
              disabled={isBusy}
              autoComplete="off"
            />

            <PasswordInput
              id="email-password"
              labelText="Password / API key"
              helperText={
                secretSet
                  ? 'A password is saved. Leave empty to keep it, or enter a new one to replace it.'
                  : 'Required. It is stored encrypted and is never shown again.'
              }
              placeholder={secretSet ? 'Saved — leave empty to keep' : ''}
              value={form.password}
              onChange={(e) => handleField('password', e.target.value)}
              invalid={!!errors.password}
              invalidText={errors.password}
              disabled={isBusy}
              autoComplete="new-password"
            />

            <TextInput
              id="email-from-email"
              labelText="From address"
              value={form.fromEmail}
              onChange={(e) => handleField('fromEmail', e.target.value)}
              invalid={!!errors.fromEmail}
              invalidText={errors.fromEmail}
              disabled={isBusy}
              autoComplete="off"
            />

            <TextInput
              id="email-from-name"
              labelText="From name (optional)"
              value={form.fromName}
              onChange={(e) => handleField('fromName', e.target.value)}
              invalid={!!errors.fromName}
              invalidText={errors.fromName}
              disabled={isBusy}
              autoComplete="off"
            />

            <TextArea
              id="email-footer"
              labelText="Email footer (optional)"
              helperText="Plain text added to every report email, for example clinic name and contact details. When empty, a default footer is used."
              value={form.footer}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleField('footer', e.target.value)}
              enableCounter
              maxCount={MAX_FOOTER_LENGTH}
              rows={4}
              invalid={!!errors.footer}
              invalidText={errors.footer}
              disabled={isBusy}
            />

            <Stack orientation="horizontal" gap={4}>
              <Button type="submit" disabled={isBusy}>
                {isSaving ? 'Saving…' : 'Save'}
              </Button>
              <Button kind="secondary" onClick={handleTest} disabled={isBusy || !isConfigured}>
                {isTesting ? 'Sending…' : 'Send test email'}
              </Button>
              <Button
                kind="danger--tertiary"
                onClick={() => setDeleteOpen(true)}
                disabled={isBusy || !isConfigured}
              >
                Remove settings
              </Button>
            </Stack>
            <p style={{ fontSize: '0.75rem', color: '#525252' }}>
              “Send test email” uses the saved settings and sends a short message to your own account email address.
            </p>
          </Stack>
        </Form>
      </Tile>

      {deleteOpen && (
        <Modal
          open
          danger
          modalHeading="Remove email settings"
          primaryButtonText={isDeleting ? 'Removing…' : 'Remove settings'}
          secondaryButtonText="Cancel"
          primaryButtonDisabled={isDeleting}
          onRequestSubmit={handleDelete}
          onRequestClose={() => setDeleteOpen(false)}
          onSecondarySubmit={() => setDeleteOpen(false)}
        >
          <p>
            This deletes your saved mail provider settings, including the encrypted password. You will not be able
            to email reports until you configure a provider again.
          </p>
        </Modal>
      )}
    </div>
  );
}

// Made with Bob
