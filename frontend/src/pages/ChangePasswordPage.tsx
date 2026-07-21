import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Form,
  Stack,
  PasswordInput,
  Button,
  InlineNotification,
  Breadcrumb,
  BreadcrumbItem,
  Tile,
} from '@carbon/react';
import { ArrowLeft } from '@carbon/icons-react';
import { authService } from '../services/authService';

const MIN_PASSWORD_LENGTH = 12;

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!currentPassword) {
      newErrors.currentPassword = 'Current password is required';
    }
    if (!newPassword) {
      newErrors.newPassword = 'New password is required';
    } else if (newPassword.length < MIN_PASSWORD_LENGTH) {
      newErrors.newPassword = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
    }
    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your new password';
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSuccess(false);

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await authService.changePassword(currentPassword, newPassword, confirmPassword);
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFieldChange = (field: string, value: string, setter: (v: string) => void) => {
    setter(value);
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <Breadcrumb noTrailingSlash style={{ marginBottom: '1rem' }}>
        <BreadcrumbItem href="/dashboard">Home</BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>Change Password</BreadcrumbItem>
      </Breadcrumb>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <Button
          kind="ghost"
          renderIcon={ArrowLeft}
          onClick={() => navigate('/dashboard')}
          hasIconOnly
          iconDescription="Back to Dashboard"
        />
        <h1>Change Password</h1>
      </div>

      <Tile>
        {success && (
          <InlineNotification
            kind="success"
            title="Password Changed"
            subtitle="Your password has been updated successfully."
            onCloseButtonClick={() => setSuccess(false)}
            lowContrast
            style={{ marginBottom: '1.5rem' }}
          />
        )}

        {submitError && (
          <InlineNotification
            kind="error"
            title="Error"
            subtitle={submitError}
            onCloseButtonClick={() => setSubmitError(null)}
            lowContrast
            style={{ marginBottom: '1.5rem' }}
          />
        )}

        <Form onSubmit={handleSubmit}>
          <Stack gap={6}>
            <PasswordInput
              id="currentPassword"
              labelText="Current Password"
              value={currentPassword}
              onChange={(e) => handleFieldChange('currentPassword', e.target.value, setCurrentPassword)}
              invalid={!!errors.currentPassword}
              invalidText={errors.currentPassword}
              disabled={isSubmitting}
              autoComplete="current-password"
            />

            <PasswordInput
              id="newPassword"
              labelText="New Password"
              helperText={`Minimum ${MIN_PASSWORD_LENGTH} characters`}
              value={newPassword}
              onChange={(e) => handleFieldChange('newPassword', e.target.value, setNewPassword)}
              invalid={!!errors.newPassword}
              invalidText={errors.newPassword}
              disabled={isSubmitting}
              autoComplete="new-password"
            />

            <PasswordInput
              id="confirmPassword"
              labelText="Confirm New Password"
              value={confirmPassword}
              onChange={(e) => handleFieldChange('confirmPassword', e.target.value, setConfirmPassword)}
              invalid={!!errors.confirmPassword}
              invalidText={errors.confirmPassword}
              disabled={isSubmitting}
              autoComplete="new-password"
            />

            <Stack orientation="horizontal" gap={4}>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Changing…' : 'Change Password'}
              </Button>
              <Button
                kind="secondary"
                onClick={() => navigate('/dashboard')}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            </Stack>
          </Stack>
        </Form>
      </Tile>
    </div>
  );
}

// Made with Bob
