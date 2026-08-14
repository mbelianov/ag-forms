import type { ReactNode } from 'react';
import { AutoCalcDot } from './AutoCalcDot';

export function autoCalcLabel(label: string, isManual: boolean, size = 6): ReactNode {
  if (!isManual) {
    return label;
  }

  return <>{label} <AutoCalcDot size={size} /></>;
}
