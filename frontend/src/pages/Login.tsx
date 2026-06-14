import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Form,
    TextInput,
    Button,
    InlineNotification,
    Stack,
} from '@carbon/react';
import { Login as LoginIcon } from '@carbon/icons-react';
import { useAuth } from '../hooks/useAuth';
import { handleApiError } from '../api/client';

const Login: React.FC = () => {
    const navigate = useNavigate();
    const { login } = useAuth();
    
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!username || !password) {
            setError('Please enter both username and password');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            await login(username, password);
            navigate('/dashboard');
        } catch (err) {
            const errorMessage = handleApiError(err);
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            backgroundColor: '#f4f4f4',
        }}>
            <div style={{
                backgroundColor: 'white',
                padding: '2rem',
                borderRadius: '4px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                width: '100%',
                maxWidth: '400px',
            }}>
                <Stack gap={6}>
                    <div style={{ textAlign: 'center' }}>
                        <LoginIcon size={48} style={{ marginBottom: '1rem' }} />
                        <h2>Prenatal Ultrasound System</h2>
                        <p style={{ color: '#525252', marginTop: '0.5rem' }}>
                            Sign in to your account
                        </p>
                    </div>

                    {error && (
                        <InlineNotification
                            kind="error"
                            title="Login Failed"
                            subtitle={error}
                            onClose={() => setError(null)}
                            lowContrast
                        />
                    )}

                    <Form onSubmit={handleSubmit}>
                        <Stack gap={5}>
                            <TextInput
                                id="username"
                                labelText="Username"
                                placeholder="Enter your username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                disabled={isLoading}
                                required
                            />

                            <TextInput
                                id="password"
                                type="password"
                                labelText="Password"
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={isLoading}
                                required
                            />

                            <Button
                                type="submit"
                                kind="primary"
                                disabled={isLoading}
                                style={{ width: '100%' }}
                            >
                                {isLoading ? 'Signing in...' : 'Sign In'}
                            </Button>
                        </Stack>
                    </Form>
                </Stack>
            </div>
        </div>
    );
};

export default Login;

// Made with Bob
