import { TextInput, type TextInputProps } from '@carbon/react';
import type { CSSProperties } from 'react';

function getPercentileBg(value: string): string {
  const numericValue = Number(value);

  if (value.trim() === '' || Number.isNaN(numericValue)) {
    return 'transparent';
  }

  if (numericValue < 2.27 || numericValue > 97.73) {
    return '#ffc7ce';
  }

  if (numericValue < 5 || numericValue > 95) {
    return '#ffee99';
  }

  return '#c6efce';
}

export default function PercentileInput({ value = '', ...props }: TextInputProps) {
  return (
    <div
      className="p-input-wrap"
      style={{ '--p-bg': getPercentileBg(String(value)) } as CSSProperties}
    >
      <TextInput value={value} {...props} />
    </div>
  );
}
