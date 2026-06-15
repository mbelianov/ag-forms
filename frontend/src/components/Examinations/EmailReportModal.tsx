import React, { useState } from 'react';
import {
    Modal,
    TextInput,
    InlineNotification,
    Loading,
} from '@carbon/react';
import { emailExaminationReport } from '../../api/examinations';

interface EmailReportModalProps {
    open: boolean;
    onClose: () => void;
    examinationId: string;
    patientEmail?: string;
    patientName: string;
}

export const EmailReportModal: React.FC<EmailReportModalProps> = ({
    open,
    onClose,
    examinationId,
    patientEmail,
    patientName,
}) => {
    const [email, setEmail] = useState(patientEmail || '');
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const validateEmail = (email: string): boolean => {
        return emailRegex.test(email);
    };

    const handleSubmit = async () => {
        setError(null);
        setSuccess(false);

        // Validate email
        if (!email.trim()) {
            setError('Email address is required');
            return;
        }

        if (!validateEmail(email)) {
            setError('Please enter a valid email address');
            return;
        }

        setIsSending(true);

        try {
            // Note: The API expects pdfBase64, but since we don't have client-side PDF generation yet,
            // we'll send an empty string. The backend should handle report generation.
            await emailExaminationReport({
                examinationId,
                pdfBase64: '', // Placeholder - backend should generate the report
            });

            setSuccess(true);
            
            // Close modal after 2 seconds on success
            setTimeout(() => {
                onClose();
                // Reset state
                setEmail(patientEmail || '');
                setSuccess(false);
            }, 2000);
        } catch (err: any) {
            setError(err.message || 'Failed to send email. Please try again.');
        } finally {
            setIsSending(false);
        }
    };

    const handleClose = () => {
        if (!isSending) {
            setError(null);
            setSuccess(false);
            setEmail(patientEmail || '');
            onClose();
        }
    };

    return (
        <Modal
            open={open}
            onRequestClose={handleClose}
            onRequestSubmit={handleSubmit}
            modalHeading="Email Examination Report"
            primaryButtonText={isSending ? 'Sending...' : 'Send Email'}
            secondaryButtonText="Cancel"
            primaryButtonDisabled={isSending || success}
            preventCloseOnClickOutside={isSending}
        >
            {success ? (
                <InlineNotification
                    kind="success"
                    title="Email sent successfully!"
                    subtitle={`The examination report has been sent to ${email}`}
                    hideCloseButton
                />
            ) : (
                <>
                    {error && (
                        <InlineNotification
                            kind="error"
                            title="Error"
                            subtitle={error}
                            onCloseButtonClick={() => setError(null)}
                            style={{ marginBottom: '1rem' }}
                        />
                    )}

                    <p style={{ marginBottom: '1rem' }}>
                        Send the examination report for <strong>{patientName}</strong> via email.
                    </p>

                    <TextInput
                        id="email-input"
                        labelText="Email Address"
                        placeholder="patient@example.com"
                        value={email}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                        invalid={email.trim() !== '' && !validateEmail(email)}
                        invalidText="Please enter a valid email address"
                        disabled={isSending}
                    />

                    {isSending && (
                        <div style={{ marginTop: '1rem' }}>
                            <Loading description="Sending email..." withOverlay={false} small />
                        </div>
                    )}
                </>
            )}
        </Modal>
    );
};

// Made with Bob