/**
 * FirstTrimesterSection — reusable section component for UZPT (first trimester) exam types.
 * Sub-Task 4. Parameterised by `prefix` so it can be rendered twice (T1 / T2) with unique DOM ids.
 *
 * Sub-sections (in paper-form order): FT Ultrasound → FT Biometry → Markers → Anatomy → FT Doppler
 *
 * AutoCalc GA uses calcGAFromCRL — Robinson (1975), Br Med J 4(5986):28–31,
 * DOI 10.1136/bmj.4.5986.28. Valid CRL range: 10–65 mm (7+0 to 13+6 weeks).
 * calcGAFromCRL is defined in frontend/src/utils/calculations.ts.
 */
import { TextInput, Button, FormGroup, Select, SelectItem } from '@carbon/react';
import AnatomySection from './AnatomySection';
import type { AnatomySectionFormData } from './AnatomySection';
import { calcGAFromCRL } from '../../utils/calculations';

export interface FirstTrimesterSectionFormData {
  // FT Ultrasound sub-section
  ft_placenta: string;
  ft_heartRate: string;
  ft_umbilicalCord: string;
  // FT Biometry sub-section
  ft_crl: string;
  ft_gaFromCrl: string;
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

const calcButtonWrap: React.CSSProperties = { display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' };
const labelStyle: React.CSSProperties = { fontSize: '0.875rem', color: '#525252', alignSelf: 'center' };

export default function FirstTrimesterSection({ prefix, data, errors, onChange, isSubmitting }: FirstTrimesterSectionProps) {
  const p = (field: string) => `${prefix}_${field}`;

  // Button enable/disable logic — Robinson (1975) valid range: 10–65 mm
  const crlFloat = data[p('ft_crl') as keyof FirstTrimesterSectionFormData]
    ? parseFloat(data[p('ft_crl') as keyof FirstTrimesterSectionFormData])
    : undefined;
  const canCalcGA = !!(crlFloat && crlFloat >= 10 && crlFloat <= 65);

  const handleCalcGA = () => {
    const result = calcGAFromCRL(crlFloat);
    if (result) onChange(p('ft_gaFromCrl'), result);
  };

  // Build anatomy data with the prefix applied
  const anatomyData: AnatomySectionFormData = {
    anat_head:     data[p('anat_head') as keyof FirstTrimesterSectionFormData],
    anat_brain:    data[p('anat_brain') as keyof FirstTrimesterSectionFormData],
    anat_heart:    data[p('anat_heart') as keyof FirstTrimesterSectionFormData],
    anat_abdomen:  data[p('anat_abdomen') as keyof FirstTrimesterSectionFormData],
    anat_kidneys:  data[p('anat_kidneys') as keyof FirstTrimesterSectionFormData],
    anat_limbs:    data[p('anat_limbs') as keyof FirstTrimesterSectionFormData],
    anat_skeleton: data[p('anat_skeleton') as keyof FirstTrimesterSectionFormData],
    anat_face:     data[p('anat_face') as keyof FirstTrimesterSectionFormData],
    anat_neckSkin: data[p('anat_neckSkin') as keyof FirstTrimesterSectionFormData],
    anat_spine:    data[p('anat_spine') as keyof FirstTrimesterSectionFormData],
    anat_thorax:   data[p('anat_thorax') as keyof FirstTrimesterSectionFormData],
  };

  return (
    <div>
      {/* ── FT Ultrasound ───────────────────────────────────────────────────── */}
      <h5 style={{ marginBottom: '0.25rem', fontWeight: 600 }}>УЗД (Ултразвук)</h5>
      <FormGroup legendText="">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
          <TextInput
            id={p('ft_placenta')}
            labelText="Плацента"
            placeholder=""
            value={data[p('ft_placenta') as keyof FirstTrimesterSectionFormData]}
            onChange={(e) => onChange(p('ft_placenta'), e.target.value)}
            disabled={isSubmitting}
          />
          <TextInput
            id={p('ft_heartRate')}
            labelText="СЧП (уд/мин)"
            placeholder=""
            value={data[p('ft_heartRate') as keyof FirstTrimesterSectionFormData]}
            invalid={!!errors[p('ft_heartRate')]}
            invalidText={errors[p('ft_heartRate')]}
            onChange={(e) => onChange(p('ft_heartRate'), e.target.value)}
            disabled={isSubmitting}
          />
          <TextInput
            id={p('ft_umbilicalCord')}
            labelText="Пъпна връв"
            placeholder=""
            value={data[p('ft_umbilicalCord') as keyof FirstTrimesterSectionFormData]}
            onChange={(e) => onChange(p('ft_umbilicalCord'), e.target.value)}
            disabled={isSubmitting}
          />
        </div>
      </FormGroup>

      {/* ── FT Biometry ─────────────────────────────────────────────────────── */}
      <h5 style={{ marginTop: '0.75rem', marginBottom: '0.25rem', fontWeight: 600 }}>Биометрия</h5>
      <FormGroup legendText="">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 9rem', gap: '0.75rem', alignItems: 'end' }}>
          {/* Row 1: CRL */}
          <TextInput
            id={p('ft_crl')}
            labelText="КТР (мм)"
            placeholder=""
            value={data[p('ft_crl') as keyof FirstTrimesterSectionFormData]}
            invalid={!!errors[p('ft_crl')]}
            invalidText={errors[p('ft_crl')]}
            onChange={(e) => onChange(p('ft_crl'), e.target.value)}
            disabled={isSubmitting}
          />
          <TextInput
            id={p('ft_gaFromCrl')}
            labelText="ГВ от КТР"
            placeholder="напр. 12w 3d"
            value={data[p('ft_gaFromCrl') as keyof FirstTrimesterSectionFormData]}
            invalid={!!errors[p('ft_gaFromCrl')]}
            invalidText={errors[p('ft_gaFromCrl')]}
            onChange={(e) => onChange(p('ft_gaFromCrl'), e.target.value)}
            disabled={isSubmitting}
          />
          <div style={calcButtonWrap}>
            <Button
              kind="tertiary"
              size="md"
              onClick={handleCalcGA}
              disabled={!canCalcGA || isSubmitting}
              title={canCalcGA
                ? 'Calculate GA from CRL (Robinson 1975, valid range 10–65 mm)'
                : 'Enter CRL in the valid range 10–65 mm to enable calculation'}
            >
              AutoCalc GA from CRL
            </Button>
          </div>
          {/* Row 2: NT */}
          <TextInput
            id={p('ft_nt')}
            labelText="НТ (мм)"
            placeholder=""
            value={data[p('ft_nt') as keyof FirstTrimesterSectionFormData]}
            invalid={!!errors[p('ft_nt')]}
            invalidText={errors[p('ft_nt')]}
            onChange={(e) => onChange(p('ft_nt'), e.target.value)}
            disabled={isSubmitting}
          />
          <div /><div />
          {/* Row 3: NB */}
          <TextInput
            id={p('ft_nb')}
            labelText="НК (мм)"
            placeholder=""
            value={data[p('ft_nb') as keyof FirstTrimesterSectionFormData]}
            invalid={!!errors[p('ft_nb')]}
            invalidText={errors[p('ft_nb')]}
            onChange={(e) => onChange(p('ft_nb'), e.target.value)}
            disabled={isSubmitting}
          />
          <div /><div />
          {/* Row 4: Puls */}
          <TextInput
            id={p('ft_puls')}
            labelText="Пулс (уд/мин)"
            placeholder=""
            value={data[p('ft_puls') as keyof FirstTrimesterSectionFormData]}
            invalid={!!errors[p('ft_puls')]}
            invalidText={errors[p('ft_puls')]}
            onChange={(e) => onChange(p('ft_puls'), e.target.value)}
            disabled={isSubmitting}
          />
          <div /><div />
        </div>
      </FormGroup>

      {/* ── Markers ─────────────────────────────────────────────────────────── */}
      <h5 style={{ marginTop: '0.75rem', marginBottom: '0.25rem', fontWeight: 600 }}>Маркери</h5>
      <FormGroup legendText="">
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.5rem 1rem', alignItems: 'center' }}>
          {([
            ['ft_arrhythmia',             'Аритмия'],
            ['ft_tricuspidRegurgitation', 'Трикуспидална регуритация'],
            ['ft_abnormalDvFlow',         'Абнормен кръвоток D.Venosus'],
            ['ft_echogenicCardiacFocus',  'Ехогенен сърдечен фикус'],
            ['ft_singleUmbilicalArtery',  'Една пъпна артерия'],
            ['ft_choroidPlexusCysts',     'Кисти на PL Chorioideus'],
            ['ft_exomphalos',             'Exomphalos'],
            ['ft_megacystis',             'Мегацистис'],
          ] as [string, string][]).map(([field, label]) => (
            <>
              <div key={`lbl_${field}`} style={labelStyle}>{label}</div>
              <Select
                key={`sel_${field}`}
                id={p(field)}
                labelText=""
                value={data[p(field) as keyof FirstTrimesterSectionFormData]}
                onChange={(e) => onChange(p(field), e.target.value)}
                disabled={isSubmitting}
              >
                <SelectItem value="" text="—" />
                <SelectItem value="yes" text="Да" />
                <SelectItem value="no" text="Не" />
              </Select>
            </>
          ))}
          <div style={labelStyle}>Плацента</div>
          <TextInput id={p('ft_markerPlacenta')} labelText="" placeholder="" value={data[p('ft_markerPlacenta') as keyof FirstTrimesterSectionFormData]} onChange={(e) => onChange(p('ft_markerPlacenta'), e.target.value)} disabled={isSubmitting} />
          <div style={labelStyle}>Пъпна връв инсерция</div>
          <TextInput id={p('ft_cordInsertion')} labelText="" placeholder="" value={data[p('ft_cordInsertion') as keyof FirstTrimesterSectionFormData]} onChange={(e) => onChange(p('ft_cordInsertion'), e.target.value)} disabled={isSubmitting} />
        </div>
      </FormGroup>

      {/* ── Anatomy ─────────────────────────────────────────────────────────── */}
      <h5 style={{ marginTop: '0.75rem', marginBottom: '0.25rem', fontWeight: 600 }}>Анатомия</h5>
      <AnatomySection prefix={prefix} data={anatomyData} errors={errors} onChange={onChange} isSubmitting={isSubmitting} columns={6} />

      {/* ── FT Doppler ──────────────────────────────────────────────────────── */}
      <h5 style={{ marginTop: '0.75rem', marginBottom: '0.25rem', fontWeight: 600 }}>Доплер</h5>
      <FormGroup legendText="">
        <div style={{ display: 'grid', gridTemplateColumns: '8rem 1fr 1fr', gap: '0.5rem', alignItems: 'end' }}>
          <div />
          <div style={labelStyle}>PI</div>
          <div style={labelStyle}>RI</div>
          <div style={labelStyle}>A. ut. Dex.</div>
          <TextInput id={p('ft_utADexPI')} labelText="" placeholder="" value={data[p('ft_utADexPI') as keyof FirstTrimesterSectionFormData]} invalid={!!errors[p('ft_utADexPI')]} invalidText={errors[p('ft_utADexPI')]} onChange={(e) => onChange(p('ft_utADexPI'), e.target.value)} disabled={isSubmitting} />
          <TextInput id={p('ft_utADexRI')} labelText="" placeholder="" value={data[p('ft_utADexRI') as keyof FirstTrimesterSectionFormData]} invalid={!!errors[p('ft_utADexRI')]} invalidText={errors[p('ft_utADexRI')]} onChange={(e) => onChange(p('ft_utADexRI'), e.target.value)} disabled={isSubmitting} />
          <div style={labelStyle}>A. ut. Sin.</div>
          <TextInput id={p('ft_utASinPI')} labelText="" placeholder="" value={data[p('ft_utASinPI') as keyof FirstTrimesterSectionFormData]} invalid={!!errors[p('ft_utASinPI')]} invalidText={errors[p('ft_utASinPI')]} onChange={(e) => onChange(p('ft_utASinPI'), e.target.value)} disabled={isSubmitting} />
          <TextInput id={p('ft_utASinRI')} labelText="" placeholder="" value={data[p('ft_utASinRI') as keyof FirstTrimesterSectionFormData]} invalid={!!errors[p('ft_utASinRI')]} invalidText={errors[p('ft_utASinRI')]} onChange={(e) => onChange(p('ft_utASinRI'), e.target.value)} disabled={isSubmitting} />
        </div>
      </FormGroup>
    </div>
  );
}

// Made with Bob
