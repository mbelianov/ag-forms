/**
 * AnatomySection — generic per-fetus anatomy form section.
 * Parameterised by `prefix` so DOM ids remain unique when two instances coexist.
 * Has no knowledge of twin logic.
 */
import { TextInput, FormGroup } from '@carbon/react';

export interface AnatomySectionFormData {
  anat_head: string;
  anat_brain: string;
  anat_heart: string;
  anat_abdomen: string;
  anat_kidneys: string;
  anat_limbs: string;
  anat_skeleton: string;
  anat_face: string;
  anat_neckSkin: string;
  anat_spine: string;
  anat_thorax: string;
}

interface AnatomySectionProps {
  prefix: string; // e.g. "t1" or "t2"
  data: AnatomySectionFormData;
  errors: Record<string, string>;
  onChange: (field: string, value: string) => void;
  isSubmitting: boolean;
  columns?: 4 | 6;
}

export default function AnatomySection({ prefix, data, onChange, isSubmitting, columns = 6 }: AnatomySectionProps) {
  const p = (field: string) => `${prefix}_${field}`;
  const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: '0.75rem' };

  return (
    <FormGroup legendText="">
      <div style={gridStyle}>
        <TextInput id={p('anat_head')}     labelText="Head"      placeholder="e.g., normal" value={data.anat_head}     onChange={(e) => onChange(p('anat_head'),     e.target.value)} disabled={isSubmitting} />
        <TextInput id={p('anat_brain')}    labelText="Brain"     placeholder="e.g., normal" value={data.anat_brain}    onChange={(e) => onChange(p('anat_brain'),    e.target.value)} disabled={isSubmitting} />
        <TextInput id={p('anat_heart')}    labelText="Heart"     placeholder="e.g., normal" value={data.anat_heart}    onChange={(e) => onChange(p('anat_heart'),    e.target.value)} disabled={isSubmitting} />
        <TextInput id={p('anat_abdomen')}  labelText="Abdomen"   placeholder="e.g., normal" value={data.anat_abdomen}  onChange={(e) => onChange(p('anat_abdomen'),  e.target.value)} disabled={isSubmitting} />
        <TextInput id={p('anat_kidneys')}  labelText="Kidneys"   placeholder="e.g., normal" value={data.anat_kidneys}  onChange={(e) => onChange(p('anat_kidneys'),  e.target.value)} disabled={isSubmitting} />
        <TextInput id={p('anat_limbs')}    labelText="Limbs"     placeholder="e.g., normal" value={data.anat_limbs}    onChange={(e) => onChange(p('anat_limbs'),    e.target.value)} disabled={isSubmitting} />
        <TextInput id={p('anat_skeleton')} labelText="Skeleton"  placeholder="e.g., normal" value={data.anat_skeleton} onChange={(e) => onChange(p('anat_skeleton'), e.target.value)} disabled={isSubmitting} />
        <TextInput id={p('anat_face')}     labelText="Face"      placeholder="e.g., normal" value={data.anat_face}     onChange={(e) => onChange(p('anat_face'),     e.target.value)} disabled={isSubmitting} />
        <TextInput id={p('anat_neckSkin')} labelText="Neck Skin" placeholder="e.g., normal" value={data.anat_neckSkin} onChange={(e) => onChange(p('anat_neckSkin'), e.target.value)} disabled={isSubmitting} />
        <TextInput id={p('anat_spine')}    labelText="Spine"     placeholder="e.g., normal" value={data.anat_spine}    onChange={(e) => onChange(p('anat_spine'),    e.target.value)} disabled={isSubmitting} />
        <TextInput id={p('anat_thorax')}   labelText="Thorax"    placeholder="e.g., normal" value={data.anat_thorax}   onChange={(e) => onChange(p('anat_thorax'),   e.target.value)} disabled={isSubmitting} />
      </div>
    </FormGroup>
  );
}

// Made with Bob
