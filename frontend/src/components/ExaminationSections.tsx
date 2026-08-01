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

// Sub-Task 1: Tile section title style — ALL CAPS, 0.875rem, weight 600, #161616
const tileTitleStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  fontWeight: 600,
  color: '#161616',
  textTransform: 'uppercase',
  marginBottom: '1rem',
};

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

  // Sub-Task A: fmtVal returns measurement value only (no percentile)
  const fmtVal = (val: number | undefined, unit: string) => {
    if (val === undefined) return '—';
    return `${fmtBiometry(val)} ${unit}`;
  };

  // Sub-Task A: fmtPct returns percentile string or "—"
  const fmtPct = (pct?: number | string): string =>
    pct !== undefined ? `${pct} %-ile` : '—';

  // Sub-Task B: 4-column biometry grid: label | value (right) | percentile | GA from Bio
  const bioGridStyle4col: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'max-content minmax(6rem, auto) max-content max-content',
    gap: '0.3rem 1.25rem',
    alignItems: 'baseline',
  };

  // Sub-Task B: right-aligned value style for col 2
  const bioValueRightStyle: React.CSSProperties = { ...bioValueStyle, textAlign: 'right' };

  // FT biometry grid stays 3-column (no percentile column for FT)
  const bioGridStyle3col: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'max-content minmax(8rem, 1fr) max-content',
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

  /**
   * Sub-Task 6: Render Ultrasound + Biometry sub-sections for one FT fetus column.
   * Biometry is now a 3-column grid with "GA from CRL" in col 3 (first data row only).
   */
  const renderFtTop = (prefix: 'ft' | 'twin2_ft') => {
    const d = examination.data;
    const ftB = prefix === 'ft' ? d?.ft_biometry : d?.twin2_ft_biometry;
    const ftU = prefix === 'ft' ? d?.ft_ultrasound : d?.twin2_ft_ultrasound;
    return (
      <div key={prefix}>
        {/* Sub-Task 6: ULTRASOUND FINDINGS sub-heading uses tileTitleStyle */}
        <div style={{ ...tileTitleStyle, marginTop: '1rem' }}>Ultrasound Findings</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
          {fieldBlock('Placenta', ftU?.placenta || '—')}
          {fieldBlock('FHR (bpm)', ftU?.heartRate !== undefined ? `${ftU.heartRate} bpm` : '—')}
          {fieldBlock('Umbilical Cord', ftU?.umbilicalCord || '—')}
        </div>
        {/* Sub-Task 6: BIOMETRY MEASUREMENTS sub-heading */}
        <div style={{ ...tileTitleStyle, marginTop: '1rem' }}>Biometry Measurements</div>
        {/* Sub-Task 6: 3-column grid: Measurement | Value | GA from CRL (first row only) */}
        <div style={bioGridStyle3col}>
          {/* Header row */}
          <div style={bioLabelStyle}>Measurement</div>
          <div style={{ ...bioLabelStyle, textAlign: 'right' }}>Value</div>
          <div style={bioLabelStyle}>GA from CRL</div>
          {/* Row 1: CRL — GA from CRL value in col 3 */}
          <div style={bioLabelStyle}>CRL (mm)</div>
          <div style={bioValueRightStyle}>{ftB?.crl !== undefined ? `${ftB.crl} mm` : '—'}</div>
          <div style={bioValueStyle}>{ftB?.gaFromCrl || '—'}</div>
          {/* Remaining rows — col 3 empty */}
          <div style={bioLabelStyle}>NT (mm)</div>
          <div style={bioValueRightStyle}>{ftB?.nt !== undefined ? `${ftB.nt} mm` : '—'}</div>
          <div />
          <div style={bioLabelStyle}>NB (mm)</div>
          <div style={bioValueRightStyle}>{ftB?.nb !== undefined ? `${ftB.nb} mm` : '—'}</div>
          <div />
          <div style={bioLabelStyle}>Heart Rate (bpm)</div>
          <div style={bioValueRightStyle}>{ftB?.puls !== undefined ? `${ftB.puls} bpm` : '—'}</div>
          <div />
        </div>
      </div>
    );
  };

  /**
   * Sub-Task 6: Render Anatomy + Doppler sub-sections for one FT fetus column.
   * Sub-headings use tileTitleStyle.
   */
  const renderFtBottom = (prefix: 'ft' | 'twin2_ft') => {
    const d = examination.data;
    const ftA = prefix === 'ft' ? d?.ft_anatomy : d?.twin2_ft_anatomy;
    const ftD = prefix === 'ft' ? d?.ft_doppler : d?.twin2_ft_doppler;
    return (
      <div key={`${prefix}_bottom`}>
        {/* Sub-Task 6: ANATOMY sub-heading */}
        <div style={{ ...tileTitleStyle, marginTop: '1rem' }}>Anatomy</div>
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
        {/* Sub-Task 6: DOPPLER MEASUREMENTS sub-heading */}
        <div style={{ ...tileTitleStyle, marginTop: '1rem' }}>Doppler Measurements</div>
        <div style={{ display: 'grid', gridTemplateColumns: '8rem 1fr 1fr', gap: '0.4rem 1rem', alignItems: 'end' }}>
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

  /**
   * Sub-Task 5: Render one prenatal column's content (A1–A4) for a given fetus.
   * biometry/doppler/anatomy data source is selected by the T1/T2 flag.
   */
  const renderPrenatalColumn = (
    twin2: boolean,
    bpct: BiometryPercentiles | undefined,
    efwPct: number | undefined,
  ) => {
    const bio = twin2 ? examination.biometry2 : examination.biometry;
    const gaFromBio = twin2 ? examination.gestationalAgeFromBiometry2 : examination.gestationalAgeFromBiometry;
    const uf = twin2 ? examination.data?.twin2_ultrasound_findings : examination.data?.ultrasound_findings;
    const anat = twin2 ? examination.data?.twin2_anatomy : examination.data?.anatomy;
    const dop = twin2 ? examination.doppler2 : examination.doppler;

    return (
      <div>
        {/* TILE A1 — ULTRASOUND FINDINGS */}
        {visibility.ultrasoundFindings && (
          <>
            <div style={{ ...tileTitleStyle, marginTop: '0.5rem' }}>Ultrasound Findings</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {fieldBlock('Presentation', uf?.presentation ? <span style={{ textTransform: 'capitalize' }}>{uf.presentation}</span> : '—')}
              {fieldBlock('Gender', uf?.gender ? <span style={{ textTransform: 'capitalize' }}>{uf.gender}</span> : '—')}
              {fieldBlock('FHR (bpm)', uf?.heart_rate !== undefined ? `${uf.heart_rate} bpm` : '—')}
              {fieldBlock('Fetal Movement', uf?.fetal_movement ? <span style={{ textTransform: 'capitalize' }}>{uf.fetal_movement}</span> : '—')}
              {fieldBlock('Placenta', uf?.placenta || '—')}
              {fieldBlock('Umbilical Cord', uf?.umbilical_cord || '—')}
            </div>
          </>
        )}

        {/* TILE A2 — BIOMETRY MEASUREMENTS — 4-column grid */}
        {visibility.biometry && (
          <>
            <div style={{ ...tileTitleStyle }}>Biometry Measurements</div>
            <div style={bioGridStyle4col}>
              {/* Header row: Measurement | Value | Percentile | GA from Bio */}
              <div style={bioLabelStyle}>Measurement</div>
              <div style={{ ...bioLabelStyle, textAlign: 'right' }}>Value</div>
              <div style={bioLabelStyle}>Percentile</div>
              <div style={bioLabelStyle}>GA from Bio</div>
              {/* Row 1: BPD — GA from Bio in col 4 */}
              <div style={bioLabelStyle}>BPD (mm)</div>
              <div style={bioValueRightStyle}>{fmtVal(bio?.bpd, 'mm')}</div>
              <div style={bioValueStyle}>{fmtPct(bpct?.bpd)}</div>
              <div style={bioValueStyle}>{gaFromBio || '—'}</div>
              {/* Remaining rows — col 4 empty */}
              <div style={bioLabelStyle}>OFD (mm)</div>
              <div style={bioValueRightStyle}>{fmtVal(bio?.ofd, 'mm')}</div>
              <div style={bioValueStyle}>{fmtPct(undefined)}</div>
              <div />
              <div style={bioLabelStyle}>HC (mm)</div>
              <div style={bioValueRightStyle}>{fmtVal(bio?.hc, 'mm')}</div>
              <div style={bioValueStyle}>{fmtPct(bpct?.hc)}</div>
              <div />
              <div style={bioLabelStyle}>TAD (mm)</div>
              <div style={bioValueRightStyle}>{fmtVal(bio?.tad, 'mm')}</div>
              <div style={bioValueStyle}>{fmtPct(undefined)}</div>
              <div />
              <div style={bioLabelStyle}>APAD (mm)</div>
              <div style={bioValueRightStyle}>{fmtVal(bio?.apad, 'mm')}</div>
              <div style={bioValueStyle}>{fmtPct(undefined)}</div>
              <div />
              <div style={bioLabelStyle}>AC (mm)</div>
              <div style={bioValueRightStyle}>{fmtVal(bio?.ac, 'mm')}</div>
              <div style={bioValueStyle}>{fmtPct(bpct?.ac)}</div>
              <div />
              <div style={bioLabelStyle}>FL (mm)</div>
              <div style={bioValueRightStyle}>{fmtVal(bio?.fl, 'mm')}</div>
              <div style={bioValueStyle}>{fmtPct(bpct?.fl)}</div>
              <div />
              <div style={bioLabelStyle}>TCD (mm)</div>
              <div style={bioValueRightStyle}>{fmtVal(bio?.tcd, 'mm')}</div>
              <div style={bioValueStyle}>{fmtPct(undefined)}</div>
              <div />
              <div style={bioLabelStyle}>Vp (mm)</div>
              <div style={bioValueRightStyle}>{fmtVal(bio?.vp, 'mm')}</div>
              <div style={bioValueStyle}>{fmtPct(undefined)}</div>
              <div />
              <div style={bioLabelStyle}>CM (mm)</div>
              <div style={bioValueRightStyle}>{fmtVal(bio?.cm, 'mm')}</div>
              <div style={bioValueStyle}>{fmtPct(undefined)}</div>
              <div />
              <div style={bioLabelStyle}>NF (mm)</div>
              <div style={bioValueRightStyle}>{fmtVal(bio?.nuchalFold, 'mm')}</div>
              <div style={bioValueStyle}>{fmtPct(undefined)}</div>
              <div />
              <div style={bioLabelStyle}>NB (mm)</div>
              <div style={bioValueRightStyle}>{fmtVal(bio?.nb, 'mm')}</div>
              <div style={bioValueStyle}>{fmtPct(undefined)}</div>
              <div />
              <div style={bioLabelStyle}>EFW (grams)</div>
              <div style={bioValueRightStyle}>{fmtVal(bio?.efw, 'g')}</div>
              <div style={bioValueStyle}>{fmtPct(efwPct)}</div>
              <div />
              <div style={bioLabelStyle}>LA (mm)</div>
              <div style={bioValueRightStyle}>{fmtVal(bio?.la, 'mm')}</div>
              <div style={bioValueStyle}>{fmtPct(undefined)}</div>
              <div />
              <div style={bioLabelStyle}>LC (mm)</div>
              <div style={bioValueRightStyle}>{fmtVal(bio?.lc, 'mm')}</div>
              <div style={bioValueStyle}>{fmtPct(undefined)}</div>
              <div />
            </div>
            {isTwins && (
              <div style={{ fontSize: '0.75rem', color: '#525252', marginTop: '0.25rem', marginBottom: '1rem', fontStyle: 'italic' }}>
                Percentiles based on singleton Hadlock reference values
              </div>
            )}
          </>
        )}

        {/* TILE A3 — ANATOMY */}
        {visibility.anatomy && (
          <>
            <div style={{ ...tileTitleStyle, marginTop: '1rem' }}>Anatomy</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {fieldBlock('Head', anat?.head || '—')}
              {fieldBlock('Brain', anat?.brain || '—')}
              {fieldBlock('Heart', anat?.heart || '—')}
              {fieldBlock('Abdomen', anat?.abdomen || '—')}
              {fieldBlock('Kidneys', anat?.kidneys || '—')}
              {fieldBlock('Limbs', anat?.limbs || '—')}
              {fieldBlock('Skeleton', anat?.skeleton || '—')}
              {fieldBlock('Face', anat?.face || '—')}
              {fieldBlock('Neck / Skin', anat?.neckSkin || '—')}
              {fieldBlock('Spine', anat?.spine || '—')}
              {fieldBlock('Thorax', anat?.thorax || '—')}
            </div>
          </>
        )}

        {/* TILE A4 — DOPPLER MEASUREMENTS */}
        {visibility.doppler && (
          <>
            <div style={{ ...tileTitleStyle, marginTop: '1rem' }}>Doppler Measurements</div>
            {/* Sub-grid A: Vessel | PI | RI */}
            <div style={{ display: 'grid', gridTemplateColumns: '8rem 1fr 1fr', gap: '0.5rem', alignItems: 'end', marginBottom: '0.5rem' }}>
              <div style={{ fontSize: '0.875rem', color: '#525252' }}>Vessel</div>
              <div style={{ fontSize: '0.875rem', color: '#525252', paddingBottom: '0.5rem' }}>PI</div>
              <div style={{ fontSize: '0.875rem', color: '#525252', paddingBottom: '0.5rem' }}>RI</div>
              <div style={{ fontSize: '0.875rem', color: '#525252', textAlign: 'left' as const }}>A. ut. Dex.</div>
              {/* Sub-Task 5: value cells use color #161616 + fontWeight 600 */}
              <div style={{ fontSize: '0.875rem', color: '#161616', fontWeight: 600 }}>{dop?.utADexPI !== undefined ? String(dop.utADexPI) : '—'}</div>
              <div style={{ fontSize: '0.875rem', color: '#161616', fontWeight: 600 }}>{dop?.utADexRI !== undefined ? String(dop.utADexRI) : '—'}</div>
              <div style={{ fontSize: '0.875rem', color: '#525252', textAlign: 'left' as const }}>A. ut. Sin.</div>
              <div style={{ fontSize: '0.875rem', color: '#161616', fontWeight: 600 }}>{dop?.utASinPI !== undefined ? String(dop.utASinPI) : '—'}</div>
              <div style={{ fontSize: '0.875rem', color: '#161616', fontWeight: 600 }}>{dop?.utASinRI !== undefined ? String(dop.utASinRI) : '—'}</div>
              <div style={{ fontSize: '0.875rem', color: '#525252', textAlign: 'left' as const }}>A. Umb.</div>
              <div style={{ fontSize: '0.875rem', color: '#161616', fontWeight: 600 }}>{dop?.pi !== undefined ? String(dop.pi) : '—'}</div>
              <div style={{ fontSize: '0.875rem', color: '#161616', fontWeight: 600 }}>{dop?.ri !== undefined ? String(dop.ri) : '—'}</div>
            </div>
            {/* Sub-grid B: Measurement | Value */}
            <div style={{ display: 'grid', gridTemplateColumns: '8rem 1fr', gap: '0.5rem', alignItems: 'end' }}>
              <div style={{ fontSize: '0.875rem', color: '#525252', textAlign: 'left' as const }}>CMA PI</div>
              <div style={{ fontSize: '0.875rem', color: '#161616', fontWeight: 600 }}>{dop?.cma !== undefined ? String(dop.cma) : '—'}</div>
              <div style={{ fontSize: '0.875rem', color: '#525252', textAlign: 'left' as const }}>PSV</div>
              <div style={{ fontSize: '0.875rem', color: '#161616', fontWeight: 600 }}>{dop?.psv !== undefined ? String(dop.psv) : '—'}</div>
              <div style={{ fontSize: '0.875rem', color: '#525252', textAlign: 'left' as const }}>CPR</div>
              <div style={{ fontSize: '0.875rem', color: '#161616', fontWeight: 600 }}>{dop?.cpr !== undefined ? String(dop.cpr) : '—'}</div>
              <div style={{ fontSize: '0.875rem', color: '#525252', textAlign: 'left' as const }}>Duc. Ven.</div>
              <div style={{ fontSize: '0.875rem', color: '#161616', fontWeight: 600 }}>{dop?.ducVen || '—'}</div>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Sub-Task 6: First Trimester layout — single wrapper Tile, 50%/50% outer grid */}
      {isFt && (
        <Tile>
          {/* Sub-Task 6: heading uses tileTitleStyle */}
          <div style={tileTitleStyle}>First Trimester Ultrasound</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            {/* Left column: always rendered — Single Fetus / Twin 1 */}
            <div>
              <div style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#161616',
                borderBottom: '3px solid #0f62fe',
                paddingBottom: '0.5rem',
                marginBottom: '0.5rem',
              }}>
                Single Fetus / Twin 1
              </div>
              {renderFtTop('ft')}
              {/* Sub-Task 6: Markers sub-heading — always rendered for FT */}
              <div style={{ ...tileTitleStyle, marginTop: '1rem' }}>Markers</div>
              {renderMarkers(examination.data?.ft_markers)}
              {renderFtBottom('ft')}
            </div>
            {/* Right column: only rendered for twins */}
            {isFtTwinsExam && (
              <div>
                <div style={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: '#161616',
                  borderBottom: '3px solid #6929c4',
                  paddingBottom: '0.5rem',
                  marginBottom: '0.5rem',
                }}>
                  Twin 2
                </div>
                {renderFtTop('twin2_ft')}
                <div style={{ ...tileTitleStyle, marginTop: '1rem' }}>Markers</div>
                {renderMarkers(examination.data?.twin2_ft_markers)}
                {renderFtBottom('twin2_ft')}
              </div>
            )}
          </div>
        </Tile>
      )}

      {/* Sub-Task 5: Prenatal layout — single wrapper Tile, 50%/50% outer grid */}
      {!isFt && (
        <Tile>
          {/* Sub-Task 5: heading uses tileTitleStyle */}
          <div style={tileTitleStyle}>Ultrasound Prenatal Exam</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            {/* Left column: always rendered — Single Fetus / Twin 1 */}
            <div>
              <div style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#161616',
                borderBottom: '3px solid #0f62fe',
                paddingBottom: '0.5rem',
                marginBottom: '0.5rem',
              }}>
                Single Fetus / Twin 1
              </div>
              {renderPrenatalColumn(false, biometryPercentiles, efwPercentile)}
            </div>
            {/* Right column: only rendered for twins */}
            {isTwins && (
              <div>
                <div style={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: '#161616',
                  borderBottom: '3px solid #6929c4',
                  paddingBottom: '0.5rem',
                  marginBottom: '0.5rem',
                }}>
                  Twin 2
                </div>
                {renderPrenatalColumn(true, biometryPercentiles2, efwPercentile2)}
              </div>
            )}
          </div>
        </Tile>
      )}
    </>
  );
}

// Made with Bob
