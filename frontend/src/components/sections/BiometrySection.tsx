/**
 * BiometrySection — generic per-fetus biometry form section.
 * HF-2: Vertical 3-column table layout. Single "Biometry / EFW" button on FL row.
 * Parameterised by `prefix` so DOM ids remain unique when two instances coexist.
 */
import { useState } from 'react';
import { TextInput, Button, FormGroup } from '@carbon/react';
import { calcGAFromBiometry, calcEFW, calcBiometryPercentiles, calcEFWPercentile } from '../../utils/calculations';
import type { BiometryPercentiles } from '../../utils/calculations';

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
  gestationalAgeFromBiometry: string;
  gestationalAge: string; // GA from LMP (read-only reference for percentiles)
}

interface BiometrySectionProps {
  prefix: string; // e.g. "t1" or "t2"
  data: BiometrySectionFormData;
  errors: Record<string, string>;
  onChange: (field: string, value: string) => void;
  isSubmitting: boolean;
}

const calcButtonWrap: React.CSSProperties = { display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' };

// HF-2: 3-column grid — col1: input, col2: percentile or secondary, col3: button or empty
const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 1fr',
  gap: '0.75rem',
  alignItems: 'end',
};

export default function BiometrySection({ prefix, data, errors, onChange, isSubmitting }: BiometrySectionProps) {
  const p = (field: string) => `${prefix}_${field}`;

  const [percentiles, setPercentiles] = useState<BiometryPercentiles | undefined>(undefined);
  const [efwPercentile, setEfwPercentile] = useState<number | undefined>(undefined);

  const biometryFloats = {
    bpd: data.bpd ? parseFloat(data.bpd) : undefined,
    hc:  data.hc  ? parseFloat(data.hc)  : undefined,
    ac:  data.ac  ? parseFloat(data.ac)  : undefined,
    fl:  data.fl  ? parseFloat(data.fl)  : undefined,
  };

  // Single button replaces AutoCalcGA + AutoCalcEFW
  const canCalcGA = !!(biometryFloats.bpd && biometryFloats.hc && biometryFloats.ac && biometryFloats.fl);

  const handleCalcBiometryEFW = () => {
    // Run both calculations in one handler
    const gaResult = calcGAFromBiometry(biometryFloats.bpd, biometryFloats.hc, biometryFloats.ac, biometryFloats.fl);
    if (gaResult) onChange(p('gestationalAgeFromBiometry'), gaResult);
    const pct = calcBiometryPercentiles(biometryFloats.bpd, biometryFloats.hc, biometryFloats.ac, biometryFloats.fl, data.gestationalAge);
    setPercentiles(pct);

    const efwResult = calcEFW(biometryFloats.bpd, biometryFloats.hc, biometryFloats.ac, biometryFloats.fl);
    if (efwResult !== undefined) {
      onChange(p('efw'), efwResult.toString());
      const ep = calcEFWPercentile(efwResult, data.gestationalAge);
      setEfwPercentile(ep);
    }
  };

  const pctText = (val: number | undefined) => val !== undefined ? `${val}th` : '';

  return (
    <FormGroup legendText="">
      <div style={gridStyle}>
        {/* BPD row — col3: GA from Biometry editable field */}
        <TextInput id={p('bpd')} labelText="BPD (mm)" placeholder="e.g., 85.5"
          value={data.bpd} onChange={(e) => onChange(p('bpd'), e.target.value)}
          invalid={!!errors[p('bpd')]} invalidText={errors[p('bpd')]} disabled={isSubmitting} autoComplete="off" />
        <TextInput id={p('bpdPercentile')} labelText="BPD Percentile"
          value={pctText(percentiles?.bpd)} readOnly tabIndex={-1} />
        <TextInput id={p('gestationalAgeFromBiometry')} labelText="GA from Bio"
          placeholder="e.g., 28w 3d" value={data.gestationalAgeFromBiometry}
          onChange={(e) => onChange(p('gestationalAgeFromBiometry'), e.target.value)}
          invalid={!!errors[p('gestationalAgeFromBiometry')]} invalidText={errors[p('gestationalAgeFromBiometry')]}
          disabled={isSubmitting} />

        {/* OFD row */}
        <TextInput id={p('ofd')} labelText="OFD (mm)" placeholder="e.g., 0.0"
          value={data.ofd} onChange={(e) => onChange(p('ofd'), e.target.value)}
          invalid={!!errors[p('ofd')]} invalidText={errors[p('ofd')]} disabled={isSubmitting} autoComplete="off" />
        <div /><div />

        {/* HC row */}
        <TextInput id={p('hc')} labelText="HC (mm)" placeholder="e.g., 310.5"
          value={data.hc} onChange={(e) => onChange(p('hc'), e.target.value)}
          invalid={!!errors[p('hc')]} invalidText={errors[p('hc')]} disabled={isSubmitting} autoComplete="off" />
        <TextInput id={p('hcPercentile')} labelText="HC Percentile"
          value={pctText(percentiles?.hc)} readOnly tabIndex={-1} />
        <div />

        {/* TAD row */}
        <TextInput id={p('tad')} labelText="TAD (mm)" placeholder="e.g., 0.0"
          value={data.tad} onChange={(e) => onChange(p('tad'), e.target.value)}
          invalid={!!errors[p('tad')]} invalidText={errors[p('tad')]} disabled={isSubmitting} autoComplete="off" />
        <div /><div />

        {/* APAD row */}
        <TextInput id={p('apad')} labelText="APAD (mm)" placeholder="e.g., 0.0"
          value={data.apad} onChange={(e) => onChange(p('apad'), e.target.value)}
          invalid={!!errors[p('apad')]} invalidText={errors[p('apad')]} disabled={isSubmitting} autoComplete="off" />
        <div /><div />

        {/* AC row */}
        <TextInput id={p('ac')} labelText="AC (mm)" placeholder="e.g., 280.5"
          value={data.ac} onChange={(e) => onChange(p('ac'), e.target.value)}
          invalid={!!errors[p('ac')]} invalidText={errors[p('ac')]} disabled={isSubmitting} autoComplete="off" />
        <TextInput id={p('acPercentile')} labelText="AC Percentile"
          value={pctText(percentiles?.ac)} readOnly tabIndex={-1} />
        <div />

        {/* FL row — col3: single Biometry / EFW button */}
        <TextInput id={p('fl')} labelText="FL (mm)" placeholder="e.g., 55.5"
          value={data.fl} onChange={(e) => onChange(p('fl'), e.target.value)}
          invalid={!!errors[p('fl')]} invalidText={errors[p('fl')]} disabled={isSubmitting} autoComplete="off" />
        <TextInput id={p('flPercentile')} labelText="FL Percentile"
          value={pctText(percentiles?.fl)} readOnly tabIndex={-1} />
        <div style={calcButtonWrap}>
          <Button kind="tertiary" size="md" onClick={handleCalcBiometryEFW}
            disabled={!canCalcGA || isSubmitting}
            title={canCalcGA
              ? 'Calculate GA from biometry and EFW (BPD, HC, AC, FL required)'
              : 'All four measurements (BPD, HC, AC, FL) required'}>
            Biometry / EFW
          </Button>
        </div>

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

        {/* EFW row */}
        <TextInput id={p('efw')} labelText="EFW (grams)" placeholder="e.g., 1500"
          value={data.efw} onChange={(e) => { onChange(p('efw'), e.target.value); setEfwPercentile(undefined); }}
          invalid={!!errors[p('efw')]} invalidText={errors[p('efw')]} disabled={isSubmitting} autoComplete="off" />
        <TextInput id={p('efwPercentile')} labelText="EFW Percentile"
          value={efwPercentile !== undefined ? `${efwPercentile}th` : ''} placeholder="—" readOnly tabIndex={-1} />
        <div />

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
