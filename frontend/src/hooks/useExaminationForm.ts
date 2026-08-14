/**
 * useExaminationForm — custom hook extracted from ExaminationForm.tsx (Sub-Task 0a).
 * Contains all non-JSX logic: state, useEffect edit-load, derived values,
 * calc handlers, validation, submit, and handleChange helpers.
 * The component file ExaminationForm.tsx becomes a thin JSX shell that calls this hook.
 */
import { useState, useEffect, useRef } from 'react';
import type {
  Examination,
  CreateExaminationRequest,
  UpdateExaminationRequest,
  Patient,
  ExaminationData,
} from '../types';
import { calcGAFromLMP, calcEDD, calculateAgeAtDate } from '../utils/calculations';
import { getSectionVisibility, isFirstTrimester, isFtTwins } from '../constants/examinationTypes';
import {
  validatePositiveFloat,
  validateNonNegativeFloat,
  validateIntegerField,
  GA_REGEX,
} from '../utils/validators';
import { computeBiometryDerivedFields } from './useBiometryAutoCalc';
import { computeFirstTrimesterDerivedFields } from './useFirstTrimesterAutoCalc';

// ── Validation rule interfaces ────────────────────────────────────────────────

interface ValidationRule {
  errorKey: string;           // key written into newErrors — always prefixed, e.g. 't1_bpd'
  formKey: string;            // key read from formData — bare for T1, prefixed for T2/FT
  validate: (raw: string) => string | undefined;
  onlyWhen?: () => boolean;   // runtime guard — closes over isTwins / isFt / isFtTwinsMode
}

// ── Field registry interfaces ─────────────────────────────────────────────────

interface FieldDef {
  formKey: string;           // key in formData
  payloadPath: string;       // dot-path into the output object, e.g. 'biometry.bpd'
  outType: 'float' | 'integer' | 'string' | 'trim';
  onlyWhen?: () => boolean;  // runtime guard — same pattern as ValidationRule
}

export interface ExaminationFormProps {
  examination?: Examination;
  patients: Patient[];
  preselectedPatientId?: string;
  onSubmit: (data: CreateExaminationRequest | UpdateExaminationRequest) => Promise<void>;
  onCancel: () => void;
  isEdit?: boolean;
}

// Helper: format a Date object picked by the DatePicker into YYYY-MM-DD
function toISODate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Helper: extract YYYY-MM-DD from an Examination's examDate string
function examDateToYMD(examDate: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(examDate)) return examDate;
  const d = new Date(examDate);
  return toISODate(d);
}

export function useExaminationForm({
  examination,
  patients,
  preselectedPatientId,
  onSubmit,
  isEdit = false,
}: ExaminationFormProps) {
  const [formData, setFormData] = useState({
    // Core fields
    patientId: examination?.patientId || preselectedPatientId || '',
    examDate: examination?.examDate ? examDateToYMD(examination.examDate) : toISODate(new Date()),
    status: (examination?.status || 'draft') as 'draft' | 'completed' | 'reviewed',
    examinationType: examination?.examinationType || 'ultrasound_prenatal',
    // biometry floats, mm
    bpd: examination?.biometry?.bpd != null ? examination.biometry.bpd.toFixed(2) : '',
    hc: examination?.biometry?.hc != null ? examination.biometry.hc.toFixed(2) : '',
    ac: examination?.biometry?.ac != null ? examination.biometry.ac.toFixed(2) : '',
    fl: examination?.biometry?.fl != null ? examination.biometry.fl.toFixed(2) : '',
    efw: examination?.biometry?.efw != null ? examination.biometry.efw.toFixed(2) : '',
    ofd: examination?.biometry?.ofd != null ? examination.biometry.ofd.toFixed(2) : '',
    vp: examination?.biometry?.vp ?? '',
    tcd: examination?.biometry?.tcd != null ? examination.biometry.tcd.toFixed(2) : '',
    cm: examination?.biometry?.cm != null ? examination.biometry.cm.toFixed(2) : '',
    nuchalFold: examination?.biometry?.nuchalFold != null ? examination.biometry.nuchalFold.toFixed(2) : '',
    nb: examination?.biometry?.nb != null ? examination.biometry.nb.toFixed(2) : '',
    apad: examination?.biometry?.apad != null ? examination.biometry.apad.toFixed(2) : '',
    tad: examination?.biometry?.tad != null ? examination.biometry.tad.toFixed(2) : '',
    la: examination?.biometry?.la ?? '',
    lc: examination?.biometry?.lc != null ? examination.biometry.lc.toFixed(2) : '',
    // GA fields (both stored separately)
    gestationalAge: examination?.gestationalAge || '',                         // GA from LMP
    gestationalAgeIsManual: examination?.gestationalAgeIsManual ?? false,
    gestationalAgeFromBiometry: examination?.gestationalAgeFromBiometry || '', // GA from Biometry
    efwIsManual: examination?.biometry?.efwIsManual ?? false,
    gestationalAgeFromBiometryIsManual: examination?.biometry?.gestationalAgeFromBiometryIsManual ?? false,
    // Sub-Task 3: Per-measurement GA fields (T1) — string "Xw Yd", empty until calculated
    bpdGa:  examination?.biometry?.bpdGa  || '',
    ofdGa:  examination?.biometry?.ofdGa  || '',
    hcGa:   examination?.biometry?.hcGa   || '',
    tadGa:  examination?.biometry?.tadGa  || '',
    apadGa: examination?.biometry?.apadGa || '',
    acGa:   examination?.biometry?.acGa   || '',
    flGa:   examination?.biometry?.flGa   || '',
    efwGa:  examination?.biometry?.efwGa  || '',
    // KI-009: Persisted percentile fields (T1) — stored as strings in formData for input binding
    bpdPercentile:  examination?.biometry?.bpdPercentile  != null ? examination.biometry.bpdPercentile.toString() : '',
    hcPercentile:   examination?.biometry?.hcPercentile   != null ? examination.biometry.hcPercentile.toString() : '',
    acPercentile:   examination?.biometry?.acPercentile   != null ? examination.biometry.acPercentile.toString() : '',
    flPercentile:   examination?.biometry?.flPercentile   != null ? examination.biometry.flPercentile.toString() : '',
    ofdPercentile:  examination?.biometry?.ofdPercentile  != null ? examination.biometry.ofdPercentile.toString() : '',
    tadPercentile:  examination?.biometry?.tadPercentile  != null ? examination.biometry.tadPercentile.toString() : '',
    apadPercentile: examination?.biometry?.apadPercentile != null ? examination.biometry.apadPercentile.toString() : '',
    efwPercentile:  examination?.biometry?.efwPercentile  != null ? examination.biometry.efwPercentile.toString() : '',
    // KI-009: IsManual flags (T1)
    bpdPercentileIsManual:  examination?.biometry?.bpdPercentileIsManual  ?? false,
    hcPercentileIsManual:   examination?.biometry?.hcPercentileIsManual   ?? false,
    acPercentileIsManual:   examination?.biometry?.acPercentileIsManual   ?? false,
    flPercentileIsManual:   examination?.biometry?.flPercentileIsManual   ?? false,
    ofdPercentileIsManual:  examination?.biometry?.ofdPercentileIsManual  ?? false,
    tadPercentileIsManual:  examination?.biometry?.tadPercentileIsManual  ?? false,
    apadPercentileIsManual: examination?.biometry?.apadPercentileIsManual ?? false,
    efwPercentileIsManual:  examination?.biometry?.efwPercentileIsManual  ?? false,
    bpdGaIsManual:  examination?.biometry?.bpdGaIsManual  ?? false,
    hcGaIsManual:   examination?.biometry?.hcGaIsManual   ?? false,
    acGaIsManual:   examination?.biometry?.acGaIsManual   ?? false,
    flGaIsManual:   examination?.biometry?.flGaIsManual   ?? false,
    ofdGaIsManual:  examination?.biometry?.ofdGaIsManual  ?? false,
    tadGaIsManual:  examination?.biometry?.tadGaIsManual  ?? false,
    apadGaIsManual: examination?.biometry?.apadGaIsManual ?? false,
    efwGaIsManual:  examination?.biometry?.efwGaIsManual  ?? false,
    // KI-009: FT gaFromBio
    t1_ft_gaFromBio: examination?.data?.ft_biometry?.gaFromBio || '',
    t1_ft_gaFromCrlIsManual: examination?.data?.ft_biometry?.gaFromCrlIsManual ?? false,
    t2_ft_gaFromBio: examination?.data?.twin2_ft_biometry?.gaFromBio || '',
    t2_ft_gaFromCrlIsManual: examination?.data?.twin2_ft_biometry?.gaFromCrlIsManual ?? false,
    // Doppler (floats allowed)
    pi: examination?.doppler?.pi?.toString() || '',
    ri: examination?.doppler?.ri?.toString() || '',
    utADexPI: examination?.doppler?.utADexPI?.toString() || '',
    utADexRI: examination?.doppler?.utADexRI?.toString() || '',
    utASinPI: examination?.doppler?.utASinPI?.toString() || '',
    utASinRI: examination?.doppler?.utASinRI?.toString() || '',
    cma: examination?.doppler?.cma?.toString() || '',
    psv: examination?.doppler?.psv?.toString() || '',
    cpr: examination?.doppler?.cpr?.toString() || '',
    ducVen: examination?.doppler?.ducVen || '',
    notes: examination?.notes || '',
    findings: examination?.findings || '',
    // Pregnancy data
    last_menstrual_period: examination?.data?.pregnancy_data?.last_menstrual_period || '',
    obstetric_history: examination?.data?.pregnancy_data?.obstetric_history || '',
    family_history: examination?.data?.pregnancy_data?.family_history || '',
    // Ultrasound findings
    presentation: examination?.data?.ultrasound_findings?.presentation || '',
    gender: examination?.data?.ultrasound_findings?.gender || '',
    heart_rate: examination?.data?.ultrasound_findings?.heart_rate?.toString() || '',
    fetal_movement: examination?.data?.ultrasound_findings?.fetal_movement || '',
    placenta: examination?.data?.ultrasound_findings?.placenta || '',
    umbilical_cord: examination?.data?.ultrasound_findings?.umbilical_cord || '',
    // Anatomy
    anat_head: examination?.data?.anatomy?.head || '',
    anat_brain: examination?.data?.anatomy?.brain || '',
    anat_heart: examination?.data?.anatomy?.heart || '',
    anat_abdomen: examination?.data?.anatomy?.abdomen || '',
    anat_kidneys: examination?.data?.anatomy?.kidneys || '',
    anat_limbs: examination?.data?.anatomy?.limbs || '',
    anat_skeleton: examination?.data?.anatomy?.skeleton || '',
    anat_face: examination?.data?.anatomy?.face || '',
    anat_neckSkin: examination?.data?.anatomy?.neckSkin || '',
    anat_spine: examination?.data?.anatomy?.spine || '',
    anat_thorax: examination?.data?.anatomy?.thorax || '',
    // Top-level data comment
    comments: examination?.data?.comments || '',
    // uzd-twins: Twin 2 biometry fields
    t2_bpd: examination?.biometry2?.bpd != null ? examination.biometry2.bpd.toFixed(2) : '',
    t2_hc: examination?.biometry2?.hc != null ? examination.biometry2.hc.toFixed(2) : '',
    t2_ac: examination?.biometry2?.ac != null ? examination.biometry2.ac.toFixed(2) : '',
    t2_fl: examination?.biometry2?.fl != null ? examination.biometry2.fl.toFixed(2) : '',
    t2_efw: examination?.biometry2?.efw != null ? examination.biometry2.efw.toFixed(2) : '',
    t2_ofd: examination?.biometry2?.ofd != null ? examination.biometry2.ofd.toFixed(2) : '',
    t2_vp: examination?.biometry2?.vp ?? '',
    t2_tcd: examination?.biometry2?.tcd != null ? examination.biometry2.tcd.toFixed(2) : '',
    t2_cm: examination?.biometry2?.cm != null ? examination.biometry2.cm.toFixed(2) : '',
    t2_nuchalFold: examination?.biometry2?.nuchalFold != null ? examination.biometry2.nuchalFold.toFixed(2) : '',
    t2_nb: examination?.biometry2?.nb != null ? examination.biometry2.nb.toFixed(2) : '',
    t2_apad: examination?.biometry2?.apad != null ? examination.biometry2.apad.toFixed(2) : '',
    t2_tad: examination?.biometry2?.tad != null ? examination.biometry2.tad.toFixed(2) : '',
    t2_la: examination?.biometry2?.la ?? '',
    t2_lc: examination?.biometry2?.lc != null ? examination.biometry2.lc.toFixed(2) : '',
    t2_gestationalAgeFromBiometry: examination?.gestationalAgeFromBiometry2 || '',
    t2_efwIsManual: examination?.biometry2?.efwIsManual ?? false,
    t2_gestationalAgeFromBiometryIsManual: examination?.biometry2?.gestationalAgeFromBiometryIsManual ?? false,
    // Sub-Task 3: Twin 2 per-measurement GA fields
    t2_bpdGa:  examination?.biometry2?.bpdGa  || '',
    t2_ofdGa:  examination?.biometry2?.ofdGa  || '',
    t2_hcGa:   examination?.biometry2?.hcGa   || '',
    t2_tadGa:  examination?.biometry2?.tadGa  || '',
    t2_apadGa: examination?.biometry2?.apadGa || '',
    t2_acGa:   examination?.biometry2?.acGa   || '',
    t2_flGa:   examination?.biometry2?.flGa   || '',
    t2_efwGa:  examination?.biometry2?.efwGa  || '',
    // KI-009: Twin 2 persisted percentile fields
    t2_bpdPercentile:  examination?.biometry2?.bpdPercentile  != null ? examination.biometry2.bpdPercentile.toString() : '',
    t2_hcPercentile:   examination?.biometry2?.hcPercentile   != null ? examination.biometry2.hcPercentile.toString() : '',
    t2_acPercentile:   examination?.biometry2?.acPercentile   != null ? examination.biometry2.acPercentile.toString() : '',
    t2_flPercentile:   examination?.biometry2?.flPercentile   != null ? examination.biometry2.flPercentile.toString() : '',
    t2_ofdPercentile:  examination?.biometry2?.ofdPercentile  != null ? examination.biometry2.ofdPercentile.toString() : '',
    t2_tadPercentile:  examination?.biometry2?.tadPercentile  != null ? examination.biometry2.tadPercentile.toString() : '',
    t2_apadPercentile: examination?.biometry2?.apadPercentile != null ? examination.biometry2.apadPercentile.toString() : '',
    t2_efwPercentile:  examination?.biometry2?.efwPercentile  != null ? examination.biometry2.efwPercentile.toString() : '',
    // KI-009: Twin 2 IsManual flags
    t2_bpdPercentileIsManual:  examination?.biometry2?.bpdPercentileIsManual  ?? false,
    t2_hcPercentileIsManual:   examination?.biometry2?.hcPercentileIsManual   ?? false,
    t2_acPercentileIsManual:   examination?.biometry2?.acPercentileIsManual   ?? false,
    t2_flPercentileIsManual:   examination?.biometry2?.flPercentileIsManual   ?? false,
    t2_ofdPercentileIsManual:  examination?.biometry2?.ofdPercentileIsManual  ?? false,
    t2_tadPercentileIsManual:  examination?.biometry2?.tadPercentileIsManual  ?? false,
    t2_apadPercentileIsManual: examination?.biometry2?.apadPercentileIsManual ?? false,
    t2_efwPercentileIsManual:  examination?.biometry2?.efwPercentileIsManual  ?? false,
    t2_bpdGaIsManual:  examination?.biometry2?.bpdGaIsManual  ?? false,
    t2_hcGaIsManual:   examination?.biometry2?.hcGaIsManual   ?? false,
    t2_acGaIsManual:   examination?.biometry2?.acGaIsManual   ?? false,
    t2_flGaIsManual:   examination?.biometry2?.flGaIsManual   ?? false,
    t2_ofdGaIsManual:  examination?.biometry2?.ofdGaIsManual  ?? false,
    t2_tadGaIsManual:  examination?.biometry2?.tadGaIsManual  ?? false,
    t2_apadGaIsManual: examination?.biometry2?.apadGaIsManual ?? false,
    t2_efwGaIsManual:  examination?.biometry2?.efwGaIsManual  ?? false,
    // uzd-twins: Twin 2 doppler fields
    t2_pi: examination?.doppler2?.pi?.toString() || '',
    t2_ri: examination?.doppler2?.ri?.toString() || '',
    t2_ducVen: examination?.doppler2?.ducVen || '',
    t2_utADexPI: examination?.doppler2?.utADexPI?.toString() || '',
    t2_utADexRI: examination?.doppler2?.utADexRI?.toString() || '',
    t2_utASinPI: examination?.doppler2?.utASinPI?.toString() || '',
    t2_utASinRI: examination?.doppler2?.utASinRI?.toString() || '',
    t2_cma: examination?.doppler2?.cma?.toString() || '',
    t2_psv: examination?.doppler2?.psv?.toString() || '',
    t2_cpr: examination?.doppler2?.cpr?.toString() || '',
    // uzd-twins: Twin 2 ultrasound findings
    t2_presentation: examination?.data?.twin2_ultrasound_findings?.presentation || '',
    t2_gender: examination?.data?.twin2_ultrasound_findings?.gender || '',
    t2_heart_rate: examination?.data?.twin2_ultrasound_findings?.heart_rate?.toString() || '',
    t2_fetal_movement: examination?.data?.twin2_ultrasound_findings?.fetal_movement || '',
    t2_placenta: examination?.data?.twin2_ultrasound_findings?.placenta || '',
    t2_umbilical_cord: examination?.data?.twin2_ultrasound_findings?.umbilical_cord || '',
    // uzd-twins: Twin 2 anatomy
    t2_anat_head: examination?.data?.twin2_anatomy?.head || '',
    t2_anat_brain: examination?.data?.twin2_anatomy?.brain || '',
    t2_anat_heart: examination?.data?.twin2_anatomy?.heart || '',
    t2_anat_abdomen: examination?.data?.twin2_anatomy?.abdomen || '',
    t2_anat_kidneys: examination?.data?.twin2_anatomy?.kidneys || '',
    t2_anat_limbs: examination?.data?.twin2_anatomy?.limbs || '',
    t2_anat_skeleton: examination?.data?.twin2_anatomy?.skeleton || '',
    t2_anat_face: examination?.data?.twin2_anatomy?.face || '',
    t2_anat_neckSkin: examination?.data?.twin2_anatomy?.neckSkin || '',
    t2_anat_spine: examination?.data?.twin2_anatomy?.spine || '',
    t2_anat_thorax: examination?.data?.twin2_anatomy?.thorax || '',
    // UZPT — FT fields (T1)
    t1_ft_placenta: examination?.data?.ft_ultrasound?.placenta || '',
    t1_ft_heartRate: examination?.data?.ft_ultrasound?.heartRate?.toString() || '',
    t1_ft_umbilicalCord: examination?.data?.ft_ultrasound?.umbilicalCord || '',
    t1_ft_crl: examination?.data?.ft_biometry?.crl?.toString() || '',
    t1_ft_gaFromCrl: examination?.data?.ft_biometry?.gaFromCrl || '',
    t1_ft_nt: examination?.data?.ft_biometry?.nt?.toString() || '',
    t1_ft_nb: examination?.data?.ft_biometry?.nb?.toString() || '',
    t1_ft_puls: examination?.data?.ft_biometry?.puls?.toString() || '',
    t1_ft_arrhythmia: examination?.data?.ft_markers?.arrhythmia || '',
    t1_ft_tricuspidRegurgitation: examination?.data?.ft_markers?.tricuspidRegurgitation || '',
    t1_ft_abnormalDvFlow: examination?.data?.ft_markers?.abnormalDvFlow || '',
    t1_ft_echogenicCardiacFocus: examination?.data?.ft_markers?.echogenicCardiacFocus || '',
    t1_ft_singleUmbilicalArtery: examination?.data?.ft_markers?.singleUmbilicalArtery || '',
    t1_ft_choroidPlexusCysts: examination?.data?.ft_markers?.choroidPlexusCysts || '',
    t1_ft_exomphalos: examination?.data?.ft_markers?.exomphalos || '',
    t1_ft_megacystis: examination?.data?.ft_markers?.megacystis || '',
    t1_ft_markerPlacenta: examination?.data?.ft_markers?.placenta || '',
    t1_ft_cordInsertion: examination?.data?.ft_markers?.cordInsertion || '',
    t1_anat_head: examination?.data?.ft_anatomy?.head || '',
    t1_anat_brain: examination?.data?.ft_anatomy?.brain || '',
    t1_anat_heart: examination?.data?.ft_anatomy?.heart || '',
    t1_anat_abdomen: examination?.data?.ft_anatomy?.abdomen || '',
    t1_anat_kidneys: examination?.data?.ft_anatomy?.kidneys || '',
    t1_anat_limbs: examination?.data?.ft_anatomy?.limbs || '',
    t1_anat_skeleton: examination?.data?.ft_anatomy?.skeleton || '',
    t1_anat_face: examination?.data?.ft_anatomy?.face || '',
    t1_anat_neckSkin: examination?.data?.ft_anatomy?.neckSkin || '',
    t1_anat_spine: examination?.data?.ft_anatomy?.spine || '',
    t1_anat_thorax: examination?.data?.ft_anatomy?.thorax || '',
    t1_ft_utADexPI: examination?.data?.ft_doppler?.utADexPI?.toString() || '',
    t1_ft_utADexRI: examination?.data?.ft_doppler?.utADexRI?.toString() || '',
    t1_ft_utASinPI: examination?.data?.ft_doppler?.utASinPI?.toString() || '',
    t1_ft_utASinRI: examination?.data?.ft_doppler?.utASinRI?.toString() || '',
    // UZPT — FT fields (T2, used when isFtTwins)
    t2_ft_placenta: examination?.data?.twin2_ft_ultrasound?.placenta || '',
    t2_ft_heartRate: examination?.data?.twin2_ft_ultrasound?.heartRate?.toString() || '',
    t2_ft_umbilicalCord: examination?.data?.twin2_ft_ultrasound?.umbilicalCord || '',
    t2_ft_crl: examination?.data?.twin2_ft_biometry?.crl?.toString() || '',
    t2_ft_gaFromCrl: examination?.data?.twin2_ft_biometry?.gaFromCrl || '',
    t2_ft_nt: examination?.data?.twin2_ft_biometry?.nt?.toString() || '',
    t2_ft_nb: examination?.data?.twin2_ft_biometry?.nb?.toString() || '',
    t2_ft_puls: examination?.data?.twin2_ft_biometry?.puls?.toString() || '',
    t2_ft_arrhythmia: examination?.data?.twin2_ft_markers?.arrhythmia || '',
    t2_ft_tricuspidRegurgitation: examination?.data?.twin2_ft_markers?.tricuspidRegurgitation || '',
    t2_ft_abnormalDvFlow: examination?.data?.twin2_ft_markers?.abnormalDvFlow || '',
    t2_ft_echogenicCardiacFocus: examination?.data?.twin2_ft_markers?.echogenicCardiacFocus || '',
    t2_ft_singleUmbilicalArtery: examination?.data?.twin2_ft_markers?.singleUmbilicalArtery || '',
    t2_ft_choroidPlexusCysts: examination?.data?.twin2_ft_markers?.choroidPlexusCysts || '',
    t2_ft_exomphalos: examination?.data?.twin2_ft_markers?.exomphalos || '',
    t2_ft_megacystis: examination?.data?.twin2_ft_markers?.megacystis || '',
    t2_ft_markerPlacenta: examination?.data?.twin2_ft_markers?.placenta || '',
    t2_ft_cordInsertion: examination?.data?.twin2_ft_markers?.cordInsertion || '',
    // Note: t2_anat_* keys are shared with prenatal T2 anatomy (mutually exclusive exam types)
    t2_ft_utADexPI: examination?.data?.twin2_ft_doppler?.utADexPI?.toString() || '',
    t2_ft_utADexRI: examination?.data?.twin2_ft_doppler?.utADexRI?.toString() || '',
    t2_ft_utASinPI: examination?.data?.twin2_ft_doppler?.utASinPI?.toString() || '',
    t2_ft_utASinRI: examination?.data?.twin2_ft_doppler?.utASinRI?.toString() || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // B-3/B-4: Track previous CRL values so the FT auto-calc effects can distinguish
  // "form loaded with existing CRL" (mount, do not overwrite manual gaFromCrl) from
  // "CRL changed by user" (must recalculate per REQ-9).
  // Seeded from the initial formData value so edit-load does not falsely trigger a
  // CRL-change overwrite on first render.
  const prevT1CrlRef = useRef<string>(formData.t1_ft_crl);
  const prevT2CrlRef = useRef<string>(formData.t2_ft_crl);

  useEffect(() => {
    if (examination) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData({
        patientId: examination.patientId,
        examDate: examDateToYMD(examination.examDate),
        status: examination.status,
        examinationType: examination.examinationType || 'ultrasound_prenatal',
        bpd: examination.biometry?.bpd != null ? examination.biometry.bpd.toFixed(2) : '',
        hc: examination.biometry?.hc != null ? examination.biometry.hc.toFixed(2) : '',
        ac: examination.biometry?.ac != null ? examination.biometry.ac.toFixed(2) : '',
        fl: examination.biometry?.fl != null ? examination.biometry.fl.toFixed(2) : '',
        efw: examination.biometry?.efw != null ? examination.biometry.efw.toFixed(2) : '',
        ofd: examination.biometry?.ofd != null ? examination.biometry.ofd.toFixed(2) : '',
        vp: examination.biometry?.vp?.toString() || '',
        tcd: examination.biometry?.tcd != null ? examination.biometry.tcd.toFixed(2) : '',
        cm: examination.biometry?.cm != null ? examination.biometry.cm.toFixed(2) : '',
        nuchalFold: examination.biometry?.nuchalFold != null ? examination.biometry.nuchalFold.toFixed(2) : '',
        nb: examination.biometry?.nb != null ? examination.biometry.nb.toFixed(2) : '',
        apad: examination.biometry?.apad != null ? examination.biometry.apad.toFixed(2) : '',
        tad: examination.biometry?.tad != null ? examination.biometry.tad.toFixed(2) : '',
        la: examination.biometry?.la?.toString() || '',
        lc: examination.biometry?.lc != null ? examination.biometry.lc.toFixed(2) : '',
        gestationalAge: examination.gestationalAge || '',
        gestationalAgeIsManual: examination.gestationalAgeIsManual ?? false,
        gestationalAgeFromBiometry: examination.gestationalAgeFromBiometry || '',
        efwIsManual: examination.biometry?.efwIsManual ?? false,
        gestationalAgeFromBiometryIsManual: examination.biometry?.gestationalAgeFromBiometryIsManual ?? false,
        // Sub-Task 3: Per-measurement GA fields (T1)
        bpdGa:  examination.biometry?.bpdGa  || '',
        ofdGa:  examination.biometry?.ofdGa  || '',
        hcGa:   examination.biometry?.hcGa   || '',
        tadGa:  examination.biometry?.tadGa  || '',
        apadGa: examination.biometry?.apadGa || '',
        acGa:   examination.biometry?.acGa   || '',
        flGa:   examination.biometry?.flGa   || '',
        efwGa:  examination.biometry?.efwGa  || '',
        // KI-009: Persisted percentile fields (T1)
        bpdPercentile:  examination.biometry?.bpdPercentile  != null ? examination.biometry.bpdPercentile.toString() : '',
        hcPercentile:   examination.biometry?.hcPercentile   != null ? examination.biometry.hcPercentile.toString() : '',
        acPercentile:   examination.biometry?.acPercentile   != null ? examination.biometry.acPercentile.toString() : '',
        flPercentile:   examination.biometry?.flPercentile   != null ? examination.biometry.flPercentile.toString() : '',
        ofdPercentile:  examination.biometry?.ofdPercentile  != null ? examination.biometry.ofdPercentile.toString() : '',
        tadPercentile:  examination.biometry?.tadPercentile  != null ? examination.biometry.tadPercentile.toString() : '',
        apadPercentile: examination.biometry?.apadPercentile != null ? examination.biometry.apadPercentile.toString() : '',
        efwPercentile:  examination.biometry?.efwPercentile  != null ? examination.biometry.efwPercentile.toString() : '',
        // KI-009: IsManual flags (T1)
        bpdPercentileIsManual:  examination.biometry?.bpdPercentileIsManual  ?? false,
        hcPercentileIsManual:   examination.biometry?.hcPercentileIsManual   ?? false,
        acPercentileIsManual:   examination.biometry?.acPercentileIsManual   ?? false,
        flPercentileIsManual:   examination.biometry?.flPercentileIsManual   ?? false,
        ofdPercentileIsManual:  examination.biometry?.ofdPercentileIsManual  ?? false,
        tadPercentileIsManual:  examination.biometry?.tadPercentileIsManual  ?? false,
        apadPercentileIsManual: examination.biometry?.apadPercentileIsManual ?? false,
        efwPercentileIsManual:  examination.biometry?.efwPercentileIsManual  ?? false,
        bpdGaIsManual:  examination.biometry?.bpdGaIsManual  ?? false,
        hcGaIsManual:   examination.biometry?.hcGaIsManual   ?? false,
        acGaIsManual:   examination.biometry?.acGaIsManual   ?? false,
        flGaIsManual:   examination.biometry?.flGaIsManual   ?? false,
        ofdGaIsManual:  examination.biometry?.ofdGaIsManual  ?? false,
        tadGaIsManual:  examination.biometry?.tadGaIsManual  ?? false,
        apadGaIsManual: examination.biometry?.apadGaIsManual ?? false,
        efwGaIsManual:  examination.biometry?.efwGaIsManual  ?? false,
        // KI-009: FT gaFromBio
        t1_ft_gaFromBio: examination.data?.ft_biometry?.gaFromBio || '',
        t1_ft_gaFromCrlIsManual: examination.data?.ft_biometry?.gaFromCrlIsManual ?? false,
        t2_ft_gaFromBio: examination.data?.twin2_ft_biometry?.gaFromBio || '',
        t2_ft_gaFromCrlIsManual: examination.data?.twin2_ft_biometry?.gaFromCrlIsManual ?? false,
        pi: examination.doppler?.pi?.toString() || '',
        ri: examination.doppler?.ri?.toString() || '',
        utADexPI: examination.doppler?.utADexPI?.toString() || '',
        utADexRI: examination.doppler?.utADexRI?.toString() || '',
        utASinPI: examination.doppler?.utASinPI?.toString() || '',
        utASinRI: examination.doppler?.utASinRI?.toString() || '',
        cma: examination.doppler?.cma?.toString() || '',
        psv: examination.doppler?.psv?.toString() || '',
        cpr: examination.doppler?.cpr?.toString() || '',
        ducVen: examination.doppler?.ducVen || '',
        notes: examination.notes || '',
        findings: examination.findings || '',
        last_menstrual_period: examination.data?.pregnancy_data?.last_menstrual_period || '',
        obstetric_history: examination.data?.pregnancy_data?.obstetric_history || '',
        family_history: examination.data?.pregnancy_data?.family_history || '',
        presentation: examination.data?.ultrasound_findings?.presentation || '',
        gender: examination.data?.ultrasound_findings?.gender || '',
        heart_rate: examination.data?.ultrasound_findings?.heart_rate?.toString() || '',
        fetal_movement: examination.data?.ultrasound_findings?.fetal_movement || '',
        placenta: examination.data?.ultrasound_findings?.placenta || '',
        umbilical_cord: examination.data?.ultrasound_findings?.umbilical_cord || '',
        anat_head: examination.data?.anatomy?.head || '',
        anat_brain: examination.data?.anatomy?.brain || '',
        anat_heart: examination.data?.anatomy?.heart || '',
        anat_abdomen: examination.data?.anatomy?.abdomen || '',
        anat_kidneys: examination.data?.anatomy?.kidneys || '',
        anat_limbs: examination.data?.anatomy?.limbs || '',
        anat_skeleton: examination.data?.anatomy?.skeleton || '',
        anat_face: examination.data?.anatomy?.face || '',
        anat_neckSkin: examination.data?.anatomy?.neckSkin || '',
        anat_spine: examination.data?.anatomy?.spine || '',
        anat_thorax: examination.data?.anatomy?.thorax || '',
        comments: examination.data?.comments || '',
        // uzd-twins: Twin 2 biometry
        t2_bpd: examination.biometry2?.bpd != null ? examination.biometry2.bpd.toFixed(2) : '',
        t2_hc: examination.biometry2?.hc != null ? examination.biometry2.hc.toFixed(2) : '',
        t2_ac: examination.biometry2?.ac != null ? examination.biometry2.ac.toFixed(2) : '',
        t2_fl: examination.biometry2?.fl != null ? examination.biometry2.fl.toFixed(2) : '',
        t2_efw: examination.biometry2?.efw != null ? examination.biometry2.efw.toFixed(2) : '',
        t2_ofd: examination.biometry2?.ofd != null ? examination.biometry2.ofd.toFixed(2) : '',
        t2_vp: examination.biometry2?.vp?.toString() || '',
        t2_tcd: examination.biometry2?.tcd != null ? examination.biometry2.tcd.toFixed(2) : '',
        t2_cm: examination.biometry2?.cm != null ? examination.biometry2.cm.toFixed(2) : '',
        t2_nuchalFold: examination.biometry2?.nuchalFold != null ? examination.biometry2.nuchalFold.toFixed(2) : '',
        t2_nb: examination.biometry2?.nb != null ? examination.biometry2.nb.toFixed(2) : '',
        t2_apad: examination.biometry2?.apad != null ? examination.biometry2.apad.toFixed(2) : '',
        t2_tad: examination.biometry2?.tad != null ? examination.biometry2.tad.toFixed(2) : '',
        t2_la: examination.biometry2?.la?.toString() || '',
        t2_lc: examination.biometry2?.lc != null ? examination.biometry2.lc.toFixed(2) : '',
        t2_gestationalAgeFromBiometry: examination.gestationalAgeFromBiometry2 || '',
        t2_efwIsManual: examination.biometry2?.efwIsManual ?? false,
        t2_gestationalAgeFromBiometryIsManual: examination.biometry2?.gestationalAgeFromBiometryIsManual ?? false,
        // Sub-Task 3: Twin 2 per-measurement GA fields
        t2_bpdGa:  examination.biometry2?.bpdGa  || '',
        t2_ofdGa:  examination.biometry2?.ofdGa  || '',
        t2_hcGa:   examination.biometry2?.hcGa   || '',
        t2_tadGa:  examination.biometry2?.tadGa  || '',
        t2_apadGa: examination.biometry2?.apadGa || '',
        t2_acGa:   examination.biometry2?.acGa   || '',
        t2_flGa:   examination.biometry2?.flGa   || '',
        t2_efwGa:  examination.biometry2?.efwGa  || '',
        // KI-009: Twin 2 persisted percentile fields
        t2_bpdPercentile:  examination.biometry2?.bpdPercentile  != null ? examination.biometry2.bpdPercentile.toString() : '',
        t2_hcPercentile:   examination.biometry2?.hcPercentile   != null ? examination.biometry2.hcPercentile.toString() : '',
        t2_acPercentile:   examination.biometry2?.acPercentile   != null ? examination.biometry2.acPercentile.toString() : '',
        t2_flPercentile:   examination.biometry2?.flPercentile   != null ? examination.biometry2.flPercentile.toString() : '',
        t2_ofdPercentile:  examination.biometry2?.ofdPercentile  != null ? examination.biometry2.ofdPercentile.toString() : '',
        t2_tadPercentile:  examination.biometry2?.tadPercentile  != null ? examination.biometry2.tadPercentile.toString() : '',
        t2_apadPercentile: examination.biometry2?.apadPercentile != null ? examination.biometry2.apadPercentile.toString() : '',
        t2_efwPercentile:  examination.biometry2?.efwPercentile  != null ? examination.biometry2.efwPercentile.toString() : '',
        // KI-009: Twin 2 IsManual flags
        t2_bpdPercentileIsManual:  examination.biometry2?.bpdPercentileIsManual  ?? false,
        t2_hcPercentileIsManual:   examination.biometry2?.hcPercentileIsManual   ?? false,
        t2_acPercentileIsManual:   examination.biometry2?.acPercentileIsManual   ?? false,
        t2_flPercentileIsManual:   examination.biometry2?.flPercentileIsManual   ?? false,
        t2_ofdPercentileIsManual:  examination.biometry2?.ofdPercentileIsManual  ?? false,
        t2_tadPercentileIsManual:  examination.biometry2?.tadPercentileIsManual  ?? false,
        t2_apadPercentileIsManual: examination.biometry2?.apadPercentileIsManual ?? false,
        t2_efwPercentileIsManual:  examination.biometry2?.efwPercentileIsManual  ?? false,
        t2_bpdGaIsManual:  examination.biometry2?.bpdGaIsManual  ?? false,
        t2_hcGaIsManual:   examination.biometry2?.hcGaIsManual   ?? false,
        t2_acGaIsManual:   examination.biometry2?.acGaIsManual   ?? false,
        t2_flGaIsManual:   examination.biometry2?.flGaIsManual   ?? false,
        t2_ofdGaIsManual:  examination.biometry2?.ofdGaIsManual  ?? false,
        t2_tadGaIsManual:  examination.biometry2?.tadGaIsManual  ?? false,
        t2_apadGaIsManual: examination.biometry2?.apadGaIsManual ?? false,
        t2_efwGaIsManual:  examination.biometry2?.efwGaIsManual  ?? false,
        // uzd-twins: Twin 2 doppler
        t2_pi: examination.doppler2?.pi?.toString() || '',
        t2_ri: examination.doppler2?.ri?.toString() || '',
        t2_ducVen: examination.doppler2?.ducVen || '',
        t2_utADexPI: examination.doppler2?.utADexPI?.toString() || '',
        t2_utADexRI: examination.doppler2?.utADexRI?.toString() || '',
        t2_utASinPI: examination.doppler2?.utASinPI?.toString() || '',
        t2_utASinRI: examination.doppler2?.utASinRI?.toString() || '',
        t2_cma: examination.doppler2?.cma?.toString() || '',
        t2_psv: examination.doppler2?.psv?.toString() || '',
        t2_cpr: examination.doppler2?.cpr?.toString() || '',
        // uzd-twins: Twin 2 ultrasound findings
        t2_presentation: examination.data?.twin2_ultrasound_findings?.presentation || '',
        t2_gender: examination.data?.twin2_ultrasound_findings?.gender || '',
        t2_heart_rate: examination.data?.twin2_ultrasound_findings?.heart_rate?.toString() || '',
        t2_fetal_movement: examination.data?.twin2_ultrasound_findings?.fetal_movement || '',
        t2_placenta: examination.data?.twin2_ultrasound_findings?.placenta || '',
        t2_umbilical_cord: examination.data?.twin2_ultrasound_findings?.umbilical_cord || '',
        // uzd-twins: Twin 2 anatomy
        t2_anat_head: examination.data?.twin2_anatomy?.head || '',
        t2_anat_brain: examination.data?.twin2_anatomy?.brain || '',
        t2_anat_heart: examination.data?.twin2_anatomy?.heart || '',
        t2_anat_abdomen: examination.data?.twin2_anatomy?.abdomen || '',
        t2_anat_kidneys: examination.data?.twin2_anatomy?.kidneys || '',
        t2_anat_limbs: examination.data?.twin2_anatomy?.limbs || '',
        t2_anat_skeleton: examination.data?.twin2_anatomy?.skeleton || '',
        t2_anat_face: examination.data?.twin2_anatomy?.face || '',
        t2_anat_neckSkin: examination.data?.twin2_anatomy?.neckSkin || '',
        t2_anat_spine: examination.data?.twin2_anatomy?.spine || '',
        t2_anat_thorax: examination.data?.twin2_anatomy?.thorax || '',
        // UZPT — FT fields (T1)
        t1_ft_placenta: examination.data?.ft_ultrasound?.placenta || '',
        t1_ft_heartRate: examination.data?.ft_ultrasound?.heartRate?.toString() || '',
        t1_ft_umbilicalCord: examination.data?.ft_ultrasound?.umbilicalCord || '',
        t1_ft_crl: examination.data?.ft_biometry?.crl?.toString() || '',
        t1_ft_gaFromCrl: examination.data?.ft_biometry?.gaFromCrl || '',
        t1_ft_nt: examination.data?.ft_biometry?.nt?.toString() || '',
        t1_ft_nb: examination.data?.ft_biometry?.nb?.toString() || '',
        t1_ft_puls: examination.data?.ft_biometry?.puls?.toString() || '',
        t1_ft_arrhythmia: examination.data?.ft_markers?.arrhythmia || '',
        t1_ft_tricuspidRegurgitation: examination.data?.ft_markers?.tricuspidRegurgitation || '',
        t1_ft_abnormalDvFlow: examination.data?.ft_markers?.abnormalDvFlow || '',
        t1_ft_echogenicCardiacFocus: examination.data?.ft_markers?.echogenicCardiacFocus || '',
        t1_ft_singleUmbilicalArtery: examination.data?.ft_markers?.singleUmbilicalArtery || '',
        t1_ft_choroidPlexusCysts: examination.data?.ft_markers?.choroidPlexusCysts || '',
        t1_ft_exomphalos: examination.data?.ft_markers?.exomphalos || '',
        t1_ft_megacystis: examination.data?.ft_markers?.megacystis || '',
        t1_ft_markerPlacenta: examination.data?.ft_markers?.placenta || '',
        t1_ft_cordInsertion: examination.data?.ft_markers?.cordInsertion || '',
        t1_anat_head: examination.data?.ft_anatomy?.head || '',
        t1_anat_brain: examination.data?.ft_anatomy?.brain || '',
        t1_anat_heart: examination.data?.ft_anatomy?.heart || '',
        t1_anat_abdomen: examination.data?.ft_anatomy?.abdomen || '',
        t1_anat_kidneys: examination.data?.ft_anatomy?.kidneys || '',
        t1_anat_limbs: examination.data?.ft_anatomy?.limbs || '',
        t1_anat_skeleton: examination.data?.ft_anatomy?.skeleton || '',
        t1_anat_face: examination.data?.ft_anatomy?.face || '',
        t1_anat_neckSkin: examination.data?.ft_anatomy?.neckSkin || '',
        t1_anat_spine: examination.data?.ft_anatomy?.spine || '',
        t1_anat_thorax: examination.data?.ft_anatomy?.thorax || '',
        t1_ft_utADexPI: examination.data?.ft_doppler?.utADexPI?.toString() || '',
        t1_ft_utADexRI: examination.data?.ft_doppler?.utADexRI?.toString() || '',
        t1_ft_utASinPI: examination.data?.ft_doppler?.utASinPI?.toString() || '',
        t1_ft_utASinRI: examination.data?.ft_doppler?.utASinRI?.toString() || '',
        // UZPT — FT fields (T2)
        t2_ft_placenta: examination.data?.twin2_ft_ultrasound?.placenta || '',
        t2_ft_heartRate: examination.data?.twin2_ft_ultrasound?.heartRate?.toString() || '',
        t2_ft_umbilicalCord: examination.data?.twin2_ft_ultrasound?.umbilicalCord || '',
        t2_ft_crl: examination.data?.twin2_ft_biometry?.crl?.toString() || '',
        t2_ft_gaFromCrl: examination.data?.twin2_ft_biometry?.gaFromCrl || '',
        t2_ft_nt: examination.data?.twin2_ft_biometry?.nt?.toString() || '',
        t2_ft_nb: examination.data?.twin2_ft_biometry?.nb?.toString() || '',
        t2_ft_puls: examination.data?.twin2_ft_biometry?.puls?.toString() || '',
        t2_ft_arrhythmia: examination.data?.twin2_ft_markers?.arrhythmia || '',
        t2_ft_tricuspidRegurgitation: examination.data?.twin2_ft_markers?.tricuspidRegurgitation || '',
        t2_ft_abnormalDvFlow: examination.data?.twin2_ft_markers?.abnormalDvFlow || '',
        t2_ft_echogenicCardiacFocus: examination.data?.twin2_ft_markers?.echogenicCardiacFocus || '',
        t2_ft_singleUmbilicalArtery: examination.data?.twin2_ft_markers?.singleUmbilicalArtery || '',
        t2_ft_choroidPlexusCysts: examination.data?.twin2_ft_markers?.choroidPlexusCysts || '',
        t2_ft_exomphalos: examination.data?.twin2_ft_markers?.exomphalos || '',
        t2_ft_megacystis: examination.data?.twin2_ft_markers?.megacystis || '',
        t2_ft_markerPlacenta: examination.data?.twin2_ft_markers?.placenta || '',
        t2_ft_cordInsertion: examination.data?.twin2_ft_markers?.cordInsertion || '',
        // Note: t2_anat_* keys are shared with prenatal T2 anatomy (mutually exclusive exam types)
        t2_ft_utADexPI: examination.data?.twin2_ft_doppler?.utADexPI?.toString() || '',
        t2_ft_utADexRI: examination.data?.twin2_ft_doppler?.utADexRI?.toString() || '',
        t2_ft_utASinPI: examination.data?.twin2_ft_doppler?.utASinPI?.toString() || '',
        t2_ft_utASinRI: examination.data?.twin2_ft_doppler?.utASinRI?.toString() || '',
      });
    }
  }, [examination]);

  // ── Derived values ─────────────────────────────────────────────────────────
  const isTwins = formData.examinationType === 'ultrasound_prenatal_twins';
  const isFt = isFirstTrimester(formData.examinationType);
  const isFtTwinsMode = isFtTwins(formData.examinationType);
  const edd = calcEDD(formData.last_menstrual_period);

  const visibility = getSectionVisibility(formData.examinationType);
  const selectedPatient = patients.find((p) => p.patientId === formData.patientId);
  const patientAge = calculateAgeAtDate(selectedPatient?.birthDate ?? '', formData.examDate);

  // ── KI-009: Reactive biometry auto-calc ────────────────────────────────────
  // Run on every render when biometry measurements or GA from LMP changes.
  // Only applies to prenatal exam types (not FT — FT has no biometry percentiles).
  useEffect(() => {
    if (isFt) return;
    const fd = formData as unknown as Record<string, string | boolean>;
    const diff = computeBiometryDerivedFields({
      bpd: fd.bpd as string, hc: fd.hc as string, ac: fd.ac as string,
      fl: fd.fl as string, ofd: fd.ofd as string, tad: fd.tad as string,
      apad: fd.apad as string, efw: fd.efw as string,
      gestationalAge: fd.gestationalAge as string,
      gestationalAgeFromBiometry: fd.gestationalAgeFromBiometry as string,
      bpdPercentile: fd.bpdPercentile as string, hcPercentile: fd.hcPercentile as string,
      acPercentile: fd.acPercentile as string, flPercentile: fd.flPercentile as string,
      ofdPercentile: fd.ofdPercentile as string, tadPercentile: fd.tadPercentile as string,
      apadPercentile: fd.apadPercentile as string, efwPercentile: fd.efwPercentile as string,
      bpdGa: fd.bpdGa as string, hcGa: fd.hcGa as string, acGa: fd.acGa as string,
      flGa: fd.flGa as string, ofdGa: fd.ofdGa as string, tadGa: fd.tadGa as string,
      apadGa: fd.apadGa as string, efwGa: fd.efwGa as string,
      bpdPercentileIsManual: fd.bpdPercentileIsManual as boolean,
      hcPercentileIsManual: fd.hcPercentileIsManual as boolean,
      acPercentileIsManual: fd.acPercentileIsManual as boolean,
      flPercentileIsManual: fd.flPercentileIsManual as boolean,
      ofdPercentileIsManual: fd.ofdPercentileIsManual as boolean,
      tadPercentileIsManual: fd.tadPercentileIsManual as boolean,
      apadPercentileIsManual: fd.apadPercentileIsManual as boolean,
      efwPercentileIsManual: fd.efwPercentileIsManual as boolean,
      bpdGaIsManual: fd.bpdGaIsManual as boolean, hcGaIsManual: fd.hcGaIsManual as boolean,
      acGaIsManual: fd.acGaIsManual as boolean, flGaIsManual: fd.flGaIsManual as boolean,
      ofdGaIsManual: fd.ofdGaIsManual as boolean, tadGaIsManual: fd.tadGaIsManual as boolean,
      apadGaIsManual: fd.apadGaIsManual as boolean, efwGaIsManual: fd.efwGaIsManual as boolean,
      efwIsManual: fd.efwIsManual as boolean,
      gestationalAgeFromBiometryIsManual: fd.gestationalAgeFromBiometryIsManual as boolean,
    });
    if (Object.keys(diff).length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData((prev) => ({ ...prev, ...diff }));
    }
  // Deliberately only track measurement + GA changes (not IsManual flags) to avoid loops
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    formData.bpd, formData.hc, formData.ac, formData.fl, formData.ofd, formData.efw,
    formData.gestationalAge, isFt,
  ]);

  useEffect(() => {
    if (isFt || !isTwins) return;
    const fd = formData as unknown as Record<string, string | boolean>;
    const diff = computeBiometryDerivedFields({
      bpd: fd.t2_bpd as string, hc: fd.t2_hc as string, ac: fd.t2_ac as string,
      fl: fd.t2_fl as string, ofd: fd.t2_ofd as string, tad: fd.t2_tad as string,
      apad: fd.t2_apad as string, efw: fd.t2_efw as string,
      gestationalAge: fd.gestationalAge as string,
      gestationalAgeFromBiometry: fd.t2_gestationalAgeFromBiometry as string,
      bpdPercentile: fd.t2_bpdPercentile as string, hcPercentile: fd.t2_hcPercentile as string,
      acPercentile: fd.t2_acPercentile as string, flPercentile: fd.t2_flPercentile as string,
      ofdPercentile: fd.t2_ofdPercentile as string, tadPercentile: fd.t2_tadPercentile as string,
      apadPercentile: fd.t2_apadPercentile as string, efwPercentile: fd.t2_efwPercentile as string,
      bpdGa: fd.t2_bpdGa as string, hcGa: fd.t2_hcGa as string, acGa: fd.t2_acGa as string,
      flGa: fd.t2_flGa as string, ofdGa: fd.t2_ofdGa as string, tadGa: fd.t2_tadGa as string,
      apadGa: fd.t2_apadGa as string, efwGa: fd.t2_efwGa as string,
      bpdPercentileIsManual: fd.t2_bpdPercentileIsManual as boolean,
      hcPercentileIsManual: fd.t2_hcPercentileIsManual as boolean,
      acPercentileIsManual: fd.t2_acPercentileIsManual as boolean,
      flPercentileIsManual: fd.t2_flPercentileIsManual as boolean,
      ofdPercentileIsManual: fd.t2_ofdPercentileIsManual as boolean,
      tadPercentileIsManual: fd.t2_tadPercentileIsManual as boolean,
      apadPercentileIsManual: fd.t2_apadPercentileIsManual as boolean,
      efwPercentileIsManual: fd.t2_efwPercentileIsManual as boolean,
      bpdGaIsManual: fd.t2_bpdGaIsManual as boolean, hcGaIsManual: fd.t2_hcGaIsManual as boolean,
      acGaIsManual: fd.t2_acGaIsManual as boolean, flGaIsManual: fd.t2_flGaIsManual as boolean,
      ofdGaIsManual: fd.t2_ofdGaIsManual as boolean, tadGaIsManual: fd.t2_tadGaIsManual as boolean,
      apadGaIsManual: fd.t2_apadGaIsManual as boolean, efwGaIsManual: fd.t2_efwGaIsManual as boolean,
      efwIsManual: fd.t2_efwIsManual as boolean,
      gestationalAgeFromBiometryIsManual: fd.t2_gestationalAgeFromBiometryIsManual as boolean,
    });
    if (Object.keys(diff).length > 0) {
      const t2Diff = Object.fromEntries(Object.entries(diff).map(([key, diffValue]) => [`t2_${key}`, diffValue]));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData((prev) => ({ ...prev, ...t2Diff }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    formData.t2_bpd, formData.t2_hc, formData.t2_ac, formData.t2_fl,
    formData.t2_ofd, formData.t2_efw, formData.gestationalAge, isFt, isTwins,
  ]);

  useEffect(() => {
    if (!isFt) return;
    const crlChanged = formData.t1_ft_crl !== prevT1CrlRef.current;
    prevT1CrlRef.current = formData.t1_ft_crl;

    // B-3: If CRL did not change (mount or flag-change re-run) and gaFromCrl is manual,
    // preserve the stored value — do not overwrite (REQ-10).
    if (!crlChanged && formData.t1_ft_gaFromCrlIsManual) return;

    const diff = computeFirstTrimesterDerivedFields({
      crl: formData.t1_ft_crl,
    });

    if (
      diff.gaFromCrl !== formData.t1_ft_gaFromCrl ||
      diff.gaFromBio !== formData.t1_ft_gaFromBio ||
      diff.gaFromCrlIsManual !== formData.t1_ft_gaFromCrlIsManual
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData((prev) => ({
        ...prev,
        t1_ft_gaFromCrl: diff.gaFromCrl,
        t1_ft_gaFromBio: diff.gaFromBio,
        t1_ft_gaFromCrlIsManual: diff.gaFromCrlIsManual,
      }));
    }
  }, [formData.t1_ft_crl, formData.t1_ft_gaFromCrl, formData.t1_ft_gaFromBio, formData.t1_ft_gaFromCrlIsManual, isFt]);

  useEffect(() => {
    if (!isFtTwinsMode) return;
    const crlChanged = formData.t2_ft_crl !== prevT2CrlRef.current;
    prevT2CrlRef.current = formData.t2_ft_crl;

    // B-4: If CRL did not change (mount or flag-change re-run) and gaFromCrl is manual,
    // preserve the stored value — do not overwrite (REQ-10).
    if (!crlChanged && formData.t2_ft_gaFromCrlIsManual) return;

    const diff = computeFirstTrimesterDerivedFields({
      crl: formData.t2_ft_crl,
    });

    if (
      diff.gaFromCrl !== formData.t2_ft_gaFromCrl ||
      diff.gaFromBio !== formData.t2_ft_gaFromBio ||
      diff.gaFromCrlIsManual !== formData.t2_ft_gaFromCrlIsManual
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData((prev) => ({
        ...prev,
        t2_ft_gaFromCrl: diff.gaFromCrl,
        t2_ft_gaFromBio: diff.gaFromBio,
        t2_ft_gaFromCrlIsManual: diff.gaFromCrlIsManual,
      }));
    }
  }, [formData.t2_ft_crl, formData.t2_ft_gaFromCrl, formData.t2_ft_gaFromBio, formData.t2_ft_gaFromCrlIsManual, isFtTwinsMode]);

  useEffect(() => {
    if (formData.gestationalAgeIsManual) return;
    if (!formData.last_menstrual_period || !formData.examDate) return;

    const result = calcGAFromLMP(formData.last_menstrual_period, formData.examDate) ?? '';
    if (result !== formData.gestationalAge) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData((prev) => ({ ...prev, gestationalAge: result }));
    }
  }, [formData.last_menstrual_period, formData.examDate, formData.gestationalAge, formData.gestationalAgeIsManual]);

  // ── handleChange / handleChangeT1 ─────────────────────────────────────────
  const handleChange = (field: string, value: string) => {
    setFormData((prev) => {
      const derivedManualFields = [
        'bpdPercentile', 'hcPercentile', 'acPercentile', 'flPercentile',
        'ofdPercentile', 'efwPercentile', 'bpdGa', 'hcGa',
        'acGa', 'flGa', 'ofdGa', 'efwGa',
        'gestationalAgeFromBiometry',
      ];
      const measurementManualDependencies: Record<string, string[]> = {
        bpd: ['efw', 'gestationalAgeFromBiometry', 'bpdPercentile', 'bpdGa', 'efwPercentile', 'efwGa'],
        hc: ['efw', 'gestationalAgeFromBiometry', 'hcPercentile', 'hcGa', 'efwPercentile', 'efwGa'],
        ac: ['efw', 'gestationalAgeFromBiometry', 'acPercentile', 'acGa', 'efwPercentile', 'efwGa'],
        fl: ['efw', 'gestationalAgeFromBiometry', 'flPercentile', 'flGa', 'efwPercentile', 'efwGa'],
        ofd: ['ofdPercentile', 'ofdGa'],
        gestationalAge: ['bpdPercentile', 'hcPercentile', 'acPercentile', 'flPercentile', 'ofdPercentile', 'efwPercentile'],
        last_menstrual_period: ['gestationalAge', 'bpdPercentile', 'hcPercentile', 'acPercentile', 'flPercentile', 'ofdPercentile', 'efwPercentile'],
        examDate: ['gestationalAge', 'bpdPercentile', 'hcPercentile', 'acPercentile', 'flPercentile', 'ofdPercentile', 'efwPercentile'],
      };
      const measurementField = field.startsWith('t2_') ? field.slice(3) : field;
      const prefix = field.startsWith('t2_') ? 't2_' : '';

      const resetDependentManualFlags = (next: Record<string, unknown>, dependencies: string[]) => {
        dependencies.forEach((dependency) => {
          next[`${prefix}${dependency}IsManual`] = false;
        });
      };

      if (field === 'gestationalAge') {
        const next = { ...prev, gestationalAge: value, gestationalAgeIsManual: value !== '' };
        resetDependentManualFlags(next, measurementManualDependencies.gestationalAge);
        // B-2: Also reset T2 percentile IsManual flags — gestationalAge has no t2_ prefix so
        // the generic prefix-detection helper above produces '' prefix (T1), not 't2_'.
        next.t2_bpdPercentileIsManual = false;
        next.t2_hcPercentileIsManual = false;
        next.t2_acPercentileIsManual = false;
        next.t2_flPercentileIsManual = false;
        next.t2_ofdPercentileIsManual = false;
        next.t2_efwPercentileIsManual = false;
        return next;
      }

      if (field === 'ft_gaFromCrl') {
        return {
          ...prev,
          t1_ft_gaFromCrl: value,
          t1_ft_gaFromCrlIsManual: value !== '',
          ...(value === '' ? { t1_ft_gaFromBio: '' } : {}),
        };
      }

      if (field === 't1_ft_gaFromCrl') {
        return {
          ...prev,
          t1_ft_gaFromCrl: value,
          t1_ft_gaFromCrlIsManual: value !== '',
          ...(value === '' ? { t1_ft_gaFromBio: '' } : {}),
        };
      }

      if (field === 't2_ft_gaFromCrl') {
        return {
          ...prev,
          t2_ft_gaFromCrl: value,
          t2_ft_gaFromCrlIsManual: value !== '',
          ...(value === '' ? { t2_ft_gaFromBio: '' } : {}),
        };
      }

      // B-5: When ft_crl changes, reset the T1 FT gaFromCrl IsManual flag so the reactive
      // effect unconditionally recalculates (REQ-9). 'ft_crl' arrives here after handleChangeT1
      // strips the 't1_' prefix; the actual formData key is 't1_ft_gaFromCrlIsManual'.
      if (field === 'ft_crl') {
        return { ...prev, t1_ft_crl: value, t1_ft_gaFromCrlIsManual: false };
      }

      // B-5: When t2_ft_crl changes, reset the T2 FT gaFromCrl IsManual flag (REQ-9).
      if (field === 't2_ft_crl') {
        return { ...prev, t2_ft_crl: value, t2_ft_gaFromCrlIsManual: false };
      }

      if (field === 'efw' || field === 't2_efw') {
        const manualKey = field === 'efw' ? 'efwIsManual' : 't2_efwIsManual';
        return { ...prev, [field]: value, [manualKey]: value !== '' };
      }

      if (measurementManualDependencies[measurementField]) {
        const next = { ...prev, [field]: value };
        resetDependentManualFlags(next, measurementManualDependencies[measurementField]);
        return next;
      }

      const normalizedField = field.startsWith('t2_') ? field.slice(3) : field;
      if (derivedManualFields.includes(normalizedField)) {
        const manualKey = field.startsWith('t2_')
          ? `t2_${normalizedField}IsManual`
          : `${normalizedField}IsManual`;
        return { ...prev, [field]: value, [manualKey]: value !== '' };
      }

      return { ...prev, [field]: value };
    });
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // uzd-twins: adapter for T1 section components — BiometrySection emits "t1_bpd" style
  // but T1 data is stored under the unprefixed keys (bpd, hc, …).
  const handleChangeT1 = (field: string, value: string) => {
    const stripped = field.startsWith('t1_') ? field.slice(3) : field;
    handleChange(stripped, value);
  };

  // ── Validation ─────────────────────────────────────────────────────────────
  const validateGA = (raw: string): string | undefined =>
    raw && !GA_REGEX.test(raw) ? 'Format must be "28w 3d" or "28с 3д"' : undefined;

  // Declarative validation rules table (ST-2).
  // errorKey: written into newErrors (always prefixed for T1 prenatal — fixes D-1).
  // formKey: read from formData (bare for T1 prenatal because handleChangeT1 strips prefix).
  // onlyWhen: runtime guard closing over derived booleans.
  const VALIDATION_RULES: ValidationRule[] = [
    // ── Prenatal T1 biometry (excl. la — string field) ──────────────────────
    { errorKey: 't1_bpd',        formKey: 'bpd',        validate: (r) => validatePositiveFloat(r, 'BPD') },
    { errorKey: 't1_hc',         formKey: 'hc',         validate: (r) => validatePositiveFloat(r, 'HC') },
    { errorKey: 't1_ac',         formKey: 'ac',         validate: (r) => validatePositiveFloat(r, 'AC') },
    { errorKey: 't1_fl',         formKey: 'fl',         validate: (r) => validatePositiveFloat(r, 'FL') },
    { errorKey: 't1_efw',        formKey: 'efw',        validate: (r) => validatePositiveFloat(r, 'EFW') },
    { errorKey: 't1_ofd',        formKey: 'ofd',        validate: (r) => validatePositiveFloat(r, 'OFD') },
    // vp is now a string field — no validation rule
    { errorKey: 't1_tcd',        formKey: 'tcd',        validate: (r) => validatePositiveFloat(r, 'TCD') },
    { errorKey: 't1_cm',         formKey: 'cm',         validate: (r) => validatePositiveFloat(r, 'CM') },
    { errorKey: 't1_nuchalFold', formKey: 'nuchalFold', validate: (r) => validatePositiveFloat(r, 'NF') },
    { errorKey: 't1_nb',         formKey: 'nb',         validate: (r) => validatePositiveFloat(r, 'NB') },
    { errorKey: 't1_apad',       formKey: 'apad',       validate: (r) => validatePositiveFloat(r, 'APAD') },
    { errorKey: 't1_tad',        formKey: 'tad',        validate: (r) => validatePositiveFloat(r, 'TAD') },
    { errorKey: 't1_lc',         formKey: 'lc',         validate: (r) => validatePositiveFloat(r, 'LC') },
    // ── Prenatal T1 GA from biometry ─────────────────────────────────────────
    { errorKey: 't1_gestationalAgeFromBiometry', formKey: 'gestationalAgeFromBiometry', validate: validateGA },
    // ── Prenatal T1 doppler ──────────────────────────────────────────────────
    { errorKey: 't1_pi',       formKey: 'pi',       validate: (r) => validateNonNegativeFloat(r, 'PI') },
    { errorKey: 't1_ri',       formKey: 'ri',       validate: (r) => validateNonNegativeFloat(r, 'RI') },
    { errorKey: 't1_utADexPI', formKey: 'utADexPI', validate: (r) => validateNonNegativeFloat(r, 'A.ut.Dex PI') },
    { errorKey: 't1_utADexRI', formKey: 'utADexRI', validate: (r) => validateNonNegativeFloat(r, 'A.ut.Dex RI') },
    { errorKey: 't1_utASinPI', formKey: 'utASinPI', validate: (r) => validateNonNegativeFloat(r, 'A.ut.Sin PI') },
    { errorKey: 't1_utASinRI', formKey: 'utASinRI', validate: (r) => validateNonNegativeFloat(r, 'A.ut.Sin RI') },
    { errorKey: 't1_cma',      formKey: 'cma',      validate: (r) => validateNonNegativeFloat(r, 'CMA') },
    { errorKey: 't1_psv',      formKey: 'psv',      validate: (r) => validateNonNegativeFloat(r, 'PSV') },
    { errorKey: 't1_cpr',      formKey: 'cpr',      validate: (r) => validateNonNegativeFloat(r, 'CPR') },
    // ── Prenatal T1 heart rate ────────────────────────────────────────────────
    { errorKey: 't1_heart_rate', formKey: 'heart_rate', validate: (r) => validateIntegerField(r, 'Heart rate') },
    // ── Prenatal T2 biometry (excl. t2_la) ───────────────────────────────────
    { errorKey: 't2_bpd',        formKey: 't2_bpd',        validate: (r) => validatePositiveFloat(r, 'BPD (T2)'),   onlyWhen: () => isTwins },
    { errorKey: 't2_hc',         formKey: 't2_hc',         validate: (r) => validatePositiveFloat(r, 'HC (T2)'),    onlyWhen: () => isTwins },
    { errorKey: 't2_ac',         formKey: 't2_ac',         validate: (r) => validatePositiveFloat(r, 'AC (T2)'),    onlyWhen: () => isTwins },
    { errorKey: 't2_fl',         formKey: 't2_fl',         validate: (r) => validatePositiveFloat(r, 'FL (T2)'),    onlyWhen: () => isTwins },
    { errorKey: 't2_efw',        formKey: 't2_efw',        validate: (r) => validatePositiveFloat(r, 'EFW (T2)'),   onlyWhen: () => isTwins },
    { errorKey: 't2_ofd',        formKey: 't2_ofd',        validate: (r) => validatePositiveFloat(r, 'OFD (T2)'),   onlyWhen: () => isTwins },
    // t2_vp is now a string field — no validation rule
    { errorKey: 't2_tcd',        formKey: 't2_tcd',        validate: (r) => validatePositiveFloat(r, 'TCD (T2)'),   onlyWhen: () => isTwins },
    { errorKey: 't2_cm',         formKey: 't2_cm',         validate: (r) => validatePositiveFloat(r, 'CM (T2)'),    onlyWhen: () => isTwins },
    { errorKey: 't2_nuchalFold', formKey: 't2_nuchalFold', validate: (r) => validatePositiveFloat(r, 'NF (T2)'),    onlyWhen: () => isTwins },
    { errorKey: 't2_nb',         formKey: 't2_nb',         validate: (r) => validatePositiveFloat(r, 'NB (T2)'),    onlyWhen: () => isTwins },
    { errorKey: 't2_apad',       formKey: 't2_apad',       validate: (r) => validatePositiveFloat(r, 'APAD (T2)'),  onlyWhen: () => isTwins },
    { errorKey: 't2_tad',        formKey: 't2_tad',        validate: (r) => validatePositiveFloat(r, 'TAD (T2)'),   onlyWhen: () => isTwins },
    { errorKey: 't2_lc',         formKey: 't2_lc',         validate: (r) => validatePositiveFloat(r, 'LC (T2)'),    onlyWhen: () => isTwins },
    // ── Prenatal T2 GA from biometry ─────────────────────────────────────────
    { errorKey: 't2_gestationalAgeFromBiometry', formKey: 't2_gestationalAgeFromBiometry', validate: validateGA, onlyWhen: () => isTwins },
    // ── Prenatal T2 doppler ──────────────────────────────────────────────────
    { errorKey: 't2_pi',       formKey: 't2_pi',       validate: (r) => validateNonNegativeFloat(r, 'PI (T2)'),         onlyWhen: () => isTwins },
    { errorKey: 't2_ri',       formKey: 't2_ri',       validate: (r) => validateNonNegativeFloat(r, 'RI (T2)'),         onlyWhen: () => isTwins },
    { errorKey: 't2_utADexPI', formKey: 't2_utADexPI', validate: (r) => validateNonNegativeFloat(r, 'A.ut.Dex PI (T2)'), onlyWhen: () => isTwins },
    { errorKey: 't2_utADexRI', formKey: 't2_utADexRI', validate: (r) => validateNonNegativeFloat(r, 'A.ut.Dex RI (T2)'), onlyWhen: () => isTwins },
    { errorKey: 't2_utASinPI', formKey: 't2_utASinPI', validate: (r) => validateNonNegativeFloat(r, 'A.ut.Sin PI (T2)'), onlyWhen: () => isTwins },
    { errorKey: 't2_utASinRI', formKey: 't2_utASinRI', validate: (r) => validateNonNegativeFloat(r, 'A.ut.Sin RI (T2)'), onlyWhen: () => isTwins },
    { errorKey: 't2_cma',      formKey: 't2_cma',      validate: (r) => validateNonNegativeFloat(r, 'CMA (T2)'),        onlyWhen: () => isTwins },
    { errorKey: 't2_psv',      formKey: 't2_psv',      validate: (r) => validateNonNegativeFloat(r, 'PSV (T2)'),        onlyWhen: () => isTwins },
    { errorKey: 't2_cpr',      formKey: 't2_cpr',      validate: (r) => validateNonNegativeFloat(r, 'CPR (T2)'),        onlyWhen: () => isTwins },
    // ── Prenatal T2 heart rate ────────────────────────────────────────────────
    { errorKey: 't2_heart_rate', formKey: 't2_heart_rate', validate: (r) => validateIntegerField(r, 'Heart rate (T2)'), onlyWhen: () => isTwins },
    // ── FT T1 biometry ────────────────────────────────────────────────────────
    { errorKey: 't1_ft_crl', formKey: 't1_ft_crl', validate: (r) => validatePositiveFloat(r, 'CRL'), onlyWhen: () => isFt },
    { errorKey: 't1_ft_nt',  formKey: 't1_ft_nt',  validate: (r) => validatePositiveFloat(r, 'NT'),  onlyWhen: () => isFt },
    { errorKey: 't1_ft_nb',  formKey: 't1_ft_nb',  validate: (r) => validatePositiveFloat(r, 'NB'),  onlyWhen: () => isFt },
    // ── FT T1 GA from CRL ─────────────────────────────────────────────────────
    { errorKey: 't1_ft_gaFromCrl', formKey: 't1_ft_gaFromCrl', validate: validateGA, onlyWhen: () => isFt },
    // ── FT T1 integer fields ─────────────────────────────────────────────────
    { errorKey: 't1_ft_puls',      formKey: 't1_ft_puls',      validate: (r) => validateIntegerField(r, 'Pulse'),      onlyWhen: () => isFt },
    { errorKey: 't1_ft_heartRate', formKey: 't1_ft_heartRate', validate: (r) => validateIntegerField(r, 'Heart rate'), onlyWhen: () => isFt },
    // ── FT T1 doppler ─────────────────────────────────────────────────────────
    { errorKey: 't1_ft_utADexPI', formKey: 't1_ft_utADexPI', validate: (r) => validateNonNegativeFloat(r, 'A.ut.Dex PI'), onlyWhen: () => isFt },
    { errorKey: 't1_ft_utADexRI', formKey: 't1_ft_utADexRI', validate: (r) => validateNonNegativeFloat(r, 'A.ut.Dex RI'), onlyWhen: () => isFt },
    { errorKey: 't1_ft_utASinPI', formKey: 't1_ft_utASinPI', validate: (r) => validateNonNegativeFloat(r, 'A.ut.Sin PI'), onlyWhen: () => isFt },
    { errorKey: 't1_ft_utASinRI', formKey: 't1_ft_utASinRI', validate: (r) => validateNonNegativeFloat(r, 'A.ut.Sin RI'), onlyWhen: () => isFt },
    // ── FT T2 biometry ────────────────────────────────────────────────────────
    { errorKey: 't2_ft_crl', formKey: 't2_ft_crl', validate: (r) => validatePositiveFloat(r, 'CRL (T2)'), onlyWhen: () => isFtTwinsMode },
    { errorKey: 't2_ft_nt',  formKey: 't2_ft_nt',  validate: (r) => validatePositiveFloat(r, 'NT (T2)'),  onlyWhen: () => isFtTwinsMode },
    { errorKey: 't2_ft_nb',  formKey: 't2_ft_nb',  validate: (r) => validatePositiveFloat(r, 'NB (T2)'),  onlyWhen: () => isFtTwinsMode },
    // ── FT T2 GA from CRL ─────────────────────────────────────────────────────
    { errorKey: 't2_ft_gaFromCrl', formKey: 't2_ft_gaFromCrl', validate: validateGA, onlyWhen: () => isFtTwinsMode },
    // ── FT T2 integer fields ─────────────────────────────────────────────────
    { errorKey: 't2_ft_puls',      formKey: 't2_ft_puls',      validate: (r) => validateIntegerField(r, 'Pulse (T2)'),      onlyWhen: () => isFtTwinsMode },
    { errorKey: 't2_ft_heartRate', formKey: 't2_ft_heartRate', validate: (r) => validateIntegerField(r, 'Heart rate (T2)'), onlyWhen: () => isFtTwinsMode },
    // ── FT T2 doppler ─────────────────────────────────────────────────────────
    { errorKey: 't2_ft_utADexPI', formKey: 't2_ft_utADexPI', validate: (r) => validateNonNegativeFloat(r, 'A.ut.Dex PI (T2)'), onlyWhen: () => isFtTwinsMode },
    { errorKey: 't2_ft_utADexRI', formKey: 't2_ft_utADexRI', validate: (r) => validateNonNegativeFloat(r, 'A.ut.Dex RI (T2)'), onlyWhen: () => isFtTwinsMode },
    { errorKey: 't2_ft_utASinPI', formKey: 't2_ft_utASinPI', validate: (r) => validateNonNegativeFloat(r, 'A.ut.Sin PI (T2)'), onlyWhen: () => isFtTwinsMode },
    { errorKey: 't2_ft_utASinRI', formKey: 't2_ft_utASinRI', validate: (r) => validateNonNegativeFloat(r, 'A.ut.Sin RI (T2)'), onlyWhen: () => isFtTwinsMode },
  ];

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // ── Imperative preamble: date/patient/GA checks (no repetitive structure) ──
    if (!isEdit && !formData.patientId) newErrors.patientId = 'Patient is required';

    if (!formData.examDate) {
      newErrors.examDate = 'Examination date is required';
    } else {
      const [yyyy, mm, dd] = formData.examDate.split('-').map(Number);
      const examDate = new Date(yyyy, mm - 1, dd);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (examDate > today) newErrors.examDate = 'Examination date cannot be in the future';
    }

    if (formData.last_menstrual_period) {
      const [ly, lm, ld] = formData.last_menstrual_period.split('-').map(Number);
      const lmpDate = new Date(ly, lm - 1, ld);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (lmpDate > today) newErrors.last_menstrual_period = 'LMP cannot be in the future';
    }

    if (formData.gestationalAge && !GA_REGEX.test(formData.gestationalAge))
      newErrors.gestationalAge = 'Format must be "28w 3d" or "28с 3д"';

    // ── Declarative table runner (ST-2) ────────────────────────────────────
    const fd = formData as unknown as Record<string, string>;
    for (const rule of VALIDATION_RULES) {
      if (rule.onlyWhen && !rule.onlyWhen()) continue;
      const err = rule.validate(fd[rule.formKey] ?? '');
      if (err) newErrors[rule.errorKey] = err;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Field registry (ST-3) ──────────────────────────────────────────────────
  // FIELD_REGISTRY covers all numeric biometry/doppler/FT fields.
  // outType transforms: float → parseFloat, integer → Math.trunc(parseFloat), trim → string.trim
  // la/t2_la use outType 'trim' (string field — Additional Change).
  const FIELD_REGISTRY: FieldDef[] = [
    // ── T1 prenatal biometry (bare keys — handleChangeT1 strips t1_ prefix) ─
    { formKey: 'bpd',        payloadPath: 'biometry.bpd',        outType: 'float' },
    { formKey: 'hc',         payloadPath: 'biometry.hc',         outType: 'float' },
    { formKey: 'ac',         payloadPath: 'biometry.ac',         outType: 'float' },
    { formKey: 'fl',         payloadPath: 'biometry.fl',         outType: 'float' },
    { formKey: 'efw',        payloadPath: 'biometry.efw',        outType: 'float' },
    { formKey: 'ofd',        payloadPath: 'biometry.ofd',        outType: 'float' },
    { formKey: 'vp',         payloadPath: 'biometry.vp',         outType: 'trim' },
    { formKey: 'tcd',        payloadPath: 'biometry.tcd',        outType: 'float' },
    { formKey: 'cm',         payloadPath: 'biometry.cm',         outType: 'float' },
    { formKey: 'nuchalFold', payloadPath: 'biometry.nuchalFold', outType: 'float' },
    { formKey: 'nb',         payloadPath: 'biometry.nb',         outType: 'float' },
    { formKey: 'apad',       payloadPath: 'biometry.apad',       outType: 'float' },
    { formKey: 'tad',        payloadPath: 'biometry.tad',        outType: 'float' },
    { formKey: 'la',         payloadPath: 'biometry.la',         outType: 'trim' },  // string field
    { formKey: 'lc',         payloadPath: 'biometry.lc',         outType: 'float' },
    // Sub-Task 3: T1 per-measurement GA fields (pass-through; no calculation yet)
    { formKey: 'bpdGa',  payloadPath: 'biometry.bpdGa',  outType: 'trim' },
    { formKey: 'ofdGa',  payloadPath: 'biometry.ofdGa',  outType: 'trim' },
    { formKey: 'hcGa',   payloadPath: 'biometry.hcGa',   outType: 'trim' },
    { formKey: 'tadGa',  payloadPath: 'biometry.tadGa',  outType: 'trim' },
    { formKey: 'apadGa', payloadPath: 'biometry.apadGa', outType: 'trim' },
    { formKey: 'acGa',   payloadPath: 'biometry.acGa',   outType: 'trim' },
    { formKey: 'flGa',   payloadPath: 'biometry.flGa',   outType: 'trim' },
    { formKey: 'efwGa',  payloadPath: 'biometry.efwGa',  outType: 'trim' },
    // KI-009: T1 persisted percentile fields (integer)
    { formKey: 'bpdPercentile',  payloadPath: 'biometry.bpdPercentile',  outType: 'integer' },
    { formKey: 'hcPercentile',   payloadPath: 'biometry.hcPercentile',   outType: 'integer' },
    { formKey: 'acPercentile',   payloadPath: 'biometry.acPercentile',   outType: 'integer' },
    { formKey: 'flPercentile',   payloadPath: 'biometry.flPercentile',   outType: 'integer' },
    { formKey: 'ofdPercentile',  payloadPath: 'biometry.ofdPercentile',  outType: 'integer' },
    { formKey: 'tadPercentile',  payloadPath: 'biometry.tadPercentile',  outType: 'integer' },
    { formKey: 'apadPercentile', payloadPath: 'biometry.apadPercentile', outType: 'integer' },
    { formKey: 'efwPercentile',  payloadPath: 'biometry.efwPercentile',  outType: 'integer' },
    // ── T1 doppler ────────────────────────────────────────────────────────────
    { formKey: 'pi',       payloadPath: 'doppler.pi',       outType: 'float' },
    { formKey: 'ri',       payloadPath: 'doppler.ri',       outType: 'float' },
    { formKey: 'utADexPI', payloadPath: 'doppler.utADexPI', outType: 'float' },
    { formKey: 'utADexRI', payloadPath: 'doppler.utADexRI', outType: 'float' },
    { formKey: 'utASinPI', payloadPath: 'doppler.utASinPI', outType: 'float' },
    { formKey: 'utASinRI', payloadPath: 'doppler.utASinRI', outType: 'float' },
    { formKey: 'cma',      payloadPath: 'doppler.cma',      outType: 'float' },
    { formKey: 'psv',      payloadPath: 'doppler.psv',      outType: 'float' },
    { formKey: 'cpr',      payloadPath: 'doppler.cpr',      outType: 'float' },
    { formKey: 'ducVen',   payloadPath: 'doppler.ducVen',   outType: 'trim' },
    // ── T1 integer (heart rate) ───────────────────────────────────────────────
    { formKey: 'heart_rate', payloadPath: 'ultrasound.heart_rate', outType: 'integer' },
    // ── T2 prenatal biometry ─────────────────────────────────────────────────
    { formKey: 't2_bpd',        payloadPath: 'biometry2.bpd',        outType: 'float',   onlyWhen: () => isTwins },
    { formKey: 't2_hc',         payloadPath: 'biometry2.hc',         outType: 'float',   onlyWhen: () => isTwins },
    { formKey: 't2_ac',         payloadPath: 'biometry2.ac',         outType: 'float',   onlyWhen: () => isTwins },
    { formKey: 't2_fl',         payloadPath: 'biometry2.fl',         outType: 'float',   onlyWhen: () => isTwins },
    { formKey: 't2_efw',        payloadPath: 'biometry2.efw',        outType: 'float',   onlyWhen: () => isTwins },
    { formKey: 't2_ofd',        payloadPath: 'biometry2.ofd',        outType: 'float',   onlyWhen: () => isTwins },
    { formKey: 't2_vp',         payloadPath: 'biometry2.vp',         outType: 'trim',    onlyWhen: () => isTwins },
    { formKey: 't2_tcd',        payloadPath: 'biometry2.tcd',        outType: 'float',   onlyWhen: () => isTwins },
    { formKey: 't2_cm',         payloadPath: 'biometry2.cm',         outType: 'float',   onlyWhen: () => isTwins },
    { formKey: 't2_nuchalFold', payloadPath: 'biometry2.nuchalFold', outType: 'float',   onlyWhen: () => isTwins },
    { formKey: 't2_nb',         payloadPath: 'biometry2.nb',         outType: 'float',   onlyWhen: () => isTwins },
    { formKey: 't2_apad',       payloadPath: 'biometry2.apad',       outType: 'float',   onlyWhen: () => isTwins },
    { formKey: 't2_tad',        payloadPath: 'biometry2.tad',        outType: 'float',   onlyWhen: () => isTwins },
    { formKey: 't2_la',         payloadPath: 'biometry2.la',         outType: 'trim',    onlyWhen: () => isTwins }, // string field
    { formKey: 't2_lc',         payloadPath: 'biometry2.lc',         outType: 'float',   onlyWhen: () => isTwins },
    // Sub-Task 3: T2 per-measurement GA fields (pass-through; no calculation yet)
    { formKey: 't2_bpdGa',  payloadPath: 'biometry2.bpdGa',  outType: 'trim', onlyWhen: () => isTwins },
    { formKey: 't2_ofdGa',  payloadPath: 'biometry2.ofdGa',  outType: 'trim', onlyWhen: () => isTwins },
    { formKey: 't2_hcGa',   payloadPath: 'biometry2.hcGa',   outType: 'trim', onlyWhen: () => isTwins },
    { formKey: 't2_tadGa',  payloadPath: 'biometry2.tadGa',  outType: 'trim', onlyWhen: () => isTwins },
    { formKey: 't2_apadGa', payloadPath: 'biometry2.apadGa', outType: 'trim', onlyWhen: () => isTwins },
    { formKey: 't2_acGa',   payloadPath: 'biometry2.acGa',   outType: 'trim', onlyWhen: () => isTwins },
    { formKey: 't2_flGa',   payloadPath: 'biometry2.flGa',   outType: 'trim', onlyWhen: () => isTwins },
    { formKey: 't2_efwGa',  payloadPath: 'biometry2.efwGa',  outType: 'trim', onlyWhen: () => isTwins },
    // KI-009: T2 persisted percentile fields (integer)
    { formKey: 't2_bpdPercentile',  payloadPath: 'biometry2.bpdPercentile',  outType: 'integer', onlyWhen: () => isTwins },
    { formKey: 't2_hcPercentile',   payloadPath: 'biometry2.hcPercentile',   outType: 'integer', onlyWhen: () => isTwins },
    { formKey: 't2_acPercentile',   payloadPath: 'biometry2.acPercentile',   outType: 'integer', onlyWhen: () => isTwins },
    { formKey: 't2_flPercentile',   payloadPath: 'biometry2.flPercentile',   outType: 'integer', onlyWhen: () => isTwins },
    { formKey: 't2_ofdPercentile',  payloadPath: 'biometry2.ofdPercentile',  outType: 'integer', onlyWhen: () => isTwins },
    { formKey: 't2_tadPercentile',  payloadPath: 'biometry2.tadPercentile',  outType: 'integer', onlyWhen: () => isTwins },
    { formKey: 't2_apadPercentile', payloadPath: 'biometry2.apadPercentile', outType: 'integer', onlyWhen: () => isTwins },
    { formKey: 't2_efwPercentile',  payloadPath: 'biometry2.efwPercentile',  outType: 'integer', onlyWhen: () => isTwins },
    // ── T2 doppler ────────────────────────────────────────────────────────────
    { formKey: 't2_pi',       payloadPath: 'doppler2.pi',       outType: 'float',   onlyWhen: () => isTwins },
    { formKey: 't2_ri',       payloadPath: 'doppler2.ri',       outType: 'float',   onlyWhen: () => isTwins },
    { formKey: 't2_utADexPI', payloadPath: 'doppler2.utADexPI', outType: 'float',   onlyWhen: () => isTwins },
    { formKey: 't2_utADexRI', payloadPath: 'doppler2.utADexRI', outType: 'float',   onlyWhen: () => isTwins },
    { formKey: 't2_utASinPI', payloadPath: 'doppler2.utASinPI', outType: 'float',   onlyWhen: () => isTwins },
    { formKey: 't2_utASinRI', payloadPath: 'doppler2.utASinRI', outType: 'float',   onlyWhen: () => isTwins },
    { formKey: 't2_cma',      payloadPath: 'doppler2.cma',      outType: 'float',   onlyWhen: () => isTwins },
    { formKey: 't2_psv',      payloadPath: 'doppler2.psv',      outType: 'float',   onlyWhen: () => isTwins },
    { formKey: 't2_cpr',      payloadPath: 'doppler2.cpr',      outType: 'float',   onlyWhen: () => isTwins },
    { formKey: 't2_ducVen',   payloadPath: 'doppler2.ducVen',   outType: 'trim',    onlyWhen: () => isTwins },
    // ── T2 integer (heart rate) ───────────────────────────────────────────────
    { formKey: 't2_heart_rate', payloadPath: 'twin2_ultrasound.heart_rate', outType: 'integer', onlyWhen: () => isTwins },
    // ── FT T1 biometry ────────────────────────────────────────────────────────
    { formKey: 't1_ft_crl', payloadPath: 'ft_biometry.crl', outType: 'float',   onlyWhen: () => isFt },
    { formKey: 't1_ft_nt',  payloadPath: 'ft_biometry.nt',  outType: 'float',   onlyWhen: () => isFt },
    { formKey: 't1_ft_nb',  payloadPath: 'ft_biometry.nb',  outType: 'float',   onlyWhen: () => isFt },
    // ── FT T1 integer fields ─────────────────────────────────────────────────
    { formKey: 't1_ft_puls',      payloadPath: 'ft_biometry.puls',      outType: 'integer', onlyWhen: () => isFt },
    { formKey: 't1_ft_heartRate', payloadPath: 'ft_ultrasound.heartRate', outType: 'integer', onlyWhen: () => isFt },
    // ── FT T1 doppler ─────────────────────────────────────────────────────────
    { formKey: 't1_ft_utADexPI', payloadPath: 'ft_doppler.utADexPI', outType: 'float', onlyWhen: () => isFt },
    { formKey: 't1_ft_utADexRI', payloadPath: 'ft_doppler.utADexRI', outType: 'float', onlyWhen: () => isFt },
    { formKey: 't1_ft_utASinPI', payloadPath: 'ft_doppler.utASinPI', outType: 'float', onlyWhen: () => isFt },
    { formKey: 't1_ft_utASinRI', payloadPath: 'ft_doppler.utASinRI', outType: 'float', onlyWhen: () => isFt },
    // ── FT T2 biometry ────────────────────────────────────────────────────────
    { formKey: 't2_ft_crl', payloadPath: 'twin2_ft_biometry.crl', outType: 'float',   onlyWhen: () => isFtTwinsMode },
    { formKey: 't2_ft_nt',  payloadPath: 'twin2_ft_biometry.nt',  outType: 'float',   onlyWhen: () => isFtTwinsMode },
    { formKey: 't2_ft_nb',  payloadPath: 'twin2_ft_biometry.nb',  outType: 'float',   onlyWhen: () => isFtTwinsMode },
    // ── FT T2 integer fields ─────────────────────────────────────────────────
    { formKey: 't2_ft_puls',      payloadPath: 'twin2_ft_biometry.puls',      outType: 'integer', onlyWhen: () => isFtTwinsMode },
    { formKey: 't2_ft_heartRate', payloadPath: 'twin2_ft_ultrasound.heartRate', outType: 'integer', onlyWhen: () => isFtTwinsMode },
    // ── FT T2 doppler ─────────────────────────────────────────────────────────
    { formKey: 't2_ft_utADexPI', payloadPath: 'twin2_ft_doppler.utADexPI', outType: 'float', onlyWhen: () => isFtTwinsMode },
    { formKey: 't2_ft_utADexRI', payloadPath: 'twin2_ft_doppler.utADexRI', outType: 'float', onlyWhen: () => isFtTwinsMode },
    { formKey: 't2_ft_utASinPI', payloadPath: 'twin2_ft_doppler.utASinPI', outType: 'float', onlyWhen: () => isFtTwinsMode },
    { formKey: 't2_ft_utASinRI', payloadPath: 'twin2_ft_doppler.utASinRI', outType: 'float', onlyWhen: () => isFtTwinsMode },
  ];

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!validateForm()) return;
    setIsSubmitting(true);
    try {
      const fd = formData as unknown as Record<string, string>;

      // ── Generic assembler (ST-3) ──────────────────────────────────────────
      // Walks FIELD_REGISTRY, applies outType transform, writes into nested output.
      const assembled: Record<string, Record<string, unknown>> = {};
      for (const entry of FIELD_REGISTRY) {
        if (entry.onlyWhen && !entry.onlyWhen()) continue;
        const raw = fd[entry.formKey] ?? '';
        if (!raw || !raw.trim()) continue;
        let value: unknown;
        if (entry.outType === 'float') {
          value = parseFloat(raw);
          if (isNaN(value as number)) continue;
        } else if (entry.outType === 'integer') {
          value = Math.trunc(parseFloat(raw));
          if (isNaN(value as number)) continue;
        } else {
          // 'trim' or 'string'
          value = raw.trim() || undefined;
          if (!value) continue;
        }
        const [group, key] = entry.payloadPath.split('.');
        if (!assembled[group]) assembled[group] = {};
        assembled[group][key] = value;
      }

      // KI-009: Merge IsManual boolean flags into assembled biometry objects
      // (booleans are not handled by FIELD_REGISTRY which operates on string formData)
      const fmBool = formData as unknown as Record<string, boolean>;
      const bioIsManualFields = [
        'bpdPercentileIsManual', 'hcPercentileIsManual', 'acPercentileIsManual', 'flPercentileIsManual',
        'ofdPercentileIsManual', 'tadPercentileIsManual', 'apadPercentileIsManual', 'efwPercentileIsManual',
        'bpdGaIsManual', 'hcGaIsManual', 'acGaIsManual', 'flGaIsManual',
        'ofdGaIsManual', 'tadGaIsManual', 'apadGaIsManual', 'efwGaIsManual', 'efwIsManual',
        'gestationalAgeFromBiometryIsManual',
      ];
      if (assembled.biometry) {
        for (const key of bioIsManualFields) {
          if (fmBool[key]) assembled.biometry[key] = true;
        }
      }
      if (isTwins && assembled.biometry2) {
        for (const key of bioIsManualFields) {
          const t2Key = `t2_${key}`;
          if (fmBool[t2Key]) assembled.biometry2[key] = true;
        }
      }

      // ── Build structured payload from assembled groups ────────────────────
      const biometry = assembled.biometry
        ? (assembled.biometry as CreateExaminationRequest['biometry'])
        : undefined;
      const doppler = assembled.doppler ? {
        ...(assembled.doppler as Record<string, unknown>),
        ducVen: (assembled.doppler as Record<string, string>).ducVen,
      } as CreateExaminationRequest['doppler'] : undefined;

      const pregnancy_data = (
        formData.last_menstrual_period || formData.obstetric_history || formData.family_history
      ) ? {
        last_menstrual_period: formData.last_menstrual_period || undefined,
        obstetric_history: formData.obstetric_history.trim() || undefined,
        family_history: formData.family_history.trim() || undefined,
      } : undefined;

      const ultrasoundBase = assembled.ultrasound as Record<string, unknown> | undefined;
      const ultrasound_findings = (
        formData.presentation || formData.gender || formData.heart_rate ||
        formData.fetal_movement || formData.placenta || formData.umbilical_cord
      ) ? {
        presentation: formData.presentation.trim() || undefined,
        gender: formData.gender || undefined,
        heart_rate: ultrasoundBase?.heart_rate as number | undefined,
        fetal_movement: formData.fetal_movement.trim() || undefined,
        placenta: formData.placenta.trim() || undefined,
        umbilical_cord: formData.umbilical_cord.trim() || undefined,
      } : undefined;

      const anatomy = (
        formData.anat_head || formData.anat_brain || formData.anat_heart ||
        formData.anat_abdomen || formData.anat_kidneys || formData.anat_limbs ||
        formData.anat_skeleton || formData.anat_face || formData.anat_neckSkin ||
        formData.anat_spine || formData.anat_thorax
      ) ? {
        head: formData.anat_head.trim() || undefined, brain: formData.anat_brain.trim() || undefined,
        heart: formData.anat_heart.trim() || undefined, abdomen: formData.anat_abdomen.trim() || undefined,
        kidneys: formData.anat_kidneys.trim() || undefined, limbs: formData.anat_limbs.trim() || undefined,
        skeleton: formData.anat_skeleton.trim() || undefined, face: formData.anat_face.trim() || undefined,
        neckSkin: formData.anat_neckSkin.trim() || undefined, spine: formData.anat_spine.trim() || undefined,
        thorax: formData.anat_thorax.trim() || undefined,
      } : undefined;

      let biometry2: CreateExaminationRequest['biometry2'] | undefined;
      let doppler2: CreateExaminationRequest['doppler2'] | undefined;
      let twin2_ultrasound_findings: ExaminationData['twin2_ultrasound_findings'] | undefined;
      let twin2_anatomy: ExaminationData['twin2_anatomy'] | undefined;
      if (isTwins) {
        biometry2 = assembled.biometry2
          ? (assembled.biometry2 as CreateExaminationRequest['biometry2'])
          : undefined;
        doppler2 = assembled.doppler2 ? {
          ...(assembled.doppler2 as Record<string, unknown>),
          ducVen: (assembled.doppler2 as Record<string, string>).ducVen,
        } as CreateExaminationRequest['doppler2'] : undefined;
        const twin2UltraBase = assembled.twin2_ultrasound as Record<string, unknown> | undefined;
        twin2_ultrasound_findings = (
          formData.t2_presentation || formData.t2_gender || formData.t2_heart_rate ||
          formData.t2_fetal_movement || formData.t2_placenta || formData.t2_umbilical_cord
        ) ? {
          presentation: formData.t2_presentation.trim() || undefined,
          gender: formData.t2_gender || undefined,
          heart_rate: twin2UltraBase?.heart_rate as number | undefined,
          fetal_movement: formData.t2_fetal_movement.trim() || undefined,
          placenta: formData.t2_placenta.trim() || undefined,
          umbilical_cord: formData.t2_umbilical_cord.trim() || undefined,
        } : undefined;
        twin2_anatomy = (
          formData.t2_anat_head || formData.t2_anat_brain || formData.t2_anat_heart ||
          formData.t2_anat_abdomen || formData.t2_anat_kidneys || formData.t2_anat_limbs ||
          formData.t2_anat_skeleton || formData.t2_anat_face || formData.t2_anat_neckSkin ||
          formData.t2_anat_spine || formData.t2_anat_thorax
        ) ? {
          head: formData.t2_anat_head.trim() || undefined, brain: formData.t2_anat_brain.trim() || undefined,
          heart: formData.t2_anat_heart.trim() || undefined, abdomen: formData.t2_anat_abdomen.trim() || undefined,
          kidneys: formData.t2_anat_kidneys.trim() || undefined, limbs: formData.t2_anat_limbs.trim() || undefined,
          skeleton: formData.t2_anat_skeleton.trim() || undefined, face: formData.t2_anat_face.trim() || undefined,
          neckSkin: formData.t2_anat_neckSkin.trim() || undefined, spine: formData.t2_anat_spine.trim() || undefined,
          thorax: formData.t2_anat_thorax.trim() || undefined,
        } : undefined;
      }

      // UZPT — FT data assembly
      let ft_biometry: ExaminationData['ft_biometry'] | undefined;
      let ft_markers: ExaminationData['ft_markers'] | undefined;
      let ft_ultrasound: ExaminationData['ft_ultrasound'] | undefined;
      let ft_anatomy: ExaminationData['ft_anatomy'] | undefined;
      let ft_doppler: ExaminationData['ft_doppler'] | undefined;
      let twin2_ft_biometry: ExaminationData['twin2_ft_biometry'] | undefined;
      let twin2_ft_markers: ExaminationData['twin2_ft_markers'] | undefined;
      let twin2_ft_ultrasound: ExaminationData['twin2_ft_ultrasound'] | undefined;
      let twin2_ft_anatomy: ExaminationData['twin2_ft_anatomy'] | undefined;
      let twin2_ft_doppler: ExaminationData['twin2_ft_doppler'] | undefined;
      if (isFt) {
        const ftBiomAssembled = assembled.ft_biometry as Record<string, unknown> | undefined;
        const ftUltraAssembled = assembled.ft_ultrasound as Record<string, unknown> | undefined;
        ft_ultrasound = (fd.t1_ft_placenta || fd.t1_ft_heartRate || fd.t1_ft_umbilicalCord) ? {
          placenta: fd.t1_ft_placenta.trim() || undefined,
          heartRate: ftUltraAssembled?.heartRate as number | undefined,
          umbilicalCord: fd.t1_ft_umbilicalCord.trim() || undefined,
        } : undefined;
        ft_biometry = (fd.t1_ft_crl || fd.t1_ft_nt || fd.t1_ft_nb || fd.t1_ft_puls || fd.t1_ft_gaFromCrl || fd.t1_ft_gaFromBio) ? {
          crl: ftBiomAssembled?.crl as number | undefined,
          gaFromCrl: fd.t1_ft_gaFromCrl.trim() || undefined,
          gaFromCrlIsManual: fd.t1_ft_gaFromCrlIsManual ? true : undefined,
          nt: ftBiomAssembled?.nt as number | undefined,
          nb: ftBiomAssembled?.nb as number | undefined,
          puls: ftBiomAssembled?.puls as number | undefined,
          // KI-009: gaFromBio persisted in ft_biometry
          gaFromBio: fd.t1_ft_gaFromBio?.trim() || undefined,
        } : undefined;
        ft_markers = (fd.t1_ft_arrhythmia || fd.t1_ft_tricuspidRegurgitation || fd.t1_ft_abnormalDvFlow || fd.t1_ft_echogenicCardiacFocus || fd.t1_ft_singleUmbilicalArtery || fd.t1_ft_choroidPlexusCysts || fd.t1_ft_exomphalos || fd.t1_ft_megacystis || fd.t1_ft_markerPlacenta || fd.t1_ft_cordInsertion) ? {
          arrhythmia: fd.t1_ft_arrhythmia || undefined,
          tricuspidRegurgitation: fd.t1_ft_tricuspidRegurgitation || undefined,
          abnormalDvFlow: fd.t1_ft_abnormalDvFlow || undefined,
          echogenicCardiacFocus: fd.t1_ft_echogenicCardiacFocus || undefined,
          singleUmbilicalArtery: fd.t1_ft_singleUmbilicalArtery || undefined,
          choroidPlexusCysts: fd.t1_ft_choroidPlexusCysts || undefined,
          exomphalos: fd.t1_ft_exomphalos || undefined,
          megacystis: fd.t1_ft_megacystis || undefined,
          placenta: fd.t1_ft_markerPlacenta.trim() || undefined,
          cordInsertion: fd.t1_ft_cordInsertion.trim() || undefined,
        } : undefined;
        ft_anatomy = (fd.t1_anat_head || fd.t1_anat_brain || fd.t1_anat_heart || fd.t1_anat_abdomen || fd.t1_anat_kidneys || fd.t1_anat_limbs || fd.t1_anat_skeleton || fd.t1_anat_face || fd.t1_anat_neckSkin || fd.t1_anat_spine || fd.t1_anat_thorax) ? {
          head: fd.t1_anat_head.trim() || undefined, brain: fd.t1_anat_brain.trim() || undefined,
          heart: fd.t1_anat_heart.trim() || undefined, abdomen: fd.t1_anat_abdomen.trim() || undefined,
          kidneys: fd.t1_anat_kidneys.trim() || undefined, limbs: fd.t1_anat_limbs.trim() || undefined,
          skeleton: fd.t1_anat_skeleton.trim() || undefined, face: fd.t1_anat_face.trim() || undefined,
          neckSkin: fd.t1_anat_neckSkin.trim() || undefined, spine: fd.t1_anat_spine.trim() || undefined,
          thorax: fd.t1_anat_thorax.trim() || undefined,
        } : undefined;
        ft_doppler = assembled.ft_doppler ? (assembled.ft_doppler as ExaminationData['ft_doppler']) : undefined;
        if (isFtTwinsMode) {
          const t2FtBiomAssembled = assembled.twin2_ft_biometry as Record<string, unknown> | undefined;
          const t2FtUltraAssembled = assembled.twin2_ft_ultrasound as Record<string, unknown> | undefined;
          twin2_ft_ultrasound = (fd.t2_ft_placenta || fd.t2_ft_heartRate || fd.t2_ft_umbilicalCord) ? {
            placenta: fd.t2_ft_placenta.trim() || undefined,
            heartRate: t2FtUltraAssembled?.heartRate as number | undefined,
            umbilicalCord: fd.t2_ft_umbilicalCord.trim() || undefined,
          } : undefined;
          twin2_ft_biometry = (fd.t2_ft_crl || fd.t2_ft_nt || fd.t2_ft_nb || fd.t2_ft_puls || fd.t2_ft_gaFromCrl || fd.t2_ft_gaFromBio) ? {
            crl: t2FtBiomAssembled?.crl as number | undefined,
            gaFromCrl: fd.t2_ft_gaFromCrl.trim() || undefined,
            gaFromCrlIsManual: fd.t2_ft_gaFromCrlIsManual ? true : undefined,
            nt: t2FtBiomAssembled?.nt as number | undefined,
            nb: t2FtBiomAssembled?.nb as number | undefined,
            puls: t2FtBiomAssembled?.puls as number | undefined,
            // KI-009: gaFromBio persisted in twin2_ft_biometry
            gaFromBio: fd.t2_ft_gaFromBio?.trim() || undefined,
          } : undefined;
          twin2_ft_markers = (fd.t2_ft_arrhythmia || fd.t2_ft_tricuspidRegurgitation || fd.t2_ft_abnormalDvFlow || fd.t2_ft_echogenicCardiacFocus || fd.t2_ft_singleUmbilicalArtery || fd.t2_ft_choroidPlexusCysts || fd.t2_ft_exomphalos || fd.t2_ft_megacystis || fd.t2_ft_markerPlacenta || fd.t2_ft_cordInsertion) ? {
            arrhythmia: fd.t2_ft_arrhythmia || undefined,
            tricuspidRegurgitation: fd.t2_ft_tricuspidRegurgitation || undefined,
            abnormalDvFlow: fd.t2_ft_abnormalDvFlow || undefined,
            echogenicCardiacFocus: fd.t2_ft_echogenicCardiacFocus || undefined,
            singleUmbilicalArtery: fd.t2_ft_singleUmbilicalArtery || undefined,
            choroidPlexusCysts: fd.t2_ft_choroidPlexusCysts || undefined,
            exomphalos: fd.t2_ft_exomphalos || undefined,
            megacystis: fd.t2_ft_megacystis || undefined,
            placenta: fd.t2_ft_markerPlacenta.trim() || undefined,
            cordInsertion: fd.t2_ft_cordInsertion.trim() || undefined,
          } : undefined;
          twin2_ft_anatomy = (fd.t2_anat_head || fd.t2_anat_brain || fd.t2_anat_heart || fd.t2_anat_abdomen || fd.t2_anat_kidneys || fd.t2_anat_limbs || fd.t2_anat_skeleton || fd.t2_anat_face || fd.t2_anat_neckSkin || fd.t2_anat_spine || fd.t2_anat_thorax) ? {
            head: fd.t2_anat_head.trim() || undefined, brain: fd.t2_anat_brain.trim() || undefined,
            heart: fd.t2_anat_heart.trim() || undefined, abdomen: fd.t2_anat_abdomen.trim() || undefined,
            kidneys: fd.t2_anat_kidneys.trim() || undefined, limbs: fd.t2_anat_limbs.trim() || undefined,
            skeleton: fd.t2_anat_skeleton.trim() || undefined, face: fd.t2_anat_face.trim() || undefined,
            neckSkin: fd.t2_anat_neckSkin.trim() || undefined, spine: fd.t2_anat_spine.trim() || undefined,
            thorax: fd.t2_anat_thorax.trim() || undefined,
          } : undefined;
          twin2_ft_doppler = assembled.twin2_ft_doppler
            ? (assembled.twin2_ft_doppler as ExaminationData['twin2_ft_doppler'])
            : undefined;
        }
      }

      const ftDataKeys = isFt ? {
        ft_biometry, ft_markers, ft_ultrasound, ft_anatomy, ft_doppler,
        ...(isFtTwinsMode ? { twin2_ft_biometry, twin2_ft_markers, twin2_ft_ultrasound, twin2_ft_anatomy, twin2_ft_doppler } : {}),
      } : {};

      const data: ExaminationData | undefined = (pregnancy_data || ultrasound_findings || anatomy || formData.comments.trim() || twin2_ultrasound_findings || twin2_anatomy || isFt) ? {
        pregnancy_data,
        ...(!isFt ? { ultrasound_findings, anatomy } : {}),
        ...(isTwins ? { twin2_ultrasound_findings, twin2_anatomy } : {}),
        ...ftDataKeys,
        comments: formData.comments.trim() || undefined,
      } : undefined;

      const submitData: CreateExaminationRequest | UpdateExaminationRequest = {
        ...(isEdit ? {} : { patientId: formData.patientId }),
        examDate: formData.examDate,
        gestationalAge: formData.gestationalAge.trim() || undefined,
        gestationalAgeIsManual: formData.gestationalAgeIsManual || undefined,
        // For FT types, biometry/doppler/gestationalAgeFromBiometry are not emitted
        ...(!isFt ? {
          gestationalAgeFromBiometry: formData.gestationalAgeFromBiometry.trim() || undefined,
          biometry,
          doppler,
        } : {}),
        status: formData.status,
        examinationType: formData.examinationType || 'ultrasound_prenatal',
        ...(isTwins ? {
          biometry2,
          doppler2,
          gestationalAgeFromBiometry2: formData.t2_gestationalAgeFromBiometry.trim() || undefined,
        } : {}),
        notes: formData.notes.trim() || undefined,
        findings: formData.findings.trim() || undefined,
        data,
        ...(patientAge !== undefined ? { patientAgeAtExam: patientAge } : {}),
      } as CreateExaminationRequest | UpdateExaminationRequest;

      await onSubmit(submitData);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    formData,
    errors,
    isSubmitting,
    submitError,
    setSubmitError,
    isTwins,
    isFt,
    isFtTwinsMode,
    edd,
    handleChange,
    handleChangeT1,
    handleSubmit,
    visibility,
    patientAge,
  };
}

// Made with Bob
