/**
 * DopplerSection — generic per-fetus doppler form section.
 * HF-3: Vessel-table layout. `vessel` field removed. Labels renamed.
 * Parameterised by `prefix` so DOM ids remain unique when two instances coexist.
 */
import { TextInput, FormGroup, Stack } from '@carbon/react';

export interface DopplerSectionFormData {
  pi: string;
  ri: string;
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
}

export default function DopplerSection({ prefix, data, errors, onChange, isSubmitting }: DopplerSectionProps) {
  const p = (field: string) => `${prefix}_${field}`;

  // Sub-grid A: vessel label | PI input | RI input  (3 rows × 3 cols = 9 cells)
  const gridA: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '8rem 1fr 1fr',
    gap: '0.5rem',
    alignItems: 'end',
  };

  // Sub-grid B: vessel label | single input  (4 rows × 2 cols = 8 cells)
  const gridB: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '8rem 1fr',
    gap: '0.5rem',
    alignItems: 'end',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '0.875rem',
    color: '#525252',
    paddingBottom: '0.5rem',
    textAlign: 'left',
  };

  return (
    <FormGroup legendText="">
      <Stack gap={4}>
        {/* Sub-grid A: PI / RI vessel table */}
        <div style={gridA}>
          {/* Header row */}
          <div />
          <div style={labelStyle}>PI</div>
          <div style={labelStyle}>RI</div>
          {/* A. ut. Dex. row */}
          <div style={labelStyle}>A. ut. Dex.</div>
          <TextInput id={p('utADexPI')} labelText="" placeholder="e.g., 0.0"
            value={data.utADexPI} onChange={(e) => onChange(p('utADexPI'), e.target.value)}
            invalid={!!errors[p('utADexPI')]} invalidText={errors[p('utADexPI')]}
            disabled={isSubmitting} autoComplete="off" />
          <TextInput id={p('utADexRI')} labelText="" placeholder="e.g., 0.0"
            value={data.utADexRI} onChange={(e) => onChange(p('utADexRI'), e.target.value)}
            invalid={!!errors[p('utADexRI')]} invalidText={errors[p('utADexRI')]}
            disabled={isSubmitting} autoComplete="off" />
          {/* A. ut. Sin. row */}
          <div style={labelStyle}>A. ut. Sin.</div>
          <TextInput id={p('utASinPI')} labelText="" placeholder="e.g., 0.0"
            value={data.utASinPI} onChange={(e) => onChange(p('utASinPI'), e.target.value)}
            invalid={!!errors[p('utASinPI')]} invalidText={errors[p('utASinPI')]}
            disabled={isSubmitting} autoComplete="off" />
          <TextInput id={p('utASinRI')} labelText="" placeholder="e.g., 0.0"
            value={data.utASinRI} onChange={(e) => onChange(p('utASinRI'), e.target.value)}
            invalid={!!errors[p('utASinRI')]} invalidText={errors[p('utASinRI')]}
            disabled={isSubmitting} autoComplete="off" />
          {/* A. Umb. row */}
          <div style={labelStyle}>A. Umb.</div>
          <TextInput id={p('pi')} labelText="" placeholder="e.g., 1.25"
            value={data.pi} onChange={(e) => onChange(p('pi'), e.target.value)}
            invalid={!!errors[p('pi')]} invalidText={errors[p('pi')]}
            disabled={isSubmitting} autoComplete="off" />
          <TextInput id={p('ri')} labelText="" placeholder="e.g., 0.65"
            value={data.ri} onChange={(e) => onChange(p('ri'), e.target.value)}
            invalid={!!errors[p('ri')]} invalidText={errors[p('ri')]}
            disabled={isSubmitting} autoComplete="off" />
        </div>

        {/* Sub-grid B: single-field rows */}
        <div style={gridB}>
          <div style={labelStyle}>CMA PI</div>
          <TextInput id={p('cma')} labelText="" placeholder="e.g., 0.0"
            value={data.cma} onChange={(e) => onChange(p('cma'), e.target.value)}
            invalid={!!errors[p('cma')]} invalidText={errors[p('cma')]}
            disabled={isSubmitting} autoComplete="off" />
          <div style={labelStyle}>PSV</div>
          <TextInput id={p('psv')} labelText="" placeholder="e.g., 0.0"
            value={data.psv} onChange={(e) => onChange(p('psv'), e.target.value)}
            invalid={!!errors[p('psv')]} invalidText={errors[p('psv')]}
            disabled={isSubmitting} autoComplete="off" />
          <div style={labelStyle}>CPR</div>
          <TextInput id={p('cpr')} labelText="" placeholder="e.g., 0.0"
            value={data.cpr} onChange={(e) => onChange(p('cpr'), e.target.value)}
            invalid={!!errors[p('cpr')]} invalidText={errors[p('cpr')]}
            disabled={isSubmitting} autoComplete="off" />
          <div style={labelStyle}>Duc. Ven.</div>
          <TextInput id={p('ducVen')} labelText="" placeholder="e.g., normal"
            value={data.ducVen} onChange={(e) => onChange(p('ducVen'), e.target.value)}
            disabled={isSubmitting} autoComplete="off" />
        </div>
      </Stack>
    </FormGroup>
  );
}

// Made with Bob
