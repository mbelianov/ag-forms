import type { EmailProviderType, EmailSecurityMode } from '../types';

export interface EmailProviderPresetConfig {
  id: EmailProviderType;
  label: string;
  /** Preset connection values; null for the Generic option (fully manual). */
  connection: { host: string; port: number; security: EmailSecurityMode } | null;
}

/** Mirrors api/src/shared/email/presets.ts (the server overwrites host/port/security for presets anyway). */
export const EMAIL_PROVIDER_PRESETS: EmailProviderPresetConfig[] = [
  {
    id: 'google',
    label: 'Google (Gmail)',
    connection: { host: 'smtp.gmail.com', port: 587, security: 'starttls' },
  },
  {
    id: 'yahoo',
    label: 'Yahoo Mail',
    connection: { host: 'smtp.mail.yahoo.com', port: 587, security: 'starttls' },
  },
  { id: 'generic', label: 'Generic SMTP', connection: null },
];

export const SECURITY_LABELS: Record<EmailSecurityMode, string> = {
  starttls: 'STARTTLS',
  ssl: 'SSL/TLS',
};

export const MAX_FOOTER_LENGTH = 500;
export const MAX_FROM_NAME_LENGTH = 100;

/** Same text as DEFAULT_EMAIL_FOOTER in the API; pre-filled the first time settings are saved (REQ-EML-01 1.6a). */
export const DEFAULT_EMAIL_FOOTER =
  'The examination report is attached as a PDF. This message is confidential and intended only for the addressee.';

export function getEmailProviderPreset(id: EmailProviderType): EmailProviderPresetConfig {
  return EMAIL_PROVIDER_PRESETS.find((p) => p.id === id) ?? EMAIL_PROVIDER_PRESETS[2];
}

// Made with Bob
