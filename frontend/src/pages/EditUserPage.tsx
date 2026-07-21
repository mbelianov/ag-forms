import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Form,
  Stack,
  TextInput,
  Select,
  SelectItem,
  Toggle,
  Button,
  InlineNotification,
  Breadcrumb,
  BreadcrumbItem,
  Tile,
  Modal,
  PasswordInput,
} from '@carbon/react';
import { ArrowLeft } from '@carbon/icons-react';
import { userService } from '../services/userService';
import type { UserRecord } from '../services/userService';
import PageLoader from '../components/PageLoader';
import { useAuth } from '../contexts/AuthContext';
import { useAutoNotification } from '../utils/useAutoNotification';

// Client-side replication of backend password strength rules (passwordService.ts)
function validatePasswordField(
  field: 'newPassword' | 'confirmPassword',
  value: string,
  currentNewPassword: string
): string {
  if (field === 'newPassword') {
    const msgs: string[] = [];
    if (value.length < 12)            msgs.push('at least 12 characters');
    if (!/[A-Z]/.test(value))         msgs.push('an uppercase letter');
    if (!/[a-z]/.test(value))         msgs.push('a lowercase letter');
    if (!/[0-9]/.test(value))         msgs.push('a number');
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(value)) msgs.push('a special character');
    return msgs.length ? 'Password must contain ' + msgs.join(', ') : '';
  }
  if (!value) return 'Confirm password is required';
  if (value !== currentNewPassword) return 'Passwords do not match';
  return '';
}

export default function EditUserPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [user, setUser] = useState<UserRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'admin' | 'doctor' | 'viewer'>('doctor');
  const [isActive, setIsActive] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Reset Password modal state
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetTouched, setResetTouched] = useState<Record<string, boolean>>({});
  const [resetErrors, setResetErrors] = useState<Record<string, string>>({});
  const [isResetting, setIsResetting] = useState(false);
  const [resetApiError, setResetApiError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const clearResetSuccess = useCallback(() => setResetSuccess(null), []);
  useAutoNotification(resetSuccess, clearResetSuccess);

  const loadUser = useCallback(async () => {
    if (!id) return;
    try {
      const result = await userService.getUsers();
      const found = result.users.find((u) => u.userId === id);
      if (found) {
        setUser(found);
        setFullName(found.fullName);
        setRole(found.role);
        setIsActive(found.isActive);
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to load user');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadUser();
  }, [loadUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSuccess(false);
    const newErrors: Record<string, string> = {};
    if (!fullName.trim()) newErrors.fullName = 'Full name is required';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      await userService.updateUser(id!, { fullName, role, isActive });
      setSuccess(true);
      setTimeout(() => navigate('/users'), 1000);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to update user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPasswordOpen = () => {
    setNewPassword('');
    setConfirmPassword('');
    setResetTouched({});
    setResetErrors({});
    setResetApiError(null);
    setResetModalOpen(true);
  };

  const handleNewPasswordChange = (value: string) => {
    setNewPassword(value);
    setResetTouched((prev) => ({ ...prev, newPassword: true }));
    const pwMsg = validatePasswordField('newPassword', value, value);
    const newErrs: Record<string, string> = { ...resetErrors, newPassword: pwMsg };
    // Re-validate confirm if already touched
    if (resetTouched.confirmPassword) {
      newErrs.confirmPassword = validatePasswordField('confirmPassword', confirmPassword, value);
    }
    setResetErrors(newErrs);
  };

  const handleConfirmPasswordChange = (value: string) => {
    setConfirmPassword(value);
    setResetTouched((prev) => ({ ...prev, confirmPassword: true }));
    const msg = validatePasswordField('confirmPassword', value, newPassword);
    setResetErrors((prev) => ({ ...prev, confirmPassword: msg }));
  };

  const handleResetPasswordClose = () => {
    if (isResetting) return;
    setResetModalOpen(false);
  };

  const handleResetPasswordSubmit = async () => {
    const errs: Record<string, string> = {};
    const pwMsg = validatePasswordField('newPassword', newPassword, newPassword);
    if (pwMsg) errs.newPassword = pwMsg;
    const cfMsg = validatePasswordField('confirmPassword', confirmPassword, newPassword);
    if (cfMsg) errs.confirmPassword = cfMsg;
    setResetErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setIsResetting(true);
    setResetApiError(null);
    try {
      await userService.resetUserPassword(id!, newPassword);
      setResetModalOpen(false);
      setResetSuccess('Password reset successfully');
    } catch (err) {
      setResetApiError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setIsResetting(false);
    }
  };

  // Determine if the user being edited is the currently logged-in user
  const isOwnAccount =
    id === (currentUser as { id?: string; userId?: string })?.id ||
    id === (currentUser as { id?: string; userId?: string })?.userId;

  if (isLoading) return <PageLoader description="Loading user..." />;

  return (
    <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <Breadcrumb noTrailingSlash style={{ marginBottom: '1rem' }}>
        <BreadcrumbItem href="/dashboard">Home</BreadcrumbItem>
        <BreadcrumbItem href="/users">Users</BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>Edit User</BreadcrumbItem>
      </Breadcrumb>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <Button kind="ghost" renderIcon={ArrowLeft} onClick={() => navigate('/users')} hasIconOnly iconDescription="Back" />
        <h1>Edit User: {user?.username}</h1>
      </div>
      {resetSuccess && (
        <InlineNotification
          kind="success"
          title="Success"
          subtitle={resetSuccess}
          onCloseButtonClick={() => setResetSuccess(null)}
          lowContrast
          style={{ marginBottom: '1.5rem' }}
        />
      )}
      <Tile>
        {success && <InlineNotification kind="success" title="User updated" subtitle="Redirecting…" lowContrast hideCloseButton style={{ marginBottom: '1.5rem' }} />}
        {submitError && <InlineNotification kind="error" title="Error" subtitle={submitError} onCloseButtonClick={() => setSubmitError(null)} lowContrast style={{ marginBottom: '1.5rem' }} />}
        <Form onSubmit={handleSubmit}>
          <Stack gap={6}>
            <TextInput id="fullName" labelText="Full Name" value={fullName} onChange={(e) => { setFullName(e.target.value); if (errors.fullName) setErrors((p) => { const n = {...p}; delete n.fullName; return n; }); }} invalid={!!errors.fullName} invalidText={errors.fullName} disabled={isSubmitting} />
            <Select id="role" labelText="Role" value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'doctor' | 'viewer')} disabled={isSubmitting}>
              <SelectItem value="admin" text="Admin" />
              <SelectItem value="doctor" text="Doctor" />
              <SelectItem value="viewer" text="Viewer" />
            </Select>
            <Toggle id="isActive" labelText="Account Active" labelA="Inactive" labelB="Active" toggled={isActive} onToggle={(checked: boolean) => setIsActive(checked)} disabled={isSubmitting} />
            <Stack orientation="horizontal" gap={4}>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Save Changes'}</Button>
              <Button kind="secondary" onClick={() => navigate('/users')} disabled={isSubmitting}>Cancel</Button>
              {!isOwnAccount && (
                <Button kind="danger--ghost" onClick={handleResetPasswordOpen} disabled={isSubmitting}>
                  Reset Password
                </Button>
              )}
            </Stack>
          </Stack>
        </Form>
      </Tile>

      {/* Reset Password Modal */}
      <Modal
        open={resetModalOpen}
        modalHeading="Reset Password"
        primaryButtonText={isResetting ? 'Resetting…' : 'Reset Password'}
        secondaryButtonText="Cancel"
        primaryButtonDisabled={isResetting}
        onRequestSubmit={handleResetPasswordSubmit}
        onRequestClose={handleResetPasswordClose}
        onSecondarySubmit={handleResetPasswordClose}
      >
        <Stack gap={6}>
          <p>Set a new password for <strong>{user?.username}</strong>. This will also unlock the account if it is locked.</p>
          <PasswordInput
            id="reset-new-password"
            labelText="New Password"
            value={newPassword}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleNewPasswordChange(e.target.value)}
            invalid={!!resetErrors.newPassword}
            invalidText={resetErrors.newPassword}
            disabled={isResetting}
          />
          <PasswordInput
            id="reset-confirm-password"
            labelText="Confirm New Password"
            value={confirmPassword}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleConfirmPasswordChange(e.target.value)}
            invalid={!!resetErrors.confirmPassword}
            invalidText={resetErrors.confirmPassword}
            disabled={isResetting}
          />
          {resetApiError && (
            <InlineNotification
              kind="error"
              title="Error"
              subtitle={resetApiError}
              onCloseButtonClick={() => setResetApiError(null)}
              lowContrast
            />
          )}
        </Stack>
      </Modal>
    </div>
  );
}

// Made with Bob
