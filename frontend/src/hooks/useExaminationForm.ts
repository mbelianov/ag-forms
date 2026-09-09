/**
 * useExaminationForm — custom hook for the examination create/edit form (ST-05 rewrite).
 *
 * Replaces the ~250 flat `t2_` / `ft_` formData keys with:
 *   - `fetuses: FetusSectionFormData[]` (one entry per fetus)
 *   - `fetusCount: number` (runtime state — create form only; read-only on edit)
 *   - `handleFetusChange(index, section, type, field, value)` for observable inputs
 *   - `handleFetusCountChange(newCount)` to resize the fetuses array on create
 *   - `computeObservableDerivedFields` replaces useBiometryAutoCalc / useFirstTrimesterAutoCalc
 *
 * Entity-level fields (examDate, status, LMP, gestationalAge, etc.) use the
 * existing `handleChange(field, value)` signature unchanged.
 */
import { useState, useEffect, useCallback } from 'react';
import type {
  Examination,
  CreateExaminationRequest,
  UpdateExaminationRequest,
  Patient,
} from '../types';
import { calcGAFromLMP, calcEDD, calculateAgeAtDate } from '../utils/calculations';
import { EXAM_TYPE_CONFIG } from '../constants/examinationTypes';
import {
  validatePositiveFloat,
  validateNonNegativeFloat,
  validateIntegerField,
  GA_REGEX,
} from '../utils/validators';
import {
  buildFetusSectionFormData,
  buildSubmitPayload,
  computeObservableDerivedFields,
  computeGaFromBiometry,
} from '../utils/observableRegistry';
import type {
  ExaminationFormData,
  FetusSectionFormData,
  ObservableFormFieldState,
  AutoCalcValue,
} from '../types/formData';
import { autoCalc } from '../types/formData';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ExaminationFormProps {
  examination?: Examination;
  patients: Patient[];
  preselectedPatientId?: string;
  onSubmit: (data: CreateExaminationRequest | UpdateExaminationRequest) => Promise<void>;
  onCancel: () => void;
  isEdit?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toISODate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function examDateToYMD(examDate: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(examDate)) return examDate;
  return toISODate(new Date(examDate));
}

function resolveExamType(raw: string | undefined): 'prenatal' | 'first_trimester' {
  if (raw === 'first_trimester') return 'first_trimester';
  return 'prenatal';
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useExaminationForm({
  examination,
  patients,
  preselectedPatientId,
  onSubmit,
  isEdit = false,
}: ExaminationFormProps) {

  // ── Determine initial values ────────────────────────────────────────────────
  const initExamType = resolveExamType(examination?.examinationType);
  const initFetusCount = examination?.data?.fetuses?.length ?? 1;
  const initConfig = EXAM_TYPE_CONFIG[initExamType];

  const buildInitialFetuses = (
    examType: 'prenatal' | 'first_trimester',
    count: number,
  ): FetusSectionFormData[] => {
    const config = EXAM_TYPE_CONFIG[examType];
    return Array.from({ length: count }, (_, i) =>
      buildFetusSectionFormData(
        examination?.data?.fetuses?.[i],
        examType,
        config,
      )
    );
  };

  // ── Form state ──────────────────────────────────────────────────────────────
  const [formData, setFormData] = useState<ExaminationFormData>({
    patientId: examination?.patientId || preselectedPatientId || '',
    examinationDate: examination?.examDate ? examDateToYMD(examination.examDate) : toISODate(new Date()),
    examinationType: initExamType,
    fetusCount: initFetusCount,
    last_menstrual_period: examination?.data?.pregnancyData?.lastMenstrualPeriod || '',
    gestationalAge: autoCalc(
      examination?.gestationalAge || '',
      examination?.gestationalAgeIsManual,
    ),
    clinicalNotes: examination?.notes || '',
    recommendations: '',
    status: (examination?.status || 'draft') as 'draft' | 'completed' | 'reviewed',
    findings: examination?.findings || '',
    obstetric_history: examination?.data?.pregnancyData?.obstetricHistory || '',
    family_history: examination?.data?.pregnancyData?.familyHistory || '',
    comments: examination?.data?.comments || '',
    fetuses: buildInitialFetuses(initExamType, initFetusCount),
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── Edit-load effect ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (examination) {
      const examType = resolveExamType(examination.examinationType);
      const fetusCount = examination.data?.fetuses?.length ?? 1;
      const config = EXAM_TYPE_CONFIG[examType];
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData({
        patientId: examination.patientId,
        examinationDate: examDateToYMD(examination.examDate),
        examinationType: examType,
        fetusCount,
        last_menstrual_period: examination.data?.pregnancyData?.lastMenstrualPeriod || '',
        gestationalAge: autoCalc(
          examination.gestationalAge || '',
          examination.gestationalAgeIsManual,
        ),
        clinicalNotes: examination.notes || '',
        recommendations: '',
        status: examination.status,
        findings: examination.findings || '',
        obstetric_history: examination.data?.pregnancyData?.obstetricHistory || '',
        family_history: examination.data?.pregnancyData?.familyHistory || '',
        comments: examination.data?.comments || '',
        fetuses: Array.from({ length: fetusCount }, (_, i) =>
          buildFetusSectionFormData(
            examination.data?.fetuses?.[i],
            examType,
            config,
          )
        ),
      });
    }
  }, [examination]);

  // ── Reactive GA from LMP ─────────────────────────────────────────────────────
  useEffect(() => {
    if (formData.gestationalAge.isManual) return;
    if (!formData.last_menstrual_period || !formData.examinationDate) return;
    const result = calcGAFromLMP(formData.last_menstrual_period, formData.examinationDate) ?? '';
    if (result !== formData.gestationalAge.value) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData(prev => ({
        ...prev,
        gestationalAge: autoCalc(result, false),
      }));
    }
  }, [formData.last_menstrual_period, formData.examinationDate, formData.gestationalAge.isManual, formData.gestationalAge.value]);

  // ── Reactive biometry auto-calc (per fetus) ──────────────────────────────────
  useEffect(() => {
    const clinicalGa = formData.gestationalAge.value;
    let anyUpdate = false;
    const newFetuses = formData.fetuses.map((fetus) => {
      const biometryUpdates = computeObservableDerivedFields(fetus.biometry, clinicalGa);
      const hasUpdates = Object.keys(biometryUpdates).length > 0;

      // Also compute gaFromBiometry if not manual
      const newGaBio = (!fetus.gaFromBiometry.isManual)
        ? computeGaFromBiometry({ ...fetus.biometry, ...biometryUpdates }, formData.examinationType)
        : null;

      const gaChanged = newGaBio !== null && newGaBio !== fetus.gaFromBiometry.value;

      if (!hasUpdates && !gaChanged) return fetus;

      anyUpdate = true;
      return {
        ...fetus,
        biometry: hasUpdates ? { ...fetus.biometry, ...biometryUpdates } : fetus.biometry,
        gaFromBiometry: gaChanged ? autoCalc(newGaBio as string, false) : fetus.gaFromBiometry,
      };
    });

    if (anyUpdate) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData(prev => ({ ...prev, fetuses: newFetuses }));
    }
  // Deliberately depend only on the serialized biometry + GA-from-LMP to avoid loops
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    formData.gestationalAge.value,
    // Serialize biometry values to detect changes without deep equality
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(formData.fetuses.map(f =>
      Object.fromEntries(Object.entries(f.biometry).map(([k, v]) => [k, v.value.value]))
    )),
  ]);

  // ── Derived values ──────────────────────────────────────────────────────────
  const examConfig = EXAM_TYPE_CONFIG[formData.examinationType] ?? initConfig;
  const edd = calcEDD(formData.last_menstrual_period);
  const selectedPatient = patients.find(p => p.patientId === formData.patientId);
  const patientAge = calculateAgeAtDate(selectedPatient?.birthDate ?? '', formData.examinationDate);

  // ── Entity-level handleChange ────────────────────────────────────────────────
  const handleChange = useCallback((field: string, value: string) => {
    setFormData(prev => {
      if (field === 'gestationalAge') {
        return { ...prev, gestationalAge: autoCalc(value, value !== '') };
      }
      // When exam type changes on create form, rebuild fetuses with new config
      if (field === 'examinationType' && !isEdit) {
        const newType = (value === 'first_trimester' ? 'first_trimester' : 'prenatal') as 'prenatal' | 'first_trimester';
        const newConfig = EXAM_TYPE_CONFIG[newType];
        const count = prev.fetusCount;
        const newFetuses: FetusSectionFormData[] = Array.from({ length: count }, () =>
          buildFetusSectionFormData(undefined, newType, newConfig)
        );
        return { ...prev, examinationType: newType, fetuses: newFetuses };
      }
      return { ...prev, [field]: value };
    });
    setErrors(prev => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, [isEdit]);

  // ── Per-fetus observable handleFetusChange ───────────────────────────────────
  const handleFetusChange = useCallback((
    index: number,
    section: 'biometry' | 'doppler',
    type: string,
    field: keyof ObservableFormFieldState,
    next: AutoCalcValue<string>,
  ) => {
    setFormData(prev => {
      const newFetuses = [...prev.fetuses];
      const fetus = { ...newFetuses[index] };
      const sectionMap = { ...fetus[section] };
      const existing = sectionMap[type] ?? { value: autoCalc('') };
      sectionMap[type] = { ...existing, [field]: next };

      // REQ-9 (§4.2): when the raw measurement value changes, reset sibling derived
      // field isManual flags so the reactive auto-calc effect overwrites them.
      if (section === 'biometry' && field === 'value' && type !== 'efw') {
        const current = sectionMap[type];
        const isDeleted = next.value.trim() === '';
        sectionMap[type] = {
          ...current,
          ...(current?.percentile ? { percentile: isDeleted ? autoCalc('', false) : { ...current.percentile, isManual: false } } : {}),
          ...(current?.ga         ? { ga:         isDeleted ? autoCalc('', false) : { ...current.ga,         isManual: false } } : {}),
        };

        // REQ-9 for EFW: BPD/HC/AC/FL are EFW source measurements.
        // Reset efw.value.isManual so the Hadlock formula can recompute it.
        if (['bpd', 'hc', 'ac', 'fl'].includes(type)) {
          const efwEntry = sectionMap['efw'];
          if (efwEntry) {
            sectionMap['efw'] = {
              ...efwEntry,
              value:      isDeleted ? autoCalc('', false) : { ...efwEntry.value,     isManual: false },
              percentile: isDeleted ? autoCalc('', false) : { ...efwEntry.percentile, isManual: false },
              ga:         isDeleted ? autoCalc('', false) : { ...efwEntry.ga,         isManual: false },
            };
          }
        }

        // REQ-9 for gaFromBiometry: source measurement changed, let composite GA recompute.
        // gaFromBiometry sources: BPD/HC/AC/FL (prenatal) or CRL (first trimester).
        if (['bpd', 'hc', 'ac', 'fl', 'crl'].includes(type)) {
          fetus.gaFromBiometry = isDeleted
            ? autoCalc('', false)
            : { ...fetus.gaFromBiometry, isManual: false };
        }        
      }

      fetus[section] = sectionMap;

      // EFW cascade: if user manually enters EFW value, force percentile & GA isManual = true
      // (Rule 1 from §14.5 — suppressed in the auto-calc guard on the next render)
      if (section === 'biometry' && type === 'efw' && field === 'value' && next.isManual) {
        const efwField = sectionMap['efw'];
        sectionMap['efw'] = {
          ...efwField,
          value: { ...next, isManual: true },
          percentile: efwField.percentile
            ? { ...efwField.percentile, isManual: true }
            : autoCalc('', true),
          ga: efwField.ga
            ? { ...efwField.ga, isManual: true }
            : autoCalc('', true),
        };
      }

      newFetuses[index] = fetus;
      return { ...prev, fetuses: newFetuses };
    });
  }, []);

  // ── Per-fetus descriptor (anatomy/ultrasoundFindings/markers/gaFromBiometry) ──
  const handleFetusDescriptorChange = useCallback((
    index: number,
    section: 'ultrasoundFindings' | 'anatomy' | 'markers' | 'gaFromBiometry',
    field: string,
    value: string,
  ) => {
    setFormData(prev => {
      const newFetuses = [...prev.fetuses];
      const fetus = { ...newFetuses[index] };
      if (section === 'gaFromBiometry') {
        fetus.gaFromBiometry = autoCalc(value, value !== '');
      } else {
        const sectionData = { ...(fetus[section] as Record<string, string>) };
        sectionData[field] = value;
        (fetus as Record<string, unknown>)[section] = sectionData;
      }
      newFetuses[index] = fetus;
      return { ...prev, fetuses: newFetuses };
    });
  }, []);

  // ── handleFetusCountChange (create form only) ────────────────────────────────
  const handleFetusCountChange = useCallback((newCount: number) => {
    if (isEdit) return; // locked on edit
    const count = Math.max(1, Math.min(newCount, 10)); // sensible bounds
    setFormData(prev => {
      const config = EXAM_TYPE_CONFIG[prev.examinationType];
      let newFetuses: FetusSectionFormData[];
      if (count > prev.fetuses.length) {
        // Append empty fetus sections
        newFetuses = [
          ...prev.fetuses,
          ...Array.from({ length: count - prev.fetuses.length }, () =>
            buildFetusSectionFormData(undefined, prev.examinationType, config)
          ),
        ];
      } else {
        // Slice — silently discard trailing sections (Option A confirmed in §12.4)
        newFetuses = prev.fetuses.slice(0, count);
      }
      return { ...prev, fetusCount: count, fetuses: newFetuses };
    });
  }, [isEdit]);

  // ── Validation ───────────────────────────────────────────────────────────────
  const validateGA = (raw: string): string | undefined =>
    raw && !GA_REGEX.test(raw) ? 'Format must be "28w 3d" or "28с 3д"' : undefined;

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!isEdit && !formData.patientId) newErrors.patientId = 'Patient is required';

    if (!formData.examinationDate) {
      newErrors.examinationDate = 'Examination date is required';
    } else {
      const [yyyy, mm, dd] = formData.examinationDate.split('-').map(Number);
      const examDate = new Date(yyyy, mm - 1, dd);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (examDate > today) newErrors.examinationDate = 'Examination date cannot be in the future';
    }

    if (formData.last_menstrual_period) {
      const [ly, lm, ld] = formData.last_menstrual_period.split('-').map(Number);
      const lmpDate = new Date(ly, lm - 1, ld);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (lmpDate > today) newErrors.last_menstrual_period = 'LMP cannot be in the future';
    }

    if (formData.gestationalAge.value && !GA_REGEX.test(formData.gestationalAge.value))
      newErrors.gestationalAge = 'Format must be "28w 3d" or "28с 3д"';

    // Per-fetus observable validation
    const config = examConfig;
    formData.fetuses.forEach((fetus, fi) => {
      const prefix = `f${fi}`;

      // Biometry numeric validations
      for (const tc of config.biometryTypes) {
        const val = fetus.biometry[tc.type]?.value?.value ?? '';
        if (!val) continue;
        const isFreeText = tc.type === 'vp' || tc.type === 'la' || tc.type === 'ducVen';
        if (isFreeText) continue;
        const isPuls = tc.type === 'puls';
        const err = isPuls
          ? validateIntegerField(val, tc.label)
          : validatePositiveFloat(val, tc.label);
        if (err) newErrors[`${prefix}_bio_${tc.type}`] = err;
        // GA field validation
        const gaVal = fetus.biometry[tc.type]?.ga?.value ?? '';
        if (gaVal) {
          const gaErr = validateGA(gaVal);
          if (gaErr) newErrors[`${prefix}_bio_${tc.type}_ga`] = gaErr;
        }
      }

      // Doppler numeric validations
      for (const tc of [...config.dopplerVessels, ...config.dopplerSingle]) {
        const val = fetus.doppler[tc.type]?.value?.value ?? '';
        if (!val) continue;
        const err = validateNonNegativeFloat(val, tc.label);
        if (err) newErrors[`${prefix}_dop_${tc.type}`] = err;
      }

      // gaFromBiometry format
      const gbVal = fetus.gaFromBiometry.value;
      if (gbVal) {
        const err = validateGA(gbVal);
        if (err) newErrors[`${prefix}_gaFromBio`] = err;
      }

    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!validateForm()) return;
    setIsSubmitting(true);

    try {
      const data = buildSubmitPayload(formData);

      const basePayload = {
        examDate: formData.examinationDate,
        gestationalAge: formData.gestationalAge.value || undefined,
        gestationalAgeIsManual: formData.gestationalAge.isManual,
        status: formData.status,
        examinationType: formData.examinationType,
        notes: formData.clinicalNotes || undefined,
        findings: formData.findings || undefined,
        patientAgeAtExam: patientAge ?? undefined,
        data,
      };

      if (isEdit && examination?.etag) {
        await onSubmit({ ...basePayload, etag: examination.etag } as UpdateExaminationRequest);
      } else {
        await onSubmit({ ...basePayload, patientId: formData.patientId } as CreateExaminationRequest);
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearSubmitError = useCallback(() => setSubmitError(null), []);

  return {
    formData,
    setFormData,
    errors,
    isSubmitting,
    submitError,
    clearSubmitError,
    edd,
    examConfig,
    selectedPatient,
    patientAge,
    handleChange,
    handleFetusChange,
    handleFetusDescriptorChange,
    handleFetusCountChange,
    handleSubmit,
  };
}
