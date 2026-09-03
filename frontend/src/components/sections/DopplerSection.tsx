/**
 * DopplerSection — renders the doppler measurement inputs for one fetus.
 *
 * Two sub-grids:
 *   Vessel grid  — vesselConfigs entries taken in pairs (PI + RI per vessel row).
 *                  Each pair shares a row: [PI label+input] [RI label+input].
 *   Single grid  — singleConfigs entries, one per row, full width.
 */
import React from 'react';
import { TextInput } from '@carbon/react';
import type { ObservableFormMap, ObservableFormFieldState, AutoCalcValue } from '../../types/formData';
import type { ObservableTypeConfig } from '../../constants/examinationTypes';

interface DopplerSectionProps {
  fetusIndex: number;
  vesselConfigs: readonly ObservableTypeConfig[];
  singleConfigs: readonly ObservableTypeConfig[];
  data: ObservableFormMap;
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

const colHeaderStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: '#525252',
  fontWeight: 600,
  paddingBottom: '0.25rem',
};

export const DopplerSection: React.FC<DopplerSectionProps> = React.memo(({
  fetusIndex,
  vesselConfigs,
  singleConfigs,
  data,
  disabled = false,
  onFieldChange,
}) => {
  const handleChange = (type: string, value: string) => {
    onFieldChange(fetusIndex, 'doppler', type, 'value', { value, isManual: value.trim() !== '' });
  };

  // Pair vessel configs: [0,1], [2,3], [4,5] ...
  const vesselPairs: [ObservableTypeConfig, ObservableTypeConfig][] = [];
  for (let i = 0; i + 1 < vesselConfigs.length; i += 2) {
    vesselPairs.push([vesselConfigs[i], vesselConfigs[i + 1]]);
  }

  const hasVessels = vesselPairs.length > 0;
  const hasSingle = singleConfigs.length > 0;

  if (!hasVessels && !hasSingle) return null;

  return (
    <div>
      <h5 style={sectionTitleStyle}>Doppler</h5>

      {/* Vessel sub-grid */}
      {hasVessels && (
        <div style={{ marginBottom: hasSingle ? '1rem' : 0 }}>
          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <span style={colHeaderStyle}>PI</span>
            <span style={colHeaderStyle}>RI</span>
          </div>
          {vesselPairs.map(([piConfig, riConfig]) => {
            const piVal = data[piConfig.type]?.value?.value ?? '';
            const riVal = data[riConfig.type]?.value?.value ?? '';
            return (
              <div
                key={piConfig.type}
                style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.5rem' }}
              >
                <TextInput
                  id={`f${fetusIndex}_dop_${piConfig.type}`}
                  labelText={piConfig.label}
                  placeholder="e.g., 0.0"
                  value={piVal}
                  disabled={disabled}
                  onChange={(e) => handleChange(piConfig.type, e.target.value)}
                  size="sm"
                />
                <TextInput
                  id={`f${fetusIndex}_dop_${riConfig.type}`}
                  labelText={riConfig.label}
                  placeholder="e.g., 0.0"
                  value={riVal}
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
            return (
              <TextInput
                key={config.type}
                id={`f${fetusIndex}_dop_${config.type}`}
                labelText={config.label}
                placeholder="e.g., 0.0"
                value={val}
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
