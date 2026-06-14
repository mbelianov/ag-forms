import React from 'react';
import { NumberInput, Stack } from '@carbon/react';

interface BiometryFieldsProps {
    biometry: {
        bpd?: number;
        hc?: number;
        ac?: number;
        fl?: number;
        efw?: number;
    };
    onChange: (biometry: any) => void;
    disabled?: boolean;
}

export const BiometryFields: React.FC<BiometryFieldsProps> = ({
    biometry,
    onChange,
    disabled = false,
}) => {
    const handleChange = (field: string, value: string | number | undefined) => {
        const numValue = typeof value === 'string' ? parseFloat(value) : value;
        onChange({ ...biometry, [field]: numValue });
    };

    return (
        <Stack gap={5}>
            <h4>Biometry Measurements</h4>
            
            <NumberInput
                id="bpd"
                label="BPD - Biparietal Diameter (mm)"
                min={0}
                max={200}
                step={0.1}
                value={biometry.bpd || ''}
                onChange={(e, { value }) => handleChange('bpd', value)}
                disabled={disabled}
                helperText="Biparietal diameter measurement"
            />

            <NumberInput
                id="hc"
                label="HC - Head Circumference (mm)"
                min={0}
                max={500}
                step={0.1}
                value={biometry.hc || ''}
                onChange={(e, { value }) => handleChange('hc', value)}
                disabled={disabled}
                helperText="Head circumference measurement"
            />

            <NumberInput
                id="ac"
                label="AC - Abdominal Circumference (mm)"
                min={0}
                max={500}
                step={0.1}
                value={biometry.ac || ''}
                onChange={(e, { value }) => handleChange('ac', value)}
                disabled={disabled}
                helperText="Abdominal circumference measurement"
            />

            <NumberInput
                id="fl"
                label="FL - Femur Length (mm)"
                min={0}
                max={100}
                step={0.1}
                value={biometry.fl || ''}
                onChange={(e, { value }) => handleChange('fl', value)}
                disabled={disabled}
                helperText="Femur length measurement"
            />

            {biometry.efw && (
                <div style={{ padding: '1rem', background: '#f4f4f4', borderRadius: '4px' }}>
                    <strong>Estimated Fetal Weight (EFW):</strong> {biometry.efw} grams
                    <br />
                    <small>Calculated using Hadlock formula</small>
                </div>
            )}
        </Stack>
    );
};

// Made with Bob
