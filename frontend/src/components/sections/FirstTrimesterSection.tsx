/**
 * FirstTrimesterSection — reusable section component for UZPT (first trimester) exam types.
 * Sub-Task 4. Parameterised by `prefix` so it can be rendered twice (T1 / T2) with unique DOM ids.
 *
 * Sub-sections (in paper-form order): FT Ultrasound → FT Biometry → Markers → Anatomy → FT Doppler
 *
 */
import { TextInput, FormGroup, RadioButtonGroup, RadioButton } from '@carbon/react';
import AnatomySection from './AnatomySection';
import type { AnatomySectionFormData } from './AnatomySection';
import { autoCalcLabel } from '../AutoCalcHelpers';

export interface FirstTrimesterSectionFormData {
  // FT Ultrasound sub-section
  ft_placenta: string;
  ft_heartRate: string;
  ft_umbilicalCord: string;
  // FT Biometry sub-section
  ft_crl: string;
  ft_gaFromCrl: string;
  // KI-009: gaFromBio — populated reactively when CRL changes, same value as gaFromCrl
  ft_gaFromBio?: string;
  ft_gaFromCrlIsManual?: boolean;
  ft_nt: string;
  ft_nb: string;
  ft_puls: string;
  // Markers
  ft_arrhythmia: string;
  ft_tricuspidRegurgitation: string;
  ft_abnormalDvFlow: string;
  ft_echogenicCardiacFocus: string;
  ft_singleUmbilicalArtery: string;
  ft_choroidPlexusCysts: string;
  ft_exomphalos: string;
  ft_megacystis: string;
  ft_markerPlacenta: string;
  ft_cordInsertion: string;
  // Anatomy (delegated to AnatomySection — anat_* keys)
  anat_head: string; anat_brain: string; anat_face: string;
  anat_neckSkin: string; anat_spine: string; anat_thorax: string;
  anat_heart: string; anat_abdomen: string; anat_kidneys: string;
  anat_limbs: string; anat_skeleton: string;
  // FT Doppler sub-section
  ft_utADexPI: string;
  ft_utADexRI: string;
  ft_utASinPI: string;
  ft_utASinRI: string;
}

interface FirstTrimesterSectionProps {
  prefix: string; // e.g. "t1" or "t2"
  data: FirstTrimesterSectionFormData;
  errors: Record<string, string>;
  onChange: (field: string, value: string) => void;
  isSubmitting: boolean;
}

const labelStyle: React.CSSProperties = { fontSize: '0.875rem', color: '#525252', alignSelf: 'center', textAlign: 'left' };

export default function FirstTrimesterSection({ prefix, data, errors, onChange, isSubmitting }: FirstTrimesterSectionProps) {
  const p = (field: string) => `${prefix}_${field}`;

  const handleCrlChange = (value: string) => {
    onChange(p('ft_crl'), value);
  };

  const valueFor = (field: string) => (data as unknown as Record<string, string | undefined>)[p(field)] ?? '';

  // Build anatomy data with the prefix applied
  const anatomyData: AnatomySectionFormData = {
    anat_head: valueFor('anat_head'),
    anat_brain: valueFor('anat_brain'),
    anat_heart: valueFor('anat_heart'),
    anat_abdomen: valueFor('anat_abdomen'),
    anat_kidneys: valueFor('anat_kidneys'),
    anat_limbs: valueFor('anat_limbs'),
    anat_skeleton: valueFor('anat_skeleton'),
    anat_face: valueFor('anat_face'),
    anat_neckSkin: valueFor('anat_neckSkin'),
    anat_spine: valueFor('anat_spine'),
    anat_thorax: valueFor('anat_thorax'),
  };

  return (
    <div>
      {/* ── FT Ultrasound ───────────────────────────────────────────────────── */}
      <h5 style={{ marginBottom: '0.25rem', fontWeight: 600 }}>Ultrasound</h5>
      <FormGroup legendText="">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
          <TextInput
            id={p('ft_placenta')}
            labelText="Placenta"
            placeholder=""
            value={valueFor('ft_placenta')}
            onChange={(e) => onChange(p('ft_placenta'), e.target.value)}
            disabled={isSubmitting}
          />
          <TextInput
            id={p('ft_heartRate')}
            labelText="FHR (bpm)"
            placeholder=""
            value={valueFor('ft_heartRate')}
            invalid={!!errors[p('ft_heartRate')]}
            invalidText={errors[p('ft_heartRate')]}
            onChange={(e) => onChange(p('ft_heartRate'), e.target.value)}
            disabled={isSubmitting}
          />
          <TextInput
            id={p('ft_umbilicalCord')}
            labelText="Umbilical Cord"
            placeholder=""
            value={valueFor('ft_umbilicalCord')}
            onChange={(e) => onChange(p('ft_umbilicalCord'), e.target.value)}
            disabled={isSubmitting}
          />
        </div>
      </FormGroup>

      {/* ── FT Biometry ─────────────────────────────────────────────────────── */}
      <h5 style={{ marginTop: '0.75rem', marginBottom: '0.25rem', fontWeight: 600 }}>Biometry</h5>
      <FormGroup legendText="">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 9rem', gap: '0.75rem', alignItems: 'end' }}>
          {/* Row 1: CRL */}
          <TextInput
            id={p('ft_crl')}
            labelText="CRL (mm)"
            placeholder=""
            value={valueFor('ft_crl')}
            invalid={!!errors[p('ft_crl')]}
            invalidText={errors[p('ft_crl')]}
            onChange={(e) => handleCrlChange(e.target.value)}
            disabled={isSubmitting}
          />
          {/* KI-009: GA from Bio — reactive, no button */}
          <TextInput
            id={p('ft_gaFromCrl')}
            labelText={autoCalcLabel('GA from CRL', Boolean((data as unknown as Record<string, unknown>)[p('ft_gaFromCrlIsManual')]))}
            placeholder="auto (10-65mm)"
            value={valueFor('ft_gaFromCrl')}
            invalid={!!errors[p('ft_gaFromCrl')]}
            invalidText={errors[p('ft_gaFromCrl')]}
            onChange={(e) => onChange(p('ft_gaFromCrl'), e.target.value)}
            disabled={isSubmitting}
          />
          <div />
          {/* Row 2: NT */}
          <TextInput
            id={p('ft_nt')}
            labelText="NT (mm)"
            placeholder=""
            value={valueFor('ft_nt')}
            invalid={!!errors[p('ft_nt')]}
            invalidText={errors[p('ft_nt')]}
            onChange={(e) => onChange(p('ft_nt'), e.target.value)}
            disabled={isSubmitting}
          />
          <div /><div />
          {/* Row 3: NB */}
          <TextInput
            id={p('ft_nb')}
            labelText="NB (mm)"
            placeholder=""
            value={valueFor('ft_nb')}
            invalid={!!errors[p('ft_nb')]}
            invalidText={errors[p('ft_nb')]}
            onChange={(e) => onChange(p('ft_nb'), e.target.value)}
            disabled={isSubmitting}
          />
          <div /><div />
          {/* Row 4: Puls */}
          <TextInput
            id={p('ft_puls')}
            labelText="Heart Rate (bpm)"
            placeholder=""
            value={valueFor('ft_puls')}
            invalid={!!errors[p('ft_puls')]}
            invalidText={errors[p('ft_puls')]}
            onChange={(e) => onChange(p('ft_puls'), e.target.value)}
            disabled={isSubmitting}
          />
          <div /><div />
        </div>
      </FormGroup>

      {/* ── Markers ─────────────────────────────────────────────────────────── */}
      <h5 style={{ marginTop: '0.75rem', marginBottom: '0.25rem', fontWeight: 600 }}>Markers</h5>
      <FormGroup legendText="">
        <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '0.5rem 1rem', alignItems: 'center', justifyContent: 'start' }}>
          {([
            ['ft_arrhythmia',             'Arrhythmia'],
            ['ft_tricuspidRegurgitation', 'Tricuspid Regurgitation'],
            ['ft_abnormalDvFlow',         'Abnormal D.Venosus Flow'],
            ['ft_echogenicCardiacFocus',  'Echogenic Cardiac Focus'],
            ['ft_singleUmbilicalArtery',  'Single Umbilical Artery'],
            ['ft_choroidPlexusCysts',     'Choroid Plexus Cysts'],
            ['ft_exomphalos',             'Exomphalos'],
            ['ft_megacystis',             'Megacystis'],
          ] as [string, string][]).map(([field, label]) => {
            const val = (data as unknown as Record<string, string>)[p(field)];
            return (
              <>
                <div key={`lbl_${field}`} style={labelStyle}>{label}</div>
                <div key={`ctrl_${field}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <RadioButtonGroup
                    name={p(field)}
                    valueSelected={val || ''}
                    onChange={(v: string) => onChange(p(field), v)}
                    disabled={isSubmitting}
                    legendText=""
                    orientation="horizontal"
                  >
                    <RadioButton id={`${p(field)}_yes`} labelText="Yes" value="yes" />
                    <RadioButton id={`${p(field)}_no`}  labelText="No"  value="no"  />
                  </RadioButtonGroup>
                  {val && (
                    <button
                      type="button"
                      onClick={() => onChange(p(field), '')}
                      disabled={isSubmitting}
                      style={{
                        background: '#da1e28',
                        border: 'none',
                        borderRadius: '999px',
                        cursor: 'pointer',
                        padding: '0.1rem 0.6rem',
                        color: '#ffffff',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        lineHeight: 1.4,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </>
            );
          })}
          <div style={labelStyle}>Placenta</div>
          <TextInput id={p('ft_markerPlacenta')} labelText="" placeholder="" value={valueFor('ft_markerPlacenta')} onChange={(e) => onChange(p('ft_markerPlacenta'), e.target.value)} disabled={isSubmitting} />
          <div style={labelStyle}>Cord Insertion</div>
          <TextInput id={p('ft_cordInsertion')} labelText="" placeholder="" value={valueFor('ft_cordInsertion')} onChange={(e) => onChange(p('ft_cordInsertion'), e.target.value)} disabled={isSubmitting} />
        </div>
      </FormGroup>

      {/* ── Anatomy ─────────────────────────────────────────────────────────── */}
      <h5 style={{ marginTop: '0.75rem', marginBottom: '0.25rem', fontWeight: 600 }}>Anatomy</h5>
      <AnatomySection prefix={prefix} data={anatomyData} errors={errors} onChange={onChange} isSubmitting={isSubmitting} columns={6} />

      {/* ── FT Doppler ──────────────────────────────────────────────────────── */}
      <h5 style={{ marginTop: '0.75rem', marginBottom: '0.25rem', fontWeight: 600 }}>Doppler</h5>
      <FormGroup legendText="">
        <div style={{ display: 'grid', gridTemplateColumns: '8rem 1fr 1fr', gap: '0.5rem', alignItems: 'end' }}>
          <div />
          <div style={labelStyle}>PI</div>
          <div style={labelStyle}>RI</div>
          <div style={labelStyle}>A. ut. Dex.</div>
          <TextInput id={p('ft_utADexPI')} labelText="" placeholder="" value={valueFor('ft_utADexPI')} invalid={!!errors[p('ft_utADexPI')]} invalidText={errors[p('ft_utADexPI')]} onChange={(e) => onChange(p('ft_utADexPI'), e.target.value)} disabled={isSubmitting} />
          <TextInput id={p('ft_utADexRI')} labelText="" placeholder="" value={valueFor('ft_utADexRI')} invalid={!!errors[p('ft_utADexRI')]} invalidText={errors[p('ft_utADexRI')]} onChange={(e) => onChange(p('ft_utADexRI'), e.target.value)} disabled={isSubmitting} />
          <div style={labelStyle}>A. ut. Sin.</div>
          <TextInput id={p('ft_utASinPI')} labelText="" placeholder="" value={valueFor('ft_utASinPI')} invalid={!!errors[p('ft_utASinPI')]} invalidText={errors[p('ft_utASinPI')]} onChange={(e) => onChange(p('ft_utASinPI'), e.target.value)} disabled={isSubmitting} />
          <TextInput id={p('ft_utASinRI')} labelText="" placeholder="" value={valueFor('ft_utASinRI')} invalid={!!errors[p('ft_utASinRI')]} invalidText={errors[p('ft_utASinRI')]} onChange={(e) => onChange(p('ft_utASinRI'), e.target.value)} disabled={isSubmitting} />
        </div>
      </FormGroup>
    </div>
  );
}

// Made with Bob
