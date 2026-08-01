/**
 * ExaminationSections — extracted from ExaminationDetailPage.tsx (Sub-Task 0b).
 * Renders the clinical-data sections for an examination: Ultrasound Findings,
 * Biometry, Anatomy, and Doppler — for both single-fetus and twins layouts.
 */
import { Fragment } from 'react';
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
    <div style={{ fontSize: '0.75rem', color: '#525252', marginBottom: '0.25rem' }}>{label}</div>
    <div style={{ fontSize: '0.875rem', color: '#161616', fontWeight: 600 }}>{value}</div>
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

  // Shared cell styles for the biometry / markers grids (Option C alignment)
  const bioLabelStyle: React.CSSProperties = { fontSize: '0.75rem', color: '#525252', whiteSpace: 'nowrap', textAlign: 'left' };
  const bioValueStyle: React.CSSProperties = { fontSize: '0.875rem', color: '#161616', fontWeight: 600, textAlign: 'left' };

  /** Format a biometry value with optional percentile: "32.4 mm · 45th" */
  const fmtVal = (val: number | undefined, unit: string, pct?: number | string) => {
    if (val === undefined) return '—';
    const base = `${fmtBiometry(val)} ${unit}`;
    return pct !== undefined ? `${base} · ${pct}th` : base;
  };

  /** 2-column biometry grid: pairs flow as [label, value] rows, no width cap */
  const bioGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'max-content minmax(6rem, 1fr)',
    gap: '0.3rem 1.25rem',
    alignItems: 'baseline',
  };

  /** Render a single biometry row as two cells */
  const bioRow = (label: string, value: string) => (
    <>
      <div style={bioLabelStyle}>{label}</div>
      <div style={bioValueStyle}>{value}</div>
    </>
  );

  /** Markers grid: label col auto-fits to content, value col left-aligned */
  const markerGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'max-content minmax(4rem, auto)',
    gap: '0.3rem 1.25rem',
    alignItems: 'baseline',
    justifyItems: 'start',
  };

  const yesNo = (v: string | undefined) => v === 'yes' ? 'Yes' : v === 'no' ? 'No' : '—';

  /** Render the Markers sub-section for one fetus. */
  const renderMarkers = (ftM: typeof examination.data.ft_markers) => (
    <div style={markerGridStyle}>
      {([
        ['Arrhythmia',              yesNo(ftM?.arrhythmia)],
        ['Tricuspid Regurgitation', yesNo(ftM?.tricuspidRegurgitation)],
        ['Abnormal D.Venosus Flow', yesNo(ftM?.abnormalDvFlow)],
        ['Echogenic Cardiac Focus', yesNo(ftM?.echogenicCardiacFocus)],
        ['Single Umbilical Artery', yesNo(ftM?.singleUmbilicalArtery)],
        ['Choroid Plexus Cysts',    yesNo(ftM?.choroidPlexusCysts)],
        ['Exomphalos',              yesNo(ftM?.exomphalos)],
        ['Megacystis',              yesNo(ftM?.megacystis)],
        ['Placenta',                ftM?.placenta || '—'],
        ['Cord Insertion',          ftM?.cordInsertion || '—'],
      ] as [string, string][]).map(([lbl, val]) => (
        <Fragment key={lbl}>{bioRow(lbl, val)}</Fragment>
      ))}
    </div>
  );

  /** Render Ultrasound + Biometry sub-sections for one fetus column. */
  const renderFtTop = (prefix: 'ft' | 'twin2_ft', label: string, color: string) => {
    const d = examination.data;
    const ftB = prefix === 'ft' ? d?.ft_biometry : d?.twin2_ft_biometry;
    const ftU = prefix === 'ft' ? d?.ft_ultrasound : d?.twin2_ft_ultrasound;
    return (
      <div key={prefix}>
        {isFtTwinsExam && <h3 style={{ marginBottom: '1rem', borderBottom: `2px solid ${color}`, paddingBottom: '0.5rem' }}>{label}</h3>}
        <h4 style={{ marginBottom: '0.75rem', marginTop: '1rem' }}>Ultrasound</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
          {fieldBlock('Placenta', ftU?.placenta || '—')}
          {fieldBlock('FHR', ftU?.heartRate !== undefined ? `${ftU.heartRate} bpm` : '—')}
          {fieldBlock('Umbilical Cord', ftU?.umbilicalCord || '—')}
        </div>
        <h4 style={{ marginBottom: '0.75rem', marginTop: '1rem' }}>Biometry</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
          {fieldBlock('CRL (mm)', ftB?.crl !== undefined ? `${ftB.crl} mm` : '—')}
          {fieldBlock('GA from CRL', ftB?.gaFromCrl || '—')}
          {fieldBlock('NT (mm)', ftB?.nt !== undefined ? `${ftB.nt} mm` : '—')}
          {fieldBlock('NB (mm)', ftB?.nb !== undefined ? `${ftB.nb} mm` : '—')}
          {fieldBlock('Heart Rate', ftB?.puls !== undefined ? `${ftB.puls} bpm` : '—')}
        </div>
      </div>
    );
  };

  /** Render Anatomy + Doppler sub-sections for one fetus column. */
  const renderFtBottom = (prefix: 'ft' | 'twin2_ft') => {
    const d = examination.data;
    const ftA = prefix === 'ft' ? d?.ft_anatomy : d?.twin2_ft_anatomy;
    const ftD = prefix === 'ft' ? d?.ft_doppler : d?.twin2_ft_doppler;
    return (
      <div key={`${prefix}_bottom`}>
        <h4 style={{ marginBottom: '0.75rem', marginTop: '1rem' }}>Anatomy</h4>
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
        <h4 style={{ marginBottom: '0.75rem', marginTop: '1rem' }}>Doppler</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '8rem 1fr 1fr', gap: '0.4rem 1rem', alignItems: 'end', width: '50%' }}>
          <div />
          <div style={{ fontSize: '0.75rem', color: '#525252' }}>PI</div>
          <div style={{ fontSize: '0.75rem', color: '#525252' }}>RI</div>
          <div style={{ fontSize: '0.75rem', color: '#525252' }}>A. ut. Dex.</div>
          <div style={{ fontSize: '0.875rem', color: '#161616', fontWeight: 600 }}>{ftD?.utADexPI !== undefined ? String(ftD.utADexPI) : '—'}</div>
          <div style={{ fontSize: '0.875rem', color: '#161616', fontWeight: 600 }}>{ftD?.utADexRI !== undefined ? String(ftD.utADexRI) : '—'}</div>
          <div style={{ fontSize: '0.75rem', color: '#525252' }}>A. ut. Sin.</div>
          <div style={{ fontSize: '0.875rem', color: '#161616', fontWeight: 600 }}>{ftD?.utASinPI !== undefined ? String(ftD.utASinPI) : '—'}</div>
          <div style={{ fontSize: '0.875rem', color: '#161616', fontWeight: 600 }}>{ftD?.utASinRI !== undefined ? String(ftD.utASinRI) : '—'}</div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* UZPT — First Trimester layout (single fetus): Ultrasound → Biometry → Markers → Anatomy → Doppler */}
      {isFt && !isFtTwinsExam && (
        <Tile>
          <h3 style={{ marginBottom: '1.5rem' }}>First Trimester Ultrasound</h3>
          {renderFtTop('ft', '', '')}
          <h4 style={{ marginBottom: '0.75rem', marginTop: '1rem' }}>Markers</h4>
          {renderMarkers(examination.data?.ft_markers)}
          {renderFtBottom('ft')}
        </Tile>
      )}
      {/* UZPT — First Trimester layout (twins): Ultrasound → Biometry → Markers (split) → Anatomy → Doppler */}
      {isFtTwinsExam && (
        <Tile>
          <h3 style={{ marginBottom: '1.5rem' }}>First Trimester Ultrasound (Twins)</h3>
          {/* Ultrasound + Biometry — two columns */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2rem' }}>
            {renderFtTop('ft', 'Twin 1', '#0f62fe')}
            {renderFtTop('twin2_ft', 'Twin 2', '#6929c4')}
          </div>
          {/* Markers — full-width row split 50/50: T1 left, T2 right */}
          <h4 style={{ marginBottom: '0.75rem', marginTop: '1.5rem' }}>Markers</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2rem' }}>
            <div>{renderMarkers(examination.data?.ft_markers)}</div>
            <div>{renderMarkers(examination.data?.twin2_ft_markers)}</div>
          </div>
          {/* Anatomy + Doppler — two columns */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2rem' }}>
            {renderFtBottom('ft')}
            {renderFtBottom('twin2_ft')}
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
            <div style={bioGridStyle}>
              {bioRow('BPD',  fmtVal(examination.biometry?.bpd,       'mm', biometryPercentiles?.bpd))}
              {bioRow('OFD',  fmtVal(examination.biometry?.ofd,       'mm'))}
              {bioRow('HC',   fmtVal(examination.biometry?.hc,        'mm', biometryPercentiles?.hc))}
              {bioRow('TAD',  fmtVal(examination.biometry?.tad,       'mm'))}
              {bioRow('APAD', fmtVal(examination.biometry?.apad,      'mm'))}
              {bioRow('AC',   fmtVal(examination.biometry?.ac,        'mm', biometryPercentiles?.ac))}
              {bioRow('FL',   fmtVal(examination.biometry?.fl,        'mm', biometryPercentiles?.fl))}
              {bioRow('TCD',  fmtVal(examination.biometry?.tcd,       'mm'))}
              {bioRow('Vp',   fmtVal(examination.biometry?.vp,        'mm'))}
              {bioRow('CM',   fmtVal(examination.biometry?.cm,        'mm'))}
              {bioRow('NF',   fmtVal(examination.biometry?.nuchalFold,'mm'))}
              {bioRow('NB',   fmtVal(examination.biometry?.nb,        'mm'))}
              {bioRow('EFW',  fmtVal(examination.biometry?.efw,       'g',  efwPercentile))}
              {bioRow('LA',   fmtVal(examination.biometry?.la,        'mm'))}
              {bioRow('LC',   fmtVal(examination.biometry?.lc,        'mm'))}
              {bioRow('GA from Bio', examination.gestationalAgeFromBiometry || '—')}
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
                  <div style={bioGridStyle}>
                    {bioRow('BPD',  fmtVal(examination.biometry?.bpd,       'mm', biometryPercentiles?.bpd))}
                    {bioRow('OFD',  fmtVal(examination.biometry?.ofd,       'mm'))}
                    {bioRow('HC',   fmtVal(examination.biometry?.hc,        'mm', biometryPercentiles?.hc))}
                    {bioRow('TAD',  fmtVal(examination.biometry?.tad,       'mm'))}
                    {bioRow('APAD', fmtVal(examination.biometry?.apad,      'mm'))}
                    {bioRow('AC',   fmtVal(examination.biometry?.ac,        'mm', biometryPercentiles?.ac))}
                    {bioRow('FL',   fmtVal(examination.biometry?.fl,        'mm', biometryPercentiles?.fl))}
                    {bioRow('TCD',  fmtVal(examination.biometry?.tcd,       'mm'))}
                    {bioRow('Vp',   fmtVal(examination.biometry?.vp,        'mm'))}
                    {bioRow('CM',   fmtVal(examination.biometry?.cm,        'mm'))}
                    {bioRow('NF',   fmtVal(examination.biometry?.nuchalFold,'mm'))}
                    {bioRow('NB',   fmtVal(examination.biometry?.nb,        'mm'))}
                    {bioRow('EFW',  fmtVal(examination.biometry?.efw,       'g',  efwPercentile))}
                    {bioRow('LA',   fmtVal(examination.biometry?.la,        'mm'))}
                    {bioRow('LC',   fmtVal(examination.biometry?.lc,        'mm'))}
                    {bioRow('GA from Bio', examination.gestationalAgeFromBiometry || '—')}
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
                  <div style={bioGridStyle}>
                    {bioRow('BPD',  fmtVal(examination.biometry2?.bpd,       'mm', biometryPercentiles2?.bpd))}
                    {bioRow('OFD',  fmtVal(examination.biometry2?.ofd,       'mm'))}
                    {bioRow('HC',   fmtVal(examination.biometry2?.hc,        'mm', biometryPercentiles2?.hc))}
                    {bioRow('TAD',  fmtVal(examination.biometry2?.tad,       'mm'))}
                    {bioRow('APAD', fmtVal(examination.biometry2?.apad,      'mm'))}
                    {bioRow('AC',   fmtVal(examination.biometry2?.ac,        'mm', biometryPercentiles2?.ac))}
                    {bioRow('FL',   fmtVal(examination.biometry2?.fl,        'mm', biometryPercentiles2?.fl))}
                    {bioRow('TCD',  fmtVal(examination.biometry2?.tcd,       'mm'))}
                    {bioRow('Vp',   fmtVal(examination.biometry2?.vp,        'mm'))}
                    {bioRow('CM',   fmtVal(examination.biometry2?.cm,        'mm'))}
                    {bioRow('NF',   fmtVal(examination.biometry2?.nuchalFold,'mm'))}
                    {bioRow('NB',   fmtVal(examination.biometry2?.nb,        'mm'))}
                    {bioRow('EFW',  fmtVal(examination.biometry2?.efw,       'g',  efwPercentile2))}
                    {bioRow('LA',   fmtVal(examination.biometry2?.la,        'mm'))}
                    {bioRow('LC',   fmtVal(examination.biometry2?.lc,        'mm'))}
                    {bioRow('GA from Bio', examination.gestationalAgeFromBiometry2 || '—')}
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
