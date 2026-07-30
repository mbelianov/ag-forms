/**
 * BiometrySection — generic per-fetus biometry form section.
 * Parameterised by `prefix` so DOM ids remain unique when two instances coexist
 * (e.g. "t1" and "t2" for twins). Has no knowledge of twin logic.
 */
import { useState } from 'react';
import { TextInput, Button, FormGroup, Stack } from '@carbon/react';
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
  columns?: 4 | 6;
}

const calcButtonWrap: React.CSSProperties = { display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' };

export default function BiometrySection({ prefix, data, errors, onChange, isSubmitting, columns = 6 }: BiometrySectionProps) {
  const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: '0.75rem' };
  const p = (field: string) => `${prefix}_${field}`; // unique DOM id helper

  const [percentiles, setPercentiles] = useState<BiometryPercentiles | undefined>(undefined);
  const [efwPercentile, setEfwPercentile] = useState<number | undefined>(undefined);

  const biometryFloats = {
    bpd: data.bpd ? parseFloat(data.bpd) : undefined,
    hc:  data.hc  ? parseFloat(data.hc)  : undefined,
    ac:  data.ac  ? parseFloat(data.ac)  : undefined,
    fl:  data.fl  ? parseFloat(data.fl)  : undefined,
  };

  const canCalcGA  = !!(biometryFloats.bpd && biometryFloats.hc && biometryFloats.ac && biometryFloats.fl);
  const canCalcEFW = canCalcGA;

  const handleCalcGA = () => {
    const result = calcGAFromBiometry(biometryFloats.bpd, biometryFloats.hc, biometryFloats.ac, biometryFloats.fl);
    if (result) onChange(p('gestationalAgeFromBiometry'), result);
    const pct = calcBiometryPercentiles(biometryFloats.bpd, biometryFloats.hc, biometryFloats.ac, biometryFloats.fl, data.gestationalAge);
    setPercentiles(pct);
  };

  const handleCalcEFW = () => {
    const result = calcEFW(biometryFloats.bpd, biometryFloats.hc, biometryFloats.ac, biometryFloats.fl);
    if (result !== undefined) {
      onChange(p('efw'), result.toString());
      const pct = calcEFWPercentile(result, data.gestationalAge);
      setEfwPercentile(pct);
    }
  };

  return (
    <FormGroup legendText="">
      <Stack gap={3}>
        {/* Core 4 measurements with percentile fields */}
        <div style={gridStyle}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <TextInput id={p('bpd')} labelText="BPD (mm)" placeholder="e.g., 85.5" value={data.bpd} onChange={(e) => onChange(p('bpd'), e.target.value)} invalid={!!errors[p('bpd')]} invalidText={errors[p('bpd')]} disabled={isSubmitting} autoComplete="off" />
            <TextInput id={p('bpdPercentile')} labelText="BPD Percentile" value={percentiles?.bpd !== undefined ? `${percentiles.bpd}th` : ''} readOnly tabIndex={-1} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <TextInput id={p('hc')} labelText="HC (mm)" placeholder="e.g., 310.5" value={data.hc} onChange={(e) => onChange(p('hc'), e.target.value)} invalid={!!errors[p('hc')]} invalidText={errors[p('hc')]} disabled={isSubmitting} autoComplete="off" />
            <TextInput id={p('hcPercentile')} labelText="HC Percentile" value={percentiles?.hc !== undefined ? `${percentiles.hc}th` : ''} readOnly tabIndex={-1} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <TextInput id={p('ac')} labelText="AC (mm)" placeholder="e.g., 280.5" value={data.ac} onChange={(e) => onChange(p('ac'), e.target.value)} invalid={!!errors[p('ac')]} invalidText={errors[p('ac')]} disabled={isSubmitting} autoComplete="off" />
            <TextInput id={p('acPercentile')} labelText="AC Percentile" value={percentiles?.ac !== undefined ? `${percentiles.ac}th` : ''} readOnly tabIndex={-1} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <TextInput id={p('fl')} labelText="FL (mm)" placeholder="e.g., 55.5" value={data.fl} onChange={(e) => onChange(p('fl'), e.target.value)} invalid={!!errors[p('fl')]} invalidText={errors[p('fl')]} disabled={isSubmitting} autoComplete="off" />
            <TextInput id={p('flPercentile')} labelText="FL Percentile" value={percentiles?.fl !== undefined ? `${percentiles.fl}th` : ''} readOnly tabIndex={-1} />
          </div>
        </div>

        {/* AutoCalc GA row */}
        <div style={{ display: 'grid', gridTemplateColumns: '9rem 1fr 1fr', gap: '0.75rem', alignItems: 'end' }}>
          <div style={calcButtonWrap}>
            <Button kind="tertiary" size="md" onClick={handleCalcGA} disabled={!canCalcGA || isSubmitting}
              title={canCalcGA ? 'Calculate GA from BPD, HC, AC and FL' : 'All four measurements required'}>
              AutoCalc GA
            </Button>
          </div>
          <TextInput id={p('gestationalAgeFromBiometry')} labelText="GA from Biometry" placeholder="e.g., 28w 3d"
            value={data.gestationalAgeFromBiometry} onChange={(e) => onChange(p('gestationalAgeFromBiometry'), e.target.value)}
            invalid={!!errors[p('gestationalAgeFromBiometry')]} invalidText={errors[p('gestationalAgeFromBiometry')]} disabled={isSubmitting} />
          <TextInput id={p('gestationalAgeFromLMPReadonly')} labelText="GA from LMP" value={data.gestationalAge} readOnly tabIndex={-1} />
        </div>

        {/* AutoCalc EFW row */}
        <div style={{ display: 'grid', gridTemplateColumns: '9rem 1fr 1fr', gap: '0.75rem', alignItems: 'end' }}>
          <div style={calcButtonWrap}>
            <Button kind="tertiary" size="md" onClick={handleCalcEFW} disabled={!canCalcEFW || isSubmitting}
              title={canCalcEFW ? 'Calculate EFW from BPD, HC, AC and FL (Hadlock)' : 'All four measurements required'}>
              AutoCalc EFW
            </Button>
          </div>
          <TextInput id={p('efw')} labelText="EFW (grams)" placeholder="e.g., 1500"
            value={data.efw} onChange={(e) => { onChange(p('efw'), e.target.value); setEfwPercentile(undefined); }}
            invalid={!!errors[p('efw')]} invalidText={errors[p('efw')]} disabled={isSubmitting} />
          <TextInput id={p('efwPercentile')} labelText="EFW Percentile"
            value={efwPercentile !== undefined ? `${efwPercentile}th` : ''} placeholder="—" readOnly tabIndex={-1} />
        </div>

        {/* Extended biometry fields */}
        <div style={gridStyle}>
          {(['tcd', 'cm', 'ofd', 'vp', 'nuchalFold', 'nb', 'apad', 'tad'] as const).map((field) => {
            const labels: Record<string, string> = {
              tcd: 'TCD (mm)', cm: 'CM (mm)', ofd: 'OFD (mm)', vp: 'Vp (mm)',
              nuchalFold: 'NF (mm)', nb: 'NB (mm)', apad: 'APAD (mm)', tad: 'TAD (mm)',
            };
            return (
              <TextInput key={field} id={p(field)} labelText={labels[field]} placeholder="e.g., 0.0"
                value={data[field] ?? ''} onChange={(e) => onChange(p(field), e.target.value)}
                invalid={!!errors[p(field)]} invalidText={errors[p(field)]} disabled={isSubmitting} autoComplete="off" />
            );
          })}
          <TextInput id={p('la')} labelText="LA (mm)" placeholder="e.g., 0.0" value={data.la}
            onChange={(e) => onChange(p('la'), e.target.value)} invalid={!!errors[p('la')]} invalidText={errors[p('la')]} disabled={isSubmitting} autoComplete="off" />
          <TextInput id={p('lc')} labelText="LC (mm)" placeholder="e.g., 0.0" value={data.lc}
            onChange={(e) => onChange(p('lc'), e.target.value)} invalid={!!errors[p('lc')]} invalidText={errors[p('lc')]} disabled={isSubmitting} autoComplete="off" />
        </div>
      </Stack>
    </FormGroup>
  );
}

// Made with Bob
