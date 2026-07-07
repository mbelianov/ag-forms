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
} from '@carbon/react';
import { ArrowLeft } from '@carbon/icons-react';
import { userService } from '../services/userService';
import type { UserRecord } from '../services/userService';
import PageLoader from '../components/PageLoader';

export default function EditUserPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<UserRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'admin' | 'doctor' | 'viewer'>('doctor');
  const [isActive, setIsActive] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const loadUser = useCallback(async () => {
    if (!id) return;
    try {
      // Get users and find the one we want
      const result = await userService.getUsers();
      const found = result.users.find((u) => u.userId === id);
      if (found) {
        setUser(found);
        setFullName(found.fullName);
        setRole(found.role);
        setIsActive(found.isActive);
      }
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to load user');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => { loadUser(); }, [loadUser]);

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
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to update user');
    } finally {
      setIsSubmitting(false);
    }
  };

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
      <Tile>
        {success && <InlineNotification kind="success" title="User updated" subtitle="Redirecting…" lowContrast hideCloseButton style={{ marginBottom: '1.5rem' }} />}
        {submitError && <InlineNotification kind="error" title="Error" subtitle={submitError} onCloseButtonClick={() => setSubmitError(null)} lowContrast style={{ marginBottom: '1.5rem' }} />}
        <Form onSubmit={handleSubmit}>
          <Stack gap={6}>
            <TextInput id="fullName" labelText="Full Name" value={fullName} onChange={(e) => { setFullName(e.target.value); if (errors.fullName) setErrors((p) => { const n = {...p}; delete n.fullName; return n; }); }} invalid={!!errors.fullName} invalidText={errors.fullName} disabled={isSubmitting} />
            <Select id="role" labelText="Role" value={role} onChange={(e) => setRole(e.target.value as any)} disabled={isSubmitting}>
              <SelectItem value="admin" text="Admin" />
              <SelectItem value="doctor" text="Doctor" />
              <SelectItem value="viewer" text="Viewer" />
            </Select>
            <Toggle id="isActive" labelText="Account Active" labelA="Inactive" labelB="Active" toggled={isActive} onToggle={(checked: boolean) => setIsActive(checked)} disabled={isSubmitting} />
            <Stack orientation="horizontal" gap={4}>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Save Changes'}</Button>
              <Button kind="secondary" onClick={() => navigate('/users')} disabled={isSubmitting}>Cancel</Button>
            </Stack>
          </Stack>
        </Form>
      </Tile>
    </div>
  );
}

// Made with Bob
