/**
 * DopplerSection — generic per-fetus doppler form section.
 * Parameterised by `prefix` so DOM ids remain unique when two instances coexist.
 * Has no knowledge of twin logic.
 */
import { TextInput, FormGroup, Stack } from '@carbon/react';

export interface DopplerSectionFormData {
  pi: string;
  ri: string;
  vessel: string;
  ducVen: string;
  utADexPI: string;
  utADexRI: string;
  utASinPI: string;
  utASinRI: string;
  cma: string;
  psv: string;
  cpr: string;
}

interface DopplerSectionProps {
  prefix: string; // e.g. "t1" or "t2"
  data: DopplerSectionFormData;
  errors: Record<string, string>;
  onChange: (field: string, value: string) => void;
  isSubmitting: boolean;
  columns?: 4 | 6;
}

export default function DopplerSection({ prefix, data, errors, onChange, isSubmitting, columns = 6 }: DopplerSectionProps) {
  const p = (field: string) => `${prefix}_${field}`;
  const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: '0.75rem' };

  return (
    <FormGroup legendText="">
      <Stack gap={3}>
        {/* Row A: PI | RI | Vessel | DucVen | A.ut.Dex PI | A.ut.Dex RI */}
        <div style={gridStyle}>
          <TextInput id={p('pi')} labelText="PI" placeholder="e.g., 1.25" value={data.pi} onChange={(e) => onChange(p('pi'), e.target.value)} invalid={!!errors[p('pi')]} invalidText={errors[p('pi')]} disabled={isSubmitting} autoComplete="off" />
          <TextInput id={p('ri')} labelText="RI" placeholder="e.g., 0.65" value={data.ri} onChange={(e) => onChange(p('ri'), e.target.value)} invalid={!!errors[p('ri')]} invalidText={errors[p('ri')]} disabled={isSubmitting} autoComplete="off" />
          <TextInput id={p('vessel')} labelText="Vessel" placeholder="e.g., Umbilical artery" value={data.vessel} onChange={(e) => onChange(p('vessel'), e.target.value)} disabled={isSubmitting} autoComplete="off" />
          <TextInput id={p('ducVen')} labelText="Duc.Ven" placeholder="e.g., normal" value={data.ducVen} onChange={(e) => onChange(p('ducVen'), e.target.value)} disabled={isSubmitting} autoComplete="off" />
          <TextInput id={p('utADexPI')} labelText="A.ut. Dex PI" placeholder="e.g., 0.0" value={data.utADexPI} onChange={(e) => onChange(p('utADexPI'), e.target.value)} invalid={!!errors[p('utADexPI')]} invalidText={errors[p('utADexPI')]} disabled={isSubmitting} autoComplete="off" />
          <TextInput id={p('utADexRI')} labelText="A.ut. Dex RI" placeholder="e.g., 0.0" value={data.utADexRI} onChange={(e) => onChange(p('utADexRI'), e.target.value)} invalid={!!errors[p('utADexRI')]} invalidText={errors[p('utADexRI')]} disabled={isSubmitting} autoComplete="off" />
        </div>
        {/* Row B: A.ut.Sin PI | A.ut.Sin RI | CMA | PSV | CPR */}
        <div style={gridStyle}>
          <TextInput id={p('utASinPI')} labelText="A.ut. Sin PI" placeholder="e.g., 0.0" value={data.utASinPI} onChange={(e) => onChange(p('utASinPI'), e.target.value)} invalid={!!errors[p('utASinPI')]} invalidText={errors[p('utASinPI')]} disabled={isSubmitting} autoComplete="off" />
          <TextInput id={p('utASinRI')} labelText="A.ut. Sin RI" placeholder="e.g., 0.0" value={data.utASinRI} onChange={(e) => onChange(p('utASinRI'), e.target.value)} invalid={!!errors[p('utASinRI')]} invalidText={errors[p('utASinRI')]} disabled={isSubmitting} autoComplete="off" />
          <TextInput id={p('cma')} labelText="CMA" placeholder="e.g., 0.0" value={data.cma} onChange={(e) => onChange(p('cma'), e.target.value)} invalid={!!errors[p('cma')]} invalidText={errors[p('cma')]} disabled={isSubmitting} autoComplete="off" />
          <TextInput id={p('psv')} labelText="PSV" placeholder="e.g., 0.0" value={data.psv} onChange={(e) => onChange(p('psv'), e.target.value)} invalid={!!errors[p('psv')]} invalidText={errors[p('psv')]} disabled={isSubmitting} autoComplete="off" />
          <TextInput id={p('cpr')} labelText="CPR" placeholder="e.g., 0.0" value={data.cpr} onChange={(e) => onChange(p('cpr'), e.target.value)} invalid={!!errors[p('cpr')]} invalidText={errors[p('cpr')]} disabled={isSubmitting} autoComplete="off" />
          <div />
        </div>
      </Stack>
    </FormGroup>
  );
}

// Made with Bob
