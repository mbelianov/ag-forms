/**
 * useExaminationForm — custom hook extracted from ExaminationForm.tsx (Sub-Task 0a).
 * Contains all non-JSX logic: state, useEffect edit-load, derived values,
 * calc handlers, validation, submit, and handleChange helpers.
 * The component file ExaminationForm.tsx becomes a thin JSX shell that calls this hook.
 */
import { useState, useEffect } from 'react';
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
    gestationalAgeFromBiometry: examination?.gestationalAgeFromBiometry || '', // GA from Biometry
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
        gestationalAgeFromBiometry: examination.gestationalAgeFromBiometry || '',
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
  const canCalcGAFromLMP = !!(formData.last_menstrual_period && formData.examDate);
  const edd = calcEDD(formData.last_menstrual_period);

  const visibility = getSectionVisibility(formData.examinationType);
  const selectedPatient = patients.find((p) => p.patientId === formData.patientId);
  const patientAge = calculateAgeAtDate(selectedPatient?.birthDate ?? '', formData.examDate);

  // ── Calc handlers ──────────────────────────────────────────────────────────
  const handleCalcGAFromLMP = () => {
    const result = calcGAFromLMP(formData.last_menstrual_period, formData.examDate);
    if (result) handleChange('gestationalAge', result);
  };

  // ── handleChange / handleChangeT1 ─────────────────────────────────────────
  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
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
    const fd = formData as Record<string, string>;
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
      const fd = formData as Record<string, string>;

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
        ft_biometry = (fd.t1_ft_crl || fd.t1_ft_nt || fd.t1_ft_nb || fd.t1_ft_puls || fd.t1_ft_gaFromCrl) ? {
          crl: ftBiomAssembled?.crl as number | undefined,
          gaFromCrl: fd.t1_ft_gaFromCrl.trim() || undefined,
          nt: ftBiomAssembled?.nt as number | undefined,
          nb: ftBiomAssembled?.nb as number | undefined,
          puls: ftBiomAssembled?.puls as number | undefined,
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
          twin2_ft_biometry = (fd.t2_ft_crl || fd.t2_ft_nt || fd.t2_ft_nb || fd.t2_ft_puls || fd.t2_ft_gaFromCrl) ? {
            crl: t2FtBiomAssembled?.crl as number | undefined,
            gaFromCrl: fd.t2_ft_gaFromCrl.trim() || undefined,
            nt: t2FtBiomAssembled?.nt as number | undefined,
            nb: t2FtBiomAssembled?.nb as number | undefined,
            puls: t2FtBiomAssembled?.puls as number | undefined,
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
    canCalcGAFromLMP,
    edd,
    handleCalcGAFromLMP,
    handleChange,
    handleChangeT1,
    handleSubmit,
    visibility,
    patientAge,
  };
}

// Made with Bob
