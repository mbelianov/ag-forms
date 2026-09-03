/**
 * ObservableSection — renders all measurement rows for one section (biometry or doppler)
 * for a single fetus (ST-07).
 *
 * Driven entirely by config.typeConfigs + data (ObservableFormMap).
 * No isFt / isTwins / SECTION_VISIBILITY references.
 */
import React from 'react';
import { ObservableRow } from './ObservableRow';
import type { ObservableFormMap, ObservableFormFieldState, AutoCalcValue } from '../../types/formData';
import type { ObservableTypeConfig } from '../../constants/examinationTypes';

interface ObservableSectionProps {
  title: string;
  fetusIndex: number;
  sectionKey: 'biometry' | 'doppler';
  typeConfigs: readonly ObservableTypeConfig[];
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

export const ObservableSection: React.FC<ObservableSectionProps> = React.memo(({
  title,
  fetusIndex,
  sectionKey,
  typeConfigs,
  data,
  disabled = false,
  onFieldChange,
}) => {
  return (
    <div className="observable-section">
      <h5 className="observable-section-title">{title}</h5>
      <div className="observable-section-rows">
        {typeConfigs.map((config) => {
          const fieldState = data[config.type] ?? {
            value: { value: '' },
            percentile: { value: '' },
            ga: { value: '' },
          };
          return (
            <ObservableRow
              key={config.type}
              config={config}
              fieldState={fieldState}
              idPrefix={`f${fetusIndex}_${sectionKey}_${config.type}`}
              disabled={disabled}
              onChange={(field, next) =>
                onFieldChange(fetusIndex, sectionKey, config.type, field, next)
              }
            />
          );
        })}
      </div>
    </div>
  );
});

ObservableSection.displayName = 'ObservableSection';
