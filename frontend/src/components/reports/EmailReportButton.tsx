import { useState } from 'react';
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
import type { Examination } from '../../types';
import api from '../../services/api';
import { printService } from '../../services/print.service';

interface EmailReportButtonProps {
  examination: Examination;
}

export default function EmailReportButton({ examination }: EmailReportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [subject, setSubject] = useState(`Ultrasound Prenatal Test Report — ${examination.patientName}`);
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [emailError, setEmailError] = useState('');

  const handleOpen = () => {
    setSendError(null);
    setSendSuccess(false);
    setEmailError('');
    setIsOpen(true);
  };

  const handleClose = () => {
    if (isSending) return;
    setIsOpen(false);
  };

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSend = async () => {
    if (!validateEmail(recipientEmail)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    setIsSending(true);
    setSendError(null);
    try {
      // Generate PDF and base64-encode it
      const pdfBlob = await printService.getPdfBlob(examination);
      const arrayBuffer = await pdfBlob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const pdfBase64 = btoa(binary);

      await api.post(`/v1/examinations/${examination.examinationId}/email-report`, {
        recipient_email: recipientEmail,
        subject,
        message: message.trim() || undefined,
        pdf_base64: pdfBase64,
      });

      setSendSuccess(true);
      setTimeout(() => setIsOpen(false), 1500);
    } catch (err: any) {
      const apiMsg = err.response?.data?.error?.message || err.response?.data?.error;
      setSendError(apiMsg || err.message || 'Failed to send report');
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
        primaryButtonText={isSending ? 'Sending…' : 'Send Report'}
        secondaryButtonText="Cancel"
        primaryButtonDisabled={isSending || !recipientEmail}
        onRequestSubmit={handleSend}
        onRequestClose={handleClose}
        onSecondarySubmit={handleClose}
        preventCloseOnClickOutside={isSending}
      >
        {sendSuccess && (
          <InlineNotification
            kind="success"
            title="Report sent"
            subtitle={`Report sent to ${recipientEmail}`}
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

        <Stack gap={5} style={{ marginTop: '1rem' }}>
          <TextInput
            id="recipientEmail"
            labelText="Recipient Email"
            placeholder="patient@example.com"
            value={recipientEmail}
            onChange={(e) => {
              setRecipientEmail(e.target.value);
              if (emailError) setEmailError('');
            }}
            invalid={!!emailError}
            invalidText={emailError}
            type="email"
            disabled={isSending}
          />
          <TextInput
            id="emailSubject"
            labelText="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={isSending}
          />
          <TextArea
            id="emailMessage"
            labelText="Message (optional)"
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={isSending}
          />
          {isSending && (
            <InlineLoading description="Generating PDF and sending…" />
          )}
        </Stack>
      </Modal>
    </>
  );
}

// Made with Bob
