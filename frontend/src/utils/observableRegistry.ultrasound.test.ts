/**
 * Regression tests for Ultrasound Findings string-only contract (ST-02, ST-05).
 * Verifies buildFetusSectionFormData converts historic numeric values to strings
 * and buildSubmitPayload emits string-only ultrasoundFindings.
 */
import { describe, it, expect } from 'vitest';
import { buildFetusSectionFormData, buildSubmitPayload } from './observableRegistry';
import { EXAM_TYPE_CONFIG } from '../constants/examinationTypes';
import type { ExaminationFormData } from '../types/formData';

const prenatalConfig = EXAM_TYPE_CONFIG['prenatal'];
const examTypeConfigArg = {
  biometryTypes: prenatalConfig.biometryTypes,
  dopplerVessels: prenatalConfig.dopplerVessels,
  dopplerSingle: prenatalConfig.dopplerSingle,
};

const emptyFetusFormData = {
  biometry: {},
  doppler: {},
  ultrasoundFindings: {},
  anatomy: {},
  markers: {},
  gaFromBiometry: { value: '', isManual: false },
};

const baseFormData: ExaminationFormData = {
  patientId: 'p1',
  examinationDate: '2025-01-01',
  examinationType: 'prenatal',
  fetusCount: 1,
  last_menstrual_period: '',
  gestationalAge: { value: '', isManual: false },
  clinicalNotes: '',
  recommendations: '',
  status: 'draft',
  findings: '',
  obstetric_history: '',
  family_history: '',
  comments: '',
  fetuses: [emptyFetusFormData],
};

describe('buildFetusSectionFormData — Ultrasound Findings normalization', () => {
  it('converts a historically stored numeric heart_rate to a string', () => {
    const form = buildFetusSectionFormData(
      {
        index: 0,
        ultrasoundFindings: { heart_rate: 145 as unknown as string },
      },
      'prenatal',
      examTypeConfigArg,
    );

    expect(form.ultrasoundFindings['heart_rate']).toBe('145');
    expect(typeof form.ultrasoundFindings['heart_rate']).toBe('string');
  });

  it('preserves string heart_rate unchanged', () => {
    const form = buildFetusSectionFormData(
      {
        index: 0,
        ultrasoundFindings: { heart_rate: '145', presentation: 'cephalic' },
      },
      'prenatal',
      examTypeConfigArg,
    );

    expect(form.ultrasoundFindings['heart_rate']).toBe('145');
    expect(form.ultrasoundFindings['presentation']).toBe('cephalic');
  });

  it('returns empty object when ultrasoundFindings is absent', () => {
    const form = buildFetusSectionFormData(undefined, 'prenatal', examTypeConfigArg);
    expect(form.ultrasoundFindings).toEqual({});
  });
});

describe('buildSubmitPayload — Ultrasound Findings string emission', () => {
  it('emits string-valued ultrasoundFindings without casting', () => {
    const formData: ExaminationFormData = {
      ...baseFormData,
      fetuses: [
        {
          ...emptyFetusFormData,
          ultrasoundFindings: { heart_rate: '145', presentation: 'cephalic' },
        },
      ],
    };

    const payload = buildSubmitPayload(formData);
    const uf = payload.fetuses[0].ultrasoundFindings;
    expect(uf).toBeDefined();
    expect(uf!['heart_rate']).toBe('145');
    expect(typeof uf!['heart_rate']).toBe('string');
  });

  it('omits ultrasoundFindings when the object is empty', () => {
    const payload = buildSubmitPayload(baseFormData);
    expect(payload.fetuses[0].ultrasoundFindings).toBeUndefined();
  });
});
