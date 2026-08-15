import { calcGAFromCRL } from '../utils/calculations';

export interface FirstTrimesterAutoCalcInput {
  crl: string;
}

export type FirstTrimesterAutoCalcDiff = {
  gaFromCrl: string;
  gaFromBio: string;
  gaFromCrlIsManual: boolean;
};

export function computeFirstTrimesterDerivedFields(
  input: FirstTrimesterAutoCalcInput,
): FirstTrimesterAutoCalcDiff {
  const crl = parseFloat(input.crl);

  if (!Number.isFinite(crl) || crl < 10 || crl > 65) {
    return {
      gaFromCrl: '',
      gaFromBio: '',
      gaFromCrlIsManual: false,
    };
  }

  const ga = calcGAFromCRL(crl) ?? '';

  return {
    gaFromCrl: ga,
    gaFromBio: ga,
    gaFromCrlIsManual: false,
  };
}
