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

export default function CreateUserPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<CreateUserRequest>({
    username: '',
    fullName: '',
    email: '',
    password: '',
    role: 'doctor',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.username.trim()) newErrors.username = 'Username is required';
    if (!formData.fullName.trim()) newErrors.fullName = 'Full name is required';
    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Valid email is required';
    if (!formData.password || formData.password.length < 12) newErrors.password = 'Password must be at least 12 characters';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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

  const handleChange = (field: keyof CreateUserRequest, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
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
            <TextInput id="username" labelText="Username" value={formData.username} onChange={(e) => handleChange('username', e.target.value)} invalid={!!errors.username} invalidText={errors.username} disabled={isSubmitting} autoComplete="off" />
            <TextInput id="fullName" labelText="Full Name" value={formData.fullName} onChange={(e) => handleChange('fullName', e.target.value)} invalid={!!errors.fullName} invalidText={errors.fullName} disabled={isSubmitting} />
            <TextInput id="email" labelText="Email" type="email" value={formData.email} onChange={(e) => handleChange('email', e.target.value)} invalid={!!errors.email} invalidText={errors.email} disabled={isSubmitting} autoComplete="off" />
            <PasswordInput id="password" labelText="Password" helperText="Minimum 12 characters" value={formData.password} onChange={(e) => handleChange('password', e.target.value)} invalid={!!errors.password} invalidText={errors.password} disabled={isSubmitting} autoComplete="new-password" />
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
