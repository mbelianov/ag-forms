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
    vp: examination?.biometry?.vp != null ? examination.biometry.vp.toFixed(2) : '',
    tcd: examination?.biometry?.tcd != null ? examination.biometry.tcd.toFixed(2) : '',
    cm: examination?.biometry?.cm != null ? examination.biometry.cm.toFixed(2) : '',
    nuchalFold: examination?.biometry?.nuchalFold != null ? examination.biometry.nuchalFold.toFixed(2) : '',
    nb: examination?.biometry?.nb != null ? examination.biometry.nb.toFixed(2) : '',
    apad: examination?.biometry?.apad != null ? examination.biometry.apad.toFixed(2) : '',
    tad: examination?.biometry?.tad != null ? examination.biometry.tad.toFixed(2) : '',
    la: examination?.biometry?.la != null ? examination.biometry.la.toFixed(2) : '',
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
    t2_vp: examination?.biometry2?.vp != null ? examination.biometry2.vp.toFixed(2) : '',
    t2_tcd: examination?.biometry2?.tcd != null ? examination.biometry2.tcd.toFixed(2) : '',
    t2_cm: examination?.biometry2?.cm != null ? examination.biometry2.cm.toFixed(2) : '',
    t2_nuchalFold: examination?.biometry2?.nuchalFold != null ? examination.biometry2.nuchalFold.toFixed(2) : '',
    t2_nb: examination?.biometry2?.nb != null ? examination.biometry2.nb.toFixed(2) : '',
    t2_apad: examination?.biometry2?.apad != null ? examination.biometry2.apad.toFixed(2) : '',
    t2_tad: examination?.biometry2?.tad != null ? examination.biometry2.tad.toFixed(2) : '',
    t2_la: examination?.biometry2?.la != null ? examination.biometry2.la.toFixed(2) : '',
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
        bpd: examination.biometry?.bpd?.toString() || '',
        hc: examination.biometry?.hc?.toString() || '',
        ac: examination.biometry?.ac?.toString() || '',
        fl: examination.biometry?.fl?.toString() || '',
        efw: examination.biometry?.efw?.toString() || '',
        ofd: examination.biometry?.ofd?.toString() || '',
        vp: examination.biometry?.vp?.toString() || '',
        tcd: examination.biometry?.tcd?.toString() || '',
        cm: examination.biometry?.cm?.toString() || '',
        nuchalFold: examination.biometry?.nuchalFold?.toString() || '',
        nb: examination.biometry?.nb?.toString() || '',
        apad: examination.biometry?.apad?.toString() || '',
        tad: examination.biometry?.tad?.toString() || '',
        la: examination.biometry?.la?.toString() || '',
        lc: examination.biometry?.lc?.toString() || '',
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
        t2_bpd: examination.biometry2?.bpd?.toString() || '',
        t2_hc: examination.biometry2?.hc?.toString() || '',
        t2_ac: examination.biometry2?.ac?.toString() || '',
        t2_fl: examination.biometry2?.fl?.toString() || '',
        t2_efw: examination.biometry2?.efw?.toString() || '',
        t2_ofd: examination.biometry2?.ofd?.toString() || '',
        t2_vp: examination.biometry2?.vp?.toString() || '',
        t2_tcd: examination.biometry2?.tcd?.toString() || '',
        t2_cm: examination.biometry2?.cm?.toString() || '',
        t2_nuchalFold: examination.biometry2?.nuchalFold?.toString() || '',
        t2_nb: examination.biometry2?.nb?.toString() || '',
        t2_apad: examination.biometry2?.apad?.toString() || '',
        t2_tad: examination.biometry2?.tad?.toString() || '',
        t2_la: examination.biometry2?.la?.toString() || '',
        t2_lc: examination.biometry2?.lc?.toString() || '',
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

  // ── Validation ────────────────────────────────────────────────────────────
  const gaRegex = /^\d{1,2}w\s?\d{1}d$/;

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

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

    if (formData.gestationalAge && !gaRegex.test(formData.gestationalAge))
      newErrors.gestationalAge = 'Format must be "28w 3d"';

    if (formData.gestationalAgeFromBiometry && !gaRegex.test(formData.gestationalAgeFromBiometry))
      newErrors.gestationalAgeFromBiometry = 'Format must be "28w 3d"';

    const biometryFields = ['bpd', 'hc', 'ac', 'fl', 'efw', 'ofd', 'vp', 'tcd', 'cm', 'nuchalFold', 'nb', 'apad', 'tad', 'la', 'lc'];
    biometryFields.forEach(field => {
      const value = formData[field as keyof typeof formData] as string;
      if (value && value.trim()) {
        const parsed = parseFloat(value);
        if (isNaN(parsed) || !isFinite(parsed) || parsed <= 0) newErrors[field] = 'Must be a positive number';
      }
    });

    const dopplerFields = ['pi', 'ri', 'utADexPI', 'utADexRI', 'utASinPI', 'utASinRI', 'cma', 'psv', 'cpr'];
    dopplerFields.forEach(field => {
      const value = formData[field as keyof typeof formData] as string;
      if (value && value.trim()) {
        const parsed = parseFloat(value);
        if (isNaN(parsed) || parsed < 0) newErrors[field] = 'Must be a valid number';
      }
    });

    if (formData.heart_rate && formData.heart_rate.trim()) {
      const parsed = parseInt(formData.heart_rate);
      if (isNaN(parsed) || parsed.toString() !== formData.heart_rate.trim()) {
        newErrors.heart_rate = 'Must be a whole number (bpm)';
      } else if (parsed <= 0) {
        newErrors.heart_rate = 'Must be a positive number';
      }
    }

    if (isTwins) {
      const t2BiometryFields = ['t2_bpd', 't2_hc', 't2_ac', 't2_fl', 't2_efw', 't2_ofd', 't2_vp', 't2_tcd', 't2_cm', 't2_nuchalFold', 't2_nb', 't2_apad', 't2_tad', 't2_la', 't2_lc'];
      t2BiometryFields.forEach(field => {
        const value = formData[field as keyof typeof formData] as string;
        if (value && value.trim()) {
          const parsed = parseFloat(value);
          if (isNaN(parsed) || !isFinite(parsed) || parsed <= 0) newErrors[field] = 'Must be a positive number';
        }
      });
      if (formData.t2_gestationalAgeFromBiometry && !gaRegex.test(formData.t2_gestationalAgeFromBiometry))
        newErrors.t2_gestationalAgeFromBiometry = 'Format must be "28w 3d"';
      const t2DopplerFields = ['t2_pi', 't2_ri', 't2_utADexPI', 't2_utADexRI', 't2_utASinPI', 't2_utASinRI', 't2_cma', 't2_psv', 't2_cpr'];
      t2DopplerFields.forEach(field => {
        const value = formData[field as keyof typeof formData] as string;
        if (value && value.trim()) {
          const parsed = parseFloat(value);
          if (isNaN(parsed) || parsed < 0) newErrors[field] = 'Must be a valid number';
        }
      });
      if (formData.t2_heart_rate && formData.t2_heart_rate.trim()) {
        const parsed = parseInt(formData.t2_heart_rate);
        if (isNaN(parsed) || parsed.toString() !== formData.t2_heart_rate.trim()) {
          newErrors.t2_heart_rate = 'Must be a whole number (bpm)';
        } else if (parsed <= 0) {
          newErrors.t2_heart_rate = 'Must be a positive number';
        }
      }
    }

    if (isFt) {
      const ftFloatFields = ['t1_ft_crl', 't1_ft_nt', 't1_ft_nb'];
      ftFloatFields.forEach(field => {
        const value = formData[field as keyof typeof formData] as string;
        if (value && value.trim()) {
          const parsed = parseFloat(value);
          if (isNaN(parsed) || parsed <= 0) newErrors[field] = 'Must be a positive number';
        }
      });
      const ftIntFields = ['t1_ft_puls', 't1_ft_heartRate'];
      ftIntFields.forEach(field => {
        const value = formData[field as keyof typeof formData] as string;
        if (value && value.trim()) {
          const parsed = parseInt(value);
          if (isNaN(parsed) || parsed <= 0) newErrors[field] = 'Must be a positive whole number';
        }
      });
      if (formData.t1_ft_gaFromCrl && !gaRegex.test(formData.t1_ft_gaFromCrl))
        newErrors.t1_ft_gaFromCrl = 'Format must be "12w 3d"';
      const ftDopplerFields = ['t1_ft_utADexPI', 't1_ft_utADexRI', 't1_ft_utASinPI', 't1_ft_utASinRI'];
      ftDopplerFields.forEach(field => {
        const value = formData[field as keyof typeof formData] as string;
        if (value && value.trim()) {
          const parsed = parseFloat(value);
          if (isNaN(parsed) || parsed < 0) newErrors[field] = 'Must be a valid number';
        }
      });
      if (isFtTwinsMode) {
        const t2FtFloatFields = ['t2_ft_crl', 't2_ft_nt', 't2_ft_nb'];
        t2FtFloatFields.forEach(field => {
          const value = formData[field as keyof typeof formData] as string;
          if (value && value.trim()) {
            const parsed = parseFloat(value);
            if (isNaN(parsed) || parsed <= 0) newErrors[field] = 'Must be a positive number';
          }
        });
        const t2FtIntFields = ['t2_ft_puls', 't2_ft_heartRate'];
        t2FtIntFields.forEach(field => {
          const value = formData[field as keyof typeof formData] as string;
          if (value && value.trim()) {
            const parsed = parseInt(value);
            if (isNaN(parsed) || parsed <= 0) newErrors[field] = 'Must be a positive whole number';
          }
        });
        if (formData.t2_ft_gaFromCrl && !gaRegex.test(formData.t2_ft_gaFromCrl))
          newErrors.t2_ft_gaFromCrl = 'Format must be "12w 3d"';
        const t2FtDopplerFields = ['t2_ft_utADexPI', 't2_ft_utADexRI', 't2_ft_utASinPI', 't2_ft_utASinRI'];
        t2FtDopplerFields.forEach(field => {
          const value = formData[field as keyof typeof formData] as string;
          if (value && value.trim()) {
            const parsed = parseFloat(value);
            if (isNaN(parsed) || parsed < 0) newErrors[field] = 'Must be a valid number';
          }
        });
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!validateForm()) return;
    setIsSubmitting(true);
    try {
      const floatOrUndef = (v: string) => (v && v.trim() ? parseFloat(v) : undefined);

      const biometry = (
        formData.bpd || formData.hc || formData.ac || formData.fl || formData.efw ||
        formData.ofd || formData.vp || formData.tcd || formData.cm || formData.nuchalFold ||
        formData.nb || formData.apad || formData.tad || formData.la || formData.lc
      ) ? {
        bpd: floatOrUndef(formData.bpd), hc: floatOrUndef(formData.hc),
        ac: floatOrUndef(formData.ac), fl: floatOrUndef(formData.fl),
        efw: floatOrUndef(formData.efw), ofd: floatOrUndef(formData.ofd),
        vp: floatOrUndef(formData.vp), tcd: floatOrUndef(formData.tcd),
        cm: floatOrUndef(formData.cm), nuchalFold: floatOrUndef(formData.nuchalFold),
        nb: floatOrUndef(formData.nb), apad: floatOrUndef(formData.apad),
        tad: floatOrUndef(formData.tad), la: floatOrUndef(formData.la),
        lc: floatOrUndef(formData.lc),
      } : undefined;

      const doppler = (
        formData.pi || formData.ri ||
        formData.utADexPI || formData.utADexRI || formData.utASinPI || formData.utASinRI ||
        formData.cma || formData.psv || formData.cpr || formData.ducVen
      ) ? {
        pi: floatOrUndef(formData.pi), ri: floatOrUndef(formData.ri),
        utADexPI: floatOrUndef(formData.utADexPI), utADexRI: floatOrUndef(formData.utADexRI),
        utASinPI: floatOrUndef(formData.utASinPI), utASinRI: floatOrUndef(formData.utASinRI),
        cma: floatOrUndef(formData.cma), psv: floatOrUndef(formData.psv),
        cpr: floatOrUndef(formData.cpr), ducVen: formData.ducVen.trim() || undefined,
      } : undefined;

      const pregnancy_data = (
        formData.last_menstrual_period || formData.obstetric_history || formData.family_history
      ) ? {
        last_menstrual_period: formData.last_menstrual_period || undefined,
        obstetric_history: formData.obstetric_history.trim() || undefined,
        family_history: formData.family_history.trim() || undefined,
      } : undefined;

      const ultrasound_findings = (
        formData.presentation || formData.gender || formData.heart_rate ||
        formData.fetal_movement || formData.placenta || formData.umbilical_cord
      ) ? {
        presentation: formData.presentation.trim() || undefined,
        gender: formData.gender || undefined,
        heart_rate: formData.heart_rate ? parseInt(formData.heart_rate) : undefined,
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
        biometry2 = (
          formData.t2_bpd || formData.t2_hc || formData.t2_ac || formData.t2_fl || formData.t2_efw ||
          formData.t2_ofd || formData.t2_vp || formData.t2_tcd || formData.t2_cm || formData.t2_nuchalFold ||
          formData.t2_nb || formData.t2_apad || formData.t2_tad || formData.t2_la || formData.t2_lc
        ) ? {
          bpd: floatOrUndef(formData.t2_bpd), hc: floatOrUndef(formData.t2_hc),
          ac: floatOrUndef(formData.t2_ac), fl: floatOrUndef(formData.t2_fl),
          efw: floatOrUndef(formData.t2_efw), ofd: floatOrUndef(formData.t2_ofd),
          vp: floatOrUndef(formData.t2_vp), tcd: floatOrUndef(formData.t2_tcd),
          cm: floatOrUndef(formData.t2_cm), nuchalFold: floatOrUndef(formData.t2_nuchalFold),
          nb: floatOrUndef(formData.t2_nb), apad: floatOrUndef(formData.t2_apad),
          tad: floatOrUndef(formData.t2_tad), la: floatOrUndef(formData.t2_la),
          lc: floatOrUndef(formData.t2_lc),
        } : undefined;
        doppler2 = (
          formData.t2_pi || formData.t2_ri ||
          formData.t2_utADexPI || formData.t2_utADexRI || formData.t2_utASinPI || formData.t2_utASinRI ||
          formData.t2_cma || formData.t2_psv || formData.t2_cpr || formData.t2_ducVen
        ) ? {
          pi: floatOrUndef(formData.t2_pi), ri: floatOrUndef(formData.t2_ri),
          utADexPI: floatOrUndef(formData.t2_utADexPI), utADexRI: floatOrUndef(formData.t2_utADexRI),
          utASinPI: floatOrUndef(formData.t2_utASinPI), utASinRI: floatOrUndef(formData.t2_utASinRI),
          cma: floatOrUndef(formData.t2_cma), psv: floatOrUndef(formData.t2_psv),
          cpr: floatOrUndef(formData.t2_cpr), ducVen: formData.t2_ducVen.trim() || undefined,
        } : undefined;
        twin2_ultrasound_findings = (
          formData.t2_presentation || formData.t2_gender || formData.t2_heart_rate ||
          formData.t2_fetal_movement || formData.t2_placenta || formData.t2_umbilical_cord
        ) ? {
          presentation: formData.t2_presentation.trim() || undefined,
          gender: formData.t2_gender || undefined,
          heart_rate: formData.t2_heart_rate ? parseInt(formData.t2_heart_rate) : undefined,
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
        const fd = formData as Record<string, string>;
        ft_ultrasound = (fd.t1_ft_placenta || fd.t1_ft_heartRate || fd.t1_ft_umbilicalCord) ? {
          placenta: fd.t1_ft_placenta.trim() || undefined,
          heartRate: fd.t1_ft_heartRate ? parseInt(fd.t1_ft_heartRate) : undefined,
          umbilicalCord: fd.t1_ft_umbilicalCord.trim() || undefined,
        } : undefined;
        ft_biometry = (fd.t1_ft_crl || fd.t1_ft_nt || fd.t1_ft_nb || fd.t1_ft_puls || fd.t1_ft_gaFromCrl) ? {
          crl: floatOrUndef(fd.t1_ft_crl),
          gaFromCrl: fd.t1_ft_gaFromCrl.trim() || undefined,
          nt: floatOrUndef(fd.t1_ft_nt),
          nb: floatOrUndef(fd.t1_ft_nb),
          puls: fd.t1_ft_puls ? parseInt(fd.t1_ft_puls) : undefined,
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
        ft_doppler = (fd.t1_ft_utADexPI || fd.t1_ft_utADexRI || fd.t1_ft_utASinPI || fd.t1_ft_utASinRI) ? {
          utADexPI: floatOrUndef(fd.t1_ft_utADexPI),
          utADexRI: floatOrUndef(fd.t1_ft_utADexRI),
          utASinPI: floatOrUndef(fd.t1_ft_utASinPI),
          utASinRI: floatOrUndef(fd.t1_ft_utASinRI),
        } : undefined;
        if (isFtTwinsMode) {
          twin2_ft_ultrasound = (fd.t2_ft_placenta || fd.t2_ft_heartRate || fd.t2_ft_umbilicalCord) ? {
            placenta: fd.t2_ft_placenta.trim() || undefined,
            heartRate: fd.t2_ft_heartRate ? parseInt(fd.t2_ft_heartRate) : undefined,
            umbilicalCord: fd.t2_ft_umbilicalCord.trim() || undefined,
          } : undefined;
          twin2_ft_biometry = (fd.t2_ft_crl || fd.t2_ft_nt || fd.t2_ft_nb || fd.t2_ft_puls || fd.t2_ft_gaFromCrl) ? {
            crl: floatOrUndef(fd.t2_ft_crl),
            gaFromCrl: fd.t2_ft_gaFromCrl.trim() || undefined,
            nt: floatOrUndef(fd.t2_ft_nt),
            nb: floatOrUndef(fd.t2_ft_nb),
            puls: fd.t2_ft_puls ? parseInt(fd.t2_ft_puls) : undefined,
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
          twin2_ft_doppler = (fd.t2_ft_utADexPI || fd.t2_ft_utADexRI || fd.t2_ft_utASinPI || fd.t2_ft_utASinRI) ? {
            utADexPI: floatOrUndef(fd.t2_ft_utADexPI),
            utADexRI: floatOrUndef(fd.t2_ft_utADexRI),
            utASinPI: floatOrUndef(fd.t2_ft_utASinPI),
            utASinRI: floatOrUndef(fd.t2_ft_utASinRI),
          } : undefined;
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
