/**
 * BiometrySection — generic per-fetus biometry form section.
 * KI-009: Each biometry row now has three columns:
 *   Col 1: measurement input
 *   Col 2: percentile (editable — auto-calculated or manually entered)
 *   Col 3: GA from measurement (editable — auto-calculated or manually entered)
 *
 * The "Biometry / EFW" calculate button has been removed — percentiles and GA
 * values are now auto-calculated reactively via useBiometryAutoCalc.
 *
 * TAD and APAD have percentile/GA inputs but no auto-calc formula (manual entry only).
 *
 * Parameterised by `prefix` so DOM ids remain unique when two instances coexist.
 */
import { TextInput, FormGroup } from '@carbon/react';
import { autoCalcLabel } from '../AutoCalcHelpers';

export interface BiometrySectionFormData {
  bpd: string;
  hc: string;
  ac: string;
  fl: string;
  efw: string;
  ofd: string;
  vp: string;
  tcd: string;
  cm: string;
  nuchalFold: string;
  nb: string;
  apad: string;
  tad: string;
  la: string;
  lc: string;
  gestationalAge: string; // GA from LMP (read-only reference for percentiles)
  // KI-009: Persisted percentile fields (displayed as string inputs)
  bpdPercentile: string;
  hcPercentile: string;
  acPercentile: string;
  flPercentile: string;
  ofdPercentile: string;
  tadPercentile: string;
  apadPercentile: string;
  efwPercentile: string;
  // KI-009: Per-measurement GA fields
  bpdGa: string;
  hcGa: string;
  acGa: string;
  flGa: string;
  ofdGa: string;
  tadGa: string;
  apadGa: string;
  efwGa: string;
  // KI-009: IsManual flags (not rendered but needed for submit)
  bpdPercentileIsManual: boolean;
  hcPercentileIsManual: boolean;
  acPercentileIsManual: boolean;
  flPercentileIsManual: boolean;
  ofdPercentileIsManual: boolean;
  tadPercentileIsManual: boolean;
  apadPercentileIsManual: boolean;
  efwPercentileIsManual: boolean;
  bpdGaIsManual: boolean;
  hcGaIsManual: boolean;
  acGaIsManual: boolean;
  flGaIsManual: boolean;
  ofdGaIsManual: boolean;
  tadGaIsManual: boolean;
  apadGaIsManual: boolean;
  efwGaIsManual: boolean;
  efwIsManual: boolean;
}

interface BiometrySectionProps {
  prefix: string; // e.g. "t1" or "t2"
  data: BiometrySectionFormData;
  errors: Record<string, string>;
  onChange: (field: string, value: string) => void;
  isSubmitting: boolean;
}

// 3-column grid: col1 = measurement input, col2 = percentile, col3 = GA from measurement
const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 1fr',
  gap: '0.75rem',
  alignItems: 'end',
};

export default function BiometrySection({ prefix, data, errors, onChange, isSubmitting }: BiometrySectionProps) {
  const p = (field: string) => `${prefix}_${field}`;

  return (
    <FormGroup legendText="">
      <div style={gridStyle}>
        {/* BPD row — col2: BPD percentile (editable), col3: GA from BPD (editable) */}
        <TextInput id={p('bpd')} labelText="BPD (mm)" placeholder="e.g., 85.5"
          value={data.bpd} onChange={(e) => onChange(p('bpd'), e.target.value)}
          invalid={!!errors[p('bpd')]} invalidText={errors[p('bpd')]} disabled={isSubmitting} autoComplete="off" />
        <TextInput id={p('bpdPercentile')} labelText={autoCalcLabel('BPD Percentile', data.bpdPercentileIsManual)}
          placeholder="auto" value={data.bpdPercentile}
          onChange={(e) => onChange(p('bpdPercentile'), e.target.value)}
          disabled={isSubmitting} />
        <TextInput id={p('bpdGa')} labelText={autoCalcLabel('BPD GA', data.bpdGaIsManual)}
          placeholder="auto (24-98mm)" value={data.bpdGa}
          onChange={(e) => onChange(p('bpdGa'), e.target.value)}
          disabled={isSubmitting} />

        {/* OFD row */}
        <TextInput id={p('ofd')} labelText="OFD (mm)" placeholder="e.g., 0.0"
          value={data.ofd} onChange={(e) => onChange(p('ofd'), e.target.value)}
          invalid={!!errors[p('ofd')]} invalidText={errors[p('ofd')]} disabled={isSubmitting} autoComplete="off" />
        <TextInput id={p('ofdPercentile')} labelText={autoCalcLabel('OFD Percentile', data.ofdPercentileIsManual)}
          placeholder="auto" value={data.ofdPercentile}
          onChange={(e) => onChange(p('ofdPercentile'), e.target.value)}
          disabled={isSubmitting} />
        <TextInput id={p('ofdGa')} labelText={autoCalcLabel('OFD GA', data.ofdGaIsManual)}
          placeholder="auto (26-100mm)" value={data.ofdGa}
          onChange={(e) => onChange(p('ofdGa'), e.target.value)}
          disabled={isSubmitting} />

        {/* HC row */}
        <TextInput id={p('hc')} labelText="HC (mm)" placeholder="e.g., 310.5"
          value={data.hc} onChange={(e) => onChange(p('hc'), e.target.value)}
          invalid={!!errors[p('hc')]} invalidText={errors[p('hc')]} disabled={isSubmitting} autoComplete="off" />
        <TextInput id={p('hcPercentile')} labelText={autoCalcLabel('HC Percentile', data.hcPercentileIsManual)}
          placeholder="auto" value={data.hcPercentile}
          onChange={(e) => onChange(p('hcPercentile'), e.target.value)}
          disabled={isSubmitting} />
        <TextInput id={p('hcGa')} labelText={autoCalcLabel('HC GA', data.hcGaIsManual)}
          placeholder="auto (90-345mm)" value={data.hcGa}
          onChange={(e) => onChange(p('hcGa'), e.target.value)}
          disabled={isSubmitting} />

        {/* TAD row — manual percentile/GA only (no formula) */}
        <TextInput id={p('tad')} labelText="TAD (mm)" placeholder="e.g., 0.0"
          value={data.tad} onChange={(e) => onChange(p('tad'), e.target.value)}
          invalid={!!errors[p('tad')]} invalidText={errors[p('tad')]} disabled={isSubmitting} autoComplete="off" />
        <TextInput id={p('tadPercentile')} labelText="TAD Percentile"
          placeholder="manual" value={data.tadPercentile}
          onChange={(e) => onChange(p('tadPercentile'), e.target.value)}
          disabled={isSubmitting} />
        <TextInput id={p('tadGa')} labelText="TAD GA"
          placeholder="manual" value={data.tadGa}
          onChange={(e) => onChange(p('tadGa'), e.target.value)}
          disabled={isSubmitting} />

        {/* APAD row — manual percentile/GA only (no formula) */}
        <TextInput id={p('apad')} labelText="APAD (mm)" placeholder="e.g., 0.0"
          value={data.apad} onChange={(e) => onChange(p('apad'), e.target.value)}
          invalid={!!errors[p('apad')]} invalidText={errors[p('apad')]} disabled={isSubmitting} autoComplete="off" />
        <TextInput id={p('apadPercentile')} labelText="APAD Percentile"
          placeholder="manual" value={data.apadPercentile}
          onChange={(e) => onChange(p('apadPercentile'), e.target.value)}
          disabled={isSubmitting} />
        <TextInput id={p('apadGa')} labelText="APAD GA"
          placeholder="manual" value={data.apadGa}
          onChange={(e) => onChange(p('apadGa'), e.target.value)}
          disabled={isSubmitting} />

        {/* AC row */}
        <TextInput id={p('ac')} labelText="AC (mm)" placeholder="e.g., 280.5"
          value={data.ac} onChange={(e) => onChange(p('ac'), e.target.value)}
          invalid={!!errors[p('ac')]} invalidText={errors[p('ac')]} disabled={isSubmitting} autoComplete="off" />
        <TextInput id={p('acPercentile')} labelText={autoCalcLabel('AC Percentile', data.acPercentileIsManual)}
          placeholder="auto" value={data.acPercentile}
          onChange={(e) => onChange(p('acPercentile'), e.target.value)}
          disabled={isSubmitting} />
        <TextInput id={p('acGa')} labelText={autoCalcLabel('AC GA', data.acGaIsManual)}
          placeholder="auto (76-360mm)" value={data.acGa}
          onChange={(e) => onChange(p('acGa'), e.target.value)}
          disabled={isSubmitting} />

        {/* FL row */}
        <TextInput id={p('fl')} labelText="FL (mm)" placeholder="e.g., 55.5"
          value={data.fl} onChange={(e) => onChange(p('fl'), e.target.value)}
          invalid={!!errors[p('fl')]} invalidText={errors[p('fl')]} disabled={isSubmitting} autoComplete="off" />
        <TextInput id={p('flPercentile')} labelText={autoCalcLabel('FL Percentile', data.flPercentileIsManual)}
          placeholder="auto" value={data.flPercentile}
          onChange={(e) => onChange(p('flPercentile'), e.target.value)}
          disabled={isSubmitting} />
        <TextInput id={p('flGa')} labelText={autoCalcLabel('FL GA', data.flGaIsManual)}
          placeholder="auto (14-78mm)" value={data.flGa}
          onChange={(e) => onChange(p('flGa'), e.target.value)}
          disabled={isSubmitting} />

        {/* EFW row */}
        <TextInput id={p('efw')} labelText={autoCalcLabel('EFW (grams)', data.efwIsManual)} placeholder="e.g., 1500"
          value={data.efw} onChange={(e) => onChange(p('efw'), e.target.value)}
          invalid={!!errors[p('efw')]} invalidText={errors[p('efw')]} disabled={isSubmitting} autoComplete="off" />
        <TextInput id={p('efwPercentile')} labelText={autoCalcLabel('EFW Percentile', data.efwPercentileIsManual)}
          placeholder="auto" value={data.efwPercentile}
          onChange={(e) => onChange(p('efwPercentile'), e.target.value)}
          disabled={isSubmitting} />
        <TextInput id={p('efwGa')} labelText={autoCalcLabel('EFW GA', data.efwGaIsManual)}
          placeholder="auto" value={data.efwGa}
          onChange={(e) => onChange(p('efwGa'), e.target.value)}
          disabled={isSubmitting} />

        {/* TCD row */}
        <TextInput id={p('tcd')} labelText="TCD (mm)" placeholder="e.g., 0.0"
          value={data.tcd} onChange={(e) => onChange(p('tcd'), e.target.value)}
          invalid={!!errors[p('tcd')]} invalidText={errors[p('tcd')]} disabled={isSubmitting} autoComplete="off" />
        <div /><div />

        {/* Vp row */}
        <TextInput id={p('vp')} labelText="Vp" placeholder="e.g., custom value"
          value={data.vp} onChange={(e) => onChange(p('vp'), e.target.value)}
          invalid={!!errors[p('vp')]} invalidText={errors[p('vp')]} disabled={isSubmitting} autoComplete="off" />
        <div /><div />

        {/* CM row */}
        <TextInput id={p('cm')} labelText="CM (mm)" placeholder="e.g., 0.0"
          value={data.cm} onChange={(e) => onChange(p('cm'), e.target.value)}
          invalid={!!errors[p('cm')]} invalidText={errors[p('cm')]} disabled={isSubmitting} autoComplete="off" />
        <div /><div />

        {/* NF row */}
        <TextInput id={p('nuchalFold')} labelText="NF (mm)" placeholder="e.g., 0.0"
          value={data.nuchalFold} onChange={(e) => onChange(p('nuchalFold'), e.target.value)}
          invalid={!!errors[p('nuchalFold')]} invalidText={errors[p('nuchalFold')]} disabled={isSubmitting} autoComplete="off" />
        <div /><div />

        {/* NB row */}
        <TextInput id={p('nb')} labelText="NB (mm)" placeholder="e.g., 0.0"
          value={data.nb} onChange={(e) => onChange(p('nb'), e.target.value)}
          invalid={!!errors[p('nb')]} invalidText={errors[p('nb')]} disabled={isSubmitting} autoComplete="off" />
        <div /><div />

        {/* LA row */}
        <TextInput id={p('la')} labelText="LA" placeholder="e.g., custom value"
          value={data.la} onChange={(e) => onChange(p('la'), e.target.value)}
          invalid={!!errors[p('la')]} invalidText={errors[p('la')]} disabled={isSubmitting} autoComplete="off" />
        <div /><div />

        {/* LC row */}
        <TextInput id={p('lc')} labelText="LC (mm)" placeholder="e.g., 0.0"
          value={data.lc} onChange={(e) => onChange(p('lc'), e.target.value)}
          invalid={!!errors[p('lc')]} invalidText={errors[p('lc')]} disabled={isSubmitting} autoComplete="off" />
        <div /><div />
      </div>
    </FormGroup>
  );
}

// Made with Bob
