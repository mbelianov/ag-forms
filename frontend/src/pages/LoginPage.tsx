import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Form,
  TextInput,
  PasswordInput,
  Button,
  Stack,
  InlineNotification,
} from '@carbon/react';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      // Username will be normalized to lowercase in authService
      await login(username, password);
      // Navigation handled by AuthContext after successful login
    } catch (err: any) {
      // Display generic error message per security requirements
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '4rem auto', padding: '2rem' }}>
      <h1 style={{ marginBottom: '2rem' }}>Login to AG Forms</h1>
      
      {error && (
        <InlineNotification
          kind="error"
          title="Login Failed"
          subtitle={error}
          onCloseButtonClick={() => setError('')}
          style={{ marginBottom: '1rem', minWidth: '100%' }}
        />
      )}

      <Form onSubmit={handleSubmit}>
        <Stack gap={6}>
          <TextInput
            id="username"
            labelText="Username"
            placeholder="Enter your username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            disabled={isSubmitting}
            autoComplete="username"
          />
          <PasswordInput
            id="password"
            labelText="Password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isSubmitting}
            autoComplete="current-password"
          />
          <Button
            type="submit"
            style={{ width: '100%' }}
            disabled={isSubmitting || !username || !password}
          >
            {isSubmitting ? 'Logging in...' : 'Login'}
          </Button>
        </Stack>
      </Form>
    </div>
  );
}

// Made with Bob
