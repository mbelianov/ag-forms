import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Form,
  Stack,
  TextInput,
  PasswordInput,
  Select,
  SelectItem,
  Button,
  InlineNotification,
  Breadcrumb,
  BreadcrumbItem,
  Tile,
} from '@carbon/react';
import { ArrowLeft } from '@carbon/icons-react';
import { userService } from '../services/userService';
import type { CreateUserRequest } from '../services/userService';

// Client-side replication of backend password strength rules (passwordService.ts)
function validatePasswordField(
  field: 'password' | 'confirmPassword',
  value: string,
  currentPassword: string
): string {
  if (field === 'password') {
    const msgs: string[] = [];
    if (value.length < 12)            msgs.push('at least 12 characters');
    if (!/[A-Z]/.test(value))         msgs.push('an uppercase letter');
    if (!/[a-z]/.test(value))         msgs.push('a lowercase letter');
    if (!/[0-9]/.test(value))         msgs.push('a number');
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value)) msgs.push('a special character');
    return msgs.length ? 'Password must contain ' + msgs.join(', ') : '';
  }
  if (!value) return 'Confirm password is required';
  if (value !== currentPassword) return 'Passwords do not match';
  return '';
}

function validateSimpleField(field: 'username' | 'fullName' | 'email', value: string): string {
  if (field === 'username' && !value.trim()) return 'Username is required';
  if (field === 'fullName' && !value.trim()) return 'Full name is required';
  if (field === 'email') {
    if (!value.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Valid email is required';
  }
  return '';
}

export default function CreateUserPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<CreateUserRequest>({
    username: '',
    fullName: '',
    email: '',
    password: '',
    role: 'doctor',
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Final gate: validate all fields regardless of touch state
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    (['username', 'fullName', 'email'] as const).forEach((f) => {
      const msg = validateSimpleField(f, formData[f] as string);
      if (msg) newErrors[f] = msg;
    });
    const pwMsg = validatePasswordField('password', formData.password, formData.password);
    if (pwMsg) newErrors.password = pwMsg;
    const cfMsg = validatePasswordField('confirmPassword', confirmPassword, formData.password);
    if (cfMsg) newErrors.confirmPassword = cfMsg;
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field: keyof CreateUserRequest, value: string) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    setTouched((prev) => ({ ...prev, [field]: true }));

    if (field === 'username' || field === 'fullName' || field === 'email') {
      const msg = validateSimpleField(field as any, value);
      setErrors((prev) => msg ? { ...prev, [field]: msg } : { ...prev, [field]: '' });
    } else if (field === 'password') {
      const pwMsg = validatePasswordField('password', value, value);
      const newErrs: Record<string, string> = { ...errors, [field]: pwMsg };
      // Re-validate confirm if it was already touched
      if (touched.confirmPassword) {
        newErrs.confirmPassword = validatePasswordField('confirmPassword', confirmPassword, value);
      }
      setErrors(newErrs);
    }
  };

  const handleConfirmChange = (value: string) => {
    setConfirmPassword(value);
    setTouched((prev) => ({ ...prev, confirmPassword: true }));
    const msg = validatePasswordField('confirmPassword', value, formData.password);
    setErrors((prev) => ({ ...prev, confirmPassword: msg }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      await userService.createUser(formData);
      navigate('/users');
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to create user');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <Breadcrumb noTrailingSlash style={{ marginBottom: '1rem' }}>
        <BreadcrumbItem href="/dashboard">Home</BreadcrumbItem>
        <BreadcrumbItem href="/users">Users</BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>Create User</BreadcrumbItem>
      </Breadcrumb>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <Button kind="ghost" renderIcon={ArrowLeft} onClick={() => navigate('/users')} hasIconOnly iconDescription="Back" />
        <h1>Create User</h1>
      </div>
      <Tile>
        {submitError && (
          <InlineNotification kind="error" title="Error" subtitle={submitError} onCloseButtonClick={() => setSubmitError(null)} lowContrast style={{ marginBottom: '1.5rem' }} />
        )}
        <Form onSubmit={handleSubmit}>
          <Stack gap={6}>
            <TextInput
              id="username"
              labelText="Username"
              value={formData.username}
              onChange={(e) => handleChange('username', e.target.value)}
              invalid={!!errors.username}
              invalidText={errors.username}
              disabled={isSubmitting}
              autoComplete="off"
            />
            <TextInput
              id="fullName"
              labelText="Full Name"
              value={formData.fullName}
              onChange={(e) => handleChange('fullName', e.target.value)}
              invalid={!!errors.fullName}
              invalidText={errors.fullName}
              disabled={isSubmitting}
            />
            <TextInput
              id="email"
              labelText="Email"
              type="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              invalid={!!errors.email}
              invalidText={errors.email}
              disabled={isSubmitting}
              autoComplete="off"
            />
            <PasswordInput
              id="password"
              labelText="Password"
              value={formData.password}
              onChange={(e) => handleChange('password', e.target.value)}
              invalid={!!errors.password}
              invalidText={errors.password}
              disabled={isSubmitting}
              autoComplete="new-password"
            />
            <PasswordInput
              id="confirmPassword"
              labelText="Confirm Password"
              value={confirmPassword}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleConfirmChange(e.target.value)}
              invalid={!!errors.confirmPassword}
              invalidText={errors.confirmPassword}
              disabled={isSubmitting}
              autoComplete="new-password"
            />
            <Select id="role" labelText="Role" value={formData.role} onChange={(e) => handleChange('role', e.target.value)} disabled={isSubmitting}>
              <SelectItem value="admin" text="Admin" />
              <SelectItem value="doctor" text="Doctor" />
              <SelectItem value="viewer" text="Viewer" />
            </Select>
            <Stack orientation="horizontal" gap={4}>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creating…' : 'Create User'}</Button>
              <Button kind="secondary" onClick={() => navigate('/users')} disabled={isSubmitting}>Cancel</Button>
            </Stack>
          </Stack>
        </Form>
      </Tile>
    </div>
  );
}

// Made with Bob
