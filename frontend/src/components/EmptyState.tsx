import { Button } from '@carbon/react';

interface EmptyStateProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({ message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div
      style={{ textAlign: 'center', padding: '2rem', color: '#525252' }}
      role="status"
      aria-live="polite"
    >
      <p>{message}</p>
      {actionLabel && onAction && (
        <Button
          kind="tertiary"
          size="sm"
          onClick={onAction}
          style={{ marginTop: '1rem' }}
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

// Made with Bob
