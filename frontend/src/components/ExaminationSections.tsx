/**
 * ExaminationSections — renders clinical sections for the detail page (ST-07 update).
 *
 * Reads from examination.data.fetuses[i] (new Observable model).
 * No references to legacy examination.biometry, biometry2, data.ft_*, data.twin2_*.
 * No AutoCalcDot — replaced by autoSuffix text-suffix pattern on value cells.
 * No footnote legend rows.
 */
import { Fragment } from 'react';
import { Tile } from '@carbon/react';
import { fmtBiometry } from '../utils/calculations';
import { EXAM_TYPE_CONFIG } from '../constants/examinationTypes';
import { autoSuffix } from './AutoCalcHelpers';
import type { Examination, Observable, FetusSectionData } from '../types';

interface ExaminationSectionsProps {
  examination: Examination;
  // Legacy percentile props kept for interface compatibility — no longer used
  biometryPercentiles?: unknown;
  efwPercentile?: number;
  biometryPercentiles2?: unknown;
  efwPercentile2?: number;
}

// Shared styles
const tileTitleStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  fontWeight: 600,
  color: '#161616',
  textTransform: 'uppercase',
  marginBottom: '1rem',
};

const bioLabelStyle: React.CSSProperties = { fontSize: '0.75rem', color: '#525252', whiteSpace: 'nowrap', textAlign: 'left' };
const bioValueStyle: React.CSSProperties = { fontSize: '0.875rem', color: '#161616', fontWeight: 600, textAlign: 'left' };
const bioValueRightStyle: React.CSSProperties = { ...bioValueStyle, textAlign: 'right' };

const bioGridStyle4col: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'max-content minmax(6rem, auto) max-content max-content',
  gap: '0.3rem 1.25rem',
  alignItems: 'baseline',
};

const fieldBlock = (label: string, value: React.ReactNode) => (
  <div>
    <div style={{ fontSize: '0.75rem', color: '#525252', marginBottom: '0.25rem' }}>
      <span>{label}</span>
    </div>
    <div style={{ fontSize: '0.875rem', color: '#161616', fontWeight: 600 }}>{value}</div>
  </div>
);

/** Returns observable value as display string. */
function obsValue(obs: Observable | undefined, unit: string): string {
  if (!obs || obs.value == null || obs.value === '') return '—';
  const raw = typeof obs.value === 'number' ? fmtBiometry(obs.value) : String(obs.value);
  return unit ? `${raw} ${unit}` : raw;
}

/** Returns percentile display string from observable. */
function obsPct(obs: Observable | undefined): string {
  if (!obs?.percentile?.value) return '—';
  const pct = obs.percentile.value;
  const manualMark = obs.percentile.isManual ? ' †' : '';
  return `${pct} %-ile${manualMark}`;
}

/** Returns GA string from observable, with autoSuffix applied inline. */
function obsGa(obs: Observable | undefined): React.ReactNode {
  if (!obs?.ga?.value) return '—';
  const gaVal = obs.ga.value;
  const manualFlag = obs.ga.isManual;
  const marker = obs.isManual ? ' †' : '';
  return <>{gaVal}{marker}{autoSuffix(manualFlag, undefined, true)}</>;
}

/** Renders a 4-column biometry row: label | value | percentile | GA */
function BioRow({ label, obs, unit }: { label: string; obs: Observable | undefined; unit: string }) {
  const hasValue = obs?.value != null && obs.value !== '';
  const valDisplay = obsValue(obs, unit);
  const manualValueMark = obs?.isManual ? ' †' : '';

  return (
    <Fragment>
      <span style={bioLabelStyle}>{label}</span>
      <span style={bioValueRightStyle}>
        {hasValue ? <>{valDisplay}{manualValueMark}</> : '—'}
      </span>
      <span style={bioValueStyle}>{obsPct(obs)}</span>
      <span style={bioValueStyle}>{obsGa(obs)}</span>
    </Fragment>
  );
}

function renderFetusBiometry(fetus: FetusSectionData, examType: string) {
  const config = EXAM_TYPE_CONFIG[examType] ?? EXAM_TYPE_CONFIG['prenatal'];
  const biometryMap = new Map<string, Observable>(
    (fetus.biometry ?? []).map(o => [o.type, o])
  );
  const dopplerMap = new Map<string, Observable>(
    (fetus.doppler ?? []).map(o => [o.type, o])
  );
  const isFt = examType === 'first_trimester';

  const gaFromBioValue = fetus.gaFromBiometry?.value;
  const gaFromBioManual = fetus.gaFromBiometry?.isManual;

  return (
    <div>
      {/* GA from Biometry header */}
      {gaFromBioValue && (
        <div style={{ marginBottom: '0.75rem' }}>
          {fieldBlock(
            'GA from Biometry',
            <>{gaFromBioValue}{autoSuffix(gaFromBioManual, undefined, true)}</>
          )}
        </div>
      )}

      {/* Biometry grid */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ ...bioGridStyle4col, marginBottom: '0.25rem' }}>
          <span style={bioLabelStyle}>Measurement</span>
          <span style={bioLabelStyle}>Value</span>
          <span style={bioLabelStyle}>Percentile</span>
          <span style={bioLabelStyle}>GA</span>
        </div>
        <div style={bioGridStyle4col}>
          {config.biometryTypes.map(tc => (
            <BioRow
              key={tc.type}
              label={`${tc.label}${tc.unit ? ` (${tc.unit})` : ''}`}
              obs={biometryMap.get(tc.type)}
              unit={tc.unit}
            />
          ))}
        </div>
      </div>

      {/* Markers (first trimester only) */}
      {isFt && fetus.markers && Object.keys(fetus.markers).length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ ...tileTitleStyle, fontSize: '0.8rem', marginBottom: '0.5rem' }}>
            First Trimester Markers
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.4rem 1rem' }}>
            {Object.entries(fetus.markers).map(([key, val]) => (
              <Fragment key={key}>
                <span style={bioLabelStyle}>{key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</span>
                <span style={bioValueStyle}>{val || '—'}</span>
              </Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Doppler */}
      {(config.dopplerVessels.length > 0 || config.dopplerSingle.length > 0) && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ ...tileTitleStyle, fontSize: '0.8rem', marginBottom: '0.5rem' }}>Doppler</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'max-content max-content', gap: '0.3rem 1.25rem' }}>
            {[...config.dopplerVessels, ...config.dopplerSingle].map(tc => {
              const obs = dopplerMap.get(tc.type);
              const hasVal = obs?.value != null && obs.value !== '';
              return (
                <Fragment key={tc.type}>
                  <span style={bioLabelStyle}>{tc.label}</span>
                  <span style={bioValueStyle}>{hasVal ? String(obs!.value) : '—'}</span>
                </Fragment>
              );
            })}
          </div>
        </div>
      )}

      {/* Ultrasound Findings */}
      {fetus.ultrasoundFindings && Object.keys(fetus.ultrasoundFindings).length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ ...tileTitleStyle, fontSize: '0.8rem', marginBottom: '0.5rem' }}>Ultrasound Findings</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem 1rem' }}>
            {Object.entries(fetus.ultrasoundFindings).map(([key, val]) => (
              fieldBlock(key.replace(/_/g, ' ').replace(/\b\w/g, s => s.toUpperCase()), val != null ? String(val) : '—')
            ))}
          </div>
        </div>
      )}

      {/* Anatomy */}
      {fetus.anatomy && Object.keys(fetus.anatomy).length > 0 && (
        <div>
          <div style={{ ...tileTitleStyle, fontSize: '0.8rem', marginBottom: '0.5rem' }}>Anatomy</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.5rem' }}>
            {Object.entries(fetus.anatomy).map(([key, val]) =>
              fieldBlock(key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()), val || '—')
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ExaminationSections({ examination }: ExaminationSectionsProps) {
  const fetuses = examination.data?.fetuses ?? [];
  const examType = examination.examinationType ?? 'prenatal';
  const fetusCount = fetuses.length;

  return (
    <div>
      {fetuses.map((fetus, i) => (
        <Tile key={i} style={{ marginBottom: '1rem' }}>
          {fetusCount > 1 && (
            <p style={{ ...tileTitleStyle, marginBottom: '1.25rem' }}>Fetus {i + 1}</p>
          )}
          {renderFetusBiometry(fetus, examType)}
        </Tile>
      ))}

      {fetuses.length === 0 && (
        <Tile>
          <p style={{ color: '#525252' }}>No clinical measurement data recorded.</p>
        </Tile>
      )}
    </div>
  );
}
