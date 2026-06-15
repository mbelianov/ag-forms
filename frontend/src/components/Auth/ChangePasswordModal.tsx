import React, { useState } from 'react';
import {
    Modal,
    TextInput,
    InlineNotification,
    Stack,
} from '@carbon/react';
import { changePassword } from '../../api/auth';

interface ChangePasswordModalProps {
    open: boolean;
    onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
    open,
    onClose,
}) => {
    const [formData, setFormData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleClose = () => {
        setFormData({
            currentPassword: '',
            newPassword: '',
            confirmPassword: '',
        });
        setError(null);
        setSuccess(false);
        onClose();
    };

    const validateForm = (): boolean => {
        // Check all fields are filled
        if (!formData.currentPassword || !formData.newPassword || !formData.confirmPassword) {
            setError('All fields are required');
            return false;
        }

        // Check new password length (minimum 12 characters per security rules)
        if (formData.newPassword.length < 12) {
            setError('New password must be at least 12 characters long');
            return false;
        }

        // Check passwords match
        if (formData.newPassword !== formData.confirmPassword) {
            setError('New passwords do not match');
            return false;
        }

        // Check new password is different from current
        if (formData.currentPassword === formData.newPassword) {
            setError('New password must be different from current password');
            return false;
        }

        return true;
    };

    const handleSubmit = async () => {
        setError(null);
        setSuccess(false);

        if (!validateForm()) {
            return;
        }

        setIsSubmitting(true);

        try {
            await changePassword({
                currentPassword: formData.currentPassword,
                newPassword: formData.newPassword,
            });
            setSuccess(true);
            // Close modal after 2 seconds on success
            setTimeout(() => {
                handleClose();
            }, 2000);
        } catch (err: any) {
            setError(
                err.response?.data?.error?.message ||
                err.message ||
                'Failed to change password'
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            open={open}
            onRequestClose={handleClose}
            onRequestSubmit={handleSubmit}
            modalHeading="Change Password"
            primaryButtonText="Change Password"
            secondaryButtonText="Cancel"
            primaryButtonDisabled={isSubmitting}
            preventCloseOnClickOutside
        >
            <Stack gap={6}>
                {error && (
                    <InlineNotification
                        kind="error"
                        title="Error"
                        subtitle={error}
                        onClose={() => setError(null)}
                        lowContrast
                    />
                )}

                {success && (
                    <InlineNotification
                        kind="success"
                        title="Success"
                        subtitle="Password changed successfully"
                        lowContrast
                        hideCloseButton
                    />
                )}

                <TextInput
                    id="currentPassword"
                    type="password"
                    labelText="Current Password"
                    placeholder="Enter current password"
                    value={formData.currentPassword}
                    onChange={(e) =>
                        setFormData({ ...formData, currentPassword: e.target.value })
                    }
                    disabled={isSubmitting || success}
                    required
                />

                <TextInput
                    id="newPassword"
                    type="password"
                    labelText="New Password"
                    placeholder="Enter new password (min 12 characters)"
                    value={formData.newPassword}
                    onChange={(e) =>
                        setFormData({ ...formData, newPassword: e.target.value })
                    }
                    disabled={isSubmitting || success}
                    required
                />

                <TextInput
                    id="confirmPassword"
                    type="password"
                    labelText="Confirm New Password"
                    placeholder="Re-enter new password"
                    value={formData.confirmPassword}
                    onChange={(e) =>
                        setFormData({ ...formData, confirmPassword: e.target.value })
                    }
                    disabled={isSubmitting || success}
                    required
                />
            </Stack>
        </Modal>
    );
};

// Made with Bob