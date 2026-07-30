/**
 * UltrasoundFindingsSection — generic per-fetus ultrasound findings form section.
 * Parameterised by `prefix` so DOM ids remain unique when two instances coexist.
 * Has no knowledge of twin logic.
 */
import { TextInput, Select, SelectItem, FormGroup } from '@carbon/react';

export interface UltrasoundFindingsSectionFormData {
  presentation: string;
  gender: string;
  heart_rate: string;
  fetal_movement: string;
  placenta: string;
  umbilical_cord: string;
}

interface UltrasoundFindingsSectionProps {
  prefix: string; // e.g. "t1" or "t2"
  data: UltrasoundFindingsSectionFormData;
  errors: Record<string, string>;
  onChange: (field: string, value: string) => void;
  isSubmitting: boolean;
  columns?: 2 | 3 | 4 | 6;
}

export default function UltrasoundFindingsSection({ prefix, data, errors, onChange, isSubmitting, columns = 6 }: UltrasoundFindingsSectionProps) {
  const p = (field: string) => `${prefix}_${field}`;
  const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: '0.75rem' };

  return (
    <FormGroup legendText="">
      <div style={gridStyle}>
        <Select id={p('presentation')} labelText="Presentation" value={data.presentation} onChange={(e) => onChange(p('presentation'), e.target.value)} disabled={isSubmitting}>
          <SelectItem value="" text="Select presentation" />
          <SelectItem value="cephalic" text="Cephalic" />
          <SelectItem value="breech" text="Breech" />
          <SelectItem value="transverse" text="Transverse" />
          <SelectItem value="oblique" text="Oblique" />
        </Select>
        <Select id={p('gender')} labelText="Gender" value={data.gender} onChange={(e) => onChange(p('gender'), e.target.value)} disabled={isSubmitting}>
          <SelectItem value="" text="Select gender" />
          <SelectItem value="male" text="Male" />
          <SelectItem value="female" text="Female" />
          <SelectItem value="unknown" text="Unknown" />
        </Select>
        <TextInput id={p('heart_rate')} labelText="FHR (bpm)" placeholder="e.g., 145" value={data.heart_rate}
          onChange={(e) => onChange(p('heart_rate'), e.target.value)}
          invalid={!!errors[p('heart_rate')]} invalidText={errors[p('heart_rate')]} disabled={isSubmitting} />
        <Select id={p('fetal_movement')} labelText="Fetal Movement" value={data.fetal_movement} onChange={(e) => onChange(p('fetal_movement'), e.target.value)} disabled={isSubmitting}>
          <SelectItem value="" text="Select fetal movement" />
          <SelectItem value="active" text="Active" />
          <SelectItem value="present" text="Present" />
          <SelectItem value="reduced" text="Reduced" />
          <SelectItem value="absent" text="Absent" />
        </Select>
        <TextInput id={p('placenta')} labelText="Placenta" placeholder="e.g., anterior, grade 1" value={data.placenta}
          onChange={(e) => onChange(p('placenta'), e.target.value)} disabled={isSubmitting} />
        <TextInput id={p('umbilical_cord')} labelText="Umbilical Cord" placeholder="e.g., 3 vessels" value={data.umbilical_cord}
          onChange={(e) => onChange(p('umbilical_cord'), e.target.value)} disabled={isSubmitting} />
      </div>
    </FormGroup>
  );
}

// Made with Bob
