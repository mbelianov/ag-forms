import React from 'react';
import {
    Form,
    TextInput,
    NumberInput,
    Button,
    Stack,
    InlineNotification,
} from '@carbon/react';
import type { Patient } from '../../types';

interface PatientFormProps {
    patient?: Patient;
    onSubmit: (data: Partial<Patient>) => Promise<void>;
    onCancel: () => void;
}

export const PatientForm: React.FC<PatientFormProps> = ({
    patient,
    onSubmit,
    onCancel,
}) => {
    const [formData, setFormData] = React.useState({
        name: patient?.name || '',
        age: patient?.age || 18,
        phone: patient?.phone || '',
        email: patient?.email || '',
        address: patient?.address || '',
    });
    const [error, setError] = React.useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);

        try {
            await onSubmit(formData);
        } catch (err: any) {
            setError(err.response?.data?.error?.message || err.message || 'Failed to save patient');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Form onSubmit={handleSubmit}>
            <Stack gap={6}>
                {error && (
                    <InlineNotification
                        kind="error"
                        title="Error"
                        subtitle={error}
                        onClose={() => setError(null)}
                    />
                )}

                <TextInput
                    id="name"
                    labelText="Full Name"
                    placeholder="Enter patient name"
                    value={formData.name}
                    onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                    }
                    required
                />

                <NumberInput
                    id="age"
                    label="Age"
                    min={2}
                    max={99}
                    value={formData.age}
                    onChange={(e: any, { value }: any) =>
                        setFormData({ ...formData, age: value || 18 })
                    }
                    required
                />

                <TextInput
                    id="phone"
                    labelText="Phone"
                    placeholder="Enter phone number"
                    value={formData.phone}
                    onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                    }
                    required
                />

                <TextInput
                    id="email"
                    labelText="Email (Optional)"
                    type="email"
                    placeholder="Enter email address"
                    value={formData.email}
                    onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                    }
                />

                <TextInput
                    id="address"
                    labelText="Address (Optional)"
                    placeholder="Enter address"
                    value={formData.address}
                    onChange={(e) =>
                        setFormData({ ...formData, address: e.target.value })
                    }
                />

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                    <Button type="submit" disabled={isSubmitting}>
                        {patient ? 'Update Patient' : 'Create Patient'}
                    </Button>
                    <Button kind="secondary" onClick={onCancel}>
                        Cancel
                    </Button>
                </div>
            </Stack>
        </Form>
    );
};

// Made with Bob