import React from 'react';
import { NumberInput, Stack } from '@carbon/react';

interface DopplerFieldsProps {
    doppler: {
        umbilicalArteryPI?: number;
        umbilicalArteryRI?: number;
        middleCerebralArteryPI?: number;
    };
    onChange: (doppler: any) => void;
    disabled?: boolean;
}

export const DopplerFields: React.FC<DopplerFieldsProps> = ({
    doppler,
    onChange,
    disabled = false,
}) => {
    const handleChange = (field: string, value: string | number | undefined) => {
        const numValue = typeof value === 'string' ? parseFloat(value) : value;
        onChange({ ...doppler, [field]: numValue });
    };

    return (
        <Stack gap={5}>
            <h4>Doppler Measurements</h4>

            <NumberInput
                id="umbilicalArteryPI"
                label="Umbilical Artery PI (Pulsatility Index)"
                min={0}
                max={10}
                step={0.01}
                value={doppler.umbilicalArteryPI || ''}
                onChange={(e, { value }) => handleChange('umbilicalArteryPI', value)}
                disabled={disabled}
                helperText="Normal range: 0.6-1.2"
            />

            <NumberInput
                id="umbilicalArteryRI"
                label="Umbilical Artery RI (Resistance Index)"
                min={0}
                max={1}
                step={0.01}
                value={doppler.umbilicalArteryRI || ''}
                onChange={(e, { value }) => handleChange('umbilicalArteryRI', value)}
                disabled={disabled}
                helperText="Normal range: 0.5-0.7"
            />

            <NumberInput
                id="middleCerebralArteryPI"
                label="Middle Cerebral Artery PI"
                min={0}
                max={10}
                step={0.01}
                value={doppler.middleCerebralArteryPI || ''}
                onChange={(e, { value }) => handleChange('middleCerebralArteryPI', value)}
                disabled={disabled}
                helperText="Normal range: 1.2-2.0"
            />
        </Stack>
    );
};

// Made with Bob
