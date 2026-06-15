import React, { useState } from 'react';
import {
    Form,
    TextInput,
    Select,
    SelectItem,
    Button,
    InlineNotification,
    PasswordInput,
} from '@carbon/react';
import { register } from '../../api/auth';
import type { User } from '../../types';

interface UserFormProps {
    onSuccess: (user: User) => void;
    onCancel: () => void;
}

export const UserForm: React.FC<UserFormProps> = ({ onSuccess, onCancel }) => {
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: 'doctor' as 'admin' | 'doctor' | 'viewer',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const validateForm = (): string | null => {
        // Username validation
        if (!formData.username.trim()) {
            return 'Username is required';
        }
        if (formData.username !== formData.username.toLowerCase()) {
            return 'Username must be lowercase';
        }
        if (formData.username.length < 3) {
            return 'Username must be at least 3 characters';
        }

        // Email validation
        if (!formData.email.trim()) {
            return 'Email is required';
        }
        if (!emailRegex.test(formData.email)) {
            return 'Please enter a valid email address';
        }

        // Password validation
        if (!formData.password) {
            return 'Password is required';
        }
        if (formData.password.length < 12) {
            return 'Password must be at least 12 characters';
        }

        // Confirm password validation
        if (formData.password !== formData.confirmPassword) {
            return 'Passwords do not match';
        }

        return null;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Validate form
        const validationError = validateForm();
        if (validationError) {
            setError(validationError);
            return;
        }

        setIsSubmitting(true);

        try {
            const user = await register({
                username: formData.username.toLowerCase(),
                email: formData.email,
                password: formData.password,
                role: formData.role,
            });

            onSuccess(user);
        } catch (err: any) {
            setError(err.message || 'Failed to create user. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setError(null);
    };

    return (
        <Form onSubmit={handleSubmit}>
            {error && (
                <InlineNotification
                    kind="error"
                    title="Error"
                    subtitle={error}
                    onCloseButtonClick={() => setError(null)}
                    style={{ marginBottom: '1rem' }}
                />
            )}

            <div style={{ marginBottom: '1rem' }}>
                <TextInput
                    id="username"
                    labelText="Username (lowercase)"
                    placeholder="johndoe"
                    value={formData.username}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                        handleChange('username', e.target.value.toLowerCase())
                    }
                    disabled={isSubmitting}
                    required
                    helperText="Username will be converted to lowercase automatically"
                />
            </div>

            <div style={{ marginBottom: '1rem' }}>
                <TextInput
                    id="email"
                    labelText="Email"
                    type="email"
                    placeholder="john.doe@example.com"
                    value={formData.email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                        handleChange('email', e.target.value)
                    }
                    disabled={isSubmitting}
                    required
                    invalid={formData.email !== '' && !emailRegex.test(formData.email)}
                    invalidText="Please enter a valid email address"
                />
            </div>

            <div style={{ marginBottom: '1rem' }}>
                <PasswordInput
                    id="password"
                    labelText="Password"
                    placeholder="Enter password (min 12 characters)"
                    value={formData.password}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                        handleChange('password', e.target.value)
                    }
                    disabled={isSubmitting}
                    required
                    invalid={formData.password !== '' && formData.password.length < 12}
                    invalidText="Password must be at least 12 characters"
                />
            </div>

            <div style={{ marginBottom: '1rem' }}>
                <PasswordInput
                    id="confirmPassword"
                    labelText="Confirm Password"
                    placeholder="Re-enter password"
                    value={formData.confirmPassword}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                        handleChange('confirmPassword', e.target.value)
                    }
                    disabled={isSubmitting}
                    required
                    invalid={
                        formData.confirmPassword !== '' && 
                        formData.password !== formData.confirmPassword
                    }
                    invalidText="Passwords do not match"
                />
            </div>

            <div style={{ marginBottom: '1rem' }}>
                <Select
                    id="role"
                    labelText="Role"
                    value={formData.role}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => 
                        handleChange('role', e.target.value)
                    }
                    disabled={isSubmitting}
                >
                    <SelectItem value="viewer" text="Viewer - Read-only access" />
                    <SelectItem value="doctor" text="Doctor - Full access to patients and examinations" />
                    <SelectItem value="admin" text="Admin - Full system access including user management" />
                </Select>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Creating User...' : 'Create User'}
                </Button>
                <Button kind="secondary" onClick={onCancel} disabled={isSubmitting}>
                    Cancel
                </Button>
            </div>
        </Form>
    );
};

// Made with Bob