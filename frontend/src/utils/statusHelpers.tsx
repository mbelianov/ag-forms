import { Tag } from '@carbon/react';

type ExaminationStatus = 'draft' | 'completed' | 'reviewed';

const STATUS_CONFIG: Record<ExaminationStatus, { type: 'gray' | 'green' | 'blue'; label: string }> = {
  draft: { type: 'gray', label: 'Draft' },
  completed: { type: 'green', label: 'Completed' },
  reviewed: { type: 'blue', label: 'Reviewed' },
};

export function getStatusTag(status: string) {
  const config = STATUS_CONFIG[status as ExaminationStatus] ?? STATUS_CONFIG.draft;
  return <Tag type={config.type}>{config.label}</Tag>;
}

// Made with Bob
