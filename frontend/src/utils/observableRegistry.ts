/**
 * observableRegistry.ts — declarative calculation registry and reactive engine (ST-05/ST-06).
 *
 * OBSERVABLE_CALC_REGISTRY maps type string → formula descriptors.
 * computeObservableDerivedFields drives auto-calculation for one fetus section.
 * buildFetusSectionFormData converts stored FetusSectionData → FetusSectionFormData.
 * buildSubmitPayload converts ExaminationFormData → ExaminationData (for API submission).
 * enrichTypeConfig copies validRange/sourceTag from the registry into ObservableTypeConfig.
 */
import {
  calcGAFromBPD, calcGAFromHC, calcGAFromAC, calcGAFromFL,
  calcGAFromOFD, calcGAFromTCD, calcGAFromCRL, calcGAFromEFW,
  calcBPDPercentile, calcHCPercentile, calcACPercentile, calcFLPercentile,
  calcOFDPercentile, calcTCDPercentile, calcEFWPercentile,
  calcEFW, calcGAFromBiometry,
} from './calculations';
import type { ObservableTypeConfig } from '../types';
import type {
  ObservableFormMap,
  ObservableFormFieldState,
  FetusSectionFormData,
  ExaminationFormData,
  AutoCalcValue,
} from '../types/formData';
import { autoCalc } from '../types/formData';
import type { FetusSectionData, Observable, ExaminationData } from '../types';

// ── Calculation descriptor ─────────────────────────────────────────────────────

export interface ObservableCalculationDescriptor {
  calcGa?: (value: number) => string | undefined;
  calcPercentile?: (value: number, ga: string | number) => number | undefined;
  isDerivedValue?: boolean;
  validRange?: { min: number; max: number };
  sourceTag?: string;
}

// ── Registry ───────────────────────────────────────────────────────────────────

export const OBSERVABLE_CALC_REGISTRY: Record<string, ObservableCalculationDescriptor> = {
  // Prenatal standard biometry
  bpd: { calcGa: calcGAFromBPD, calcPercentile: calcBPDPercentile,
         validRange: { min: 23.8, max: 97.6 }, sourceTag: 'Hadlock' },
  hc:  { calcGa: calcGAFromHC,  calcPercentile: calcHCPercentile,
         validRange: { min: 89.4, max: 345.5 }, sourceTag: 'Hadlock' },
  ac:  { calcGa: calcGAFromAC,  calcPercentile: calcACPercentile,
         validRange: { min: 75.2, max: 360.8 }, sourceTag: 'Hadlock' },
  fl:  { calcGa: calcGAFromFL,  calcPercentile: calcFLPercentile,
         validRange: { min: 13.6, max: 78.2 },  sourceTag: 'Hadlock' },
  ofd: { calcGa: calcGAFromOFD, calcPercentile: calcOFDPercentile,
         validRange: { min: 35.5, max: 123.7 }, sourceTag: 'Hadlock' },
  tcd: { calcGa: calcGAFromTCD, calcPercentile: calcTCDPercentile,
         validRange: { min: 11.1, max: 51.3 },  sourceTag: 'Chitty' },
  // First trimester
  crl: { calcGa: calcGAFromCRL,
         validRange: { min: 10, max: 65 },  sourceTag: 'Robinson' },
  // EFW — derived from BPD/HC/AC/FL, not directly entered
  efw: {
    calcGa: calcGAFromEFW,
    calcPercentile: (val, ga) => calcEFWPercentile(val, String(ga)),
    isDerivedValue: true,
    sourceTag: 'Hadlock',
  },
};

// ── enrichTypeConfig ───────────────────────────────────────────────────────────

/**
 * Merges validRange and sourceTag from the registry into an ObservableTypeConfig entry.
 * Called once during EXAM_TYPE_CONFIG construction in examinationTypes.ts.
 */
export function enrichTypeConfig(
  config: Omit<ObservableTypeConfig, 'validRange' | 'sourceTag'>
): ObservableTypeConfig {
  const desc = OBSERVABLE_CALC_REGISTRY[config.type];
  return {
    ...config,
    ...(desc?.validRange ? { validRange: desc.validRange } : {}),
    ...(desc?.sourceTag  ? { sourceTag:  desc.sourceTag  } : {}),
  };
}

// ── computeObservableDerivedFields ────────────────────────────────────────────

/**
 * Pure calculation function for one fetus's biometry ObservableFormMap.
 * Returns a partial map of updated field states.
 *
 * Rules:
 *  - Iterates every entry in biometry that has a non-empty numeric value.
 *  - For each, runs GA and/or percentile formulas if not manually locked.
 *  - EFW is special: value is derived from BPD/HC/AC/FL (Hadlock 4-param).
 *    EFW cascade rule (§14.5): when efw.value.isManual is true, both
 *    efw.percentile and efw.ga are also suppressed from recalculation.
 *  - gaFromBiometry (composite) is computed from BPD/HC/AC/FL.
 */
export function computeObservableDerivedFields(
  biometry: ObservableFormMap,
  clinicalGa: string | undefined,
): Partial<ObservableFormMap> {
  const updates: Partial<ObservableFormMap> = {};

  // 1. Dynamic pass — iterate all non-EFW observables with values
  for (const [type, field] of Object.entries(biometry)) {
    const descriptor = OBSERVABLE_CALC_REGISTRY[type];
    if (!descriptor || descriptor.isDerivedValue || !field?.value?.value) continue;

    const numVal = parseFloat(field.value.value);
    if (isNaN(numVal)) continue;

    let updatedField: ObservableFormFieldState | undefined;

    // GA calculation
    if (descriptor.calcGa && !field.ga?.isManual) {
      const calcGaVal = descriptor.calcGa(numVal);
      const calcGaStr = calcGaVal ?? '';
      if (calcGaStr !== (field.ga?.value ?? '')) {
        updatedField = { ...(updatedField ?? field), ga: autoCalc(calcGaStr, false) };
      }
    }

    // Percentile calculation
    if (descriptor.calcPercentile && !field.percentile?.isManual && clinicalGa) {
      const calcPctl = descriptor.calcPercentile(numVal, clinicalGa);
      const pctlStr = calcPctl != null ? String(calcPctl) : '';
      if (pctlStr !== (field.percentile?.value ?? '')) {
        updatedField = { ...(updatedField ?? field), percentile: autoCalc(pctlStr, false) };
      }
    }

    if (updatedField) {
      updates[type] = updatedField;
    }
  }

  // 2. EFW composite + cascade (§14.5)
  const efwField = biometry['efw'] ?? {
    value: autoCalc(''),
    percentile: autoCalc(''),
    ga: autoCalc(''),
  };

  if (!efwField.value.isManual) {
    // Get current numeric values for BPD/HC/AC/FL
    const bpd = parseFloat(biometry['bpd']?.value?.value ?? '') || undefined;
    const hc  = parseFloat(biometry['hc']?.value?.value  ?? '') || undefined;
    const ac  = parseFloat(biometry['ac']?.value?.value  ?? '') || undefined;
    const fl  = parseFloat(biometry['fl']?.value?.value  ?? '') || undefined;

    const hadlockEfw = calcEFW(bpd, hc, ac, fl);

    if (hadlockEfw != null) {
      const efwValStr = String(Math.round(hadlockEfw));
      const efwNum = hadlockEfw;
      const efwDescriptor = OBSERVABLE_CALC_REGISTRY['efw'];

      // Percentile: suppressed by either its own isManual OR efw.value.isManual (already false here)
      const efwPercentile: AutoCalcValue<string> = (!efwField.percentile?.isManual && clinicalGa && efwDescriptor?.calcPercentile)
        ? autoCalc(String(efwDescriptor.calcPercentile(efwNum, clinicalGa) ?? ''), false)
        : (efwField.percentile ?? autoCalc('', false));

      // GA: suppressed by either its own isManual OR efw.value.isManual (already false here)
      const efwGa: AutoCalcValue<string> = (!efwField.ga?.isManual && efwDescriptor?.calcGa)
        ? autoCalc(efwDescriptor.calcGa(efwNum) ?? '', false)
        : (efwField.ga ?? autoCalc('', false));

      updates['efw'] = {
        value: autoCalc(efwValStr, false),
        percentile: efwPercentile,
        ga: efwGa,
      };
    }
  }

  return updates;
}

/**
 * Compute the composite GA from biometry.
 * First trimester: Robinson formula from CRL.
 * Prenatal: Hadlock composite from BPD/HC/AC/FL.
 * Returns a string like "28w 3d" or '' if cannot be computed.
 */
export function computeGaFromBiometry(
  biometry: ObservableFormMap,
  examType: 'prenatal' | 'first_trimester',
): string {
  if (examType === 'first_trimester') {
    const crl = parseFloat(biometry['crl']?.value?.value ?? '') || undefined;
    const crlGa = crl ? OBSERVABLE_CALC_REGISTRY['crl']?.calcGa?.(crl) : undefined;
    return crlGa ?? '';
  }
  const bpd = parseFloat(biometry['bpd']?.value?.value ?? '') || undefined;
  const hc  = parseFloat(biometry['hc']?.value?.value  ?? '') || undefined;
  const ac  = parseFloat(biometry['ac']?.value?.value  ?? '') || undefined;
  const fl  = parseFloat(biometry['fl']?.value?.value  ?? '') || undefined;
  return calcGAFromBiometry(bpd, hc, ac, fl) ?? '';
}

// ── buildFetusSectionFormData ────────────────────────────────────────────────

/**
 * Convert a stored FetusSectionData into a FetusSectionFormData for the form.
 * Called once per fetus during form initialization.
 * Absent observables produce empty-string AutoCalcValue defaults so all rows always render.
 * All isManual flags default to false (never undefined) in form state.
 */
export function buildFetusSectionFormData(
  storedFetus: FetusSectionData | undefined,
  _examType: 'prenatal' | 'first_trimester',
  // EXAM_TYPE_CONFIG is passed in to avoid circular dependency
  examTypeConfig: { biometryTypes: readonly ObservableTypeConfig[]; dopplerVessels: readonly ObservableTypeConfig[]; dopplerSingle: readonly ObservableTypeConfig[] },
): FetusSectionFormData {
  const initMap = (
    types: readonly string[],
    storedList: Observable[] | undefined,
  ): ObservableFormMap => {
    const lookup = new Map<string, Observable>(storedList?.map(o => [o.type, o]) ?? []);
    const map: ObservableFormMap = {};
    for (const type of types) {
      const stored = lookup.get(type);
      map[type] = {
        value: autoCalc(
          stored?.value != null ? String(stored.value) : '',
          stored?.isManual,
        ),
        percentile: autoCalc(
          stored?.percentile?.value != null ? String(stored.percentile.value) : '',
          stored?.percentile?.isManual,
        ),
        ga: autoCalc(
          stored?.ga?.value ?? '',
          stored?.ga?.isManual,
        ),
      };
    }
    return map;
  };

  return {
    biometry: initMap(
      examTypeConfig.biometryTypes.map(t => t.type),
      storedFetus?.biometry,
    ),
    doppler: initMap(
      [...examTypeConfig.dopplerVessels, ...examTypeConfig.dopplerSingle].map(t => t.type),
      storedFetus?.doppler,
    ),
    ultrasoundFindings: storedFetus?.ultrasoundFindings
      ? Object.fromEntries(
          Object.entries(storedFetus.ultrasoundFindings).map(([k, v]) => [k, String(v)])
        )
      : {},
    anatomy: storedFetus?.anatomy ?? {},
    markers: storedFetus?.markers ?? {},
    gaFromBiometry: autoCalc(
      storedFetus?.gaFromBiometry?.value ?? '',
      storedFetus?.gaFromBiometry?.isManual,
    ),
  };
}

// ── buildSubmitPayload ────────────────────────────────────────────────────────

/**
 * Convert ExaminationFormData back into ExaminationData for API submission.
 * Omits observables with empty value.
 * Omits isManual when false (storage omits false, reads back as false).
 * Only EFW stores isManual on the root value.
 */
export function buildSubmitPayload(formData: ExaminationFormData): ExaminationData {
  const serializeMap = (map: ObservableFormMap): Observable[] =>
    Object.entries(map)
      .filter(([, field]) => field.value.value.trim() !== '')
      .map(([type, field]) => {
        const raw = field.value.value;
        const numericValue = isNaN(Number(raw)) ? NaN : Number(raw);
        const obs: Observable = {
          type,
          value: isNaN(numericValue) ? raw : numericValue,
        };
        // Only EFW stores isManual on root value
        if (type === 'efw' && field.value.isManual) {
          obs.isManual = true;
        }
        if (field.percentile?.value.trim()) {
          obs.percentile = {
            value: parseInt(field.percentile.value, 10),
            ...(field.percentile.isManual ? { isManual: true } : {}),
          };
        }
        if (field.ga?.value.trim()) {
          obs.ga = {
            value: field.ga.value,
            ...(field.ga.isManual ? { isManual: true } : {}),
          };
        }
        return obs;
      });

  return {
    pregnancyData: {
      lastMenstrualPeriod: formData.last_menstrual_period || undefined,
      obstetricHistory: formData.obstetric_history || undefined,
      familyHistory: formData.family_history || undefined,
    },
    comments: formData.comments || undefined,
    fetuses: formData.fetuses.map((f, i) => {
      const fetus: FetusSectionData = {
        index: i,
        biometry: serializeMap(f.biometry),
        doppler: serializeMap(f.doppler),
      };
      if (Object.keys(f.ultrasoundFindings).length > 0) {
        fetus.ultrasoundFindings = f.ultrasoundFindings;
      }
      if (Object.keys(f.anatomy).length > 0) {
        fetus.anatomy = f.anatomy as Record<string, string>;
      }
      if (f.markers && Object.keys(f.markers).length > 0) {
        fetus.markers = f.markers as Record<string, string>;
      }
      if (f.gaFromBiometry.value) {
        fetus.gaFromBiometry = {
          value: f.gaFromBiometry.value,
          ...(f.gaFromBiometry.isManual ? { isManual: true } : {}),
        };
      }
      return fetus;
    }),
  };
}
