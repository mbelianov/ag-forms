/**
 * ObservableRow — renders a single measurement row in the examination form (ST-07).
 *
 * Each row shows: value input, optional percentile input (colour-coded), optional GA input.
 * PercentileInput is used for the percentile column to preserve colour-coding.
 * autoSuffix is applied to labels: "(manual)" in yellow, "(Hadlock)"/"(auto)" in normal colour.
 */
import React from 'react';
import { TextInput } from '@carbon/react';
import PercentileInput from '../PercentileInput';
import type { ObservableFormFieldState, AutoCalcValue } from '../../types/formData';
import type { ObservableTypeConfig } from '../../constants/examinationTypes';

interface ObservableRowProps {
  config: ObservableTypeConfig;
  fieldState: ObservableFormFieldState;
  idPrefix: string;
  disabled?: boolean;
  onChange: (field: keyof ObservableFormFieldState, next: AutoCalcValue<string>) => void;
}

/** Returns a suffix label node reflecting auto-calc or manual status. */
function buildLabel(base: string, value: string, isManual: boolean | undefined, sourceTag?: string): React.ReactNode {
  if (!value.trim()) return base;
  if (isManual) {
    return (
      <>{base} <span style={{ color: '#f1c21b' }}>(manual)</span></>
    );
  }
  if (!sourceTag) return base;
  const tag = sourceTag ?? 'auto';
  return `${base} (${tag})`;
}

export const ObservableRow: React.FC<ObservableRowProps> = React.memo(({
  config,
  fieldState,
  idPrefix,
  disabled = false,
  onChange,
}) => {
  const { type, label, unit, hasPercentile, hasGa, validRange, sourceTag } = config;

  const displayLabel = unit ? `${label} (${unit})` : label;
  const valueLabelNode = buildLabel(displayLabel, fieldState.value.value, fieldState.value.isManual, sourceTag);
  const gaLabelNode = buildLabel(`${label} GA`, fieldState.ga?.value ?? '', fieldState.ga?.isManual, sourceTag);
  const pctlLabelNode = buildLabel(`${label} %`, fieldState.percentile?.value ?? '', fieldState.percentile?.isManual, sourceTag);

  const valuePlaceholder = validRange ? `${validRange.min}–${validRange.max}` : '';

  return (
    <div className="observable-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', alignItems: 'start' }}>
      <TextInput
        id={`${idPrefix}_value`}
        labelText={valueLabelNode as string}
        placeholder={valuePlaceholder}
        value={fieldState.value.value}
        disabled={disabled}
        onChange={(e) => {
          const val = e.target.value;
          onChange('value', {
            value: val,
            // Only EFW marks its own value as manual when directly typed
            ...(type === 'efw' ? { isManual: val.trim() !== '' } : {}),
          });
        }}
        size="sm"
      />
      {hasPercentile ? (
        <PercentileInput
          id={`${idPrefix}_pctl`}
          labelText={pctlLabelNode as string}
          placeholder="1–99"
          value={fieldState.percentile?.value ?? ''}
          disabled={disabled}
          onChange={(e) => {
            const val = e.target.value;
            onChange('percentile', { value: val, isManual: val.trim() !== '' });
          }}
          size="sm"
        />
      ) : (
        <div className="observable-empty-cell" style={{ minHeight: '2rem' }} />
      )}
      {hasGa ? (
        <TextInput
          id={`${idPrefix}_ga`}
          labelText={gaLabelNode as string}
          placeholder="e.g. 28w 2d"
          value={fieldState.ga?.value ?? ''}
          disabled={disabled}
          onChange={(e) => {
            const val = e.target.value;
            onChange('ga', { value: val, isManual: val.trim() !== '' });
          }}
          size="sm"
        />
      ) : (
        <div className="observable-empty-cell" style={{ minHeight: '2rem' }} />
      )}
    </div>
  );
});

ObservableRow.displayName = 'ObservableRow';
