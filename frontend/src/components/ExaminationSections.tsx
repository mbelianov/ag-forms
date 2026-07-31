/**
 * ExaminationSections — extracted from ExaminationDetailPage.tsx (Sub-Task 0b).
 * Renders the clinical-data sections for an examination: Ultrasound Findings,
 * Biometry, Anatomy, and Doppler — for both single-fetus and twins layouts.
 */
import { Tile } from '@carbon/react';
import { fmtBiometry } from '../utils/calculations';
import { getSectionVisibility, isFirstTrimester, isFtTwins } from '../constants/examinationTypes';
import type { Examination } from '../types';
import type { BiometryPercentiles } from '../utils/calculations';

interface ExaminationSectionsProps {
  examination: Examination;
  biometryPercentiles: BiometryPercentiles | undefined;
  efwPercentile: number | undefined;
  biometryPercentiles2: BiometryPercentiles | undefined;
  efwPercentile2: number | undefined;
}

const fieldBlock = (label: string, value: React.ReactNode) => (
  <div>
    <div style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.25rem' }}>{label}</div>
    <div style={{ fontSize: '0.875rem', color: '#525252' }}>{value}</div>
  </div>
);

export default function ExaminationSections({
  examination,
  biometryPercentiles,
  efwPercentile,
  biometryPercentiles2,
  efwPercentile2,
}: ExaminationSectionsProps) {
  const visibility = getSectionVisibility(examination.examinationType);
  const isTwins = examination.examinationType === 'ultrasound_prenatal_twins';
  const isFt = isFirstTrimester(examination.examinationType);
  const isFtTwinsExam = isFtTwins(examination.examinationType);

  // Shared cell styles for the biometry 4-column table
  const labelStyle: React.CSSProperties = { fontSize: '0.875rem', color: '#525252', textAlign: 'left' };
  const valueStyle: React.CSSProperties = { fontSize: '0.875rem', color: '#525252', textAlign: 'left' };
  const pctStyle: React.CSSProperties = { fontSize: '0.875rem', color: '#525252', textAlign: 'left' };

  // Helper: render a single FT block (used for both T1 and T2 in twins layout)
  const renderFtBlock = (prefix: 'ft' | 'twin2_ft', label: string, color: string) => {
    const d = examination.data;
    const ftB = prefix === 'ft' ? d?.ft_biometry : d?.twin2_ft_biometry;
    const ftM = prefix === 'ft' ? d?.ft_markers : d?.twin2_ft_markers;
    const ftU = prefix === 'ft' ? d?.ft_ultrasound : d?.twin2_ft_ultrasound;
    const ftA = prefix === 'ft' ? d?.ft_anatomy : d?.twin2_ft_anatomy;
    const ftD = prefix === 'ft' ? d?.ft_doppler : d?.twin2_ft_doppler;
    const yesNo = (v: string | undefined) => v === 'yes' ? 'Да' : v === 'no' ? 'Не' : '—';
    return (
      <div key={prefix}>
        {isFtTwinsExam && <h3 style={{ marginBottom: '1rem', borderBottom: `2px solid ${color}`, paddingBottom: '0.5rem' }}>{label}</h3>}
        <h4 style={{ marginBottom: '0.75rem', marginTop: '1rem' }}>УЗД</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
          {fieldBlock('Плацента', ftU?.placenta || '—')}
          {fieldBlock('СЧП', ftU?.heartRate !== undefined ? `${ftU.heartRate} уд/мин` : '—')}
          {fieldBlock('Пъпна връв', ftU?.umbilicalCord || '—')}
        </div>
        <h4 style={{ marginBottom: '0.75rem', marginTop: '1rem' }}>Биометрия</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
          {fieldBlock('КТР (мм)', ftB?.crl !== undefined ? `${ftB.crl} мм` : '—')}
          {fieldBlock('ГВ от КТР', ftB?.gaFromCrl || '—')}
          {fieldBlock('НТ (мм)', ftB?.nt !== undefined ? `${ftB.nt} мм` : '—')}
          {fieldBlock('НК (мм)', ftB?.nb !== undefined ? `${ftB.nb} мм` : '—')}
          {fieldBlock('Пулс', ftB?.puls !== undefined ? `${ftB.puls} уд/мин` : '—')}
        </div>
        <h4 style={{ marginBottom: '0.75rem', marginTop: '1rem' }}>Маркери</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem 0.75rem' }}>
          {fieldBlock('Аритмия', yesNo(ftM?.arrhythmia))}
          {fieldBlock('Трикуспидална регуритация', yesNo(ftM?.tricuspidRegurgitation))}
          {fieldBlock('Абнормен кръвоток D.Venosus', yesNo(ftM?.abnormalDvFlow))}
          {fieldBlock('Ехогенен сърдечен фикус', yesNo(ftM?.echogenicCardiacFocus))}
          {fieldBlock('Една пъпна артерия', yesNo(ftM?.singleUmbilicalArtery))}
          {fieldBlock('Кисти на PL Chorioideus', yesNo(ftM?.choroidPlexusCysts))}
          {fieldBlock('Exomphalos', yesNo(ftM?.exomphalos))}
          {fieldBlock('Мегацистис', yesNo(ftM?.megacystis))}
          {fieldBlock('Плацента', ftM?.placenta || '—')}
          {fieldBlock('Пъпна връв инсерция', ftM?.cordInsertion || '—')}
        </div>
        <h4 style={{ marginBottom: '0.75rem', marginTop: '1rem' }}>Анатомия</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem' }}>
          {fieldBlock('Head', ftA?.head || '—')}
          {fieldBlock('Brain', ftA?.brain || '—')}
          {fieldBlock('Heart', ftA?.heart || '—')}
          {fieldBlock('Abdomen', ftA?.abdomen || '—')}
          {fieldBlock('Kidneys', ftA?.kidneys || '—')}
          {fieldBlock('Limbs', ftA?.limbs || '—')}
          {fieldBlock('Skeleton', ftA?.skeleton || '—')}
          {fieldBlock('Face', ftA?.face || '—')}
          {fieldBlock('Neck / Skin', ftA?.neckSkin || '—')}
          {fieldBlock('Spine', ftA?.spine || '—')}
          {fieldBlock('Thorax', ftA?.thorax || '—')}
        </div>
        <h4 style={{ marginBottom: '0.75rem', marginTop: '1rem' }}>Доплер</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
          {fieldBlock('A. ut. Dex. PI', ftD?.utADexPI !== undefined ? String(ftD.utADexPI) : '—')}
          {fieldBlock('A. ut. Dex. RI', ftD?.utADexRI !== undefined ? String(ftD.utADexRI) : '—')}
          {fieldBlock('A. ut. Sin. PI', ftD?.utASinPI !== undefined ? String(ftD.utASinPI) : '—')}
          {fieldBlock('A. ut. Sin. RI', ftD?.utASinRI !== undefined ? String(ftD.utASinRI) : '—')}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* UZPT — First Trimester layout */}
      {isFt && !isFtTwinsExam && (
        <Tile>
          <h3 style={{ marginBottom: '1.5rem' }}>Ултразвук Първи Триместър</h3>
          {renderFtBlock('ft', 'Twin 1', '#0f62fe')}
        </Tile>
      )}
      {isFtTwinsExam && (
        <Tile>
          <h3 style={{ marginBottom: '1.5rem' }}>Ултразвук Първи Триместър (Близнаци)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2rem' }}>
            {renderFtBlock('ft', 'Twin 1', '#0f62fe')}
            {renderFtBlock('twin2_ft', 'Twin 2', '#6929c4')}
          </div>
        </Tile>
      )}

      {/* Ultrasound Findings, Biometry, Anatomy, Doppler — single-fetus path (HF-1 order) */}
      {!isTwins && !isFt && (
        <>
          {visibility.ultrasoundFindings && (
            <Tile>
              <h3 style={{ marginBottom: '1.5rem' }}>Ultrasound Findings</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                {fieldBlock('Presentation', examination.data?.ultrasound_findings?.presentation ? <span style={{ textTransform: 'capitalize' }}>{examination.data.ultrasound_findings.presentation}</span> : '—')}
                {fieldBlock('Gender', examination.data?.ultrasound_findings?.gender ? <span style={{ textTransform: 'capitalize' }}>{examination.data.ultrasound_findings.gender}</span> : '—')}
                {fieldBlock('Fetal Heart Rate', examination.data?.ultrasound_findings?.heart_rate !== undefined ? `${examination.data.ultrasound_findings.heart_rate} bpm` : '—')}
                {fieldBlock('Fetal Movement', examination.data?.ultrasound_findings?.fetal_movement ? <span style={{ textTransform: 'capitalize' }}>{examination.data.ultrasound_findings.fetal_movement}</span> : '—')}
                {fieldBlock('Placenta', examination.data?.ultrasound_findings?.placenta || '—')}
                {fieldBlock('Umbilical Cord', examination.data?.ultrasound_findings?.umbilical_cord || '—')}
              </div>
            </Tile>
          )}

          {visibility.biometry && (
          <Tile>
            <h3 style={{ marginBottom: '1rem' }}>Biometry Measurements</h3>
            {/* 4 columns: label | value | percentile | GA from Bio (BPD row only) */}
            <div style={{ display: 'grid', gridTemplateColumns: '6rem 1fr 4rem 6rem', gap: '0.4rem 1.25rem', alignItems: 'end', width: '50%' }}>
              <div style={labelStyle}>BPD</div>
              <div style={valueStyle}>{examination.biometry?.bpd !== undefined ? `${fmtBiometry(examination.biometry.bpd)} mm` : '—'}</div>
              <div style={pctStyle}>{biometryPercentiles?.bpd !== undefined ? `${biometryPercentiles.bpd}th` : ''}</div>
              <div><div style={labelStyle}>GA from Bio</div><div style={valueStyle}>{examination.gestationalAgeFromBiometry || '—'}</div></div>
              <div style={labelStyle}>OFD</div>
              <div style={valueStyle}>{examination.biometry?.ofd !== undefined ? `${fmtBiometry(examination.biometry.ofd)} mm` : '—'}</div>
              <div /><div />
              <div style={labelStyle}>HC</div>
              <div style={valueStyle}>{examination.biometry?.hc !== undefined ? `${fmtBiometry(examination.biometry.hc)} mm` : '—'}</div>
              <div style={pctStyle}>{biometryPercentiles?.hc !== undefined ? `${biometryPercentiles.hc}th` : ''}</div>
              <div />
              <div style={labelStyle}>TAD</div>
              <div style={valueStyle}>{examination.biometry?.tad !== undefined ? `${fmtBiometry(examination.biometry.tad)} mm` : '—'}</div>
              <div /><div />
              <div style={labelStyle}>APAD</div>
              <div style={valueStyle}>{examination.biometry?.apad !== undefined ? `${fmtBiometry(examination.biometry.apad)} mm` : '—'}</div>
              <div /><div />
              <div style={labelStyle}>AC</div>
              <div style={valueStyle}>{examination.biometry?.ac !== undefined ? `${fmtBiometry(examination.biometry.ac)} mm` : '—'}</div>
              <div style={pctStyle}>{biometryPercentiles?.ac !== undefined ? `${biometryPercentiles.ac}th` : ''}</div>
              <div />
              <div style={labelStyle}>FL</div>
              <div style={valueStyle}>{examination.biometry?.fl !== undefined ? `${fmtBiometry(examination.biometry.fl)} mm` : '—'}</div>
              <div style={pctStyle}>{biometryPercentiles?.fl !== undefined ? `${biometryPercentiles.fl}th` : ''}</div>
              <div />
              <div style={labelStyle}>TCD</div>
              <div style={valueStyle}>{examination.biometry?.tcd !== undefined ? `${fmtBiometry(examination.biometry.tcd)} mm` : '—'}</div>
              <div /><div />
              <div style={labelStyle}>Vp</div>
              <div style={valueStyle}>{examination.biometry?.vp !== undefined ? `${fmtBiometry(examination.biometry.vp)} mm` : '—'}</div>
              <div /><div />
              <div style={labelStyle}>CM</div>
              <div style={valueStyle}>{examination.biometry?.cm !== undefined ? `${fmtBiometry(examination.biometry.cm)} mm` : '—'}</div>
              <div /><div />
              <div style={labelStyle}>NF</div>
              <div style={valueStyle}>{examination.biometry?.nuchalFold !== undefined ? `${fmtBiometry(examination.biometry.nuchalFold)} mm` : '—'}</div>
              <div /><div />
              <div style={labelStyle}>NB</div>
              <div style={valueStyle}>{examination.biometry?.nb !== undefined ? `${fmtBiometry(examination.biometry.nb)} mm` : '—'}</div>
              <div /><div />
              <div style={labelStyle}>EFW</div>
              <div style={valueStyle}>{examination.biometry?.efw !== undefined ? `${fmtBiometry(examination.biometry.efw)} g` : '—'}</div>
              <div style={pctStyle}>{efwPercentile !== undefined ? `${efwPercentile}th` : ''}</div>
              <div />
              <div style={labelStyle}>LA</div>
              <div style={valueStyle}>{examination.biometry?.la !== undefined ? `${fmtBiometry(examination.biometry.la)} mm` : '—'}</div>
              <div /><div />
              <div style={labelStyle}>LC</div>
              <div style={valueStyle}>{examination.biometry?.lc !== undefined ? `${fmtBiometry(examination.biometry.lc)} mm` : '—'}</div>
              <div /><div />
            </div>
          </Tile>
          )}

          {visibility.anatomy && (
            <Tile>
              <h3 style={{ marginBottom: '1.5rem' }}>Anatomy</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1.5rem' }}>
                {fieldBlock('Head', examination.data?.anatomy?.head || '—')}
                {fieldBlock('Brain', examination.data?.anatomy?.brain || '—')}
                {fieldBlock('Heart', examination.data?.anatomy?.heart || '—')}
                {fieldBlock('Abdomen', examination.data?.anatomy?.abdomen || '—')}
                {fieldBlock('Kidneys', examination.data?.anatomy?.kidneys || '—')}
                {fieldBlock('Limbs', examination.data?.anatomy?.limbs || '—')}
                {fieldBlock('Skeleton', examination.data?.anatomy?.skeleton || '—')}
                {fieldBlock('Face', examination.data?.anatomy?.face || '—')}
                {fieldBlock('Neck / Skin', examination.data?.anatomy?.neckSkin || '—')}
                {fieldBlock('Spine', examination.data?.anatomy?.spine || '—')}
                {fieldBlock('Thorax', examination.data?.anatomy?.thorax || '—')}
              </div>
            </Tile>
          )}

          {visibility.doppler && (
          <Tile>
            <h3 style={{ marginBottom: '1.5rem' }}>Doppler Measurements</h3>
            {/* Sub-grid A: vessel label | PI | RI  (matches DopplerSection.tsx) */}
            <div style={{ display: 'grid', gridTemplateColumns: '8rem 1fr 1fr', gap: '0.5rem', alignItems: 'end', marginBottom: '0.5rem' }}>
              <div />
              <div style={{ fontSize: '0.875rem', color: '#525252', paddingBottom: '0.5rem' }}>PI</div>
              <div style={{ fontSize: '0.875rem', color: '#525252', paddingBottom: '0.5rem' }}>RI</div>
              <div style={{ fontSize: '0.875rem', color: '#525252', textAlign: 'left' as const }}>A. ut. Dex.</div>
              <div style={{ fontSize: '0.875rem', color: '#525252' }}>{examination.doppler?.utADexPI !== undefined ? examination.doppler.utADexPI : '—'}</div>
              <div style={{ fontSize: '0.875rem', color: '#525252' }}>{examination.doppler?.utADexRI !== undefined ? examination.doppler.utADexRI : '—'}</div>
              <div style={{ fontSize: '0.875rem', color: '#525252', textAlign: 'left' as const }}>A. ut. Sin.</div>
              <div style={{ fontSize: '0.875rem', color: '#525252' }}>{examination.doppler?.utASinPI !== undefined ? examination.doppler.utASinPI : '—'}</div>
              <div style={{ fontSize: '0.875rem', color: '#525252' }}>{examination.doppler?.utASinRI !== undefined ? examination.doppler.utASinRI : '—'}</div>
              <div style={{ fontSize: '0.875rem', color: '#525252', textAlign: 'left' as const }}>A. Umb.</div>
              <div style={{ fontSize: '0.875rem', color: '#525252' }}>{examination.doppler?.pi !== undefined ? examination.doppler.pi : '—'}</div>
              <div style={{ fontSize: '0.875rem', color: '#525252' }}>{examination.doppler?.ri !== undefined ? examination.doppler.ri : '—'}</div>
            </div>
            {/* Sub-grid B: label | single value */}
            <div style={{ display: 'grid', gridTemplateColumns: '8rem 1fr', gap: '0.5rem', alignItems: 'end' }}>
              <div style={{ fontSize: '0.875rem', color: '#525252', textAlign: 'left' as const }}>CMA PI</div>
              <div style={{ fontSize: '0.875rem', color: '#525252' }}>{examination.doppler?.cma !== undefined ? examination.doppler.cma : '—'}</div>
              <div style={{ fontSize: '0.875rem', color: '#525252', textAlign: 'left' as const }}>PSV</div>
              <div style={{ fontSize: '0.875rem', color: '#525252' }}>{examination.doppler?.psv !== undefined ? examination.doppler.psv : '—'}</div>
              <div style={{ fontSize: '0.875rem', color: '#525252', textAlign: 'left' as const }}>CPR</div>
              <div style={{ fontSize: '0.875rem', color: '#525252' }}>{examination.doppler?.cpr !== undefined ? examination.doppler.cpr : '—'}</div>
              <div style={{ fontSize: '0.875rem', color: '#525252', textAlign: 'left' as const }}>Duc. Ven.</div>
              <div style={{ fontSize: '0.875rem', color: '#525252' }}>{examination.doppler?.ducVen || '—'}</div>
            </div>
          </Tile>
          )}
        </>
      )}

      {/* uzd-twins: Two-column layout for twins exam (HF-1 order: UF → Bio → Anatomy → Doppler) */}
      {isTwins && !isFt && (
        <Tile>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2rem' }}>
            {/* Twin 1 column */}
            <div>
              <h3 style={{ marginBottom: '1rem', borderBottom: '2px solid #0f62fe', paddingBottom: '0.5rem' }}>Twin 1</h3>
              {visibility.ultrasoundFindings && (
                <>
                  <h4 style={{ marginBottom: '0.75rem', marginTop: '1rem' }}>Ultrasound Findings</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
                    {fieldBlock('Presentation', examination.data?.ultrasound_findings?.presentation || '—')}
                    {fieldBlock('Gender', examination.data?.ultrasound_findings?.gender || '—')}
                    {fieldBlock('Heart Rate', examination.data?.ultrasound_findings?.heart_rate !== undefined ? `${examination.data.ultrasound_findings.heart_rate} bpm` : '—')}
                    {fieldBlock('Fetal Movement', examination.data?.ultrasound_findings?.fetal_movement || '—')}
                    {fieldBlock('Placenta', examination.data?.ultrasound_findings?.placenta || '—')}
                    {fieldBlock('Umbilical Cord', examination.data?.ultrasound_findings?.umbilical_cord || '—')}
                  </div>
                </>
              )}
              {visibility.biometry && (
                <>
                  <h4 style={{ marginBottom: '0.5rem', marginTop: '1rem' }}>Biometry</h4>
                  {/* 4 columns: label | value | percentile | GA from Bio (BPD row only) */}
                  <div style={{ display: 'grid', gridTemplateColumns: '6rem 1fr 4rem 6rem', gap: '0.4rem 1.25rem', alignItems: 'end', width: '100%' }}>
                    <div style={labelStyle}>BPD</div>
                    <div style={valueStyle}>{examination.biometry?.bpd !== undefined ? `${fmtBiometry(examination.biometry.bpd)} mm` : '—'}</div>
                    <div style={pctStyle}>{biometryPercentiles?.bpd !== undefined ? `${biometryPercentiles.bpd}th` : ''}</div>
                    <div><div style={labelStyle}>GA from Bio</div><div style={valueStyle}>{examination.gestationalAgeFromBiometry || '—'}</div></div>
                    <div style={labelStyle}>OFD</div>
                    <div style={valueStyle}>{examination.biometry?.ofd !== undefined ? `${fmtBiometry(examination.biometry.ofd)} mm` : '—'}</div>
                    <div /><div />
                    <div style={labelStyle}>HC</div>
                    <div style={valueStyle}>{examination.biometry?.hc !== undefined ? `${fmtBiometry(examination.biometry.hc)} mm` : '—'}</div>
                    <div style={pctStyle}>{biometryPercentiles?.hc !== undefined ? `${biometryPercentiles.hc}th` : ''}</div>
                    <div />
                    <div style={labelStyle}>TAD</div>
                    <div style={valueStyle}>{examination.biometry?.tad !== undefined ? `${fmtBiometry(examination.biometry.tad)} mm` : '—'}</div>
                    <div /><div />
                    <div style={labelStyle}>APAD</div>
                    <div style={valueStyle}>{examination.biometry?.apad !== undefined ? `${fmtBiometry(examination.biometry.apad)} mm` : '—'}</div>
                    <div /><div />
                    <div style={labelStyle}>AC</div>
                    <div style={valueStyle}>{examination.biometry?.ac !== undefined ? `${fmtBiometry(examination.biometry.ac)} mm` : '—'}</div>
                    <div style={pctStyle}>{biometryPercentiles?.ac !== undefined ? `${biometryPercentiles.ac}th` : ''}</div>
                    <div />
                    <div style={labelStyle}>FL</div>
                    <div style={valueStyle}>{examination.biometry?.fl !== undefined ? `${fmtBiometry(examination.biometry.fl)} mm` : '—'}</div>
                    <div style={pctStyle}>{biometryPercentiles?.fl !== undefined ? `${biometryPercentiles.fl}th` : ''}</div>
                    <div />
                    <div style={labelStyle}>TCD</div>
                    <div style={valueStyle}>{examination.biometry?.tcd !== undefined ? `${fmtBiometry(examination.biometry.tcd)} mm` : '—'}</div>
                    <div /><div />
                    <div style={labelStyle}>Vp</div>
                    <div style={valueStyle}>{examination.biometry?.vp !== undefined ? `${fmtBiometry(examination.biometry.vp)} mm` : '—'}</div>
                    <div /><div />
                    <div style={labelStyle}>CM</div>
                    <div style={valueStyle}>{examination.biometry?.cm !== undefined ? `${fmtBiometry(examination.biometry.cm)} mm` : '—'}</div>
                    <div /><div />
                    <div style={labelStyle}>NF</div>
                    <div style={valueStyle}>{examination.biometry?.nuchalFold !== undefined ? `${fmtBiometry(examination.biometry.nuchalFold)} mm` : '—'}</div>
                    <div /><div />
                    <div style={labelStyle}>NB</div>
                    <div style={valueStyle}>{examination.biometry?.nb !== undefined ? `${fmtBiometry(examination.biometry.nb)} mm` : '—'}</div>
                    <div /><div />
                    <div style={labelStyle}>EFW</div>
                    <div style={valueStyle}>{examination.biometry?.efw !== undefined ? `${fmtBiometry(examination.biometry.efw)} g` : '—'}</div>
                    <div style={pctStyle}>{efwPercentile !== undefined ? `${efwPercentile}th` : ''}</div>
                    <div />
                    <div style={labelStyle}>LA</div>
                    <div style={valueStyle}>{examination.biometry?.la !== undefined ? `${fmtBiometry(examination.biometry.la)} mm` : '—'}</div>
                    <div /><div />
                    <div style={labelStyle}>LC</div>
                    <div style={valueStyle}>{examination.biometry?.lc !== undefined ? `${fmtBiometry(examination.biometry.lc)} mm` : '—'}</div>
                    <div /><div />
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#525252', marginTop: '0.25rem', fontStyle: 'italic' }}>Percentiles based on singleton Hadlock reference values</div>
                </>
              )}
              {visibility.anatomy && (
                <>
                  <h4 style={{ marginBottom: '0.75rem', marginTop: '1rem' }}>Anatomy</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem' }}>
                    {fieldBlock('Head', examination.data?.anatomy?.head || '—')}
                    {fieldBlock('Brain', examination.data?.anatomy?.brain || '—')}
                    {fieldBlock('Heart', examination.data?.anatomy?.heart || '—')}
                    {fieldBlock('Abdomen', examination.data?.anatomy?.abdomen || '—')}
                    {fieldBlock('Kidneys', examination.data?.anatomy?.kidneys || '—')}
                    {fieldBlock('Limbs', examination.data?.anatomy?.limbs || '—')}
                    {fieldBlock('Skeleton', examination.data?.anatomy?.skeleton || '—')}
                    {fieldBlock('Face', examination.data?.anatomy?.face || '—')}
                    {fieldBlock('Neck / Skin', examination.data?.anatomy?.neckSkin || '—')}
                    {fieldBlock('Spine', examination.data?.anatomy?.spine || '—')}
                    {fieldBlock('Thorax', examination.data?.anatomy?.thorax || '—')}
                  </div>
                </>
              )}
              {visibility.doppler && (
                <>
                  <h4 style={{ marginBottom: '0.75rem', marginTop: '1rem' }}>Doppler</h4>
                  {/* Sub-grid A */}
                  <div style={{ display: 'grid', gridTemplateColumns: '8rem 1fr 1fr', gap: '0.5rem', alignItems: 'end', marginBottom: '0.5rem' }}>
                    <div />
                    <div style={{ fontSize: '0.875rem', color: '#525252', paddingBottom: '0.5rem' }}>PI</div>
                    <div style={{ fontSize: '0.875rem', color: '#525252', paddingBottom: '0.5rem' }}>RI</div>
                    <div style={{ fontSize: '0.875rem', color: '#525252', textAlign: 'left' as const }}>A. ut. Dex.</div>
                    <div style={{ fontSize: '0.875rem', color: '#525252' }}>{examination.doppler?.utADexPI !== undefined ? String(examination.doppler.utADexPI) : '—'}</div>
                    <div style={{ fontSize: '0.875rem', color: '#525252' }}>{examination.doppler?.utADexRI !== undefined ? String(examination.doppler.utADexRI) : '—'}</div>
                    <div style={{ fontSize: '0.875rem', color: '#525252', textAlign: 'left' as const }}>A. ut. Sin.</div>
                    <div style={{ fontSize: '0.875rem', color: '#525252' }}>{examination.doppler?.utASinPI !== undefined ? String(examination.doppler.utASinPI) : '—'}</div>
                    <div style={{ fontSize: '0.875rem', color: '#525252' }}>{examination.doppler?.utASinRI !== undefined ? String(examination.doppler.utASinRI) : '—'}</div>
                    <div style={{ fontSize: '0.875rem', color: '#525252', textAlign: 'left' as const }}>A. Umb.</div>
                    <div style={{ fontSize: '0.875rem', color: '#525252' }}>{examination.doppler?.pi !== undefined ? String(examination.doppler.pi) : '—'}</div>
                    <div style={{ fontSize: '0.875rem', color: '#525252' }}>{examination.doppler?.ri !== undefined ? String(examination.doppler.ri) : '—'}</div>
                  </div>
                  {/* Sub-grid B */}
                  <div style={{ display: 'grid', gridTemplateColumns: '8rem 1fr', gap: '0.5rem', alignItems: 'end' }}>
                    <div style={{ fontSize: '0.875rem', color: '#525252', textAlign: 'left' as const }}>CMA PI</div>
                    <div style={{ fontSize: '0.875rem', color: '#525252' }}>{examination.doppler?.cma !== undefined ? String(examination.doppler.cma) : '—'}</div>
                    <div style={{ fontSize: '0.875rem', color: '#525252', textAlign: 'left' as const }}>PSV</div>
                    <div style={{ fontSize: '0.875rem', color: '#525252' }}>{examination.doppler?.psv !== undefined ? String(examination.doppler.psv) : '—'}</div>
                    <div style={{ fontSize: '0.875rem', color: '#525252', textAlign: 'left' as const }}>CPR</div>
                    <div style={{ fontSize: '0.875rem', color: '#525252' }}>{examination.doppler?.cpr !== undefined ? String(examination.doppler.cpr) : '—'}</div>
                    <div style={{ fontSize: '0.875rem', color: '#525252', textAlign: 'left' as const }}>Duc. Ven.</div>
                    <div style={{ fontSize: '0.875rem', color: '#525252' }}>{examination.doppler?.ducVen || '—'}</div>
                  </div>
                </>
              )}
            </div>

            {/* Twin 2 column */}
            <div>
              <h3 style={{ marginBottom: '1rem', borderBottom: '2px solid #6929c4', paddingBottom: '0.5rem' }}>Twin 2</h3>
              {visibility.ultrasoundFindings && (
                <>
                  <h4 style={{ marginBottom: '0.75rem', marginTop: '1rem' }}>Ultrasound Findings</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
                    {fieldBlock('Presentation', examination.data?.twin2_ultrasound_findings?.presentation || '—')}
                    {fieldBlock('Gender', examination.data?.twin2_ultrasound_findings?.gender || '—')}
                    {fieldBlock('Heart Rate', examination.data?.twin2_ultrasound_findings?.heart_rate !== undefined ? `${examination.data.twin2_ultrasound_findings.heart_rate} bpm` : '—')}
                    {fieldBlock('Fetal Movement', examination.data?.twin2_ultrasound_findings?.fetal_movement || '—')}
                    {fieldBlock('Placenta', examination.data?.twin2_ultrasound_findings?.placenta || '—')}
                    {fieldBlock('Umbilical Cord', examination.data?.twin2_ultrasound_findings?.umbilical_cord || '—')}
                  </div>
                </>
              )}
              {visibility.biometry && (
                <>
                  <h4 style={{ marginBottom: '0.5rem', marginTop: '1rem' }}>Biometry</h4>
                  {/* 4 columns: label | value | percentile | GA from Bio (BPD row only) */}
                  <div style={{ display: 'grid', gridTemplateColumns: '6rem 1fr 4rem 6rem', gap: '0.4rem 1.25rem', alignItems: 'end', width: '100%' }}>
                    <div style={labelStyle}>BPD</div>
                    <div style={valueStyle}>{examination.biometry2?.bpd !== undefined ? `${fmtBiometry(examination.biometry2.bpd)} mm` : '—'}</div>
                    <div style={pctStyle}>{biometryPercentiles2?.bpd !== undefined ? `${biometryPercentiles2.bpd}th` : ''}</div>
                    <div><div style={labelStyle}>GA from Bio</div><div style={valueStyle}>{examination.gestationalAgeFromBiometry2 || '—'}</div></div>
                    <div style={labelStyle}>OFD</div>
                    <div style={valueStyle}>{examination.biometry2?.ofd !== undefined ? `${fmtBiometry(examination.biometry2.ofd)} mm` : '—'}</div>
                    <div /><div />
                    <div style={labelStyle}>HC</div>
                    <div style={valueStyle}>{examination.biometry2?.hc !== undefined ? `${fmtBiometry(examination.biometry2.hc)} mm` : '—'}</div>
                    <div style={pctStyle}>{biometryPercentiles2?.hc !== undefined ? `${biometryPercentiles2.hc}th` : ''}</div>
                    <div />
                    <div style={labelStyle}>TAD</div>
                    <div style={valueStyle}>{examination.biometry2?.tad !== undefined ? `${fmtBiometry(examination.biometry2.tad)} mm` : '—'}</div>
                    <div /><div />
                    <div style={labelStyle}>APAD</div>
                    <div style={valueStyle}>{examination.biometry2?.apad !== undefined ? `${fmtBiometry(examination.biometry2.apad)} mm` : '—'}</div>
                    <div /><div />
                    <div style={labelStyle}>AC</div>
                    <div style={valueStyle}>{examination.biometry2?.ac !== undefined ? `${fmtBiometry(examination.biometry2.ac)} mm` : '—'}</div>
                    <div style={pctStyle}>{biometryPercentiles2?.ac !== undefined ? `${biometryPercentiles2.ac}th` : ''}</div>
                    <div />
                    <div style={labelStyle}>FL</div>
                    <div style={valueStyle}>{examination.biometry2?.fl !== undefined ? `${fmtBiometry(examination.biometry2.fl)} mm` : '—'}</div>
                    <div style={pctStyle}>{biometryPercentiles2?.fl !== undefined ? `${biometryPercentiles2.fl}th` : ''}</div>
                    <div />
                    <div style={labelStyle}>TCD</div>
                    <div style={valueStyle}>{examination.biometry2?.tcd !== undefined ? `${fmtBiometry(examination.biometry2.tcd)} mm` : '—'}</div>
                    <div /><div />
                    <div style={labelStyle}>Vp</div>
                    <div style={valueStyle}>{examination.biometry2?.vp !== undefined ? `${fmtBiometry(examination.biometry2.vp)} mm` : '—'}</div>
                    <div /><div />
                    <div style={labelStyle}>CM</div>
                    <div style={valueStyle}>{examination.biometry2?.cm !== undefined ? `${fmtBiometry(examination.biometry2.cm)} mm` : '—'}</div>
                    <div /><div />
                    <div style={labelStyle}>NF</div>
                    <div style={valueStyle}>{examination.biometry2?.nuchalFold !== undefined ? `${fmtBiometry(examination.biometry2.nuchalFold)} mm` : '—'}</div>
                    <div /><div />
                    <div style={labelStyle}>NB</div>
                    <div style={valueStyle}>{examination.biometry2?.nb !== undefined ? `${fmtBiometry(examination.biometry2.nb)} mm` : '—'}</div>
                    <div /><div />
                    <div style={labelStyle}>EFW</div>
                    <div style={valueStyle}>{examination.biometry2?.efw !== undefined ? `${fmtBiometry(examination.biometry2.efw)} g` : '—'}</div>
                    <div style={pctStyle}>{efwPercentile2 !== undefined ? `${efwPercentile2}th` : ''}</div>
                    <div />
                    <div style={labelStyle}>LA</div>
                    <div style={valueStyle}>{examination.biometry2?.la !== undefined ? `${fmtBiometry(examination.biometry2.la)} mm` : '—'}</div>
                    <div /><div />
                    <div style={labelStyle}>LC</div>
                    <div style={valueStyle}>{examination.biometry2?.lc !== undefined ? `${fmtBiometry(examination.biometry2.lc)} mm` : '—'}</div>
                    <div /><div />
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#525252', marginTop: '0.25rem', fontStyle: 'italic' }}>Percentiles based on singleton Hadlock reference values</div>
                </>
              )}
              {visibility.anatomy && (
                <>
                  <h4 style={{ marginBottom: '0.75rem', marginTop: '1rem' }}>Anatomy</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem' }}>
                    {fieldBlock('Head', examination.data?.twin2_anatomy?.head || '—')}
                    {fieldBlock('Brain', examination.data?.twin2_anatomy?.brain || '—')}
                    {fieldBlock('Heart', examination.data?.twin2_anatomy?.heart || '—')}
                    {fieldBlock('Abdomen', examination.data?.twin2_anatomy?.abdomen || '—')}
                    {fieldBlock('Kidneys', examination.data?.twin2_anatomy?.kidneys || '—')}
                    {fieldBlock('Limbs', examination.data?.twin2_anatomy?.limbs || '—')}
                    {fieldBlock('Skeleton', examination.data?.twin2_anatomy?.skeleton || '—')}
                    {fieldBlock('Face', examination.data?.twin2_anatomy?.face || '—')}
                    {fieldBlock('Neck / Skin', examination.data?.twin2_anatomy?.neckSkin || '—')}
                    {fieldBlock('Spine', examination.data?.twin2_anatomy?.spine || '—')}
                    {fieldBlock('Thorax', examination.data?.twin2_anatomy?.thorax || '—')}
                  </div>
                </>
              )}
              {visibility.doppler && (
                <>
                  <h4 style={{ marginBottom: '0.75rem', marginTop: '1rem' }}>Doppler</h4>
                  {/* Sub-grid A */}
                  <div style={{ display: 'grid', gridTemplateColumns: '8rem 1fr 1fr', gap: '0.5rem', alignItems: 'end', marginBottom: '0.5rem' }}>
                    <div />
                    <div style={{ fontSize: '0.875rem', color: '#525252', paddingBottom: '0.5rem' }}>PI</div>
                    <div style={{ fontSize: '0.875rem', color: '#525252', paddingBottom: '0.5rem' }}>RI</div>
                    <div style={{ fontSize: '0.875rem', color: '#525252', textAlign: 'left' as const }}>A. ut. Dex.</div>
                    <div style={{ fontSize: '0.875rem', color: '#525252' }}>{examination.doppler2?.utADexPI !== undefined ? String(examination.doppler2.utADexPI) : '—'}</div>
                    <div style={{ fontSize: '0.875rem', color: '#525252' }}>{examination.doppler2?.utADexRI !== undefined ? String(examination.doppler2.utADexRI) : '—'}</div>
                    <div style={{ fontSize: '0.875rem', color: '#525252', textAlign: 'left' as const }}>A. ut. Sin.</div>
                    <div style={{ fontSize: '0.875rem', color: '#525252' }}>{examination.doppler2?.utASinPI !== undefined ? String(examination.doppler2.utASinPI) : '—'}</div>
                    <div style={{ fontSize: '0.875rem', color: '#525252' }}>{examination.doppler2?.utASinRI !== undefined ? String(examination.doppler2.utASinRI) : '—'}</div>
                    <div style={{ fontSize: '0.875rem', color: '#525252', textAlign: 'left' as const }}>A. Umb.</div>
                    <div style={{ fontSize: '0.875rem', color: '#525252' }}>{examination.doppler2?.pi !== undefined ? String(examination.doppler2.pi) : '—'}</div>
                    <div style={{ fontSize: '0.875rem', color: '#525252' }}>{examination.doppler2?.ri !== undefined ? String(examination.doppler2.ri) : '—'}</div>
                  </div>
                  {/* Sub-grid B */}
                  <div style={{ display: 'grid', gridTemplateColumns: '8rem 1fr', gap: '0.5rem', alignItems: 'end' }}>
                    <div style={{ fontSize: '0.875rem', color: '#525252', textAlign: 'left' as const }}>CMA PI</div>
                    <div style={{ fontSize: '0.875rem', color: '#525252' }}>{examination.doppler2?.cma !== undefined ? String(examination.doppler2.cma) : '—'}</div>
                    <div style={{ fontSize: '0.875rem', color: '#525252', textAlign: 'left' as const }}>PSV</div>
                    <div style={{ fontSize: '0.875rem', color: '#525252' }}>{examination.doppler2?.psv !== undefined ? String(examination.doppler2.psv) : '—'}</div>
                    <div style={{ fontSize: '0.875rem', color: '#525252', textAlign: 'left' as const }}>CPR</div>
                    <div style={{ fontSize: '0.875rem', color: '#525252' }}>{examination.doppler2?.cpr !== undefined ? String(examination.doppler2.cpr) : '—'}</div>
                    <div style={{ fontSize: '0.875rem', color: '#525252', textAlign: 'left' as const }}>Duc. Ven.</div>
                    <div style={{ fontSize: '0.875rem', color: '#525252' }}>{examination.doppler2?.ducVen || '—'}</div>
                  </div>
                </>
              )}
            </div>
          </div>
        </Tile>
      )}
    </>
  );
}

// Made with Bob
