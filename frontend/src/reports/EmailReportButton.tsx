import { useCallback, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Button,
  Modal,
  TextInput,
  TextArea,
  Stack,
  InlineNotification,
  InlineLoading,
} from '@carbon/react';
import { Email } from '@carbon/icons-react';
import type { EmailProviderSettings, Examination } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { examinationService } from '../services/examinationService';
import { patientService } from '../services/patientService';
import { emailProviderService } from '../services/emailProviderService';
import { getExamTypeLabel } from '../constants/examinationTypes';
import { EMAIL_ERROR_MESSAGES, getEmailErrorCode, getEmailErrorMessage } from '../utils/emailErrors';
import { useAutoNotification } from '../utils/useAutoNotification';
import { printService } from './printService';

interface EmailReportButtonProps {
  examination: Examination;
}

const MAX_SUBJECT_LENGTH = 200;
const MAX_MESSAGE_LENGTH = 2000;

/** Single, well-formed address: no whitespace, list separators or display-name forms. */
const SINGLE_EMAIL_PATTERN = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

/** Default subject, matching the server default (REQ-EML-03 3.8): no patient name, no MRN. */
function buildDefaultSubject(examination: Examination): string {
  const label = getExamTypeLabel(examination.examinationType ?? 'prenatal');
  const datePart = (examination.examDate || '').slice(0, 10) || 'unknown date';
  return `Examination report \u2014 ${label} \u2014 ${datePart}`;
}

/** Base64-encode a Blob (the PDF) without a data-URL prefix. */
async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export default function EmailReportButton({ examination }: EmailReportButtonProps) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [provider, setProvider] = useState<EmailProviderSettings | null>(null);
  const [profileEmail, setProfileEmail] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [subject, setSubject] = useState(() => buildDefaultSubject(examination));
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [recipientTouched, setRecipientTouched] = useState(false);
  const openCounter = useRef(0);

  const closeDialog = useCallback(() => {
    setIsOpen(false);
    setSuccessMessage(null);
  }, []);
  useAutoNotification(successMessage, closeDialog);

  // Defence in depth: the detail page already gates the button, the component must not rely on it.
  if (user?.role !== 'admin' && user?.role !== 'doctor') {
    return null;
  }

  const handleOpen = async () => {
    const openId = ++openCounter.current;
    setSendError(null);
    setLoadError(null);
    setSuccessMessage(null);
    setRecipientTouched(false);
    setProvider(null);
    setProfileEmail('');
    setRecipientEmail('');
    setSubject(buildDefaultSubject(examination));
    setMessage('');
    setIsOpen(true);
    setIsLoading(true);

    const [patientResult, providerResult] = await Promise.allSettled([
      patientService.getPatient(examination.patientId),
      emailProviderService.getProvider(),
    ]);
    if (openId !== openCounter.current) return; // dialog was reopened meanwhile

    if (patientResult.status === 'fulfilled') {
      const email = patientResult.value.email?.trim() ?? '';
      setProfileEmail(email);
      setRecipientEmail(email);
    } else {
      setLoadError(getEmailErrorMessage(patientResult.reason, 'Failed to load the patient'));
    }
    if (providerResult.status === 'fulfilled') {
      setProvider(providerResult.value);
    } else {
      setLoadError(getEmailErrorMessage(providerResult.reason, 'Failed to load email settings'));
    }
    setIsLoading(false);
  };

  const handleClose = () => {
    if (isSending) return;
    closeDialog();
  };

  const trimmedRecipient = recipientEmail.trim();
  const recipientValid = SINGLE_EMAIL_PATTERN.test(trimmedRecipient);
  const recipientError =
    recipientTouched && !recipientValid
      ? trimmedRecipient
        ? 'Please enter a single, valid email address'
        : 'Recipient email is required'
      : '';
  const isNotConfigured = provider !== null && !provider.configured;
  const isDifferentFromProfile =
    !!profileEmail && recipientValid && trimmedRecipient.toLowerCase() !== profileEmail.toLowerCase();
  const canSend =
    !isLoading && provider?.configured === true && recipientValid && !isSending && !successMessage;

  const handleSend = async () => {
    if (!canSend) return;

    setIsSending(true);
    setSendError(null);
    try {
      // PDF generation happens only here, after the doctor confirmed (REQ-EML-04 4.2a).
      const pdfBlob = await printService.getPdfBlob(examination);
      const pdfBase64 = await blobToBase64(pdfBlob);

      const result = await examinationService.emailReport(examination.examinationId, {
        // Only an address that differs from the profile email is an override (audited as such).
        recipient_email: isDifferentFromProfile || !profileEmail ? trimmedRecipient : undefined,
        subject: subject.trim() || buildDefaultSubject(examination),
        message: message.trim() || undefined,
        file_name: `${examination.mrn}_${examination.examDate}.pdf`,
        pdf_base64: pdfBase64,
      });

      setSuccessMessage(`Report accepted for delivery to ${result?.recipient_email || trimmedRecipient}`);
    } catch (err) {
      if (getEmailErrorCode(err) === 'EMAIL_PROVIDER_NOT_CONFIGURED') {
        setProvider({ configured: false });
      }
      setSendError(getEmailErrorMessage(err, 'Failed to send report'));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <Button
        kind="ghost"
        renderIcon={Email}
        onClick={handleOpen}
        aria-label="Email examination report"
      >
        Email Report
      </Button>

      <Modal
        open={isOpen}
        modalHeading="Email Report"
        primaryButtonText="Confirm and send"
        secondaryButtonText={successMessage ? 'Close' : 'Cancel'}
        primaryButtonDisabled={!canSend}
        onRequestSubmit={handleSend}
        onRequestClose={handleClose}
        onSecondarySubmit={handleClose}
        preventCloseOnClickOutside
      >
        {successMessage && (
          <InlineNotification
            kind="success"
            title="Report accepted"
            subtitle={successMessage}
            lowContrast
            hideCloseButton
            style={{ marginBottom: '1rem' }}
          />
        )}
        {sendError && (
          <InlineNotification
            kind="error"
            title="Failed to send"
            subtitle={sendError}
            onCloseButtonClick={() => setSendError(null)}
            lowContrast
            style={{ marginBottom: '1rem' }}
          />
        )}
        {loadError && (
          <InlineNotification
            kind="error"
            title="Could not load data"
            subtitle={loadError}
            onCloseButtonClick={() => setLoadError(null)}
            lowContrast
            style={{ marginBottom: '1rem' }}
          />
        )}

        {isLoading && <InlineLoading description="Loading…" />}

        {isNotConfigured && (
          <>
            <InlineNotification
              kind="warning"
              title="Email provider not configured"
              subtitle={EMAIL_ERROR_MESSAGES.EMAIL_PROVIDER_NOT_CONFIGURED}
              hideCloseButton
              lowContrast
              style={{ marginBottom: '0.5rem' }}
            />
            {/* Carbon notifications must not contain interactive children, so the link sits below. */}
            <RouterLink to="/email-settings">Go to Email Settings</RouterLink>
          </>
        )}

        {!isLoading && provider?.configured && (
          <Stack gap={5} style={{ marginTop: '1rem' }}>
            {examination.status === 'draft' && (
              <InlineNotification
                kind="warning"
                title="Draft"
                subtitle="This examination is a draft and may be incomplete."
                hideCloseButton
                lowContrast
              />
            )}
            {!profileEmail && !loadError && (
              <InlineNotification
                kind="warning"
                title="No patient email"
                subtitle="Patient has no email in the profile"
                hideCloseButton
                lowContrast
              />
            )}

            <p>
              From: {provider.from_name ? `${provider.from_name} <${provider.from_email}>` : provider.from_email}
            </p>

            <TextInput
              id="recipientEmail"
              labelText="Recipient Email"
              placeholder="patient@example.com"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              onBlur={() => setRecipientTouched(true)}
              invalid={!!recipientError}
              invalidText={recipientError}
              type="email"
              disabled={isSending}
            />
            {isDifferentFromProfile && (
              <InlineNotification
                kind="info"
                title="Different recipient"
                subtitle="Different from the patient's email in the profile — this will be recorded in the audit log"
                hideCloseButton
                lowContrast
              />
            )}
            <TextInput
              id="emailSubject"
              labelText="Subject"
              value={subject}
              maxLength={MAX_SUBJECT_LENGTH}
              onChange={(e) => setSubject(e.target.value)}
              disabled={isSending}
            />
            <TextArea
              id="emailMessage"
              labelText="Message (optional)"
              rows={4}
              value={message}
              enableCounter
              maxCount={MAX_MESSAGE_LENGTH}
              onChange={(e) => setMessage(e.target.value)}
              disabled={isSending}
            />
            {isSending && (
              <InlineLoading description="Generating PDF and sending…" />
            )}
          </Stack>
        )}
      </Modal>
    </>
  );
}

// Made with Bob
