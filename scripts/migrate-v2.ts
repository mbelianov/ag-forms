/**
 * migrate-v2.ts — One-time migration script (ST-09).
 *
 * Pass 1: Converts legacy flat-field biometry/doppler model to Observable fetus-array.
 *         Handles all 4 legacy exam types (ultrasound_prenatal, ultrasound_prenatal_twins,
 *         ultrasound_first_trimester, ultrasound_first_trimester_twins).
 * Pass 2: Rewrites examinationType per §12.5 mapping.
 *
 * Usage:
 *   npx ts-node scripts/migrate-v2.ts --connection-string "<connStr>" --pass all [--dry-run]
 *
 * Flags:
 *   --connection-string  Azure Storage connection string (required)
 *   --pass               1 | 2 | all  (default: all)
 *   --dry-run            Print what would change without writing
 *   --table              Examinations table name (default: Examinations)
 *
 * Idempotent: running twice on the same data produces the same result.
 */

const args = process.argv.slice(2);

function getArg(name: string): string | undefined {
  const idx = args.findIndex(a => a === `--${name}`);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

const DRY_RUN    = args.includes('--dry-run');
const PASS       = getArg('pass') ?? 'all';
const TABLE_NAME = getArg('table') ?? 'Examinations';
const CONN_STR   = getArg('connection-string');

if (!CONN_STR) {
  console.error('ERROR: --connection-string is required');
  process.exit(1);
}

// ─── Type definitions (mirrors api/src/types/index.ts) ──────────────────────

interface Observable {
  type: string;
  value: number | string;
  isManual?: boolean;
  percentile?: { value: number; isManual?: boolean };
  ga?: { value: string; isManual?: boolean };
}

interface FetusSectionData {
  index: number;
  gaFromBiometry?: { value: string; isManual?: boolean };
  biometry?: Observable[];
  doppler?: Observable[];
  ultrasoundFindings?: Record<string, string | number>;
  anatomy?: Record<string, string>;
  markers?: Record<string, string>;
}

// ─── Exam type mapping (§12.5) ────────────────────────────────────────────────

const EXAM_TYPE_MAP: Record<string, string> = {
  'ultrasound_prenatal':                'prenatal',
  'ultrasound_prenatal_twins':          'prenatal',
  'ultrasound_first_trimester':         'first_trimester',
  'ultrasound_first_trimester_twins':   'first_trimester',
  // Already-migrated values (idempotent)
  'prenatal':                           'prenatal',
  'first_trimester':                    'first_trimester',
};

// ─── Legacy biometry field map ─────────────────────────────────────────────────

type LegacyBiometry = {
  bpd?: number; hc?: number; ac?: number; fl?: number; efw?: number;
  ofd?: number; vp?: string; tcd?: number; cm?: number; nuchalFold?: number;
  nb?: number; apad?: number; tad?: number; la?: string; lc?: number;
  bpdPercentile?: number; bpdPercentileIsManual?: boolean;
  hcPercentile?: number;  hcPercentileIsManual?: boolean;
  acPercentile?: number;  acPercentileIsManual?: boolean;
  flPercentile?: number;  flPercentileIsManual?: boolean;
  efwPercentile?: number; efwPercentileIsManual?: boolean;
  ofdPercentile?: number; ofdPercentileIsManual?: boolean;
  tcdPercentile?: number; tcdPercentileIsManual?: boolean;
  bpdGa?: string;  bpdGaIsManual?: boolean;
  hcGa?: string;   hcGaIsManual?: boolean;
  acGa?: string;   acGaIsManual?: boolean;
  flGa?: string;   flGaIsManual?: boolean;
  efwGa?: string;  efwGaIsManual?: boolean;
  ofdGa?: string;  ofdGaIsManual?: boolean;
  tcdGa?: string;  tcdGaIsManual?: boolean;
  gestationalAgeFromBiometry?: string;
  gestationalAgeFromBiometryIsManual?: boolean;
  efwIsManual?: boolean;
};

type LegacyDoppler = {
  pi?: number; ri?: number;
  utADexPI?: number; utADexRI?: number; utASinPI?: number; utASinRI?: number;
  cma?: number; psv?: number; cpr?: number; ducVen?: string;
};

type LegacyFtBiometry = {
  crl?: number; nt?: number; nb?: number; puls?: number;
  gaFromCrl?: string; gaFromBio?: string;
  gaFromCrlIsManual?: boolean; gaFromBioIsManual?: boolean;
};

type LegacyFtMarkers = Record<string, string>;
type LegacyFtDoppler = { utADexPI?: number; utADexRI?: number; utASinPI?: number; utASinRI?: number };
type LegacyFtUltrasound = { placenta?: string; heartRate?: number; umbilicalCord?: string };
type LegacyFtAnatomy = Record<string, string>;
type LegacyAnatomy = Record<string, string>;
type LegacyUltrasoundFindings = Record<string, string | number>;

// ─── Pass 1 helpers ───────────────────────────────────────────────────────────

function prenatalBiometryToObservables(b: LegacyBiometry): Observable[] {
  const obs: Observable[] = [];
  const add = (type: string, value: number | string | undefined, extras?: Partial<Observable>) => {
    if (value === undefined || value === null || value === '') return;
    obs.push({ type, value, ...extras });
  };

  if (b.bpd != null) {
    const o: Observable = { type: 'bpd', value: b.bpd };
    if (b.bpdPercentile != null) o.percentile = { value: b.bpdPercentile, ...(b.bpdPercentileIsManual ? { isManual: true } : {}) };
    if (b.bpdGa) o.ga = { value: b.bpdGa, ...(b.bpdGaIsManual ? { isManual: true } : {}) };
    obs.push(o);
  }
  if (b.ofd != null) {
    const o: Observable = { type: 'ofd', value: b.ofd };
    if (b.ofdPercentile != null) o.percentile = { value: b.ofdPercentile, ...(b.ofdPercentileIsManual ? { isManual: true } : {}) };
    if (b.ofdGa) o.ga = { value: b.ofdGa, ...(b.ofdGaIsManual ? { isManual: true } : {}) };
    obs.push(o);
  }
  if (b.hc != null) {
    const o: Observable = { type: 'hc', value: b.hc };
    if (b.hcPercentile != null) o.percentile = { value: b.hcPercentile, ...(b.hcPercentileIsManual ? { isManual: true } : {}) };
    if (b.hcGa) o.ga = { value: b.hcGa, ...(b.hcGaIsManual ? { isManual: true } : {}) };
    obs.push(o);
  }
  if (b.tad != null) add('tad', b.tad);
  if (b.apad != null) add('apad', b.apad);
  if (b.ac != null) {
    const o: Observable = { type: 'ac', value: b.ac };
    if (b.acPercentile != null) o.percentile = { value: b.acPercentile, ...(b.acPercentileIsManual ? { isManual: true } : {}) };
    if (b.acGa) o.ga = { value: b.acGa, ...(b.acGaIsManual ? { isManual: true } : {}) };
    obs.push(o);
  }
  if (b.fl != null) {
    const o: Observable = { type: 'fl', value: b.fl };
    if (b.flPercentile != null) o.percentile = { value: b.flPercentile, ...(b.flPercentileIsManual ? { isManual: true } : {}) };
    if (b.flGa) o.ga = { value: b.flGa, ...(b.flGaIsManual ? { isManual: true } : {}) };
    obs.push(o);
  }
  if (b.efw != null) {
    const o: Observable = { type: 'efw', value: b.efw };
    if (b.efwIsManual) o.isManual = true;
    if (b.efwPercentile != null) o.percentile = { value: b.efwPercentile, ...(b.efwPercentileIsManual ? { isManual: true } : {}) };
    if (b.efwGa) o.ga = { value: b.efwGa, ...(b.efwGa ? {} : {}) };
    obs.push(o);
  }
  if (b.tcd != null) {
    const o: Observable = { type: 'tcd', value: b.tcd };
    if (b.tcdPercentile != null) o.percentile = { value: b.tcdPercentile, ...(b.tcdPercentileIsManual ? { isManual: true } : {}) };
    if (b.tcdGa) o.ga = { value: b.tcdGa, ...(b.tcdGaIsManual ? { isManual: true } : {}) };
    obs.push(o);
  }
  add('vp', b.vp);
  add('cm', b.cm);
  if (b.nuchalFold != null) add('nuchalFold', b.nuchalFold);
  add('nb', b.nb);
  add('la', b.la);
  add('lc', b.lc);

  return obs;
}

function prenatalDopplerToObservables(d: LegacyDoppler): Observable[] {
  const obs: Observable[] = [];
  const add = (type: string, value: number | string | undefined) => {
    if (value === undefined || value === null || value === '') return;
    obs.push({ type, value });
  };
  add('pi', d.pi); add('ri', d.ri);
  add('utADexPI', d.utADexPI); add('utADexRI', d.utADexRI);
  add('utASinPI', d.utASinPI); add('utASinRI', d.utASinRI);
  add('cma', d.cma); add('psv', d.psv); add('cpr', d.cpr);
  add('ducVen', d.ducVen);
  return obs;
}

function ftBiometryToObservables(b: LegacyFtBiometry): Observable[] {
  const obs: Observable[] = [];
  if (b.crl != null) obs.push({ type: 'crl', value: b.crl });
  if (b.nt  != null) obs.push({ type: 'nt',  value: b.nt  });
  if (b.nb  != null) obs.push({ type: 'nb',  value: b.nb  });
  if (b.puls != null) obs.push({ type: 'puls', value: b.puls });
  return obs;
}

function ftDopplerToObservables(d: LegacyFtDoppler): Observable[] {
  const obs: Observable[] = [];
  const add = (type: string, value: number | undefined) => {
    if (value != null) obs.push({ type, value });
  };
  add('utADexPI', d.utADexPI); add('utADexRI', d.utADexRI);
  add('utASinPI', d.utASinPI); add('utASinRI', d.utASinRI);
  return obs;
}

/**
 * Migrate a single examination entity from flat-field model to fetus-array model.
 * Returns the updated entity object. Does not mutate the input.
 * Idempotent: if data.fetuses already exists, returns entity unchanged.
 */
export function migratePrenatalEntity(entity: Record<string, unknown>): Record<string, unknown> {
  // Parse the stored data blob (may be a JSON string or already an object)
  let data: Record<string, unknown> = {};
  if (typeof entity['data'] === 'string') {
    try { data = JSON.parse(entity['data'] as string); } catch { data = {}; }
  } else if (entity['data'] && typeof entity['data'] === 'object') {
    data = entity['data'] as Record<string, unknown>;
  }

  // Idempotency check: if fetuses array already present, skip
  if (Array.isArray(data['fetuses'])) {
    return entity;
  }

  const examinationType = String(entity['examinationType'] ?? '');
  const isTwins = examinationType.includes('twins');
  const isFt = examinationType.includes('first_trimester');

  const fetuses: FetusSectionData[] = [];

  if (!isFt) {
    // ── Prenatal: fetus 0 from biometry/doppler top-level fields ─────────────
    const b = (entity['biometry'] ?? {}) as LegacyBiometry;
    const d = (entity['doppler'] ?? {}) as LegacyDoppler;
    const uf = (data['ultrasound_findings'] ?? {}) as LegacyUltrasoundFindings;
    const an = (data['anatomy'] ?? {}) as LegacyAnatomy;
    const gaFromBioStr = String(entity['gestationalAgeFromBiometry'] ?? '');
    const gaFromBioManual = Boolean(b.gestationalAgeFromBiometryIsManual);

    const fetus0: FetusSectionData = { index: 0 };
    fetus0.biometry = prenatalBiometryToObservables(b);
    fetus0.doppler  = prenatalDopplerToObservables(d);
    if (Object.keys(uf).length > 0) fetus0.ultrasoundFindings = uf;
    if (Object.keys(an).length > 0) fetus0.anatomy = an;
    if (gaFromBioStr) fetus0.gaFromBiometry = { value: gaFromBioStr, ...(gaFromBioManual ? { isManual: true } : {}) };
    fetuses.push(fetus0);

    if (isTwins) {
      // ── Prenatal twins: fetus 1 from biometry2/doppler2 ────────────────────
      const b2 = (entity['biometry2'] ?? {}) as LegacyBiometry;
      const d2 = (entity['doppler2'] ?? {}) as LegacyDoppler;
      const uf2 = (data['twin2_ultrasound_findings'] ?? {}) as LegacyUltrasoundFindings;
      const an2 = (data['twin2_anatomy'] ?? {}) as LegacyAnatomy;
      const gaFromBio2Str = String(entity['gestationalAgeFromBiometry2'] ?? '');
      const gaFromBio2Manual = Boolean(b2.gestationalAgeFromBiometryIsManual);

      const fetus1: FetusSectionData = { index: 1 };
      fetus1.biometry = prenatalBiometryToObservables(b2);
      fetus1.doppler  = prenatalDopplerToObservables(d2);
      if (Object.keys(uf2).length > 0) fetus1.ultrasoundFindings = uf2;
      if (Object.keys(an2).length > 0) fetus1.anatomy = an2;
      if (gaFromBio2Str) fetus1.gaFromBiometry = { value: gaFromBio2Str, ...(gaFromBio2Manual ? { isManual: true } : {}) };
      fetuses.push(fetus1);
    }
  } else {
    // ── First Trimester: fetus 0 from ft_biometry/ft_markers/ft_doppler ─────
    const ftB = (data['ft_biometry'] ?? {}) as LegacyFtBiometry;
    const ftM = (data['ft_markers'] ?? {}) as LegacyFtMarkers;
    const ftD = (data['ft_doppler'] ?? {}) as LegacyFtDoppler;
    const ftU = (data['ft_ultrasound'] ?? {}) as LegacyFtUltrasound;
    const ftA = (data['ft_anatomy'] ?? {}) as LegacyFtAnatomy;

    const gaFromBioStr = ftB.gaFromBio || ftB.gaFromCrl || '';
    const gaFromBioManual = Boolean(ftB.gaFromBioIsManual || ftB.gaFromCrlIsManual);

    const fetus0: FetusSectionData = { index: 0 };
    fetus0.biometry = ftBiometryToObservables(ftB);
    fetus0.doppler  = ftDopplerToObservables(ftD);
    if (Object.keys(ftM).length > 0) fetus0.markers = ftM;
    if (ftU.placenta || ftU.heartRate != null || ftU.umbilicalCord) {
      fetus0.ultrasoundFindings = {
        ...(ftU.placenta ? { placenta: ftU.placenta } : {}),
        ...(ftU.heartRate != null ? { heart_rate: ftU.heartRate } : {}),
        ...(ftU.umbilicalCord ? { umbilical_cord: ftU.umbilicalCord } : {}),
      };
    }
    if (Object.keys(ftA).length > 0) fetus0.anatomy = ftA;
    if (gaFromBioStr) fetus0.gaFromBiometry = { value: gaFromBioStr, ...(gaFromBioManual ? { isManual: true } : {}) };
    fetuses.push(fetus0);

    if (isTwins) {
      const ftB2 = (data['twin2_ft_biometry'] ?? {}) as LegacyFtBiometry;
      const ftM2 = (data['twin2_ft_markers'] ?? {}) as LegacyFtMarkers;
      const ftD2 = (data['twin2_ft_doppler'] ?? {}) as LegacyFtDoppler;
      const ftU2 = (data['twin2_ft_ultrasound'] ?? {}) as LegacyFtUltrasound;
      const ftA2 = (data['twin2_ft_anatomy'] ?? {}) as LegacyFtAnatomy;

      const gaFromBio2Str = ftB2.gaFromBio || ftB2.gaFromCrl || '';
      const gaFromBio2Manual = Boolean(ftB2.gaFromBioIsManual || ftB2.gaFromCrlIsManual);

      const fetus1: FetusSectionData = { index: 1 };
      fetus1.biometry = ftBiometryToObservables(ftB2);
      fetus1.doppler  = ftDopplerToObservables(ftD2);
      if (Object.keys(ftM2).length > 0) fetus1.markers = ftM2;
      if (ftU2.placenta || ftU2.heartRate != null || ftU2.umbilicalCord) {
        fetus1.ultrasoundFindings = {
          ...(ftU2.placenta ? { placenta: ftU2.placenta } : {}),
          ...(ftU2.heartRate != null ? { heart_rate: ftU2.heartRate } : {}),
          ...(ftU2.umbilicalCord ? { umbilical_cord: ftU2.umbilicalCord } : {}),
        };
      }
      if (Object.keys(ftA2).length > 0) fetus1.anatomy = ftA2;
      if (gaFromBio2Str) fetus1.gaFromBiometry = { value: gaFromBio2Str, ...(gaFromBio2Manual ? { isManual: true } : {}) };
      fetuses.push(fetus1);
    }
  }

  // Build the new data blob
  const pregnancyData = {
    ...(data['pregnancy_data'] ? {
      lastMenstrualPeriod: (data['pregnancy_data'] as Record<string, unknown>)['last_menstrual_period'],
      obstetricHistory:    (data['pregnancy_data'] as Record<string, unknown>)['obstetric_history'],
      familyHistory:       (data['pregnancy_data'] as Record<string, unknown>)['family_history'],
    } : {}),
  };

  const newData: Record<string, unknown> = {
    ...(Object.keys(pregnancyData).length > 0 ? { pregnancyData } : {}),
    ...(data['comments'] ? { comments: data['comments'] } : {}),
    fetuses,
  };

  // Build the updated entity — remove legacy top-level fields
  const updated: Record<string, unknown> = { ...entity };
  updated['data'] = newData;
  delete updated['biometry'];
  delete updated['doppler'];
  delete updated['biometry2'];
  delete updated['doppler2'];
  delete updated['gestationalAgeFromBiometry'];
  delete updated['gestationalAgeFromBiometry2'];

  return updated;
}

/**
 * Rewrite examinationType per §12.5 mapping.
 * Idempotent: already-migrated values ('prenatal', 'first_trimester') pass through unchanged.
 */
export function migrateExamType(entity: Record<string, unknown>): Record<string, unknown> {
  const oldType = String(entity['examinationType'] ?? '');
  const newType = EXAM_TYPE_MAP[oldType];
  if (!newType || newType === oldType) return entity;
  return { ...entity, examinationType: newType };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Lazy import to avoid compile errors when module not available
  const { TableClient, AzureNamedKeyCredential } = await import('@azure/data-tables');

  const tableClient = TableClient.fromConnectionString(CONN_STR!, TABLE_NAME);

  // Fetch all entities in EXAM and PATIENT_* partitions
  let pass1Count = 0;
  let pass2Count = 0;
  let unchanged = 0;

  const entities = tableClient.listEntities<Record<string, unknown>>();

  console.log(`[migrate-v2] Starting migration. Pass=${PASS} DryRun=${DRY_RUN} Table=${TABLE_NAME}`);

  for await (const entity of entities) {
    const pk = String(entity.partitionKey ?? '');
    // Only process exam rows
    if (!pk.startsWith('EXAM') && !pk.startsWith('PATIENT_')) continue;

    let updated = entity as unknown as Record<string, unknown>;
    let changed = false;

    if (PASS === '1' || PASS === 'all') {
      const migrated = migratePrenatalEntity(updated);
      if (JSON.stringify(migrated) !== JSON.stringify(updated)) {
        updated = migrated;
        changed = true;
        pass1Count++;
        console.log(`[pass1] ${pk}/${updated.rowKey}`);
      }
    }

    if (PASS === '2' || PASS === 'all') {
      const migrated = migrateExamType(updated);
      if (JSON.stringify(migrated) !== JSON.stringify(updated)) {
        updated = migrated;
        changed = true;
        pass2Count++;
        console.log(`[pass2] ${pk}/${updated.rowKey} → ${updated.examinationType}`);
      }
    }

    if (!changed) {
      unchanged++;
      continue;
    }

    if (!DRY_RUN) {
      await tableClient.upsertEntity(updated as Parameters<typeof tableClient.upsertEntity>[0], 'Merge');
    }
  }

  console.log(`[migrate-v2] Done. Pass1 updates: ${pass1Count}, Pass2 updates: ${pass2Count}, Unchanged: ${unchanged}${DRY_RUN ? ' [DRY RUN — no writes]' : ''}`);
}

// Only execute when run directly (not imported for unit tests)
if (require.main === module) {
  main().catch(err => { console.error(err); process.exit(1); });
}
