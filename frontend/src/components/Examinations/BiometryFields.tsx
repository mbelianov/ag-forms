import React from 'react';
import { NumberInput, Stack, Loading } from '@carbon/react';

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
    calculations?: {
        estimatedFetalWeight?: number;
        percentiles?: {
            bpd?: number;
            hc?: number;
            ac?: number;
            fl?: number;
            efw?: number;
        };
    } | null;
    isCalculating?: boolean;
}

export const BiometryFields: React.FC<BiometryFieldsProps> = ({
    biometry,
    onChange,
    disabled = false,
    calculations = null,
    isCalculating = false,
}) => {
    const handleChange = (field: string, value: string | number | undefined) => {
        const numValue = typeof value === 'string' ? parseFloat(value) : value;
        onChange({ ...biometry, [field]: numValue });
    };

    const renderPercentile = (value?: number) => {
        if (value === undefined) return null;
        return (
            <span style={{ marginLeft: '0.5rem', color: '#0f62fe', fontWeight: 500 }}>
                ({value.toFixed(1)}th percentile)
            </span>
        );
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
                helperText={
                    <>
                        Biparietal diameter measurement
                        {calculations?.percentiles?.bpd && renderPercentile(calculations.percentiles.bpd)}
                    </>
                }
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
                helperText={
                    <>
                        Head circumference measurement
                        {calculations?.percentiles?.hc && renderPercentile(calculations.percentiles.hc)}
                    </>
                }
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
                helperText={
                    <>
                        Abdominal circumference measurement
                        {calculations?.percentiles?.ac && renderPercentile(calculations.percentiles.ac)}
                    </>
                }
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
                helperText={
                    <>
                        Femur length measurement
                        {calculations?.percentiles?.fl && renderPercentile(calculations.percentiles.fl)}
                    </>
                }
            />

            {isCalculating && (
                <div style={{ padding: '1rem', background: '#f4f4f4', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Loading small withOverlay={false} />
                    <span>Calculating...</span>
                </div>
            )}

            {!isCalculating && calculations?.estimatedFetalWeight && (
                <div style={{ padding: '1rem', background: '#e5f6ff', borderRadius: '4px', border: '1px solid #0f62fe' }}>
                    <strong>Estimated Fetal Weight (EFW):</strong> {calculations.estimatedFetalWeight} grams
                    {calculations.percentiles?.efw && renderPercentile(calculations.percentiles.efw)}
                    <br />
                    <small style={{ color: '#525252' }}>Calculated using Hadlock formula</small>
                </div>
            )}
        </Stack>
    );
};

// Made with Bob
