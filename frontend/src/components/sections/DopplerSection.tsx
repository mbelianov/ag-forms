/**
 * DopplerSection — renders the doppler measurement inputs for one fetus.
 *
 * Two sub-grids:
 *   Vessel grid  — vesselGroups entries; each group renders as a row with PI and RI inputs.
 *                  Each input uses its full measurement label (e.g. "A.ut.Dex PI") for alignment.
 *   Single grid  — singleConfigs entries, one per row, full width.
 */
import React from 'react';
import { TextInput } from '@carbon/react';
import type { ObservableFormMap, ObservableFormFieldState, AutoCalcValue } from '../../types/formData';
import type { DopplerVesselGroup } from '../../types';
import type { ObservableTypeConfig } from '../../constants/examinationTypes';

interface DopplerSectionProps {
  fetusIndex: number;
  vesselGroups: readonly DopplerVesselGroup[];
  singleConfigs: readonly ObservableTypeConfig[];
  data: ObservableFormMap;
  errors?: Record<string, string>;
  disabled?: boolean;
  onFieldChange: (
    fetusIndex: number,
    sectionKey: 'biometry' | 'doppler',
    type: string,
    field: keyof ObservableFormFieldState,
    next: AutoCalcValue<string>,
  ) => void;
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  fontWeight: 600,
  color: '#161616',
  marginBottom: '0.75rem',
  marginTop: '1.5rem',
};

export const DopplerSection: React.FC<DopplerSectionProps> = React.memo(({
  fetusIndex,
  vesselGroups,
  singleConfigs,
  data,
  errors,
  disabled = false,
  onFieldChange,
}) => {
  const handleChange = (type: string, value: string) => {
    onFieldChange(fetusIndex, 'doppler', type, 'value', { value, isManual: value.trim() !== '' });
  };

  const hasVessels = vesselGroups.length > 0;
  const hasSingle = singleConfigs.length > 0;

  if (!hasVessels && !hasSingle) return null;

  return (
    <div>
      <h5 style={sectionTitleStyle}>Doppler</h5>

      {/* Vessel sub-grid */}
      {hasVessels && (
        <div style={{ marginBottom: hasSingle ? '1rem' : 0 }}>
          {vesselGroups.map((group) => {
            const [piConfig, riConfig] = group.measurements as [ObservableTypeConfig, ObservableTypeConfig];
            const piVal = data[piConfig.type]?.value?.value ?? '';
            const riVal = data[riConfig.type]?.value?.value ?? '';
            const piError = errors?.[`f${fetusIndex}_doppler_${piConfig.type}`];
            const riError = errors?.[`f${fetusIndex}_doppler_${riConfig.type}`];
            return (
              <div
                key={group.vesselLabel}
                style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.5rem' }}
              >
                <TextInput
                  id={`f${fetusIndex}_doppler_${piConfig.type}`}
                  labelText={piConfig.label}
                  placeholder="e.g., 0.0"
                  value={piVal}
                  invalid={!!piError}
                  invalidText={piError}
                  disabled={disabled}
                  onChange={(e) => handleChange(piConfig.type, e.target.value)}
                  size="sm"
                />
                <TextInput
                  id={`f${fetusIndex}_doppler_${riConfig.type}`}
                  labelText={riConfig.label}
                  placeholder="e.g., 0.0"
                  value={riVal}
                  invalid={!!riError}
                  invalidText={riError}
                  disabled={disabled}
                  onChange={(e) => handleChange(riConfig.type, e.target.value)}
                  size="sm"
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Single-value sub-grid */}
      {hasSingle && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {singleConfigs.map((config) => {
            const val = data[config.type]?.value?.value ?? '';
            const valError = errors?.[`f${fetusIndex}_doppler_${config.type}`];
            return (
              <TextInput
                key={config.type}
                id={`f${fetusIndex}_doppler_${config.type}`}
                labelText={config.label}
                placeholder="e.g., 0.0"
                value={val}
                invalid={!!valError}
                invalidText={valError}
                disabled={disabled}
                onChange={(e) => handleChange(config.type, e.target.value)}
                size="sm"
              />
            );
          })}
        </div>
      )}
    </div>
  );
});

DopplerSection.displayName = 'DopplerSection';
