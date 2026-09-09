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
const styleFetusSectionContainer: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  flexWrap: 'nowrap',
  gap: '1.5rem',
  width: '100%',
  overflowX: 'auto',
  paddingBottom: '0.5rem',
};

const styleFetusColumn: React.CSSProperties = {
  minWidth: '480px',
  flex: '0 0 calc(50% - 0.75rem)',
  boxSizing: 'border-box',
};

const tileTitleStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  fontWeight: 600,
  color: '#161616',
  textTransform: 'uppercase',
  marginBottom: '0.75rem',
  textAlign: 'left',
};

const subSectionTitleStyle: React.CSSProperties = {
  fontSize: '0.8125rem',
  fontWeight: 600,
  color: '#161616',
  textTransform: 'uppercase',
  marginTop: '1.25rem',
  marginBottom: '0.5rem',
  textAlign: 'left',
};

const bioLabelStyle: React.CSSProperties = { fontSize: '0.75rem', color: '#525252', whiteSpace: 'nowrap', textAlign: 'left' };
const bioValueStyle: React.CSSProperties = { fontSize: '0.875rem', color: '#161616', fontWeight: 600, textAlign: 'left' };
const bioValueRightStyle: React.CSSProperties = { ...bioValueStyle, textAlign: 'right' };

const fieldBlock = (label: string, value: React.ReactNode) => (
  <div style={{ textAlign: 'left' }}>
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

/** Returns GA string from observable, with autoSuffix applied inline using sourceTag from config. */
function obsGa(obs: Observable | undefined, sourceTag?: string): React.ReactNode {
  if (!obs?.ga?.value) return '—';
  const gaVal = obs.ga.value;
  const manualFlag = obs.ga.isManual;
  const marker = obs.isManual ? ' †' : '';
  return <>{gaVal}{marker}{autoSuffix(manualFlag, sourceTag, true)}</>;
}

/** Renders biometry row cells dynamically driven by ObservableTypeConfig metadata. */
function BioRow({
  config,
  obs,
  showPercentile,
}: {
  config: import('../types').ObservableTypeConfig;
  obs: Observable | undefined;
  showPercentile: boolean;
}) {
  const hasValue = obs?.value != null && obs.value !== '';
  const valDisplay = obsValue(obs, config.unit);
  const manualValueMark = obs?.isManual ? ' †' : '';
  const labelWithUnit = `${config.label}${config.unit ? ` (${config.unit})` : ''}`;

  return (
    <Fragment>
      <span style={bioLabelStyle}>{labelWithUnit}</span>
      <span style={bioValueRightStyle}>
        {hasValue ? <>{valDisplay}{manualValueMark}</> : '—'}
      </span>
      {showPercentile && (
        <span style={bioValueStyle}>
          {config.hasPercentile ? obsPct(obs) : '—'}
        </span>
      )}
      <span style={bioValueStyle}>
        {config.hasGa ? obsGa(obs, config.sourceTag) : ''}
      </span>
    </Fragment>
  );
}

function renderFetusClinicalDetails(fetus: FetusSectionData, examType: string) {
  const config = EXAM_TYPE_CONFIG[examType] ?? EXAM_TYPE_CONFIG['prenatal'];
  const biometryMap = new Map<string, Observable>(
    (fetus.biometry ?? []).map(o => [o.type, o])
  );
  const dopplerMap = new Map<string, Observable>(
    (fetus.doppler ?? []).map(o => [o.type, o])
  );

  const uf = (fetus.ultrasoundFindings ?? {}) as Record<string, string>;
  const anat = (fetus.anatomy ?? {}) as Record<string, string>;
  const gaFromBioValue = fetus.gaFromBiometry?.value;
  const gaFromBioManual = fetus.gaFromBiometry?.isManual;
  const hasPercentileCol = config.biometryTypes.some(t => t.hasPercentile);

  return (
    <div>
      {/* 1. Ultrasound Findings (unconditionally rendered from config) */}
      {config.ultrasoundFindingTypes.length > 0 && (
        <div>
          <div style={subSectionTitleStyle}>Ultrasound Findings</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem 1rem' }}>
            {config.ultrasoundFindingTypes.map(tc => {
              const rawVal = uf[tc.key];
              let displayVal = '—';
              if (rawVal != null && rawVal !== '') {
                // If it has options, check matching option label
                const opt = tc.options?.find(o => o.value === rawVal);
                if (opt) {
                  displayVal = opt.label;
                } else {
                  const s = String(rawVal);
                  displayVal = s.charAt(0).toUpperCase() + s.slice(1);
                  if (tc.unit && !s.includes(tc.unit)) {
                    displayVal = `${displayVal} ${tc.unit}`;
                  }
                }
              }
              return (
                <Fragment key={tc.key}>
                  {fieldBlock(tc.unit && tc.inputType === 'text' && tc.key === 'heart_rate' ? 'FHR (bpm)' : tc.label, displayVal)}
                </Fragment>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Biometry */}
      {config.biometryTypes.length > 0 && (
        <div>
          <div style={subSectionTitleStyle}>Biometry</div>

          {/* GA from Biometry header summary if present */}
          {gaFromBioValue && (
            <div style={{ marginBottom: '0.75rem' }}>
              {fieldBlock(
                'GA from Biometry',
                <>{gaFromBioValue}{autoSuffix(gaFromBioManual, config.trimester === 'first' ? 'Robinson' : 'Hadlock', true)}</>
              )}
            </div>
          )}

          {/* Biometry grid — Single unified CSS Grid container for headers and data rows */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: hasPercentileCol
                ? 'max-content minmax(5rem, auto) max-content max-content'
                : 'max-content minmax(5rem, auto) max-content',
              gap: '0.3rem 1.25rem',
              alignItems: 'baseline',
            }}
          >
            {/* Headers */}
            <span style={bioLabelStyle}>Measurement</span>
            <span style={{ ...bioLabelStyle, textAlign: 'right' }}>Value</span>
            {hasPercentileCol && <span style={bioLabelStyle}>Percentile</span>}
            <span style={bioLabelStyle}>GA</span>

            {/* Dynamic Data Rows */}
            {config.biometryTypes.map(tc => (
              <BioRow
                key={tc.type}
                config={tc}
                obs={biometryMap.get(tc.type)}
                showPercentile={hasPercentileCol}
              />
            ))}
          </div>
        </div>
      )}

      {/* 3. Doppler Section — Config-driven Sub-grid A (Vessels) and Sub-grid B (Single) */}
      {(config.dopplerVessels.length > 0 || config.dopplerSingle.length > 0) && (() => {
        // Pair vessel configs in chunks of 2: [PI, RI]
        const vesselPairs: [import('../types').ObservableTypeConfig, import('../types').ObservableTypeConfig][] = [];
        for (let i = 0; i + 1 < config.dopplerVessels.length; i += 2) {
          vesselPairs.push([config.dopplerVessels[i], config.dopplerVessels[i + 1]]);
        }

        return (
          <div>
            <div style={subSectionTitleStyle}>Doppler</div>

            {/* Sub-grid A: Dynamic Vessel Pairs (3 cols: Vessel | PI | RI) */}
            {vesselPairs.length > 0 && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'max-content 5rem 5rem',
                  gap: '0.3rem 1.25rem',
                  alignItems: 'baseline',
                  marginBottom: config.dopplerSingle.length > 0 ? '0.75rem' : 0,
                }}
              >
                <span style={bioLabelStyle}>Vessel</span>
                <span style={bioLabelStyle}>PI</span>
                <span style={bioLabelStyle}>RI</span>

                {vesselPairs.map(([piConfig, riConfig]) => {
                  const piObs = dopplerMap.get(piConfig.type);
                  const riObs = dopplerMap.get(riConfig.type);
                  const vesselLabel = piConfig.label.replace(/\s*PI$/i, '').trim();

                  return (
                    <Fragment key={piConfig.type}>
                      <span style={bioLabelStyle}>{vesselLabel}</span>
                      <span style={bioValueStyle}>
                        {piObs?.value != null && piObs.value !== '' ? String(piObs.value) : '—'}
                      </span>
                      <span style={bioValueStyle}>
                        {riObs?.value != null && riObs.value !== '' ? String(riObs.value) : '—'}
                      </span>
                    </Fragment>
                  );
                })}
              </div>
            )}

            {/* Sub-grid B: Dynamic Single Doppler Observables (2 cols: Measurement | Value) */}
            {config.dopplerSingle.length > 0 && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'max-content minmax(5rem, auto)',
                  gap: '0.3rem 1.25rem',
                  alignItems: 'baseline',
                }}
              >
                <span style={bioLabelStyle}>Measurement</span>
                <span style={bioLabelStyle}>Value</span>

                {config.dopplerSingle.map(tc => {
                  const obs = dopplerMap.get(tc.type);
                  return (
                    <Fragment key={tc.type}>
                      <span style={bioLabelStyle}>{tc.label}</span>
                      <span style={bioValueStyle}>
                        {obs?.value != null && obs.value !== '' ? String(obs.value) : '—'}
                      </span>
                    </Fragment>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* 4. Anatomy (unconditionally rendered from config) */}
      {config.anatomyTypes.length > 0 && (
        <div>
          <div style={subSectionTitleStyle}>Anatomy</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.75rem 0.5rem' }}>
            {config.anatomyTypes.map(tc => {
              const rawVal = anat[tc.key];
              const displayVal = rawVal && rawVal.trim() !== ''
                ? rawVal.charAt(0).toUpperCase() + rawVal.slice(1)
                : '—';
              return (
                <Fragment key={tc.key}>
                  {fieldBlock(tc.label, displayVal)}
                </Fragment>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Markers (driven dynamically by config.markerTypes) */}
      {config.markerTypes.length > 0 && (
        <div>
          <div style={subSectionTitleStyle}>First Trimester Markers</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.4rem 1rem' }}>
            {config.markerTypes.map(mt => {
              const val = fetus.markers?.[mt.key];
              const displayVal = mt.inputType === 'boolean'
                ? (val === 'yes' || val === 'true' ? 'Yes' : val === 'no' || val === 'false' ? 'No' : '—')
                : (val || '—');
              return (
                <Fragment key={mt.key}>
                  <span style={bioLabelStyle}>{mt.label}</span>
                  <span style={bioValueStyle}>{displayVal}</span>
                </Fragment>
              );
            })}
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
    <Tile style={{ textAlign: 'left' }}>
      <div style={tileTitleStyle}>
        Clinical Measurements {fetusCount > 1 ? `(${fetusCount} fetuses)` : ''}
      </div>

      <div style={styleFetusSectionContainer}>
        {fetuses.map((fetus, i) => (
          <div
            key={i}
            style={{
              ...styleFetusColumn,
              borderTop: fetusCount > 1
                ? (i === 0 ? '3px solid #0f62fe' : i === 1 ? '3px solid #6929c4' : '3px solid #525252')
                : undefined,
              paddingTop: fetusCount > 1 ? '0.5rem' : 0,
            }}
          >
            {fetusCount > 1 && (
              <h4 style={{ fontSize: '1rem', fontWeight: 600, color: '#161616', marginBottom: '1rem' }}>
                Fetus {i + 1}
              </h4>
            )}
            {renderFetusClinicalDetails(fetus, examType)}
          </div>
        ))}

        {fetuses.length === 0 && (
          <p style={{ color: '#525252', fontStyle: 'italic' }}>No clinical measurement data recorded.</p>
        )}
      </div>
    </Tile>
  );
}
